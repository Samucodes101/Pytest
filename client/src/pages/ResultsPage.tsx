import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentResults, useAllResults } from '@/hooks/useQueries';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Card, Button, Input, Select, PageHeader, ResultBadge } from '@/components/ui/Base';
import { DataTable } from '@/components/ui/Complex';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { formatDateTime, formatDuration, formatPercent } from '@/utils/format';

const ResultsPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: studentResults, isLoading: studentLoading } = useStudentResults(undefined, page, 20, debouncedSearch);
  const { data: allResults, isLoading: adminLoading } = useAllResults(page, 20, status || undefined, undefined, debouncedSearch, isAdmin);

  const data = isAdmin ? allResults : studentResults;
  const isLoading = isAdmin ? adminLoading : studentLoading;
  const rows = data?.data || [];
  const total = data?.pagination?.total ?? rows.length;
  const lastPage = Math.max(1, Math.ceil(total / 20));

  const scoreCol = { key: 'percentage', label: 'Score', render: (v: number) => <span className="font-medium">{formatPercent(v)}</span> };
  const statusCol = { key: 'status', label: 'Outcome', render: (v: string) => <ResultBadge status={v} size="sm" /> };
  const dateCol = { key: 'completed_at', label: 'Completed', render: (v: string) => formatDateTime(v) };

  const columns = isAdmin
    ? [
        {
          key: 'student_name',
          label: 'Candidate',
          render: (v: string, row: any) => (
            <div>
              <p className="font-medium">{v}</p>
              <p className="text-xs text-gray-500">{row.student_email}</p>
            </div>
          ),
        },
        { key: 'exam_title', label: 'Exam' },
        scoreCol,
        statusCol,
        { key: 'time_taken_seconds', label: 'Time used', render: (v: number) => formatDuration(v) },
        dateCol,
      ]
    : [
        { key: 'exam_title', label: 'Exam' },
        { key: 'obtained_marks', label: 'Marks', render: (v: number, row: any) => `${Number(v)} / ${Number(row.total_marks)}` },
        scoreCol,
        statusCol,
        dateCol,
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? 'Results' : 'My results'}
        description={isAdmin ? 'Every graded submission. Click a row to review it.' : 'Your graded exams. Click one to see the full review.'}
        actions={
          <>
            {isAdmin && (
              <Select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                placeholder="All outcomes"
                options={[
                  { value: 'above_average', label: 'Distinction' },
                  { value: 'passed', label: 'Passed' },
                  { value: 'failed', label: 'Failed' },
                ]}
                className="sm:w-44"
              />
            )}
            <Input
              placeholder={isAdmin ? 'Search candidate or exam' : 'Search exams'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              icon={<MagnifyingGlass size={18} />}
              className="sm:w-72"
            />
          </>
        }
      />

      <Card>
        <DataTable
          data={rows}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/results/${row.id}`)}
          emptyMessage={debouncedSearch || status ? 'No results match those filters.' : 'No results yet.'}
        />
      </Card>

      {!isLoading && total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} of {lastPage} · {total} results
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

export default ResultsPage;
