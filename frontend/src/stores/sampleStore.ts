import { create } from 'zustand'
import type { PaperSample, PaperSampleInput } from '../types/paper-sample'
import { db, plain } from '../utils/db'
import { nextTraceCode } from '../utils/traceCode'

interface SampleStore {
  paperSamples: PaperSample[]
  isLoading: boolean
  loaded: boolean
  error: string | null
  loadSamples: () => Promise<void>
  addSample: (input: PaperSampleInput) => Promise<PaperSample | null>
}

export const useSampleStore = create<SampleStore>((set, get) => ({
  paperSamples: [],
  isLoading: false,
  loaded: false,
  error: null,
  loadSamples: async () => {
    if (get().loaded) return
    set({ isLoading: true, error: null })
    try {
      const paperSamples = await db.paperSamples.orderBy('sampleNo').toArray()
      set({ paperSamples, isLoading: false, loaded: true })
    } catch {
      set({ isLoading: false, error: '样本档案读取失败，请检查浏览器存储权限' })
    }
  },
  addSample: async (input) => {
    set({ error: null })
    try {
      const [runs, moulds, samples] = await Promise.all([db.sheetRuns.toArray(), db.moulds.toArray(), db.paperSamples.toArray()])
      const traceCode = nextTraceCode(samples, runs, moulds, input.runId)
      if (!traceCode) throw new Error('run or mould missing')
      const payload = plain({ ...input, traceCode })
      const id = Number(await db.paperSamples.add(payload))
      const created: PaperSample = { ...payload, id, schemaRev: 3 }
      set((state) => ({ paperSamples: [created, ...state.paperSamples] }))
      return created
    } catch {
      set({ error: '样本登记失败，请检查样本编号是否重复或工序是否关联' })
      return null
    }
  },
}))
