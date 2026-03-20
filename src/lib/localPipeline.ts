import { chatJson, chatModel, transcribeAudio } from './localOpenai'
import { idb, type SegmentRecord } from './db'
import { notifyIndexedDbUpdate } from './notifyStorage'
import { topicsForPrompt } from './questionnaireData'

type SegWorking = {
  start_ms: number
  end_ms: number
  speaker_label: 'agent' | 'customer' | 'unknown'
  text: string
}

function emit() {
  notifyIndexedDbUpdate()
}

async function assignSpeakers(segments: SegWorking[]): Promise<void> {
  if (!segments.length) return
  const body = segments
    .slice(0, 200)
    .map((s, i) => `${i}: ${s.text}`)
    .join('\n')
  const hint =
    '{"assignments":[{"segment_index":0,"speaker":"agent"|"customer"|"unknown"}]}'
  const raw = await chatJson([
    {
      role: 'system',
      content:
        'You label each transcript segment as agent or customer in a sales call. Return ONLY JSON: ' +
        hint,
    },
    { role: 'user', content: body },
  ])
  try {
    const parsed = JSON.parse(raw) as {
      assignments?: Array<{ segment_index?: number; speaker?: string }>
    }
    for (const item of parsed.assignments ?? []) {
      const idx = Number(item.segment_index ?? -1)
      const sp = String(item.speaker ?? 'unknown').toLowerCase()
      if (idx < 0 || idx >= segments.length) continue
      if (sp === 'agent' || sp === 'customer' || sp === 'unknown') {
        segments[idx].speaker_label = sp
      }
    }
  } catch {
    /* ignore */
  }
}

function talkPct(segments: SegWorking[]): [number | null, number | null] {
  let a = 0
  let c = 0
  for (const s of segments) {
    const d = Math.max(0, s.end_ms - s.start_ms)
    if (s.speaker_label === 'agent') a += d
    else if (s.speaker_label === 'customer') c += d
  }
  const t = a + c
  if (t <= 0) return [null, null]
  return [Math.round((100 * a) / t * 10) / 10, Math.round((100 * c) / t * 10) / 10]
}

function transcriptForPrompt(segments: SegWorking[]): string {
  return segments
    .map((s) => `[${s.speaker_label} ${s.start_ms}-${s.end_ms}ms]: ${s.text}`)
    .join('\n')
}

