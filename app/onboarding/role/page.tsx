'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Role } from '../../../types'

const roles: {
  id: Role
  label: string
  desc: string
  iconBg: string
  iconColor: string
  icon: React.ReactNode
}[] = [
  {
    id: 'Student',
    label: 'Student',
    desc: 'Create and share your dietary profile with dining staff',
    iconBg: '#E8F5F1',
    iconColor: '#1A7A5E',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="8" r="3.5" stroke="#1A7A5E" strokeWidth="1.6" />
        <path d="M4 19c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#1A7A5E" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'Dining Hall Staff',
    label: 'Dining hall staff',
    desc: 'Scan student profiles to view dietary restrictions',
    iconBg: '#EEF2FF',
    iconColor: '#4F46E5',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        {/* QR scan frame */}
        <path d="M4 8V5h3" stroke="#4F46E5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 8V5h-3" stroke="#4F46E5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 14v3h3" stroke="#4F46E5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 14v3h-3" stroke="#4F46E5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="7.5" y="7.5" width="3" height="3" rx="0.5" fill="#4F46E5" />
        <rect x="11.5" y="7.5" width="3" height="3" rx="0.5" fill="#4F46E5" />
        <rect x="7.5" y="11.5" width="3" height="3" rx="0.5" fill="#4F46E5" />
        <rect x="11.5" y="11.5" width="3" height="3" rx="0.5" fill="#4F46E5" />
      </svg>
    ),
  },
  {
    id: 'Admin / Dietitian',
    label: 'Admin / dietitian',
    desc: 'Oversee student profiles and dining accommodations',
    iconBg: '#FEF3C7',
    iconColor: '#D97706',
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        {/* Shield with check */}
        <path
          d="M11 3l7 3v5c0 4-3 6.5-7 8-4-1.5-7-4-7-8V6l7-3z"
          stroke="#D97706"
          strokeWidth="1.6"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M8 11l2 2 4-4" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

const roleLabels: Record<Role, string> = {
  'Student': 'student',
  'Dining Hall Staff': 'dining hall staff',
  'Admin / Dietitian': 'admin',
}

export default function RoleSelectionPage() {
  const [selected, setSelected] = useState<Role>('Student')
  const router = useRouter()

  function handleContinue() {
    localStorage.setItem('selectedRole', selected)
    if (selected === 'Dining Hall Staff') {
      router.push('/staff/home')
    } else {
      router.push('/onboarding/account-creation')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-10">
      <div className="w-full max-w-[430px] flex flex-col gap-8">

        {/* ── LOGO AREA ── */}
        <div className="flex flex-col items-center gap-3 text-center pt-2">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#1A7A5E' }}
          >
            <svg width="28" height="28" viewBox="0 0 38 38" fill="none">
              <rect x="8" y="5" width="22" height="28" rx="3" stroke="white" strokeWidth="2" fill="none" />
              <line x1="19" y1="5" x2="19" y2="33" stroke="white" strokeWidth="1.5" strokeDasharray="2 2" />
              <circle cx="19" cy="16" r="4.5" stroke="white" strokeWidth="1.75" fill="none" />
              <path d="M12 27c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeWidth="1.75" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="flex flex-col gap-0.5">
            <p style={{ fontSize: 20, fontWeight: 600, color: '#111827', letterSpacing: '-0.3px' }}>
              Dining Passport
            </p>
            <p style={{ fontSize: 13, color: '#6B7280' }}>
              Your dietary profile, always with you
            </p>
          </div>
        </div>

        {/* ── HEADING ── */}
        <div className="flex flex-col gap-1">
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.4px' }}>
            Who are you?
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280' }}>
            Select the role that best describes you.
          </p>
        </div>

        {/* ── ROLE CARDS ── */}
        <div className="flex flex-col gap-3">
          {roles.map((role) => {
            const isSelected = selected === role.id
            return (
              <button
                key={role.id}
                onClick={() => setSelected(role.id)}
                className="flex items-center gap-4 w-full text-left transition-colors"
                style={{
                  border: isSelected ? '1.5px solid #1A7A5E' : '1.5px solid #E5E7EB',
                  borderRadius: 14,
                  padding: 18,
                  backgroundColor: isSelected ? '#F0FAF7' : '#FFFFFF',
                }}
              >
                {/* Icon bubble */}
                <div
                  className="flex-shrink-0 flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: role.iconBg }}
                >
                  {role.icon}
                </div>

                {/* Text */}
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#111827' }}>
                    {role.label}
                  </p>
                  <p className="text-sm" style={{ color: '#6B7280', lineHeight: 1.45 }}>
                    {role.desc}
                  </p>
                </div>

                {/* Arrow */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  className="flex-shrink-0"
                >
                  <path
                    d="M6.75 4.5L11.25 9l-4.5 4.5"
                    stroke={isSelected ? '#1A7A5E' : '#D1D5DB'}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )
          })}
        </div>

        {/* ── CTA ── */}
        <div className="flex flex-col items-center gap-4 pb-2">
          <button onClick={handleContinue} className="btn-primary transition-opacity">
            Continue as {roleLabels[selected]}
          </button>

          <p style={{ fontSize: 13, color: '#6B7280' }}>
            Already have an account?{' '}
            <Link href="/auth/signin" style={{ color: '#1A7A5E', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
