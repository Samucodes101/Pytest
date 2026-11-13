import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExamDetails, useUpdateExam } from '@/hooks/useQueries';
import { PageHeader } from '@/components/ui/Base';
import { Skeleton } from '@/components/ui/Complex';
import ExamForm, { EMPTY_EXAM, ExamDraft, QuestionDraft, newKey, toPayload } from '@/components/ExamForm';
import { validateExam } from './ExamCreatePage';
import { apiError } from '@/utils/format';

const ExamEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const examId = parseInt(id!);

  const { data: exam, isLoading } = useExamDetails(examId);
  const { mutate: updateExam, isPending } = useUpdateExam(examId);

  const [draft, setDraft] = useState<ExamDraft>({ ...EMPTY_EXAM });
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!exam) return;
    setDraft({
      title: exam.title || '',
      description: exam.description || '',
      subject: exam.subject || '',
      pass_mark: Number(exam.pass_mark) || 50,
      average_threshold: Number(exam.average_threshold) || 75,
      duration_minutes: Number(exam.duration_minutes) || 30,
      shuffle_questions: !!exam.shuffle_questions,
      show_answers: !!exam.show_answers,
      max_violations: Number(exam.max_violations) || 0,
    });
    setQuestions(
      (exam.questions || []).map((q: any) => ({
        key: newKey(),
        id: q.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer || 'a',
        marks: Number(q.marks) || 1,
        difficulty: q.difficulty || 'medium',
        topic: q.topic || '',
        answer_count: Number(q.answer_count) || 0,
      }))
    );
  }, [exam]);

  if (isLoading) return <Skeleton.Card />;

  const handleSubmit = () => {
    const problem = validateExam(draft, questions);
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    updateExam(toPayload(draft, questions), {
      onSuccess: () => navigate(`/exams/${examId}`),
      onError: (err) => {
        setError(apiError(err, 'The exam could not be saved'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Edit exam" description={exam?.title} />
      <ExamForm
        exam={draft}
        setExam={setDraft}
        questions={questions}
        setQuestions={setQuestions}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/exams/${examId}`)}
        submitLabel="Save changes"
        isSubmitting={isPending}
        error={error}
        hasAttempts={questions.some((q) => (q.answer_count || 0) > 0)}
      />
    </div>
  );
};

export default ExamEditPage;
