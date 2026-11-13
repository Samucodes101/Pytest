import React, { useEffect } from 'react';
import clsx from 'clsx';
import { X } from '@phosphor-icons/react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, interactive = false, ...props }) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl p-6 shadow-soft border border-gray-200/70',
        interactive && 'hover:shadow-medium hover:border-primary-200 transition-all duration-200 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'gray';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'primary', size = 'md', className }) => {
  const variantStyles: Record<BadgeVariant, string> = {
    primary: 'bg-primary-50 text-primary-700 ring-primary-200',
    secondary: 'bg-secondary-50 text-secondary-700 ring-secondary-200',
    success: 'bg-accent-50 text-accent-700 ring-accent-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-red-200',
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {children}
    </span>
  );
};

/** Human label + colour for a result status. */
export const ResultBadge: React.FC<{ status?: string | null; size?: 'sm' | 'md' }> = ({ status, size }) => {
  if (!status) return <Badge variant="gray" size={size}>—</Badge>;
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    above_average: { label: 'Distinction', variant: 'secondary' },
    passed: { label: 'Passed', variant: 'success' },
    failed: { label: 'Failed', variant: 'danger' },
  };
  const entry = map[status] || { label: status, variant: 'gray' as BadgeVariant };
  return (
    <Badge variant={entry.variant} size={size}>
      {entry.label}
    </Badge>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  isLoading = false,
  className,
  disabled,
  type = 'button',
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-primary text-white hover:bg-primary-700 shadow-sm',
    secondary: 'bg-gray-100 text-dark hover:bg-gray-200',
    outline: 'border border-gray-300 bg-white text-dark hover:border-primary-300 hover:bg-primary-50',
    ghost: 'text-primary hover:bg-primary-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    accent: 'bg-accent text-white hover:bg-accent-600 shadow-sm',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const fieldBase =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 transition';

export const Input: React.FC<InputProps> = ({ label, error, hint, icon, className, id, ...props }) => {
  const inputId = id || (label ? `f-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
        <input
          id={inputId}
          className={clsx(fieldBase, icon && 'pl-10', error && 'border-red-400 focus:ring-red-200 focus:border-red-500', className)}
          {...props}
        />
      </div>
      {error ? <p className="text-red-600 text-xs mt-1">{error}</p> : hint ? <p className="text-gray-500 text-xs mt-1">{hint}</p> : null}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  placeholder?: string;
  options: { value: string | number; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, error, options, placeholder = 'Select an option', className, id, ...props }) => {
  const selectId = id || (label ? `s-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <select id={selectId} className={clsx(fieldBase, error && 'border-red-400', className)} {...props}>
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  className?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, error, className, id, ...props }) => {
  const areaId = id || (label ? `t-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={areaId} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea id={areaId} className={clsx(fieldBase, error && 'border-red-400', className)} {...props} />
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
};

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description }) => (
  <label className="flex items-start justify-between gap-4 cursor-pointer select-none">
    <span>
      <span className="block text-sm font-medium text-dark">{label}</span>
      {description && <span className="block text-xs text-gray-500 mt-0.5">{description}</span>}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'bg-gray-300'
      )}
    >
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  </label>
);

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, children, footer, size = 'md' }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'w-full max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-medium',
          size === 'lg' ? 'max-w-2xl' : 'max-w-md'
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-dark">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
};

export const Alert: React.FC<{ variant?: 'error' | 'success' | 'info' | 'warning'; children: React.ReactNode; className?: string }> = ({
  variant = 'error',
  children,
  className,
}) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-700',
    success: 'bg-accent-50 border-accent-200 text-accent-700',
    info: 'bg-secondary-50 border-secondary-200 text-secondary-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
  };
  return <div className={clsx('rounded-lg border px-4 py-3 text-sm', styles[variant], className)}>{children}</div>;
};

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions }) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <h1 className="text-2xl font-semibold text-dark">{title}</h1>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    </div>
    {actions && <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{actions}</div>}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; message?: string; action?: React.ReactNode }> = ({
  icon,
  title,
  message,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    {icon && <div className="mb-3 rounded-full bg-primary-50 p-3 text-primary">{icon}</div>}
    <p className="font-medium text-dark">{title}</p>
    {message && <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
