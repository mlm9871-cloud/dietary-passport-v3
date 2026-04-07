'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PassportMeta {
  token: string
  dietary_profile_id: string
  user_id: string
  updated_at: string
  full_name: string
  organization_name: string | null
}

interface Restriction {
  name: string
  emoji: string
  category: string
  tier: number
  cross_contact: boolean
  staff_note: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function Spinner({ color = '#1A7A5E', size = 44 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.9s linear infinite' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PublicPassportPage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [passport, setPassport] = useState<PassportMeta | null>(null)
  const [restrictions, setRestrictions] = useState<Restriction[]>([])

  useEffect(() => {
    if (!token) return
    fetchPassport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function fetchPassport() {
    setLoading(true)
    try {
      const { data: tokenData, error: tokenError } = await supabase
        .from('qr_tokens')
        .select(`
          token,
          dietary_profile_id,
          dietary_profiles!inner(
            id,
            user_id,
            updated_at,
            users!inner(
              full_name,
              organization_id,
              organizations(name)
            )
          )
        `)
        .eq('token', token)
        .limit(1)
        .single()

      if (tokenError || !tokenData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      const dp = (tokenData as any).dietary_profiles
      const u = dp?.users
      const org = Array.isArray(u?.organizations) ? u.organizations[0] : u?.organizations

      const meta: PassportMeta = {
        token: tokenData.token,
        dietary_profile_id: tokenData.dietary_profile_id,
        user_id: dp?.user_id ?? '',
        updated_at: dp?.updated_at ?? '',
        full_name: u?.full_name ?? 'Unknown',
        organization_name: org?.name ?? null,
      }
      setPassport(meta)

      const { data: rData, error: rError } = await supabase
        .from('dietary_profile_restrictions')
        .select('name, emoji, category, tier, cross_contact, staff_note')
        .eq('dietary_profile_id', tokenData.dietary_profile_id)
        .order('tier', { ascending: true })

      if (rError) console.error('Restrictions fetch error:', rError)
      else setRestrictions(rData ?? [])
    } catch (err) {
      console.error('Passport fetch error:', err)
      setNotFound(true)
    }
    setLoading(false)
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
        minHeight: '100vh', backgroundColor: '#FFFFFF',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 14, fontFamily: 'Inter, sans-serif',
      }}>
        <Spinner />
        <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Loading passport...</p>
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (notFound || !passport) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#FFFFFF',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: '0 32px',
        fontFamily: 'Inter, sans-serif', textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', backgroundColor: '#F3F4F6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="5" y="3" width="18" height="22" rx="2.5" stroke="#9CA3AF" strokeWidth="2" />
            <path d="M9 9h10M9 13h10M9 17h6" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M18 18l5 5M23 18l-5 5" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
          Passport Not Found
        </p>
        <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.6, maxWidth: 320 }}>
          This QR code is invalid or has expired. Ask the student to open their Dining Passport app
          and show their current QR code.
        </p>
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#FFFFFF',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{
          backgroundColor: '#1A7A5E', padding: '20px 20px 22px',
        }}>
          {/* Label */}
          <p style={{
            margin: '0 0 8px', fontSize: 11, color: '#D1FAE5',
            textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
          }}>
            Dining Passport
          </p>

          {/* Name */}
          <p style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: 'white' }}>
            {passport.full_name}
          </p>

          {/* Org */}
          {passport.organization_name && (
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#D1FAE5' }}>
              {passport.organization_name}
            </p>
          )}

          {/* Verified badge + last updated */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 999,
              padding: '4px 10px',
            }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" fill="rgba(255,255,255,0.2)" />
                <path d="M3.5 6l2 2 3-3" stroke="white" strokeWidth="1.4"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>Verified Profile</span>
            </div>
            {passport.updated_at && (
              <span style={{ fontSize: 12, color: '#D1FAE5' }}>
                Updated {formatDate(passport.updated_at)}
              </span>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>

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

          {/* Empty profile */}
          {restrictions.length === 0 && (
            <div style={{
              backgroundColor: '#F8FAFB', border: '1px solid #E5E7EB',
              borderRadius: 12, padding: '24px 16px', textAlign: 'center',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
                No restrictions listed
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#6B7280' }}>
                This student has no dietary restrictions on file.
              </p>
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

          {/* Staff instructions */}
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
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '16px 20px', borderTop: '1px solid #E5E7EB',
          textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9CA3AF' }}>
            Dining Passport · Verified Profile
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
            This profile is read-only. Information provided by student.
          </p>
        </div>

      </div>
    </div>
  )
}
