import 'reflect-metadata';
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ApplicationStatus as S, UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  annuity,
  assertBank,
  assertBankTransition,
  assertOwner,
  assertVersion,
  nextClientStatus,
} from './policy.js';
import { validateProductRequest } from './catalog.js';
import { CreateApplicationDto } from './dto.js';
import { ApplicationsController } from './applications.controller.js';
import { MlMockService } from './ml-mock.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const valid = {
  inn: '7714892011',
  companyName: 'Учебная компания',
  registrationDate: '2022-01-01',
  monthlyRevenue: 12000000,
  monthlyExpenses: 3000000,
  currentDebtLoad: 10000,
  productCode: 'K1',
  requestedAmount: 3000000,
  requestedTermMonths: 36,
  purpose: 'Станок для производства',
  purposeCode: 'equipment',
  answers: { purpose: 'equipment', collateral: 'no' },
  consent: true,
} satisfies CreateApplicationDto;
const client = { id: 'client-1', phone: '+79990000001', role: UserRole.CLIENT };

describe('Credit policy and validation', () => {
  afterEach(() => vi.useRealTimers());
  it('separates annuity from flat interest and handles zero rate', () => {
    expect(annuity(1000000, 12, 0)).toBe(83333.33);
    expect(annuity(1000000, 12, 21.5)).toBeCloseTo(93353.89, 0);
  });
  it('prevents customer access to bank actions and foreign company mutations', () => {
    expect(() => assertBank(UserRole.CLIENT)).toThrow(ForbiddenException);
    expect(() => assertOwner('another', 'mine')).toThrow(ForbiddenException);
    expect(() => assertBank(UserRole.UNDERWRITER)).not.toThrow();
  });
  it('requires acceptance before signing and prevents repeated disbursement', () => {
    expect(() => nextClientStatus(S.APPROVED, 'SIGN_CONTRACT')).toThrow(
      ConflictException,
    );
    expect(nextClientStatus(S.APPROVED, 'ACCEPT_OFFER')).toBe(S.SIGNING);
    expect(nextClientStatus(S.SIGNING, 'SIGN_CONTRACT')).toBe(S.DISBURSED);
    expect(() => nextClientStatus(S.DISBURSED, 'SIGN_CONTRACT')).toThrow(
      ConflictException,
    );
  });
  it('requires detailed customer response and a bank review state', () => {
    expect(() => nextClientStatus(S.NEED_INFO, 'PROVIDE_INFO', 'x')).toThrow(
      BadRequestException,
    );
    expect(
      nextClientStatus(
        S.NEED_INFO,
        'PROVIDE_INFO',
        'Сезонность объяснена в приложенном документе',
      ),
    ).toBe(S.MANUAL_REVIEW);
    expect(() => assertBankTransition(S.APPROVED, S.REJECTED)).toThrow(
      ConflictException,
    );
    expect(() =>
      assertBankTransition(S.MANUAL_REVIEW, S.NEED_INFO),
    ).not.toThrow();
  });
  it('rejects stale optimistic version or status', () => {
    expect(() =>
      assertVersion({ status: S.SIGNING, version: 2 }, { expectedVersion: 1 }),
    ).toThrow(ConflictException);
    expect(() =>
      assertVersion(
        { status: S.SIGNING, version: 2 },
        { expectedStatus: S.APPROVED },
      ),
    ).toThrow(ConflictException);
  });
  it('enforces product limits and distinction between own and purchased collateral', () => {
    expect(() =>
      validateProductRequest({ ...valid, requestedAmount: 100000 }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateProductRequest({
        ...valid,
        productCode: 'T1',
        purposeCode: 'auto',
        answers: { purpose: 'auto', collateral: 'no', asset: 'yes' },
      }),
    ).not.toThrow();
    expect(() =>
      validateProductRequest({
        ...valid,
        productCode: 'T1',
        purposeCode: 'auto',
        answers: { asset: 'no' },
      }),
    ).toThrow(BadRequestException);
  });
  it('blocks refinancing of cards/overdraft and confirmed young business restrictions', () => {
    expect(() =>
      validateProductRequest({
        ...valid,
        productCode: 'R1',
        purposeCode: 'refi',
        answers: { refi_type: 'od' },
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      validateProductRequest(
        {
          ...valid,
          productCode: 'N1',
          purposeCode: 'property',
          registrationDate: '2026-10-01',
        },
        new Date('2026-10-22'),
      ),
    ).toThrow(BadRequestException);
  });
  it('keeps C1 unconfirmed term for manual review instead of inventing published limit', () => {
    expect(() =>
      validateProductRequest({
        ...valid,
        productCode: 'C1',
        requestedAmount: 700000,
        requestedTermMonths: 180,
        purposeCode: 'operations',
      }),
    ).not.toThrow();
  });
  it('validates missing consent, zero revenue, NaN and malformed INN before scoring', async () => {
    for (const change of [
      { consent: false },
      { monthlyRevenue: 0 },
      { monthlyRevenue: Number.NaN },
      { inn: 'wrong' },
      { requestedTermMonths: 0 },
    ])
      expect(
        (
          await validate(
            plainToInstance(CreateApplicationDto, { ...valid, ...change }),
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(plainToInstance(CreateApplicationDto, valid)),
    ).toHaveLength(0);
  });
  it('routes approved / manual / counter / reject through separate decision policy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T00:00:00Z'));
    const ml = new MlMockService(),
      input = { ...valid, registrationDate: new Date(valid.registrationDate) };
    expect(ml.evaluateApplication(input).recommendedStatus).toBe(S.APPROVED);
    expect(ml.evaluateApplication(input, true).recommendedStatus).toBe(
      S.MANUAL_REVIEW,
    );
    const medium = ml.getGosuslugiEgrulProfile('medium');
    const counter = ml.evaluateApplication({
      ...input,
      ...medium,
      registrationDate: new Date(medium.registrationDate),
    });
    expect(counter.recommendedStatus).toBe(S.COUNTER_OFFER);
    expect(counter.approvedAmount).toBeLessThan(input.requestedAmount);
    expect(
      annuity(counter.approvedAmount, 36, 21.5) + medium.currentDebtLoad,
    ).toBeLessThanOrEqual(
      (medium.monthlyRevenue - medium.monthlyExpenses) * 0.65,
    );
    expect(
      ml.evaluateApplication({
        ...input,
        monthlyExpenses: valid.monthlyRevenue,
      }).recommendedStatus,
    ).toBe(S.REJECTED);
  });
  it('checks RBAC before querying sensitive bank data', async () => {
    const db = { loanApplication: { findMany: vi.fn() } };
    const c = new ApplicationsController(
      db as unknown as PrismaService,
      new MlMockService(),
    );
    await expect(c.getAllForBank({ user: client }, {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(db.loanApplication.findMany).not.toHaveBeenCalled();
  });
  it('checks foreign ownership before upsert and before client transition', async () => {
    const tx = {
      loanApplication: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            id: 'app',
            status: S.SIGNING,
            version: 0,
            company: { userId: 'foreign' },
          }),
        updateMany: vi.fn(),
      },
    };
    const db = {
      company: { findUnique: vi.fn().mockResolvedValue({ userId: 'foreign' }) },
      $transaction: vi.fn(async (fn) => fn(tx)),
    };
    const c = new ApplicationsController(
      db as unknown as PrismaService,
      new MlMockService(),
    );
    await expect(c.createApplication({ user: client }, valid)).rejects.toThrow(
      ForbiddenException,
    );
    expect(db.$transaction).not.toHaveBeenCalled();
    await expect(
      c.handleClientAction(
        'app',
        { user: client },
        { action: 'SIGN_CONTRACT' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.loanApplication.updateMany).not.toHaveBeenCalled();
  });
});
