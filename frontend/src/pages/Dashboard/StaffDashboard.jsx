import { useCallback, useEffect, useMemo, useState } from 'react'
import apiClient from '../../app/apiClient.js'
import PatientDetailsCard from '../../components/Cards/PatientDetailsCard.jsx'
import InsuranceDetailsCard from '../../components/Cards/InsuranceDetailsCard.jsx'
import RecordEditForm from '../Records/RecordEditForm.jsx'

export default function StaffDashboard() {
  const [query, setQuery] = useState('')
  const [list, setList] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [patient, setPatient] = useState(null)
  const [auditEntries, setAuditEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [corrections, setCorrections] = useState([])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    try {
      const { data } = await apiClient.get('/patients', { params: { q: query }, skipErrorToast: true })
      setList(Array.isArray(data) ? data : [])
    } finally {
      setLoadingList(false)
    }
  }, [query])

  useEffect(() => {
    loadList()
  }, [loadList])

  const selectPatient = async (p) => {
    setPatient(null)
    setAuditEntries([])
    setLoading(true)
    try {
      const [{ data: full }, { data: audit }, { data: corr }] = await Promise.all([
        apiClient.get(`/patients/${p._id}`),
        apiClient.get(`/patients/${p._id}/audit`, { skipErrorToast: true }).catch(() => ({ data: [] })),
        apiClient.get(`/patients/${p._id}/corrections`, { skipErrorToast: true }).catch(() => ({ data: [] }))
      ])
      setPatient(full)
      setAuditEntries(audit)
      setCorrections(corr)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdated = useCallback((next) => setPatient(next), [])

  const handleCorrectionAction = async (id, action) => {
    const path = action === 'approve' ? `/corrections/${id}/approve` : `/corrections/${id}/reject`
    await apiClient.post(path)
    if (patient?._id) {
      const { data } = await apiClient.get(`/patients/${patient._id}/corrections`, { skipErrorToast: true })
      setCorrections(data)
      const { data: full } = await apiClient.get(`/patients/${patient._id}`)
      setPatient(full)
    }
  }

  return (
    <main style={layout}>
      <div style={grid}>
        <aside style={sidebar}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input style={input} placeholder="Search patients" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button style={button} onClick={loadList} disabled={loadingList}>Search</button>
          </div>
          <ul style={listStyle}>
            {list.map((p) => (
              <li key={p._id} style={listItem} onClick={() => selectPatient(p)}>
                <div style={{ fontWeight: 600 }}>{p.demographics?.firstName} {p.demographics?.lastName}</div>
                <div style={{ color: '#64748b' }}>{p.demographics?.email}</div>
              </li>
            ))}
          </ul>
        </aside>
        <section style={content}>
          <div style={cards}>
            <PatientDetailsCard patient={patient} editable={false} />
            <InsuranceDetailsCard insurance={patient?.insurance} />
          </div>
          <div style={panel}>
            <h3 style={{ marginTop: 0 }}>Update demographics & insurance</h3>
            <RecordEditForm patient={patient} loading={loading} onUpdated={handleUpdated} />
          </div>
          <div style={panelRow}>
            <div style={panel}>
              <h3 style={{ marginTop: 0 }}>Correction requests</h3>
              {corrections.length ? (
                <ul style={corrList}>
                  {corrections.map((c) => (
                    <li key={c._id} style={corrItem}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.status}</div>
                        <pre style={pre}>{JSON.stringify(c.fields, null, 2)}</pre>
                      </div>
                      {c.status === 'OPEN' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button style={approve} onClick={() => handleCorrectionAction(c._id, 'approve')}>Approve</button>
                          <button style={reject} onClick={() => handleCorrectionAction(c._id, 'reject')}>Reject</button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: '#64748b' }}>No open correction requests.</p>
              )}
            </div>
            <div style={panel}><h3 style={{ marginTop: 0 }}>Change log</h3><p style={{ color: '#64748b' }}>Recent updates and corrections</p></div>
          </div>
        </section>
      </div>
    </main>
  )
}

const layout = { padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }
const grid = { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1rem' }
const sidebar = { background: '#fff', borderRadius: '1rem', padding: '1rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)', display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 'calc(100vh - 200px)', overflowY: 'auto' }
const content = { display: 'flex', flexDirection: 'column', gap: '1rem' }
const input = { flex: 1, border: '1px solid #cbd5f5', borderRadius: '0.65rem', padding: '0.5rem 0.75rem' }
const button = { border: 'none', borderRadius: '0.65rem', padding: '0.5rem 0.75rem', background: '#0ea5e9', color: '#fff' }
const listStyle = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }
const listItem = { border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.6rem', cursor: 'pointer' }
const cards = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }
const panel = { background: '#fff', borderRadius: '1rem', padding: '1rem', boxShadow: '0 20px 40px rgba(15,23,42,0.08)' }
const panelRow = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }
const corrList = { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }
const corrItem = { border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }
const approve = { border: 'none', borderRadius: '0.75rem', padding: '0.45rem 0.9rem', background: '#22c55e', color: '#fff', cursor: 'pointer' }
const reject = { ...approve, background: '#ef4444' }
const pre = { margin: 0, fontSize: '0.85rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '0.5rem' }

