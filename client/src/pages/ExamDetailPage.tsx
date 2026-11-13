import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useExamDetails, useDeleteExam, useExamAssignments, useResetAssignment, useItemAnalysis, useExamStats } from '@/hooks/useQueries';
import { apiClient } from '@/api/client';
import { Card, Button, Badge, ResultBadge, Alert, Modal, EmptyState } from '@/components/ui/Base';
import { Skeleton, DataTable, StatsCard } from '@/components/ui/Complex';
import { useAuthStore } from '@/hooks/useAuthStore';
import {
  Clock, ListNumbers, CheckCircle, Trophy, UserPlus, PencilSimple, Trash, DownloadSimple, Shuffle, Eye, ShieldWarning,
  ArrowCounterClockwise, UsersThree, Warning,
} from '@phosphor-icons/react';
import ExamAssignModal from '@/components/ExamAssignModal';
import { apiError, dueLabel, formatDateTime, formatDuration, formatPercent } from '@/utils/format';

const STATUS_BADGE = {
  pending: <Badge variant="gray" size="sm">Not started</Badge>,
  in_progress: <Badge variant="warning" size="sm">Writing now</Badge>,
  completed: <Badge variant="success" size="sm">Submitted</Badge>,
};

const FLAG_TEXT: Record<string, string> = {
  too_easy: 'Almost everyone got this right',
  too_hard: 'Very few got this right; check the key',
  negative_discrimination: 'Weaker candidates did better; review wording',
};

