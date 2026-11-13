import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useBrandingStore } from '@/hooks/useBranding';
import { usePublicDepartments } from '@/hooks/useQueries';
import { Button, Input, Select, Alert } from '@/components/ui/Base';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { User, EnvelopeSimple, LockSimple } from '@phosphor-icons/react';
import { apiError } from '@/utils/format';

export const passwordProblem = (password: string) => {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Include at least one letter and one number.';
  return '';
};

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { register, isLoading, token } = useAuthStore();
  const { branding } = useBrandingStore();
  const { data: departments } = usePublicDepartments();
  const navigate = useNavigate();

  if (token) return <Navigate to="/dashboard" replace />;

  if (branding.allow_registration === 'false') {
    return (
      <AuthLayout title="Registration is closed" subtitle="Accounts are created by your administrator.">
        <Alert variant="info">Please contact your department administrator to receive your sign-in details.</Alert>
        <Link to="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!departmentId) return setError('Choose the department you are being assessed for.');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirmPassword) return setError('The two passwords do not match.');

    try {
      await register(name, email, password, Number(departmentId));
      navigate('/dashboard');
    } catch (err: any) {
      setError(apiError(err, 'Registration failed'));
    }
  };

  return (
    <AuthLayout title="Create your candidate account" subtitle="You will see your assigned assessments once you sign in.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}

        <Input
          label="Full name"
          autoComplete="name"
          placeholder="e.g. Amaka Okafor"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={<User size={18} />}
          required
        />

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<EnvelopeSimple size={18} />}
          required
        />

        <Select
          label="Department"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          placeholder="Select your department"
          options={(departments || []).map((d) => ({ value: d.id, label: d.name }))}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<LockSimple size={18} />}
            hint="8+ characters, letters and numbers"
            required
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<LockSimple size={18} />}
            required
          />
        </div>

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
