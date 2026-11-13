import React, { useState } from 'react';
import { useActivityLogs, useAbstractAnalysis } from '@/hooks/useQueries';
import { Card, Button, Select, Badge } from '@/components/ui/Base';
import { DataTable, StatsCard } from '@/components/ui/Complex';
import { ActivityLog, AbstractAnalysis } from '@/types';
import { UsersThree, Buildings, ChartBar } from '@phosphor-icons/react';

const AuditPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data: logsData, isLoading: logsLoading } = useActivityLogs({
    page,
    limit: 20,
    userRole: roleFilter || undefined,
    action: actionFilter || undefined,
  });
  const { data: analysis } = useAbstractAnalysis();

  const logs = (logsData as any)?.data as ActivityLog[] | undefined;
  const abstract = analysis as AbstractAnalysis | undefined;

  const totalUsers =
    (abstract?.roleCounts || []).reduce((sum, r) => sum + Number(r.count || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-dark">Audit trail</h2>
        <p className="text-sm text-gray-500">
          Every sign-in, exam change, submission and settings change, across all departments.
        </p>
      </div>

      {/* Abstract analysis cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard title="Total Users" value={totalUsers} icon={<UsersThree size={24} />} />
        <StatsCard
          title="Departments"
          value={abstract?.departments?.length || 0}
          icon={<Buildings size={24} />}
        />
        <StatsCard
          title="Activity Actions"
          value={abstract?.activitySummary?.length || 0}
          icon={<ChartBar size={24} />}
        />
      </div>

      {/* Department breakdown */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Department Breakdown</h3>
        <DataTable
          data={abstract?.departments || []}
          columns={[
            { key: 'name', label: 'Department' },
            { key: 'admins', label: 'Admins' },
            { key: 'students', label: 'Students' },
          ]}
        />
      </Card>

      {/* Activity summary */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">Activity Summary by Role & Action</h3>
        <DataTable
          data={abstract?.activitySummary || []}
          columns={[
            {
              key: 'user_role',
              label: 'Role',
              render: (value) => <Badge variant="primary">{value}</Badge>,
            },
            { key: 'action', label: 'Action' },
            { key: 'count', label: 'Count' },
          ]}
        />
      </Card>

      {/* Audit log feed */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold">Activity Log</h3>
          <div className="flex gap-2">
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              placeholder="All roles"
              options={[
                { value: 'superadmin', label: 'Superadmin' },
                { value: 'admin', label: 'Admin' },
                { value: 'student', label: 'Student' },
              ]}
            />
            <Select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              placeholder="All actions"
              options={[
                { value: 'auth.login', label: 'Login' },
                { value: 'auth.change_password', label: 'Password Change' },
                { value: 'exam.start', label: 'Exam Started' },
                { value: 'exam.reset_attempt', label: 'Attempt Reset' },
                { value: 'result.auto_submit', label: 'Auto-submitted' },
                { value: 'user.deactivate', label: 'User Deactivated' },
                { value: 'user.activate', label: 'User Reactivated' },
                { value: 'settings.update', label: 'Branding Updated' },
                { value: 'auth.register', label: 'Register' },
                { value: 'user.create_student', label: 'Create Student' },
                { value: 'user.create_admin', label: 'Create Admin' },
                { value: 'exam.create', label: 'Exam Create' },
                { value: 'exam.update', label: 'Exam Update' },
                { value: 'exam.delete', label: 'Exam Delete' },
                { value: 'exam.assign', label: 'Exam Assign' },
                { value: 'result.submit', label: 'Result Submit' },
                { value: 'result.export', label: 'Result Export' },
                { value: 'department.create', label: 'Department Create' },
              ]}
            />
          </div>
        </div>

        <DataTable
          data={logs || []}
          isLoading={logsLoading}
          columns={[
            {
              key: 'created_at',
              label: 'Time',
              render: (value) => new Date(value).toLocaleString(),
            },
            { key: 'user_name', label: 'User' },
            {
              key: 'user_role',
              label: 'Role',
              render: (value) => {
                const variant = value === 'superadmin' ? 'danger' : value === 'admin' ? 'primary' : 'gray';
                return <Badge variant={variant as any}>{value}</Badge>;
              },
            },
            { key: 'action', label: 'Action' },
            {
              key: 'details',
              label: 'Details',
              render: (value: any) => {
                if (!value) return '—';
                const d = typeof value === 'string' ? JSON.parse(value) : value;
                return (
                  <span className="text-xs text-gray-500">
                    {Object.entries(d)
                      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
                      .slice(0, 3)
                      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
                      .join(' · ')}
                  </span>
                );
              },
            },
          ]}
        />
      </Card>

      {(logsData as any)?.pagination?.total > 20 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuditPage;