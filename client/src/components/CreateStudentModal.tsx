import React, { useState } from 'react';
import { useCreateStudent, useDepartments } from '@/hooks/useQueries';
import { useAuthStore } from '@/hooks/useAuthStore';
import { Button, Input, Select, Modal, Alert } from '@/components/ui/Base';
import { passwordProblem } from '@/pages/RegisterPage';
import { apiError } from '@/utils/format';

interface CreateStudentModalProps {
  onClose: () => void;
  onSuccess?: (name: string) => void;
}

const CreateStudentModal: React.FC<CreateStudentModalProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuthStore();
  const isSuper = user?.role === 'superadmin';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');

  const { data: departments } = useDepartments(isSuper);
  const { mutate: createStudent, isPending } = useCreateStudent();

  const handleSubmit = () => {
    setError('');
    if (!name.trim() || !email.trim()) return setError('Name and email are required.');
    if (isSuper && !departmentId) return setError('Choose a department for this candidate.');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);

    createStudent(
      { name: name.trim(), email: email.trim(), password, ...(isSuper ? { department_id: Number(departmentId) } : {}) },
      {
        onSuccess: () => {
          onSuccess?.(name.trim());
          onClose();
        },
        onError: (err) => setError(apiError(err, 'Could not create the account')),
      }
    );
  };

  return (
    <Modal
      title="Add a candidate"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isPending}>
            Create account
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tunde Bakare" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidate@example.com" />
        {isSuper ? (
          <Select
            label="Department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            options={(departments || []).map((d) => ({ value: d.id, label: d.name }))}
          />
        ) : (
          <p className="text-xs text-gray-500">The candidate will be added to your department.</p>
        )}
        <Input
          label="Temporary password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="8+ characters with letters and numbers. Share it with the candidate; they can change it from their profile."
        />
      </div>
    </Modal>
  );
};

export default CreateStudentModal;
