'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '../types'

const roleHomeMap: Record<Role, string> = {
  'Student': '/student/home',
  'Dining Hall Staff': '/staff/scan',
  'Admin / Dietitian': '/admin/dashboard',
}

export function useRoleGuard(requiredRole: Role): Role | null {
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('selectedRole') as Role | null

    if (!stored) {
      router.replace('/onboarding/role')
      return
    }

    if (stored !== requiredRole) {
      router.replace(roleHomeMap[stored] ?? '/onboarding/role')
      return
    }

    setRole(stored)
  }, [requiredRole, router])

  return role
}
