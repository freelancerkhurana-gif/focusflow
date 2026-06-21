import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { toPng } from 'html-to-image'

// ─── SVG RING COMPONENT ───────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 90

function Ring({ secsLeft, total, color, glow, size, children }) {
  const pct = total > 0 ? secsLeft / total : 1
  const offset = CIRC * (1 - pct)
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ position:'absolute', inset:0, transform:'rotate(-90deg)', filter: `drop-shadow(0 0 20px ${glow})` }}>
        <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"/>
        <circle cx="100" cy="100" r="90" fill="none" stroke={glow} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ filter:'blur(8px) drop-shadow(0 0 15px currentColor)', transition:'stroke-dashoffset 0.6s linear' }}/>
        <circle cx="100" cy="100" r="90" fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transition:'stroke-dashoffset 0.6s linear' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)', borderRadius:'50%' }}>
        {children}
      </div>
    </div>
  )
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PHASE_COLORS = {
  pomodoro:   '#4A1A1A',
  shortBreak: '#1A3A5C',
  longBreak:  '#1A3A5C',
}

const NOISE_OPTIONS = [
  { key: 'white',  label: 'White Noise', pro: false },
  { key: 'pink',   label: 'Pink Noise',  pro: false },
  { key: 'brown',  label: 'Brown Noise', pro: true },
  { key: 'rain',   label: 'Rain',        pro: true },
  { key: 'cafe',   label: 'Café',        pro: true },
  { key: 'forest', label: 'Forest',      pro: true },
]

const WASH_COLORS = [
  { label: 'Black',    bg: '#000000', fg: '#fff' },
  { label: 'White',    bg: '#FFFFFF', fg: '#333' },
  { label: 'Red',      bg: '#BA4949', fg: '#fff' },
  { label: 'Teal',     bg: '#38858A', fg: '#fff' },
  { label: 'Blue',     bg: '#397097', fg: '#fff' },
  { label: 'Forest',   bg: '#2D5A2D', fg: '#fff' },
  { label: 'Lavender', bg: '#9B89C4', fg: '#fff' },
  { label: 'Gold',     bg: '#D4A017', fg: '#333' },
  { label: 'Charcoal', bg: '#36454F', fg: '#fff' },
]

// ─── BACKGROUND IMAGES ──────────────────────────────────────────────────────────
const BG_LIGHT_WORK  = '/light_mode_work.png'
const BG_LIGHT_BREAK = '/light_mode_break.png'
const BG_DARK_WORK   = '/dark_mode_work.png'
const BG_DARK_BREAK  = '/dark_mode_break.png'

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

