import type { Mould } from '../types/mould'
import type { PaperSample } from '../types/paper-sample'
import type { SheetRun } from '../types/sheet-run'

/** 追溯码标识前缀 */
export const TRACE_PREFIX = 'TM'

/** 从“DL-01”这类帘号中取出数字部分（01）；取不到数字时回退为 00。 */
export function mouldNumberDigits(mouldNo: string): string {
  const matched = mouldNo.match(/(\d+)\s*$/)
  if (!matched) return '00'
  return matched[1].slice(-2).padStart(2, '0')
}

/** 追溯码前缀部分：TM + 抄纸日期 YYMMDD + 帘号两位数字，如 TM26070101。 */
export function buildTracePrefix(runDate: string, mouldNo: string): string {
  const compact = runDate.replace(/-/g, '')
  const yyMmDd = compact.slice(2, 8)
  return `${TRACE_PREFIX}${yyMmDd}${mouldNumberDigits(mouldNo)}`
}

/** 拼成完整追溯码：前缀 + 当天该帘的两位流水，如 TM2607010101。 */
export function buildTraceCode(runDate: string, mouldNo: string, sequence: number): string {
  return `${buildTracePrefix(runDate, mouldNo)}${String(sequence).padStart(2, '0')}`
}

interface TraceContext {
  runs: Pick<SheetRun, 'id' | 'mouldId' | 'runDate'>[]
  moulds: Pick<Mould, 'id' | 'mouldNo'>[]
}

/**
 * 按“同一天同一张帘”的样本排定两位流水：
 * 优先沿用样本原有追溯码中的流水，缺失或冲突时依次续排。
 */
export function assignTraceCodes(
  samples: Array<Omit<PaperSample, 'traceCode'> & { traceCode?: string }>,
  context: TraceContext,
): Array<Pick<PaperSample, 'id' | 'sampleNo' | 'traceCode'>> {
  const runById = new Map(context.runs.map((run) => [run.id, run]))
  const mouldById = new Map(context.moulds.map((mould) => [mould.id, mould]))

  type TraceInput = Omit<PaperSample, 'traceCode'> & { traceCode?: string }
  const groups = new Map<string, TraceInput[]>()
  const groupKeyOf = (sample: TraceInput): string | null => {
    const run = runById.get(sample.runId)
    if (!run) return null
    const mould = mouldById.get(run.mouldId)
    if (!mould) return null
    return buildTracePrefix(run.runDate, mould.mouldNo)
  }

  for (const sample of samples) {
    const key = groupKeyOf(sample)
    if (!key) continue
    const group = groups.get(key)
    if (group) group.push(sample)
    else groups.set(key, [sample])
  }

  const results: Array<Pick<PaperSample, 'id' | 'sampleNo' | 'traceCode'>> = []
  for (const [prefix, group] of groups) {
    const used = new Set<number>()
    const assignments = new Map<string, number>()

    // 先保留已有追溯码里合法的流水号
    for (const sample of group) {
      const key = sample.id !== undefined ? `id:${sample.id}` : `no:${sample.sampleNo}`
      const existingCode = sample.traceCode ?? ''
      if (existingCode.startsWith(prefix)) {
        const sequence = Number(existingCode.slice(prefix.length))
        if (Number.isInteger(sequence) && sequence >= 1 && sequence <= 99 && !used.has(sequence)) {
          used.add(sequence)
          assignments.set(key, sequence)
        }
      }
    }

    // 其余样本从 01 起续排
    let next = 1
    for (const sample of group) {
      const key = sample.id !== undefined ? `id:${sample.id}` : `no:${sample.sampleNo}`
      if (assignments.has(key)) continue
      while (used.has(next)) next += 1
      used.add(next)
      assignments.set(key, next)
    }

    for (const sample of group) {
      const key = sample.id !== undefined ? `id:${sample.id}` : `no:${sample.sampleNo}`
      results.push({ id: sample.id, sampleNo: sample.sampleNo, traceCode: `${prefix}${String(assignments.get(key)).padStart(2, '0')}` })
    }
  }
  return results
}

/** 追溯码格式校验：TM + 6 位日期 + 2 位帘号 + 2 位流水。 */
export function isTraceCodeFormat(value: string): boolean {
  return /^TM\d{10}$/.test(value.trim())
}
