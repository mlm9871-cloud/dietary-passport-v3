'use client'

import { useRoleGuard } from '../../../lib/useRoleGuard'

export default function StaffScanPage() {
  useRoleGuard('Dining Hall Staff')

  return (
    <div className="flex min-h-screen items-center justify-center bg-white flex-col gap-3">
      <span style={{ fontSize: 11, fontWeight: 600, color: '#EA580C', backgroundColor: '#FFF7ED', borderRadius: 99, padding: '3px 10px', letterSpacing: '0.04em' }}>
        Dining Hall Staff
      </span>
      <p style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>/staff/scan</p>
    </div>
  )
}
