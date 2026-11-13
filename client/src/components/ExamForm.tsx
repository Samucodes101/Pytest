import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { Card, Button, Input, TextArea, Select, Toggle, Alert, Badge } from '@/components/ui/Base';
import { Trash, Plus, PencilSimple, UploadSimple, DownloadSimple, ArrowUp, ArrowDown } from '@phosphor-icons/react';
import { parseQuestionCsv, QUESTION_CSV_SAMPLE } from '@/utils/csv';

export interface QuestionDraft {
  key: string;
  id?: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'a' | 'b' | 'c' | 'd';
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  answer_count?: number;
}

export interface ExamDraft {
  title: string;
  description: string;
  subject: string;
  pass_mark: number;
  average_threshold: number;
  duration_minutes: number;
  shuffle_questions: boolean;
  show_answers: boolean;
  max_violations: number;
}

export const EMPTY_EXAM: ExamDraft = {
  title: '',
  description: '',
  subject: '',
  pass_mark: 50,
  average_threshold: 75,
  duration_minutes: 30,
  shuffle_questions: true,
  show_answers: true,
  max_violations: 0,
};

const EMPTY_QUESTION: Omit<QuestionDraft, 'key'> = {
  question_text: '',
  option_a: '',
  option_b: '',
  option_c: '',
  option_d: '',
  correct_answer: 'a',
  marks: 1,
  difficulty: 'medium',
  topic: '',
};

let keySeq = 0;
export const newKey = () => `q${Date.now()}-${keySeq++}`;

/** Shape the API expects. */
export const toPayload = (exam: ExamDraft, questions: QuestionDraft[]) => ({
  ...exam,
  description: exam.description || null,
  subject: exam.subject || null,
  questions: questions.map((q) => ({
    ...(q.id ? { id: q.id } : {}),
    text: q.question_text,
    optionA: q.option_a,
    optionB: q.option_b,
    optionC: q.option_c,
    optionD: q.option_d,
    correctAnswer: q.correct_answer,
    marks: q.marks,
    difficulty: q.difficulty,
    topic: q.topic || null,
  })),
});

const DIFFICULTY_BADGE = { easy: 'success', medium: 'secondary', hard: 'warning' } as const;

