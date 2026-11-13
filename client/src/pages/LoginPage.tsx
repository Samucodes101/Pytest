import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useBrandingStore } from '@/hooks/useBranding';
import { Button, Input, Alert } from '@/components/ui/Base';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { EnvelopeSimple, LockSimple } from '@phosphor-icons/react';
import { apiError } from '@/utils/format';

const DEMO_PASSWORD = 'Demo@2026';
const DEMO_ACCOUNTS = [
  { role: 'Super admin', email: 'oluwaseun.adeyemi@demo.pytest.local' },
  { role: 'ICT admin', email: 'chinedu.okafor@demo.pytest.local' },
  { role: 'Candidate', email: 'segun.afolabi@demo.pytest.local' },
];

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading, token } = useAuthStore();
  const { branding } = useBrandingStore();
  const navigate = useNavigate();

  if (token) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(apiError(err, 'Sign-in failed'));
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle={`Sign in to ${branding.org_name} to continue.`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@organisation.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<EnvelopeSimple size={18} />}
          required
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<LockSimple size={18} />}
          required
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Sign in
        </Button>
      </form>

      {branding.allow_registration !== 'false' && (
        <p className="mt-6 text-center text-sm text-gray-600">
          New candidate?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      )}

      {/* {import.meta.env.DEV && (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Demo accounts · {DEMO_PASSWORD}</p>
          <div className="mt-2 grid gap-1">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="flex justify-between rounded-md px-2 py-1 text-left text-xs text-gray-600 hover:bg-white"
              >
                <span>{a.role}</span>
                <span className="font-mono">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      )} */}
    </AuthLayout>
  );
};

export default LoginPage;
