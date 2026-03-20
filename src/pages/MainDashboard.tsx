import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../api'

const SENT_COLORS = {
  positive: '#34d399',
  neutral: '#94a3b8',
  negative: '#f87171',
}

export function MainDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: api.dashboardSummary,
    refetchInterval: 12_000,
  })

  if (isLoading) return <p className="muted">Loading dashboard…</p>
  if (error) return <div className="alert">{(error as Error).message}</div>
  if (!data) return null

  const pieData = [
    { name: 'Positive', value: data.sentiment_positive, key: 'positive' as const },
    { name: 'Neutral', value: data.sentiment_neutral, key: 'neutral' as const },
    { name: 'Negative', value: data.sentiment_negative, key: 'negative' as const },
  ].filter((d) => d.value > 0)

  const pieFallback =
    data.total_calls === 0
      ? [{ name: 'No data', value: 1, key: 'neutral' as const }]
      : pieData

  return (
    <>
      <h1>Main dashboard</h1>
      <p className="muted" style={{ marginTop: '-0.75rem', marginBottom: '2rem' }}>
        Team performance and call trends at a glance.
      </p>

      <div className="grid-cards">
        <div className="card">
          <div className="card-label">Total calls processed</div>
          <div className="card-value">{data.total_calls}</div>
        </div>
        <div className="card">
          <div className="card-label">Average call score</div>
          <div className="card-value">
            {data.average_score != null ? data.average_score.toFixed(1) : '—'}
            <span className="card-sub">out of 10</span>
          </div>
        </div>
        <div className="card">
          <div className="card-label">Avg. call duration</div>
          <div className="card-value">
            {data.average_duration_sec != null
              ? `${Math.floor(data.average_duration_sec / 60)}:${String(
                  Math.round(data.average_duration_sec % 60),
                ).padStart(2, '0')}`
              : '—'}
            <span className="card-sub">mm:ss</span>
          </div>
        </div>
        <div className="card">
          <div className="card-label">Action items total</div>
          <div className="card-value">{data.total_action_items}</div>
        </div>
      </div>

      <div className="call-detail-grid" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div className="card-label" style={{ marginBottom: '0.75rem' }}>
            Sentiment split
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.total_calls === 0 ? pieFallback : pieData.length ? pieData : pieFallback}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {(data.total_calls === 0 ? pieFallback : pieData.length ? pieData : pieFallback).map(
                    (entry, i) => (
                      <Cell
                        key={i}
                        fill={SENT_COLORS[entry.key]}
                        stroke="transparent"
                      />
                    ),
                  )}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1c2431',
                    border: '1px solid #2a3548',
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card-sub" style={{ textAlign: 'center' }}>
            Positive {data.sentiment_positive} · Neutral {data.sentiment_neutral} · Negative{' '}
            {data.sentiment_negative}
          </div>
        </div>

        <div className="card">
          <div className="card-label" style={{ marginBottom: '0.75rem' }}>
            Top keywords
          </div>
          {data.top_keywords.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No keywords yet. Process calls to populate.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {data.top_keywords.map(([word, count]) => (
                <li key={word}>
                  <strong>{word}</strong> <span className="muted">×{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
