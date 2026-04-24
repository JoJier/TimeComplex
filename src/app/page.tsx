"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, List, Globe, Users, User, X, Check, Trash2, Calendar, LogIn, UserPlus, Lock, Mail, Eye, EyeOff, Undo, Sparkles, FileText, Link, Send, Loader2, Upload, MousePointer2, Square, Circle, StickyNote, Image as ImageIcon, Pen, Eraser, ChevronDown } from "lucide-react";

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

type TimelineTick = { type: 'year' | 'year_minor' | 'month' | 'quarter' | 'quarter_minor'; value: number | string; x: number };

type StrokePoint = { x: number, y: number };
type Stroke = { id: string, color: string, width: number, points: StrokePoint[] };
type CanvasSticker = { id: string, emoji: string, time: string, y: number };

// 9 Zoom Levels
const ZOOM_LEVELS = [
  { level: 1, yearsVisible: 1, tickType: 'month' },
  { level: 2, yearsVisible: 2, tickType: 'month' },
  { level: 3, yearsVisible: 4, tickType: 'quarter' },
  { level: 4, yearsVisible: 6, tickType: 'quarter' },
  { level: 5, yearsVisible: 8, tickType: 'quarter' },
  { level: 6, yearsVisible: 10, tickType: 'year' },
  { level: 7, yearsVisible: 20, tickType: 'year' },
  { level: 8, yearsVisible: 30, tickType: 'year' },
  { level: 9, yearsVisible: 40, tickType: 'year' },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BASE_DATE = new Date("2014-01-01");
const RULER_MATERIAL = {
  baseAlpha: 0.02,
  blurPx: 2,
  borderAlpha: 0.3,
  topLineAlpha: 0.35,
  gradientTopAlpha: 0.08,
  gradientBottomAlpha: 0.04,
  highlightAlpha: 0.09,
  tintAlpha: 0.03,
  shadowAlpha: 0.06,
} as const;
const HAND_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36'%3E%3Ctext x='4' y='27' font-size='24'%3E%F0%9F%91%8B%3C/text%3E%3C/svg%3E") 8 8, grab`;

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
  const [stickers, setStickers] = useState<CanvasSticker[]>([]);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const deletedStrokeIdsRef = useRef<Set<string>>(new Set());
  const deletedStickerIdsRef = useRef<Set<string>>(new Set());
  const [todayIso, setTodayIso] = useState(() => BASE_DATE.toISOString().slice(0, 10));
  const todayYear = Number(todayIso.slice(0, 4));

  const [interaction, setInteraction] = useState<{
    type: 'idle' | 'creating_event' | 'editing_event' | 'creating_block' | 'editing_block' | 'resizing_block' | 'dragging_element';
    eventId?: string;
    blockId?: string;
    x?: number;
    y?: number;
    time?: string;
    startX?: number;
    currentX?: number;
    startTime?: string;
    endTime?: string;
    edge?: 'left' | 'right';
    elementType?: 'event' | 'block';
    elementId?: string;
    offsetX?: number;
    offsetY?: number;
  }>({ type: 'idle' });

  // --- Auth Focus Refs ---
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const authSubmittingRef = useRef(false);
  const creatingEventRef = useRef(false);
  const keydownStateRef = useRef<any>(null);
  const isPersistedId = (id?: string | null) => !!id && /^\d+$/.test(String(id));
  const [currentLabel, setCurrentLabel] = useState("");
  const [currentTime, setCurrentTime] = useState("");
  const [currentEndTime, setCurrentTimeEnd] = useState("");
  const [currentColor, setCurrentColor] = useState("#fbbf24");
  const [currentCategory, setCurrentCategory] = useState("其他");

  const editingEventId = interaction.type === 'editing_event' ? interaction.eventId : null;
  const editingBlockId = interaction.type === 'editing_block' ? interaction.blockId : null;
  const pendingEvent = interaction.type === 'creating_event' ? { x: interaction.x!, y: interaction.y!, time: interaction.time! } : 
                       interaction.type === 'editing_event' ? { x: dateToOffset(currentTime || '2014-01-01'), y: interaction.y!, time: currentTime || '2014-01-01' } : null;
  const pendingBlock = interaction.type === 'creating_block' ? { startX: interaction.startX!, currentX: interaction.currentX!, y: interaction.y!, startTime: interaction.startTime!, endTime: interaction.endTime! } : 
                       interaction.type === 'editing_block' ? { startX: dateToOffset(currentTime || '2014-01-01'), currentX: dateToOffset(currentEndTime || '2014-01-01'), y: interaction.y!, startTime: currentTime || '2014-01-01', endTime: currentEndTime || '2014-01-01' } : null;
  const resizingBlock = interaction.type === 'resizing_block' ? { id: interaction.blockId!, edge: interaction.edge!, y: interaction.y! } : null;
  const draggingElement = interaction.type === 'dragging_element' ? { elementType: interaction.elementType!, elementId: interaction.elementId!, offsetX: interaction.offsetX!, offsetY: interaction.offsetY! } : null;

  const isEditingAny = () => interaction.type !== 'idle';

  const setEditingEventId = (id: string | null) => {
    if (id) setInteraction({ type: 'editing_event', eventId: id, y: events.find(e => e.id === id)?.y || 400 });
    else if (interaction.type === 'editing_event') setInteraction({ type: 'idle' });
  };
  
  const setEditingBlockId = (id: string | null | ((prev: string | null) => string | null)) => {
    if (typeof id === 'function') {
      const nextId = id(editingBlockId || null);
      if (nextId) setInteraction({ type: 'editing_block', blockId: nextId });
      else if (interaction.type === 'editing_block') setInteraction({ type: 'idle' });
    } else {
      if (id) setInteraction({ type: 'editing_block', blockId: id });
      else if (interaction.type === 'editing_block') setInteraction({ type: 'idle' });
    }
  };

  const setPendingEvent = (val: { x: number, y: number, time: string } | null) => {
    if (val) setInteraction({ type: 'creating_event', ...val });
    else if (interaction.type === 'creating_event') setInteraction({ type: 'idle' });
  };

  const setPendingBlock = (val: { startX: number, currentX: number, y: number, startTime: string, endTime: string } | null | ((prev: any) => any)) => {
    if (typeof val === 'function') {
      const nextVal = val(pendingBlock);
      if (nextVal) setInteraction({ type: 'creating_block', ...nextVal });
      else if (interaction.type === 'creating_block') setInteraction({ type: 'idle' });
    } else {
      if (val) setInteraction({ type: 'creating_block', ...val });
      else if (interaction.type === 'creating_block') setInteraction({ type: 'idle' });
    }
  };

  const setResizingBlock = (val: { id: string, edge: 'left' | 'right', y: number } | null) => {
    if (val) setInteraction({ type: 'resizing_block', blockId: val.id, edge: val.edge, y: val.y });
    else if (interaction.type === 'resizing_block') setInteraction({ type: 'idle' });
  };
  
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
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

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
    if (editingBlockId || (pendingBlock && activeTool === 'block')) {
      saveTimeBlock();
    } else if (editingEventId || (pendingEvent && !editingBlockId)) {
      saveEvent();
    }
    updateRecentColors(currentColor);
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
    setShowCategoryDropdown(false);
  };

  const [showStickerMenu, setShowStickerMenu] = useState(false);
  const [currentSticker, setCurrentSticker] = useState('⭐');

  const STICKERS_LIST = ["⭐", "🚩", "💡", "❗", "❓", "📌", "📍", "🎈", "👑", "🏆", "🚀", "🎯", "🎨", "🌈", "⚡", "🔥", "🎉", "💯"];

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

  const [undoStack, setUndoStack] = useState<{ events: CanvasEvent[], timeBlocks: TimeBlock[], strokes: Stroke[], stickers: CanvasSticker[] }[]>([]);
  const [recentColors, setRecentColors] = useState<string[]>(["#fbbf24", "#c084fc", "#2dd4bf", "#ef4444", "#3b82f6"]);

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
       pushToUndo(events, timeBlocks, strokes, stickers);
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

  const pushToUndo = (currentEvents: CanvasEvent[], currentTimeBlocks: TimeBlock[], currentStrokes: Stroke[], currentStickers: CanvasSticker[]) => {
    setUndoStack(prev => {
      const newStack = [...prev, { events: currentEvents, timeBlocks: currentTimeBlocks, strokes: currentStrokes, stickers: currentStickers }];
      if (newStack.length > 20) return newStack.slice(newStack.length - 20);
      return newStack;
    });
  };

  const [isMac, setIsMac] = useState(false);
  const [rulerY, setRulerY] = useState(16);
  const rulerDragOffsetRef = useRef(0);
  const isDraggingRulerRef = useRef(false);
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isDraggingRulerRef.current) return;
      const rulerHeight = 84;
      const minY = 8;
      const maxY = Math.max(minY, window.innerHeight - rulerHeight - 8);
      const nextTop = e.clientY - rulerDragOffsetRef.current;
      setRulerY(Math.max(minY, Math.min(maxY, nextTop)));
    };
    const handleWindowMouseUp = () => {
      isDraggingRulerRef.current = false;
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    
    const lastSnapshot = undoStack[undoStack.length - 1];
    const prevStack = undoStack.slice(0, -1);
    
    // Find what changed (specifically additions to restore deletions)
    const currentEventIds = new Set(events.map(e => e.id));
    const eventsToRestore = lastSnapshot.events.filter((e: CanvasEvent) => !currentEventIds.has(e.id));
    
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
      
      setEvents(lastSnapshot.events);
      setTimeBlocks(lastSnapshot.timeBlocks);
      setUndoStack(prevStack);
    } catch (err) {
      console.error("Undo sync failed:", err);
      alert("撤销失败，请检查网络连接");
    }
  };

  keydownStateRef.current = {
    editingEventId,
    pendingEvent,
    editingBlockId,
    pendingBlock,
    activeTool,
    showAiModal,
    isAiProcessing,
    authMode,
    showStickerMenu,
    showCategoryDropdown,
    isSearchExpanded,
    isPanning,
    currentStroke,
    isErasing,
    resizingBlock,
    draggingElement,
    handleUndo,
    cancelEdit
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const s = keydownStateRef.current;
      if (!s) return;

      // 撤销快捷键
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        s.handleUndo();
      }
      
      // 全局 Enter 保存（当存在待保存的编辑状态时），关闭编辑弹窗
      if (e.key === 'Enter') {
        if (s.editingEventId || (s.pendingEvent && !s.editingBlockId) || s.editingBlockId || (s.pendingBlock && s.activeTool === 'block')) {
          e.preventDefault();
          s.cancelEdit();
        }
      }

      // 全局 Esc 退出当前操作
      if (e.key === 'Escape') {
        e.preventDefault();

        // 先关闭顶层模态窗口
        if (s.showAiModal) {
          if (!s.isAiProcessing) setShowAiModal(false);
          return;
        }
        if (s.authMode) {
          setAuthMode(null);
          return;
        }

        // 关闭各类次级 UI
        if (s.showStickerMenu) setShowStickerMenu(false);
        if (s.showCategoryDropdown) setShowCategoryDropdown(false);
        if (s.isSearchExpanded) setIsSearchExpanded(false);

        // 清理长按拖拽定时器
        if (dragPressTimerRef.current) {
          clearTimeout(dragPressTimerRef.current);
          dragPressTimerRef.current = null;
        }

        // 结束平移
        if (s.isPanning) setIsPanning(false);

        // 结束画笔（不保存未完成笔迹）
        if (s.currentStroke) setCurrentStroke(null);

        // 结束橡皮擦，并同步已擦除的对象到后端
        if (s.isErasing) {
          setIsErasing(false);
          setEraserTrail([]);

          if (deletedStrokeIdsRef.current.size > 0) {
            deletedStrokeIdsRef.current.forEach(id => {
              fetch(`/api/strokes?id=${id}`, { method: 'DELETE' }).catch(err => console.error('Error deleting stroke:', err));
            });
            deletedStrokeIdsRef.current.clear();
          }

          if (deletedStickerIdsRef.current.size > 0) {
            deletedStickerIdsRef.current.forEach(id => {
              fetch(`/api/stickers?id=${id}`, { method: 'DELETE' }).catch(err => console.error('Error deleting sticker:', err));
            });
            deletedStickerIdsRef.current.clear();
          }
        }

        // 若存在编辑/创建/拉伸/拖拽状态，统一退出
        if (s.editingEventId || s.editingBlockId || s.pendingEvent || s.pendingBlock || s.resizingBlock || s.draggingElement) {
          s.cancelEdit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const rulerMaterial = RULER_MATERIAL;
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
    // 移除了时间块的重叠检测逻辑，现在允许时间块在同一个 y 轴位置任意重叠
    return false;
  }, []);

  const findTimeBlockAtCell = useCallback((row: number, yearOffset: number) => {
    for (const block of timeBlocks) {
      if (block.y !== row) continue;
      const r = getTimeBlockRange(block);
      if (r.start <= yearOffset && yearOffset < r.end) return block;
    }
    return null;
  }, [getTimeBlockRange, timeBlocks]);

  const openTimeBlockEditor = useCallback((block: TimeBlock) => {
    setInteraction({
      type: 'editing_block',
      blockId: block.id,
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
        const absoluteYear = 2014 + y;
        const x = offset.x + y * pixelsPerYear;
        const showYearTick = currentZoom.level === 9
          ? (absoluteYear - 2026) % 5 === 0
          : currentZoom.level === 8
            ? (absoluteYear - 2026) % 3 === 0
            : currentZoom.level === 7
              ? (absoluteYear - 2026) % 2 === 0
              : true;

        ticks.push({ type: showYearTick ? 'year' : 'year_minor', value: absoluteYear, x });
        if (currentZoom.tickType === 'month') {
          for (let m = 1; m < 12; m++) {
            ticks.push({ type: 'month', value: MONTHS[m], x: x + (m / 12) * pixelsPerYear });
          }
        } else if (currentZoom.tickType === 'quarter') {
          for (let q = 1; q < 4; q++) {
            ticks.push({ type: 'quarter', value: `Q${q+1}`, x: x + (q * 3 / 12) * pixelsPerYear });
          }
        } else if (currentZoom.level === 6) {
          // Level 6 keeps yearly labels but adds quarter supplementary ticks between years.
          for (let q = 1; q < 4; q++) {
            ticks.push({ type: 'quarter_minor', value: `Q${q+1}`, x: x + (q * 3 / 12) * pixelsPerYear });
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
    
    // Fetch events, timeblocks, and strokes from the database API
    const fetchData = async () => {
      // If NOT logged in, show initial demo events and empty blocks/strokes
      if (!isLoggedIn) {
        setEvents(INITIAL_EVENTS);
        setTimeBlocks([]);
        setStrokes([]);
        return;
      }
      
      // If logged in but user info not ready yet, wait
      if (!currentUser) {
        return;
      }

      try {
        // Fetch Events
        const resEvents = await fetch(`/api/events?userId=${currentUser.id}`);
        if (resEvents.ok) {
          const dbEvents = await resEvents.json();
          if (dbEvents && dbEvents.length > 0) {
            const processedDbEvents = dbEvents.map((ev: CanvasEvent, index: number) => ({
              ...ev,
              y: ev.y || (400 + (index % 3) * 50)
            }));
            setEvents(processedDbEvents);
          } else {
            setEvents([]);
          }
        } else {
          setEvents([]);
        }

        // Fetch TimeBlocks
        const resBlocks = await fetch(`/api/timeblocks?userId=${currentUser.id}`);
        if (resBlocks.ok) {
          const dbBlocks = await resBlocks.json();
          setTimeBlocks(dbBlocks && dbBlocks.length > 0 ? dbBlocks : []);
        }

        // Fetch Strokes
        const resStrokes = await fetch(`/api/strokes?userId=${currentUser.id}`);
        if (resStrokes.ok) {
          const dbStrokes = await resStrokes.json();
          setStrokes(dbStrokes && dbStrokes.length > 0 ? dbStrokes : []);
        }

        // Fetch Stickers
        const resStickers = await fetch(`/api/stickers?userId=${currentUser.id}`);
        if (resStickers.ok) {
          const dbStickers = await resStickers.json();
          setStickers(dbStickers && dbStickers.length > 0 ? dbStickers : []);
        }

      } catch (err) {
        console.error("Failed to fetch data from DB, using fallback.", err);
        setEvents([]);
        setTimeBlocks([]);
        setStrokes([]);
        setStickers([]);
      }
    };
    
    fetchData();
    
    return () => window.removeEventListener("resize", updateSize);
  }, [isLoggedIn, currentUser]); // Added currentUser to dependencies

  const handleLogin = async () => {
    if (isLoading || authSubmittingRef.current) return;
    authSubmittingRef.current = true;
    setIsLoading(true);
    setLoginError("");
    
    // Check for empty fields
    if (!username.trim()) {
      setLoginError("用户名不能为空");
      setIsLoading(false);
      authSubmittingRef.current = false;
      return;
    }
    if (!password) {
      setLoginError("密码不能为空");
      setIsLoading(false);
      authSubmittingRef.current = false;
      return;
    }

    try {
      if (authMode === 'register') {
        if (!email.trim() || !email.includes('@')) {
          setLoginError("请输入有效的邮箱地址");
          setIsLoading(false);
          authSubmittingRef.current = false;
          return;
        }
        if (password !== confirmPassword) {
          setLoginError("两次输入的密码不一致");
          setIsLoading(false);
          authSubmittingRef.current = false;
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
    } finally {
      setIsLoading(false);
      authSubmittingRef.current = false;
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

  const isCreatingBlockRef = useRef(false);
  const blockCreateStartRef = useRef<{ startX: number; row: number; startTime: string } | null>(null);
  const skipNextCanvasClickRef = useRef(false);
  const dragPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUiInteractiveTarget = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('.ui-interactive');
  const isEditingPopupTarget = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest('.editing-popup');
  const scheduleDragStart = (
    elementType: 'event' | 'block',
    elementId: string,
    e: React.MouseEvent
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
    const canvasY = e.clientY - rect.top - offset.y;

    if (dragPressTimerRef.current) {
      clearTimeout(dragPressTimerRef.current);
    }

    dragPressTimerRef.current = setTimeout(() => {
      pushToUndo(events, timeBlocks, strokes, stickers);
      setInteraction({
        type: 'dragging_element',
        elementType,
        elementId,
        offsetX: rawYearOffset,
        offsetY: canvasY
      });
      dragPressTimerRef.current = null;
    }, 220);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (isEditingPopupTarget(target) || isUiInteractiveTarget(target)) return;
    if (authMode || showAiModal) return;

    if (e.button === 1 || (e.button === 0 && (e.altKey || e.ctrlKey)) || (activeTool === 'select' && !target.closest('.draggable-element'))) { 
      setIsPanning(true);
      e.preventDefault();
    } else if (e.button === 0 && activeTool === 'draw') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const canvasY = (e.clientY - rect.top - offset.y);
        pushToUndo(events, timeBlocks, strokes, stickers);
        setCurrentStroke({ id: Math.random().toString(36).slice(2, 11), color: currentColor, width: brushWidth, points: [{ x: rawYearOffset, y: canvasY }] });
      }
      return;
    } else if (e.button === 0 && activeTool === 'eraser') {
      setIsErasing(true);
      deletedStrokeIdsRef.current.clear();
      deletedStickerIdsRef.current.clear();
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const canvasX = e.clientX - rect.left - offset.x;
        const canvasY = e.clientY - rect.top - offset.y;
        setEraserTrail([{ x: canvasX, y: canvasY }]);
      }
      return;
    } else if (e.button === 0 && (activeTool === 'block' || !isEditingAny())) {
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
          blockCreateStartRef.current = null;
          openTimeBlockEditor(existing);
          return;
        }
        // Block mode rule: while editing, do not create another block.
        if (isEditingAny()) return;
        // Arm creation first, and start only when the cursor actually drags.
        blockCreateStartRef.current = { startX: yearOffset, row, startTime: timeStr };
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingElement) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const canvasY = (e.clientY - rect.top - offset.y);

        if (draggingElement.elementType === 'event') {
          setEvents(prev => prev.map(ev => {
            if (ev.id === draggingElement.elementId) {
              return { ...ev, y: canvasY };
            }
            return ev;
          }));
          if (editingEventId === draggingElement.elementId) {
            setInteraction(prev => ({ ...prev, y: canvasY }));
          }
        } else if (draggingElement.elementType === 'block') {
          const row = Math.floor(canvasY / 60);
          setTimeBlocks(prev => prev.map(b => {
            if (b.id === draggingElement.elementId) {
              return { ...b, y: row };
            }
            return b;
          }));
          if (editingBlockId === draggingElement.elementId) {
            setInteraction(prev => ({ ...prev, y: row }));
          }
        }
      }
    } else if (resizingBlock) {
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

        const hitStrokes = strokes.filter(stroke => {
          return stroke.points.some(p => {
            const px = p.x * pixelsPerYear;
            const py = p.y;
            return Math.sqrt(Math.pow(px - canvasX, 2) + Math.pow(py - canvasY, 2)) < 30;
          });
        });

        if (hitStrokes.length > 0) {
          const newHits = hitStrokes.filter(s => !deletedStrokeIdsRef.current.has(s.id));
          if (newHits.length > 0) {
            pushToUndo(events, timeBlocks, strokes, stickers);
            newHits.forEach(s => deletedStrokeIdsRef.current.add(s.id));
            setStrokes(prev => prev.filter(s => !deletedStrokeIdsRef.current.has(s.id)));
          }
        }

        const hitStickers = stickers.filter(s => {
          const px = dateToOffset(s.time) * pixelsPerYear;
          const py = s.y;
          return Math.sqrt(Math.pow(px - canvasX, 2) + Math.pow(py - canvasY, 2)) < 40;
        });

        if (hitStickers.length > 0) {
          const newHits = hitStickers.filter(s => !deletedStickerIdsRef.current.has(s.id));
          if (newHits.length > 0) {
            pushToUndo(events, timeBlocks, strokes, stickers);
            newHits.forEach(s => deletedStickerIdsRef.current.add(s.id));
            setStickers(prev => prev.filter(s => !deletedStickerIdsRef.current.has(s.id)));
          }
        }
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
    } else if (activeTool === 'block' && blockCreateStartRef.current && !editingBlockId) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rawYearOffset = (e.clientX - rect.left - offset.x) / pixelsPerYear;
        const yearOffset = snapYearOffsetToGrid(rawYearOffset);
        const armed = blockCreateStartRef.current;
        if (yearOffset !== armed.startX) {
          isCreatingBlockRef.current = true;
          setCurrentColor("#fbbf24");
          setCurrentCategory("其他");
          setCurrentLabel(getNextTimeBlockLabel());
          setInteraction({
            type: 'creating_block',
            startX: armed.startX,
            currentX: yearOffset,
            y: armed.row,
            startTime: armed.startTime,
            endTime: offsetToDate(yearOffset)
          });
          blockCreateStartRef.current = null;
        }
      }
    }
  };

  const handleMouseUp = async () => {
    if (dragPressTimerRef.current) {
      clearTimeout(dragPressTimerRef.current);
      dragPressTimerRef.current = null;
    }

    if (draggingElement) {
      if (draggingElement.elementType === 'event') {
        const ev = events.find(e => e.id === draggingElement.elementId);
        if (ev) {
          try {
            await fetch('/api/events', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...ev, userId: currentUser?.id }),
            });
          } catch (err) {
            console.error("Failed to update event position in DB", err);
          }
        }
      } else if (draggingElement.elementType === 'block') {
        const block = timeBlocks.find(b => b.id === draggingElement.elementId);
        if (block) {
          try {
            await fetch('/api/timeblocks', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(block),
            });
          } catch (err) {
            console.error("Failed to update block position in DB", err);
          }
        }
      }
      setInteraction({ type: 'idle' });
      return;
    }
    if (resizingBlock) {
      // 拖拽调整边缘结束时，保存修改到数据库
      const block = timeBlocks.find(b => b.id === resizingBlock.id);
      if (block) {
        try {
          await fetch('/api/timeblocks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(block),
          });
        } catch (err) {
          console.error("Failed to update block size in DB", err);
        }
      }
      if (block) {
        setInteraction({ type: 'editing_block', blockId: block.id, y: block.y });
      } else {
        setResizingBlock(null);
      }
      return;
    }
    if (currentStroke) {
      setStrokes(prev => [...prev, currentStroke]);
      // Save stroke to DB
      try {
        const res = await fetch('/api/strokes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...currentStroke, userId: currentUser?.id })
        });
        const data = await res.json();
        // Update the stroke with the real DB id
        if (data.success && data.id) {
          setStrokes(prev => prev.map(s => s.id === currentStroke.id ? { ...s, id: data.id.toString() } : s));
        }
      } catch (err) {
        console.error("Save stroke error:", err);
      }
      setCurrentStroke(null);
    }
    if (isErasing) {
      setIsErasing(false);
      setEraserTrail([]);
      
      // Sync deletions to database
      if (deletedStrokeIdsRef.current.size > 0) {
        deletedStrokeIdsRef.current.forEach(id => {
          fetch(`/api/strokes?id=${id}`, { method: 'DELETE' }).catch(err => console.error('Error deleting stroke:', err));
        });
        deletedStrokeIdsRef.current.clear();
      }
      
      if (deletedStickerIdsRef.current.size > 0) {
        deletedStickerIdsRef.current.forEach(id => {
          fetch(`/api/stickers?id=${id}`, { method: 'DELETE' }).catch(err => console.error('Error deleting sticker:', err));
        });
        deletedStickerIdsRef.current.clear();
      }
    }

    if (isPanning) {
      setIsPanning(false);
    } else if (pendingBlock && activeTool === 'block' && !editingBlockId) {
      blockCreateStartRef.current = null;
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

      const label = currentLabel || getNextTimeBlockLabel();
      const newBlockData = {
        startTime,
        endTime,
        label,
        color: currentColor,
        category: currentCategory,
        y: pendingBlock.y,
        userId: currentUser?.id
      };

      pushToUndo(events, timeBlocks, strokes, stickers);
      
      // 乐观更新 UI，立即创建
      const tempId = Math.random().toString(36).substr(2, 9);
      const newBlock: TimeBlock = { ...newBlockData, id: tempId };
      setTimeBlocks(prev => [...prev, newBlock]);
      
      // 自动进入编辑状态
      openTimeBlockEditor(newBlock);
      // Prevent the trailing click (after mouseup) from immediately canceling this fresh edit session.
      skipNextCanvasClickRef.current = true;

      // 后台同步到数据库
      fetch('/api/timeblocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBlockData),
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.id) {
          const realId = data.id.toString();
          // 替换为真实的数据库 ID
          setTimeBlocks(prev => prev.map(b => b.id === tempId ? { ...b, id: realId } : b));
          // 如果当前还在编辑这个块，也要更新 editingBlockId
          setEditingBlockId(prev => prev === tempId ? realId : prev);

          // If user has edited fields while waiting for POST, sync latest editor state to DB once real ID is available.
          fetch('/api/timeblocks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: realId,
              startTime: currentTime || newBlockData.startTime,
              endTime: currentEndTime || newBlockData.endTime,
              label: (currentLabel || newBlockData.label).trim(),
              color: currentColor || newBlockData.color,
              category: currentCategory || newBlockData.category
            }),
          }).catch(err => console.error("Sync block after ID mapping error:", err));
        }
      })
      .catch(err => console.error("Save block error:", err));
    } else if (activeTool === 'block' && blockCreateStartRef.current) {
      // Click without dragging in block mode should not create a block.
      blockCreateStartRef.current = null;
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (skipNextCanvasClickRef.current) {
      skipNextCanvasClickRef.current = false;
      return;
    }
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (isUiInteractiveTarget(target)) return;
    if (isPanning || resizingBlock) return;
    if (authMode) {
      setAuthMode(null);
      return;
    }

    if (activeTool === 'draw' || activeTool === 'eraser') return;

    if (isCreatingBlockRef.current) {
      isCreatingBlockRef.current = false;
      return;
    }

    // 只有在点、方块或贴纸模式下才允许通过点击创建
    if (activeTool !== 'point' && activeTool !== 'block' && activeTool !== 'sticker') {
      if (isEditingAny()) {
        cancelEdit();
      }
      return;
    }

    if ((e.target as HTMLElement).closest('rect') || (e.target as HTMLElement).closest('circle') || (e.target as HTMLElement).closest('text')) {
      return;
    }

    if (e.button === 0 && !e.altKey && !e.ctrlKey) {
      // 如果当前已经在编辑状态，点击空白处则取消
      if (isEditingAny()) {
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
          setInteraction({ type: 'creating_event', x: yearOffset, y: canvasY, time: timeStr });
          setCurrentLabel("新事件");
          setCurrentTime(timeStr);
          setCurrentTimeEnd(timeStr);
          setCurrentColor("#fbbf24");
          setCurrentCategory("其他");
        } else if (activeTool === 'sticker') {
          pushToUndo(events, timeBlocks, strokes, stickers);
          const newStickerData = { emoji: currentSticker, time: timeStr, y: canvasY, userId: currentUser?.id || null };
          const tempId = Math.random().toString(36).substr(2, 9);
          setStickers(prev => [...prev, { ...newStickerData, id: tempId }]);

          fetch('/api/stickers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStickerData),
          })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.id) {
              setStickers(prev => prev.map(s => s.id === tempId ? { ...s, id: data.id.toString() } : s));
            }
          })
          .catch(err => console.error("Save sticker error:", err));
        }
        // 注意：方块模式的初始化主要在 handleMouseDown/Up 中处理
      }
    }
  };

  const updateRecentColors = (newColor: string) => {
    setRecentColors(prev => {
      // 只有在最终保存（或者关闭颜色选择器）时，或者新颜色确实不在最近颜色中时，我们才更新
      // 但为了简单和用户体验，我们依然允许它更新，只是做个轻量级去重
      // 如果最新一个颜色和新颜色一样，就不需要频繁插入
      if (prev[0] === newColor) return prev;
      
      const filtered = prev.filter(c => c !== newColor);
      return [newColor, ...filtered].slice(0, 5);
    });
  };

  const handleColorChange = (c: string) => {
    setCurrentColor(c);
  };

  const startEditing = (event: CanvasEvent) => {
    setInteraction({ type: 'editing_event', eventId: event.id, y: event.y });
    setCurrentLabel(event.label);
    setCurrentTime(event.time);
    setCurrentTimeEnd(event.time);
    setCurrentColor(event.color);
    updateRecentColors(event.color);
    setCurrentCategory("其他");
  };

  const saveEvent = async (overrideTime?: string, overrideLabel?: string, overrideColor?: string, overrideCategory?: string) => {
    const timeToSave = overrideTime || currentTime;
    const labelToSave = overrideLabel || currentLabel;
    const colorToSave = overrideColor || currentColor;

    if (!labelToSave.trim() || !timeToSave) {
      return;
    }

    try {
      if (editingEventId) {
        const existingEvent = events.find(e => e.id === editingEventId);
        // Only update if there are actual changes
        if (existingEvent && existingEvent.label === labelToSave.trim() && existingEvent.time === timeToSave && existingEvent.color === colorToSave) {
          return;
        }

        const updateData = {
          id: editingEventId,
          label: labelToSave.trim(),
          time: timeToSave,
          color: colorToSave,
          y: existingEvent?.y || 400,
          userId: currentUser?.id
        };

        const res = await fetch('/api/events', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        if (!res.ok) throw new Error('Failed to update event in DB');

        setEvents(prev => prev.map(ev => 
          ev.id === editingEventId ? { ...ev, label: labelToSave.trim(), time: timeToSave, color: colorToSave } : ev
        ));
      } else if (pendingEvent) {
        if (creatingEventRef.current) return;
        creatingEventRef.current = true;
        const newEventData = {
          time: timeToSave,
          y: pendingEvent.y,
          label: labelToSave.trim(),
          color: colorToSave,
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
        // Remove pendingEvent to transition to editing state
        setInteraction({ type: 'editing_event', eventId: newEvent.id, y: newEvent.y });
        creatingEventRef.current = false;
      }
    } catch (err) {
      console.error('Error saving event:', err);
      creatingEventRef.current = false;
    }
  };

  const deleteEvent = async () => {
    if (editingEventId) {
      try {
        pushToUndo(events, timeBlocks, strokes, stickers);
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

  const saveTimeBlock = async (overrideStartTime?: string, overrideEndTime?: string, overrideLabel?: string, overrideColor?: string, overrideCategory?: string) => {
    const startTimeToSave = overrideStartTime || currentTime;
    const endTimeToSave = overrideEndTime || currentEndTime;
    const labelToSave = overrideLabel || currentLabel;
    const colorToSave = overrideColor || currentColor;
    const categoryToSave = overrideCategory || currentCategory;

    if (!labelToSave.trim() || !startTimeToSave || !endTimeToSave) {
      return;
    }

    const fallbackRow = Math.floor(400 / 60);
    const newBlockData = {
      startTime: startTimeToSave,
      endTime: endTimeToSave,
      label: labelToSave.trim(),
      color: colorToSave,
      category: categoryToSave,
      y: editingBlockId ? (timeBlocks.find(b => b.id === editingBlockId)?.y ?? fallbackRow) : (pendingBlock?.y ?? fallbackRow),
      userId: currentUser?.id
    };

    try {
      if (editingBlockId) {
        // If the block is still using a temporary client ID, update local state only.
        // The backend sync will be completed after the real DB ID is returned.
        if (!isPersistedId(editingBlockId)) {
          setTimeBlocks(prev => prev.map(b => b.id === editingBlockId ? { ...b, ...newBlockData } : b));
          return;
        }

        const existingBlock = timeBlocks.find(b => b.id === editingBlockId);
        if (existingBlock && existingBlock.startTime === startTimeToSave && existingBlock.endTime === endTimeToSave && existingBlock.label === labelToSave.trim() && existingBlock.color === colorToSave && existingBlock.category === categoryToSave) {
          return;
        }

        await fetch('/api/timeblocks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...newBlockData, id: editingBlockId }),
        });
        
        setTimeBlocks(prev => prev.map(b => b.id === editingBlockId ? { ...b, ...newBlockData } : b));
      } else {
        const res = await fetch('/api/timeblocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newBlockData),
        });
        const data = await res.json();
        
        const newBlock: TimeBlock = {
          ...newBlockData,
          id: data.id ? data.id.toString() : Math.random().toString(36).substr(2, 9),
        };
        setTimeBlocks(prev => [...prev, newBlock]);
        setInteraction({ type: 'editing_block', blockId: newBlock.id });
      }
    } catch (err) {
      console.error('Error saving time block:', err);
    }
  };

  const deleteTimeBlock = async () => {
    if (editingBlockId) {
      try {
        pushToUndo(events, timeBlocks, strokes, stickers);
        await fetch(`/api/timeblocks?id=${editingBlockId}`, {
          method: 'DELETE',
        });
        setTimeBlocks(prev => prev.filter(b => b.id !== editingBlockId));
        cancelEdit();
      } catch (err) {
        console.error('Error deleting time block:', err);
      }
    }
  };

  const deleteSticker = async (id: string) => {
    try {
      pushToUndo(events, timeBlocks, strokes, stickers);
      await fetch(`/api/stickers?id=${id}`, {
        method: 'DELETE',
      });
      setStickers(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting sticker:', err);
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

  // Virtualization bounds calculation
  const visibleBounds = useMemo(() => {
    // We add a buffer area (e.g. 1000px) so items just off-screen are rendered,
    // ensuring smooth scrolling and panning without sudden pop-ins.
    const bufferX = windowSize.width || 1000;
    const bufferY = windowSize.height || 800;
    return {
      minX: -offset.x - bufferX,
      maxX: -offset.x + windowSize.width + bufferX,
      minY: -offset.y - bufferY,
      maxY: -offset.y + windowSize.height + bufferY,
    };
  }, [offset.x, offset.y, windowSize.width, windowSize.height]);

  const visibleEvents = useMemo(() => {
    return events.filter(ev => {
      if (ev.id === editingEventId) return true; // Always render the event being edited
      const x = dateToOffset(ev.time) * pixelsPerYear;
      const y = ev.y;
      return x >= visibleBounds.minX && x <= visibleBounds.maxX &&
             y >= visibleBounds.minY && y <= visibleBounds.maxY;
    });
  }, [events, visibleBounds, pixelsPerYear, editingEventId]);

  const visibleTimeBlocks = useMemo(() => {
    return timeBlocks.filter(block => {
      if (block.id === editingBlockId) return true; // Always render the block being edited
      const startX = dateToOffset(block.startTime) * pixelsPerYear;
      const endX = dateToOffset(block.endTime) * pixelsPerYear;
      const y = block.y * 60;
      return endX >= visibleBounds.minX && startX <= visibleBounds.maxX &&
             y >= visibleBounds.minY && y <= visibleBounds.maxY;
    });
  }, [timeBlocks, visibleBounds, pixelsPerYear, editingBlockId]);

  const visibleStrokes = useMemo(() => {
    return strokes.filter(stroke => {
      if (stroke.points.length === 0) return false;
      // Quick bounds check for stroke
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < stroke.points.length; i += Math.max(1, Math.floor(stroke.points.length / 20))) { // sample up to 20 points for speed
        const p = stroke.points[i];
        const px = p.x * pixelsPerYear;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return maxX >= visibleBounds.minX && minX <= visibleBounds.maxX &&
             maxY >= visibleBounds.minY && minY <= visibleBounds.maxY;
    });
  }, [strokes, visibleBounds, pixelsPerYear]);

  const visibleStickers = useMemo(() => {
    return stickers.filter(sticker => {
      const x = dateToOffset(sticker.time) * pixelsPerYear;
      const y = sticker.y;
      return x >= visibleBounds.minX && x <= visibleBounds.maxX &&
             y >= visibleBounds.minY && y <= visibleBounds.maxY;
    });
  }, [stickers, visibleBounds, pixelsPerYear]);

  if (!hydrated) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-[#F7F4EB] font-sans text-slate-800 touch-none" style={{ cursor: 'crosshair' }}>
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
          backgroundPosition: `0px 0px`,
          boxShadow: 'inset 0 0 100px rgba(160, 140, 100, 0.1)',
        }} />
      </main>
    );
  }

  return (
    <main 
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden bg-[#F7F4EB] font-sans text-slate-800 touch-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
      style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
    >
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
        backgroundPosition: `0px 0px`,
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
              {/* Stickers */}
              <g className="stickers">
                {visibleStickers.map(sticker => (
                  <text
                    key={sticker.id}
                    x={dateToOffset(sticker.time) * pixelsPerYear}
                    y={sticker.y}
                    fontSize="32"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ cursor: activeTool === 'eraser' ? 'crosshair' : 'default', userSelect: 'none' }}
                  >
                    {sticker.emoji}
                  </text>
                ))}
              </g>

              {/* Strokes */}
              <g className="strokes">
                {visibleStrokes.map(stroke => {
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
                {visibleTimeBlocks.map(block => {
                  const x = dateToOffset(block.startTime) * pixelsPerYear;
                  const y = block.y * 60 + 10;
                  const width = (dateToOffset(block.endTime) - dateToOffset(block.startTime)) * pixelsPerYear;
                  return (
                    <g
                      key={block.id}
                      className="draggable-element"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (activeTool === 'draw' || activeTool === 'eraser') return;
                        if (activeTool === 'select') return;
                        openTimeBlockEditor(block);
                      }}
                      onMouseDown={(e) => {
                        if (activeTool === 'select') {
                          e.stopPropagation();
                          scheduleDragStart('block', block.id, e);
                        }
                      }}
                      style={{ cursor: activeTool === 'select' ? 'grab' : 'pointer' }}
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
                          if (activeTool === 'draw' || activeTool === 'eraser') return;
                          if (editingBlockId !== block.id) {
                            openTimeBlockEditor(block);
                          }
                          setResizingBlock({ id: block.id, edge: 'left', y: block.y });
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
                          if (activeTool === 'draw' || activeTool === 'eraser') return;
                          if (editingBlockId !== block.id) {
                            openTimeBlockEditor(block);
                          }
                          setResizingBlock({ id: block.id, edge: 'right', y: block.y });
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
                {visibleEvents.map(event => (
                  <Marker
                    key={event.id}
                    x={dateToOffset(event.time) * pixelsPerYear}
                    y={event.y}
                    color={event.color}
                    label={event.label}
                    onClick={() => {
                      if (activeTool === 'draw' || activeTool === 'eraser') return;
                      if (activeTool === 'select') return;
                      startEditing(event);
                    }}
                    onMouseDown={(e) => {
                      if (activeTool === 'select') {
                        e.stopPropagation();
                        scheduleDragStart('event', event.id, e);
                      }
                    }}
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
                      style={{ overflow: 'visible' }}
                    >
                      <div className="flex flex-col items-center p-1 editing-popup" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
                        <div className="glass px-4 py-4 rounded-[20px] border border-white/60 shadow-xl flex flex-col gap-4 w-full bg-white/70 backdrop-blur-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-slate-400 tracking-wider">
                              {editingBlockId || (pendingBlock && activeTool === 'block') ? "时间方块" : "点事件"}
                            </span>
                            <div className="flex items-center gap-1.5 relative">
                              {/* 常用颜色 */}
                              {recentColors.map(c => (
                                <button 
                                  key={c} 
                                  onClick={() => {
                                    handleColorChange(c);
                                    updateRecentColors(c);
                                    if (editingBlockId || (pendingBlock && activeTool === 'block')) {
                                      saveTimeBlock(currentTime, currentEndTime, currentLabel, c, currentCategory);
                                    } else {
                                      saveEvent(currentTime, currentLabel, c, currentCategory);
                                    }
                                  }} 
                                  className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${currentColor === c ? 'ring-2 ring-offset-2 ring-slate-300 scale-110' : ''}`} 
                                  style={{ backgroundColor: c }} 
                                />
                              ))}
                              {/* 更多颜色（调色盘） */}
                              <div className="relative ml-1 w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center bg-white shadow-sm hover:bg-slate-50 transition-colors overflow-hidden cursor-pointer pointer-events-auto">
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-80 pointer-events-none" />
                                <input 
                                  type="color" 
                                  value={currentColor} 
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => {
                                    handleColorChange(e.target.value);
                                    if (editingBlockId || (pendingBlock && activeTool === 'block')) {
                                      saveTimeBlock(currentTime, currentEndTime, currentLabel, e.target.value, currentCategory);
                                    } else {
                                      saveEvent(currentTime, currentLabel, e.target.value, currentCategory);
                                    }
                                  }}
                                  onBlur={() => updateRecentColors(currentColor)}
                                  className="absolute inset-[-10px] w-[200%] h-[200%] opacity-0 cursor-pointer pointer-events-auto"
                                />
                              </div>
                            </div>
                          </div>

                          {!(editingBlockId || (pendingBlock && activeTool === 'block')) && (
                            <input 
                              autoFocus 
                              type="text" 
                              value={currentLabel} 
                              onChange={e => {
                                setCurrentLabel(e.target.value);
                                saveEvent(currentTime, e.target.value, currentColor, currentCategory);
                              }} 
                              onKeyDown={e => e.key === 'Enter' && cancelEdit()}
                              placeholder="输入标题..." 
                              className="bg-transparent border-none outline-none text-lg font-bold text-slate-700 w-full placeholder:text-slate-300" 
                            />
                          )}

                          <div className="flex flex-col gap-2.5">
                            <div className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2.5 border border-white/80 shadow-sm transition-colors focus-within:border-blue-200 focus-within:bg-white">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <input 
                                type="date" 
                                value={currentTime} 
                                onChange={e => {
                                  setCurrentTime(e.target.value);
                                  if (editingBlockId || (pendingBlock && activeTool === 'block')) {
                                    saveTimeBlock(e.target.value, currentEndTime, currentLabel, currentColor, currentCategory);
                                  } else {
                                    saveEvent(e.target.value, currentLabel, currentColor, currentCategory);
                                  }
                                }} 
                                onKeyDown={e => e.key === 'Enter' && cancelEdit()}
                                className="bg-transparent border-none outline-none text-[13px] font-semibold text-slate-600 text-center w-full flex-1 mx-2" 
                              />
                              <Calendar className="w-4 h-4 text-slate-400 opacity-0" />
                            </div>
                            
                            {(editingBlockId || (pendingBlock && activeTool === 'block')) && (
                              <div className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2.5 border border-white/80 shadow-sm transition-colors focus-within:border-blue-200 focus-within:bg-white animate-in fade-in slide-in-from-top-1">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <input 
                                  type="date" 
                                  value={currentEndTime} 
                                  onChange={e => {
                                    setCurrentTimeEnd(e.target.value);
                                    saveTimeBlock(currentTime, e.target.value, currentLabel, currentColor, currentCategory);
                                  }} 
                                  onKeyDown={e => e.key === 'Enter' && cancelEdit()}
                                  className="bg-transparent border-none outline-none text-[13px] font-semibold text-slate-600 text-center w-full flex-1 mx-2" 
                                />
                                <Calendar className="w-4 h-4 text-slate-400 opacity-0" />
                              </div>
                            )}
                          </div>

                          {/* 标签栏（单行） */}
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 flex items-center bg-white/60 rounded-xl px-3 py-2 border border-white/80 shadow-sm focus-within:border-blue-200 focus-within:bg-white transition-colors">
                              <input 
                                type="text"
                                placeholder="输入新标签..."
                                value={currentCategory === '其他' ? '' : currentCategory}
                                onChange={e => {
                                  const newCat = e.target.value || '其他';
                                  setCurrentCategory(newCat);
                                  if (editingBlockId || (pendingBlock && activeTool === 'block')) {
                                    saveTimeBlock(currentTime, currentEndTime, currentLabel, currentColor, newCat);
                                  } else {
                                    saveEvent(currentTime, currentLabel, currentColor, newCat);
                                  }
                                }}
                                onKeyDown={e => e.key === 'Enter' && cancelEdit()}
                                className="bg-transparent border-none outline-none text-xs font-medium text-slate-600 w-full placeholder:text-slate-400"
                              />
                            </div>
                            
                            <div className="relative">
                              <button 
                                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                className="flex items-center justify-center bg-white/60 rounded-xl px-3 py-2 border border-white/80 shadow-sm hover:bg-white transition-colors h-[34px]"
                              >
                                <span className="text-xs font-medium text-slate-500 mr-1">已有</span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              </button>
                              
                              {showCategoryDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden flex flex-col">
                                  {["运动", "职业", "旅行", "健康", "学习", "财务", "社交"].map(cat => (
                                    <button 
                                      key={cat} 
                                      onClick={() => { 
                                        setCurrentCategory(cat); 
                                        setShowCategoryDropdown(false); 
                                        if (editingBlockId || (pendingBlock && activeTool === 'block')) {
                                          saveTimeBlock(currentTime, currentEndTime, currentLabel, currentColor, cat);
                                        } else {
                                          saveEvent(currentTime, currentLabel, currentColor, cat);
                                        }
                                      }}
                                      className={`px-3 py-2 text-xs text-left hover:bg-slate-50 transition-colors ${currentCategory === cat ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-slate-600'}`}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-3">
                            {(editingEventId || editingBlockId) && (
                              <button onClick={editingBlockId ? deleteTimeBlock : deleteEvent} className="p-3 hover:bg-red-50 bg-white border border-red-100 rounded-[14px] text-red-500 transition-colors shadow-sm" title="删除">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={cancelEdit} className="flex-1 p-3 hover:bg-slate-100 bg-white border border-slate-200 rounded-[14px] text-slate-500 font-medium transition-colors shadow-sm" title="关闭">
                              关闭
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
        <div className="absolute top-10 left-10 pointer-events-auto" onClick={e => e.stopPropagation()}>
          <h1 className="text-3xl font-light tracking-wider text-slate-900/80 leading-tight">
            <span className="sr-only">时间集合体</span>
            Time Complex
          </h1>
        </div>

        {/* Draggable Glass Ruler */}
        <div
          className="absolute left-0 right-0 h-[84px] pointer-events-auto ui-interactive px-5"
          style={{ top: rulerY }}
          onMouseDown={(e) => {
            if (!(e.target instanceof Element)) return;
            if (e.target.closest('.ruler-drag-handle')) {
              const currentTop = rulerY;
              rulerDragOffsetRef.current = e.clientY - currentTop;
              isDraggingRulerRef.current = true;
              e.stopPropagation();
              e.preventDefault();
            }
          }}
        >
          <div
            className="relative w-full h-full overflow-hidden rounded-[24px]"
            style={{
              backgroundColor: `rgba(255,255,255,${rulerMaterial.baseAlpha})`,
              border: `1px solid rgba(255,255,255,${rulerMaterial.borderAlpha})`,
              backdropFilter: `blur(${rulerMaterial.blurPx}px) saturate(110%) contrast(105%)`,
              WebkitBackdropFilter: `blur(${rulerMaterial.blurPx}px) saturate(110%) contrast(105%)`,
              boxShadow: `0 10px 22px rgba(15,23,42,${rulerMaterial.shadowAlpha}), inset 0 1px 0 rgba(255,255,255,0.22)`,
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,${rulerMaterial.gradientTopAlpha}), rgba(255,255,255,0), rgba(255,255,255,${rulerMaterial.gradientBottomAlpha}))`,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 18% 18%, rgba(255,255,255,${rulerMaterial.highlightAlpha}), transparent 40%), radial-gradient(circle at 80% 72%, rgba(148,163,184,${rulerMaterial.tintAlpha}), transparent 35%)`,
              }}
            />
            <div className="absolute inset-x-0 top-0 h-[1px] pointer-events-none" style={{ backgroundColor: `rgba(255,255,255,${rulerMaterial.topLineAlpha})` }} />
            <div className="absolute left-0 right-0 top-[28px] h-[1px] bg-slate-500/16 pointer-events-none" />
            <div className="absolute left-0 right-0 top-[52px] h-[1px] bg-slate-500/12 pointer-events-none" />

            <div className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-auto">
              <div
                className="ruler-drag-handle flex items-center gap-2 rounded-full border border-white/60 bg-white/40 px-3 py-1 text-[10px] font-semibold tracking-wide text-slate-600 shadow-sm select-none"
                style={{ cursor: HAND_CURSOR }}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400/70" />
                拖拽尺子
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400/70" />
              </div>
            </div>

            <div className="relative w-full h-full pointer-events-none">
              {dynamicTimelineTicks.map((tick: TimelineTick, i: number) => {
                const x = tick.x;
                const lineWidth = tick.type === 'year' ? 1 : tick.type === 'year_minor' ? 0.9 : tick.type === 'quarter' ? 0.8 : tick.type === 'quarter_minor' ? 0.75 : 0.7;
                const edgeSegmentHeight = tick.type === 'year' ? 33 : tick.type === 'year_minor' ? 10 : tick.type === 'quarter' ? 24 : tick.type === 'quarter_minor' ? 14 : 18;
                const lineAlpha = tick.type === 'year'
                  ? (hydrated && tick.value === todayYear ? 0.8 : 0.45)
                  : tick.type === 'year_minor' ? 0.22 : tick.type === 'quarter' ? 0.26 : tick.type === 'quarter_minor' ? 0.2 : 0.2;
                const lineColor = hydrated && tick.value === todayYear && tick.type === 'year'
                  ? `rgba(239,68,68,${lineAlpha})`
                  : `rgba(71,85,105,${lineAlpha})`;
                return (
                  <div key={`${tick.type}-${tick.value}-${i}`} className="absolute h-[84px]" style={{ left: x, top: 0, transform: 'translateX(-50%)' }}>
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2"
                      style={{ width: lineWidth, height: edgeSegmentHeight, backgroundColor: lineColor }}
                    />
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2"
                      style={{ width: lineWidth, height: edgeSegmentHeight, backgroundColor: lineColor }}
                    />
                    {tick.type === 'year' && (
                      <span
                        className={`absolute left-1/2 -translate-x-1/2 text-[12px] font-black ${hydrated && tick.value === todayYear ? 'text-red-600/90' : 'text-slate-700/85'}`}
                        style={{ top: 42, transform: 'translate(-50%, -50%)' }}
                      >
                        {tick.value}
                      </span>
                    )}
                    {(tick.type === 'month' || tick.type === 'quarter') && (
                      <span
                        className={`absolute left-1/2 -translate-x-1/2 font-bold ${tick.type === 'quarter' ? 'text-[9px] text-slate-600/70' : 'text-[8px] text-slate-500/65'}`}
                        style={{ top: 42, transform: 'translate(-50%, -50%)' }}
                      >
                        {tick.value}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
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

        <div className="absolute right-12 top-10 flex items-center gap-4 pointer-events-auto ui-interactive" onClick={e => e.stopPropagation()}>
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
              <button
                 onClick={() => { setAuthMode('login'); setUsername(""); setPassword(""); setLoginError(""); setShowPassword(false); }}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-white/60 text-slate-700 text-sm font-medium shadow-sm transition-all"
               >
                 <LogIn className="w-4 h-4 opacity-60" />
                 登录
              </button>
              <button
                 onClick={() => { setAuthMode('register'); setUsername(""); setPassword(""); setEmail(""); setConfirmPassword(""); setLoginError(""); setShowPassword(false); setShowConfirmPassword(false); }}
                 className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 text-white text-sm font-medium shadow-md shadow-slate-200/50 transition-all"
               >
                 <UserPlus className="w-4 h-4 opacity-80" />
                 注册
              </button>
             </>
           )}
         </div>

        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto ui-interactive" onClick={e => e.stopPropagation()}>
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
            <div className="relative group/sticker">
              <motion.button 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { switchTool('sticker'); setShowStickerMenu(!showStickerMenu); }}
                className={`group relative p-3.5 rounded-2xl transition-all flex items-center justify-center ${activeTool === 'sticker' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/50'}`}
              >
                <StickyNote className="w-6 h-6" />
                <span className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl z-50">标签贴纸</span>
              </motion.button>
              
              <AnimatePresence>
                {activeTool === 'sticker' && showStickerMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 glass p-3 rounded-2xl flex flex-wrap gap-2 w-[220px] z-50 pointer-events-auto shadow-2xl"
                  >
                    {STICKERS_LIST.map(emoji => (
                      <button 
                        key={emoji} 
                        onClick={() => { setCurrentSticker(emoji); setShowStickerMenu(false); }} 
                        className={`text-2xl hover:scale-125 transition-transform p-1 rounded-xl ${currentSticker === emoji ? 'bg-white/50 ring-2 ring-slate-400' : 'hover:bg-white/30'}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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

        <div className="absolute bottom-12 right-10 bg-white/60 backdrop-blur-xl px-5 py-2.5 rounded-full text-xs text-slate-500 border border-white/80 shadow-sm select-none pointer-events-auto ui-interactive"><span className="font-bold text-blue-600 mr-2">Level {currentZoom.level}</span><span className="font-medium text-slate-800">滚轮</span> 切换层级 • <span className="font-medium text-slate-800 ml-2">拖拽</span> 平移 • <span className="ml-2 font-mono">View: {currentZoom.yearsVisible}Y</span></div>

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
                className="relative glass-pill bg-white/80 backdrop-blur-2xl p-8 rounded-[2rem] border border-white shadow-2xl w-full max-w-sm pointer-events-auto ui-interactive"
                onMouseDownCapture={e => e.stopPropagation()}
                onMouseUpCapture={e => e.stopPropagation()}
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
                        ref={usernameRef}
                        type="text" 
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (authMode === 'register') {
                              emailRef.current?.focus();
                            } else {
                              passwordRef.current?.focus();
                            }
                          }
                        }}
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
                          ref={emailRef}
                          type="email" 
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              passwordRef.current?.focus();
                            }
                          }}
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
                        ref={passwordRef}
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (authMode === 'register') {
                              confirmPasswordRef.current?.focus();
                            } else {
                              handleLogin();
                            }
                          }
                        }}
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
                          ref={confirmPasswordRef}
                          type={showConfirmPassword ? "text" : "password"} 
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleLogin();
                            }
                          }}
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

                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full mt-8 py-4 rounded-2xl bg-slate-800 text-white font-semibold shadow-lg shadow-slate-200 hover:bg-slate-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? '提交中...' : (authMode === 'login' ? '立即登录' : '立即注册')}
                </button>

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
                className="relative glass-pill bg-white/90 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white shadow-2xl w-full max-w-2xl pointer-events-auto overflow-hidden ui-interactive"
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

function Marker({ x, y, color, label, onClick, isEditing, isHighlighted, onMouseDown }: { x: number, y: number, color: string, label: string, onClick?: () => void, isEditing?: boolean, isHighlighted?: boolean, onMouseDown?: (e: React.MouseEvent) => void }) {
  return (
    <motion.g 
      initial={{ opacity: 0, scale: 0 }} 
      animate={{ opacity: isEditing ? 0.3 : 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0 }} 
      whileHover={isEditing ? {} : "hover"} 
      className="pointer-events-auto cursor-pointer draggable-element" 
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}
      onMouseDown={(e) => { if (onMouseDown) onMouseDown(e); }}
    >
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
      <motion.text
        x={x}
        y={y}
        fontSize="26"
        textAnchor="middle"
        dominantBaseline="central"
        className="select-none"
        style={{
          filter: "drop-shadow(0 6px 6px rgba(15, 23, 42, 0.2))",
          transformOrigin: `${x}px ${y}px`,
        }}
        variants={{ hover: { scale: 1.2 } }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        animate={isHighlighted ? { scale: [1, 1.18, 1] } : {}}
      >
        📍
      </motion.text>
      <foreignObject x={x - 60} y={y + 20} width="120" height="60"><div className="flex justify-center p-1"><motion.div variants={{ hover: { y: 2, scale: 1.05 } }} animate={isHighlighted ? { scale: [1, 1.1, 1], y: [0, -5, 0] } : {}} className="glass-pill px-3 py-1.5 rounded-xl text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-sm border border-white/60">{label}</motion.div></div></foreignObject>
    </motion.g>
  );
}
