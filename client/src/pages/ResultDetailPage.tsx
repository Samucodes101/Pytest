import React from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { useResult } from '@/hooks/useQueries';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useBrandingStore } from '@/hooks/useBranding';
import { Card, Button, ResultBadge, Alert, EmptyState } from '@/components/ui/Base';
import { Skeleton, ProgressRing } from '@/components/ui/Complex';
import { CheckCircle, XCircle, MinusCircle, Printer, ArrowLeft } from '@phosphor-icons/react';
import { formatDateTime, formatDuration } from '@/utils/format';

const OPTIONS = ['a', 'b', 'c', 'd'] as const;

const ResultDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { user } = useAuthStore();
  const { branding } = useBrandingStore();
  const { data: result, isLoading, error } = useResult(parseInt(id!));
  const notice = (location.state as { notice?: string } | null)?.notice;
  const isStudent = user?.role === 'student';

  if (isLoading) return <Skeleton.Card />;
  if (error || !result) {
    return (
      <Card>
        <EmptyState title="Result not found" action={<Link to="/results"><Button variant="outline">Back to results</Button></Link>} />
      </Card>
    );
  }

  const answers: any[] = result.answers || [];
  const correctCount = answers.filter((a) => a.is_correct).length;
  const blankCount = answers.filter((a) => !a.selected_answer).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between no-print">
        <Link to={isStudent ? '/results' : `/exams/${result.exam_id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft size={16} /> {isStudent ? 'My results' : 'Back to exam'}
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer size={16} /> Print result slip
        </Button>
      </div>

      {notice && <Alert variant="info" className="no-print">{notice}</Alert>}

      <Card className="p-8">
        <div className="mb-6 hidden items-center justify-between border-b border-gray-200 pb-4 print:flex">
          <div className="flex items-center gap-3">
            {branding.logo_url && <img src={branding.logo_url} alt="" className="h-12 w-auto object-contain" />}
            <p className="text-lg font-semibold">{branding.org_name}</p>
          </div>
          <p className="text-sm text-gray-500">Result slip #{result.id}</p>
        </div>
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-medium text-primary">{result.subject || 'Assessment result'}</p>
            <h1 className="mt-1 text-2xl font-semibold text-dark">{result.exam_title}</h1>
            {!isStudent && (
              <p className="mt-1 text-sm text-gray-600">
                {result.student_name} · {result.student_email}
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <ResultBadge status={result.status} />
              {!!result.auto_submitted && <span className="text-xs font-medium text-amber-700">Submitted automatically</span>}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ['Score', `${Number(result.obtained_marks)} / ${Number(result.total_marks)}`],
                ['Pass mark', `${Number(result.pass_mark)}%`],
                ['Time used', `${formatDuration(result.time_taken_seconds)} of ${result.duration_minutes}m`],
                ['Tab switches', String(result.violations ?? 0)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="mt-0.5 font-semibold text-dark">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-gray-500">Completed {formatDateTime(result.completed_at)}</p>
          </div>
          <div className="flex justify-center">
            <ProgressRing percentage={Number(result.percentage)} size={180} passMark={Number(result.pass_mark)} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-dark">Question review</h2>
          {!result.answers_hidden && (
            <p className="text-sm text-gray-500">
              {correctCount} correct · {answers.length - correctCount - blankCount} wrong · {blankCount} unanswered
            </p>
          )}
        </div>

        {result.answers_hidden ? (
          <Alert variant="info">
            The examiner has chosen not to release the answer key for this exam. Your score above is final; contact your administrator if you
            have questions.
          </Alert>
        ) : (
          <ol className="space-y-4">
            {answers.map((answer, idx) => {
              const Icon = !answer.selected_answer ? MinusCircle : answer.is_correct ? CheckCircle : XCircle;
              return (
                <li
                  key={answer.id}
                  className={clsx(
                    'rounded-xl border-l-4 p-4 break-inside-avoid',
                    !answer.selected_answer ? 'border-gray-300 bg-light' : answer.is_correct ? 'border-accent bg-accent-50/60' : 'border-red-400 bg-red-50/60'
                  )}
                >
                  <div className="flex gap-3">
                    <Icon
                      size={22}
                      weight="fill"
                      className={clsx('mt-0.5 flex-shrink-0', !answer.selected_answer ? 'text-gray-400' : answer.is_correct ? 'text-accent' : 'text-red-500')}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-dark">
                          {idx + 1}. {answer.question_text}
                        </p>
                        <span className="flex-shrink-0 text-xs font-medium text-gray-500">
                          {Number(answer.marks_obtained)}/{Number(answer.marks)}
                        </span>
                      </div>
                      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
                        {OPTIONS.map((k) => {
                          const isCorrect = answer.correct_answer === k;
                          const isChosen = answer.selected_answer === k;
                          return (
                            <li
                              key={k}
                              className={clsx(
                                'rounded-lg px-3 py-1.5',
                                isCorrect && 'bg-accent-100 font-medium text-accent-700',
                                isChosen && !isCorrect && 'bg-red-100 text-red-700 line-through decoration-red-400',
                                !isCorrect && !isChosen && 'text-gray-600'
                              )}
                            >
                              {k.toUpperCase()}. {answer[`option_${k}`]}
                              {isChosen && <span className="ml-1 text-xs no-underline">(your answer)</span>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
};

export default ResultDetailPage;
