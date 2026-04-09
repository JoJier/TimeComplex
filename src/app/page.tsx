"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, List, Globe, Users, User, X, Check, Trash2, Calendar, LogIn, UserPlus, Lock, Mail, Eye, EyeOff, Undo, Sparkles, FileText, Link, Send, Loader2, Upload, MousePointer2, Square, Circle, StickyNote, Image as ImageIcon, Pen, Eraser } from "lucide-react";

interface CanvasEvent {
  id: string;
  time: string; // YYYY-MM-DD format
  y: number;
  label: string;
  color: string;
}

interface TimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  color: string;
  category: string;
  y: number;
}

type TimelineTick = { type: 'year' | 'month' | 'quarter'; value: number | string; x: number };

type StrokePoint = { x: number, y: number };
type Stroke = { id: string, color: string, width: number, points: StrokePoint[] };

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

const dateToOffset = (dateStr: string) => {
  if (!dateStr) return 0;
  const parts = dateStr.split('-');
  const year = Number(parts[0]);
  const monthIndex = parts.length > 1 ? Number(parts[1]) - 1 : 0;
  const dayIndex = parts.length > 2 ? Number(parts[2]) - 1 : 0;
  
  if (!Number.isFinite(year)) return 0;

  const safeMonthIndex = Number.isFinite(monthIndex) ? monthIndex : 0;
  const safeDayIndex = Number.isFinite(dayIndex) ? dayIndex : 0;

  const baseYear = BASE_DATE.getFullYear();
  const daysInMonth = new Date(year, safeMonthIndex + 1, 0).getDate();
  const clampedDayIndex = Math.max(0, Math.min(daysInMonth - 1, safeDayIndex));

  return (year - baseYear) + safeMonthIndex / 12 + (clampedDayIndex / daysInMonth) / 12;
};

