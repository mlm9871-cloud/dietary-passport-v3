'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRoleGuard } from '../../../../lib/useRoleGuard'
import { supabase } from '../../../../lib/supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentInfo {
  id: string
  full_name: string
  email: string
  created_at: string
  profile_id: string | null
  profile_updated_at: string | null
  notes: string | null
}

interface Restriction {
  name: string
  emoji: string
  category: string
  tier: number
  cross_contact: boolean
  staff_note: string | null
}

interface RequestRow {
  id: string
  status: string
  source_type: string
  created_at: string
  reviewed_at: string | null
  dining_hall_name: string | null
  station_name: string | null
}

interface IncidentRow {
  id: string
  incident_type: string
  reason: string
  created_at: string
  dining_hall_name: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return shortDate(iso)
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

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  acknowledged:         { bg: '#DCFCE7', color: '#16A34A', label: 'Acknowledged' },
  fulfilled:            { bg: '#DCFCE7', color: '#16A34A', label: 'Fulfilled' },
  pending:              { bg: '#F3F4F6', color: '#6B7280', label: 'Pending' },
  cannot_accommodate:   { bg: '#FEE2E2', color: '#DC2626', label: 'Cannot Accommodate' },
  escalated:            { bg: '#FEF3C7', color: '#D97706', label: 'Escalated' },
}