/** Pull a JSON object out of model text (fenced block or outermost braces). */
function extractJsonObject(raw: string): string {
  let s = raw.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(s)
  if (fence) s = fence[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

function coveredToBool(v: unknown): boolean {
  if (v === true) return true
  if (v === false) return false
  return false
}

function buildAnalysisPrompt(transcript: string, topics: ReturnType<typeof topicsForPrompt>) {
  const topicsStr = JSON.stringify(topics)
  const topicIds = topics.map((t) => t.id).join(', ')
  return `Analyze this sales call transcript. Return ONLY one JSON object (no markdown), matching this shape:
{
  "overall_sentiment": "positive" | "neutral" | "negative",
  "overall_score_0_10": number 0-10,
  "summary_text": "2-4 sentences",
  "agent_talk_pct": number 0-100 or null,
  "customer_talk_pct": number 0-100 or null,
  "dimension_scores": {
    "communication_clarity": 1-10,
    "politeness": 1-10,
    "business_knowledge": 1-10,
    "problem_handling": 1-10,
    "listening_ability": 1-10
  },
  "questionnaire_coverage": [ {"topic_id": "<one of listed ids>", "covered": true or false } ],
  "keywords": ["short relevant phrases as strings"],
  "action_items": ["strings"],
  "observations_positive": ["strings"],
  "observations_negative": ["strings"],
  "evidence": {}
}

Rules:
- questionnaire_coverage must have exactly one row for EACH topic_id in: ${topicIds}
- Each "covered" value must be JSON boolean true or false only (not numbers, not arrays).
- topic_id must be exactly one of those ids; do not add extra rows (e.g. do not use "keywords" as topic_id — "keywords" is only the separate top-level string array).
Questionnaire topics (exact topic_id and hints): ${topicsStr}
Transcript:
${transcript}`
}

function clampDim(n: unknown): number {
  const x = Math.round(Number(n))
  if (Number.isNaN(x)) return 5
  return Math.max(1, Math.min(10, x))
}

function parseAnalysis(
  raw: string,
  topics: ReturnType<typeof topicsForPrompt>,
  agentPct: number | null,
  customerPct: number | null
) {
  try {
    const d = JSON.parse(raw) as Record<string, unknown>
    const dimIn = (d.dimension_scores ?? {}) as Record<string, unknown>
    const dimensionScores = {
      communication_clarity: clampDim(dimIn.communication_clarity),
      politeness: clampDim(dimIn.politeness),
      business_knowledge: clampDim(dimIn.business_knowledge),
      problem_handling: clampDim(dimIn.problem_handling),
      listening_ability: clampDim(dimIn.listening_ability),
    }
    const cov = (d.questionnaire_coverage ?? []) as Array<{ topic_id?: string; covered?: unknown }>
    const allowedIds = new Set(topics.map((t) => t.id))
    const questionnaireResults: Record<string, boolean> = {}
    for (const row of cov) {
      const id = row.topic_id ? String(row.topic_id) : ''
      if (!id || !allowedIds.has(id)) continue
      questionnaireResults[id] = coveredToBool(row.covered)
    }
    for (const t of topics) {
      if (questionnaireResults[t.id] === undefined) questionnaireResults[t.id] = false
    }

    const s = String(d.overall_sentiment ?? 'neutral')
    const overallSentiment =
      s === 'positive' || s === 'negative' || s === 'neutral' ? s : 'neutral'

    return {
      overallSentiment,
      overallScore010: Math.max(0, Math.min(10, Number(d.overall_score_0_10 ?? 5))),
      summaryText: String(d.summary_text ?? ''),
      agentTalkPct:
        d.agent_talk_pct != null ? Number(d.agent_talk_pct) : agentPct,
      customerTalkPct:
        d.customer_talk_pct != null ? Number(d.customer_talk_pct) : customerPct,
      dimensionScores,
      questionnaireResults,
      keywords: (d.keywords as string[] | undefined)?.slice(0, 20) ?? [],
      actionItems: (d.action_items as string[] | undefined)?.slice(0, 30) ?? [],
      observationsPos:
        (d.observations_positive as string[] | undefined)?.slice(0, 20) ?? [],
      observationsNeg:
        (d.observations_negative as string[] | undefined)?.slice(0, 20) ?? [],
      evidence: (d.evidence as Record<string, string> | null | undefined) ?? null,
      rawLlmResponse: raw.slice(0, 65000),
    }
  } catch {
    const questionnaireResults: Record<string, boolean> = {}
    for (const t of topics) questionnaireResults[t.id] = false
    return {
      overallSentiment: 'neutral' as const,
      overallScore010: 5,
      summaryText: 'Analysis could not be parsed; try Reprocess.',
      agentTalkPct: agentPct,
      customerTalkPct: customerPct,
      dimensionScores: {
        communication_clarity: 5,
        politeness: 5,
        business_knowledge: 5,
        problem_handling: 5,
        listening_ability: 5,
      },
      questionnaireResults,
      keywords: [] as string[],
      actionItems: [] as string[],
      observationsPos: [] as string[],
      observationsNeg: [] as string[],
      evidence: null as Record<string, string> | null,
      rawLlmResponse: '{"error":"fallback"}',
    }
  }
}

async function runAnalysisLlm(
  segments: SegWorking[],
  agentPct: number | null,
  customerPct: number | null
) {
  const topics = topicsForPrompt()
  const prompt = buildAnalysisPrompt(transcriptForPrompt(segments), topics)
  let rawText = ''
  for (let attempt = 0; attempt < 3; attempt++) {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: 'You are an expert sales QA analyst. Output JSON only.' },
      {
        role: 'user',
        content:
          attempt === 0
            ? prompt
            : prompt + '\n\nInvalid JSON before. Return valid JSON only.',
      },
    ]
    if (attempt > 0 && rawText) {
      messages.push({ role: 'assistant', content: rawText })
      messages.push({ role: 'user', content: 'Fix JSON only.' })
    }
    rawText = await chatJson(messages, { jsonObject: false })
    const trimmed = extractJsonObject(rawText)
    try {
      JSON.parse(trimmed)
      rawText = trimmed
      break
    } catch {
      /* retry */
    }
  }
  return parseAnalysis(extractJsonObject(rawText), topics, agentPct, customerPct)
}

