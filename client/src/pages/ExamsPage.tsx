import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useExams, useStudentAssignments } from '@/hooks/useQueries';
import { Card, Button, Input, PageHeader, EmptyState, Badge } from '@/components/ui/Base';
import { DataTable, Skeleton } from '@/components/ui/Complex';
import AssignmentCard from '@/components/AssignmentCard';
import { useAuthStore } from '@/hooks/useAuthStore';
import { MagnifyingGlass, Plus, FileText } from '@phosphor-icons/react';
import { formatDate } from '@/utils/format';

const StudentExams: React.FC = () => {
  const { data: assignments, isLoading } = useStudentAssignments();
  const [tab, setTab] = useState<'open' | 'done'>('open');

  const open = (assignments || []).filter((a) => a.status !== 'completed');
  const done = (assignments || []).filter((a) => a.status === 'completed');
  const list = tab === 'open' ? open : done;

  return (
    <div className="space-y-6">
      <PageHeader title="My exams" description="Assessments assigned to you. Each one is timed from the moment you press Start." />
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
        {[
          ['open', `To do (${open.length})`],
          ['done', `Completed (${done.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as 'open' | 'done')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === key ? 'bg-primary text-white' : 'text-gray-600 hover:text-dark'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton.Card />
      ) : list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={24} />}
            title={tab === 'open' ? 'Nothing to do right now' : 'No completed exams yet'}
            message={tab === 'open' ? 'When an administrator assigns you an exam, it will appear here.' : 'Your finished exams and scores will be listed here.'}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
};

const AdminExams: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useExams(page, 20, undefined, debouncedSearch);
  const exams = data?.data || [];
  const total = data?.pagination?.total ?? exams.length;
  const lastPage = Math.max(1, Math.ceil(total / 20));

  const columns = [
    {
      key: 'title',
      label: 'Exam',
      render: (val: string, row: any) => (
        <div>
          <p className="font-medium text-dark">{val}</p>
          <p className="text-xs text-gray-500">{row.subject || 'No subject'} · created {formatDate(row.created_at)}</p>
        </div>
      ),
    },
    { key: 'department_name', label: 'Department', render: (v: string) => v || '—' },
    { key: 'total_questions', label: 'Questions' },
    { key: 'duration_minutes', label: 'Duration', render: (v: number) => `${v} min` },
    { key: 'pass_mark', label: 'Pass mark', render: (v: number) => `${Number(v)}%` },
    {
      key: 'assigned_count',
      label: 'Progress',
      render: (v: number, row: any) => (
        <Badge variant={row.attempt_count > 0 ? 'success' : 'gray'} size="sm">
          {row.attempt_count}/{v} submitted
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exams"
        description="Every active exam, with how many assigned candidates have submitted."
        actions={
          <>
            <Input
              placeholder="Search by title or subject"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<MagnifyingGlass size={18} />}
              className="sm:w-72"
            />
            <Link to="/admin/create-exam">
              <Button className="w-full whitespace-nowrap">
                <Plus size={18} /> New exam
              </Button>
            </Link>
          </>
        }
      />

      <Card>
        <DataTable
          data={exams}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/exams/${row.id}`)}
          emptyMessage={debouncedSearch ? 'No exams match that search.' : 'No exams yet. Create your first one.'}
        />
      </Card>

      {!isLoading && total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} of {lastPage} · {total} exams
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= lastPage}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ExamsPage: React.FC = () => {
  const { user } = useAuthStore();
  return user?.role === 'student' ? <StudentExams /> : <AdminExams />;
};

export default ExamsPage;
