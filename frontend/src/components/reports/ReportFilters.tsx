import { useEffect, useMemo } from 'react'

type Option = { value: string; label: string }

export type ReportType = 'DAILY_VISITS' | 'APPT_LOAD' | 'PEAK_HOURS' | 'PAYMENT_SUMMARY'

export interface FiltersState {
  type: ReportType
  range: { from: string; to: string }
  departmentId?: string
  branchId?: string
  doctorId?: string
  paymentMethod?: 'CARD' | 'CASH' | 'GOVERNMENT'
}

export default function ReportFilters({
  value,
  onChange,
  options
}: {
  value: FiltersState
  onChange: (v: FiltersState) => void
  options: { departments: string[]; branches: string[]; doctors: { id: string; name: string }[] }
}) {
  const typeOptions: Option[] = useMemo(
    () => [
      { value: 'DAILY_VISITS', label: 'Daily Patient Visits' },
      { value: 'APPT_LOAD', label: 'Appointment Load' },
      { value: 'PEAK_HOURS', label: 'Peak Hours' },
      { value: 'PAYMENT_SUMMARY', label: 'Payment Summaries' }
    ],
    []
  )

  useEffect(() => {
    // ensure range exists
    if (!value.range?.from || !value.range?.to) return
  }, [value])

  const set = (patch: Partial<FiltersState>) => onChange({ ...value, ...patch })

  return (
    <section style={wrap}>
      <div style={row}>
        <div style={field}> 
          <label style={label}>Report Type</label>
          <select value={value.type} onChange={(e) => set({ type: e.target.value as ReportType })} style={input}>
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={field}>
          <label style={label}>From</label>
          <input type="date" value={value.range.from} onChange={(e) => set({ range: { ...value.range, from: e.target.value } })} style={input} />
        </div>
        <div style={field}>
          <label style={label}>To</label>
          <input type="date" value={value.range.to} onChange={(e) => set({ range: { ...value.range, to: e.target.value } })} style={input} />
        </div>
      </div>

      <div style={row}>
        <div style={field}>
          <label style={label}>Department</label>
          <select value={value.departmentId || ''} onChange={(e) => set({ departmentId: e.target.value || undefined })} style={input}>
            <option value="">All Departments</option>
            {options.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div style={field}>
          <label style={label}>Hospital Branch</label>
          <select value={value.branchId || ''} onChange={(e) => set({ branchId: e.target.value || undefined })} style={input}>
            <option value="">All Branches</option>
            {options.branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div style={field}>
          <label style={label}>Doctor</label>
          <select value={value.doctorId || ''} onChange={(e) => set({ doctorId: e.target.value || undefined })} style={input}>
            <option value="">All Doctors</option>
            {options.doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}

const wrap: React.CSSProperties = {
  background: '#fff',
  borderRadius: '0.75rem',
  padding: '1rem',
  boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
}

const row: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '1rem'
}

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem' }
const label: React.CSSProperties = { fontSize: 12, color: '#475569' }
const input: React.CSSProperties = { padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }

