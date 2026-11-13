import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudents, useSearchStudents, useSetUserStatus } from '@/hooks/useQueries';
import { Card, Button, Input, PageHeader, Badge, Alert } from '@/components/ui/Base';
import { DataTable } from '@/components/ui/Complex';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import CreateStudentModal from '@/components/CreateStudentModal';
import { apiError, formatDate, formatPercent } from '@/utils/format';

const StudentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const { data: allStudents, isLoading: allLoading } = useStudents(page);
  const { data: searchResults, isLoading: searchLoading } = useSearchStudents(searchTerm);
  const { mutate: setStatus } = useSetUserStatus();

  const students = searchTerm ? searchResults || [] : allStudents?.data || [];
  const isLoading = searchTerm ? searchLoading : allLoading;
  const total = allStudents?.pagination?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / 20));

  const toggle = (row: any) => {
    const active = !(row.is_active === 0 || row.is_active === false);
    setError('');
    setStatus(
      { userId: row.id, isActive: !active },
      {
        onSuccess: () => setNotice(`${row.name} has been ${active ? 'deactivated and signed out' : 'reactivated'}.`),
        onError: (err) => setError(apiError(err, 'Could not change the account status')),
      }
    );
  };

  const columns = [
    {
      key: 'name',
      label: 'Candidate',
      render: (v: string, row: any) => (
        <div>
          <p className="font-medium">{v}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    { key: 'department_name', label: 'Department', render: (v: string) => v || '—' },
    { key: 'exams_taken', label: 'Exams taken', render: (v: number) => v ?? '—' },
    { key: 'average_percentage', label: 'Average', render: (v: number) => formatPercent(v) },
    { key: 'created_at', label: 'Joined', render: (v: string) => formatDate(v) },
    {
      key: 'is_active',
      label: 'Status',
      render: (v: any) => (v === 0 || v === false ? <Badge variant="gray" size="sm">Deactivated</Badge> : <Badge variant="success" size="sm">Active</Badge>),
    },
    {
      key: 'id',
      label: '',
      render: (_: number, row: any) => {
        const active = !(row.is_active === 0 || row.is_active === false);
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className={active ? 'text-red-600 hover:bg-red-50' : ''} onClick={() => toggle(row)}>
              {active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="Interns, corps members and interviewees who can be assigned exams."
        actions={
          <>
            <Input
              placeholder="Search by name or email"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              icon={<MagnifyingGlass size={18} />}
              className="sm:w-72"
            />
            <Button onClick={() => setShowCreateModal(true)} className="whitespace-nowrap">
              <Plus size={16} /> Add candidate
            </Button>
          </>
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      <Card>
        <DataTable
          data={students}
          columns={columns}
          isLoading={isLoading}
          onRowClick={(row) => navigate(`/students/${row.id}`)}
          emptyMessage={searchTerm ? 'No candidates match that search.' : 'No candidates yet.'}
        />
      </Card>

      {!searchTerm && !isLoading && total > 20 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} of {lastPage} · {total} candidates
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

      {showCreateModal && <CreateStudentModal onClose={() => setShowCreateModal(false)} onSuccess={(n) => setNotice(`Account created for ${n}.`)} />}
    </div>
  );
};

export default StudentsPage;
