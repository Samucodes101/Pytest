import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStudent, useStudentStats, useStudentPerformanceTrend, useStudentResults } from '@/hooks/useQueries';
import { Card, Button, Badge, ResultBadge } from '@/components/ui/Base';
import { Skeleton, StatsCard } from '@/components/ui/Complex';
import { ChartContainer, LineChartComponent } from '@/components/charts/Charts';
import { ArrowLeft, BookOpen, CheckCircle, Trophy, TrendUp } from '@phosphor-icons/react';

const StudentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const studentId = parseInt(id!);

  const { data: student, isLoading: studentLoading } = useStudent(studentId);
  const { data: stats } = useStudentStats(studentId);
  const { data: trend, isLoading: trendLoading } = useStudentPerformanceTrend(studentId);
  const { data: resultsData, isLoading: resultsLoading } = useStudentResults(studentId, 1, 20);

  if (studentLoading) {
    return (
      <div className="space-y-6">
        <Skeleton.Card />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton.Card />
          <Skeleton.Card />
          <Skeleton.Card />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <Card className="text-center py-12">
        <p className="text-gray-600 mb-4">Student not found.</p>
        <Link to="/students">
          <Button variant="outline">Back to Students</Button>
        </Link>
      </Card>
    );
  }

  const results = resultsData?.data || [];
  const avgScore = stats?.average_percentage ?? 0;

  return (
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-2 text-primary-600 hover:underline">
        <ArrowLeft size={18} />
        Back to candidates
      </Link>

      {/* Student header */}
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold">
              {student.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{student.name}</h1>
              <p className="text-gray-600">{student.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {student.department_name && <Badge variant="gray">{student.department_name}</Badge>}
            {student.is_active === 0 || student.is_active === false ? <Badge variant="gray">Deactivated</Badge> : <Badge variant="success">Active</Badge>}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Enrolled {new Date(student.created_at).toLocaleDateString()}
        </p>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Exams Taken"
          value={stats?.exams_taken ?? 0}
          subtitle="Total attempts"
          icon={<BookOpen />}
        />
        <StatsCard
          title="Average Score"
          value={`${avgScore}%`}
          subtitle="Across all exams"
          icon={<TrendUp />}
        />
        <StatsCard
          title="Passed"
          value={stats?.passed ?? 0}
          subtitle="Passed exams"
          icon={<CheckCircle />}
        />
      </div>

      {/* Performance trend */}
      <ChartContainer title="Performance Trend" subtitle="Score progression across completed exams">
        {trendLoading ? (
          <Skeleton.Text lines={3} />
        ) : trend && trend.length > 0 ? (
          <LineChartComponent
            data={trend.map((item: any) => ({
              date: new Date(item.completed_at).toLocaleDateString(),
              percentage: item.percentage,
              exam: item.exam_name,
            }))}
            lines={[{ dataKey: 'percentage', name: 'Score (%)', stroke: '#1E5269' }]}
          />
        ) : (
          <p className="text-gray-600 text-center py-8">No performance data yet.</p>
        )}
      </ChartContainer>

      {/* Results list */}
      <Card>
        <h2 className="text-xl font-bold mb-6">Exam Results</h2>
        {resultsLoading ? (
          <Skeleton.Table rows={3} cols={4} />
        ) : results.length === 0 ? (
          <p className="text-gray-600 py-8">No results available.</p>
        ) : (
          <div className="space-y-3">
            {results.map((result: any) => (
              <div
                key={result.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-gray-900">{result.exam_title}</p>
                  <p className="text-sm text-gray-600">
                    {result.obtained_marks}/{result.total_marks} marks
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {result.percentage}%
                  </span>
                  <ResultBadge status={result.status} size="sm" />
                  <Link to={`/results/${result.id}`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Highest score highlight */}
      {stats && stats.highest_score != null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Highest Score"
            value={`${stats.highest_score}%`}
            icon={<Trophy />}
            subtitle="Best result"
          />
          <StatsCard
            title="Lowest Score"
            value={`${stats.lowest_score}%`}
            icon={<TrendUp />}
            subtitle="Lowest result"
          />
          <StatsCard
            title="Above Average"
            value={stats.above_average ?? 0}
            icon={<CheckCircle />}
            subtitle="Above-average results"
          />
        </div>
      )}
    </div>
  );
};

export default StudentDetailPage;