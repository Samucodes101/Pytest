import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useDashboardStats, useStudentPerformanceTrend, useStudentAssignments, useAllResults } from '@/hooks/useQueries';
import { StatsCard, Skeleton, DataTable } from '@/components/ui/Complex';
import { ChartContainer, PieChartComponent, LineChartComponent } from '@/components/charts/Charts';
import { Card, Button, ResultBadge, EmptyState } from '@/components/ui/Base';
import AssignmentCard from '@/components/AssignmentCard';
import { UsersThree, BookOpen, CheckCircle, Hourglass, Plus, Trophy, FileText, ChartLineUp } from '@phosphor-icons/react';
import { formatDateTime, formatPercent } from '@/utils/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  return user?.role === 'student' ? <StudentDashboard /> : <AdminDashboard />;
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();
  const { data: recent, isLoading: recentLoading } = useAllResults(1, 6);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton.Card key={i} />
        ))}
      </div>
    );
  }

  const outcomes = [
    { name: 'Distinction', value: stats?.aboveAverageCount || 0 },
    { name: 'Passed', value: stats?.passedCount || 0 },
    { name: 'Failed', value: stats?.failedCount || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dark">
            {greeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {user?.role === 'superadmin' ? 'Here is how assessments are going across the organisation.' : 'Here is how assessments are going in your department.'}
          </p>
        </div>
        <Link to="/admin/create-exam">
          <Button>
            <Plus size={18} /> New exam
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Candidates" value={stats?.totalStudents || 0} icon={<UsersThree />} subtitle="Registered" />
        <StatsCard title="Active exams" value={stats?.totalExams || 0} icon={<BookOpen />} tone="secondary" subtitle={`${stats?.pendingCount || 0} assignments not started`} />
        <StatsCard title="Writing right now" value={stats?.inProgressCount || 0} icon={<Hourglass />} tone="accent" subtitle="Live attempts" />
        <StatsCard
          title="Pass rate"
          value={`${stats?.passRate || '0'}%`}
          icon={<CheckCircle />}
          subtitle={`${stats?.totalResults || 0} graded submissions`}
          trend={{ value: Math.abs(Number(stats?.passRateTrend) || 0), direction: (stats?.passRateTrend || 0) < 0 ? 'down' : 'up' }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <ChartContainer title="Outcomes" subtitle="All graded submissions">
          {stats?.totalResults ? (
            <PieChartComponent data={outcomes} colors={['#3B82F6', '#10B981', '#EF4444']} />
          ) : (
            <EmptyState icon={<ChartLineUp size={24} />} title="No submissions yet" message="Charts fill in once candidates finish their first exam." />
          )}
        </ChartContainer>

        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-dark">Latest submissions</h3>
              <p className="text-sm text-gray-500">Click a row to review the answers.</p>
            </div>
            <Link to="/results" className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <DataTable
            isLoading={recentLoading}
            data={recent?.data || []}
            onRowClick={(row) => navigate(`/results/${row.id}`)}
            emptyMessage="No submissions yet."
            columns={[
              { key: 'student_name', label: 'Candidate' },
              { key: 'exam_title', label: 'Exam' },
              { key: 'percentage', label: 'Score', render: (v: number) => formatPercent(v) },
              { key: 'status', label: 'Outcome', render: (v: string) => <ResultBadge status={v} size="sm" /> },
              { key: 'completed_at', label: 'When', render: (v: string) => formatDateTime(v) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

const StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { data: assignments, isLoading } = useStudentAssignments();
  const { data: performance } = useStudentPerformanceTrend();

  const open = (assignments || []).filter((a) => a.status !== 'completed');
  const done = (assignments || []).filter((a) => a.status === 'completed');
  const average = done.length ? done.reduce((s, a) => s + Number(a.percentage || 0), 0) / done.length : null;
  const best = done.length ? Math.max(...done.map((a) => Number(a.percentage || 0))) : null;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-primary p-8 text-white">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
        <div className="relative">
          <h1 className="text-2xl font-semibold">
            {greeting()}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-primary-100">
            {open.length
              ? `You have ${open.length} exam${open.length === 1 ? '' : 's'} waiting. Each one is timed from the moment you press Start, so begin when you are ready.`
              : 'You are all caught up. New assessments will appear here as soon as they are assigned.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard title="Waiting for you" value={open.length} icon={<FileText />} />
        <StatsCard title="Average score" value={formatPercent(average)} icon={<ChartLineUp />} tone="secondary" subtitle={`${done.length} completed`} />
        <StatsCard title="Best score" value={formatPercent(best)} icon={<Trophy />} tone="accent" />
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-dark">Up next</h2>
        {isLoading ? (
          <Skeleton.Card />
        ) : open.length === 0 ? (
          <Card>
            <EmptyState icon={<CheckCircle size={24} />} title="Nothing to do right now" />
          </Card>
        ) : (
          <div className="space-y-3">
            {open.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </div>

      {performance && performance.length > 1 && (
        <ChartContainer title="Your progress" subtitle="Score on each exam, oldest first">
          <LineChartComponent
            data={performance.map((item: any) => ({ date: new Date(item.completed_at).toLocaleDateString(), percentage: Number(item.percentage) }))}
            lines={[{ dataKey: 'percentage', name: 'Score (%)', stroke: '#1E5269' }]}
          />
        </ChartContainer>
      )}
    </div>
  );
};

export default DashboardPage;
