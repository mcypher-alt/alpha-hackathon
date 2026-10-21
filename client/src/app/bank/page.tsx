'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Tag,
  Button,
  Select,
  DatePicker,
  Segmented,
  Input,
  Drawer,
  Form,
  InputNumber,
  Progress,
  Descriptions,
  Timeline,
  Space,
  Card,
  Statistic,
  message,
} from 'antd';
import type { TableColumnsType } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type ApplicationStatusType =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VALIDATING'
  | 'ENRICHING'
  | 'SCORING'
  | 'NEED_INFO'
  | 'MANUAL_REVIEW'
  | 'COUNTER_OFFER'
  | 'APPROVED'
  | 'REJECTED'
  | 'SIGNING'
  | 'DISBURSED';

export interface StatusHistoryItem {
  id: string;
  fromStatus: ApplicationStatusType | null;
  toStatus: ApplicationStatusType;
  actorRole: 'CLIENT' | 'UNDERWRITER' | 'ADMIN';
  comment: string | null;
  createdAt: string;
}

export interface LoanApplicationItem {
  id: string;
  requestedAmount: number | string;
  requestedTermMonths: number;
  purpose: string;
  status: ApplicationStatusType;
  scoringScore: number | null;
  riskGrade: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  scoringFactors: {
    positive?: string[];
    negative?: string[];
    dtiRatio?: number;
  } | null;
  approvedAmount: number | string | null;
  approvedTermMonths: number | null;
  approvedRate: number | null;
  decisionNote: string | null;
  createdAt: string;
  company?: {
    id: string;
    name: string;
    inn: string;
    okved: string;
    okvedTitle?: string;
    monthlyRevenue: number | string;
    monthlyExpenses: number | string;
    currentDebtLoad: number | string;
  };
  product?: {
    id: string;
    code: string;
    title: string;
  };
  statusHistory?: StatusHistoryItem[];
}

interface InterveneFormValues {
  toStatus: ApplicationStatusType;
  approvedAmount?: number;
  approvedTermMonths?: number;
  approvedRate?: number;
  decisionNote: string;
}

const STATUS_META: Record<ApplicationStatusType, { label: string; color: string }> = {
  DRAFT: { label: 'Черновик', color: 'default' },
  SUBMITTED: { label: 'Отправлена', color: 'processing' },
  VALIDATING: { label: 'Проверка данных', color: 'processing' },
  ENRICHING: { label: 'Запрос ФНС/БКИ', color: 'processing' },
  SCORING: { label: 'ML-Скоринг', color: 'purple' },
  NEED_INFO: { label: 'Дозапрос сведений', color: 'warning' },
  MANUAL_REVIEW: { label: 'Ручной разбор', color: 'gold' },
  COUNTER_OFFER: { label: 'Контр-оффер', color: 'cyan' },
  APPROVED: { label: 'Одобрено', color: 'success' },
  REJECTED: { label: 'Отказ', color: 'error' },
  SIGNING: { label: 'На подписании', color: 'blue' },
  DISBURSED: { label: 'Выдано', color: 'green' },
};