interface ExamFormProps {
  exam: ExamDraft;
  setExam: React.Dispatch<React.SetStateAction<ExamDraft>>;
  questions: QuestionDraft[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionDraft[]>>;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  isSubmitting: boolean;
  error: string;
  hasAttempts?: boolean;
}

const ExamForm: React.FC<ExamFormProps> = ({
  exam,
  setExam,
  questions,
  setQuestions,
  onSubmit,
  onCancel,
  submitLabel,
  isSubmitting,
  error,
  hasAttempts,
}) => {
  const [editor, setEditor] = useState<Omit<QuestionDraft, 'key'>>({ ...EMPTY_QUESTION });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const [importNote, setImportNote] = useState<{ ok: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const totalMarks = questions.reduce((sum, q) => sum + Number(q.marks || 0), 0);

  const setField = (name: keyof ExamDraft, value: any) => setExam((prev) => ({ ...prev, [name]: value }));

  const saveQuestion = () => {
    setEditorError('');
    if (!editor.question_text.trim()) return setEditorError('Write the question first.');
    if (![editor.option_a, editor.option_b, editor.option_c, editor.option_d].every((o) => o.trim())) {
      return setEditorError('All four options need some text.');
    }
    if (!(editor.marks > 0)) return setEditorError('Marks must be greater than zero.');

    if (editingKey) {
      setQuestions((prev) => prev.map((q) => (q.key === editingKey ? { ...q, ...editor } : q)));
    } else {
      setQuestions((prev) => [...prev, { ...editor, key: newKey() }]);
    }
    setEditor({ ...EMPTY_QUESTION, difficulty: editor.difficulty, topic: editor.topic, marks: editor.marks });
    setEditingKey(null);
  };

  const editQuestion = (q: QuestionDraft) => {
    const { key, ...rest } = q;
    setEditor(rest);
    setEditingKey(key);
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const removeQuestion = (q: QuestionDraft) => {
    if (q.answer_count && q.answer_count > 0) return;
    setQuestions((prev) => prev.filter((x) => x.key !== q.key));
    if (editingKey === q.key) {
      setEditingKey(null);
      setEditor({ ...EMPTY_QUESTION });
    }
  };

  const move = (idx: number, delta: number) =>
    setQuestions((prev) => {
      const next = [...prev];
      const target = idx + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });

  const importCsv = async (file: File) => {
    const { questions: parsed, errors } = parseQuestionCsv(await file.text());
    setQuestions((prev) => [...prev, ...parsed.map((q) => ({ ...q, key: newKey() }))]);
    setImportNote({ ok: parsed.length, errors });
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([QUESTION_CSV_SAMPLE], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <Card>
        <h2 className="text-base font-semibold text-dark">Exam details</h2>
        <p className="mb-5 text-sm text-gray-500">What candidates see before they start.</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Title" value={exam.title} onChange={(e) => setField('title', e.target.value)} placeholder="e.g. Graduate Trainee Aptitude Test" required />
            <Input label="Subject / skill area" value={exam.subject} onChange={(e) => setField('subject', e.target.value)} placeholder="e.g. Quantitative Reasoning" />
          </div>
          <TextArea
            label="Instructions"
            value={exam.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Tell candidates what the exam covers and anything they should know before starting."
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Input label="Duration (minutes)" type="number" min={1} max={600} value={exam.duration_minutes} onChange={(e) => setField('duration_minutes', Number(e.target.value))} />
            <Input label="Pass mark (%)" type="number" min={0} max={100} value={exam.pass_mark} onChange={(e) => setField('pass_mark', Number(e.target.value))} />
            <Input
              label="Distinction from (%)"
              type="number"
              min={0}
              max={100}
              value={exam.average_threshold}
              onChange={(e) => setField('average_threshold', Number(e.target.value))}
              hint="Scores at or above this are 'Distinction'"
            />
            <Input label="Total marks" value={totalMarks} readOnly className="bg-light" hint="Calculated from questions" />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-dark">Delivery & integrity</h2>
        <p className="mb-5 text-sm text-gray-500">How the exam behaves while candidates are writing it.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <Toggle
            checked={exam.shuffle_questions}
            onChange={(v) => setField('shuffle_questions', v)}
            label="Shuffle question order"
            description="Each candidate gets their own order, which makes copying from a neighbour harder."
          />
          <Toggle
            checked={exam.show_answers}
            onChange={(v) => setField('show_answers', v)}
            label="Show correct answers after submission"
            description="Turn off for recruitment tests you plan to reuse."
          />
          <div className="md:col-span-2 md:max-w-sm">
            <Input
              label="Auto-submit after this many tab switches"
              type="number"
              min={0}
              max={50}
              value={exam.max_violations}
              onChange={(e) => setField('max_violations', Number(e.target.value))}
              hint="0 records tab switches but never auto-submits."
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-dark">Questions ({questions.length})</h2>
            <p className="text-sm text-gray-500">{totalMarks} marks in total.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              <DownloadSimple size={16} /> CSV template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <UploadSimple size={16} /> Import CSV
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          </div>
        </div>

        {importNote && (
          <Alert variant={importNote.errors.length ? 'warning' : 'success'} className="mb-4">
            Imported {importNote.ok} question{importNote.ok === 1 ? '' : 's'}.
            {importNote.errors.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {importNote.errors.slice(0, 5).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {importNote.errors.length > 5 && <li>…and {importNote.errors.length - 5} more</li>}
              </ul>
            )}
          </Alert>
        )}

        {hasAttempts && (
          <Alert variant="info" className="mb-4">
            Candidates have already taken this exam. You can correct wording or answers, but answered questions cannot be removed, so past results keep their full review.
          </Alert>
        )}

        {questions.length > 0 && (
          <ol className="mb-6 space-y-3">
            {questions.map((q, idx) => (
              <li
                key={q.key}
                className={clsx(
                  'rounded-xl border p-4',
                  editingKey === q.key ? 'border-primary bg-primary-50/50' : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex items-start gap-4">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50 text-sm font-semibold text-primary">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-dark">{q.question_text}</p>
                    <ul className="mt-2 grid gap-1 text-sm text-gray-600 sm:grid-cols-2">
                      {(['a', 'b', 'c', 'd'] as const).map((k) => (
                        <li key={k} className={q.correct_answer === k ? 'font-medium text-accent-700' : ''}>
                          {k.toUpperCase()}. {q[`option_${k}`]}
                          {q.correct_answer === k && ' ✓'}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="gray" size="sm">{q.marks} mark{q.marks === 1 ? '' : 's'}</Badge>
                      <Badge variant={DIFFICULTY_BADGE[q.difficulty]} size="sm">{q.difficulty}</Badge>
                      {q.topic && <Badge variant="primary" size="sm">{q.topic}</Badge>}
                      {!!q.answer_count && <Badge variant="gray" size="sm">answered {q.answer_count}×</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row">
                    <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">
                      <ArrowUp size={16} />
                    </button>
                    <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30" onClick={() => move(idx, 1)} disabled={idx === questions.length - 1} aria-label="Move down">
                      <ArrowDown size={16} />
                    </button>
                    <button className="rounded-lg p-1.5 text-primary hover:bg-primary-50" onClick={() => editQuestion(q)} aria-label="Edit question">
                      <PencilSimple size={16} />
                    </button>
                    <button
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => removeQuestion(q)}
                      disabled={!!q.answer_count}
                      title={q.answer_count ? 'Already answered by candidates' : 'Remove question'}
                      aria-label="Remove question"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div ref={editorRef} className="space-y-4 rounded-xl border-2 border-dashed border-gray-300 bg-light p-5">
          <h3 className="font-semibold text-dark">{editingKey ? 'Edit question' : 'Add a question'}</h3>
          {editorError && <Alert>{editorError}</Alert>}
          <TextArea
            label="Question"
            value={editor.question_text}
            onChange={(e) => setEditor({ ...editor, question_text: e.target.value })}
            placeholder="Type the question"
            rows={2}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(['a', 'b', 'c', 'd'] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditor({ ...editor, correct_answer: k })}
                  title="Mark as correct answer"
                  className={clsx(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border text-sm font-semibold',
                    editor.correct_answer === k ? 'border-accent bg-accent text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-accent'
                  )}
                >
                  {k.toUpperCase()}
                </button>
                <Input placeholder={`Option ${k.toUpperCase()}`} value={editor[`option_${k}`]} onChange={(e) => setEditor({ ...editor, [`option_${k}`]: e.target.value })} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Click a letter to mark the correct option. It is currently <strong>{editor.correct_answer.toUpperCase()}</strong>.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Marks" type="number" min={0.5} step={0.5} value={editor.marks} onChange={(e) => setEditor({ ...editor, marks: Number(e.target.value) })} />
            <Select
              label="Difficulty"
              placeholder="Choose"
              value={editor.difficulty}
              onChange={(e) => setEditor({ ...editor, difficulty: (e.target.value || 'medium') as QuestionDraft['difficulty'] })}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
            <Input label="Topic (optional)" value={editor.topic} onChange={(e) => setEditor({ ...editor, topic: e.target.value })} placeholder="e.g. Percentages" />
          </div>
          <div className="flex gap-3">
            <Button onClick={saveQuestion} className="flex-1">
              <Plus size={16} />
              {editingKey ? 'Update question' : 'Add question'}
            </Button>
            {editingKey && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingKey(null);
                  setEditor({ ...EMPTY_QUESTION });
                }}
              >
                Cancel edit
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit} isLoading={isSubmitting} disabled={!exam.title.trim() || questions.length === 0}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};

export default ExamForm;
