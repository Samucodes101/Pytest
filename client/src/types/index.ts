export type Role = 'superadmin' | 'admin' | 'student';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  department_id?: number | null;
  department_name?: string;
  avatar?: string;
  is_active?: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Department {
  id: number;
  name: string;
  code?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Exam {
  id: number;
  title: string;
  description?: string;
  subject?: string;
  department_id?: number | null;
  department_name?: string;
  pass_mark: number;
  average_threshold: number;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
  created_by: number;
  is_active: boolean;
  shuffle_questions?: boolean | number;
  show_answers?: boolean | number;
  max_violations?: number;
  assigned_count?: number;
  attempt_count?: number;
  created_at: string;
}

export interface Question {
  id: number;
  exam_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
  order_index: number;
  correct_answer?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  topic?: string | null;
  answer_count?: number;
}

export interface ExamAssignment {
  id: number;
  exam_id: number;
  user_id: number;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_at: string;
  started_at?: string;
  due_date?: string;
  completed_at?: string;
}

export interface Result {
  id: number;
  user_id: number;
  exam_id: number;
  assignment_id: number;
  total_marks: number;
  obtained_marks: number;
  percentage: number;
  status: 'passed' | 'failed' | 'above_average';
  completed_at: string;
}

export interface StudentAnswer {
  id: number;
  result_id: number;
  question_id: number;
  selected_answer: string;
  is_correct: boolean;
  marks_obtained: number;
}

export interface DashboardStats {
  totalStudents: number;
  totalExams: number;
  totalResults: number;
  passedCount: number;
  failedCount: number;
  aboveAverageCount: number;
  passRate: string;
  failRate: string;
  inProgressCount?: number;
  pendingCount?: number;
  averageScore?: number;
  passRateTrend?: number;
  failRateTrend?: number;
}

export interface ScoreDistribution {
  grade: string;
  count: number;
}

export interface SubjectPerformance {
  subject: string;
  total_attempts: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  pass_count: number;
}

export interface StudentStats {
  exams_taken: number;
  passed: number;
  failed: number;
  above_average: number;
  average_percentage: number;
  highest_score: number;
  lowest_score: number;
}

export interface ActivityLog {
  id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  user_role: Role;
  action: string;
  entity?: string | null;
  entity_id?: number | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

export interface AbstractAnalysis {
  departments: {
    id: number;
    name: string;
    admins: number;
    students: number;
  }[];
  activitySummary: {
    user_role: Role;
    action: string;
    count: number;
  }[];
  roleCounts: {
    role: Role;
    count: number;
  }[];
  examActivity: {
    department_id: number | null;
    department_name: string | null;
    exams: number;
    active_exams: number;
  }[];
}

export interface Branding {
  org_name: string;
  org_tagline: string;
  logo_url: string;
  primary_color: string;
  allow_registration: 'true' | 'false';
}

export interface CandidateQuestion {
  id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
}

/** Payload returned when a candidate starts or resumes a timed attempt. */
export type AttemptSession =
  | { completed: true; resultId: number | null }
  | {
      completed: false;
      assignmentId: number;
      exam: {
        id: number;
        title: string;
        description?: string;
        duration_minutes: number;
        total_marks: number;
        max_violations: number;
      };
      questions: CandidateQuestion[];
      savedAnswers: Record<string, string>;
      violations: number;
      startedAt: string;
      deadline: string;
      serverNow: string;
    };

export interface StudentAssignment {
  id: number;
  exam_id: number;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_at: string;
  started_at?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  title: string;
  description?: string;
  subject?: string;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
  pass_mark: number;
  result_id?: number | null;
  obtained_marks?: number | null;
  percentage?: number | null;
  result_status?: Result['status'] | null;
}

export interface ExamAssignmentRow {
  id: number;
  user_id: number;
  name: string;
  email: string;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_at: string;
  started_at?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  violations: number;
  result_id?: number | null;
  percentage?: number | null;
  result_status?: Result['status'] | null;
  auto_submitted?: number | boolean | null;
  time_taken_seconds?: number | null;
}

export interface ItemAnalysisRow {
  question_id: number;
  number: number;
  question_text: string;
  topic?: string | null;
  tagged_difficulty: 'easy' | 'medium' | 'hard';
  correct_answer: string;
  responses: number;
  correct: number;
  difficulty_index: number | null;
  discrimination_index: number | null;
  option_counts: Record<string, number>;
  top_distractor: string | null;
  flag: 'too_easy' | 'too_hard' | 'negative_discrimination' | null;
}
