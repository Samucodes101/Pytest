import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { apiClient } from '@/api/client';
import { AttemptSession, CandidateQuestion } from '@/types';
import { Button, Alert, Modal } from '@/components/ui/Base';
import { ProgressBar } from '@/components/ui/Complex';
import { BrandMark } from '@/components/layout/Navigation';
import { apiError } from '@/utils/format';
import { Timer, Flag, CaretLeft, CaretRight, CloudCheck, CloudSlash, Warning, PaperPlaneTilt } from '@phosphor-icons/react';

type ActiveSession = Extract<AttemptSession, { completed: false }>;
type SaveState = 'idle' | 'saving' | 'saved' | 'offline';

const OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;
const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_INTERVAL_MS = 20000;

const optionText = (q: CandidateQuestion, key: (typeof OPTION_KEYS)[number]) =>
  ({ a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d })[key];

const ExamTakePage: React.FC = () => {
  const { assignmentId } = useParams<{ examId: string; assignmentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const id = Number(assignmentId);

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loadError, setLoadError] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);
  const [violations, setViolations] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [focusWarning, setFocusWarning] = useState(false);

  // Refs mirror state for use inside timers and event listeners.
  const answersRef = useRef(answers);
  const violationsRef = useRef(violations);
  const dirtyRef = useRef(false);
  const finishedRef = useRef(false);
  const submittingRef = useRef(false);
  const clockOffsetRef = useRef(0);
  answersRef.current = answers;
  violationsRef.current = violations;

  const finish = useCallback(
    (resultId: number | null | undefined, reason?: string) => {
      finishedRef.current = true;
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['studentResults'] });
      if (resultId) navigate(`/results/${resultId}`, { replace: true, state: reason ? { notice: reason } : undefined });
      else navigate('/exams', { replace: true });
    },
    [navigate, queryClient]
  );

  // Start or resume the attempt.
  useEffect(() => {
    let cancelled = false;
    apiClient
      .startAttempt(id)
      .then((data) => {
        if (cancelled) return;
        if (data.completed) return finish(data.resultId, 'This attempt was already closed, so here is your result.');
        clockOffsetRef.current = new Date(data.serverNow).getTime() - Date.now();
        setSession(data);
        setAnswers(data.savedAnswers || {});
        setViolations(data.violations || 0);
      })
      .catch((err) => !cancelled && setLoadError(apiError(err, 'Could not open this exam')));
    return () => {
      cancelled = true;
    };
  }, [id, finish]);

  const save = useCallback(async () => {
    if (!session || finishedRef.current) return;
    dirtyRef.current = false;
    setSaveState('saving');
    try {
      const res = await apiClient.saveProgress(id, answersRef.current, violationsRef.current);
      if (res.autoSubmitted) {
        return finish(res.resultId, 'Your exam was submitted automatically because you left the exam window too many times.');
      }
      setSaveState('saved');
      setLastSaved(new Date());
    } catch (err: any) {
      dirtyRef.current = true;
      // 409/410 mean the server has already closed the attempt.
      if ([409, 410].includes(err?.response?.status)) return;
      setSaveState('offline');
    }
  }, [id, session, finish]);

  const submit = useCallback(
    async (auto = false) => {
      if (!session || finishedRef.current || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setSubmitError('');
      try {
        const payload = session.questions.map((q) => ({ questionId: q.id, selectedAnswer: answersRef.current[String(q.id)] || null }));
        const res = await apiClient.submitExam(id, payload, violationsRef.current);
        finish(res.resultId, auto ? 'Time ran out, so your answers were submitted automatically.' : undefined);
      } catch (err: any) {
        if (err?.response?.status === 409) {
          // Already closed (e.g. by another tab): show the result instead.
          const fresh = await apiClient.startAttempt(id).catch(() => null);
          return finish(fresh && fresh.completed ? fresh.resultId : null);
        }
        setSubmitError(apiError(err, 'Submission failed. Check your connection and try again; your answers are saved.'));
        submittingRef.current = false;
        setSubmitting(false);
        if (auto) setShowConfirm(true);
      }
    },
    [id, session, finish]
  );

  // Countdown against the server deadline (corrected for clock skew).
  useEffect(() => {
    if (!session) return;
    const deadline = new Date(session.deadline).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - (Date.now() + clockOffsetRef.current)) / 1000));
      setRemaining(left);
      if (left === 0 && !finishedRef.current) submit(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session, submit]);

  // Debounced autosave after each change, plus a periodic safety save.
  useEffect(() => {
    if (!session || !dirtyRef.current) return;
    const t = setTimeout(save, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [answers, session, save]);

  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => dirtyRef.current && save(), AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [session, save]);

  // Integrity: count every time the candidate leaves the exam tab.
  useEffect(() => {
    if (!session) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && !finishedRef.current) {
        setViolations((v) => v + 1);
        violationsRef.current += 1;
        setFocusWarning(true);
        save();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (finishedRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [session, save]);

  const questions = session?.questions || [];
  const question = questions[current];

  const choose = useCallback(
    (key: string) => {
      if (!question) return;
      dirtyRef.current = true;
      setAnswers((prev) => ({ ...prev, [String(question.id)]: key }));
    },
    [question]
  );

  // Keyboard: A–D or 1–4 to answer, arrow keys to move.
  useEffect(() => {
    if (!session) return;
    const onKey = (e: KeyboardEvent) => {
      if (showConfirm || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      const idx = ['1', '2', '3', '4'].indexOf(k);
      if (OPTION_KEYS.includes(k as any)) choose(k);
      else if (idx >= 0) choose(OPTION_KEYS[idx]);
      else if (e.key === 'ArrowRight') setCurrent((c) => Math.min(questions.length - 1, c + 1));
      else if (e.key === 'ArrowLeft') setCurrent((c) => Math.max(0, c - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, choose, questions.length, showConfirm]);

  const answeredCount = useMemo(() => questions.filter((q) => answers[String(q.id)]).length, [questions, answers]);
  const unanswered = questions.length - answeredCount;

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-light p-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <Alert>{loadError}</Alert>
          <Link to="/exams">
            <Button variant="outline">Back to my exams</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!session || remaining === null || !question) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-light">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary" />
        <p className="text-sm text-gray-500">Preparing your exam…</p>
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const lowTime = remaining <= 300;
  const limit = session.exam.max_violations;
  const selected = answers[String(question.id)];
  const isFlagged = flagged.has(question.id);

  const toggleFlag = () =>
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(question.id) ? next.delete(question.id) : next.add(question.id);
      return next;
    });

  return (
    <div className="min-h-screen bg-light">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="hidden sm:block">
            <BrandMark />
          </div>
          <div className="min-w-0 flex-1 sm:border-l sm:border-gray-200 sm:pl-4">
            <p className="truncate font-semibold text-dark">{session.exam.title}</p>
            <p className="text-xs text-gray-500">
              {answeredCount} of {questions.length} answered
            </p>
          </div>
          <div className="hidden items-center gap-1.5 text-xs text-gray-500 md:flex" aria-live="polite">
            {saveState === 'offline' ? (
              <>
                <CloudSlash size={16} className="text-amber-500" /> Offline, retrying
              </>
            ) : saveState === 'saving' ? (
              <>Saving…</>
            ) : lastSaved ? (
              <>
                <CloudCheck size={16} className="text-accent" /> Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </>
            ) : null}
          </div>
          <div
            className={clsx(
              'flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-base font-semibold tabular-nums',
              lowTime ? 'bg-red-50 text-red-700 animate-pulse' : 'bg-primary-50 text-primary'
            )}
            aria-label="Time remaining"
          >
            <Timer size={20} />
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
        <ProgressBar value={(answeredCount / questions.length) * 100} tone="accent" className="h-1 rounded-none" />
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {focusWarning && (
            <Alert variant="warning" className="flex items-start gap-2">
              <Warning size={18} className="mt-0.5 flex-shrink-0" />
              <span>
                You left the exam window. This has been recorded ({violations} time{violations === 1 ? '' : 's'}).
                {limit > 0 && ` After ${limit} the exam submits automatically.`}
                <button className="ml-2 underline" onClick={() => setFocusWarning(false)}>
                  Dismiss
                </button>
              </span>
            </Alert>
          )}
          {saveState === 'offline' && (
            <Alert variant="warning">Your connection dropped. Keep going; answers are kept here and will save when you are back online.</Alert>
          )}

          {/* Question */}
          <section className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-soft sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">
                Question {current + 1} of {questions.length} · {question.marks} mark{Number(question.marks) === 1 ? '' : 's'}
              </span>
              <button
                onClick={toggleFlag}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium',
                  isFlagged ? 'bg-amber-50 text-amber-700' : 'text-gray-500 hover:bg-gray-100'
                )}
              >
                <Flag size={16} weight={isFlagged ? 'fill' : 'regular'} />
                {isFlagged ? 'Flagged' : 'Flag for review'}
              </button>
            </div>

            <h2 className="whitespace-pre-line text-lg font-medium leading-relaxed text-dark">{question.question_text}</h2>

            <div className="mt-6 space-y-3" role="radiogroup">
              {OPTION_KEYS.map((key) => {
                const active = selected === key;
                return (
                  <button
                    key={key}
                    role="radio"
                    aria-checked={active}
                    onClick={() => choose(key)}
                    className={clsx(
                      'flex w-full items-center gap-4 rounded-xl border-2 px-4 py-3.5 text-left transition-colors',
                      active ? 'border-primary bg-primary-50' : 'border-gray-200 hover:border-primary-200 hover:bg-light'
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
                        active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {key.toUpperCase()}
                    </span>
                    <span className="text-dark">{optionText(question, key)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
                <CaretLeft size={16} /> Previous
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => setCurrent((c) => c + 1)}>
                  Next <CaretRight size={16} />
                </Button>
              ) : (
                <Button variant="accent" onClick={() => setShowConfirm(true)}>
                  Review & submit <PaperPlaneTilt size={16} />
                </Button>
              )}
            </div>
          </section>
          <p className="hidden text-center text-xs text-gray-400 sm:block">Tip: press A–D to answer and the arrow keys to move between questions.</p>
        </div>

        {/* Navigator */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-soft lg:sticky lg:top-24">
            <p className="mb-3 text-sm font-semibold text-dark">Questions</p>
            <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
              {questions.map((q, idx) => {
                const done = !!answers[String(q.id)];
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrent(idx)}
                    aria-label={`Question ${idx + 1}${done ? ', answered' : ''}${flagged.has(q.id) ? ', flagged' : ''}`}
                    className={clsx(
                      'relative h-9 rounded-lg text-sm font-medium transition-colors',
                      idx === current && 'ring-2 ring-primary ring-offset-1',
                      done ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {idx + 1}
                    {flagged.has(q.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-xs text-gray-500">
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-primary" /> Answered</p>
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-gray-200" /> Not answered</p>
              <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500" /> Flagged for review</p>
            </div>
            <Button variant="accent" className="mt-5 w-full" onClick={() => setShowConfirm(true)}>
              Submit exam
            </Button>
          </div>
        </aside>
      </div>

      {showConfirm && (
        <Modal
          title="Submit your exam?"
          onClose={() => !submitting && setShowConfirm(false)}
          footer={
            <>
              <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting}>
                Keep working
              </Button>
              <Button variant="accent" onClick={() => submit(false)} isLoading={submitting}>
                Submit now
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-gray-600">
            <p>Once submitted, your answers are final and the exam is graded immediately.</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-accent-50 p-3">
                <p className="text-xl font-semibold text-accent-700">{answeredCount}</p>
                <p className="text-xs">Answered</p>
              </div>
              <div className={clsx('rounded-xl p-3', unanswered ? 'bg-red-50' : 'bg-gray-50')}>
                <p className={clsx('text-xl font-semibold', unanswered ? 'text-red-600' : 'text-gray-500')}>{unanswered}</p>
                <p className="text-xs">Unanswered</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-xl font-semibold text-amber-700">{flagged.size}</p>
                <p className="text-xs">Flagged</p>
              </div>
            </div>
            {unanswered > 0 && <p>Unanswered questions score zero.</p>}
            {submitError && <Alert>{submitError}</Alert>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ExamTakePage;
