import React from 'react';
import { Search, Plus, BrainCircuit, Type, ChevronRight, Pin, Database, HelpCircle } from 'lucide-react';
import { VectorData } from '../../../../../services/db/indexedDB';

export interface EntryListViewProps {
    entries: VectorData[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onAdd: () => void;
    
    searchTerm: string;
    onSearchChange: (val: string) => void;
    
    viewMode: 'keyword' | 'semantic';
    onViewModeChange: (val: 'keyword' | 'semantic') => void;
    
    onSemanticSearch: () => void;
    isSearchingSemantic: boolean;
    
    activeCategoryFilter: string | null;
    onCategoryFilterChange: (cat: string | null) => void;
    
    filteredEntries: VectorData[];
    
    CATEGORY_MAP: any;
    
    renderTool?: () => React.ReactNode;
}

export const EntryListView: React.FC<EntryListViewProps> = ({
    entries, selectedId, onSelect, onAdd,
    searchTerm, onSearchChange,
    viewMode, onViewModeChange,
    onSemanticSearch, isSearchingSemantic,
    activeCategoryFilter, onCategoryFilterChange,
    filteredEntries, CATEGORY_MAP,
    renderTool
}) => {
    return (
        <div id="entry-list-view-root" className="flex flex-col h-full bg-[#020617] text-slate-100 border-r border-slate-800/60 relative select-none font-sans">
            <div className="absolute inset-0 bg-repeat bg-center opacity-[0.015] pointer-events-none mix-blend-color-burn" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }} />
            
            {/* Top Command Toolbar */}
            <div className="p-4 border-b border-slate-850/50 shrink-0 space-y-3.5 bg-slate-950/90 backdrop-blur-md relative z-10 z-[1]">
                
