'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRoleGuard } from '@/lib/useRoleGuard'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabaseClient'

type DiningItem = { name: string; detail: string }
type DiningStatus = 'safe' | 'limited' | 'unsafe'
type TimeContext = 'open' | 'soon' | 'closed'

type DiningHall = {
  id: string
  name: string
  status: DiningStatus
  safeCount: number
  hours: string
  timeContext: TimeContext
  timeLabel: string
  items: DiningItem[]
}

const MOCK_DINING_HALLS: DiningHall[] = [
  {
    id: 'lipton',
    name: 'Lipton Dining',
    status: 'safe',
    safeCount: 3,
    hours: 'Closes at 10:00 PM',
    timeContext: 'open',
    timeLabel: 'Open now',
    items: [
      { name: 'Grilled chicken breast', detail: 'Plain grilled · no marinades' },
      { name: 'Steamed white rice', detail: 'No additives · safe for all allergens' },
      { name: 'Garden salad', detail: 'Request dressing on side · confirm ingredients' },
    ],
  },
  {
    id: 'palladium',
    name: 'Palladium',
    status: 'safe',
    safeCount: 5,
    hours: 'Closes at 9:00 PM',
    timeContext: 'open',
    timeLabel: 'Open now',
    items: [
      { name: 'Pasta with marinara', detail: 'Vegan · confirm wheat content' },
      { name: 'Roasted vegetables', detail: 'Olive oil only · no cross-contact' },
      { name: 'Fruit bowl', detail: 'Fresh cut · safe for all allergens' },
      { name: 'Black bean tacos', detail: 'Vegan · confirm tortilla ingredients' },
      { name: 'Oatmeal', detail: 'Plain · add your own toppings' },
    ],
  },
  {
    id: 'kimmel',
    name: 'Kimmel',
    status: 'limited',
    safeCount: 1,
    hours: 'Closes at 8:00 PM',
    timeContext: 'soon',
    timeLabel: 'Closes in 45 min',
    items: [
      { name: 'Plain bagel', detail: 'Verify no cross-contact with nut spreads' },
    ],
  },
  {
    id: 'downstein',
    name: 'Downstein',
    status: 'unsafe',
    safeCount: 0,
    hours: 'Closed',
    timeContext: 'closed',
    timeLabel: 'Closed',
    items: [],
  },
]

const STATUS_CONFIG: Record<DiningStatus, { icon: string; iconBg: string; labelColor: string; label: string; hoverBorder: string; hoverBg: string }> = {
  safe:    { icon: '✅', iconBg: '#F0FDF4', labelColor: '#16A34A', label: 'Safe',             hoverBorder: '#86EFAC', hoverBg: '#F0FDF4' },
  limited: { icon: '⚠️', iconBg: '#FFFBEB', labelColor: '#D97706', label: 'Verify with staff', hoverBorder: '#FCD34D', hoverBg: '#FFFBEB' },
  unsafe:  { icon: '❌', iconBg: '#FFF5F5', labelColor: '#DC2626', label: 'Not safe',          hoverBorder: '#FCA5A5', hoverBg: '#FFF5F5' },
}

const TIME_BADGE: Record<TimeContext, { bg: string; color: string }> = {
  open:   { bg: '#DCFCE7', color: '#15803D' },
  soon:   { bg: '#FEF3C7', color: '#B45309' },
  closed: { bg: '#FEE2E2', color: '#B91C1C' },
}

type RestrictionDetail = {
  name: string
  emoji: string
  category: 'allergen' | 'preference'
  tier: 1 | 2 | 3 | null
  crossContact: boolean
  staffNote: string
}

function getGreeting(hour: number): string {
  if (hour >= 5 && hour <= 11) return 'Good morning,'
  if (hour >= 12 && hour <= 16) return 'Good afternoon,'
  if (hour >= 17 && hour <= 23) return 'Good evening,'
  return 'Welcome back,'
}

