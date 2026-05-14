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

  // Refs
  const timerRef = useRef(null);
  const liveRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const phaseRef = useRef("work");
  phaseRef.current = phase;

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

  // Theme colors
  const bg = themeMode === "dark" ? "#121212" : "#f4f4ef";
  const text = themeMode === "dark" ? "#e8e8e8" : "#1a1d23";
  const textDim = themeMode === "dark" ? "rgba(232,232,232,0.5)" : "rgba(26,29,35,0.5)";
  const accent = themeMode === "dark" ? "#e8e8e8" : "#1a1d23";
  const surface = themeMode === "dark" ? "#1e1e1e" : "#ffffff";

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
  const resetTimer = useCallback((newPhase = phase, newWorkMin = workMin, newBreakMin = breakMin) => {
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

  // Dynamic Tab Title
  useEffect(() => {
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const phaseText = phase === "work" ? "Focus" : "Rest";
    document.title = `${formatTime(secsLeft)} - ${phaseText}`;
  }, [secsLeft, phase]);

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

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Derived stats ─────────────────────────────────────────────────────────────
  // saved (flushed on every pause) + live (current running segment, 0 when paused)
  const totalWorkSecs = savedWorkSeconds + (phase === "work" ? liveSeconds : 0);
  const totalBreakSecs = savedBreakSeconds + (phase === "break" ? liveSeconds : 0);
  const focusScore = Math.min(Math.round((totalWorkSecs / (100 * 60)) * 100), 100);

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
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 30px",
        zIndex: 10
      }}>
        {/* Logo */}
        <div style={{
          color: accent,
          fontSize: "16px",
          fontWeight: "500",
          letterSpacing: "0.5px",
          opacity: 0.8
        }}>
          Pomodoros.io
        </div>

        {/* Utility Row */}
        <div style={{
          display: "flex",
          gap: "12px",
          alignItems: "center"
        }}>
          {/* Theme Toggle */}
          <button
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
              color: accent,
              padding: "8px 12px",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              fontSize: "12px"
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.12)";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.08)";
              e.target.style.transform = "translateY(0)";
            }}
          >
            {themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Wash Button */}
          <button
            onClick={openWashMode}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
              color: accent,
              padding: "8px 12px",
              borderRadius: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              fontSize: "12px"
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.12)";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255, 255, 255, 0.08)";
              e.target.style.transform = "translateY(0)";
            }}
          >
            <Monitor size={14} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        padding: "0 30px"
      }}>
        {/* Timer Section */}
        {tab === "timer" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: "96px",
              marginBottom: "40px",
              letterSpacing: "4px",
              fontWeight: "300",
              color: accent,
              fontVariantNumeric: "tabular-nums"
            }}>
              {formatTime(secsLeft)}
            </div>
            <div style={{
              fontSize: "16px",
              color: textDim,
              marginBottom: "60px",
              letterSpacing: "6px",
              fontWeight: "500",
              textTransform: "uppercase"
            }}>
              {phase === "work" ? "Focus" : "Rest"}
            </div>
            <div style={{
              marginBottom: "60px",
              display: "flex",
              gap: "16px",
              justifyContent: "center"
            }}>
              <button
                onClick={() => setRunning(r => !r)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
                  color: accent,
                  padding: "16px 32px",
                  cursor: "pointer",
                  fontSize: "16px",
                  letterSpacing: "1px",
                  borderRadius: "16px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  minWidth: "120px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.15)";
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.08)";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                }}
              >
                {running ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => resetTimer(phase, workMin, breakMin)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
                  color: accent,
                  padding: "16px 32px",
                  cursor: "pointer",
                  fontSize: "16px",
                  letterSpacing: "1px",
                  borderRadius: "16px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  minWidth: "120px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.15)";
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.08)";
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow = "none";
                }}
              >
                Reset
              </button>
            </div>
            <div style={{
              display: "flex",
              gap: "12px",
              justifyContent: "center"
            }}>
              <button
                onClick={() => { setPhase("work"); resetTimer("work"); }}
                style={{
                  background: phase === "work" ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${phase === "work" ? accent : (themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)")}`,
                  color: phase === "work" ? accent : textDim,
                  padding: "12px 24px",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  fontSize: "14px",
                  letterSpacing: "1px"
                }}
                onMouseEnter={(e) => {
                  if (phase !== "work") {
                    e.target.style.background = "rgba(255, 255, 255, 0.1)";
                    e.target.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (phase !== "work") {
                    e.target.style.background = "rgba(255, 255, 255, 0.05)";
                    e.target.style.transform = "translateY(0)";
                  }
                }}
              >
                Work
              </button>
              <button
                onClick={() => { setPhase("break"); resetTimer("break"); }}
                style={{
                  background: phase === "break" ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${phase === "break" ? accent : (themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)")}`,
                  color: phase === "break" ? accent : textDim,
                  padding: "12px 24px",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  fontSize: "14px",
                  letterSpacing: "1px"
                }}
                onMouseEnter={(e) => {
                  if (phase !== "break") {
                    e.target.style.background = "rgba(255, 255, 255, 0.1)";
                    e.target.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (phase !== "break") {
                    e.target.style.background = "rgba(255, 255, 255, 0.05)";
                    e.target.style.transform = "translateY(0)";
                  }
                }}
              >
                Break
              </button>
            </div>
          </div>
        )}

        {/* Noise Section */}
        {tab === "noise" && (
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h2 style={{
              color: accent,
              fontSize: "28px",
              marginBottom: "40px",
              fontWeight: "300",
              letterSpacing: "2px"
            }}>
              Ambient Noise
            </h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "30px"
            }}>
              {NOISE_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => { setNoiseType(type); setNoiseOn(true); }}
                  style={{
                    background: noiseType === type && noiseOn ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.05)",
                    backdropFilter: "blur(10px)",
                    border: `1px solid ${noiseType === type && noiseOn ? accent : (themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)")}`,
                    color: noiseType === type && noiseOn ? accent : textDim,
                    padding: "16px",
                    cursor: "pointer",
                    borderRadius: "12px",
                    transition: "all 0.2s ease",
                    fontWeight: "500",
                    fontSize: "16px",
                    letterSpacing: "1px",
                    textTransform: "capitalize"
                  }}
                  onMouseEnter={(e) => {
                    if (!(noiseType === type && noiseOn)) {
                      e.target.style.background = "rgba(255, 255, 255, 0.1)";
                      e.target.style.transform = "translateY(-1px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(noiseType === type && noiseOn)) {
                      e.target.style.background = "rgba(255, 255, 255, 0.05)";
                      e.target.style.transform = "translateY(0)";
                    }
                  }}
                >
                  {type} Noise
                </button>
              ))}
            </div>
            {noiseOn && (
              <button
                onClick={() => setNoiseOn(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
                  color: accent,
                  padding: "14px 28px",
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease",
                  fontWeight: "500",
                  fontSize: "14px",
                  letterSpacing: "1px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.12)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.08)";
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
                background: "rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(10px)",
                border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
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
                e.target.style.background = "rgba(255, 255, 255, 0.08)";
                e.target.style.borderColor = accent;
              }}
              onBlur={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.05)";
                e.target.style.borderColor = themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)";
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
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
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
                  e.target.style.background = "rgba(255, 255, 255, 0.12)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.08)";
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
                  background: "rgba(255, 255, 255, 0.08)",
                  backdropFilter: "blur(10px)",
                  border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
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
                  e.target.style.background = "rgba(255, 255, 255, 0.12)";
                  e.target.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255, 255, 255, 0.08)";
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
          <div style={{ textAlign: "center", maxWidth: "500px" }}>
            <h2 style={{
              color: accent,
              fontSize: "28px",
              marginBottom: "32px",
              fontWeight: "300",
              letterSpacing: "2px"
            }}>
              Today's Stats
            </h2>
            
            {/* Live Session Status */}
            <div style={{
              background: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
              padding: "24px",
              borderRadius: "16px",
              marginBottom: "24px"
            }}>
              <div style={{
                color: accent,
                fontSize: "16px",
                fontWeight: "300",
                letterSpacing: "1px",
                lineHeight: "1.5"
              }}>
                {running 
                  ? (phase === "work" 
                      ? `Focus Session #${sessionsCompleted + 1} is underway... ${formatTime(secsLeft)}` 
                      : `Recharging: Break session in progress... ${formatTime(secsLeft)}` 
                    )
                  : (phase === "work" 
                      ? "Ready for your next focus session"
                      : "Ready to continue working"
                    )
                }
              </div>
            </div>
            
            {/* Perfect 2x2 Stats Grid */}
            <div style={{
              background: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
              padding: "40px",
              borderRadius: "16px",
              textAlign: "center"
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "24px",
                alignItems: "stretch"
              }}>
                {/* Sessions Completed */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "24px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "120px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "12px",
                    letterSpacing: "1px",
                    marginBottom: "12px",
                    textTransform: "uppercase"
                  }}>
                    Sessions Completed
                  </div>
                  <div style={{
                    fontSize: "32px",
                    fontWeight: "300",
                    color: accent,
                    lineHeight: "1"
                  }}>
                    {sessionsCompleted}
                  </div>
                </div>
                
                {/* Total Focused Time */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "24px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "120px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "12px",
                    letterSpacing: "1px",
                    marginBottom: "12px",
                    textTransform: "uppercase"
                  }}>
                    Total Focused Time
                  </div>
                  <div style={{
                    fontSize: "32px",
                    fontWeight: "300",
                    color: accent,
                    lineHeight: "1"
                  }}>
                    {formatTime(totalWorkSecs)}
                  </div>
                </div>
                
                {/* Total Break Time */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "24px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "120px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "12px",
                    letterSpacing: "1px",
                    marginBottom: "12px",
                    textTransform: "uppercase"
                  }}>
                    Total Break Time
                  </div>
                  <div style={{
                    fontSize: "32px",
                    fontWeight: "300",
                    color: accent,
                    lineHeight: "1"
                  }}>
                    {formatTime(totalBreakSecs)}
                  </div>
                </div>
                
                {/* Focus Score */}
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "24px",
                  borderRadius: "12px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minHeight: "120px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "12px",
                    letterSpacing: "1px",
                    marginBottom: "12px",
                    textTransform: "uppercase"
                  }}>
                    Focus Score
                  </div>
                  <div style={{
                    fontSize: "32px",
                    fontWeight: "300",
                    color: focusScore >= 100 ? "#FFD700" : accent,
                    lineHeight: "1"
                  }}>
                    {focusScore}%
                  </div>
                </div>
              </div>
            </div>

            {/* Clear Stats */}
            <button
              onClick={clearStats}
              style={{
                background: "rgba(255, 255, 255, 0.05)",
                backdropFilter: "blur(10px)",
                border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
                color: textDim,
                padding: "10px 24px",
                cursor: "pointer",
                borderRadius: "12px",
                transition: "all 0.2s ease",
                fontWeight: "500",
                fontSize: "13px",
                letterSpacing: "1px"
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.1)";
                e.target.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(255, 255, 255, 0.05)";
                e.target.style.transform = "translateY(0)";
              }}
            >
              Clear Stats
            </button>
          </div>
        )}
      </div>

      {/* Segmented Control Navigation */}
      <div style={{
        position: "absolute",
        bottom: "40px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
        borderRadius: "16px",
        padding: "4px",
        display: "flex",
        gap: "4px"
      }}>
        {["timer", "noise", "note", "stats"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? "rgba(255, 255, 255, 0.15)" : "transparent",
              color: tab === t ? accent : textDim,
              padding: "12px 20px",
              cursor: "pointer",
              borderRadius: "12px",
              transition: "all 0.2s ease",
              fontWeight: "500",
              fontSize: "14px",
              letterSpacing: "1px",
              textTransform: "capitalize",
              border: "none",
              minWidth: "80px"
            }}
            onMouseEnter={(e) => {
              if (tab !== t) {
                e.target.style.background = "rgba(255, 255, 255, 0.08)";
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
      </div>
      
      {/* SEO Footer */}
      <div style={{ position: "absolute", bottom: "8px", left: "50%",
        transform: "translateX(-50%)", fontSize: "11px", color: "rgba(255,255,255,0.15)",
        letterSpacing: "0.5px", textAlign: "center", whiteSpace: "nowrap" }}>
        Minimalist Pomodoro Timer · Ambient Noise · Deep Work Tool
      </div>
    </div>
  );
}
