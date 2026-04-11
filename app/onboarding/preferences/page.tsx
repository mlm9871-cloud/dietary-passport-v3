'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoleGuard } from '../../../lib/useRoleGuard'

function pruneRestrictionDetails(keepNames: string[]) {
  const stored = localStorage.getItem('restrictionDetails')
  if (!stored) return
  const details: { name: string }[] = JSON.parse(stored)
  localStorage.setItem('restrictionDetails', JSON.stringify(details.filter((d) => keepNames.includes(d.name))))
}

const LIFESTYLE = [
  { name: 'Vegan',                    emoji: '🌿', desc: 'No meat, fish, dairy, eggs, or honey' },
  { name: 'Vegetarian',               emoji: '🥗', desc: 'No meat or fish — dairy and eggs are fine' },
  { name: 'Keto / low-carb',          emoji: '🥑', desc: 'Avoiding bread, sugar, pasta, and starchy sides' },
  { name: 'Gluten-free (preference)', emoji: '🌾', desc: 'Not medical — I prefer to avoid gluten when possible' },
]

const RELIGIOUS = [
  { name: 'Halal',  emoji: '☪️', desc: 'Requires halal-certified preparation' },
  { name: 'Kosher', emoji: '✡️', desc: 'Requires kosher-certified preparation' },
]

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div style={{
      width: 20,
      height: 20,
      borderRadius: '50%',
      border: checked ? 'none' : '1.5px solid #E5E7EB',
      backgroundColor: checked ? '#1A7A5E' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {checked && (
        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
          <path d="M1 4.5l3 3L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function PreferenceRow({
  name,
  desc,
  selected,
  onToggle,
}: {
  name: string
  desc: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 w-full text-left transition-colors"
      style={{
        border: selected ? '1.5px solid #1A7A5E' : '1.5px solid #E5E7EB',
        borderRadius: 12,
        padding: '14px 16px',
        backgroundColor: selected ? '#F0FAF7' : '#FFFFFF',
        cursor: 'pointer',
      }}
    >
      <div className="flex flex-col flex-1 min-w-0" style={{ gap: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{name}</span>
        <span style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.45 }}>{desc}</span>
      </div>

      <Checkbox checked={selected} />
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11,
      color: '#9CA3AF',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      fontWeight: 500,
      marginTop: 16,
      marginBottom: 8,
    }}>
      {children}
    </p>
  )
}

export default function PreferencesPage() {
  useRoleGuard('Student')
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>([])
  const [otherSelected, setOtherSelected] = useState(false)
  const [otherText, setOtherText] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('selectedPreferences')
    if (!stored) return
    const parsed: string[] = JSON.parse(stored)
    const known = [...LIFESTYLE, ...RELIGIOUS].map((p) => p.name)
    const knownSelected = parsed.filter((p) => known.includes(p))
    const other = parsed.find((p) => !known.includes(p))
    setSelected(knownSelected)
    if (other) {
      setOtherSelected(true)
      setOtherText(other)
    }
  }, [])

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const totalSelected = selected.length + (otherSelected ? 1 : 0)

  function buildArray() {
    const arr = [...selected]
    if (otherSelected && otherText.trim()) arr.push(otherText.trim())
    return arr
  }

  function handleSkip() {
    setSelected([])
    setOtherSelected(false)
    setOtherText('')
    localStorage.setItem('selectedPreferences', JSON.stringify([]))
    const allergens: string[] = JSON.parse(localStorage.getItem('selectedAllergens') ?? '[]')
    pruneRestrictionDetails(allergens)
    router.push('/onboarding/severity')
  }

  function handleContinue() {
    const prefs = buildArray()
    localStorage.setItem('selectedPreferences', JSON.stringify(prefs))
    const allergens: string[] = JSON.parse(localStorage.getItem('selectedAllergens') ?? '[]')
    pruneRestrictionDetails([...allergens, ...prefs])
    router.push('/onboarding/severity')
  }

  return (
    <div className="flex min-h-screen justify-center bg-white px-5 py-8">
      <div className="w-full max-w-[430px] flex flex-col">

        {/* ── BACK ── */}
        <button
          onClick={() => router.push('/onboarding/allergens')}
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
              Step 2 of 3
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
              Preferences
            </span>
          </div>
          <div style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 99 }}>
            <div style={{ height: 4, width: '66%', backgroundColor: '#1A7A5E', borderRadius: 99 }} />
          </div>
        </div>

        {/* ── HEADING ── */}
        <div className="flex flex-col gap-1.5" style={{ marginBottom: 8 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.3 }}>
            Any dietary preferences?
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55 }}>
            Select any that apply. These help dining staff understand your needs beyond allergies.
          </p>
        </div>

        {/* ── LIFESTYLE ── */}
        <SectionLabel>Lifestyle</SectionLabel>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {LIFESTYLE.map((p) => (
            <PreferenceRow
              key={p.name}
              name={p.name}
              desc={p.desc}
              selected={selected.includes(p.name)}
              onToggle={() => toggle(p.name)}
            />
          ))}
        </div>

        {/* ── RELIGIOUS / CULTURAL ── */}
        <SectionLabel>Religious / cultural</SectionLabel>
        <div className="flex flex-col" style={{ gap: 8 }}>
          {RELIGIOUS.map((p) => (
            <PreferenceRow
              key={p.name}
              name={p.name}
              desc={p.desc}
              selected={selected.includes(p.name)}
              onToggle={() => toggle(p.name)}
            />
          ))}
        </div>

        {/* ── OTHER PREFERENCE ROW ── */}
        <div className="flex flex-col" style={{ gap: 8, marginTop: 8 }}>
          <button
            onClick={() => setOtherSelected((v) => !v)}
            className="flex items-center gap-3 w-full text-left transition-colors"
            style={{
              border: otherSelected ? '1.5px solid #1A7A5E' : '1.5px solid #E5E7EB',
              borderRadius: 12,
              padding: '14px 16px',
              backgroundColor: otherSelected ? '#F0FAF7' : '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#F8FAFB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 4v10M4 9h10" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col flex-1 min-w-0" style={{ gap: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>Other preference</span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Add a dietary need not listed above</span>
            </div>
            <Checkbox checked={otherSelected} />
          </button>

          {otherSelected && (
            <input
              type="text"
              placeholder="e.g. Hindu vegetarian, Jain, Low FODMAP"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              autoFocus
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                color: '#111827',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* ── SELECTED COUNT ── */}
        <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
          {totalSelected > 0 && (
            <p style={{ fontSize: 13, color: '#1A7A5E', fontWeight: 500 }}>
              {totalSelected} preference{totalSelected !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>

        {/* ── SKIP + CTA ── */}
        <div className="flex flex-col items-center gap-3" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 2 }}>
            None of these apply.{' '}
            <button
              onClick={handleSkip}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1A7A5E', fontWeight: 500, fontSize: 13 }}
            >
              Skip this step →
            </button>
          </p>

          <button onClick={handleContinue} className="btn-primary transition-opacity">
            Continue to severity
          </button>
        </div>

      </div>
    </div>
  )
}
