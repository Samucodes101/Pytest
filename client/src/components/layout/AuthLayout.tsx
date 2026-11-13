import React from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import { useBrandingStore } from '@/hooks/useBranding';
import { BrandMark } from './Navigation';

const POINTS = [
  'Timed assessments that survive a dropped connection',
  'Instant, consistent grading with detailed review',
  'Department-level analytics for every exam',
];

/** Split-screen frame for the sign-in and registration pages. */
export const AuthLayout: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => {
  const { branding } = useBrandingStore();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-secondary/20" />
        <div className="relative">
          <BrandMark light onPrimary size="lg" />
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Assessments your organisation can trust.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-primary-100">
                <CheckCircle size={22} weight="fill" className="mt-0.5 flex-shrink-0 text-accent" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-primary-200">© {new Date().getFullYear()} {branding.org_name}</p>
      </div>

      <div className="flex items-center justify-center bg-light p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          <h1 className="text-2xl font-semibold text-dark">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
};