const offsetToDate = (offset: number) => {
  const baseYear = BASE_DATE.getFullYear();
  const safe = Number.isFinite(offset) ? offset : 0;

  const yearOffset = Math.floor(safe);
  const year = baseYear + yearOffset;
  const withinYear = safe - yearOffset;
  const monthFloat = withinYear * 12;
  const monthIndex = Math.max(0, Math.min(11, Math.floor(monthFloat)));
  const withinMonth = monthFloat - monthIndex;

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dayIndex = Math.max(0, Math.min(daysInMonth - 1, Math.floor(withinMonth * daysInMonth)));

  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(dayIndex + 1).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

export default function Home() {
  const [zoomIndex, setZoomLevelIndex] = useState(5);
  const [offset, setOffset] = useState({ x: 100, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [events, setEvents] = useState<CanvasEvent[]>(INITIAL_EVENTS);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [todayIso, setTodayIso] = useState(() => BASE_DATE.toISOString().slice(0, 10));
  const todayYear = Number(todayIso.slice(0, 4));

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{ x: number, y: number, time: string } | null>(null);
  const [pendingBlock, setPendingBlock] = useState<{ startX: number, currentX: number, y: number, startTime: string, endTime: string } | null>(null);
  const [currentLabel, setCurrentLabel] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentEndTime, setCurrentTimeEnd] = useState("");
  const [currentColor, setCurrentColor] = useState("#fbbf24");
  const [currentCategory, setCurrentCategory] = useState("其他");
  
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
  const [activeTool, setActiveTool] = useState<'select' | 'block' | 'point' | 'sticker' | 'import' | 'ai' | 'search' | 'draw' | 'eraser'>('point');
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchResults, setSearchResults] = useState<CanvasEvent[]>([]);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [brushWidth, setBrushWidth] = useState(4);
  const [isErasing, setIsErasing] = useState(false);
  const [eraserTrail, setEraserTrail] = useState<StrokePoint[]>([]);
  const [resizingBlock, setResizingBlock] = useState<{ id: string, edge: 'left' | 'right', y: number } | null>(null);

  useEffect(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setTodayIso(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const cancelEdit = () => {
    setPendingEvent(null);
    setPendingBlock(null);
    setEditingEventId(null);
    setEditingBlockId(null);
    setResizingBlock(null);
    setCurrentLabel("");
    setCurrentTime("");
    setCurrentTimeEnd("");
    setCurrentColor("#fbbf24");
    setCurrentCategory("其他");
  };

  const switchTool = (tool: 'select' | 'block' | 'point' | 'sticker' | 'import' | 'ai' | 'search' | 'draw' | 'eraser') => {
    setActiveTool(tool);
    setIsSearchExpanded(false);
    cancelEdit(); // 切换工具时强制清除所有编辑/创建状态
  };

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
        const mapped = (data.events as Array<{ time: string; label: string }>).map((ev, i: number) => ({
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

  useEffect(() => {
    // 阻止各个浏览器（Chrome, Safari, Firefox 等）在触控板双指捏合时触发整个网页的原生缩放或前进后退
    const preventDefaultGestures = (e: WheelEvent) => {
      // ctrlKey 是大多数浏览器用于标记触控板捏合 (Pinch-to-zoom) 的通用方式
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    
    // 必须使用 passive: false 才能拦截默认的滚动/缩放行为
    document.addEventListener('wheel', preventDefaultGestures, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', preventDefaultGestures);
    };
  }, []);

  const currentZoom = ZOOM_LEVELS[zoomIndex];
  const pixelsPerYear = useMemo(() => {
    if (windowSize.width === 0) return 600;
    return windowSize.width / currentZoom.yearsVisible;
  }, [currentZoom, windowSize.width]);

  const gridSizePx = useMemo(() => {
    const divisor = currentZoom.tickType === 'month' ? 12 : 4;
    return pixelsPerYear / divisor;
  }, [currentZoom.tickType, pixelsPerYear]);

  const snapPxToGrid = useCallback((px: number) => {
    if (gridSizePx === 0) return px;
    return Math.round(px / gridSizePx) * gridSizePx;
  }, [gridSizePx]);

  const snapYearOffsetToGrid = useCallback((yearOffset: number) => {
    return snapPxToGrid(yearOffset * pixelsPerYear) / pixelsPerYear;
  }, [pixelsPerYear, snapPxToGrid]);

  const getNextTimeBlockLabel = useCallback(() => {
    let max = 0;
    for (const block of timeBlocks) {
      const match = /^时间(\d+)$/.exec(block.label.trim());
      if (match) max = Math.max(max, Number(match[1]));
    }
    return `时间${max + 1}`;
  }, [timeBlocks]);

  const getTimeBlockRange = useCallback((block: TimeBlock) => {
    const a = dateToOffset(block.startTime);
    const b = dateToOffset(block.endTime);
    const start = Math.min(a, b);
    const end = Math.max(a, b);
    return { start, end };
  }, []);

  const isOverlappingTimeBlock = useCallback((row: number, start: number, end: number, ignoreId?: string) => {
    if (!(end > start)) return false;
    for (const block of timeBlocks) {
      if (block.y !== row) continue;
      if (ignoreId && block.id === ignoreId) continue;
      const r = getTimeBlockRange(block);
      if (!(r.end > r.start)) continue;
      if (start < r.end && r.start < end) return true;
    }
    return false;
  }, [getTimeBlockRange, timeBlocks]);

  const findTimeBlockAtCell = useCallback((row: number, yearOffset: number) => {
    for (const block of timeBlocks) {
      if (block.y !== row) continue;
      const r = getTimeBlockRange(block);
      if (r.start <= yearOffset && yearOffset < r.end) return block;
    }
    return null;
  }, [getTimeBlockRange, timeBlocks]);

  const openTimeBlockEditor = useCallback((block: TimeBlock) => {
    setEditingBlockId(block.id);
    setEditingEventId(null);
    setPendingEvent(null);
    setPendingBlock({
      startX: dateToOffset(block.startTime),
      currentX: dateToOffset(block.endTime),
      y: block.y,
      startTime: block.startTime,
      endTime: block.endTime
    });
    setCurrentLabel(block.label);
    setCurrentTime(block.startTime);
    setCurrentTimeEnd(block.endTime);
    setCurrentColor(block.color);
    setCurrentCategory(block.category);
  }, []);

  useEffect(() => {
    // Empty effect to remove block Y mutation
  }, []);

  const dynamicTimelineTicks = useMemo(() => {
    if (windowSize.width === 0) return [];
    const ticks: TimelineTick[] = [];
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
    // 阻止默认的页面滚动或浏览器缩放行为
    e.preventDefault();

    // 在 Chrome 和部分浏览器中，触控板双指捏合不一定会触发 e.ctrlKey=true
    // 但是，鼠标滚轮和触控板滑动产生的事件特征有明显区别。
    // 如果用户希望在网页上：
    // 1. 只有纯粹的垂直滚动（deltaY 有值，deltaX 严格为 0）才被视为缩放（符合鼠标滚轮的特征）。
    // 2. 其他情况（包括任何带有 deltaX 的双指滑动或斜向滚动）都被视为平移。

    const isVerticalScrollOnly = Math.abs(e.deltaY) > 0 && e.deltaX === 0;

    if (isVerticalScrollOnly) {
      // 触发缩放 (Zoom)
      if (e.deltaY > 0) {
        if (zoomIndex < ZOOM_LEVELS.length - 1) {
          const nextIndex = zoomIndex + 1;
          adjustOffsetForZoom(nextIndex, e.clientX);
          setZoomLevelIndex(nextIndex);
        }
      } else if (e.deltaY < 0) {
        if (zoomIndex > 0) {
          const nextIndex = zoomIndex - 1;
          adjustOffsetForZoom(nextIndex, e.clientX);
          setZoomLevelIndex(nextIndex);
        }
      }
    } else {
      // 触发平移 (Pan)
      // 注意：如果只是双指垂直滑动，因为 deltaX 不严格为 0（触控板很难做到绝对的 deltaX=0），
      // 或者就是明显的双指横向滑动，都会走到这里。
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const adjustOffsetForZoom = (nextIndex: number, mouseX: number) => {
    const nextZoom = ZOOM_LEVELS[nextIndex];
    const nextPixelsPerYear = windowSize.width / nextZoom.yearsVisible;
    const timeAtMouse = (mouseX - offset.x) / pixelsPerYear;
    setOffset(prev => ({ ...prev, x: mouseX - timeAtMouse * nextPixelsPerYear }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.editing-popup')) return;

    if (e.button === 1 || (e.button === 0 && (e.altKey || e.ctrlKey)) || activeTool === 'select') { 
      setIsPanning(true);
      e.preventDefault();
    } else if (e.button === 0 && activeTool === 'draw') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const canvasY = (e.clientY - rect.top - offset.y);
        setCurrentStroke({ id: Math.random().toString(36).slice(2, 11), color: currentColor, width: brushWidth, points: [{ x: rawYearOffset, y: canvasY }] });
      }
      return;
    } else if (e.button === 0 && activeTool === 'eraser') {
      setIsErasing(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const canvasX = e.clientX - rect.left - offset.x;
        const canvasY = e.clientY - rect.top - offset.y;
        setEraserTrail([{ x: canvasX, y: canvasY }]);
      }
      return;
    } else if (e.button === 0 && !pendingEvent && !editingEventId && !editingBlockId && !pendingBlock) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
      const yearOffset = snapYearOffsetToGrid(rawYearOffset);
      const canvasY = (e.clientY - rect.top - offset.y);
      const timeStr = offsetToDate(yearOffset);

      if (activeTool === 'block') {
        const row = Math.floor(canvasY / 60);
        const existing = findTimeBlockAtCell(row, yearOffset);
        if (existing) {
          openTimeBlockEditor(existing);
          return;
        }
        setCurrentColor("#fbbf24");
        setCurrentCategory("其他");
        setPendingBlock({
          startX: yearOffset,
          currentX: yearOffset,
          y: row,
          startTime: timeStr,
          endTime: timeStr
        });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (resizingBlock) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const yearOffset = snapYearOffsetToGrid(rawYearOffset);
        const newTimeStr = offsetToDate(yearOffset);
        
        setTimeBlocks(prev => prev.map(b => {
          if (b.id === resizingBlock.id) {
            if (resizingBlock.edge === 'left') {
              const safeTime = newTimeStr >= b.endTime ? b.endTime : newTimeStr;
              return { ...b, startTime: safeTime };
            } else {
              const safeTime = newTimeStr <= b.startTime ? b.startTime : newTimeStr;
              return { ...b, endTime: safeTime };
            }
          }
          return b;
        }));
        
        if (editingBlockId === resizingBlock.id) {
          if (resizingBlock.edge === 'left') {
            const safeTime = newTimeStr >= currentEndTime ? currentEndTime : newTimeStr;
            setCurrentTime(safeTime);
          } else {
            const safeTime = newTimeStr <= currentTime ? currentTime : newTimeStr;
            setCurrentTimeEnd(safeTime);
          }
        }
      }
    } else if (currentStroke && activeTool === 'draw') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const canvasY = (e.clientY - rect.top - offset.y);
        setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, { x: rawYearOffset, y: canvasY }] } : null);
      }
    } else if (isErasing && activeTool === 'eraser') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const canvasX = e.clientX - rect.left - offset.x;
        const canvasY = e.clientY - rect.top - offset.y;
        
        setEraserTrail(prev => [...prev, { x: canvasX, y: canvasY }]);

        setStrokes(prevStrokes => prevStrokes.filter(stroke => {
          const hit = stroke.points.some(p => {
            const px = p.x * pixelsPerYear;
            const py = p.y;
            // 距离计算，如果橡皮擦半径是 30
            const dist = Math.sqrt(Math.pow(px - canvasX, 2) + Math.pow(py - canvasY, 2));
            return dist < 30;
          });
          return !hit; // 没碰到的保留
        }));
      }
    } else if (isPanning) {
      setOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
    } else if (pendingBlock && !editingBlockId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const yearOffset = snapYearOffsetToGrid(rawYearOffset);
        const startTime = pendingBlock.startX < yearOffset ? pendingBlock.startTime : offsetToDate(yearOffset);
        const endTime = pendingBlock.startX < yearOffset ? offsetToDate(yearOffset) : pendingBlock.startTime;
        
        setPendingBlock(prev => prev ? {
          ...prev,
          currentX: yearOffset,
          startTime,
          endTime
        } : null);
      }
    }
  };

  const handleMouseUp = () => {
    if (resizingBlock) {
      setResizingBlock(null);
      return;
    }
    if (currentStroke) {
      setStrokes(prev => [...prev, currentStroke]);
      setCurrentStroke(null);
    }
    if (isErasing) {
      setIsErasing(false);
      setEraserTrail([]);
    }

    if (isPanning) {
      setIsPanning(false);
    } else if (pendingBlock && activeTool === 'block' && !editingBlockId) {
      const startTime = pendingBlock.startTime;
      let endTime = pendingBlock.endTime;
      if (startTime === endTime) {
        const end = new Date(startTime);
        if (currentZoom.tickType === 'month') {
          end.setMonth(end.getMonth() + 1);
        } else if (currentZoom.tickType === 'quarter') {
          end.setMonth(end.getMonth() + 3);
        } else {
          end.setFullYear(end.getFullYear() + 1);
        }
        endTime = end.toISOString().split('T')[0];
      }

      const startOffset = dateToOffset(startTime);
      const endOffset = dateToOffset(endTime);
      const rangeStart = Math.min(startOffset, endOffset);
      const rangeEnd = Math.max(startOffset, endOffset);
      if (isOverlappingTimeBlock(pendingBlock.y, rangeStart, rangeEnd)) {
        alert('时间块不能重叠');
        setPendingBlock(null);
        return;
      }

      const label = getNextTimeBlockLabel();
      const newBlock: TimeBlock = {
        id: Math.random().toString(36).slice(2, 11),
        startTime,
        endTime,
        label,
        color: currentColor,
        category: currentCategory,
        y: pendingBlock.y,
      };
      setTimeBlocks(prev => [...prev, newBlock]);
      setPendingBlock(null);
      setEditingBlockId(null);
      setEditingEventId(null);
      setPendingEvent(null);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (isPanning || resizingBlock) return;
    if (authMode) {
      setAuthMode(null);
      return;
    }

    if (activeTool === 'draw' || activeTool === 'eraser') return;

    // 只有在点或方块模式下才允许通过点击创建
    if (activeTool !== 'point' && activeTool !== 'block') {
      if (pendingEvent || editingEventId || pendingBlock || editingBlockId) {
        cancelEdit();
      }
      return;
    }

    if (e.button === 0 && !e.altKey && !e.ctrlKey && activeTool === 'block') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const yearOffset = snapYearOffsetToGrid(rawYearOffset);
        const canvasY = (e.clientY - rect.top - offset.y);
        const row = Math.floor(canvasY / 60);
        const existing = findTimeBlockAtCell(row, yearOffset);
        if (existing) {
          openTimeBlockEditor(existing);
          return;
        }
      }
    }

    if ((e.target as HTMLElement).closest('rect') || (e.target as HTMLElement).closest('circle')) {
      return;
    }

    if (e.button === 0 && !e.altKey && !e.ctrlKey) {
      // 如果当前已经在编辑状态，点击空白处则取消
      if (pendingEvent || editingEventId || pendingBlock || editingBlockId) {
        cancelEdit();
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const yearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const canvasY = (e.clientY - rect.top - offset.y);
        const timeStr = offsetToDate(yearOffset);
        
        if (activeTool === 'point') {
          // 初始化点事件创建状态
          setPendingEvent({ x: yearOffset, y: canvasY, time: timeStr });
          setEditingEventId(null);
          setCurrentLabel("新事件");
          setCurrentTime(timeStr);
          setCurrentTimeEnd(timeStr);
          setCurrentColor("#fbbf24");
          setCurrentCategory("其他");
        }
        // 注意：方块模式的初始化主要在 handleMouseDown/Up 中处理
      }
    }
  };

  const startEditing = (event: CanvasEvent) => {
    setEditingBlockId(null);
    setPendingBlock(null);
    setPendingEvent({ x: dateToOffset(event.time), y: event.y, time: event.time });
    setEditingEventId(event.id);
    setCurrentLabel(event.label);
    setCurrentTime(event.time);
    setCurrentTimeEnd(event.time);
    setCurrentColor(event.color);
    setCurrentCategory("其他");
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

  const saveTimeBlock = async () => {
    if (!currentLabel.trim() || !currentTime || !currentEndTime) {
      cancelEdit();
      return;
    }

    const fallbackRow = Math.floor(400 / 60);
    const newBlockData = {
      startTime: currentTime,
      endTime: currentEndTime,
      label: currentLabel.trim(),
      color: currentColor,
      category: currentCategory,
      y: editingBlockId ? (timeBlocks.find(b => b.id === editingBlockId)?.y ?? fallbackRow) : (pendingBlock?.y ?? fallbackRow)
    };

    const startOffset = dateToOffset(newBlockData.startTime);
    const endOffset = dateToOffset(newBlockData.endTime);
    const rangeStart = Math.min(startOffset, endOffset);
    const rangeEnd = Math.max(startOffset, endOffset);
    if (isOverlappingTimeBlock(newBlockData.y, rangeStart, rangeEnd, editingBlockId ?? undefined)) {
      alert('时间块不能重叠');
      return;
    }

    try {
      // TODO: 实现后端 API 支持 TimeBlock
      // const res = await fetch('/api/timeblocks', { ... });
      
      if (editingBlockId) {
        setTimeBlocks(prev => prev.map(b => b.id === editingBlockId ? { ...b, ...newBlockData } : b));
      } else {
        const newBlock: TimeBlock = {
          ...newBlockData,
          id: Math.random().toString(36).substr(2, 9),
        };
        setTimeBlocks(prev => [...prev, newBlock]);
      }
    } catch (err) {
      console.error('Error saving time block:', err);
    }
    cancelEdit();
  };

  const deleteTimeBlock = () => {
    if (editingBlockId) {
      setTimeBlocks(prev => prev.filter(b => b.id !== editingBlockId));
      cancelEdit();
    }
  };

  const getDurationText = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 365) {
      return `${(diffDays / 365.25).toFixed(1)} 年`;
    } else if (diffDays >= 30) {
      return `${(diffDays / 30.44).toFixed(1)} 月`;
    } else {
      return `${diffDays} 天`;
    }
  };

  if (!hydrated) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-[#fdf2f8] font-sans text-slate-800">
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-200/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200/20 blur-[120px] rounded-full" />
        </div>
      </main>
    );
  }

  return (
    <main 
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden bg-[#fdf2f8] font-sans text-slate-800 touch-none"
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

      {hydrated && windowSize.width > 0 && (
        <div className="fixed top-0 bottom-0 w-[2px] bg-red-500/40 z-20 pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.4)]" style={{ left: offset.x + dateToOffset(todayIso) * pixelsPerYear }}>
          <div className="absolute top-36 -left-12 w-24 text-center">
            <span className="text-[10px] font-black text-red-600/50 tracking-widest uppercase bg-white/40 px-2 py-0.5 rounded-full backdrop-blur-sm">Present</span>
          </div>
        </div>
      )}

      {/* 固定正方形网格背景层 - 复古练习本风格 */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#F7F4EB]" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(160, 140, 100, 0.15) 1px, transparent 1px), 
          linear-gradient(to bottom, rgba(160, 140, 100, 0.15) 1px, transparent 1px),
          linear-gradient(to right, rgba(160, 140, 100, 0.05) 1px, transparent 1px), 
          linear-gradient(to bottom, rgba(160, 140, 100, 0.05) 1px, transparent 1px),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E")
        `,
        backgroundSize: `
          60px 60px,
          60px 60px,
          15px 15px,
          15px 15px,
          200px 200px
        `,
        backgroundPosition: `${offset.x % 60}px ${offset.y % 60}px`,
        boxShadow: 'inset 0 0 100px rgba(160, 140, 100, 0.1)', // 添加边缘暗角，增加纸张做旧感
      }} />
      
      <div className="absolute inset-0 z-10 origin-top-left will-change-transform" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
        <div className="relative w-[40000px] h-[5000px]">
          <svg className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible">
            <defs>
              <linearGradient id="grad-yellow" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" /><stop offset="50%" stopColor="#ef4444" stopOpacity="0.6" /><stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" /></linearGradient>
              <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" /><stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" /></linearGradient>
              <linearGradient id="grad-teal" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#10b981" stopOpacity="0.2" /><stop offset="50%" stopColor="#10b981" stopOpacity="0.6" /><stop offset="100%" stopColor="#10b981" stopOpacity="0.2" /></linearGradient>
              <filter id="glow-lg"><feGaussianBlur stdDeviation="8" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
              <filter id="glow-sm"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
            </defs>

            {/* Background curves - Hidden as per user request */}
            {/* <motion.path d={`M ${-1 * pixelsPerYear},400 C ${0 * pixelsPerYear},400 ${1 * pixelsPerYear},450 ${2 * pixelsPerYear},550 S ${4 * pixelsPerYear},650 ${7 * pixelsPerYear},650`} stroke="url(#grad-yellow)" strokeWidth="32" fill="none" strokeLinecap="round" />
            <motion.path d={`M ${-0.5 * pixelsPerYear},800 C 1 * pixelsPerYear,800 ${3 * pixelsPerYear},880 ${5 * pixelsPerYear},950 S ${7 * pixelsPerYear},1050 ${9 * pixelsPerYear},1050`} stroke="url(#grad-purple)" strokeWidth="32" fill="none" strokeLinecap="round" />
            <motion.path d={`M ${0 * pixelsPerYear},1200 C 2 * pixelsPerYear,1200 ${5 * pixelsPerYear},1300 ${8 * pixelsPerYear},1380 S ${11 * pixelsPerYear},1500 ${14 * pixelsPerYear},1500`} stroke="url(#grad-teal)" strokeWidth="32" fill="none" strokeLinecap="round" /> */}

            <g className="pointer-events-auto">
              {/* Strokes */}
              <g className="strokes">
                {strokes.map(stroke => {
                  if (stroke.points.length === 0) return null;
                  const d = stroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * pixelsPerYear} ${p.y}`).join(' ');
                  return <path key={stroke.id} d={d} fill="none" stroke={stroke.color} strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" />;
                })}
                {currentStroke && (
                  <path 
                    d={currentStroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * pixelsPerYear} ${p.y}`).join(' ')} 
                    fill="none" 
                    stroke={currentStroke.color} 
                    strokeWidth={currentStroke.width} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                )}
                {/* Eraser Trail */}
                {eraserTrail.length > 0 && (
                  <path 
                    d={eraserTrail.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} 
                    fill="none" 
                    stroke="rgba(239, 68, 68, 0.4)" 
                    strokeWidth={30} 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="pointer-events-none"
                    style={{ filter: 'blur(2px)' }}
                  />
                )}
              </g>

              <AnimatePresence>
                {/* 渲染已有的 TimeBlocks */}
                {timeBlocks.map(block => {
                  const x = dateToOffset(block.startTime) * pixelsPerYear;
                  const y = block.y * 60 + 10;
                  const width = (dateToOffset(block.endTime) - dateToOffset(block.startTime)) * pixelsPerYear;
                  return (
                    <g
                      key={block.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        openTimeBlockEditor(block);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <motion.rect
                        x={x}
                        y={y}
                        width={width}
                        height={40}
                        fill={block.color}
                        fillOpacity="0.2"
                        stroke={block.color}
                        strokeWidth="2"
                        rx="8"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ fillOpacity: 0.3 }}
                      />
                      <foreignObject x={x} y={y} width={Math.max(0, width)} height={40}>
                        <div className="w-full h-full flex items-center justify-center px-3">
                          {editingBlockId === block.id ? (
                            <input
                              autoFocus
                              value={currentLabel}
                              onChange={(e) => setCurrentLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveTimeBlock();
                              }}
                              className="w-full bg-transparent border-none outline-none text-[11px] font-semibold text-slate-900 text-center"
                            />
                          ) : (
                            <div className="text-[11px] font-semibold text-slate-700 truncate whitespace-nowrap overflow-hidden max-w-full pointer-events-none">
                              {block.label}
                            </div>
                          )}
                        </div>
                      </foreignObject>
                      
                      {/* Left Drag Handle */}
                      <rect
                        x={x}
                        y={y}
                        width={10}
                        height={40}
                        fill="transparent"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingBlock({ id: block.id, edge: 'left', y: block.y });
                          if (editingBlockId !== block.id) {
                            openTimeBlockEditor(block);
                          }
                        }}
                      />
                      {/* Right Drag Handle */}
                      <rect
                        x={x + Math.max(0, width) - 10}
                        y={y}
                        width={10}
                        height={40}
                        fill="transparent"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingBlock({ id: block.id, edge: 'right', y: block.y });
                          if (editingBlockId !== block.id) {
                            openTimeBlockEditor(block);
                          }
                        }}
                      />
                    </g>
                  );
                })}

                {/* 渲染正在拖拽创建的 TimeBlock 预览 */}
                {pendingBlock && (
                  <g>
                    <rect
                      x={Math.min(pendingBlock.startX, pendingBlock.currentX) * pixelsPerYear}
                      y={pendingBlock.y * 60 + 10}
                      width={Math.abs(pendingBlock.currentX - pendingBlock.startX) * pixelsPerYear}
                      height={40}
                      fill={currentColor}
                      fillOpacity="0.3"
                      stroke={currentColor}
                      strokeWidth="2"
                      strokeDasharray="4 2"
                      rx="8"
                    />
                    <foreignObject 
                      x={Math.min(pendingBlock.startX, pendingBlock.currentX) * pixelsPerYear} 
                      y={pendingBlock.y * 60 + 10} 
                      width={Math.abs(pendingBlock.currentX - pendingBlock.startX) * pixelsPerYear} 
                      height={40}
                    >
                      <div className="w-full h-full flex items-center justify-center px-3">
                        <input
                          autoFocus
                          value={currentLabel}
                          onChange={(e) => setCurrentLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveTimeBlock();
                          }}
                          className="w-full bg-transparent border-none outline-none text-[11px] font-semibold text-slate-900 text-center"
                        />
                      </div>
                    </foreignObject>

                    {/* 时间提示条 */}
                    <foreignObject 
                      x={Math.min(pendingBlock.startX, pendingBlock.currentX) * pixelsPerYear} 
                      y={pendingBlock.y * 60 - 35} 
                      width="300" 
                      height="40"
                    >
                      <div className="flex justify-center w-full">
                        <div className="glass px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-700 whitespace-nowrap shadow-sm border border-white/60 flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-blue-500" />
                          <span>{pendingBlock.startTime} 至 {pendingBlock.endTime}</span>
                          <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-md">
                            共 {getDurationText(pendingBlock.startTime, pendingBlock.endTime)}
                          </span>
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                )}
              </AnimatePresence>

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
                {(pendingEvent || (pendingBlock && currentTime && !isPanning)) && (
                  <motion.g initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="pointer-events-auto">
                    {/* 只有在纯点事件时显示圆圈 */}
                    {pendingEvent && !editingEventId && currentTime && <circle cx={dateToOffset(currentTime) * pixelsPerYear} cy={pendingEvent.y} r="8" fill="#cbd5e1" />}
                    
                    <foreignObject 
                      x={(currentTime ? dateToOffset(currentTime) : 0) * pixelsPerYear - 140} 
                      y={(pendingEvent?.y ?? (pendingBlock ? pendingBlock.y * 60 + 10 : 400)) + 25} 
                      width="280" 
                      height="320"
                    >
                      <div className="flex flex-col items-center p-1 editing-popup" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
                        <div className="glass px-4 py-4 rounded-3xl border border-white/60 shadow-2xl flex flex-col gap-4 w-full">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {editingBlockId || (pendingBlock && activeTool === 'block') ? "时间方块" : "点事件"}
                            </span>
                            <div className="flex gap-1">
                              {["#fbbf24", "#c084fc", "#2dd4bf", "#ef4444", "#3b82f6"].map(c => (
                                <button key={c} onClick={() => setCurrentColor(c)} className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-110 ${currentColor === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''}`} style={{ backgroundColor: c }} />
                              ))}
                            </div>
                          </div>

                          {!(editingBlockId || (pendingBlock && activeTool === 'block')) && (
                            <input 
                              autoFocus 
                              type="text" 
                              value={currentLabel} 
                              onChange={e => setCurrentLabel(e.target.value)} 
                              onKeyDown={e => e.key === 'Enter' && saveEvent()}
                              placeholder="输入标题..." 
                              className="bg-transparent border-none outline-none text-lg font-bold text-slate-700 w-full placeholder:text-slate-300" 
                            />
                          )}

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 bg-white/30 rounded-xl px-3 py-2 border border-white/40">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <input type="date" value={currentTime} onChange={e => setCurrentTime(e.target.value)} className="bg-transparent border-none outline-none text-[11px] font-medium text-slate-700 w-full" />
                            </div>
                            
                            {(editingBlockId || (pendingBlock && activeTool === 'block')) && (
                              <div className="flex items-center gap-2 bg-white/30 rounded-xl px-3 py-2 border border-white/40 animate-in fade-in slide-in-from-top-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <input type="date" value={currentEndTime} onChange={e => setCurrentTimeEnd(e.target.value)} className="bg-transparent border-none outline-none text-[11px] font-medium text-slate-700 w-full" />
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 py-1">
                            {["运动", "职业", "旅行", "健康", "学习", "财务", "社交"].map(cat => (
                              <button 
                                key={cat} 
                                onClick={() => setCurrentCategory(cat)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] transition-all ${currentCategory === cat ? 'bg-slate-800 text-white shadow-md' : 'bg-white/40 text-slate-500 hover:bg-white/60'}`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button 
                              onClick={editingBlockId || (pendingBlock && activeTool === 'block') ? saveTimeBlock : saveEvent} 
                              className="flex-1 bg-slate-800 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                            >
                              <Check className="w-4 h-4 text-blue-300" /> 
                              {(editingEventId || editingBlockId) ? "保存修改" : "完成创建"}
                            </button>
                            {(editingEventId || editingBlockId) && (
                              <button onClick={editingBlockId ? deleteTimeBlock : deleteEvent} className="p-2.5 hover:bg-red-50 rounded-xl text-red-500 transition-colors" title="删除">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={cancelEdit} className="p-2.5 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors" title="取消">
                              <X className="w-4 h-4" />
                            </button>
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

      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        <div className="absolute top-10 left-10 pointer-events-auto" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
          <h1 className="text-3xl font-light tracking-wider text-slate-900/80 leading-tight">
            <span className="sr-only">时间集合体</span>
            Time Complex
          </h1>
        </div>

        {/* Top Dynamic Multi-level Timeline */}
        <div className="absolute top-4 left-0 right-0 h-20 pointer-events-none">
          <div className="relative w-full h-full">
            {dynamicTimelineTicks.map((tick: TimelineTick, i: number) => {
              const x = tick.x;

              return (
                <div key={`${tick.type}-${tick.value}-${i}`} className="absolute flex flex-col items-center" style={{ left: x, transform: 'translateX(-50%)' }}>
                  {tick.type === 'year' ? (
                    <>
                      <span className="text-[12px] font-black text-slate-700/80 mb-1">{tick.value}</span>
                      <div className={`w-3 h-3 rotate-45 border-2 ${hydrated && tick.value === todayYear ? 'border-red-500 bg-red-100 shadow-[0_0_10px_rgba(239,68,68,0.5)] scale-125' : (typeof tick.value === 'number' && tick.value % 2 === 0 ? 'border-blue-400/60 bg-blue-50/50' : 'border-slate-300/60 bg-slate-50/50')}`} />
                    </>
                  ) : (
                    <>
                      <span className="text-[9px] font-bold text-slate-500/60 mb-0.5">{tick.value}</span>
                      <div className={`rounded-full bg-slate-300/40 ${tick.type === 'quarter' ? 'w-1.5 h-1.5' : 'w-1 h-1'}`} />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 隐藏左侧分类菜单 */}
        {/* <aside className="absolute left-10 top-40 flex flex-col gap-10 pointer-events-auto" onClick={e => e.stopPropagation()}>
          {[
            { title: "Career", items: ["Career", "Money", "Skills", "Travels", "Hobbies", "Creations"], color: "text-amber-600/70" },
            { title: "Relationship", items: ["Family", "Friends"], color: "text-purple-600/70" },
            { title: "Location", items: ["World", "War", "Virus", "Country", "Religion", "Earth Year"], color: "text-indigo-600/70" }
          ].map((section) => (
            <section key={section.title}><h2 className={`text-xl font-medium ${section.color} mb-3`}>{section.title}</h2><ul className="space-y-1.5 pl-1">{section.items.map(item => <li key={item} className="cursor-pointer text-slate-400 hover:text-slate-800 transition-colors"><span className="text-base font-light">{item}</span></li>)}</ul></section>
          ))}
        </aside> */}

        <div className="absolute right-12 top-10 flex items-center gap-4 pointer-events-auto" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
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

        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
          <div suppressHydrationWarning className="glass px-3 py-3 rounded-3xl border border-white/60 shadow-2xl flex items-center gap-2">
            {/* 0. 选中模式 */}
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => switchTool('select')}
              className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'select' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <MousePointer2 className="w-6 h-6" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">选中模式</span>
            </motion.button>

            {/* 1. 创建时间方块 */}
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => switchTool('block')}
              className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'block' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <Square className="w-6 h-6" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">时间方块</span>
            </motion.button>

            {/* 2. 创建事件点 */}
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => switchTool('point')}
              className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'point' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <Circle className="w-6 h-6" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">事件点</span>
            </motion.button>

            {/* 3. 标签贴纸 */}
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => switchTool('sticker')}
              className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'sticker' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <StickyNote className="w-6 h-6" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">标签贴纸</span>
            </motion.button>

            {/* 4. 导入素材 */}
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => switchTool('import')}
              className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'import' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <Upload className="w-6 h-6" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">导入素材</span>
            </motion.button>

            {/* 5. AI 智能提取 */}
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { switchTool('ai'); setShowAiModal(true); }}
              className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'ai' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <Sparkles className="w-6 h-6" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">AI 提取</span>
            </motion.button>

            <div className="w-[1px] h-10 bg-slate-200/50 mx-2" />

            {/* 画笔 */}
            <div className="relative group/draw">
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => switchTool('draw')}
                className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'draw' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
              >
                <Pen className="w-6 h-6" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-50">画笔</span>
              </motion.button>
              
              <AnimatePresence>
                {activeTool === 'draw' && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 glass p-3 rounded-2xl flex flex-col gap-3 min-w-[140px] z-50 pointer-events-auto"
                  >
                    <div className="flex gap-1.5 justify-center flex-wrap">
                      {["#fbbf24", "#c084fc", "#2dd4bf", "#ef4444", "#3b82f6", "#1e293b", "#ffffff"].map(c => (
                        <button key={c} onClick={() => setCurrentColor(c)} className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${currentColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-125' : ''}`} style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[10px] font-bold text-slate-400">粗细</span>
                      <input type="range" min="1" max="20" value={brushWidth} onChange={e => setBrushWidth(Number(e.target.value))} className="flex-1 accent-slate-800" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 橡皮擦 */}
            <motion.button 
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => switchTool('eraser')}
              className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'eraser' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'text-slate-500 hover:bg-white/50'}`}
            >
              <Eraser className="w-6 h-6" />
              <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-red-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-50">橡皮擦 (滑动擦除)</span>
            </motion.button>

            <div className="w-[1px] h-10 bg-slate-200/50 mx-2" />

            {/* 6. 搜索定位 */}
            <motion.div 
              layout
              className={`flex items-center glass-pill transition-all duration-300 ${isSearchExpanded ? 'w-64 px-4 bg-white/40' : 'w-16 justify-center'}`}
            >
              <button 
                  onClick={() => switchTool('search')}
                  className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'search' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
                >
                  <Search className="w-6 h-6" />
                  {!isSearchExpanded && <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">搜索定位</span>}
                </button>
                
                <AnimatePresence>
                  {isSearchExpanded && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: '100%', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      className="flex items-center ml-3 overflow-hidden"
                    >
                      <input
                        autoFocus
                        type="text"
                        placeholder="搜索..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && searchResults.length > 0) {
                            scrollToEvent(searchResults[0]);
                          }
                        }}
                        className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 w-full placeholder:text-slate-400"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* 搜索结果弹窗 */}
            <AnimatePresence>
              {searchResults.length > 0 && isSearchExpanded && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="glass absolute bottom-full mb-6 w-72 right-0 overflow-y-auto rounded-3xl border border-white/60 shadow-2xl p-4 flex flex-col gap-2 custom-scrollbar"
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1">搜索结果 ({searchResults.length})</div>
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
          </div>

        <div className="absolute bottom-12 right-10 bg-white/60 backdrop-blur-xl px-5 py-2.5 rounded-full text-xs text-slate-500 border border-white/80 shadow-sm select-none pointer-events-auto"><span className="font-bold text-blue-600 mr-2">Level {currentZoom.level}</span><span className="font-medium text-slate-800">滚轮</span> 切换层级 • <span className="font-medium text-slate-800 ml-2">拖拽</span> 平移 • <span className="ml-2 font-mono">View: {currentZoom.yearsVisible}Y</span></div>

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
                      {([
                        { id: 'text', icon: FileText, label: '粘贴文本' },
                        { id: 'file', icon: Upload, label: '上传文件' },
                        { id: 'url', icon: Link, label: '网页链接' }
                      ] as const).map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setAiInputType(tab.id)}
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
