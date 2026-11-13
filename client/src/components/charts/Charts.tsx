import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../ui/Base';

/** Brand palette: primary, secondary, accent, then warm tones for warnings/failures. */
export const CHART_COLORS = ['#1E5269', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({ title, subtitle, children, className }) => (
  <Card className={className}>
    <div className="mb-6">
      <h3 className="text-base font-semibold text-dark">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </Card>
);

interface PieChartProps {
  data: any[];
  dataKey?: string;
  nameKey?: string;
  colors?: string[];
}

export const PieChartComponent: React.FC<PieChartProps> = ({
  data,
  dataKey = 'value',
  nameKey = 'name',
  colors = CHART_COLORS,
}) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ percent }) => (percent > 0 ? `${(percent * 100).toFixed(0)}%` : "")}
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          fill="#8884d8"
          dataKey={dataKey}
          nameKey={nameKey}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => value} />
        <Legend verticalAlign="bottom" height={32} />
      </PieChart>
    </ResponsiveContainer>
  );
};

interface LineChartProps {
  data: any[];
  lines: { dataKey: string; stroke?: string; name?: string }[];
}

export const LineChartComponent: React.FC<LineChartProps> = ({
  data,
  lines,
}) => {
  const colors = CHART_COLORS;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
          }}
        />
        <Legend />
        {lines.map((line, idx) => (
          <Line
            dot={{ r: 3 }}
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            stroke={line.stroke || colors[idx % colors.length]}
            name={line.name || line.dataKey}
            strokeWidth={2}
            isAnimationActive
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

interface BarChartProps {
  data: any[];
  bars: { dataKey: string; fill?: string; name?: string }[];
  xAxisKey?: string;
}

export const BarChartComponent: React.FC<BarChartProps> = ({
  data,
  bars,
  xAxisKey = 'name',
}) => {
  const colors = CHART_COLORS;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey={xAxisKey} stroke="#6B7280" fontSize={12} />
        <YAxis stroke="#6B7280" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
          }}
        />
        <Legend />
        {bars.map((bar, idx) => (
          <Bar
            key={bar.dataKey}
            dataKey={bar.dataKey}
            fill={bar.fill || colors[idx % colors.length]}
            name={bar.name || bar.dataKey}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};
