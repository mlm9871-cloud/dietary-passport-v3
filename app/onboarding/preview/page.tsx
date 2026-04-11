'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoleGuard } from '../../../lib/useRoleGuard'
import { supabase } from '../../../lib/supabaseClient'
import type { Tier } from '../../../types'

type RestrictionDetail = {
  name: string
  emoji: string
  category: 'allergen' | 'preference'
  tier: Tier | null
  crossContact: boolean
  staffNote: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function Pill({ name, bg, color }: { name: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      backgroundColor: bg,
      color,
      borderRadius: 99,
      padding: '5px 10px',
      fontSize: 12,
      fontWeight: 500,
    }}>
      {name}
    </span>
  )
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 11, color, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        {label}
      </span>
    </div>
  )
}

export default function PreviewPage() {
  useRoleGuard('Student')
  const router = useRouter()

  const [details, setDetails] = useState<RestrictionDetail[]>([])
  const [name, setName] = useState('Your Name')
  const [university, setUniversity] = useState('Your University')

  useEffect(() => {
    const raw = localStorage.getItem('restrictionDetails')
    if (raw) setDetails(JSON.parse(raw))
    const n = localStorage.getItem('userName')
    if (n) setName(n)
    const u = localStorage.getItem('userUniversity')
    if (u) setUniversity(u)
  }, [])

  const tier1 = details.filter((d) => d.tier === 1)
  const tier2 = details.filter((d) => d.tier === 2)
  const tier3 = details.filter((d) => d.tier === 3)
  const hasCrossContact = details.some((d) => d.crossContact)
  const notesItems = details.filter((d) => d.staffNote.trim())
  const isEmpty = details.length === 0

  function handleSave() {
    localStorage.setItem('profileSaved', 'true')
    localStorage.setItem('profileCreatedAt', new Date().toISOString())

    // Non-blocking Supabase writes — always attempted regardless of auth state
    ;(async () => {
      try {
        let userId: string | null = localStorage.getItem('supabaseUserId')
        const userEmail: string = localStorage.getItem('userEmail') ?? ''

        // If userId missing, try to recover one via auth or direct insert
        if (!userId && userEmail) {
          // Attempt 1: sign up
          try {
            const tempPassword = crypto.randomUUID()
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: userEmail,
              password: tempPassword,
            })
            if (!signUpError && signUpData.user?.id) {
              userId = signUpData.user.id
              localStorage.setItem('supabaseUserId', userId)
            } else {
              // Attempt 2: sign in (account may already exist from a prior attempt)
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: userEmail,
                password: tempPassword,
              })
              if (!signInError && signInData.user?.id) {
                userId = signInData.user.id
                localStorage.setItem('supabaseUserId', userId)
              } else {
                console.error('Auth recovery failed — signUp:', signUpError, '— signIn:', signInError)
              }
            }
          } catch (authErr) {
            console.error('Auth recovery exception:', authErr)
          }

          // Fallback: insert directly into users table without auth
          if (!userId) {
            try {
              const { data: insertUserData, error: insertUserError } = await supabase
                .from('users')
                .insert({ email: userEmail, full_name: name })
                .select('id')
                .single()
              if (!insertUserError && insertUserData?.id) {
                userId = insertUserData.id
                localStorage.setItem('supabaseUserId', userId)
              } else {
                console.error('Fallback user insert error:', insertUserError)
              }
            } catch (err) {
              console.error('Fallback user insert exception:', err)
            }
          }
        }

        // No userId available after all attempts — skip Supabase, proceed via finally
        if (!userId) return

        // Step 3a: check for existing dietary_profile, create if missing
        let profileId: string | null = null
        try {
          const { data: existingProfile } = await supabase
            .from('dietary_profiles')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .single()
          if (existingProfile?.id) {
            profileId = existingProfile.id
          }
        } catch { /* not found — will insert below */ }

        if (!profileId) {
          const { data: newProfile, error: profileError } = await supabase
            .from('dietary_profiles')
            .insert({ user_id: userId, display_name: name })
            .select('id')
            .single()
          if (profileError) {
            console.error('dietary_profiles insert error:', profileError)
          } else {
            profileId = newProfile?.id ?? null
          }
        }

        if (!profileId) return

        // Step 3b: delete existing restrictions to avoid duplicates
        await supabase
          .from('dietary_profile_restrictions')
          .delete()
          .eq('dietary_profile_id', profileId)

        // Step 3c: insert all current restrictions (no restriction_id)
        if (details.length > 0) {
          const toInsert = details.map((d) => ({
            dietary_profile_id: profileId,
            name: d.name,
            emoji: d.emoji,
            category: d.category,
            tier: d.tier,
            cross_contact: d.crossContact,
            staff_note: d.staffNote,
            notes: d.staffNote,
          }))
          try {
            const { error: restrictionsError } = await supabase
              .from('dietary_profile_restrictions')
              .insert(toInsert)
            if (restrictionsError) console.error('restrictions insert error:', restrictionsError)
          } catch (err) {
            console.error('restrictions insert exception:', err)
          }
        }

        // Step 3d: check for existing qr_token, create if missing
        try {
          const { data: existingToken } = await supabase
            .from('qr_tokens')
            .select('token')
            .eq('dietary_profile_id', profileId)
            .limit(1)
            .single()
          if (existingToken?.token) {
            localStorage.setItem('userQRToken', existingToken.token)
          } else {
            const token =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
            await supabase
              .from('qr_tokens')
              .insert({ dietary_profile_id: profileId, token, expires_at: null })
            localStorage.setItem('userQRToken', token)
          }
        } catch (err) {
          console.error('qr_tokens error:', err)
        }

        // Step 3e: persist profileId
        localStorage.setItem('supabaseDietaryProfileId', String(profileId))

      } catch (err) {
        console.error('Unexpected Supabase error on save:', err)
      } finally {
        router.push('/student/home')
      }
    })()
  }

  return (
    <div className="flex min-h-screen justify-center bg-white px-5 py-8">
      <div className="w-full max-w-[430px] flex flex-col">

        {/* ── BACK ── */}
        <button
          onClick={() => router.push('/onboarding/severity')}
          className="flex items-center gap-1.5 w-fit"
          style={{ background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', marginBottom: 20 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11.25 13.5L6.75 9l4.5-4.5" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 14, color: '#6B7280' }}>Back</span>
        </button>

        {/* ── HEADING ── */}
        <div className="flex flex-col gap-1.5" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.3 }}>
            Here's what staff will see
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55 }}>
            This is your Dining Passport. Review it before saving — you can always edit it later.
          </p>
        </div>

        {/* ── PREVIEW LABEL ── */}
        <p style={{
          fontSize: 11,
          color: '#9CA3AF',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          fontWeight: 500,
          textAlign: 'center',
          marginBottom: 10,
        }}>
          Your passport preview
        </p>

        {/* ── PASSPORT CARD ── */}
        <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>

          {/* A) Header */}
          <div style={{ backgroundColor: '#1A7A5E', padding: 16, position: 'relative' }}>
            {/* Live badge */}
            <div style={{
              position: 'absolute',
              top: 14,
              right: 14,
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 10,
              color: 'white',
              fontWeight: 500,
            }}>
              Live profile
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Avatar */}
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 600,
                color: 'white',
                flexShrink: 0,
              }}>
                {getInitials(name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>{name}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                  {university} · Dining Passport
                </span>
              </div>
            </div>
          </div>

          {/* EMPTY STATE */}
          {isEmpty && (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#6B7280' }}>
                No restrictions added. Your passport is empty.
              </p>
            </div>
          )}

          {/* B) Must avoid */}
          {tier1.length > 0 && (
            <div style={{ backgroundColor: '#FFF5F5', borderBottom: '1px solid #FEE2E2', padding: 14 }}>
              <SectionHeader label="Must avoid" color="#DC2626" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tier1.map((d) => (
                  <Pill key={d.name} name={d.name} bg="#FEE2E2" color="#991B1B" />
                ))}
              </div>
            </div>
          )}

          {/* C) Cross-contact banner */}
          {hasCrossContact && (
            <div style={{ margin: '10px 14px 0' }}>
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 500 }}>
                  Cross-contact sensitive — trace amounts are a risk
                </span>
              </div>
            </div>
          )}

          {/* D) Try to avoid */}
          {tier2.length > 0 && (
            <div style={{
              backgroundColor: '#FFFDF5',
              borderBottom: '1px solid #FEF3C7',
              padding: 14,
              marginTop: 10,
            }}>
              <SectionHeader label="Try to avoid" color="#D97706" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tier2.map((d) => (
                  <Pill key={d.name} name={d.name} bg="#FEF3C7" color="#92400E" />
                ))}
              </div>
            </div>
          )}

          {/* E) Preference */}
          {tier3.length > 0 && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderBottom: '1px solid #E5E7EB',
              padding: 14,
            }}>
              <SectionHeader label="Preference" color="#16A34A" />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tier3.map((d) => (
                  <Pill key={d.name} name={d.name} bg="#DCFCE7" color="#166534" />
                ))}
              </div>
            </div>
          )}

          {/* F) Staff notes */}
          {notesItems.length > 0 && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #E5E7EB' }}>
              {notesItems.map((d) => (
                <div key={d.name} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#9CA3AF',
                    marginTop: 5,
                    flexShrink: 0,
                  }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{d.staffNote}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{d.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* G) Staff instruction bar */}
          {!isEmpty && (
            <div style={{
              backgroundColor: '#FAFAFA',
              borderTop: '1px solid #E5E7EB',
              padding: '10px 14px',
            }}>
              <p style={{ fontSize: 12, color: '#111827', fontWeight: 500, textAlign: 'center', margin: 0 }}>
                {tier1.length > 0
                  ? 'Do not serve if uncertain about any must-avoid item'
                  : 'Please accommodate preferences where possible.'}
              </p>
            </div>
          )}

        </div>

        {/* ── EDIT LINK ── */}
        <p style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 14 }}>
          Something wrong?{' '}
          <button
            onClick={() => router.push('/onboarding/severity')}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1A7A5E', fontWeight: 500, fontSize: 13 }}
          >
            Go back and edit →
          </button>
        </p>

        {/* ── CTA ── */}
        <button onClick={handleSave} className="btn-primary transition-opacity">
          Save my passport
        </button>

        {/* ── SAVE NOTE ── */}
        <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 10, marginBottom: 24 }}>
          You can update this anytime from your profile
        </p>

      </div>
    </div>
  )
}
