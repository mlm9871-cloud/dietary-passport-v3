'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Role } from '../types'

export function useAuthRedirect(isFirstTime = true) {
  const router = useRouter()

  useEffect(() => {
    const role = localStorage.getItem('selectedRole') as Role | null

    if (!role) {
      router.replace('/onboarding/role')
      return
    }

    if (role === 'Student') {
      router.replace(isFirstTime ? '/onboarding/allergens' : '/student/home')
    } else if (role === 'Dining Hall Staff') {
      router.replace('/staff/scan')
    } else if (role === 'Admin / Dietitian') {
      router.replace('/admin/dashboard')
    }
  }, [isFirstTime, router])
}
