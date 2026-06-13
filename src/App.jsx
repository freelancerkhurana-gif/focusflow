import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

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
  { key: 'white',  label: 'White Noise' },
  { key: 'pink',   label: 'Pink Noise'  },
  { key: 'brown',  label: 'Brown Noise' },
  { key: 'rain',   label: 'Rain'        },
  { key: 'cafe',   label: 'Café'        },
  { key: 'forest', label: 'Forest'      },
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

  // ── SUPABASE AUTH ──
  const [user, setUser] = useState(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading, setLbLoading] = useState(false)

  // ── PRO ──
  const [isPro, setIsPro] = useState(() => ls.get('pom_pro', false))
  const [showUpgrade, setShowUpgrade] = useState(false)

  // ── UI ──
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const [showKeyHelp, setShowKeyHelp] = useState(false)
  const [showOnboard, setShowOnboard] = useState(() => !ls.get('pom_visited', false))
  const [onboardStep, setOnboardStep] = useState(1)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [installPrompt, setInstallPrompt] = useState(null)

  // ── THEME: background changes with timerMode ──
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('pom_theme_dark')
    return saved !== null ? JSON.parse(saved) : false
  })
  const bgColor = isDark ? '#0a0a0a' : (PHASE_COLORS[timerMode] || PHASE_COLORS.pomodoro)
  const accentColor = isDark ? '#1a1a1a' : bgColor
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

  const signIn = () => supabase.auth.signInWithOAuth({
    provider: 'google', options: { redirectTo: window.location.origin }
  })
  const signOut = () => { supabase.auth.signOut(); setUser(null) }

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
    const next = lastDate === yest ? streak + 1 : 1
    setStreak(next)
    ls.set('pom_streak', next)
    ls.set('pom_lastDate', today)
    if (next > 1) showToast(`🔥 ${next} day streak!`)
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
    if (timers.length >= 4) { showToast('Maximum 4 timers'); return }
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
        showToast(isPomodoro ? `🍅 ${t.name} complete! Take a break.` : `⚡ Break over — back to focus!`)
        // determine next mode
        let nextMode
        if (isPomodoro) {
          nextMode = newCycles % settings.longBreakEvery === 0 ? 'longBreak' : 'shortBreak'
        } else {
          nextMode = 'pomodoro'
        }
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
  const addStopwatch = () => {
    if (stopwatches.length >= 4) { showToast('Maximum 4 stopwatches'); return }
    const id = Date.now()
    setStopwatches(prev => [...prev, makeSW(id, prev.length + 1)])
  }

  const removeSW = (id) => {
    clearInterval(swRefs.current[id]); delete swRefs.current[id]
    setStopwatches(prev => (prev || []).filter(s => s.id !== id))
  }

  const toggleSW = (id) => {
    setStopwatches(prev => {
      const sw = (prev || []).find(s => s.id === id)
      if (!sw) return prev
      if (sw.running) {
        clearInterval(swRefs.current[id]); delete swRefs.current[id]
        return (prev || []).map(s => s.id === id ? { ...s, running: false } : s)
      } else {
        const start = Date.now() - sw.elapsed * 1000
        swRefs.current[id] = setInterval(() => {
          setStopwatches(p => (p || []).map(s => s.id === id
            ? { ...s, elapsed: Math.floor((Date.now() - start) / 1000) } : s))
        }, 1000)
        return (prev || []).map(s => s.id === id ? { ...s, running: true } : s)
      }
    })
  }

  const lapSW = (id) => {
    setStopwatches(prev => (prev || []).map(s => {
      if (s.id !== id || !s.running) return s
      const prevTotal = s.laps.length ? s.laps[s.laps.length - 1].total : 0
      return { ...s, laps: [...s.laps, { n: s.laps.length + 1, split: s.elapsed - prevTotal, total: s.elapsed }] }
    }))
  }

  const resetSW = (id) => {
    clearInterval(swRefs.current[id]); delete swRefs.current[id]
    setStopwatches(prev => (prev || []).map(s => s.id === id ? { ...s, elapsed: 0, running: false, laps: [] } : s))
  }

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

  // ─── RESIZE ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
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
      return { ...t, secsLeft: secs }
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
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
      *, *::before, *::after { box-sizing: border-box; -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }
      *::-webkit-scrollbar { width: 4px; } *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      body, html { margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: #0f172a; }
      button { cursor: pointer; font-family: inherit; transition: all .2s cubic-bezier(0.23,1,0.32,1); }
      button:focus, input:focus, textarea:focus { outline: none; }
      @keyframes cfall { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(105vh) rotate(540deg);opacity:0} }
      @keyframes fadeUp { from{opacity:0;transform:translateX(-50%) translateY(10px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
      @keyframes meshFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-20px) scale(1.05)} }
      .start-btn:hover { transform: translateY(-3px) scale(1.03) !important; box-shadow: 0 15px 40px rgba(0,0,0,0.4) !important; }
      .tab-btn:hover { background: rgba(255,255,255,0.08) !important; color: #f8fafc !important; }
      .task-row:hover { border-color: rgba(255,255,255,0.12) !important; background: rgba(255,255,255,0.05) !important; }
      .icon-btn:hover { background: rgba(255,255,255,0.12) !important; transform: translateY(-2px); }
      .adj-btn:hover { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.3) !important; }
      .timer-grid { transition: grid-template-columns 0.45s cubic-bezier(0.4,0,0.2,1) !important; }
            .sw-grid    { transition: all 0.45s cubic-bezier(0.23,1,0.32,1) !important; }
      .preset-btn:hover { border-color: #10b981 !important; color: #10b981 !important; background: rgba(16,185,129,0.08) !important; }
      .work-btn:hover  { box-shadow: 0 0 20px rgba(16,185,129,0.3) !important; }
      .break-btn:hover { box-shadow: 0 0 20px rgba(59,130,246,0.3) !important; }
      input::placeholder { color: #334155 !important; }
      textarea::placeholder { color: #334155 !important; }
      html, body { overflow: hidden !important; height: 100% !important; }
      #root { height: 100% !important; overflow: hidden !important; }
            .timer-card-wrap { transition: all 0.4s cubic-bezier(0.4,0,0.2,1) !important; opacity: 1 !important; }
      @media(max-width:767px){.timer-grid{grid-template-columns:1fr!important}.sw-grid{grid-template-columns:1fr!important}}
    `
    document.head.appendChild(s)
    return () => document.head.removeChild(s)
  }, [])

  
  // ─── TIMER CARD ──────────────────────────────────────────────────────────────
  const TimerCard = ({ timer, count }) => {
    const isLarge  = count === 1
    const isMed    = count === 2
    const isSmallGrid = count >= 3
    const digitPx  = isMobile ? 76 : isLarge ? 121 : isMed ? 96 : 84
    const padV     = isLarge ? 12 : isMed ? 10 : 10
    const padH     = isLarge ? 24 : isMed ? 20 : 14

    const modeColor = {
      pomodoro:   '#BA4949',
      shortBreak: '#38858A',
      longBreak:  '#397097',
    }[timer.mode]

    return (
      <div className="timer-card-wrap" style={{
    background: 'rgba(0,0,0,0.18)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderTop: '2px solid rgba(255,255,255,0.55)',
    borderRadius: 10,
    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.15), 0 2px 12px rgba(0,0,0,0.2)',
    padding: `${padV}px ${padH}px`,
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
        {/* Name — editable */}
        {editingId === timer.id ? (
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={() => {
    const trimmed = (editName || editingName || '').trim()
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
      const trimmed = (editName || editingName || '').trim()
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
        
        {/* Mode tabs — per timer */}
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
                ? (isDark ? '#6B2020' : 'rgba(255,255,255,0.28)')
                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'),
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              boxShadow: timer.mode === 'pomodoro'
                ? (isDark ? '0 0 14px rgba(107,32,32,0.6)' : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.15)')
                : 'none',
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
                ? (isDark ? '#2E7FBF' : 'rgba(255,255,255,0.28)')
                : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)'),
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              boxShadow: timer.mode !== 'pomodoro'
                ? (isDark ? '0 0 14px rgba(46,127,191,0.7)' : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.15)')
                : 'none',
            }}>
            Break
          </button>
        </div>
        </div>

        
        {/* Countdown */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 0,
            marginBottom: 0,
            width: '100%',
            justifyContent: 'center',
            paddingRight: 8,
          }}>
          <button onClick={() => !timer.running && updateTimerField(timer.id,'secsLeft',Math.max(60,timer.secsLeft-60))}
            style={{
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.6)',
    width: 34,
    height: 34,
    borderRadius: '50%',
    fontSize: 18,
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
            <div style={{ fontSize:digitPx, fontWeight:700, color:'#fff', letterSpacing:-2, lineHeight:1, userSelect:'none', fontVariantNumeric:'tabular-nums', animation: timer.running?'none':'none' }}>
              {fmtTime(timer.secsLeft)}
            </div>
          </div>

          <button onClick={() => !timer.running && updateTimerField(timer.id,'secsLeft',Math.min(3600,timer.secsLeft+60))}
            style={{
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.6)',
    width: 34,
    height: 34,
    borderRadius: '50%',
    fontSize: 18,
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
    background: '#fff',
    color: bgColor,
    fontSize: isLarge ? 14 : isMed ? 12 : 11,
    fontWeight: 900,
    letterSpacing: 2,
    cursor: 'pointer',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(0,0,0,0.15)',
    flexShrink: 0,
    transition: 'opacity 0.15s ease',
  }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
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
    fontSize: isLarge ? 14 : isMed ? 12 : 11,
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
        </div>

              </div>
    )
  }

  // ─── STOPWATCH CARD ──────────────────────────────────────────────────────────
  const SWCard = ({ sw, count }) => {
    const isLarge = count === 1
    return (
      <div style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.18)', borderTop:'3px solid rgba(255,255,255,0.6)', borderRadius:12, padding: isLarge?'32px 40px':'20px 24px', display:'flex', flexDirection:'column', alignItems:'center', position:'relative' }}>
        {count > 1 && (
          <button onClick={() => removeSW(sw.id)} style={{ position:'absolute', top:8, right:10, background:'transparent', border:'none', color:'rgba(255,255,255,0.4)', fontSize:20 }}
            onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.4)'}>×</button>
        )}
        <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.7)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:10 }}>{sw.name}</div>
        <div style={{ fontSize: isLarge?110:70, fontWeight:700, color:'#fff', letterSpacing:-4, lineHeight:1, fontVariantNumeric:'tabular-nums', marginBottom:8 }}>{fmtHMS(sw.elapsed)}</div>
        <div style={{ fontSize:10, fontWeight:600, letterSpacing:2, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', marginBottom:14 }}>
          {sw.running ? 'COUNTING' : sw.elapsed > 0 ? 'PAUSED' : 'READY'}
        </div>
        {sw.laps.slice(-4).map(l => (
          <div key={l.n} style={{ display:'flex', justifyContent:'space-between', width:'100%', maxWidth:260, fontSize:11, color:'rgba(255,255,255,0.55)', padding:'3px 0', borderBottom:'1px solid rgba(255,255,255,0.08)', fontFamily:'monospace' }}>
            <span>Lap {l.n}</span><span>+{fmtHMS(l.split)}</span><span style={{opacity:.6}}>{fmtHMS(l.total)}</span>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <button onClick={() => toggleSW(sw.id)} style={{ background:'#fff', color:bgColor, border:'none', padding:'13px 40px', borderRadius:4, fontSize:15, fontWeight:900, letterSpacing:2 }}
            onMouseEnter={e=>e.currentTarget.style.opacity='.88'} onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            {sw.running ? 'STOP' : 'START'}
          </button>
          <button onClick={() => lapSW(sw.id)} disabled={!sw.running} style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.2)', color:sw.running?'#fff':'rgba(255,255,255,0.3)', padding:'13px 18px', borderRadius:4, fontSize:13, fontWeight:700, opacity:sw.running?1:.5 }}>Lap</button>
          <button onClick={() => resetSW(sw.id)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.5)', padding:'13px 12px', fontSize:13 }}
            onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.5)'}>↺</button>
        </div>
      </div>
    )
  }

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

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: bgColor,
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
      transition: 'background 0.4s ease, color 0.3s ease',
    }}>
      {/* Animated mesh background */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(circle at 15% 15%, ${accentColor}22 0%, transparent 45%),
          radial-gradient(circle at 85% 85%, ${accentColor}14 0%, transparent 45%),
          radial-gradient(circle at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 60%)
        `,
        filter: 'blur(60px)',
        animation: 'meshFloat 8s ease-in-out infinite',
        opacity: meshOpacity,
      }}/>

      {/* Main content wrapper */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
      }}>
        {/* ══ HEADER ══════════════════════════════════════════════════════════════ */}
        <div style={{ height: 58, flexShrink: 0, padding: '0 20px', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{
    fontFamily: "'Outfit', -apple-system, sans-serif",
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: -0.5,
    color: '#fff',
    userSelect: 'none',
  }}>
    Pomodoros<span style={{
      color: 'rgba(255,255,255,0.55)',
      fontWeight: 300,
      fontSize: 20,
    }}>.io</span>
  </span>
                      </div>

          {/* Right buttons */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {streak > 0 && (
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 20,
                padding: '4px 12px',
                color: '#fff',
                marginRight: 2,
              }}>🔥 {streak}</span>
            )}
                        <button
              onClick={() => setIsDark(d => !d)}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                border: isDark
                  ? '1px solid rgba(255,255,255,0.15)'
                  : '1px solid rgba(0,0,0,0.15)',
                background: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
                color: isDark ? '#f8fafc' : '#0f172a',
                fontSize: 17,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}>
              {isDark ? '☀️' : '🌙'}
            </button>
            {[
              { icon:'🖥', tip:'Color Wash Mode', fn: openWashMode },
              { icon:'⚙️', tip:'Settings', fn:()=>{ setTempSettings(settings); setShowSettings(true) } },
              { icon:'?', tip:'Keyboard Shortcuts', fn:()=>setShowKeyHelp(true) },
            ].map(b => (
              <button key={b.icon} className="icon-btn" onClick={b.fn} title={b.tip}
                style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', width:38, height:38, borderRadius:'50%', fontSize:16, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {b.icon}
              </button>
            ))}
                                  </div>
        </div>

      {/* ══ MAINTENANCE BANNER ════════════════════════════════════════════════════════════ */}
      <div style={{
        width: '100%',
        textAlign: 'center',
        padding: '5px 16px',
        background: 'rgba(0,0,0,0.15)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: '#FF3B3B',
        flexShrink: 0,
      }}>
        🚧 We are actively working on improving this site — sorry for any inconvenience caused 🚧
      </div>

      {/* ══ NAV TABS ════════════════════════════════════════════════════════════ */}
      <div style={{ flexShrink: 0, padding: '8px 16px 0', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflowX: 'auto' }}>
        <div style={{ display:'flex', background:isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)', border:isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.1)', borderRadius:100, padding:5, gap:2 }}>
          {[{k:'timer',l:'Pomodoro'},{k:'sounds',l:'Sounds'},{k:'notes',l:'Notes'},{k:'stopwatch',l:'Stopwatch'},{k:'stats',l:'Report'}].map(t => (
            <button key={t.k} className="tab-btn" onClick={()=>setTab(t.k)}
              style={{ background:tab===t.k?accentColor:'transparent', color:tab===t.k?'#fff':'#64748b', border:'none', padding:'6px 13px', borderRadius:100, fontSize:12, fontWeight:tab===t.k?700:500, letterSpacing:.3 }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Add timer / stopwatch */}
        {(tab==='timer'||tab==='stopwatch') && (
          <button onClick={tab==='timer'?addTimer:addStopwatch}
            disabled={(tab==='timer'?timers:stopwatches).length>=4}
            style={{ background:isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border:isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)', color:isDark ? '#94a3b8' : '#475569', padding:'6px 13px', borderRadius:100, fontSize:12, fontWeight:600, opacity:(tab==='timer'?timers:stopwatches).length>=4?.4:1 }}>
            + Add {tab==='timer'?'Timer':'Stopwatch'}
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
            padding: timers.length <= 2 ? '4px 24px 12px' : '4px 8px 12px',
            boxSizing: 'border-box',
            alignItems: 'center',
          }}>
            {/* Timer grid */}
            <div className="timer-grid" style={{
              display: 'grid',
              gridTemplateColumns: timers.length === 1 ? '1fr' : '1fr 1fr',
              gridTemplateRows: timers.length >= 3 ? '1fr 1fr' : '1fr',
              gap: 10,
              flex: 1,
              width: '100%',
              maxWidth: timers.length === 1 ? 380 : timers.length === 2 ? 720 : 940,
              margin: '0 auto',
              alignItems: 'stretch',
              alignContent: timers.length <= 2 ? 'center' : 'stretch',
              justifyContent: 'center',
              justifyItems: 'stretch',
              padding: '0 4px',
              boxSizing: 'border-box',
              height: timers.length <= 2 ? 'auto' : '100%',
              maxHeight: timers.length === 1 ? '82vh' : timers.length === 2 ? '80vh' : '100%',
              minHeight: 0,
            }}>
              {(timers || []).map((t, idx) => (
                <div key={t.id} style={{
                  gridColumn: timers.length === 3 && idx === 2 ? '1 / -1' : 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  width: '100%',
                  minHeight: 0,
                }}>
                  <div style={{
                    width: timers.length === 3 && idx === 2 ? '50%' : '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  }}>
                    <TimerCard timer={t} count={timers.length} />
                  </div>
                </div>
              ))}
            </div>

            
            
              
                        </div>
        )}

        {/* ── SOUNDS TAB ── */}
        {tab==='sounds' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <h2 style={{ fontWeight:300, fontSize:24, letterSpacing:1, marginBottom:28 }}>Ambient Noise</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
              {NOISE_OPTIONS.map(n => (
                <button key={n.key} className="noise-btn"
                  onClick={()=>{ setNoiseKey(n.key); setNoiseOn(true) }}
                  style={{ background:noiseKey===n.key&&noiseOn?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.18)', border:`1px solid ${noiseKey===n.key&&noiseOn?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.2)'}`, color:noiseKey===n.key&&noiseOn?'#fff':'rgba(255,255,255,0.65)', padding:'18px 10px', borderRadius:10, fontSize:14, fontWeight:700, transition:'all .15s' }}>
                  {n.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', letterSpacing:1.5, marginBottom:8 }}>VOLUME — {Math.round(volume*100)}%</div>
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e=>setVolume(+e.target.value)}
                style={{ width:220, accentColor:'#fff' }} />
            </div>
            {noiseOn && (
              <button onClick={()=>setNoiseOn(false)}
                style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.25)', color:'rgba(255,255,255,0.8)', padding:'11px 30px', borderRadius:8, fontSize:14, fontWeight:700 }}>
                Stop Sound
              </button>
            )}
          </div>
        )}

        {/* ── NOTES TAB ── */}
        {tab==='notes' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', overflow:'hidden', padding:'0 16px' }}>
            <h2 style={{ fontWeight:300, fontSize:24, letterSpacing:1, marginBottom:24 }}>Notes</h2>
            <textarea value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Type your notes here..."
              style={{ width:'100%', height: 'calc(100vh - 260px)', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', padding:20, borderRadius:12, fontSize:15, lineHeight:1.75, resize:'vertical', caretColor:'#fff', transition:'border .2s' }}
              onFocus={e=>e.target.style.borderColor='rgba(255,255,255,0.45)'}
              onBlur={e=>e.target.style.borderColor='rgba(255,255,255,0.2)'} />
            <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:14 }}>
              <button onClick={()=>{ls.set('pom_note',note);showToast('Notes saved ✓')}}
                style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', padding:'10px 26px', borderRadius:8, fontSize:14, fontWeight:700 }}>Save</button>
              <button onClick={()=>{setNote('');ls.set('pom_note','')}}
                style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.65)', padding:'10px 22px', borderRadius:8, fontSize:14 }}>Clear</button>
            </div>
          </div>
        )}

        {/* ── STOPWATCH TAB ── */}
        {tab==='stopwatch' && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
            <div className="sw-grid" style={{
              display: 'grid',
              gridTemplateColumns: stopwatches.length === 1 ? '1fr' : '1fr 1fr',
              gap: 12,
              flex: 1,
              overflow: 'hidden',
              width: '100%',
              maxWidth: stopwatches.length === 1 ? 420 : '100%',
              margin: '0 auto',
              alignItems: 'center',
              justifyItems: 'center',
              transition: 'all 0.45s cubic-bezier(0.23,1,0.32,1)',
            }}>
              {(stopwatches || []).map(sw => <SWCard key={sw.id} sw={sw} count={stopwatches.length} />)}
            </div>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab==='stats' && (
          <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px' }}>
            <h2 style={{ textAlign:'center', fontSize:13, fontWeight:700, letterSpacing:2, textTransform:'uppercase', color:'rgba(255,255,255,0.7)', marginBottom:20 }}>Today's Report</h2>

            {/* Tasks section */}
            <div style={{ maxWidth: 680, margin: '0 auto 24px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.1)', paddingBottom:8, marginBottom:12 }}>
                <span style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, color:'rgba(255,255,255,0.5)', textTransform:'uppercase' }}>Tasks</span>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{pendingTasks.length} remaining</span>
              </div>
              {tasks.map(task => (
                <div key={task.id}
                  onClick={() => setActiveTaskId(task.id===activeTaskId?null:task.id)}
                  style={{ display:'flex', alignItems:'center', gap:10, background:activeTaskId===task.id?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.03)', border:activeTaskId===task.id?'1px solid rgba(255,255,255,0.3)':'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'10px 14px', marginBottom:6, cursor:'pointer' }}>
                  <input type="checkbox" checked={task.done} onClick={e=>e.stopPropagation()}
                    onChange={e => setTasks(prev => prev.map(t => t.id===task.id?{...t,done:e.target.checked}:t))}
                    style={{ width:14, height:14, cursor:'pointer', flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:13, fontWeight:500, textDecoration:task.done?'line-through':'none', color:task.done?'rgba(255,255,255,0.35)':'#fff' }}>{task.name}</span>
                  <div style={{ display:'flex', gap:3 }}>
                    {Array(task.estimatedPomodoros||1).fill(0).map((_,i)=>(
                      <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:i<(task.completedPomodoros||0)?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.18)' }}/>
                    ))}
                  </div>
                  <button onClick={e=>{e.stopPropagation();setTasks(prev=>prev.filter(t=>t.id!==task.id))}}
                    style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.3)', fontSize:16, cursor:'pointer', flexShrink:0 }}
                    onMouseEnter={e=>e.currentTarget.style.color='#fff'}
                    onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>×</button>
                </div>
              ))}
              <div style={{ border:'1px dashed rgba(255,255,255,0.15)', borderRadius:10, padding:'10px 14px', cursor:'text', background:'rgba(255,255,255,0.02)' }}
                onClick={()=>document.getElementById('pom-task-inp-report')?.focus()}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18, color:'rgba(255,255,255,0.3)' }}>＋</span>
                  <input id="pom-task-inp-report" value={newTask} onChange={e=>setNewTask(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&newTask.trim()){setTasks(prev=>[...prev,{id:Date.now(),name:newTask.trim(),estimatedPomodoros:newTaskEst,completedPomodoros:0,done:false}]);setNewTask('');setNewTaskEst(1);}}}
                    placeholder="Add task (Enter to save)"
                    style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:13, caretColor:'#fff' }}/>
                </div>
                {newTask && (
                  <div style={{ display:'flex', gap:8, marginTop:8, alignItems:'center' }}>
                    <select value={newTaskEst} onChange={e=>setNewTaskEst(+e.target.value)}
                      style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff', padding:'3px 6px', borderRadius:6, fontSize:12 }}>
                      {Array.from({length:10},(_,i)=><option key={i+1} value={i+1}>{i+1}🍅</option>)}
                    </select>
                    <button onClick={()=>{if(newTask.trim()){setTasks(prev=>[...prev,{id:Date.now(),name:newTask.trim(),estimatedPomodoros:newTaskEst,completedPomodoros:0,done:false}]);setNewTask('');setNewTaskEst(1);}}}
                      style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', padding:'4px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer' }}>Add</button>
                    <button onClick={()=>setNewTask('')}
                      style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.5)', padding:'4px 10px', borderRadius:8, fontSize:12, cursor:'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            </div>

            {/* Stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
              {[
                {l:'Focus Time', v:fmtTime(totalFocusSecs)},
                {l:'Break Time', v:fmtTime(totalBreakSecs)},
                {l:'Cycles', v:totalCycles},
                {l:'Focus Score', v:focusScore+'%'},
              ].map(s=>(
                <div key={s.l} className="stat-card" style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, padding:'18px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', letterSpacing:1, textTransform:'uppercase', marginBottom:8 }}>{s.l}</div>
                  <div style={{ fontSize:28, fontWeight:300, fontVariantNumeric:'tabular-nums' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginBottom:16 }}>
              {[
                {l:'Clear Stats', fn:()=>{setTimers(p=>p.map(t=>({...t,totalFocusSecs:0,totalBreakSecs:0,cyclesDone:0})));showToast('Stats cleared')}},
                {l:'Export CSV', fn:exportCSV},
                {l:'Share on X', fn:shareX},
                {l:'🏆 Leaderboard', fn:()=>{setShowLeaderboard(true);loadLeaderboard()}},
                user&&{l:'☁️ Sync to Cloud', fn:syncToCloud},
              ].filter(Boolean).map(b=>(
                <button key={b.l} onClick={b.fn}
                  style={{ background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.22)', color:'rgba(255,255,255,0.8)', padding:'9px 16px', borderRadius:7, fontSize:13, fontWeight:700 }}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,0.35)'}
                  onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,0.2)'}>
                  {b.l}
                </button>
              ))}
            </div>

            {/* Per-timer breakdown */}
            {timers.map(t=>(
              <div key={t.id} style={{ background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.12)', borderLeft:'3px solid rgba(255,255,255,0.5)', borderRadius:8, padding:'12px 16px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                <span style={{ fontSize:14, fontWeight:700 }}>{t.name}</span>
                <div style={{ display:'flex', gap:14, fontSize:12, color:'rgba(255,255,255,0.65)' }}>
                  <span>Focus: {fmtTime(t.totalFocusSecs)}</span>
                  <span>Break: {fmtTime(t.totalBreakSecs)}</span>
                  <span>Cycles: {t.cyclesDone}</span>
                </div>
              </div>
            ))}

            {/* Daily goal */}
            <div style={{ background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:10, padding:18, marginTop:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.5)', letterSpacing:1 }}>DAILY GOAL ({settings.dailyGoalHours}h)</span>
                <span style={{ fontSize:12, fontWeight:700 }}>{Math.min(100,Math.round((totalFocusSecs/(settings.dailyGoalHours*3600))*100))}%</span>
              </div>
              <div style={{ background:'rgba(0,0,0,0.25)', borderRadius:100, height:8 }}>
                <div style={{ background:'rgba(255,255,255,0.7)', borderRadius:100, height:8, width:`${Math.min(100,(totalFocusSecs/(settings.dailyGoalHours*3600))*100)}%`, transition:'width .5s' }}/>
              </div>
              {streak>0 && <div style={{ textAlign:'center', marginTop:12, fontSize:14 }}>🔥 <strong>{streak}</strong> day streak</div>}
            </div>

            {/* Focus Heatmap */}
            <div
              style={{
                background: 'rgba(0,0,0,0.18)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: 16,
                marginTop: 14
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 12,
                  textTransform: 'uppercase'
                }}
              >
                Focus Heatmap
              </div>

              <HeatmapGrid />

              {weeklyInsights.bestHour && (
                <div
                  style={{
                    marginTop: 14,
                    textAlign: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 13
                  }}
                >
                  🧠 Best Focus Hour:
                  <strong> {weeklyInsights.bestHour}:00 </strong>
                  ({weeklyInsights.focusMinutes} mins)
                </div>
              )}
            </div>

            {/* AI Productivity Coach */}
            <div
              style={{
                background: 'rgba(0,0,0,0.18)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: 16,
                marginTop: 14
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#fff' }}>🧠 AI Productivity Coach</h3>

              {coachMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: 8,
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 13
                  }}
                >
                  • {msg}
                </div>
              ))}
            </div>

            {/* RPG Level System */}
            <div
              style={{
                background: 'rgba(0,0,0,0.18)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: 16,
                marginTop: 14
              }}
            >
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#fff' }}>
                🎮 Level {level} — {playerTitle}
              </h3>

              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 10 }}>
                XP: {xp}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 10
                }}
              >
                {badges.map(badge => (
                  <div
                    key={badge}
                    style={{
                      background: 'rgba(16,185,129,0.15)',
                      padding: '6px 10px',
                      borderRadius: 20,
                      fontSize: 12,
                      color: '#fff',
                      border: '1px solid rgba(16,185,129,0.3)'
                    }}
                  >
                    {badge}
                  </div>
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

      {/* ══ LEADERBOARD ══════════════════════════════════════════════════════════ */}
      {showLeaderboard && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(10px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={()=>setShowLeaderboard(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1a1a2e', border:'1px solid rgba(255,255,255,0.12)', borderRadius:20, padding:32, width:'90%', maxWidth:480, maxHeight:'75vh', overflowY:'auto', color:'#fff' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800 }}>🏆 Weekly Leaderboard</h2>
              <button onClick={()=>setShowLeaderboard(false)} style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.5)', fontSize:24, lineHeight:1 }}>×</button>
            </div>

            {!user && (
              <div style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:16, marginBottom:16, textAlign:'center' }}>
                <p style={{ marginBottom:12, color:'rgba(255,255,255,0.7)', fontSize:14 }}>Sign in to join the leaderboard and compete globally</p>
                <button onClick={signIn} style={{ background:bgColor, border:'none', color:'#fff', padding:'10px 24px', borderRadius:8, fontSize:14, fontWeight:700 }}>Sign In with Google</button>
              </div>
            )}

            {lbLoading ? (
              <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.5)' }}>Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div style={{ textAlign:'center', padding:40, color:'rgba(255,255,255,0.5)' }}>No sessions this week yet — be the first!</div>
            ) : leaderboard.map((e,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)', borderRadius:8, marginBottom:4, background:i<3?'rgba(255,255,255,0.04)':'transparent' }}>
                <div style={{ width:30, textAlign:'center', fontSize:i<3?20:14 }}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
                {e.avatar_url && <img src={e.avatar_url} alt="" style={{ width:32, height:32, borderRadius:'50%' }}/>}
                <div style={{ flex:1, fontSize:14, fontWeight:700 }}>{e.username||'Anonymous'}</div>
                <div style={{ fontSize:14, fontWeight:800, fontVariantNumeric:'tabular-nums' }}>
                  {Math.floor(e.total_focus_seconds/3600)}h {Math.floor((e.total_focus_seconds%3600)/60)}m
                </div>
              </div>
            ))}

            {user && (
              <button onClick={()=>{syncToCloud();setShowLeaderboard(false)}}
                style={{ width:'100%', marginTop:16, background:bgColor, border:'none', color:'#fff', padding:13, borderRadius:10, fontSize:14, fontWeight:800 }}>
                Submit My Score
              </button>
            )}
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
            <p style={{ color:'rgba(255,255,255,0.6)', marginBottom:24, fontSize:14, lineHeight:1.65 }}>Unlock cloud sync, leaderboard, and unlimited history</p>
            {['☁️ Cloud sync across all devices','🏆 Weekly leaderboard','📊 Unlimited focus history','⚡ Priority support'].map(f=>(
              <div key={f} style={{ fontSize:14, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.08)', textAlign:'left', color:'rgba(255,255,255,0.8)' }}>{f}</div>
            ))}
            <div style={{ fontSize:34, fontWeight:800, margin:'22px 0 4px' }}>$4.99</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:22 }}>per month · cancel anytime</div>
            <button onClick={()=>window.open('https://buy.stripe.com/test_bJe00j01mcZk6JOeMH8k800','_blank')}
              style={{ width:'100%', background:bgColor, border:'none', color:'#fff', padding:15, borderRadius:12, fontSize:16, fontWeight:800, marginBottom:10 }}>
              Start Pro — $4.99/mo
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
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:14, lineHeight:1.7 }}>The only Pomodoro timer with up to <strong>4 simultaneous timers</strong>, Supabase leaderboard, AI insights, stopwatch, ambient noise and more. All free.</p>
            </>)}
            {onboardStep===2&&(<>
              <div style={{ fontSize:64, marginBottom:20 }}>🎯</div>
              <h2 style={{ fontSize:22, fontWeight:800, marginBottom:16 }}>How it works</h2>
              {['Add your tasks below the timer','Hit START for a 25-min focus session','Take a break when the alarm rings','After 4 cycles, earn a long break','Sign in to join the global leaderboard'].map((s,i)=>(
                <div key={i} style={{ fontSize:13, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.08)', textAlign:'left', color:'rgba(255,255,255,0.75)' }}>{i+1}. {s}</div>
              ))}
            </>)}
            {onboardStep===3&&(<>
              <div style={{ fontSize:64, marginBottom:20 }}>🏆</div>
              <h2 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>Compete globally</h2>
              <p style={{ color:'rgba(255,255,255,0.65)', fontSize:14, lineHeight:1.7, marginBottom:20 }}>Sign in with Google to sync your focus stats and appear on the weekly leaderboard. See how you rank against focused workers worldwide.</p>
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
          {['Privacy','Terms','Contact'].map(l=>(
            <span key={l} style={{ cursor:'pointer' }} onClick={()=>window.open(`https://www.pomodoros.io/${l.toLowerCase()}`,'_blank')}>{l}</span>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}