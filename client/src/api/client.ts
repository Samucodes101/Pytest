import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  AuthResponse,
  User,
  Department,
  DashboardStats,
  ScoreDistribution,
  SubjectPerformance,
  AbstractAnalysis,
  Branding,
  AttemptSession,
  StudentAssignment,
  ExamAssignmentRow,
  ItemAnalysisRow,
} from '@/types';

const API_BASE_URL = '/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // A failed sign-in is a 401 too; let the login form show the message.
        const url = error.config?.url || '';
        const isAuthAttempt = url.startsWith('/auth/login') || url.startsWith('/auth/register');
        if (error.response?.status === 401 && !isAuthAttempt) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(data: { name: string; email: string; password: string; department_id?: number }) {
    const response = await this.client.post<{ success: boolean; data: AuthResponse }>('/auth/register', data);
    return response.data.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post<{ success: boolean; data: AuthResponse }>('/auth/login', { email, password });
    return response.data.data;
  }

  async getMe() {
    const response = await this.client.get<{ success: boolean; data: User }>('/auth/me');
    return response.data.data;
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.put<any>('/auth/password', { currentPassword, newPassword });
    return response.data;
  }

  // Settings / branding
  async getSettings() {
    const response = await this.client.get<{ success: boolean; data: Branding }>('/settings');
    return response.data.data;
  }

  async updateSettings(data: Partial<Branding>) {
    const response = await this.client.put<{ success: boolean; data: Branding }>('/settings', data);
    return response.data.data;
  }

  async getPublicDepartments() {
    const response = await this.client.get<{ success: boolean; data: { id: number; name: string }[] }>('/departments/public');
    return response.data.data;
  }

  // User endpoints
  async createStudent(data: { name: string; email: string; password: string; department_id?: number }) {
    const response = await this.client.post<any>('/users', data);
    return response.data.data;
  }

  async createAdmin(data: { name: string; email: string; password: string; department_id: number }) {
    const response = await this.client.post<any>('/users/admin', data);
    return response.data.data;
  }

  async getAdmins(page: number = 1, limit: number = 20) {
    const response = await this.client.get<any>('/users/admin', { params: { page, limit } });
    return response.data;
  }

  async getStudents(page: number = 1, limit: number = 20) {
    const response = await this.client.get<any>('/users', { params: { page, limit } });
    return response.data;
  }

  async getStudent(studentId: number) {
    const response = await this.client.get<any>(`/users/${studentId}`);
    return response.data.data;
  }

  async getStudentStats(studentId?: number) {
    const url = studentId ? `/users/stats/${studentId}` : '/users/stats';
    const response = await this.client.get<any>(url);
    return response.data.data;
  }

  async setUserStatus(userId: number, isActive: boolean) {
    const response = await this.client.patch<any>(`/users/${userId}/status`, { is_active: isActive });
    return response.data.data;
  }

  async searchStudents(query: string) {
    const response = await this.client.get<any>('/users/search', { params: { q: query } });
    return response.data.data;
  }

  // Department endpoints
  async getDepartments() {
    const response = await this.client.get<{ success: boolean; data: Department[] }>('/departments');
    return response.data.data;
  }

  async createDepartment(data: { name: string; code?: string }) {
    const response = await this.client.post<any>('/departments', data);
    return response.data.data;
  }

  // Activity/audit endpoints (superadmin)
  async getActivityLogs(params: { page?: number; limit?: number; userRole?: string; action?: string; userId?: number } = {}) {
    const response = await this.client.get<any>('/activity', { params });
    return response.data;
  }

  async getAbstractAnalysis() {
    const response = await this.client.get<{ success: boolean; data: AbstractAnalysis }>('/activity/abstract-analysis');
    return response.data.data;
  }

  // Exam endpoints
  async getExams(page: number = 1, limit: number = 20, subject?: string, search?: string) {
    const response = await this.client.get<any>('/exams', { params: { page, limit, subject, search } });
    return response.data;
  }

  async getExamDetails(examId: number) {
    const response = await this.client.get<any>(`/exams/${examId}`);
    return response.data.data;
  }

  async createExam(data: any) {
    const response = await this.client.post<any>('/exams', data);
    return response.data.data;
  }

  async updateExam(examId: number, data: any) {
    const response = await this.client.put<any>(`/exams/${examId}`, data);
    return response.data;
  }

  async deleteExam(examId: number) {
    const response = await this.client.delete<any>(`/exams/${examId}`);
    return response.data;
  }

  async assignExam(examId: number, studentIds: number[], dueDate?: string | null) {
    const response = await this.client.post<any>('/exams/assign', { examId, studentIds, dueDate: dueDate || null });
    return response.data.data;
  }

  async getExamAssignments(examId: number): Promise<ExamAssignmentRow[]> {
    const response = await this.client.get<any>(`/exams/${examId}/assignments`);
    return response.data.data;
  }

  async resetAssignment(assignmentId: number) {
    const response = await this.client.post<any>(`/exams/assignments/${assignmentId}/reset`);
    return response.data;
  }

  async startAttempt(assignmentId: number): Promise<AttemptSession> {
    const response = await this.client.post<any>(`/exams/assignments/${assignmentId}/start`);
    return response.data.data;
  }

  async saveProgress(assignmentId: number, answers: Record<string, string>, violations: number) {
    const response = await this.client.put<any>(`/exams/assignments/${assignmentId}/progress`, { answers, violations });
    return response.data.data as { saved: boolean; autoSubmitted: boolean; resultId?: number; savedAt?: string };
  }

  async getStudentAssignments(studentId?: number): Promise<StudentAssignment[]> {
    const url = studentId ? `/exams/assignments/${studentId}` : '/exams/assignments';
    const response = await this.client.get<any>(url);
    return response.data.data;
  }

  // Result endpoints
  async submitExam(assignmentId: number, answers: any[], violations?: number) {
    const response = await this.client.post<any>('/results/submit', { assignmentId, answers, violations });
    return response.data.data;
  }

  async getResult(resultId: number) {
    const response = await this.client.get<any>(`/results/${resultId}`);
    return response.data.data;
  }

  async getStudentResults(studentId?: number, page: number = 1, limit: number = 20, search?: string) {
    const url = studentId ? `/results/student/${studentId}` : '/results/student';
    const response = await this.client.get<any>(url, { params: { page, limit, search } });
    return response.data;
  }

  async getAllResults(page: number = 1, limit: number = 20, status?: string, examId?: number, search?: string) {
    const response = await this.client.get<any>('/results', { params: { page, limit, status, examId, search } });
    return response.data;
  }

  async exportResults(examId: number) {
    const response = await this.client.get<any>(`/results/export/${examId}`);
    return response.data.data;
  }

  // Analytics endpoints
  async getDashboardStats() {
    const response = await this.client.get<{ success: boolean; data: DashboardStats }>('/analytics/dashboard');
    return response.data.data;
  }

  async getScoreDistribution() {
    const response = await this.client.get<{ success: boolean; data: ScoreDistribution[] }>('/analytics/distribution');
    return response.data.data;
  }

  async getSubjectPerformance() {
    const response = await this.client.get<{ success: boolean; data: SubjectPerformance[] }>('/analytics/subject-performance');
    return response.data.data;
  }

  async getScoreTrends() {
    const response = await this.client.get<any>('/analytics/trends');
    return response.data.data;
  }

  async getTopPerformers(limit: number = 10) {
    const response = await this.client.get<any>('/analytics/top-performers', { params: { limit } });
    return response.data.data;
  }

  async getExamStats(examId: number) {
    const response = await this.client.get<any>(`/analytics/exam/${examId}`);
    return response.data.data;
  }

  async getItemAnalysis(examId: number) {
    const response = await this.client.get<{
      success: boolean;
      data: { exam: { id: number; title: string }; candidates: number; items: ItemAnalysisRow[] };
    }>(`/analytics/exam/${examId}/items`);
    return response.data.data;
  }

  async getStudentPerformanceTrend(studentId?: number) {
    const url = studentId ? `/analytics/student/${studentId}` : '/analytics/student';
    const response = await this.client.get<any>(url);
    return response.data.data;
  }
}

export const apiClient = new ApiClient();