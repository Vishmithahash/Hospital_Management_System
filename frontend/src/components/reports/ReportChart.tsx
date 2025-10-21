import type { MutableRefObject } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

type ReportChartProps = {
  chart?: any
  containerRef?: MutableRefObject<HTMLDivElement | null>
}

export default function ReportChart({ chart, containerRef }: ReportChartProps) {
  if (!chart || !chart.series) {
    if (containerRef) containerRef.current = null
    return null
  }

  const ref = containerRef ?? undefined

  if (chart.kind === 'line') {
    const data = chart.series[0]?.data || []
    return (
      <div ref={ref} style={card}>
        <h4 style={title}>Trend</h4>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.xAxis || 'day'} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={chart.yAxis || 'visits'} stroke="#0ea5e9" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  if (chart.kind === 'stacked') {
    const series = chart.series || []
    // Flatten stacked series into one dataset with keys
    const keys = series.map((s: any) => s.name)
    const days = series[0]?.data?.map((d: any) => d.day) || []
    const data = days.map((day: string) =>
      keys.reduce(
        (acc: any, k: string, idx: number) => ({ ...acc, [k]: series[idx].data.find((i: any) => i.day === day)?.[k] || 0, day }),
        { day }
      )
    )
    return (
      <div ref={ref} style={card}>
        <h4 style={title}>Appointment Load</h4>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            {keys.map((k: string, i: number) => (
              <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Default: bar
  const data = chart.series[0]?.data || []
  const x = chart.xAxis || 'hour'
  const y = chart.yAxis || 'cnt'
  return (
    <div ref={ref} style={card}>
      <h4 style={title}>Distribution</h4>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={x} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={y} fill="#0ea5e9" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: '0.75rem 1rem', border: '1px solid #e2e8f0' }
const title: React.CSSProperties = { margin: 0, marginBottom: 8, fontSize: 14, color: '#334155' }
const colors = ['#22c55e', '#0ea5e9', '#f43f5e', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444']