function ProfilePill({
  tier1Count,
  totalCount,
  hasCrossContact,
}: {
  tier1Count: number
  totalCount: number
  hasCrossContact: boolean
}) {
  let bg: string, border: string, color: string, dotBg: string, label: string

  if (tier1Count > 0 && hasCrossContact) {
    bg = '#FEE2E2'; border = '1px solid #FECACA'; color = '#991B1B'; dotBg = '#DC2626'
    label = `${tier1Count} must avoid · Cross-contact sensitive`
  } else if (tier1Count > 0) {
    bg = '#FEF3C7'; border = '1px solid #FDE68A'; color = '#92400E'; dotBg = '#D97706'
    label = `${tier1Count} must avoid allergen${tier1Count !== 1 ? 's' : ''}`
  } else if (totalCount > 0) {
    bg = '#F0FAF7'; border = '1px solid #D1FAE5'; color = '#065F46'; dotBg = '#16A34A'
    label = `Passport active · ${totalCount} restriction${totalCount !== 1 ? 's' : ''}`
  } else {
    bg = '#F9FAFB'; border = '1px solid #E5E7EB'; color = '#6B7280'; dotBg = '#9CA3AF'
    label = 'No restrictions added yet'
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      backgroundColor: bg,
      border,
      borderRadius: 99,
      padding: '4px 10px',
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: dotBg, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
    </div>
  )
}

