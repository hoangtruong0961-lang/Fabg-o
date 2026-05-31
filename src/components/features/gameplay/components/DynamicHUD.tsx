import React, { useMemo, useState } from 'react';
import { WorldData, GameTime } from '../../../../types';
import { 
    MapPin, Heart, User, Sun, Moon, Backpack, Shirt, 
    ChevronDown, ChevronUp, Wind, Target, Users, BookOpen, 
    Shield, Coins, Swords, Zap, Activity, Clock, Sparkles, Flame, Compass, Scroll, FileText
} from 'lucide-react';
import { formatGameTime } from '../../../../utils/timeUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface DynamicHUDProps {
    worldData?: WorldData | null;
    gameTime?: GameTime;
    turnCount: number;
}

export const DynamicHUD: React.FC<DynamicHUDProps> = ({ worldData, gameTime, turnCount }) => {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'status' | 'inventory' | 'quests' | 'relations' | 'chronicles'>('status');
    const [selectedItem, setSelectedItem] = useState<{name: string, quantity?: string, desc: string} | null>(null);

    const lsr = worldData?.lsrData || {};

    // Helper to get element values safely (supports objects with numeric keys from LsrParser and fallback arrays)
    const getRowValue = (row: any, idx: number | string, fallback: string = ''): string => {
        if (!row) return fallback;
        const val = row[idx] !== undefined ? row[idx] : row[String(idx)];
        return val !== undefined ? String(val).trim() : fallback;
    };

    // Helper to estimate progress percentages from formatted text (e.g. "80/100", "75%", "90")
    const getProgressRatio = (valStr: string): number => {
        if (!valStr) return -1;
        const pctMatch = valStr.match(/(\d+)%/);
        if (pctMatch) return parseInt(pctMatch[1]);
        const fracMatch = valStr.match(/(\d+)\s*[/|]\s*(\d+)/);
        if (fracMatch) {
            const cur = parseInt(fracMatch[1]);
            const max = parseInt(fracMatch[2]);
            return max > 0 ? Math.min((cur / max) * 100, 100) : 0;
        }
        const numMatch = valStr.match(/^(\d+)$/);
        if (numMatch) {
            const v = parseInt(numMatch[1]);
            return v <= 100 ? v : 100;
        }
        return -1;
    };
    
    // --- Parse LSR Tables ---
    // #0 Thông tin Hiện tại: ["Thời gian", "Địa điểm", "Sự kiện", "Mục tiêu"]
    const t0 = (lsr['0'] || []) as any[];
    const currentInfo = t0[0] || null;
    const locationString = getRowValue(currentInfo, 1, 'Chưa xác định');
    const currentEvent = getRowValue(currentInfo, 2, '');
    const currentObjective = getRowValue(currentInfo, 3, '');

    // #1 Nhân vật Gần đây: ["Tên Nhân vật", "Thái độ/Trạng thái", "Hành động"]
    const recentNpcs = (lsr['1'] || []).map(row => ({
        name: getRowValue(row, 0),
        status: getRowValue(row, 1),
        action: getRowValue(row, 2)
    })).filter(n => n.name);

    // #2 Trạng thái Bản thân: ["Chỉ số/Tên", "Giá trị", "Mô tả"]
    const playerStats = (lsr['2'] || []).map(row => ({
        name: getRowValue(row, 0),
        value: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(s => s.name);
    
    // Find primary health and mana stats to draw beautiful gauge bars in the core panel
    const healthStat = playerStats.find(s => 
        s.name.toLowerCase().includes('máu') || 
        s.name.toLowerCase().includes('hp') || 
        s.name.toLowerCase().includes('sinh lực') || 
        s.name.toLowerCase().includes('the luc') || 
        s.name.toLowerCase().includes('thể lực')
    );
    const manaStat = playerStats.find(s => 
        s.name.toLowerCase().includes('mana') || 
        s.name.toLowerCase().includes('năng lượng') || 
        s.name.toLowerCase().includes('ki') || 
        s.name.toLowerCase().includes('mp') || 
        s.name.toLowerCase().includes('pháp lực')
    );

    const quickStatus = healthStat ? `${healthStat.value} - ${healthStat.desc}` : 'Bình thường';
    
    // #3 Quan hệ: ["Tên Nhân vật", "Độ thân thiết", "Chi tiết/Đánh giá"]
    const relations = (lsr['3'] || []).map(row => ({
        name: getRowValue(row, 0),
        affinity: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(r => r.name);
    
    // #4 Nhiệm vụ / Quest: ["Thời gian", "Trạng thái", "Tên Quest", "Tiến độ"]
    const quests = (lsr['4'] || []).map(row => ({
        time: getRowValue(row, 0),
        status: getRowValue(row, 1),
        name: getRowValue(row, 2),
        progress: getRowValue(row, 3)
    })).filter(q => q.name);
    const activeQuest = quests.find(q => 
        q.status.toLowerCase().includes('đang') || 
        q.status.toLowerCase().includes('active') || 
        q.status.toLowerCase().includes('chưa')
    );

    // #5 Kỹ năng / Phép thuật: ["Tên kỹ năng", "Cấp độ", "Sức mạnh / Mô tả"]
    const skills = (lsr['5'] || []).map(row => ({
        name: getRowValue(row, 0),
        level: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(s => s.name);

    // #6 Túi đồ: ["Tên vật phẩm", "Số lượng", "Trạng thái/Tác dụng"]
    const items = (lsr['6'] || []).map(row => ({
        name: getRowValue(row, 0),
        quantity: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(i => i.name);

    // #7 Trang bị đang mặc: ["Vị trí", "Tên trang bị", "Hiệu ứng/Độ bền"]
    const equipment = (lsr['7'] || []).map(row => ({
        slot: getRowValue(row, 0),
        name: getRowValue(row, 1),
        desc: getRowValue(row, 2)
    })).filter(e => e.name);

    // #8 Địa điểm đã biết
    const places = (lsr['8'] || []).map(row => ({
        name: getRowValue(row, 0),
        description: getRowValue(row, 1)
    })).filter(p => p.name);

    // #9 Phe phái / Thế lực
    const factions = (lsr['9'] || []).map(row => ({
        name: getRowValue(row, 0),
        reputation: getRowValue(row, 1),
        diplomacy: getRowValue(row, 2)
    })).filter(f => f.name);

    // #10 Timeline Sự kiện Thế giới
    const worldTimeline = (lsr['10'] || []).map(row => ({
        time: getRowValue(row, 0),
        significance: getRowValue(row, 1),
        name: getRowValue(row, 2),
        detail: getRowValue(row, 3)
    })).filter(t => t.name || t.detail);

    // #11 Tin đồn / Nhật ký
    const rumors = (lsr['11'] || []).map(row => ({
        source: getRowValue(row, 0),
        content: getRowValue(row, 1),
        reliability: getRowValue(row, 2)
    })).filter(r => r.content);

    // #12 Hiệu ứng (Buff/Debuff): ["Tên hiệu ứng", "Thời gian còn lại", "Tác dụng"]
    const activeEffects = (lsr['12'] || []).map(row => ({
        name: getRowValue(row, 0),
        duration: getRowValue(row, 1),
        effect: getRowValue(row, 2)
    })).filter(e => e.name);

    // #13 Kinh tế / Tiền tệ: ["Loại tài sản", "Số lượng", "Ghi chú"]
    const economy = (lsr['13'] || []).map(row => ({
        type: getRowValue(row, 0),
        amount: getRowValue(row, 1),
        note: getRowValue(row, 2)
    })).filter(eco => eco.type);

    // #14 Pet / Đồng hành
    const companions = (lsr['14'] || []).map(row => ({
        name: getRowValue(row, 0),
        status: getRowValue(row, 1),
        loyalty: getRowValue(row, 2)
    })).filter(c => c.name);

    // #15 Timeline Nhân Vật Chính
    const playerTimeline = (lsr['15'] || []).map(row => ({
        arc: getRowValue(row, 0),
        date: getRowValue(row, 1),
        character: getRowValue(row, 2),
        event: getRowValue(row, 3)
    })).filter(t => t.event);

    // Format final time string
    const timeString = gameTime ? formatGameTime(gameTime) : (getRowValue(currentInfo, 0) || '12:00');
    
    // --- Dynamic Environmental Color Themes & Icons ---
    const environmentTheme = (() => {
        const lcTime = timeString.toLowerCase();
        const locStr = locationString.toLowerCase();
        
        let accentColor = "text-sky-400";
        let accentBg = "bg-sky-500/10";
        let accentBorder = "border-sky-500/30";
        let hoverBorder = "hover:border-sky-500/50";
        let glowShadow = "shadow-[0_0_15px_rgba(56,189,248,0.25)]";
        let bgGradient = "from-slate-900 via-slate-950 to-zinc-950";
        let headerGradient = "from-slate-950/70 to-slate-950/80";
        let headingText = "text-sky-200";
        let timeIcon = <Sun size={14} className="text-amber-400 animate-spin-slow" />;
        
        // Night
        if (lcTime.includes('đêm') || lcTime.includes('tối') || lcTime.includes('khuya') || lcTime.includes('21:') || lcTime.includes('22:') || lcTime.includes('23:') || lcTime.includes('00:') || lcTime.includes('01:') || lcTime.includes('02:') || lcTime.includes('03:') || lcTime.includes('04:')) {
            accentColor = "text-indigo-400";
            accentBg = "bg-indigo-500/10";
            accentBorder = "border-indigo-500/30";
            hoverBorder = "hover:border-indigo-500/50";
            glowShadow = "shadow-[0_0_15px_rgba(99,102,241,0.2)]";
            bgGradient = "from-indigo-950/40 via-slate-950 to-neutral-950";
            headerGradient = "from-indigo-950/85 to-indigo-950/95";
            headingText = "text-indigo-200";
            timeIcon = <Moon size={14} className="text-violet-300 animate-pulse" />;
        } 
        // Sunset / Dusk / Twilight
        else if (lcTime.includes('chiều') || lcTime.includes('hoàng hôn') || lcTime.includes('chạng vạng') || lcTime.includes('17:') || lcTime.includes('18:') || lcTime.includes('19:')) {
            accentColor = "text-rose-400";
            accentBg = "bg-rose-500/10";
            accentBorder = "border-rose-500/30";
            hoverBorder = "hover:border-rose-500/50";
            glowShadow = "shadow-[0_0_15px_rgba(244,63,94,0.25)]";
            bgGradient = "from-rose-950/30 via-slate-950 to-zinc-950";
            headerGradient = "from-rose-950/70 to-slate-950/85";
            headingText = "text-rose-200";
            timeIcon = <Sun size={14} className="text-rose-400" />;
        }
        // Dawn / Sunrise / Morning
        else if (lcTime.includes('sáng') || lcTime.includes('bình minh') || lcTime.includes('05:') || lcTime.includes('06:') || lcTime.includes('07:') || lcTime.includes('08:') || lcTime.includes('09:')) {
            accentColor = "text-emerald-400";
            accentBg = "bg-emerald-500/10";
            accentBorder = "border-emerald-500/30";
            hoverBorder = "hover:border-emerald-500/50";
            glowShadow = "shadow-[0_0_15px_rgba(16,185,129,0.22)]";
            bgGradient = "from-emerald-950/30 via-slate-950 to-slate-950";
            headerGradient = "from-emerald-950/60 to-slate-950/75";
            headingText = "text-emerald-200";
            timeIcon = <Sun size={14} className="text-yellow-300 animate-pulse" />;
        }
        
        let sceneryIcon = <MapPin size={12} className={accentColor} />;
        if (locStr.includes('rừng') || locStr.includes('cây') || locStr.includes('thảo nguyên') || locStr.includes('núi') || locStr.includes('nguyên')) {
            sceneryIcon = <MapPin size={12} className="text-emerald-400" />;
        } else if (locStr.includes('hang') || locStr.includes('hầm') || locStr.includes('ngục') || locStr.includes('đá') || locStr.includes('tối')) {
            sceneryIcon = <MapPin size={12} className="text-neutral-400" />;
        } else if (locStr.includes('biển') || locStr.includes('sông') || locStr.includes('hồ') || locStr.includes('nước') || locStr.includes('đại dương')) {
            sceneryIcon = <MapPin size={12} className="text-cyan-400 animate-pulse" />;
        } else if (locStr.includes('hỏa') || locStr.includes('lửa') || locStr.includes('vực') || locStr.includes('lab')) {
            sceneryIcon = <MapPin size={12} className="text-rose-500" />;
        } else if (locStr.includes('phố') || locStr.includes('thành') || locStr.includes('chợ') || locStr.includes('quán') || locStr.includes('lâu đài')) {
            sceneryIcon = <MapPin size={12} className="text-amber-400" />;
        }
        
        return {
            accentColor,
            accentBg,
            accentBorder,
            hoverBorder,
            glowShadow,
            bgGradient,
            headerGradient,
            headingText,
            timeIcon,
            sceneryIcon
        };
    })();

    // --- Dynamic Health Glow aura around character photo ---
    const characterAura = (() => {
        const effectsStr = JSON.stringify(activeEffects).toLowerCase();
        
        const isPoisoned = effectsStr.includes('độc') || effectsStr.includes('yếu') || effectsStr.includes('nguyền') || effectsStr.includes('dược');
        const isWounded = healthStat && (
            healthStat.value.toLowerCase().includes('yếu') || 
            healthStat.value.toLowerCase().includes('thấp') || 
            healthStat.value.toLowerCase().includes('nguy kịch') ||
            (getProgressRatio(healthStat.value) !== -1 && getProgressRatio(healthStat.value) < 30)
        );
        const isBuffed = effectsStr.includes('phúc lành') || effectsStr.includes('vệ') || effectsStr.includes('tăng') || effectsStr.includes('pháp') || effectsStr.includes('quang');

        if (isWounded) {
            return {
                pulseClass: "animate-ping bg-rose-500/20 ring-2 ring-rose-500/50",
                borderClass: "border-rose-500/90 shadow-[0_0_15px_rgba(244,63,94,0.73)]"
            };
        } else if (isPoisoned) {
            return {
                pulseClass: "animate-pulse bg-purple-500/20 ring-2 ring-purple-400/50",
                borderClass: "border-purple-500/90 shadow-[0_0_15px_rgba(168,85,247,0.73)]"
            };
        } else if (isBuffed) {
            return {
                pulseClass: "animate-pulse bg-amber-400/20 ring-2 ring-amber-400/50",
                borderClass: "border-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.61)]"
            };
        }
        
        return {
            pulseClass: "animate-pulse bg-sky-500/10 ring-1 ring-sky-500/30",
            borderClass: "border-sky-500/60 shadow-[0_0_8px_rgba(56,189,248,0.36)]"
        };
    })();

    // --- Silhouette Map for Equipment ---
    const silhouetteSlots = [
        { key: 'đầu', label: 'Mũ/Đầu', icon: <Shirt size={14} className="opacity-25" /> },
        { key: 'áo', label: 'Cơ thể/Áo', icon: <Shirt size={14} className="opacity-25" /> },
        { key: 'vũ khí', label: 'Vũ khí chính', icon: <Swords size={14} className="opacity-25" /> },
        { key: 'tay', label: 'Tay/Shield', icon: <Shield size={14} className="opacity-25" /> },
        { key: 'nhẫn', label: 'Nhẫn/Bùa', icon: <Coins size={14} className="opacity-25" /> },
        { key: 'chân', label: 'Giày/Chân', icon: <Backpack size={14} className="opacity-25" /> }
    ];

    if (!worldData) return null;

    return (
        <div className={`relative w-full z-20 transition-all duration-700 bg-stone-200 dark:bg-[#0c1425] border-b border-stone-300 dark:border-slate-900 shadow-md ${expanded ? '' : 'neu-flat'}`}>
            
            {/* Top Bar - Beautiful Compact HUD Overlay */}
            <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    
                    {/* Character Bio Avatar & Vitals status */}
                    <button 
                        onClick={() => setExpanded(!expanded)} 
                        className="flex items-center gap-3 group cursor-pointer shrink-0 rounded-2xl hover:bg-stone-300/40 dark:hover:bg-slate-800/40 p-1.5 -ml-1 transition-all"
                    >
                        <div className="relative">
                            {/* Animated ring glow indicator */}
                            <div className={`absolute -inset-0.5 rounded-full blur-sm leading-none ${characterAura.pulseClass}`} />
                            
                            <div className={`relative w-11 h-11 rounded-full bg-slate-950 flex items-center justify-center border-2 ${characterAura.borderClass} group-hover:border-white transition-all overflow-hidden shadow-inner`}>
                                {worldData.player.avatar ? (
                                    <img src={worldData.player.avatar} alt={worldData.player.name} className="w-full h-full object-cover scale-105" />
                                ) : (
                                    <User size={22} className="text-slate-400" />
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-xs font-black text-stone-800 dark:text-slate-100 group-hover:text-mystic-accent transition-colors tracking-widest uppercase font-sans">
                                {worldData.player.name}
                            </span>
                            <span className="text-[10px] font-bold text-stone-600 dark:text-slate-400 max-w-[130px] md:max-w-[210px] truncate flex items-center gap-1.5 mt-0.5">
                                <Heart size={10} className="text-rose-500 animate-pulse fill-rose-500/20" />
                                {quickStatus}
                            </span>
                        </div>
                    </button>

                    <div className="h-8 w-px bg-stone-400/20 dark:bg-slate-800/40 hidden md:block" />

                    {/* Compact Interactive Stats Carousel */}
                    <div className="flex items-center gap-2.5 overflow-x-auto select-none no-scrollbar flex-1 pb-1 md:pb-0">
                        {/* Environmental Card */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none shrink-0 text-stone-800 dark:text-slate-300">
                            {environmentTheme.timeIcon}
                            <span className="text-[10px] font-extrabold font-mono text-stone-700 dark:text-slate-300">{environmentTheme.timeStr}</span>
                        </div>

                        {/* Location Badge */}
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none shrink-0 text-stone-800 dark:text-slate-300">
                            {environmentTheme.sceneryIcon}
                            <span className="text-[10px] font-extrabold text-stone-700 dark:text-slate-300 truncate max-w-[140px] md:max-w-[200px]">{locationString}</span>
                        </div>

                        {/* Mini HP & MP bar indicators directly visible in Header */}
                        {healthStat && (
                            <div className="hidden sm:flex flex-col gap-1 w-24 md:w-32 shrink-0 neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none px-2.5 py-1.5 rounded-xl justify-center">
                                <div className="flex justify-between text-[8px] font-mono font-black leading-none text-stone-600 dark:text-slate-400">
                                    <span>HP</span>
                                    <span className="text-rose-600 dark:text-rose-400">{healthStat.value}</span>
                                </div>
                                <div className="h-1 bg-stone-350 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                                    <div 
                                        className="h-full bg-gradient-to-r from-red-600 to-rose-400 rounded-full" 
                                        style={{ width: `${Math.max(0, Math.min(100, getProgressRatio(healthStat.value) !== -1 ? getProgressRatio(healthStat.value) : 100))}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Quest target tracking */}
                        {(activeQuest || currentObjective) && (
                            <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl neu-sm-inset bg-stone-250 dark:bg-[#060c18] border-none shrink-0 text-stone-800 dark:text-slate-300">
                                <Target size={11} className="text-amber-500" />
                                <span className="text-[10px] font-extrabold text-stone-700 dark:text-slate-300 truncate max-w-[200px]">
                                    {activeQuest ? activeQuest.name : currentObjective}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right side controls - Open Dashboard */}
                <div className="flex items-center gap-2 shrink-0">
                    <button 
                         onClick={() => setExpanded(!expanded)}
                         className={`px-3.5 py-2.5 rounded-xl border-none flex items-center gap-2 text-[11px] font-mono tracking-widest uppercase transition-all duration-300 hover:scale-105 active:scale-95 neu-btn text-stone-700 dark:text-slate-300 ${
                             expanded 
                             ? 'text-mystic-accent font-black shadow-inner' 
                             : 'font-black'
                         }`}
                         title="Xem bảng trạng thái toàn bộ"
                    >
                         <span className="hidden md:inline font-bold">HUD</span>
                         <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
                             <ChevronDown size={14} />
                         </motion.div>
                    </button>
                </div>
            </div>

            {/* Dashboard - Satisfying Expandable Details panel */}
            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-white/5 bg-slate-950/95"
                    >
                        <div className="flex flex-col h-full max-h-[75vh] md:max-h-[500px]">
                            
                            {/* Tab Selection Row */}
                            <div className="flex px-4 pt-1 gap-1 overflow-x-auto no-scrollbar border-b border-white/5 bg-black/40">
                                {[
                                    { id: 'status', label: 'Trạng thái', icon: <Activity size={12} /> },
                                    { id: 'inventory', label: 'Hành lý', icon: <Backpack size={12} /> },
                                    { id: 'quests', label: 'Cơ duyên', icon: <Compass size={12} /> },
                                    { id: 'relations', label: 'Nhân gian', icon: <Users size={12} /> },
                                    { id: 'chronicles', label: 'Sử ký', icon: <Scroll size={12} /> }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id as any);
                                            setSelectedItem(null);
                                        }}
                                        className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-bold uppercase tracking-wider rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
                                            activeTab === tab.id 
                                            ? `text-white border-sky-400 bg-sky-500/5` 
                                            : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-200'
                                        }`}
                                    >
                                        {tab.icon}
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Tab Grid content panel */}
                            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-slate-950 via-slate-950 to-zinc-950">
                                
                                {/* 1. STATUS TAB */}
                                {activeTab === 'status' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        
                                        {/* Left col: Character Stat Bars & Vitals */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                    <Activity size={12} className={environmentTheme.accentColor} />
                                                    <span>Chỉ Số Bản Thể</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-3 space-y-3">
                                                    {playerStats.length > 0 ? (
                                                        playerStats.map((stat, i) => {
                                                            const ratio = getProgressRatio(stat.value);
                                                            const isHp = stat.name.toLowerCase().includes('máu') || stat.name.toLowerCase().includes('hp') || stat.name.toLowerCase().includes('sinh lực');
                                                            const isMp = stat.name.toLowerCase().includes('mana') || stat.name.toLowerCase().includes('năng lượng') || stat.name.toLowerCase().includes('mp') || stat.name.toLowerCase().includes('ki') || stat.name.toLowerCase().includes('pháp lực');
                                                            const isStamina = stat.name.toLowerCase().includes('lực') || stat.name.toLowerCase().includes('giáp') || stat.name.toLowerCase().includes('khí');

                                                            // Determine bar color
                                                            let barColor = "from-sky-600 to-sky-400";
                                                            if (isHp) barColor = "from-red-600 to-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]";
                                                            else if (isMp) barColor = "from-indigo-600 to-violet-400 shadow-[0_0_8px_rgba(124,58,237,0.4)]";
                                                            else if (isStamina) barColor = "from-emerald-600 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]";

                                                            return (
                                                                <div key={i} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-black text-slate-300 font-sans">{stat.name}</span>
                                                                        <span className="text-[11px] font-bold font-mono text-white bg-black/40 px-1.5 py-0.5 rounded border border-white/5">{stat.value}</span>
                                                                    </div>
                                                                    
                                                                    {ratio !== -1 ? (
                                                                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden p-[1px] border border-white/5">
                                                                            <div 
                                                                                className={`h-full rounded-full bg-gradient-to-r ${barColor}`} 
                                                                                style={{ width: `${ratio}%` }}
                                                                            />
                                                                        </div>
                                                                    ) : null}
                                                                    {stat.desc && <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">{stat.desc}</span>}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="p-4 text-center text-xs text-slate-500 font-mono">Chưa ghi nhận bản thể</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Center col: Spells, Skills & Magic */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                    <BookOpen size={12} className="text-amber-400" />
                                                    <span>Kỹ Năng & Lĩnh Ngộ</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-2 max-h-[220px] overflow-y-auto no-scrollbar">
                                                    {skills.length > 0 ? (
                                                        skills.map((s, i) => (
                                                            <div key={i} className="p-2 border-b border-white/5 last:border-0 hover:bg-white/5 rounded-lg transition-colors flex gap-2.5 items-start">
                                                                <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-mono font-bold shrink-0">
                                                                    {getRowValue(s, 1, '1')}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[11px] font-bold text-slate-200">{s.name}</span>
                                                                    <span className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{s.desc}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-4 text-center text-xs text-slate-500 font-mono">Trang kinh sơ khai, chưa lĩnh ngộ chiêu thức</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Companion details */}
                                            {companions.length > 0 && (
                                                <div>
                                                    <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                        <Users size={12} className="text-pink-400" />
                                                        <span>Linh Thú & Bạn Đồng Hành</span>
                                                    </h4>
                                                    <div className="bg-black/35 rounded-xl border border-white/5 p-2 grid grid-cols-1 gap-2">
                                                        {companions.map((c, i) => (
                                                            <div key={i} className="flex items-center gap-2.5 py-1 px-2 border-b border-white/5 last:border-none">
                                                                <div className="w-7 h-7 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                                                                    <User size={13} className="text-pink-300" />
                                                                </div>
                                                                <div className="flex flex-col min-w-0 flex-1">
                                                                    <span className="text-[11px] font-bold text-slate-200">{c.name}</span>
                                                                    <span className="text-[10px] text-pink-300 font-mono italic">{c.status}</span>
                                                                </div>
                                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                                                                    💖 {c.loyalty || 'Trung thành'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right col: Dynamic Active Effects / Debuffs */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                    <Zap size={11} className="text-rose-400" />
                                                    <span>Trạng Thái Cát Hung (Buffs)</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-3 space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
                                                    {activeEffects.length > 0 ? (
                                                        activeEffects.map((eff, i) => {
                                                            const isNegative = eff.name.toLowerCase().includes('độc') || eff.name.toLowerCase().includes('nguyền') || eff.name.toLowerCase().includes('yếu') || eff.name.toLowerCase().includes('giảm');
                                                            return (
                                                                <div 
                                                                    key={i} 
                                                                    className={`flex flex-col p-2.5 rounded-lg border transition-all ${
                                                                        isNegative 
                                                                        ? 'bg-purple-950/20 border-purple-900/40 text-purple-200' 
                                                                        : 'bg-amber-950/15 border-amber-900/35 text-amber-200'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-bold flex items-center gap-1">
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${isNegative ? 'bg-purple-500 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
                                                                            {eff.name}
                                                                        </span>
                                                                        <span className="text-[9px] font-mono opacity-80 flex items-center gap-0.5">
                                                                            <Clock size={8} />
                                                                            {eff.duration}
                                                                        </span>
                                                                    </div>
                                                                    {eff.effect && <span className="text-[10px] opacity-70 mt-1">{eff.effect}</span>}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="p-5 text-center text-xs text-slate-600 font-mono bg-slate-900/20 rounded-xl border border-dashed border-white/5">
                                                            Lục phủ thanh tịnh, vô định trạng thái
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* 2. INVENTORY TAB - RPG Style Equipment & Item Grid with Inspect Drawer */}
                                {activeTab === 'inventory' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                        
                                        {/* Equipment Silhouette view (Left 5 columns) */}
                                        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-3 flex items-center gap-1.5">
                                                    <Shield size={12} className="text-emerald-400" />
                                                    <span>Thiết Bị Cực Hạn (Trang Bị)</span>
                                                </h4>
                                                
                                                <div className="bg-black/35 rounded-xl border border-white/5 p-4 flex flex-col items-center relative min-h-[220px] justify-center">
                                                    <div className="absolute top-2 left-2 text-[8px] font-mono text-slate-500 uppercase tracking-widest">BODY CORE MATRIX</div>
                                                    
                                                    {/* Symmetric visual equipment outline */}
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-sm">
                                                        {silhouetteSlots.map(slot => {
                                                            // Match table #7 gear matching slot key in name or slot column
                                                            const eqItem = equipment.find(e => 
                                                                e.slot.toLowerCase().includes(slot.key) || 
                                                                slot.key.toLowerCase().includes(e.slot.toLowerCase())
                                                            );

                                                            return (
                                                                <div 
                                                                    key={slot.key} 
                                                                    className={`p-2 rounded-lg border flex flex-col items-center text-center justify-between min-h-[64px] transition-all ${
                                                                        eqItem 
                                                                        ? 'bg-emerald-950/20 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)] hover:border-emerald-500/60' 
                                                                        : 'bg-black/45 border-white/10 hover:border-slate-700'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center justify-between w-full opacity-60">
                                                                        <span className="text-[8px] font-mono tracking-widest uppercase text-slate-400">{slot.label}</span>
                                                                        {slot.icon}
                                                                    </div>
                                                                    
                                                                    {eqItem ? (
                                                                        <div className="w-full mt-1.5">
                                                                            <div className="text-[11px] font-black leading-none text-emerald-300 truncate">{eqItem.name}</div>
                                                                            <div className="text-[9px] text-slate-400 truncate mt-0.5">{eqItem.desc || 'Đang lắp'}</div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[9px] font-mono text-slate-500 italic mt-1.5">Trống</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bag square slots view & Asset Indicator (Right 7 columns) */}
                                        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-3 flex items-center gap-1.5">
                                                    <Backpack size={12} className="text-sky-400" />
                                                    <span>Hành Trang & Tài Vật (Bags)</span>
                                                </h4>
                                                
                                                {/* Squares layout of items */}
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto no-scrollbar bg-black/25 rounded-xl border border-white/5 p-2">
                                                    {items.length > 0 ? (
                                                        items.map((item, i) => (
                                                            <div 
                                                                key={i} 
                                                                onClick={() => setSelectedItem(item)}
                                                                className={`cursor-pointer group flex flex-col justify-between p-2 rounded-lg bg-black/45 hover:bg-slate-900 border transition-all ${
                                                                    selectedItem?.name === item.name 
                                                                    ? `${environmentTheme.accentBorder} ${environmentTheme.glowShadow} scale-95` 
                                                                    : 'border-white/5 hover:border-white/10'
                                                                }`}
                                                            >
                                                                <div className="flex justify-between items-start">
                                                                    <div className="w-7 h-7 rounded bg-sky-500/5 hover:bg-sky-500/10 border border-white/5 text-[9px] text-center flex items-center justify-center font-bold text-sky-400">
                                                                        PKG
                                                                    </div>
                                                                    <div className="text-[10px] font-black font-mono text-slate-300 bg-black px-1 rounded border border-white/5">
                                                                        x{item.quantity || 1}
                                                                    </div>
                                                                </div>
                                                                <div className="mt-2 text-[10px] font-bold text-slate-200 truncate group-hover:text-white leading-tight">
                                                                    {item.name}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="col-span-full py-12 text-center text-xs text-slate-500 font-mono">Bao xơ trắng không có vật ngoài thân</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Item Inspection details tray */}
                                            {selectedItem && (
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5 flex flex-col relative"
                                                >
                                                    <button 
                                                        onClick={() => setSelectedItem(null)}
                                                        className="absolute top-1.5 right-2 text-slate-400 hover:text-white font-mono text-xs p-1"
                                                    >
                                                        ✕
                                                    </button>
                                                    <div className="text-[11px] font-black text-sky-300 uppercase tracking-widest">Pháp bảo đại hoàn</div>
                                                    <div className="text-xs font-bold text-white mt-1 uppercase flex items-center gap-1">
                                                        <span>{selectedItem.name}</span>
                                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black text-amber-400">Lượng: {selectedItem.quantity}</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-300 leading-relaxed mt-1.5 italic">
                                                        {selectedItem.desc || 'Huyền diệu chi vật vô luận tác dụng'}
                                                    </p>
                                                </motion.div>
                                            )}

                                            {/* Financial items indicator */}
                                            {economy.length > 0 && (
                                                <div className="bg-black/40 rounded-xl border border-white/5 p-2 px-3 flex flex-wrap gap-3 items-center">
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 font-mono">
                                                        <Coins size={10} className="text-yellow-500" />
                                                        <span>Tài Sản Kinh Tế:</span>
                                                    </div>
                                                    {economy.map((eco, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-white/5">
                                                            <span className="text-[10px] font-bold text-slate-400">{eco.type}:</span>
                                                            <span className="text-[11px] font-bold font-mono text-amber-400">{eco.amount}</span>
                                                            {eco.note && <span className="text-[9px] text-slate-400 truncate max-w-[80px]">({eco.note})</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}

                                {/* 3. QUESTS & COMPASS LORE TAB */}
                                {activeTab === 'quests' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                        
                                        {/* Quest List (Left 7 columns) */}
                                        <div className="lg:col-span-7 space-y-3">
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                <Target size={12} className="text-amber-400" />
                                                <span>Thiên Mệnh Nhân Quả (Nhiệm vụ)</span>
                                            </h4>
                                            
                                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar">
                                                {quests.length > 0 ? (
                                                    quests.map((q, i) => {
                                                        const isActive = q.status.toLowerCase().includes('đang') || q.status.toLowerCase().includes('tiến hành') || q.status.toLowerCase().includes('chưa');
                                                        const isDone = q.status.toLowerCase().includes('hoàn') || q.status.toLowerCase().includes('thành') || q.status.toLowerCase().includes('xong');
                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={`p-3 rounded-xl border transition-all ${
                                                                    isActive 
                                                                    ? 'bg-amber-950/15 border-amber-500/20' 
                                                                    : isDone 
                                                                    ? 'bg-emerald-950/20 border-emerald-500/20' 
                                                                    : 'bg-black/35 border-white/5'
                                                                }`}
                                                            >
                                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                                                            isActive 
                                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                                                            : isDone 
                                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                                            : 'bg-slate-800 text-slate-400 border-white/5'
                                                                        }`}>
                                                                            {q.status}
                                                                        </span>
                                                                        <span className="text-[10px] font-mono text-slate-500">{q.time}</span>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="text-[12px] font-bold text-slate-100 mt-2">{q.name}</div>
                                                                
                                                                {q.progress && (
                                                                    <div className="mt-2 flex flex-col gap-0.5 bg-black/30 p-2 rounded border border-white/5">
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mục tiêu</span>
                                                                        <span className="text-[11px] text-slate-300 italic">{q.progress}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-8 text-center text-xs text-slate-500 font-mono bg-black/40 rounded-xl border border-white/5 border-dashed">
                                                        Phục vân tản bộ, thế giới nhàn tản vô tai ách nguy nan
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Discovered Places & Rumors (Right 5 columns) */}
                                        <div className="lg:col-span-5 space-y-4">
                                            {/* Discovered places */}
                                            {places.length > 0 && (
                                                <div>
                                                    <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                        <MapPin size={11} className="text-indigo-400" />
                                                        <span>Địa Bản Đồ Ký (Bản Đồ)</span>
                                                    </h4>
                                                    <div className="bg-black/35 rounded-xl border border-white/5 p-2 grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto no-scrollbar">
                                                        {places.map((p, i) => (
                                                            <div key={i} className="py-2 px-2.5 rounded bg-black/50 border border-white/5 flex flex-col">
                                                                <span className="text-[11px] font-bold text-slate-200">{p.name}</span>
                                                                {p.description && <span className="text-[10px] text-slate-400 mt-0.5 leading-snug">{p.description}</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Rumors journals */}
                                            {rumors.length > 0 && (
                                                <div>
                                                    <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                        <FileText size={11} className="text-sky-400" />
                                                        <span>Đàm Tiếu Vân Khói (Tin Đồn)</span>
                                                    </h4>
                                                    <div className="bg-black/35 rounded-xl border border-white/5 p-2.5 space-y-2 max-h-[150px] overflow-y-auto no-scrollbar">
                                                        {rumors.map((rum, i) => (
                                                            <div key={i} className="text-[10px] leading-relaxed p-2 bg-slate-900/60 border border-white/5 rounded text-slate-300">
                                                                <div className="flex items-center justify-between text-slate-400 font-mono text-[8px] uppercase font-bold mb-1 border-b border-white/5 pb-1">
                                                                    <span>Nguồn: {rum.source || 'Nhân thế'}</span>
                                                                    <span className="text-amber-500">Tin cậy: {rum.reliability}</span>
                                                                </div>
                                                                "{rum.content}"
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}

                                {/* 4. SOCIAL & RELATIONSHIPS TAB */}
                                {activeTab === 'relations' && (
                                    <div className="space-y-4">
                                        
                                        {/* Factions status panel at the top (if present) */}
                                        {factions.length > 0 && (
                                            <div>
                                                <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2 flex items-center gap-1.5">
                                                    <Shield size={12} className="text-sky-400" />
                                                    <span>Môn Phái & Phục Thế Lực</span>
                                                </h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                                    {factions.map((f, i) => (
                                                        <div key={i} className="p-2.5 rounded-xl bg-black/45 border border-white/5 flex items-center justify-between">
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[12px] font-bold text-slate-200 truncate">{f.name}</span>
                                                                <span className="text-[10px] text-slate-400 mt-0.5">Ngoại giao: {f.diplomacy || 'Hòa hoãn'}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-900/30 px-2 py-0.5 rounded">
                                                                🛡️ {f.reputation || '0'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Relations Grid */}
                                        <div>
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest mb-2.5 flex items-center gap-1.5">
                                                <Users size={12} className="text-pink-400" />
                                                <span>Mối Nhân Duyên Hồng Trần (Nhân Vật)</span>
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {relations.length > 0 ? (
                                                    relations.map((rel, i) => {
                                                        const isActiveRecently = recentNpcs.some(n => 
                                                            n.name.toLowerCase().includes(rel.name.toLowerCase()) ||
                                                            rel.name.toLowerCase().includes(n.name.toLowerCase())
                                                        );

                                                        // Parse estimated friendliness numbers (e.g., "80/100", "70%", "Tiên tiến 90")
                                                        const affinityNumber = getProgressRatio(rel.affinity);

                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={`p-3 rounded-xl border bg-gradient-to-r from-black/35 to-black/10 transition-colors flex gap-3 ${
                                                                    isActiveRecently 
                                                                    ? 'border-pink-500/40 ring-1 ring-pink-500/20' 
                                                                    : 'border-white/5 hover:border-pink-500/20'
                                                                }`}
                                                            >
                                                                {/* Circular Avatar */}
                                                                <div className="relative shrink-0">
                                                                    <div className={`w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border ${isActiveRecently ? 'border-pink-400 shadow-[0_0_8px_rgba(236,72,153,0.4)]' : 'border-white/10'}`}>
                                                                        <User size={18} className="text-slate-400" />
                                                                    </div>
                                                                    {isActiveRecently && (
                                                                        <div className="absolute top-0 right-  w-2.5 h-2.5 bg-emerald-500 border border-black rounded-full animate-pulse" title="Vừa tương tác gần đây" />
                                                                    )}
                                                                </div>

                                                                {/* Detailed text */}
                                                                <div className="flex flex-col flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between gap-1.5">
                                                                        <span className="text-[12px] font-black text-slate-100 truncate">{rel.name}</span>
                                                                        <span className="text-[10px] font-mono px-2 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 whitespace-nowrap">
                                                                            💖 {rel.affinity}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    {/* Friendly gauge bar if applicable */}
                                                                    {affinityNumber !== -1 && (
                                                                        <div className="h-1.5 bg-slate-900 rounded-full w-full overflow-hidden mt-1 p-[1px]">
                                                                            <div className="h-full bg-gradient-to-r from-rose-500 to-pink-400 rounded-full" style={{ width: `${affinityNumber}%` }} />
                                                                        </div>
                                                                    )}

                                                                    <p className="text-[10px] text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                                                                        {rel.desc}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="col-span-full py-12 text-center text-xs text-slate-500 font-mono bg-black/40 rounded-xl border border-white/5 border-dashed">
                                                        Phàm trần độc bước, chưa lập nhân duyên bằng hữu
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                )}

                                {/* 5. CHRONICLES TIMELINE TAB */}
                                {activeTab === 'chronicles' && (
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                        
                                        {/* Player timeline / Personal Arc milestones (Left 6 columns) */}
                                        <div className="md:col-span-6 space-y-3.5">
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-1.5">
                                                <Scroll size={11} className="text-pink-400" />
                                                <span>Thiên Mệnh Ký Sự (Sử ký Thân Bản)</span>
                                            </h4>
                                            
                                            <div className="relative border-l border-white/10 pl-4 ml-2.5 py-1 space-y-4 max-h-[320px] overflow-y-auto no-scrollbar">
                                                {playerTimeline.length > 0 ? (
                                                    playerTimeline.map((item, i) => (
                                                        <div key={i} className="relative group">
                                                            {/* Custom Bullet icon on vertical timeline line */}
                                                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-pink-500 border-2 border-slate-950 group-hover:scale-125 transition-transform" />
                                                            
                                                            <div className="bg-black/35 rounded-xl border border-white/5 p-3 hover:border-pink-500/10 transition-colors">
                                                                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 uppercase font-black">
                                                                    <span>ARC: {item.arc || 'TIỀN ĐỀ'}</span>
                                                                    <span className="text-pink-400">{item.date}</span>
                                                                </div>
                                                                <div className="text-[10px] font-bold text-slate-300 mt-1">
                                                                    Nhân vật quan hệ: {item.character}
                                                                </div>
                                                                <p className="text-[11px] text-slate-400 leading-relaxed mt-1.5 font-sans italic">
                                                                    "{item.event}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-12 text-center text-xs text-slate-500 font-mono">Chương thư khởi sắc, đang viết huyền thoại bản thân</div>
                                                )}
                                            </div>
                                        </div>

                                        {/* World event chronology timeline (Right 6 columns) */}
                                        <div className="md:col-span-6 space-y-3.5">
                                            <h4 className="text-[9px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-1.5">
                                                <Clock size={11} className="text-amber-400" />
                                                <span>Biên Niên Thế Sự (Sự Kiện Thiên Hạ)</span>
                                            </h4>
                                            
                                            <div className="relative border-l border-white/10 pl-4 ml-2.5 py-1 space-y-4 max-h-[320px] overflow-y-auto no-scrollbar">
                                                {worldTimeline.length > 0 ? (
                                                    worldTimeline.map((item, i) => (
                                                        <div key={i} className="relative group">
                                                            {/* Round bullet indicator */}
                                                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-slate-950 group-hover:scale-125 transition-transform animate-pulse" />
                                                            
                                                            <div className="bg-black/35 rounded-xl border border-white/5 p-3 hover:border-amber-500/10 transition-colors">
                                                                <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 font-black">
                                                                    <span>Ý NGHĨA: {item.significance || 'THƯỜNG NHẬT'}</span>
                                                                    <span className="text-amber-400">{item.time}</span>
                                                                </div>
                                                                <div className="text-[11px] font-black text-slate-200 mt-1 uppercase tracking-wide">
                                                                    {item.name || 'Thế sự rung chuyển'}
                                                                </div>
                                                                <p className="text-[11px] text-slate-400 leading-normal mt-1.5">
                                                                    {item.detail}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-12 text-center text-xs text-slate-500 font-mono">Bát quái tĩnh dính, núi sông tạm thời bình lặng</div>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                )}

                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

