import React, { useState } from 'react';
import { useAdmins, useDepartments, useCreateAdmin, useCreateDepartment, useSetUserStatus } from '@/hooks/useQueries';
import { Card, Button, Input, Select, Badge, Alert, PageHeader } from '@/components/ui/Base';
import { apiError } from '@/utils/format';
import { passwordProblem } from './RegisterPage';
import { DataTable } from '@/components/ui/Complex';
import { Department, User } from '@/types';
import { ShieldCheck, Plus } from '@phosphor-icons/react';

const AdminsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const { data: adminsData, isLoading: adminsLoading } = useAdmins(page, 20);
  const { data: departments } = useDepartments();
  const createAdmin = useCreateAdmin();
  const createDepartment = useCreateDepartment();

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [showCreateDept, setShowCreateDept] = useState(false);

  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    department_id: 0,
  });

  const [deptForm, setDeptForm] = useState({ name: '', code: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const setStatus = useSetUserStatus();

  const admins = (adminsData as any)?.data as User[] | undefined;

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(adminForm.password);
    if (problem) return setError(problem);
    if (!adminForm.department_id) return setError('Choose the department this admin will manage.');
    try {
      await createAdmin.mutateAsync(adminForm);
      setNotice(`${adminForm.name} can now sign in as a department admin.`);
      setAdminForm({ name: '', email: '', password: '', department_id: 0 });
      setShowCreateAdmin(false);
    } catch (err) {
      setError(apiError(err, 'Could not create the admin'));
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createDepartment.mutateAsync(deptForm);
      setNotice(`Department "${deptForm.name}" created.`);
      setDeptForm({ name: '', code: '' });
      setShowCreateDept(false);
    } catch (err) {
      setError(apiError(err, 'Could not create the department'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Department admins"
        description="Each admin manages the exams and candidates of one department."
        actions={
        <>
          <Button variant="outline" onClick={() => setShowCreateDept(!showCreateDept)}>
            <Plus size={16} className="inline mr-1" /> New Department
          </Button>
          <Button onClick={() => setShowCreateAdmin(!showCreateAdmin)}>
            <ShieldCheck size={16} className="inline mr-1" /> New Admin
          </Button>
        </>
        }
      />

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      {showCreateDept && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Create Department</h3>
          <form onSubmit={handleCreateDepartment} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Department Name"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              required
            />
            <Input
              label="Code (optional)"
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
            />
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" isLoading={createDepartment.isPending}>
                Create Department
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreateDept(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {showCreateAdmin && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">Create Admin</h3>
          <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={adminForm.email}
              onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              value={adminForm.password}
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
              hint="8+ characters with letters and numbers"
              required
            />
            <Select
              label="Department"
              value={adminForm.department_id}
              onChange={(e) => setAdminForm({ ...adminForm, department_id: Number(e.target.value) })}
              options={(departments || []).map((d: Department) => ({ value: d.id, label: d.name }))}
              required
            />
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" isLoading={createAdmin.isPending}>
                Create Admin
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowCreateAdmin(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <DataTable
          data={admins || []}
          isLoading={adminsLoading}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Email' },
            {
              key: 'department_name',
              label: 'Department',
              render: (value) => value || <Badge variant="gray">Unassigned</Badge>,
            },
            {
              key: 'is_active',
              label: 'Status',
              render: (v) => (v === 0 || v === false ? <Badge variant="gray" size="sm">Deactivated</Badge> : <Badge variant="success" size="sm">Active</Badge>),
            },
            {
              key: 'id',
              label: '',
              render: (_, row: any) => {
                const active = !(row.is_active === 0 || row.is_active === false);
                return (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={active ? 'text-red-600 hover:bg-red-50' : ''}
                      onClick={() =>
                        setStatus.mutate(
                          { userId: row.id, isActive: !active },
                          {
                            onSuccess: () => setNotice(`${row.name} has been ${active ? 'deactivated' : 'reactivated'}.`),
                            onError: (err) => setError(apiError(err, 'Could not change status')),
                          }
                        )
                      }
                    >
                      {active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </div>
                );
              },
            },
          ]}
        />
      </Card>

      {(adminsData as any)?.pagination?.total > 20 && (
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

export default AdminsPage;