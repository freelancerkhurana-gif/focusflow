import { useState, useEffect, useRef, useCallback } from "react";
import { Monitor, Sun, Moon, Volume2, VolumeX, FileText, BarChart2 } from "lucide-react";

export default function Pomodoros() {
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
  const [themeMode, setThemeMode] = useState("dark");

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
      liveSeconds: 0
    }
  ]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTimerName, setNewTimerName] = useState('');
  const [editingTimerId, setEditingTimerId] = useState(null);
  const [editingName, setEditingName] = useState('');

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

  const NOISE_TYPES = ["white", "pink", "brown"];

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
      ['TOTALS', formatTime(totalWorkSecs), formatTime(totalBreakSecs), totalCycles, '']
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
        liveSeconds: 0
      };
      
      return [...prev, newTimer];
    });
  }, []);

  const startTimer = useCallback((id) => {
    if (timerIntervalsRef.current[id]) return;
    timerIntervalsRef.current[id] = setInterval(() => {
      setTimers(prev => prev.map(t => {
        if (t.id !== id) return t;
        if (t.secsLeft <= 1) {
          clearInterval(timerIntervalsRef.current[id]);
          delete timerIntervalsRef.current[id];
          const nextPhase = t.phase === 'work' ? 'break' : 'work';
          const nextSecs = nextPhase === 'work' ? 25 * 60 : 5 * 60;
          return { 
            ...t, 
            running: false, 
            phase: nextPhase, 
            secsLeft: nextSecs, 
            cyclesCompleted: (t.cyclesCompleted || 0) + (t.phase === 'work' ? 1 : 0),
            totalWorkSeconds: t.phase === 'work' ? t.totalWorkSeconds + t.liveSeconds + 1 : t.totalWorkSeconds,
            totalBreakSeconds: t.phase === 'break' ? t.totalBreakSeconds + t.liveSeconds + 1 : t.totalBreakSeconds,
            liveSeconds: 0
          };
        }
        const updatedTimer = { ...t, secsLeft: t.secsLeft - 1 };
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
        secsLeft: 25 * 60,
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
          secsLeft: newPhase === 'work' ? 25 * 60 : 5 * 60,
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

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(timerIntervalsRef.current).forEach(interval => clearInterval(interval));
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

  // Global Styles
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
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
        .timer-grid-2, .timer-grid-4 {
          grid-template-columns: 1fr !important;
          grid-template-rows: unset !important;
          height: auto !important;
          overflow-y: auto !important;
        }
        .nav-bar {
          gap: 2px !important;
        }
        .nav-bar button {
          padding: 7px 8px !important;
          font-size: 11px !important;
        }
        .stats-row {
          grid-template-columns: 1fr 1fr !important;
        }
        .task-breakdown-grid {
          grid-template-columns: 1fr !important;
        }
      }
      @media (max-width: 480px) {
        .stats-row {
          grid-template-columns: 1fr !important;
        }
        .nav-bar button {
          padding: 6px 6px !important;
          font-size: 10px !important;
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
            .message {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              color: inherit;
              font-size: 16px;
              letter-spacing: 3px;
              opacity: 0.6;
              z-index: 10000;
              text-align: center;
              font-weight: 300;
              text-transform: uppercase;
              user-select: none;
              pointer-events: none;
              display: none;
            }
            .message.show {
              display: block;
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
          <div class="message" id="message">Press ESC to return</div>
          
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
              document.body.style.background = bg;
              
              // Hide other elements
              document.querySelector('.palette-container').style.display = 'none';
              document.querySelector('.title').style.display = 'none';
              document.getElementById('message').classList.add('show');
              document.getElementById('message').style.color = text;
              
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
              document.getElementById('message').classList.remove('show');
              
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
      <div style={{
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
        </div>
      </div>

      {/* Top Navigation */}
      <div className="nav-bar" style={{
        position: "absolute",
        top: "60px",
        left: "50%",
        transform: "translateX(-50%)",
        background: themeMode === 'dark' ? 'rgba(17,17,24,0.6)' : 'rgba(216,212,204,0.8)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${border}`,
        borderRadius: "12px",
        padding: "3px",
        display: "flex",
        gap: "3px",
        alignItems: "center"
      }}>
        {["timer", "noise", "note", "stats"].map(t => (
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
            {t}
          </button>
        ))}
        
        {/* Add Timer Button */}
        {tab === "timer" && (
          <button
            onClick={addTimer}
            disabled={timers.length >= 4}
            style={{
              background: timers.length >= 4 ? surface : "rgba(91,110,245,0.15)",
              color: timers.length >= 4 ? textDim : accentBlue,
              border: `1px solid ${timers.length >= 4 ? border : 'rgba(91,110,245,0.3)'}`,
              padding: "8px 16px",
              cursor: timers.length >= 4 ? "not-allowed" : "pointer",
              borderRadius: "9px",
              transition: "all 0.15s ease",
              fontWeight: "500",
              fontSize: "13px",
              letterSpacing: "0.5px",
              opacity: timers.length >= 4 ? 0.5 : 1,
              marginLeft: "8px"
            }}
            onMouseEnter={(e) => {
              if (timers.length < 4) {
                e.target.style.borderColor = borderHover;
                e.target.style.transform = "translateY(-1px)";
              }
            }}
            onMouseLeave={(e) => {
              if (timers.length < 4) {
                e.target.style.borderColor = 'rgba(91,110,245,0.3)';
                e.target.style.transform = "translateY(0)";
              }
            }}
          >
            + Add {timers.length >= 4 && "(Max 4)"}
          </button>
        )}
      </div>

      {/* Main Content */}
      <div style={{
        position: 'fixed',
        top: '108px',
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: tab === 'timer' ? 'flex-start' : 'center',
        height: '100%',
        width: '100%'
      }}>
        {/* Multi-Timer Section */}
        {tab === "timer" && (
          <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>

            
            {/* Timer Grid */}
            <div className={`timer-grid ${timers.length === 2 ? 'timer-grid-2' : 'timer-grid-4'}`} style={{
              display: 'grid',
              gridTemplateColumns: timers.length === 1 ? '1fr' : '1fr 1fr',
              gridTemplateRows: timers.length <= 2 ? '1fr' : '1fr 1fr',
              gap: '10px',
              padding: '10px 16px',
              height: 'calc(100vh - 108px)',
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: timers.length === 1 ? '520px' : '100%',
              margin: timers.length === 1 ? '0 auto' : '0',
              transition: 'all 0.3s ease'
            }}>
              {timers.map((timer) => {
                const timerCount = timers.length;
                const cardPadding = timerCount === 1 ? '28px 32px' : timerCount === 2 ? '20px 24px' : '14px 16px';
                return (
                <div
                  key={timer.id}
                  style={{
                    background: themeMode === 'dark' ? 'rgba(17,17,24,0.8)' : 'rgba(220,216,208,0.9)',
                    backdropFilter: 'blur(20px)',
                    border: `1px solid ${border}`,
                    borderTop: `2px solid ${timer.phase === 'work' ? '#E07B4F' : '#4FA8E0'}`,
                    borderRadius: "16px",
                    padding: cardPadding,
                    textAlign: "center",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: themeMode === 'dark' ? '0 4px 24px rgba(0,0,0,0.4)' : '0 2px 16px rgba(0,0,0,0.06)',
                    transition: "all 0.3s ease",
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    height: '100%',
                    width: '100%'
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
                            updateTimerName(timer.id, editingName.trim());
                          }
                          setEditingTimerId(null);
                          setEditingName('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingName.trim()) {
                              updateTimerName(timer.id, editingName.trim());
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

                  {/* Countdown + Phase Label Container */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', margin: '0' }}>
                    {/* Timer Display */}
                    <div style={{
                      fontSize: timers.length === 1 ? '88px' : timers.length === 2 ? '64px' : '48px',
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
                      {timer.phase === "work" ? "Focus" : "Rest"}
                    </div>
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
                          padding: timers.length === 1 ? '12px 20px' : timers.length === 2 ? '10px 16px' : '7px 12px',
                          cursor: "pointer",
                          borderRadius: "10px",
                          transition: "all 0.15s ease",
                          fontWeight: "500",
                          fontSize: timers.length === 1 ? '15px' : timers.length === 2 ? '13px' : '11px',
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
                          padding: timers.length === 1 ? '12px 20px' : timers.length === 2 ? '10px 16px' : '7px 12px',
                          cursor: "pointer",
                          borderRadius: "10px",
                          transition: "all 0.15s ease",
                          fontWeight: "500",
                          fontSize: timers.length === 1 ? '15px' : timers.length === 2 ? '13px' : '11px',
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
            <div style={{
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
          <div style={{ textAlign: "center", maxWidth: "500px", width: "100%" }}>
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
                height: "300px",
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

        {/* Stats Section */}
        {tab === "stats" && (
          <div style={{ textAlign: "center", maxWidth: "680px", margin: "0 auto" }}>
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
              padding: "16px",
              borderRadius: "16px",
              textAlign: "center"
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "12px",
                alignItems: "stretch"
              }}>
                {/* Total Focus Time */}
                <div style={{
                  background: surface,
                  padding: "16px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "11px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Total Focus Time
                  </div>
                  <div style={{
                    fontSize: "26px",
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
                  padding: "16px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "11px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Total Break Time
                  </div>
                  <div style={{
                    fontSize: "26px",
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
                  padding: "16px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "11px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Total Cycles Completed
                  </div>
                  <div style={{
                    fontSize: "26px",
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
                  padding: "16px 20px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "80px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "11px",
                    letterSpacing: "0.8px",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    fontWeight: "500"
                  }}>
                    Focus Score
                  </div>
                  <div style={{
                    fontSize: "26px",
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
              marginTop: '12px',
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
            </div>

            {/* Per Task Breakdown */}
            {timers.length > 0 && (
              <div className="task-breakdown-grid" style={{
                display: 'grid',
                gridTemplateColumns: timers.length > 2 ? '1fr 1fr' : '1fr',
                gap: '8px',
                marginTop: '12px'
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
          </div>
        )}
      </div>

            
          </div>
  );
}
