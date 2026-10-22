import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ApplicationStatus as S, UserRole } from '@prisma/client';

export function assertBank(role: UserRole) {
  if (role !== UserRole.UNDERWRITER && role !== UserRole.ADMIN)
    throw new ForbiddenException('Доступ разрешён сотруднику банка');
}
export function assertClient(role: UserRole) {
  if (role !== UserRole.CLIENT)
    throw new ForbiddenException('Действие доступно клиенту');
}
export function assertOwner(ownerId: string, userId: string) {
  if (ownerId !== userId)
    throw new ForbiddenException('Нет доступа к заявке или компании');
}
const BANK_TRANSITIONS: Partial<Record<S, S[]>> = {
  [S.MANUAL_REVIEW]: [S.APPROVED, S.REJECTED, S.NEED_INFO, S.COUNTER_OFFER],
  [S.NEED_INFO]: [S.MANUAL_REVIEW, S.REJECTED],
};
export function assertBankTransition(from: S, to: S) {
  if (!BANK_TRANSITIONS[from]?.includes(to))
    throw new ConflictException(`Переход ${from} → ${to} недоступен`);
}
export function nextClientStatus(from: S, action: string, comment?: string): S {
  if (
    action === 'ACCEPT_OFFER' &&
    [S.APPROVED, S.COUNTER_OFFER].includes(from as typeof S.APPROVED)
  )
    return S.SIGNING;
  if (action === 'SIGN_CONTRACT' && from === S.SIGNING) return S.DISBURSED;
  if (action === 'PROVIDE_INFO' && from === S.NEED_INFO) {
    if (!comment || comment.trim().length < 10)
      throw new BadRequestException(
        'Добавьте уточнение длиной не менее 10 символов',
      );
    return S.MANUAL_REVIEW;
  }
  throw new ConflictException(
    `Действие ${action} недоступно из статуса ${from}`,
  );
}
export function assertVersion(
  current: { status: S; version: number },
  expected: { expectedVersion?: number; expectedStatus?: S },
) {
  if (
    (expected.expectedVersion !== undefined &&
      current.version !== expected.expectedVersion) ||
    (expected.expectedStatus && current.status !== expected.expectedStatus)
  )
    throw new ConflictException('Заявка уже изменилась. Обновите данные');
}
export function annuity(amount: number, term: number, rate = 21.5) {
  const r = rate / 1200;
  return (
    Math.round(
      (r === 0 ? amount / term : (amount * r) / (1 - (1 + r) ** -term)) * 100,
    ) / 100
  );
}
