import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { VectorData } from "../../../../../services/db/indexedDB";
import { CharacterSheetEditor } from "../../../world-creation/CharacterSheetEditor";
import { CharacterSheet } from "../../../../../types";
import {
  Sparkles,
  Shrink,
  Maximize2,
  FileCode,
  Tags,
  Link as LinkIcon,
  Plus,
  X,
  User,
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Filter,
  Sliders,
  Settings,
  Cpu,
  Bookmark,
  Award,
  Pin,
  Eye,
  Globe,
  Compass,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { worldAiService } from "../../../../../services/ai/world-creation/service";
import { useAppStore } from "../../../../../store/appStore";

export interface EntryEditorProps {
  formData: Partial<VectorData>;
  onChange: (field: keyof VectorData, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isEditing: boolean;
  entries: VectorData[]; // Existing entries list for links
}

export const EntryEditor: React.FC<EntryEditorProps> = ({
  formData,
  onChange,
  onSave,
  onCancel,
  isSaving,
  isEditing,
  entries = [],
}) => {
  const [keywordsText, setKeywordsText] = useState("");
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [isGeneratingTarget, setIsGeneratingTarget] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiIdeaPrompt, setAiIdeaPrompt] = useState("");
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [showRpgAttrs, setShowRpgAttrs] = useState(true);
  const [showLinksArea, setShowLinksArea] = useState(true);
  const [relatedSearchTerm, setRelatedSearchTerm] = useState("");
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'content' | 'trigger' | 'stats_network'>('content');

  // Wizard states (for adding new entries)
  const [wizardStep, setWizardStep] = useState(1);

  const { settings } = useAppStore();
  const currentModel = settings?.aiModel || "gemini-3.5-flash";

  // Keyboard Shortcuts Listener for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
      // Escape to cancel edit
      if (e.key === "Escape" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onCancel]);

  // Sync formData.keywords to local tag systems
  useEffect(() => {
    setKeywordsText(formData.keywords?.join(", ") || "");
    setSuggestedKeywords([]);
  }, [formData.keywords, formData.id]);

  const handleKeywordsChange = (val: string) => {
    setKeywordsText(val);
    const parsed = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    onChange("keywords", parsed);
  };

  const handleAddKeywordBadge = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    const currentList = formData.keywords || [];
    if (currentList.some((w) => w.toLowerCase() === trimmed.toLowerCase())) return;

    const newList = [...currentList, trimmed];
    onChange("keywords", newList);
    setKeywordsText(newList.join(", "));
  };

  const handleRemoveKeywordBadge = (idxToRemove: number) => {
    const currentList = formData.keywords || [];
    const newList = currentList.filter((_, idx) => idx !== idxToRemove);
    onChange("keywords", newList);
    setKeywordsText(newList.join(", "));
  };

  const handleAddKeywordFromInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeywordInput.trim()) {
      handleAddKeywordBadge(newKeywordInput.trim());
      setNewKeywordInput("");
    }
  };

  // Character Sheet JSON parse
  const characterData = useMemo(() => {
    if (formData.category !== "character") return null;
    try {
      return JSON.parse(formData.text || "{}") as Partial<CharacterSheet>;
    } catch {
      return { narrativeRole: formData.text } as Partial<CharacterSheet>;
    }
  }, [formData.text, formData.category]);

  const handleCharacterSheetChange = (
    field: keyof CharacterSheet,
    value: string
  ) => {
    const newData = { ...characterData, [field]: value };
    onChange("text", JSON.stringify(newData, null, 2));
  };

  const handleAiGenKnowledge = async () => {
    if (!characterData?.knowledge_train?.trim()) {
      toast.warning("Vui lòng nhập dữ liệu gốc (Knowledge Base) trước.");
      return;
    }

    setIsGeneratingTarget(true);
    try {
      const generatedSheet =
        await worldAiService.generateCharacterSheetFromKnowledge(
          characterData.knowledge_train,
          currentModel,
          settings
        );
      const newData = {
        ...characterData,
        ...generatedSheet,
        knowledge_train: characterData.knowledge_train,
      };
      onChange("text", JSON.stringify(newData, null, 2));
      toast.success("Đã sinh nhân vật từ Knowledge Base thành công!");
    } catch (error: any) {
      console.error(error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      toast.error(`Lỗi khi tạo hình nhân vật từ Knowledge. Chi tiết: ${errorMsg}`);
    } finally {
      setIsGeneratingTarget(false);
    }
  };

  // --- CORE SYSTEM REMAKE AI COMMANDS ---

  const handleAiDraftFromIdea = async () => {
    if (!formData.keyword?.trim()) {
      toast.warning("Vui lòng nhập Từ khóa chính làm tiêu đề trước.");
      return;
    }
    if (!aiIdeaPrompt.trim()) {
      toast.warning("Vui lòng nhập một vài phác thảo ý tưởng để AI giúp bạn bồi đắp!");
      return;
    }

    setIsAiProcessing(true);
    try {
      const gLore = await worldAiService.generateEncyclopediaEntry(
        formData.keyword,
        formData.category || "world",
        aiIdeaPrompt,
        currentModel,
        settings
      );
      if (gLore) {
        onChange("text", gLore);
        setAiIdeaPrompt("");
        toast.success("Draft thành công bối cảnh từ ý tưởng!");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Có lỗi xảy ra khi gọi AI Drafting. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiRefinement = async (action: "condense" | "expand" | "format") => {
    const currentText = formData.text || "";
    if (!currentText.trim() || formData.category === "character") {
      toast.warning("Hãy nhập một ít thông tin bối cảnh vào ô bên dưới trước khi yêu cầu tinh luyện.");
      return;
    }

    setIsAiProcessing(true);
    try {
      const refined = await worldAiService.refineEncyclopediaEntry(
        currentText,
        action,
        currentModel,
        settings
      );
      if (refined) {
        onChange("text", refined);
        toast.success("Tinh luyện bối cảnh bằng AI thành công!");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Không thể tinh luyện bối cảnh bằng AI. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiExtractKeywords = async () => {
    const currentText = formData.text || "";
    if (!currentText.trim() || formData.category === "character") {
      toast.warning("Nhập nội dung bối cảnh trước khi phân tích trích xuất từ khóa kích hoạt.");
      return;
    }

    setIsAiProcessing(true);
    try {
      const words = await worldAiService.extractTriggerKeywords(
        currentText,
        currentModel,
        settings
      );
      if (words && words.length > 0) {
        setSuggestedKeywords(words);
        toast.success(`Đã trích xuất xong ${words.length} từ khóa kích thích!`);
      } else {
        toast.warning("AI không tìm thấy từ khóa kích hoạt phù hợp đạt chuẩn.");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Lỗi trích xuất từ khóa kích hoạt. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleAiAutoExtractStats = async () => {
    const currentText = formData.text || "";
    if (!currentText.trim() || formData.category === "character") {
      toast.warning("Hãy điền nội dung bối cảnh trước để AI phân tích cấu trúc.");
      return;
    }

    setIsAiProcessing(true);
    try {
      const extAttrs = await worldAiService.autoExtractRpgAttributes(
        currentText,
        formData.category || "world",
        currentModel,
        settings
      );
      if (extAttrs && Object.keys(extAttrs).length > 0) {
        onChange("rpg_attrs" as any, extAttrs);
        toast.success("Trích xuất chỉ số thuộc tính thành công!");
      } else {
        toast.warning("Không tìm thấy thông số phù hợp thích ứng loại danh mục này.");
      }
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(`Lỗi phân tích thông số RPG tự động. Chi tiết: ${errorMsg}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const getRpgAttrs = (): Record<string, string> => {
    return (formData as any).rpg_attrs || {};
  };

  const handleRpgAttrChange = (key: string, val: string) => {
    const current = getRpgAttrs();
    onChange("rpg_attrs" as any, { ...current, [key]: val });
  };

  // Convert priority to Human Readable Tier helper
  const priorityTier = useMemo(() => {
    const pr = formData.priority || 50;
    if (pr >= 90) return { text: "S Class (Ưu tiên Tối thượng)", class: "S" };
    if (pr >= 75) return { text: "A Class (Ưu tiên Cao)", class: "A" };
    if (pr >= 50) return { text: "B Class (Ưu tiên Trung bình)", class: "B" };
    if (pr >= 30) return { text: "C Class (Ưu tiên Thấp)", class: "C" };
    return { text: "D Class (Lưu trữ Bị động)", class: "D" };
  }, [formData.priority]);

  // Set designated priority values via Tier select click
  const setPriorityByTier = (tierLetter: "S" | "A" | "B" | "C" | "D") => {
    const defaultVal = tierLetter === "S" ? 95 :
                       tierLetter === "A" ? 82 :
                       tierLetter === "B" ? 60 :
                       tierLetter === "C" ? 40 : 15;
    onChange("priority", defaultVal);
  };

  // 1. Live Context Injection Preview Generator
  const contextInjectionPreviewText = useMemo(() => {
    const delimiter = "=======================";
    const catLabel = formData.category?.toUpperCase() || "WORLD";
    const title = formData.keyword?.trim() || "VÔ DANH THƯ";
    const pr = formData.priority || 50; 
    const mode = formData.triggerMode || "hybrid";
    const pos = formData.position || "before_char";
    
    // Build RPG traits string
    let rpgLines = "";
    if (formData.category !== "character") {
      const attrs = getRpgAttrs();
      const entries = Object.entries(attrs).filter(([_, v]) => v.trim());
      if (entries.length > 0) {
        rpgLines = "\n[RPG TRAITS]\n" + entries.map(([k, v]) => `  • ${k.toUpperCase()}: ${v}`).join("\n");
      }
    }

    // Related entries list
    const linksList = (formData.relatedEntries || []).map(id => {
      const matched = entries.find(e => e.id === id);
      return matched ? matched.keyword : null;
    }).filter(Boolean);
    const relatedLine = linksList.length > 0 ? `\n[RELATED ANCIENT LINES]: ${linksList.join(" <-> ")}` : "";

    // Text content
    let contentSnippet = "";
    if (formData.category === "character" && characterData) {
      contentSnippet = JSON.stringify(characterData, null, 2);
    } else {
      contentSnippet = formData.text || "Chưa điền văn bản ghi chép dã sử.";
    }

    return `${delimiter}
[PROMPT INJECTION BLOCK] - (Vị trí nạp: ${pos.toUpperCase()})
[PRIORITY CLASS: ${priorityTier.class} (Value: ${pr})] • [TRIGGER LOGIC: ${mode.toUpperCase()}]
${delimiter}

[ENCYCLOPEDIA REFERENCE: ${catLabel} - ${title}]${rpgLines}${relatedLine}

${contentSnippet}

${delimiter}`;
  }, [formData, characterData, entries, priorityTier]);

  return (
    <div id="entry-editor-root" className="flex flex-col lg:flex-row h-full bg-[#020617] text-slate-100 overflow-hidden select-none font-sans relative">
      <div className="absolute inset-0 bg-repeat bg-center opacity-[0.012] pointer-events-none mix-blend-color-burn" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/dark-matter.png')" }} />

      {/* LEFT COLUMN: The Complete Rich Editor Form (58%) */}
      <div className="flex-1 lg:w-[58%] flex flex-col h-full border-r border-slate-800/60 relative overflow-y-auto custom-scrollbar">
        
        {/* Header Action Bar */}
        <div className="px-5 py-4 border-b border-slate-800/70 flex justify-between items-center bg-slate-900/95 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Bookmark size={16} className="text-sky-400 animate-pulse" />
            <h3 className="font-sans font-extrabold text-slate-100 tracking-wider uppercase text-sm">
              {isEditing ? "Hiệu đính Cổ Thư" : "Khai hoang Cốt truyện Mới"}
            </h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={isSaving || isAiProcessing}
              className="px-4 py-1.5 bg-slate-950 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200 rounded-xl font-mono text-[10px] font-bold border border-slate-800/80 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={onSave}
              disabled={isSaving || isAiProcessing}
              className="px-4 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl font-bold text-[10px] uppercase tracking-wide transition-all shadow hover:translate-y-[-1px] disabled:opacity-40"
              title="Lưu hoặc phím tắt Ctrl+S"
            >
              {isSaving ? "Đang găm..." : "Thiết lập tri thức ✓"}
            </button>
          </div>
        </div>

        {/* Inner Forms */}
        <div className="p-4 lg:p-6 space-y-6 pb-20 text-left">
          {isAiProcessing && (
            <div className="absolute inset-0 z-40 bg-slate-950/85 flex justify-center items-center">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl flex items-center gap-3">
                <RefreshCw size={20} className="animate-spin text-sky-400" />
                <span className="text-xs font-sans font-bold text-slate-200 uppercase tracking-wider">
                  AI Scribe đang chế biến bối cảnh thần tích...
                </span>
              </div>
            </div>
          )}

          {isEditing ? (
            <>
              {/* Core Tab selection */}
              <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 shadow-inner gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'content'
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BookOpen size={11} />
                  1. Văn thư căn nguyên
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('trigger')}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'trigger'
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Filter size={11} />
                  2. Quy pháp kích hoạt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('stats_network')}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'stats_network'
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders size={11} />
                  3. Thuộc tính & Cầu nối
                </button>
              </div>

              {/* TAB 1: CONTENT / PROFILE */}
              {activeTab === 'content' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Title & category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 shadow">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-widest block">
                    Danh xưng căn nguyên / Title (Từ khóa chính)
                  </label>
                  <input
                    type="text"
                    value={formData.keyword || ""}
                    onChange={(e) => onChange("keyword", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-sans font-black text-slate-100 outline-none focus:border-sky-500/50 transition-colors"
                    placeholder="Vd: Hiệp sĩ Galahad, Eldoria..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-widest block">
                    Xếp loại Tri thư / Category
                  </label>
                  <select
                    value={formData.category || "world"}
                    onChange={(e) => {
                      onChange("category", e.target.value);
                      onChange("rpg_attrs" as any, {});
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-slate-100 outline-none focus:border-sky-500/50 transition-colors"
                  >
                    <option value="character">Nhân vật (Character Profile)</option>
                    <option value="location">Địa danh (Location Guide)</option>
                    <option value="faction">Thế lực / Bang phái (Faction Spec)</option>
                    <option value="item">Cổ vật dã thiết (Item Stats)</option>
                    <option value="event">Sự kiện / Lịch ký (Event Chrono)</option>
                    <option value="law">Quy tắc thế giới (World Law)</option>
                    <option value="world">Lore chung (General Lore)</option>
                  </select>
                </div>
              </div>

              {/* AI Scribe Assistive Panel */}
              {formData.category !== "character" && (
                <div className="bg-slate-900/60 p-4 border border-slate-800/80 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 flex-wrap gap-2">
                    <span className="text-[9px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1.5 tracking-widest">
                      <Sparkles size={11} className="text-sky-450 animate-pulse" />
                      AI Chronicles Scribe (Biên niên căn bản)
                    </span>
                    <span className="text-[8px] font-mono py-0.5 px-2 bg-slate-950 text-sky-400 hover:underline cursor-pointer border border-slate-800/60 rounded uppercase">
                      Gemini flash Engine
                    </span>
                  </div>

                  {!(formData.text || "").trim() ? (
                    <div className="space-y-2.5">
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Bạn chưa viết nội dung bối cảnh mục này? Đơn giản gõ ý tưởng phác họa sơ bộ dưới đây, AI sẽ hỗ trợ dệt nên một bản văn dã sử toàn chỉnh!
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={aiIdeaPrompt}
                          onChange={(e) => setAiIdeaPrompt(e.target.value)}
                          placeholder="Ý tưởng tóm lược (Vd: Ma đạo hội quỷ, ẩn dật vùng đồi hoang dã dã sương)..."
                          className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs outline-none focus:border-sky-500/50 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={handleAiDraftFromIdea}
                          disabled={isAiProcessing || !aiIdeaPrompt.trim() || !formData.keyword?.trim()}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-45 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 shrink-0"
                        >
                          <Sparkles size={10} /> Dệt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-left">
                      <span className="text-[9px] font-mono text-slate-400 font-black uppercase block tracking-wider">Cử hành Pháp thuật AI Tinh mài văn trạng:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAiRefinement("condense")}
                          disabled={isAiProcessing}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-lg hover:border-sky-500 hover:text-sky-400 transition-all flex items-center gap-1"
                        >
                          <Shrink size={10} /> Chưng cất tối ưu
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiRefinement("expand")}
                          disabled={isAiProcessing}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-lg hover:border-sky-500 hover:text-sky-400 transition-all flex items-center gap-1"
                        >
                          <Maximize2 size={10} /> Thổi bùng câu ví
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAiRefinement("format")}
                          disabled={isAiProcessing}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 text-xs text-slate-350 rounded-lg hover:border-sky-500 hover:text-sky-400 transition-all flex items-center gap-1"
                        >
                          <FileCode size={10} /> Thắp cấu trúc MD
                        </button>
                        <button
                          type="button"
                          onClick={handleAiExtractKeywords}
                          disabled={isAiProcessing}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-800/60 text-xs text-slate-400 rounded-lg hover:border-sky-500 hover:text-sky-400 transition-all flex items-center gap-1"
                        >
                          <Tags size={10} /> Quét từ khóa
                        </button>
                      </div>

                      {suggestedKeywords.length > 0 && (
                        <div className="pt-2 border-t border-slate-800/80 mt-1.5 space-y-1.5">
                          <span className="text-[9px] font-mono font-bold text-sky-400 uppercase block tracking-wider">Từ khóa AI tìm thấy (Click để gán kích hoạt phụ):</span>
                          <div className="flex flex-wrap gap-1">
                            {suggestedKeywords.map((word, idx) => {
                              const exists = (formData.keywords || []).some((w) => w.toLowerCase() === word.toLowerCase());
                              return (
                                <button
                                  type="button"
                                  key={idx}
                                  onClick={() => handleAddKeywordBadge(word)}
                                  disabled={exists}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                                    exists
                                      ? "bg-slate-950 border-slate-900 text-slate-550/40 cursor-not-allowed"
                                      : "bg-slate-900 border-slate-800 hover:border-sky-500 text-sky-400"
                                  }`}
                                >
                                  #{word} {!exists && "+"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Main text area or sheet character */}
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 shadow space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] font-mono font-semibold uppercase text-slate-400 tracking-widest">
                    Chính Văn Thư tịch (Core Description)
                  </span>
                  <span className="text-[9px] font-mono text-sky-400 font-bold">
                    ~{Math.round((formData.text?.length || 0) / 3.8)} Tokens
                  </span>
                </div>

                {formData.category === "character" && characterData ? (
                  <div className="bg-slate-950 border border-slate-805 rounded-xl p-3 space-y-3 relative shadow-inner">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-850/60 pb-2">
                      <p className="text-[10px] text-slate-400 italic leading-normal max-w-sm">
                        Nhấn nút dưới để AI tự động cấu trúc hồ sơ chuẩn hóa từ dữ liệu dán ở góc Học tập nhân vật.
                      </p>
                      <button
                        type="button"
                        onClick={handleAiGenKnowledge}
                        disabled={isGeneratingTarget || !characterData.knowledge_train?.trim()}
                        className="py-1 px-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] rounded uppercase tracking-wide inline-flex items-center gap-1 shrink-0 disabled:opacity-40"
                      >
                        AI Structurize
                      </button>
                    </div>
                    <CharacterSheetEditor
                      data={characterData}
                      onChange={handleCharacterSheetChange}
                    />
                  </div>
                ) : (
                  <textarea
                    value={formData.text || ""}
                    onChange={(e) => onChange("text", e.target.value)}
                    className="w-full h-[330px] p-4 bg-slate-950 border border-slate-800 focus:border-sky-500/50 text-xs sm:text-sm text-slate-100 outline-none rounded-xl font-sans leading-relaxed resize-y shadow-inner transition-colors"
                    placeholder="Mở vết dã sử cổ thư, tóm lược mốc sự tích, thuộc tính... Hỗ trợ đầy đủ cú pháp tinh chế văn dã Markdown..."
                  />
                )}
              </div>

            </div>
          )}

          {/* TAB 2: TRIGGER SENSORS LOGIC & DIAGRAM */}
          {activeTab === 'trigger' && (
            <div className="space-y-6 animate-fadeIn text-left">
              
              {/* Redesigned Trigger Mode SELECTOR CARDS Instead of standard dropdown */}
              <div className="space-y-2">
                <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest block">
                  Phương án Cảm Ứng (Sensor Trigger Logic)
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                  {[
                    { mode: "always", label: "Always-On", desc: "Luôn kích hoạt cố định găm sẵn vào mọi lượt.", icon: "🔴" },
                    { mode: "keyword", label: "Keyword Match", desc: "Chỉ thắp sấy khi trùng khớp chuẩn từ khóa cổ.", icon: "🟡" },
                    { mode: "semantic", label: "Semantic", desc: "Kích hoạt bằng cảm biến tương đồng ngữ nghĩa AI.", icon: "🟣" },
                    { mode: "hybrid", label: "Hybrid Core", desc: "Kết hợp cả từ khóa lẻ và trí thông minh Vector.", icon: "🟢" }
                  ].map((item) => {
                    const isSelected = (formData.triggerMode || "hybrid") === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => onChange("triggerMode", item.mode)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-500 shadow-[0_4px_12px_rgba(14,165,233,0.15)] scale-[1.01]"
                            : "bg-slate-900/40 border-slate-800/60 hover:border-sky-500/30 hover:bg-slate-900/60"
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs font-black text-slate-100 mb-1">
                          <span className="font-sans text-sky-400">{item.label}</span>
                          <span>{item.icon}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tag system: Inline Tag builder with crossed chips */}
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-2.5">
                <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest block">
                  Cảm ứng thứ cấp / Keywords (Cách nhau bởi dấu phẩy, hỗ trợ tag nhanh)
                </span>
                
                {/* Visual Chips Wrapper */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950 border border-slate-800/60 rounded-lg min-h-[44px]">
                  {(!formData.keywords || formData.keywords.length === 0) ? (
                    <span className="text-[10px] text-slate-500 italic self-center px-1">Chưa gán từ khóa phụ kích hoạt dã ngoại.</span>
                  ) : (
                    formData.keywords.map((chip, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg text-[10px] font-mono"
                      >
                        #{chip}
                        <button
                          type="button"
                          onClick={() => handleRemoveKeywordBadge(idx)}
                          className="text-sky-400 hover:text-red-400 focus:outline-none ml-0.5"
                          title="Hủy gỡ từ khóa"
                        >
                          ✕
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Inline Addition input form */}
                <form onSubmit={handleAddKeywordFromInput} className="flex gap-2">
                  <input
                    type="text"
                    value={newKeywordInput}
                    onChange={(e) => setNewKeywordInput(e.target.value)}
                    placeholder="Gõ từ khóa mới rồi nhấn Enter để găm..."
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs outline-none focus:border-sky-500/50"
                  />
                  <button
                    type="submit"
                    className="px-3 bg-sky-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-sky-400 transition-colors"
                  >
                    + Găm
                  </button>
                </form>
              </div>

              {/* Visual clickable Prompt Stack Position Diagram */}
              <div className="space-y-3 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest block">
                    Định vị điểm chèn sấm kịch (Insertion visual architecture)
                  </span>
                  <p className="text-[10px] text-slate-400 leading-relaxed">AI sẽ xử lý bối cảnh tri thức nhanh hơn nếu định cấu trúc địa vị chính xác.</p>
                </div>

                {/* Diagram Stack list */}
                <div className="flex flex-col gap-1 border border-slate-800/60 bg-slate-950 p-2.5 rounded-xl font-mono text-[9px] text-slate-300 uppercase font-black">
                  
                  <div className="px-3 py-1.5 border border-dashed border-slate-800/40 bg-slate-900/30 rounded text-center text-slate-500">
                    System Instructions (Mệnh lệnh quy chế gốc)
                  </div>
                  
                  {/* segment 1 */}
                  <button
                    type="button"
                    onClick={() => onChange("position", "before_char")}
                    className={`p-2 border rounded transition-all text-center ${
                      (formData.position || "before_char") === "before_char"
                        ? "border-sky-500 text-sky-400 bg-sky-500/10"
                        : "border-slate-800 hover:border-sky-500/30 hover:text-slate-100"
                    }`}
                  >
                    ✦ Before Characters (Trước mô tả tính NPC)
                  </button>

                  <div className="px-3 py-1.5 border border-dashed border-slate-800/40 bg-slate-900/30 rounded text-center text-slate-500">
                    Characters Sheet (Bản sắc nhân vật)
                  </div>

                  {/* segment 2 */}
                  <button
                    type="button"
                    onClick={() => onChange("position", "after_char")}
                    className={`p-2 border rounded transition-all text-center ${
                      (formData.position || "before_char") === "after_char"
                        ? "border-sky-500 text-sky-400 bg-sky-500/10"
                        : "border-slate-800 hover:border-sky-500/30 hover:text-slate-100"
                    }`}
                  >
                    ✦ After Characters (Sau tính cách hệ thống)
                  </button>

                  {/* segment 3 */}
                  <button
                    type="button"
                    onClick={() => onChange("position", "before_history")}
                    className={`p-2 border rounded transition-all text-center ${
                      (formData.position || "before_char") === "before_history"
                        ? "border-sky-500 text-sky-400 bg-sky-500/10"
                        : "border-slate-800 hover:border-sky-500/30 hover:text-slate-100"
                    }`}
                  >
                    ✦ Before Chat History (Bản lề lưu trước đoạn thoại)
                  </button>

                  <div className="px-3 py-1.5 border border-dashed border-slate-800/40 bg-slate-900/30 rounded text-center text-slate-500">
                    Conversation logs (Nhật ký tấu thoại)
                  </div>

                  {/* segment 4 */}
                  <button
                    type="button"
                    onClick={() => onChange("position", "after_history")}
                    className={`p-2 border rounded transition-all text-center ${
                      (formData.position || "before_char") === "after_history"
                        ? "border-sky-500 text-sky-400 bg-sky-500/10"
                        : "border-slate-800 hover:border-sky-500/30 hover:text-slate-100"
                    }`}
                  >
                    ✦ After Chat History / Author Notes (Cuối thoại - Cảm nhận mạnh nhất)
                  </button>

                  {/* segment 5 */}
                  <button
                    type="button"
                    onClick={() => onChange("position", "in_chat")}
                    className={`p-2 border rounded transition-all text-center ${
                      (formData.position || "before_char") === "in_chat"
                        ? "border-sky-500 text-sky-400 bg-sky-500/10"
                        : "border-slate-800 hover:border-sky-500/30 hover:text-slate-100"
                    }`}
                  >
                    ✦ In-Chat Depth (Nạp ngầm vào chiều sâu tin nhắn cũ)
                  </button>
                </div>

                {formData.position === "in_chat" && (
                  <div className="pt-2 animate-fadeIn flex flex-col gap-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center text-slate-400 tracking-widest text-[9px] uppercase">
                      Độ sâu lướt chèn ngược
                      <span className="text-sky-400 font-extrabold">{formData.depth || 0} lượt thoại trước</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={formData.depth || 0}
                        onChange={(e) => onChange("depth", parseInt(e.target.value) || 0)}
                        className="flex-1 accent-sky-500"
                      />
                      <span className="font-sans text-sm font-bold text-sky-400 w-8 text-right pr-1">{(formData.depth || 0)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority Stars Rating/Tier System */}
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3 text-left">
                <div className="flex justify-between items-baseline flex-wrap gap-2">
                  <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest block">
                    Ưu tiên Nạp (Priority Classes)
                  </span>
                  <span className="text-[10px] font-mono text-sky-400 bg-slate-950 px-2 py-0.5 rounded font-black border border-slate-800">
                    {priorityTier.text} (Hệ số: {formData.priority || 50})
                  </span>
                </div>

                {/* Clickable Tier selections */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shadow-inner gap-1">
                  {(["D", "C", "B", "A", "S"] as const).map((tier) => {
                    const isActive = priorityTier.class === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setPriorityByTier(tier)}
                        className={`flex-1 py-1.5 text-xs font-mono font-black uppercase rounded transition-all ${
                          isActive
                            ? 'bg-sky-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/30'
                        }`}
                      >
                        {tier}-Tier
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5 pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.priority || 50}
                    onChange={(e) => onChange("priority", parseInt(e.target.value))}
                    className="w-full bg-slate-950 h-1.5 rounded-full outline-none accent-sky-500"
                  />
                  <span className="text-[9px] text-slate-405 italic block leading-relaxed">
                    * Nguyên lý: Trọng lượng chèn tri thức. Khi dung tích quá tải, hệ cao cấp gạt hệ thấp ra hòng tránh nhũ hóa bộ nhớ đệm bối cảnh gốc.
                  </span>
                </div>

                {/* Status switches inside editor */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/60 text-xs">
                  <label className="flex items-center gap-2.5 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isEnabled ?? true}
                      onChange={(e) => onChange("isEnabled", e.target.checked)}
                      className="accent-sky-550 rounded cursor-pointer"
                    />
                    <div className="text-left font-mono">
                      <span className="text-[10px] block font-bold text-slate-200">ENABLED</span>
                      <span className="text-[8px] text-slate-400 block">Mở cảm biến liên ứng</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 bg-slate-950 rounded-lg border border-slate-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isSticky ?? false}
                      onChange={(e) => onChange("isSticky", e.target.checked)}
                      className="accent-sky-550 rounded cursor-pointer"
                    />
                    <div className="text-left font-mono">
                      <span className="text-[10px] block font-bold text-slate-200">PIN STICKY</span>
                      <span className="text-[8px] text-slate-400 block">Găm tri thức vĩnh hằng</span>
                    </div>
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: RPG TEXTBOOK ATTRIBUTES & LINKS */}
          {activeTab === 'stats_network' && (
            <div className="space-y-6 animate-fadeIn text-left">
              
              {/* RPG Technical stats attributes */}
              {formData.category !== "character" && (
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl overflow-hidden shadow">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800/60 bg-slate-950">
                    <span className="flex items-center gap-1.5 font-sans font-bold text-xs text-sky-400 uppercase tracking-wide">
                      <Activity size={13} className="text-sky-400 animate-pulse" />
                      RPG Attributes (Tri căn dã thiết)
                    </span>
                    <button
                      type="button"
                      onClick={handleAiAutoExtractStats}
                      disabled={isAiProcessing || !(formData.text || "").trim()}
                      className="py-1 px-3 bg-sky-500/10 hover:bg-sky-500 hover:text-slate-950 disabled:opacity-40 text-[9px] text-sky-400 font-mono font-bold rounded-lg transition-colors flex items-center gap-1 border border-sky-500/20"
                    >
                      <Sparkles size={10} /> AI Auto-Fill
                    </button>
                  </div>

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {formData.category === "location" && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Khí hậu / Climate</label>
                          <input type="text" value={getRpgAttrs().climate || ""} onChange={(e) => handleRpgAttrChange("climate", e.target.value)} placeholder="Sương lạnh mù sương, tuyết trắng..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Bộ túc cai quản / Ruler</label>
                          <input type="text" value={getRpgAttrs().ruler || ""} onChange={(e) => handleRpgAttrChange("ruler", e.target.value)} placeholder="Tuyết Nũ vương Kaelen..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Cư dân định cư / Population</label>
                          <input type="text" value={getRpgAttrs().population || ""} onChange={(e) => handleRpgAttrChange("population", e.target.value)} placeholder="1,500 Tinh linh Tuyết..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase font-bold text-sky-400">Mức nguy hại (Danger)</label>
                          <select value={getRpgAttrs().danger_level || "B"} onChange={(e) => handleRpgAttrChange("danger_level", e.target.value)} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs">
                            <option value="Safe">S (Safe) - Tuyệt đối An toàn</option>
                            <option value="D">D - Thấp</option>
                            <option value="C">C - Trung bình</option>
                            <option value="B">B - Nguy cơ</option>
                            <option value="A">A - Nguy hiểm Cao</option>
                            <option value="S_class">S_Class - Tử địa phong ấn</option>
                          </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Điểm kỳ thắm đáng nhớ</label>
                          <input type="text" value={getRpgAttrs().points_of_interest || ""} onChange={(e) => handleRpgAttrChange("points_of_interest", e.target.value)} placeholder="Đền cổ đóng băng, động pha lê thạch lam..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                      </>
                    )}

                    {formData.category === "faction" && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Tổ lĩnh tối cao (Leader)</label>
                          <input type="text" value={getRpgAttrs().leader || ""} onChange={(e) => handleRpgAttrChange("leader", e.target.value)} placeholder="Raymond Đao Phủ bạc..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Đại doanh hoạt mật (HQ)</label>
                          <input type="text" value={getRpgAttrs().hq || ""} onChange={(e) => handleRpgAttrChange("hq", e.target.value)} placeholder="Hang đá Thung Lũng..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Khuynh hướng thế cuộc</label>
                          <input type="text" value={getRpgAttrs().alignment || ""} onChange={(e) => handleRpgAttrChange("alignment", e.target.value)} placeholder="Lawful Neutral (Pháp định)..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase font-bold text-sky-400">Danh vọng chính trị</label>
                          <select value={getRpgAttrs().influence || "Vừa"} onChange={(e) => handleRpgAttrChange("influence", e.target.value)} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs">
                            <option value="Nhỏ lẻ">Tiểu phái ẩn dật</option>
                            <option value="Vừa">Cát cứ trung bình</option>
                            <option value="Cao">Uy chấn đế chế vương quyền</option>
                            <option value="Cực cao">Thế lực bá chủ triệt tiêu vạn phương</option>
                          </select>
                        </div>
                      </>
                    )}

                    {formData.category === "item" && (
                      <>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Vật loại phân phân</label>
                          <input type="text" value={getRpgAttrs().item_type || ""} onChange={(e) => handleRpgAttrChange("item_type", e.target.value)} placeholder="Cổ cổ vật thất lạc..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Cổ kỳ phẩm bảo / Rarity</label>
                          <select value={getRpgAttrs().rarity || "Hiếm"} onChange={(e) => handleRpgAttrChange("rarity", e.target.value)} className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs">
                            <option value="Thường">Thường (Common)</option>
                            <option value="Hiếm">Hiếm thần kỳ</option>
                            <option value="Sử thi">Sử thi anh linh</option>
                            <option value="Truyền thuyết">Truyền thuyết vương tước</option>
                            <option value="Thần khí">Công cụ Thần Đế quyền năng</option>
                          </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase font-bold text-sky-400">Linh thi cường lực dã thuật</label>
                          <input type="text" value={getRpgAttrs().abilities || ""} onChange={(e) => handleRpgAttrChange("abilities", e.target.value)} placeholder="Hàm ý nguyền phong ấn kiếm khi khi..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                      </>
                    )}

                    {formData.category === "event" && (
                      <>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Kỷ niên diễn biến</label>
                          <input type="text" value={getRpgAttrs().timeline_date || ""} onChange={(e) => handleRpgAttrChange("timeline_date", e.target.value)} placeholder="Biến cố kỉ thứ hai thế gian sụp sụp..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Nhân vật/Quân túc di hữu can hệ</label>
                          <input type="text" value={getRpgAttrs().characters_involved || ""} onChange={(e) => handleRpgAttrChange("characters_involved", e.target.value)} placeholder="Pháp vương Magnus, Hiệp sĩ Galahad..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                      </>
                    )}

                    {formData.category !== "location" && formData.category !== "faction" && formData.category !== "item" && formData.category !== "event" && (
                      <>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[9px] font-mono text-slate-400 block uppercase">Mốc dã nguồn thần tích khởi thủy</label>
                          <input type="text" value={getRpgAttrs().origin || ""} onChange={(e) => handleRpgAttrChange("origin", e.target.value)} placeholder="Lời nguyền sương râm phong hóa thạch cổ xưa..." className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-100 focus:border-sky-500/50 text-xs font-sans" />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Related linked entries checklist visual */}
              {entries.filter(e => e.id !== formData.id).length > 0 && (
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl overflow-hidden shadow text-left">
                  <div className="px-4 py-3 flex justify-between items-center bg-slate-950 border-b border-slate-800/60">
                    <span className="flex items-center gap-1.5 font-sans font-bold text-xs text-sky-400 uppercase tracking-wide">
                      <LinkIcon size={12} className="text-sky-400" />
                      Trùng Kích Thiết Lập Liên Hồi (Intel Ties)
                    </span>
                    <span className="text-[8px] font-mono py-0 text-sky-400">
                      {(formData.relatedEntries || []).length} liên kết
                    </span>
                  </div>

                  <div className="p-4 space-y-3.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={relatedSearchTerm}
                        onChange={(e) => setRelatedSearchTerm(e.target.value)}
                        placeholder="Tìm cổ tăm dã thiết thiết lập liên chéo..."
                        className="flex-1 px-3 py-1 bg-slate-950 border border-slate-800 text-slate-100 rounded-lg text-xs outline-none focus:border-sky-500/50"
                      />
                    </div>

                    <div className="max-h-[160px] overflow-y-auto custom-scrollbar border border-slate-800/60 p-2.5 bg-slate-950 rounded-xl space-y-1">
                      {entries
                        .filter(e => e.id !== formData.id)
                        .filter(e => !relatedSearchTerm || (e.keyword || "").toLowerCase().includes(relatedSearchTerm.toLowerCase()))
                        .map((e) => {
                          const isLinked = (formData.relatedEntries || []).includes(e.id);
                          return (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => {
                                let nextList = [...(formData.relatedEntries || [])];
                                if (nextList.includes(e.id)) {
                                  nextList = nextList.filter(id => id !== e.id);
                                } else {
                                  nextList.push(e.id);
                                }
                                onChange("relatedEntries", nextList);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-all ${
                                isLinked
                                  ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                                  : "hover:bg-slate-900/60 text-slate-400 border border-transparent"
                              }`}
                            >
                              <span className="font-sans text-xs capitalize">{e.keyword || "Vô danh văn"}</span>
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isLinked ? "bg-sky-400 border-sky-400 text-slate-950" : "border-slate-800 bg-slate-950"}`}>
                                {isLinked && <Check size={8} strokeWidth={4} />}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </>
      ) : (
        /* WIZARD FLOW FOR NEW ENTRY */
        <div className="space-y-6 animate-fadeIn">
          {/* Wizard Steps bar */}
          <div className="flex justify-between items-center bg-slate-950 p-3 rounded-2xl border border-slate-800 text-[9px] font-mono tracking-wider mb-2 select-none">
            {[
              { step: 1, label: "1. Nhãn mục" },
              { step: 2, label: "2. Danh xưng" },
              { step: 3, label: "3. Biên khảo" },
              { step: 4, label: "4. Kích hoạt & Ưu tiên" },
              { step: 5, label: "5. Khảo duyệt" }
            ].map((s) => {
              const isActive = wizardStep === s.step;
              const isDone = wizardStep > s.step;
              return (
                <div key={s.step} className="flex items-center gap-2 flex-1 justify-center last:flex-initial">
                  <button
                    type="button"
                     onClick={() => wizardStep > s.step && setWizardStep(s.step)}
                    disabled={wizardStep <= s.step}
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs border transition-all ${
                      isActive
                        ? "bg-sky-500 text-slate-950 border-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]"
                        : isDone
                        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                        : "bg-slate-900 text-slate-400 border-slate-800"
                    }`}
                  >
                    {isDone ? "✓" : s.step}
                  </button>
                  <span className={`hidden sm:inline font-bold uppercase tracking-wider text-[8px] ${isActive ? "text-sky-400" : isDone ? "text-sky-400/70" : "text-slate-400"}`}>
                    {s.label.split(". ")[1]}
                  </span>
                  {s.step < 5 && <div className="hidden sm:block flex-1 h-px bg-slate-800/60 mx-2" />}
                </div>
              );
            })}
          </div>

          {/* Wizard Step 1: Category definition */}
          {wizardStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1 text-left">
                <h3 className="font-sans text-lg font-black text-sky-400 uppercase tracking-wide">Bước 1: Chọn Chủng Loại Thư Tịch / Category</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Xác lập phân mục bối cảnh để AI tối ưu hóa hệ thống ghi chép dã sử và căn tính thuộc tính thích ứng.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {[
                  { key: "character", icon: User, title: "Nhân Vật", desc: "Hồ sơ cá nhân, tâm tính, năng lực, đối thoại" },
                  { key: "location", icon: Globe, title: "Địa Điểm", desc: "Khí hậu, thành trì, địa hình bối cảnh" },
                  { key: "faction", icon: Award, title: "Thế Lực / Bang hội", desc: "Thế phiệt, tòng phái cai trị, dã vọng" },
                  { key: "item", icon: Bookmark, title: "Cổ Vật", desc: "Phẩm rarity, thần khí dã thiết pháp thuật" },
                  { key: "event", icon: Bookmark, title: "Sự Kiện", desc: "Trận chiến, lịch sử biên niên vương quốc" },
                  { key: "law", icon: Sliders, title: "Luật Lệ", desc: "Vật lý tự nhiên, ma pháp cấm thuật thế giới" },
                  { key: "world", icon: BookOpen, title: "Lore dã", desc: "Vần hóa tổng thể bối cảnh thế giới" }
                ].map((categ) => {
                  const isSelected = (formData.category || "world") === categ.key;
                  return (
                    <button
                      key={categ.key}
                      type="button"
                      onClick={() => {
                        onChange("category", categ.key);
                        onChange("rpg_attrs" as any, {});
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-[120px] overflow-hidden ${
                        isSelected
                          ? "bg-sky-500/10 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.15)] bg-gradient-to-tr from-sky-550/10 to-slate-900"
                          : "bg-slate-900/40 border-slate-800 hover:border-sky-500/30 hover:bg-slate-900/60"
                      }`}
                    >
                      {/* Corner deco */}
                      {isSelected && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-sky-550" />}
                      <div className={`p-1.5 w-7 h-7 rounded border flex items-center justify-center ${isSelected ? "text-sky-455 border-sky-500 bg-slate-950" : "text-slate-400 border-slate-800 bg-slate-950"}`}>
                        {React.createElement(categ.icon || BookOpen, { size: 14 })}
                      </div>
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-100 uppercase tracking-wide block">{categ.title}</span>
                        <span className="text-[9px] text-slate-400 leading-tight block mt-0.5 line-clamp-2">{categ.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-end border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold uppercase tracking-widest rounded-xl hover:translate-y-[-1px] transition-all flex items-center gap-1.5 shadow"
                >
                  Tiếp tục Bước 2 →
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 2: Title and identifiers */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1 text-left">
                <h3 className="font-sans text-lg font-black text-sky-400 uppercase tracking-wide">Bước 2: Sắc Lệnh Danh Xưng / Title & Keywords</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Hãy thiết lập từ khóa danh xưng chính và các từ liên can phụ cứu tế để AI đối sánh chuẩn sát.</p>
              </div>

              <div className="bg-slate-900/50 p-5 border border-slate-800/80 rounded-xl space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-401 tracking-widest block font-bold">Từ khóa chính / Title (Bắt buộc thiết lập)</label>
                  <input
                    type="text"
                    value={formData.keyword || ""}
                    onChange={(e) => onChange("keyword", e.target.value)}
                    placeholder="Vd: Hiệp sĩ Galahad, Eldoria, Thành trì Bão tố..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-lg text-sm font-sans font-bold text-slate-100 outline-none transition-colors"
                  />
                </div>

                <div className="space-y-1.5 pt-2 text-left">
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-401 tracking-widest block font-bold">Từ khóa phụ kích hoạt cảm biến (Phân chia bằng dấu phẩy)</label>
                  <input
                    type="text"
                    value={keywordsText}
                    onChange={(e) => handleKeywordsChange(e.target.value)}
                    placeholder="Vd: Galahad, thánh hiệp sĩ, thanh kiếm bão, Eldoria..."
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-sky-500/50 rounded-lg text-xs font-semibold text-slate-100 outline-none transition-colors"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-2 font-mono">
                    {(formData.keywords || []).map((badge, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/10 text-sky-400 rounded-lg text-[10px] font-bold border border-sky-500/20">
                        #{badge}
                        <button type="button" onClick={() => handleRemoveKeywordBadge(idx)} className="text-sky-400 hover:text-red-500 font-bold ml-1">✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setWizardStep(1)}
                  className="px-5 py-2.5 bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 hover:text-slate-100 font-bold uppercase rounded-xl transition-all"
                >
                  ← Trở lại Bước 1
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  disabled={!formData.keyword?.trim()}
                  className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 text-xs font-bold font-mono uppercase tracking-widest rounded-xl hover:translate-y-[-1px] transition-all whitespace-nowrap"
                >
                  Tiếp tục Bước 3 →
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 3: Lore content draft */}
          {wizardStep === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1 text-left">
                <h3 className="font-sans text-lg font-black text-sky-400 uppercase tracking-wide">Bước 3: Biên soạn bối cảnh chi tiết / Description</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Biên soạn kỹ lưỡng hoặc dùng AI Scribe sinh ý tưởng tức thời.</p>
              </div>

              {formData.category === "character" ? (
                <div className="space-y-4">
                  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-widest block">AI Character Auto Scribe</span>
                    <div className="space-y-2">
                      <textarea
                        value={characterData?.knowledge_train || ""}
                        onChange={(e) => handleCharacterSheetChange("knowledge_train", e.target.value)}
                        placeholder="Nhập ghi chép sơ dời nhân hình (Vd: Là Đại hiệp khách cô độc, tinh thông kiếm pháp, có thù oán giang hồ sâu sắc với môn phái)..."
                        rows={4}
                        className="w-full p-3 bg-slate-950 border border-slate-800 text-xs text-slate-100 outline-none rounded-xl focus:border-sky-550/60 font-sans"
                      />
                      <button
                        type="button"
                        onClick={handleAiGenKnowledge}
                        disabled={isGeneratingTarget || !(characterData?.knowledge_train || "").trim()}
                        className="w-full py-2 bg-sky-500/10 hover:bg-sky-500 hover:text-slate-950 text-sky-400 disabled:opacity-40 text-xs font-bold rounded-xl transition-all border border-sky-500/20 flex items-center justify-center gap-1.5"
                      >
                        <Sparkles size={13} /> {isGeneratingTarget ? "Đang cấu trúc hóa hồ sơ..." : "✓ Trích Xuất Hồ Sơ Nhân Vật Bằng AI Scribe"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-mono text-slate-400 uppercase font-bold tracking-wider block">Bio Sơ Lược Character (Character Prompt JSON Payload)</label>
                    <textarea
                      value={formData.text || ""}
                      onChange={(e) => onChange("text", e.target.value)}
                      placeholder="Hồ sơ kịch bản JSON..."
                      rows={8}
                      className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:border-sky-500/55 outline-none font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-900/50 p-4 border border-slate-800/80 rounded-xl space-y-3">
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-400 tracking-widest block flex items-center gap-1">
                      <Sparkles size={11} className="text-sky-400 animate-pulse" />
                      AI Scribe Assistant Draftsman
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={aiIdeaPrompt}
                        onChange={(e) => setAiIdeaPrompt(e.target.value)}
                        placeholder="Ý tưởng tóm lược (Vd: Là một hiệp hội thần bí cổ rêu rả thờ phụng phượng hoàng lửa)..."
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 text-xs text-slate-100 outline-none rounded-xl focus:border-sky-500/55"
                      />
                      <button
                        type="button"
                        onClick={handleAiDraftFromIdea}
                        disabled={isAiProcessing || !aiIdeaPrompt.trim() || !formData.keyword?.trim()}
                        className="px-4 py-2 bg-sky-500/10 hover:bg-sky-500 hover:text-slate-950 text-sky-400 disabled:opacity-40 font-black text-xs rounded-xl flex items-center gap-1 shrink-0 border border-sky-500/20 transition-all whitespace-nowrap"
                      >
                        Dệt Lore
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-mono text-slate-400 tracking-widest block uppercase font-bold">Văn bản ghi chép bối cảnh (Markdown format)</label>
                    <textarea
                      value={formData.text || ""}
                      onChange={(e) => onChange("text", e.target.value)}
                      placeholder="Nhập bối cảnh dã sử đầy văn vẻ hùng tráng..."
                      rows={9}
                      className="w-full p-4 bg-slate-950 border border-slate-800 text-xs text-slate-100 outline-none rounded-xl focus:border-sky-500/50 font-sans leading-relaxed"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-between border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setWizardStep(2)}
                  className="px-5 py-2.5 bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 hover:text-slate-100 font-bold uppercase rounded-xl transition-all"
                >
                  ← Trở lại Bước 2
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  disabled={!formData.text?.trim()}
                  className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 text-xs font-bold font-mono uppercase tracking-widest rounded-xl hover:translate-y-[-1px] transition-all whitespace-nowrap"
                >
                  Tiếp tục Bước 4 →
                </button>
              </div>
            </div>
          )}

          {/* Wizard Step 4: Settings & sensory */}
          {wizardStep === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1 text-left">
                <h3 className="font-sans text-lg font-black text-sky-400 uppercase tracking-wide">Bước 4: Cài đặt Cảm biến kích hoạt & Hệ số ưu tiên</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Cấu hình điều kiện lọc kích động bối cảnh và mức độ ưu tiên nạp trong hộp bối cảnh AI.</p>
              </div>

              {/* Visual Trigger Mode selects */}
              <div className="space-y-2 pt-1 text-left">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-widest block">1. Quy pháp kích hoạt cảm biến (Trigger Mode)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "always", emoji: "🔴 Always", title: "Always-ON", desc: "Nạp cứng cố định" },
                    { key: "keyword", emoji: "🟡 Keyword", title: "Từ khóa thoại", desc: "Trigger khi thoại khớp" },
                    { key: "semantic", emoji: "🟣 Semantic", title: "Ý niệm đối sánh", desc: "Matching định lượng" },
                    { key: "hybrid", emoji: "🟢 Hybrid", title: "Cơ hợp tối cao", desc: "Hợp nhất cả song phương" }
                  ].map((m) => {
                    const isSelected = (formData.triggerMode || "hybrid") === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => onChange("triggerMode", m.key)}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-[110px] ${
                          isSelected
                            ? "bg-sky-500/10 border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.15)] bg-gradient-to-tr from-sky-550/10 to-slate-900"
                            : "bg-slate-900/40 border-slate-800 hover:border-sky-500/30 hover:bg-slate-900/60"
                        }`}
                      >
                        <span className="text-xs">{m.emoji}</span>
                        <div className="pt-2">
                          <span className="text-[10px] font-bold text-slate-100 uppercase block tracking-wider">{m.title}</span>
                          <span className="text-[8px] text-slate-400 block mt-0.5 leading-tight">{m.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Insertion Position Grid selecting */}
              <div className="space-y-2 pt-2 text-left">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-widest block">2. Điểm chèn bối cảnh dã sử (Insertion Position)</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  {[
                    { key: "before_char", title: "Character Profile" },
                    { key: "after_char", title: "Sau Character Profile" },
                    { key: "before_history", title: "Găm đầu Biên niên" },
                    { key: "in_chat", title: "Găm ngược sâu Chat" }
                  ].map((pos) => {
                    const isSelected = (formData.position || "before_char") === pos.key;
                    return (
                      <button
                        key={pos.key}
                        type="button"
                        onClick={() => onChange("position", pos.key)}
                        className={`py-2 px-3 text-center rounded-lg text-[9.5px] font-bold transition-all border ${
                          isSelected
                            ? "bg-sky-500 text-slate-950 border-sky-500"
                            : "bg-slate-900/45 text-slate-400 border-slate-800 hover:text-slate-100"
                        }`}
                      >
                        {pos.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Star selections priority classes */}
              <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3 pt-2 text-left">
                <div className="flex justify-between items-baseline flex-wrap gap-2">
                  <span className="text-[9px] font-mono font-black uppercase text-slate-400 tracking-widest block">3. Hệ số ưu tiên chèn găm bối cảnh (Priority Tiers)</span>
                  <span className="text-[10px] font-mono text-sky-400 bg-slate-950 px-2 py-0.5 rounded font-black border border-slate-800">{priorityTier.text} (Hệ số: {formData.priority || 50})</span>
                </div>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 shadow-inner gap-1">
                  {(["D", "C", "B", "A", "S"] as const).map((tier) => {
                    const isActive = priorityTier.class === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setPriorityByTier(tier)}
                        className={`flex-1 py-1 text-[10px] font-mono font-black uppercase rounded transition-all ${
                          isActive ? 'bg-sky-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {tier}-Tier
                      </button>
                    );
                   })}
                </div>
                <div className="pt-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.priority || 50}
                    onChange={(e) => onChange("priority", parseInt(e.target.value))}
                    className="w-full bg-slate-950 h-1.5 rounded-full outline-none accent-sky-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-between border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  className="px-5 py-2.5 bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 hover:text-slate-100 font-bold uppercase rounded-xl transition-all"
                >
                  ← Trở lại Bước 3
                </button>
                <button
                  type="button"
                  onClick={() => setWizardStep(5)}
                  className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold font-mono uppercase tracking-widest rounded-xl hover:translate-y-[-1px] transition-all whitespace-nowrap"
                >
                  Tiếp tục Bước 5 →
                </button>
              </div>
            </div>
          )}

          {/* Step 5 Content: Review & Save */}
          {wizardStep === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1 text-left">
                <h3 className="font-sans text-lg font-black text-sky-400 uppercase tracking-wide">Bước 5: Khảo duyệt dã sử & Thần thi ấn ký</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Rà soát báo cáo chuẩn đoán dệt bối cảnh cổ thư cuối cùng trước khi chính thức lưu hành tri thư quan.</p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/80 p-5 rounded-xl text-xs space-y-4">
                <div className="grid grid-cols-2 gap-4 border-b border-slate-800/60 pb-4 text-left">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Từ khóa chính bối cảnh</span>
                    <strong className="text-sm font-sans font-black text-slate-100 uppercase">{formData.keyword || "VÔ DANH THƯ"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Xếp loại danh mục</span>
                    <strong className="text-sm font-sans font-black text-sky-400 uppercase">{formData.category?.toUpperCase() || "WORLD"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Phương pháp cảm ứng</span>
                    <strong className="text-xs font-mono text-slate-100 uppercase">{formData.triggerMode?.toUpperCase() || "HYBRID"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Xếp tầng ưu tiên dã sử</span>
                    <strong className="text-xs font-mono text-slate-100 uppercase">{priorityTier.class}-Tier ({(formData.priority || 50)}%)</strong>
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">✓ Kết quả phân tích chất lượng AI Scribe Audit</span>
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5 font-mono text-[10px]">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <span>✓</span>
                      <span>Dung tích văn bia: ~{Math.round((formData.text?.length || 0)/3.8)} Tokens (Hợp lệ)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sky-400 font-bold">
                      <span>✦</span>
                      <span>Cảm ứng kích hoạt, liên can liên thông ngữ cảnh sẵn sàng bồi đắp.</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <span>▲</span>
                      <span>Hãy chắc chắn đây là thông tin chuẩn xác để AI Studio thấu nhớ sâu đậm nhất.</span>
                    </div>
                  </div>
                </div>

                {formData.category !== "character" && (
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row justify-between sm:items-center bg-slate-950/40 p-3 rounded-lg border border-slate-800/80 gap-2">
                    <div className="text-left">
                      <strong className="text-slate-100 block text-[11px]">Trích xuất các thuộc tính RPG dã sữ</strong>
                      <span className="text-slate-400 text-[9px] block">Để AI quét tự động nội dung và điền thông số phân bổ.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAiAutoExtractStats}
                      disabled={isAiProcessing || !(formData.text || "").trim()}
                      className="py-1.5 px-3 bg-sky-500/10 hover:bg-sky-550 hover:text-slate-950 text-sky-400 text-[10px] font-mono font-bold rounded-lg transition-colors border border-sky-500/20 whitespace-nowrap self-end shrink-0"
                    >
                      Auto Extract Stats ✨
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-between border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={() => setWizardStep(4)}
                  className="px-5 py-2.5 bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 hover:text-slate-100 font-bold uppercase rounded-xl transition-all"
                >
                  ← Trở lại Bước 4
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={isSaving || isAiProcessing}
                  className="px-8 py-3 bg-sky-500 hover:bg-sky-450 text-slate-950 font-sans font-black uppercase text-xs tracking-widest rounded-xl hover:translate-y-[-1px] transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(14,165,233,0.25)]"
                >
                  Lập thư lưu hành thế giới ✓
                </button>
              </div>
            </div>
          )}
        </div>
      )}

        </div>
      </div>

      {/* RIGHT COLUMN: The Immersive Live Preview Panel (42% Width) */}
      <div className="hidden lg:flex w-[42%] bg-slate-950 flex-col h-full overflow-hidden shrink-0 font-mono relative">
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none opacity-5 bg-gradient-to-t from-sky-500/20 to-transparent" />
        
        {/* Preview Title bar */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 text-xs text-slate-400 shrink-0 font-bold tracking-widest uppercase relative z-10 select-none">
          <span className="flex items-center gap-1.5 font-bold">
            <Eye size={13} className="text-sky-450 animate-pulse" />
            Nhìn trước ngữ trạng (Context Inject Live)
          </span>
          <span className="text-[10px] bg-slate-950 px-2 py-0.5 border border-slate-800 rounded text-sky-400">
            Real-time
          </span>
        </div>

        {/* Live Payload Stream container */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 relative z-10">
          <div className="space-y-4 text-left max-w-xl mx-auto h-full flex flex-col justify-between">
            <div className="space-y-3 flex-1 flex flex-col h-full">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 block border-b border-slate-800 pb-1 font-bold">
                Cấu trúc tri thức AI Scribe sẽ tự động bơm găm vào hốc bối cảnh cốt truyện:
              </span>
              
              {/* Glowing ledger display */}
              <div className="flex-1 bg-slate-900/30 border border-slate-800 rounded-xl p-4 font-mono text-[10.5px] text-slate-350 leading-relaxed overflow-y-auto custom-scrollbar whitespace-pre-wrap select-text h-[400px] shadow-inner">
                {contextInjectionPreviewText}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[9px] text-slate-450 leading-relaxed italic select-none">
              * Đây là hiển thị chính văn đầy đủ mà Hệ thống Tháp SillyTavern sẽ tự động dịch chuyển và tháp ghép vào trí thông minh của AI Studio ở vị trí <strong className="text-sky-400 text-[10px] underline">{(formData.position || "before_char").toUpperCase()}</strong>.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
