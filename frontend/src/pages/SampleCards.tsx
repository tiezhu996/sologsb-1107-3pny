import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, Chip, Grid, Stack, TextField, Typography } from '@mui/material'
import { GrainStripePreview } from '../components/common/GrainStripePreview'
import { RulerInput } from '../components/common/RulerInput'
import { StatBadge } from '../components/common/StatBadge'
import { useUnitConvert } from '../hooks/useUnitConvert'
import { useMouldStore } from '../stores/mouldStore'
import { useRunStore } from '../stores/runStore'
import { useSampleStore } from '../stores/sampleStore'
import { EVENNESS_LEVELS, type EvennessLevel, type PaperSampleInput } from '../types/paper-sample'
import { isGapOutOfTolerance } from '../utils/stripe'
import { TRACE_CODE_PATTERN } from '../utils/traceCode'

const emptySampleForm: PaperSampleInput = {
  sampleNo: '',
  runId: 1,
  sizeMm: 210,
  stripeCount: 45,
  evenness: '均匀',
  archiveBin: '待归档-01',
}

function stripeTier(count: number): { label: string; color: 'success' | 'info' | 'warning' } {
  if (count >= 50) return { label: '密纹档', color: 'success' }
  if (count >= 40) return { label: '中密档', color: 'info' }
  return { label: '疏纹档', color: 'warning' }
}

