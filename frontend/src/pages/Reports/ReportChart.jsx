import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'

export default function ReportChart({ data = [] }) {
  const dataset = useMemo(() => normalise(data), [data])
  const keys = useMemo(() => {
    if (!dataset.length) return []
    return Object.keys(dataset[0]).filter((key) => key !== 'date')
  }, [dataset])

  if (!dataset.length || !keys.length) {
    return <p style={empty}>No chart data</p>
  }

  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dataset}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          {keys.map((key) => (
            <Line key={key} type="monotone" dataKey={key} stroke={palette[keys.indexOf(key) % palette.length]} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function normalise(data) {
  const map = new Map()

  data.forEach((entry) => {
    const date = entry.date || entry.status

    if (!map.has(date)) {
      map.set(date, { date })
    }

    const bucket = map.get(date)

    if (typeof entry.count === 'number') {
      if (entry.method) {
        bucket[entry.method] = entry.count
      } else if (entry.status) {
        bucket[entry.status] = entry.count
      } else {
        bucket.count = entry.count
      }
    }

    if (typeof entry.total === 'number') {
      const key = entry.method ? `${entry.method}_total` : 'total'
      bucket[key] = entry.total
    }
  })

  return Array.from(map.values())
}

const palette = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7']

const empty = {
  margin: 0,
  padding: '1rem',
  color: '#64748b'
}
