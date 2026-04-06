'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoleGuard } from '../../../lib/useRoleGuard'

const KNOWN_NAMES = ['Peanuts', 'Tree nuts', 'Shellfish', 'Fish', 'Milk / dairy', 'Eggs', 'Wheat / gluten', 'Soy', 'Sesame']

function pruneRestrictionDetails(keepNames: string[]) {
  const stored = localStorage.getItem('restrictionDetails')
  if (!stored) return
  const details: { name: string }[] = JSON.parse(stored)
  localStorage.setItem('restrictionDetails', JSON.stringify(details.filter((d) => keepNames.includes(d.name))))
}

const ALLERGENS = [
  { name: 'Peanuts',        emoji: '🥜' },
  { name: 'Tree nuts',      emoji: '🌰' },
  { name: 'Shellfish',      emoji: '🦐' },
  { name: 'Fish',           emoji: '🐟' },
  { name: 'Milk / dairy',   emoji: '🥛' },
  { name: 'Eggs',           emoji: '🥚' },
  { name: 'Wheat / gluten', emoji: '🌾' },
  { name: 'Soy',            emoji: '🫘' },
  { name: 'Sesame',         emoji: '🌱' },
]

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: checked ? 'none' : '1.5px solid #E5E7EB',
        backgroundColor: checked ? '#1A7A5E' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

export default function AllergensPage() {
  useRoleGuard('Student')
  const router = useRouter()

  const [selected, setSelected] = useState<string[]>([])
  const [otherSelected, setOtherSelected] = useState(false)
  const [otherText, setOtherText] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('selectedAllergens')
    if (stored === null) return
    const parsed: string[] = JSON.parse(stored)
    setSelected(parsed.filter((n) => KNOWN_NAMES.includes(n)))
    const other = parsed.find((n) => !KNOWN_NAMES.includes(n))
    if (other) { setOtherSelected(true); setOtherText(other) }
  }, [])

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const totalSelected = selected.length + (otherSelected ? 1 : 0)

  function handleSkip() {
    setSelected([])
    setOtherSelected(false)
    setOtherText('')
    localStorage.setItem('selectedAllergens', JSON.stringify([]))
    const prefs: string[] = JSON.parse(localStorage.getItem('selectedPreferences') ?? '[]')
    pruneRestrictionDetails(prefs)
    router.push('/onboarding/preferences')
  }

  function handleContinue() {
    if (totalSelected === 0) return
    const allergens = [...selected]
    if (otherSelected && otherText.trim()) allergens.push(otherText.trim())
    localStorage.setItem('selectedAllergens', JSON.stringify(allergens))
    const prefs: string[] = JSON.parse(localStorage.getItem('selectedPreferences') ?? '[]')
    pruneRestrictionDetails([...allergens, ...prefs])
    router.push('/onboarding/preferences')
  }

  return (
    <div className="flex min-h-screen justify-center bg-white px-5 py-8">
      <div className="w-full max-w-[430px] flex flex-col gap-6">

        {/* ── BACK ── */}
        <button
          onClick={() => router.push('/onboarding/account-creation')}
          className="flex items-center gap-1.5 w-fit"
          style={{ background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11.25 13.5L6.75 9l4.5-4.5" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 14, color: '#6B7280' }}>Back</span>
        </button>

        {/* ── PROGRESS ── */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
              Step 1 of 3
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
              Allergens
            </span>
          </div>
          <div style={{ height: 4, backgroundColor: '#E5E7EB', borderRadius: 99 }}>
            <div style={{ height: 4, width: '33%', backgroundColor: '#1A7A5E', borderRadius: 99 }} />
          </div>
        </div>

        {/* ── HEADING ── */}
        <div className="flex flex-col gap-1.5">
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.3 }}>
            Do you have any food allergies?
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55 }}>
            Select all that apply. You'll set severity for each one next.
          </p>
        </div>

        {/* ── ALLERGEN GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {ALLERGENS.map((allergen) => {
            const isSelected = selected.includes(allergen.name)
            return (
              <button
                key={allergen.name}
                onClick={() => toggle(allergen.name)}
                className="flex flex-col items-center text-left w-full transition-colors"
                style={{
                  border: isSelected ? '1.5px solid #1A7A5E' : '1.5px solid #E5E7EB',
                  borderRadius: 12,
                  padding: '14px 12px',
                  backgroundColor: isSelected ? '#F0FAF7' : '#FFFFFF',
                  gap: 8,
                  cursor: 'pointer',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: isSelected ? '#E8F5F1' : '#F8FAFB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                }}>
                  {allergen.emoji}
                </div>

                {/* Name */}
                <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', textAlign: 'center', lineHeight: 1.3 }}>
                  {allergen.name}
                </span>

                {/* Checkbox */}
                <Checkbox checked={isSelected} />
              </button>
            )
          })}
        </div>

        {/* ── OTHER ALLERGEN ROW ── */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setOtherSelected((v) => !v)}
            className="flex items-center gap-3 w-full text-left transition-colors"
            style={{
              border: otherSelected ? '1.5px solid #1A7A5E' : '1.5px solid #E5E7EB',
              borderRadius: 12,
              padding: 14,
              backgroundColor: otherSelected ? '#F0FAF7' : '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            {/* + icon */}
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

            {/* Text */}
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>Other allergen</span>
              <span style={{ fontSize: 11, color: '#6B7280' }}>Add something not listed above</span>
            </div>

            <Checkbox checked={otherSelected} />
          </button>

          {otherSelected && (
            <input
              type="text"
              placeholder="e.g. Lupin, mustard, sulfites"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
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
              autoFocus
            />
          )}
        </div>

        {/* ── SELECTED COUNT ── */}
        {totalSelected > 0 && (
          <p style={{ fontSize: 13, color: '#1A7A5E', fontWeight: 500, textAlign: 'center' }}>
            {totalSelected} allergen{totalSelected !== 1 ? 's' : ''} selected
          </p>
        )}

        {/* ── SKIP + CTA ── */}
        <div className="flex flex-col items-center gap-3 pb-4">
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 2 }}>
            No allergies?{' '}
            <button
              onClick={handleSkip}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#1A7A5E', fontWeight: 500, fontSize: 13 }}
            >
              Skip this step →
            </button>
          </p>

          <button
            onClick={handleContinue}
            disabled={totalSelected === 0}
            className="btn-primary transition-opacity"
            style={totalSelected === 0 ? { backgroundColor: '#D1D5DB', cursor: 'default' } : {}}
          >
            Continue to preferences
          </button>
        </div>

      </div>
    </div>
  )
}
