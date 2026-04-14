'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import type { StaffSession } from '../../../types/index'

type Org = { id: string; name: string }
type DiningHall = { id: string; name: string }
type Station = { id: string; name: string }

export default function StaffSetupPage() {
  const router = useRouter()

  const [orgs, setOrgs] = useState<Org[]>([])
  const [diningHalls, setDiningHalls] = useState<DiningHall[]>([])
  const [stations, setStations] = useState<Station[]>([])

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [selectedOrgName, setSelectedOrgName] = useState<string>('')
  const [selectedDiningHallId, setSelectedDiningHallId] = useState<string | null>(null)
  const [selectedDiningHallName, setSelectedDiningHallName] = useState<string>('')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [selectedStationName, setSelectedStationName] = useState<string>('')

  const [orgsError, setOrgsError] = useState(false)
  const [diningError, setDiningError] = useState(false)
  const [stationsError, setStationsError] = useState(false)

  // On mount: check for existing session and load orgs
  useEffect(() => {
    // Redirect if session already active
    try {
      const raw = localStorage.getItem('staffSession')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.organizationId && parsed.diningHallId && parsed.startedAt) {
          router.push('/staff/home')
          return
        }
      }
    } catch {
      // ignore parse errors
    }

    // Load orgs
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id,name')
          .order('name', { ascending: true })
        if (error) {
          console.error('Error fetching organizations:', error)
          setOrgsError(true)
        } else if (data) {
          setOrgs(data as Org[])
          // Pre-select last org if remembered
          try {
            const lastOrgId = localStorage.getItem('lastStaffOrg')
            if (lastOrgId) {
              const match = (data as Org[]).find((o) => o.id === lastOrgId)
              if (match) {
                setSelectedOrgId(match.id)
                setSelectedOrgName(match.name)
              }
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        console.error('Unexpected error fetching organizations:', err)
        setOrgsError(true)
      }
    })()
  }, [router])

  // Fetch dining halls when org changes
  useEffect(() => {
    setDiningHalls([])
    setSelectedDiningHallId(null)
    setSelectedDiningHallName('')
    setStations([])
    setSelectedStationId(null)
    setSelectedStationName('')
    if (!selectedOrgId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('dining_halls')
          .select('id,name')
          .eq('organization_id', selectedOrgId)
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (error) {
          console.error('Error fetching dining halls:', error)
          setDiningError(true)
        } else if (data) {
          setDiningHalls(data as DiningHall[])
        }
      } catch (err) {
        console.error('Unexpected error fetching dining halls:', err)
        setDiningError(true)
      }
    })()
  }, [selectedOrgId])

  // Fetch stations when dining hall changes
  useEffect(() => {
    setStations([])
    setSelectedStationId(null)
    setSelectedStationName('')
    if (!selectedDiningHallId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('stations')
          .select('id,name')
          .eq('dining_hall_id', selectedDiningHallId)
          .eq('is_active', true)
          .order('name', { ascending: true })
        if (error) {
          console.error('Error fetching stations:', error)
          setStationsError(true)
        } else if (data) {
          setStations(data as Station[])
        }
      } catch (err) {
        console.error('Unexpected error fetching stations:', err)
        setStationsError(true)
      }
    })()
  }, [selectedDiningHallId])

  const canStart = !!(selectedOrgId && selectedDiningHallId)

  function handleOrgChange(id: string) {
    setSelectedOrgId(id || null)
    const match = orgs.find((o) => o.id === id)
    setSelectedOrgName(match?.name || '')
    if (id) {
      try {
        localStorage.setItem('lastStaffOrg', id)
      } catch {
        // ignore
      }
    }
  }

  function handleDiningHallChange(id: string) {
    setSelectedDiningHallId(id || null)
    const match = diningHalls.find((d) => d.id === id)
    setSelectedDiningHallName(match?.name || '')
  }

  function handleStationChange(v: string) {
    setSelectedStationId(v || null)
    if (v === 'general') {
      setSelectedStationName('General / No specific station')
    } else {
      const match = stations.find((s) => s.id === v)
      setSelectedStationName(match?.name || '')
    }
  }

  function startSession() {
    if (!selectedOrgId || !selectedDiningHallId) return
    const stationIdToSave = !selectedStationId || selectedStationId === 'general' ? null : selectedStationId
    const stationNameToSave = !selectedStationId || selectedStationId === 'general'
      ? 'General / No specific station'
      : selectedStationName

    const sess: StaffSession = {
      organizationId: selectedOrgId,
      organizationName: selectedOrgName,
      diningHallId: selectedDiningHallId,
      diningHallName: selectedDiningHallName,
      stationId: stationIdToSave,
      stationName: stationNameToSave,
      startedAt: new Date().toISOString(),
      dbSessionId: null,
    }

    try {
      localStorage.setItem('staffSession', JSON.stringify(sess))
    } catch (err) {
      console.error('Error writing staffSession to localStorage:', err)
    }

    router.push('/staff/home')
  }

  return (
    <div style={{ backgroundColor: '#F8FAFB', minHeight: '100vh' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100vh', padding: 20 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, backgroundColor: '#1A7A5E', borderRadius: 6, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>Set up your session</div>
            <div style={{ fontSize: 14, color: '#6B7280' }}>Select your location before you begin.</div>
          </div>
        </div>

        {/* Organization select */}
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            Your organization
          </label>
          <select
            value={selectedOrgId ?? ''}
            onChange={(e) => handleOrgChange(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginTop: 8, fontSize: 15, backgroundColor: '#fff' }}
          >
            <option value="">Select organization</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          {orgsError && (
            <div style={{ marginTop: 8, color: '#DC2626', fontSize: 13 }}>Could not load options. Please refresh.</div>
          )}
        </div>

        {/* Dining hall select */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            Dining hall
          </label>
          <select
            value={selectedDiningHallId ?? ''}
            onChange={(e) => handleDiningHallChange(e.target.value)}
            disabled={!selectedOrgId}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginTop: 8, fontSize: 15, backgroundColor: '#fff', opacity: selectedOrgId ? 1 : 0.6 }}
          >
            <option value="">Select dining hall</option>
            {diningHalls.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {diningError && (
            <div style={{ marginTop: 8, color: '#DC2626', fontSize: 13 }}>Could not load options. Please refresh.</div>
          )}
        </div>

        {/* Station select */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            Your station
          </label>
          <select
            value={selectedStationId ?? ''}
            onChange={(e) => handleStationChange(e.target.value)}
            disabled={!selectedDiningHallId}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #E5E7EB', marginTop: 8, fontSize: 15, backgroundColor: '#fff', opacity: selectedDiningHallId ? 1 : 0.6 }}
          >
            <option value="">Select station</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value="general">General / No specific station</option>
          </select>
          {stationsError && (
            <div style={{ marginTop: 8, color: '#DC2626', fontSize: 13 }}>Could not load options. Please refresh.</div>
          )}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 18 }}>
          <button
            onClick={startSession}
            disabled={!canStart}
            style={{ width: '100%', padding: 14, borderRadius: 12, backgroundColor: canStart ? '#1A7A5E' : '#D1D5DB', color: '#fff', border: 'none', fontSize: 15, fontWeight: 500, cursor: canStart ? 'pointer' : 'default' }}
          >
            Start session
          </button>
        </div>

      </div>
    </div>
  )
}
