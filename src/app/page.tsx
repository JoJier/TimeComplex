"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, List, Globe, Users, User, X, Check, Trash2, Calendar, LogIn, UserPlus, Lock, Mail, Eye, EyeOff, Undo, Sparkles, FileText, Link, Send, Loader2, Upload } from "lucide-react";

interface CanvasEvent {
  id: string;
  time: string; // YYYY-MM-DD format
  y: number;
  label: string;
  color: string;
}

// 9 Zoom Levels
const ZOOM_LEVELS = [
  { level: 1, yearsVisible: 1, tickType: 'month' },
  { level: 2, yearsVisible: 2, tickType: 'quarter' },
  { level: 3, yearsVisible: 4, tickType: 'quarter' },
  { level: 4, yearsVisible: 6, tickType: 'quarter' },
  { level: 5, yearsVisible: 8, tickType: 'year' },
  { level: 6, yearsVisible: 10, tickType: 'year' },
  { level: 7, yearsVisible: 20, tickType: 'year' },
  { level: 8, yearsVisible: 30, tickType: 'year' },
  { level: 9, yearsVisible: 40, tickType: 'year' },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BASE_DATE = new Date("2014-01-01");

const INITIAL_EVENTS: CanvasEvent[] = [
  // COVID-19 Events (Y: 350-550)
  { id: "covid-1", time: "2019-12-31", y: 350, label: "武汉通报不明原因肺炎", color: "#ef4444" },
  { id: "covid-2", time: "2020-01-11", y: 400, label: "报告首例死亡病例", color: "#ef4444" },
  { id: "covid-3", time: "2020-01-23", y: 450, label: "武汉封城", color: "#f59e0b" },
  { id: "covid-4", time: "2020-03-11", y: 500, label: "世卫组织宣布全球大流行", color: "#ef4444" },
  { id: "covid-5", time: "2020-12-08", y: 370, label: "全球首剂获批疫苗接种", color: "#10b981" },
  { id: "covid-6", time: "2021-11-26", y: 420, label: "奥密克戎被列为关切变异株", color: "#f59e0b" },
  { id: "covid-7", time: "2022-12-07", y: 470, label: "优化防控措施(新十条)", color: "#10b981" },
  { id: "covid-8", time: "2023-05-05", y: 520, label: "全球卫生紧急状态结束", color: "#10b981" },

  // Global Wars (Y: 650-850) - 上移到可见区域
  { id: "war-1", time: "2014-02-20", y: 650, label: "克里米亚危机爆发", color: "#4f46e5" },
  { id: "war-2", time: "2014-06-29", y: 700, label: "极端组织IS宣布“建国”", color: "#1e293b" },
  { id: "war-3", time: "2015-09-30", y: 750, label: "叙利亚战争俄军介入", color: "#4f46e5" },
  { id: "war-4", time: "2020-09-27", y: 800, label: "纳卡冲突爆发", color: "#4f46e5" },
  { id: "war-5", time: "2021-08-15", y: 670, label: "塔利班进入喀布尔", color: "#1e293b" },
  { id: "war-6", time: "2022-02-24", y: 720, label: "俄乌战争全面爆发", color: "#ef4444" },
  { id: "war-7", time: "2023-10-07", y: 770, label: "巴以新一轮冲突爆发", color: "#ef4444" },
  { id: "war-8", time: "2024-04-13", y: 820, label: "伊朗对以色列发动报复性袭击", color: "#f59e0b" },
];

// Helper to convert date string to year offset from 2026-01-01
const dateToOffset = (dateStr: string) => {
  const date = new Date(dateStr);
  const diffTime = date.getTime() - BASE_DATE.getTime();
  return diffTime / (1000 * 60 * 60 * 24 * 365.25);
};

// Helper to convert year offset back to date string
const offsetToDate = (offset: number) => {
  const date = new Date(BASE_DATE.getTime() + offset * (1000 * 60 * 60 * 24 * 365.25));
  return date.toISOString().split('T')[0];
};

export default function Home() {
  const [zoomIndex, setZoomLevelIndex] = useState(5);
  const [offset, setOffset] = useState({ x: 100, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [events, setEvents] = useState<CanvasEvent[]>(INITIAL_EVENTS);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{ x: number, y: number, time: string } | null>(null);
  const [currentLabel, setCurrentLabel] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentColor, setCurrentColor] = useState("#fbbf24");
  
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string, username: string } | null>(null);
  const [loginError, setLoginError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CanvasEvent[]>([]);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const filtered = events.filter(ev => 
      ev.label.toLowerCase().includes(query.toLowerCase())
    );
    setSearchResults(filtered);
  };

  const scrollToEvent = (event: CanvasEvent) => {
    const eventOffset = dateToOffset(event.time);
    const targetX = (windowSize.width / 2) - (eventOffset * pixelsPerYear);
    const targetY = (windowSize.height / 2) - event.y;
    
    setOffset({ x: targetX, y: targetY });
    setSearchQuery("");
    setSearchResults([]);
    
    // Trigger highlight animation
    setHighlightedEventId(event.id);
    setTimeout(() => {
      setHighlightedEventId(null);
    }, 3000); // 3 seconds highlight
  };

  const [undoStack, setUndoStack] = useState<CanvasEvent[][]>([]);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiInputType, setAiInputType] = useState<'text' | 'file' | 'url'>('text');
  const [aiText, setAiText] = useState("");
  const [aiUrl, setAiUrl] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiExtractedEvents, setAiExtractedEvents] = useState<CanvasEvent[]>([]);

  const handleAiProcess = async () => {
    setIsAiProcessing(true);
    try {
      const formData = new FormData();
      formData.append('type', aiInputType);
      if (aiInputType === 'text') formData.append('content', aiText);
      if (aiInputType === 'url') formData.append('content', aiUrl);
      if (aiInputType === 'file' && aiFile) formData.append('file', aiFile);

      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('AI extraction failed');
      const data = await res.json();
      
      if (data.events && data.events.length > 0) {
        // Map data.events to CanvasEvent and show review UI
        const mapped = data.events.map((ev: any, i: number) => ({
          id: `ai-${Date.now()}-${i}`,
          time: ev.time,
          label: ev.label,
          y: 400 + (i % 5) * 60,
          color: ["#fbbf24", "#c084fc", "#2dd4bf", "#ef4444", "#10b981"][i % 5]
        }));
        setAiExtractedEvents(mapped);
      } else {
        alert("未能从输入中提取到任何事件点，请尝试更详细的内容。");
      }
    } catch (err) {
      console.error("AI processing error:", err);
      alert("AI 处理失败，请检查网络或稍后再试。");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const saveAiEvents = async () => {
     if (aiExtractedEvents.length === 0) return;
     
     try {
       pushToUndo(events);
       const savedEvents: CanvasEvent[] = [];
       for (const ev of aiExtractedEvents) {
         const res = await fetch('/api/events', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ ...ev, userId: currentUser?.id }),
         });
         if (res.ok) {
           const data = await res.json();
           savedEvents.push({ ...ev, id: data.id.toString() });
         }
       }
       setEvents(prev => [...prev, ...savedEvents]);
       setShowAiModal(false);
       setAiExtractedEvents([]);
       alert(`成功添加 ${savedEvents.length} 个事件！`);
     } catch (err) {
       console.error("Save AI events error:", err);
       alert("部分或全部事件保存失败。");
     }
   };

  const pushToUndo = (currentEvents: CanvasEvent[]) => {
    setUndoStack(prev => {
      const newStack = [...prev, currentEvents];
      if (newStack.length > 20) return newStack.slice(1);
      return newStack;
    });
  };

  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    
    const lastEvents = undoStack[undoStack.length - 1];
    const prevStack = undoStack.slice(0, -1);
    
    // Find what changed (specifically additions to restore deletions)
    const currentEventIds = new Set(events.map(e => e.id));
    const eventsToRestore = lastEvents.filter(e => !currentEventIds.has(e.id));
    
    try {
      // Sync restored events back to DB
      for (const event of eventsToRestore) {
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...event,
            userId: currentUser?.id
          }),
        });
      }
      
      setEvents(lastEvents);
      setUndoStack(prevStack);
    } catch (err) {
      console.error("Undo sync failed:", err);
      alert("撤销失败，请检查网络连接");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, events, currentUser]); // Added missing dependencies and kept it stable

  const currentZoom = ZOOM_LEVELS[zoomIndex];
  const pixelsPerYear = useMemo(() => {
    if (windowSize.width === 0) return 600;
    return windowSize.width / currentZoom.yearsVisible;
  }, [currentZoom, windowSize.width]);

  const dynamicTimelineTicks = useMemo(() => {
    if (windowSize.width === 0) return [];
    const ticks = [];
    const startYearOffset = Math.floor((0 - offset.x) / pixelsPerYear);
    const endYearOffset = Math.ceil((windowSize.width - offset.x) / pixelsPerYear);
    const yearStep = 1;

    for (let y = startYearOffset - 1; y <= endYearOffset + 1; y++) {
      if (y % yearStep === 0) {
        const x = offset.x + y * pixelsPerYear;
        ticks.push({ type: 'year', value: 2014 + y, x });
        if (currentZoom.tickType === 'month') {
          for (let m = 1; m < 12; m++) {
            ticks.push({ type: 'month', value: MONTHS[m], x: x + (m / 12) * pixelsPerYear });
          }
        } else if (currentZoom.tickType === 'quarter') {
          for (let q = 1; q < 4; q++) {
            ticks.push({ type: 'quarter', value: `Q${q+1}`, x: x + (q * 3 / 12) * pixelsPerYear });
          }
        }
      }
    }
    return ticks;
  }, [zoomIndex, offset.x, windowSize.width, pixelsPerYear]);

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    
    // Position the timeline so that 2014 is visible near the left
    setOffset({ x: 100, y: 50 });
    
    // Fetch events from the database API
    const fetchEvents = async () => {
      // If NOT logged in, show initial demo events
      if (!isLoggedIn) {
        setEvents(INITIAL_EVENTS);
        return;
      }
      
      // If logged in but user info not ready yet, wait
      if (!currentUser) {
        return;
      }

      try {
        const res = await fetch(`/api/events?userId=${currentUser.id}`);
        if (!res.ok) throw new Error('DB Fetch failed');
        const dbEvents = await res.json();
        
        if (dbEvents && dbEvents.length > 0) {
          // If we have DB events, use them.
          const processedDbEvents = dbEvents.map((ev: CanvasEvent, index: number) => ({
              ...ev,
              y: ev.y || (400 + (index % 3) * 50) // Fallback Y if missing
            }));
          setEvents(processedDbEvents);
        } else {
          setEvents([]); // Strictly show empty if logged in but no events in DB
        }
      } catch (err) {
        console.error("Failed to fetch events from DB, using fallback.", err);
        setEvents([]); // Better to show empty than leak INITIAL_EVENTS to a user
      }
    };
    
    fetchEvents();
    
    return () => window.removeEventListener("resize", updateSize);
  }, [isLoggedIn, currentUser]); // Added currentUser to dependencies

  const handleLogin = async () => {
    setLoginError("");
    try {
      if (authMode === 'register') {
        if (!email.includes('@')) {
          setLoginError("请输入有效的邮箱地址");
          return;
        }
        if (password !== confirmPassword) {
          setLoginError("两次输入的密码不一致");
          return;
        }
      }

      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = authMode === 'login' 
        ? { username, password } 
        : { username, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (authMode === 'register') {
          alert('注册成功，请登录！');
          setAuthMode('login');
          setPassword("");
          setConfirmPassword("");
        } else {
          setIsLoggedIn(true);
          setCurrentUser(data.user);
          setAuthMode(null);
          alert('登录成功！');
        }
      } else {
        setLoginError(data.message || (authMode === 'login' ? '登录失败' : '注册失败'));
      }
    } catch (err) {
      console.error('Auth error detail:', err);
      setLoginError('服务器连接失败');
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setEvents(INITIAL_EVENTS);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      if (zoomIndex > 0) {
        const nextIndex = zoomIndex - 1;
        adjustOffsetForZoom(nextIndex, e.clientX);
        setZoomLevelIndex(nextIndex);
      }
    } else {
      if (zoomIndex < ZOOM_LEVELS.length - 1) {
        const nextIndex = zoomIndex + 1;
        adjustOffsetForZoom(nextIndex, e.clientX);
        setZoomLevelIndex(nextIndex);
      }
    }
  };

  const adjustOffsetForZoom = (nextIndex: number, mouseX: number) => {
    const nextZoom = ZOOM_LEVELS[nextIndex];
    const nextPixelsPerYear = windowSize.width / nextZoom.yearsVisible;
    const timeAtMouse = (mouseX - offset.x) / pixelsPerYear;
    setOffset(prev => ({ ...prev, x: mouseX - timeAtMouse * nextPixelsPerYear }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && (e.altKey || e.ctrlKey))) { 
      setIsPanning(true);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPanning) return;
    if (authMode) {
      setAuthMode(null);
      return;
    }
    if (e.button === 0 && !e.altKey && !e.ctrlKey) {
      if (pendingEvent || editingEventId) {
        cancelEdit();
        return;
      }
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const yearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const canvasY = (e.clientY - rect.top - offset.y);
        const timeStr = offsetToDate(yearOffset);
        
        setPendingEvent({ x: yearOffset, y: canvasY, time: timeStr });
        setEditingEventId(null);
        setCurrentLabel("");
        setCurrentTime(timeStr);
      }
    }
  };

  const startEditing = (event: CanvasEvent) => {
    setPendingEvent({ x: dateToOffset(event.time), y: event.y, time: event.time });
    setEditingEventId(event.id);
    setCurrentLabel(event.label);
    setCurrentTime(event.time);
    setCurrentColor(event.color);
  };

  const saveEvent = async () => {
    if (!currentLabel.trim() || !currentTime) {
      cancelEdit();
      return;
    }

    try {
      if (editingEventId) {
        // Optional: Implement PUT /api/events for editing
        setEvents(prev => prev.map(ev => 
          ev.id === editingEventId ? { ...ev, label: currentLabel.trim(), time: currentTime, color: currentColor } : ev
        ));
      } else if (pendingEvent) {
        const newEventData = {
          time: currentTime,
          y: pendingEvent.y,
          label: currentLabel.trim(),
          color: currentColor,
          userId: currentUser?.id
        };

        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEventData),
        });

        if (!res.ok) throw new Error('Failed to save event to DB');
        const data = await res.json();

        const newEvent: CanvasEvent = {
          ...newEventData,
          id: data.id.toString(),
        };
        setEvents(prev => [...prev, newEvent]);
      }
    } catch (err) {
      console.error('Error saving event:', err);
      alert('保存事件失败，请检查数据库连接');
    }
    cancelEdit();
  };

  const deleteEvent = async () => {
    if (editingEventId) {
      try {
        pushToUndo(events);
        const res = await fetch(`/api/events?id=${editingEventId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete event from DB');
        
        setEvents(prev => prev.filter(ev => ev.id !== editingEventId));
        cancelEdit();
      } catch (err) {
        console.error('Error deleting event:', err);
        alert('删除事件失败');
      }
    }
  };

  const cancelEdit = () => {
    setPendingEvent(null);
    setEditingEventId(null);
    setCurrentLabel("");
    setCurrentTime("");
    setCurrentColor("#fbbf24");
  };

  return (
    <main 
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden bg-[#fdf2f8] font-sans text-slate-800"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/20 blur-[120px] rounded-full" />
      </div>

      {/* Red vertical "Now" line */}
      <div className="fixed top-0 bottom-0 w-[2px] bg-red-500/40 z-20 pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.4)]" style={{ left: offset.x + dateToOffset("2026-03-31") * pixelsPerYear }}>
        <div className="absolute top-36 -left-12 w-24 text-center">
          <span className="text-[10px] font-black text-red-600/50 tracking-widest uppercase bg-white/40 px-2 py-0.5 rounded-full backdrop-blur-sm">Present</span>
        </div>
      </div>
      
      <div className="absolute inset-0 z-10 origin-top-left will-change-transform" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="absolute inset-[-40000px] pointer-events-none" style={{
          backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)`,
          backgroundSize: `${pixelsPerYear / (currentZoom.tickType === 'month' ? 12 : 4)}px 100px`,
        }} />

        <div className="relative w-[40000px] h-[5000px]">
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            <defs>
              <linearGradient id="grad-yellow" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" /><stop offset="50%" stopColor="#ef4444" stopOpacity="0.6" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" /></linearGradient>
              <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" /><stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" /></linearGradient>
              <linearGradient id="grad-teal" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#10b981" stopOpacity="0.2" /><stop offset="50%" stopColor="#10b981" stopOpacity="0.6" /><stop offset="100%" stopColor="#10b981" stopOpacity="0.2" /></linearGradient>
              <filter id="glow-lg"><feGaussianBlur stdDeviation="8" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
              <filter id="glow-sm"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
            </defs>

            <motion.path d={`M ${-1 * pixelsPerYear},400 C ${0 * pixelsPerYear},400 ${1 * pixelsPerYear},450 ${2 * pixelsPerYear},550 S ${4 * pixelsPerYear},650 ${7 * pixelsPerYear},650`} stroke="url(#grad-yellow)" strokeWidth="32" fill="none" strokeLinecap="round" />
            <motion.path d={`M ${-0.5 * pixelsPerYear},800 C 1 * pixelsPerYear,800 ${3 * pixelsPerYear},880 ${5 * pixelsPerYear},950 S ${7 * pixelsPerYear},1050 ${9 * pixelsPerYear},1050`} stroke="url(#grad-purple)" strokeWidth="32" fill="none" strokeLinecap="round" />
            <motion.path d={`M ${0 * pixelsPerYear},1200 C 2 * pixelsPerYear,1200 ${5 * pixelsPerYear},1300 ${8 * pixelsPerYear},1380 S ${11 * pixelsPerYear},1500 ${14 * pixelsPerYear},1500`} stroke="url(#grad-teal)" strokeWidth="32" fill="none" strokeLinecap="round" />

            <g className="pointer-events-auto">
              <AnimatePresence>
                {events.map(event => (
                  <Marker 
                    key={event.id} 
                    x={dateToOffset(event.time) * pixelsPerYear} 
                    y={event.y} 
                    color={event.color} 
                    label={event.label} 
                    onClick={() => startEditing(event)} 
                    isEditing={editingEventId === event.id}
                    isHighlighted={highlightedEventId === event.id}
                  />
                ))}
              </AnimatePresence>

              <AnimatePresence>
                {pendingEvent && (
                  <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="pointer-events-auto">
                    {!editingEventId && <circle cx={dateToOffset(currentTime) * pixelsPerYear} cy={pendingEvent.y} r="8" fill="#cbd5e1" />}
                    <foreignObject x={dateToOffset(currentTime) * pixelsPerYear - 140} y={pendingEvent.y + 15} width="280" height="150">
                      <div className="flex flex-col items-center p-1" onClick={e => e.stopPropagation()}>
                        <div className="glass px-3 py-3 rounded-2xl border border-white/60 shadow-xl flex flex-col gap-3 w-full">
                          <div className="flex items-center gap-2 bg-white/30 rounded-lg px-2 py-1.5 border border-white/40">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <input type="date" value={currentTime} onChange={e => setCurrentTime(e.target.value)} className="bg-transparent border-none outline-none text-[11px] font-medium text-slate-700 w-full" />
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="color" 
                              value={currentColor} 
                              onChange={e => setCurrentColor(e.target.value)}
                              className="w-6 h-6 rounded-lg overflow-hidden border-none bg-transparent cursor-pointer"
                            />
                            <input autoFocus type="text" value={currentLabel} onChange={e => setCurrentLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEvent() : e.key === 'Escape' ? cancelEdit() : null} placeholder={editingEventId ? "编辑事件..." : "新事件..."} className="bg-transparent border-none outline-none text-[12px] font-medium text-slate-700 flex-1 px-1" />
                            <div className="flex items-center gap-1.5 border-l border-slate-100 pl-2">
                              <button onClick={saveEvent} className="p-1.5 hover:bg-green-100 rounded-lg text-green-600 transition-colors"><Check className="w-3.5 h-3.5" /></button>
                              {editingEventId && <button onClick={deleteEvent} className="p-1.5 hover:bg-red-100 rounded-lg text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                              <button onClick={cancelEdit} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </foreignObject>
                  </motion.g>
                )}
              </AnimatePresence>
            </g>
          </svg>
        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute top-10 left-10 pointer-events-auto" onClick={e => e.stopPropagation()}>
          <h1 className="text-3xl font-light tracking-wider text-slate-900/80 leading-tight">时间集合体<span className="block text-xl font-extralight opacity-40 mt-1">Time Complex</span></h1>
        </div>

        {/* Top Dynamic Multi-level Timeline */}
        <div className="absolute top-9 left-[280px] right-10 h-20 pointer-events-none flex items-start justify-center">
          <div className="glass rounded-2xl shadow-sm border border-white/40 pointer-events-auto w-full h-full relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute inset-0 pt-2">
              {dynamicTimelineTicks.map((tick: any, i: number) => {
                // Adjust tick.x to be relative to this container
                // container is now offset from left by 280px
                const relativeX = tick.x - 280;

                return (
                  <div key={`${tick.type}-${tick.value}-${i}`} className="absolute flex flex-col items-center top-1/2 -translate-y-1/2" style={{ left: relativeX, transform: 'translate(-50%, -50%)' }}>
                    {tick.type === 'year' ? (
                      <>
                        <span className="text-[12px] font-black text-slate-700 mb-1">{tick.value}</span>
                        <div className={`w-3.5 h-3.5 rotate-45 border-2 ${tick.value === 2026 ? 'border-red-500 bg-red-100 shadow-[0_0_10px_rgba(239,68,68,0.5)] scale-125' : (typeof tick.value === 'number' && tick.value % 2 === 0 ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50')}`} />
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-bold text-slate-500 mb-0.5">{tick.value}</span>
                        <div className={`rounded-full bg-slate-300 ${tick.type === 'quarter' ? 'w-1.5 h-1.5' : 'w-1 h-1'}`} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#fdf2f8]/90 via-[#fdf2f8]/50 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#fdf2f8]/90 via-[#fdf2f8]/50 to-transparent z-10 pointer-events-none" />
          </div>
        </div>

        <aside className="absolute left-10 top-40 flex flex-col gap-10 pointer-events-auto" onClick={e => e.stopPropagation()}>
          {[
            { title: "Career", items: ["Career", "Money", "Skills", "Travels", "Hobbies", "Creations"], color: "text-amber-600/70" },
            { title: "Relationship", items: ["Family", "Friends"], color: "text-purple-600/70" },
            { title: "Location", items: ["World", "War", "Virus", "Country", "Religion", "Earth Year"], color: "text-indigo-600/70" }
          ].map((section) => (
            <section key={section.title}><h2 className={`text-xl font-medium ${section.color} mb-3`}>{section.title}</h2><ul className="space-y-1.5 pl-1">{section.items.map(item => <li key={item} className="cursor-pointer text-slate-400 hover:text-slate-800 transition-colors"><span className="text-base font-light">{item}</span></li>)}</ul></section>
          ))}
        </aside>

        <div className="absolute right-12 top-10 flex items-center gap-4 pointer-events-auto" onClick={e => e.stopPropagation()}>
           {isLoggedIn ? (
             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/60 text-slate-700 text-sm font-medium">
                 <User className="w-4 h-4 opacity-60" />
                 {currentUser?.username}
               </div>
               <motion.button 
                 whileHover={{ scale: 1.05, backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                 whileTap={{ scale: 0.95 }}
                 onClick={handleLogout}
                 className="px-4 py-2 rounded-full text-red-500 text-sm font-medium transition-all"
               >
                 退出登录
               </motion.button>
             </div>
           ) : (
             <>
               <motion.button 
                 whileHover={{ scale: 1.05, backgroundColor: "rgba(255, 255, 255, 0.9)" }}
                 whileTap={{ scale: 0.95 }}
                 onClick={() => { setAuthMode('login'); setUsername(""); setPassword(""); setLoginError(""); setShowPassword(false); }}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-white/60 text-slate-700 text-sm font-medium shadow-sm transition-all"
               >
                 <LogIn className="w-4 h-4 opacity-60" />
                 登录
               </motion.button>
               <motion.button 
                 whileHover={{ scale: 1.05, backgroundColor: "rgba(30, 41, 59, 0.9)" }}
                 whileTap={{ scale: 0.95 }}
                 onClick={() => { setAuthMode('register'); setUsername(""); setPassword(""); setEmail(""); setConfirmPassword(""); setLoginError(""); setShowPassword(false); setShowConfirmPassword(false); }}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 text-white text-sm font-medium shadow-md shadow-slate-200/50 transition-all"
               >
                 <UserPlus className="w-4 h-4 opacity-80" />
                 注册
               </motion.button>
             </>
           )}
         </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[60%] max-w-4xl pointer-events-auto" onClick={e => e.stopPropagation()}>
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="glass absolute bottom-full mb-6 w-full max-h-[300px] overflow-y-auto rounded-3xl border border-white/60 shadow-2xl p-4 flex flex-col gap-2 custom-scrollbar"
              >
                {searchResults.map(ev => (
                  <motion.button
                    key={ev.id}
                    whileHover={{ x: 5, backgroundColor: "rgba(255, 255, 255, 0.5)" }}
                    onClick={() => scrollToEvent(ev)}
                    className="flex items-center justify-between p-3 rounded-2xl transition-all text-left group"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">{ev.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">{ev.time}</span>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: ev.color }} />
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {undoStack.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex justify-center mb-4"
              >
                  <button 
                    onClick={handleUndo}
                    className="glass px-4 py-2 rounded-full flex items-center gap-2 text-xs font-medium text-slate-600 hover:bg-white/80 hover:text-blue-600 transition-all shadow-sm border border-white/60"
                  >
                    <Undo className="w-3.5 h-3.5" />
                    撤销删除 ({isMac ? '⌘Z' : 'Ctrl+Z'} - {undoStack.length})
                  </button>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="glass px-8 py-5 rounded-[2.5rem] flex items-center gap-5 shadow-2xl border border-white/60">
              <Search className="w-7 h-7 text-slate-300" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    scrollToEvent(searchResults[0]);
                  }
                }}
                placeholder="Explore the infinite timeline..." 
                className="flex-1 bg-transparent border-none outline-none text-slate-700 text-xl font-light placeholder:text-slate-300" 
              />
              <div className="flex items-center gap-8 text-slate-300 border-l border-slate-100 pl-8 ml-2">
                <SlidersHorizontal className="w-6 h-6 cursor-pointer hover:text-blue-500" />
                <List className="w-6 h-6 cursor-pointer hover:text-blue-500" />
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAiModal(true)}
                  className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-200/50"
                >
                  <Sparkles className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
        </div>

        <div className="absolute bottom-10 right-10 bg-white/60 backdrop-blur-xl px-5 py-2.5 rounded-full text-xs text-slate-500 border border-white/80 shadow-sm select-none"><span className="font-bold text-blue-600 mr-2">Level {currentZoom.level}</span><span className="font-medium text-slate-800">滚轮</span> 切换层级 • <span className="font-medium text-slate-800 ml-2">拖拽</span> 平移 • <span className="ml-2 font-mono">View: {currentZoom.yearsVisible}Y</span></div>

        {/* Auth Modal */}
        <AnimatePresence>
          {authMode && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm pointer-events-auto"
                onClick={() => setAuthMode(null)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative glass-pill bg-white/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-white shadow-2xl w-full max-w-sm pointer-events-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4 shadow-lg shadow-slate-200">
                    {authMode === 'login' ? <LogIn className="text-white w-8 h-8" /> : <UserPlus className="text-white w-8 h-8" />}
                  </div>
                  <h2 className="text-2xl font-semibold text-slate-800">
                    {authMode === 'login' ? '欢迎回来' : '创建账号'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {authMode === 'login' ? '请输入您的凭据以登录' : '加入我们，开始记录您的无限时间'}
                  </p>
                  {loginError && (
                    <p className="text-xs text-red-500 mt-2 bg-red-50 p-2 rounded-lg border border-red-100 w-full">
                      {loginError}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 ml-2">用户名</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/50 border border-slate-200/50 focus-within:border-slate-400 transition-all">
                      <User className="w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        placeholder="请输入用户名" 
                        className="bg-transparent border-none outline-none text-sm text-slate-700 w-full" 
                      />
                    </div>
                  </div>

                  {authMode === 'register' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400 ml-2">邮箱</label>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/50 border border-slate-200/50 focus-within:border-slate-400 transition-all">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <input 
                          type="email" 
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleLogin()}
                          placeholder="请输入邮箱" 
                          className="bg-transparent border-none outline-none text-sm text-slate-700 w-full" 
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 ml-2">密码</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/50 border border-slate-200/50 focus-within:border-slate-400 transition-all">
                      <Lock className="w-4 h-4 text-slate-400" />
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        placeholder="请输入密码" 
                        className="bg-transparent border-none outline-none text-sm text-slate-700 w-full" 
                      />
                      <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {authMode === 'register' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-400 ml-2">确认密码</label>
                      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/50 border border-slate-200/50 focus-within:border-slate-400 transition-all">
                        <Lock className="w-4 h-4 text-slate-400" />
                        <input 
                          type={showConfirmPassword ? "text" : "password"} 
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleLogin()}
                          placeholder="请再次输入密码" 
                          className="bg-transparent border-none outline-none text-sm text-slate-700 w-full" 
                        />
                        <button onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-slate-400 hover:text-slate-600 transition-colors">
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleLogin}
                  className="w-full mt-8 py-4 rounded-2xl bg-slate-800 text-white font-semibold shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all"
                >
                  {authMode === 'login' ? '立即登录' : '立即注册'}
                </motion.button>

                <div className="mt-6 text-center">
                  <button 
                    onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setLoginError(""); }}
                    className="text-xs text-slate-400 hover:text-slate-800 transition-colors"
                  >
                    {authMode === 'login' ? '还没有账号？立即注册' : '已经有账号了？立即登录'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* AI Import Modal */}
        <AnimatePresence>
          {showAiModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-md pointer-events-auto"
                onClick={() => { if (!isAiProcessing) setShowAiModal(false); }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative glass-pill bg-white/90 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white shadow-2xl w-full max-w-2xl pointer-events-auto overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-200">
                      <Sparkles className="text-white w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-semibold text-slate-800">AI 智能提取</h2>
                      <p className="text-sm text-slate-500">通过文件、文本或链接自动生成时间轴事件</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowAiModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {aiExtractedEvents.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-slate-700">预览提取结果 ({aiExtractedEvents.length})</h3>
                      <button 
                        onClick={() => setAiExtractedEvents([])}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        重新提取
                      </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto space-y-3 custom-scrollbar pr-2">
                      {aiExtractedEvents.map((ev, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{ev.label}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{ev.time}</p>
                          </div>
                          <button 
                            onClick={() => setAiExtractedEvents(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={saveAiEvents}
                      className="w-full py-4 rounded-2xl bg-slate-800 text-white font-semibold shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      确认并添加到时间轴
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex p-1 bg-slate-100 rounded-2xl">
                      {[
                        { id: 'text', icon: FileText, label: '粘贴文本' },
                        { id: 'file', icon: Upload, label: '上传文件' },
                        { id: 'url', icon: Link, label: '网页链接' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setAiInputType(tab.id as any)}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${aiInputType === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          <tab.icon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="min-h-[200px]">
                      {aiInputType === 'text' && (
                        <textarea
                          value={aiText}
                          onChange={e => setAiText(e.target.value)}
                          placeholder="在此粘贴文章内容、日记、历史记录等..."
                          className="w-full h-48 p-5 rounded-3xl bg-slate-50 border border-slate-200 focus:border-purple-300 focus:ring-4 focus:ring-purple-100 outline-none transition-all resize-none text-slate-700"
                        />
                      )}

                      {aiInputType === 'file' && (
                        <div className="w-full h-48 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-3 transition-all hover:border-purple-300 hover:bg-purple-50/30">
                          <div className="p-4 rounded-full bg-white shadow-sm">
                            <Upload className="w-8 h-8 text-slate-400" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-slate-600">
                              {aiFile ? aiFile.name : '点击或拖拽文件到此处'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">支持 PDF, Word (.docx), TXT 格式</p>
                          </div>
                          <input 
                            type="file" 
                            accept=".pdf,.docx,.txt"
                            onChange={e => setAiFile(e.target.files?.[0] || null)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      )}

                      {aiInputType === 'url' && (
                        <div className="space-y-4 pt-10">
                          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-100 transition-all">
                            <Link className="w-5 h-5 text-slate-400" />
                            <input 
                              type="url" 
                              value={aiUrl}
                              onChange={e => setAiUrl(e.target.value)}
                              placeholder="请输入网页 URL (例如新闻报道、维基百科页面)" 
                              className="bg-transparent border-none outline-none text-slate-700 w-full" 
                            />
                          </div>
                          <p className="text-xs text-slate-400 px-2 italic">注意：部分动态加载的网页可能无法解析。</p>
                        </div>
                      )}
                    </div>

                    <motion.button 
                      whileHover={!isAiProcessing ? { scale: 1.02 } : {}}
                      whileTap={!isAiProcessing ? { scale: 0.98 } : {}}
                      disabled={isAiProcessing || (aiInputType === 'text' && !aiText) || (aiInputType === 'file' && !aiFile) || (aiInputType === 'url' && !aiUrl)}
                      onClick={handleAiProcess}
                      className="w-full py-4 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-200/50 flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale transition-all"
                    >
                      {isAiProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          AI 正在分析并提取中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          开始提取事件
                        </>
                      )}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Marker({ x, y, color, label, onClick, isEditing, isHighlighted }: { x: number, y: number, color: string, label: string, onClick?: () => void, isEditing?: boolean, isHighlighted?: boolean }) {
  return (
    <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: isEditing ? 0.3 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }} whileHover={isEditing ? {} : "hover"} className="pointer-events-auto cursor-pointer" onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}>
      <circle cx={x} cy={y} r="12" fill={color} opacity="0.15" filter="url(#glow-lg)" />
      
      {/* Highlight effect */}
       <AnimatePresence>
         {isHighlighted && (
           <>
             <motion.circle
               cx={x}
               cy={y}
               initial={{ r: 12, opacity: 0.8 }}
               animate={{ r: 120, opacity: 0 }}
               transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
               fill="none"
               stroke={color}
               strokeWidth="3"
             />
             <motion.circle
               cx={x}
               cy={y}
               initial={{ r: 12, opacity: 0.6 }}
               animate={{ r: 90, opacity: 0 }}
               transition={{ duration: 2, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
               fill="none"
               stroke={color}
               strokeWidth="2"
             />
             <motion.circle
               cx={x}
               cy={y}
               initial={{ r: 12, opacity: 0.4 }}
               animate={{ r: 60, opacity: 0 }}
               transition={{ duration: 2, delay: 1, repeat: Infinity, ease: "easeOut" }}
               fill="none"
               stroke={color}
               strokeWidth="1.5"
             />
           </>
         )}
       </AnimatePresence>

      <motion.circle cx={x} cy={y} r="7" fill="white" stroke={color} strokeWidth="3" filter="url(#glow-sm)" variants={{ hover: { scale: 1.3 } }} transition={{ type: "spring", stiffness: 300, damping: 20 }} animate={isHighlighted ? { scale: [1, 1.5, 1] } : {}} style={{ transformOrigin: `${x}px ${y}px` }} />
      <foreignObject x={x - 60} y={y + 20} width="120" height="60"><div className="flex justify-center p-1"><motion.div variants={{ hover: { y: 2, scale: 1.05 } }} animate={isHighlighted ? { scale: [1, 1.1, 1], y: [0, -5, 0] } : {}} className="glass-pill px-3 py-1.5 rounded-xl text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-sm border border-white/60">{label}</motion.div></div></foreignObject>
    </motion.g>
  );
}