/** Candidate-facing overview: the paper itself stays hidden until Start. */
const CandidateExamView: React.FC<{ exam: any }> = ({ exam }) => {
  const navigate = useNavigate();
  const a = exam.assignment;
  const due = dueLabel(a?.due_date);
  const missed = a?.status === 'pending' && due?.overdue;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="p-8">
        <p className="text-sm font-medium text-primary">{exam.subject || 'Assessment'}</p>
        <h1 className="mt-1 text-2xl font-semibold text-dark">{exam.title}</h1>
        {exam.description && <p className="mt-4 whitespace-pre-line text-gray-600">{exam.description}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Clock, label: 'Time allowed', value: `${exam.duration_minutes} min` },
            { icon: ListNumbers, label: 'Questions', value: exam.total_questions },
            { icon: Trophy, label: 'Total marks', value: Number(exam.total_marks) },
            { icon: CheckCircle, label: 'Pass mark', value: `${Number(exam.pass_mark)}%` },
          ].map((i) => (
            <div key={i.label} className="rounded-xl bg-light p-4">
              <i.icon size={20} className="text-primary" />
              <p className="mt-2 text-xs text-gray-500">{i.label}</p>
              <p className="font-semibold text-dark">{i.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
          <p className="font-medium text-dark">Before you begin</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>The timer starts when you press Start and keeps running even if you close the page.</li>
            <li>Your answers save automatically. If your connection drops, reopen the exam to continue.</li>
            <li>Leaving the exam tab is recorded{exam.max_violations > 0 ? `, and after ${exam.max_violations} times your exam submits itself` : ''}.</li>
            <li>When the time runs out, your saved answers are submitted for you.</li>
          </ul>
        </div>

        <div className="mt-6">
          {a?.status === 'completed' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 font-medium text-accent-700">
                <CheckCircle size={20} weight="fill" /> You have completed this exam.
              </span>
              {a.result_id && (
                <Link to={`/results/${a.result_id}`}>
                  <Button variant="outline">View result</Button>
                </Link>
              )}
            </div>
          ) : missed ? (
            <Alert>The due date for this exam has passed. Please contact your administrator.</Alert>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" variant={a?.status === 'in_progress' ? 'accent' : 'primary'} onClick={() => navigate(`/exams/${exam.id}/take/${a.id}`)}>
                {a?.status === 'in_progress' ? 'Resume exam' : 'Start exam'}
              </Button>
              {due && <span className="text-sm text-gray-500">{due.text}</span>}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const AdminExamView: React.FC<{ exam: any }> = ({ exam }) => {
  const navigate = useNavigate();
  const examId = exam.id;
  const [tab, setTab] = useState<'candidates' | 'items' | 'paper'>('candidates');
  const [showAssign, setShowAssign] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: assignments, isLoading: assignmentsLoading } = useExamAssignments(examId);
  const { data: stats } = useExamStats(examId);
  const { data: items, isLoading: itemsLoading } = useItemAnalysis(examId, tab === 'items');
  const { mutate: deleteExam, isPending: isDeleting } = useDeleteExam();
  const { mutate: resetAttempt, isPending: isResetting } = useResetAssignment(examId);

  const submitted = (assignments || []).filter((a) => a.status === 'completed').length;
  const writing = (assignments || []).filter((a) => a.status === 'in_progress').length;

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await apiClient.exportResults(examId);
      const escapeCell = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csv = [data.headers, ...data.rows].map((row: any[]) => row.map(escapeCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(data.examTitle || 'results').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-results.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiError(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {exam.subject && <Badge variant="primary">{exam.subject}</Badge>}
              {exam.department_name && <Badge variant="gray">{exam.department_name}</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-dark">{exam.title}</h1>
            {exam.description && <p className="mt-2 max-w-3xl text-sm text-gray-600">{exam.description}</p>}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
              <span className="flex items-center gap-1.5"><Clock size={16} /> {exam.duration_minutes} min</span>
              <span className="flex items-center gap-1.5"><ListNumbers size={16} /> {exam.total_questions} questions · {Number(exam.total_marks)} marks</span>
              <span className="flex items-center gap-1.5"><CheckCircle size={16} /> Pass {Number(exam.pass_mark)}% · Distinction {Number(exam.average_threshold)}%</span>
              {!!exam.shuffle_questions && <span className="flex items-center gap-1.5"><Shuffle size={16} /> Shuffled</span>}
              <span className="flex items-center gap-1.5"><Eye size={16} /> {exam.show_answers ? 'Answers shown after' : 'Answers hidden'}</span>
              {exam.max_violations > 0 && <span className="flex items-center gap-1.5"><ShieldWarning size={16} /> Auto-submit after {exam.max_violations} tab switches</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowAssign(true)}>
              <UserPlus size={16} /> Assign
            </Button>
            <Link to={`/admin/edit-exam/${examId}`}>
              <Button variant="outline">
                <PencilSimple size={16} /> Edit
              </Button>
            </Link>
            <Button variant="outline" onClick={handleExport} isLoading={exporting} disabled={submitted === 0}>
              <DownloadSimple size={16} /> Export CSV
            </Button>
            <Button variant="outline" className="text-red-600 hover:border-red-300 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              <Trash size={16} />
            </Button>
          </div>
        </div>
      </Card>

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Assigned" value={assignments?.length ?? 0} icon={<UsersThree />} />
        <StatsCard title="Submitted" value={submitted} subtitle={writing ? `${writing} writing now` : undefined} icon={<CheckCircle />} tone="accent" />
        <StatsCard title="Average score" value={formatPercent(stats?.average_score)} icon={<Trophy />} tone="secondary" />
        <StatsCard
          title="Pass rate"
          value={stats?.total_attempts ? formatPercent(((Number(stats.passed) + Number(stats.above_average)) / Number(stats.total_attempts)) * 100) : '—'}
          icon={<CheckCircle />}
        />
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          ['candidates', 'Candidates'],
          ['items', 'Question analysis'],
          ['paper', 'Question paper'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as any)}
            className={clsx(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium',
              tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-dark'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'candidates' && (
        <Card>
          {!assignmentsLoading && (assignments || []).length === 0 ? (
            <EmptyState
              icon={<UserPlus size={24} />}
              title="No one has been assigned yet"
              message="Assign this exam to candidates in your department to get started."
              action={<Button onClick={() => setShowAssign(true)}>Assign candidates</Button>}
            />
          ) : (
            <DataTable
              isLoading={assignmentsLoading}
              data={assignments || []}
              columns={[
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
                { key: 'status', label: 'Status', render: (v: keyof typeof STATUS_BADGE) => STATUS_BADGE[v] },
                {
                  key: 'percentage',
                  label: 'Score',
                  render: (v: number, row: any) =>
                    row.result_id ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatPercent(v)}</span>
                        <ResultBadge status={row.result_status} size="sm" />
                      </div>
                    ) : (
                      '—'
                    ),
                },
                { key: 'time_taken_seconds', label: 'Time used', render: (v: number) => formatDuration(v) },
                {
                  key: 'violations',
                  label: 'Tab switches',
                  render: (v: number, row: any) => (
                    <span className={clsx(v > 0 && 'font-medium text-amber-700')}>
                      {v || 0}
                      {row.auto_submitted ? ' · auto-submitted' : ''}
                    </span>
                  ),
                },
                { key: 'due_date', label: 'Due', render: (v: string) => (v ? formatDateTime(v) : 'No deadline') },
                {
                  key: 'id',
                  label: '',
                  render: (_: number, row: any) => (
                    <div className="flex justify-end gap-2">
                      {row.result_id && (
                        <Link to={`/results/${row.result_id}`}>
                          <Button size="sm" variant="outline">Review</Button>
                        </Link>
                      )}
                      {row.status !== 'pending' && (
                        <Button size="sm" variant="ghost" onClick={() => setResetTarget(row)} title="Allow a retake">
                          <ArrowCounterClockwise size={16} />
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </Card>
      )}

      {tab === 'items' && (
        <Card>
          <div className="mb-4">
            <h3 className="font-semibold text-dark">How each question performed</h3>
            <p className="text-sm text-gray-500">
              Difficulty is the share of candidates who answered correctly. Discrimination compares the top and bottom 27% of scorers: good
              questions are answered correctly more often by stronger candidates (0.3 or above is healthy).
            </p>
          </div>
          {itemsLoading ? (
            <Skeleton.Table rows={4} cols={5} />
          ) : !items || items.candidates === 0 ? (
            <EmptyState title="No submissions yet" message="Question statistics appear once candidates have submitted." />
          ) : (
            <div className="space-y-3">
              {items.items.map((it) => (
                <div key={it.question_id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <p className="text-sm font-medium text-dark">
                      Q{it.number}. {it.question_text}
                    </p>
                    <div className="flex flex-shrink-0 gap-4 text-center text-xs">
                      <div>
                        <p className="text-gray-500">Correct</p>
                        <p className="text-base font-semibold text-dark">{it.difficulty_index !== null ? `${Math.round(it.difficulty_index * 100)}%` : '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Discrimination</p>
                        <p className={clsx('text-base font-semibold', (it.discrimination_index ?? 0) < 0 ? 'text-red-600' : 'text-dark')}>
                          {it.discrimination_index ?? '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(['a', 'b', 'c', 'd'] as const).map((o) => {
                      const count = it.option_counts[o] || 0;
                      const pct = it.responses ? Math.round((count / it.responses) * 100) : 0;
                      return (
                        <div
                          key={o}
                          className={clsx(
                            'min-w-[84px] rounded-lg px-3 py-1.5 text-xs',
                            o === it.correct_answer ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200' : 'bg-light text-gray-600'
                          )}
                        >
                          <span className="font-semibold">{o.toUpperCase()}</span> · {count} ({pct}%)
                        </div>
                      );
                    })}
                    {it.option_counts.blank > 0 && <div className="rounded-lg bg-light px-3 py-1.5 text-xs text-gray-500">Blank · {it.option_counts.blank}</div>}
                  </div>
                  {it.flag && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                      <Warning size={14} /> {FLAG_TEXT[it.flag]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'paper' && (
        <Card>
          <ol className="space-y-5">
            {(exam.questions || []).map((q: any, idx: number) => (
              <li key={q.id} className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                <p className="font-medium text-dark">
                  {idx + 1}. {q.question_text}
                </p>
                <ul className="mt-2 grid gap-1 text-sm text-gray-600 sm:grid-cols-2">
                  {(['a', 'b', 'c', 'd'] as const).map((k) => (
                    <li key={k} className={q.correct_answer === k ? 'font-medium text-accent-700' : ''}>
                      {k.toUpperCase()}. {q[`option_${k}`]} {q.correct_answer === k && '✓'}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Badge variant="gray" size="sm">{Number(q.marks)} marks</Badge>
                  <Badge variant="gray" size="sm">{q.difficulty}</Badge>
                  {q.topic && <Badge variant="primary" size="sm">{q.topic}</Badge>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {showAssign && (
        <ExamAssignModal
          examId={examId}
          alreadyAssigned={(assignments || []).map((a) => a.user_id)}
          onClose={() => setShowAssign(false)}
          onSuccess={(n) => setNotice(`Assigned to ${n} candidate${n === 1 ? '' : 's'}.`)}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Delete this exam?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={isDeleting}
                onClick={() =>
                  deleteExam(examId, {
                    onSuccess: () => navigate('/exams'),
                    onError: (err) => {
                      setConfirmDelete(false);
                      setError(apiError(err, 'Delete failed'));
                    },
                  })
                }
              >
                Delete exam
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            The exam disappears from every list and candidates can no longer start it. Existing results are kept for your records.
          </p>
        </Modal>
      )}

      {resetTarget && (
        <Modal
          title={`Allow ${resetTarget.name} to retake?`}
          onClose={() => setResetTarget(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={isResetting}
                onClick={() =>
                  resetAttempt(resetTarget.id, {
                    onSuccess: () => {
                      setNotice(`${resetTarget.name} can now take the exam again.`);
                      setResetTarget(null);
                    },
                    onError: (err) => {
                      setError(apiError(err, 'Reset failed'));
                      setResetTarget(null);
                    },
                  })
                }
              >
                Reset attempt
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600">
            Their current {resetTarget.status === 'completed' ? 'result' : 'attempt'} will be permanently removed and the exam reopened for them. The reset is
            recorded in the audit trail.
          </p>
        </Modal>
      )}
    </div>
  );
};

const ExamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { data: exam, isLoading, error } = useExamDetails(parseInt(id!));

  if (isLoading) return <Skeleton.Card />;
  if (error || !exam) {
    return (
      <Card>
        <EmptyState
          title="Exam not found"
          message="It may have been removed, or it is not assigned to you."
          action={
            <Link to="/exams">
              <Button variant="outline">Back to exams</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  return user?.role === 'student' ? <CandidateExamView exam={exam} /> : <AdminExamView exam={exam} />;
};

export default ExamDetailPage;
