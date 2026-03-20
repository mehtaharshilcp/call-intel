import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { CallStatus } from '../types'

function StatusBadge({ status }: { status: CallStatus }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

export function CallsPage() {
  const qc = useQueryClient()
  const { data: calls, isLoading, error } = useQuery({
    queryKey: ['calls'],
    queryFn: api.listCalls,
    refetchInterval: (q) => {
      const list = q.state.data
      if (!list?.length) return false
      const busy = list.some((c) => c.status === 'uploaded' || c.status === 'transcribing' || c.status === 'analyzing')
      return busy ? 4000 : false
    },
  })

  const upload = useMutation({
    mutationFn: (file: File) => api.uploadCall(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calls'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <>
      <h1>Calls</h1>
      <p className="muted" style={{ marginTop: '-0.75rem', marginBottom: '1.25rem' }}>
        Upload recordings and open each call for the full intelligence report.
      </p>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
          Upload audio
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
            hidden
            disabled={upload.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload.mutate(f)
              e.target.value = ''
            }}
          />
        </label>
        {upload.isError && (
          <span className="muted" style={{ color: '#f87171' }}>
            {(upload.error as Error).message}
          </span>
        )}
        {upload.isSuccess && <span className="muted">Upload started — processing in background.</span>}
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {error && <div className="alert">{(error as Error).message}</div>}

      {!isLoading && calls && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Score</th>
                <th>Sentiment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td>{c.original_filename}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    {c.duration_sec != null
                      ? `${Math.round(c.duration_sec)}s`
                      : '—'}
                  </td>
                  <td>
                    {c.overall_score_0_10 != null ? c.overall_score_0_10.toFixed(1) : '—'}
                  </td>
                  <td>
                    {c.overall_sentiment ? (
                      <span
                        className={
                          c.overall_sentiment === 'positive'
                            ? 'sentiment-pos'
                            : c.overall_sentiment === 'negative'
                              ? 'sentiment-neg'
                              : 'sentiment-neu'
                        }
                      >
                        {c.overall_sentiment}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <Link to={`/calls/${c.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {calls.length === 0 && (
            <div className="empty-state">No calls yet. Upload an audio file to begin.</div>
          )}
        </div>
      )}
    </>
  )
}
