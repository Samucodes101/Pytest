import React, { useState } from 'react';
import { useAssignExam, useStudents } from '@/hooks/useQueries';
import { Button, Input, Modal, Alert } from '@/components/ui/Base';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { apiError } from '@/utils/format';

interface ExamAssignModalProps {
  examId: number;
  alreadyAssigned?: number[];
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

const ExamAssignModal: React.FC<ExamAssignModalProps> = ({ examId, alreadyAssigned = [], onClose, onSuccess }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');
  const { data: studentsData, isLoading } = useStudents(1, 100);
  const { mutate: assignExam, isPending } = useAssignExam();

  const assignedSet = new Set(alreadyAssigned);
  const students = (studentsData?.data || []).filter((s: any) => s.is_active !== 0 && s.is_active !== false);
  const term = searchTerm.toLowerCase();
  const filtered = students.filter((s: any) => s.name?.toLowerCase().includes(term) || s.email?.toLowerCase().includes(term));
  const selectable = filtered.filter((s: any) => !assignedSet.has(s.id));

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allSelected = selectable.length > 0 && selectable.every((s: any) => selected.includes(s.id));

  const handleAssign = () => {
    setError('');
    if (selected.length === 0) return setError('Select at least one candidate.');
    if (dueDate && new Date(dueDate).getTime() < Date.now()) return setError('The due date must be in the future.');

    assignExam(
      { examId, studentIds: selected, dueDate: dueDate ? new Date(dueDate).toISOString() : null },
      {
        onSuccess: () => {
          onSuccess?.(selected.length);
          onClose();
        },
        onError: (err) => setError(apiError(err, 'Could not assign the exam')),
      }
    );
  };

  return (
    <Modal
      title="Assign to candidates"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} isLoading={isPending} disabled={selected.length === 0}>
            Assign to {selected.length} candidate{selected.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            placeholder="Search by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<MagnifyingGlass size={18} />}
          />
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date (optional)" hint="Optional due date. Leave empty for no deadline." />
        </div>

        {error && <Alert>{error}</Alert>}

        <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-light px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded accent-[#1E5269]"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? [] : selectable.map((s: any) => s.id))}
          />
          <span className="flex-1 font-medium text-dark">Select all ({selectable.length})</span>
          <span className="text-gray-500">{selected.length} selected</span>
        </label>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading candidates…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No candidates found in your department.</p>
          ) : (
            filtered.map((s: any) => {
              const assigned = assignedSet.has(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${assigned ? 'border-gray-100 opacity-60' : 'cursor-pointer border-gray-200 hover:bg-light'}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-[#1E5269]"
                    disabled={assigned}
                    checked={assigned || selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-dark">{s.name}</p>
                    <p className="truncate text-xs text-gray-500">{s.email}</p>
                  </div>
                  {assigned && <span className="text-xs text-gray-500">Already assigned</span>}
                </label>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ExamAssignModal;
