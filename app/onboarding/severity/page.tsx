'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoleGuard } from '../../../lib/useRoleGuard'
import type { Tier } from '../../../types'

const EMOJI_MAP: Record<string, string> = {
  'Peanuts':                 '🥜',
  'Tree nuts':               '🌰',
  'Shellfish':               '🦐',
  'Fish':                    '🐟',
  'Milk / dairy':            '🥛',
  'Eggs':                    '🥚',
  'Wheat / gluten':          '🌾',
  'Soy':                     '🫘',
  'Sesame':                  '🌱',
  'Vegan':                   '🌿',
  'Vegetarian':              '🥗',
  'Keto / low-carb':         '🥑',
  'Gluten-free (preference)':'🌾',
  'Halal':                   '☪️',
  'Kosher':                  '✡️',
}

type Category = 'allergen' | 'preference'

type RestrictionDetail = {
  name: string
  emoji: string
  category: Category
  tier: Tier | null
  crossContact: boolean
  staffNote: string
}

const TIERS: {
  tier: Tier
  label: string
  consequence: string
  dot: string
  selectedBorder: string
  selectedBg: string
  selectedText: string
}[] = [
  {
    tier: 1,
    label: 'Must avoid — safety critical',
    consequence: 'Even a small amount could cause a serious reaction. Staff must not serve if uncertain.',
    dot: '#DC2626',
    selectedBorder: '#DC2626',
    selectedBg: '#FEF2F2',
    selectedText: '#DC2626',
  },
  {
    tier: 2,
    label: 'Try to avoid — causes discomfort',
    consequence: 'I feel unwell if I eat this. Please avoid where possible.',
    dot: '#D97706',
    selectedBorder: '#D97706',
    selectedBg: '#FFFBEB',
    selectedText: '#D97706',
  },
  {
    tier: 3,
    label: 'Preference — best effort',
    consequence: 'I prefer not to eat this but it\'s not a health issue.',
    dot: '#16A34A',
    selectedBorder: '#16A34A',
    selectedBg: '#F0FDF4',
    selectedText: '#16A34A',
  },
]

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      style={{
        width: 36,
        height: 20,
        borderRadius: 99,
        backgroundColor: on ? '#DC2626' : '#E5E7EB',
        position: 'relative',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        transition: 'background-color 0.15s',
      }}
    >
      <div style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        backgroundColor: 'white',
        position: 'absolute',
        top: 2,
        left: 2,
        transform: on ? 'translateX(16px)' : 'translateX(0)',
        transition: 'transform 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }} />
    </button>
  )
}

