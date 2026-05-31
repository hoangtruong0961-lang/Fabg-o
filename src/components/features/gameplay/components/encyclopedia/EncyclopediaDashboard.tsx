import React, { useMemo, useState, useEffect } from "react";
import {
  Database,
  Bookmark,
  Compass,
  Cpu,
  ArrowRight,
  Activity,
  Award,
  ChevronRight,
  Eye,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Settings,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Pin,
  AlertTriangle,
  Flame,
  CheckCircle,
  AlertCircle,
  BarChart4,
  RefreshCw,
  X,
  Radio,
  BookOpen,
  LayoutGrid,
  List
} from "lucide-react";
import { VectorData } from "../../../../../services/db/indexedDB";

interface EncyclopediaDashboardProps {
  entries: VectorData[];
  onSelect: (id: string) => void;
  onAddManualWithTemplate: (template: Partial<VectorData>) => void;
  CATEGORY_MAP: Record<
    string,
    { label: string; color: string; icon: any }
  >;
  onCategoryFilterChange: (cat: string | null) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string, enabled: boolean) => void;
}

const STARTER_TEMPLATES = [
  {
    title: "Hiệp sĩ Lưu đày Galahad",
    category: "character",
    keyword: "Galahad",
    keywords: ["Galahad", "Lưu đày", "Hiệp sĩ"],
    description: "Hồ sơ tráng sĩ kiếm sĩ vương quốc với bi kịch rạn nứt tâm hồn và lời nguyền tiềm tàng.",
    align: "Lawful Good (Chính trực)",
    role: "Người đỡ đầu & Đồng minh (Mentor & Ally)",
    text: `{
  "name": "Hiệp sĩ Galahad",
  "gender": "Nam",
  "age": "37 tuổi",
  "appearance": "Khoác bộ giáp thép rạn nứt bị phong hóa bởi mưa cát, khoác áo choàng rách bạc màu. Ánh mắt trầm uất và có một vết sẹo dài chạy dọc má trái.",
  "voiceAndTone": "Văn phong trầm ấm, nghiêm nghị, pha chút mệt mỏi của kẻ phong sương.",
  "personality": "Kiên trung, ít nói, tôn trọng danh dự nhưng thực tế và cảnh giác cao độ.",
  "coreValues": "Luôn bảo vệ kẻ yếu thế, không bao giờ bội ước lời thề kiếm sĩ.",
  "hardLimits": "Tuyệt đối không ra tay với trẻ em và phụ nữ không có khả năng tự vệ.",
  "definingEvents": "Bị trục xuất khỏi Thánh Điện Ánh Sáng sau khi phát hiện giáo hoàng thông đồng với Đại Quỷ.",
  "background": "Từng là Đệ nhất Kiếm khiên hành lễ, nay sống ẩn dật bằng nghề săn tiền quỷ ở Vùng Biên Viễn.",
  "currentMood": "Trầm mặc, cảnh giác nhưng sẵn lòng giúp đỡ những tâm hồn lạc lối hòng tìm lại sự cứu rỗi.",
  "relationshipTags": "Kính trọng người giữ luật lệ chân chính, căm ghét ngọn lửa cuồng tín Thánh Điện.",
  "strengths": "Cận chiến tuyệt đỉnh, khiên chắn có khả năng phản lại ma pháp cấp trung.",
  "weaknesses": "Cánh tay phải bị nguyền rủa bởi ma khí, thỉnh thoảng lên cơn đau co thắt thần kinh.",
  "narrativeRole": "Mentor & Ally",
  "contradictions": "Muốn từ bỏ thanh kiếm danh dự để làm nông phu, nhưng bản năng hộ vệ luôn thôi thúc ra tay cứu trợ.",
  "failureMode": "Khi lời nguyền ma khí bùng phát, anh sẽ tự xích mình lại hoặc lao vào rừng sâu gầm rú điên loạn hòng tránh làm thương tổn đồng đội.",
  "exampleMessages": "Kiếm là để bảo vệ, không phải để khoe khoang quyền lực.\\nMột lời thề đã lập, có chết cũng phải giữ lấy trọn vẹn.\\nCẩn thận đó người trẻ, bóng tối dưới tán thông già này không tầm thường đâu."
}`,
    rpg_attrs: {
      alignment: "Chính Trực Khắc Khổ (Lawful Good)",
      role: "Đồng minh cốt cán / Mentor chính",
      danger_level: "B (Khống chế bởi ma khí nguyền rủa)",
      points_of_interest: "Vùng biên thùy sương gió / Quạt quán lữ hành hoang phế"
    }
  },
  {
    title: "Thung lũng Sương Hải",
    category: "location",
    keyword: "Thung lũng Sương Hải",
    keywords: ["Sương Hải", "Thung lũng", "Eldoria"],
    description: "Nhật ký vùng đất sương mù huyền ảo bí ẩn, chứa đầy mana kết tinh lạnh giá lý tưởng cho pháp thuật hệ băng.",
    text: "Thung lũng sương mù vĩnh cửu nằm ở cực bắc đại lục Eldoria. Vào ban đêm, các luồng sương sương lam lấp lánh (mana hóa hơi) dâng cao như sóng biển, nhấn chìm toàn bộ rừng thông cổ thụ trong ánh sáng dị kỳ. Nơi đây là thánh địa phong ấn Thần Thú Băng Hà và chứa đầy các quặng ma thạch lạnh giá.",
    rpg_attrs: {
      climate: "Lạnh giá quanh năm, sương mù ma pháp dày đặc đêm xuống.",
      ruler: "Nữ vương bộ tộc Tuyết Nhung - Kaelen Sương Tuyết.",
      population: "Khoảng 1,500 tinh linh tuyết và dị tộc cư ngụ rìa hang đá.",
      danger_level: "A (Nguy hiểm cao do quái thú băng giá)",
      points_of_interest: "Đền thờ Thần Băng Cổ, Hang quặng Tinh Pha Lê."
    }
  },
  {
    title: "Mặt nạ Hắc vực",
    category: "item",
    keyword: "Mặt nạ Hắc vực",
    keywords: ["Hắc vực", "Mặt nạ", "Cổ vật"],
    description: "Món ma khí cường đại nhưng chứa đựng cái giá rùng rợn trói buộc lấy linh thức vật chủ đeo nó.",
    text: "Mặt nạ cổ xưa rèn từ mảnh sọ thần thú bóng tối bị phong ấn. Người đeo lên có thể nhìn thấu trong đêm, miễn nhiễm với ảo ảnh và có khả năng hòa tan bản thân vào bóng tối vật lý để ẩn thân. Tuy nhiên, đeo quá lâu sẽ nghe thấy những lời thì thầm gào thét tinh thần thúc giục hủy hoại đồng minh.",
    rpg_attrs: {
      rarity: "Epic (Sử thi cổ đại)",
      item_type: "Cổ vật hỗ trợ ẩn thân & Ma pháp tinh thần",
      abilities: "Hòa mình làm một với bóng tối, Nhãn quan Chân lý vạn vật.",
      value_copper: "8,500 đồng tinh kim cổ."
    }
  },
  {
    title: "Hội Đao Phủ Bạc",
    category: "faction",
    keyword: "Hội Đao Phủ Bạc",
    keywords: ["Đao Phủ Bạc", "Sát thủ", "Ám sát"],
    description: "Phe cánh sát thủ mật nghị tôn thờ pháp định, hoạt động ngầm phục vụ Vương triều Thái Dương.",
    text: "Tổ chức sát thủ bảo hoàng bí mật phục tùng Hoàng triều Mặt trời lặn. Họ mặc quan phục xám tro, đeo mặt nạ bạc hình quạ và sử dụng song đao rèn từ bụi bạc thánh tẩy ma quỷ. Sứ mệnh của hội là ám sát bất kỳ ai sử dụng cấm thuật hắc ám hoặc đe dọa hoàng tộc.",
    rpg_attrs: {
      alignment: "Lawful Neutral (Pháp định trung lập)",
      leader: "Tổng đốc Ám ảnh - Raymond Đao Phủ Bạc.",
      influence: "Cực cao (Chi phối bóng tối chính trị đế quốc)",
      hq: "Nhà ngục ngầm Dưới Đáy Mồ, Hoàng thành Solar.",
      allies_enemies: "Đồng minh: Hoàng tộc Solar | Kẻ thù: Giáo phái Hắc Vực."
    }
  },
  {
    title: "Đại hồng thủy Pha lê",
    category: "event",
    keyword: "Đại hồng thủy Pha lê",
    keywords: ["Đại hồng thủy", "Tai họa", "Kỷ thứ ba"],
    description: "Biến cố thảm họa diệt vong một nền văn minh rực rỡ bởi lòng tham và sự mất kiểm soát nguồn lõi ma năng thần bí.",
    text: "Biến cố thảm khốc xảy ra vào năm 342 của Kỷ thứ ba. Lõi tinh năng của vương quốc cổ đại Aethelgard quá tải và phát nổ, giải phóng lượng ma năng tinh pha lê lỏng khổng lồ chảy tràn như dung nham nguội, hóa đá và đóng băng vĩnh viễn 80% cư dân cùng đất đai trong bán kính 100 dặm thành những khối pha lê bất tử.",
    rpg_attrs: {
      timeline_date: "Năm 342, Kỷ thứ ba (Thời đại Sụp đổ).",
      characters_involved: "Pháp vương Magnus Đệ lục, Đại phù thủy Cheryl.",
      consequences: "Biến Aethelgard trù phú thành Sa mạc Pha Lê chết chóc hoang phế."
    }
  },
];

