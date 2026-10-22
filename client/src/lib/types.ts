export const STATUS: Record<string, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Заявка принята",
  VALIDATING: "Проверка данных",
  ENRICHING: "Сбор сведений",
  SCORING: "Оценка риска",
  NEED_INFO: "Нужны сведения",
  MANUAL_REVIEW: "На рассмотрении",
  COUNTER_OFFER: "Другие условия",
  APPROVED: "Одобрено",
  REJECTED: "Отказ",
  SIGNING: "Ожидает подписания",
  DISBURSED: "Выдача смоделирована",
};
export type Application = {
  id: string;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  purpose: string;
  requestedAmount: string | number;
  requestedTermMonths: number;
  approvedAmount?: string | number;
  approvedTermMonths?: number;
  approvedRate?: number;
  scoringScore?: number;
  riskGrade?: string;
  decisionNote?: string;
  company: {
    id: string;
    name: string;
    inn: string;
    okved: string;
    okvedTitle?: string;
    monthlyRevenue: string | number;
    monthlyExpenses: string | number;
    currentDebtLoad: string | number;
  };
  product: { code: string; title: string };
  financialSnapshot?: {
    monthlyRevenue?: number;
    monthlyExpenses?: number;
    currentDebtLoad?: number;
  };
  scoringFactors?: {
    positive?: string[];
    negative?: string[];
    probabilityOfDefault?: number;
    modelVersion?: string;
    dtiRatio?: number;
    dataSource?: string;
    modelFactors?: { label: string; direction: string; contribution: number }[];
    applicationSnapshot?: {
      monthlyRevenue?: number;
      monthlyExpenses?: number;
      currentDebtLoad?: number;
    };
    [key: string]: unknown;
  };
  statusHistory: {
    id: string;
    toStatus: string;
    comment: string;
    actorRole: string;
    createdAt: string;
  }[];
  documents?: {
    id: string;
    title: string;
    type: string;
    isSigned: boolean;
    createdAt: string;
  }[];
};
export type Article = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  targetOkved?: string;
  targetStage?: string;
  source?: string;
};
