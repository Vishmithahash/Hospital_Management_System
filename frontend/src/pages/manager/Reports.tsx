import { useEffect, useRef, useState } from 'react'
import ReportFilters, { type FiltersState } from '../../components/reports/ReportFilters'
import ReportMeta from '../../components/reports/ReportMeta'
import ReportChart from '../../components/reports/ReportChart'
import ReportTable from '../../components/reports/ReportTable'
import { defaultRange, exportReport, generateReport, getOptions } from '../../lib/reportApi'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import { toastError, toastWarning, toastInfo } from '../../app/toastHelpers.js'

export default function ManagerReports() {
  const [filters, setFilters] = useState<FiltersState>({ type: 'APPT_LOAD', range: defaultRange(7) })
  const [options, setOptions] = useState({ departments: [], branches: [], doctors: [] } as any)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const lastParams = useRef<string>('')
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    getOptions().then(setOptions).catch(() => setOptions({ departments: [], branches: [], doctors: [] }))
    const raw = localStorage.getItem('mgr-report-filters')
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        const normalized = normalizeState({ ...parsed })
        setFilters((f) => ({ ...f, ...normalized }))
      } catch {}
    }
  }, [])

  const onFiltersChange = (v: FiltersState) => {
    const normalized = normalizeState(v)
    setFilters(normalized)
    localStorage.setItem('mgr-report-filters', JSON.stringify(normalized))
  }

  const todayStr = () => new Date().toISOString().slice(0, 10)
  const normalizeRange = (range: { from: string; to: string }) => {
    const today = todayStr()
    let from = range.from
    let to = range.to
    if (to > today) to = today
    if (from > to) from = to
    return { from, to }
  }

  const normalizeState = (state: FiltersState): FiltersState => {
    const range = normalizeRange(state.range)
    return { ...state, range }
  }

  const buildFilterPayload = (state: FiltersState) => {
    const next: Record<string, string> = {}
    if (state.departmentId) next.departmentId = state.departmentId
    if (state.branchId) next.branchId = state.branchId
    if (state.doctorId) next.doctorId = state.doctorId
    if (state.paymentMethod) next.paymentMethod = state.paymentMethod
    return next
  }

  const doGenerate = async (regenerate = false) => {
    setLoading(true)
    try {
      const clean = normalizeState(filters)
      if (clean.range.to !== filters.range.to || clean.range.from !== filters.range.from) {
        toastWarning('Adjusted date range to be valid. Please review and generate again if needed.')
      }
      const filterPayload = buildFilterPayload(clean)
      const payload: any = { type: clean.type, range: clean.range }
      if (Object.keys(filterPayload).length) payload.filters = filterPayload
      if (regenerate) payload.regenerate = true
      const res = await generateReport(payload)
      setResult(res)
      lastParams.current = JSON.stringify(payload)
    } catch (error: any) {
      setResult(null)
      const status = error?.response?.status
      const code = error?.response?.data?.code
      const message = error?.response?.data?.message || 'Unable to generate report'

      if (status === 400) {
        if (code === 'INVALID_DOCTOR_ID') {
          toastWarning('The selected doctor is no longer available. Filter cleared.')
          onFiltersChange({ ...filters, doctorId: undefined })
        } else if (code === 'INVALID_DEPARTMENT_ID') {
          toastWarning('That department no longer exists in appointment records. Filter cleared.')
          onFiltersChange({ ...filters, departmentId: undefined })
        } else if (code === 'INVALID_BRANCH_ID') {
          toastWarning(message)
        } else if (code === 'A1_INVALID_PARAMS') {
          // Likely invalid range: future or from>to
          const fixed = normalizeState(filters)
          if (fixed.range.to !== filters.range.to || fixed.range.from !== filters.range.from) {
            onFiltersChange(fixed)
            toastWarning('Your date range was invalid (future or from>to). We corrected it. Generate again.')
          } else {
            toastWarning(message)
          }
        } else {
          toastWarning(message)
        }
      } else {
        toastError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const captureChartImage = async () => {
    const container = chartRef.current
    if (!container) return null
    const svg = container.querySelector('svg') as SVGSVGElement | null
    if (!svg) return null

    const cloned = svg.cloneNode(true) as SVGSVGElement
    if (!cloned.getAttribute('xmlns')) cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    const rect = container.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || svg.viewBox?.baseVal?.width || 640))
    const height = Math.max(1, Math.round(rect.height || svg.viewBox?.baseVal?.height || 360))

    const serializer = new XMLSerializer()
    const svgString = serializer.serializeToString(cloned)
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    return await new Promise<string | null>((resolve) => {
      const img = new Image()
      const cleanup = () => URL.revokeObjectURL(url)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const dpr = window.devicePixelRatio || 1
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          cleanup()
          resolve(null)
          return
        }
        ctx.scale(dpr, dpr)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/png')
        cleanup()
        resolve(dataUrl)
      }
      img.onerror = () => {
        cleanup()
        resolve(null)
      }
      img.src = url
    })
  }

  const onGenerateClick = () => {
    const params = JSON.stringify({
      type: filters.type,
      range: filters.range,
      departmentId: filters.departmentId,
      branchId: filters.branchId,
      doctorId: filters.doctorId,
      paymentMethod: filters.paymentMethod
    })
    if (result && params !== lastParams.current) setConfirmOpen(true)
    else doGenerate(false)
  }

  const onExport = async (format: 'pdf' | 'xlsx') => {
    try {
      const filterPayload = buildFilterPayload(filters)
      const payload: any = { type: filters.type, range: filters.range, format }
      if (Object.keys(filterPayload).length) payload.filters = filterPayload
      if (format === 'pdf' && result?.chart) {
        const chartImage = await captureChartImage()
        if (chartImage) payload.chartImage = chartImage
      }

      const { blob, headers } = await exportReport(payload)
      const filename = /filename="?([^";]+)"?/i.exec(headers['content-disposition'] || '')?.[1] || `report.${format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toastInfo(format === 'pdf' ? 'PDF exported successfully.' : 'Excel exported successfully.')
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Failed to export the report'
      toastError(message)
    }
  }

  return (
    <main style={layout}>
      <header>
        <h2 style={{ margin: 0 }}>Generate Reports</h2>
        <p style={{ margin: '4px 0 0', color: '#64748b' }}>Select a report type and set your parameters to generate a report.</p>
      </header>
      <ReportFilters value={filters} onChange={onFiltersChange} options={options} />

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onGenerateClick} style={primary}>Generate Report</button>
        <button onClick={() => onExport('pdf')} style={ghost}>Export as PDF</button>
        <button onClick={() => onExport('xlsx')} style={ghost}>Export as Excel</button>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <ReportMeta meta={result?.meta} />
          <ReportChart chart={result?.chart} containerRef={chartRef} />
        <ReportTable table={result?.table} loading={loading} />
        {result?.meta?.noData ? (
          <div style={callout}>No data for selected filters. Try a wider date range or different filters.</div>
        ) : null}
      </section>

      {confirmOpen ? (
        <ConfirmDialog
          open={confirmOpen}
          title="Regenerate & discard previous?"
          message="You have a generated report. Generating again will discard the previous result."
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false)
            doGenerate(true)
          }}
        />
      ) : null}
    </main>
  )
}

const layout: React.CSSProperties = { padding: '2rem', display: 'flex', flexDirection: 'column', gap: 12 }
const primary: React.CSSProperties = { background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer' }
const ghost: React.CSSProperties = { background: '#e2e8f0', color: '#0f172a', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer' }
const callout: React.CSSProperties = { background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', padding: '10px 12px', borderRadius: 8 }

