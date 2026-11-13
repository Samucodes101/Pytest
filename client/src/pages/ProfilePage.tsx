import React, { useState } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { apiClient } from '@/api/client';
import { Card, Button, Input, Alert, Badge, PageHeader } from '@/components/ui/Base';
import { passwordProblem } from './RegisterPage';
import { apiError, formatDate } from '@/utils/format';

const ROLE_LABEL: Record<string, string> = { superadmin: 'Super Admin', admin: 'Department Admin', student: 'Candidate' };

const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const problem = passwordProblem(next);
    if (problem) return setMessage({ kind: 'error', text: problem });
    if (next !== confirm) return setMessage({ kind: 'error', text: 'The new passwords do not match.' });
    if (next === current) return setMessage({ kind: 'error', text: 'Choose a password different from your current one.' });

    setSaving(true);
    try {
      await apiClient.changePassword(current, next);
      setMessage({ kind: 'success', text: 'Password updated. Use the new one next time you sign in.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setMessage({ kind: 'error', text: apiError(err, 'Could not change the password') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="My profile" />

      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-white">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-dark">{user?.name}</p>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant="primary">{ROLE_LABEL[user?.role || ''] || user?.role}</Badge>
              {user?.department_name && <Badge variant="gray">{user.department_name}</Badge>}
            </div>
          </div>
        </div>
        {user?.created_at && <p className="mt-4 text-xs text-gray-500">Member since {formatDate(user.created_at)}</p>}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-dark">Change password</h2>
        <p className="mb-5 text-sm text-gray-500">If an administrator created your account, replace the temporary password here.</p>
        <form onSubmit={changePassword} className="space-y-4">
          {message && <Alert variant={message.kind}>{message.text}</Alert>}
          <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} hint="8+ characters, letters and numbers" required />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <Button type="submit" isLoading={saving}>
            Update password
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ProfilePage;
