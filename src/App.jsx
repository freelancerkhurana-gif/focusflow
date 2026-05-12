import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Pause, RotateCcw, Settings, X, Volume2, VolumeX,
  Monitor, FileText, BarChart2, ChevronUp, ChevronDown, Zap,
  Download, Bookmark, Copy, Check, Minimize2, Maximize2,
  Pin, Shield, WifiOff, Sun, Moon, Laptop
} from "lucide-react";

/* ─────────────────────────────────────────────
   THEME SYSTEM
───────────────────────────────────────────── */
const THEMES = {
  dark: {
    id: "dark",
    bg:          "#090909",
    surface:     "#111111",
    border:      "rgba(0,255,65,0.14)",
    borderBright:"rgba(0,255,65,0.35)",
    accent:      "#00FF41",
    accentDim:   "rgba(0,255,65,0.38)",
    accentFaint: "rgba(0,255,65,0.07)",
    text:        "#00FF41",
    textDim:     "rgba(0,255,65,0.4)",
    textFaint:   "rgba(0,255,65,0.18)",
    glow:        "0 0 20px #00FF41, 0 0 40px rgba(0,255,65,0.4)",
    btnBg:       "#00FF41",
    btnText:     "#090909",
    scanOpacity: "0.04",
  },
  light: {
    id: "light",
    bg:          "#F4F4EF",
    surface:     "#FFFFFF",
    border:      "rgba(0,107,28,0.18)",
    borderBright:"rgba(0,107,28,0.55)",
    accent:      "#006B1C",
    accentDim:   "rgba(0,107,28,0.5)",
    accentFaint: "rgba(0,107,28,0.07)",
    text:        "#0a2e10",
    textDim:     "rgba(0,70,18,0.52)",
    textFaint:   "rgba(0,70,18,0.22)",
    glow:        "none",
    btnBg:       "#006B1C",
    btnText:     "#FFFFFF",
    scanOpacity: "0",
  },
  forest: {
    id: "forest",
    bg:          "#0a1f0f",
    surface:     "#1a2e1a",
    border:      "rgba(34,139,34,0.12)",
    borderBright:"rgba(34,139,34,0.28)",
    accent:      "#2d5016",
    accentDim:   "rgba(45,125,34,0.4)",
    accentFaint: "rgba(45,125,34,0.08)",
    text:        "#2d5016",
    textDim:     "rgba(45,125,34,0.3)",
    textFaint:   "rgba(45,125,34,0.15)",
    glow:        "0 0 15px #2d5016, 0 0 30px rgba(45,125,34,0.3)",
    btnBg:       "#2d5016",
    btnText:     "#FFFFFF",
    scanOpacity: "0.02",
  },
  cyberpunk: {
    id: "cyberpunk",
    bg:          "#0a0a0a",
    surface:     "#1a0f1a",
    border:      "rgba(255,0,255,0.12)",
    borderBright:"rgba(255,0,255,0.35)",
    accent:      "#ff00ff",
    accentDim:   "rgba(255,0,255,0.4)",
    accentFaint: "rgba(255,0,255,0.08)",
    text:        "#ff00ff",
    textDim:     "rgba(255,0,255,0.4)",
    textFaint:   "rgba(255,0,255,0.18)",
    glow:        "0 0 20px #ff00ff, 0 0 40px rgba(255,0,255,0.4), 0 0 60px rgba(255,0,255,0.2)",
    btnBg:       "#ff00ff",
    btnText:     "#000000",
    scanOpacity: "0.05",
  },
  minimalist: {
    id: "minimalist",
    bg:          "#f8f8f8",
    surface:     "#ffffff",
    border:      "rgba(128,128,128,0.15)",
    borderBright:"rgba(128,128,128,0.25)",
    accent:      "#333333",
    accentDim:   "rgba(51,51,51,0.4)",
    accentFaint: "rgba(51,51,51,0.08)",
    text:        "#333333",
    textDim:     "rgba(51,51,51,0.3)",
    textFaint:   "rgba(51,51,51,0.15)",
    glow:        "none",
    btnBg:       "#333333",
    btnText:     "#f8f8f8",
    scanOpacity: "0",
  },
};

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/* ─────────────────────────────────────────────
   WASH MODES — Top 5 essential colors
───────────────────────────────────────────── */
const WASH_MODES = [
  { label:"RED",    bg:"#FF0000", text:"#ffffff" },
  { label:"GREEN",  bg:"#00FF00", text:"#003300" },
  { label:"BLUE",   bg:"#0000FF", text:"#aaaaff" },
  { label:"WHITE",  bg:"#FFFFFF", text:"#000000" },
  { label:"BLACK",  bg:"#000000", text:"#333333" },
];

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const NOISE_TYPES = ["white","pink","brown"];
const LS_KEYS = {
  note:      "ff_note",
  focusMs:   "ff_focus_ms",
  focusDate: "ff_focus_date",
  workMin:   "ff_work_min",
  breakMin:  "ff_break_min",
  installed: "ff_pwa_installed",
  themeMode: "ff_theme_mode",
};
const APP_URL = window.location.href;

/* ─────────────────────────────────────────────
   NOISE GENERATOR
───────────────────────────────────────────── */
function createNoiseNode(ctx, type) {
  const bufferSize = ctx.sampleRate * 4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  if (type === "white") {
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === "brown") {
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * w) / 1.02; last = data[i]; data[i] *= 3.5;
    }
  } else {
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      data[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
  }
  const src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true; return src;
}

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2,"0"); }
function fmt(sec) { return `${pad(Math.floor(sec/60))}:${pad(sec%60)}`; }
function todayStr() { return new Date().toISOString().slice(0,10); }
function loadFocusMs() {
  if (localStorage.getItem(LS_KEYS.focusDate) !== todayStr()) {
    localStorage.setItem(LS_KEYS.focusDate, todayStr());
    localStorage.setItem(LS_KEYS.focusMs, "0");
  }
  return parseInt(localStorage.getItem(LS_KEYS.focusMs)||"0",10);
}
function saveFocusMs(ms) { localStorage.setItem(LS_KEYS.focusMs, String(ms)); }

/* ─────────────────────────────────────────────
   FAVICON
───────────────────────────────────────────── */
function updateFavicon(secsLeft, phase, running) {
  try {
    const canvas = document.createElement("canvas"); canvas.width=32; canvas.height=32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle="#090909"; ctx.beginPath(); ctx.arc(16,16,15,0,Math.PI*2); ctx.fill();
    const totalSecs = phase==="work"?25*60:5*60;
    const pct = 1-secsLeft/totalSecs;
    ctx.strokeStyle=running?"#00FF41":"rgba(0,255,65,0.4)"; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(16,16,12,-Math.PI/2,-Math.PI/2+pct*Math.PI*2); ctx.stroke();
    const mins=Math.floor(secsLeft/60);
    ctx.fillStyle=running?"#00FF41":"rgba(0,255,65,0.6)";
    ctx.font=`bold ${mins>=10?11:9}px monospace`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(mins>=10?String(mins):fmt(secsLeft),16,16);
    ctx.fillStyle=phase==="break"?"#FFD700":"#00FF41";
    ctx.beginPath(); ctx.arc(26,6,3,0,Math.PI*2); ctx.fill();
    let link=document.querySelector("link[rel*='icon']");
    if (!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}
    link.href=canvas.toDataURL("image/png");
  } catch(e){}
}

