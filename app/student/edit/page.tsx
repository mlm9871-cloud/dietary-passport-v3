'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRoleGuard } from '../../../lib/useRoleGuard'
import { supabase } from '../../../lib/supabaseClient'

type RestrictionDetail = {
  name: string
  emoji: string
  category: 'allergen' | 'preference'
  tier: 1 | 2 | 3 | null
  crossContact: boolean
  staffNote: string
}

const EMOJI_MAP: Record<string, string> = {
  Peanuts: '🥜',
  'Tree nuts': '🌰',
  Shellfish: '🦐',
  Fish: '🐟',
  'Milk / dairy': '🥛',
  Eggs: '🥚',
  'Wheat / gluten': '🌾',
  Soy: '🫘',
  Sesame: '🌱',
  Vegan: '🌿',
  Vegetarian: '🥗',
  'Keto / low-carb': '🥑',
  'Gluten-free (preference)': '🌾',
  Halal: '☪️',
  Kosher: '✡️',
}

export default function StudentEditPage() {
  useRoleGuard('Student')
  const router = useRouter()

  const [userName, setUserName] = useState<string>('')
  const [savedRestrictions, setSavedRestrictions] = useState<RestrictionDetail[]>([])
  const [draftRestrictions, setDraftRestrictions] = useState<RestrictionDetail[]>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false)
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [savedIndicator, setSavedIndicator] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState<boolean>(false)
  const [addSheetSelected, setAddSheetSelected] = useState<string[]>([])

  useEffect(() => {
    const name = localStorage.getItem('userName') || ''
    setUserName(name)

    const raw = localStorage.getItem('restrictionDetails')
    try {
      const parsed: RestrictionDetail[] = raw ? JSON.parse(raw) : []
      setSavedRestrictions(parsed)
      setDraftRestrictions(JSON.parse(JSON.stringify(parsed || [])))
    } catch (e) {
      setSavedRestrictions([])
      setDraftRestrictions([])
    }
  }, [])

  useEffect(() => {
    const same = JSON.stringify(savedRestrictions) === JSON.stringify(draftRestrictions)
    setHasUnsavedChanges(!same)
  }, [savedRestrictions, draftRestrictions])

  const tierCounts = useMemo(() => {
    const t1 = draftRestrictions.filter((r) => r.tier === 1).length
    const t2 = draftRestrictions.filter((r) => r.tier === 2).length
    const t3 = draftRestrictions.filter((r) => r.tier === 3).length
    return { tier1Count: t1, tier2Count: t2, tier3Count: t3 }
  }, [draftRestrictions])

  const initials = useMemo(() => {
    if (!userName) return ''
    const parts = userName.trim().split(/\s+/)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
    return (first + last).toUpperCase()
  }, [userName])

  function cardIdForIndex(i: number) {
    return `card-${i}`
  }

  function toggleExpand(id: string) {
    setExpandedCardId((prev) => (prev === id ? null : id))
  }

  function showSavedTemp(name: string) {
    setSavedIndicator(name)
    setTimeout(() => setSavedIndicator(null), 1500)
  }

  function handleTierChange(index: number, newTier: 1 | 2 | 3) {
    setDraftRestrictions((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as RestrictionDetail[]
      const item = next[index]
      if (!item) return prev
      const prevTier = item.tier
      item.tier = newTier
      if (newTier === 1) item.crossContact = true
      if (prevTier === 1 && newTier !== 1) item.crossContact = false
      return next
    })
    showSavedTemp(draftRestrictions[index]?.name ?? '')
  }

  function toggleCrossContact(index: number) {
    setDraftRestrictions((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as RestrictionDetail[]
      const item = next[index]
      if (!item) return prev
      item.crossContact = !item.crossContact
      return next
    })
    showSavedTemp(draftRestrictions[index]?.name ?? '')
  }

  function handleStaffNoteChange(index: number, val: string) {
    setDraftRestrictions((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as RestrictionDetail[]
      const item = next[index]
      if (!item) return prev
      item.staffNote = val
      return next
    })
  }

  function commitSave() {
    const updatedRestrictions = draftRestrictions
    localStorage.setItem('restrictionDetails', JSON.stringify(updatedRestrictions))
    setSavedRestrictions(JSON.parse(JSON.stringify(updatedRestrictions)))
    setHasUnsavedChanges(false)

    // Non-blocking Supabase sync: delete stale rows and re-insert updated ones
    ;(async () => {
      try {
        const profileId = localStorage.getItem('supabaseDietaryProfileId')
        if (!profileId) return

        // Delete existing restrictions
        await supabase
          .from('dietary_profile_restrictions')
          .delete()
          .eq('dietary_profile_id', profileId)

        // Re-insert updated restrictions (no restriction_id)
        if (updatedRestrictions.length > 0) {
          const toInsert = updatedRestrictions.map((d) => ({
            dietary_profile_id: profileId,
            name: d.name,
            emoji: d.emoji,
            category: d.category,
            tier: d.tier,
            cross_contact: d.crossContact,
            staff_note: d.staffNote,
            notes: d.staffNote,
          }))
          const { error } = await supabase
            .from('dietary_profile_restrictions')
            .insert(toInsert)
          if (error) console.error('Supabase restrictions sync error:', error)
        }
      } catch (err) {
        console.error('Unexpected Supabase sync error on edit save:', err)
      }
    })()

    router.push('/student/home')
  }

  function onBackClick() {
    if (hasUnsavedChanges) setShowDiscardModal(true)
    else router.push('/student/home')
  }

  function onRequestDelete(targetId: string) {
    setDeleteTargetId(targetId)
    setShowDeleteModal(true)
  }

  function confirmDelete() {
    if (deleteTargetId == null) return
    const idx = parseInt(deleteTargetId.replace('card-', ''), 10)
    setDraftRestrictions((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as RestrictionDetail[]
      if (idx >= 0 && idx < next.length) next.splice(idx, 1)
      return next
    })
    setHasUnsavedChanges(true)
    setShowDeleteModal(false)
    setDeleteTargetId(null)
    setExpandedCardId(null)
  }

  const ALLERGENS = ['Peanuts','Tree nuts','Shellfish','Fish','Milk / dairy','Eggs','Wheat / gluten','Soy','Sesame']
  const PREFERENCES = ['Vegan','Vegetarian','Keto / low-carb','Gluten-free (preference)','Halal','Kosher']

  function toggleAddSheetSelection(name: string) {
    setAddSheetSelected((prev) => prev.includes(name) ? prev.filter((s)=>s!==name) : [...prev, name])
  }

  function addSelectedRestrictions() {
    if (addSheetSelected.length === 0) return
    setDraftRestrictions((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as RestrictionDetail[]
      for (const name of addSheetSelected) {
        // skip if already exists
        if (next.some((r) => r.name === name)) continue
        const category = ALLERGENS.includes(name) ? 'allergen' : 'preference'
        const tier = category === 'allergen' ? 1 : 3
        const crossContact = category === 'allergen'
        const emoji = EMOJI_MAP[name] ?? '🍽️'
        next.push({ name, emoji, category, tier, crossContact, staffNote: '' })
      }
      return next
    })
    setAddSheetSelected([])
    setShowAddSheet(false)
    setHasUnsavedChanges(true)
  }

  return (
    <div style={{ background: '#F8FAFB' }} className="min-h-screen flex flex-col items-center">
      <div style={{ maxWidth: 430 }} className="w-full">
        {/* Top Nav */}
        <header style={{ background: '#fff' }} className="flex items-center justify-between px-4 py-3 border-b" style={{borderBottom: '1px solid #F3F4F6', padding: '14px 16px', background: '#fff'}}>
          <button onClick={onBackClick} className="rounded-md" style={{border: '1.5px solid #111827', padding: '6px 12px', fontSize:13, fontWeight:500, background:'#fff', color:'#111827', borderRadius:8}} onMouseEnter={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='#111827'; (e.currentTarget as HTMLButtonElement).style.color='#fff'}} onMouseLeave={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='#fff'; (e.currentTarget as HTMLButtonElement).style.color='#111827'}}>
            ‹ Back
          </button>
          <div style={{fontSize:17,fontWeight:600,color:'#111827'}}>Edit profile</div>
          <button onClick={commitSave} className="rounded-md" style={{border: '1.5px solid #111827', padding: '6px 14px', fontSize:13, fontWeight:600, background:'#fff', color:'#111827', borderRadius:8}} onMouseEnter={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='#111827'; (e.currentTarget as HTMLButtonElement).style.color='#fff'}} onMouseLeave={(e)=>{(e.currentTarget as HTMLButtonElement).style.background='#fff'; (e.currentTarget as HTMLButtonElement).style.color='#111827'}}>
            Save
          </button>
        </header>

        {/* Profile Context */}
        <section style={{background:'#fff', borderBottom: '1px solid #F3F4F6'}} className="flex items-center gap-3 px-5 py-4">
          <div style={{width:40,height:40,borderRadius:999,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:'#E8F5F1',border:'1.5px solid #D1FAE5'}}>
            <span style={{fontSize:15,fontWeight:600,color:'#1A7A5E'}}>{initials}</span>
          </div>
          <div className="flex-1">
            <div style={{fontSize:14,fontWeight:600,color:'#111827', marginBottom:3}}>{(userName ? userName.split(' ')[0] : 'Your')}'s Dietary Profile</div>
            <div className="flex items-center gap-2 flex-wrap">
              {tierCounts.tier1Count > 0 && (
                <div style={{background:'#F5EDED', color:'#8B4A4A', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:500}}>{tierCounts.tier1Count} must avoid</div>
              )}
              {tierCounts.tier2Count > 0 && (
                <div style={{background:'#F5EFE1', color:'#7A5530', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:500}}>{tierCounts.tier2Count} try to avoid</div>
              )}
              {tierCounts.tier3Count > 0 && (
                <div style={{background:'#E5F2EC', color:'#2E6B48', padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:500}}>{tierCounts.tier3Count} preference</div>
              )}
            </div>
          </div>
        </section>

        {/* Restrictions List */}
        <main className="px-5 pt-4 pb-8">
          <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF',letterSpacing:'0.08em',marginBottom:10}}>YOUR RESTRICTIONS</div>

          {[...draftRestrictions]
            .map((r, i) => ({ r, i }))
            .sort((a, b) => (a.r.tier ?? 4) - (b.r.tier ?? 4))
            .map(({ r, i }) => {
            const id = cardIdForIndex(i)
            const expanded = expandedCardId === id
            const severity = r.tier
            const tag = severity === 1 ? {color:'#DC2626', label:'Must avoid'}
              : severity === 2 ? {color:'#D97706', label:'Try to avoid'}
              : {color:'#16A34A', label:'Preference'}
            const leftBorderColor = severity === 1 ? '#FCA5A5' : severity === 2 ? '#FCD34D' : '#86EFAC'

            return (
              <div key={id} className="mb-2 rounded-lg overflow-hidden bg-white" style={{borderTop:'1px solid #E5E7EB', borderRight:'1px solid #E5E7EB', borderBottom:'1px solid #E5E7EB', borderLeft:`3px solid ${leftBorderColor}`, cursor:'pointer'}} onClick={() => toggleExpand(id)}>
                <div style={{padding:'12px 14px', display:'flex', alignItems:'center', gap:10}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
                      <span style={{fontSize:13, fontWeight:600, color:'#111827'}}>{r.name}</span>
                      <div style={{display:'inline-flex', alignItems:'center', gap:6}}>
                        <span style={{fontSize:10, fontWeight:500, color: severity ? tag.color : '#6B7280'}}>{severity ? tag.label : 'Unspecified'}</span>
                        {r.crossContact && (
                          <div style={{display:'inline-flex', alignItems:'center', gap:4}}>
                            <span style={{width:6,height:6,background:'#DC2626',borderRadius:99,display:'inline-block'}} />
                            <span style={{fontSize:11,fontWeight:600,color:'#DC2626'}}>Cross-contact sensitive</span>
                          </div>
                        )}
                        <span style={{fontSize:16,fontWeight:700,color:'#111827', flexShrink:0, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}>&#8250;</span>
                      </div>
                    </div>
                  </div>
                </div>

                {expanded && (
                  <div style={{borderTop:'1px solid #F3F4F6', padding:14, background:'#FAFAFA'}} onClick={(e) => e.stopPropagation()}>
                    {/* Tier selection */}
                    <div style={{fontSize:10,fontWeight:600,color:'#6B7280', textTransform:'uppercase', marginBottom:8}}>How serious is this?</div>
                    <div className="flex flex-col gap-2 mb-3">
                      {[1,2,3].map((t) => {
                        const selected = r.tier === t
                        const rowStyle = selected ? (t===1 ? {borderColor:'#DC2626', background:'#FEF2F2'} : t===2 ? {borderColor:'#D97706', background:'#FFFBEB'} : {borderColor:'#16A34A', background:'#F0FDF4'}) : {borderColor:'#E5E7EB', background:'#fff'}
                        return (
                          <div key={t} onClick={() => handleTierChange(i, t as 1|2|3)} style={{border:'1.5px solid', borderRadius:10, padding:'9px 12px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:9, ...(rowStyle as any)}}>
                            <div style={{width:8,height:8,borderRadius:99,marginTop:3, background: t===1? '#DC2626' : t===2? '#D97706' : '#16A34A'}} />
                            <div>
                              <div style={{fontSize:12,fontWeight:500, color: selected ? (t===1? '#DC2626' : t===2? '#D97706' : '#16A34A') : '#111827'}}>{t===1? 'Must avoid — safety critical' : t===2? 'Try to avoid — causes discomfort' : 'Preference — best effort'}</div>
                              <div style={{fontSize:11,color:'#6B7280', marginTop:4}}>{t===1? 'Even a small amount could cause a serious reaction' : t===2? 'I feel unwell if I eat this' : 'I prefer not to eat this'}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Cross-contact toggle */}
                    <div onClick={() => toggleCrossContact(i)} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderRadius:10, border:'1px solid #E5E7EB', marginBottom:12, background: r.crossContact ? '#FEF2F2' : '#fff', cursor:'pointer'}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:500,color:'#111827'}}>Cross-contact sensitive</div>
                        <div style={{fontSize:11,color:'#6B7280', marginTop:4}}>Trace amounts or shared equipment are a risk</div>
                      </div>
                      <div style={{width:36,height:18,borderRadius:99, position:'relative', background: r.crossContact ? '#DC2626' : '#E5E7EB'}}>
                        <div style={{width:14,height:14,borderRadius:99, background:'#fff', position:'absolute', top:2, left: r.crossContact ? 20 : 2, transition:'transform 0.2s, left 0.2s'}} />
                      </div>
                    </div>

                    {/* Staff note */}
                    <div style={{fontSize:10,fontWeight:600,color:'#6B7280', textTransform:'uppercase', marginTop:12, marginBottom:8}}>Note for staff</div>
                    <textarea value={r.staffNote} onChange={(e) => handleStaffNoteChange(i, e.target.value)} rows={2} style={{width:'100%', resize:'none', border:'1px solid #E5E7EB', borderRadius:8, padding:'9px 11px', fontSize:12, color:'#111827'}} placeholder="e.g. I carry an EpiPen. Please change gloves before handling my food." />

                    {savedIndicator === r.name && (
                      <div style={{marginTop:8, color:'#16A34A', fontSize:11, fontWeight:500}}>✓ Saved</div>
                    )}

                    <div style={{borderTop:'1px solid #F3F4F6', paddingTop:12, marginTop:14, display:'flex', justifyContent:'center'}}>
                      <button onClick={(e) => { e.stopPropagation(); onRequestDelete(id) }} style={{padding:'8px 16px', border:'1px solid #FECACA', borderRadius:8, background:'#FEF2F2', color:'#DC2626', fontSize:12, fontWeight:500}}>🗑 Remove this restriction</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Add restriction card */}
          <div onClick={() => setShowAddSheet(true)} className="mt-1 mb-6" style={{margin:'4px 20px 0', border:'1.5px dashed #D1D5DB', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', background:'#fff'}}>
            <div style={{width:36,height:36,borderRadius:10, background:'#F0FAF7', border:'1px solid #D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, color:'#1A7A5E'}}>+</div>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:'#374151'}}>Add a restriction</div>
              <div style={{fontSize:11,color:'#9CA3AF', marginTop:4}}>Add allergens or dietary preferences</div>
            </div>
          </div>

          {/* Save changes button */}
          <div style={{padding:'0 20px 30px'}}>
            <button onClick={commitSave} disabled={!hasUnsavedChanges} style={{width:'100%', padding:15, background: hasUnsavedChanges ? '#1A7A5E' : '#D1D5DB', color:'#fff', borderRadius:12, fontSize:15, fontWeight:500, border:'none', cursor: hasUnsavedChanges ? 'pointer' : 'default'}}>Save changes</button>
            <div style={{textAlign:'center', marginTop:8, fontSize:11, color:'#9CA3AF'}}>Changes update your passport immediately</div>
          </div>
        </main>
      </div>

      {/* Discard modal */}
      {showDiscardModal && (
        <div onClick={() => setShowDiscardModal(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:40, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div onClick={(e)=>e.stopPropagation()} style={{background:'#fff', borderRadius:16, width:'100%', maxWidth:430, margin:'0 24px', overflow:'hidden'}}>
            <div style={{padding:'20px 20px 0', textAlign:'center'}}>
              <div style={{width:44,height:44,borderRadius:999, background:'#FEF3C7', margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20}}>⚠️</div>
              <div style={{fontSize:16,fontWeight:600,color:'#111827', marginBottom:6}}>Discard changes?</div>
              <div style={{fontSize:13,color:'#6B7280', lineHeight:1.5}}>Your edits won't be saved if you go back.</div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', borderTop:'1px solid #F3F4F6', marginTop:16}}>
              <button onClick={() => setShowDiscardModal(false)} style={{padding:14, fontSize:14, fontWeight:500, color:'#6B7280', background:'none', border:'none', borderRight:'1px solid #F3F4F6'}}>Cancel</button>
              <button onClick={() => { setDraftRestrictions(JSON.parse(JSON.stringify(savedRestrictions))); setHasUnsavedChanges(false); setShowDiscardModal(false); router.push('/student/home') }} style={{padding:14, fontSize:14, fontWeight:600, color:'#DC2626', background:'none', border:'none'}}>Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div onClick={() => setShowDeleteModal(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:40, display:'flex', alignItems:'center', justifyContent:'center'}}>
          <div onClick={(e)=>e.stopPropagation()} style={{background:'#fff', borderRadius:16, width:'100%', maxWidth:430, margin:'0 24px', overflow:'hidden'}}>
            <div style={{padding:'20px 20px 0', textAlign:'center'}}>
              <div style={{width:44,height:44,borderRadius:999, background:'#FEF2F2', margin:'0 auto 12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20}}>🗑</div>
              <div style={{fontSize:16,fontWeight:600,color:'#111827'}}>Remove this restriction?</div>
              <div style={{fontSize:13,color:'#6B7280', lineHeight:1.5}}>This will remove it from your passport and all future orders.</div>
              <div style={{marginTop:10}}>
                {deleteTargetId && (() => {
                  const idx = parseInt(deleteTargetId.replace('card-', ''), 10)
                  const item = draftRestrictions[idx]
                  if (!item) return null
                  return (
                    <div style={{display:'inline-flex', alignItems:'center', gap:5, background:'#FEE2E2', borderRadius:99, padding:'4px 10px', margin:'10px auto', fontSize:12, fontWeight:600, color:'#991B1B'}}>{item.emoji} {item.name}</div>
                  )
                })()}
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', borderTop:'1px solid #F3F4F6', marginTop:16}}>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null) }} style={{padding:14, fontSize:14, fontWeight:500, color:'#6B7280', background:'none', border:'none', borderRight:'1px solid #F3F4F6'}}>Cancel</button>
              <button onClick={confirmDelete} style={{padding:14, fontSize:14, fontWeight:600, color:'#DC2626', background:'none', border:'none'}}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Add sheet */}
      {showAddSheet && (
        <div onClick={() => setShowAddSheet(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:40}}>
          <div onClick={(e)=>e.stopPropagation()} style={{position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:430, background:'#fff', borderRadius:'20px 20px 0 0', zIndex:50, maxHeight:'80vh', overflowY:'auto'}}>
            <div style={{height:12}} />
            <div style={{height:4, width:36, background:'#E5E7EB', borderRadius:99, margin:'12px auto 16px'}} />
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 20px 12px', borderBottom:'1px solid #F3F4F6'}}>
              <div style={{fontSize:16,fontWeight:600,color:'#111827'}}>Add a restriction</div>
              <button onClick={() => setShowAddSheet(false)} style={{fontSize:20,color:'#9CA3AF', background:'none', border:'none'}}>✕</button>
            </div>

            <div>
              <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.07em', padding:'12px 20px 8px'}}>Allergens</div>
              {ALLERGENS.map((name) => {
                const already = draftRestrictions.some(r => r.name === name)
                const selected = addSheetSelected.includes(name)
                return (
                  <div key={name} onClick={() => { if (!already) toggleAddSheetSelection(name) }} style={{display:'flex', alignItems:'center', gap:12, padding:'11px 20px', borderBottom:'1px solid #F9FAFB', cursor: already ? 'default' : 'pointer'}}>
                    <div style={{display:'flex', alignItems:'center', gap:12}}>
                      <span style={{fontSize:18}}>{EMOJI_MAP[name] ?? '🍽️'}</span>
                      <div style={{fontSize:14}}>{name}</div>
                    </div>
                    <div style={{marginLeft:'auto'}}>
                      {already ? <span style={{color:'#16A34A'}}>✓</span> : selected ? <span style={{color:'#1A7A5E'}}>✓</span> : null}
                    </div>
                  </div>
                )
              })}

              <div style={{fontSize:10,fontWeight:600,color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.07em', padding:'12px 20px 8px'}}>Dietary preferences</div>
              {PREFERENCES.map((name) => {
                const already = draftRestrictions.some(r => r.name === name)
                const selected = addSheetSelected.includes(name)
                return (
                  <div key={name} onClick={() => { if (!already) toggleAddSheetSelection(name) }} style={{display:'flex', alignItems:'center', gap:12, padding:'11px 20px', borderBottom:'1px solid #F9FAFB', cursor: already ? 'default' : 'pointer'}}>
                    <div style={{display:'flex', alignItems:'center', gap:12}}>
                      <span style={{fontSize:18}}>{EMOJI_MAP[name] ?? '🍽️'}</span>
                      <div style={{fontSize:14}}>{name}</div>
                    </div>
                    <div style={{marginLeft:'auto'}}>
                      {already ? <span style={{color:'#16A34A'}}>✓</span> : selected ? <span style={{color:'#1A7A5E'}}>✓</span> : null}
                    </div>
                  </div>
                )
              })}

              <div style={{padding:'16px 20px'}}>
                <button onClick={addSelectedRestrictions} disabled={addSheetSelected.length===0} style={{width:'100%', padding:14, borderRadius:12, background: addSheetSelected.length===0 ? '#D1D5DB' : '#1A7A5E', color:'#fff', border:'none', fontSize:14, fontWeight:500}}>Add {addSheetSelected.length} restriction{addSheetSelected.length!==1?'s':''}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
