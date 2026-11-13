import React from 'react';
import {
  useDashboardStats,
  useScoreDistribution,
  useSubjectPerformance,
  useScoreTrends,
  useTopPerformers,
} from '@/hooks/useQueries';
import { ChartContainer, PieChartComponent, BarChartComponent, LineChartComponent } from '@/components/charts/Charts';
import { Card, Badge, PageHeader } from '@/components/ui/Complex';
import { Skeleton, StatsCard } from '@/components/ui/Complex';

const AnalyticsPage: React.FC = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: distribution, isLoading: distributionLoading } = useScoreDistribution();
  const { data: performance, isLoading: performanceLoading } = useSubjectPerformance();
  const { data: trends, isLoading: trendsLoading } = useScoreTrends();
  const { data: topPerformers, isLoading: topLoading } = useTopPerformers();

  if (statsLoading || distributionLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton.Card key={i} />
        ))}
      </div>
    );
  }

  const passFailData = [
    { name: 'Distinction', value: stats?.aboveAverageCount || 0 },
    { name: 'Passed', value: stats?.passedCount || 0 },
    { name: 'Failed', value: stats?.failedCount || 0 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" description="Outcomes across every exam. Open an individual exam for question-by-question analysis." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Graded submissions" value={stats?.totalResults || 0} />
        <StatsCard title="Pass rate" value={`${stats?.passRate || '0'}%`} tone="accent" />
        <StatsCard title="Fail rate" value={`${stats?.failRate || '0'}%`} tone="danger" />
        <StatsCard title="Distinctions" value={stats?.aboveAverageCount || 0} tone="secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Outcomes" subtitle="Distinction, pass and fail across all submissions">
          <PieChartComponent data={passFailData} dataKey="value" nameKey="name" colors={['#3B82F6', '#10B981', '#EF4444']} />
        </ChartContainer>

        <ChartContainer title="Grade bands" subtitle="How submissions spread across score bands">
          <BarChartComponent
            data={distribution || []}
            bars={[{ dataKey: 'count', fill: '#1E5269', name: 'Submissions' }]}
            xAxisKey="grade"
          />
        </ChartContainer>
      </div>

      {trendsLoading ? (
        <Skeleton.Card />
      ) : (
        <ChartContainer title="Score trend" subtitle="Daily average, best and worst score over the last 30 days" className="col-span-full">
          <LineChartComponent
            data={(trends || []).map((t: any) => ({ ...t, date: new Date(t.date).toLocaleDateString() }))}
            lines={[
              { dataKey: 'average_percentage', name: 'Average %', stroke: '#1E5269' },
              { dataKey: 'highest_score', name: 'Highest %', stroke: '#10B981' },
              { dataKey: 'lowest_score', name: 'Lowest %', stroke: '#EF4444' },
            ]}
          />
        </ChartContainer>
      )}

      {performanceLoading ? (
        <Skeleton.Card />
      ) : (
        <ChartContainer title="Performance by subject" subtitle="Average score per subject or skill area" className="col-span-full">
          <BarChartComponent
            data={(performance || []).map((p: any) => ({ ...p, subject: p.subject || 'Unspecified', average_score: Number(p.average_score) }))}
            bars={[{ dataKey: 'average_score', fill: '#3B82F6', name: 'Average %' }]}
            xAxisKey="subject"
          />
        </ChartContainer>
      )}
      {topLoading ? (
        <Skeleton.Card />
      ) : (
        <Card>
          <h3 className="mb-4 text-base font-semibold text-dark">Top performers</h3>
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Name
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Email
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Avg Score
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                  Passed
                </th>
              </tr>
            </thead>
            <tbody>
              {topPerformers?.map((performer: any, idx: number) => (
                <tr key={performer.id} className="border-b last:border-0">
                  <td className="py-3 px-4">
                    <Badge variant="primary" size="sm">
                      #{idx + 1}
                    </Badge>
                    <span className="ml-2 font-medium">{performer.name}</span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {performer.email}
                  </td>
                  <td className="py-3 px-4 font-semibold text-primary-600">
                    {Number(performer.average_percentage || 0).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4">{performer.passed_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;
