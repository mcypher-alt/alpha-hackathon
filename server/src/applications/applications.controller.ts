import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationStatus as S, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MlMockService } from './ml-mock.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  BankQueryDto,
  ClientActionDto,
  CreateApplicationDto,
  DocumentDto,
  IntentDto,
  InterveneDto,
} from './dto.js';
import {
  assertBank,
  assertBankTransition,
  assertClient,
  assertOwner,
  assertVersion,
  nextClientStatus,
} from './policy.js';
import { PRODUCT_CATALOG, validateProductRequest } from './catalog.js';
import { classifyIntent } from '../ml/scorer.js';
import { randomUUID } from 'node:crypto';

interface AuthRequest {
  user: { id: string; phone: string; role: UserRole };
}
const INCLUDE = {
  company: true,
  product: true,
  documents: true,
  statusHistory: { orderBy: { createdAt: 'desc' as const } },
};
const COMPLETED: S[] = [S.REJECTED, S.DISBURSED];

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlService: MlMockService,
  ) {}

  @Get('gosuslugi-mock')
  @ApiOperation({
    summary: 'Локальный синтетический профиль, без доступа к ФНС/ЕСИА',
  })
  getGosuslugiData(
    @Query('preset') preset: 'good' | 'medium' | 'risky' = 'good',
  ) {
    if (!['good', 'medium', 'risky'].includes(preset))
      throw new BadRequestException('Неизвестный профиль');
    return this.mlService.getGosuslugiEgrulProfile(preset);
  }

  @Post('intent')
  @ApiOperation({ summary: 'Локальная обученная классификация описания цели' })
  intent(@Body() body: IntentDto) {
    const p = classifyIntent(body.text);
    return { ...p, label: p.intent, abstained: p.needsClarification };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Валидация, обогащение, скоринг и решение по синтетической заявке',
  })
  async createApplication(
    @Req() req: AuthRequest,
    @Body() body: CreateApplicationDto,
  ) {
    assertClient(req.user.role);
    const {
      product: p,
      monthsOld,
      requiresSubscription,
    } = validateProductRequest(body);
    const existing = await this.prisma.company.findUnique({
      where: { inn: body.inn },
    });
    if (existing) assertOwner(existing.userId, req.user.id);
    const answers = body.answers ?? {};
    const chosenPurpose =
      body.purposeCode ??
      (answers.purpose === 'other'
        ? answers.confirmedPurpose
        : answers.purpose);
    const uncertainGoal = !chosenPurpose || chosenPurpose === 'other';
    const uncertainCollateral =
      (p.pledge === 'owned' && answers.collateral !== 'yes') ||
      (p.pledge === 'purchase' && answers.asset !== 'yes');
    const requiresManual =
      uncertainGoal ||
      uncertainCollateral ||
      p.code === 'C1' ||
      (monthsOld < 9 && p.code !== 'A1') ||
      requiresSubscription ||
      (p.code === 'M1' && answers.seller !== 'yes') ||
      (['R1', 'R2'].includes(p.code) &&
        !['single', 'line'].includes(answers.refi_type));
    const ml = this.mlService.evaluateApplication(
      {
        ...body,
        currentDebtLoad: body.currentDebtLoad ?? 0,
        registrationDate: new Date(body.registrationDate),
      },
      requiresManual,
    );
    const snapshot = JSON.parse(
      JSON.stringify({
        ...ml.scoringFactors.applicationSnapshot,
        answers,
        consent: true,
        consentAt: new Date().toISOString(),
        policyVersion: 'demo-policy-1',
        modelVersion: ml.scoringFactors.modelVersion,
        catalogVerifiedAt: p.verifiedAt,
        requiresSubscription,
      }),
    );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const currentCompany = await tx.company.findUnique({
            where: { inn: body.inn },
          });
          if (currentCompany) assertOwner(currentCompany.userId, req.user.id);
          const companyData = {
            name: body.companyName,
            legalForm: body.legalForm ?? 'ООО',
            okved: body.okved ?? '47.91',
            okvedTitle: body.okvedTitle ?? 'Коммерческая деятельность',
            registrationDate: new Date(body.registrationDate),
            monthlyRevenue: body.monthlyRevenue,
            monthlyExpenses: body.monthlyExpenses,
            currentDebtLoad: body.currentDebtLoad ?? 0,
            ogrn: body.ogrn ?? '1000000000000',
          };
          const company = await tx.company.upsert({
            where: { inn: body.inn },
            update: companyData,
            create: { ...companyData, inn: body.inn, userId: req.user.id },
          });
          const product = await tx.creditProduct.upsert({
            where: { code: p.code },
            update: {},
            create: {
              code: p.code,
              title: p.title,
              description: `Учебный каталог от ${p.verifiedAt}`,
              minAmount: p.min ?? 0,
              maxAmount: p.max,
              minTermMonths: p.minTerm,
              maxTermMonths: p.maxTerm,
              baseRate: p.baseRate,
              minScoringScore: 700,
            },
          });
          const stages: S[] = [
            S.SUBMITTED,
            S.VALIDATING,
            S.ENRICHING,
            S.SCORING,
            ml.recommendedStatus,
          ];
          const comments = [
            'Заявка отправлена клиентом. Согласие на обработку учебных данных получено.',
            'Проверены обязательные поля и ограничения продукта.',
            'Локальные симуляторы ФНС / ЕГРЮЛ / БКИ; реальные проверки не выполнялись.',
            'Риск оценён локальной моделью на синтетических данных.',
            ml.decisionNote,
          ];
          return tx.loanApplication.create({
            data: {
              companyId: company.id,
              productId: product.id,
              requestedAmount: body.requestedAmount,
              requestedTermMonths: body.requestedTermMonths,
              purpose: body.purpose,
              status: ml.recommendedStatus,
              scoringScore: ml.scoringScore,
              riskGrade: ml.riskGrade,
              enrichmentData: ml.enrichmentData,
              scoringFactors: JSON.parse(
                JSON.stringify({
                  ...ml.scoringFactors,
                  applicationSnapshot: snapshot,
                }),
              ) as Prisma.InputJsonValue,
              financialSnapshot: snapshot,
              approvedAmount: ml.approvedAmount,
              approvedTermMonths: ml.approvedTermMonths,
              approvedRate: ml.approvedRate,
              decisionNote: ml.decisionNote,
              statusHistory: {
                create: stages.map((status, i) => ({
                  fromStatus: i ? stages[i - 1] : S.DRAFT,
                  toStatus: status,
                  actorRole: i ? UserRole.ADMIN : UserRole.CLIENT,
                  changedById: i ? undefined : req.user.id,
                  comment: comments[i],
                  createdAt: new Date(Date.now() - stages.length + i),
                })),
              },
            },
            include: INCLUDE,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      return this.dbConflict(e);
    }
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyApplications(@Req() req: AuthRequest) {
    return this.prisma.loanApplication.findMany({
      where: { company: { userId: req.user.id } },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('bank/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getAllForBank(@Req() req: AuthRequest, @Query() query: BankQueryDto) {
    assertBank(req.user.role);
    const where: Prisma.LoanApplicationWhereInput = {};
    if (query.status) where.status = query.status;
    else if (query.completion === 'COMPLETED') where.status = { in: COMPLETED };
    else if (query.completion === 'IN_PROGRESS')
      where.status = { notIn: COMPLETED };
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo)
        where.createdAt.lte = new Date(
          query.dateTo.length === 10
            ? query.dateTo + 'T23:59:59.999Z'
            : query.dateTo,
        );
    }
    if (query.search)
      where.company = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { inn: { contains: query.search } },
        ],
      };
    return this.prisma.loanApplication.findMany({
      where,
      include: {
        ...INCLUDE,
        company: {
          include: {
            user: {
              select: { id: true, fullName: true, phone: true, position: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  @Patch('bank/:id/intervene')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async bankIntervene(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Body() body: InterveneDto,
  ) {
    assertBank(req.user.role);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.loanApplication.findUnique({
        where: { id },
        include: { product: true },
      });
      if (!current) throw new NotFoundException('Заявка не найдена');
      assertVersion(current, body);
      assertBankTransition(current.status, body.toStatus);
      const amount =
        body.approvedAmount ??
        Number(current.approvedAmount ?? current.requestedAmount);
      const term =
        body.approvedTermMonths ??
        current.approvedTermMonths ??
        current.requestedTermMonths;
      const rate = body.approvedRate ?? current.approvedRate ?? 21.5;
      if (
        [S.APPROVED, S.COUNTER_OFFER].includes(
          body.toStatus as typeof S.APPROVED,
        )
      ) {
        if (
          amount < Number(current.product.minAmount) ||
          amount > Number(current.product.maxAmount) ||
          amount > Number(current.requestedAmount) ||
          term < current.product.minTermMonths ||
          term > current.product.maxTermMonths ||
          rate < 1 ||
          rate > 60
        )
          throw new BadRequestException(
            'Условия вне лимитов продукта и заявки',
          );
      }
      await this.atomicTransition(
        tx,
        current,
        body.toStatus,
        req.user,
        body.decisionNote,
        {
          approvedAmount: body.toStatus === S.REJECTED ? 0 : amount,
          approvedTermMonths: term,
          approvedRate: body.toStatus === S.REJECTED ? 0 : rate,
        },
      );
      return tx.loanApplication.findUnique({ where: { id }, include: INCLUDE });
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getApplication(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    return this.access(id, req.user);
  }

  @Patch(':id/client-action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async handleClientAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Body() body: ClientActionDto,
  ) {
    assertClient(req.user.role);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.loanApplication.findUnique({
        where: { id },
        include: { company: true, product: true },
      });
      if (!current) throw new NotFoundException('Заявка не найдена');
      assertOwner(current.company.userId, req.user.id);
      assertVersion(current, body);
      const next = nextClientStatus(
        current.status,
        body.action,
        body.clientComment,
      );
      const note =
        body.action === 'SIGN_CONTRACT'
          ? 'Учебный договор подписан внутри продукта. Выдача средств смоделирована, реального перечисления нет.'
          : body.action === 'ACCEPT_OFFER'
            ? 'Клиент принял условия. Ожидается подписание учебного договора.'
            : `Клиент уточнил сведения: ${body.clientComment}`;
      await this.atomicTransition(tx, current, next, req.user, note);
      if (body.action === 'SIGN_CONTRACT')
        await tx.applicationDocument.create({
          data: {
            applicationId: id,
            type: 'CONTRACT',
            title: 'Учебный кредитный договор',
            fileUrl: `/applications/${id}`,
            isSigned: true,
            signedAt: new Date(),
            content: `УЧЕБНЫЙ ДОГОВОР. Не является офертой и юридически значимой подписью.\nКомпания: ${current.company.name}.\nПродукт: ${current.product.title}.\nСумма: ${current.approvedAmount} RUB. Срок: ${current.approvedTermMonths} мес. Демонстрационная ставка: ${current.approvedRate}% годовых.\nСогласие пользователя ${req.user.id} зафиксировано внутри продукта. Выдача средств смоделирована.`,
          },
        });
      return tx.loanApplication.findUnique({ where: { id }, include: INCLUDE });
    });
  }

  @Post(':id/documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
    @Body() body: DocumentDto,
  ) {
    assertClient(req.user.role);
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.loanApplication.findUnique({
        where: { id },
        include: { company: true },
      });
      if (!a) throw new NotFoundException('Заявка не найдена');
      assertOwner(a.company.userId, req.user.id);
      if (
        [S.REJECTED, S.DISBURSED, S.SIGNING].includes(
          a.status as typeof S.REJECTED,
        )
      )
        throw new ConflictException('Документы больше не принимаются');
      if (
        (await tx.applicationDocument.count({
          where: { applicationId: id },
        })) >= 20
      )
        throw new BadRequestException(
          'К заявке можно добавить до 20 документов',
        );
      await this.atomicTransition(
        tx,
        a,
        a.status,
        req.user,
        `Прикреплён учебный документ: ${body.title}`,
      );
      const documentId = randomUUID();
      return tx.applicationDocument.create({
        data: {
          ...body,
          id: documentId,
          applicationId: id,
          fileUrl: `/applications/${id}/documents/${documentId}`,
        },
      });
    });
  }

  @Get(':id/documents/:documentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: AuthRequest,
  ) {
    await this.access(id, req.user);
    const d = await this.prisma.applicationDocument.findFirst({
      where: { id: documentId, applicationId: id },
    });
    if (!d) throw new NotFoundException('Документ не найден');
    return d;
  }

  private async access(id: string, user: AuthRequest['user']) {
    const a = await this.prisma.loanApplication.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!a) throw new NotFoundException('Заявка не найдена');
    if (user.role === UserRole.CLIENT) assertOwner(a.company.userId, user.id);
    else assertBank(user.role);
    return a;
  }
  private async atomicTransition(
    tx: Prisma.TransactionClient,
    current: { id: string; status: S; version: number },
    toStatus: S,
    user: AuthRequest['user'],
    note: string,
    extra: Prisma.LoanApplicationUpdateManyMutationInput = {},
  ) {
    const changed = await tx.loanApplication.updateMany({
      where: {
        id: current.id,
        status: current.status,
        version: current.version,
      },
      data: {
        ...extra,
        status: toStatus,
        decisionNote: note,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      throw new ConflictException('Заявка уже изменилась. Обновите данные');
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: current.id,
        fromStatus: current.status,
        toStatus,
        actorRole: user.role,
        changedById: user.id,
        comment: note,
      },
    });
  }
  private dbConflict(e: unknown): never {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(e.code)
    )
      throw new ConflictException(
        'Конкурирующее изменение. Обновите данные и повторите отправку',
      );
    throw e;
  }
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  @Get() all() {
    return PRODUCT_CATALOG;
  }
}