export default function SampleCards() {
  const samples = useSampleStore((state) => state.paperSamples)
  const error = useSampleStore((state) => state.error)
  const loadSamples = useSampleStore((state) => state.loadSamples)
  const addSample = useSampleStore((state) => state.addSample)
  const runs = useRunStore((state) => state.sheetRuns)
  const runError = useRunStore((state) => state.error)
  const loadRuns = useRunStore((state) => state.loadRuns)
  const moulds = useMouldStore((state) => state.moulds)
  const mouldError = useMouldStore((state) => state.error)
  const loadMoulds = useMouldStore((state) => state.loadMoulds)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PaperSampleInput>(emptySampleForm)
  const [evennessFilter, setEvennessFilter] = useState<EvennessLevel | '全部'>('全部')
  const [stripeFloor, setStripeFloor] = useState(0)
  const [traceQuery, setTraceQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { mmToCm, formatGrammage } = useUnitConvert()

  useEffect(() => {
    void loadSamples()
    void loadRuns()
    void loadMoulds()
  }, [loadMoulds, loadRuns, loadSamples])

  const runById = useMemo(() => new Map(runs.map((run) => [run.id, run])), [runs])
  const mouldById = useMemo(() => new Map(moulds.map((mould) => [mould.id, mould])), [moulds])
  const filteredSamples = useMemo(
    () => samples.filter((sample) => (evennessFilter === '全部' || sample.evenness === evennessFilter) && sample.stripeCount >= stripeFloor),
    [evennessFilter, samples, stripeFloor],
  )
  const normalizedTrace = traceQuery.trim().toUpperCase()
  const traceComplete = TRACE_CODE_PATTERN.test(normalizedTrace)
  const traceHit = useMemo(
    () => (traceComplete ? samples.find((sample) => sample.traceCode.toUpperCase() === normalizedTrace) : undefined),
    [normalizedTrace, samples, traceComplete],
  )
  const traceMiss = traceComplete && !traceHit
  const visibleSamples = traceComplete ? (traceHit ? [traceHit] : []) : filteredSamples
  const denseCount = samples.filter((sample) => sample.stripeCount >= 50).length
  const recheckCount = samples.filter((sample) => sample.evenness !== '均匀').length

  const updateForm = <K extends keyof PaperSampleInput,>(key: K, value: PaperSampleInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!form.sampleNo.trim() || !form.archiveBin.trim() || form.sizeMm <= 0 || form.stripeCount <= 0) return
    setSubmitting(true)
    const created = await addSample({ ...form, sampleNo: form.sampleNo.trim(), archiveBin: form.archiveBin.trim() })
    setSubmitting(false)
    if (created) {
      setForm(emptySampleForm)
      setShowForm(false)
    }
  }

  const errorMessage = error ?? runError ?? mouldError

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: { xs: 'flex-start', md: 'center' }, flexDirection: { xs: 'column', md: 'row' } }}>
        <Box>
          <Typography component="h1" variant="h3" color="#344a34">成纸样本与透光检验卡</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>按匀度与帘纹条数分档，复核样本对应的抄纸工序和归档位置。</Typography>
        </Box>
        <Button variant="contained" size="large" onClick={() => setShowForm((current) => !current)} data-testid="new-sample">
          {showForm ? '收起登记' : '新建样本'}
        </Button>
      </Box>

      {errorMessage && <Alert severity="warning">{errorMessage}</Alert>}

      {showForm && (
        <Card data-testid="form-sample" sx={{ borderColor: '#9eb096' }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" sx={{ mb: 2 }}>登记成纸样本</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}><TextField fullWidth label="样本编号" value={form.sampleNo} onChange={(event) => updateForm('sampleNo', event.target.value)} inputProps={{ 'data-testid': 'field-sampleNo' }} /></Grid>
              <Grid item xs={12} md={4}>
                <TextField select fullWidth label="对应工序" value={form.runId} onChange={(event) => updateForm('runId', Number(event.target.value))} SelectProps={{ native: true, inputProps: { 'data-testid': 'field-runId' } }}>
                  {!runs.some((run) => run.id === form.runId) && <option value={form.runId}>工序数据载入中</option>}
                  {runs.map((run) => <option key={run.id} value={run.id}>{run.runNo} · {run.runDate}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={6} md={2}><TextField fullWidth type="number" label="样本尺寸" value={form.sizeMm} onChange={(event) => updateForm('sizeMm', Number(event.target.value))} inputProps={{ min: 20, max: 1000, step: 1, 'data-testid': 'field-sizeMm' }} InputProps={{ endAdornment: 'mm' }} /></Grid>
              <Grid item xs={6} md={3}><TextField fullWidth type="number" label="帘纹条数" value={form.stripeCount} onChange={(event) => updateForm('stripeCount', Number(event.target.value))} inputProps={{ min: 1, max: 300, step: 1, 'data-testid': 'field-stripeCount' }} /></Grid>
              <Grid item xs={6} md={3}>
                <TextField select fullWidth label="匀度" value={form.evenness} onChange={(event) => updateForm('evenness', event.target.value as EvennessLevel)} SelectProps={{ native: true, inputProps: { 'data-testid': 'field-evenness' } }}>
                  {EVENNESS_LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
                </TextField>
              </Grid>
              <Grid item xs={12} md={5}><TextField fullWidth label="存档位" value={form.archiveBin} onChange={(event) => updateForm('archiveBin', event.target.value)} inputProps={{ 'data-testid': 'field-archiveBin' }} /></Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              保存时按“TM + 抄纸日期 + 帘号数字 + 两位流水”自动生成追溯码，无需手填。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 }}>
              <Button onClick={() => setShowForm(false)}>取消</Button>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting} data-testid="submit-sample">保存样本</Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <StatBadge label="样本总数" value={samples.length} detail="档案柜入库数量" />
        <StatBadge label="密纹样本" value={denseCount} detail="帘纹条数不少于 50" tone="bamboo" />
        <StatBadge label="待复检" value={recheckCount} detail="匀度非“均匀”" tone={recheckCount ? 'warning' : 'neutral'} />
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                label="追溯码定位"
                placeholder="如 TM2607010101"
                value={traceQuery}
                onChange={(event) => setTraceQuery(event.target.value)}
                error={traceMiss}
                helperText={traceMiss ? '档案里没有这张样本' : '输入完整追溯码（TM+日期+帘号+流水）定位卡片'}
                inputProps={{ 'data-testid': 'field-traceCode' }}
              />
            </Grid>
            <Grid item xs={12} sm={5} md={2}>
              <TextField select fullWidth size="small" label="匀度筛选" value={evennessFilter} onChange={(event) => setEvennessFilter(event.target.value as EvennessLevel | '全部')} SelectProps={{ native: true }}>
                <option value="全部">全部匀度</option>
                {EVENNESS_LEVELS.map((option) => <option key={option} value={option}>{option}</option>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={7} md={3}>
              <RulerInput label="最低帘纹条数" value={stripeFloor} onChange={setStripeFloor} unit="条" min={0} max={300} step={1} compact />
            </Grid>
            <Grid item xs={6} md={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Typography variant="body2" color="text.secondary">当前记录</Typography><Typography variant="h5" data-testid="count-sample">{visibleSamples.length}</Typography></Box>
            </Grid>
            <Grid item xs={6} md={2}><Button fullWidth variant="outlined" onClick={() => { setEvennessFilter('全部'); setStripeFloor(0); setTraceQuery('') }}>重置分档</Button></Grid>
          </Grid>
        </CardContent>
      </Card>

      {traceMiss && <Alert severity="warning" data-testid="trace-miss">档案里没有这张样本：{normalizedTrace}</Alert>}
      {traceComplete && traceHit && <Alert severity="success" data-testid="trace-hit">已定位追溯码 {traceHit.traceCode} 对应的样本卡片</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {visibleSamples.map((sample) => {
          const run = runById.get(sample.runId)
          const mould = run ? mouldById.get(run.mouldId) : undefined
          const tier = stripeTier(sample.stripeCount)
          const gap = run?.measuredGap ?? mould?.stripeGap ?? 1
          return (
            <Card key={sample.id ?? sample.sampleNo} data-testid="row-sample" sx={{ bgcolor: sample.evenness === '均匀' ? '#fffdf7' : '#fff9e8' }}>
              <CardContent sx={{ p: 2.25 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, alignItems: 'flex-start', mb: 1.5 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{sample.sampleNo}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>工序 {run?.runNo ?? '待关联'} · {run?.runDate ?? '日期待补'}</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f6b4a', letterSpacing: '.04em' }} data-testid="trace-code">追溯码 {sample.traceCode}</Typography>
                  </Box>
                  <Chip size="small" color={tier.color} label={tier.label} />
                </Box>
                <GrainStripePreview
                  gap={gap}
                  wireDiameter={mould?.wireDiameter ?? 0.25}
                  density={mould?.meshDensity}
                  stripeCount={sample.stripeCount}
                  direction={run?.stripeDirection === '横帘纹' ? 'horizontal' : 'vertical'}
                />
                <Grid container spacing={1} sx={{ mt: 1 }}>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">帘纹条数</Typography><Typography sx={{ fontWeight: 700 }}>{sample.stripeCount} 条</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">匀度</Typography><Typography sx={{ fontWeight: 700, color: sample.evenness === '均匀' ? 'success.dark' : 'warning.dark' }}>{sample.evenness}</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">样本尺寸</Typography><Typography>{sample.sizeMm} mm · {mmToCm(sample.sizeMm)} cm</Typography></Grid>
                  <Grid item xs={6}><Typography variant="caption" color="text.secondary">纸页克重</Typography><Typography>{run ? formatGrammage(run.grammage) : '待补'}</Typography></Grid>
                </Grid>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center', mt: 1.5 }}>
                  <Chip size="small" variant="outlined" label={`存档 ${sample.archiveBin}`} />
                  {run && isGapOutOfTolerance(run.deviation) && <Chip size="small" color="warning" label={`偏差 ${run.deviation > 0 ? '+' : ''}${run.deviation.toFixed(2)} mm`} />}
                </Box>
              </CardContent>
            </Card>
          )
        })}
        {visibleSamples.length === 0 && (
          <Card sx={{ gridColumn: '1 / -1' }}><CardContent sx={{ textAlign: 'center', py: 7 }}><Typography color="text.secondary">{traceMiss ? `档案里没有这张样本：${normalizedTrace}` : '没有符合当前匀度与帘纹条数分档的样本'}</Typography></CardContent></Card>
        )}
      </Box>
    </Stack>
  )
}
