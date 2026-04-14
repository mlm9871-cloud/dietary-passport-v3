export type UUID = string

export type Role = 'Student' | 'Dining Hall Staff' | 'Admin / Dietitian'

export type DBRole = 'student' | 'staff' | 'hall_manager' | 'admin' | 'super_admin'

export type Tier = 1 | 2 | 3

export type TierLabel = 'must_avoid' | 'try_to_avoid' | 'preference'

export interface Organization {
  id: UUID
  name: string
  created_at?: string
}

export interface User {
  id: UUID
  email: string
  full_name?: string
  role?: DBRole
  organization_id?: UUID | null
  created_at?: string
}

export interface DietaryProfile {
  id: UUID
  user_id: UUID
  display_name?: string
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export interface Restriction {
  id: UUID
  name: string
  tier?: Tier
  created_at?: string
}

export interface StaffSession {
  organizationId: string
  organizationName: string
  diningHallId: string
  diningHallName: string
  stationId: string | null
  stationName: string
  startedAt: string
  dbSessionId?: string | null
}

export interface QRToken {
  id: UUID
  dietary_profile_id: UUID
  token: string
  expires_at?: string | null
  created_at?: string
}
