import type {
  CallDetail,
  CallSummary,
  CallAnalysis,
  DashboardSummary,
} from '../types'
import { idb } from './db'
import { processCallPipeline } from './localPipeline'
import { QUESTIONNAIRE_TOPICS } from './questionnaireData'
import { notifyIndexedDbUpdate } from './notifyStorage'

function analysisToApi(row: {
  id: string
  overallSentiment: string
  overallScore010: number
  summaryText: string
  agentTalkPct: number | null
  customerTalkPct: number | null
  dimensionScores: Record<string, number>
  questionnaireResults: Record<string, boolean>
  keywords: string[]
  actionItems: string[]
  observationsPos: string[]
  observationsNeg: string[]
  evidence: Record<string, string> | null
  modelName: string
  createdAt: number
}): CallAnalysis {
  return {
    id: row.id,
    overall_sentiment: row.overallSentiment as CallAnalysis['overall_sentiment'],
    overall_score_0_10: row.overallScore010,
    summary_text: row.summaryText,
    agent_talk_pct: row.agentTalkPct,
    customer_talk_pct: row.customerTalkPct,
    dimension_scores: row.dimensionScores,
    questionnaire_results: row.questionnaireResults,
    keywords: row.keywords,
    action_items: row.actionItems,
    observations_pos: row.observationsPos,
    observations_neg: row.observationsNeg,
    evidence: row.evidence,
    model_name: row.modelName,
    created_at: new Date(row.createdAt).toISOString(),
  }
}

export const localApi = {
  dashboardSummary: async (): Promise<DashboardSummary> => {
    const ready = await idb.calls.where('status').equals('ready').toArray()
    let pos = 0,
      neu = 0,
      neg = 0
    const scores: number[] = []
    const durations: number[] = []
    const kwCount = new Map<string, number>()
    let actionTotal = 0

    for (const c of ready) {
      const analyses = await idb.analyses.where('callId').equals(c.id).sortBy('createdAt')
      const latest = analyses[analyses.length - 1]
      if (!latest) continue
      const s = latest.overallSentiment
      if (s === 'positive') pos++
      else if (s === 'negative') neg++
      else neu++
      scores.push(latest.overallScore010)
      if (c.durationSec != null) durations.push(c.durationSec)
      for (const k of latest.keywords ?? []) {
        if (typeof k === 'string' && k.trim()) {
          const key = k.trim().toLowerCase()
          kwCount.set(key, (kwCount.get(key) ?? 0) + 1)
        }
      }
      actionTotal += (latest.actionItems ?? []).length
    }

    const total = ready.length
    const avgScore =
      scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null
    const avgDur =
      durations.length > 0
        ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
        : null

    const top_keywords = [...kwCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12) as [string, number][]

    return {
      total_calls: total,
      sentiment_positive: pos,
      sentiment_neutral: neu,
      sentiment_negative: neg,
      average_score: avgScore,
      average_duration_sec: avgDur,
      top_keywords,
      total_action_items: actionTotal,
    }
  },

  listCalls: async (): Promise<CallSummary[]> => {
    const rows = await idb.calls.orderBy('createdAt').reverse().toArray()
    return rows.map((c) => ({
      id: c.id,
      original_filename: c.originalFilename,
      status: c.status as CallSummary['status'],
      duration_sec: c.durationSec,
      created_at: new Date(c.createdAt).toISOString(),
      overall_sentiment: (c.latestOverallSentiment ?? null) as CallSummary['overall_sentiment'],
      overall_score_0_10: c.latestOverallScore ?? null,
    }))
  },

  getCall: async (id: string): Promise<CallDetail> => {
    const c = await idb.calls.get(id)
    if (!c) throw new Error('Call not found')

    const segs = await idb.segments.where('callId').equals(id).sortBy('startMs')
    const analyses = await idb.analyses.where('callId').equals(id).sortBy('createdAt')
    const latest = analyses.length ? analyses[analyses.length - 1] : null

    return {
      id: c.id,
      original_filename: c.originalFilename,
      status: c.status as CallDetail['status'],
      duration_sec: c.durationSec,
      created_at: new Date(c.createdAt).toISOString(),
      overall_sentiment: (c.latestOverallSentiment ?? null) as CallSummary['overall_sentiment'],
      overall_score_0_10: c.latestOverallScore ?? null,
      error_message: c.errorMessage,
      segments: segs.map((s) => ({
        id: s.id,
        start_ms: s.startMs,
        end_ms: s.endMs,
        speaker_label: s.speakerLabel as CallDetail['segments'][0]['speaker_label'],
        text: s.text,
      })),
      latest_analysis: latest ? analysisToApi(latest) : null,
    }
  },

  uploadCall: async (file: File) => {
    const id = crypto.randomUUID()
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    await idb.calls.add({
      id,
      originalFilename: file.name || 'recording',
      status: 'uploaded',
      durationSec: null,
      errorMessage: null,
      createdAt: Date.now(),
      audioBlob: blob,
    })
    notifyIndexedDbUpdate()
    queueMicrotask(() => {
      void processCallPipeline(id)
    })
    return { id, status: 'uploaded' }
  },

  reprocessCall: async (id: string) => {
    const c = await idb.calls.get(id)
    if (!c) throw new Error('Call not found')
    await idb.segments.where('callId').equals(id).delete()
    await idb.analyses.where('callId').equals(id).delete()
    await idb.calls.update(id, {
      status: 'uploaded',
      errorMessage: null,
      latestOverallSentiment: null,
      latestOverallScore: null,
    })
    notifyIndexedDbUpdate()
    queueMicrotask(() => {
      void processCallPipeline(id)
    })
    return { id, status: 'uploaded' }
  },

  questionnaireTopics: async () => QUESTIONNAIRE_TOPICS,

  getAudioPlaybackUrl: async (callId: string): Promise<string> => {
    const c = await idb.calls.get(callId)
    if (!c?.audioBlob) throw new Error('No audio for call')
    return URL.createObjectURL(c.audioBlob)
  },
}