function RestrictionCard({
  detail,
  onChange,
}: {
  detail: RestrictionDetail
  onChange: (updated: Partial<RestrictionDetail>) => void
}) {
  return (
    <div style={{
      border: '1px solid #E5E7EB',
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {/* Card header */}
      <div style={{
        backgroundColor: '#F8FAFB',
        borderBottom: '1px solid #E5E7EB',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{detail.emoji}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{detail.name}</span>
      </div>

      {/* Card body */}
      <div style={{ padding: 14 }}>

        {/* Tier label */}
        <p style={{
          fontSize: 11,
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          fontWeight: 500,
          marginBottom: 8,
        }}>
          How serious is this?
        </p>

        {/* Tier options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TIERS.map((t) => {
            const isSelected = detail.tier === t.tier
            return (
              <button
                key={t.tier}
                onClick={() => onChange({ tier: t.tier })}
                style={{
                  border: isSelected ? `1.5px solid ${t.selectedBorder}` : '1.5px solid #E5E7EB',
                  borderRadius: 10,
                  padding: '10px 12px',
                  backgroundColor: isSelected ? t.selectedBg : '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: t.dot,
                  flexShrink: 0,
                  marginTop: 3,
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: isSelected ? t.selectedText : '#111827',
                    lineHeight: 1.3,
                  }}>
                    {t.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.45 }}>
                    {t.consequence}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Cross-contact toggle */}
        <button
          onClick={() => onChange({ crossContact: !detail.crossContact })}
          style={{
            marginTop: 12,
            border: detail.crossContact ? '1px solid #DC2626' : '1px solid #E5E7EB',
            borderRadius: 10,
            padding: '10px 12px',
            backgroundColor: detail.crossContact ? '#FEF2F2' : '#FFFFFF',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            width: '100%',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
              Cross-contact sensitive
            </span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>
              Trace amounts or shared equipment are a risk
            </span>
          </div>
          <Toggle on={detail.crossContact} onToggle={() => onChange({ crossContact: !detail.crossContact })} />
        </button>

        {/* Staff note */}
        <p style={{
          fontSize: 11,
          color: '#6B7280',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          fontWeight: 500,
          marginTop: 12,
          marginBottom: 6,
        }}>
          Note for staff (optional)
        </p>
        <textarea
          rows={2}
          placeholder="e.g. I carry an EpiPen. Please change gloves before handling my food."
          value={detail.staffNote}
          onChange={(e) => onChange({ staffNote: e.target.value })}
          style={{
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            color: '#111827',
            outline: 'none',
            width: '100%',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            boxSizing: 'border-box',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#1A7A5E' }}
          onBlur={(e) => { e.target.style.borderColor = '#E5E7EB' }}
        />
      </div>
    </div>
  )
}

function buildDetail(name: string, category: Category, saved: RestrictionDetail | undefined): RestrictionDetail {
  if (saved) return { ...saved, name, emoji: EMOJI_MAP[name] ?? '🍽️', category }
  return { name, emoji: EMOJI_MAP[name] ?? '🍽️', category, tier: null, crossContact: false, staffNote: '' }
}

export default function SeverityPage() {
  useRoleGuard('Student')
  const router = useRouter()

  const [details, setDetails] = useState<RestrictionDetail[]>([])

  useEffect(() => {
    const allergens: string[] = JSON.parse(localStorage.getItem('selectedAllergens') ?? '[]')
    const preferences: string[] = JSON.parse(localStorage.getItem('selectedPreferences') ?? '[]')
    const savedRaw = localStorage.getItem('restrictionDetails')
    const saved: RestrictionDetail[] = savedRaw ? JSON.parse(savedRaw) : []
    const savedMap = new Map(saved.map((d) => [d.name, d]))
    setDetails([
      ...allergens.map((name) => buildDetail(name, 'allergen', savedMap.get(name))),
      ...preferences.map((name) => buildDetail(name, 'preference', savedMap.get(name))),
    ])
  }, [])

  function updateDetail(index: number, patch: Partial<RestrictionDetail>) {
    setDetails((prev) => prev.map((d, i) => i === index ? { ...d, ...patch } : d))
  }

  const allConfigured = details.length === 0 || details.every((d) => d.tier !== null)

  function handleContinue() {
    if (!allConfigured) return
    localStorage.setItem('restrictionDetails', JSON.stringify(details))
    router.push('/onboarding/preview')
  }

  return (
    <div className="flex min-h-screen justify-center bg-white px-5 py-8">
      <div className="w-full max-w-[430px] flex flex-col">

        {/* ── BACK ── */}
        <button
          onClick={() => router.push('/onboarding/preferences')}
          className="flex items-center gap-1.5 w-fit"
          style={{ background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', marginBottom: 20 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11.25 13.5L6.75 9l4.5-4.5" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 14, color: '#6B7280' }}>Back</span>
        </button>

        {/* ── PROGRESS ── */}
        <div className="flex flex-col gap-2" style={{ marginBottom: 24 }}>
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
              Step 3 of 3
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
              Severity
            </span>
          </div>
          <div style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 99 }}>
            <div style={{ height: 4, width: '100%', backgroundColor: '#1A7A5E', borderRadius: 99 }} />
          </div>
        </div>

        {/* ── HEADING ── */}
        <div className="flex flex-col gap-1.5" style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.3 }}>
            How serious are your restrictions?
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55 }}>
            This tells dining staff exactly how to handle each one. Be as accurate as you can.
          </p>
        </div>

        {/* ── EMPTY STATE ── */}
        {details.length === 0 && (
          <div style={{
            border: '1px solid #E5E7EB',
            borderRadius: 14,
            padding: '32px 20px',
            textAlign: 'center',
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 14, color: '#6B7280' }}>
              No restrictions selected.{' '}
              <button
                onClick={() => router.push('/onboarding/allergens')}
                style={{ background: 'none', border: 'none', padding: 0, color: '#1A7A5E', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
              >
                Go back to add some.
              </button>
            </p>
          </div>
        )}

        {/* ── RESTRICTION CARDS ── */}
        {details.map((detail, i) => (
          <RestrictionCard
            key={detail.name}
            detail={detail}
            onChange={(patch) => updateDetail(i, patch)}
          />
        ))}

        {/* ── REASSURANCE ── */}
        <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 4, marginBottom: 20 }}>
          You can edit any of this later from your profile.
        </p>

        {/* ── CTA ── */}
        <div style={{ marginBottom: 32 }}>
          {!allConfigured && (
            <p style={{ fontSize: 13, color: '#D97706', textAlign: 'center', marginBottom: 10 }}>
              Please set a severity level for each restriction above.
            </p>
          )}
          <button
            onClick={handleContinue}
            disabled={!allConfigured}
            className="btn-primary transition-opacity"
            style={!allConfigured ? { backgroundColor: '#D1D5DB', cursor: 'default' } : {}}
          >
            Preview my passport →
          </button>
        </div>

      </div>
    </div>
  )
}
