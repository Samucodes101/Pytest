import React from 'react';
import clsx from 'clsx';
export { Card, Badge, ResultBadge, Button, Input, Select, TextArea, Toggle, Modal, Alert, PageHeader, EmptyState } from './Base';

export const SkeletonLoader: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('bg-gray-200/80 rounded-lg animate-pulse', className)} />
);

export const Skeleton = {
  Card: () => (
    <div className="bg-white rounded-2xl p-6 shadow-soft border border-gray-200/70">
      <SkeletonLoader className="h-6 w-1/3 mb-4" />
      <SkeletonLoader className="h-10 w-1/2 mb-4" />
      <SkeletonLoader className="h-4 w-2/3" />
    </div>
  ),
  Text: ({ lines = 1, className = 'w-full' }: { lines?: number; className?: string }) => (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLoader key={i} className={clsx('h-4', className)} />
      ))}
    </div>
  ),
  Table: ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLoader key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  ),
};

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  passMark?: number;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({ percentage, size = 120, strokeWidth = 10, className, passMark = 50 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, percentage) / 100) * circumference;
  const color = percentage >= passMark ? '#10B981' : '#EF4444';

  return (
    <svg width={size} height={size} className={className} role="img" aria-label={`${percentage.toFixed(0)} percent`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle" fontSize={size / 5} fontWeight={700} fill="#1F2937">
        {percentage.toFixed(0)}%
      </text>
    </svg>
  );
};

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: { key: keyof T | string; label: string; render?: (value: any, row: T) => React.ReactNode; className?: string }[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps<any>>(
  ({ data, columns, isLoading = false, onRowClick, emptyMessage = 'Nothing to show yet.' }, ref) => {
    if (isLoading) {
      return <Skeleton.Table rows={5} cols={columns.length} />;
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="overflow-x-auto -mx-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key) + col.label}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-light"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {data.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                onClick={() => onRowClick?.(row)}
                className={clsx('hover:bg-primary-50/40 transition-colors', onRowClick && 'cursor-pointer')}
              >
                {columns.map((col) => (
                  <td key={String(col.key) + col.label} className={clsx('px-6 py-3.5 text-sm text-dark', col.className)}>
                    {col.render ? col.render(row[col.key as string], row) : row[col.key as string] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
);

DataTable.displayName = 'DataTable';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'accent' | 'danger';
  trend?: { value: number; direction: 'up' | 'down'; goodWhen?: 'up' | 'down' };
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle, icon, trend, tone = 'primary' }) => {
  const tones = {
    primary: 'bg-primary-50 text-primary',
    secondary: 'bg-secondary-50 text-secondary',
    accent: 'bg-accent-50 text-accent-600',
    danger: 'bg-red-50 text-red-600',
  };
  const good = trend ? trend.direction === (trend.goodWhen || 'up') : true;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-soft border border-gray-200/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-dark mt-1.5">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className={clsx('rounded-xl p-2.5 text-2xl', tones[tone])}>{icon}</div>}
      </div>
      {trend && trend.value > 0 && (
        <div className={clsx('mt-3 text-xs font-medium', good ? 'text-accent-600' : 'text-red-600')}>
          {trend.direction === 'up' ? '▲' : '▼'} {trend.value.toFixed(1)} pts vs. 30+ days ago
        </div>
      )}
    </div>
  );
};

export const ProgressBar: React.FC<{ value: number; className?: string; tone?: 'primary' | 'accent' }> = ({ value, className, tone = 'primary' }) => (
  <div className={clsx('h-2 w-full overflow-hidden rounded-full bg-gray-200', className)}>
    <div
      className={clsx('h-full rounded-full transition-all duration-300', tone === 'accent' ? 'bg-accent' : 'bg-primary')}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);
