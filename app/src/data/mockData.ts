import type { Alert } from '../types';

export const MOCK_ALERT: Alert = {
  id: 'alert-1',
  familyId: 'family-1',
  type: 'schedule_conflict',
  severity: 'high',
  status: 'pending',
  title: '17:30–18:30 孩子接送無人負責',
  description: '你的會議延後 + 另一半外出，孩子可能無人接送',
  triggerTime: new Date() as any,
  expiryTime: new Date(Date.now() + 24 * 60 * 60 * 1000) as any,
  relatedEventIds: ['event-1', 'event-2'],
  suggestedSolutions: [],
  createdAt: new Date() as any,
  updatedAt: new Date() as any,
};

export const MOCK_CONFLICT_CONTEXT = {
  conflictTime: '週三 17:30–18:30',
  events: [
    {
      person: '你',
      event: '工作會議（原訂17:00結束，延後到18:00）',
      location: '辦公室',
    },
    {
      person: '另一半',
      event: '外出聚餐',
      location: '市區',
      startTime: '17:00',
    },
    {
      person: '小孩',
      event: '需要從幼兒園接回',
      location: '幼兒園',
      deadline: '18:00 前',
    },
  ],
  consequence: '孩子可能沒人接，需要在幼兒園多等或請老師幫忙照顧',
  availableHelpers: ['阿公', '阿嬤'],
};
