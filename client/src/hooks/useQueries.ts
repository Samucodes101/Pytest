import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';

// Hooks for exams
export const useExams = (page: number = 1, limit: number = 20, subject?: string, search?: string) => {
  return useQuery({
    queryKey: ['exams', page, limit, subject, search],
    queryFn: () => apiClient.getExams(page, limit, subject, search),
  });
};

export const useExamDetails = (examId: number) => {
  return useQuery({
    queryKey: ['exam', examId],
    queryFn: () => apiClient.getExamDetails(examId),
    enabled: !!examId,
  });
};

export const useCreateExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiClient.createExam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });
};

export const useUpdateExam = (examId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiClient.updateExam(examId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
    },
  });
};

export const useDeleteExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: number) => apiClient.deleteExam(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });
};

// Hooks for assignments
export const useStudentAssignments = (studentId?: number) => {
  return useQuery({
    queryKey: ['assignments', studentId],
    queryFn: () => apiClient.getStudentAssignments(studentId),
  });
};

export const useAssignExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ examId, studentIds, dueDate }: { examId: number; studentIds: number[]; dueDate?: string | null }) =>
      apiClient.assignExam(examId, studentIds, dueDate),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['examAssignments', vars.examId] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
  });
};

export const useExamAssignments = (examId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['examAssignments', examId],
    queryFn: () => apiClient.getExamAssignments(examId),
    enabled: !!examId && enabled,
  });
};

export const useResetAssignment = (examId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: number) => apiClient.resetAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examAssignments', examId] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
};

export const useItemAnalysis = (examId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['itemAnalysis', examId],
    queryFn: () => apiClient.getItemAnalysis(examId),
    enabled: !!examId && enabled,
  });
};

// Hooks for results
export const useSubmitExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, answers, violations }: { assignmentId: number; answers: any[]; violations?: number }) =>
      apiClient.submitExam(assignmentId, answers, violations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
};

export const useResult = (resultId: number) => {
  return useQuery({
    queryKey: ['result', resultId],
    queryFn: () => apiClient.getResult(resultId),
    enabled: !!resultId,
  });
};

export const useStudentResults = (studentId?: number, page: number = 1, limit: number = 20, search?: string) => {
  return useQuery({
    queryKey: ['studentResults', studentId, page, limit, search],
    queryFn: () => apiClient.getStudentResults(studentId, page, limit, search),
  });
};

export const useAllResults = (page: number = 1, limit: number = 20, status?: string, examId?: number, search?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['results', page, limit, status, examId, search],
    queryFn: () => apiClient.getAllResults(page, limit, status, examId, search),
    enabled,
  });
};

// Hooks for analytics
export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => apiClient.getDashboardStats(),
  });
};

export const useScoreDistribution = () => {
  return useQuery({
    queryKey: ['scoreDistribution'],
    queryFn: () => apiClient.getScoreDistribution(),
  });
};

export const useSubjectPerformance = () => {
  return useQuery({
    queryKey: ['subjectPerformance'],
    queryFn: () => apiClient.getSubjectPerformance(),
  });
};

export const useScoreTrends = () => {
  return useQuery({
    queryKey: ['scoreTrends'],
    queryFn: () => apiClient.getScoreTrends(),
  });
};

export const useTopPerformers = (limit: number = 10) => {
  return useQuery({
    queryKey: ['topPerformers', limit],
    queryFn: () => apiClient.getTopPerformers(limit),
  });
};

export const useExamStats = (examId: number) => {
  return useQuery({
    queryKey: ['examStats', examId],
    queryFn: () => apiClient.getExamStats(examId),
    enabled: !!examId,
  });
};

export const useStudentPerformanceTrend = (studentId?: number) => {
  return useQuery({
    queryKey: ['studentPerformanceTrend', studentId],
    queryFn: () => apiClient.getStudentPerformanceTrend(studentId),
  });
};

// User hooks
export const useStudents = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: ['students', page, limit],
    queryFn: () => apiClient.getStudents(page, limit),
  });
};

export const useStudent = (studentId: number) => {
  return useQuery({
    queryKey: ['student', studentId],
    queryFn: () => apiClient.getStudent(studentId),
    enabled: !!studentId,
  });
};

export const useStudentStats = (studentId?: number) => {
  return useQuery({
    queryKey: ['studentStats', studentId],
    queryFn: () => apiClient.getStudentStats(studentId),
    enabled: !!studentId,
  });
};

export const useSetUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean }) => apiClient.setUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['searchStudents'] });
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      queryClient.invalidateQueries({ queryKey: ['student'] });
    },
  });
};

export const usePublicDepartments = () => {
  return useQuery({
    queryKey: ['publicDepartments'],
    queryFn: () => apiClient.getPublicDepartments(),
    staleTime: 5 * 60 * 1000,
  });
};

export const useSearchStudents = (query: string) => {
  return useQuery({
    queryKey: ['searchStudents', query],
    queryFn: () => apiClient.searchStudents(query),
    enabled: !!query && query.length > 0,
  });
};

export const useCreateStudent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; department_id?: number }) =>
      apiClient.createStudent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
};

// Department hooks
export const useDepartments = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => apiClient.getDepartments(),
    enabled,
  });
};

// Superadmin hooks
export const useAdmins = (page: number = 1, limit: number = 20) => {
  return useQuery({
    queryKey: ['admins', page, limit],
    queryFn: () => apiClient.getAdmins(page, limit),
  });
};

export const useCreateAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; department_id: number }) =>
      apiClient.createAdmin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
  });
};

export const useCreateDepartment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; code?: string }) => apiClient.createDepartment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
};

export const useActivityLogs = (params: { page?: number; limit?: number; userRole?: string; action?: string; userId?: number } = {}) => {
  return useQuery({
    queryKey: ['activityLogs', params],
    queryFn: () => apiClient.getActivityLogs(params),
  });
};

export const useAbstractAnalysis = () => {
  return useQuery({
    queryKey: ['abstractAnalysis'],
    queryFn: () => apiClient.getAbstractAnalysis(),
  });
};