/* ─────────────────────────────────────────────
   SERVICE WORKER
───────────────────────────────────────────── */
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  const code=`const C='ff-v1';self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/'])));self.skipWaiting();});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).catch(()=>new Response('<h1>Offline</h1>',{headers:{'Content-Type':'text/html'}}))));});`;
  try { navigator.serviceWorker.register(URL.createObjectURL(new Blob([code],{type:"application/javascript"}))).catch(()=>{}); } catch(e){}
}

/* ─────────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────────── */
function ThemeToggle({ themeMode, setThemeMode, T }) {
  return (
    <div style={{ display:"flex",alignItems:"center",border:`1px solid ${T.border}`,borderRadius:3,overflow:"hidden",height:26 }}>
      {[
        {id:"dark",   icon:<Moon size={10}/> },
        {id:"light",  icon:<Sun size={10}/> },
      ].map((opt,i,arr)=>(
        <button key={opt.id} onClick={()=>setThemeMode(opt.id)} title={opt.id.toUpperCase()}
          style={{ background:themeMode===opt.id?T.accentFaint:"transparent",border:"none",borderRight:i<arr.length-1?`1px solid ${T.border}`:"none",color:themeMode===opt.id?T.accent:T.textDim,padding:"0 8px",height:"100%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}>
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function Pomodoros() {

  /* ── THEME ── */
  const [themeMode, setThemeMode] = useState(()=>localStorage.getItem(LS_KEYS.themeMode)||"dark");
  const T = THEMES[themeMode]||THEMES.dark;
  useEffect(()=>{localStorage.setItem(LS_KEYS.themeMode,themeMode);},[themeMode]);

  /* ── TABS ── */
  const [tab, setTab] = useState("timer");

  /* ── COLOR WASH ── */
  const [washActive, setWashActive] = useState(false);
  const [washIdx, setWashIdx]       = useState(0);
  const [showWashMessage, setShowWashMessage] = useState(false);

  /* ── POMODORO ── */
  const [workMin, setWorkMin]   = useState(()=>parseInt(localStorage.getItem(LS_KEYS.workMin)||"25",10));
  const [breakMin, setBreakMin] = useState(()=>parseInt(localStorage.getItem(LS_KEYS.breakMin)||"5",10));
  const [phase, setPhase]       = useState("work");
  const [secsLeft, setSecsLeft] = useState(()=>parseInt(localStorage.getItem(LS_KEYS.workMin)||"25",10)*60);
  const [running, setRunning]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sessions, setSessions] = useState(0);
  const timerRef = useRef(null);
  const phaseRef = useRef("work"); phaseRef.current = phase;

  /* ── FOCUS ── */
  const [focusMs, setFocusMs] = useState(loadFocusMs);
  const focusStartRef = useRef(null);

  /* ── AUDIO ── */
  const [noiseType, setNoiseType] = useState("brown");
  const [noiseOn,   setNoiseOn]   = useState(false);
  const [volume,    setVolume]    = useState(0.4);
  const audioCtxRef=useRef(null); const gainRef=useRef(null); const noiseNodeRef=useRef(null);

  /* ── NOTE ── */
  const [note, setNote] = useState(()=>localStorage.getItem(LS_KEYS.note)||"");

  /* ── PINNED ── */
  const [pinnedMode, setPinnedMode] = useState(false);
  const [pipWindow, setPipWindow] = useState(null);

  /* ── PWA ── */
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(()=>localStorage.getItem(LS_KEYS.installed)==="true"||window.matchMedia("(display-mode: standalone)").matches);
  const [showProBadge, setShowProBadge] = useState(false);

  /* ── UI state ── */
  const [copied, setCopied]               = useState(false);
  const [showBookmarkTip, setShowBookmarkTip] = useState(false);
  const [isOffline, setIsOffline]         = useState(!navigator.onLine);
  const faviconRef = useRef(null);

  /* ── INIT ── */
  useEffect(()=>{
    registerSW();
    const on=()=>setIsOffline(false); const off=()=>setIsOffline(true);
    window.addEventListener("online",on); window.addEventListener("offline",off);
    return ()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off);};
  },[]);

  useEffect(()=>{
    const h=e=>{e.preventDefault();setDeferredPrompt(e);};
    window.addEventListener("beforeinstallprompt",h);
    window.addEventListener("appinstalled",()=>{setIsInstalled(true);setShowProBadge(true);localStorage.setItem(LS_KEYS.installed,"true");setTimeout(()=>setShowProBadge(false),6000);});
    return ()=>window.removeEventListener("beforeinstallprompt",h);
  },[]);

  /* ── FAVICON ── */
  useEffect(()=>{
    updateFavicon(secsLeft,phase,running);
    clearInterval(faviconRef.current);
    faviconRef.current=setInterval(()=>updateFavicon(secsLeft,phase,running),10000);
    return ()=>clearInterval(faviconRef.current);
  },[secsLeft,phase,running]);

  /* ── TAB TITLE ── */
  useEffect(()=>{
    const h=()=>{document.title=document.hidden&&running?`${fmt(secsLeft)}`:"Pomodoros — Deep Work Timer";};
    document.addEventListener("visibilitychange",h); return ()=>document.removeEventListener("visibilitychange",h);
  },[secsLeft,running]);
  useEffect(()=>{
    document.title=document.hidden&&running?`${fmt(secsLeft)}`:"Pomodoros — Deep Work Timer";
  },[secsLeft,running]);

  /* ── TIMER ── */
  const totalSecs = phase==="work"?workMin*60:breakMin*60;
  const pct = 1-secsLeft/totalSecs;
  const resetTimer = useCallback((np=phase,wm=workMin,bm=breakMin)=>{
    clearInterval(timerRef.current); setRunning(false); setSecsLeft(np==="work"?wm*60:bm*60);
  },[phase,workMin,breakMin]);

  useEffect(()=>{
    if (!running){clearInterval(timerRef.current);return;}
    if (phase==="work") focusStartRef.current=Date.now();
    timerRef.current=setInterval(()=>{
      setSecsLeft(s=>{
        if (s<=1){
          clearInterval(timerRef.current);
          if (phaseRef.current==="work"&&focusStartRef.current){
            const e2=Date.now()-focusStartRef.current;
            setFocusMs(p=>{const n=p+e2;saveFocusMs(n);return n;});
            focusStartRef.current=null; setSessions(n=>n+1);
          }
          const nx=phaseRef.current==="work"?"break":"work"; setPhase(nx); setRunning(false);
          return nx==="work"?workMin*60:breakMin*60;
        }
        return s-1;
      });
    },1000);
    return ()=>clearInterval(timerRef.current);
  },[running]);

  useEffect(()=>{
    if (!running&&phase==="work"&&focusStartRef.current){
      const e2=Date.now()-focusStartRef.current;
      setFocusMs(p=>{const n=p+e2;saveFocusMs(n);return n;}); focusStartRef.current=null;
    }
  },[running]);

  /* ── WASH MESSAGE ── */
  useEffect(()=>{
    if (washActive) {
      setShowWashMessage(true);
      const timer = setTimeout(() => setShowWashMessage(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [washActive]);

  useEffect(()=>{localStorage.setItem(LS_KEYS.workMin,workMin);},[workMin]);
  useEffect(()=>{localStorage.setItem(LS_KEYS.breakMin,breakMin);},[breakMin]);

  /* ── AUDIO ── */
  const stopNoise=useCallback(()=>{if(noiseNodeRef.current){try{noiseNodeRef.current.stop();}catch(_){}noiseNodeRef.current=null;}},[]);
  const startNoise=useCallback((type,vol)=>{
    stopNoise();
    if (!audioCtxRef.current||audioCtxRef.current.state==="closed") audioCtxRef.current=new(window.AudioContext||window.webkitAudioContext)();
    const ctx=audioCtxRef.current; if(ctx.state==="suspended")ctx.resume();
    if (!gainRef.current||gainRef.current.context!==ctx){gainRef.current=ctx.createGain();gainRef.current.connect(ctx.destination);}
    gainRef.current.gain.setValueAtTime(vol,ctx.currentTime);
    const node=createNoiseNode(ctx,type); node.connect(gainRef.current); node.start(); noiseNodeRef.current=node;
  },[stopNoise]);
  useEffect(()=>{if(gainRef.current)gainRef.current.gain.setValueAtTime(volume,audioCtxRef.current.currentTime);},[volume]);
  useEffect(()=>{if(noiseOn)startNoise(noiseType,volume);else stopNoise();},[noiseOn,noiseType]);

  /* ── NOTE AUTOSAVE ── */
  useEffect(()=>{const t=setTimeout(()=>localStorage.setItem(LS_KEYS.note,note),400);return ()=>clearTimeout(t);},[note]);

  /* ── KEYBOARD ── */
  useEffect(()=>{
    function onKey(e){
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      switch(e.key.toLowerCase()){
        case " ":e.preventDefault();setRunning(r=>!r);break;
        case "r":resetTimer();break;
        case "c":setWashActive(a=>{
          if(!a)return true;
          setWashIdx(i=>{const n=(i+1)%WASH_MODES.length;if(n===0){setWashActive(false);return 0;}return i;});
          return true;
        });break;
        case "m":setNoiseOn(n=>!n);break;
        case "p":setPinnedMode(v=>!v);break;
        case "1":setTab("timer");break;
        case "2":setTab("noise");break;
        case "3":setTab("note");break;
        case "4":setTab("stats");break;
        case "escape":setWashActive(false);setShowSettings(false);setShowBookmarkTip(false);break;
      }
    }
    window.addEventListener("keydown",onKey);return ()=>window.removeEventListener("keydown",onKey);
  },[resetTimer]);

  /* ── WAKE LOCK ── */
  useEffect(()=>{
    if (!('wakeLock' in navigator)) return;
    
    const requestWakeLock = async () => {
      try {
        if (running) {
          const wakeLock = await navigator.wakeLock.request('screen', {
            preventSleep: true
          });
          
          wakeLock.addEventListener('release', () => {
            // Lock released, allow sleep
          });
          
          return wakeLock;
        }
      } catch (err) {
        console.log('Wake Lock error:', err);
      }
    };
    
    const handleVisibilityChange = async () => {
      if (document.hidden && running) {
        await requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  },[running]);

  /* ── COPY URL ── */
  const copyURL=async()=>{
    try{await navigator.clipboard.writeText(APP_URL);}
    catch{const el=document.createElement("textarea");el.value=APP_URL;document.body.appendChild(el);el.select();document.execCommand("copy");document.body.removeChild(el);}
    setCopied(true);setTimeout(()=>setCopied(false),2500);
  };

  /* ── INSTALL PWA ── */
  const installPWA=async()=>{
    if(!deferredPrompt)return;
    deferredPrompt.prompt();
    const{outcome}=await deferredPrompt.userChoice;
    if(outcome==="accepted"){setIsInstalled(true);setShowProBadge(true);localStorage.setItem(LS_KEYS.installed,"true");setTimeout(()=>setShowProBadge(false),6000);}
    setDeferredPrompt(null);
  };

  /* ── DISPLAY ── */
  const focusHrs=Math.floor(focusMs/3600000);
  const focusMins=Math.floor((focusMs%3600000)/60000);
  const focusSecs2=Math.floor((focusMs%60000)/1000);
  const currentWash=WASH_MODES[washIdx];

  /* ── DERIVED STYLES ── */
  const S={
    timerRing:p=>({background:`conic-gradient(${T.accent} ${p*360}deg,${T.accentFaint} 0deg)`}),
    glow:{textShadow:T.glow},
    btnGlow:{boxShadow:`0 0 12px ${T.accentDim}`,background:T.btnBg,color:T.btnText},
    dimText:{color:T.textDim},
    faintText:{color:T.textFaint},
    borderTop:{borderTop:`1px solid ${T.border}`},
    font:{fontFamily:"'Share Tech Mono','Courier New',monospace"},
    scanlines:{backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,${T.scanOpacity}) 2px,rgba(0,0,0,${T.scanOpacity}) 4px)`,pointerEvents:"none"},
  };

  /* ═══════════════════════════════════════════
     PINNED MODE
  ═══════════════════════════════════════════ */
  if (pinnedMode) return (
    <div style={{ position:"fixed",bottom:20,right:20,zIndex:99999,background:T.bg,border:`1px solid ${running?T.accent:T.border}`,borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,fontFamily:"'Share Tech Mono',monospace",minWidth:180,boxShadow:`0 4px 20px rgba(0,0,0,0.4)`,transition:"border-color 0.3s" }}>
      <div style={{ width:6,height:6,borderRadius:"50%",background:running?T.accent:T.textDim,flexShrink:0 }}/>
      <span style={{ fontSize:8,letterSpacing:2,color:T.textDim,minWidth:32 }}>{phase==="work"?"WORK":"REST"}</span>
      <span style={{ fontSize:20,color:T.accent,letterSpacing:-1,minWidth:60 }}>{fmt(secsLeft)}</span>
      <button onClick={()=>setRunning(r=>!r)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",padding:2 }}>{running?<Pause size={13}/>:<Play size={13}/>}</button>
      <button onClick={()=>resetTimer()} style={{ background:"none",border:"none",color:T.textDim,cursor:"pointer",padding:2 }}><RotateCcw size={11}/></button>
      <button onClick={()=>setPinnedMode(false)} style={{ background:"none",border:"none",color:T.textDim,cursor:"pointer",padding:2,marginLeft:"auto" }}><Maximize2 size={11}/></button>
    </div>
  );

  /* ═══════════════════════════════════════════
     FULL UI
  ═══════════════════════════════════════════ */
  return (
    <div style={{ background:T.bg,width:"100vw",height:"100vh",color:T.text,...S.font,transition:"background 0.25s,color 0.25s",overflow:"hidden",position:"fixed",top:0,left:0 }}>

      {/* Scanlines */}
      <div style={{ position:"fixed",inset:0,zIndex:9998,...S.scanlines }}/>

      {/* Pro badge */}
      {showProBadge&&(
        <div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:99999,background:T.bg,border:`1px solid ${T.accent}`,borderRadius:4,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,boxShadow:`0 0 30px ${T.accentFaint}`,animation:"slideDown 0.3s ease" }}>
          <Shield size={14} color={T.accent}/>
          <div>
            <div style={{ fontSize:11,letterSpacing:3,color:T.accent }}>PRO USER ACTIVATED</div>
            <div style={{ fontSize:9,color:T.textDim,letterSpacing:1,marginTop:2 }}>Pomodoros installed · Works offline</div>
          </div>
        </div>
      )}

      {/* Offline banner */}
      {isOffline&&(
        <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:9997,background:"rgba(255,200,0,0.08)",borderBottom:"1px solid rgba(255,200,0,0.25)",padding:"6px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:9,letterSpacing:3,color:"#FFD700" }}>
          <WifiOff size={10}/> OFFLINE MODE · ALL FEATURES AVAILABLE
        </div>
      )}

/* ── DERIVED STYLES ── */
const S={
  timerRing:p=>({background:`conic-gradient(${T.accent} ${p*360}deg,${T.accentFaint} 0deg)`}),
  glow:{textShadow:T.glow},
  btnGlow:{boxShadow:`0 0 12px ${T.accentDim}`,background:T.btnBg,color:T.btnText},
  dimText:{color:T.textDim},
  faintText:{color:T.textFaint},
  borderTop:{borderTop:`1px solid ${T.border}`},
  font:{fontFamily:"'Share Tech Mono','Courier New',monospace"},
  scanlines:{backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,${T.scanOpacity}) 2px,rgba(0,0,0,${T.scanOpacity}) 4px)`,pointerEvents:"none"},
};

/* ═══════════════════════════════════════════
   PINNED MODE
  ═══════════════════════════════════════════ */
if (pinnedMode) return (
  <div style={{ position:"fixed",bottom:20,right:20,zIndex:99999,background:T.bg,border:`1px solid ${running?T.accent:T.border}`,borderRadius:6,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,fontFamily:"'Share Tech Mono',monospace",minWidth:180,boxShadow:`0 4px 20px rgba(0,0,0,0.4)`,transition:"border-color 0.3s" }}>
    <div style={{ width:6,height:6,borderRadius:"50%",background:running?T.accent:T.textDim,flexShrink:0 }}/>
    <span style={{ fontSize:8,letterSpacing:2,color:T.textDim,minWidth:32 }}>{phase==="work"?"WORK":"REST"}</span>
    <span style={{ fontSize:20,color:T.accent,letterSpacing:-1,minWidth:60 }}>{fmt(secsLeft)}</span>
    <button onClick={()=>setRunning(r=>!r)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer",padding:2 }}>{running?<Pause size={13}/>:<Play size={13}/>}</button>
    <button onClick={()=>resetTimer()} style={{ background:"none",border:"none",color:T.textDim,cursor:"pointer",padding:2 }}><RotateCcw size={11}/></button>
    <button onClick={()=>setPinnedMode(false)} style={{ background:"none",border:"none",color:T.textDim,cursor:"pointer",padding:2,marginLeft:"auto" }}><Maximize2 size={11}/></button>
  </div>
);

/* ═══════════════════════════════════════════
   FULL UI
  ═══════════════════════════════════════════ */
return (
  <div style={{ background:T.bg,width:"100vw",height:"100vh",color:T.text,...S.font,transition:"background 0.25s,color 0.25s",overflow:"hidden",position:"fixed",top:0,left:0 }}>

    {/* Scanlines */}
    <div style={{ position:"fixed",inset:0,zIndex:9998,...S.scanlines }}/>

    {/* Pro badge */}
    {showProBadge&&(
      <div style={{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:99999,background:T.bg,border:`1px solid ${T.accent}`,borderRadius:4,padding:"12px 20px",display:"flex",alignItems:"center",gap:10,boxShadow:`0 0 30px ${T.accentFaint}`,animation:"slideDown 0.3s ease" }}>
        <Shield size={14} color={T.accent}/>
        <div>
          <div style={{ fontSize:11,letterSpacing:3,color:T.accent }}>PRO USER ACTIVATED</div>
          <div style={{ fontSize:9,color:T.textDim,letterSpacing:1,marginTop:2 }}>Pomodoros installed · Works offline</div>
        </div>
      </div>
    )}

    {/* Offline banner */}
    {isOffline&&(
      <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:9997,background:"rgba(255,200,0,0.08)",borderBottom:"1px solid rgba(255,200,0,0.25)",padding:"6px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontSize:9,letterSpacing:3,color:"#FFD700" }}>
        <WifiOff size={10}/> OFFLINE MODE · ALL FEATURES AVAILABLE
      </div>
    )}

    {/* ════ COLOR WASH OVERLAY ════ */}
    {washActive&&(
      <div style={{ position:"fixed",top:0,left:0,width:"100vw",height:"100vh",zIndex:9999,background:currentWash.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:0,transition:"background 0.25s ease" }}>
        {/* Temporary ESC message */}
        {showWashMessage && (
          <div style={{ position:"absolute",top:20,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.8)",color:currentWash.text,padding:"8px 16px",borderRadius:4,fontSize:12,letterSpacing:1,fontFamily:"'Share Tech Mono',monospace",opacity:showWashMessage?1:0,transition:"opacity 0.5s ease" }}>
            Press ESC to exit
          </div>
        )}
        <button onClick={()=>{
          if (pipWindow) {
            pipWindow.close();
            setPipWindow(null);
          } else {
            // Simple PiP implementation
            const pipWindow = window.open('', 'width=300,height=150,left=100,top=100');
            pipWindow.document.write(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Pomodoros Timer</title>
                  <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                      background: ${T.bg}; 
                      color: ${T.accent}; 
                      font-family: 'Share Tech Mono', monospace;
                      font-weight: bold;
                      display: flex; 
                      align-items: center; 
                      justify-content: center; 
                      height: 100vh; 
                      overflow: hidden;
                      border: 2px solid ${T.accent};
                      border-radius: 8px;
                    }
                    .timer {
                      font-size: 24px;
                      letter-spacing: 2px;
                    }
                  </style>
                </head>
                <body>
                  <div class="timer">${fmt(secsLeft)}</div>
                  <script>
                    setInterval(() => {
                      const timer = document.querySelector('.timer');
                      if (timer) {
                        timer.textContent = fmt(secsLeft);
                      }
                    }, 1000);
                  </script>
                </body>
              </html>
            `);
            setPipWindow(pipWindow);
          }
        }} style={{ background:"none",border:`1px solid ${T.border}`,color:T.accent,padding:"5px 8px",borderRadius:2,cursor:"pointer",fontSize:9,letterSpacing:2,display:"flex",alignItems:"center",gap:5 }}>
          <Pin size={11}/> {pipWindow ? 'UNPIN' : 'PIN'}
        </button>
        <span style={{ color:currentWash.text,fontSize:15,letterSpacing:6,opacity:0.65,marginBottom:4,fontFamily:"'Share Tech Mono',monospace" }}>{currentWash.label}</span>

        {/* Swatches */}
        <div style={{ display:"flex",flexWrap:"wrap",gap:12,justifyContent:"center",maxWidth:"min(400px,80vw)",padding:"0 20px" }}>
          {WASH_MODES.map((w,gi)=>(
            <button key={w.label} onClick={()=>{
              const newWindow = window.open('', '_blank');
              newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>${w.label} - Pomodoros</title>
                    <style>
                      * { margin: 0; padding: 0; box-sizing: border-box; }
                      body { 
                        background: ${w.bg}; 
                        color: ${w.text}; 
                        font-family: 'Share Tech Mono', monospace;
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        height: 100vh; 
                        overflow: hidden;
                        cursor: none;
                      }
                      .info {
                        position: absolute;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        background: rgba(0,0,0,0.8);
                        color: ${w.text};
                        padding: 8px 16px;
                        border-radius: 4px;
                        font-size: 12px;
                        letter-spacing: 1px;
                        opacity: 1;
                        transition: opacity 0.5s ease;
                        z-index: 1000;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="info">Press ESC to exit</div>
                    <script>
                      // Request fullscreen immediately
                      const elem = document.documentElement;
                      if (elem.requestFullscreen) {
                        elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
                      } else if (elem.webkitRequestFullscreen) {
                        elem.webkitRequestFullscreen().catch(err => console.log('Fullscreen error:', err));
                      } else if (elem.msRequestFullscreen) {
                        elem.msRequestFullscreen().catch(err => console.log('Fullscreen error:', err));
                      }
                      
                      // Handle ESC key to exit fullscreen and close tab
                      document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') {
                          // Exit fullscreen first
                          if (document.exitFullscreen) {
                            document.exitFullscreen();
                          } else if (document.webkitExitFullscreen) {
                            document.webkitExitFullscreen();
                          } else if (document.msExitFullscreen) {
                            document.msExitFullscreen();
                          }
                          // Then close the window
                          setTimeout(() => window.close(), 100);
                        }
                      });
                      
                      // Fade out info message
                      setTimeout(() => {
                        const info = document.querySelector('.info');
                        if (info) info.style.opacity = '0';
                      }, 3000);
                    </script>
                  </body>
                </html>
              `);
              newWindow.document.close();
              
              // Request fullscreen after document is ready
              newWindow.addEventListener('load', () => {
                const elem = newWindow.document.documentElement;
                if (elem.requestFullscreen) {
                  elem.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
                } else if (elem.webkitRequestFullscreen) {
                  elem.webkitRequestFullscreen().catch(err => console.log('Fullscreen error:', err));
                } else if (elem.msRequestFullscreen) {
                  elem.msRequestFullscreen().catch(err => console.log('Fullscreen error:', err));
                }
              });
            }}
              style={{ width:"clamp(80px,15vw,100px)",height:"clamp(60px,12vw,80px)",background:w.bg,border:gi===washIdx?`3px solid ${w.text}`:`2px solid ${w.text}33`,borderRadius:5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 0 5px",boxShadow:gi===washIdx?`0 0 18px ${w.text}44`:undefined,transition:"all 0.15s",outline:"none" }}>
                <span style={{ fontSize:"clamp(8px,2vw,10px)",color:w.text,letterSpacing:1,opacity:0.65,fontFamily:"'Share Tech Mono',monospace" }}>{w.label}</span>
              </button>
          ))}
                });
              }}
                style={{ width:"clamp(80px,15vw,100px)",height:"clamp(60px,12vw,80px)",background:w.bg,border:gi===washIdx?`3px solid ${w.text}`:`2px solid ${w.text}33`,borderRadius:5,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 0 5px",boxShadow:gi===washIdx?`0 0 18px ${w.text}44`:undefined,transition:"all 0.15s",outline:"none" }}>
                  <span style={{ fontSize:"clamp(8px,2vw,10px)",color:w.text,letterSpacing:1,opacity:0.65,fontFamily:"'Share Tech Mono',monospace" }}>{w.label}</span>
                </button>
            ))}
          </div>
        </div>
      )}

      {/* App shell */}
      <div style={{ width:"100vw",height:"100vh",margin:0,padding:isOffline?"56px 20px 20px":"20px",display:"grid",gridTemplateColumns:"1fr",gridTemplateRows:"auto 1fr auto",overflow:"hidden" }}>

        {/* Header */}
        <header style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:"12px" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:8,height:8,borderRadius:"50%",background:T.accent,boxShadow:`0 0 10px ${T.accent}`,animation:"pulse 2s ease-in-out infinite" }}/>
            <span style={{ fontFamily:"'Syne','Share Tech Mono',monospace",fontWeight:800,fontSize:18,color:T.accent,letterSpacing:-0.5 }}>Pomodoros</span>
            {isInstalled&&(
              <div style={{ display:"flex",alignItems:"center",gap:4,padding:"2px 6px",border:`1px solid ${T.border}`,borderRadius:2,background:T.accentFaint }}>
                <Shield size={8} color={T.accent}/><span style={{ fontSize:7,letterSpacing:2,color:T.accent }}>PRO</span>
              </div>
            )}
          </div>
          <div style={{ display:"flex",gap:6,alignItems:"center" }}>
            {/* Theme toggle — top right */}
            <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} T={T}/>
            </button>
            <button onClick={()=>setWashActive(true)} title="Color Wash [C]"
              style={{ background:"none",border:`1px solid ${T.border}`,color:T.accent,padding:"5px 8px",borderRadius:2,cursor:"pointer",display:"flex",alignItems:"center",gap:5,fontSize:9,letterSpacing:2 }}>
              <Monitor size={11}/> WASH
            </button>
        </div>
      </header>
          </div>
        </header>

        {/* Nav */}
        <nav style={{ display:"flex",marginBottom:24,borderBottom:`1px solid ${T.border}`,flexWrap:"wrap",gap:"2px" }}>
          {[{id:"timer",label:"TIMER",icon:<Zap size={11}/>},{id:"noise",label:"NOISE",icon:<Volume2 size={11}/>},{id:"note",label:"NOTE",icon:<FileText size={11}/>},{id:"stats",label:"STATS",icon:<BarChart2 size={11}/>}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:"1 1 auto",minWidth:"80px",background:"none",border:"none",borderBottom:tab===t.id?`2px solid ${T.accent}`:"2px solid transparent",color:tab===t.id?T.accent:T.textDim,padding:"8px 4px 10px",cursor:"pointer",fontSize:9,letterSpacing:3,display:"flex",alignItems:"center",justifyContent:"center",gap:5,transition:"all 0.2s",marginBottom:-1 }}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        {/* ── TIMER TAB ── */}
        {tab==="timer"&&(
          <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:32 }}>
            <div style={{ display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center" }}>
              {["work","break"].map(p=>(
                <button key={p} onClick={()=>{setPhase(p);resetTimer(p);}}
                  style={{ background:"none",border:`1px solid ${phase===p?T.accent:T.border}`,color:phase===p?T.accent:T.textDim,padding:"4px 14px",borderRadius:2,cursor:"pointer",fontSize:9,letterSpacing:3,transition:"all 0.2s" }}>
                  {p==="work"?"WORK":"BREAK"}
                </button>
              ))}
            </div>
            <div style={{ position:"relative",width:"clamp(280px,50vw,320px)",height:"clamp(280px,50vw,320px)" }}>
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",...S.timerRing(pct),padding:8,transition:"background 0.5s linear" }}>
                <div style={{ background:T.bg,borderRadius:"50%",width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4 }}>
                  <span style={{ fontSize:"clamp(48px,9vw,72px)",fontWeight:"bold",color:T.accent,letterSpacing:-2,...S.glow }}>{fmt(secsLeft)}</span>
                  <span style={{ fontSize:9,letterSpacing:4,...S.dimText }}>{phase==="work"?"FOCUS":"REST"}</span>
                </div>
              </div>
            </div>
            <div style={{ display:"flex",gap:12,alignItems:"center" }}>
              <button onClick={()=>resetTimer()} style={{ background:"none",border:`1px solid ${T.border}`,color:T.accent,width:40,height:40,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><RotateCcw size={14}/></button>
              <button onClick={()=>setRunning(r=>!r)} style={{ ...S.btnGlow,width:56,height:56,borderRadius:"50%",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                {running?<Pause size={20}/>:<Play size={20} style={{marginLeft:2}}/>}
              </button>
              <button onClick={()=>setShowSettings(s=>!s)} style={{ background:"none",border:`1px solid ${T.border}`,color:T.accent,width:40,height:40,borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><Settings size={14}/></button>
            </div>
            <span style={{ fontSize:10,...S.dimText,letterSpacing:2 }}>[SPACE] TOGGLE · [R] RESET · [P] PIN</span>
            {showSettings&&(
              <div style={{ width:"100%",border:`1px solid ${T.border}`,borderRadius:4,padding:20,background:T.accentFaint }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
                  <span style={{ fontSize:10,letterSpacing:4 }}>SETTINGS</span>
                  <button onClick={()=>setShowSettings(false)} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer" }}><X size={14}/></button>
                </div>
                {[{label:"WORK",val:workMin,set:v=>{setWorkMin(v);if(phase==="work")setSecsLeft(v*60);},min:1,max:90},{label:"BREAK",val:breakMin,set:v=>{setBreakMin(v);if(phase==="break")setSecsLeft(v*60);},min:1,max:30}].map(row=>(
                  <div key={row.label} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
                    <span style={{ fontSize:10,letterSpacing:3,...S.dimText }}>{row.label}</span>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      <button onClick={()=>row.set(Math.max(row.min,row.val-1))} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer" }}><ChevronDown size={14}/></button>
                      <span style={{ fontSize:16,minWidth:36,textAlign:"center" }}>{row.val}<span style={{ fontSize:9,...S.dimText }}> MIN</span></span>
                      <button onClick={()=>row.set(Math.min(row.max,row.val+1))} style={{ background:"none",border:"none",color:T.accent,cursor:"pointer" }}><ChevronUp size={14}/></button>
                    </div>
                  </div>
                ))}
                <div style={{ marginTop:16,paddingTop:16,borderTop:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:9,letterSpacing:3,...S.dimText,marginBottom:10 }}>INSTALL & SHARE</div>
                  {!isInstalled&&deferredPrompt&&(
                    <button onClick={installPWA} style={{ width:"100%",marginBottom:8,background:T.accentFaint,border:`1px solid ${T.accent}`,color:T.accent,padding:"10px 14px",borderRadius:3,cursor:"pointer",fontSize:10,letterSpacing:3,display:"flex",alignItems:"center",gap:8 }}>
                      <Download size={12}/> INSTALL DESKTOP APP <span style={{ marginLeft:"auto",fontSize:8,opacity:0.5 }}>PWA</span>
                    </button>
                  )}
                  {isInstalled&&(
                    <div style={{ display:"flex",alignItems:"center",gap:8,padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:3 }}>
                      <Shield size={11} color={T.accent}/><span style={{ fontSize:9,letterSpacing:2,color:T.accent }}>INSTALLED · OFFLINE READY</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── NOISE TAB ── */}
        {tab==="noise"&&(
          <div style={{ flex:1,display:"flex",flexDirection:"column",gap:24 }}>
            <p style={{ fontSize:10,letterSpacing:3,...S.dimText,margin:0 }}>WEB AUDIO API · NO EXTERNAL FILES</p>
            <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
              {NOISE_TYPES.map(t=>(
                <button key={t} onClick={()=>{setNoiseType(t);if(!noiseOn)setNoiseOn(true);}}
                  style={{ background:noiseType===t&&noiseOn?T.accentFaint:"none",border:`1px solid ${noiseType===t?T.accent:T.border}`,color:noiseType===t?T.accent:T.textDim,padding:"16px 20px",borderRadius:3,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all 0.2s" }}>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:11,letterSpacing:4,marginBottom:4 }}>{t.toUpperCase()} NOISE</div>
                    <div style={{ fontSize:9,opacity:0.5 }}>{t==="white"?"Flat spectrum · All frequencies equal":t==="pink"?"−3dB/octave · Natural & soothing":"−6dB/octave · Deep & low rumble"}</div>
                  </div>
                  {noiseType===t&&noiseOn&&(
                    <div style={{ display:"flex",gap:2,alignItems:"flex-end",height:20 }}>
                      {[4,8,6,12,7,10,5].map((h,i)=>(<div key={i} style={{ width:3,height:h,background:T.accent,borderRadius:1,animation:`eq ${0.4+i*0.1}s ease-in-out infinite alternate` }}/>))}
                    </div>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between" }}>
                <span style={{ fontSize:10,letterSpacing:3,...S.dimText }}>VOLUME</span>
                <span style={{ fontSize:10 }}>{Math.round(volume*100)}%</span>
              </div>
              <div style={{ position:"relative",height:2,background:T.accentFaint,borderRadius:1 }}>
                <div style={{ position:"absolute",left:0,top:0,height:"100%",width:`${volume*100}%`,background:T.accent,borderRadius:1 }}/>
                <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e=>setVolume(parseFloat(e.target.value))} style={{ position:"absolute",inset:0,width:"100%",opacity:0,cursor:"pointer",height:20,top:-9 }}/>
              </div>
            </div>
            <button onClick={()=>setNoiseOn(n=>!n)}
              style={{ ...(noiseOn?S.btnGlow:{}),border:`1px solid ${noiseOn?T.accent:T.border}`,background:noiseOn?T.btnBg:"none",color:noiseOn?T.btnText:T.accent,padding:"14px",borderRadius:3,cursor:"pointer",fontSize:11,letterSpacing:4,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s" }}>
              {noiseOn?<Volume2 size={14}/>:<VolumeX size={14}/>}{noiseOn?"STOP NOISE":"START NOISE"}
            </button>
            <span style={{ fontSize:10,...S.dimText,letterSpacing:2,textAlign:"center" }}>[M] TO TOGGLE</span>
          </div>
        )}

        {/* ── NOTE TAB ── */}
        {tab==="note"&&(
          <div style={{ flex:1,display:"flex",flexDirection:"column",gap:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <span style={{ fontSize:9,letterSpacing:3,...S.dimText }}>DISTRACTION-FREE · AUTOSAVED</span>
              <span style={{ fontSize:9,...S.dimText }}>{note.length} CHARS</span>
            </div>
            <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Begin typing. Your thoughts are saved automatically..."
              style={{ flex:1,minHeight:360,background:T.accentFaint,border:`1px solid ${T.border}`,borderRadius:3,color:T.text,padding:20,fontSize:14,lineHeight:1.8,fontFamily:"'Share Tech Mono','Courier New',monospace",resize:"none",outline:"none",caretColor:T.accent }}/>
            <div style={{ display:"flex",gap:8 }}>
              <button onClick={()=>{if(window.confirm("Clear all notes?"))setNote("");}} style={{ background:"none",border:`1px solid ${T.border}`,color:T.textDim,padding:"6px 12px",borderRadius:2,cursor:"pointer",fontSize:9,letterSpacing:2 }}>CLEAR</button>
              <button onClick={()=>{const b=new Blob([note],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`focusflow-${todayStr()}.txt`;a.click();}} style={{ background:"none",border:`1px solid ${T.border}`,color:T.textDim,padding:"6px 12px",borderRadius:2,cursor:"pointer",fontSize:9,letterSpacing:2 }}>EXPORT</button>
            </div>
          </div>
        )}

        {/* ── STATS TAB ── */}
        {tab==="stats"&&(
          <div style={{ flex:1,display:"flex",flexDirection:"column",gap:16 }}>
            <span style={{ fontSize:9,letterSpacing:3,...S.dimText }}>TODAY'S SESSION</span>
            <div style={{ border:`1px solid ${T.border}`,borderRadius:3,padding:28,textAlign:"center",background:T.accentFaint }}>
              <div style={{ fontSize:10,letterSpacing:4,...S.dimText,marginBottom:12 }}>TIME FOCUSED</div>
              <div style={{ fontSize:48,...S.glow,letterSpacing:-2 }}>{pad(focusHrs)}:{pad(focusMins)}:{pad(focusSecs2)}</div>
              <div style={{ fontSize:9,letterSpacing:3,...S.dimText,marginTop:8 }}>HH:MM:SS</div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
              {[{label:"SESSIONS",value:sessions},{label:"WORK INTERVAL",value:`${workMin}m`},{label:"BREAK INTERVAL",value:`${breakMin}m`},{label:"NOISE",value:noiseOn?noiseType.toUpperCase():"OFF"}].map(s=>(
                <div key={s.label} style={{ border:`1px solid ${T.border}`,borderRadius:3,padding:16 }}>
                  <div style={{ fontSize:8,letterSpacing:3,...S.dimText,marginBottom:8 }}>{s.label}</div>
                  <div style={{ fontSize:22 }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:8 }}>
                <span style={{ fontSize:9,letterSpacing:3,...S.dimText }}>DAILY GOAL</span>
                <span style={{ fontSize:9,...S.dimText }}>{Math.min(100,Math.round(focusMs/288000))}% OF 8H</span>
              </div>
              <div style={{ height:3,background:T.accentFaint,borderRadius:2 }}>
                <div style={{ height:"100%",width:`${Math.min(100,focusMs/288000)}%`,background:T.accent,borderRadius:2,transition:"width 0.5s ease" }}/>
              </div>
            </div>
            <button onClick={()=>{saveFocusMs(0);setFocusMs(0);setSessions(0);}} style={{ background:"none",border:`1px solid ${T.border}`,color:T.textDim,padding:"8px",borderRadius:2,cursor:"pointer",fontSize:9,letterSpacing:3 }}>RESET TODAY</button>
          </div>
        )}

        {/* ── PRO TOOLS STRIP ── */}
        <div style={{ marginTop:24,paddingTop:16,...S.borderTop }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
            <span style={{ fontSize:8,letterSpacing:3,...S.faintText,marginRight:4 }}>TOOLS</span>
            {!isInstalled&&deferredPrompt?(
              <button onClick={installPWA} style={{ background:T.accentFaint,border:`1px solid ${T.accent}`,color:T.accent,padding:"5px 10px",borderRadius:2,cursor:"pointer",fontSize:9,letterSpacing:2,display:"flex",alignItems:"center",gap:5,animation:"breathe 3s ease-in-out infinite" }}>
                <Download size={10}/> INSTALL APP
              </button>
            ) : isInstalled ? (
                    <button onClick={()=>setShowBookmarkTip(false)} style={{ position:"absolute",top:4,right:6,background:"none",border:"none",color:T.textDim,cursor:"pointer",fontSize:10 }}>×</button>
                  </div>
                )}
              </div>
            )}
            <button onClick={copyURL} style={{ background:copied?T.accentFaint:"none",border:`1px solid ${copied?T.accent:T.border}`,color:copied?T.accent:T.textDim,padding:"5px 10px",borderRadius:2,cursor:"pointer",fontSize:9,letterSpacing:2,display:"flex",alignItems:"center",gap:5,transition:"all 0.2s" }}>
              {copied?<Check size={10}/>:<Copy size={10}/>}{copied?"COPIED!":"COPY URL"}
            </button>
          </div>
          <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginTop:12 }}>
            {[["1-4","TABS"],["SPC","TIMER"],["R","RESET"],["C","WASH"],["M","NOISE"],["P","PIN"],["ESC","CLOSE"]].map(([k,v])=>(
              <div key={k} style={{ display:"flex",gap:5,alignItems:"center" }}>
                <span style={{ border:`1px solid ${T.borderBright}`,borderRadius:2,padding:"1px 5px",fontSize:8,color:T.accent }}>{k}</span>
                <span style={{ fontSize:8,letterSpacing:1,...S.dimText }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════ HIDDEN SEO CONTENT ════════════ */}
      <section aria-hidden="true" style={{ position:"absolute",left:"-9999px",top:"auto",width:1,height:1,overflow:"hidden" }}>
        <h1>Pomodoros — Free Pomodoro Timer, Ambient Noise Generator, Monitor Dead Pixel Test 2025 2026</h1>

        <h2>Pomodoro Timer — Keywords</h2>
        <p>free pomodoro timer online pomodoro technique 25 minutes timer focus timer work timer countdown timer productivity timer pomodoro clock pomodoro app no signup no account pomodoro timer free pomodoro website custom pomodoro intervals 50 minute timer 90 minute deep work timer tomato timer pomodairo focusmate alternative forest app alternative study timer exam timer school timer university timer college study session pomodoro with breaks adjustable pomodoro flowtime technique time blocking timer 52 17 rule timer website pomodoro no ads pomodoro no sign up browser timer no download best pomodoro timer 2025 best pomodoro timer 2026 pomofocus alternative marinara timer alternative tomato timer alternative be focused alternative focus keeper alternative flow time technique timer</p>

        <h2>White Noise Brown Noise Pink Noise — Keywords</h2>
        <p>white noise generator online free white noise machine alternative brown noise generator free pink noise generator online noise for focus noise for studying noise for sleep noise for ADHD noise for anxiety office background noise background noise for work coffee shop ambient sound rain sound generator thunder background noise deep focus sound ambient sound productivity lofi alternative binaural beats alternative nature sounds focus music alternative calming background sound work from home noise open office noise masking noise cancellation alternative noise machine free browser noise generator no download noise app noise website brown noise ADHD focus brown noise study red noise generator brownian noise generator relaxing noise sound therapy noise</p>

        <h2>Monitor Test Dead Pixel Check — Keywords</h2>
        <p>monitor dead pixel test online free screen test tool pixel checker LCD test OLED test dead pixel finder display test tool backlight bleed test monitor uniformity test monitor color accuracy test all white screen test all black screen test solid color screen full screen color test monitor calibration tool online screen repair test monitor quality check 4K monitor test gaming monitor test IPS glow test OLED screen test AMOLED test burn-in test black uniformity test monitor brightness test display dead pixel fix screen uniformity checker monitor review tool display calibration free color wash display diagnostic monitor health check TFT LCD LED monitor test CRT monitor test</p>

        <h2>Productivity Deep Work — Keywords</h2>
        <p>deep work timer Cal Newport deep work book focus app distraction free browser distraction free focus minimalist productivity tool time tracking app daily focus tracker focus time logger productivity no ads time management app flow state timer ultradian rhythm timer cognitive load reduction procrastination cure focus booster mental clarity tool study aid students work from home productivity remote work timer developer focus tool programmer focus timer writer focus timer creative focus tool ADHD productivity tool hyperfocus timer neurodivergent productivity executive function timer body double timer</p>

        <h2>PWA Offline App — Keywords</h2>
        <p>offline pomodoro timer progressive web app PWA timer install timer app desktop app no internet timer works offline no backend privacy first no tracking no analytics lightweight fast loading browser app no subscription free forever local storage timer open source timer minimal web app single page application SPA productivity tool zero ads no cookies tracker free tool productivity 2025 2026</p>

        <h2>Enhanced Monitor Testing — Keywords</h2>
        <p>monitor color test screen color calibration display color accuracy test RGB color test CMYK color test color gamut test sRGB test Adobe RGB test DCI-P3 test HDR monitor test color banding test color gradient test color uniformity test pixel response time test ghosting test motion blur test refresh rate test backlight bleed test IPS glow test VA panel test TN panel test OLED burn-in test AMOLED pixel test QLED monitor test mini-LED test local dimming test HDR brightness test contrast ratio test black level test white balance test color temperature test gamma test color space test wide color gamut test 10-bit color test 8-bit color test dithering test pixel substructure test subpixel layout test pentile matrix test RGB stripe test</p>

        <h2>Advanced Display Testing — Keywords</h2>
        <p>display calibration tool screen calibration monitor calibration professional calibration colorimeter alternative spectrophotometer alternative display profiling color management ICC profile creation monitor review tool display benchmark display performance test screen quality assessment visual display test display diagnostics panel technology test LCD vs OLED vs QLED vs MicroLED vs E-ink display comparison display manufacturing test quality control display uniformity checker brightness uniformity test color uniformity test pixel defect detection dead pixel stuck pixel hot pixel subpixel defect backlight bleeding clouding flashlight effect dirty screen effect DSE test panel lottery OLED degradation test burn-in prevention pixel refresh cycle panel aging test display longevity test</p>

        <h2>Productivity & Focus Tools — Keywords</h2>
        <p>productivity app focus app deep work tool time management app pomodoro technique timer study timer work timer break timer focus session timer productivity tracker time tracking app distraction blocker website blocker app focus music study music ambient sounds white noise brown noise pink noise nature sounds rain sounds ocean sounds forest sounds thunderstorm sounds fireplace sounds coffee shop sounds library sounds office background sounds study environment focus environment ADHD tools anxiety tools stress relief tools sleep tools meditation tools mindfulness tools breathing exercises relaxation techniques concentration aids cognitive enhancement memory improvement learning tools study techniques exam preparation academic tools professional tools business tools remote work tools work from home productivity home office setup digital minimalism simple living mindfulness productivity work-life balance time blocking time boxing task management project management workflow automation productivity hacks life hacks personal development self-improvement goal setting habit formation habit tracking daily routine morning routine evening routine productivity systems productivity methodology GTD getting things done Eisenhower matrix Pareto principle 80/20 rule time audit time analysis productivity metrics performance metrics KPI dashboard analytics reporting data visualization productivity dashboard focus dashboard time dashboard work dashboard personal dashboard</p>

        <h2>FAQ: Pomodoros Enhanced</h2>
        <h3>What is Pomodoros Enhanced?</h3>
        <p>Pomodoros Enhanced is a comprehensive free productivity tool featuring: Pomodoro timer with custom intervals, white/pink/brown noise generator via Web Audio API, advanced monitor testing with 24+ color presets including RGB spectrum and professional display testing colors, distraction-free autosaving notepad, daily focus time tracker, and a Progressive Web App that works fully offline. Enhanced with expanded wash modes for comprehensive display calibration and professional-grade monitor testing capabilities.</p>

        <h3>How do I test my monitor with enhanced wash modes?</h3>
        <p>Press C or click WASH. Choose from 24+ calibrated presets across three groups. Brightness group: Pure White, Warm White, Cool White, Pure Black, Near Black, 25% Gray, 75% Gray for brightness and contrast testing. Primary group: Pure Red, Green, Blue, Yellow, Cyan, Magenta for complete RGB spectrum testing and subpixel analysis. Advanced group: Navy, Amber, Orange, Purple, Teal, Lime, Pink, Brown, Olive, Maroon for professional display calibration, color accuracy testing, and panel defect detection. Each color is specifically chosen to reveal different types of display issues and calibration problems.</p>

        <h3>What display issues can the enhanced wash modes detect?</h3>
        <p>The enhanced wash modes can detect: dead pixels (all colors), stuck pixels (specific colors), subpixel defects (RGB colors), backlight bleeding (black screens), clouding and flashlight effect (gray screens), color banding (gradients), color accuracy issues (primary colors), color temperature problems (warm/cool whites), contrast ratio issues (black/white), uniformity problems (solid colors), panel technology differences (color response), OLED burn-in (solid colors), IPS glow (dark screens), VA smearing (motion), TN color shifting (viewing angles), HDR capability testing (bright colors), wide gamut testing (vibrant colors), and professional calibration verification.</p>

        <h3>How does the theme toggle work?</h3>
        <p>The theme toggle in the top-right corner offers three modes: Dark (black background with green accents - default), Light (light background with dark green accents), and System (automatically follows your OS preference). Toggle between themes using the Moon/Laptop/Sun icons. Your preference is saved locally and persists across sessions.</p>

        <h3>Why are there so many wash colors?</h3>
        <p>Different colors reveal different display issues. Primary colors (RGB) test subpixel functionality. Secondary colors (CMY) test color mixing. Grayscale tests uniformity and contrast. Warm/cool whites test color temperature. Dark colors test backlight bleeding. Bright colors test HDR capability. Professional colors test color accuracy and gamut coverage. This comprehensive approach ensures thorough display testing for professionals and enthusiasts.</p>

        <h3>Is Pomodoros Enhanced really free and does it track me?</h3>
        <p>Pomodoros Enhanced is 100% free with no subscription, no account, no advertisements, and zero analytics or tracking. All data — notes, settings, focus time, theme preferences — is stored locally on your device in localStorage and never leaves your browser. No data is sent to any servers.</p>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Syne:wght@400;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.5;} }
        @keyframes eq { from{transform:scaleY(0.3);}to{transform:scaleY(1);} }
        @keyframes slideDown { from{opacity:0;transform:translate(-50%,-20px);}to{opacity:1;transform:translate(-50%,0);} }
        @keyframes breathe { 0%,100%{opacity:0.75;}50%{opacity:1;} }
        textarea::placeholder { color:rgba(128,128,128,0.3); }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none;width:14px;height:14px;background:#00FF41;border-radius:50%;cursor:pointer; }
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.2);border-radius:2px;}
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box;}
      `}</style>
    </div>
  );
}