export async function processCallPipeline(callId: string): Promise<void> {
  const call = await idb.calls.get(callId)
  if (!call) return

  try {
    await idb.calls.update(callId, {
      status: 'transcribing',
      errorMessage: null,
    })
    emit()

    await idb.segments.where('callId').equals(callId).delete()
    await idb.analyses.where('callId').equals(callId).delete()

    const data = await transcribeAudio(call.audioBlob, call.originalFilename)
    const duration = data.duration ?? null
    const rawSegs = data.segments ?? []
    const segments: SegWorking[] = []

    for (const s of rawSegs) {
      const start = Math.round((s.start ?? 0) * 1000)
      const end = Math.round((s.end ?? 0) * 1000)
      const text = String(s.text ?? '').trim()
      if (!text) continue
      segments.push({
        start_ms: start,
        end_ms: Math.max(end, start + 1),
        speaker_label: 'unknown',
        text,
      })
    }
    if (!segments.length && data.text) {
      const durMs = duration != null ? Math.round(duration * 1000) : 0
      segments.push({
        start_ms: 0,
        end_ms: Math.max(durMs, 1000),
        speaker_label: 'unknown',
        text: String(data.text).trim(),
      })
    }

    await assignSpeakers(segments)
    const [ap, cp] = talkPct(segments)

    await idb.calls.update(callId, { durationSec: duration })
    const segRows: SegmentRecord[] = segments.map((s) => ({
      id: crypto.randomUUID(),
      callId,
      startMs: s.start_ms,
      endMs: s.end_ms,
      speakerLabel: s.speaker_label,
      text: s.text,
    }))
    await idb.segments.bulkAdd(segRows)

    await idb.calls.update(callId, { status: 'analyzing' })
    emit()

    const analysis = await runAnalysisLlm(segments, ap, cp)
    const aid = crypto.randomUUID()
    await idb.analyses.add({
      id: aid,
      callId,
      createdAt: Date.now(),
      overallSentiment: analysis.overallSentiment,
      overallScore010: analysis.overallScore010,
      summaryText: analysis.summaryText,
      agentTalkPct: analysis.agentTalkPct ?? ap,
      customerTalkPct: analysis.customerTalkPct ?? cp,
      dimensionScores: analysis.dimensionScores,
      questionnaireResults: analysis.questionnaireResults,
      keywords: analysis.keywords,
      actionItems: analysis.actionItems,
      observationsPos: analysis.observationsPos,
      observationsNeg: analysis.observationsNeg,
      evidence: analysis.evidence,
      rawLlmResponse: analysis.rawLlmResponse,
      modelName: chatModel,
    })

    await idb.calls.update(callId, {
      status: 'ready',
      durationSec: duration,
      latestOverallSentiment: analysis.overallSentiment,
      latestOverallScore: analysis.overallScore010,
      errorMessage: null,
    })
    emit()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await idb.calls.update(callId, {
      status: 'failed',
      errorMessage: msg.slice(0, 2000),
    })
    emit()
  }
}