const fmtHMS = (s) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sc = s % 60
  return h > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(sc).padStart(2,'0')}`
}

const calculateFocusScore = (
  focusSecs,
  completedCycles,
  distractionsCount
) => {
  const focusPoints = Math.floor(focusSecs / 60)
  const cycleBonus = completedCycles * 25
  const distractionPenalty = distractionsCount * 15

  return Math.max(
    0,
    Math.min(
      100,
      focusPoints + cycleBonus - distractionPenalty
    )
  )
}

const getCurrentHour = () => {
  return new Date().getHours()
}

const awardXP = (amount, setXp, setLevel) => {
  setXp(prev => {
    const newXP = prev + amount

    const nextLevel =
      Math.floor(newXP / 500) + 1

    setLevel(nextLevel)

    ls.set('pom_xp', newXP)
    ls.set('pom_level', nextLevel)

    return newXP
  })
}

const addDistraction = (reason, setDistractions, showToast) => {
  const item = {
    id: Date.now(),
    reason,
    timestamp: new Date().toISOString(),
  }

  setDistractions(prev => {
    const updated = [...prev, item]
    ls.set('pom_distractions', updated)
    return updated
  })

  showToast(`Distraction logged: ${reason}`)
}

const checkAchievements = (totalCycles, streak, totalFocusSecs, setAchievements) => {
  const unlocked = []

  if (totalCycles >= 10)
    unlocked.push('10 Pomodoros')

  if (totalCycles >= 50)
    unlocked.push('Focus Machine')

  if (streak >= 7)
    unlocked.push('7 Day Streak')

  if (totalFocusSecs >= 36000)
    unlocked.push('10 Hour Club')

  setAchievements(prev => {
    const merged = [
      ...new Set([...prev, ...unlocked]),
    ]

    ls.set('pom_achievements', merged)

    return merged
  })
}

const updateHeatmap = (seconds, setHeatmapData) => {
  const today = new Date().toISOString().split('T')[0]

  setHeatmapData(prev => {
    const updated = {
      ...prev,
      [today]: (prev[today] || 0) + seconds
    }

    ls.set('pom_heatmap_data', updated)
    return updated
  })
}

const updateHourlyFocus = (seconds, setHourlyFocusData) => {
  const hour = new Date().getHours()

  setHourlyFocusData(prev => {
    const updated = {
      ...prev,
      [hour]: (prev[hour] || 0) + seconds
    }

    ls.set('pom_hourly_focus', updated)
    return updated
  })
}

const generateInsights = (data) => {
  const entries = Object.entries(data || {})

  if (!entries.length) return null

  const bestHour = entries.reduce((a, b) =>
    Number(a[1]) > Number(b[1]) ? a : b
  )

  return {
    bestHour: bestHour[0],
    focusMinutes: Math.round(bestHour[1] / 60),
    generatedAt: new Date().toISOString()
  }
}

const getPlayerTitle = level => {
  if (level >= 100) return 'Focus Emperor'
  if (level >= 75) return 'Deep Work Legend'
  if (level >= 50) return 'Focus Master'
  if (level >= 35) return 'Elite Performer'
  if (level >= 20) return 'Productivity Expert'
  if (level >= 10) return 'Focus Warrior'
  return 'Focus Beginner'
}

const generateCoachMessage = (totalFocusSecs, totalCycles, streak, focusScore, distractions) => {
  const messages = []

  if (totalFocusSecs < 3600) {
    messages.push(
      'You have focused less than 1 hour today. Try completing 2 more sessions.'
    )
  }

  if (totalCycles >= 8) {
    messages.push(
      'Excellent consistency today. You are entering deep work territory.'
    )
  }

  if (streak >= 7) {
    messages.push(
      `Your ${streak} day streak is becoming a powerful habit.` 
    )
  }

  if (focusScore >= 90) {
    messages.push(
      'Outstanding focus score. Keep protecting your attention.'
    )
  }

  if (distractions.length > 5) {
    messages.push(
      'Distractions are increasing. Consider enabling Focus Mode.'
    )
  }

  if (!messages.length) {
    messages.push(
      'Keep building momentum. Small wins compound quickly.'
    )
  }

  return messages
}


const checkBadges = (totalCycles, streak, focusScore) => {
  const earned = []

  if (totalCycles >= 10)
    earned.push('🍅 Pomodoro Rookie')

  if (totalCycles >= 50)
    earned.push('🔥 Focus Machine')

  if (totalCycles >= 100)
    earned.push('⚡ Deep Worker')

  if (streak >= 7)
    earned.push('🏆 Consistency Master')

  if (streak >= 30)
    earned.push('👑 Discipline King')

  if (focusScore >= 95)
    earned.push('🎯 Laser Focus')

  return earned
}

const buildDailyReview = (totalFocusSecs, totalCycles, focusScore, streak) => {
  const review = {
    focusHours: (
      totalFocusSecs / 3600
    ).toFixed(1),

    cycles: totalCycles,

    score: focusScore,

    streak,

    recommendation:
      focusScore < 70
        ? 'Reduce distractions and complete more sessions.'
        : 'Maintain your current momentum.'
  }

  return review
}

const ls = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def } catch { return def } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
}

// ─── STOPWATCH CARD ──────────────────────────────────────────────────────────
function SWCard({ sw, count, bgColor, removeSW, toggleSW, lapSW, resetSW,
  isMobile, editingSwId, editSwName, setEditingSwId, setEditSwName, updateSWField, setTasks }) {
  const isLarge = count === 1
  const isMed = count === 2
  const digitPx = isMobile ? 61 : isLarge ? 86 : isMed ? 74 : 61
  const padV = isLarge ? 10 : isMed ? 8 : 10
  const padH = isLarge ? 16 : isMed ? 14 : 10

  return (
    <div className="timer-card-wrap" style={{
      background: 'rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.18)',
      borderTop: '1px solid rgba(255,255,255,0.3)',
      borderRadius: 24,
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      padding: padV + 'px ' + padH + 'px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      minHeight: 0,
    }}>
      {count > 1 && (
        <button onClick={() => removeSW(sw.id)}
          style={{
            position: 'absolute', top: 8, right: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 14, lineHeight: 1, padding: '2px 7px',
            borderRadius: 20, cursor: 'pointer', zIndex: 2,
          }}
          onMouseEnter={e => e.currentTarget.style.color='#fff'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.5)'}>
          ×
        </button>
      )}

      {/* Top group */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, paddingTop: isLarge ? 18 : isMed ? 14 : 10 }}>
        {editingSwId === sw.id ? (
          <input
            value={editSwName}
            onChange={e => setEditSwName(e.target.value)}
            onBlur={() => {
              const trimmed = (editSwName || sw.name || '').trim()
              if (trimmed) {
                updateSWField(sw.id, 'name', trimmed)
                setTasks(prev => {
                  const exists = prev.find(t => t.swRef === sw.id)
                  if (exists) return prev.map(t => t.swRef === sw.id ? { ...t, name: trimmed } : t)
                  return [...prev, { id: Date.now(), name: trimmed, estimatedPomodoros: 1, completedPomodoros: 0, done: false, swRef: sw.id }]
                })
              }
              setEditingSwId(null)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                const trimmed = (editSwName || sw.name || '').trim()
                if (trimmed) {
                  updateSWField(sw.id, 'name', trimmed)
                  setTasks(prev => {
                    const exists = prev.find(t => t.swRef === sw.id)
                    if (exists) return prev.map(t => t.swRef === sw.id ? { ...t, name: trimmed } : t)
                    return [...prev, { id: Date.now(), name: trimmed, estimatedPomodoros: 1, completedPomodoros: 0, done: false, swRef: sw.id }]
                  })
                }
                setEditingSwId(null)
              }
            }}
            autoFocus
            style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
              fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:6,
              textAlign:'center', letterSpacing:1, width:140 }}
          />
        ) : (
          <div
            onClick={() => { setEditingSwId(sw.id); setEditSwName(sw.name) }}
            style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)',
              letterSpacing:1.5, textTransform:'uppercase', cursor:'pointer',
              padding:'4px 14px', borderRadius:20,
              background:'rgba(255,255,255,0.08)',
              border:'1px solid rgba(255,255,255,0.15)', whiteSpace:'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
            {sw.name}
          </div>
        )}
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 2,
          color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
        }}>
          {sw.running ? 'COUNTING' : sw.elapsed > 0 ? 'PAUSED' : 'READY'}
        </div>
      </div>

      {/* Time display */}
      <div style={{
        fontSize: digitPx,
        fontWeight: 300,
        color: '#fff',
        letterSpacing: -2,
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
        fontFamily: '"Outfit", sans-serif',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        {fmtHMS(sw.elapsed)}
      </div>

      {/* Lap list */}
      <div style={{ width:'100%', maxWidth: 240 }}>
        {sw.laps.slice(-3).map(l => (
          <div key={l.n} style={{
            display:'flex', justifyContent:'space-between',
            fontSize:10, color:'rgba(255,255,255,0.5)',
            padding:'2px 0', borderBottom:'1px solid rgba(255,255,255,0.07)',
            fontFamily:'monospace',
          }}>
            <span>Lap {l.n}</span>
            <span>+{fmtHMS(l.split)}</span>
            <span style={{opacity:.6}}>{fmtHMS(l.total)}</span>
          </div>
        ))}
      </div>

      {/* Bottom group */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, paddingBottom: isLarge ? 18 : isMed ? 14 : 10 }}>
        <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
          <button
            onClick={() => toggleSW(sw.id)}
            style={{
              padding: isLarge ? '10px 32px' : isMed ? '8px 24px' : '7px 18px',
              borderRadius: 100,
              border: '1px solid rgba(255,255,255,0.55)',
              background: 'rgba(255,255,255,0.22)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              color: '#fff',
              fontSize: isLarge ? 14 : isMed ? 12 : 11,
              fontWeight: 700,
              letterSpacing: 2,
              cursor: 'pointer',
              fontFamily: '"Outfit", sans-serif',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 12px rgba(0,0,0,0.2)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.32)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.22)' }}>
            {sw.running ? 'STOP' : 'START'}
          </button>
          <button
            onClick={() => lapSW(sw.id)}
            disabled={!sw.running}
            style={{
              padding: isLarge ? '10px 24px' : isMed ? '8px 18px' : '7px 14px',
              borderRadius: 100,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.12)',
              color: sw.running ? '#fff' : 'rgba(255,255,255,0.3)',
              fontSize: isLarge ? 14 : isMed ? 12 : 11,
              fontWeight: 700,
              cursor: sw.running ? 'pointer' : 'not-allowed',
              opacity: sw.running ? 1 : 0.4,
              fontFamily: '"Outfit", sans-serif',
            }}>
            LAP
          </button>
          <button
            onClick={() => resetSW(sw.id)}
            style={{
              padding: isLarge ? '10px 24px' : isMed ? '8px 18px' : '7px 14px',
              borderRadius: 100,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: isLarge ? 14 : isMed ? 12 : 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "\"Outfit\", sans-serif",
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.18)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.08)' }}>
            ↺
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── TIMER CARD ──────────────────────────────────────────────────────────────
function TimerCard({
  timer, count, isMobile, isDark, bgColor, surfBg, borderCol,
  settings, editingId, editName, setEditingId, setEditName,
  updateTimerField, adjustTimer, toggleTimer, resetTimer,
  changeTimerPhase, setTimerMode, setTasks, removeTimer, setTimers,
  setDistractionTimerId, setShowDistractionLog,
}) {
  const isLarge  = count === 1
  const isMed    = count === 2
  const isSmallGrid = count >= 3
  const digitPx  = isMobile ? 48 : isLarge ? 72 : isMed ? 60 : 48
  const padV     = isLarge ? 10 : isMed ? 8 : 10
  const padH     = isLarge ? 16 : isMed ? 14 : 10

  const modeColor = {
    pomodoro:   '#BA4949',
    shortBreak: '#38858A',
    longBreak:  '#397097',
  }[timer.mode]

  return (
    <div className="timer-card-wrap" style={{
  background: 'rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderTop: '1px solid rgba(255,255,255,0.3)',
  borderRadius: 24,
  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  padding: padV + 'px ' + padH + 'px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 0,
  position: 'relative',
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  minHeight: 0,
}}>
      {/* Delete button */}
      {count > 1 && (
        <button onClick={() => removeTimer(timer.id)}
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 14,
            lineHeight: 1,
            padding: '2px 7px',
            borderRadius: 20,
            cursor: 'pointer',
            zIndex: 2,
          }}
          onMouseEnter={e => e.currentTarget.style.color='#fff'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.5)'}>
          ×
        </button>
      )}

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, paddingTop: isLarge ? 18 : isMed ? 14 : 10 }}>
      {/* Name - editable */}
      {editingId === timer.id ? (
        <input
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={() => {
  const trimmed = (editName || timer.name || '').trim()
  if (trimmed) {
    updateTimerField(timer.id, 'name', trimmed)
    updateTimerField(timer.id, 'task', trimmed)
    setTasks(prev => {
      const exists = prev.find(t => t.timerRef === timer.id)
      if (exists) {
        return prev.map(t => t.timerRef === timer.id ? { ...t, name: trimmed } : t)
      }
      return [...prev, { id: Date.now(), name: trimmed, estimatedPomodoros: 1, completedPomodoros: 0, done: false, timerRef: timer.id }]
    })
  }
  setEditingId(null)
}}
          onKeyDown={e => {
  if (e.key === 'Enter' || e.key === 'Escape') {
    const trimmed = (editName || timer.name || '').trim()
    if (trimmed) {
      updateTimerField(timer.id, 'name', trimmed)
      updateTimerField(timer.id, 'task', trimmed)
      setTasks(prev => {
        const exists = prev.find(t => t.timerRef === timer.id)
        if (exists) {
          return prev.map(t => t.timerRef === timer.id ? { ...t, name: trimmed } : t)
        }
        return [...prev, { id: Date.now(), name: trimmed, estimatedPomodoros: 1, completedPomodoros: 0, done: false, timerRef: timer.id }]
      })
    }
    setEditingId(null)
  }
}}
          autoFocus
          style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:6, textAlign:'center', letterSpacing:1, width:160 }}
        />
      ) : (
        <div
          onClick={() => { setEditingId(timer.id); setEditName(timer.name) }}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.75)',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            cursor: 'pointer',
            padding: '4px 14px',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            textAlign: 'center',
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
          {timer.name}
        </div>
      )}

      {/* Task line */}
      
      {/* Mode tabs - per timer */}
      <div style={{ display:'flex', gap:8 }}>
        <button
          onClick={() => { changeTimerPhase(timer.id, 'pomodoro'); setTimerMode('pomodoro') }}
          style={{
            padding: '6px 20px',
            borderRadius: 100,
            border: timer.mode === 'pomodoro'
              ? (isDark ? 'none' : '1px solid rgba(255,255,255,0.55)')
              : 'none',
            background: timer.mode === 'pomodoro'
              ? 'rgba(255,255,255,0.28)'
              : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 'clamp(10px, 1vw, 13px)',
            fontWeight: 700,
            letterSpacing: 0.5,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 8px rgba(0,0,0,0.15)',
          }}>
          Work
        </button>
        <button
          onClick={() => { changeTimerPhase(timer.id, 'shortBreak'); setTimerMode('shortBreak') }}
          style={{
            padding: '6px 20px',
            borderRadius: 100,
            border: timer.mode !== 'pomodoro'
              ? (isDark ? 'none' : '1px solid rgba(255,255,255,0.55)')
              : 'none',
            background: timer.mode !== 'pomodoro'
              ? 'rgba(255,255,255,0.28)'
              : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 'clamp(10px, 1vw, 13px)',
            fontWeight: 700,
            letterSpacing: 0.5,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 8px rgba(0,0,0,0.15)',
          }}>
          Break
        </button>
      </div>
      </div>

      
      {/* Countdown */}
      <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          marginTop: 0,
          marginBottom: 0,
          width: '100%',
          boxSizing: 'border-box',
          paddingLeft: 6,
          paddingRight: 6,
          overflow: 'visible',
          flexWrap: 'nowrap',
        }}>
        <button onClick={() => !timer.running && updateTimerField(timer.id,'secsLeft',Math.max(60,timer.secsLeft-60))}
          style={{
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)',
  width: 28,
  height: 28,
  borderRadius: '50%',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  lineHeight: 1,
  padding: 0,
  cursor: 'pointer',
}}
          disabled={timer.running}>−</button>

        <div style={{ textAlign:'center' }}>
          <div style={{
  fontSize: isLarge
    ? 'clamp(48px, 8vw, 110px)'
    : isMed
      ? 'clamp(40px, 6vw, 88px)'
      : 'clamp(36px, 5vw, 72px)',
  fontWeight: 300,
  color: '#fff',
  letterSpacing: -2,
  lineHeight: 1,
  userSelect: 'none',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: '"Outfit", sans-serif',
  whiteSpace: 'nowrap',
  flexShrink: 1,
  minWidth: 0,
}}>
            {fmtTime(timer.secsLeft)}
          </div>
        </div>

        <button onClick={() => !timer.running && updateTimerField(timer.id,'secsLeft',Math.min(3600,timer.secsLeft+60))}
          style={{
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.2)',
  color: 'rgba(255,255,255,0.6)',
  width: 28,
  height: 28,
  borderRadius: '50%',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  lineHeight: 1,
  padding: 0,
  cursor: 'pointer',
}}
          disabled={timer.running}>+</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, paddingBottom: isLarge ? 18 : isMed ? 14 : 10 }}>
      <div style={{
  display: 'flex',
  gap: 8,
  justifyContent: 'center',
  width: '100%',
}}>
  <button
    onClick={() => toggleTimer(timer.id)}
    style={{
  padding: isLarge ? '10px 32px' : isMed ? '8px 24px' : '7px 18px',
  borderRadius: 100,
  border: '1px solid rgba(255,255,255,0.55)',
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  color: '#fff',
  fontSize: 'clamp(10px, 1.2vw, 14px)',
  fontWeight: 700,
  letterSpacing: 2,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 12px rgba(0,0,0,0.2)',
  flexShrink: 0,
  transition: 'all 0.15s ease',
  fontFamily: '"Outfit", sans-serif',
}}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.32)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.75)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.55)' }}>
    {timer.running ? 'PAUSE' : 'START'}
  </button>
  <button
    onClick={() => resetTimer(timer.id)}
    style={{
  padding: isLarge ? '10px 32px' : isMed ? '8px 24px' : '7px 18px',
  borderRadius: 100,
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.12)',
  color: '#fff',
  fontSize: 'clamp(10px, 1.2vw, 14px)',
  fontWeight: 700,
  letterSpacing: 1,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.1)',
  flexShrink: 0,
  transition: 'all 0.15s ease',
}}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}>
    ↺ RESET
  </button>
</div>

      {/* Preset pills */}
      <div style={{ display:'flex', gap:6, marginTop:0, marginBottom:0 }}>
        {[{label:'25/5',work:25,brk:5},{label:'30/10',work:30,brk:10},{label:'45/15',work:45,brk:15}].map(p => {
          const active = timer.mode === 'pomodoro'
            ? Math.round((timer.totalSecs || timer.secsLeft) / 60) === p.work
            : Math.round((timer.totalSecs || timer.secsLeft) / 60) === p.brk
          return (
            <button
              key={p.label}
              disabled={timer.running}
              onClick={() => {
                const secs = timer.mode === 'pomodoro' ? p.work * 60 : p.brk * 60
                setTimers(prev => prev.map(t => t.id === timer.id ? {
                  ...t,
                  secsLeft: secs,
                  totalSecs: secs,
                  workMin: p.work,
                  breakMin: p.brk,
                } : t))
              }}
              style={{
                padding: '3px 11px',
                borderRadius: 100,
                border: `1px solid ${active ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}`,
                background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: 11,
                fontWeight: 700,
                cursor: timer.running ? 'not-allowed' : 'pointer',
                opacity: timer.running ? 0.35 : 1,
                transition: 'all 0.2s ease',
                letterSpacing: 0.3,
              }}>
              {p.label}
            </button>
          )
        })}
      </div>
      <div style={{ display:'flex', justifyContent:'center', marginTop:6 }}>
        <button
          onClick={() => {
            if (timer.running) return
            updateTimerField(timer.id, 'secsLeft', 120)
            updateTimerField(timer.id, 'totalSecs', 120)
            toggleTimer(timer.id)
          }}
          disabled={timer.running}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.6)',
            padding: '6px 21px',
            borderRadius: 100,
            fontSize: 15,
            fontWeight: 600,
            cursor: timer.running ? 'not-allowed' : 'pointer',
            opacity: timer.running ? 0.35 : 1,
            letterSpacing: 0.3,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { if (!timer.running) e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}>
          ⚡ Just 2 minutes — start now
        </button>
      </div>
      {timer.running && (
        <button
          onClick={() => { setDistractionTimerId(timer.id); setShowDistractionLog(true) }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 10,
            marginTop: 4,
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
          }}>
          Got distracted?
        </button>
      )}
      </div>

            </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {

  // ── TAB ──
  const [tab, setTab] = useState('timer') // timer | sounds | notes | stopwatch | stats

  // ── TIMER MODE ── (which phase preset is selected in the top nav)
  const [timerMode, setTimerMode] = useState('pomodoro') // pomodoro | shortBreak | longBreak
  const [globalMode, setGlobalMode] = useState('pomodoro')

  // ── SETTINGS ──
  const [settings, setSettings] = useState(() => ls.get('pom_settings', {
    pomodoroMin: 25, shortBreakMin: 5, longBreakMin: 15,
    longBreakEvery: 4, autoStartBreaks: false, autoStartPomodoros: false,
    alarmSound: true, browserNotifs: true,
    dailyGoalHours: 4,
  }))
  const [showSettings, setShowSettings] = useState(false)
  const [tempSettings, setTempSettings] = useState(settings)

  // ── ADVANCED ANALYTICS ──
  const [sessionHistory, setSessionHistory] = useState(() =>
    ls.get('pom_session_history', [])
  )
  const [focusScore, setFocusScore] = useState(() =>
    ls.get('pom_focus_score', 0)
  )
  const [distractions, setDistractions] = useState(() =>
    ls.get('pom_distractions', [])
  )
  const [dailyStats, setDailyStats] = useState(() =>
    ls.get('pom_daily_stats', {})
  )
  const [productivityHeatmap, setProductivityHeatmap] = useState(() =>
    ls.get('pom_heatmap', {})
  )
  const [achievements, setAchievements] = useState(() =>
    ls.get('pom_achievements', [])
  )
  const [level, setLevel] = useState(() =>
    ls.get('pom_level', 1)
  )
  const [xp, setXp] = useState(() =>
    ls.get('pom_xp', 0)
  )
  const [heatmapData, setHeatmapData] = useState(() =>
    ls.get('pom_heatmap_data', {})
  )
  const [hourlyFocusData, setHourlyFocusData] = useState(() =>
    ls.get('pom_hourly_focus', {})
  )
  const [weeklyInsights, setWeeklyInsights] = useState(() =>
    ls.get('pom_weekly_insights', {})
  )
  const [coachMessages, setCoachMessages] = useState(() =>
    ls.get('pom_coach_messages', [])
  )
  const [dailyReview, setDailyReview] = useState(() =>
    ls.get('pom_daily_review', null)
  )
  const [badges, setBadges] = useState(() =>
    ls.get('pom_badges', [])
  )
  const [playerTitle, setPlayerTitle] = useState(() =>
    ls.get('pom_player_title', 'Focus Beginner')
  )

  // ── THEME ──

  // ── MULTI TIMERS ──
  const makeTimer = (id, num) => ({
    id, num,
    name: `Timer ${num}`,
    task: '',
    mode: 'pomodoro',
    secsLeft: settings.pomodoroMin * 60,
    totalSecs: settings.pomodoroMin * 60,
    workMin: settings.pomodoroMin,
    breakMin: settings.shortBreakMin,
    running: false,
    cyclesDone: 0,
    totalFocusSecs: 0,
    totalBreakSecs: 0,
  })
  const [timers, setTimers] = useState(() => [makeTimer(1, 1)])
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editingSwId, setEditingSwId] = useState(null)
  const [editSwName, setEditSwName] = useState('')
  const timerRefs = useRef({})   // id → intervalId

  // ── STOPWATCHES ──
  const makeSW = (id, num) => ({ id, num, name: `Stopwatch ${num}`, elapsed: 0, running: false, laps: [] })
  const [stopwatches, setStopwatches] = useState(() => [makeSW(1, 1)])
  const swRefs = useRef({})

  // ── TASKS ──
  const [tasks, setTasks] = useState(() => ls.get('pom_tasks', []))
  const [newTask, setNewTask] = useState('')
  const [newTaskEst, setNewTaskEst] = useState(1)
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [showTaskMenu, setShowTaskMenu] = useState(null)
  const [templates, setTemplates] = useState(() => ls.get('pom_templates', []))

  // ── AMBIENT NOISE ──
  const [noiseKey, setNoiseKey] = useState('brown')
  const [noiseOn, setNoiseOn] = useState(false)
  const [volume, setVolume] = useState(0.4)
  const audioCtx = useRef(null)
  const gainNode = useRef(null)
  const noiseNode = useRef(null)

  // ── NOTES ──
  const [note, setNote] = useState(() => ls.get('pom_note', ''))

  // ── STREAK ──
  const [streak, setStreak] = useState(() => ls.get('pom_streak', 0))
  const streakFreezesLeft = (() => {
    const thisMonth = new Date().toISOString().slice(0,7)
    const freezeData = ls.get('pom_streak_freezes', { month: thisMonth, used: 0 })
    if (freezeData.month !== thisMonth) return 2
    return Math.max(0, 2 - freezeData.used)
  })()

  const weeklyStats = (() => {
    const days = []
    let weekTotal = 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const secs = heatmapData[key] || 0
      weekTotal += secs
      days.push({ date: d, secs })
    }
    const bestDay = days.reduce((a, b) => b.secs > a.secs ? b : a, days[0])
    const activeDays = days.filter(d => d.secs > 0).length
    return { days, weekTotal, bestDay, activeDays }
  })()

  // ── SUPABASE AUTH ──
  const [user, setUser] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading, setLbLoading] = useState(false)

  // ── PRO ──
  const [isPro, setIsPro] = useState(() => ls.get('pom_pro', false))
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [activeFocusCount, setActiveFocusCount] = useState(0)
  const sessionIdRef = useRef(
    ls.get('pom_session_id', null) || (() => {
      const id = 'sess_' + Math.random().toString(36).slice(2) + Date.now()
      ls.set('pom_session_id', id)
      return id
    })()
  )

  useEffect(() => {
    if (!user) {
      setIsPro(false)
      ls.set('pom_pro', false)
      return
    }
    supabase
      .from('subscriptions')
      .select('status, pro_until, source')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) { setIsPro(false); ls.set('pom_pro', false); return }
        let active = data.status === 'active'
        if (active && data.source === 'referral' && data.pro_until) {
          active = new Date(data.pro_until) > new Date()
        }
        setIsPro(active)
        ls.set('pom_pro', active)
      })
      .catch(() => {
        setIsPro(false)
        ls.set('pom_pro', false)
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const refId = params.get('ref')
    if (!refId || refId === user.id) return

    const alreadyProcessed = ls.get('pom_referral_processed', false)
    if (alreadyProcessed) return

    fetch('/api/process-referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrerId: refId, referredId: user.id }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          ls.set('pom_referral_processed', true)
          showToast('🎉 You and your friend both got 1 month of Pro free!')
          setIsPro(true)
          ls.set('pom_pro', true)
        }
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    const anyRunning = (timers || []).some(t => t.running)

    const pingPresence = async () => {
      if (!anyRunning) return
      try {
        await supabase.from('active_sessions').upsert({
          session_id: sessionIdRef.current,
          last_seen: new Date().toISOString(),
        }, { onConflict: 'session_id' })
      } catch {}
    }

    const fetchCount = async () => {
      try {
        const cutoff = new Date(Date.now() - 90 * 1000).toISOString()
        const { count } = await supabase
          .from('active_sessions')
          .select('*', { count: 'exact', head: true })
          .gte('last_seen', cutoff)
        setActiveFocusCount(count || 0)
      } catch {}
    }

    pingPresence()
    fetchCount()

    const interval = setInterval(() => {
      pingPresence()
      fetchCount()
    }, 30000)

    return () => clearInterval(interval)
  }, [timers])

  // ── UI ──
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const [showKeyHelp, setShowKeyHelp] = useState(false)
  const [showOnboard, setShowOnboard] = useState(false)
  const [onboardStep, setOnboardStep] = useState(1)
  const [showDistractionLog, setShowDistractionLog] = useState(false)
  const [distractionTimerId, setDistractionTimerId] = useState(null)
  const [customDistraction, setCustomDistraction] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [vw, setVw] = useState(window.innerWidth)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [focusMode, setFocusMode] = useState(false)

  // ── SOUNDCLOUD PLAYER ──
  const scWidget = useRef(null)
  const scIframe = useRef(null)
  const [scPlaying, setScPlaying] = useState(false)
  const [scReady, setScReady] = useState(false)

  // ── AI COACH CHAT ──
  const [coachChatOpen, setCoachChatOpen] = useState(false)
  const [coachMessages2, setCoachMessages2] = useState(() => ls.get('pom_coach_chat', []))
  const [coachInput, setCoachInput] = useState('')
  const [coachTyping, setCoachTyping] = useState(false)

  // ── MOOD TRACKING ──
  const [sessionMoods, setSessionMoods] = useState(() => ls.get('pom_session_moods', []))
  const [showMoodPrompt, setShowMoodPrompt] = useState(null) // holds timer id or null
  const [dailyInsightText, setDailyInsightText] = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)
  const [showReportCard, setShowReportCard] = useState(false)
  const reportCardRef = useRef(null)

  // ── THEME: background changes with timerMode ──
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('pom_theme_dark')
    return saved !== null ? JSON.parse(saved) : false
  })
  const [loadedBgImages, setLoadedBgImages] = useState(() => new Set([currentBgImage]))

  useEffect(() => {
    setLoadedBgImages(prev => new Set([...prev, currentBgImage]))
  }, [currentBgImage])
  const bgColor = isDark ? '#0a0a0a' : 'transparent'
  const accentColor = isDark ? '#1a1a1a' : bgColor
  const currentBgImage = isDark
    ? (timerMode === 'shortBreak' || timerMode === 'longBreak'
        ? BG_DARK_BREAK
        : BG_DARK_WORK)
    : (timerMode === 'shortBreak' || timerMode === 'longBreak'
        ? BG_LIGHT_BREAK
        : BG_LIGHT_WORK)
  const meshOpacity = isDark ? 0 : 1
  const textMain = '#fff'
  const textDim = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.7)'
  const textFaint = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.4)'
  const surfBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.18)'
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.12)'

  // ─── DERIVED ─────────────────────────────────────────────────────────────────
  const totalFocusSecs = (timers || []).reduce((s, t) => s + (t.totalFocusSecs || 0), 0)
  const totalBreakSecs = (timers || []).reduce((s, t) => s + (t.totalBreakSecs || 0), 0)
  const totalCycles    = (timers || []).reduce((s, t) => s + (t.cyclesDone || 0), 0)
  const activeTask     = (tasks || []).find(t => t.id === activeTaskId)
  const pendingTasks   = (tasks || []).filter(t => !t.done)

  // ─── SUPABASE ────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) upsertProfile(session.user)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('coach_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const loaded = data.map(d => ({ role: d.role, text: d.message, ts: new Date(d.created_at).getTime() }))
          setCoachMessages2(loaded)
        }
      })
  }, [user])

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: window.location.origin }
  })
  const signOut = () => {
    supabase.auth.signOut()
    setUser(null)
    setIsPro(false)
    ls.set('pom_pro', false)
  }

  const startCheckout = async () => {
    if (!user) {
      showToast('Please sign in first to upgrade')
      signIn()
      return
    }
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      })
      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        showToast('Could not start checkout. Try again.')
      }
    } catch (err) {
      console.error('Checkout error:', err)
      showToast('Could not start checkout. Try again.')
    }
  }

  const logDistraction = (reason) => {
    addDistraction(reason, setDistractions, showToast)
    setShowDistractionLog(false)
    setCustomDistraction('')
  }

  const logSessionMood = (mood) => {
    setSessionMoods(prev => [...prev, { mood, ts: Date.now() }])
    setShowMoodPrompt(null)
  }

  const copyInviteLink = () => {
    if (!user) { showToast('Sign in to get your invite link'); signIn(); return }
    const link = `https://www.pomodoros.io/?ref=${user.id}` 
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true)
      showToast('Invite link copied!')
      setTimeout(() => setInviteCopied(false), 2000)
    })
  }

  const upsertProfile = async (u) => {
    await supabase.from('profiles').upsert({
      id: u.id,
      username: u.user_metadata?.full_name || u.email?.split('@')[0],
      avatar_url: u.user_metadata?.avatar_url,
    }, { onConflict: 'id' })
  }

  const syncToCloud = async () => {
    if (!user) return
    await supabase.from('focus_sessions').insert({
      user_id: user.id,
      total_work_seconds: totalFocusSecs,
      total_break_seconds: totalBreakSecs,
      total_cycles: totalCycles,
      session_date: new Date().toISOString().split('T')[0],
    })
    showToast('Stats synced to cloud ☁️')
  }

  const toggleScPlay = () => {
    if (!scWidget.current) return
    if (scPlaying) scWidget.current.pause()
    else scWidget.current.play()
  }

  const scNext = () => {
    if (!scWidget.current) return
    scWidget.current.next()
  }

  const loadLeaderboard = async () => {
    setLbLoading(true)
    const { data } = await supabase
      .from('weekly_leaderboard')
      .select('*')
      .order('total_focus_seconds', { ascending: false })
      .limit(100)
    setLeaderboard(data || [])
    setLbLoading(false)
  }

  // ─── TOAST ───────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ─── STREAK ──────────────────────────────────────────────────────────────────
  const bumpStreak = useCallback(() => {
    const today = new Date().toDateString()
    const lastDate = ls.get('pom_lastDate', '')
    if (lastDate === today) return

    const yest = new Date(Date.now() - 86400000).toDateString()
    const twoDaysAgo = new Date(Date.now() - 2*86400000).toDateString()

    const thisMonth = new Date().toISOString().slice(0,7)
    let freezeData = ls.get('pom_streak_freezes', { month: thisMonth, used: 0 })
    if (freezeData.month !== thisMonth) freezeData = { month: thisMonth, used: 0 }
    const freezesAvailable = Math.max(0, 2 - freezeData.used)

    let next
    let usedFreeze = false

    if (lastDate === yest) {
      // consecutive day, normal increment
      next = streak + 1
    } else if (lastDate === twoDaysAgo && freezesAvailable > 0) {
      // missed exactly one day, but a freeze covers it
      next = streak + 1
      usedFreeze = true
      freezeData.used += 1
      ls.set('pom_streak_freezes', freezeData)
    } else if (lastDate === '') {
      // first ever session
      next = 1
    } else {
      // missed too many days or no freezes left, reset
      next = 1
    }

    setStreak(next)
    ls.set('pom_streak', next)
    ls.set('pom_lastDate', today)

    if (usedFreeze) {
      showToast(`🧊 Streak freeze used — ${next} day streak protected!`)
    } else if (next > 1) {
      showToast(`🔥 ${next} day streak!`)
    }
  }, [streak, showToast])

  // ─── AUDIO ───────────────────────────────────────────────────────────────────
  const buildNoiseBuffer = (ctx, key) => {
    const size = ctx.sampleRate * 4
    const buf  = ctx.createBuffer(1, size, ctx.sampleRate)
    const data = buf.getChannelData(0)
    if (key === 'white') {
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1
    } else if (key === 'brown') {
      let last = 0
      for (let i = 0; i < size; i++) {
        const w = Math.random() * 2 - 1
        data[i] = (last + 0.02 * w) / 1.02
        last = data[i]; data[i] *= 3.5
      }
    } else {
      // pink (also used as base for rain/cafe/forest with filter)
      let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
      for (let i = 0; i < size; i++) {
        const w = Math.random() * 2 - 1
        b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759
        b2=.96900*b2+w*.1538520; b3=.86650*b3+w*.3104856
        b4=.55000*b4+w*.5329522; b5=-.7616*b5-w*.0168980
        data[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11; b6=w*.115926
      }
    }
    return buf
  }

  const stopNoise = useCallback(() => {
    try { noiseNode.current?.stop() } catch {}
    noiseNode.current = null
  }, [])

  const playNoise = useCallback((key, vol) => {
    stopNoise()
    if (!audioCtx.current || audioCtx.current.state === 'closed')
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)()
    const ctx = audioCtx.current
    if (ctx.state === 'suspended') ctx.resume()
    if (!gainNode.current || gainNode.current.context !== ctx) {
      gainNode.current = ctx.createGain()
      gainNode.current.connect(ctx.destination)
    }
    gainNode.current.gain.setValueAtTime(vol, ctx.currentTime)
    const buf = buildNoiseBuffer(ctx, ['rain','cafe','forest'].includes(key) ? 'pink' : key)
    const src = ctx.createBufferSource()
    src.buffer = buf; src.loop = true
    if (['rain','cafe','forest'].includes(key)) {
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = key === 'rain' ? 600 : key === 'cafe' ? 1000 : 800
      src.connect(f); f.connect(gainNode.current)
    } else {
      src.connect(gainNode.current)
    }
    src.start()
    noiseNode.current = src
  }, [stopNoise])

  useEffect(() => {
    if (noiseOn) playNoise(noiseKey, volume)
    else stopNoise()
  }, [noiseOn, noiseKey, volume, playNoise, stopNoise])

  // update gain when volume changes without restarting
  useEffect(() => {
    if (gainNode.current) gainNode.current.gain.value = volume
  }, [volume])

  const beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3)
      g.gain.setValueAtTime(0.4, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
      osc.start(); osc.stop(ctx.currentTime + 0.65)
    } catch {}
  }

  // ─── CONFETTI ────────────────────────────────────────────────────────────────
  const confetti = () => {
    const colors = ['#BA4949','#38858A','#FFD700','#fff','#34C77B']
    for (let i = 0; i < 50; i++) {
      const el = document.createElement('div')
      el.style.cssText = `position:fixed;width:${4+Math.random()*7}px;height:${4+Math.random()*7}px;background:${colors[i%colors.length]};left:${Math.random()*100}vw;top:-10px;border-radius:50%;z-index:99999;pointer-events:none;animation:cfall ${1+Math.random()*2}s ease-in forwards;animation-delay:${Math.random()*0.5}s`
      document.body.appendChild(el)
      setTimeout(() => el.remove(), 3000)
    }
  }

  // ─── MULTI TIMER LOGIC ───────────────────────────────────────────────────────
  const clearTimerInterval = (id) => {
    clearInterval(timerRefs.current[id])
    delete timerRefs.current[id]
  }

  const addTimer = () => {
    const limit = isPro ? 4 : 1
    if (timers.length >= limit) {
      if (!isPro) {
        showToast('Free plan allows 1 timer. Upgrade to Pro for up to 4.')
        setShowUpgrade(true)
      } else {
        showToast('Maximum 4 timers')
      }
      return
    }
    const id  = Date.now()
    const num = timers.length + 1
    const grid = document.querySelector('.timer-grid')
    if (grid) {
      grid.style.transition = 'grid-template-columns 0.45s cubic-bezier(0.4,0,0.2,1)'
      setTimeout(() => { if (grid) grid.style.transition = '' }, 500)
    }
    setTimers(prev => [...prev, makeTimer(id, num)])
  }

  const removeTimer = (id) => {
    clearTimerInterval(id)
    const grid = document.querySelector('.timer-grid')
    if (grid) {
      grid.style.transition = 'grid-template-columns 0.45s cubic-bezier(0.4,0,0.2,1)'
      setTimeout(() => { if (grid) grid.style.transition = '' }, 500)
    }
    setTimers(prev => (prev || []).filter(t => t.id !== id))
  }

  const startTimer = useCallback((id) => {
    if (timerRefs.current[id]) return
    bumpStreak()
    timerRefs.current[id] = setInterval(() => {
      setTimers(prev => (prev || []).map(t => {
        if (t.id !== id) return t
        // tick
        if (t.secsLeft > 1) {
          const upd = { ...t, secsLeft: t.secsLeft - 1 }
          if (t.mode === 'pomodoro') upd.totalFocusSecs = t.totalFocusSecs + 1
          else upd.totalBreakSecs = t.totalBreakSecs + 1
          return upd
        }
        // session complete
        clearInterval(timerRefs.current[id])
        delete timerRefs.current[id]
        beep()
        const isPomodoro = t.mode === 'pomodoro'
        const newCycles = isPomodoro ? t.cyclesDone + 1 : t.cyclesDone
        confetti()
        showToast(isPomodoro ? `🍅 ${t.name} complete! Take a break.` : `⚡ Break over - back to focus!`)
        if (isPomodoro) {
          setTimeout(() => setShowMoodPrompt(id), 800)
        }
        // determine next mode
        let nextMode
        if (isPomodoro) {
          nextMode = newCycles % settings.longBreakEvery === 0 ? 'longBreak' : 'shortBreak'
        } else {
          nextMode = 'pomodoro'
        }
        setTimerMode(nextMode === 'pomodoro' ? 'pomodoro' : 'shortBreak')
        const timerWorkMin = t.workMin || settings.pomodoroMin
        const timerBreakMin = t.breakMin || settings.shortBreakMin
        const nextSecs = nextMode === 'pomodoro'
          ? timerWorkMin * 60
          : timerBreakMin * 60
        const upd = {
          ...t,
          running: false,
          mode: nextMode,
          secsLeft: nextSecs,
          cyclesDone: newCycles,
          totalSecs: nextSecs,
          totalFocusSecs: isPomodoro ? t.totalFocusSecs + 1 : t.totalFocusSecs,
          totalBreakSecs: !isPomodoro ? t.totalBreakSecs + 1 : t.totalBreakSecs,
        }
        return upd
      }))
    }, 1000)
  }, [bumpStreak, showToast, settings])

  const pauseTimer = useCallback((id) => {
    clearTimerInterval(id)
    setTimers(prev => (prev || []).map(t => t.id === id ? { ...t, running: false } : t))
  }, [])

  const resetTimer = useCallback((id) => {
    clearTimerInterval(id)
    setTimers(prev => (prev || []).map(t => {
      if (t.id !== id) return t
      const workMin = t.workMin || settings.pomodoroMin
      const breakMin = t.breakMin || settings.shortBreakMin
      const secs = t.mode === 'pomodoro' ? workMin * 60 : breakMin * 60
      return { ...t, running: false, secsLeft: secs, totalSecs: secs }
    }))
  }, [settings])

  const toggleTimer = useCallback((id) => {
    setTimers(prev => (prev || []).map(t => {
      if (t.id !== id) return t
      if (t.running) { pauseTimer(id); return { ...t, running: false } }
      else { startTimer(id); return { ...t, running: true } }
    }))
  }, [pauseTimer, startTimer])

  const changeTimerPhase = useCallback((id, mode) => {
    clearTimerInterval(id)
    setTimers(prev => (prev || []).map(t => {
      if (t.id !== id) return t
      const workMin = t.workMin || settings.pomodoroMin
      const breakMin = t.breakMin || settings.shortBreakMin
      const secs = mode === 'pomodoro' ? workMin * 60 : breakMin * 60
      return { ...t, running: false, mode, secsLeft: secs, totalSecs: secs }
    }))
  }, [settings])

  const updateTimerField = useCallback((id, field, val) => {
    setTimers(prev => (prev || []).map(t => t.id === id ? { ...t, [field]: val } : t))
  }, [])

  const adjustTimer = useCallback((id, delta) => {
    setTimers(prev => (prev || []).map(t => {
      if (t.id !== id || t.running) return t
      const s = Math.max(60, Math.min(3600, t.secsLeft + delta))
      return { ...t, secsLeft: s, totalSecs: s }
    }))
  }, [])

  // ─── STOPWATCH LOGIC ─────────────────────────────────────────────────────────
  const updateSWField = useCallback((id, field, val) => {
    setStopwatches(prev => (prev || []).map(s => s.id === id ? { ...s, [field]: val } : s))
  }, [])

  const addStopwatch = () => {
    const limit = isPro ? 4 : 1
    if (stopwatches.length >= limit) {
      if (!isPro) {
        showToast('Free plan allows 1 stopwatch. Upgrade to Pro for up to 4.')
        setShowUpgrade(true)
      } else {
        showToast('Maximum 4 stopwatches')
      }
      return
    }
    const id = Date.now()
    setStopwatches(prev => [...prev, makeSW(id, prev.length + 1)])
  }

  const removeSW = useCallback((id) => {
    clearInterval(swRefs.current[id])
    delete swRefs.current[id]
    setStopwatches(prev => prev.filter(s => s.id !== id))
  }, [])

  const toggleSW = useCallback((id) => {
    setStopwatches(prev => {
      const sw = prev.find(s => s.id === id)
      if (!sw) return prev

      if (sw.running) {
        // PAUSE — clear interval and mark not running
        clearInterval(swRefs.current[id])
        delete swRefs.current[id]
        return prev.map(s => s.id === id ? { ...s, running: false } : s)
      } else {
        // START — capture elapsed at this moment, then tick
        const elapsed = sw.elapsed
        const startedAt = Date.now() - elapsed * 1000
        // clear any stale interval first
        clearInterval(swRefs.current[id])
        swRefs.current[id] = setInterval(() => {
          const newElapsed = Math.floor((Date.now() - startedAt) / 1000)
          setStopwatches(p => p.map(s =>
            s.id === id ? { ...s, elapsed: newElapsed } : s
          ))
        }, 1000)
        return prev.map(s => s.id === id ? { ...s, running: true } : s)
      }
    })
  }, [])

  const lapSW = useCallback((id) => {
    setStopwatches(prev => prev.map(s => {
      if (s.id !== id || !s.running) return s
      const prevTotal = s.laps.length ? s.laps[s.laps.length - 1].total : 0
      return {
        ...s,
        laps: [...s.laps, {
          n: s.laps.length + 1,
          split: s.elapsed - prevTotal,
          total: s.elapsed
        }]
      }
    }))
  }, [])

  const resetSW = useCallback((id) => {
    clearInterval(swRefs.current[id])
    delete swRefs.current[id]
    setStopwatches(prev => prev.map(s =>
      s.id === id ? { ...s, elapsed: 0, running: false, laps: [] } : s
    ))
  }, [])

  // ─── KEYBOARD ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); if (timers[0]) toggleTimer(timers[0].id) }
      if (e.code === 'KeyR' && !e.ctrlKey) { if (timers[0]) resetTimer(timers[0].id) }
      if (e.code === 'KeyN') setNoiseOn(p => !p)
      const tabMap = { Digit1:'timer', Digit2:'sounds', Digit3:'notes', Digit4:'stopwatch', Digit5:'stats' }
      if (tabMap[e.code]) setTab(tabMap[e.code])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [timers, toggleTimer, resetTimer])

  // ─── FOCUS MODE ESCAPE KEY ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  // ─── RESIZE ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => { setIsMobile(window.innerWidth < 768); setVw(window.innerWidth) }
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // ─── PWA ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  // ─── PERSIST ─────────────────────────────────────────────────────────────────
  useEffect(() => { ls.set('pom_tasks', tasks) }, [tasks])
  useEffect(() => { ls.set('pom_templates', templates) }, [templates])
  useEffect(() => { ls.set('pom_settings', settings) }, [settings])
  useEffect(() => { ls.set('pom_note', note) }, [note])
  useEffect(() => { ls.set('pom_coach_chat', coachMessages2) }, [coachMessages2])
  useEffect(() => { ls.set('pom_distractions', distractions) }, [distractions])
  useEffect(() => { ls.set('pom_session_moods', sessionMoods) }, [sessionMoods])
  useEffect(() => {
    localStorage.setItem('pom_theme_dark', JSON.stringify(isDark))
  }, [isDark])

  // ─── FOCUS SCORE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const score = calculateFocusScore(
      totalFocusSecs,
      totalCycles,
      distractions.length
    )

    setFocusScore(score)

    ls.set('pom_focus_score', score)
  }, [
    totalFocusSecs,
    totalCycles,
    distractions
  ])

  // ─── AUTO TRACKING ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const running = (timers || []).filter(
        t => t.running && t.mode === 'pomodoro'
      )

      if (!running.length) return

      updateHeatmap(running.length, setHeatmapData)
      updateHourlyFocus(running.length, setHourlyFocusData)
    }, 1000)

    return () => clearInterval(interval)
  }, [timers, setHeatmapData, setHourlyFocusData])

  // ─── INSIGHTS ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const insights = generateInsights(hourlyFocusData)
    if (insights) {
      setWeeklyInsights(insights)
      ls.set('pom_weekly_insights', insights)
    }
  }, [hourlyFocusData])

  useEffect(() => {
    setDailyInsightText(generateDailyInsight())
  }, [])

  // ─── AI COACH CHAT FUNCTIONS ─────────────────────────────────────────────────────
  const generateDailyInsight = () => {
    const today = new Date().toDateString()
    const cached = ls.get('pom_daily_insight', null)
    if (cached && cached.date === today) return cached.text

    const insights = []

    // Best hour from existing weeklyInsights
    if (weeklyInsights.bestHour) {
      insights.push(`Your best focus hour is around ${weeklyInsights.bestHour}:00 — try scheduling your hardest task then.`)
    }

    // Mood trend
    if (sessionMoods.length >= 3) {
      const recent = sessionMoods.slice(-5)
      const goodCount = recent.filter(m => m.mood === 'Good' || m.mood === 'Great').length
      if (goodCount >= 4) {
        insights.push(`Your last few sessions felt great — whatever you're doing right now is working.`)
      } else if (goodCount <= 1) {
        insights.push(`Your recent sessions have felt tough. Try a shorter 2-minute session to rebuild momentum.`)
      }
    }

    // Distraction pattern
    if (distractions.length >= 3) {
      const counts = {}
      distractions.forEach(d => { counts[d.reason] = (counts[d.reason] || 0) + 1 })
      const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0]
      if (top) {
        insights.push(`"${top[0]}" has pulled you away ${top[1]} times recently — worth putting it out of reach before your next session?`)
      }
    }

    // Streak status
    if (streak >= 3) {
      insights.push(`You're on a ${streak}-day streak. One more session today keeps it alive.`)
    } else if (streak === 0 && totalFocusSecs === 0) {
      insights.push(`A fresh day. Even a single 2-minute session counts as a win — want to start one now?`)
    }

    // Heatmap-based day-of-week pattern
    const dayOfWeek = new Date().getDay()
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const sameDayEntries = Object.entries(heatmapData).filter(([date]) => new Date(date).getDay() === dayOfWeek)
    if (sameDayEntries.length >= 3) {
      const avgSecs = sameDayEntries.reduce((s,[,v]) => s+v, 0) / sameDayEntries.length
      if (avgSecs > 1800) {
        insights.push(`${dayNames[dayOfWeek]}s tend to be one of your stronger focus days. Make the most of it.`)
      }
    }

    const text = insights.length > 0
      ? insights[Math.floor(Math.random() * insights.length)]
      : `Ready when you are. Pick a task and start your first session of the day.` 

    ls.set('pom_daily_insight', { date: today, text })
    return text
  }

  const generateCoachReply = (userMsg) => {
    const msg = userMsg.toLowerCase()
    const remaining = pendingTasks
    const hoursLeft = Math.max(0, settings.dailyGoalHours - totalFocusSecs/3600)

    // Planning / scheduling requests
    if (msg.includes('plan') || msg.includes('schedule') || msg.includes('organize')) {
      if (remaining.length === 0) {
        return "You don't have any tasks listed yet. Add a few tasks below and tell me your deadline — I'll help you break them into focused Pomodoro blocks."
      }
      const totalPomos = remaining.reduce((s,t) => s + ((t.estimatedPomodoros||1) - (t.completedPomodoros||0)), 0)
      const totalMins = totalPomos * settings.pomodoroMin
      return `You have ${remaining.length} task(s) left, roughly ${totalPomos} Pomodoro session(s) (~${Math.round(totalMins/60*10)/10}h). I'd suggest tackling "${remaining[0].name}" first since it's at the top of your list — start with one ${settings.pomodoroMin}-min focus block, then a ${settings.shortBreakMin}-min break. Want me to suggest an order based on urgency?` 
    }

    // Motivation requests
    if (msg.includes('motivat') || msg.includes('tired') || msg.includes('stuck') || msg.includes('procrastinat') || msg.includes("don't want") || msg.includes('dont want')) {
      const lines = [
        `Totally normal to feel this way. You've already focused ${fmtTime(totalFocusSecs)} today — that's real progress. Try just ONE more 10-minute block. Momentum beats willpower.`,
        `Here's a trick: commit to just the first 5 minutes of the task. Often starting is the hardest part — once you're in motion, continuing is easy.`,
        `You're ${streak > 0 ? `on a ${streak}-day streak` : 'building a habit'} — don't break it now. One small session counts. Pick the smallest possible piece of your task and start there.`,
        `Low energy is data, not a verdict. Try switching to your easiest task for one Pomodoro to rebuild momentum, then return to the harder one.`,
      ]
      return lines[Math.floor(Math.random()*lines.length)]
    }

    // Deadline / urgency
    if (msg.includes('deadline') || msg.includes('due') || msg.includes('exam') || msg.includes('tomorrow') || msg.includes('today')) {
      return `Got it — that's urgent. With ${remaining.length} task(s) pending, I'd suggest working in tight ${settings.pomodoroMin}/${settings.shortBreakMin} cycles with minimal breaks between, and save your longest break for after the hardest task. Want me to estimate how many cycles you'll need?` 
    }

    // Study specific
    if (msg.includes('study') || msg.includes('exam') || msg.includes('revis')) {
      return `For studying, active recall beats re-reading. Try: 1 Pomodoro reading/taking notes, then 1 Pomodoro testing yourself without looking. Repeat. Want help splitting your material into session-sized chunks?` 
    }

    // Work/project specific
    if (msg.includes('project') || msg.includes('work') || msg.includes('report') || msg.includes('client')) {
      return `For project work, the first session should just be planning — outline what "done" looks like before diving in. That alone often removes the biggest blocker: not knowing where to start.` 
    }

    // Stats / progress questions
    if (msg.includes('how am i doing') || msg.includes('progress') || msg.includes('stats')) {
      return `Today: ${fmtTime(totalFocusSecs)} focused, ${totalCycles} cycles completed, focus score ${focusScore}%. ${hoursLeft > 0 ? `You're ${Math.round(hoursLeft*60)} min from your daily goal.` : "You've hit your daily goal — nice work!"}` 
    }

    // Break related
    if (msg.includes('break') || msg.includes('rest')) {
      return `Breaks aren't wasted time — they're what let your brain consolidate what you just learned. Step away from the screen if you can; even 2 minutes of looking outside helps more than scrolling.` 
    }

    // Greeting
    if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey')) {
      return `Hey! I'm here to help you plan your work, stay motivated, or just talk through what's blocking you. What are you working on today?` 
    }

    // Default fallback
    const fallbacks = [
      `Tell me what you're working on and your deadline (if any) — I can help break it into focused sessions.`,
      `I can help you plan tasks, push through procrastination, or just check in on your progress. What's on your mind?`,
      `Want a study plan, a motivation boost, or a look at today's stats? Just ask.`,
    ]
    return fallbacks[Math.floor(Math.random()*fallbacks.length)]
  }

  const sendCoachMessage = async () => {
    const trimmed = coachInput.trim()
    if (!trimmed) return

    // Free tier limit: 5 messages per day for non-Pro users
    if (!isPro) {
      const today = new Date().toDateString()
      const usage = ls.get('pom_coach_usage', { date: today, count: 0 })
      if (usage.date !== today) {
        usage.date = today
        usage.count = 0
      }
      if (usage.count >= 5) {
        setCoachMessages2(prev => [...prev, {
          role: 'coach',
          text: "You've used your 5 free coach messages for today. Upgrade to Pro for unlimited coaching, cloud sync, and more.",
          ts: Date.now(),
        }])
        setShowUpgrade(true)
        return
      }
      usage.count += 1
      ls.set('pom_coach_usage', usage)
    }
    const userEntry = { role:'user', text:trimmed, ts:Date.now() }
    setCoachMessages2(prev => [...prev, userEntry])
    setCoachInput('')
    setCoachTyping(true)

    // Save user message to Supabase if signed in
    if (user) {
      supabase.from('coach_conversations').insert({
        user_id: user.id, role: 'user', message: trimmed,
      }).then(() => {}).catch(() => {})
    }

    try {
      const contextPayload = {
        totalFocusSecs, totalBreakSecs, totalCycles, focusScore, streak,
        tasks, settings, heatmapData, dailyReview,
        isSignedIn: !!user,
      }

      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          context: contextPayload,
          history: coachMessages2,
        }),
      })

      const data = await response.json()
      console.log('Coach API response:', response.status, data)

      if (!response.ok) {
        console.error('Coach API error detail:', data)
        throw new Error(data.detail || data.error || 'API error')
      }

      const reply = data.reply || "Sorry, I couldn't generate a response. Try again?"
      setCoachMessages2(prev => [...prev, { role:'coach', text:reply, ts:Date.now() }])

      if (user) {
        supabase.from('coach_conversations').insert({
          user_id: user.id, role: 'coach', message: reply,
        }).then(() => {}).catch(() => {})
      }
    } catch (err) {
      console.error('Coach chat error:', err.message)
      setCoachMessages2(prev => [...prev, {
        role:'coach',
        text: "I'm having trouble connecting right now (" + err.message + "). Please try again in a moment.",
        ts: Date.now(),
      }])
    } finally {
      setCoachTyping(false)
    }
  }

  // ─── COACH UPDATES ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const messages = generateCoachMessage(totalFocusSecs, totalCycles, streak, focusScore, distractions)
    setCoachMessages(messages)
    ls.set('pom_coach_messages', messages)
  }, [
    totalFocusSecs,
    totalCycles,
    focusScore,
    streak,
    distractions
  ])

  // ─── BADGE CHECKS ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const earned = checkBadges(totalCycles, streak, focusScore)
    setBadges(prev => {
      const merged = [...new Set([...prev, ...earned])]
      ls.set('pom_badges', merged)
      return merged
    })
  }, [
    totalCycles,
    streak,
    focusScore
  ])

  // ─── RPG LEVEL SYSTEM ─────────────────────────────────────────────────────────
  useEffect(() => {
    const title = getPlayerTitle(level)

    setPlayerTitle(title)

    ls.set('pom_player_title', title)
  }, [level])

  // ─── DAILY REVIEW ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const review = buildDailyReview(totalFocusSecs, totalCycles, focusScore, streak)
    setDailyReview(review)
    ls.set('pom_daily_review', review)
  }, [
    totalFocusSecs,
    totalCycles,
    focusScore,
    streak
  ])

  // ─── DYNAMIC TITLE ───────────────────────────────────────────────────────────
  useEffect(() => {
    const running = (timers || []).filter(t => t.running)
    if (!running.length) { document.title = 'Pomodoros.io – Free Multi Timer'; return }
    if (running.length === 1) {
      const t = running[0]
      document.title = `${fmtTime(t.secsLeft)} – ${t.name}`
    } else {
      document.title = `${running.length} timers running – Pomodoros.io`
    }
  }, [timers])

  // ─── CLEANUP ─────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    Object.values(timerRefs.current).forEach(clearInterval)
    Object.values(swRefs.current).forEach(clearInterval)
  }, [])

  // ─── SETTINGS SAVE ───────────────────────────────────────────────────────────
  const saveSettings = () => {
    setSettings(tempSettings)
    // apply new times to non-running timers
    setTimers(prev => (prev || []).map(t => {
      if (t.running) return t
      const secs = t.mode === 'pomodoro' ? tempSettings.pomodoroMin * 60
        : t.mode === 'shortBreak' ? tempSettings.shortBreakMin * 60
        : tempSettings.longBreakMin * 60
      return { ...t, secsLeft: secs, totalSecs: secs }
    }))
    setShowSettings(false)
    showToast('Settings saved')
  }

  // ─── CSV EXPORT ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Task', 'Focus Time', 'Break Time', 'Cycles', 'Date'],
      ...(timers || []).map(t => [t.name, fmtTime(t.totalFocusSecs || 0), fmtTime(t.totalBreakSecs || 0), t.cyclesDone || 0, new Date().toLocaleDateString()]),
      ['', '', '', '', ''],
      ['TOTAL', fmtTime(totalFocusSecs), fmtTime(totalBreakSecs), totalCycles, ''],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `pomodoros-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    showToast('CSV downloaded 📊')
  }

  const shareX = () => window.open(
    'https://x.com/intent/tweet?text=' + encodeURIComponent(
      `Just crushed my focus goals on pomodoros.io! 🍅\n⏱️ Focus: ${fmtTime(totalFocusSecs)}\n✅ Cycles: ${totalCycles}\nhttps://www.pomodoros.io`
    ), '_blank'
  )

  const downloadReportCard = async () => {
    if (!reportCardRef.current) return
    try {
      const dataUrl = await toPng(reportCardRef.current, { pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `pomodoros-weekly-report-${new Date().toISOString().split('T')[0]}.png` 
      link.href = dataUrl
      link.click()
      showToast('Report card downloaded 📸')
    } catch (err) {
      console.error('Failed to generate report card:', err)
      showToast('Could not generate image. Try again.')
    }
  }

  const shareReportCardX = () => {
    const hours = (weeklyStats.weekTotal / 3600).toFixed(1)
    window.open(
      'https://x.com/intent/tweet?text=' + encodeURIComponent(
        `My focus this week on pomodoros.io 🍅\n⏱️ ${hours}h focused\n📅 ${weeklyStats.activeDays}/7 active days\n${streak > 0 ? `🔥 ${streak} day streak\n` : ''}https://www.pomodoros.io` 
      ), '_blank'
    )
  }

  // ─── WASH MODE ───────────────────────────────────────────────────────────────
  const openWashMode = () => {
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Focus Color – Pomodoros.io</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif}h1{color:#fff;font-size:20px;font-weight:300;letter-spacing:2px;margin-bottom:28px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:20px;max-width:500px;width:100%}
    .c{aspect-ratio:1;border-radius:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;border:2px solid rgba(255,255,255,0.15);transition:.2s}
    .c:hover{transform:scale(1.04);border-color:rgba(255,255,255,0.4)}
    .fs{position:fixed!important;inset:0;border-radius:0!important;border:none!important;z-index:9999;font-size:16px;letter-spacing:3px}
    </style></head><body>
    <h1>Choose Focus Color</h1>
    <div class="grid">
    ${WASH_COLORS.map(c => `<div class="c" style="background:${c.bg};color:${c.fg}" data-bg="${c.bg}" data-fg="${c.fg}">${c.label}</div>`).join('')}
    </div>
    <script>
    let active=null;
    document.querySelectorAll('.c').forEach(el=>{
      el.addEventListener('click',()=>{
        if(active){active.classList.remove('fs');active.textContent=active.dataset.label;active=null;document.body.style.background='#1a1a2e';return;}
        el.dataset.label=el.textContent;el.textContent='Click to exit';el.classList.add('fs');active=el;document.body.style.background=el.dataset.bg;
      });
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){active.classList.remove('fs');active.textContent=active.dataset.label;active=null;document.body.style.background='#1a1a2e';}});
    </script></body></html>`)
    w.document.close()
  }

  // ─── GLOBAL STYLES ───────────────────────────────────────────────────────────
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'pom-global'
    s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
    #root { width: 100%; height: 100%; overflow: hidden; }
    *::-webkit-scrollbar { width: 3px; height: 3px; }
    *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
    *::-webkit-scrollbar-track { background: transparent; }
    button { cursor: pointer; font-family: inherit; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    button:focus, input:focus, textarea:focus { outline: none; }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.3) !important; }

    @keyframes cfall { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(105vh) rotate(540deg);opacity:0} }
    @keyframes fadeUp { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
    @keyframes fadeInScale { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

    .timer-card-wrap { transition: box-shadow 0.3s ease, border-color 0.3s ease; }
    .timer-grid { transition: grid-template-columns 0.45s cubic-bezier(0.4,0,0.2,1) !important; }
    .sw-grid { transition: all 0.45s cubic-bezier(0.23,1,0.32,1) !important; }

    .start-btn:hover { opacity: 0.88; }
    .tab-btn:hover { background: rgba(255,255,255,0.12) !important; color: #fff !important; }
    .icon-btn:hover { background: rgba(255,255,255,0.18) !important; }
    .adj-btn:hover { background: rgba(255,255,255,0.15) !important; }
    .preset-btn:hover { border-color: rgba(255,255,255,0.5) !important; color: #fff !important; }
    .work-btn:hover { background: rgba(255,255,255,0.35) !important; }
    .break-btn:hover { background: rgba(255,255,255,0.35) !important; }
    .nav-scroll::-webkit-scrollbar { display: none; }

    /* ── MOBILE (phones up to 480px) ── */
    @media (max-width: 480px) {
      .timer-grid {
        grid-template-columns: 1fr !important;
        grid-template-rows: auto !important;
        gap: 8px !important;
        height: auto !important;
        overflow-y: auto !important;
        padding: 0 8px !important;
      }
      .sw-grid {
        grid-template-columns: 1fr !important;
        max-width: 100% !important;
      }
      .yt-player { display: none !important; }
      .focus-bottom-btn { bottom: 10px !important; right: 10px !important; width: 36px !important; height: 36px !important; font-size: 15px !important; }
      .nav-tab-label { font-size: 10px !important; padding: 5px 8px !important; }
      .header-logo { font-size: 22px !important; }
      .maintenance-banner { font-size: 9px !important; padding: 3px 8px !important; }
    }

    /* ── TABLET (481px to 768px) ── */
    @media (min-width: 481px) and (max-width: 768px) {
      .timer-grid {
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        padding: 0 8px !important;
      }
      .sw-grid { max-width: 100% !important; }
      .yt-player { width: 220px !important; }
      .yt-player iframe { width: 220px !important; height: 100px !important; }
    }

    /* ── LAPTOP (769px to 1280px) ── */
    @media (min-width: 769px) and (max-width: 1280px) {
    }

    /* ── DESKTOP (1281px to 1920px) ── */
    @media (min-width: 1281px) and (max-width: 1920px) {
    }

    /* ── TV / LARGE SCREEN (1921px+) ── */
    @media (min-width: 1921px) {
      .timer-grid { gap: 20px !important; }
      .sw-grid { max-width: 1200px !important; }
      .header-logo { font-size: 42px !important; }
      .nav-tab-label { font-size: 16px !important; padding: 10px 20px !important; }
    }
  `
    document.head.appendChild(s)
    return () => document.head.removeChild(s)
  }, [])

  useEffect(() => {
    // Load SoundCloud Widget API script dynamically
    const existingScript = document.getElementById('sc-widget-api')
    if (existingScript) {
      initSCWidget()
      return
    }
    const script = document.createElement('script')
    script.id = 'sc-widget-api'
    script.src = 'https://w.soundcloud.com/player/api.js'
    script.async = true
    script.onload = () => initSCWidget()
    document.head.appendChild(script)

    function initSCWidget() {
      setTimeout(() => {
        const iframe = document.getElementById('sc-iframe')
        if (!iframe || !window.SC || !window.SC.Widget) return
        scWidget.current = window.SC.Widget(iframe)
        scWidget.current.bind(window.SC.Widget.Events.READY, () => {
          setScReady(true)
        })
        scWidget.current.bind(window.SC.Widget.Events.PLAY, () => {
          setScPlaying(true)
        })
        scWidget.current.bind(window.SC.Widget.Events.PAUSE, () => {
          setScPlaying(false)
        })
        scWidget.current.bind(window.SC.Widget.Events.FINISH, () => {
          setScPlaying(false)
        })
      }, 1500)
    }
  }, [])

  
  
  
  // ─── HEATMAP COMPONENT ─────────────────────────────────────────────────────────
  const HeatmapGrid = () => {
    const days = []

    for (let i = 119; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)

      const key = d.toISOString().split('T')[0]

      const secs = heatmapData[key] || 0

      let opacity = 0.08

      if (secs > 900) opacity = 0.25
      if (secs > 1800) opacity = 0.45
      if (secs > 3600) opacity = 0.65
      if (secs > 7200) opacity = 0.9

      days.push(
        <div
          key={key}
          title={`${key} - ${Math.round(secs / 60)} mins`}
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            background: `rgba(16,185,129,${opacity})` 
          }}
        />
      )
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(20,14px)',
          gap: 4,
          justifyContent: 'center'
        }}
      >
        {days}
      </div>
    )
  }

  // ─── FOCUS MODE TIMERS ───────────────────────────────────────────────────────────
  const focusModeTimers = (timers || []).filter(t => t.running).length > 0
    ? (timers || []).filter(t => t.running)
    : [(timers || [])[0]].filter(Boolean)

  const focusModeDisplayTimer = (() => {
    const running = (timers || []).find(t => t.running)
    return running || timers[0] || null
  })()

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      position: 'fixed',
      top: 0,
      left: 0,
      minHeight: '-webkit-fill-available',
    }}>
      {/* Background image layers with smooth crossfade */}
      {[BG_LIGHT_WORK, BG_LIGHT_BREAK, BG_DARK_WORK, BG_DARK_BREAK].map(img => (
        <div
          key={img}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            pointerEvents: 'none',
            backgroundImage: loadedBgImages.has(img) ? `url('${img}')` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
            opacity: currentBgImage === img ? 1 : 0,
            transition: 'opacity 0.9s ease',
          }}
        />
      ))}

      {/* Color overlay layer */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        pointerEvents: 'none',
        background: isDark
          ? 'rgba(0,0,0,0.65)'
          : timerMode === 'shortBreak' || timerMode === 'longBreak'
            ? 'rgba(0,5,15,0.40)'
            : 'rgba(0,8,18,0.30)',
        transition: 'background 0.6s ease',
      }}/>

      {/* Main content wrapper */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}>
        {/* ══ HEADER ══════════════════════════════════════════════════════════════ */}
        <div style={{ height: 58, flexShrink: 0, padding: '0 20px', background: 'transparent', backdropFilter: 'none', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span
    onClick={() => { setTab('timer'); setFocusMode(false) }}
    className="header-logo"
    style={{
      fontFamily: "'Caveat', cursive",
      fontSize: 36,
      fontWeight: 700,
      color: '#fff',
      userSelect: 'none',
      letterSpacing: 0.5,
      textShadow: '0 2px 12px rgba(0,0,0,0.3)',
      cursor: 'pointer',
    }}>
    pomodoros<span style={{
      color: 'rgba(255,255,255,0.7)',
      fontWeight: 500,
    }}>.io</span>
  </span>
                      </div>

          {/* Right buttons */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsDark(d => !d)}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
              }}>
              {isDark ? (
                /* Sun icon - shown in dark mode to switch to light */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <line x1="12" y1="2" x2="12" y2="4"/>
                  <line x1="12" y1="20" x2="12" y2="22"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="2" y1="12" x2="4" y2="12"/>
                  <line x1="20" y1="12" x2="22" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                /* Moon icon - shown in light mode to switch to dark */
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.9)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            {!isPro && (
              <button
                onClick={() => setShowUpgrade(true)}
                style={{
                  background: 'rgba(255,215,0,0.15)',
                  border: '1px solid rgba(255,215,0,0.4)',
                  color: '#FFD700',
                  padding: '7px 14px',
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  letterSpacing: 0.3,
                }}>
                ⚡ Upgrade
              </button>
            )}
            {isPro && (
              <span style={{
                background: 'rgba(255,215,0,0.2)',
                border: '1px solid rgba(255,215,0,0.4)',
                color: '#FFD700',
                padding: '4px 10px',
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 800,
              }}>
                PRO ✨
              </span>
            )}
            {!user && (
              <button onClick={signIn}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff',
                  padding: '7px 16px',
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}>
                Sign In
              </button>
            )}
            {user && (
              <button onClick={signOut}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'rgba(255,255,255,0.7)',
                  padding: '7px 14px',
                  borderRadius: 100,
                  fontSize: 11,
                  cursor: 'pointer',
                }}>
                Sign Out
              </button>
            )}
                        {[
              { icon:'?', tip:'Keyboard Shortcuts', fn:()=>setShowKeyHelp(true) },
            ].map(b => (
              <button key={b.icon} className="icon-btn" onClick={b.fn} title={b.tip}
                style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', width:38, height:38, borderRadius:'50%', fontSize:16, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {b.icon}
              </button>
            ))}
            {activeFocusCount > 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.55)',
                letterSpacing: 0.3,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#4ade80',
                  boxShadow: '0 0 6px #4ade80',
                }}/>
                {activeFocusCount} focusing now
              </span>
            )}
            {streak > 0 && (
              <span
                title={`${streakFreezesLeft} streak freeze(s) left this month`}
                style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginLeft: 4, letterSpacing: 0.3, cursor: 'default' }}>
                🔥 {streak}
              </span>
            )}
                                  </div>
        </div>

      {/* ══ MAINTENANCE BANNER ════════════════════════════════════════════════════════════ */}
      <div className="maintenance-banner" style={{
        width: '100%',
        textAlign: 'center',
        padding: '5px 16px',
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(8px)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: '#FF3B3B',
        flexShrink: 0,
      }}>
        🚧 We are actively working on improving this site - sorry for any inconvenience caused 🚧
      </div>

      {/* ══ NAV TABS ════════════════════════════════════════════════════════════ */}
      <div className="nav-scroll" style={{ flexShrink: 0, padding: '6px 8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        <div style={{ display:'flex', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius:100, padding:5, gap:2, backdropFilter: 'blur(12px)' }}>
          {[{k:'timer',l:'Pomodoro'},{k:'sounds',l:'Sounds'},{k:'notes',l:'Notes'},{k:'stopwatch',l:'Stopwatch'},{k:'stats',l:'Report'}].map(t => (
            <button key={t.k} className="tab-btn nav-tab-label" onClick={()=>setTab(t.k)}
              style={{
                background: tab===t.k
                  ? 'rgba(255,255,255,0.22)'
                  : 'transparent',
                color: tab===t.k
                  ? '#fff'
                  : 'rgba(255,255,255,0.6)',
                backdropFilter: tab===t.k ? 'blur(8px)' : 'none',
                WebkitBackdropFilter: tab===t.k ? 'blur(8px)' : 'none',
                border: tab===t.k
                  ? '1px solid rgba(255,255,255,0.35)'
                  : '1px solid transparent',
                fontWeight: tab===t.k ? 700 : 500,
                padding:'6px 13px',
                borderRadius:100,
                fontSize:12,
                fontFamily: '"Outfit", sans-serif',
                letterSpacing:.3
              }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Add timer / stopwatch */}
        {(tab==='timer'||tab==='stopwatch') && (
          <button
            onClick={() => {
              const list = tab === 'timer' ? timers : stopwatches
              const limit = isPro ? 4 : 1
              if (list.length >= limit) {
                setShowUpgrade(true)
                return
              }
              if (tab === 'timer') addTimer()
              else addStopwatch()
            }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.8)',
              padding: '6px 13px',
              borderRadius: 100,
              fontSize: 12,
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
            }}>
            + Add {tab==='timer'?'Timer':'Stopwatch'}{!isPro && ' 🔒'}
          </button>
        )}

              </div>

      {/* ══ CONTENT ══════════════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 16px 8px',
        boxSizing: 'border-box',
      }}>

        {/* ── TIMER TAB ── */}
        {tab==='timer' && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            padding: timers.length <= 2 ? '4px 120px 12px' : '4px 8px 12px',
            boxSizing: 'border-box',
            alignItems: 'center',
          }}>
            {/* Daily Insight Banner */}
            {dailyInsightText && (
              <div style={{
                width: '100%',
                maxWidth: timers.length === 1 ? 380 : timers.length === 2 ? 680 : 860,
                margin: '0 auto 12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  {dailyInsightText}
                </span>
              </div>
            )}
            {/* Timer grid */}
            <div className="timer-grid" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: timers.length >= 3 ? '1fr 1fr' : '1fr',
              gap: 10,
              flex: 1,
              width: timers.length <= 2 ? '100%' : '100%',
              maxWidth: timers.length === 1 ? 380
    : timers.length === 2 ? 680
    : 860,
              margin: '0 auto',
              transition: 'grid-template-columns 0.45s cubic-bezier(0.4,0,0.2,1)',
              alignItems: 'stretch',
              alignContent: timers.length <= 2 ? 'center' : 'stretch',
              justifyContent: 'center',
              justifyItems: 'stretch',
              padding: '0 4px',
              boxSizing: 'border-box',
              height: timers.length <= 2 ? 'auto' : '100%',
              maxHeight: timers.length === 1 ? '63vh' : timers.length === 2 ? '61vh' : '100%',
              minHeight: 0,
            }}>
              {(timers || []).map((t, idx) => (
                <div key={t.id} style={{
                  gridColumn: timers.length === 1
    ? '1 / -1'
    : timers.length === 3 && idx === 2
      ? '1 / -1'
      : 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                  minHeight: 0,
                }}>
                  <div style={{
                    width: timers.length === 1
    ? '100%'
    : timers.length === 3 && idx === 2
      ? '50%'
      : '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  }}>
                    <TimerCard
                    timer={t}
                    count={timers.length}
                    isMobile={isMobile}
                    isDark={isDark}
                    bgColor={bgColor}
                    surfBg={surfBg}
                    borderCol={borderCol}
                    settings={settings}
                    editingId={editingId}
                    editName={editName}
                    setEditingId={setEditingId}
                    setEditName={setEditName}
                    updateTimerField={updateTimerField}
                    adjustTimer={adjustTimer}
                    toggleTimer={toggleTimer}
                    resetTimer={resetTimer}
                    changeTimerPhase={changeTimerPhase}
                    setTimerMode={setTimerMode}
                    setTasks={setTasks}
                    removeTimer={removeTimer}
                    setTimers={setTimers}
                    setDistractionTimerId={setDistractionTimerId}
                    setShowDistractionLog={setShowDistractionLog}
                  />
                  </div>
                </div>
              ))}
            </div>

            
            
              
                        </div>
        )}

        {/* ── SOUNDS TAB ── */}
        {tab==='sounds' && (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', overflow:'hidden', padding:'20px 20px 0' }}>
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderTop: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        padding: '32px 36px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        width: '100%',
        maxWidth: 420,
      }}>
        <h2 style={{ fontWeight:300, fontSize:22, letterSpacing:1, margin:0, color:'#fff' }}>Ambient Noise</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:'100%' }}>
          {NOISE_OPTIONS.map(n => {
            const locked = n.pro && !isPro
            return (
              <button key={n.key} className="noise-btn"
                onClick={()=>{
                  if (locked) { setShowUpgrade(true); return }
                  setNoiseKey(n.key); setNoiseOn(true)
                }}
                style={{
                  background: noiseKey===n.key&&noiseOn ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${noiseKey===n.key&&noiseOn ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
                  backdropFilter: 'blur(8px)',
                  color: locked ? 'rgba(255,255,255,0.35)' : '#fff',
                  padding: '14px 8px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all .15s',
                  letterSpacing: 0.3,
                  position: 'relative',
                }}>
                {n.label}{locked && ' 🔒'}
              </button>
            )
          })}
        </div>
        <div style={{ textAlign:'center', width:'100%' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', letterSpacing:1.5, marginBottom:10 }}>
            VOLUME — {Math.round(volume*100)}%
          </div>
          <input type="range" min={0} max={1} step={0.01} value={volume}
            onChange={e=>setVolume(+e.target.value)}
            style={{ width:'100%', accentColor:'rgba(255,255,255,0.8)' }} />
        </div>
        {noiseOn && (
          <button onClick={()=>setNoiseOn(false)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.25)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              padding: '10px 28px',
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            Stop Sound
          </button>
        )}
      </div>
    </div>
  )}

        {/* ── NOTES TAB ── */}
        {tab==='notes' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', overflow:'hidden', padding:'20px 16px 0', width:'100%' }}>
            <div style={{ width:'100%', maxWidth:380, display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
              <h2 style={{ fontWeight:300, fontSize:24, letterSpacing:1, margin:0 }}>Notes</h2>
              <textarea value={note} onChange={e=>setNote(e.target.value)}
                placeholder="Type your notes here..."
                style={{ width:'100%', height: 'calc((100vh - 260px) * 0.5)', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', padding:20, borderRadius:12, fontSize:15, lineHeight:1.75, resize:'vertical', caretColor:'#fff', transition:'border .2s' }}
                onFocus={e=>e.target.style.borderColor='rgba(255,255,255,0.45)'}
                onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.2)'} />
              <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                <button onClick={()=>{ls.set('pom_note',note);showToast('Notes saved ✓')}}
                  style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', padding:'10px 26px', borderRadius:8, fontSize:14, fontWeight:700 }}>Save</button>
                <button onClick={()=>{setNote('');ls.set('pom_note','')}}
                  style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.65)', padding:'10px 22px', borderRadius:8, fontSize:14 }}>Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* ── STOPWATCH TAB ── */}
        {tab==='stopwatch' && (
          <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflow: 'hidden',
      padding: '4px 8px 8px',
      boxSizing: 'border-box',
      height: '100%',
    }}>
            <div className="sw-grid" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: stopwatches.length >= 3 ? '1fr 1fr' : '1fr',
              gap: 10,
              flex: 1,
              width: '100%',
              maxWidth: stopwatches.length === 1 ? 471 : stopwatches.length === 2 ? 813 : 860,
              margin: '0 auto',
              alignItems: 'stretch',
              alignContent: stopwatches.length <= 2 ? 'center' : 'stretch',
              justifyContent: 'center',
              justifyItems: 'stretch',
              padding: stopwatches.length <= 2 ? '0 60px' : '0 4px',
              boxSizing: 'border-box',
              height: stopwatches.length >= 3 ? '100%' : 'auto',
              maxHeight: stopwatches.length === 1 ? '61vh' : stopwatches.length === 2 ? '59vh' : '100%',
              minHeight: 0,
            }}>
              {(stopwatches || []).map((sw, idx) => (
                <div key={sw.id} style={{
                  gridColumn: stopwatches.length === 1 ? '1 / -1' : stopwatches.length === 3 && idx === 2 ? '1 / -1' : 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                  minHeight: 0,
                }}>
                  <div style={{
                    width: stopwatches.length === 1 ? '100%' : stopwatches.length === 3 && idx === 2 ? '50%' : '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  }}>
                    <SWCard
                  sw={sw}
                  count={stopwatches.length}
                  bgColor={bgColor}
                  removeSW={removeSW}
                  toggleSW={toggleSW}
                  lapSW={lapSW}
                  resetSW={resetSW}
                  isMobile={isMobile}
                  editingSwId={editingSwId}
                  editSwName={editSwName}
                  setEditingSwId={setEditingSwId}
                  setEditSwName={setEditSwName}
                  updateSWField={updateSWField}
                  setTasks={setTasks}
                />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab==='stats' && (
          <div style={{ flex:1, overflowY:'auto', padding:'16px 20px 40px', boxSizing:'border-box' }}>

            {/* ── PAGE TITLE ── */}
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:13, fontWeight:700, letterSpacing:3, textTransform:'uppercase', color:'rgba(255,255,255,0.5)', marginBottom:4 }}>Daily Report</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)', letterSpacing:1 }}>{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
            </div>
            {activeFocusCount > 0 && (
              <div style={{ textAlign:'center', marginBottom:16 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.06)', padding: '6px 14px',
                  borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 8px #4ade80' }}/>
                  {activeFocusCount} {activeFocusCount === 1 ? 'person' : 'people'} focusing right now around the world
                </span>
              </div>
            )}

            <div style={{ maxWidth:700, margin:'0 auto', display:'flex', flexDirection:'column', gap:16 }}>

              {/* ── HERO STATS ROW ── */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                {[
                  { icon:'⏱', label:'Focus Time', value: fmtTime(totalFocusSecs), sub: `${Math.floor(totalFocusSecs/3600)}h ${Math.floor((totalFocusSecs%3600)/60)}m` },
                  { icon:'☕', label:'Break Time', value: fmtTime(totalBreakSecs), sub: `${(totalBreakSecs/60).toFixed(0)} mins` },
                  { icon:'🔄', label:'Cycles Done', value: totalCycles, sub: `${settings.longBreakEvery - (totalCycles % settings.longBreakEvery)} to long break` },
                  { icon:'🎯', label:'Focus Score', value: focusScore + '%', sub: focusScore >= 80 ? 'Excellent' : focusScore >= 60 ? 'Good' : focusScore >= 40 ? 'Fair' : 'Keep going' },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'14px 12px', textAlign:'center' }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{s.icon}</div>
                    <div style={{ fontSize:22, fontWeight:700, color:'#fff', fontFamily:"'Outfit',sans-serif", fontVariantNumeric:'tabular-nums' }}>{s.value}</div>
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.45)', letterSpacing:1, textTransform:'uppercase', marginTop:2 }}>{s.label}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2 }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* ── DAILY GOAL PROGRESS ── */}
              <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Daily Goal</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>Target: {settings.dailyGoalHours}h of deep focus</div>
                  </div>
                  <div style={{ fontSize:28, fontWeight:800, color:'#fff', fontFamily:"'Outfit',sans-serif" }}>
                    {Math.min(100, Math.round((totalFocusSecs / (settings.dailyGoalHours * 3600)) * 100))}%
                  </div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:100, height:8, overflow:'hidden' }}>
                  <div style={{
                    background: totalFocusSecs >= settings.dailyGoalHours * 3600
                      ? 'rgba(16,185,129,0.9)'
                      : 'rgba(255,255,255,0.7)',
                    borderRadius:100, height:8,
                    width: Math.min(100,(totalFocusSecs/(settings.dailyGoalHours*3600))*100) + '%',
                    transition:'width 0.5s ease',
                  }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:10, color:'rgba(255,255,255,0.35)' }}>
                  <span>0h</span>
                  <span>{settings.dailyGoalHours/2}h</span>
                  <span>{settings.dailyGoalHours}h</span>
                </div>
                {streak > 0 && (
                  <div style={{ marginTop:10, fontSize:12, color:'rgba(255,255,255,0.6)', textAlign:'center' }}>
                    🔥 <strong style={{color:'#fff'}}>{streak} day</strong> streak — keep it going!
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:3 }}>
                      🧊 {streakFreezesLeft} freeze{streakFreezesLeft !== 1 ? 's' : ''} left this month — missing a day won't break your streak
                    </div>
                  </div>
                )}
              </div>

              {/* ── PER-TIMER BREAKDOWN ── */}
              <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px' }}>
                <div style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.5)', marginBottom:12 }}>Timer Breakdown</div>
                {timers.map((t, i) => {
                  const pct = t.totalFocusSecs + t.totalBreakSecs > 0
                    ? Math.round((t.totalFocusSecs / (t.totalFocusSecs + t.totalBreakSecs)) * 100)
                    : 0
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom: i < timers.length-1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>{i+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:'#fff', marginBottom:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                        <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:100, height:4 }}>
                          <div style={{ background:'rgba(255,255,255,0.6)', borderRadius:100, height:4, width:pct+'%', transition:'width 0.5s' }}/>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', flexShrink:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{fmtTime(t.totalFocusSecs)}</div>
                        <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>{t.cyclesDone} cycles</div>
                      </div>
                    </div>
                  )
                })}
                {timers.every(t => t.totalFocusSecs === 0) && (
                  <div style={{ textAlign:'center', padding:'20px 0', fontSize:13, color:'rgba(255,255,255,0.35)' }}>
                    Start a timer to see your breakdown here
                  </div>
                )}
              </div>

              {/* ── TASKS ── */}
              <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.5)' }}>Tasks</div>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{pendingTasks.length} remaining</span>
                </div>
                {tasks.length === 0 && (
                  <div style={{ textAlign:'center', padding:'16px 0', fontSize:13, color:'rgba(255,255,255,0.35)' }}>No tasks yet — add one below</div>
                )}
                {tasks.map(task => (
                  <div key={task.id}
                    onClick={() => setActiveTaskId(task.id===activeTaskId?null:task.id)}
                    style={{ display:'flex', alignItems:'center', gap:10, background:activeTaskId===task.id?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.03)', border:activeTaskId===task.id?'1px solid rgba(255,255,255,0.25)':'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 12px', marginBottom:6, cursor:'pointer', transition:'all 0.15s' }}>
                    <input type="checkbox" checked={task.done} onClick={e=>e.stopPropagation()}
                      onChange={e => setTasks(prev => prev.map(t => t.id===task.id?{...t,done:e.target.checked}:t))}
                      style={{ width:14, height:14, cursor:'pointer', flexShrink:0, accentColor:'rgba(255,255,255,0.8)' }}/>
                    <span style={{ flex:1, fontSize:13, fontWeight:500, textDecoration:task.done?'line-through':'none', color:task.done?'rgba(255,255,255,0.3)':'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.name}</span>
                    <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                      {Array(task.estimatedPomodoros||1).fill(0).map((_,i)=>(
                        <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:i<(task.completedPomodoros||0)?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.15)' }}/>
                      ))}
                    </div>
                    <button onClick={e=>{e.stopPropagation();setTasks(prev=>prev.filter(t=>t.id!==task.id))}}
                      style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.25)', fontSize:16, cursor:'pointer', flexShrink:0, padding:'0 2px' }}
                      onMouseEnter={e=>e.currentTarget.style.color='#fff'}
                      onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.25)'}>×</button>
                  </div>
                ))}
                <div style={{ border:'1px dashed rgba(255,255,255,0.12)', borderRadius:10, padding:'8px 12px', cursor:'text', background:'rgba(255,255,255,0.02)', marginTop:4 }}
                  onClick={()=>document.getElementById('pom-task-inp-report')?.focus()}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:16, color:'rgba(255,255,255,0.25)' }}>＋</span>
                    <input id="pom-task-inp-report" value={newTask} onChange={e=>setNewTask(e.target.value)}
                      onKeyDown={e=>{if(e.key==='Enter'&&newTask.trim()){setTasks(prev=>[...prev,{id:Date.now(),name:newTask.trim(),estimatedPomodoros:newTaskEst,completedPomodoros:0,done:false}]);setNewTask('');setNewTaskEst(1);}}}
                      placeholder="Add task and press Enter"
                      style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:12, caretColor:'#fff' }}/>
                  </div>
                  {newTask && (
                    <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
                      <select value={newTaskEst} onChange={e=>setNewTaskEst(+e.target.value)}
                        style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', padding:'3px 6px', borderRadius:6, fontSize:11 }}>
                        {Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1} 🍅</option>)}
                      </select>
                      <button onClick={()=>{if(newTask.trim()){setTasks(prev=>[...prev,{id:Date.now(),name:newTask.trim(),estimatedPomodoros:newTaskEst,completedPomodoros:0,done:false}]);setNewTask('');setNewTaskEst(1);}}}
                        style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', padding:'4px 12px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer' }}>Add</button>
                      <button onClick={()=>setNewTask('')}
                        style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.4)', padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer' }}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>

              
              {/* ── AI COACH CHAT ── */}
              <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: coachChatOpen ? 12 : 0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:18 }}>💬</div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>Ask Your Coach</div>
                        <span style={{ fontSize:9, background:'rgba(16,185,129,0.2)', border:'1px solid rgba(16,185,129,0.4)', color:'#6ee7b7', padding:'2px 8px', borderRadius:100, fontWeight:700, letterSpacing:0.5, marginLeft:8 }}>AI POWERED</span>
                        {!isPro && (() => {
                          const today = new Date().toDateString()
                          const usage = ls.get('pom_coach_usage', { date: today, count: 0 })
                          const remaining = usage.date === today ? Math.max(0, 5 - usage.count) : 5
                          return (
                            <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginLeft:8 }}>
                              {remaining}/5 free today
                            </span>
                          )
                        })()}
                      </div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:1 }}>Plan tasks, get motivated, beat procrastination</div>
                    </div>
                  </div>
                  <button onClick={()=>setCoachChatOpen(o=>!o)}
                    style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.18)', color:'#fff', borderRadius:100, padding:'6px 14px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                    {coachChatOpen ? 'Close' : 'Open Chat'}
                  </button>
                </div>

                {coachChatOpen && (
                  <>
                    <div style={{ maxHeight:280, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, marginBottom:12, paddingRight:4 }}>
                      {coachMessages2.length === 0 && (
                        <div style={{ textAlign:'center', padding:'20px 10px', fontSize:12, color:'rgba(255,255,255,0.35)', lineHeight:1.6 }}>
                          👋 Hi! Tell me what you're working on, your deadline, or how you're feeling — I'll help you plan and stay motivated.
                        </div>
                      )}
                      {coachMessages2.map((m,i) => (
                        <div key={i} style={{
                          alignSelf: m.role==='user' ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          background: m.role==='user' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                          border: m.role==='user' ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 14,
                          padding: '8px 12px',
                          fontSize: 12,
                          color: '#fff',
                          lineHeight: 1.5,
                        }}>
                          {m.text}
                        </div>
                      ))}
                      {coachTyping && (
                        <div style={{ alignSelf:'flex-start', fontSize:11, color:'rgba(255,255,255,0.4)', padding:'4px 12px' }}>
                          Thinking...
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <input
                        value={coachInput}
                        onChange={e=>setCoachInput(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter') sendCoachMessage() }}
                        placeholder="e.g. I have an exam tomorrow, help me plan"
                        style={{ flex:1, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:100, color:'#fff', fontSize:12, padding:'9px 16px', caretColor:'#fff' }}
                      />
                      <button onClick={sendCoachMessage}
                        style={{ background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', borderRadius:100, padding:'9px 18px', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                        Send
                      </button>
                    </div>
                    {coachMessages2.length > 0 && (
                      <button onClick={()=>{ setCoachMessages2([]); ls.set('pom_coach_chat',[]) }}
                        style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.3)', fontSize:10, marginTop:8, cursor:'pointer', padding:0 }}>
                        Clear conversation
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ── FOCUS HEATMAP ── */}
              <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Focus Heatmap</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Last 120 days of focus activity</div>
                  </div>
                  {weeklyInsights.bestHour && (
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', textAlign:'right' }}>
                      🕐 Peak: <strong style={{color:'#fff'}}>{weeklyInsights.bestHour}:00</strong>
                      <br/><span style={{fontSize:10}}>{weeklyInsights.focusMinutes}m avg</span>
                    </div>
                  )}
                </div>
                <HeatmapGrid />
                <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:10, justifyContent:'flex-end' }}>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Less</span>
                  {[0.08,0.25,0.45,0.65,0.9].map(o => (
                    <div key={o} style={{ width:10, height:10, borderRadius:2, background:`rgba(16,185,129,${o})` }}/>
                  ))}
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>More</span>
                </div>
              </div>

              {/* ── DISTRACTION PATTERNS ── */}
              {distractions.length > 0 && (
                <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px' }}>
                  <div style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.5)', marginBottom:4 }}>Distraction Patterns</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:12 }}>{distractions.length} logged — see what pulls you away most</div>
                  {(() => {
                    const counts = {}
                    distractions.forEach(d => { counts[d.reason] = (counts[d.reason] || 0) + 1 })
                    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5)
                    const maxCount = sorted[0]?.[1] || 1
                    return sorted.map(([reason, count]) => (
                      <div key={reason} style={{ marginBottom:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#fff', marginBottom:3 }}>
                          <span>{reason}</span>
                          <span style={{ color:'rgba(255,255,255,0.5)' }}>{count}×</span>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:100, height:5 }}>
                          <div style={{ background:'rgba(255,255,255,0.5)', borderRadius:100, height:5, width:(count/maxCount*100)+'%', transition:'width 0.5s' }}/>
                        </div>
                      </div>
                    ))
                  })()}
                  <button
                    onClick={() => { setDistractions([]); ls.set('pom_distractions', []); showToast('Distraction log cleared') }}
                    style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.3)', fontSize:10, marginTop:6, cursor:'pointer', padding:0 }}>
                    Clear log
                  </button>
                </div>
              )}

              {/* ── MOOD TREND ── */}
              {sessionMoods.length > 0 && (
                <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px' }}>
                  <div style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.5)', marginBottom:10 }}>How Your Sessions Feel</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {sessionMoods.slice(-20).map((m, i) => {
                      const emojiMap = { Hard: '😫', Okay: '😐', Good: '😊', Great: '🔥' }
                      return (
                        <div key={i} title={m.mood} style={{ fontSize:16, opacity: 0.4 + (i/20)*0.6 }}>
                          {emojiMap[m.mood] || '😐'}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:8 }}>Last {Math.min(sessionMoods.length, 20)} sessions, oldest to newest</div>
                </div>
              )}

              {/* ── INVITE FRIENDS ── */}
              <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px', textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>🎁</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4 }}>Invite a friend, you both get Pro free</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:14, lineHeight:1.5 }}>
                  When a friend signs up using your link, you each get 1 month of Pro — unlimited AI coach, all sounds, up to 4 timers, and more.
                </div>
                <button onClick={copyInviteLink}
                  style={{
                    background: inviteCopied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.15)',
                    border: `1px solid ${inviteCopied ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.25)'}`,
                    color: '#fff',
                    padding: '10px 24px',
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  {inviteCopied ? '✓ Copied!' : '🔗 Copy My Invite Link'}
                </button>
              </div>

              {/* ── WEEKLY REPORT CARD ── */}
              <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, padding:'16px 20px', textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📸</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#fff', marginBottom:4 }}>Your Week, Visualized</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:14 }}>
                  Generate a shareable card of your weekly focus stats
                </div>
                <button onClick={() => setShowReportCard(true)}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff',
                    padding: '10px 24px',
                    borderRadius: 100,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                  View My Report Card
                </button>
              </div>

              
              {/* ── ACTION BUTTONS ── */}
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
                {[
                  { l:'🗑 Clear Stats', fn:()=>{ setTimers(p=>p.map(t=>({...t,totalFocusSecs:0,totalBreakSecs:0,cyclesDone:0}))); showToast('Stats cleared') } },
                  { l: isPro ? '📊 Export CSV' : '📊 Export CSV 🔒', fn: isPro ? exportCSV : () => setShowUpgrade(true) },
                  { l:'🐦 Share on X', fn:shareX },
                  ...(user ? [{ l: isPro ? '☁️ Sync' : '☁️ Sync 🔒', fn: isPro ? syncToCloud : () => setShowUpgrade(true) }] : []),
                ].map(b => (
                  <button key={b.l} onClick={b.fn}
                    style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', backdropFilter:'blur(8px)', color:'rgba(255,255,255,0.8)', padding:'9px 16px', borderRadius:100, fontSize:12, fontWeight:600, cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.16)'}
                    onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
                    {b.l}
                  </button>
                ))}
              </div>

            </div>
          </div>
        )}

      </div>

      {/* ══ TOAST ══════════════════════════════════════════════════════════════ */}
      {toast && (
        <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.85)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:100, padding:'11px 26px', fontSize:14, fontWeight:600, zIndex:9999, backdropFilter:'blur(20px)', whiteSpace:'nowrap', animation:'fadeUp .25s ease', boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      {/* ══ SETTINGS MODAL ══════════════════════════════════════════════════════ */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setShowSettings(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:32, width:'90%', maxWidth:500, maxHeight:'85vh', overflowY:'auto', color:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>Settings</h2>
              <button onClick={()=>setShowSettings(false)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.5)', fontSize:24, lineHeight:1 }}>×</button>
            </div>

            <div style={{ marginBottom:20, borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:20 }}>
              <h3 style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'rgba(255,255,255,0.5)', marginBottom:16 }}>TIMER (MINUTES)</h3>
              {[
                {l:'Pomodoro', k:'pomodoroMin', min:1, max:60},
                {l:'Short Break', k:'shortBreakMin', min:1, max:30},
                {l:'Long Break', k:'longBreakMin', min:5, max:60},
                {l:'Long Break Every', k:'longBreakEvery', min:2, max:8, suffix:' pomodoros'},
              ].map(f=>(
                <div key={f.k} style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:600, marginBottom:6 }}>
                    <span>{f.l}</span>
                    <span style={{ color:'rgba(255,255,255,0.6)' }}>{tempSettings[f.k]}{f.suffix||' min'}</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} value={tempSettings[f.k]}
                    onChange={e=>setTempSettings(p=>({...p,[f.k]:+e.target.value}))}
                    style={{ width:'100%', accentColor:bgColor }} />
                </div>
              ))}
            </div>

            <div style={{ marginBottom:20, borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:20 }}>
              <h3 style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'rgba(255,255,255,0.5)', marginBottom:16 }}>AUTO START</h3>
              {[
                {l:'Auto-start Breaks', k:'autoStartBreaks'},
                {l:'Auto-start Pomodoros', k:'autoStartPomodoros'},
                {l:'Alarm Sound', k:'alarmSound'},
                {l:'Browser Notifications', k:'browserNotifs'},
              ].map(f=>(
                <label key={f.k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, cursor:'pointer', fontSize:14 }}>
                  <span>{f.l}</span>
                  <input type="checkbox" checked={tempSettings[f.k]}
                    onChange={e=>setTempSettings(p=>({...p,[f.k]:e.target.checked}))}
                    style={{ width:18, height:18, accentColor:bgColor, cursor:'pointer' }} />
                </label>
              ))}
            </div>

            <div style={{ marginBottom:24 }}>
              <h3 style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'rgba(255,255,255,0.5)', marginBottom:12 }}>DAILY GOAL</h3>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[1,2,4,6,8].map(h=>(
                  <button key={h} onClick={()=>setTempSettings(p=>({...p,dailyGoalHours:h}))}
                    style={{ background:tempSettings.dailyGoalHours===h?bgColor:'rgba(255,255,255,0.1)', border:`1px solid ${tempSettings.dailyGoalHours===h?'rgba(255,255,255,0.5)':'rgba(255,255,255,0.2)'}`, color:'#fff', padding:'7px 16px', borderRadius:20, fontSize:13, fontWeight:700 }}>
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <button onClick={saveSettings}
              style={{ width:'100%', background:bgColor, border:'none', color:'#fff', padding:14, borderRadius:10, fontSize:15, fontWeight:800, letterSpacing:.5 }}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* ══ WEEKLY REPORT CARD MODAL ══════════════════════════════ */}
      {showReportCard && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(12px)', zIndex:1500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={()=>setShowReportCard(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, maxWidth:400, width:'100%' }}>

            {/* The actual card to be captured as an image */}
            <div ref={reportCardRef} style={{
              width: '100%',
              aspectRatio: '1 / 1.2',
              background: 'linear-gradient(135deg, #1a0a20 0%, #2d1230 50%, #1a1a3e 100%)',
              borderRadius: 24,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}>
              <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.05)' }}/>
              <div style={{ position:'absolute', bottom:-80, left:-80, width:240, height:240, borderRadius:'50%', background:'rgba(255,255,255,0.04)' }}/>

              <div style={{ fontFamily:"'Caveat', cursive", fontSize:28, fontWeight:700, marginBottom:4, position:'relative', zIndex:1 }}>
                pomodoros<span style={{ color:'rgba(255,255,255,0.6)', fontWeight:500 }}>.io</span>
              </div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', letterSpacing:2, textTransform:'uppercase', marginBottom:24, position:'relative', zIndex:1 }}>
                Weekly Focus Report
              </div>

              <div style={{ fontSize:48, fontWeight:800, fontFamily:"'Outfit', sans-serif", lineHeight:1, marginBottom:4, position:'relative', zIndex:1 }}>
                {(weeklyStats.weekTotal / 3600).toFixed(1)}h
              </div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:24, position:'relative', zIndex:1 }}>
                focused this week
              </div>

              <div style={{ display:'flex', gap:8, marginBottom:24, position:'relative', zIndex:1 }}>
                {weeklyStats.days.map((d, i) => {
                  const dayLetter = ['S','M','T','W','T','F','S'][d.date.getDay()]
                  const intensity = d.secs > 0 ? Math.min(1, d.secs / 7200) : 0
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                      <div style={{
                        width: '100%',
                        height: 50,
                        borderRadius: 8,
                        background: intensity > 0 ? `rgba(255,255,255,${0.15 + intensity * 0.55})` : 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                      }}/>
                      <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>{dayLetter}</span>
                    </div>
                  )
                })}
              </div>

              <div style={{ display:'flex', gap:16, marginTop:'auto', position:'relative', zIndex:1 }}>
                <div>
                  <div style={{ fontSize:20, fontWeight:700 }}>{weeklyStats.activeDays}/7</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>active days</div>
                </div>
                <div>
                  <div style={{ fontSize:20, fontWeight:700 }}>{totalCycles}</div>
                  <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>cycles today</div>
                </div>
                {streak > 0 && (
                  <div>
                    <div style={{ fontSize:20, fontWeight:700 }}>🔥 {streak}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)' }}>day streak</div>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons - outside the captured card */}
            <div style={{ display:'flex', gap:10, width:'100%' }}>
              <button onClick={downloadReportCard}
                style={{ flex:1, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', padding:'12px 0', borderRadius:100, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                ⬇️ Download
              </button>
              <button onClick={shareReportCardX}
                style={{ flex:1, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', padding:'12px 0', borderRadius:100, fontSize:13, fontWeight:700, cursor:'pointer' }}>
                🐦 Share on X
              </button>
            </div>
            <button onClick={()=>setShowReportCard(false)}
              style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.4)', fontSize:12, cursor:'pointer' }}>
              Close
            </button>
          </div>
        </div>
      )}

      
      {/* ══ MOOD PROMPT MODAL ══════════════════════════════════════ */}
      {showMoodPrompt && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setShowMoodPrompt(null)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:24, width:'90%', maxWidth:320, color:'#fff', textAlign:'center' }}>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginBottom:14 }}>How did that session feel?</div>
            <div style={{ display:'flex', justifyContent:'center', gap:10 }}>
              {[
                { emoji: '😫', label: 'Hard' },
                { emoji: '😐', label: 'Okay' },
                { emoji: '😊', label: 'Good' },
                { emoji: '🔥', label: 'Great' },
              ].map(m => (
                <button key={m.label} onClick={() => logSessionMood(m.label)}
                  style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:14, padding:'10px 14px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4, fontSize:11, color:'rgba(255,255,255,0.7)' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.14)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.06)'}>
                  <span style={{ fontSize:22 }}>{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
            <button onClick={()=>setShowMoodPrompt(null)}
              style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.3)', fontSize:11, marginTop:14, cursor:'pointer' }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ══ DISTRACTION LOG MODAL ══════════════════════════════════ */}
      {showDistractionLog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setShowDistractionLog(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:28, width:'90%', maxWidth:360, color:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:800 }}>What pulled you away?</h2>
              <button onClick={()=>setShowDistractionLog(false)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, lineHeight:1, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
              {['📱 Phone', '💬 Message', '🌐 Browsing', '🧠 Random thought', '🗣️ Someone talked to me', '😴 Low energy'].map(reason => (
                <button key={reason} onClick={() => logDistraction(reason)}
                  style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', padding:'8px 14px', borderRadius:100, fontSize:13, cursor:'pointer' }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.16)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
                  {reason}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input
                value={customDistraction}
                onChange={e=>setCustomDistraction(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && customDistraction.trim()) logDistraction(customDistraction.trim()) }}
                placeholder="Something else..."
                style={{ flex:1, background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, color:'#fff', fontSize:13, padding:'8px 12px', caretColor:'#fff' }}
              />
              <button
                onClick={() => { if (customDistraction.trim()) logDistraction(customDistraction.trim()) }}
                style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', borderRadius:10, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ KEYBOARD HELP ═══════════════════════════════════════════════════════ */}
      {showKeyHelp && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setShowKeyHelp(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:32, width:'90%', maxWidth:380, color:'#fff', textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:14 }}>⌨️</div>
            <h2 style={{ margin:'0 0 20px', fontSize:20, fontWeight:800 }}>Keyboard Shortcuts</h2>
            {[['Space','Start / Pause first timer'],['R','Reset first timer'],['N','Toggle ambient noise'],['1','Timer tab'],['2','Sounds tab'],['3','Notes tab'],['4','Stopwatch tab'],['5','Stats tab']].map(([k,d])=>(
              <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                <kbd style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', padding:'3px 10px', borderRadius:6, fontSize:12, fontWeight:800, fontFamily:'monospace' }}>{k}</kbd>
                <span style={{ fontSize:13, color:'rgba(255,255,255,0.7)' }}>{d}</span>
              </div>
            ))}
            <button onClick={()=>setShowKeyHelp(false)}
              style={{ marginTop:20, background:bgColor, border:'none', color:'#fff', padding:'11px 36px', borderRadius:10, fontSize:14, fontWeight:800 }}>Got it</button>
          </div>
        </div>
      )}

      {/* ══ UPGRADE MODAL ════════════════════════════════════════════════════════ */}
      {showUpgrade && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setShowUpgrade(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:22, padding:40, width:'90%', maxWidth:400, color:'#fff', textAlign:'center' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>⚡</div>
            <h2 style={{ margin:'0 0 8px', fontSize:24, fontWeight:800 }}>Upgrade to Pro</h2>
            <p style={{ color:'rgba(255,255,255,0.6)', marginBottom:24, fontSize:14, lineHeight:1.65 }}>Unlock cloud sync and unlimited history</p>
            {[
                '⏱️ Up to 4 timers & stopwatches',
                '🧠 Unlimited AI Coach messages',
                '🎵 All ambient sounds (rain, café, forest)',
                '☁️ Cloud sync across all devices',
                '📊 CSV export of your stats',
              ].map(f=>(
                <div key={f} style={{ fontSize:14, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.08)', textAlign:'left', color:'rgba(255,255,255,0.8)' }}>{f}</div>
              ))}
            <div style={{ fontSize:34, fontWeight:800, margin:'22px 0 4px' }}>$3.99 CAD</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:22 }}>per month · cancel anytime</div>
            <button onClick={startCheckout}
              style={{ width:'100%', background:bgColor, border:'none', color:'#fff', padding:15, borderRadius:12, fontSize:16, fontWeight:800, marginBottom:10 }}>
              Start Pro - $3.99 CAD/mo
            </button>
            <button onClick={()=>setShowUpgrade(false)}
              style={{ width:'100%', background:'transparent', border:'1px solid rgba(255,255,255,0.18)', color:'rgba(255,255,255,0.55)', padding:12, borderRadius:12, fontSize:14 }}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* ══ ONBOARDING ═══════════════════════════════════════════════════════════ */}
      {showOnboard && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(12px)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:22, padding:40, width:'90%', maxWidth:440, color:'#fff', textAlign:'center' }}>
            {onboardStep===1&&(<>
              <div style={{ fontSize:64, marginBottom:20 }}>🍅</div>
              <h2 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>Welcome to Pomodoros.io</h2>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:14, lineHeight:1.7 }}>The only Pomodoro timer with up to <strong>4 simultaneous timers</strong>, AI insights, stopwatch, ambient noise and more. All free.</p>
            </>)}
            {onboardStep===2&&(<>
              <div style={{ fontSize:64, marginBottom:20 }}>🎯</div>
              <h2 style={{ fontSize:22, fontWeight:800, marginBottom:16 }}>How it works</h2>
              {['Add your tasks below the timer','Hit START for a 25-min focus session','Take a break when the alarm rings','After 4 cycles, earn a long break','Sign in to sync your stats'].map((s,i)=>(
                <div key={i} style={{ fontSize:13, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.08)', textAlign:'left', color:'rgba(255,255,255,0.75)' }}>{i+1}. {s}</div>
              ))}
            </>)}
            {onboardStep===3&&(<>
              <div style={{ fontSize:64, marginBottom:20 }}>🏆</div>
              <h2 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>Sync your progress</h2>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:14, lineHeight:1.7, marginBottom:20 }}>Sign in with Google to sync your focus stats across devices and keep your productivity data safe.</p>
              <button onClick={signIn} style={{ width:'100%', background:bgColor, border:'none', color:'#fff', padding:13, borderRadius:10, fontSize:15, fontWeight:800, marginBottom:10 }}>Sign In with Google</button>
            </>)}
            <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:22 }}>
              <button onClick={()=>{ls.set('pom_visited',true);setShowOnboard(false)}}
                style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.55)', padding:'10px 22px', borderRadius:10, fontSize:13 }}>Skip</button>
              <button onClick={()=>{ if(onboardStep>=3){ls.set('pom_visited',true);setShowOnboard(false);}else setOnboardStep(s=>s+1) }}
                style={{ background:bgColor, border:'none', color:'#fff', padding:'10px 22px', borderRadius:10, fontSize:13, fontWeight:800 }}>
                {onboardStep>=3?'Get Started':'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {tab !== 'timer' && (
        <div style={{ position:'fixed', bottom:6, left:'50%', transform:'translateX(-50%)', display:'flex', gap:16, fontSize:10, color:'rgba(255,255,255,0.2)', zIndex:1 }}>
          {['Blog','Privacy','Terms','Contact'].map(l=>(
            <span key={l} style={{ cursor:'pointer' }} onClick={()=>window.open(l==='Blog' ? '/blog' : `https://www.pomodoros.io/${l.toLowerCase()}`, l==='Blog' ? '_self' : '_blank')}>{l}</span>
          ))}
        </div>
      )}

  {focusMode && focusModeDisplayTimer && (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: `url('${currentBgImage}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        zIndex: 0,
      }}/>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

        <div style={{
          position: 'absolute',
          top: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: 1,
        }}>
          Press ESC to exit
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}>
          <div style={{
            fontSize: 22,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: 3,
            fontFamily: "'Caveat', cursive",
          }}>
            {focusModeDisplayTimer.name}
          </div>

          <div style={{
            fontSize: 'clamp(96px, 20vw, 200px)',
            fontWeight: 300,
            color: '#fff',
            fontFamily: '"Outfit", sans-serif',
            letterSpacing: -4,
            textShadow: '0 4px 32px rgba(0,0,0,0.4)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtTime(focusModeDisplayTimer.secsLeft)}
          </div>

          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 4,
            fontFamily: '"Outfit", sans-serif',
          }}>
            {focusModeDisplayTimer.mode === 'pomodoro' ? 'FOCUS SESSION' : 'BREAK TIME'}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              onClick={() => toggleTimer(focusModeDisplayTimer.id)}
              style={{
                padding: '16px 56px',
                borderRadius: 100,
                border: '1px solid rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.95)',
                color: '#1a0a20',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 3,
                cursor: 'pointer',
                fontFamily: '"Outfit", sans-serif',
                boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
              }}>
              {focusModeDisplayTimer.running ? 'PAUSE' : 'START'}
            </button>
            <button
              onClick={() => resetTimer(focusModeDisplayTimer.id)}
              style={{
                padding: '16px 32px',
                borderRadius: 100,
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 2,
                cursor: 'pointer',
                fontFamily: '"Outfit", sans-serif',
                backdropFilter: 'blur(8px)',
              }}>
              ↺ RESET
            </button>
          </div>
        </div>
      </div>
    </div>
  )}     {/* SoundCloud Music Player - hidden iframe + custom glass UI */}
        {/* Hidden SoundCloud iframe - loads in background */}
        <iframe
          id="sc-iframe"
          title="SC"
          width="1"
          height="1"
          scrolling="no"
          frameBorder="no"
          allow="autoplay; encrypted-media"
          src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/playlists/soundcloud%253Aplaylists%253A2252642798&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false"
          style={{
            position: 'fixed',
            bottom: -100,
            left: -100,
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1,
            width: 1,
            height: 1,
          }}
        />

        
        {/* Custom glass player UI */}
        <div
          className="yt-player"
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 50,
            padding: '8px 16px 8px 8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            opacity: 0.9,
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
        >
          {/* Album art */}
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 16,
              animation: scPlaying ? 'spin 3s linear infinite' : 'none',
            }}>🎵</div>
          </div>

          {/* Label */}
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.8)',
            letterSpacing: 0.5,
            fontFamily: '"Outfit", sans-serif',
            whiteSpace: 'nowrap',
          }}>
            {scPlaying ? 'Now Playing' : 'Play Music'}
          </div>

          {/* Play/Pause button */}
          <button
            onClick={toggleScPlay}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.35)',
              background: scPlaying ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
            onMouseLeave={e => e.currentTarget.style.background = scPlaying ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)'}
          >
            {scPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={scNext}
            title="Next track"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            ⏭
          </button>
        </div>

      {/* Focus Mode Button - bottom right */}
      <button
        className="focus-bottom-btn"
        onClick={() => setFocusMode(f => !f)}
        title="Focus Mode"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 500,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.25)',
          background: focusMode
            ? 'rgba(255,255,255,0.28)'
            : 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#fff',
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.32)'
          e.currentTarget.style.transform = 'scale(1.08)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = focusMode
            ? 'rgba(255,255,255,0.28)'
            : 'rgba(255,255,255,0.12)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        ⛶
      </button>
    </div>
  </div>
  )
}