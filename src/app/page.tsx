"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, List, Globe, Users, User, X, Check, Trash2, Calendar } from "lucide-react";

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
const BASE_DATE = new Date("2026-01-01");

const INITIAL_EVENTS: CanvasEvent[] = [
  { id: "1", time: "2024-06-15", y: 400, label: "Started Project", color: "#fbbf24" },
  { id: "2", time: "2025-02-10", y: 450, label: "Skill Mastery", color: "#fbbf24" },
  { id: "4", time: "2026-03-20", y: 800, label: "New Milestone", color: "#c084fc" },
  { id: "5", time: "2026-07-01", y: 850, label: "Team Expansion", color: "#c084fc" },
  { id: "7", time: "2027-04-15", y: 1200, label: "Global Launch", color: "#2dd4bf" },
  { id: "8", time: "2028-09-30", y: 1300, label: "Market Leader", color: "#2dd4bf" },
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
  const [offset, setOffset] = useState({ x: 0, y: 100 });
  const [isPanning, setIsPanning] = useState(false);
  const [events, setEvents] = useState<CanvasEvent[]>(INITIAL_EVENTS);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<{ x: number, y: number, time: string } | null>(null);
  const [currentLabel, setCurrentLabel] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  const currentZoom = ZOOM_LEVELS[zoomIndex];
  const pixelsPerYear = useMemo(() => {
    if (windowSize.width === 0) return 600;
    return windowSize.width / currentZoom.yearsVisible;
  }, [currentZoom, windowSize.width]);

  useEffect(() => {
    const updateSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    setOffset(prev => ({ ...prev, x: window.innerWidth / 2 }));
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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
  };

  const saveEvent = () => {
    if (!currentLabel.trim() || !currentTime) {
      cancelEdit();
      return;
    }

    if (editingEventId) {
      setEvents(prev => prev.map(ev => 
        ev.id === editingEventId ? { ...ev, label: currentLabel.trim(), time: currentTime } : ev
      ));
    } else if (pendingEvent) {
      const newEvent: CanvasEvent = {
        id: Math.random().toString(36).substr(2, 9),
        time: currentTime,
        y: pendingEvent.y,
        label: currentLabel.trim(),
        color: ["#fbbf24", "#c084fc", "#2dd4bf"][Math.floor(Math.random() * 3)]
      };
      setEvents(prev => [...prev, newEvent]);
    }
    cancelEdit();
  };

  const deleteEvent = () => {
    if (editingEventId) {
      setEvents(prev => prev.filter(ev => ev.id !== editingEventId));
      cancelEdit();
    }
  };

  const cancelEdit = () => {
    setPendingEvent(null);
    setEditingEventId(null);
    setCurrentLabel("");
    setCurrentTime("");
  };

  const timelineTicks = useMemo(() => {
    if (windowSize.width === 0) return [];
    const ticks = [];
    const startYearOffset = Math.floor((0 - offset.x) / pixelsPerYear);
    const endYearOffset = Math.ceil((windowSize.width - offset.x) / pixelsPerYear);
    const yearStep = 1;

    for (let y = startYearOffset - 1; y <= endYearOffset + 1; y++) {
      if (y % yearStep === 0) {
        const x = offset.x + y * pixelsPerYear;
        ticks.push({ type: 'year', value: 2026 + y, x });
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
      <div className="fixed top-0 bottom-0 w-[2px] bg-red-500/40 z-20 pointer-events-none shadow-[0_0_15px_rgba(239,68,68,0.4)]" style={{ left: offset.x }}>
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
              <linearGradient id="grad-yellow" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#fbbf24" stopOpacity="0.2" /><stop offset="50%" stopColor="#fbbf24" stopOpacity="0.6" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0.2" /></linearGradient>
              <linearGradient id="grad-purple" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#c084fc" stopOpacity="0.2" /><stop offset="50%" stopColor="#c084fc" stopOpacity="0.6" /><stop offset="100%" stopColor="#c084fc" stopOpacity="0.2" /></linearGradient>
              <linearGradient id="grad-teal" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.2" /><stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.6" /><stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.2" /></linearGradient>
              <filter id="glow-lg"><feGaussianBlur stdDeviation="8" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
              <filter id="glow-sm"><feGaussianBlur stdDeviation="3" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
            </defs>

            <motion.path d={`M ${-10 * pixelsPerYear},400 C ${-5 * pixelsPerYear},400 0,450 ${5 * pixelsPerYear},550 S ${15 * pixelsPerYear},650 ${25 * pixelsPerYear},650`} stroke="url(#grad-yellow)" strokeWidth="32" fill="none" strokeLinecap="round" />
            <motion.path d={`M ${-8 * pixelsPerYear},800 C -3 * pixelsPerYear,800 ${3 * pixelsPerYear},880 ${8 * pixelsPerYear},950 S ${18 * pixelsPerYear},1050 ${28 * pixelsPerYear},1050`} stroke="url(#grad-purple)" strokeWidth="32" fill="none" strokeLinecap="round" />
            <motion.path d={`M ${-6 * pixelsPerYear},1200 C 2 * pixelsPerYear,1200 ${7 * pixelsPerYear},1300 ${12 * pixelsPerYear},1380 S ${22 * pixelsPerYear},1500 ${32 * pixelsPerYear},1500`} stroke="url(#grad-teal)" strokeWidth="32" fill="none" strokeLinecap="round" />

            <g className="pointer-events-auto">
              <AnimatePresence>
                {events.map(event => (
                  <Marker key={event.id} x={dateToOffset(event.time) * pixelsPerYear} y={event.y} color={event.color} label={event.label} onClick={() => startEditing(event)} isEditing={editingEventId === event.id} />
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
                            <input autoFocus type="text" value={currentLabel} onChange={e => setCurrentLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' ? saveEvent() : e.key === 'Escape' ? cancelEdit() : null} placeholder={editingEventId ? "编辑事件..." : "新事件..."} className="bg-transparent border-none outline-none text-[12px] font-medium text-slate-700 flex-1 px-1" />
                            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
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
              {timelineTicks.map((tick, i) => {
                // Adjust tick.x to be relative to this container
                // container is now offset from left by 280px
                const relativeX = tick.x - 280;

                return (
                  <div key={`${tick.type}-${tick.value}-${i}`} className="absolute flex flex-col items-center top-1/2 -translate-y-1/2" style={{ left: relativeX, transform: 'translate(-50%, -50%)' }}>
                    {tick.type === 'year' ? (
                      <>
                        <span className="text-[12px] font-black text-slate-700 mb-1">{tick.value}</span>
                        <div className={`w-3.5 h-3.5 rotate-45 border-2 ${tick.value === 2026 ? 'border-red-500 bg-red-100 shadow-[0_0_10px_rgba(239,68,68,0.5)] scale-125' : (tick.value % 2 === 0 ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-slate-50')}`} />
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

        <div className="absolute right-12 top-1/2 -translate-y-1/2 flex flex-col gap-14 pointer-events-auto" onClick={e => e.stopPropagation()}>
          {[{ label: "Individual", sub: "个人", icon: User }, { label: "Community", sub: "社群", icon: Users }, { label: "Population", sub: "种群", icon: Globe }].map((item) => (
            <motion.button key={item.label} whileHover={{ scale: 1.1, y: -5 }} className="w-28 h-28 rounded-full glass-circle flex flex-col items-center justify-center text-slate-700"><item.icon className="w-6 h-6 mb-2 opacity-30" /><span className="text-sm font-medium">{item.label}</span><span className="text-xs font-light opacity-40">{item.sub}</span></motion.button>
          ))}
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-[60%] max-w-4xl pointer-events-auto" onClick={e => e.stopPropagation()}>
          <div className="glass px-8 py-5 rounded-[2.5rem] flex items-center gap-5 shadow-2xl border border-white/60"><Search className="w-7 h-7 text-slate-300" /><input type="text" placeholder="Explore the infinite timeline..." className="flex-1 bg-transparent border-none outline-none text-slate-700 text-xl font-light placeholder:text-slate-300" /><div className="flex items-center gap-8 text-slate-300 border-l border-slate-100 pl-8 ml-2"><SlidersHorizontal className="w-6 h-6 cursor-pointer hover:text-blue-500" /><List className="w-6 h-6 cursor-pointer hover:text-blue-500" /></div></div>
        </div>

        <div className="absolute bottom-10 right-10 bg-white/60 backdrop-blur-xl px-5 py-2.5 rounded-full text-xs text-slate-500 border border-white/80 shadow-sm select-none"><span className="font-bold text-blue-600 mr-2">Level {currentZoom.level}</span><span className="font-medium text-slate-800">滚轮</span> 切换层级 • <span className="font-medium text-slate-800 ml-2">拖拽</span> 平移 • <span className="ml-2 font-mono">View: {currentZoom.yearsVisible}Y</span></div>
      </div>
    </main>
  );
}

function Marker({ x, y, color, label, onClick, isEditing }: { x: number, y: number, color: string, label: string, onClick?: () => void, isEditing?: boolean }) {
  return (
    <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: isEditing ? 0.3 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }} whileHover={isEditing ? {} : "hover"} className="pointer-events-auto cursor-pointer" onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}>
      <circle cx={x} cy={y} r="12" fill={color} opacity="0.15" filter="url(#glow-lg)" />
      <motion.circle cx={x} cy={y} r="7" fill="white" stroke={color} strokeWidth="3" filter="url(#glow-sm)" variants={{ hover: { scale: 1.3 } }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ transformOrigin: `${x}px ${y}px` }} />
      <foreignObject x={x - 60} y={y + 20} width="120" height="60"><div className="flex justify-center p-1"><motion.div variants={{ hover: { y: 2, scale: 1.05 } }} className="glass-pill px-3 py-1.5 rounded-xl text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-sm border border-white/60">{label}</motion.div></div></foreignObject>
    </motion.g>
  );
}
