import type { Mould } from '../types/mould'
import type { PaperSample } from '../types/paper-sample'
import type { SheetRun } from '../types/sheet-run'

export const TRACE_CODE_PREFIX = 'TM'
export const TRACE_CODE_PATTERN = /^TM\d{10}$/i

type TraceRunRef = Pick<SheetRun, 'id' | 'mouldId' | 'runDate'>
type TraceMouldRef = Pick<Mould, 'id' | 'mouldNo'>
type TraceSampleRef = Pick<PaperSample, 'id' | 'runId'>

export function buildTraceCode(runDate: string, mouldNo: string, serial: number): string {
  const datePart = runDate.replace(/-/g, '').slice(2)
  const mouldPart = mouldNo.replace(/\D/g, '')
  return `${TRACE_CODE_PREFIX}${datePart}${mouldPart}${String(serial).padStart(2, '0')}`
}

function traceGroupKey(run: TraceRunRef): string {
  return `${run.runDate}|${run.mouldId}`
}

export function assignTraceCodes(samples: TraceSampleRef[], runs: TraceRunRef[], moulds: TraceMouldRef[]): Map<number, string> {
  const runById = new Map(runs.map((run) => [run.id, run]))
  const mouldById = new Map(moulds.map((mould) => [mould.id, mould]))
  const counters = new Map<string, number>()
  const codes = new Map<number, string>()
  const ordered = [...samples].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
  for (const sample of ordered) {
    if (sample.id === undefined) continue
    const run = runById.get(sample.runId)
    const mould = run ? mouldById.get(run.mouldId) : undefined
    if (!run || !mould) continue
    const key = traceGroupKey(run)
    const serial = (counters.get(key) ?? 0) + 1
    counters.set(key, serial)
    codes.set(sample.id, buildTraceCode(run.runDate, mould.mouldNo, serial))
  }
  return codes
}

export function nextTraceCode(samples: TraceSampleRef[], runs: TraceRunRef[], moulds: TraceMouldRef[], runId: number): string | null {
  const run = runs.find((item) => item.id === runId)
  const mould = run ? moulds.find((item) => item.id === run.mouldId) : undefined
  if (!run || !mould) return null
  const runById = new Map(runs.map((item) => [item.id, item]))
  const count = samples.filter((sample) => {
    const sampleRun = runById.get(sample.runId)
    return sampleRun !== undefined && traceGroupKey(sampleRun) === traceGroupKey(run)
  }).length
  return buildTraceCode(run.runDate, mould.mouldNo, count + 1)
}
