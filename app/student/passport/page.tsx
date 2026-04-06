'use client'

import { useRoleGuard } from '../../../lib/useRoleGuard'

export default function StudentPassportPage() {
  useRoleGuard('Student')

  return (
    <div className="flex min-h-screen items-center justify-center bg-white flex-col gap-3">
      <span style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED', backgroundColor: '#EDE9FE', borderRadius: 99, padding: '3px 10px', letterSpacing: '0.04em' }}>
        Student
      </span>
      <p style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>/student/passport</p>
    </div>
  )
}
