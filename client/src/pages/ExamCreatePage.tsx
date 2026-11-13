import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateExam } from '@/hooks/useQueries';
import { PageHeader } from '@/components/ui/Base';
import ExamForm, { EMPTY_EXAM, ExamDraft, QuestionDraft, toPayload } from '@/components/ExamForm';
import { apiError } from '@/utils/format';

/** Checks shared by the create and edit pages before anything is sent. */
export const validateExam = (exam: ExamDraft, questions: QuestionDraft[]) => {
  if (exam.title.trim().length < 3) return 'Give the exam a title of at least 3 characters.';
  if (questions.length === 0) return 'Add at least one question.';
  if (exam.duration_minutes < 1) return 'The duration must be at least one minute.';
  if (exam.average_threshold < exam.pass_mark) return 'The distinction threshold cannot be lower than the pass mark.';
  return '';
};

const ExamCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { mutate: createExam, isPending } = useCreateExam();
  const [exam, setExam] = useState<ExamDraft>({ ...EMPTY_EXAM });
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const problem = validateExam(exam, questions);
    if (problem) {
      setError(problem);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError('');
    createExam(toPayload(exam, questions), {
      onSuccess: (data: any) => navigate(`/exams/${data.id}`),
      onError: (err) => {
        setError(apiError(err, 'The exam could not be created'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Create exam" description="Set up the paper, choose how it is delivered, then assign it to candidates." />
      <ExamForm
        exam={exam}
        setExam={setExam}
        questions={questions}
        setQuestions={setQuestions}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/exams')}
        submitLabel="Create exam"
        isSubmitting={isPending}
        error={error}
      />
    </div>
  );
};

export default ExamCreatePage;