                {/* 2-way Custom Search Mode Toggle */}
                <div className="flex flex-col gap-1.5 shrink-0 text-left">
                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-widest font-mono">
                        Mã hóa Truy vết Thần thức
                    </span>
                    <div className="flex bg-[#020617] rounded-xl p-1 w-full border border-slate-850/50 gap-1 shadow-inner">
                        <button 
                            type="button"
                            onClick={() => onViewModeChange('keyword')} 
                            className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg transition-all whitespace-nowrap ${
                                viewMode === 'keyword' 
                                ? 'bg-sky-500/15 text-sky-400 border border-slate-800/80 shadow-md' 
                                : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            <Type size={11} /> Từ khóa cơ bản
                        </button>
                        <button 
                            type="button"
                            onClick={() => onViewModeChange('semantic')} 
                            className={`flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg transition-all whitespace-nowrap ${
                                viewMode === 'semantic' 
                                ? 'bg-sky-500/15 text-sky-400 border border-slate-800/80 shadow-md' 
                                : 'text-slate-400 hover:text-slate-100'
                            }`}
                        >
                            <BrainCircuit size={11} /> Ý niệm ngữ nghĩa (Vector)
                        </button>
                    </div>
                </div>

                {/* Sub Search Container (only shown in list modes) */}
                {(viewMode === 'keyword' || viewMode === 'semantic') && (
                    <div className="space-y-3 animate-fadeIn">
                        {/* Elegant command input box */}
                        <div className="relative flex gap-2">
                            <div className="relative flex-1">
                                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-400/70" />
                                <input 
                                    type="text" 
                                    placeholder={viewMode === 'semantic' ? "Nhập ý niệm cốt truyện để quét..." : "Nhập từ khóa lẻ..."}
                                    className="w-full pl-9 pr-3 py-2 bg-[#020617]/80 border border-slate-850/50 focus:border-sky-500/80 rounded-xl text-xs text-slate-100 outline-none placeholder-[#a3947c]/40 font-sans transition-all shadow-inner font-medium"
                                    value={searchTerm}
                                    onChange={e => onSearchChange(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && viewMode === 'semantic') onSemanticSearch();
                                    }}
                                />
                            </div>
                            {viewMode === 'semantic' && (
                                <button 
                                    onClick={onSemanticSearch}
                                    disabled={isSearchingSemantic || !searchTerm.trim()}
                                    className="px-3.5 py-2 bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.35)] hover:bg-sky-600 disabled:opacity-40 text-[#16100c] rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 flex items-center justify-center hover:scale-[1.01]"
                                    title="Quét đối sánh"
                                >
                                    {isSearchingSemantic ? "Quét..." : "Tìm"}
                                </button>
                            )}
                        </div>

                        {/* Staggered category filter list */}
                        <div className="flex gap-1.5 pb-1 overflow-x-auto custom-scrollbar items-center select-none text-left">
                            <button 
                                onClick={() => onCategoryFilterChange(null)}
                                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider transition-all border ${
                                    activeCategoryFilter === null 
                                    ? 'bg-sky-500/15 text-sky-400 border-slate-800/80 shadow-sm' 
                                    : 'bg-[#020617]/50 text-slate-400 border-slate-850/30 hover:bg-[#020617] hover:text-slate-100'
                                }`}
                            >
                                Tất cả
                            </button>
                            {Object.entries(CATEGORY_MAP).map(([catValue, catInfo]: any) => {
                                const isSelected = activeCategoryFilter === catValue;
                                return (
                                    <button 
                                        key={catValue}
                                        onClick={() => onCategoryFilterChange(catValue)}
                                        className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider transition-all border flex items-center gap-1 ${
                                            isSelected 
                                            ? 'bg-sky-500/15 text-sky-400 border-slate-800/80 shadow-md' 
                                            : 'bg-[#020617]/50 text-slate-400 border-slate-850/30 hover:bg-[#020617] hover:text-slate-100'
                                        }`}
                                    >
                                        {React.createElement(catInfo.icon, { size: 9 })} {catInfo.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Content area: either the list of entries or the rendered tool */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#020617]/40 relative z-10">
                {(viewMode === 'keyword' || viewMode === 'semantic') ? (
                    <div className="p-3 space-y-2">
                        {/* Count bar */}
                        <div className="flex items-center justify-between px-2 py-1 mb-1 text-left">
                            <span className="text-[9px] font-mono font-bold text-slate-400 tracking-widest uppercase flex items-center gap-1 select-none">
                                <Database size={10} className="text-sky-400" /> Danh mục ({filteredEntries.length})
                            </span>
                            <button 
                                onClick={onAdd} 
                                className="text-slate-400 hover:text-sky-400 bg-slate-950/60 hover:bg-slate-950 p-1.5 rounded-lg transition-colors border border-slate-850/30 hover:border-sky-500/40/35 flex items-center justify-center shadow-inner" 
                                title="Đăng ký Cổ Thư mới"
                            >
                                <Plus size={13} />
                            </button>
                        </div>

                        {/* List entries */}
                        {filteredEntries.length === 0 ? (
                            <div className="text-center text-slate-400 py-16 text-xs flex flex-col items-center gap-3">
                                <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-850/50">
                                    <Search size={20} className="opacity-40 text-sky-400" />
                                </div>
                                <span className="font-mono text-[10px] tracking-widest uppercase">
                                    {searchTerm ? "Thư tịch chưa mở..." : "Khố tạng hoàn toàn trống"}
                                </span>
                            </div>
                        ) : (
                            filteredEntries.map(entry => {
                                const isSelected = selectedId === entry.id;
                                const isEnabled = entry.isEnabled !== false;
                                const catInfo = CATEGORY_MAP[entry.category || 'world'];
                                return (
                                    <button
                                        key={entry.id}
                                        onClick={() => onSelect(entry.id)}
                                        className={`w-full text-left p-3.5 rounded-xl border transition-all relative overflow-hidden flex flex-col gap-1.5 ${
                                            isSelected 
                                            ? 'bg-sky-950/35 border-sky-500/40 shadow-[0_4px_12px_rgba(0,0,0,0.25)] scale-[1.01]' 
                                            : 'bg-slate-950/45 border-slate-850/30 hover:border-sky-500/40/35 hover:bg-slate-950'
                                        } ${!isEnabled ? 'opacity-40 grayscale' : ''}`}
                                    >
                                        {/* Status heading golden line indicator */}
                                        {isSelected && (
                                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-sky-500 shadow-[0_0_12px_rgba(56,189,248,0.35)] rounded-r-md"></div>
                                        )}
                                        
                                        {/* Entry title and category ribbon */}
                                        <div className="flex items-center justify-between gap-2 w-full">
                                            <div className="flex items-center gap-1.5 select-none min-w-0 flex-1">
                                                {catInfo && (
                                                    <span className="text-sky-400 shrink-0 opacity-80">
                                                        {React.createElement(catInfo.icon, { size: 11 })}
                                                    </span>
                                                )}
                                                <h5 className={`font-sans font-black text-slate-100 tracking-wide capitalize text-xs truncate group-hover:text-sky-300 ${!isEnabled ? 'line-through' : ''}`}>
                                                    {entry.keyword || 'Vô danh thư'}
                                                </h5>
                                            </div>

                                            <div className="flex gap-1 shrink-0">
                                                {entry.isSticky && (
                                                    <span className="p-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-bold text-[7px]" title="Luôn găm">
                                                        <Pin size={6} />
                                                    </span>
                                                )}
                                                {entry.triggerMode === 'always' && (
                                                    <span className="px-1 py-0.5 bg-[#eae3d2]/5 border border-[#eae3d2]/10 text-sky-400 rounded font-bold text-[7px] uppercase tracking-wider select-none h-3 leading-none flex items-center justify-center">
                                                        Always
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content snippet */}
                                        <p className="text-[10px] text-slate-400 font-sans line-clamp-2 leading-relaxed opacity-95">
                                            {entry.category === 'character' ? (() => {
                                                try {
                                                    const cData = JSON.parse(entry.text || "{}");
                                                    return [cData.narrativeRole, cData.personality, cData.appearance].filter(Boolean).join(" • ").replace(/[#*`~>]/g, '');
                                                } catch {
                                                    return (entry.text || '').replace(/[#*`~>]/g, '');
                                                }
                                            })() : (entry.text || '').replace(/[#*`~>]/g, '')}
                                        </p>

                                        {/* Footer Metadata */}
                                        <div className="flex items-center justify-between border-t border-slate-850/15 pt-1.5 mt-0.5 text-[8px] text-slate-400 font-mono font-bold tracking-widest uppercase">
                                             <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                                             <div className="flex items-center gap-1">
                                                 <span>{Math.round((entry.text?.length || 0)/3.8)} TKs</span>
                                                 <ChevronRight size={10} className={`transition-transform text-sky-400 ${isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'}`} />
                                             </div>
                                        </div>
                                    </button>
                                );
                             })
                        )}
                    </div>
                ) : (
                    <div className="h-full p-2 relative animate-fadeIn">
                        {renderTool?.()}
                    </div>
                )}
            </div>
        </div>
    );
};