export default function StudentHomePage() {
  useRoleGuard('Student')
  const router = useRouter()

  const [userName, setUserName] = useState('')
  const [userUniversity, setUserUniversity] = useState('')
  const [profileCreatedAt, setProfileCreatedAt] = useState('')
  const [restrictionDetails, setRestrictionDetails] = useState<RestrictionDetail[]>([])
  const [tier1List, setTier1List] = useState<RestrictionDetail[]>([])
  const [tier2List, setTier2List] = useState<RestrictionDetail[]>([])
  const [tier3List, setTier3List] = useState<RestrictionDetail[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [hasCrossContact, setHasCrossContact] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [passportOpen, setPassportOpen] = useState(false)
  const [selectedDiningHall, setSelectedDiningHall] = useState<DiningHall | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [editCardHovered, setEditCardHovered] = useState(false)
  const [shareCardHovered, setShareCardHovered] = useState(false)
  const [passportTab, setPassportTab] = useState<'screen' | 'qr'>('screen')
  const [mounted, setMounted] = useState(false)
  const [userQRToken, setUserQRToken] = useState('')
  const [unreadNotifications, setUnreadNotifications] = useState<{ id: string; type: string; message: string; created_at: string }[]>([])

  useEffect(() => {
    const name = localStorage.getItem('userName') || ''
    const university = localStorage.getItem('userUniversity') || 'Your University'
    const createdAt = localStorage.getItem('profileCreatedAt') || ''
    const details: RestrictionDetail[] = JSON.parse(
      localStorage.getItem('restrictionDetails') || '[]'
    )

    const t1 = details.filter((r) => r.tier === 1)
    const t2 = details.filter((r) => r.tier === 2)
    const t3 = details.filter((r) => r.tier === 3)
    const cross = details.some((r) => r.crossContact === true)

    setUserName(name)
    setUserUniversity(university)
    setProfileCreatedAt(createdAt)
    setRestrictionDetails(details)
    setTier1List(t1)
    setTier2List(t2)
    setTier3List(t3)
    setTotalCount(details.length)
    setHasCrossContact(cross)
    setGreeting(getGreeting(new Date().getHours()))
    const token = localStorage.getItem('userQRToken') || ''
    setUserQRToken(token)
  }, [])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const userId = localStorage.getItem('supabaseUserId')
    if (!userId) return
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('id, type, message, created_at')
          .eq('user_id', userId)
          .eq('read', false)
          .order('created_at', { ascending: false })
          .limit(5)
        if (error) {
          console.error('Notifications fetch error:', error)
          return
        }
        setUnreadNotifications(data ?? [])
      } catch (err) {
        console.error('Notifications fetch exception:', err)
      }
    })()
  }, [])

  async function markNotificationRead(id: string) {
    setUnreadNotifications((prev) => prev.filter((n) => n.id !== id))
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    } catch (err) {
      console.error('Mark read error:', err)
    }
  }

  async function markAllRead() {
    const userId = localStorage.getItem('supabaseUserId')
    setUnreadNotifications([])
    if (!userId) return
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)
    } catch (err) {
      console.error('Mark all read error:', err)
    }
  }

  return (
    <div style={{ backgroundColor: '#F8FAFB', minHeight: '100vh' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', backgroundColor: '#F8FAFB', minHeight: '100vh' }}>

        {/* ── HEADER ── */}
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '20px 20px 16px',
          borderBottom: '1px solid #F3F4F6',
        }}>
          {/* Greeting */}
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
            {greeting}
          </p>

          {/* Student name */}
          <h1 style={{
            fontSize: 21,
            fontWeight: 600,
            color: '#111827',
            letterSpacing: '-0.3px',
            marginBottom: 6,
          }}>
            {userName || 'Your Name'}
          </h1>

          {/* Profile pill */}
          <ProfilePill
            tier1Count={tier1List.length}
            totalCount={totalCount}
            hasCrossContact={hasCrossContact}
          />
        </div>

        {/* ── NOTIFICATION BANNER ── */}
        {unreadNotifications.length > 0 && (
          <div style={{ padding: '12px 20px 0' }}>
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}>
              {/* Warning icon */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="10" cy="10" r="9" stroke="#DC2626" strokeWidth="1.8" />
                <path d="M10 6v5M10 13v.5" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
              </svg>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
                  {unreadNotifications.length === 1
                    ? 'Accommodation Issue'
                    : `${unreadNotifications.length} accommodation issues`}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#6B7280', lineHeight: 1.4,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {unreadNotifications.length === 1
                    ? unreadNotifications[0].message
                    : 'Tap to view'}
                </p>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => {
                  if (unreadNotifications.length === 1) {
                    markNotificationRead(unreadNotifications[0].id)
                  } else {
                    markAllRead()
                  }
                }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: '#9CA3AF', padding: '2px 0', flexShrink: 0,
                }}
              >
                {unreadNotifications.length === 1 ? 'Dismiss' : 'Dismiss all'}
              </button>
            </div>
          </div>
        )}

        {/* ── SHOW PASSPORT BUTTON ── */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ position: 'relative' }}>
          {unreadNotifications.length > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4, zIndex: 1,
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: '#DC2626',
              border: '2px solid white',
            }} />
          )}
          <button
            onClick={() => { setPassportOpen(true); setPassportTab('screen') }}
            style={{
              width: '100%',
              backgroundColor: '#1A7A5E',
              border: '1.5px solid #155f49',
              borderRadius: 14,
              padding: 0,
              overflow: 'hidden',
              cursor: 'pointer',
              animation: 'passportPulse 2.5s ease-in-out infinite',
              transition: 'background 0.15s, transform 0.1s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#155f49'
              e.currentTarget.style.transform = 'scale(1.01)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1A7A5E'
              e.currentTarget.style.transform = 'scale(1)'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = '#111827'
              e.currentTarget.style.borderColor = '#111827'
              e.currentTarget.style.transform = 'scale(0.99)'
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = '#155f49'
              e.currentTarget.style.borderColor = '#155f49'
              e.currentTarget.style.transform = 'scale(1.01)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
              {/* Left — icon wrap */}
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 22,
                color: 'white',
              }}>
                ▣
              </div>

              {/* Middle — text */}
              <div style={{ flex: 1, textAlign: 'left' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', display: 'block' }}>
                  Show my passport
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1, display: 'block' }}>
                  Tap to show staff or scan QR
                </span>
              </div>

              {/* Right — arrow */}
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)' }}>›</span>
            </div>
          </button>
          </div>
        </div>

        {/* ── WHERE TO EAT ── */}
        <div style={{ padding: '14px 20px 0' }}>
          <p style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}>
            Where to eat right now
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MOCK_DINING_HALLS.map((hall) => {
              const cfg = STATUS_CONFIG[hall.status]
              const timeBadge = TIME_BADGE[hall.timeContext]
              const isHovered = hoveredCard === hall.id
              return (
                <button
                  key={hall.id}
                  onClick={() => setSelectedDiningHall(hall)}
                  onMouseEnter={() => setHoveredCard(hall.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onMouseDown={() => setHoveredCard(hall.id)}
                  onMouseUp={() => setHoveredCard(hall.id)}
                  style={{
                    backgroundColor: isHovered ? cfg.hoverBg : '#FFFFFF',
                    border: isHovered ? `1.5px solid ${cfg.hoverBorder}` : '1.5px solid #E5E7EB',
                    borderRadius: 13,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 11,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    width: '100%',
                    textAlign: 'left',
                  }}
                >
                  {/* Left — status icon */}
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    backgroundColor: cfg.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 17,
                    flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {cfg.icon}
                  </div>

                  {/* Middle — info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 2 }}>
                      {hall.name}
                    </p>

                    {/* Status + time row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.labelColor }}>
                        {cfg.label}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '1px 6px',
                        borderRadius: 99,
                        backgroundColor: timeBadge.bg,
                        color: timeBadge.color,
                      }}>
                        {hall.timeLabel}
                      </span>
                    </div>

                    {/* Safe count */}
                    <p style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: hall.status === 'unsafe' ? '#DC2626' : '#111827',
                      marginBottom: 1,
                    }}>
                      {hall.status === 'unsafe'
                        ? '0 safe items'
                        : `${hall.safeCount} safe ${hall.safeCount === 1 ? 'item' : 'items'} today`}
                    </p>

                    {/* Hours */}
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>{hall.hours}</p>
                  </div>

                  {/* Right — arrow */}
                  <span style={{ fontSize: 15, color: '#D1D5DB', flexShrink: 0, marginTop: 2 }}>›</span>
                </button>
              )
            })}
          </div>

          {/* Mock data badge */}
          <div style={{ marginTop: 10 }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: '#F3F4F6',
              borderRadius: 99,
              padding: '3px 8px',
              fontSize: 10,
              color: '#6B7280',
              fontWeight: 500,
            }}>
              🔌 Mock data · Real menu API coming soon
            </span>
          </div>
        </div>

        {/* ── YOUR PROFILE ── */}
        <div style={{ padding: '14px 20px 0' }}>
          <p style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}>
            Your profile
          </p>

          {/* Restriction list card */}
          <div style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
            {restrictionDetails.length > 0 ? (
              [...restrictionDetails]
                .sort((a, b) => (a.tier ?? 4) - (b.tier ?? 4))
                .map((r, i, arr) => {
                  const dotColor = r.tier === 1 ? '#DC2626' : r.tier === 2 ? '#D97706' : '#16A34A'
                  const meta = r.tier === 1
                    ? (r.crossContact ? 'Must avoid · Cross-contact' : 'Must avoid')
                    : r.tier === 2 ? 'Try to avoid' : 'Preference'
                  return (
                    <div
                      key={r.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        padding: '10px 13px',
                        borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none',
                      }}
                    >
                      {/* Tier dot */}
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
                      {/* Emoji */}
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{r.emoji}</span>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{r.name}</p>
                        <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{meta}</p>
                      </div>
                      {/* Edit button */}
                      <button
                        onClick={() => router.push('/student/edit')}
                        style={{
                          fontSize: 10,
                          color: '#1A7A5E',
                          fontWeight: 500,
                          padding: '2px 7px',
                          border: '1px solid #D1FAE5',
                          borderRadius: 5,
                          backgroundColor: '#F0FAF7',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )
                })
            ) : (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#6B7280' }}>No restrictions added yet</p>
                <button
                  onClick={() => router.push('/onboarding/allergens')}
                  style={{
                    display: 'inline-block',
                    marginTop: 10,
                    border: '1px solid #1A7A5E',
                    color: '#1A7A5E',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Add restrictions
                </button>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            {/* Edit profile */}
            <button
              onClick={() => router.push('/student/edit')}
              onMouseEnter={() => setEditCardHovered(true)}
              onMouseLeave={() => setEditCardHovered(false)}
              style={{
                backgroundColor: editCardHovered ? '#F0FAF7' : '#fff',
                border: editCardHovered ? '1px solid #1A7A5E' : '1px solid #E5E7EB',
                borderRadius: 12,
                padding: 13,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                width: '100%',
              }}
            >
              <p style={{ fontSize: 18, marginBottom: 6 }}>✏️</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>Edit profile</p>
              <p style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>Update restrictions or severity</p>
            </button>

            {/* Share profile */}
            <button
              onClick={() => {
                try {
                  navigator.clipboard.writeText(window.location.origin + '/passport/preview')
                  setToastVisible(true)
                  setTimeout(() => setToastVisible(false), 2000)
                } catch {}
              }}
              onMouseEnter={() => setShareCardHovered(true)}
              onMouseLeave={() => setShareCardHovered(false)}
              style={{
                backgroundColor: shareCardHovered ? '#F0FAF7' : '#fff',
                border: shareCardHovered ? '1px solid #1A7A5E' : '1px solid #E5E7EB',
                borderRadius: 12,
                padding: 13,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
                width: '100%',
              }}
            >
              <p style={{ fontSize: 18, marginBottom: 6 }}>🔗</p>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>Share profile</p>
              <p style={{ fontSize: 10, color: '#6B7280', marginTop: 1 }}>Send your passport link</p>
            </button>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 20, padding: '0 20px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: '#9CA3AF' }}>
            {profileCreatedAt && !isNaN(new Date(profileCreatedAt).getTime())
              ? `Profile last updated · ${new Date(profileCreatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : 'Profile not yet saved'}
          </p>
        </div>

      </div>

      {/* ── PASSPORT BOTTOM SHEET ── */}
      {passportOpen && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setPassportOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.4)' }}
          />

          {/* Sheet */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 430,
              backgroundColor: '#fff',
              borderRadius: '20px 20px 0 0',
              zIndex: 50,
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {/* Green header */}
            <div style={{ backgroundColor: '#1A7A5E', padding: '16px 20px 20px' }}>
              <button
                onClick={() => setPassportOpen(false)}
                style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, marginBottom: 12, display: 'block' }}
              >
                ‹ Back
              </button>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
                {userName || 'Your Name'}
              </p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {userUniversity} · Dining Passport
              </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', backgroundColor: '#F8FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {(['screen', 'qr'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setPassportTab(tab)}
                  style={{
                    flex: 1,
                    padding: 11,
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: 'none',
                    borderBottom: passportTab === tab ? '2px solid #1A7A5E' : '2px solid transparent',
                    backgroundColor: passportTab === tab ? '#fff' : 'transparent',
                    color: passportTab === tab ? '#1A7A5E' : '#6B7280',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab === 'screen' ? 'Show screen' : 'Show QR code'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {passportTab === 'qr' ? (
              <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>

                {/* QR code box */}
                <div style={{ width: 160, height: 160, backgroundColor: '#F8FAFB', border: '2px solid #E5E7EB', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {mounted ? (
                    <QRCodeSVG
                      value={typeof window !== 'undefined' ? (userQRToken ? window.location.origin + '/passport/' + userQRToken : window.location.origin + '/passport/preview') : '/passport/preview'}
                      size={140}
                      level="M"
                      bgColor="#F8FAFB"
                      fgColor="#111827"
                    />
                  ) : (
                    <div style={{ width: 160, height: 160, backgroundColor: '#F8FAFB', borderRadius: 16 }} />
                  )}
                </div>

                {/* Student identity */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{userName || 'Your Name'}</p>
                  <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Scan to view dietary profile</p>
                </div>

                {/* Instruction box */}
                <div style={{ width: '100%', backgroundColor: '#F0FAF7', border: '1px solid #D1FAE5', borderRadius: 10, padding: '12px 14px' }}>
                  <p style={{ fontSize: 12, color: '#065F46', fontWeight: 500, textAlign: 'center', lineHeight: 1.5 }}>
                    Staff: scan this code to view full dietary restrictions and instructions
                  </p>
                </div>

                {/* Must avoid summary */}
                {tier1List.length > 0 && (
                  <div style={{ width: '100%' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                      Must avoid
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {tier1List.map((r) => (
                        <span key={r.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: 99, padding: '4px 9px', fontSize: 11, fontWeight: 600 }}>
                          {r.emoji} {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div style={{ padding: '16px 20px 0' }}>

                {/* A) Must avoid */}
                {tier1List.length > 0 && (
                  <div style={{ backgroundColor: '#FFF5F5', border: '1.5px solid #FECACA', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#DC2626', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Must avoid</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {tier1List.map((r) => (
                        <span key={r.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: 99, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
                          {r.emoji} {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* B) Cross-contact banner */}
                {hasCrossContact && tier1List.length > 0 && (
                  <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                    <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 500 }}>Cross-contact sensitive — trace amounts are a risk</span>
                  </div>
                )}

                {/* C) Try to avoid */}
                {tier2List.length > 0 && (
                  <div style={{ backgroundColor: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#D97706', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Try to avoid</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {tier2List.map((r) => (
                        <span key={r.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: 99, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
                          {r.emoji} {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* D) Preference */}
                {tier3List.length > 0 && (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: '#16A34A', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Preference</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {tier3List.map((r) => (
                        <span key={r.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', color: '#166534', borderRadius: 99, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
                          {r.emoji} {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* E) Staff notes */}
                {restrictionDetails.some((r) => r.staffNote.trim() !== '') && (
                  <div style={{ marginBottom: 10 }}>
                    {restrictionDetails
                      .filter((r) => r.staffNote.trim() !== '')
                      .map((r) => (
                        <div key={r.name} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0' }}>
                          <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#6B7280', flexShrink: 0, marginTop: 6 }} />
                          <div>
                            <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.45 }}>{r.staffNote}</p>
                            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>Note for {r.name}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* F) Staff instructions */}
                <div style={{ backgroundColor: '#F0FAF7', border: '1px solid #D1FAE5', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Staff instructions
                  </p>
                  {tier1List.length > 0 ? (
                    <>
                      {[
                        'Do not serve if uncertain about must-avoid items',
                        ...(hasCrossContact ? ['Avoid cross-contact — use clean equipment'] : []),
                        'Please confirm ingredients before serving',
                      ].map((text, i, arr) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: i < arr.length - 1 ? 5 : 0 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#1A7A5E', flexShrink: 0, marginTop: 5 }} />
                          <p style={{ fontSize: 12, color: '#065F46', lineHeight: 1.45 }}>{text}</p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {['Please accommodate preferences where possible', 'Ask if unsure about any items'].map((text, i, arr) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: i < arr.length - 1 ? 5 : 0 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#1A7A5E', flexShrink: 0, marginTop: 5 }} />
                          <p style={{ fontSize: 12, color: '#065F46', lineHeight: 1.45 }}>{text}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>

              </div>
            )}

            {/* Bottom bar */}
            <div style={{ backgroundColor: '#1A7A5E', padding: '12px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Dining Passport · Verified profile</p>
            </div>
          </div>
        </>
      )}

      {/* ── DINING HALL BOTTOM SHEET ── */}
      {selectedDiningHall !== null && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setSelectedDiningHall(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
          />

          {/* Sheet */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              bottom: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: 430,
              backgroundColor: '#fff',
              borderRadius: '20px 20px 0 0',
              zIndex: 50,
              maxHeight: '75vh',
              overflowY: 'auto',
            }}
          >
            {/* Handle bar */}
            <div style={{
              width: 36,
              height: 4,
              backgroundColor: '#E5E7EB',
              borderRadius: 99,
              margin: '12px auto 16px',
              display: 'block',
            }} />

            {/* Header */}
            <div style={{
              padding: '0 20px 12px',
              borderBottom: '1px solid #F3F4F6',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
                  {selectedDiningHall.name}
                </p>
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  {STATUS_CONFIG[selectedDiningHall.status].label} · {selectedDiningHall.timeLabel} · {selectedDiningHall.hours}
                </p>
              </div>
              <button
                onClick={() => setSelectedDiningHall(null)}
                style={{
                  fontSize: 20,
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                }}
              >
                ✕
              </button>
            </div>

            {/* Section label */}
            <p style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#9CA3AF',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              padding: '14px 20px 8px',
            }}>
              Safe items for your profile
            </p>

            {/* Menu items */}
            {selectedDiningHall.items.length > 0 ? (
              selectedDiningHall.items.map((item, i, arr) => (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 20px',
                    borderBottom: i < arr.length - 1 ? '1px solid #F9FAFB' : 'none',
                  }}
                >
                  {/* Green dot */}
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#16A34A',
                    flexShrink: 0,
                    marginTop: 4,
                  }} />

                  {/* Text */}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{item.name}</p>
                    <p style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{item.detail}</p>
                  </div>

                  {/* Safe badge */}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#16A34A',
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: 99,
                    padding: '2px 7px',
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}>
                    Safe
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: '#9CA3AF' }}>
                  No safe items confirmed for your profile today.
                </p>
              </div>
            )}

            {/* Coming soon note */}
            <div style={{ margin: '12px 20px 20px' }}>
              <div style={{
                backgroundColor: '#F8FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: 10,
                padding: '10px 12px',
                fontSize: 11,
                color: '#9CA3AF',
                textAlign: 'center',
              }}>
                Mock data only · Real menu integration coming soon
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TOAST ── */}
      <div style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        pointerEvents: 'none',
        opacity: toastVisible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}>
        <div style={{
          backgroundColor: '#111827',
          color: '#fff',
          fontSize: 12,
          fontWeight: 500,
          padding: '10px 18px',
          borderRadius: 99,
          whiteSpace: 'nowrap',
        }}>
          Link copied!
        </div>
      </div>

    </div>
  )
}
