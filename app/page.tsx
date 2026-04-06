'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function WelcomePage() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
      <div className="w-full max-w-[430px] flex flex-col gap-10">

        {/* ── HERO ── */}
        <div className="flex flex-col items-center gap-5 text-center">
          {/* Logo mark */}
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: '#1A7A5E' }}
          >
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Passport book */}
              <rect x="8" y="5" width="22" height="28" rx="3" stroke="white" strokeWidth="2" fill="none" />
              {/* Center line (spine) */}
              <line x1="19" y1="5" x2="19" y2="33" stroke="white" strokeWidth="1.5" strokeDasharray="2 2" />
              {/* Profile circle */}
              <circle cx="19" cy="16" r="4.5" stroke="white" strokeWidth="1.75" fill="none" />
              {/* Shoulders arc */}
              <path d="M12 27c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="white" strokeWidth="1.75" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              Dining Passport
            </h1>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.5 }}>
              Your dietary needs, always understood.
            </p>
          </div>
        </div>

        {/* ── ABOUT CARDS ── */}
        <div className="flex flex-col gap-3">
          {/* Card 1 — green */}
          <div
            className="flex items-center gap-3"
            style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#F0FAF7' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="3" stroke="#1A7A5E" strokeWidth="1.5" />
                <path d="M4 17c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="#1A7A5E" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>Build your profile once</p>
              <p className="text-sm" style={{ color: '#6B7280', lineHeight: 1.45 }}>
                Set your allergies, restrictions, and severity levels in minutes.
              </p>
            </div>
          </div>

          {/* Card 2 — blue */}
          <div
            className="flex items-center gap-3"
            style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#EFF6FF' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                {/* QR code outline */}
                <rect x="3" y="3" width="6" height="6" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
                <rect x="11" y="3" width="6" height="6" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
                <rect x="3" y="11" width="6" height="6" rx="1" stroke="#3B82F6" strokeWidth="1.5" />
                <rect x="4.5" y="4.5" width="3" height="3" rx="0.5" fill="#3B82F6" />
                <rect x="12.5" y="4.5" width="3" height="3" rx="0.5" fill="#3B82F6" />
                <rect x="4.5" y="12.5" width="3" height="3" rx="0.5" fill="#3B82F6" />
                <path d="M11 11h2v2h-2zM13 13h2v2h-2zM11 15h2v2h-2zM15 11h2v2h-2z" fill="#3B82F6" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>Show it anywhere</p>
              <p className="text-sm" style={{ color: '#6B7280', lineHeight: 1.45 }}>
                Share your dietary passport with dining staff instantly via QR code.
              </p>
            </div>
          </div>

          {/* Card 3 — amber */}
          <div
            className="flex items-center gap-3"
            style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: '14px 16px' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: '#FFFBEB' }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 2l2.09 4.24 4.68.68-3.38 3.3.8 4.65L10 12.77l-4.19 2.1.8-4.65L3.23 6.92l4.68-.68L10 2z"
                  stroke="#D97706"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path d="M7.5 10.5l1.5 1.5 3-3" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold" style={{ color: '#111827' }}>Get confirmation</p>
              <p className="text-sm" style={{ color: '#6B7280', lineHeight: 1.45 }}>
                Know your restrictions were seen before your food is prepared.
              </p>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => router.push('/onboarding/role')}
            className="btn-primary transition-opacity"
          >
            Get started
          </button>

          <p style={{ fontSize: 13, color: '#6B7280' }}>
            Already have an account?{' '}
            <Link href="/auth/signin" style={{ color: '#1A7A5E', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>

          <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            Used by students at NYU and partner institutions
          </p>
        </div>

      </div>
    </div>
  )
}
