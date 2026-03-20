export type CallStatus =
  | 'uploaded'
  | 'transcribing'
  | 'analyzing'
  | 'ready'
  | 'failed'

export type OverallSentiment = 'positive' | 'neutral' | 'negative'

export type SpeakerLabel = 'agent' | 'customer' | 'unknown'

export interface TranscriptSegment {
  id: string
  start_ms: number
  end_ms: number
  speaker_label: SpeakerLabel
  text: string
}

export interface CallAnalysis {
  id: string
  overall_sentiment: OverallSentiment
  overall_score_0_10: number
  summary_text: string
  agent_talk_pct: number | null
  customer_talk_pct: number | null
  dimension_scores: Record<string, number>
  questionnaire_results: Record<string, boolean>
  keywords: string[]
  action_items: string[]
  observations_pos: string[]
  observations_neg: string[]
  evidence: Record<string, string> | null
  model_name: string
  created_at: string
}

export interface CallSummary {
  id: string
  original_filename: string
  status: CallStatus
  duration_sec: number | null
  created_at: string
  overall_sentiment: OverallSentiment | null
  overall_score_0_10: number | null
}

export interface CallDetail extends CallSummary {
  error_message: string | null
  segments: TranscriptSegment[]
  latest_analysis: CallAnalysis | null
}

export interface DashboardSummary {
  total_calls: number
  sentiment_positive: number
  sentiment_neutral: number
  sentiment_negative: number
  average_score: number | null
  average_duration_sec: number | null
  top_keywords: [string, number][]
  total_action_items: number
}

export interface QuestionnaireTopic {
  id: string
  label: string
}
