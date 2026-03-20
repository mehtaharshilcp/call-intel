import Dexie, { type EntityTable } from 'dexie'

export interface CallRecord {
  id: string
  originalFilename: string
  status: string
  durationSec: number | null
  errorMessage: string | null
  createdAt: number
  audioBlob: Blob
  latestOverallSentiment?: string | null
  latestOverallScore?: number | null
}

export interface SegmentRecord {
  id: string
  callId: string
  startMs: number
  endMs: number
  speakerLabel: string
  text: string
}

export interface AnalysisRecord {
  id: string
  callId: string
  createdAt: number
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
  rawLlmResponse: string | null
  modelName: string
}

export class CallIntelDB extends Dexie {
  calls!: EntityTable<CallRecord, 'id'>
  segments!: EntityTable<SegmentRecord, 'id'>
  analyses!: EntityTable<AnalysisRecord, 'id'>

  constructor() {
    super('callintel')
    this.version(1).stores({
      calls: 'id, status, createdAt',
      segments: 'id, callId, startMs',
      analyses: 'id, callId, createdAt',
    })
  }
}

export const idb = new CallIntelDB()