export const EncyclopediaDashboard: React.FC<EncyclopediaDashboardProps> = ({
  entries,
  onSelect,
  onAddManualWithTemplate,
  CATEGORY_MAP,
  onCategoryFilterChange,
  onDelete,
  onToggleStatus,
}) => {
  const [activeTemplateTab, setActiveTemplateTab] = useState<string>("character");
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);
  const [activeFilterIndicator, setActiveFilterIndicator] = useState<string | null>(null);
  
  // New States for Remake
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchTips, setShowSearchTips] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIHuyenCo, setShowAIHuyenCo] = useState(false);
  const [layoutStyle, setLayoutStyle] = useState<'cards' | 'dense'>('cards');

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      
      // Focus search bar if '/' is pressed when not writing in fields
      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.getElementById("smart-search-bar");
        searchInput?.focus();
      }

      // Start new entry wizard when 'N' is pressed
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        onAddManualWithTemplate?.({
          category: "world",
          keyword: "",
          keywords: [],
          text: ""
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAddManualWithTemplate]);

  // 1. Core Smart Search Parser
  const parsedSearchFilter = (item: VectorData): boolean => {
    if (!searchTerm.trim()) return true;
    
    const tokens = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
    
    return tokens.every(token => {
      // Category prefix: e.g. @character
      if (token.startsWith('@')) {
        const cat = token.slice(1);
        return (item.category || '').toLowerCase() === cat;
      }
      
      // Tag/Keyword: e.g. #cursed
      if (token.startsWith('#')) {
        const tag = token.slice(1);
        const keywords = item.keywords || [];
        return keywords.some(k => k.toLowerCase().includes(tag));
      }
      
      // Priority parameters: e.g. p>50, p<70, p:60
      if (token.startsWith('p>') || token.startsWith('p<') || token.startsWith('p:')) {
        const op = token.charAt(1);
        const val = parseInt(token.slice(2));
        const entryPriority = item.priority || 50;
        if (isNaN(val)) return true;
        if (op === '>') return entryPriority > val;
        if (op === '<') return entryPriority < val;
        if (op === ':') return entryPriority === val;
      }
      
      // Trigger mode: e.g. trigger:always
      if (token.startsWith('trigger:')) {
        const mode = token.slice(8);
        return (item.triggerMode || '').toLowerCase() === mode;
      }

      // Status: e.g. status:enabled / status:disabled
      if (token.startsWith('status:')) {
        const stat = token.slice(7);
        const isEnabled = item.isEnabled !== false;
        if (stat === 'enabled' || stat === 'on') return isEnabled;
        if (stat === 'disabled' || stat === 'off') return !isEnabled;
      }
      
      // Relations indicator: e.g. linked:true
      if (token.startsWith('linked:')) {
        const val = token.slice(7);
        const hasLinks = (item.relatedEntries || []).length > 0;
        if (val === 'true') return hasLinks;
        if (val === 'false') return !hasLinks;
      }
      
      // Default fuzzy search
      return (item.keyword || '').toLowerCase().includes(token) ||
             (item.text || '').toLowerCase().includes(token);
    });
  };

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (activeFilterIndicator) {
      result = result.filter(e => e.category === activeFilterIndicator);
    }
    return result.filter(parsedSearchFilter);
  }, [entries, activeFilterIndicator, searchTerm]);

  // Convert priority to human-readable Tier
  const getPriorityTier = (pr: number = 50) => {
    if (pr >= 90) return { label: "S Class", color: "text-red-500 border-red-500/30 bg-red-500/10" };
    if (pr >= 75) return { label: "A Class", color: "text-amber-500 border-amber-500/30 bg-amber-500/10" };
    if (pr >= 50) return { label: "B Class", color: "text-violet-500 border-violet-500/30 bg-violet-500/10" };
    if (pr >= 30) return { label: "C Class", color: "text-sky-500 border-sky-500/30 bg-sky-500/10" };
    return { label: "D Class", color: "text-stone-400 border-stone-400/20 bg-stone-500/5" };
  };

  // Render priority ASCII/visual bar
  const renderPriorityBar = (pr: number = 50) => {
    const blocks = Math.min(10, Math.ceil(pr / 10));
    const empty = 10 - blocks;
    return (
      <div className="flex items-center gap-1 text-[10px] font-mono tracking-tighter text-[#eae3d2]/60 select-none">
        <span>██████████</span>
        <div className="flex gap-[1px] bg-stone-900 border border-stone-800 p-[2px] rounded h-3.5 items-center w-24">
          <div className="bg-[#c9a84c] h-full rounded-sm" style={{ width: `${pr}%` }} />
        </div>
        <span className="font-bold text-[#c9a84c]">P:{pr}</span>
      </div>
    );
  };

  // 2. Health Check Diagnostic Engine
  const healthChecks = useMemo(() => {
    const issues: Array<{ id: string; type: "error" | "warning" | "info"; msg: string; target: string }> = [];
    const keywordMap: Record<string, string[]> = {};

    entries.forEach(item => {
      const isEnabled = item.isEnabled !== false;
      
      // A. Empty Trigger keywords
      if (item.triggerMode !== 'always' && (!item.keywords || item.keywords.length === 0) && (!item.keyword)) {
        issues.push({
          id: `no-kw-${item.id}`,
          type: "error",
          msg: `Bài viết bối cảnh này không có từ khóa kích hoạt nào, AI sẽ không bao giờ cảm ứng được`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      // B. Oversized entries (token waste danger)
      const byteLen = (item.text || '').length;
      if (byteLen > 4000) {
        issues.push({
          id: `too-long-${item.id}`,
          type: "warning",
          msg: `Nội dung quá dài (~${Math.round(byteLen/3.8)} Tokens). Nguy cơ gây tràn bộ nhớ đệm bối cảnh`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      // C. High Priority but disabled
      if (!isEnabled && (item.priority || 50) >= 80) {
        issues.push({
          id: `hi-disabled-${item.id}`,
          type: "info",
          msg: `Bối cảnh bậc cao (PR:${item.priority}) đang tạm tắt, hãy bật lại nếu AI quên dữ kiện quan trọng`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      // D. Isolated items
      if (isEnabled && (!item.relatedEntries || item.relatedEntries.length === 0)) {
        issues.push({
          id: `isolated-${item.id}`,
          type: "info",
          msg: `Bài viết cô độc (chưa liên kết với bất kỳ mốc thế giới quan nào khác)`,
          target: item.keyword || item.title || "Untitled"
        });
      }

      // E. Check duplicates
      const kws = [...(item.keywords || [])];
      if (item.keyword) kws.push(item.keyword);
      kws.forEach(kw => {
        const normalized = kw.trim().toLowerCase();
        if (normalized) {
          if (!keywordMap[normalized]) keywordMap[normalized] = [];
          keywordMap[normalized].push(item.keyword || item.title || "Untitled");
        }
      });
    });

    Object.entries(keywordMap).forEach(([kw, items]) => {
      if (items.length > 1) {
        issues.push({
          id: `dup-kw-${kw}`,
          type: "warning",
          msg: `Từ khóa "${kw}" bị trùng lặp kích hoạt chéo giữa các bài viết: [${items.join(', ')}]`,
          target: `Khớp chéo #${kw}`
        });
      }
    });

    return issues.slice(0, 10); // Limit to top 10 actionable diagnostic indicators
  }, [entries]);

  // 3. Token Budget Visualizer Calculations
  const tokenStatistics = useMemo(() => {
    // 3.8 char per token average for custom Vietnamese context
    const getTokens = (text: string) => Math.ceil((text || '').length / 3.8);

    const alwaysEntriesBytes = entries
      .filter(e => e.isEnabled !== false && (e.triggerMode === 'always' || e.isSticky))
      .reduce((acc, e) => acc + (e.text || '').length, 0);

    const potentialPoolBytes = entries
      .filter(e => e.isEnabled !== false && e.triggerMode !== 'always' && !e.isSticky)
      .reduce((acc, e) => acc + (e.text || '').length, 0);

    const alwaysTokens = getTokens(alwaysEntriesBytes);
    const potentialTokens = getTokens(potentialPoolBytes);
    const budgetLimit = 8000; // Standard reference limit
    const percentage = Math.min(100, Math.round((alwaysTokens / budgetLimit) * 100));

    return {
      activeTokens: alwaysTokens,
      potentialTokens,
      percentage,
      limit: budgetLimit,
      isDanger: alwaysTokens > budgetLimit * 0.85
    };
  }, [entries]);

  // 4. Stable Node Coordinates inside Clustered Circular Graph View
  const cosmosNodes = useMemo(() => {
    if (entries.length === 0) return [];

    const visibleEntries = entries.slice(0, 18); // limit top nodes
    const n = visibleEntries.length;
    const centerX = 200;
    const centerY = 180;

    return visibleEntries.map((entry, index) => {
      // Grouping clusters based on category
      const hashCategory = (entry.category || 'world').charCodeAt(0) % 5;
      const angle = (index * 2 * Math.PI) / n;
      const radius = 100 + (hashCategory * 15) + (index % 2 === 0 ? 15 : -15);

      const cx = centerX + Math.cos(angle) * radius;
      const cy = centerY + Math.sin(angle) * radius;

      return {
        id: entry.id,
        keyword: entry.keyword || "Untitled",
        category: entry.category || "world",
        cx,
        cy,
        entry,
        priority: entry.priority || 50,
      };
    });
  }, [entries]);

  // Compute connections beautifully
  const cosmosLinks = useMemo(() => {
    const links: { x1: number; y1: number; x2: number; y2: number; id: string; strong: boolean }[] = [];
    if (cosmosNodes.length < 2) return [];

    for (let i = 0; i < cosmosNodes.length; i++) {
      const nodeA = cosmosNodes[i];
      const textA = (nodeA.entry.text || "").toLowerCase();

      for (let j = i + 1; j < cosmosNodes.length; j++) {
        const nodeB = cosmosNodes[j];
        const keywordB = (nodeB.entry.keyword || "").toLowerCase();
        const textB = (nodeB.entry.text || "").toLowerCase();
        const keywordA = (nodeA.entry.keyword || "").toLowerCase();

        const isRelated =
          (keywordB && textA.includes(keywordB)) ||
          (keywordA && textB.includes(keywordA)) ||
          nodeA.entry.relatedEntries?.includes(nodeB.id) ||
          nodeB.entry.relatedEntries?.includes(nodeA.id);

        if (isRelated) {
          const directMatch = (keywordB && textA.includes(keywordB)) || (keywordA && textB.includes(keywordA));
          links.push({
            x1: nodeA.cx,
            y1: nodeA.cy,
            x2: nodeB.cx,
            y2: nodeB.cy,
            id: `${nodeA.id}-${nodeB.id}`,
            strong: directMatch || (nodeA.category === nodeB.category),
          });
        }
      }
    }
    return links.slice(0, 40); // cap connections beautifully
  }, [cosmosNodes]);

  // Stars coordinates for realistic star field background inside the map
  const starsField = useMemo(() => {
    const arr = [];
    let seed = 42;
    const pseudoRandom = () => {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 30; i++) {
      arr.push({
        cx: Math.floor(pseudoRandom() * 400),
        cy: Math.floor(pseudoRandom() * 360),
        r: pseudoRandom() * 1.5 + 0.3,
        opacity: pseudoRandom() * 0.7 + 0.3
      });
    }
    return arr;
  }, []);

  const handleCategoryFilterClick = (catKey: string) => {
    if (activeFilterIndicator === catKey) {
      onCategoryFilterChange(null);
      setActiveFilterIndicator(null);
    } else {
      onCategoryFilterChange(catKey);
      setActiveFilterIndicator(catKey);
    }
  };

  const selectedTemplate = useMemo(() => {
    return STARTER_TEMPLATES.find((t) => t.category === activeTemplateTab) || STARTER_TEMPLATES[0];
  }, [activeTemplateTab]);

  return (
    <div id="encyclopedia-manager-root" className="flex-1 flex flex-col h-full bg-[#020617] text-slate-100 overflow-y-auto custom-scrollbar relative font-sans selection:bg-sky-500/20 selection:text-sky-200">
      {/* Subtle dynamic background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-950/15 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-indigo-950/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-repeat bg-center opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/stardust.png')" }} />
      
      <div className="max-w-6xl mx-auto w-full p-4 lg:p-6 space-y-6 pb-20 relative z-10">
        
        {/* Ancient Tome Styled Header Title Block */}
        <div className="text-center py-6 border-b border-sky-950/40 bg-gradient-to-b from-sky-950/5 to-transparent rounded-2xl p-4">
          <h1 className="font-sans text-3xl lg:text-4xl font-extrabold tracking-wide uppercase flex items-center justify-center gap-3 select-none bg-clip-text text-transparent bg-gradient-to-r from-sky-400 via-indigo-300 to-sky-300 drop-shadow-[0_0_15px_rgba(56,189,248,0.2)]">
            <BookOpen size={30} className="text-sky-400" />
            Thư Khố Vũ Trụ
          </h1>
          <p className="font-mono text-xs text-indigo-400/80 mt-2 tracking-[0.2em] uppercase font-bold">
            Mạng Lưới Thần Thức Cốt Truyện • Lore Constellations Dashboard
          </p>
        </div>

        {/* Quick Panel Controllers / Layout customization toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d1527]/70 border border-slate-800/80 p-3 rounded-2xl select-none shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-sky-400 animate-pulse" />
            <span className="font-sans text-xs font-extrabold text-slate-300 uppercase tracking-widest">
              KIẾN TRÚC THƯ VIỆN:
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setShowGraph(!showGraph)}
              className={`px-3 py-1 text-xs font-bold font-mono uppercase rounded-xl border transition-all flex items-center gap-1.5 ${
                showGraph
                  ? "bg-sky-500/15 text-sky-300 border-sky-400/50 shadow-[0_0_10px_rgba(58,191,248,0.15)] bg-slate-900/60"
                  : "text-slate-400 border-slate-800/80 hover:bg-slate-900/40 hover:text-slate-200"
              }`}
            >
              <Compass size={12} className={showGraph ? "animate-spin-slow text-sky-400" : ""} />
              Constellation {showGraph ? "• ON" : "• OFF"}
            </button>

            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-3 py-1 text-xs font-bold font-mono uppercase rounded-xl border transition-all flex items-center gap-1.5 ${
                showTemplates
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/35 shadow-[0_0_10px_rgba(139,92,246,0.15)] bg-slate-900/60"
                  : "text-slate-400 border-slate-800/80 hover:bg-slate-900/40 hover:text-slate-200"
              }`}
            >
              <Award size={12} className={showTemplates ? "text-indigo-400" : ""} />
              Tài Liệu Mẫu {showTemplates ? "• ON" : "• OFF"}
            </button>

            <button
              onClick={() => setShowAIHuyenCo(!showAIHuyenCo)}
              className={`px-3 py-1 text-xs font-bold font-mono uppercase rounded-xl border transition-all flex items-center gap-1.5 ${
                showAIHuyenCo
                  ? "bg-purple-500/15 text-purple-300 border-purple-500/35 shadow-[0_0_10px_rgba(168,85,247,0.15)] bg-slate-900/60"
                  : "text-slate-400 border-slate-800/80 hover:bg-slate-900/40 hover:text-slate-200"
              }`}
            >
              <Activity size={12} className={showAIHuyenCo ? "text-purple-400 animate-pulse" : ""} />
              Huyền Cơ {showAIHuyenCo ? "• ON" : "• OFF"}
            </button>

            <div className="w-px h-5 bg-slate-800 mx-1 self-center" />

            <button
              onClick={() => setLayoutStyle(layoutStyle === 'cards' ? 'dense' : 'cards')}
              className="px-3 py-1 text-xs font-bold font-mono uppercase rounded-xl border bg-slate-950 text-sky-400 border-slate-800 hover:border-sky-500/40 hover:text-sky-300 transition-all flex items-center gap-1.5"
            >
              {layoutStyle === 'cards' ? <LayoutGrid size={11} className="text-sky-400" /> : <List size={11} className="text-sky-400" />}
              :{layoutStyle === 'cards' ? "Lưới Dịch Giả" : "Mật Danh Thu"}
            </button>
          </div>
        </div>

        {/* Diagnostic Monitors Panel (Unified health-and-budget layout) - Conditional */}
        {showAIHuyenCo && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch animate-fadeIn">
            
            {/* Health Diagnostics Panel (7 Cols) */}
            <div className="md:col-span-7 bg-[#090f23]/70 rounded-2xl border border-sky-950/50 p-5 flex flex-col justify-between shadow-2xl relative backdrop-blur-md">
              <div className="absolute top-0 right-0 p-3 opacity-15">
                <Activity size={40} className="text-sky-400" />
              </div>
              
              <div className="space-y-3">
                <h3 className="font-sans text-sm font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={16} className="text-sky-400" />
                  Chuẩn Đoán Đột Phá Bộ Nhớ (Health-Check)
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Hệ thống tự động phát hiện mâu thuẫn từ khóa, kích thước tệp, và cấu hình cảm ứng để AI đạt hiệu năng mượt nhất.
                </p>

                {/* Diagnostic Log lines */}
                <div className="border border-sky-950/40 bg-slate-950/80 rounded-xl p-3.5 max-h-[190px] overflow-y-auto custom-scrollbar space-y-2.5 text-[11px] font-mono">
                  {healthChecks.length === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-400 font-bold py-4 justify-center">
                      <CheckCircle size={16} />
                      <span>✓ Thư khố hoàn toàn khỏe mạnh, không có mâu thuẫn tri thức!</span>
                    </div>
                  ) : (
                    healthChecks.map((issue) => (
                      <div key={issue.id} className="flex items-start gap-2 border-b border-slate-900/30 pb-2 last:border-0 last:pb-0">
                        {issue.type === "error" ? (
                          <span className="text-red-500 shrink-0 mt-0.5">⬤</span>
                        ) : issue.type === "warning" ? (
                          <span className="text-amber-500 shrink-0 mt-0.5">▲</span>
                        ) : (
                          <span className="text-sky-400 shrink-0 mt-0.5">◆</span>
                        )}
                        <div>
                          <span className="text-sky-400 font-black underline mr-1.5 font-sans">
                            [{issue.target}]:
                          </span>
                          <span className="text-slate-200">{issue.msg}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/50 text-[10px] text-slate-400 flex items-center gap-2 mt-4">
                <span className="inline-block w-2.5 h-2.5 rounded bg-red-500"></span> Lỗi Kích Hoạt
                <span className="inline-block w-2.5 h-2.5 rounded bg-amber-500 ml-2"></span> Cảnh Báo Phì Đại
                <span className="inline-block w-2.5 h-2.5 rounded bg-sky-400 ml-2"></span> Khuyên dùng
              </div>
            </div>

            {/* Token Budget Gauge Section (5 Cols) */}
            <div className="md:col-span-5 bg-[#090f23]/70 rounded-2xl border border-sky-950/50 p-5 flex flex-col justify-between shadow-2xl relative backdrop-blur-md">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-sky-950/30 pb-2">
                  <h3 className="font-sans text-sm font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
                    <BarChart4 size={16} className="text-sky-400" />
                    Hao Phí Ngân Sách Token (Găm Sẵn)
                  </h3>
                  <span className="font-mono text-xs text-sky-400 font-bold">
                    {tokenStatistics.activeTokens.toLocaleString()} / {tokenStatistics.limit.toLocaleString()} TK
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                    <span>Mức nạp tri thức gốc (Always & Pin)</span>
                    <span>{tokenStatistics.percentage}%</span>
                  </div>
                  {/* Modern Interstellar Progress Bar */}
                  <div className="w-full h-3 bg-slate-950 border border-slate-800/85 rounded-full overflow-hidden shadow-inner p-[2px]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        tokenStatistics.isDanger 
                          ? 'bg-gradient-to-r from-red-600 to-amber-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]' 
                          : 'bg-gradient-to-r from-sky-600 to-indigo-500 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                      }`}
                      style={{ width: `${tokenStatistics.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-[10px] font-mono pt-1 text-slate-300">
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800/70">
                    <span className="block text-slate-500 text-[8px] uppercase tracking-wider">Luôn Găm Sẵn</span>
                    <span className="text-xs font-bold text-slate-200">{tokenStatistics.activeTokens.toLocaleString()} Tokens</span>
                  </div>
                  <div className="bg-slate-950/70 p-2 rounded border border-slate-800/70" title="Kích hoạt linh động, không chiếm cố định">
                    <span className="block text-slate-500 text-[8px] uppercase tracking-wider">Cảm Biến Động</span>
                    <span className="text-xs font-bold text-sky-400">{tokenStatistics.potentialTokens.toLocaleString()} Tokens</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 leading-normal pt-2.5 border-t border-slate-800/50 italic mt-4">
                * Mẹo: Chỉ gỡ lỗi hoặc ghim (PIN) khi thật sự cần lưu trữ vĩnh viễn bối cảnh gốc của căn nguyên.
              </div>
            </div>

          </div>
        )}
        <div className="bg-[#090f23]/80 border border-sky-950/60 rounded-2xl p-4.5 shadow-xl">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search size={18} className="text-sky-400" />
            </div>
            <input
              id="smart-search-bar"
              type="text"
              placeholder="Gõ mã tìm kiếm bối cảnh dã sử... Cú pháp hỗ trợ: @character #mentor p>60 (Nhấn '/' để gõ nhanh)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800/80 outline-none text-slate-100 focus:border-sky-500/60 focus:shadow-[0_0_15px_rgba(58,191,248,0.12)] rounded-xl pl-12 pr-12 py-3.5 text-sm font-sans placeholder-slate-550 transition-all shadow-inner font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-4 flex items-center justify-center text-slate-500 hover:text-sky-400 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Smart Search tips collapsible bar */}
          <div className="mt-2.5 px-1.5 flex justify-between items-center text-xs font-mono">
            <button
              onClick={() => setShowSearchTips(!showSearchTips)}
              className="text-sky-400 hover:underline flex items-center gap-1 font-bold"
            >
              <HelpCircle size={12} /> {showSearchTips ? "✕ Thu nhỏ hướng dẫn tìm kiếm" : "❖ Hướng dẫn tìm kiếm thông minh"}
            </button>
            <span className="text-slate-400 text-xs">Đang hiển thị {filteredEntries.length} trong số {entries.length} cổ mẫu</span>
          </div>

          {showSearchTips && (
            <div className="mt-3.5 bg-slate-950/90 border border-sky-950/65 rounded-xl p-4 text-xs font-mono space-y-2 text-slate-300 animate-slideDown">
              <p className="font-bold text-sky-400 border-b border-sky-950/40 pb-1 flex items-center gap-1.5">
                <Sparkles size={12} /> Cú pháp phân phối bối cảnh thông dụng:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-sky-400 font-black mr-2">@loại</span> 
                  <span>Lọc loại mục: <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">@character</code>, <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">@location</code>, <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">@faction</code></span>
                </div>
                <div>
                  <span className="text-sky-400 font-black mr-2">#từ khóa</span>
                  <span>Tìm từ khóa liên kết: <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">#Galahad</code>, <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">#Sương</code></span>
                </div>
                <div>
                  <span className="text-sky-400 font-black mr-2">p&gt;hệ / p&lt;hệ</span>
                  <span>Lọc độ ưu tiên: <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">p&gt;70</code> (Đầu mục quan trọng), <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">p&lt;30</code></span>
                </div>
                <div>
                  <span className="text-sky-400 font-black mr-2">trigger:mode</span>
                  <span>Luật logic cảm: <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">trigger:always</code>, <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">trigger:hybrid</code></span>
                </div>
                <div>
                  <span className="text-sky-400 font-black mr-2">status:state</span>
                  <span>Tài nguyên bật tắt: <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">status:enabled</code>, <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">status:disabled</code></span>
                </div>
                <div>
                  <span className="text-sky-400 font-black mr-2">linked:bool</span>
                  <span>Kiểm tra quan hệ kết nối: <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">linked:true</code>, <code className="bg-slate-900 text-sky-400 px-1 py-0.5 rounded">linked:false</code></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Split Section: Graph view and templates */}
        {(showGraph || showTemplates) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch animate-fadeIn">
            
            {/* Interactive SVG Network Graph View */}
            {showGraph && (
              <div className={`${showTemplates ? "lg:col-span-7" : "lg:col-span-12"} bg-[#030712]/95 border border-sky-950/60 rounded-2xl p-5 flex flex-col min-h-[410px] shadow-2xl relative overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-sky-950/30 pb-3 mb-4 shrink-0 z-10">
                  <div className="flex items-center gap-2">
                    <Compass size={15} className="text-sky-400 animate-spin-slow" />
                    <h3 className="font-sans text-xs font-bold text-sky-305 uppercase tracking-widest">
                      Bản Đồ Thiên Hà Sáng Tạo (Constellation Network Graph)
                    </h3>
                  </div>
                  
                  <button 
                    onClick={() => setShowGraph(!showGraph)}
                    className="text-[10px] font-mono bg-slate-950 border border-slate-800/85 px-2 py-0.5 rounded text-sky-400 hover:bg-sky-500/10"
                  >
                    An Sinh mạng ✕
                  </button>
                </div>

                {entries.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                    <svg className="w-24 h-24 opacity-25 animate-[spin_180s_linear_infinite] mb-3 text-sky-400" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 3" />
                      <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" />
                      <circle cx="30" cy="30" r="1" fill="currentColor" />
                      <circle cx="70" cy="65" r="1.5" fill="currentColor" />
                    </svg>
                    <h4 className="text-sky-400 font-sans font-bold text-xs uppercase tracking-widest mb-1">Thiên hà tinh vân trống rạng</h4>
                    <p className="text-[11px] text-slate-400 max-w-[280px] leading-relaxed">
                      Bơm thử khố mẫu bối cảnh bên phải hoặc khởi tạo các mốc thế giới để thắp sáng thiên mạng cốt truyện dã sử!
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 relative w-full h-[330px] select-none flex items-center justify-center">
                    <svg className="w-full h-full min-h-[330px] max-h-[350px]" viewBox="0 0 400 360">
                      <defs>
                        <filter id="galaxyGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                        <radialGradient id="ambGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.08" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                        </radialGradient>
                      </defs>

                      <rect width="400" height="360" fill="url(#ambGlow)" rx="20" />

                      {starsField.map((s, i) => (
                        <circle
                          key={`star_${i}`}
                          cx={s.cx}
                          cy={s.cy}
                          r={s.r}
                          fill="#38bdf8"
                          opacity={s.opacity * 0.5}
                        />
                      ))}

                      {/* Ring orbits reference */}
                      <circle cx="200" cy="180" r="115" fill="none" stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 6" />
                      <circle cx="200" cy="180" r="150" fill="none" stroke="#38bdf8" strokeOpacity="0.04" strokeWidth="0.5" />
                      <circle cx="200" cy="180" r="70" fill="none" stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="0.5" strokeDasharray="1 3" />

                      {/* Draw connection ties links line */}
                      <g>
                        {cosmosLinks.map((link) => (
                          <line
                            key={link.id}
                            x1={link.x1}
                            y1={link.y1}
                            x2={link.x2}
                            y2={link.y2}
                            stroke={link.strong ? "#38bdf8" : "#818cf8"}
                            strokeOpacity={link.strong ? "0.25" : "0.1"}
                            strokeWidth={link.strong ? "1.5" : "0.8"}
                            strokeDasharray={link.strong ? "0" : "2 2"}
                          />
                        ))}
                      </g>

                      {/* Draw nodes */}
                      <g>
                        {cosmosNodes.map((node) => {
                          const isNodeHovered = hoveredNode && hoveredNode.id === node.id;
                          
                          // Theme-aligned Node Colors
                          const colorHex = node.category === "character" ? "#38bdf8" :
                                           node.category === "location" ? "#34d399" :
                                           node.category === "faction" ? "#a78bfa" :
                                           node.category === "item" ? "#fbbf24" :
                                           node.category === "event" ? "#f87171" :
                                           node.category === "relationship" ? "#f472b6" :
                                           node.category === "law" ? "#818cf8" : "#38bdf8";

                          // Priority sizes
                          const sizeMultiplier = node.priority >= 90 ? 8 :
                                                 node.priority >= 75 ? 6.5 :
                                                 node.priority >= 50 ? 5.5 : 4.5;

                          return (
                            <g
                              key={node.id}
                              className="cursor-pointer"
                              onClick={() => onSelect(node.id)}
                              onMouseEnter={() => setHoveredNode(node)}
                              onMouseLeave={() => setHoveredNode(null)}
                            >
                              <circle
                                cx={node.cx}
                                cy={node.cy}
                                r={isNodeHovered ? sizeMultiplier + 7 : sizeMultiplier + 4}
                                fill="none"
                                stroke={colorHex}
                                strokeWidth="1.5"
                                strokeOpacity={isNodeHovered ? "0.6" : "0.2"}
                                className="transition-all duration-300"
                              />
                              <circle
                                cx={node.cx}
                                cy={node.cy}
                                r={sizeMultiplier}
                                fill={colorHex}
                                className="transition-all duration-200"
                              />
                              <circle
                                cx={node.cx}
                                cy={node.cy}
                                r="1.5"
                                fill="#ffffff"
                              />
                              <text
                                x={node.cx}
                                y={node.cy + sizeMultiplier + 9}
                                textAnchor="middle"
                                fill={isNodeHovered ? "#38bdf8" : "#94a3b8"}
                                className="text-[9px] font-mono pointer-events-none select-none transition-colors"
                              >
                                {node.keyword.length > 9 ? `${node.keyword.slice(0, 8)}…` : node.keyword}
                              </text>
                            </g>
                          );
                        })}
                      </g>

                      {/* Origin Star Beacon Center */}
                      <circle cx="200" cy="180" r="16" fill="#38bdf8" fillOpacity="0.04" className="animate-pulse" />
                      <circle cx="200" cy="180" r="3" fill="#38bdf8" filter="url(#galaxyGlow)" />
                    </svg>

                    {/* Micro tooltip floating info box */}
                    {hoveredNode ? (
                      <div className="absolute right-3.5 top-3.5 w-[220px] bg-slate-950/95 border border-sky-500/20 p-3 rounded-xl shadow-2xl backdrop-blur-md animate-fadeIn text-left space-y-1.5 pointer-events-none">
                        <div className="flex justify-between items-center border-b border-sky-950/30 pb-1">
                          <span className="text-[9px] uppercase font-mono tracking-widest text-sky-400">
                            {hoveredNode.category}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            PR: {hoveredNode.priority}
                          </span>
                        </div>
                        <h4 className="text-xs font-sans font-black text-slate-100 capitalize">{hoveredNode.keyword}</h4>
                        <p className="text-[9px] text-slate-305 leading-normal line-clamp-3">
                          {hoveredNode.entry.text ? hoveredNode.entry.text.slice(0, 100).replace(/[#*`~>]/g, '') : "Chưa có dã văn khảo tả."}
                        </p>
                      </div>
                    ) : (
                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[9px] text-slate-400 font-mono uppercase tracking-widest">
                        <span>🛸 Đưa chuột vào tinh cầu cốt truyện để quét nhanh</span>
                        <span>Orbit System</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Spellbook of Starter Templates (5 Cols) */}
            {showTemplates && (
              <div className={`${showGraph ? "lg:col-span-12 xl:col-span-5" : "lg:col-span-12"} bg-[#090f23]/70 border border-sky-950/50 rounded-2xl p-5 flex flex-col justify-between shadow-2xl relative backdrop-blur-md animate-fadeIn`}>
                <div className="space-y-4 h-full flex flex-col">
                  
                  <div className="flex items-center justify-between border-b border-sky-950/30 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Award size={15} className="text-sky-400" />
                      <span className="font-sans text-xs font-semibold text-sky-400 tracking-wider uppercase">
                        Bản Mẫu Thần Thoại (Templates)
                      </span>
                    </div>
                    <span className="text-[8px] font-mono py-0.5 px-2 bg-slate-950 text-sky-400 border border-sky-500/25 rounded uppercase">
                      Quản tạo nhanh
                    </span>
                  </div>

                  {/* Shelf Tab selection */}
                  <div className="flex bg-slate-950 p-1 rounded-xl gap-1 border border-slate-800/60 shrink-0">
                    {["character", "location", "item", "faction"].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveTemplateTab(cat)}
                        className={`flex-1 text-[9px] py-1 text-center font-mono font-bold uppercase rounded-lg transition-all ${
                          activeTemplateTab === cat 
                            ? "bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm" 
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {cat === 'character' ? 'Nhân vật' : cat === 'location' ? 'Địa danh' : cat === 'item' ? 'Cổ vật' : 'Mật nghi'}
                      </button>
                    ))}
                  </div>

                  {/* Dossier Card display */}
                  <div className="flex-1 bg-slate-950/95 p-4 border border-sky-950/80 rounded-xl flex flex-col justify-between relative overflow-hidden text-left space-y-3.5">
                    <div className="space-y-2 flex-1">
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                        <span>Cổ thư khố / Tài liệu dã sử</span>
                        <span className="font-extrabold text-sky-400">
                          PREGRADE #0{STARTER_TEMPLATES.findIndex((t) => t.category === activeTemplateTab) + 1}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-sans font-black text-sky-400 uppercase tracking-wide flex items-center gap-1.5">
                          <ChevronRight size={13} className="text-sky-400" />
                          {selectedTemplate.title}
                        </h4>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-sans line-clamp-3">
                          {selectedTemplate.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-slate-900/50 font-sans text-slate-300">
                        {selectedTemplate.rpg_attrs && Object.entries(selectedTemplate.rpg_attrs).map(([key, value]: any) => {
                          const label = key === "alignment" ? "Khuynh hướng" :
                                        key === "role" ? "Nhân cấu định lý" :
                                        key === "danger_level" ? "Mức đe dọa" :
                                        key === "climate" ? "Khí hậu" :
                                        key === "ruler" ? "Tổ lĩnh cai quản" :
                                        key === "population" ? "Cư tộc định cư" :
                                        key === "rarity" ? "Phẩm cấp" :
                                        key === "abilities" ? "Kỹ nghệ linh thức" :
                                        key === "influence" ? "Ảnh hưởng" : key;
                          return (
                            <div key={key} className="space-y-0.5 truncate">
                              <span className="text-slate-500 block uppercase tracking-wider text-[8px] font-mono">
                                {label}
                              </span>
                              <span className="font-bold block truncate text-sky-305">
                                {value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-sky-950/40">
                      <button
                        onClick={() => {
                          const modelData: Partial<VectorData> = {
                            category: selectedTemplate.category,
                            keyword: selectedTemplate.keyword,
                            keywords: selectedTemplate.keywords,
                            text: selectedTemplate.text,
                            triggerMode: selectedTemplate.category === "character" ? "keyword" : "hybrid",
                            priority: 50,
                            isEnabled: true,
                            position: selectedTemplate.category === "character" ? "before_char" : "before_history",
                            tags: selectedTemplate.keywords,
                          };
                          if (selectedTemplate.rpg_attrs) {
                            try {
                              (modelData as any).rpg_attrs = selectedTemplate.rpg_attrs;
                            } catch {}
                          }
                          onAddManualWithTemplate(modelData);
                        }}
                        className="w-full py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:opacity-90 hover:from-sky-550 text-slate-100 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all transform hover:translate-y-[-1px]"
                      >
                        <Sparkles size={11} />
                        Tiếp tụ bối cảnh này!
                        <ArrowRight size={11} className="ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 8 Categories Filter Pills */}
        <div className="space-y-2 text-left">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Bookmark size={14} className="text-sky-400" />
              <h3 className="font-sans text-xs font-bold text-sky-455 uppercase tracking-widest">
                Lớp Tri Thức Bản Đồ ({Object.keys(CATEGORY_MAP).length} Nhãn mục)
              </h3>
            </div>
            {activeFilterIndicator && (
              <button 
                onClick={() => {
                  onCategoryFilterChange(null);
                  setActiveFilterIndicator(null);
                }}
                className="text-xs font-mono text-sky-455 hover:underline flex items-center gap-1 uppercase font-bold"
              >
                ✕ Hủy lọc nhãn
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {Object.entries(CATEGORY_MAP).map(([catKey, catInfo]) => {
              const count = entries.filter(e => e.category === catKey).length;
              const isSelected = activeFilterIndicator === catKey;

              return (
                <button
                  key={catKey}
                  onClick={() => handleCategoryFilterClick(catKey)}
                  className={`group p-3 rounded-xl text-left transition-all hover:translate-y-[-1px] shadow-sm flex flex-col justify-between min-h-[90px] relative overflow-hidden border ${
                    isSelected
                      ? "bg-sky-500/10 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.15)] bg-gradient-to-tr from-sky-950/20 to-slate-900"
                      : "bg-[#0d1527]/45 border-slate-800/80 hover:border-sky-500/40 hover:bg-slate-900/80"
                  }`}
                >
                  <div className={`p-1 w-8 h-8 rounded border flex items-center justify-center ${
                    isSelected ? "text-sky-400 border-sky-500/40 bg-slate-900" : "text-slate-400 border-slate-800/60 bg-slate-950/60"
                  }`}>
                    {React.createElement(catInfo.icon, { size: 16 })}
                  </div>
                  <div className="mt-2 text-ellipsis overflow-hidden z-10 w-full">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block truncate">
                      {catInfo.label}
                    </span>
                    <div className="flex justify-between items-baseline mt-0.5">
                      <span className="text-base font-sans font-black text-slate-100">
                        {count}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-sky-400 font-bold">
                          Lọc ⬤
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Core Main Stage Bento Grid of Lore Dossier Cards (Focus mode center) */}
        <div className="space-y-4 text-left pt-3">
          <div className="flex items-center justify-between border-b border-sky-950/40 pb-2">
            <h3 className="font-sans text-lg font-extrabold text-sky-400 uppercase tracking-widest flex items-center gap-2 select-none">
              <Database size={18} className="text-sky-400" />
              Danh Mục Toàn Hư (Dossier Record)
            </h3>
            <span className="text-xs font-mono text-indigo-400">Khai quật được {filteredEntries.length} mốc tri thức</span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center bg-[#0d1527]/35 border border-dashed border-slate-800/80 py-16 rounded-2xl flex flex-col items-center justify-center gap-3">
              <Search size={36} className="text-slate-700 animate-pulse" />
              <h4 className="font-sans text-sm text-sky-455 uppercase tracking-wider font-extrabold">Cổ thư chưa có dữ liệu tương đồng</h4>
              <p className="text-slate-400 text-xs max-w-sm leading-relaxed">Vui lòng điều chỉnh điều kiện tìm kiếm hoặc bấm nút nạp nhanh bối cảnh mẫu phía bên trên.</p>
            </div>
          ) : (
            <div className={layoutStyle === "dense" ? "space-y-2 lg:space-y-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"}>
              {filteredEntries.map((e) => {
                const isEnabled = e.isEnabled !== false;
                const catInfo = CATEGORY_MAP[e.category || 'world'];
                const { label: tierLabel, color: tierColor } = getPriorityTier(e.priority);

                if (layoutStyle === "dense") {
                  return (
                    <div
                      key={e.id}
                      onClick={() => onSelect(e.id)}
                      className={`group rounded-xl border text-left transition-all px-4 py-3.5 shadow-md relative cursor-pointer flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 select-none hover:translate-x-1 ${
                        !isEnabled 
                          ? 'bg-slate-950/45 border-slate-900 opacity-45 grayscale hover:opacity-75 hover:grayscale-0' 
                          : 'bg-[#090f23]/90 border-slate-800/85 hover:border-sky-505/40 hover:bg-slate-900/95 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
                      }`}
                    >
                      {/* Left Block: Icon & Keyword & text brief */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={`p-2 rounded-lg border shrink-0 ${
                          isEnabled ? "text-sky-400 border-sky-500/20 bg-slate-950" : "text-slate-400 border-slate-850 bg-slate-900"
                        }`}>
                          {catInfo && React.createElement(catInfo.icon, { size: 16 })}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2.5">
                            <h4 className={`text-sm font-sans font-extrabold tracking-wide text-sky-400 group-hover:text-sky-350 capitalize truncate ${!isEnabled ? 'line-through opacity-50' : ''}`}>
                              {e.keyword || e.title || "Vô danh thư"}
                            </h4>
                            {e.triggerMode === 'always' && <Pin size={11} className="text-sky-400 animate-pulse shrink-0" />}
                            <span className="text-xs font-mono text-slate-400 hidden md:inline shrink-0">
                              ~{Math.round((e.text?.length || 0)/3.8)} TK
                            </span>
                          </div>
                          <span className="text-xs text-slate-300 font-sans truncate block line-clamp-1 mt-0.5">
                            {e.category === 'character' ? (() => {
                              try {
                                const cData = JSON.parse(e.text || "{}");
                                return [cData.narrativeRole, cData.personality].filter(Boolean).join(" • ");
                              } catch {
                                return (e.text || '').replace(/[#*`~>]/g, '');
                              }
                            })() : (e.text || '').replace(/[#*`~>]/g, '')}
                          </span>
                        </div>
                      </div>

                      {/* Right Block: Tags list, Tier Badge, Status toggles, Delete button */}
                      <div className="flex items-center gap-3.5 shrink-0 ml-auto sm:ml-0">
                        {e.keywords && e.keywords.length > 0 && (
                          <div className="hidden sm:flex gap-1 overflow-hidden max-w-[140px]">
                            {e.keywords.slice(0, 2).map((w, idx) => (
                              <span key={idx} className="text-xs font-mono text-slate-405 bg-slate-950 px-1.5 py-0.5 rounded truncate max-w-[70px] border border-slate-900/60 font-medium font-bold">
                                #{w}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {(e.relatedEntries || []).length > 0 && (
                          <span className="text-xs font-mono text-sky-455 font-bold hidden sm:inline shrink-0">
                            🔗{(e.relatedEntries || []).length}
                          </span>
                        )}

                        <span className={`px-2 py-0.5 rounded text-xs border font-bold uppercase shrink-0 ${tierColor}`}>
                          {tierLabel}
                        </span>

                        <div className="flex items-center gap-2 border-l border-slate-800/80 pl-2.5">
                          {/* Enable/Disable switch button */}
                          {onToggleStatus && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleStatus(e.id, !isEnabled);
                              }}
                              className="text-slate-400 hover:text-sky-450 transition-colors focus:outline-none shrink-0"
                              title={isEnabled ? "Tạm ngắt tri thức" : "Bật kích hoạt"}
                            >
                              {isEnabled ? (
                                <ToggleRight className="text-emerald-500 hover:text-emerald-400" size={18} />
                              ) : (
                                <ToggleLeft size={18} className="opacity-40" />
                              )}
                            </button>
                          )}
                          
                          {/* Quick delete button */}
                          {onDelete && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (confirm("Bạn có chắc chắn muốn xóa thư tịch tri thức này?")) {
                                  onDelete(e.id);
                                }
                              }}
                              className="text-stone-500 hover:text-red-500 transition-colors focus:outline-none ml-0.5 shrink-0"
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={e.id}
                    onClick={() => onSelect(e.id)}
                    className={`group rounded-2xl border text-left transition-all p-5 shadow-lg relative overflow-hidden cursor-pointer flex flex-col justify-between h-[210px] select-none hover:scale-[1.015] duration-300 font-sans hover:shadow-sky-500/5 ${
                      !isEnabled 
                        ? 'bg-slate-950/45 border-slate-900 opacity-44 grayscale hover:opacity-75 hover:grayscale-0' 
                        : 'bg-[#090f23]/90 border-slate-800/85 hover:border-sky-500/40 shadow-[0_4px_24px_rgba(0,0,0,0.45)]'
                    }`}
                  >
                    {/* Modern geometric cyber accents on corners */}
                    <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-sky-500/20 group-hover:border-sky-400 group-hover:w-3.5 group-hover:h-3.5 transition-all duration-300 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-sky-500/20 group-hover:border-sky-400 group-hover:w-3.5 group-hover:h-3.5 transition-all duration-300 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-sky-500/20 group-hover:border-sky-400 group-hover:w-3.5 group-hover:h-3.5 transition-all duration-300 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-sky-500/20 group-hover:border-sky-400 group-hover:w-3.5 group-hover:h-3.5 transition-all duration-300 pointer-events-none" />

                    {/* Card Header Strip */}
                    <div className="space-y-2 flex-1 flex flex-col">
                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400">
                        <span className="flex items-center gap-1 font-bold text-sky-455">
                          {catInfo && React.createElement(catInfo.icon, { size: 11, className: "text-sky-400" })}
                          {catInfo ? catInfo.label : 'Cổ Thư'}
                        </span>
                        
                        <div className="flex gap-1.5 items-center">
                          {e.triggerMode && (
                            <span className="bg-slate-950 px-1.5 py-0.5 rounded text-[8px] font-bold text-sky-450/80 uppercase border border-slate-900/60">
                              {e.triggerMode === 'always' ? 'Always-ON' : e.triggerMode}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 rounded text-[8px] border font-bold uppercase ${tierColor}`}>
                            {tierLabel}
                          </span>
                        </div>
                      </div>

                      {/* Main Book Title */}
                      <div className="space-y-1">
                        <h4 className={`text-base font-sans font-extrabold tracking-wide text-sky-400 group-hover:text-sky-305 capitalize truncate ${!isEnabled ? 'line-through opacity-50' : ''}`}>
                          {e.keyword || e.title || "Vô danh thư"}
                        </h4>
                        
                        {/* Summary / Description */}
                        <p className="text-[10.5px] text-slate-350 leading-relaxed font-sans line-clamp-3">
                          {e.category === 'character' ? (() => {
                            try {
                              const cData = JSON.parse(e.text || "{}");
                              return [cData.narrativeRole, cData.personality, cData.appearance].filter(Boolean).join(" • ");
                            } catch {
                              return (e.text || '').replace(/[#*`~>]/g, '');
                            }
                          })() : (e.text || '').replace(/[#*`~>]/g, '')}
                        </p>
                      </div>
                    </div>

                    {/* Bottom strip representing properties */}
                    <div className="pt-2.5 mt-2 border-t border-slate-800/85 flex flex-col gap-1.5">
                      {/* Keyword triggers chips lists */}
                      {e.keywords && e.keywords.length > 0 && (
                        <div className="flex gap-1 overflow-hidden h-4 select-none">
                          {e.keywords.slice(0, 3).map((w, idx) => (
                            <span key={idx} className="text-[9px] font-mono text-slate-405 truncate bg-slate-950 px-1 py-0.5 rounded border border-slate-900/60">
                              #{w}
                            </span>
                          ))}
                          {e.keywords.length > 3 && (
                            <span className="text-[8px] font-mono text-slate-500">+{e.keywords.length - 3}</span>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 pt-0.5">
                        <span className="flex items-center gap-1">
                          {(e.relatedEntries || []).length > 0 ? (
                            <span className="text-sky-400 font-bold flex items-center gap-1">🔗 {(e.relatedEntries || []).length} liên đới</span>
                          ) : (
                            <span>無 Liên kết</span>
                          )}
                          {e.triggerMode === 'always' && <Pin size={8} className="text-sky-400 animate-pulse" />}
                        </span>

                        <div className="flex items-center gap-3">
                          <span className="text-[9px] text-slate-500">~{Math.round((e.text?.length || 0)/3.8)} Tokens</span>
                          
                          {/* Enable/Disable switch button */}
                          {onToggleStatus && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleStatus(e.id, !isEnabled);
                              }}
                              className="text-slate-400 hover:text-sky-400 transition-colors focus:outline-none"
                              title={isEnabled ? "Tạm ngắt tri thức" : "Bật kích hoạt"}
                            >
                              {isEnabled ? (
                                <ToggleRight className="text-emerald-500 hover:text-emerald-400" size={18} />
                              ) : (
                                <ToggleLeft size={18} className="opacity-40" />
                              )}
                            </button>
                          )}
                          
                          {/* Quick delete button */}
                          {onDelete && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                if (confirm("Bạn có chắc chắn muốn xóa thư tịch tri thức này?")) {
                                  onDelete(e.id);
                                }
                              }}
                              className="text-slate-500 hover:text-red-500 transition-colors focus:outline-none ml-0.5"
                              title="Xóa vĩnh viễn"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
