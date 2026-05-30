import { useState, useEffect, useRef, useCallback } from "react";
import { Monitor, Sun, Moon, Volume2, VolumeX, FileText, BarChart2 } from "lucide-react";
import { supabase } from './supabase';

export default function Pomodoros() {
  // Pomodoro Presets
  const PRESETS = [
    { label: '25/5', work: 25, break: 5 },
    { label: '30/10', work: 30, break: 10 },
    { label: '45/15', work: 45, break: 15 },
  ];

  // State
  const [tab, setTab] = useState("timer");
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [phase, setPhase] = useState("work");
  const [secsLeft, setSecsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [noiseType, setNoiseType] = useState("brown");
  const [noiseOn, setNoiseOn] = useState(false);
  const [note, setNote] = useState(() => localStorage.getItem("pomodoros_note") || "");
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [themeMode, setThemeMode] = useState(
  () => localStorage.getItem('pomodoros_theme') || 'dark'
);

  // Stats state — stored in seconds for full precision, flushed on every pause
  const [sessionsCompleted, setSessionsCompleted] = useState(
    () => parseInt(localStorage.getItem("pomodoros_sessions") || "0", 10)
  );
  const [savedWorkSeconds, setSavedWorkSeconds] = useState(
    () => parseInt(localStorage.getItem("pomodoros_work_seconds") || "0", 10)
  );
  const [savedBreakSeconds, setSavedBreakSeconds] = useState(
    () => parseInt(localStorage.getItem("pomodoros_break_seconds") || "0", 10)
  );

  // Live seconds for the currently-running segment (resets to 0 each time Start is pressed)
  const [liveSeconds, setLiveSeconds] = useState(0);

  // Multi-timer state
  const [timers, setTimers] = useState([
    { 
      id: 1, 
      name: 'Task 1', 
      phase: 'work', 
      secsLeft: 25 * 60, 
      running: false,
      cyclesCompleted: 0,
      totalWorkSeconds: 0,
      totalBreakSeconds: 0,
      liveSeconds: 0,
      workMin: 25,
      breakMin: 5,
      selectedPreset: '25/5'
    }
  ]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTimerName, setNewTimerName] = useState('');
  const [editingTimerId, setEditingTimerId] = useState(null);
  const [editingName, setEditingName] = useState('');
  
  // Stopwatch state
  const [stopwatches, setStopwatches] = useState([
    { id: 1, name: 'Task 1', elapsed: 0, running: false, laps: [] }
  ]);
  const stopwatchIntervalsRef = useRef({});

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auth state
  const [user, setUser] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // PWA Install state
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstall(true);
    });
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstall(false);
  };

  // Settings state
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pomodoros_settings') || '{}');
      return {
        workMin: saved.workMin || 25,
        shortBreakMin: saved.shortBreakMin || 5,
        longBreakMin: saved.longBreakMin || 15,
        longBreakInterval: saved.longBreakInterval || 4,
        soundEnabled: saved.soundEnabled !== false,
        autoStartBreak: saved.autoStartBreak || false,
        autoStartWork: saved.autoStartWork || false,
        dailyGoalSeconds: saved.dailyGoalSeconds || 4 * 3600,
        alarmSound: saved.alarmSound || 'bell',
        browserNotifications: saved.browserNotifications !== false
      };
    } catch(e) {
      return {
        workMin: 25,
        shortBreakMin: 5,
        longBreakMin: 15,
        longBreakInterval: 4,
        soundEnabled: true,
        autoStartBreak: false,
        autoStartWork: false,
        dailyGoalSeconds: 4 * 3600,
        alarmSound: 'bell',
        browserNotifications: true
      };
    }
  });

  const [showSettings, setShowSettings] = useState(false);
  const [globalWorkMin, setGlobalWorkMin] = useState(settings.workMin || 25);
  const [globalBreakMin, setGlobalBreakMin] = useState(settings.shortBreakMin || 5);
  const [globalLongBreakMin, setGlobalLongBreakMin] = useState(settings.longBreakMin || 15);
  const [longBreakInterval, setLongBreakInterval] = useState(settings.longBreakInterval || 4);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled !== false);
  const [alarmVolume, setAlarmVolume] = useState(settings.alarmVolume || 0.3);
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.browserNotifications !== false);
  const [dailyGoal, setDailyGoal] = useState(settings.dailyGoalSeconds ? settings.dailyGoalSeconds / 3600 : 4);
  const [autoStartBreak, setAutoStartBreak] = useState(settings.autoStartBreak || false);
  const [autoStartWork, setAutoStartWork] = useState(settings.autoStartWork || false);

  // Pro state
  const [isPro, setIsPro] = useState(() => localStorage.getItem('pomodoros_pro') === 'true');
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Task management
  const [tasks, setTasks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pomodoros_tasks') || '[]'); } catch(e) { return []; }
  });
  const [newTaskInput, setNewTaskInput] = useState('');
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  // Task templates
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pomodoros_templates') || '[]'); } catch(e) { return []; }
  });

  // Focus streak
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('pomodoros_streak') || '0'));

  // Keyboard help
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Active task and focus mode
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [focusTimerId, setFocusTimerId] = useState(null);

  // Alarm sound setting
  const [alarmSound, setAlarmSound] = useState(settings.alarmSound || 'bell');

  // Onboarding and toast
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('pomodoros_visited')
  );
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [toast, setToast] = useState(null);

  // Refs
  const timerRef = useRef(null);
  const liveRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const phaseRef = useRef("work");
  phaseRef.current = phase;

  // Timer intervals ref for multi-timer system
  const timerIntervalsRef = useRef({});

  // Ref so flushLiveSeconds can read latest value without stale closure
  const liveSecondsRef = useRef(0);
  liveSecondsRef.current = liveSeconds;

  // Track previous running state to detect pause
  const prevRunningRef = useRef(false);

  // Constants
  const WASH_MODES = [
    { label: "BLACK", bg: "#000000", text: "#ffffff" },
    { label: "WHITE", bg: "#FFFFFF", text: "#000000" },
    { label: "RED", bg: "#FF0000", text: "#ffffff" },
    { label: "SOFT MINT", bg: "#E8F5E8", text: "#2D5A2D" },
    { label: "OCEAN BLUE", bg: "#0077BE", text: "#ffffff" },
    { label: "SUNSET", bg: "#FF6B6B", text: "#ffffff" },
    { label: "FOREST", bg: "#2D5A2D", text: "#ffffff" },
    { label: "LAVENDER", bg: "#E6E6FA", text: "#4B0082" },
    { label: "GOLD", bg: "#FFD700", text: "#333333" },
    { label: "CHARCOAL", bg: "#36454F", text: "#ffffff" }
  ];

  const NOISE_TYPES = ["white", "pink", "brown", "rain", "cafe", "forest"];

  // Auth useEffect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) syncStatsToCloud(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        saveUserProfile(session.user);
        syncStatsToCloud(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Global Design System Colors
  const bg = themeMode === "dark" ? "#0A0A0F" : "#E8E4DC";
  const surface = themeMode === "dark" ? "#111118" : "#DEDAD2";
  const surfaceHover = themeMode === "dark" ? "#1A1A24" : "#D4D0C8";
  const border = themeMode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
  const borderHover = themeMode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const text = themeMode === "dark" ? "#EDEDED" : "#1E1A14";
  const textDim = themeMode === "dark" ? "rgba(237,237,237,0.4)" : "rgba(30,26,20,0.45)";
  const accent = themeMode === "dark" ? "#EDEDED" : "#1E1A14";
  const accentBlue = "#E07B4F";
  const accentGreen = "#4FA8E0";

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Dynamic sizing functions
  const getGridStyle = () => {
    if (timers.length === 1) return {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: 'calc(100vh - 110px)',
      padding: '16px'
    };
    if (timers.length === 2) return {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '10px',
      height: 'calc(100vh - 110px)',
      maxHeight: 'calc(100vh - 110px)',
      padding: '10px 16px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    };
    return {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: '1fr 1fr',
      gap: '10px',
      height: 'calc(100vh - 110px)',
      maxHeight: 'calc(100vh - 110px)',
      padding: '10px 16px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    };
  };

  const getCardStyle = () => {
    if (timers.length === 1) return {
      width: '100%',
      maxWidth: '500px',
      padding: '32px',
      countdownSize: '96px',
      buttonPadding: '14px 28px',
      buttonFontSize: '15px'
    };
    if (timers.length === 2) return {
      padding: '24px',
      countdownSize: '72px',
      buttonPadding: '12px 20px',
      buttonFontSize: '14px'
    };
    return {
      padding: '12px',
      countdownSize: '48px',
      buttonPadding: '7px 12px',
      buttonFontSize: '12px'
    };
  };

  // ─── Derived stats ─────────────────────────────────────────────────────────────
  // Aggregate from all timers
  const totalWorkSecs = timers.reduce((sum, t) => sum + (t.totalWorkSeconds || 0), 0) + (phase === 'work' ? liveSeconds : 0);
  const totalBreakSecs = timers.reduce((sum, t) => sum + (t.totalBreakSeconds || 0), 0) + (phase === 'break' ? liveSeconds : 0);
  const totalCycles = timers.reduce((sum, t) => sum + (t.cyclesCompleted || 0), 0);
  const focusScore = Math.min(Math.round((totalWorkSecs / (100 * 60)) * 100), 100);

  // ─── Flush live seconds into saved totals ─────────────────────────────────────
  // Called on every pause and reset so no time is ever lost
  const flushLiveSeconds = useCallback(() => {
    const live = liveSecondsRef.current;
    if (live === 0) return;
    if (phaseRef.current === "work") {
      setSavedWorkSeconds((prev) => {
        const next = prev + live;
        localStorage.setItem("pomodoros_work_seconds", next);
        return next;
      });
    } else {
      setSavedBreakSeconds((prev) => {
        const next = prev + live;
        localStorage.setItem("pomodoros_break_seconds", next);
        return next;
      });
    }
    setLiveSeconds(0);
  }, []);

  // ─── Main countdown timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!running) {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          clearInterval(liveRef.current);

          // Flush live time then record the completed session
          const live = liveSecondsRef.current;
          if (phaseRef.current === "work") {
            setSavedWorkSeconds((prev) => {
              const next = prev + live;
              localStorage.setItem("pomodoros_work_seconds", next);
              return next;
            });
            setSessionsCompleted((prev) => {
              const n = prev + 1;
              localStorage.setItem("pomodoros_sessions", n);
              return n;
            });
          } else {
            setSavedBreakSeconds((prev) => {
              const next = prev + live;
              localStorage.setItem("pomodoros_break_seconds", next);
              return next;
            });
          }
          setLiveSeconds(0);

          const nextPhase = phaseRef.current === "work" ? "break" : "work";
          setPhase(nextPhase);
          setRunning(false);
          return nextPhase === "work" ? workMin * 60 : breakMin * 60;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [running, workMin, breakMin]);

  // ─── Live ticker ──────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(liveRef.current);
    if (!running) return;
    liveRef.current = setInterval(() => {
      setLiveSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(liveRef.current);
  }, [running]);

  // ─── Detect pause: flush live seconds into saved totals immediately ───────────
  useEffect(() => {
    if (prevRunningRef.current && !running) {
      flushLiveSeconds();
    }
    prevRunningRef.current = running;
  }, [running, flushLiveSeconds]);

  // ─── Reset ────────────────────────────────────────────────────────────────────
  const resetGlobalTimer = useCallback((newPhase = phase, newWorkMin = workMin, newBreakMin = breakMin) => {
    clearInterval(timerRef.current);
    clearInterval(liveRef.current);
    flushLiveSeconds();
    setRunning(false);
    setSecsLeft(newPhase === "work" ? newWorkMin * 60 : newBreakMin * 60);
    setPhase(newPhase);
    setLiveSeconds(0);
  }, [phase, workMin, breakMin, flushLiveSeconds]);

  // ─── Clear all stats ──────────────────────────────────────────────────────────
  const clearStats = useCallback(() => {
    setSavedWorkSeconds(0);
    setSavedBreakSeconds(0);
    setSessionsCompleted(0);
    setLiveSeconds(0);
    localStorage.removeItem("pomodoros_work_seconds");
    localStorage.removeItem("pomodoros_break_seconds");
    localStorage.removeItem("pomodoros_sessions");
    setTimers(prev => prev.map(t => ({
      ...t,
      totalWorkSeconds: 0,
      totalBreakSeconds: 0,
      cyclesCompleted: 0
    })));
    // Clear stopwatch stats
    setStopwatches(prev => prev.map(sw => ({
      ...sw,
      elapsed: 0,
      running: false,
      laps: []
    })));
  }, []);

  // ─── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Task Name', 'Work Time (MM:SS)', 'Break Time (MM:SS)', 'Cycles Completed', 'Date'],
      ...timers.map(t => [
        t.name,
        formatTime(t.totalWorkSeconds || 0),
        formatTime(t.totalBreakSeconds || 0),
        t.cyclesCompleted || 0,
        new Date().toLocaleDateString()
      ]),
      ['', '', '', '', ''],
      ['TOTALS', formatTime(totalWorkSecs), formatTime(totalBreakSecs), totalCycles, ''],
      ['', '', '', '', ''],
      ['STOPWATCH SESSIONS', '', '', '', ''],
      ['Stopwatch Name', 'Elapsed Time', 'Laps', '', 'Date'],
      ...stopwatches.filter(sw => sw.elapsed > 0).map(sw => [
        sw.name,
        formatStopwatchTime(sw.elapsed),
        sw.laps.length,
        '',
        new Date().toLocaleDateString()
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomodoros-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Share on X ─────────────────────────────────────────────────────────────
  const shareOnX = () => {
    const runningCount = timers.length;
    const totalCyclesCount = timers.reduce((sum, t) => sum + (t.cyclesCompleted || 0), 0);
    const focusTime = formatTime(totalWorkSecs);
    const tweet = `Just crushed my deep work goals on pomodoros.io! 🚀\n\n⏱️ Total focus time: ${focusTime}\n🔥 Timers tracked: ${runningCount}\n✅ Cycles completed: ${totalCyclesCount}\n\nFree multi timer for deep work 👇\nhttps://www.pomodoros.io`;
    window.open(
      'https://x.com/intent/tweet?text=' + encodeURIComponent(tweet),
      '_blank',
      'noopener,noreferrer'
    );
  };

  
  // ─── Multi-timer management functions ───────────────────────────────────────
  const addTimer = useCallback(() => {
    if (!isPro && timers.length >= 1) {
      setShowUpgrade(true);
      return;
    }
    setTimers(prev => {
      if (prev.length >= 4) return prev;
      
      const newNumber = prev.length + 1;
      const newTimer = {
        id: Date.now(),
        name: `Task ${newNumber}`,
        phase: 'work',
        secsLeft: 25 * 60,
        running: false,
        cyclesCompleted: 0,
        totalWorkSeconds: 0,
        totalBreakSeconds: 0,
        liveSeconds: 0,
        workMin: 25,
        breakMin: 5,
        longBreakMin: 15,
        selectedPreset: '25/5'
      };
      
      return [...prev, newTimer];
    });
  }, [isPro, timers.length]);

  const startTimer = useCallback((id) => {
    if (timerIntervalsRef.current[id]) return;
    updateStreak();
    timerIntervalsRef.current[id] = setInterval(() => {
      setTimers(prev => prev.map(t => {
        if (t.id !== id) return t;
        if (t.secsLeft <= 1) {
          clearInterval(timerIntervalsRef.current[id]);
          delete timerIntervalsRef.current[id];
          const nextPhase = t.phase === 'work' ? 'break' : 'work';
          const isLongBreak = t.phase === 'work' && ((t.cyclesCompleted || 0) + 1) % 4 === 0;
          const nextSecs = nextPhase === 'work' ? t.workMin * 60 : (isLongBreak ? t.longBreakMin * 60 : t.breakMin * 60);
          return { 
            ...t, 
            running: false, 
            phase: nextPhase, 
            secsLeft: nextSecs, 
            cyclesCompleted: (t.cyclesCompleted || 0) + (t.phase === 'work' ? 1 : 0),
            totalWorkSeconds: t.phase === 'work' ? t.totalWorkSeconds + t.liveSeconds + 1 : t.totalWorkSeconds,
            totalBreakSeconds: t.phase === 'break' ? t.totalBreakSeconds + t.liveSeconds + 1 : t.totalBreakSeconds,
            liveSeconds: 0,
            isLongBreak: nextPhase === 'break' && isLongBreak
          };
        }
        const updatedTimer = { ...t, secsLeft: t.secsLeft - 1 };
        if (t.secsLeft <= 1) {
          playCompletionSound();
          showNotification(t.name || 'Timer', t.phase === 'work');
          if (t.phase === 'work') {
            showConfetti();
            showToast(quotes[Math.floor(Math.random() * quotes.length)]);
          }
        }
        if (t.phase === 'work') {
          updatedTimer.totalWorkSeconds = t.totalWorkSeconds + 1;
          updatedTimer.liveSeconds = t.liveSeconds + 1;
        } else {
          updatedTimer.totalBreakSeconds = t.totalBreakSeconds + 1;
          updatedTimer.liveSeconds = t.liveSeconds + 1;
        }
        return updatedTimer;
      }));
    }, 1000);
  }, []);

  const pauseTimer = useCallback((id) => {
    clearInterval(timerIntervalsRef.current[id]);
    delete timerIntervalsRef.current[id];
    setTimers(prev => prev.map(t => {
      if (t.id === id) {
        const updatedTimer = { ...t, running: false };
        if (t.phase === 'work') {
          updatedTimer.totalWorkSeconds = t.totalWorkSeconds + t.liveSeconds;
        } else {
          updatedTimer.totalBreakSeconds = t.totalBreakSeconds + t.liveSeconds;
        }
        updatedTimer.liveSeconds = 0;
        return updatedTimer;
      }
      return t;
    }));
  }, []);

  const resetTimer = useCallback((id) => {
    clearInterval(timerIntervalsRef.current[id]);
    delete timerIntervalsRef.current[id];
    setTimers(prev => prev.map(t => 
      t.id === id ? { 
        ...t, 
        running: false, 
        phase: 'work', 
        secsLeft: t.workMin * 60,
        liveSeconds: 0
      } : t
    ));
  }, []);

  const deleteTimer = useCallback((id) => {
    clearInterval(timerIntervalsRef.current[id]);
    delete timerIntervalsRef.current[id];
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const togglePhase = useCallback((id, newPhase) => {
    clearInterval(timerIntervalsRef.current[id]);
    delete timerIntervalsRef.current[id];
    setTimers(prev => prev.map(t => {
      if (t.id === id) {
        const updatedTimer = {
          ...t, 
          running: false, 
          phase: newPhase,
          secsLeft: newPhase === 'work' ? t.workMin * 60 : t.breakMin * 60,
          liveSeconds: 0
        };
        if (t.phase === 'work') {
          updatedTimer.totalWorkSeconds = t.totalWorkSeconds + t.liveSeconds;
        } else {
          updatedTimer.totalBreakSeconds = t.totalBreakSeconds + t.liveSeconds;
        }
        return updatedTimer;
      }
      return t;
    }));
  }, []);

  const toggleTimerRunning = useCallback((id) => {
    setTimers(prev => prev.map(t => {
      if (t.id === id) {
        if (t.running) {
          pauseTimer(id);
        } else {
          startTimer(id);
          return { ...t, running: true };
        }
        return { ...t, running: false };
      }
      return t;
    }));
  }, [pauseTimer, startTimer]);

  const updateTimer = useCallback((id, updates) => {
    setTimers(prev => prev.map(timer => 
      timer.id === id ? { ...timer, ...updates } : timer
    ));
  }, []);

  const startEditingTimer = useCallback((id, currentName) => {
    setEditingTimerId(id);
    setEditingName(currentName);
  }, []);

  const saveTimerName = useCallback((id) => {
    if (editingName.trim()) {
      updateTimer(id, { name: editingName.trim() });
    }
    setEditingTimerId(null);
    setEditingName('');
  }, [editingName, updateTimer]);

  // Stopwatch functions
  const startStopwatch = useCallback((id) => {
    if (stopwatchIntervalsRef.current[id]) return;
    const startTime = Date.now();
    setStopwatches(prev => {
      const sw = prev.find(s => s.id === id);
      const offset = sw ? sw.elapsed : 0;
      stopwatchIntervalsRef.current[id] = setInterval(() => {
        setStopwatches(p => p.map(s => s.id === id
          ? { ...s, elapsed: offset + Math.floor((Date.now() - startTime) / 1000) }
          : s
        ));
      }, 1000);
      return prev.map(s => s.id === id ? { ...s, running: true } : s);
    });
  }, []);

  const pauseStopwatch = useCallback((id) => {
    clearInterval(stopwatchIntervalsRef.current[id]);
    delete stopwatchIntervalsRef.current[id];
    setStopwatches(prev => prev.map(s => s.id === id ? { ...s, running: false } : s));
  }, []);

  const resetStopwatch = useCallback((id) => {
    clearInterval(stopwatchIntervalsRef.current[id]);
    delete stopwatchIntervalsRef.current[id];
    setStopwatches(prev => prev.map(s =>
      s.id === id ? { ...s, elapsed: 0, running: false, laps: [] } : s
    ));
  }, []);

  const lapStopwatch = useCallback((id) => {
    setStopwatches(prev => prev.map(s => {
      if (s.id !== id) return s;
      const lapTime = s.elapsed;
      const prevLap = s.laps.length > 0 ? s.laps[s.laps.length - 1].total : 0;
      return {
        ...s,
        laps: [...s.laps, {
          number: s.laps.length + 1,
          split: lapTime - prevLap,
          total: lapTime
        }]
      };
    }));
  }, []);

  const deleteStopwatch = useCallback((id) => {
    clearInterval(stopwatchIntervalsRef.current[id]);
    delete stopwatchIntervalsRef.current[id];
    setStopwatches(prev => prev.filter(s => s.id !== id));
  }, []);

  const addStopwatch = useCallback(() => {
    setStopwatches(prev => {
      if (prev.length >= 4) return prev;
      const newNumber = prev.length + 1;
      return [...prev, {
        id: Date.now(),
        name: `Task ${newNumber}`,
        elapsed: 0,
        running: false,
        laps: []
      }];
    });
  }, []);

  // Format stopwatch time as HH:MM:SS
  const formatStopwatchTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // Auth functions
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Auth useEffect with redirect handling
  useEffect(() => {
    // Handle OAuth redirect
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get('access_token')) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setUser(session.user);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
    }

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        saveUserProfile(session.user);
        showToast(`Welcome back, ${session.user.user_metadata?.full_name?.split(' ')[0] || 'friend'}! 👋`);
      }
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const saveUserProfile = async (user) => {
    await supabase.from('profiles').upsert({
      id: user.id,
      username: user.user_metadata?.full_name || user.email?.split('@')[0],
      avatar_url: user.user_metadata?.avatar_url
    }, { onConflict: 'id' });
  };

  const syncStatsToCloud = async (userId) => {
    const totalWork = timers.reduce((sum, t) => sum + (t.totalWorkSeconds || 0), 0);
    const totalBreak = timers.reduce((sum, t) => sum + (t.totalBreakSeconds || 0), 0);
    const cycles = timers.reduce((sum, t) => sum + (t.cyclesCompleted || 0), 0);
    if (totalWork === 0) return;
    await supabase.from('focus_sessions').insert({
      user_id: userId,
      total_work_seconds: totalWork,
      total_break_seconds: totalBreak,
      total_cycles: cycles,
      session_date: new Date().toISOString().split('T')[0]
    });
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    const { data, error } = await supabase
      .from('weekly_leaderboard')
      .select('*');
    if (!error) setLeaderboard(data || []);
    setLoadingLeaderboard(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        const firstTimer = timers[0];
        if (firstTimer) toggleTimerRunning(firstTimer.id);
      }
      if (e.code === 'KeyR' && !e.ctrlKey) {
        const firstTimer = timers[0];
        if (firstTimer) resetTimer(firstTimer.id);
      }
      if (e.code === 'KeyN') setNoiseOn(prev => !prev);
      if (e.code === 'Digit1') setTab('timer');
      if (e.code === 'Digit2') setTab('noise');
      if (e.code === 'Digit3') setTab('note');
      if (e.code === 'Digit4') setTab('stopwatch');
      if (e.code === 'Digit5') setTab('stats');
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [timers, toggleTimerRunning, resetTimer]);

  // Auto-save tasks and templates
  useEffect(() => {
    localStorage.setItem('pomodoros_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('pomodoros_templates', JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem('pomodoros_settings', JSON.stringify(settings));
  }, [settings]);

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('pomodoros_theme', themeMode);
  }, [themeMode]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(timerIntervalsRef.current).forEach(interval => clearInterval(interval));
      Object.values(stopwatchIntervalsRef.current).forEach(interval => clearInterval(interval));
    };
  }, []);

  // Audio functions
  const createNoiseNode = useCallback((ctx, type) => {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    if (type === "white") {
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    } else if (type === "brown") {
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = (last + 0.02 * w) / 1.02;
        last = data[i];
        data[i] *= 3.5;
      }
    } else if (type === 'rain') {
      // White noise with low-pass filter for rain effect
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.8;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      src.connect(filter);
      filter.connect(gainRef.current);
      src.start();
      noiseNodeRef.current = src;
      return null;
    } else if (type === 'cafe') {
      let b0 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + w * 0.02;
        data[i] = b0 * 8 + (Math.random() * 2 - 1) * 0.1;
      }
    } else if (type === 'forest') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.sin(i * 0.001) * (Math.random() * 2 - 1) * 0.3 +
                  Math.sin(i * 0.003) * (Math.random() * 2 - 1) * 0.2;
      }
    } else {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    return src;
  }, []);

  const stopNoise = useCallback(() => {
    if (noiseNodeRef.current) {
      try {
        noiseNodeRef.current.stop();
      } catch (_) {}
      noiseNodeRef.current = null;
    }
  }, []);

  const startNoise = useCallback((type, vol) => {
    stopNoise();
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    
    if (!gainRef.current || gainRef.current.context !== ctx) {
      gainRef.current = ctx.createGain();
      gainRef.current.connect(ctx.destination);
    }
    gainRef.current.gain.setValueAtTime(vol, ctx.currentTime);
    
    const node = createNoiseNode(ctx, type);
    node.connect(gainRef.current);
    node.start();
    noiseNodeRef.current = node;
  }, [stopNoise, createNoiseNode]);

  useEffect(() => {
    if (noiseOn) {
      startNoise(noiseType, volume);
    } else {
      stopNoise();
    }
  }, [noiseOn, noiseType, volume, startNoise, stopNoise]);

  // Completion sound
  const playCompletionSound = useCallback(() => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  }, []);

  // Browser notifications
  const showNotification = useCallback((timerName, isWork) => {
    if (!soundEnabled) return;
    if (Notification.permission === 'granted') {
      new Notification('Pomodoros.io', {
        body: isWork ? `${timerName} focus session complete! Take a break.` : `Break over! Time to focus.`,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, [soundEnabled]);

  // Focus streak update
  const updateStreak = useCallback(() => {
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem('pomodoros_last_date');
    if (lastDate === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const newStreak = lastDate === yesterday.toDateString()
      ? parseInt(localStorage.getItem('pomodoros_streak') || '0') + 1
      : 1;
    localStorage.setItem('pomodoros_streak', newStreak);
    localStorage.setItem('pomodoros_last_date', today);
    setStreak(newStreak);
  }, []);

  // Utility functions
  const ProGate = ({ children, feature }) => {
    if (isPro) return children;
    return (
      <div style={{ position: 'relative', filter: 'blur(2px)', pointerEvents: 'none' }}>
        {children}
        <div
          onClick={(e) => { e.stopPropagation(); setShowUpgrade(true); }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)', borderRadius: '12px',
            cursor: 'pointer', pointerEvents: 'all'
          }}>
          <div style={{
            background: accentBlue, color: 'white', padding: '8px 16px',
            borderRadius: '20px', fontSize: '12px', fontWeight: '600'
          }}>🔒 Pro Feature</div>
        </div>
      </div>
    );
  };

  const showConfetti = () => {
    const colors = ['#E07B4F', '#4FA8E0', '#FFD700', '#34C77B', '#FF6B6B'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: ${4 + Math.random() * 8}px;
        height: ${4 + Math.random() * 8}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}vw;
        top: -20px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        z-index: 9999;
        pointer-events: none;
        animation: confettiFall ${1 + Math.random() * 2}s ease-in forwards;
        animation-delay: ${Math.random() * 0.5}s;
      `;
      document.body.appendChild(confetti);
      setTimeout(() => confetti.remove(), 3000);
    }
  };

  const shareAsImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0A0A0F';
    ctx.fillRect(0, 0, 800, 400);
    ctx.fillStyle = '#EDEDED';
    ctx.font = 'bold 32px -apple-system, sans-serif';
    ctx.fillText('Pomodoros.io', 40, 60);
    ctx.font = '18px -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(237,237,237,0.6)';
    ctx.fillText(new Date().toLocaleDateString(), 40, 90);
    ctx.fillStyle = '#E07B4F';
    ctx.font = 'bold 72px -apple-system, sans-serif';
    ctx.fillText(formatTime(totalWorkSecs), 40, 200);
    ctx.fillStyle = 'rgba(237,237,237,0.6)';
    ctx.font = '20px -apple-system, sans-serif';
    ctx.fillText('Total Focus Time', 40, 240);
    ctx.fillStyle = '#EDEDED';
    ctx.font = 'bold 48px -apple-system, sans-serif';
    ctx.fillText(`${totalCycles} cycles`, 40, 320);
    ctx.fillStyle = 'rgba(237,237,237,0.4)';
    ctx.font = '16px -apple-system, sans-serif';
    ctx.fillText('pomodoros.io — Free Multi Timer for Deep Work', 40, 380);
    const link = document.createElement('a');
    link.download = `pomodoros-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 5000);
  };

  const quotes = [
    "Great work! Take a well-deserved break. 🌟",
    "You crushed that session! Rest up. 💪",
    "Focus complete! Your brain needs this break. 🧠",
    "Amazing focus! Recharge and come back stronger. ⚡",
    "Session done! Step away and breathe. 🌿",
    "You're on fire! Take 5 and keep going. 🔥",
    "Deep work done! Rest is part of the process. 🎯"
  ];

  // Global Styles
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      @keyframes confettiFall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .timer-display {
        user-select: none;
        -webkit-user-select: none;
        cursor: default;
        caret-color: transparent;
      }
      * {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      }
      * {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      *::-webkit-scrollbar {
        display: none;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 768px) {
        /* Header */
        .pomodoros-header {
          padding: 0 16px !important;
        }
        /* Nav bar wraps on small screens */
        .nav-bar {
          width: calc(100% - 16px) !important;
          left: 8px !important;
          transform: none !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
          gap: 2px !important;
          padding: 3px !important;
        }
        .nav-bar button {
          padding: 6px 8px !important;
          font-size: 11px !important;
          min-width: unset !important;
        }
        /* Main content starts lower on mobile */
        .pomodoros-main {
          top: 130px !important;
        }
        /* Timer and stopwatch grids stack vertically */
        .timer-grid-2, .timer-grid-4 {
          grid-template-columns: 1fr !important;
          grid-template-rows: unset !important;
          height: auto !important;
          overflow-y: auto !important;
          padding: 8px !important;
          gap: 8px !important;
        }
        .timer-card, .stopwatch-card {
          max-height: 260px !important;
          min-height: unset !important;
          padding: 12px 16px !important;
        }
        .timer-card .countdown-display {
          font-size: 40px !important;
        }
        .stopwatch-card .countdown-display {
          font-size: 40px !important;
        }
        .sw-display {
          font-size: 40px !important;
        }
        /* Stats grid stacks */
        .stats-row {
          grid-template-columns: 1fr 1fr !important;
          gap: 6px !important;
        }
        .stats-grid {
          padding: 8px !important;
        }
        .task-breakdown-grid {
          grid-template-columns: 1fr !important;
        }
        /* Noise buttons stack */
        .noise-buttons {
          flex-direction: column !important;
          align-items: center !important;
        }
        /* Notes textarea full width */
        .notes-container {
          max-width: 100% !important;
          width: 100% !important;
          padding: 0 16px !important;
          box-sizing: border-box !important;
        }
        .notes-container h2 {
          font-size: 20px !important;
          margin-bottom: 16px !important;
        }
        .notes-container textarea {
          height: 200px !important;
        }
        /* Timer countdown smaller on mobile */
        .countdown-display {
          font-size: 56px !important;
        }
      }
      @media (max-width: 480px) {
        .stats-row {
          grid-template-columns: 1fr 1fr !important;
        }
        .nav-bar button {
          padding: 5px 8px !important;
          font-size: 10px !important;
        }
        .countdown-display {
          font-size: 44px !important;
        }
      }
      button:focus {
        outline: none !important;
        box-shadow: none !important;
      }
      button:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }
      * {
        -webkit-tap-highlight-color: transparent;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Dynamic Tab Title
  useEffect(() => {
    const runningTimers = timers.filter(t => t.running);
    if (runningTimers.length === 0) {
      document.title = 'Pomodoros.io – Multi Timer for Deep Work';
    } else if (runningTimers.length === 1) {
      const t = runningTimers[0];
      const mins = Math.floor(t.secsLeft / 60);
      const secs = t.secsLeft % 60;
      const time = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
      const phase = t.phase === 'work' ? 'Focus' : 'Rest';
      document.title = `${time} – ${t.name} – ${phase}`;
    } else {
      document.title = `${runningTimers.length} Sessions Running – Pomodoros.io`;
    }
  }, [timers]);

  // Note Auto-save
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem("pomodoros_note", note);
    }, 500);
    return () => clearTimeout(timeout);
  }, [note]);

  // Wash mode function — identical to your original
  const openWashMode = useCallback(() => {
    const newWindow = window.open('', '_blank');
    
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Color Wash - Pomodoros</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { 
              background: #121212; 
              width: 100vw;
              height: 100vh;
              overflow: hidden;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .palette-container {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
              gap: 16px;
              padding: 40px;
              max-width: 800px;
              width: 100%;
            }
            .color-card {
              aspect-ratio: 1;
              border-radius: 16px;
              cursor: pointer;
              transition: all 0.3s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 500;
              font-size: 14px;
              letter-spacing: 1px;
              text-transform: uppercase;
              border: 2px solid rgba(255, 255, 255, 0.1);
              position: relative;
              overflow: hidden;
            }
            .color-card:hover {
              transform: translateY(-4px);
              box-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
              border-color: rgba(255, 255, 255, 0.3);
            }
            .color-card.fullscreen {
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              border-radius: 0;
              border: none;
              z-index: 9999;
              cursor: default;
            }
                        .title {
              color: #e8e8e8;
              font-size: 24px;
              font-weight: 300;
              letter-spacing: 2px;
              margin-bottom: 32px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1 class="title">Choose Your Focus Color</h1>
          <div class="palette-container">
            ${WASH_MODES.map((color, index) => `
              <div class="color-card" 
                   style="background: ${color.bg}; color: ${color.text};"
                   data-index="${index}"
                   data-bg="${color.bg}"
                   data-text="${color.text}">
                ${color.label}
              </div>
            `).join('')}
          </div>
          
          <script>
            const WASH_MODES = ${JSON.stringify(WASH_MODES)};
            let isFullscreen = false;
            let currentColor = null;
            
            function enterFullscreen(color) {
              const card = event.target;
              const bg = card.dataset.bg;
              const text = card.dataset.text;
              
              currentColor = { bg, text };
              
              // Apply fullscreen styling
              card.classList.add('fullscreen');
              card.addEventListener('click', exitFullscreen, { once: true });
              document.body.style.background = bg;
              
              // Hide other elements
              document.querySelector('.palette-container').style.display = 'none';
              document.querySelector('.title').style.display = 'none';
              
              // Request fullscreen
              const elem = document.documentElement;
              const requestFullscreen = elem.requestFullscreen || 
                                      elem.webkitRequestFullscreen || 
                                      elem.mozRequestFullScreen || 
                                      elem.msRequestFullscreen;
              
              if (requestFullscreen) {
                requestFullscreen.call(elem).catch(err => {
                  console.log('Fullscreen request failed:', err);
                });
              }
              
              isFullscreen = true;
              document.body.addEventListener('click', function onBodyClick() {
                exitFullscreen();
                document.body.removeEventListener('click', onBodyClick);
              });
            }
            
            function exitFullscreen() {
              if (!isFullscreen) return;
              
              // Exit fullscreen
              if (document.fullscreenElement) {
                document.exitFullscreen().then(() => {
                  // Return to color palette after exiting fullscreen
                  returnToPalette();
                }).catch(() => {
                  // Fallback: return to palette even if exit fails
                  returnToPalette();
                });
              } else {
                // If not in fullscreen, just return to palette
                returnToPalette();
              }
            }
            
            function returnToPalette() {
              // Reset fullscreen state
              isFullscreen = false;
              
              // Show all elements again
              document.querySelector('.palette-container').style.display = 'grid';
              document.querySelector('.title').style.display = 'block';
              
              // Reset background
              document.body.style.background = '#121212';
              
              // Remove fullscreen class from any color card
              const fullscreenCard = document.querySelector('.color-card.fullscreen');
              if (fullscreenCard) {
                fullscreenCard.classList.remove('fullscreen');
              }
            }
            
            // Add click handlers to color cards
            document.querySelectorAll('.color-card').forEach(card => {
              card.addEventListener('click', enterFullscreen);
            });
            
            // ESC to exit
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                exitFullscreen();
              }
            });
            
            // Fullscreen change event listener
            document.addEventListener('fullscreenchange', () => {
              if (!document.fullscreenElement && isFullscreen) {
                // User exited fullscreen (via ESC, F11, etc.)
                returnToPalette();
              }
            });
            
            // Also listen for vendor-specific fullscreen events
            document.addEventListener('webkitfullscreenchange', () => {
              if (!document.webkitFullscreenElement && isFullscreen) {
                returnToPalette();
              }
            });
            
            document.addEventListener('mozfullscreenchange', () => {
              if (!document.mozFullScreenElement && isFullscreen) {
                returnToPalette();
              }
            });
            
            document.addEventListener('MSFullscreenChange', () => {
              if (!document.msFullscreenElement && isFullscreen) {
                returnToPalette();
              }
            });
            
            // Prevent interactions
            document.addEventListener('contextmenu', (e) => e.preventDefault());
            document.addEventListener('selectstart', (e) => e.preventDefault());
            document.addEventListener('dragstart', (e) => e.preventDefault());
          </script>
        </body>
      </html>
    `);
    newWindow.document.close();
  }, []);

  return (
    <div style={{
      background: bg,
      width: "100vw",
      height: "100vh",
      color: text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      position: "fixed",
      top: 0,
      left: 0,
      overflow: "hidden"
    }}>
      {/* Header */}
      <div className="pomodoros-header" style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "52px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 30px",
        zIndex: 10,
        background: themeMode === 'dark' ? 'rgba(10,10,15,0.8)' : 'rgba(232,228,220,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${border}`
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{
            color: accent,
            fontSize: '15px',
            fontWeight: '600',
            letterSpacing: '0.3px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: accentBlue,
              animation: 'pulse 2s ease-in-out infinite'
            }} />
            Pomodoros.io
            {streak > 0 && (
              <div style={{ fontSize: '10px', color: '#E07B4F', fontWeight: '600' }}>
                🔥 {streak} day streak
              </div>
            )}
          </div>
          <div style={{
            fontSize: '10px',
            color: textDim,
            letterSpacing: '0.3px',
            fontWeight: '400',
            opacity: 0.4
          }}>
            Free Multi Timer · Deep Work · Focus Sessions
          </div>
        </div>

        {/* Utility Row */}
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center"
        }}>
          <button
  onClick={() => setThemeMode(m => m === 'dark' ? 'light' : 'dark')}
  style={{
    width: '36px', height: '36px', minWidth: '36px',
    borderRadius: '10px',
    backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    border: '1px solid rgba(128,128,128,0.3)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0', flexShrink: 0
  }}>
  {themeMode === 'dark'
    ? <Sun size={16} color="#FFFFFF" strokeWidth={2} />
    : <Moon size={16} color="#000000" strokeWidth={2} />}
