'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type ScanState = 'scanning' | 'loading' | 'error' | 'success' | 'no-camera'

interface StaffSession {
  diningHallId: string
  diningHallName: string
  stationId: string
  stationName: string
  startedAt: string
}

interface RecentRequest {
  requestId: string
  studentName: string
  diningHall: string
  station: string
  status: string
  scannedAt: string
}

export default function StaffScanPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [errorMessage, setErrorMessage] = useState('')
  const [staffSession, setStaffSession] = useState<StaffSession | null>(null)
  const scannerRef = useRef<InstanceType<typeof import('html5-qrcode')['Html5Qrcode']> | null>(null)
  const isScanningRef = useRef(false)

  useEffect(() => {
    setMounted(true)
    try {
      const raw = localStorage.getItem('staffSession')
      if (raw) setStaffSession(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [])

  // Start camera once mounted and state is 'scanning'
  useEffect(() => {
    if (!mounted || scanState !== 'scanning') return

    let cancelled = false

    async function startScanner() {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (cancelled) return

      try {
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        isScanningRef.current = true

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          onScanSuccess,
          () => { /* ignore per-frame errors */ }
        )
      } catch (err) {
        if (cancelled) return
        console.error('Camera start error:', err)
        setScanState('no-camera')
        isScanningRef.current = false
      }
    }

    startScanner()

    return () => {
      cancelled = true
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, scanState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function stopScanner() {
    if (scannerRef.current && isScanningRef.current) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch {
        // ignore cleanup errors
      }
      isScanningRef.current = false
      scannerRef.current = null
    }
  }

  async function onScanSuccess(decodedText: string) {
    if (!isScanningRef.current) return
    await stopScanner()
    setScanState('loading')

    const token = decodedText.split('/').pop() || ''

    if (!token) {
      setErrorMessage('Could not read a valid token from this QR code.')
      setScanState('error')
      return
    }

    try {
      const { data, error } = await supabase
        .from('qr_tokens')
        .select(`
          dietary_profile_id,
          dietary_profiles!inner(
            id,
            user_id,
            users!inner(full_name)
          )
        `)
        .eq('token', token)
        .limit(1)
        .single()

      if (error || !data) {
        console.error('QR lookup error:', error)
        setErrorMessage(
          'No profile found for this QR code. Ask the student to regenerate their passport.'
        )
        setScanState('error')
        return
      }

      const profileId = data.dietary_profile_id
      // @ts-ignore — nested join shape
      const fullName: string = data.dietary_profiles?.users?.full_name ?? 'Unknown'

      const session: StaffSession | null = (() => {
        try {
          const raw = localStorage.getItem('staffSession')
          return raw ? JSON.parse(raw) : null
        } catch { return null }
      })()

      const { data: requestData, error: insertError } = await supabase
        .from('dietary_requests')
        .insert({
          profile_id: profileId,
          source_type: 'qr_scan',
          staff_session_id: session?.startedAt ?? null,
          dining_hall_id: session?.diningHallId ?? null,
          station_id: session?.stationId ?? null,
          status: 'pending',
        })
        .select('id')
        .single()

      if (insertError || !requestData) {
        console.error('Insert error:', insertError)
        setErrorMessage('Could not create the request. Please try again.')
        setScanState('error')
        return
      }

      const requestId: string = requestData.id

      // Prepend to recentRequests in localStorage (max 5)
      try {
        const existing: RecentRequest[] = JSON.parse(
          localStorage.getItem('recentRequests') || '[]'
        )
        const entry: RecentRequest = {
          requestId,
          studentName: fullName,
          diningHall: session?.diningHallName ?? '',
          station: session?.stationName ?? '',
          status: 'pending',
          scannedAt: new Date().toISOString(),
        }
        const updated = [entry, ...existing].slice(0, 5)
        localStorage.setItem('recentRequests', JSON.stringify(updated))
      } catch {
        // ignore storage errors
      }

      setScanState('success')
      setTimeout(() => {
        router.push('/staff/profile/' + token + '?requestId=' + requestId)
      }, 500)
    } catch (err) {
      console.error('Unexpected scan error:', err)
      setErrorMessage('An unexpected error occurred. Please try again.')
      setScanState('error')
    }
  }

  function handleTryAgain() {
    setErrorMessage('')
    setScanState('scanning')
  }

  // Loading skeleton before hydration
  if (!mounted) {
    return (
      <div style={{
        maxWidth: 430, margin: '0 auto', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FFFFFF'
      }}>
        <SpinnerIcon color="#1A7A5E" size={40} />
      </div>
    )
  }

  return (
    <div style={{
      maxWidth: 430, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      backgroundColor: '#FFFFFF', fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#1A7A5E',
        padding: '16px 20px 14px',
        display: 'flex', flexDirection: 'column', gap: 4,
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push('/staff/home')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, margin: -4 }}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12.5 15L7.5 10l5-5" stroke="white"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={{ color: 'white', fontSize: 17, fontWeight: 600 }}>
            Scan Passport
          </span>
        </div>
        {staffSession && (
          <span style={{ color: '#D1FAE5', fontSize: 12, paddingLeft: 36 }}>
            {staffSession.diningHallName} · {staffSession.stationName}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 20px', gap: 0
      }}>

        {/* SCANNING STATE */}
        {(scanState === 'scanning') && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* Viewfinder wrapper */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
              {/* html5-qrcode mount point */}
              <div
                id="qr-reader"
                style={{
                  width: '100%',
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: '#000'
                }}
              />
              {/* Corner bracket overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ position: 'relative', width: 250, height: 250 }}>
                  {/* Top-left */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: 32, height: 32,
                    borderTop: '3px solid white', borderLeft: '3px solid white', borderRadius: '4px 0 0 0' }} />
                  {/* Top-right */}
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 32, height: 32,
                    borderTop: '3px solid white', borderRight: '3px solid white', borderRadius: '0 4px 0 0' }} />
                  {/* Bottom-left */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: 32, height: 32,
                    borderBottom: '3px solid white', borderLeft: '3px solid white', borderRadius: '0 0 0 4px' }} />
                  {/* Bottom-right */}
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32,
                    borderBottom: '3px solid white', borderRight: '3px solid white', borderRadius: '0 0 4px 0' }} />
                </div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', margin: 0 }}>
              Point camera at student's QR code
            </p>
          </div>
        )}

        {/* LOADING STATE */}
        {scanState === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <SpinnerIcon color="#1A7A5E" size={48} />
            <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>Looking up profile...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {scanState === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 300, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="12" stroke="#DC2626" strokeWidth="2" />
                <path d="M16 10v7M16 21v1" stroke="#DC2626" strokeWidth="2.2"
                  strokeLinecap="round" />
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>
              Could not read passport
            </p>
            <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
              {errorMessage}
            </p>
            <button
              onClick={handleTryAgain}
              style={{
                marginTop: 8, padding: '13px 32px',
                backgroundColor: '#1A7A5E', color: 'white',
                border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Try again
            </button>
          </div>
        )}

        {/* SUCCESS STATE */}
        {scanState === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: '#F0FAF7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="12" fill="#1A7A5E" />
                <path d="M10 16.5l4 4 8-8" stroke="white" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p style={{ fontSize: 15, color: '#111827', fontWeight: 500, margin: 0 }}>
              Passport found — loading profile
            </p>
          </div>
        )}

        {/* NO CAMERA STATE */}
        {scanState === 'no-camera' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 300, textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="3" y="9" width="20" height="14" rx="2.5" stroke="#9CA3AF" strokeWidth="2" />
                <circle cx="13" cy="16" r="3.5" stroke="#9CA3AF" strokeWidth="2" />
                <path d="M25 9l4 4M29 9l-4 4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
                <path d="M4 4l24 24" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p style={{ fontSize: 17, fontWeight: 600, color: '#111827', margin: 0 }}>
              Camera access needed
            </p>
            <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
              Please allow camera access in your browser settings, then refresh this page.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SpinnerIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.9s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
