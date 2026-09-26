import { create } from 'zustand'
import type { PaperSample, PaperSampleInput } from '../types/paper-sample'
import { db, plain } from '../utils/db'
import { buildTracePrefix, buildTraceCode } from '../utils/trace'

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
      const created = await db.transaction('rw', db.sheetRuns, db.moulds, db.paperSamples, async () => {
        const run = await db.sheetRuns.get(input.runId)
        const mould = run ? await db.moulds.get(run.mouldId) : undefined
        if (!run || !mould) throw new Error('样本对应的工序或纸帘不存在，无法生成追溯码')

        // 同一天同一张帘的样本流水接着排
        const prefix = buildTracePrefix(run.runDate, mould.mouldNo)
        const sameDayMouldSamples = await db.paperSamples.where('traceCode').startsWith(prefix).toArray()
        const traceCode = buildTraceCode(run.runDate, mould.mouldNo, sameDayMouldSamples.length + 1)

        const payload = plain({ ...input, traceCode })
        const id = Number(await db.paperSamples.add(payload))
        return { ...payload, id, schemaRev: 3 } satisfies PaperSample
      })
      set((state) => ({ paperSamples: [created, ...state.paperSamples] }))
      return created
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : ''
      set({ error: reason || '样本登记失败，请检查样本编号或追溯码是否重复' })
      return null
    }
  },
}))
