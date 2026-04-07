'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRoleGuard } from '../../../lib/useRoleGuard'
import { supabase } from '../../../lib/supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: string
  full_name: string
  email: string
  created_at: string
  profile_id: string | null
  profile_updated_at: string | null
}

interface IncidentRow {
  id: string
  reason: string
  created_at: string
  incident_type: string
  dining_hall_name: string | null
  student_name: string
  student_user_id: string
}

interface StationRow {
  id: string
  name: string
  is_active: boolean
  dining_hall_id: string
}

interface DiningHallRow {
  id: string
  name: string
  is_active: boolean
  stations: StationRow[]
}

interface AddStationModal {
  diningHallId: string
  diningHallName: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function Spinner({ color = '#1A7A5E', size = 40 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.9s linear infinite' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  useRoleGuard('Admin / Dietitian')
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [noOrg, setNoOrg] = useState(false)

  const [students, setStudents] = useState<StudentRow[]>([])
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [totalRequests, setTotalRequests] = useState(0)
  const [search, setSearch] = useState('')
  const [diningHalls, setDiningHalls] = useState<DiningHallRow[]>([])
  const [addStationModal, setAddStationModal] = useState<AddStationModal | null>(null)
  const [addStationName, setAddStationName] = useState('')
  const [addStationLoading, setAddStationLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    const name = localStorage.getItem('userOrganizationName') || ''
    setOrgName(name)
    const orgId = localStorage.getItem('userOrganizationId')
    if (!orgId) {
      setNoOrg(true)
      setLoading(false)
      return
    }
    fetchAll(orgId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAll(orgId: string) {
    setLoading(true)
    setFetchError(false)
    try {
      await Promise.all([
        fetchStudents(orgId),
        fetchIncidents(orgId),
        fetchRequestCount(orgId),
        fetchDiningHalls(orgId),
      ])
    } catch (err) {
      console.error('Dashboard fetch error:', err)
      setFetchError(true)
    }
    setLoading(false)
  }

  async function fetchStudents(orgId: string) {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        created_at,
        dietary_profiles(id, updated_at)
      `)
      .eq('organization_id', orgId)
      .order('full_name', { ascending: true })

    if (error) {
      console.error('Students fetch error:', error)
      return
    }

    const rows: StudentRow[] = (data ?? []).map((u: any) => {
      const dp = Array.isArray(u.dietary_profiles)
        ? u.dietary_profiles[0]
        : u.dietary_profiles
      return {
        id: u.id,
        full_name: u.full_name ?? '',
        email: u.email ?? '',
        created_at: u.created_at ?? '',
        profile_id: dp?.id ?? null,
        profile_updated_at: dp?.updated_at ?? null,
      }
    })
    setStudents(rows)
  }

  async function fetchIncidents(orgId: string) {
    const { data, error } = await supabase
      .from('incidents')
      .select(`
        id,
        reason,
        created_at,
        incident_type,
        dietary_requests!inner(
          dining_hall_id,
          station_id,
          profile_id,
          dietary_profiles!inner(
            user_id,
            users!inner(full_name, organization_id)
          ),
          dining_halls(name)
        )
      `)
      .in('incident_type', ['cannot_accommodate', 'need_manager', 'cross_contact'])
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Incidents fetch error:', error)
      return
    }

    const rows: IncidentRow[] = (data ?? [])
      .filter((inc: any) => {
        const u = inc.dietary_requests?.dietary_profiles?.users
        return u?.organization_id === orgId
      })
      .map((inc: any) => {
        const dr = inc.dietary_requests
        const dp = dr?.dietary_profiles
        const u = dp?.users
        const dh = Array.isArray(dr?.dining_halls) ? dr.dining_halls[0] : dr?.dining_halls
        return {
          id: inc.id,
          reason: inc.reason ?? '',
          created_at: inc.created_at ?? '',
          incident_type: inc.incident_type ?? '',
          dining_hall_name: dh?.name ?? null,
          student_name: u?.full_name ?? 'Unknown',
          student_user_id: dp?.user_id ?? '',
        }
      })
    setIncidents(rows)
  }

  async function fetchRequestCount(orgId: string) {
    const { count, error } = await supabase
      .from('dietary_requests')
      .select('id', { count: 'exact', head: true })
      .not('profile_id', 'is', null)

    if (error) {
      console.error('Request count error:', error)
      return
    }
    setTotalRequests(count ?? 0)
  }

  async function fetchDiningHalls(orgId: string) {
    const { data, error } = await supabase
      .from('dining_halls')
      .select(`
        id, name, is_active,
        stations(id, name, is_active)
      `)
      .eq('organization_id', orgId)
      .order('name', { ascending: true })

    if (error) { console.error('Dining halls fetch error:', error); return }

    const rows: DiningHallRow[] = (data ?? []).map((dh: any) => {
      const rawStations = Array.isArray(dh.stations) ? dh.stations : (dh.stations ? [dh.stations] : [])
      const stations: StationRow[] = rawStations
        .map((s: any) => ({ id: s.id, name: s.name, is_active: s.is_active ?? true, dining_hall_id: dh.id }))
        .sort((a: StationRow, b: StationRow) => a.name.localeCompare(b.name))
      return { id: dh.id, name: dh.name, is_active: dh.is_active ?? true, stations }
    })
    setDiningHalls(rows)
  }

  async function handleAddStation() {
    if (!addStationModal || !addStationName.trim() || addStationLoading) return
    setAddStationLoading(true)
    try {
      const { data, error } = await supabase
        .from('stations')
        .insert({ dining_hall_id: addStationModal.diningHallId, name: addStationName.trim(), is_active: true })
        .select('id, name, is_active')
        .single()
      if (error) { console.error('Add station error:', error) }
      else if (data) {
        const newStation: StationRow = { id: data.id, name: data.name, is_active: data.is_active, dining_hall_id: addStationModal.diningHallId }
        setDiningHalls((prev) => prev.map((dh) =>
          dh.id === addStationModal.diningHallId
            ? { ...dh, stations: [...dh.stations, newStation].sort((a, b) => a.name.localeCompare(b.name)) }
            : dh
        ))
      }
    } catch (err) { console.error('Add station exception:', err) }
    setAddStationLoading(false)
    setAddStationModal(null)
    setAddStationName('')
  }

  async function handleToggleStation(stationId: string, diningHallId: string, newActive: boolean) {
    setDiningHalls((prev) => prev.map((dh) =>
      dh.id === diningHallId
        ? { ...dh, stations: dh.stations.map((s) => s.id === stationId ? { ...s, is_active: newActive } : s) }
        : dh
    ))
    try {
      const { error } = await supabase.from('stations').update({ is_active: newActive }).eq('id', stationId)
      if (error) {
        console.error('Toggle station error:', error)
        // revert
        setDiningHalls((prev) => prev.map((dh) =>
          dh.id === diningHallId
            ? { ...dh, stations: dh.stations.map((s) => s.id === stationId ? { ...s, is_active: !newActive } : s) }
            : dh
        ))
      }
    } catch (err) { console.error('Toggle station exception:', err) }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalStudents = students.length
  const totalIncidents = incidents.length
  const successRate =
    totalRequests === 0
      ? null
      : Math.round(((totalRequests - totalIncidents) / totalRequests) * 100)

  function rateColor(rate: number): string {
    if (rate >= 90) return '#16A34A'
    if (rate >= 70) return '#D97706'
    return '#DC2626'
  }

  // ── Filtered students ─────────────────────────────────────────────────────

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase()
    return s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
  })

  // ── Retry ────────────────────────────────────────────────────────────────

  function handleRetry() {
    const orgId = localStorage.getItem('userOrganizationId')
    if (!orgId) { setNoOrg(true); return }
    fetchAll(orgId)
  }

  // ── Pre-mount ─────────────────────────────────────────────────────────────

  if (!mounted) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFFFFF',
      }}>
        <Spinner />
      </div>
    )
  }

  // ── No org ────────────────────────────────────────────────────────────────

  if (noOrg) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: '0 32px',
        backgroundColor: '#FFFFFF', fontFamily: 'Inter, sans-serif', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', backgroundColor: '#FEF2F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="10" stroke="#DC2626" strokeWidth="2" />
            <path d="M13 8v6M13 17v.5" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>
          Organization not found
        </p>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
          Please sign in again.
        </p>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 14, backgroundColor: '#FFFFFF',
        fontFamily: 'Inter, sans-serif',
      }}>
        <Spinner size={44} />
        <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Loading dashboard...</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (fetchError) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: '0 32px',
        backgroundColor: '#FFFFFF', fontFamily: 'Inter, sans-serif', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', backgroundColor: '#FEF2F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <circle cx="13" cy="13" r="10" stroke="#DC2626" strokeWidth="2" />
            <path d="M13 8v6M13 17v.5" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>
          Could not load dashboard
        </p>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
          Please check your connection and try again.
        </p>
        <button
          onClick={handleRetry}
          style={{
            marginTop: 8, padding: '12px 28px', backgroundColor: '#1A7A5E',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      backgroundColor: '#F8FAFB', fontFamily: 'Inter, sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{
        backgroundColor: '#1A7A5E', padding: '18px 20px 14px',
        display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0,
      }}>
        <span style={{ color: 'white', fontSize: 17, fontWeight: 600 }}>
          Admin Dashboard
        </span>
        {orgName && (
          <span style={{ color: '#D1FAE5', fontSize: 12 }}>
            {orgName}
          </span>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 16px 40px',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* ── Stats grid ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {[
            { value: String(totalStudents), label: 'STUDENTS', color: '#111827' },
            { value: String(totalRequests), label: 'REQUESTS', color: '#111827' },
            { value: String(totalIncidents), label: 'INCIDENTS', color: '#111827' },
            {
              value: successRate === null ? '—' : `${successRate}%`,
              label: 'SUCCESS RATE',
              color: successRate === null ? '#111827' : rateColor(successRate),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                borderRadius: 12, padding: 14,
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: stat.color }}>
                {stat.value}
              </p>
              <p style={{
                margin: 0, fontSize: 11, color: '#9CA3AF',
                textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
              }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Incidents feed ── */}
        <div>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Recent Incidents
          </p>

          {incidents.length === 0 ? (
            <div style={{
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
              borderRadius: 12, padding: '28px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', backgroundColor: '#F0FAF7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <circle cx="11" cy="11" r="9" fill="#1A7A5E" />
                  <path d="M6.5 11l3 3 6-6" stroke="white" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>
                No incidents reported
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                All dietary requests have been accommodated
              </p>
            </div>
          ) : (
            incidents.map((inc) => {
              const isCannotAccommodate = inc.incident_type === 'cannot_accommodate'
              const pillBg = isCannotAccommodate ? '#FEE2E2' : '#FEF3C7'
              const pillColor = isCannotAccommodate ? '#DC2626' : '#D97706'
              const pillLabel = isCannotAccommodate ? 'Cannot Accommodate'
                : inc.incident_type === 'need_manager' ? 'Need Manager'
                : 'Cross-Contact'
              return (
                <div
                  key={inc.id}
                  onClick={() => router.push('/admin/students/' + inc.student_user_id)}
                  style={{
                    backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                    borderRadius: 12, padding: 14, marginBottom: 8, cursor: 'pointer',
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: pillBg, color: pillColor,
                      borderRadius: 999, padding: '3px 10px',
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {pillLabel}
                    </span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {timeAgo(inc.created_at)}
                    </span>
                  </div>
                  {/* Student name */}
                  <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    {inc.student_name}
                  </p>
                  {/* Bottom row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 2.687 3.5 6.5 3.5 6.5s3.5-3.813 3.5-6.5C9.5 2.567 7.933 1 6 1z"
                          stroke="#9CA3AF" strokeWidth="1.2" />
                        <circle cx="6" cy="4.5" r="1" fill="#9CA3AF" />
                      </svg>
                      <span style={{ fontSize: 12, color: '#6B7280' }}>
                        {inc.dining_hall_name ?? 'Unknown location'}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 12, color: '#6B7280', fontStyle: 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 160,
                    }}>
                      {inc.reason}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* ── Student roster ── */}
        <div>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            All Students
          </p>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            style={{
              width: '100%', padding: '10px 14px', marginBottom: 10,
              border: '1px solid #E5E7EB', borderRadius: 8,
              fontSize: 14, color: '#111827', backgroundColor: '#FFFFFF',
              outline: 'none', boxSizing: 'border-box',
              fontFamily: 'Inter, sans-serif',
            }}
          />

          {filteredStudents.length === 0 ? (
            <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>
              {search ? 'No students match your search.' : 'No students enrolled yet.'}
            </p>
          ) : (
            filteredStudents.map((student) => (
              <div
                key={student.id}
                onClick={() => router.push('/admin/students/' + student.id)}
                style={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: 12, padding: 14, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                }}
              >
                {/* Initials */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: '#1A7A5E', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>
                    {initials(student.full_name)}
                  </span>
                </div>

                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {student.full_name}
                  </p>
                  <p style={{
                    margin: 0, fontSize: 12, color: '#9CA3AF',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {student.email}
                  </p>
                </div>

                {/* Profile badge + chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {student.profile_id ? (
                    <span style={{
                      backgroundColor: '#F0FAF7', color: '#1A7A5E',
                      borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 600,
                    }}>
                      Profile
                    </span>
                  ) : (
                    <span style={{
                      backgroundColor: '#F3F4F6', color: '#9CA3AF',
                      borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 500,
                    }}>
                      No profile
                    </span>
                  )}
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.25 3.5L8.75 7l-3.5 3.5" stroke="#9CA3AF"
                      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            ))
          )}
        </div>
        {/* ── Dining halls & stations ── */}
        <div style={{ marginTop: 4 }}>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Dining Halls &amp; Stations
          </p>

          {diningHalls.length === 0 ? (
            <p style={{ fontSize: 14, color: '#9CA3AF', textAlign: 'center', padding: '16px 0' }}>
              No dining halls configured yet.
            </p>
          ) : (
            diningHalls.map((dh) => (
              <div key={dh.id} style={{
                backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                borderRadius: 12, padding: 14, marginBottom: 10,
              }}>
                {/* Hall header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{dh.name}</span>
                  <button
                    onClick={() => { setAddStationModal({ diningHallId: dh.id, diningHallName: dh.name }); setAddStationName('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#1A7A5E', fontWeight: 500, padding: '2px 0' }}
                  >
                    + Add Station
                  </button>
                </div>

                {/* Station list */}
                {dh.stations.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                    No stations yet.
                  </p>
                ) : (
                  dh.stations.map((station) => (
                    <div key={station.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 0', borderTop: '1px solid #F3F4F6',
                    }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>{station.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {station.is_active ? (
                          <span style={{
                            backgroundColor: '#DCFCE7', color: '#16A34A',
                            borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                          }}>Active</span>
                        ) : (
                          <span style={{
                            backgroundColor: '#F3F4F6', color: '#9CA3AF',
                            borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                          }}>Inactive</span>
                        )}
                        <button
                          onClick={() => handleToggleStation(station.id, dh.id, !station.is_active)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: 500, padding: 0,
                            color: station.is_active ? '#9CA3AF' : '#1A7A5E',
                          }}
                        >
                          {station.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>

      </div>

      {/* ── Add Station modal ── */}
      {addStationModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 20px',
        }}>
          <div style={{
            width: '100%', maxWidth: 390,
            backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
              Add Station
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7280' }}>
              {addStationModal.diningHallName}
            </p>
            <input
              type="text"
              value={addStationName}
              onChange={(e) => setAddStationName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddStation() }}
              placeholder="e.g. Grill Station"
              autoFocus
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #E5E7EB', borderRadius: 8,
                fontSize: 14, color: '#111827', outline: 'none',
                boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setAddStationModal(null); setAddStationName('') }}
                style={{
                  flex: 1, padding: '11px 0',
                  backgroundColor: 'white', border: '1.5px solid #E5E7EB',
                  color: '#6B7280', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddStation}
                disabled={!addStationName.trim() || addStationLoading}
                style={{
                  flex: 1, padding: '11px 0',
                  backgroundColor: addStationName.trim() ? '#1A7A5E' : '#E5E7EB',
                  color: addStationName.trim() ? 'white' : '#9CA3AF',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  cursor: addStationName.trim() ? 'pointer' : 'default',
                }}
              >
                {addStationLoading ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
