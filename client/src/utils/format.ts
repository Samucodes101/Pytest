export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

/** 754 -> "12m 34s" */
export const formatDuration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
};

export const formatPercent = (value?: number | string | null) =>
  value === null || value === undefined || value === '' ? '—' : `${Number(value).toFixed(1)}%`;

/** "Due in 3 days", "Overdue", etc. Returns null when there is no due date. */
export const dueLabel = (due?: string | null): { text: string; overdue: boolean } | null => {
  if (!due) return null;
  const diff = new Date(due).getTime() - Date.now();
  if (diff < 0) return { text: 'Past due date', overdue: true };
  const hours = diff / 3_600_000;
  if (hours < 24) return { text: `Due in ${Math.max(1, Math.round(hours))}h`, overdue: false };
  return { text: `Due in ${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'}`, overdue: false };
};

export const apiError = (err: any, fallback = 'Something went wrong') => {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e: any) => e.message).join('. ');
  return data?.message || fallback;
};
