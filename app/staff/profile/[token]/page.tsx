'use client'

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StaffSession {
  diningHallId: string
  diningHallName: string
  stationId: string
  stationName: string
  organizationName: string
  startedAt: string
}

interface ProfileMeta {
  token: string
  dietary_profile_id: string
  user_id: string
  updated_at: string
  full_name: string
  email: string
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
  dining_hall_id: string | null
  station_id: string | null
  created_at: string
}

type ModalType = 'manager' | 'cannot' | null

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  if (diff < 10) return 'just now'
  if (diff < 60) return `${diff}s ago`
  const m = Math.floor(diff / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function updateRecentRequestStatus(requestId: string, status: string) {
  try {
    const existing = JSON.parse(localStorage.getItem('recentRequests') || '[]')
    const updated = existing.map((r: { requestId: string; status: string }) =>
      r.requestId === requestId ? { ...r, status } : r
    )
    localStorage.setItem('recentRequests', JSON.stringify(updated))
  } catch {
    // ignore
  }
}

// ── Spinner ────────────────────────────────────────────────────────────────────

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

export default function StaffProfilePage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const token = params.token as string
  const requestId = searchParams.get('requestId')

  const [mounted, setMounted] = useState(false)
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const [profile, setProfile] = useState<ProfileMeta | null>(null)
  const [restrictions, setRestrictions] = useState<Restriction[]>([])
  const [request, setRequest] = useState<RequestRow | null>(null)

  const [ackLoading, setAckLoading] = useState(false)
  const [ackDone, setAckDone] = useState(false)
  const [cannotDone, setCannotDone] = useState(false)

  const [modal, setModal] = useState<ModalType>(null)
  const [cannotReason, setCannotReason] = useState('')
  const [cannotOther, setCannotOther] = useState('')
  const [cannotLoading, setCannotLoading] = useState(false)
  const [managerLoading, setManagerLoading] = useState(false)
  const [showCannotOverlay, setShowCannotOverlay] = useState(false)
  const [showManagerOverlay, setShowManagerOverlay] = useState(false)

  // Mount + session
  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem('staffSession')
      if (raw) setStaffSession(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  // Data fetch
  useEffect(() => {
    if (!mounted || !token) return
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, token])

  async function fetchAll() {
    setLoading(true)
    setFetchError(false)
    try {
      // Step 1: profile meta via token
      const { data: tokenData, error: tokenError } = await supabase
        .from('qr_tokens')
        .select(`
          token,
          dietary_profile_id,
          dietary_profiles!inner(
            id,
            user_id,
            updated_at,
            users!inner(full_name, email)
          )
        `)
        .eq('token', token)
        .limit(1)
        .single()

      if (tokenError || !tokenData) {
        console.error('Token fetch error:', tokenError)
        setFetchError(true)
        setLoading(false)
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dp = (tokenData as any).dietary_profiles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const u = (dp as any)?.users

      const profileMeta: ProfileMeta = {
        token: tokenData.token,
        dietary_profile_id: tokenData.dietary_profile_id,
        user_id: dp?.user_id ?? '',
        updated_at: dp?.updated_at ?? '',
        full_name: u?.full_name ?? 'Unknown',
        email: u?.email ?? '',
      }
      setProfile(profileMeta)

      // Step 2: restrictions
      const { data: restrictionData, error: restrictionError } = await supabase
        .from('dietary_profile_restrictions')
        .select('name, emoji, category, tier, cross_contact, staff_note')
        .eq('dietary_profile_id', tokenData.dietary_profile_id)
        .order('tier', { ascending: true })

      if (restrictionError) {
        console.error('Restrictions fetch error:', restrictionError)
      } else {
        setRestrictions(restrictionData ?? [])
      }

      // Step 3: request (optional)
      if (requestId) {
        const { data: reqData, error: reqError } = await supabase
          .from('dietary_requests')
          .select('id, status, dining_hall_id, station_id, created_at')
          .eq('id', requestId)
          .limit(1)
          .single()

        if (reqError) {
          console.error('Request fetch error:', reqError)
        } else {
          setRequest(reqData)
        }
      }
    } catch (err) {
      console.error('Unexpected fetch error:', err)
      setFetchError(true)
    }
    setLoading(false)
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const tier1 = restrictions.filter((r) => r.tier === 1)
  const tier2 = restrictions.filter((r) => r.tier === 2)
  const tier3 = restrictions.filter((r) => r.tier === 3)
  const hasCrossContact = tier1.some((r) => r.cross_contact)
  const notedRestrictions = restrictions.filter((r) => r.staff_note && r.staff_note.trim() !== '')

  const instructions: string[] = []
  if (tier1.length > 0) {
    instructions.push('Do not serve if uncertain about must-avoid items')
    instructions.push('Please confirm ingredients before serving')
  }
  if (hasCrossContact) {
    instructions.push('Avoid cross-contact — use clean equipment and separate utensils')
  }
  if (tier2.length > 0) {
    instructions.push('Avoid where possible — substitutions welcome')
  }
  if (tier3.length > 0) {
    instructions.push('Best effort on preferences — not a health issue')
  }

  // ── Action handlers ──────────────────────────────────────────────────────────

  async function handleAcknowledge() {
    if (ackLoading || ackDone) return
    setAckLoading(true)
    try {
      if (requestId) {
        await supabase
          .from('dietary_requests')
          .update({ status: 'acknowledged', reviewed_at: new Date().toISOString() })
          .eq('id', requestId)
        updateRecentRequestStatus(requestId, 'acknowledged')
      }
    } catch (err) {
      console.error('Acknowledge error:', err)
    }
    setAckLoading(false)
    setAckDone(true)
    setTimeout(() => router.push('/staff/home'), 1000)
  }

  async function handleNeedManager() {
    setManagerLoading(true)
    try {
      if (requestId) {
        await supabase
          .from('dietary_requests')
          .update({ status: 'escalated' })
          .eq('id', requestId)
        await supabase.from('incidents').insert({
          request_id: requestId,
          incident_type: 'need_manager',
          reason: 'manager_requested',
          notes: null,
        })
      }
    } catch (err) {
      console.error('Manager escalation error:', err)
    }
    setManagerLoading(false)
    setModal(null)
    setShowManagerOverlay(true)
    setTimeout(() => router.push('/staff/home'), 1500)
  }

  async function handleCannotConfirm() {
    if (!cannotReason || cannotLoading) return
    setCannotLoading(true)
    const reason = cannotReason === 'Other' ? cannotOther || 'Other' : cannotReason
    try {
      if (requestId) {
        await supabase
          .from('dietary_requests')
          .update({ status: 'cannot_accommodate', reviewed_at: new Date().toISOString() })
          .eq('id', requestId)

        await supabase.from('incidents').insert({
          request_id: requestId,
          incident_type: 'cannot_accommodate',
          reason,
          notes: cannotReason === 'Other' ? cannotOther || null : null,
        })

        if (profile) {
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'cannot_accommodate',
            message:
              'A staff member at ' +
              (staffSession?.diningHallName ?? 'your dining hall') +
              ' could not accommodate your request.',
            request_id: requestId,
            read: false,
          })
        }

        updateRecentRequestStatus(requestId, 'cannot_accommodate')
      }
    } catch (err) {
      console.error('Cannot accommodate error:', err)
    }
    setCannotLoading(false)
    setModal(null)
    setCannotDone(true)
    setShowCannotOverlay(true)
    setTimeout(() => router.push('/staff/home'), 1500)
  }

  // ── Pre-mount skeleton ───────────────────────────────────────────────────────

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

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, backgroundColor: '#FFFFFF',
        fontFamily: 'Inter, sans-serif',
      }}>
        <Spinner size={48} />
        <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Loading profile...</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (fetchError || !profile) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, padding: '0 32px',
        backgroundColor: '#FFFFFF', fontFamily: 'Inter, sans-serif', textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', backgroundColor: '#FEF2F2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="#DC2626" strokeWidth="2" />
            <path d="M16 10v7M16 21v1" stroke="#DC2626" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>Profile not found</p>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
          This QR code could not be matched to a student profile. Ask the student to open their
          Dining Passport app and regenerate their QR code.
        </p>
        <button
          onClick={() => router.push('/staff/scan')}
          style={{
            marginTop: 8, padding: '13px 28px', backgroundColor: '#1A7A5E',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Back to scanner
        </button>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      backgroundColor: '#F8FAFB', fontFamily: 'Inter, sans-serif',
      position: 'relative',
    }}>

      {/* ── Header ── */}
      <div style={{
        backgroundColor: '#1A7A5E', padding: '16px 20px 14px',
        display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/staff/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, margin: -4 }}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10l5-5" stroke="white"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ color: 'white', fontSize: 17, fontWeight: 600 }}>
            Dietary Request
          </span>
        </div>
        {staffSession && (
          <span style={{ color: '#D1FAE5', fontSize: 12, paddingLeft: 36 }}>
            {staffSession.diningHallName} · {staffSession.stationName}
          </span>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 16px 120px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>

        {/* ── Student identity card ── */}
        <div style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Initials */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              backgroundColor: '#1A7A5E', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>
                {initials(profile.full_name)}
              </span>
            </div>
            {/* Name + org */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name}
              </p>
              {staffSession?.organizationName && (
                <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
                  {staffSession.organizationName}
                </p>
              )}
            </div>
            {/* Verified badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              backgroundColor: '#F0FAF7', borderRadius: 999,
              padding: '4px 10px', flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" fill="#1A7A5E" />
                <path d="M3.5 6l2 2 3-3" stroke="white" strokeWidth="1.3"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1A7A5E' }}>Verified</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, backgroundColor: '#E5E7EB', margin: '12px 0' }} />

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* QR scan badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              backgroundColor: '#F3F4F6', borderRadius: 999, padding: '4px 10px',
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="#6B7280" strokeWidth="1.2" />
                <rect x="7" y="1" width="4" height="4" rx="0.5" stroke="#6B7280" strokeWidth="1.2" />
                <rect x="1" y="7" width="4" height="4" rx="0.5" stroke="#6B7280" strokeWidth="1.2" />
                <rect x="2.5" y="2.5" width="1" height="1" fill="#6B7280" />
                <rect x="8.5" y="2.5" width="1" height="1" fill="#6B7280" />
                <rect x="2.5" y="8.5" width="1" height="1" fill="#6B7280" />
                <path d="M7 7h1.5M8.5 7v1.5M7 8.5h1" stroke="#6B7280" strokeWidth="1"
                  strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: 12, color: '#6B7280' }}>QR Scan</span>
            </div>

            {/* Timestamp */}
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>
              {request ? `Scanned ${timeAgo(request.created_at)}` : 'Scanned just now'}
            </span>

            {/* Profile updated */}
            {profile.updated_at && (
              <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>
                Profile updated {formatDate(profile.updated_at)}
              </span>
            )}
          </div>
        </div>

        {/* ── MUST AVOID ── */}
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
                    {r.emoji && <span>{r.emoji}</span>}
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TRY TO AVOID ── */}
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
                    {r.emoji && <span>{r.emoji}</span>}
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── PREFERENCE ── */}
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
                    {r.emoji && <span>{r.emoji}</span>}
                    {r.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Cross-contact banner ── */}
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

        {/* ── Staff notes ── */}
        {notedRestrictions.length > 0 && (
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block',
              marginBottom: 8 }}>
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

        {/* ── Operational instructions ── */}
        {instructions.length > 0 && (
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block',
              marginBottom: 8 }}>
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
      </div>

      {/* ── Sticky action buttons ── */}
      <div style={{
        position: 'sticky', bottom: 0, backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E5E7EB', padding: '14px 16px 20px',
        display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
      }}>
        {/* Acknowledge */}
        <button
          onClick={handleAcknowledge}
          disabled={ackLoading || ackDone}
          style={{
            width: '100%', padding: 14,
            backgroundColor: ackDone ? '#16A34A' : '#1A7A5E',
            color: 'white', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 600, cursor: ackDone ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'background-color 0.2s',
          }}
        >
          {ackDone ? (
            <>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9l4 4 6-6" stroke="white" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Acknowledged
            </>
          ) : ackLoading ? (
            <Spinner color="white" size={20} />
          ) : (
            'Acknowledge'
          )}
        </button>

        {/* Need Manager */}
        <button
          onClick={() => setModal('manager')}
          style={{
            width: '100%', padding: 14,
            backgroundColor: 'white', border: '1.5px solid #D97706',
            color: '#D97706', borderRadius: 12,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Need Manager
        </button>

        {/* Cannot Accommodate */}
        <button
          onClick={() => { setCannotReason(''); setCannotOther(''); setModal('cannot') }}
          style={{
            width: '100%', padding: 14,
            backgroundColor: cannotDone ? '#FEF2F2' : 'white',
            border: '1.5px solid #DC2626',
            color: '#DC2626', borderRadius: 12,
            fontSize: 15, fontWeight: 600, cursor: cannotDone ? 'default' : 'pointer',
          }}
        >
          {cannotDone ? 'Request logged' : 'Cannot Accommodate'}
        </button>
      </div>

      {/* ── Manager modal ── */}
      {modal === 'manager' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            width: '100%', maxWidth: 390,
            backgroundColor: '#FFFFFF', borderRadius: 16,
            padding: 24, marginBottom: 16, maxHeight: '85vh', overflowY: 'auto',
          }}>
            {/* Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="16" r="8" stroke="#D97706" strokeWidth="2.5" />
                <path d="M8 40c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="36" cy="14" r="5" fill="#FFFBEB" stroke="#D97706" strokeWidth="2" />
                <path d="M36 11.5v3M36 16v.5" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>

            {/* Title */}
            <p style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' }}>
              Contact Manager
            </p>

            {/* Section 1 — Situation */}
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Situation
            </p>
            <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                {tier1.length > 0
                  ? <>
                      Student has {tier1.length} must-avoid item{tier1.length !== 1 ? 's' : ''}: {tier1.map((r) => r.name).join(', ')}.
                      {hasCrossContact && ' Cross-contact sensitive.'}
                    </>
                  : 'Student has dietary preferences that require attention.'
                }
              </p>
            </div>

            {/* Section 2 — Manager alert preview */}
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Manager Alert
            </p>
            <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>📋</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Dining Hall Manager</span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                Staff needs assistance with a dietary accommodation at {staffSession?.stationName ?? 'your station'}. Please come to the {staffSession?.stationName ?? 'station'} station.
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
                This notification is simulated — full manager alerts coming in a future version.
              </p>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => setModal(null)}
                style={{
                  width: '100%', padding: 13,
                  backgroundColor: 'white', border: '1.5px solid #E5E7EB',
                  color: '#6B7280', borderRadius: 10,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleNeedManager}
                disabled={managerLoading}
                style={{
                  width: '100%', padding: 13,
                  backgroundColor: '#D97706', color: 'white',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {managerLoading ? <Spinner color="white" size={20} /> : 'Notify Manager'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cannot accommodate modal ── */}
      {modal === 'cannot' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div style={{
            width: '100%', maxWidth: 390,
            backgroundColor: '#FFFFFF', borderRadius: 16,
            padding: 24, marginBottom: 16, maxHeight: '85vh', overflowY: 'auto',
          }}>
            {/* Header */}
            <p style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
              Cannot Accommodate
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6B7280' }}>
              What is preventing you from serving this student?
            </p>

            {/* Reason cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Ingredient details unclear',
                'Cross-contact risk cannot be avoided',
                'Item not available today',
                'Allergen present in all available options',
                'Cannot verify preparation method',
                'Other',
              ].map((option) => {
                const selected = cannotReason === option
                return (
                  <button
                    key={option}
                    onClick={() => setCannotReason(option)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '12px 14px',
                      backgroundColor: selected ? '#FEF2F2' : '#FFFFFF',
                      border: selected ? '1.5px solid #FECACA' : '1.5px solid #E5E7EB',
                      borderRadius: 10, fontSize: 14,
                      color: selected ? '#DC2626' : '#111827',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    <span>{option}</span>
                    {selected && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" fill="#16A34A" />
                        <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.6"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Other textarea */}
            {cannotReason === 'Other' && (
              <textarea
                value={cannotOther}
                onChange={(e) => setCannotOther(e.target.value)}
                placeholder="Describe the issue..."
                style={{
                  width: '100%', padding: '10px 12px', marginTop: 8,
                  border: '1px solid #E5E7EB', borderRadius: 8,
                  fontSize: 14, color: '#111827', resize: 'vertical',
                  minHeight: 80, fontFamily: 'Inter, sans-serif',
                  boxSizing: 'border-box', outline: 'none',
                }}
              />
            )}

            {/* Affected restrictions */}
            {(tier1.length > 0 || tier2.length > 0) && (
              <div style={{ marginTop: 12 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Affected restrictions:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(tier1.length > 0 ? tier1 : tier2).map((r) => (
                    <span key={r.name} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      backgroundColor: '#FEE2E2', color: '#DC2626',
                      borderRadius: 999, padding: '4px 10px', fontSize: 12,
                    }}>
                      {r.emoji} {r.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => { setModal(null); setCannotReason('') }}
                style={{
                  width: '100%', padding: 13,
                  backgroundColor: 'white', border: '1.5px solid #E5E7EB',
                  color: '#6B7280', borderRadius: 10,
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCannotConfirm}
                disabled={!cannotReason || cannotLoading}
                style={{
                  width: '100%', padding: 13,
                  backgroundColor: '#DC2626', color: 'white',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 600,
                  opacity: !cannotReason || cannotLoading ? 0.4 : 1,
                  cursor: !cannotReason || cannotLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {cannotLoading ? <Spinner color="white" size={20} /> : 'Confirm — Cannot Accommodate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cannot accommodate confirmation overlay ── */}
      {showCannotOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          backgroundColor: '#FEF2F2',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: '#DC2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M7 7l14 14M21 7L7 21" stroke="white" strokeWidth="2.5"
                strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 20, fontWeight: 700, color: '#DC2626' }}>
            Cannot Accommodate
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6B7280' }}>
            Logged and student notified
          </p>
        </div>
      )}

      {/* ── Manager confirmation overlay ── */}
      {showManagerOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          backgroundColor: '#FFFBEB',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            backgroundColor: '#D97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l7 7 11-11" stroke="white" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 20, fontWeight: 700, color: '#D97706' }}>
            Manager Alerted
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#9CA3AF', fontStyle: 'italic' }}>
            Simulation only — full alerts coming soon
          </p>
        </div>
      )}
    </div>
  )
}
