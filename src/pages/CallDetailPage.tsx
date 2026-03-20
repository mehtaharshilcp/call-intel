import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiUsesBlobAudio } from '../api'
import type { OverallSentiment, TranscriptSegment } from '../types'

const DIM_LABELS: Record<string, string> = {
  communication_clarity: 'Communication clarity',
  politeness: 'Politeness',
  business_knowledge: 'Business knowledge',
  problem_handling: 'Problem handling',
  listening_ability: 'Listening ability',
}

function sentimentClass(s: OverallSentiment) {
  if (s === 'positive') return 'sentiment-pos'
  if (s === 'negative') return 'sentiment-neg'
  return 'sentiment-neu'
}

export function CallDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const audioRef = useRef<HTMLAudioElement>(null)
  const segRefs = useRef<(HTMLDivElement | null)[]>([])
  const blobUrlRef = useRef<string | undefined>(undefined)
  const [t, setT] = useState(0)
  const [audioSrc, setAudioSrc] = useState('')

  const { data: call, isLoading, error } = useQuery({
    queryKey: ['call', id],
    queryFn: () => api.getCall(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const c = q.state.data
      if (!c) return false
      if (c.status === 'ready' || c.status === 'failed') return false
      return 3000
    },
  })

  const { data: topics } = useQuery({
    queryKey: ['questionnaire-topics'],
    queryFn: api.questionnaireTopics,
  })

  const reprocess = useMutation({
    mutationFn: () => api.reprocessCall(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['call', id] })
      qc.invalidateQueries({ queryKey: ['calls'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const segments = call?.segments ?? []
  const activeIdx = useMemo(() => {
    const ms = t * 1000
    return segments.findIndex((s) => ms >= s.start_ms && ms < s.end_ms)
  }, [t, segments])

  useEffect(() => {
    const el = segRefs.current[activeIdx]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeIdx])

  useEffect(() => {
    let cancelled = false
    blobUrlRef.current = undefined

    void (async () => {
      const n = call?.segments?.length ?? 0
      if (!call?.id || !n) {
        setAudioSrc('')
        return
      }
      try {
        const url = await api.getAudioPlaybackUrl(call.id)
        if (cancelled) {
          if (apiUsesBlobAudio && url.startsWith('blob:')) URL.revokeObjectURL(url)
          return
        }
        setAudioSrc(url)
        if (apiUsesBlobAudio && url.startsWith('blob:')) blobUrlRef.current = url
      } catch {
        if (!cancelled) setAudioSrc('')
      }
    })()

    return () => {
      cancelled = true
      const r = blobUrlRef.current
      blobUrlRef.current = undefined
      if (r) URL.revokeObjectURL(r)
    }
  }, [call?.id, call?.segments?.length])

  if (!id) return <div className="alert">Missing call id</div>
  if (isLoading) return <p className="muted">Loading call…</p>
  if (error) return <div className="alert">{(error as Error).message}</div>
  if (!call) return null

  const a = call.latest_analysis
  const questionnaireRows =
    topics?.map((top) => ({
      label: top.label,
      covered: a?.questionnaire_results?.[top.id] ?? false,
    })) ?? []

  return (
    <>
      <p style={{ marginBottom: '0.5rem' }}>
        <Link to="/calls">← All calls</Link>
      </p>
      <h1 style={{ marginBottom: '0.25rem' }}>{call.original_filename}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Status: <strong>{call.status}</strong>
        {call.error_message && (
          <>
            {' '}
            — <span style={{ color: '#f87171' }}>{call.error_message}</span>
          </>
        )}
      </p>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          disabled={reprocess.isPending || call.status === 'transcribing' || call.status === 'analyzing'}
          onClick={() => reprocess.mutate()}
        >
          Reprocess
        </button>
        {reprocess.isError && (
          <span style={{ color: '#f87171' }}>{(reprocess.error as Error).message}</span>
        )}
      </div>

      {call.status === 'failed' && (
        <div className="alert">Processing failed. Fix API keys or audio and use Reprocess.</div>
      )}

      {!a && call.status !== 'failed' && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            {call.status === 'ready'
              ? 'No analysis on file.'
              : 'Transcription and analysis running… this page updates automatically.'}
          </p>
        </div>
      )}

      {a && (
        <div className="call-detail-grid">
          <div className="card call-detail-wide">
            <h2>Call summary</h2>
            <p style={{ margin: 0 }}>{a.summary_text}</p>
            <p style={{ marginTop: '1rem' }}>
              <span className="muted">Sentiment: </span>
              <strong className={sentimentClass(a.overall_sentiment)}>{a.overall_sentiment}</strong>
              <span className="muted" style={{ marginLeft: '1.5rem' }}>
                Overall score:{' '}
              </span>
              <strong>{a.overall_score_0_10.toFixed(1)} / 10</strong>
            </p>
          </div>

          <div className="card">
            <h2>Talk time (estimated)</h2>
            <table>
              <tbody>
                <tr>
                  <td>Agent</td>
                  <td>
                    <strong>{a.agent_talk_pct != null ? `${a.agent_talk_pct}%` : '—'}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Customer</td>
                  <td>
                    <strong>{a.customer_talk_pct != null ? `${a.customer_talk_pct}%` : '—'}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Agent performance (1–10)</h2>
            {Object.entries(a.dimension_scores).map(([key, val]) => (
              <div key={key} className="dim-row" title={a.evidence?.[key] ?? ''}>
                <span className="dim-name">{DIM_LABELS[key] ?? key}</span>
                <div className="dim-bar">
                  <div className="dim-fill" style={{ width: `${Math.min(100, (val / 10) * 100)}%` }} />
                </div>
                <span style={{ width: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {val}
                </span>
              </div>
            ))}
          </div>

          <div className="card call-detail-wide">
            <h2>Business questionnaire coverage</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Asked?</th>
                  </tr>
                </thead>
                <tbody>
                  {questionnaireRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.covered ? 'Yes ✓' : 'No ✗'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card call-detail-wide">
            <h2>Top keywords</h2>
            <div className="keywords">
              {a.keywords.length === 0 ? (
                <span className="muted">None extracted.</span>
              ) : (
                a.keywords.map((k) => (
                  <span key={k} className="keyword-pill">
                    {k}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="card call-detail-wide">
            <h2>Follow-up action items</h2>
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {a.action_items.length === 0 ? (
                <li className="muted">None detected.</li>
              ) : (
                a.action_items.map((item, i) => <li key={i}>{item}</li>)
              )}
            </ul>
          </div>

          <div className="card call-detail-wide">
            <h2>AI observations</h2>
            <div className="obs-grid">
              <div className="obs-box obs-pos">
                <strong className="sentiment-pos">Positive</strong>
                <ul className="obs-list">
                  {a.observations_pos.length === 0 ? (
                    <li className="muted">None listed.</li>
                  ) : (
                    a.observations_pos.map((o, i) => <li key={i}>{o}</li>)
                  )}
                </ul>
              </div>
              <div className="obs-box obs-neg">
                <strong className="sentiment-neg">Negative</strong>
                <ul className="obs-list">
                  {a.observations_neg.length === 0 ? (
                    <li className="muted">None listed.</li>
                  ) : (
                    a.observations_neg.map((o, i) => <li key={i}>{o}</li>)
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {segments.length > 0 && (
        <div className="player-panel call-detail-wide" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ color: 'var(--muted)', marginBottom: '1rem' }}>Recording & transcript</h2>
          <audio
            ref={audioRef}
            controls
            src={audioSrc || undefined}
            onTimeUpdate={(e) => setT(e.currentTarget.currentTime)}
          />
          <TranscriptView segments={segments} activeIdx={activeIdx} segRefs={segRefs} />
        </div>
      )}
    </>
  )
}

function TranscriptView({
  segments,
  activeIdx,
  segRefs,
}: {
  segments: TranscriptSegment[]
  activeIdx: number
  segRefs: MutableRefObject<(HTMLDivElement | null)[]>
}) {
  return (
    <div className="transcript">
      {segments.map((s, i) => (
        <div
          key={s.id}
          ref={(el) => {
            segRefs.current[i] = el
          }}
          className={`transcript-seg ${s.speaker_label} ${i === activeIdx ? 'active' : ''}`}
        >
          <div className="seg-meta">
            {s.speaker_label} · {(s.start_ms / 1000).toFixed(1)}s – {(s.end_ms / 1000).toFixed(1)}s
          </div>
          {s.text}
        </div>
      ))}
    </div>
  )
}