export default function BankDashboardPage() {
  const [applications, setApplications] = useState<LoanApplicationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Состояния фильтров
  const [completion, setCompletion] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatusType | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [search, setSearch] = useState<string>('');

  // Выбранная заявка для вмешательства
  const [selectedApp, setSelectedApp] = useState<LoanApplicationItem | null>(null);
  const [form] = Form.useForm<InterveneFormValues>();

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (completion !== 'ALL') params.set('completion', completion);
      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);
      if (dateRange?.[0]) params.set('dateFrom', dateRange[0].startOf('day').toISOString());
      if (dateRange?.[1]) params.set('dateTo', dateRange[1].endOf('day').toISOString());

      const res = await fetch(`${API_URL}/applications/bank/all?${params.toString()}`);
      const data: unknown = await res.json();
      setApplications(Array.isArray(data) ? (data as LoanApplicationItem[]) : []);
    } catch {
      message.error('Не удалось загрузить список заявок');
    } finally {
      setLoading(false);
    }
  }, [completion, statusFilter, dateRange, search]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  // Синхронизируем значения формы только когда выбранная заявка открыта
  useEffect(() => {
    if (selectedApp) {
      form.setFieldsValue({
        toStatus: selectedApp.status,
        approvedAmount: Number(selectedApp.approvedAmount ?? selectedApp.requestedAmount),
        approvedTermMonths: selectedApp.approvedTermMonths ?? selectedApp.requestedTermMonths,
        approvedRate: selectedApp.approvedRate ?? 21.5,
        decisionNote: selectedApp.decisionNote ?? '',
      });
    }
  }, [selectedApp, form]);

  const handleInterveneSubmit = async (values: InterveneFormValues) => {
    if (!selectedApp) return;
    const res = await fetch(`${API_URL}/applications/bank/${selectedApp.id}/intervene`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });

    if (res.ok) {
      message.success('Решение сотрудника банка применено к заявке');
      setSelectedApp(null);
      void fetchApplications();
    } else {
      message.error('Ошибка при сохранении решения');
    }
  };

  const columns: TableColumnsType<LoanApplicationItem> = [
    {
      title: 'Дата подачи',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (val: string) => dayjs(val).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Компания / ИНН',
      key: 'company',
      render: (_, row) => (
        <div>
          <div className="font-bold">{row.company?.name}</div>
          <div className="text-xs text-neutral-400">
            ИНН: {row.company?.inn} • ОКВЭД {row.company?.okved}
          </div>
        </div>
      ),
    },
    {
      title: 'Продукт',
      key: 'product',
      render: (_, row) => (
        <Tag color="red" className="font-bold">
          {row.product?.code} — {row.product?.title}
        </Tag>
      ),
    },
    {
      title: 'Запрошено / Одобрено ML',
      key: 'amount',
      render: (_, row) => (
        <div>
          <div>
            Запрос: <b>{Number(row.requestedAmount).toLocaleString('ru-RU')} ₽</b> ({row.requestedTermMonths} мес.)
          </div>
          {row.approvedAmount != null && (
            <div className="text-xs text-emerald-700">
              Оффер: {Number(row.approvedAmount).toLocaleString('ru-RU')} ₽ под {row.approvedRate}%
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Результат ML-сервиса',
      key: 'ml',
      render: (_, row) => {
        const score = row.scoringScore ?? 0;
        return (
          <div className="w-36">
            <div className="flex justify-between text-xs mb-1">
              <span>
                Score: <b>{row.scoringScore ?? '—'}</b>
              </span>
              <Tag color={row.riskGrade === 'LOW' ? 'green' : row.riskGrade === 'MEDIUM' ? 'orange' : 'red'}>
                {row.riskGrade ?? 'N/A'}
              </Tag>
            </div>
            <Progress
              percent={Math.round(score / 10)}
              size="small"
              showInfo={false}
              strokeColor={score >= 750 ? '#0CC44D' : score >= 580 ? '#FF7024' : '#EF3124'}
            />
          </div>
        );
      },
    },
    {
      title: 'Статус конвейера',
      dataIndex: 'status',
      key: 'status',
      render: (st: ApplicationStatusType) => (
        <Tag color={STATUS_META[st]?.color || 'default'}>{STATUS_META[st]?.label || st}</Tag>
      ),
    },
    {
      title: 'Управление',
      key: 'action',
      render: (_, row) => (
        <Button type="primary" onClick={() => setSelectedApp(row)}>
          Вмешаться / Изменить
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F2F3F5] p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <Card className="shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold m-0">
                Терминал андеррайтера • Управление кредитным конвейером
              </h1>
              <p className="text-neutral-500 text-sm m-0">
                Мониторинг результатов ML-скоринга и ручное вмешательство на любом этапе заявки
              </p>
            </div>
            <Space>
              <Statistic title="Всего в выборке" value={applications.length} />
            </Space>
          </div>

          <div className="mt-6 pt-5 border-t flex flex-wrap gap-4 items-center justify-between">
            <Segmented
              value={completion}
              onChange={(val) => setCompletion(val as 'ALL' | 'IN_PROGRESS' | 'COMPLETED')}
              options={[
                { label: 'Все заявки', value: 'ALL' },
                { label: 'В работе (Активные)', value: 'IN_PROGRESS' },
                { label: 'Завершенные', value: 'COMPLETED' },
              ]}
            />

            <Space wrap>
              <Input.Search
                placeholder="Поиск по ИНН или компании..."
                allowClear
                onSearch={(v) => setSearch(v)}
                style={{ width: 240 }}
              />

              <Select<ApplicationStatusType>
                allowClear
                placeholder="Фильтр по ApplicationStatus"
                style={{ width: 240 }}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                options={(Object.entries(STATUS_META) as [ApplicationStatusType, { label: string }][]).map(
                  ([key, val]) => ({
                    value: key,
                    label: `${val.label} (${key})`,
                  }),
                )}
              />

              <RangePicker
                placeholder={['Дата от', 'Дата до']}
                onChange={(dates) => setDateRange(dates)}
              />
            </Space>
          </div>
        </Card>

        <Card className="shadow-sm">
          <Table<LoanApplicationItem>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={applications}
            pagination={{ pageSize: 8 }}
          />
        </Card>
      </div>

      <Drawer
        title={`Управление заявкой: ${selectedApp?.company?.name || ''}`}
        size={640}
        open={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        forceRender
      >
        <div className="space-y-6">
          {selectedApp && (
            <Card size="small" title="Вердикт ML-сервиса и факторы риска">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Скоринговый балл">
                  <b>{selectedApp.scoringScore} / 1000</b>
                </Descriptions.Item>
                <Descriptions.Item label="Уровень риска">
                  <Tag color="orange">{selectedApp.riskGrade}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Выручка / мес.">
                  {Number(selectedApp.company?.monthlyRevenue ?? 0).toLocaleString('ru-RU')} ₽
                </Descriptions.Item>
                <Descriptions.Item label="Текущий долг / мес.">
                  {Number(selectedApp.company?.currentDebtLoad ?? 0).toLocaleString('ru-RU')} ₽
                </Descriptions.Item>
              </Descriptions>

              <div className="mt-3 text-xs space-y-1">
                <div className="font-bold text-emerald-700">Плюсы:</div>
                {(selectedApp.scoringFactors?.positive || []).map((f, i) => (
                  <div key={i}>+ {f}</div>
                ))}
                <div className="font-bold text-red-600 mt-2">Факторы риска:</div>
                {(selectedApp.scoringFactors?.negative || []).map((f, i) => (
                  <div key={i}>− {f}</div>
                ))}
              </div>
            </Card>
          )}

          <Form<InterveneFormValues> form={form} layout="vertical" onFinish={handleInterveneSubmit}>
            <Form.Item
              name="toStatus"
              label="Перевести заявку в статус (ApplicationStatus)"
              rules={[{ required: true }]}
            >
              <Select
                options={(Object.entries(STATUS_META) as [ApplicationStatusType, { label: string }][]).map(
                  ([key, val]) => ({
                    value: key,
                    label: `${val.label} (${key})`,
                  }),
                )}
              />
            </Form.Item>

            <div className="grid grid-cols-3 gap-3">
              <Form.Item name="approvedAmount" label="Одобренная сумма (₽)">
                <InputNumber className="w-full" step={100000} />
              </Form.Item>
              <Form.Item name="approvedTermMonths" label="Срок (мес.)">
                <InputNumber className="w-full" min={1} max={120} />
              </Form.Item>
              <Form.Item name="approvedRate" label="Ставка (%)">
                <InputNumber className="w-full" step={0.5} />
              </Form.Item>
            </div>

            <Form.Item
              name="decisionNote"
              label="Комментарий для клиента / причина изменения условий"
              rules={[{ required: true, message: 'Укажите комментарий решения' }]}
            >
              <Input.TextArea rows={3} placeholder="Например: Одобрено после ручной проверки контрактов..." />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large">
              Сохранить решение и обновить статус у клиента
            </Button>
          </Form>

          {selectedApp && (
            <div>
              <h4 className="font-bold mb-3">История движения заявки по конвейеру</h4>
              <Timeline
                items={(selectedApp.statusHistory || []).map((h) => ({
                  color: h.actorRole === 'UNDERWRITER' ? 'red' : 'blue',
                  children: (
                    <div className="text-xs">
                      <b>
                        {h.fromStatus ?? 'START'} → {h.toStatus}
                      </b>{' '}
                      ({dayjs(h.createdAt).format('HH:mm:ss')})
                      <div className="text-neutral-500">{h.comment}</div>
                    </div>
                  ),
                }))}
              />
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
}