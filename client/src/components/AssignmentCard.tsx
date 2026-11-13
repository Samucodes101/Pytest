import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ListNumbers, CalendarBlank, ArrowRight } from '@phosphor-icons/react';
import { StudentAssignment } from '@/types';
import { Badge, Button, ResultBadge } from '@/components/ui/Base';
import { dueLabel, formatPercent } from '@/utils/format';

/** One assigned exam from the candidate's point of view, with the right next action. */
const AssignmentCard: React.FC<{ assignment: StudentAssignment }> = ({ assignment: a }) => {
  const due = dueLabel(a.due_date);
  const expired = !!due?.overdue && a.status === 'pending';

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-dark">{a.title}</p>
          {a.status === 'in_progress' && <Badge variant="warning">In progress</Badge>}
          {a.status === 'completed' && <ResultBadge status={a.result_status} />}
          {expired && <Badge variant="danger">Missed</Badge>}
        </div>
        {a.subject && <p className="mt-0.5 text-sm text-gray-500">{a.subject}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><Clock size={14} /> {a.duration_minutes} minutes</span>
          <span className="flex items-center gap-1.5"><ListNumbers size={14} /> {a.total_questions} questions</span>
          {due && a.status !== 'completed' && (
            <span className={`flex items-center gap-1.5 ${due.overdue ? 'text-red-600' : ''}`}>
              <CalendarBlank size={14} /> {due.text}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-3">
        {a.status === 'completed' ? (
          <>
            <span className="text-lg font-semibold text-dark">{formatPercent(a.percentage)}</span>
            {a.result_id && (
              <Link to={`/results/${a.result_id}`}>
                <Button variant="outline" size="sm">View result</Button>
              </Link>
            )}
          </>
        ) : expired ? (
          <span className="text-sm text-gray-500">Contact your administrator</span>
        ) : (
          <Link to={`/exams/${a.exam_id}`}>
            <Button size="sm" variant={a.status === 'in_progress' ? 'accent' : 'primary'}>
              {a.status === 'in_progress' ? 'Resume' : 'Start'} <ArrowRight size={14} />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default AssignmentCard;
