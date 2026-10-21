import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MlMockService } from './ml-mock.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApplicationsModule } from '../applications/applications.module.js';

const COMPLETED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.DISBURSED,
];

interface AuthenticatedRequest {
  user: {
    id: string;
    phone: string;
    role: UserRole;
  };
}

interface CreateApplicationBody {
  inn: string;
  ogrn?: string;
  companyName: string;
  legalForm?: string;
  okved?: string;
  okvedTitle?: string;
  registrationDate?: string;
  monthlyRevenue: number | string;
  monthlyExpenses: number | string;
  currentDebtLoad?: number | string;
  productCode: string;
  productName?: string;
  requestedAmount: number | string;
  requestedTermMonths: number | string;
  purpose?: string;
}

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mlService: MlMockService,
  ) {}

  // 1. Моковая кнопка «Заполнить через Госуслуги / ЕГРЮЛ»
  @Get('gosuslugi-mock')
  @ApiOperation({ summary: 'Мок получения данных бизнеса из Госуслуг и ЕГРЮЛ' })
  getGosuslugiData(@Query('preset') preset: 'good' | 'medium' | 'risky' = 'good') {
    return this.mlService.getGosuslugiEgrulProfile(preset);
  }

  // 2. Создание заявки клиентом -> Авто-прогон через ML-сервис
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Отправка заявки клиентом и первичный скоринг в ML-сервисе' })
  async createApplication(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateApplicationBody,
  ) {
    const userId = req.user.id;

    const company = await this.prisma.company.upsert({
      where: { inn: body.inn },
      update: {
        name: body.companyName,
        legalForm: body.legalForm || 'ООО',
        okved: body.okved || '47.91',
        okvedTitle: body.okvedTitle || 'Коммерческая деятельность',
        monthlyRevenue: Number(body.monthlyRevenue),
        monthlyExpenses: Number(body.monthlyExpenses),
        currentDebtLoad: Number(body.currentDebtLoad || 0),
      },
      create: {
        userId,
        inn: body.inn,
        ogrn: body.ogrn || '1187746000000',
        name: body.companyName,
        legalForm: body.legalForm || 'ООО',
        okved: body.okved || '47.91',
        okvedTitle: body.okvedTitle || 'Коммерческая деятельность',
        registrationDate: new Date(body.registrationDate || '2023-01-15'),
        monthlyRevenue: Number(body.monthlyRevenue),
        monthlyExpenses: Number(body.monthlyExpenses),
        currentDebtLoad: Number(body.currentDebtLoad || 0),
      },
    });

    const product = await this.prisma.creditProduct.upsert({
      where: { code: body.productCode },
      update: {},
      create: {
        code: body.productCode,
        title: body.productName || `Продукт ${body.productCode}`,
        description: 'Бизнес-финансирование Альфа-Банка',
        minAmount: 50000,
        maxAmount: 150000000,
        minTermMonths: 1,
        maxTermMonths: 120,
        baseRate: 21.5,
        minScoringScore: 650,
      },
    });

    const mlResult = await this.mlService.evaluateApplication({
      productCode: body.productCode,
      requestedAmount: Number(body.requestedAmount),
      requestedTermMonths: Number(body.requestedTermMonths),
      monthlyRevenue: Number(body.monthlyRevenue),
      monthlyExpenses: Number(body.monthlyExpenses),
      currentDebtLoad: Number(body.currentDebtLoad || 0),
      registrationDate: company.registrationDate,
    });

    return this.prisma.loanApplication.create({
      data: {
        companyId: company.id,
        productId: product.id,
        requestedAmount: Number(body.requestedAmount),
        requestedTermMonths: Number(body.requestedTermMonths),
        purpose: body.purpose || 'Пополнение оборотных средств и развитие',
        status: mlResult.recommendedStatus,
        scoringScore: mlResult.scoringScore,
        riskGrade: mlResult.riskGrade,
        enrichmentData: mlResult.enrichmentData,
        scoringFactors: mlResult.scoringFactors,
        approvedAmount: mlResult.approvedAmount,
        approvedTermMonths: mlResult.approvedTermMonths,
        approvedRate: mlResult.approvedRate,
        decisionNote: mlResult.decisionNote,
        statusHistory: {
          create: [
            {
              fromStatus: ApplicationStatus.DRAFT,
              toStatus: ApplicationStatus.SUBMITTED,
              actorRole: UserRole.CLIENT,
              changedById: userId,
              comment: 'Заявка сформирована и отправлена клиентом',
            },
            {
              fromStatus: ApplicationStatus.SUBMITTED,
              toStatus: mlResult.recommendedStatus,
              actorRole: UserRole.ADMIN,
              comment: `ML-конвейер (Score: ${mlResult.scoringScore}): ${mlResult.decisionNote}`,
            },
          ],
        },
      },
      include: { company: true, product: true, statusHistory: true },
    });
  }

  // 3. Список заявок текущего клиента («Мои заявки»)
  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение списка заявок клиента («Мои заявки»)' })
  async getMyApplications(@Req() req: AuthenticatedRequest) {
    return this.prisma.loanApplication.findMany({
      where: { company: { userId: req.user.id } },
      include: {
        company: true,
        product: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 4. Дашборд сотрудника банка с фильтрацией
  @Get('bank/all')
  @ApiOperation({ summary: 'Все заявки для дашборда банка с фильтрацией' })
  async getAllForBank(
    @Query('completion') completion?: 'ALL' | 'IN_PROGRESS' | 'COMPLETED',
    @Query('status') status?: ApplicationStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    const where: Prisma.LoanApplicationWhereInput = {};

    if (status) {
      where.status = status;
    } else if (completion === 'COMPLETED') {
      where.status = { in: COMPLETED_STATUSES };
    } else if (completion === 'IN_PROGRESS') {
      where.status = { notIn: COMPLETED_STATUSES };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.company = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { inn: { contains: search } },
        ],
      };
    }

    return this.prisma.loanApplication.findMany({
      where,
      include: {
        company: { include: { user: true } },
        product: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 5. Ручное вмешательство сотрудника банка в любую заявку
  @Patch('bank/:id/intervene')
  @ApiOperation({ summary: 'Вмешательство сотрудника банка в заявку (смена статуса и условий)' })
  async bankIntervene(
    @Param('id') id: string,
    @Body()
    body: {
      toStatus: ApplicationStatus;
      approvedAmount?: number;
      approvedTermMonths?: number;
      approvedRate?: number;
      decisionNote: string;
    },
  ) {
    const current = await this.prisma.loanApplication.findUniqueOrThrow({ where: { id } });

    return this.prisma.loanApplication.update({
      where: { id },
      data: {
        status: body.toStatus,
        approvedAmount: body.approvedAmount ?? current.approvedAmount,
        approvedTermMonths: body.approvedTermMonths ?? current.approvedTermMonths,
        approvedRate: body.approvedRate ?? current.approvedRate,
        decisionNote: body.decisionNote,
        statusHistory: {
          create: {
            fromStatus: current.status,
            toStatus: body.toStatus,
            actorRole: UserRole.UNDERWRITER,
            comment: `[Ручное вмешательство сотрудника банка]: ${body.decisionNote}`,
          },
        },
      },
      include: {
        company: true,
        product: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  // 6. Действия клиента в «Моих заявках» (Принятие контр-оффера / Досыл инфо / Подписание ПЭП)
  @Patch(':id/client-action')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Действие клиента по заявке (согласие с оффером, подписание или ответ банку)' })
  async handleClientAction(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      action: 'ACCEPT_OFFER' | 'SIGN_CONTRACT' | 'PROVIDE_INFO';
      clientComment?: string;
    },
  ) {
    const current = await this.prisma.loanApplication.findUniqueOrThrow({ where: { id } });

    let nextStatus: ApplicationStatus = current.status;
    let note = current.decisionNote;
    let historyComment = '';

    if (body.action === 'ACCEPT_OFFER') {
      nextStatus = ApplicationStatus.SIGNING;
      note = 'Клиент принял условия предложения. Ожидается подписание договора ПЭП.';
      historyComment = 'Клиент согласился с предложенными условиями финансирования';
    } else if (body.action === 'SIGN_CONTRACT') {
      nextStatus = ApplicationStatus.DISBURSED;
      note = 'Договор подписан ПЭП. Денежные средства перечислены на расчетный счет клиента.';
      historyComment = 'Клиент подписал кредитный договор электронной подписью. Средства выданы.';
    } else if (body.action === 'PROVIDE_INFO') {
      nextStatus = ApplicationStatus.MANUAL_REVIEW;
      note = `Клиент предоставил уточнения: "${body.clientComment || 'Документы приложены'}"`;
      historyComment = `Клиент предоставил дополнительные сведения: ${body.clientComment || ''}`;
    }

    return this.prisma.loanApplication.update({
      where: { id },
      data: {
        status: nextStatus,
        decisionNote: note,
        statusHistory: {
          create: {
            fromStatus: current.status,
            toStatus: nextStatus,
            actorRole: UserRole.CLIENT,
            changedById: req.user.id,
            comment: historyComment,
          },
        },
      },
      include: {
        company: true,
        product: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
  }
}