</button>

<button
  onClick={openWashMode}
  style={{
    width: '36px', height: '36px', minWidth: '36px',
    borderRadius: '10px',
    backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    border: '1px solid rgba(128,128,128,0.3)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0', flexShrink: 0
  }}>
  <Monitor size={16} color={themeMode === 'dark' ? '#FFFFFF' : '#000000'} strokeWidth={2} />
</button>
{showInstall && (
  <button onClick={handleInstall} style={{
    background: 'transparent',
    border: `1px solid ${accentBlue}`,
    color: accentBlue,
    padding: '8px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  }}>
    📲 Install App
  </button>
)}
<button onClick={() => setShowSettings(true)} style={{
  background: 'transparent',
  border: `1px solid ${border}`,
  color: textDim,
  padding: '8px 12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: '500'
}}>
  ⚙️
</button>
<button onClick={() => setShowKeyboardHelp(true)} style={{
  background: 'transparent',
  border: `1px solid ${border}`,
  color: textDim,
  padding: '8px 12px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: '500'
}}>
  ?
</button>
{user && !isPro && (
  <button onClick={() => setShowUpgrade(true)} style={{
    background: 'linear-gradient(135deg, #E07B4F, #ff6b35)',
    border: 'none',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '0.3px'
  }}>
    ⚡ Go Pro
  </button>
)}
{isPro && (
  <div style={{
    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '700',
    color: '#333'
  }}>PRO ✨</div>
)}
{user ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <img
      src={user.user_metadata?.avatar_url}
      alt="avatar"
      style={{ width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' }}
      onClick={() => { fetchLeaderboard(); setShowLeaderboard(true); }}
    />
    <button
      onClick={signOut}
      style={{
        background: 'transparent',
        border: `1px solid ${border}`,
        color: textDim,
        padding: '6px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '500'
      }}>
      Sign Out
    </button>
  </div>
) : (
  <button
    onClick={signInWithGoogle}
    style={{
      background: accentBlue,
      border: 'none',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }}>
    Sign in with Google
  </button>
)}
        </div>
      </div>

      {/* Top Navigation */}
      <div className="nav-bar" style={{
        position: "absolute",
        top: isMobile ? '58px' : '60px',
        left: "50%",
        transform: "translateX(-50%)",
        width: isMobile ? 'calc(100% - 16px)' : 'auto',
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        justifyContent: 'center',
        background: themeMode === 'dark' ? 'rgba(17,17,24,0.6)' : 'rgba(216,212,204,0.8)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${border}`,
        borderRadius: "12px",
        padding: "3px",
        display: "flex",
        gap: "3px",
        alignItems: "center",
        overflowX: isMobile ? 'auto' : 'visible',
        WebkitOverflowScrolling: 'touch'
      }}>
        {["timer", "noise", "note"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? accentBlue : "transparent",
              color: tab === t ? "white" : textDim,
              padding: "8px 16px",
              cursor: "pointer",
              borderRadius: "9px",
              transition: "all 0.15s ease",
              fontWeight: "500",
              fontSize: "13px",
              letterSpacing: "0.5px",
              textTransform: "capitalize",
              border: "none"
            }}
            onMouseEnter={(e) => {
              if (tab !== t) {
                e.target.style.background = surfaceHover;
              }
            }}
            onMouseLeave={(e) => {
              if (tab !== t) {
                e.target.style.background = "transparent";
              }
            }}
          >
            {t === 'stopwatch' ? 'Watch' : t}
          </button>
        ))}
        
        {/* Add Timer/Stopwatch Button */}
        {(tab === "timer" || tab === "stopwatch") && (
          <button
            onClick={tab === "timer" ? addTimer : addStopwatch}
            disabled={tab === "timer" ? timers.length >= 4 : stopwatches.length >= 4}
            style={{
              background: (tab === "timer" ? timers.length : stopwatches.length) >= 4 ? surface : "rgba(91,110,245,0.15)",
              color: (tab === "timer" ? timers.length : stopwatches.length) >= 4 ? textDim : accentBlue,
              border: `1px solid ${(tab === "timer" ? timers.length : stopwatches.length) >= 4 ? border : 'rgba(91,110,245,0.3)'}`,
              padding: "8px 16px",
              cursor: (tab === "timer" ? timers.length : stopwatches.length) >= 4 ? "not-allowed" : "pointer",
              borderRadius: "9px",
              transition: "all 0.15s ease",
              fontWeight: "500",
              fontSize: "13px",
              letterSpacing: "0.5px",
              opacity: (tab === "timer" ? timers.length : stopwatches.length) >= 4 ? 0.5 : 1,
              marginLeft: "8px"
            }}
            onMouseEnter={(e) => {
              if ((tab === "timer" ? timers.length : stopwatches.length) < 4) {
                e.target.style.borderColor = borderHover;
                e.target.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if ((tab === "timer" ? timers.length : stopwatches.length) < 4) {
                e.target.style.borderColor = 'rgba(91,110,245,0.3)';
                e.target.style.transform = "translateY(0)";
              }
            }}
          >
            + Add {(tab === "timer" ? timers.length : stopwatches.length) >= 4 && "(Max 4)"}
          </button>
        )}
        <button
          onClick={() => setShowTaskPanel(!showTaskPanel)}
          style={{
            background: showTaskPanel ? accentBlue : "transparent",
            color: showTaskPanel ? "white" : textDim,
            padding: "8px 16px",
            cursor: "pointer",
            borderRadius: "9px",
            transition: "all 0.15s ease",
            fontWeight: "500",
            fontSize: "13px",
            letterSpacing: "0.5px",
            border: "none"
          }}
        >
          Tasks
        </button>
      </div>

      {/* Main Content */}
      <div className="pomodoros-main" style={{
        position: 'fixed',
        top: isMobile ? '128px' : '108px',
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: (tab === 'timer' || tab === 'stopwatch') ? 'flex-start' : 'center',
        height: '100%',
        width: '100%'
      }} onClick={() => { if (showTaskPanel) setShowTaskPanel(false); }}>
        {/* Multi-Timer Section */}
        {tab === "timer" && (
          <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>

            
            {/* Timer Grid */}
            <div className={`timer-grid ${timers.length === 2 ? 'timer-grid-2' : 'timer-grid-4'}`} style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : (timers.length === 1 ? '1fr' : '1fr 1fr'),
              gridTemplateRows: 'unset',
              gap: '8px',
              padding: isMobile ? '8px' : '10px 16px',
              height: isMobile ? 'auto' : 'calc(100vh - 108px)',
              maxHeight: isMobile ? 'calc(100vh - 128px)' : 'unset',
              overflowY: isMobile ? 'auto' : 'hidden',
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: (!isMobile && timers.length === 1) ? '520px' : '100%',
              margin: (!isMobile && timers.length === 1) ? '0 auto' : '0',
              transition: 'all 0.3s ease'
            }}>
              {timers.map((timer) => {
                const timerCount = timers.length;
                const cardPadding = timerCount === 1 ? '28px 32px' : timerCount === 2 ? '20px 24px' : '14px 16px';
                return (
                <div
                  key={timer.id}
                  className="timer-card"
                  style={{
                    background: themeMode === 'dark' ? 'rgba(17,17,24,0.8)' : 'rgba(220,216,208,0.9)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${border}`,
                    borderTop: `2px solid ${timer.phase === 'work' ? '#E07B4F' : (timer.isLongBreak ? '#FFD700' : '#4FA8E0')}`,
                    borderRadius: "16px",
                    padding: isMobile ? '12px 14px' : cardPadding,
                    maxHeight: isMobile ? '260px' : 'unset',
                    height: isMobile ? 'auto' : '100%',
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Delete Button */}
                  {timers.length > 1 && (
                    <button
                      onClick={() => deleteTimer(timer.id)}
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "transparent",
                        border: "none",
                        color: textDim,
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        transition: "all 0.15s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = border;
                        e.target.style.color = "#ff3b30";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = "transparent";
                        e.target.style.color = textDim;
                      }}
                    >
                      ×
                    </button>
                  )}

                  {/* Timer Name */}
                  <div style={{ marginBottom: '0', marginTop: '0' }}>
                    {editingTimerId === timer.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          if (editingName.trim()) {
                            updateTimer(timer.id, { name: editingName.trim() });
                          }
                          setEditingTimerId(null);
                          setEditingName('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingName.trim()) {
                              updateTimer(timer.id, { name: editingName.trim() });
                            }
                            setEditingTimerId(null);
                            setEditingName('');
                          } else if (e.key === 'Escape') {
                            setEditingTimerId(null);
                            setEditingName('');
                          }
                        }}
                        autoFocus
                        style={{
                          background: surface,
                          border: `1px solid ${accent}`,
                          borderRadius: "6px",
                          color: text,
                          fontSize: "13px",
                          fontWeight: "500",
                          padding: "6px 12px",
                          textAlign: "center",
                          outline: "none"
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => startEditingTimer(timer.id, timer.name)}
                        style={{
                          color: textDim,
                          fontSize: timers.length === 1 ? '13px' : '10px',
                          fontWeight: "500",
                          cursor: "pointer",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          transition: "all 0.15s ease",
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          MozUserSelect: 'none',
                          msUserSelect: 'none',
                          caretColor: 'transparent',
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = surfaceHover;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = "transparent";
                        }}
                      >
                        {timer.name}
                      </div>
                    )}
                  </div>

                  {/* Current Task Input */}
                  <input
                    placeholder="What are you working on?"
                    value={timer.currentTask || ''}
                    onChange={(e) => updateTimer(timer.id, { currentTask: e.target.value })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${border}`,
                      color: textDim,
                      fontSize: '11px',
                      textAlign: 'center',
                      outline: 'none',
                      width: '80%',
                      padding: '2px 8px',
                      marginBottom: '8px'
                    }}
                  />

                  {/* Preset Buttons */}
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginBottom: '4px' }}>
                    {PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => {
                          if (!timer.running) {
                            setTimers(prev => prev.map(t => t.id === timer.id ? {
                              ...t,
                              selectedPreset: preset.label,
                              secsLeft: timer.phase === 'work' ? preset.work * 60 : preset.break * 60,
                              workMin: preset.work,
                              breakMin: preset.break
                            } : t));
                          }
                        }}
                        style={{
                          background: timer.selectedPreset === preset.label
                            ? 'rgba(224,123,79,0.2)'
                            : 'transparent',
                          border: `1px solid ${timer.selectedPreset === preset.label
                            ? 'rgba(224,123,79,0.5)'
                            : border}`,
                          color: timer.selectedPreset === preset.label ? accentBlue : textDim,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '500',
                          cursor: timer.running ? 'not-allowed' : 'pointer',
                          opacity: timer.running ? 0.5 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Countdown + Phase Label Container */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1 }}>
                    {/* Minus Button */}
                    <button
                      onClick={() => {
                        if (!timer.running) {
                          setTimers(prev => prev.map(t => t.id === timer.id
                            ? { ...t, secsLeft: Math.max(60, t.secsLeft - 60) }
                            : t
                          ));
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${border}`,
                        color: textDim,
                        width: '28px', height: '28px',
                        borderRadius: '8px',
                        cursor: timer.running ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: timer.running ? 0.3 : 1,
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}>
                      −
                    </button>

                    {/* Countdown and Phase */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      {/* Timer Display */}
                      <div className="countdown-display" style={{
                        fontSize: isMobile ? '42px' : (timers.length === 1 ? '88px' : timers.length === 2 ? '64px' : '48px'),
                        fontWeight: "200",
                        color: text,
                        letterSpacing: "-1px",
                        fontVariantNumeric: "tabular-nums",
                        margin: '0',
                        lineHeight: '1',
                        cursor: 'default',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        caretColor: 'transparent',
                        pointerEvents: 'none'
                      }}>
                        {formatTime(timer.secsLeft)}
                      </div>

                      {/* Phase */}
                      <div style={{
                        color: timer.phase === "work" ? accentGreen : accentBlue,
                        fontSize: timers.length === 1 ? '12px' : '9px',
                        fontWeight: "500",
                        letterSpacing: "0.8px",
                        textTransform: "uppercase",
                        margin: '0',
                        padding: '0',
                        cursor: 'default',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        caretColor: 'transparent',
                        pointerEvents: 'none'
                      }}>
                        {timer.phase === "work" ? "Focus" : (timer.isLongBreak ? "Long Break" : "Rest")}
                      </div>
                    </div>

                    {/* Plus Button */}
                    <button
                      onClick={() => {
                        if (!timer.running) {
                          setTimers(prev => prev.map(t => t.id === timer.id
                            ? { ...t, secsLeft: Math.min(3600, t.secsLeft + 60) }
                            : t
                          ));
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${border}`,
                        color: textDim,
                        width: '28px', height: '28px',
                        borderRadius: '8px',
                        cursor: timer.running ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: timer.running ? 0.3 : 1,
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}>
                      +
                    </button>
                  </div>

                  {/* Controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {/* Start/Pause and Reset */}
                    <div style={{ display: "flex", gap: "12px", justifyContent: "center", margin: '0' }}>
                      <button
                        onClick={() => toggleTimerRunning(timer.id)}
                        style={{
                          background: timer.running ? "rgba(224,123,79,0.15)" : accentBlue,
                          border: timer.running ? `1px solid rgba(224,123,79,0.3)` : "none",
                          color: timer.running ? accentBlue : "white",
                          padding: isMobile ? '8px 12px' : (timers.length === 1 ? '12px 20px' : timers.length === 2 ? '10px 16px' : '7px 12px'),
                          cursor: "pointer",
                          borderRadius: "10px",
                          transition: "all 0.15s ease",
                          fontWeight: "500",
                          fontSize: isMobile ? '12px' : (timers.length === 1 ? '15px' : timers.length === 2 ? '13px' : '11px'),
                          flex: 1
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = "translateY(-1px)";
                          if (!timer.running) {
                            e.target.style.boxShadow = "0 0 0 3px rgba(224,123,79,0.2)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = "translateY(0)";
                          if (!timer.running) {
                            e.target.style.boxShadow = "none";
                          }
                        }}
                      >
                        {timer.running ? 'Pause' : 'Start'}
                      </button>
                      <button
                        onClick={() => resetTimer(timer.id)}
                        style={{
                          background: surface,
                          border: `1px solid ${border}`,
                          color: textDim,
                          padding: isMobile ? '8px 12px' : (timers.length === 1 ? '12px 20px' : timers.length === 2 ? '10px 16px' : '7px 12px'),
                          cursor: "pointer",
                          borderRadius: "10px",
                          transition: "all 0.15s ease",
                          fontWeight: "500",
                          fontSize: isMobile ? '12px' : (timers.length === 1 ? '15px' : timers.length === 2 ? '13px' : '11px'),
                          flex: 1
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = surfaceHover;
                          e.target.style.borderColor = borderHover;
                          e.target.style.transform = "translateY(-1px)";
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = surface;
                          e.target.style.borderColor = border;
                          e.target.style.transform = "translateY(0)";
                        }}
                      >
                        Reset
                      </button>
                    </div>

                    {/* Work/Break Toggle */}
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center", margin: '0' }}>
                      <button
                        onClick={() => togglePhase(timer.id, 'work')}
                        style={{
                          background: timer.phase === "work" ? "rgba(79,168,224,0.15)" : "transparent",
                          border: timer.phase === "work" ? `1px solid rgba(79,168,224,0.3)` : `1px solid ${border}`,
                          color: timer.phase === "work" ? accentGreen : textDim,
                          padding: timers.length === 1 ? '12px 20px' : timers.length === 2 ? '10px 16px' : '7px 12px',
                          cursor: "pointer",
                          borderRadius: "10px",
                          transition: "all 0.15s ease",
                          fontWeight: "500",
                          fontSize: timers.length === 1 ? '15px' : timers.length === 2 ? '13px' : '11px',
                          flex: 1
                        }}
                        onMouseEnter={(e) => {
                          if (timer.phase !== "work") {
                            e.target.style.background = surfaceHover;
                            e.target.style.borderColor = borderHover;
                            e.target.style.transform = "translateY(-1px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (timer.phase !== "work") {
                            e.target.style.background = "transparent";
                            e.target.style.borderColor = border;
                            e.target.style.transform = "translateY(0)";
                          }
                        }}
                      >
                        Work
                      </button>
                      <button
                        onClick={() => togglePhase(timer.id, 'break')}
                        style={{
                          background: timer.phase === "break" ? "rgba(224,123,79,0.15)" : "transparent",
                          border: timer.phase === "break" ? `1px solid rgba(224,123,79,0.3)` : `1px solid ${border}`,
                          color: timer.phase === "break" ? accentBlue : textDim,
                          padding: timers.length === 1 ? '12px 20px' : timers.length === 2 ? '10px 16px' : '7px 12px',
                          cursor: "pointer",
                          borderRadius: "10px",
                          transition: "all 0.15s ease",
                          fontWeight: "500",
                          fontSize: timers.length === 1 ? '15px' : timers.length === 2 ? '13px' : '11px',
                          flex: 1
                        }}
                        onMouseEnter={(e) => {
                          if (timer.phase !== "break") {
                            e.target.style.background = surfaceHover;
                            e.target.style.borderColor = borderHover;
                            e.target.style.transform = "translateY(-1px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (timer.phase !== "break") {
                            e.target.style.background = "transparent";
                            e.target.style.borderColor = border;
                            e.target.style.transform = "translateY(0)";
                          }
                        }}
                      >
                        Break
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Noise Section */}
        {tab === "noise" && (
          <div style={{ textAlign: "center", maxWidth: "480px" }}>
            <h2 style={{
              color: accent,
              fontSize: "22px",
              marginBottom: "32px",
              fontWeight: "300",
              letterSpacing: "2px"
            }}>
              Ambient Noise
            </h2>
            <div className="noise-buttons" style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              marginBottom: '24px'
            }}>
              {NOISE_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => { setNoiseType(type); setNoiseOn(true); }}
                  style={{
                    background: noiseType === type && noiseOn ? accentBlue : surface,
                    border: `1px solid ${noiseType === type && noiseOn ? accentBlue : border}`,
                    color: noiseType === type && noiseOn ? "white" : textDim,
                    padding: "14px 36px",
                    cursor: "pointer",
                    borderRadius: "100px",
                    transition: "all 0.15s ease",
                    fontWeight: "500",
                    fontSize: "15px",
                    textTransform: "capitalize"
                  }}
                  onMouseEnter={(e) => {
                    if (!(noiseType === type && noiseOn)) {
                      e.target.style.background = surfaceHover;
                      e.target.style.borderColor = borderHover;
                      e.target.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(noiseType === type && noiseOn)) {
                      e.target.style.background = surface;
                      e.target.style.borderColor = border;
                      e.target.style.transform = "translateY(0)";
                    }
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
            
            {/* Volume Slider */}
            <div style={{ marginTop: '28px' }}>
              <input
                type='range'
                min='0'
                max='1'
                step='0.01'
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                style={{
                  width: '260px',
                  accentColor: '#E07B4F',
                  cursor: 'pointer'
                }}
              />
              <div style={{ fontSize: '13px', color: textDim, marginTop: '10px' }}>
                Volume
              </div>
            </div>
            
            {noiseOn && (
              <button
                onClick={() => setNoiseOn(false)}
                style={{
                  background: surface,
                  border: `1px solid ${border}`,
                  color: textDim,
                  padding: "12px 32px",
                  cursor: "pointer",
                  borderRadius: "10px",
                  transition: "all 0.15s ease",
                  fontWeight: "500",
                  fontSize: "14px",
                  marginTop: "24px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = surfaceHover;
                  e.target.style.borderColor = borderHover;
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = surface;
                  e.target.style.borderColor = border;
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Stop Noise
              </button>
            )}
          </div>
        )}

        {/* Note Section */}
        {tab === "note" && (
          <div className="notes-container" style={{
          textAlign: "center",
          maxWidth: isMobile ? '100%' : "500px",
          width: '100%',
          padding: isMobile ? '0 16px' : '0',
          boxSizing: 'border-box'
        }}>
            <h2 style={{
              color: accent,
              fontSize: "28px",
              marginBottom: "40px",
              fontWeight: "300",
              letterSpacing: "2px"
            }}>
              Notes
            </h2>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Type your notes here..."
              style={{
                width: "100%",
                height: isMobile ? "180px" : "300px",
                background: themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)",
                backdropFilter: "blur(10px)",
                border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
                color: text,
                padding: "20px",
                borderRadius: "16px",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                fontSize: "16px",
                resize: "none",
                transition: "all 0.2s ease",
                outline: "none"
              }}
              onFocus={(e) => {
                e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(40, 35, 29, 0.1)";
                e.target.style.borderColor = accent;
              }}
              onBlur={(e) => {
                e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)";
                e.target.style.borderColor = themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)";
              }}
            />
            <div style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              marginTop: "20px"
            }}>
              <button
                onClick={() => {
                  localStorage.setItem("pomodoros_note", note);
                  // Brief visual feedback
                  const button = event.target;
                  button.textContent = "Saved!";
                  setTimeout(() => {
                    button.textContent = "Save";
                  }, 1500);
                }}
                style={{
                  background: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(40, 35, 29, 0.07)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
                  color: accent,
                  padding: "12px 24px",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  fontSize: "14px",
                  letterSpacing: "1px",
                  minWidth: "80px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(40, 35, 29, 0.1)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(40, 35, 29, 0.07)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setNote("");
                  localStorage.removeItem("pomodoros_note");
                  // Brief visual feedback
                  const button = event.target;
                  button.textContent = "Cleared!";
                  setTimeout(() => {
                    button.textContent = "Clear";
                  }, 1500);
                }}
                style={{
                  background: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(40, 35, 29, 0.07)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
                  color: accent,
                  padding: "12px 24px",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  fontSize: "14px",
                  letterSpacing: "1px",
                  minWidth: "80px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.12)" : "rgba(40, 35, 29, 0.1)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(40, 35, 29, 0.07)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Stopwatch Section */}
        {tab === "stopwatch" && (
          <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
            <div className={`timer-grid ${stopwatches.length === 2 ? 'timer-grid-2' : 'timer-grid-4'}`} style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : (stopwatches.length === 1 ? '1fr' : '1fr 1fr'),
              gridTemplateRows: 'unset',
              gap: '8px',
              padding: isMobile ? '8px' : '10px 16px',
              height: isMobile ? 'auto' : 'calc(100vh - 108px)',
              maxHeight: isMobile ? 'calc(100vh - 128px)' : 'unset',
              overflowY: isMobile ? 'auto' : 'hidden',
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: (!isMobile && stopwatches.length === 1) ? '520px' : '100%',
              margin: (!isMobile && stopwatches.length === 1) ? '0 auto' : '0',
              transition: 'all 0.3s ease'
            }}>
              {stopwatches.map(sw => (
                <div key={sw.id} className="stopwatch-card" style={{
                  background: themeMode === 'dark' ? 'rgba(17,17,24,0.8)' : 'rgba(220,216,208,0.9)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${border}`,
                  borderTop: `2px solid ${accentGreen}`,
                  borderRadius: '16px',
                  padding: isMobile ? '12px 14px' : (stopwatches.length === 1 ? '28px 32px' : stopwatches.length === 2 ? '20px 24px' : '14px 16px'),
                  maxHeight: isMobile ? '260px' : 'unset',
                  height: isMobile ? 'auto' : '100%',
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}>
                  {/* Delete button */}
                  {stopwatches.length > 1 && (
                    <button onClick={() => deleteStopwatch(sw.id)} style={{
                      position: 'absolute', top: '12px', right: '12px',
                      background: 'transparent', border: 'none',
                      color: textDim, width: '24px', height: '24px',
                      borderRadius: '6px', cursor: 'pointer',
                      fontSize: '14px', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>×</button>
                  )}

                  {/* Stopwatch name */}
                  <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                    {editingTimerId === sw.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          if (editingName.trim()) {
                            setStopwatches(prev => prev.map(s =>
                              s.id === sw.id ? { ...s, name: editingName.trim() } : s
                            ));
                          }
                          setEditingTimerId(null);
                          setEditingName('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingName.trim()) {
                              setStopwatches(prev => prev.map(s =>
                                s.id === sw.id ? { ...s, name: editingName.trim() } : s
                              ));
                            }
                            setEditingTimerId(null);
                            setEditingName('');
                          } else if (e.key === 'Escape') {
                            setEditingTimerId(null);
                            setEditingName('');
                          }
                        }}
                        autoFocus
                        style={{
                          background: surface,
                          border: `1px solid ${accent}`,
                          borderRadius: '6px',
                          color: text,
                          fontSize: '11px',
                          fontWeight: '500',
                          padding: '4px 10px',
                          textAlign: 'center',
                          outline: 'none',
                          width: '80%'
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => { setEditingTimerId(sw.id); setEditingName(sw.name); }}
                        style={{
                          color: textDim,
                          fontSize: stopwatches.length === 1 ? '13px' : '10px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase',
                          userSelect: 'none',
                          transition: 'all 0.15s ease',
                          display: 'inline-block'
                        }}
                        onMouseEnter={(e) => e.target.style.background = surfaceHover}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        {sw.name}
                      </div>
                    )}
                  </div>

                  {/* Elapsed time display */}
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}>
                    <div className="sw-display" style={{
                      fontSize: isMobile ? '42px' : (stopwatches.length === 1 ? '88px' : stopwatches.length === 2 ? '64px' : '48px'),
                      fontWeight: '200', color: text, letterSpacing: '-1px',
                      fontVariantNumeric: 'tabular-nums', lineHeight: '1',
                      userSelect: 'none', pointerEvents: 'none'
                    }}>
                      {formatStopwatchTime(sw.elapsed)}
                    </div>
                    <div style={{
                      color: accentGreen, fontSize: '10px', fontWeight: '500',
                      letterSpacing: '2px', textTransform: 'uppercase'
                    }}>
                      {sw.running ? 'COUNTING' : sw.elapsed > 0 ? 'PAUSED' : 'READY'}
                    </div>

                    {/* Laps display — show last 3 laps */}
                    {sw.laps.length > 0 && (
                      <div style={{
                        marginTop: '8px', width: '100%', maxWidth: '280px'
                      }}>
                        {sw.laps.slice(-3).map(lap => (
                          <div key={lap.number} style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: '10px', color: textDim,
                            padding: '2px 8px',
                            borderBottom: `1px solid ${border}` 
                          }}>
                            <span>Lap {lap.number}</span>
                            <span>{formatStopwatchTime(lap.split)}</span>
                            <span style={{ opacity: 0.6 }}>{formatStopwatchTime(lap.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Start/Pause + Lap */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => sw.running ? pauseStopwatch(sw.id) : startStopwatch(sw.id)}
                        style={{
                          background: sw.running ? 'rgba(224,123,79,0.15)' : accentBlue,
                          border: sw.running ? '1px solid rgba(224,123,79,0.3)' : 'none',
                          color: sw.running ? accentBlue : 'white',
                          padding: stopwatches.length === 1 ? '12px 20px' : stopwatches.length === 2 ? '10px 16px' : '7px 12px',
                          borderRadius: '10px', cursor: 'pointer',
                          fontWeight: '500',
                          fontSize: stopwatches.length === 1 ? '15px' : stopwatches.length === 2 ? '13px' : '11px',
                          flex: 1, transition: 'all 0.15s ease'
                        }}>
                        {sw.running ? 'Pause' : 'Start'}
                      </button>
                      <button
                        onClick={() => lapStopwatch(sw.id)}
                        disabled={!sw.running}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${border}`,
                          color: sw.running ? text : textDim,
                          padding: stopwatches.length === 1 ? '12px 20px' : stopwatches.length === 2 ? '10px 16px' : '7px 12px',
                          borderRadius: '10px', cursor: sw.running ? 'pointer' : 'not-allowed',
                          fontWeight: '500',
                          fontSize: stopwatches.length === 1 ? '15px' : stopwatches.length === 2 ? '13px' : '11px',
                          flex: 1, transition: 'all 0.15s ease',
                          opacity: sw.running ? 1 : 0.4
                        }}>
                        Lap
                      </button>
                    </div>
                    {/* Reset */}
                    <button
                      onClick={() => resetStopwatch(sw.id)}
                      style={{
                        background: surface,
                        border: `1px solid ${border}`,
                        color: textDim,
                        padding: stopwatches.length === 1 ? '12px 20px' : stopwatches.length === 2 ? '10px 16px' : '7px 12px',
                        borderRadius: '10px', cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: stopwatches.length === 1 ? '15px' : stopwatches.length === 2 ? '13px' : '11px',
                        width: '100%', transition: 'all 0.15s ease'
                      }}>
                      Reset
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Section */}
        {tab === "stats" && (
          <div style={{
              textAlign: 'center',
              maxWidth: '680px',
              margin: '0 auto',
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              paddingBottom: '20px'
            }}>
            <h2 style={{
              color: textDim,
              fontSize: "13px",
              marginBottom: "32px",
              fontWeight: "500",
              letterSpacing: "2px",
              textTransform: "uppercase"
            }}>
              Today's Stats
            </h2>
            
                        
            {/* Overall Stats Grid */}
            <div className="stats-grid stats-row" style={{
              background: surface,
              border: `1px solid ${border}`,
              padding: "12px",
              borderRadius: "16px",
              textAlign: "center"
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? '1fr 1fr' : "repeat(4, 1fr)",
                gap: isMobile ? '8px' : "12px",
                alignItems: "stretch"
              }}>
                {/* Total Focus Time */}
                <div style={{
                  background: surface,
                  padding: "12px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "10px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Total Focus Time
                  </div>
                  <div style={{
                    fontSize: "22px",
                    fontWeight: "300",
                    color: text,
                    lineHeight: "1"
                  }}>
                    {formatTime(totalWorkSecs)}
                  </div>
                </div>
                
                {/* Total Break Time */}
                <div style={{
                  background: surface,
                  padding: "12px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "10px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Total Break Time
                  </div>
                  <div style={{
                    fontSize: "22px",
                    fontWeight: "300",
                    color: text,
                    lineHeight: "1"
                  }}>
                    {formatTime(totalBreakSecs)}
                  </div>
                </div>
                
                {/* Total Cycles Completed */}
                <div style={{
                  background: surface,
                  padding: "12px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "10px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Total Cycles Completed
                  </div>
                  <div style={{
                    fontSize: "22px",
                    fontWeight: "300",
                    color: text,
                    lineHeight: "1"
                  }}>
                    {totalCycles}
                  </div>
                </div>
                
                {/* Focus Score */}
                <div style={{
                  background: surface,
                  padding: "12px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "10px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Focus Score
                  </div>
                  <div style={{
                    fontSize: "22px",
                    fontWeight: "300",
                    color: focusScore === 100 ? "#FFD700" : text,
                    lineHeight: "1"
                  }}>
                    {focusScore}%
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'center',
              marginTop: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={clearStats}
                title="Reset all timer statistics"
                style={{
                  background: themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
                  color: textDim,
                  padding: "10px 16px",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  fontSize: "12px",
                  letterSpacing: "1px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 44, 44, 0.1)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Clear Stats
              </button>
              <button
                onClick={exportCSV}
                title="Download stats as Excel-compatible CSV file"
                style={{
                  background: themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
                  color: textDim,
                  padding: "10px 16px",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  fontSize: "12px",
                  letterSpacing: "1px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(44, 44, 44, 0.1)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)";
                  e.target.style.transform = "translateY(0)";
                }}
              >
                Export CSV
              </button>
              <button
                onClick={shareOnX}
                title="Share your focus session on X"
                style={{
                  background: 'rgba(0,0,0,0.9)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  letterSpacing: '0.3px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-1px)";
                  e.target.style.borderColor = "rgba(255,255,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              >
                Share on X
              </button>
              <button
                onClick={shareAsImage}
                title="Share as image"
                style={{
                  background: 'rgba(0,0,0,0.9)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '8px 18px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  letterSpacing: '0.3px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-1px)";
                  e.target.style.borderColor = "rgba(255,255,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.borderColor = "rgba(255,255,255,0.1)";
                }}
              >
                Share as Image
              </button>
            </div>

            {/* Per Task Breakdown */}
            {timers.length > 0 && (
              <div className="task-breakdown-grid" style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : (timers.length > 2 ? '1fr 1fr' : '1fr'),
                gap: '8px',
                marginTop: '8px'
              }}>
                {timers.map((timer) => (
                  <div key={timer.id} style={{
                    background: themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)",
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
                    padding: "12px",
                    borderRadius: "12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div style={{
                      color: accent,
                      fontSize: "14px",
                      fontWeight: "500",
                      flex: 1,
                      textAlign: "left"
                    }}>
                      {timer.name}
                    </div>
                    <div style={{
                      display: "flex",
                      gap: "16px",
                      alignItems: "center"
                    }}>
                      <div style={{
                        textAlign: "center"
                      }}>
                        <div style={{
                          color: textDim,
                          fontSize: "10px",
                          letterSpacing: "1px",
                          marginBottom: "2px",
                          textTransform: "uppercase"
                        }}>
                          Work
                        </div>
                        <div style={{ 
                          color: accent, 
                          fontSize: "14px", 
                          fontWeight: "300",
                          fontVariantNumeric: "tabular-nums"
                        }}>
                          {formatTime(timer.totalWorkSeconds)}
                        </div>
                      </div>
                      <div style={{
                        textAlign: "center"
                      }}>
                        <div style={{
                          color: textDim,
                          fontSize: "10px",
                          letterSpacing: "1px",
                          marginBottom: "2px",
                          textTransform: "uppercase"
                        }}>
                          Break
                        </div>
                        <div style={{ 
                          color: accent, 
                          fontSize: "14px", 
                          fontWeight: "300",
                          fontVariantNumeric: "tabular-nums"
                        }}>
                          {formatTime(timer.totalBreakSeconds)}
                        </div>
                      </div>
                      <div style={{
                        textAlign: "center"
                      }}>
                        <div style={{
                          color: textDim,
                          fontSize: "10px",
                          letterSpacing: "1px",
                          marginBottom: "2px",
                          textTransform: "uppercase"
                        }}>
                          Cycles
                        </div>
                        <div style={{ 
                          color: accent, 
                          fontSize: "14px", 
                          fontWeight: "300",
                          fontVariantNumeric: "tabular-nums"
                        }}>
                          {timer.cyclesCompleted || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daily Summary */}
            <div style={{
              background: themeMode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
              borderRadius: "16px",
              padding: "20px",
              marginTop: "16px"
            }}>
              <h3 style={{
                color: textDim,
                fontSize: "11px",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                fontWeight: "500",
                marginBottom: "12px",
                textAlign: "center"
              }}>
                Daily Report
              </h3>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px"
              }}>
                <div style={{ color: text, fontSize: "12px", fontWeight: "500" }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div style={{
                  color: accentBlue,
                  fontSize: "14px",
                  fontWeight: "600",
                  fontVariantNumeric: "tabular-nums"
                }}>
                  {formatTime(totalWorkSecs)}
                </div>
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px"
              }}>
                <div style={{ color: textDim, fontSize: "11px", fontWeight: "500" }}>
                  Total Cycles
                </div>
                <div style={{
                  color: text,
                  fontSize: "12px",
                  fontWeight: "600",
                  fontVariantNumeric: "tabular-nums"
                }}>
                  {timers.reduce((sum, t) => sum + (t.cyclesCompleted || 0), 0)}
                </div>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <div style={{
                  color: textDim,
                  fontSize: "10px",
                  fontWeight: "500",
                  marginBottom: "4px"
                }}>
                  Daily Goal Progress (4 hours)
                </div>
                <div style={{
                  background: border,
                  borderRadius: "100px",
                  height: "8px",
                  width: "100%",
                  marginTop: "8px"
                }}>
                  <div style={{
                    background: accentBlue,
                    borderRadius: "100px",
                    height: "8px",
                    width: `${Math.min((totalWorkSecs / (4 * 3600)) * 100, 100)}%`,
                    transition: "width 0.5s ease"
                  }} />
                </div>
              </div>
            </div>

            {/* Stopwatch Sessions */}
            {stopwatches.some(sw => sw.elapsed > 0) && (
              <div style={{ marginTop: '8px' }}>
                <div style={{
                  color: textDim, fontSize: '11px', letterSpacing: '1.5px',
                  textTransform: 'uppercase', fontWeight: '500',
                  marginBottom: '8px', textAlign: 'center'
                }}>Stopwatch Sessions</div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: stopwatches.length > 2 ? '1fr 1fr' : '1fr',
                  gap: '8px'
                }}>
                  {stopwatches.filter(sw => sw.elapsed > 0).map(sw => (
                    <div key={sw.id} style={{
                      background: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(40,35,29,0.05)',
                      border: `1px solid ${border}`,
                      borderLeft: `3px solid ${accentGreen}`,
                      padding: '12px', borderRadius: '12px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div style={{ color: accent, fontSize: '13px', fontWeight: '500' }}>
                        {sw.name}
                      </div>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: textDim, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>Elapsed</div>
                          <div style={{ color: accent, fontSize: '14px', fontWeight: '300', fontVariantNumeric: 'tabular-nums' }}>
                            {formatStopwatchTime(sw.elapsed)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ color: textDim, fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '2px' }}>Laps</div>
                          <div style={{ color: accent, fontSize: '14px', fontWeight: '300' }}>
                            {sw.laps.length}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Visual Reports Section */}
      <div style={{
        background: themeMode === 'dark' ? "rgba(255, 255, 255, 0.05)" : "rgba(40, 35, 29, 0.05)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(40,35,29,0.1)"}`,
        borderRadius: "16px",
        padding: "24px",
        marginTop: "20px"
      }}>
        <h3 style={{
          color: textDim,
          fontSize: "11px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          fontWeight: "500",
          marginBottom: "16px",
          textAlign: "center"
        }}>
          📊 Visual Reports
        </h3>
        
        {/* Today's Focus Time Bar Chart */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: textDim, fontSize: '10px', marginBottom: '8px' }}>
            Today's Focus Time
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: '80px',
            gap: '4px',
            marginBottom: '8px'
          }}>
            {[...Array(24)].map((_, hour) => {
              const hourFocusTime = Math.random() * 60; // Simulated data
              const height = (hourFocusTime / 60) * 80;
              return (
                <div
                  key={hour}
                  style={{
                    flex: 1,
                    background: hourFocusTime > 0 ? accentBlue : 'transparent',
                    border: hourFocusTime > 0 ? 'none' : `1px solid ${border}`,
                    borderRadius: '2px',
                    height: `${height}px`,
                    minHeight: '2px'
                  }}
                  title={`${hour}:00 - ${Math.round(hourFocusTime)} min`}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: textDim }}>
            <span>12am</span>
            <span>6am</span>
            <span>12pm</span>
            <span>6pm</span>
            <span>11pm</span>
          </div>
        </div>
        
        {/* Daily Goal Progress */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: textDim, fontSize: '10px', marginBottom: '8px' }}>
            Daily Goal Progress ({dailyGoal}h)
          </div>
          <div style={{
            background: border,
            borderRadius: "100px",
            height: "12px",
            width: "100%",
            marginBottom: '8px'
          }}>
            <div style={{
              background: accentBlue,
              borderRadius: "100px",
              height: "12px",
              width: `${Math.min((totalWorkSecs / (dailyGoal * 3600)) * 100, 100)}%`,
              transition: "width 0.5s ease"
            }} />
          </div>
          <div style={{ textAlign: 'center', fontSize: '12px', color: text }}>
            {Math.round((totalWorkSecs / (dailyGoal * 3600)) * 100)}% Complete
          </div>
        </div>
        
        {/* Best Streak */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: textDim, fontSize: '10px', marginBottom: '8px' }}>
            Best Streak
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '24px' }}>🔥</span>
            <div style={{
              fontSize: '20px',
              fontWeight: '600',
              color: accent
            }}>
              {Math.max(streak, 7)} days
            </div>
          </div>
        </div>
        
        {/* Total Focus Time All Time */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ color: textDim, fontSize: '10px', marginBottom: '8px' }}>
            Total Focus Time (All Time)
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: text,
            textAlign: 'center'
          }}>
            {formatTime(totalWorkSecs * 10)} {/* Simulated all-time data */}
          </div>
        </div>
        
        {/* Estimated Finish Time for Remaining Tasks */}
        {tasks.filter(t => !t.done).length > 0 && (
          <div>
            <div style={{ color: textDim, fontSize: '10px', marginBottom: '8px' }}>
              Estimated Finish Time
            </div>
            <div style={{
              background: themeMode === 'dark' ? 'rgba(224,123,79,0.1)' : 'rgba(224,123,79,0.05)',
              border: `1px solid ${border}`,
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '16px',
                fontWeight: '600',
                color: accent
              }}>
                {Math.ceil(tasks.filter(t => !t.done).reduce((sum, t) => 
                  sum + (t.estimatedPomodoros - t.completedPomodoros), 0
                ) * (globalWorkMin || 25) / 60)} hours
              </div>
              <div style={{ fontSize: '10px', color: textDim, marginTop: '4px' }}>
                {tasks.filter(t => !t.done).length} tasks remaining
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowLeaderboard(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: themeMode === 'dark' ? '#111118' : '#E8E4DC',
            border: `1px solid ${border}`,
            borderRadius: '20px',
            padding: '32px',
            width: '90%',
            maxWidth: '480px',
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: accent, fontSize: '18px', fontWeight: '600', margin: 0 }}>
                🏆 Weekly Leaderboard
              </h2>
              <button onClick={() => setShowLeaderboard(false)} style={{
                background: 'transparent', border: 'none', color: textDim,
                fontSize: '20px', cursor: 'pointer'
              }}>×</button>
            </div>
            {loadingLeaderboard ? (
              <div style={{ textAlign: 'center', color: textDim, padding: '40px' }}>Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div style={{ textAlign: 'center', color: textDim, padding: '40px' }}>
                No sessions this week yet. Be the first!
              </div>
            ) : (
              leaderboard.map((entry, index) => (
                <div key={index} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', borderRadius: '12px',
                  background: index === 0 ? 'rgba(224,123,79,0.1)' : 'transparent',
                  borderBottom: `1px solid ${border}`, marginBottom: '4px'
                }}>
                  <div style={{
                    width: '28px', textAlign: 'center',
                    fontSize: index < 3 ? '18px' : '14px',
                    color: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : textDim
                  }}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                  </div>
                  {entry.avatar_url && (
                    <img src={entry.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                  )}
                  <div style={{ flex: 1, color: accent, fontSize: '14px', fontWeight: '500' }}>
                    {entry.username}
                  </div>
                  <div style={{ color: accentBlue, fontSize: '14px', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
                    {Math.floor(entry.total_focus_seconds / 3600)}h {Math.floor((entry.total_focus_seconds % 3600) / 60)}m
                  </div>
                </div>
              ))
            )}
            {user && (
              <button
                onClick={() => { syncStatsToCloud(user.id); setShowLeaderboard(false); }}
                style={{
                  width: '100%', marginTop: '16px',
                  background: accentBlue, border: 'none', color: 'white',
                  padding: '12px', borderRadius: '12px', cursor: 'pointer',
                  fontSize: '14px', fontWeight: '600'
                }}>
                Submit My Score
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: themeMode === 'dark' ? '#111118' : '#E8E4DC',
            border: `1px solid ${border}`,
            borderRadius: '20px',
            padding: '32px',
            width: '90%',
            maxWidth: '520px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: accent, fontSize: '18px', fontWeight: '600', margin: 0 }}>
                ⚙️ Settings
              </h2>
              <button onClick={() => setShowSettings(false)} style={{
                background: 'transparent', border: 'none', color: textDim,
                fontSize: '20px', cursor: 'pointer'
              }}>×</button>
            </div>
            
            {/* Timer Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: text, fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
                Timer Settings
              </h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                  Work Duration: {globalWorkMin} min
                </label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={globalWorkMin}
                  onChange={(e) => setGlobalWorkMin(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                  Short Break: {globalBreakMin} min
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={globalBreakMin}
                  onChange={(e) => setGlobalBreakMin(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                  Long Break: {globalLongBreakMin} min
                </label>
                <input
                  type="range"
                  min="1"
                  max="60"
                  value={globalLongBreakMin}
                  onChange={(e) => setGlobalLongBreakMin(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                  Long Break Interval: every {longBreakInterval} pomodoros
                </label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={longBreakInterval}
                  onChange={(e) => setLongBreakInterval(parseInt(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            
            {/* Sound Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: text, fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
                Sound Settings
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                  />
                  Alarm Sound
                </label>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                  Alarm Volume: {Math.round(alarmVolume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={alarmVolume}
                  onChange={(e) => setAlarmVolume(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                  Ambient Noise Volume: {Math.round(volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            
            {/* Notification Settings */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: text, fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
                Notification Settings
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  />
                  Browser Notifications
                </label>
              </div>
            </div>
            
            {/* Daily Goal */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: text, fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
                Daily Goal
              </h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[1, 2, 4, 6, 8].map(hours => (
                  <button
                    key={hours}
                    onClick={() => setDailyGoal(hours)}
                    style={{
                      background: dailyGoal === hours ? accentBlue : 'transparent',
                      border: `1px solid ${border}`,
                      color: dailyGoal === hours ? 'white' : text,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>
            
            {/* Auto Start */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: text, fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>
                Auto Start
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={autoStartBreak}
                    onChange={(e) => setAutoStartBreak(e.target.checked)}
                  />
                  Auto-start Break after Work
                </label>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ color: text, fontSize: '12px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={autoStartWork}
                    onChange={(e) => setAutoStartWork(e.target.checked)}
                  />
                  Auto-start Work after Break
                </label>
              </div>
            </div>
            
            <button
              onClick={() => {
                const newSettings = {
                  workMin: globalWorkMin,
                  breakMin: globalBreakMin,
                  longBreakMin: globalLongBreakMin,
                  longBreakInterval,
                  soundEnabled,
                  alarmVolume,
                  notificationsEnabled,
                  dailyGoal,
                  autoStartBreak,
                  autoStartWork
                };
                setSettings(newSettings);
                setTimers(prev => prev.map(timer => ({
                  ...timer,
                  workMin: globalWorkMin,
                  breakMin: globalBreakMin,
                  longBreakMin: globalLongBreakMin,
                  secsLeft: timer.phase === 'work' ? globalWorkMin * 60 : globalBreakMin * 60
                })));
                setShowSettings(false);
              }}
              style={{
                width: '100%',
                background: accentBlue,
                border: 'none',
                color: 'white',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowUpgrade(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: themeMode === 'dark' ? '#111118' : '#E8E4DC',
            border: `1px solid ${border}`,
            borderRadius: '24px',
            padding: '40px',
            width: '90%',
            maxWidth: '420px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
            <h2 style={{ color: accent, fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
              Upgrade to Pro
            </h2>
            <p style={{ color: textDim, fontSize: '14px', marginBottom: '32px', lineHeight: '1.6' }}>
              Unlock the full Pomodoros.io experience
            </p>
            <div style={{ marginBottom: '32px', textAlign: 'left' }}>
              {[
                '✅ Cloud sync across all devices',
                '✅ Weekly leaderboard access',
                '✅ Unlimited timer history',
                '✅ Priority support',
                '✅ Early access to new features',
                '✅ Remove all limitations'
              ].map(feature => (
                <div key={feature} style={{
                  color: accent, fontSize: '14px', padding: '8px 0',
                  borderBottom: `1px solid ${border}` 
                }}>{feature}</div>
              ))}
            </div>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: accent, fontSize: '36px', fontWeight: '700' }}>$4.99</div>
              <div style={{ color: textDim, fontSize: '13px' }}>per month · cancel anytime</div>
            </div>
            <button
              onClick={() => {
                window.open('https://buy.stripe.com/test_bJe00j01mcZk6JOeMH8k800', '_blank');
              }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #E07B4F, #ff6b35)',
                border: 'none',
                color: 'white',
                padding: '16px',
                borderRadius: '14px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '700',
                marginBottom: '12px'
              }}>
              Start Pro — $4.99/month
            </button>
            <button
              onClick={() => setShowUpgrade(false)}
              style={{
                width: '100%',
                background: 'transparent',
                border: `1px solid ${border}`,
                color: textDim,
                padding: '12px',
                borderRadius: '14px',
                cursor: 'pointer',
                fontSize: '14px'
              }}>
              Maybe later
            </button>
          </div>
        </div>
      )}

      {/* Task Panel */}
      {showTaskPanel && (
        <div style={{
          position: 'fixed',
          top: isMobile ? '58px' : '60px',
          left: 0,
          bottom: 0,
          width: '320px',
          background: themeMode === 'dark' ? '#111118' : '#E8E4DC',
          border: `1px solid ${border}`,
          borderLeft: 'none',
          backdropFilter: 'blur(20px)',
          zIndex: 999,
          padding: '24px',
          overflowY: 'auto',
          transform: showTaskPanel ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: accent, fontSize: '18px', fontWeight: '600', margin: 0 }}>
              📋 Tasks
            </h2>
            <button onClick={() => setShowTaskPanel(false)} style={{
              background: 'transparent', border: 'none', color: textDim,
              fontSize: '20px', cursor: 'pointer'
            }}>×</button>
          </div>
          
          {/* Add new task */}
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Add new task..."
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newTaskInput.trim()) {
                  const newTask = {
                    id: Date.now(),
                    name: newTaskInput.trim(),
                    estimatedPomodoros: 1,
                    completedPomodoros: 0,
                    done: false,
                    createdAt: new Date().toISOString()
                  };
                  setTasks([...tasks, newTask]);
                  setNewTaskInput('');
                }
              }}
              style={{
                width: '100%',
                background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                border: `1px solid ${border}`,
                color: text,
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '8px'
              }}
            />
            <select
              value={1}
              onChange={(e) => {
                if (newTaskInput.trim()) {
                  const newTask = {
                    id: Date.now(),
                    name: newTaskInput.trim(),
                    estimatedPomodoros: parseInt(e.target.value),
                    completedPomodoros: 0,
                    done: false,
                    createdAt: new Date().toISOString()
                  };
                  setTasks([...tasks, newTask]);
                  setNewTaskInput('');
                }
              }}
              style={{
                width: '100%',
                background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                border: `1px solid ${border}`,
                color: text,
                padding: '8px',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            >
              {[...Array(10)].map((_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1} pomodoro{i + 1 > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          
          {/* Task list */}
          <div style={{ marginBottom: '20px' }}>
            {tasks.filter(t => !t.done).map(task => (
              <div key={task.id} style={{
                background: themeMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${border}`,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={(e) => {
                      setTasks(tasks.map(t => 
                        t.id === task.id ? { ...t, done: e.target.checked } : t
                      ));
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ 
                    color: text, 
                    fontSize: '14px', 
                    textDecoration: task.done ? 'line-through' : 'none',
                    opacity: task.done ? 0.5 : 1
                  }}>
                    {task.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                  {[...Array(task.estimatedPomodoros)].map((_, i) => (
                    <div key={i} style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: i < task.completedPomodoros ? accentBlue : border
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const template = { ...task, id: Date.now() };
                      setTemplates([...templates, template]);
                    }}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${border}`,
                      color: textDim,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    Save as Template
                  </button>
                  <button
                    onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${border}`,
                      color: textDim,
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Templates */}
          {templates.length > 0 && (
            <div>
              <h3 style={{ color: textDim, fontSize: '12px', fontWeight: '500', marginBottom: '8px' }}>
                Templates
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => {
                      const newTask = {
                        id: Date.now(),
                        name: template.name,
                        estimatedPomodoros: template.estimatedPomodoros,
                        completedPomodoros: 0,
                        done: false,
                        createdAt: new Date().toISOString()
                      };
                      setTasks([...tasks, newTask]);
                    }}
                    style={{
                      background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      border: `1px solid ${border}`,
                      color: text,
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Estimated finish time */}
          {tasks.filter(t => !t.done).length > 0 && (
            <div style={{
              marginTop: '20px',
              padding: '12px',
              background: themeMode === 'dark' ? 'rgba(224,123,79,0.1)' : 'rgba(224,123,79,0.05)',
              border: `1px solid ${border}`,
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ color: textDim, fontSize: '10px', marginBottom: '4px' }}>
                Estimated finish time
              </div>
              <div style={{ color: accent, fontSize: '14px', fontWeight: '600' }}>
                {Math.ceil(tasks.filter(t => !t.done).reduce((sum, t) => 
                  sum + (t.estimatedPomodoros - t.completedPomodoros), 0
                ) * (globalWorkMin || 25) / 60)} hours
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keyboard Help Modal */}
      {showKeyboardHelp && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowKeyboardHelp(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: themeMode === 'dark' ? '#111118' : '#E8E4DC',
            border: `1px solid ${border}`,
            borderRadius: '20px',
            padding: '32px',
            width: '90%',
            maxWidth: '420px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⌨️</div>
            <h2 style={{ color: accent, fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
              Keyboard Shortcuts
            </h2>
            <p style={{ color: textDim, fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
              Work faster with these shortcuts
            </p>
            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              {[
                { key: 'Space', desc: 'Start/Pause first timer' },
                { key: 'R', desc: 'Reset first timer' },
                { key: 'N', desc: 'Toggle noise' },
                { key: '1', desc: 'Switch to Timer tab' },
                { key: '2', desc: 'Switch to Noise tab' },
                { key: '3', desc: 'Switch to Notes tab' },
                { key: '4', desc: 'Switch to Stopwatch tab' },
                { key: '5', desc: 'Switch to Stats tab' }
              ].map(shortcut => (
                <div key={shortcut.key} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: `1px solid ${border}`
                }}>
                  <div style={{
                    background: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    border: `1px solid ${border}`,
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: accent,
                    minWidth: '40px',
                    textAlign: 'center'
                  }}>
                    {shortcut.key}
                  </div>
                  <div style={{
                    color: text,
                    fontSize: '14px'
                  }}>
                    {shortcut.desc}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowKeyboardHelp(false)}
              style={{
                width: '100%',
                background: accentBlue,
                border: 'none',
                color: 'white',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}>
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: themeMode === 'dark' ? '#111118' : '#E8E4DC',
            border: `1px solid ${border}`,
            borderRadius: '24px',
            padding: '40px',
            width: '90%',
            maxWidth: '480px',
            textAlign: 'center'
          }}>
            {onboardingStep === 1 && (
              <>
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>🍅</div>
                <h2 style={{ color: accent, fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
                  Welcome to Pomodoros.io
                </h2>
                <p style={{ color: text, fontSize: '16px', lineHeight: '1.6', marginBottom: '32px' }}>
                  The ultimate focus timer with deep work features
                </p>
                <div style={{ marginBottom: '32px', textAlign: 'left' }}>
                  {[
                    '🔥 Run up to 4 timers simultaneously',
                    '⏱️ Built-in stopwatch for time tracking',
                    '🌧️ Ambient noise for deep focus',
                    '📊 Detailed stats and progress tracking'
                  ].map(feature => (
                    <div key={feature} style={{
                      color: text, fontSize: '14px', padding: '8px 0',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                      {feature}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {onboardingStep === 2 && (
              <>
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎯</div>
                <h2 style={{ color: accent, fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
                  How to Use
                </h2>
                <p style={{ color: text, fontSize: '16px', lineHeight: '1.6', marginBottom: '32px' }}>
                  Get started in 3 simple steps
                </p>
                <div style={{ marginBottom: '32px', textAlign: 'left' }}>
                  {[
                    '1️⃣ Add a timer and set your work duration',
                    '2️⃣ Press Start to begin your focus session',
                    '3️⃣ Take breaks when the timer completes'
                  ].map(step => (
                    <div key={step} style={{
                      color: text, fontSize: '14px', padding: '8px 0',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                      {step}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {onboardingStep === 3 && (
              <>
                <div style={{ fontSize: '64px', marginBottom: '24px' }}>🚀</div>
                <h2 style={{ color: accent, fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>
                  Save Your Progress
                </h2>
                <p style={{ color: text, fontSize: '16px', lineHeight: '1.6', marginBottom: '32px' }}>
                  Sign in to sync your data across devices
                </p>
                <div style={{ marginBottom: '32px', textAlign: 'left' }}>
                  {[
                    '💾 Save your stats and progress',
                    '🏆 Access the global leaderboard',
                    '☁️ Sync across all your devices',
                    '⭐ Unlock premium features'
                  ].map(benefit => (
                    <div key={benefit} style={{
                      color: text, fontSize: '14px', padding: '8px 0',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                      {benefit}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  localStorage.setItem('pomodoros_visited', 'true');
                  setShowOnboarding(false);
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${border}`,
                  color: textDim,
                  padding: '12px 24px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Skip
              </button>
              <button
                onClick={() => {
                  if (onboardingStep === 3) {
                    localStorage.setItem('pomodoros_visited', 'true');
                    setShowOnboarding(false);
                  } else {
                    setOnboardingStep(onboardingStep + 1);
                  }
                }}
                style={{
                  background: accentBlue,
                  border: 'none',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {onboardingStep === 3 ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: themeMode === 'dark' ? '#1A1A24' : '#DEDAD2',
          border: `1px solid ${border}`,
          borderRadius: '100px',
          padding: '12px 24px',
          color: accent,
          fontSize: '14px',
          fontWeight: '500',
          zIndex: 99999,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.3s ease',
          whiteSpace: 'nowrap'
        }}>
          {toast}
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '16px',
        fontSize: '10px',
        color: textDim,
        opacity: 0.4,
        zIndex: 1
      }}>
        {['Privacy', 'Terms', 'Contact'].map(link => (
          <span key={link} style={{ cursor: 'pointer' }}
            onClick={() => window.open(`https://www.pomodoros.io/${link.toLowerCase()}`, '_blank')}>
            {link}
          </span>
        ))}
      </div>
          </div>
    </div>
  );
}