const INCIDENT_PILL: Record<string, { bg: string; color: string; label: string }> = {
  cannot_accommodate: { bg: '#FEE2E2', color: '#DC2626', label: 'Cannot Accommodate' },
  need_manager:       { bg: '#FEF3C7', color: '#D97706', label: 'Need Manager' },
  cross_contact:      { bg: '#FEF3C7', color: '#D97706', label: 'Cross-Contact' },
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AdminStudentDetailPage() {
  useRoleGuard('Admin / Dietitian')
  const router = useRouter()
  const params = useParams()
  const studentId = params.id as string

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [incidents, setIncidents] = useState<IncidentRow[]>([])

  useEffect(() => {
    if (!studentId) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  async function fetchAll() {
    setLoading(true)
    setFetchError(false)
    try {
      // Fetch 1 — Student + profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          id, full_name, email, created_at,
          dietary_profiles(id, updated_at, notes)
        `)
        .eq('id', studentId)
        .limit(1)
        .single()

      if (userError || !userData) {
        console.error('Student fetch error:', userError)
        setFetchError(true)
        setLoading(false)
        return
      }

      const dp = Array.isArray((userData as any).dietary_profiles)
        ? (userData as any).dietary_profiles[0]
        : (userData as any).dietary_profiles

      const info: StudentInfo = {
        id: userData.id,
        full_name: (userData as any).full_name ?? '',
        email: (userData as any).email ?? '',
        created_at: (userData as any).created_at ?? '',
        profile_id: dp?.id ?? null,
        profile_updated_at: dp?.updated_at ?? null,
        notes: dp?.notes ?? null,
      }
      setStudent(info)

      if (info.profile_id) {
        await Promise.all([
          fetchRestrictions(info.profile_id),
          fetchRequests(info.profile_id),
          fetchIncidents(info.profile_id),
        ])
      }
    } catch (err) {
      console.error('Unexpected fetch error:', err)
      setFetchError(true)
    }
    setLoading(false)
  }

  async function fetchRestrictions(profileId: string) {
    const { data, error } = await supabase
      .from('dietary_profile_restrictions')
      .select('name, emoji, category, tier, cross_contact, staff_note')
      .eq('dietary_profile_id', profileId)
      .order('tier', { ascending: true })
    if (error) { console.error('Restrictions fetch error:', error); return }
    setRestrictions(data ?? [])
  }

  async function fetchRequests(profileId: string) {
    const { data, error } = await supabase
      .from('dietary_requests')
      .select(`
        id, status, source_type, created_at, reviewed_at,
        dining_halls(name),
        stations(name)
      `)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) { console.error('Requests fetch error:', error); return }

    const rows: RequestRow[] = (data ?? []).map((r: any) => {
      const dh = Array.isArray(r.dining_halls) ? r.dining_halls[0] : r.dining_halls
      const st = Array.isArray(r.stations) ? r.stations[0] : r.stations
      return {
        id: r.id,
        status: r.status ?? 'pending',
        source_type: r.source_type ?? '',
        created_at: r.created_at ?? '',
        reviewed_at: r.reviewed_at ?? null,
        dining_hall_name: dh?.name ?? null,
        station_name: st?.name ?? null,
      }
    })
    setRequests(rows)
  }

  async function fetchIncidents(profileId: string) {
    const { data, error } = await supabase
      .from('incidents')
      .select(`
        id, incident_type, reason, created_at,
        dietary_requests!inner(
          dining_hall_id,
          dining_halls(name)
        )
      `)
      .eq('dietary_requests.profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) { console.error('Incidents fetch error:', error); return }

    const rows: IncidentRow[] = (data ?? []).map((inc: any) => {
      const dr = inc.dietary_requests
      const dh = Array.isArray(dr?.dining_halls) ? dr.dining_halls[0] : dr?.dining_halls
      return {
        id: inc.id,
        incident_type: inc.incident_type ?? '',
        reason: inc.reason ?? '',
        created_at: inc.created_at ?? '',
        dining_hall_name: dh?.name ?? null,
      }
    })
    setIncidents(rows)
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const tier1 = restrictions.filter((r) => r.tier === 1)
  const tier2 = restrictions.filter((r) => r.tier === 2)
  const tier3 = restrictions.filter((r) => r.tier === 3)
  const hasCrossContact = tier1.some((r) => r.cross_contact)
  const notedRestrictions = restrictions.filter((r) => r.staff_note?.trim())

  const instructions: string[] = []
  if (tier1.length > 0) {
    instructions.push('Do not serve if uncertain about must-avoid items')
    instructions.push('Please confirm ingredients before serving')
  }
  if (hasCrossContact) instructions.push('Avoid cross-contact — use clean equipment and separate utensils')
  if (tier2.length > 0) instructions.push('Avoid where possible — substitutions welcome')
  if (tier3.length > 0) instructions.push('Best effort on preferences — not a health issue')

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 14, backgroundColor: '#FFFFFF',
        fontFamily: 'Inter, sans-serif',
      }}>
        <Spinner size={44} />
        <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Loading profile...</p>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (fetchError || !student) {
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
        <p style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>Could not load profile</p>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
          Please check your connection and try again.
        </p>
        <button
          onClick={() => router.push('/admin/dashboard')}
          style={{
            marginTop: 8, padding: '12px 24px', backgroundColor: '#1A7A5E',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      backgroundColor: '#F8FAFB', fontFamily: 'Inter, sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{
        backgroundColor: '#1A7A5E', padding: '16px 20px 14px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button
          onClick={() => router.push('/admin/dashboard')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, margin: -4 }}
          aria-label="Back to dashboard"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10l5-5" stroke="white"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span style={{ color: 'white', fontSize: 17, fontWeight: 600 }}>
          Student Detail
        </span>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 16px 40px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {/* ── Identity card ── */}
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
          borderRadius: 12, padding: 16,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          {/* Initials */}
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: '#1A7A5E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>
              {initials(student.full_name)}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' }}>
            {student.full_name}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
            {student.email}
          </p>
          {student.created_at && (
            <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>
              Member since {memberSince(student.created_at)}
            </p>
          )}

          {/* Profile status pill */}
          {student.profile_id ? (
            <span style={{
              marginTop: 4,
              backgroundColor: '#F0FAF7', color: '#1A7A5E',
              borderRadius: 999, padding: '4px 12px',
              fontSize: 12, fontWeight: 600,
            }}>
              Profile Active
            </span>
          ) : (
            <span style={{
              marginTop: 4,
              backgroundColor: '#F3F4F6', color: '#9CA3AF',
              borderRadius: 999, padding: '4px 12px',
              fontSize: 12, fontWeight: 600,
            }}>
              No Profile
            </span>
          )}
        </div>

        {/* ── Dietary restrictions ── */}
        {!student.profile_id || restrictions.length === 0 ? (
          <div style={{
            backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
            borderRadius: 12, padding: '24px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            textAlign: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="13" stroke="#E5E7EB" strokeWidth="2" />
              <path d="M16 10v7M16 21v.5" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111827' }}>
              No dietary profile on file
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              This student has not completed their Dining Passport profile yet.
            </p>
          </div>
        ) : (
          <>
            {/* Must Avoid */}
            {tier1.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#DC2626' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626',
                    textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Must Avoid
                  </span>
                </div>
                <div style={{
                  backgroundColor: '#FEF2F2', border: '1px solid #FECACA',
                  borderRadius: 12, padding: 14,
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tier1.map((r) => (
                      <span key={r.name} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        backgroundColor: '#FEE2E2', color: '#DC2626',
                        borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 500,
                      }}>
                        {r.emoji && <span>{r.emoji}</span>}{r.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Try to Avoid */}
            {tier2.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#D97706' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706',
                    textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Try to Avoid
                  </span>
                </div>
                <div style={{
                  backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 12, padding: 14,
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tier2.map((r) => (
                      <span key={r.name} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        backgroundColor: '#FEF3C7', color: '#D97706',
                        borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 500,
                      }}>
                        {r.emoji && <span>{r.emoji}</span>}{r.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Preference */}
            {tier3.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#16A34A' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A',
                    textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Preference
                  </span>
                </div>
                <div style={{
                  backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0',
                  borderRadius: 12, padding: 14,
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tier3.map((r) => (
                      <span key={r.name} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        backgroundColor: '#DCFCE7', color: '#16A34A',
                        borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 500,
                      }}>
                        {r.emoji && <span>{r.emoji}</span>}{r.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cross-contact banner */}
            {hasCrossContact && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M9 2L1.5 15.5h15L9 2z" stroke="#D97706" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 7v4M9 13v.5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontSize: 14, color: '#92400E', fontWeight: 500, lineHeight: 1.5 }}>
                  Cross-contact sensitive — trace amounts are a risk
                </span>
              </div>
            )}

            {/* Staff notes */}
            {notedRestrictions.length > 0 && (
              <div>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  display: 'block', marginBottom: 8,
                }}>
                  Student Notes
                </span>
                <div style={{
                  backgroundColor: '#F8FAFB', border: '1px solid #E5E7EB',
                  borderRadius: 10, padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {notedRestrictions.map((r) => (
                    <div key={r.name}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {r.emoji} {r.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                        {r.staff_note}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operational instructions */}
            {instructions.length > 0 && (
              <div>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  display: 'block', marginBottom: 8,
                }}>
                  Staff Instructions
                </span>
                <div style={{
                  backgroundColor: '#F0FAF7', border: '1px solid #D1FAE5',
                  borderRadius: 10, padding: 14,
                }}>
                  {instructions.map((line, i) => (
                    <p key={i} style={{
                      margin: i === 0 ? 0 : '6px 0 0',
                      fontSize: 13, color: '#374151', lineHeight: 1.6,
                    }}>
                      {'• ' + line}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Request history ── */}
        <div style={{ marginTop: 8 }}>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Request History
          </p>

          {requests.length === 0 ? (
            <div style={{
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
              borderRadius: 10, padding: '18px 16px', textAlign: 'center',
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>No requests recorded yet</p>
            </div>
          ) : (
            requests.map((req) => {
              const pill = STATUS_PILL[req.status] ?? STATUS_PILL['pending']
              return (
                <div key={req.id} style={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {/* Status pill */}
                  <span style={{
                    backgroundColor: pill.bg, color: pill.color,
                    borderRadius: 999, padding: '3px 9px',
                    fontSize: 11, fontWeight: 600, flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    {pill.label}
                  </span>

                  {/* Location */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 500, color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {req.dining_hall_name ?? 'Unknown hall'}
                    </p>
                    {req.station_name && (
                      <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                        {req.station_name}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>
                    {shortDate(req.created_at)}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* ── Incident history ── */}
        <div style={{ marginTop: 4 }}>
          <p style={{
            margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: '#9CA3AF',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Incident History
          </p>

          {incidents.length === 0 ? (
            <div style={{
              backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
              borderRadius: 10, padding: '20px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              textAlign: 'center',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', backgroundColor: '#F0FAF7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="8" fill="#1A7A5E" />
                  <path d="M5 9l3 3 5-5" stroke="white" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#111827' }}>
                No incidents on record
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
                All requests have been successfully accommodated
              </p>
            </div>
          ) : (
            incidents.map((inc) => {
              const pill = INCIDENT_PILL[inc.incident_type] ?? INCIDENT_PILL['cannot_accommodate']
              return (
                <div key={inc.id} style={{
                  backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  {/* Type pill */}
                  <span style={{
                    backgroundColor: pill.bg, color: pill.color,
                    borderRadius: 999, padding: '3px 9px',
                    fontSize: 11, fontWeight: 600, flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    {pill.label}
                  </span>

                  {/* Location + reason */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 13, fontWeight: 500, color: '#111827',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {inc.dining_hall_name ?? 'Unknown location'}
                    </p>
                    {inc.reason && (
                      <p style={{
                        margin: 0, fontSize: 12, color: '#6B7280', fontStyle: 'italic',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {inc.reason}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <span style={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>
                    {shortDate(inc.created_at)}
                  </span>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}
