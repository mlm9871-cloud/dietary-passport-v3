'use client'

import { useRoleGuard } from '../../../lib/useRoleGuard'

export default function AdminDashboardPage() {
  useRoleGuard('Admin / Dietitian')

  return (
    <div className="flex min-h-screen items-center justify-center bg-white flex-col gap-3">
      <span style={{ fontSize: 11, fontWeight: 600, color: '#1A7A5E', backgroundColor: '#F0FAF7', borderRadius: 99, padding: '3px 10px', letterSpacing: '0.04em' }}>
        Admin / Dietitian
      </span>
      <p style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>/admin/dashboard</p>
    </div>
  )
}
