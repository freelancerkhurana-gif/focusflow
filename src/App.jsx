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
  const [note, setNote] = useState("");
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [themeMode, setThemeMode] = useState("dark");
  
  // Refs
  const timerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const gainRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const phaseRef = useRef("work");
  phaseRef.current = phase;

  // Constants
  const WASH_MODES = [
    { label: "RED", bg: "#FF0000", text: "#ffffff" },
    { label: "GREEN", bg: "#00FF00", text: "#003300" },
    { label: "BLUE", bg: "#0000FF", text: "#aaaaff" },
    { label: "WHITE", bg: "#FFFFFF", text: "#000000" },
    { label: "BLACK", bg: "#000000", text: "#333333" },
  ];

  const NOISE_TYPES = ["white", "pink", "brown"];

  // Theme colors
  const bg = themeMode === "dark" ? "#121212" : "#f4f4ef";
  const text = themeMode === "dark" ? "#e8e8e8" : "#1a1d23";
  const textDim = themeMode === "dark" ? "rgba(232,232,232,0.5)" : "rgba(26,29,35,0.5)";
  const accent = themeMode === "dark" ? "#e8e8e8" : "#1a1d23";
  const surface = themeMode === "dark" ? "#1e1e1e" : "#ffffff";

  // Timer logic
  const resetTimer = useCallback((newPhase = phase, newWorkMin = workMin, newBreakMin = breakMin) => {
    clearInterval(timerRef.current);
    setRunning(false);
    setSecsLeft(newPhase === "work" ? newWorkMin * 60 : newBreakMin * 60);
    setPhase(newPhase);
  }, [phase, workMin, breakMin]);

  useEffect(() => {
    if (!running) {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (secsLeft <= 1) {
        // Session complete
        const nextPhase = phaseRef.current === "work" ? "break" : "work";
        setPhase(nextPhase);
        setRunning(false);
        setSecsLeft(nextPhase === "work" ? workMin * 60 : breakMin * 60);
        return;
      }
      setSecsLeft(s => s - 1);
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [running, secsLeft, workMin, breakMin]);

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

  // Wash mode function
  const openWashMode = useCallback(() => {
    const newWindow = window.open('', '_blank');
    const color = WASH_MODES[0];
    
    newWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${color.label} - Pomodoros</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              background: ${color.bg}; 
              height: 100vh; 
              overflow: hidden;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .info {
              position: fixed;
              top: 20px;
              left: 50%;
              transform: translateX(-50%);
              color: ${color.text};
              font-size: 14px;
              letter-spacing: 2px;
              opacity: 0.7;
              z-index: 1000;
            }
            .colors {
              position: fixed;
              bottom: 40px;
              left: 50%;
              transform: translateX(-50%);
              display: flex;
              gap: 12px;
              z-index: 1000;
            }
            .color-btn {
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid ${color.text};
              color: ${color.text};
              padding: 8px 16px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 12px;
              letter-spacing: 1px;
              transition: all 0.2s ease;
            }
            .color-btn:hover {
              background: rgba(255, 255, 255, 0.2);
              transform: translateY(-1px);
            }
          </style>
        </head>
        <body>
          <div class="info">${color.label} - Press ESC to exit</div>
          <div class="colors">
            ${WASH_MODES.map((mode, index) => 
              `<button class="color-btn" onclick="changeColor(${index})">${mode.label}</button>`
            ).join('')}
          </div>
          <script>
            const WASH_MODES = ${JSON.stringify(WASH_MODES)};
            let currentColorIndex = 0;
            
            function changeColor(index) {
              currentColorIndex = index;
              const color = WASH_MODES[index];
              document.body.style.background = color.bg;
              document.querySelector('.info').textContent = color.label + ' - Press ESC to exit';
              document.querySelectorAll('.color-btn').forEach((btn, i) => {
                btn.style.opacity = i === index ? '1' : '0.7';
              });
            }
            
            // Request fullscreen on load
            document.addEventListener('DOMContentLoaded', () => {
              document.documentElement.requestFullscreen().catch(err => {
                console.log('Fullscreen request failed:', err);
              });
            });
            
            // ESC to exit fullscreen and close
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                if (document.fullscreenElement) {
                  document.exitFullscreen().then(() => {
                    window.close();
                  }).catch(() => {
                    window.close();
                  });
                } else {
                  window.close();
                }
              }
            });
            
            // Initialize first button as active
            changeColor(0);
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
                onClick={resetTimer}
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
          </div>
        )}

        {/* Stats Section */}
        {tab === "stats" && (
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h2 style={{
              color: accent,
              fontSize: "28px",
              marginBottom: "40px",
              fontWeight: "300",
              letterSpacing: "2px"
            }}>
              Today's Stats
            </h2>
            <div style={{
              background: "rgba(255, 255, 255, 0.05)",
              backdropFilter: "blur(10px)",
              border: `1px solid ${themeMode === "dark" ? "rgba(200,200,200,0.08)" : "rgba(0,0,0,0.08)"}`,
              padding: "32px",
              borderRadius: "16px",
              textAlign: "center"
            }}>
              <div style={{
                fontSize: "48px",
                marginBottom: "16px",
                color: accent,
                fontWeight: "300",
                letterSpacing: "2px"
              }}>
                0:00
              </div>
              <div style={{
                color: textDim,
                marginBottom: "32px",
                fontSize: "14px",
                letterSpacing: "1px"
              }}>
                Hours:Minutes Focused
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "16px"
              }}>
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "20px",
                  borderRadius: "12px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "12px",
                    letterSpacing: "1px",
                    marginBottom: "8px"
                  }}>
                    Work Duration
                  </div>
                  <div style={{
                    fontSize: "24px",
                    fontWeight: "300",
                    color: accent
                  }}>
                    {workMin} min
                  </div>
                </div>
                <div style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "20px",
                  borderRadius: "12px"
                }}>
                  <div style={{
                    color: textDim,
                    fontSize: "12px",
                    letterSpacing: "1px",
                    marginBottom: "8px"
                  }}>
                    Break Duration
                  </div>
                  <div style={{
                    fontSize: "24px",
                    fontWeight: "300",
                    color: accent
                  }}>
                    {breakMin} min
                  </div>
                </div>
              </div>
            </div>
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
    </div>
  );
}
