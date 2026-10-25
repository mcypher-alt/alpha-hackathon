import { BadRequestException } from '@nestjs/common';
import type { CreateApplicationDto } from './dto.js';

export const PRODUCT_CATALOG = [
  {
    code: 'K1',
    title: 'Кредит без залога',
    min: 300000,
    max: 30000000,
    minTerm: 12,
    maxTerm: 60,
    goals: ['operations', 'gap', 'equipment', 'auto', 'market'],
    pledge: 'none',
    source: 'businesscredit/',
  },
  {
    code: 'K2',
    title: 'Кредит с залогом',
    min: 500000,
    max: 150000000,
    minTerm: 12,
    maxTerm: 120,
    goals: ['operations', 'equipment', 'auto', 'property', 'market'],
    pledge: 'owned',
    source: 'businesscredit/',
  },
  {
    code: 'L1',
    title: 'Возобновляемая линия без залога',
    min: 300000,
    max: 30000000,
    minTerm: 1,
    maxTerm: 12,
    goals: ['operations', 'gap', 'market'],
    pledge: 'none',
    source: 'creditline/adv/',
  },
  {
    code: 'L2',
    title: 'Возобновляемая линия с залогом',
    min: 500000,
    max: 50000000,
    minTerm: 1,
    maxTerm: 6,
    goals: ['operations', 'gap', 'market'],
    pledge: 'owned',
    source: 'creditline/adv/',
  },
  {
    code: 'L3',
    title: 'Невозобновляемая линия с залогом',
    min: 500000,
    max: 50000000,
    minTerm: 1,
    maxTerm: 60,
    goals: ['operations', 'equipment'],
    pledge: 'owned',
    source: 'creditline/adv/',
  },
  {
    code: 'O1',
    title: 'Овердрафт',
    min: 300000,
    max: 20000000,
    minTerm: 1,
    maxTerm: 3,
    goals: ['operations', 'gap', 'market'],
    pledge: 'none',
    source: 'overdraft/',
  },
  {
    code: 'A1',
    title: 'Альфа-Старт',
    min: 50000,
    max: 1000000,
    minTerm: 1,
    maxTerm: 12,
    goals: ['operations', 'gap', 'equipment', 'market'],
    pledge: 'none',
    source: 'alfastart/',
  },
  {
    code: 'M1',
    title: 'Альфа-Селлер',
    min: null,
    max: 20000000,
    minTerm: 1,
    maxTerm: 12,
    goals: ['market'],
    pledge: 'none',
    source: 'creditsellers/',
  },
  {
    code: 'C1',
    title: 'Business One Credit',
    min: null,
    max: 1000000,
    minTerm: 1,
    maxTerm: 180,
    goals: ['operations', 'gap', 'market'],
    pledge: 'none',
    source: 'creditcard/',
  },
  {
    code: 'T1',
    title: 'Автокредит',
    min: null,
    max: 50000000,
    minTerm: 1,
    maxTerm: 120,
    goals: ['auto'],
    pledge: 'purchase',
    source: 'autocredit/',
  },
  {
    code: 'N1',
    title: 'Бизнес-ипотека',
    min: null,
    max: 150000000,
    minTerm: 1,
    maxTerm: 120,
    goals: ['property'],
    pledge: 'purchase',
    source: 'businessipoteka/',
  },
  {
    code: 'R1',
    title: 'Рефинансирование без залога',
    min: 300000,
    max: 30000000,
    minTerm: 12,
    maxTerm: 60,
    goals: ['refi'],
    pledge: 'none',
    source: 'refin/',
  },
  {
    code: 'R2',
    title: 'Рефинансирование с залогом',
    min: 500000,
    max: 150000000,
    minTerm: 12,
    maxTerm: 120,
    goals: ['refi'],
    pledge: 'owned',
    source: 'refin/',
  },
].map((p) => ({
  ...p,
  url: `https://alfabank.ru/sme/profits/${p.source}`,
  verifiedAt: '2026-10-21',
  status: 'PROJECT_SNAPSHOT',
  baseRate: 21.5,
  termConstraintsKnown: p.code !== 'C1',
}));
export function validateProductRequest(
  body: CreateApplicationDto,
  asOf = new Date(),
) {
  const p = PRODUCT_CATALOG.find((x) => x.code === body.productCode);
  if (!p) throw new BadRequestException('Неизвестный продукт');
  if (body.requestedAmount < (p.min ?? 1) || body.requestedAmount > p.max)
    throw new BadRequestException('Сумма вне лимитов выбранного продукта');
  if (
    p.termConstraintsKnown &&
    (body.requestedTermMonths < p.minTerm ||
      body.requestedTermMonths > p.maxTerm)
  )
    throw new BadRequestException('Срок вне лимитов выбранного продукта');
  const date = new Date(body.registrationDate);
  if (date > asOf || date.getUTCFullYear() < 1900)
    throw new BadRequestException('Некорректная дата регистрации');
  const months =
    (asOf.getUTCFullYear() - date.getUTCFullYear()) * 12 +
    asOf.getUTCMonth() -
    date.getUTCMonth() -
    (asOf.getUTCDate() < date.getUTCDate() ? 1 : 0);
  if (['N1', 'R1', 'R2'].includes(p.code) && months < 9)
    throw new BadRequestException(
      'Для этого продукта бизнес должен работать не менее 9 месяцев',
    );
  const answers = body.answers ?? {};
  if (
    Object.values(answers).some(
      (v) => typeof v !== 'string' || v.length > 2000,
    ) ||
    Object.keys(answers).length > 30
  )
    throw new BadRequestException('Некорректные ответы опроса');
  const purpose =
    body.purposeCode ??
    (answers.purpose === 'other' ? answers.confirmedPurpose : answers.purpose);
  if (purpose && purpose !== 'other' && !p.goals.includes(purpose))
    throw new BadRequestException('Выбранный продукт не соответствует цели');
  if (p.pledge === 'owned' && answers.collateral === 'no')
    throw new BadRequestException('Для продукта требуется имеющийся залог');
  if (p.pledge === 'purchase' && answers.asset === 'no')
    throw new BadRequestException(
      'Для продукта требуется залог приобретаемого объекта',
    );
  if (
    ['R1', 'R2'].includes(p.code) &&
    ['od', 'card'].includes(answers.refi_type)
  )
    throw new BadRequestException(
      'Овердрафт и карта не рефинансируются этой программой',
    );
  return {
    product: p,
    monthsOld: months,
    requiresSubscription:
      (['L1', 'A1'].includes(p.code) && body.requestedTermMonths > 6) ||
      (p.code === 'O1' && body.requestedTermMonths > 2),
  };
}
