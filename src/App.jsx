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
const THEME = {
  bg: "#1a1d23",
  surface: "#22262e", 
  border: "rgba(200,200,200,0.08)",
  accent: "#e8e8e8",
  text: "#e8e8e8",
  textDim: "rgba(232,232,232,0.5)"
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
  muted:     "ff_muted",
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


/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function Pomodoros() {

  /* ── THEME ── */
  const T = THEME;

  /* ── SOUND ── */
  const [isMuted, setIsMuted] = useState(()=>localStorage.getItem(LS_KEYS.muted)==="true");
  useEffect(()=>{localStorage.setItem(LS_KEYS.muted,isMuted);},[isMuted]);

  /* ── NOTIFICATIONS ── */
  const [showOverlay, setShowOverlay] = useState(false);

  /* ── ZEN CHIME ── */
  const playZenChime = useCallback(() => {
    if (isMuted) return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Create a gentle, smooth chime sound
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5 note
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      // Clean up after sound finishes
      setTimeout(() => {
        audioContext.close();
      }, 600);
    } catch (error) {
      console.log('Zen chime error:', error);
    }
  }, [isMuted]);

  /* ── NOTIFICATION HANDLER ── */
  const handleSessionComplete = useCallback(() => {
    // Play Zen chime
    playZenChime();
    
    // Show overlay if tab is active
    if (!document.hidden) {
      setShowOverlay(true);
    }
    
    // Send desktop notification if tab is in background
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Focus Session Complete', {
        body: 'Time for a break!',
        icon: '/favicon.ico',
        tag: 'pomodoros-session-complete'
      });
    }
    
    // Request notification permission if not granted
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Notification permission granted');
        }
      });
    }
  }, [playZenChime]);

  
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
      if (!running) return;
      if (secsLeft > 0) {
        handleSessionComplete();
        const nx = phaseRef.current === "work"?"break":"work"; 
        setPhase(nx); 
        setRunning(false);
        return nx==="work"?workMin*60:breakMin*60;
      }
      setSecsLeft(s=>s-1);
    },1000);
    return ()=>clearInterval(timerRef.current);
  },[running, handleSessionComplete]);

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
    
    let wakeLock = null;
    
    const requestWakeLock = async () => {
      try {
        if (running && !wakeLock) {
          wakeLock = await navigator.wakeLock.request('screen', {
            preventSleep: true
          });
          
          wakeLock.addEventListener('release', () => {
            wakeLock = null;
            // Lock released, try to reacquire if still running
            if (running && !document.hidden) {
              setTimeout(requestWakeLock, 1000);
            }
          });
          
          console.log('Wake Lock acquired');
        }
      } catch (err) {
        console.log('Wake Lock error:', err);
        wakeLock = null;
      }
    };
    
    const releaseWakeLock = () => {
      if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
      }
    };
    
    const handleVisibilityChange = async () => {
      if (document.hidden && running) {
        // Request wake lock when tab becomes hidden
        await requestWakeLock();
      } else if (!document.hidden && !running) {
        // Release wake lock when tab becomes visible and timer is not running
        releaseWakeLock();
      }
    };
    
    // Initial wake lock request if timer is running
    if (running) {
      requestWakeLock();
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
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

return (
  <div style={{ background:T.bg,width:"100vw",height:"100vh",color:T.text,fontFamily:"'Share Tech Mono',monospace",transition:"background 0.25s,color 0.25s",overflow:"hidden",position:"fixed",top:0,left:0 }}>
    <div style={{ padding:"20px",textAlign:"center" }}>
      <h1 style={{ color:T.accent,fontSize:"24px",marginBottom:"20px" }}>Pomodoros.io</h1>
      <div style={{ fontSize:"48px",marginBottom:"20px" }}>
        {Math.floor(secsLeft / 60)}:{(secsLeft % 60).toString().padStart(2, '0')}
      </div>
      <div style={{ marginBottom:"20px" }}>
        <button onClick={()=>setRunning(r=>!r)} style={{ background:T.accent,color:T.bg,border:"none",padding:"10px 20px",marginRight:"10px",cursor:"pointer" }}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={()=>resetTimer()} style={{ background:T.accent,color:T.bg,border:"none",padding:"10px 20px",cursor:"pointer" }}>
          Reset
        </button>
      </div>
      <div style={{ display:"flex",gap:"10px",justifyContent:"center",marginBottom:"20px" }}>
        {["timer","noise","note","stats"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ background:tab===t?T.accent:"transparent",color:tab===t?T.bg:T.text,border:`1px solid ${T.accent}`,padding:"5px 10px",cursor:"pointer" }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  </div>
);
}
