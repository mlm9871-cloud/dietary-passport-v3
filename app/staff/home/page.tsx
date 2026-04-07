'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

type Org = { id: string; name: string }
type DiningHall = { id: string; name: string }
type Station = { id: string; name: string }

type StaffSession = {
  organizationId: string
  organizationName: string
  diningHallId: string
  diningHallName: string
  stationId: string | null
  stationName: string
  startedAt: string
}

type RecentRequest = {
  requestId: string
  studentName: string
  diningHall: string
  station: string
  status: string
  scannedAt: string
}

export default function StaffHomePage() {
  const router = useRouter()

  // Dropdown data
  const [orgs, setOrgs] = useState<Org[]>([])
  const [diningHalls, setDiningHalls] = useState<DiningHall[]>([])
  const [stations, setStations] = useState<Station[]>([])

  // Selected ids
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedDiningHallId, setSelectedDiningHallId] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)

  // Names for display
  const [selectedOrgName, setSelectedOrgName] = useState<string>('')
  const [selectedDiningHallName, setSelectedDiningHallName] = useState<string>('')
  const [selectedStationName, setSelectedStationName] = useState<string>('')

  // Error flags for fetches
  const [orgsError, setOrgsError] = useState(false)
  const [diningError, setDiningError] = useState(false)
  const [stationsError, setStationsError] = useState(false)

  // Session state
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null)

  // Recent requests
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([])

  // Modal
  const [showEndModal, setShowEndModal] = useState(false)

  // SSR guard: load everything on mount
  useEffect(() => {
    // load orgs
    ;(async () => {
      try {
        const { data, error } = await supabase.from('organizations').select('id,name').order('name', { ascending: true })
        if (error) {
          console.error('Error fetching organizations:', error)
          setOrgsError(true)
        } else if (data) {
          setOrgs(data as Org[])
        }
      } catch (err) {
        console.error('Unexpected error fetching organizations:', err)
        setOrgsError(true)
      }
    })()

    // load staffSession from localStorage
    try {
      const raw = localStorage.getItem('staffSession')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.diningHallId && parsed.organizationId && parsed.startedAt) {
          setStaffSession(parsed)
        }
      }
    } catch (err) {
      // ignore parse errors
    }

    // load recentRequests
    try {
      const rr = JSON.parse(localStorage.getItem('recentRequests') || '[]') as RecentRequest[]
      setRecentRequests(rr.slice(0, 5))
    } catch (err) {
      setRecentRequests([])
    }
  }, [])

  // Fetch dining halls when org changes
  useEffect(() => {
    setDiningHalls([])
    setSelectedDiningHallId(null)
    setSelectedDiningHallName('')
    if (!selectedOrgId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('dining_halls')
          .select('id,name')
          .eq('organization_id', selectedOrgId)
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (error) {
          console.error('Error fetching dining halls:', error)
          setDiningError(true)
        } else if (data) {
          setDiningHalls(data as DiningHall[])
        }
      } catch (err) {
        console.error('Unexpected error fetching dining halls:', err)
        setDiningError(true)
      }
    })()
  }, [selectedOrgId])

  // Fetch stations when dining hall changes
  useEffect(() => {
    setStations([])
    setSelectedStationId(null)
    setSelectedStationName('')
    if (!selectedDiningHallId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('stations')
          .select('id,name')
          .eq('dining_hall_id', selectedDiningHallId)
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (error) {
          console.error('Error fetching stations:', error)
          setStationsError(true)
        } else if (data) {
          setStations(data as Station[])
        }
      } catch (err) {
        console.error('Unexpected error fetching stations:', err)
        setStationsError(true)
      }
    })()
  }, [selectedDiningHallId])

  const canStart = selectedOrgId && selectedDiningHallId && selectedStationId !== null && selectedStationName !== ''

  function startSession() {
    if (!selectedOrgId || !selectedDiningHallId) return
    const stationIdToSave = selectedStationId === 'general' ? null : selectedStationId
    const stationNameToSave = selectedStationId === 'general' ? 'General / No specific station' : selectedStationName
    const sess: StaffSession = {
      organizationId: selectedOrgId,
      organizationName: selectedOrgName || '',
      diningHallId: selectedDiningHallId,
      diningHallName: selectedDiningHallName || '',
      stationId: stationIdToSave,
      stationName: stationNameToSave,
      startedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem('staffSession', JSON.stringify(sess))
    } catch (err) {
      console.error('Error writing staffSession to localStorage:', err)
    }
    setStaffSession(sess)
  }

  function endSessionConfirmed() {
    try {
      localStorage.removeItem('staffSession')
      localStorage.removeItem('recentRequests')
    } catch (err) {
      console.error('Error clearing session keys:', err)
    }
    setStaffSession(null)
    setRecentRequests([])
    setShowEndModal(false)
  }

  function timeAgo(iso: string) {
    try {
      const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
      if (diff < 1) return 'just now'
      if (diff === 1) return '1 min ago'
      return `${diff} min ago`
    } catch {
      return ''
    }
  }

  // Derived display for state 2
  const orgNameDisplay = staffSession?.organizationName ?? ''
  const diningNameDisplay = staffSession?.diningHallName ?? ''
  const stationNameDisplay = staffSession?.stationName ?? ''

  return (
    <div style={{ backgroundColor: '#F8FAFB', minHeight: '100vh' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh' }}>

        {/* Header */}
        {!staffSession ? (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, backgroundColor: '#1A7A5E', borderRadius: 6 }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Set up your session</div>
                <div style={{ fontSize: 14, color: '#6B7280' }}>Select your location before you begin.</div>
              </div>
            </div>

            {/* Organization select */}
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Your organization</label>
              <select value={selectedOrgId ?? ''} onChange={(e) => { const id = e.target.value; setSelectedOrgId(id || null); const o = orgs.find(x=>x.id===id); setSelectedOrgName(o?.name||'') }} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginTop: 8, fontSize: 15, backgroundColor: '#fff' }}>
                <option value="">Select organization</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              {orgsError && <div style={{ marginTop: 8, color: '#DC2626' }}>Could not load options. Please refresh.</div>}
            </div>

            {/* Dining hall select */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Dining hall</label>
              <select value={selectedDiningHallId ?? ''} onChange={(e) => { const id = e.target.value; setSelectedDiningHallId(id || null); const d = diningHalls.find(x=>x.id===id); setSelectedDiningHallName(d?.name||'') }} disabled={!selectedOrgId} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginTop: 8, fontSize: 15, backgroundColor: '#fff', opacity: selectedOrgId ? 1 : 0.6 }}>
                <option value="">Select dining hall</option>
                {diningHalls.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              {diningError && <div style={{ marginTop: 8, color: '#DC2626' }}>Could not load options. Please refresh.</div>}
            </div>

            {/* Station select */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Your station</label>
              <select value={selectedStationId ?? ''} onChange={(e) => { const v = e.target.value; setSelectedStationId(v || null); const s = stations.find(x=>x.id===v); setSelectedStationName(s?.name||(v==='general'?'General / No specific station':'')) }} disabled={!selectedDiningHallId} style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginTop: 8, fontSize: 15, backgroundColor: '#fff', opacity: selectedDiningHallId ? 1 : 0.6 }}>
                <option value="">Select station</option>
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
                <option value="general">General / No specific station</option>
              </select>
              {stationsError && <div style={{ marginTop: 8, color: '#DC2626' }}>Could not load options. Please refresh.</div>}
            </div>

            {/* CTA */}
            <div style={{ marginTop: 18 }}>
              <button onClick={startSession} disabled={!canStart} style={{ width: '100%', padding: 14, borderRadius: 12, backgroundColor: canStart ? '#1A7A5E' : '#D1D5DB', color: '#fff', border: 'none', fontSize: 15, fontWeight: 500, cursor: canStart ? 'pointer' : 'default' }}>Start session</button>
            </div>

          </div>
        ) : (
          // STATE 2: Active session
          <div>
            <div style={{ backgroundColor: '#1A7A5E', padding: '14px 16px', color: '#fff', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: '#D1FAE5' }}>{orgNameDisplay}</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{diningNameDisplay}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.95)' }}>{stationNameDisplay}</div>
              </div>
              <div>
                <button onClick={() => setShowEndModal(true)} style={{ background: 'transparent', border: 'none', color: '#fff', textDecoration: 'underline', fontSize: 12, cursor: 'pointer' }}>End session</button>
              </div>
            </div>

            <div style={{ padding: 16 }}>
              {/* Primary action card */}
              <div onClick={() => router.push('/staff/scan')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12, backgroundColor: '#1A7A5E', color: '#fff', cursor: 'pointer', marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', animation: 'passportPulse 2.5s ease-in-out infinite' }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {/* simple QR SVG icon */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="4" height="4" stroke="white" strokeWidth="1.5"/>
                    <rect x="9" y="3" width="4" height="4" stroke="white" strokeWidth="1.5"/>
                    <rect x="15" y="3" width="6" height="6" stroke="white" strokeWidth="1.5"/>
                    <rect x="3" y="9" width="4" height="4" stroke="white" strokeWidth="1.5"/>
                    <rect x="15" y="15" width="6" height="6" stroke="white" strokeWidth="1.5"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>Scan Passport</div>
                  <div style={{ fontSize: 13, color: '#D1FAE5', marginTop: 4 }}>Tap to scan a student QR code</div>
                </div>
                <div style={{ fontSize: 20 }}>›</div>
              </div>

              {/* Secondary card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#F8FAFB', border: '1px solid #E5E7EB', marginBottom: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 6h18" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M7 10h10" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M7 14h6" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#6B7280' }}>View Attached Orders</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Coming soon — online order integration</div>
                </div>
                <div style={{ backgroundColor: '#F3F4F6', borderRadius: 99, padding: '4px 8px', fontSize: 12, color: '#6B7280' }}>Coming Soon</div>
              </div>

              {/* Recent Requests */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>RECENT REQUESTS</div>
                {recentRequests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: '#9CA3AF' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>⏱️</div>
                    <div style={{ fontSize: 14, color: '#6B7280' }}>No requests yet this session</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>Scanned passports will appear here</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {recentRequests.slice(0,5).map((r) => {
                      const pill = r.status === 'acknowledged' || r.status === 'fulfilled' ? { bg: '#DCFCE7', color: '#16A34A' } : r.status === 'cannot_accommodate' ? { bg: '#FEE2E2', color: '#DC2626' } : { bg: '#F3F4F6', color: '#6B7280' }
                      return (
                        <button key={r.requestId} onClick={() => router.push(`/staff/request/${r.requestId}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #E5E7EB', textAlign: 'left', cursor: 'pointer' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.studentName}</div>
                            <div style={{ fontSize: 12, color: '#6B7280' }}>{r.station}</div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                            <div style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(r.scannedAt)}</div>
                            <div style={{ backgroundColor: pill.bg, color: pill.color, padding: '4px 8px', borderRadius: 99, fontSize: 12, fontWeight: 600 }}>{r.status.replace('_', ' ')}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ marginTop: 20, textAlign: 'center', paddingBottom: 40 }}>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>Dining Passport · Staff Mode</div>
              </div>

            </div>

            {/* End session modal */}
            {showEndModal && (
              <div onClick={() => setShowEndModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 430, margin: '0 24px', overflow: 'hidden' }}>
                  <div style={{ padding: 20, textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 999, background: '#FEF2F2', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🗑</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 6 }}>End session?</div>
                    <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>Your session at {diningNameDisplay} will be closed. You will need to set up a new session to continue.</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #F3F4F6' }}>
                    <button onClick={() => setShowEndModal(false)} style={{ padding: 14, fontSize: 14, fontWeight: 500, color: '#6B7280', background: 'none', border: 'none', borderRight: '1px solid #F3F4F6' }}>Cancel</button>
                    <button onClick={endSessionConfirmed} style={{ padding: 14, fontSize: 14, fontWeight: 600, color: '#DC2626', background: 'none', border: 'none' }}>End session</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
