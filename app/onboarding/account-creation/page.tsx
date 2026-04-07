'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'

const inputStyle: React.CSSProperties = {
  border: '1px solid #E5E7EB',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  width: '100%',
  color: '#111827',
  backgroundColor: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({
  label,
  helper,
  children,
}: {
  label: string
  helper?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{label}</label>
      {children}
      {helper && (
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>{helper}</p>
      )}
    </div>
  )
}

export default function AccountCreationPage() {
  const router = useRouter()
  const [role, setRole] = useState<string>('student')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    institution: '',
  })
  const [focused, setFocused] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const stored = localStorage.getItem('selectedRole')
    if (stored) setRole(stored)
  }, [])

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  function touch(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function focusStyle(name: string): React.CSSProperties {
    return focused === name
      ? { ...inputStyle, borderColor: '#1A7A5E', boxShadow: '0 0 0 3px rgba(26,122,94,0.1)' }
      : inputStyle
  }

  const errors = {
    name: !form.name.trim() ? 'Please enter your full name' : '',
    email: !form.email.trim() || !form.email.includes('@') ? 'Please enter a valid email address' : '',
    password: form.password.length < 8 ? 'Password must be at least 8 characters' : '',
    confirmPassword: form.confirmPassword !== form.password ? 'Passwords do not match' : '',
  }

  const isValid = Object.values(errors).every((e) => e === '')

  function handleContinue() {
    if (!isValid) return

    // Keep existing localStorage behavior regardless of Supabase outcome
    localStorage.setItem('userName', form.name.trim())
    localStorage.setItem('userEmail', form.email.trim())
    localStorage.setItem('userUniversity', form.institution.trim())

    // Attempt Supabase sign-up, lookup organization, and insert user (non-blocking)
    ;(async () => {
      try {
        const { data, error } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password })
        if (error) {
          console.error('Supabase signUp error:', error)
        } else if (data?.user?.id) {
          const supabaseId = data.user.id
          try {
            // Organization lookup: first try case-insensitive name match
            let matchedOrgId: string | null = null
            let matchedOrgName: string = form.institution.trim()

            try {
              const { data: orgByName, error: orgNameError } = await supabase
                .from('organizations')
                .select('id,name')
                .ilike('name', form.institution.trim())
                .limit(1)
              if (orgNameError) {
                console.error('Supabase org name lookup error:', orgNameError)
              }
              if (orgByName && orgByName.length > 0) {
                matchedOrgId = orgByName[0].id
                matchedOrgName = orgByName[0].name
              }
            } catch (err) {
              console.error('Unexpected error during org name lookup:', err)
            }

            // If no name match, try domain extracted from email
            if (!matchedOrgId) {
              try {
                const domain = (form.email || '').split('@')[1]?.toLowerCase() ?? ''
                if (domain) {
                  const { data: orgByDomain, error: orgDomainError } = await supabase
                    .from('organizations')
                    .select('id,name')
                    .eq('domain', domain)
                    .limit(1)
                  if (orgDomainError) {
                    console.error('Supabase org domain lookup error:', orgDomainError)
                  }
                  if (orgByDomain && orgByDomain.length > 0) {
                    matchedOrgId = orgByDomain[0].id
                    matchedOrgName = orgByDomain[0].name
                  }
                }
              } catch (err) {
                console.error('Unexpected error during org domain lookup:', err)
              }
            }

            // Insert user with matched organization_id if found
            try {
              await supabase.from('users').insert([{ id: supabaseId, email: form.email.trim(), full_name: form.name.trim(), organization_id: matchedOrgId }])
            } catch (err) {
              console.error('Supabase insert users error:', err)
            }

            // Persist supabase user id and matched organization info to localStorage
            try {
              localStorage.setItem('supabaseUserId', supabaseId)
              if (matchedOrgId) localStorage.setItem('userOrganizationId', matchedOrgId)
              // Always save a displayed organization name (fallback to form.institution)
              localStorage.setItem('userOrganizationName', matchedOrgName || form.institution.trim())
            } catch (err) {
              console.error('Error writing organization info to localStorage:', err)
            }
          } catch (err) {
            console.error('Error during organization lookup/insert flow:', err)
          }
        }
      } catch (err) {
        console.error('Supabase signUp unexpected error:', err)
      }
    })()

    const savedRole = localStorage.getItem('selectedRole')
    if (savedRole === 'Dining Hall Staff') {
      router.push('/staff/home')
    } else if (savedRole === 'Admin / Dietitian') {
      router.push('/admin/dashboard')
    } else {
      router.push('/onboarding/allergens')
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-white px-6 py-10">
      <div className="w-full max-w-[430px] flex flex-col gap-7">

        {/* ── BACK BUTTON ── */}
        <button
          onClick={() => router.push('/onboarding/role')}
          className="flex items-center gap-1.5 w-fit"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11.25 13.5L6.75 9l4.5-4.5" stroke="#6B7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 14, color: '#6B7280' }}>Back</span>
        </button>

        {/* ── HEADER ── */}
        <div className="flex flex-col gap-2">
          <p style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
            Step 1 of 2
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.25 }}>
            Create your account
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.55 }}>
            You'll use this to access your Dining Passport from any device.
          </p>
        </div>

        {/* ── FORM ── */}
        <div className="flex flex-col gap-4">

          <Field label="Full name">
            <input
              type="text"
              placeholder="Your full name"
              value={form.name}
              onChange={set('name')}
              onFocus={() => setFocused('name')}
              onBlur={() => { setFocused(null); touch('name') }}
              style={focusStyle('name')}
            />
            {touched.name && errors.name && (
              <p style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{errors.name}</p>
            )}
          </Field>

          <Field label="Email address">
            <input
              type="email"
              placeholder="you@university.edu"
              value={form.email}
              onChange={set('email')}
              onFocus={() => setFocused('email')}
              onBlur={() => { setFocused(null); touch('email') }}
              style={focusStyle('email')}
            />
            {touched.email && errors.email && (
              <p style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{errors.email}</p>
            )}
          </Field>

          <Field label="Password" helper="Minimum 8 characters">
            <input
              type="password"
              placeholder="Create a password"
              value={form.password}
              onChange={set('password')}
              onFocus={() => setFocused('password')}
              onBlur={() => { setFocused(null); touch('password') }}
              style={focusStyle('password')}
            />
            {touched.password && errors.password && (
              <p style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{errors.password}</p>
            )}
          </Field>

          <Field label="Confirm password">
            <input
              type="password"
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              onFocus={() => setFocused('confirmPassword')}
              onBlur={() => { setFocused(null); touch('confirmPassword') }}
              style={focusStyle('confirmPassword')}
            />
            {touched.confirmPassword && errors.confirmPassword && (
              <p style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{errors.confirmPassword}</p>
            )}
          </Field>

          <Field
            label="University or institution"
            helper="This connects your profile to your dining program."
          >
            <input
              type="text"
              placeholder="e.g. New York University"
              value={form.institution}
              onChange={set('institution')}
              onFocus={() => setFocused('institution')}
              onBlur={() => setFocused(null)}
              style={focusStyle('institution')}
            />
          </Field>

        </div>

        {/* ── CTA ── */}
        <div className="flex flex-col items-center gap-3 pb-4">
          <button
            onClick={handleContinue}
            disabled={!isValid}
            className="btn-primary transition-opacity"
            style={!isValid ? { backgroundColor: '#D1D5DB', cursor: 'default' } : {}}
          >
            Create account
          </button>

          <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: '#1A7A5E' }}>Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" style={{ color: '#1A7A5E' }}>Privacy Policy</Link>
          </p>
        </div>

      </div>
    </div>
  )
}
