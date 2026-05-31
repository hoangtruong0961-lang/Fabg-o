import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Database, X, Code, Zap, Plus, Trash2, Check, Sparkles, 
    AlertTriangle, ListChecks, Search, Clipboard, ArrowUp, ArrowDown,
    Edit2, Save, FileDown, FileUp, Sliders, CheckCircle2, HelpingCircle, RefreshCw,
    Undo, Redo, Star, Eye, Send, Play, Layers, CheckCircle, HelpCircle, Settings
} from 'lucide-react';
import Button from '../../../ui/Button';
import { useTheme } from '../../../../context/ThemeContext';
import { useResponsive } from '../../../../hooks/useResponsive';
import { ContextDebuggerView } from '../components/ContextDebuggerView';
import { WorldData, ContextWindowConfig, AppSettings, ChatMessage, PresetModelConfig } from '../../../../types';

const CATEGORIES = ['🎭 Đóng vai', '✍️ Văn phong', '🔥 Độ khó', '🗣️ Đối thoại', '⚙️ Cấu trúc'];
const PRIORITIES = ['🔴 TUYỆT ĐỐI', '🟡 LINH HOẠT', '🟢 KHUYẾN NGHỊ'];

const CATEGORY_STYLES: Record<string, { bg: string, text: string, border: string, iconColor: string }> = {
    '🎭 Đóng vai': { bg: 'bg-rose-500/10 dark:bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-900/40', iconColor: 'text-rose-500' },
    '✍️ Văn phong': { bg: 'bg-sky-500/10 dark:bg-sky-500/15', text: 'text-sky-600 dark:text-sky-450', border: 'border-sky-300 dark:border-sky-900/40', iconColor: 'text-sky-400' },
    '🔥 Độ khó': { bg: 'bg-amber-500/10 dark:bg-amber-500/15', text: 'text-amber-600 dark:text-amber-450', border: 'border-amber-300 dark:border-amber-900/40', iconColor: 'text-amber-500' },
    '🗣️ Đối thoại': { bg: 'bg-violet-500/10 dark:bg-violet-500/15', text: 'text-violet-600 dark:text-violet-450', border: 'border-violet-300 dark:border-violet-900/40', iconColor: 'text-violet-400' },
    '⚙️ Cấu trúc': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-450', border: 'border-emerald-300 dark:border-emerald-900/40', iconColor: 'text-emerald-450' },
    '⚙️ Khác': { bg: 'bg-stone-500/10 dark:bg-stone-500/15', text: 'text-stone-600 dark:text-stone-400', border: 'border-stone-300 dark:border-stone-800', iconColor: 'text-stone-400' },
};

const PRIORITY_STYLES: Record<string, { badge: string, dot: string }> = {
    '🔴 TUYỆT ĐỐI': { badge: 'bg-red-500/10 border-red-300 dark:border-red-900/30 text-red-600 dark:text-red-400', dot: 'bg-red-500' },
    '🟡 LINH HOẠT': { badge: 'bg-yellow-500/10 border-yellow-300 dark:border-yellow-900/30 text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
    '🟢 KHUYẾN NGHỊ': { badge: 'bg-green-500/10 border-green-300 dark:border-green-900/30 text-green-600 dark:text-green-400', dot: 'bg-green-500' },
};

interface ContextWindowModalProps {
    show: boolean;
    onClose: () => void;
    activeWorld: WorldData;
    handleUpdateContextConfig: (config: ContextWindowConfig) => void;
    settings: AppSettings;
    history: ChatMessage[];
    turnCount: number;
    tawaPresetConfig: PresetModelConfig | null;
    gameTime: any;
    lastAction: string;
    dynamicRules?: string[];
    setDynamicRules?: (rules: string[]) => void;
    isInline?: boolean;
    initialTab?: 'config' | 'rules' | 'debugger';
    allowedTabs?: ('config' | 'rules' | 'debugger')[];
}

interface ParsedRule {
    original: string;
    index: number;
    isDisabled: boolean;
    category: string;
    priority: string;
    title: string;
    content: string;
    condition?: string;
    tags?: string[];
    scope?: 'global' | 'chapter' | 'scene';
    expiryTurns?: number;
}

const parseRule = (rawRule: string, index: number): ParsedRule => {
    let str = rawRule.trim();
    let isDisabled = false;

    // Check disable status
    if (str.startsWith('[VÔ HIỆU HÓA]')) {
        isDisabled = true;
        str = str.substring('[VÔ HIỆU HÓA]'.length).trim();
    } else if (str.startsWith('//')) {
        isDisabled = true;
        str = str.substring(2).trim();
    }

    // Parse Expiry
    let expiryTurns: number | undefined = undefined;
    const expiryMatch = str.match(/^\[EXPIRY:\s*(\d+)\]/i);
    if (expiryMatch) {
        expiryTurns = parseInt(expiryMatch[1], 10);
        str = str.substring(expiryMatch[0].length).trim();
    }

    // Parse Scope
    let scope: 'global' | 'chapter' | 'scene' = 'global';
    const scopeMatch = str.match(/^\[SCOPE:\s*([^\]]+)\]/i);
    if (scopeMatch) {
        const parsedScope = scopeMatch[1].toLowerCase().trim();
        if (parsedScope === 'chapter' || parsedScope === 'scene') {
            scope = parsedScope;
        }
        str = str.substring(scopeMatch[0].length).trim();
    }

    // Parse Tags
    let tags: string[] = [];
    const tagsMatch = str.match(/^\[TAGS:\s*([^\]]+)\]/i);
    if (tagsMatch) {
        tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
        str = str.substring(tagsMatch[0].length).trim();
    }

    // Parse Condition tag
    let condition = '';
    const condMatch = str.match(/^\[(?:ĐIỀU KIỆN|KÍCH HOẠT KHI|COND|CONDITION|TRIGGER):\s*([^\]]+)\]/i);
    if (condMatch) {
        condition = condMatch[1].trim();
        str = str.substring(condMatch[0].length).trim();
    }

    // Parse category
    let category = '⚙️ Khác';
    for (const cat of CATEGORIES) {
        if (str.startsWith(`[${cat}]`)) {
            category = cat;
            str = str.substring(`[${cat}]`.length).trim();
            break;
        }
    }

    // Parse priority
    let priority = '🔴 TUYỆT ĐỐI';
    for (const pr of PRIORITIES) {
        if (str.startsWith(`[${pr}]`)) {
            priority = pr;
            str = str.substring(`[${pr}]`.length).trim();
            break;
        }
    }

    // Parse title
    let title = '';
    const titleMatch = str.match(/^\[([^\]]+)\]:\s*(.*)$/);
    if (titleMatch) {
        title = titleMatch[1];
        str = titleMatch[2];
    } else {
        // Fallback title
        title = str.length > 25 ? str.substring(0, 25) + '...' : str;
    }

    return {
        original: rawRule,
        index,
        isDisabled,
        category,
        priority,
        title,
        content: str,
        condition,
        tags,
        scope,
        expiryTurns
    };
};

const serializeRule = (parsed: Omit<ParsedRule, 'original' | 'index'>) => {
    let ruleStr = `[${parsed.category}] [${parsed.priority}] [${parsed.title}]: ${parsed.content}`;
    if (parsed.condition && parsed.condition.trim() !== '') {
        ruleStr = `[ĐIỀU KIỆN: ${parsed.condition.trim()}] ${ruleStr}`;
    }
    if (parsed.tags && parsed.tags.length > 0) {
        ruleStr = `[TAGS: ${parsed.tags.join(',')}] ${ruleStr}`;
    }
    if (parsed.scope && parsed.scope !== 'global') {
        ruleStr = `[SCOPE: ${parsed.scope}] ${ruleStr}`;
    }
    if (parsed.expiryTurns !== undefined && parsed.expiryTurns > 0) {
        ruleStr = `[EXPIRY: ${parsed.expiryTurns}] ${ruleStr}`;
    }
    if (parsed.isDisabled) {
        ruleStr = `[VÔ HIỆU HÓA] ${ruleStr}`;
    }
    return ruleStr;
};

// Advanced Preset Library structured by RPG usecase
interface AdvancedPreset {
    title: string;
    category: string;
    priority: string;
    content: string;
    condition?: string;
    tags?: string[];
    scope?: 'global' | 'chapter' | 'scene';
    expiryTurns?: number;
    useCase: 'Roleplay' | 'Combat' | 'Storyline' | 'Safety' | 'Aesthetics';
    rating?: string;
    popular?: boolean;
    desc?: string;
}

const PRESET_RULE_TEMPLATES: AdvancedPreset[] = [
    {
        title: "Chống OOC / Tự đóng vai",
        category: "🎭 Đóng vai",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Không bao giờ được tự đóng thế, tự viết tiếp hành động, cảm xúc hoặc hội thoại của nhân vật người chơi (Player). Hãy để người chơi tự kiểm soát nhân vật của mình.",
        desc: "Yêu cầu AI dừng hoàn toàn việc tự ý tả hoặc thực hiện hành động thế nhân vật của bạn.",
        useCase: 'Roleplay',
        tags: ['ooc', 'player-rights'],
        scope: 'global',
        popular: true,
        rating: '5.0'
    },
    {
        title: "Tả cảnh quan & Giác quan sắc bén",
        category: "✍️ Văn phong",
        priority: "🟡 LINH HOẠT",
        content: "Miêu tả sâu sắc các liên kết ngũ giác (âm thanh, khứu giác, điều kiện thời tiết kịch tính cùng cử chỉ cơ thể chậm rãi). Tránh lạm dụng tính từ sáo rỗng.",
        desc: "Tăng tính chân thực, kết nối ngũ giác trực giác mạnh mẽ với môi trường bối cảnh.",
        useCase: 'Aesthetics',
        tags: ['sensory', 'cinematic'],
        scope: 'global',
        rating: '4.8'
    },
    {
        title: "Loại bỏ văn phong mẫu AI",
        category: "✍️ Văn phong",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Tuyệt đối không sử dụng văn phong phụ tá lặp quân hay các cụm câu mồi/kết luận sượng sùng như: 'Tuy nhiên,', 'Có vẻ như', 'bất kể thế nào', 'bánh xe số mệnh'. Câu từ thuần Việt gãy gọn, kịch tính, thô sần nguyên bản.",
        desc: "Lọc bỏ triệt để giọng điệu rườm rà rập khuôn máy móc đặc thù của AI.",
        useCase: 'Aesthetics',
        tags: ['filter-ai', 'clean-text'],
        scope: 'global',
        popular: true,
        rating: '4.9'
    },
    {
        title: "Độ khó sinh tồn tàn nhẫn",
        category: "🔥 Độ khó",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Nguy hiểm trong thế giới này là tuyệt đối nguy kịch, vết thương có thể dẫn tới bại hoại cơ thể rõ rệt, quái vật thông minh mưu sâu. AI không được can thiệp cứu nguy người chơi bất thành văn hay bằng phép màu vô lý.",
        desc: "Đưa hiểm nguy trở thành hiện thực gai góc, rèn luyện cảm xúc kịch tính cao.",
        useCase: 'Combat',
        tags: ['survival', 'hardcore'],
        scope: 'global',
        rating: '4.7'
    },
    {
        title: "Hội thoại súc tích thần thái",
        category: "🗣️ Đối thoại",
        priority: "🟡 LINH HOẠT",
        content: "Giữ đối thoại của NPC cực kỳ súc tích (dưới 3 câu). Thể hiện thần thái cốt cách thông qua hành động, hướng mắt nhìn, nhịp thở đi kèm thay vì nói dông dài lý lẽ.",
        desc: "NPC kiện lời, nội tâm sâu sắc sắc bén hơn rất nhiều.",
        useCase: 'Aesthetics',
        tags: ['short-chat', 'npc-temper'],
        scope: 'global',
        rating: '4.9'
    },
    {
        title: "Bức tường kịch bản cố định",
        category: "⚙️ Cấu trúc",
        priority: "🔴 TUYỆT ĐỐI",
        content: "Ý chí và tôn chỉ của NPC giữ vững tuyệt đối, thù hận hay quy phục đều diễn tiến có lý trí. Không bị lay chuyển dễ dàng chỉ bằng vài từ ngữ hoa mỹ hay thuyết phục sáo rỗng từ người chơi.",
        desc: "Cản trợ người chơi bẻ khóa cốt cách hoặc phá vỡ tâm lý logic của Boss, NPC mấu chốt.",
        useCase: 'Safety',
        tags: ['lore-guard', 'difficulty'],
        scope: 'global',
        rating: '4.8'
    },
    {
        title: "Khẩu âm cổ xưa trang trọng",
        category: "🗣️ Đối thoại",
        priority: "🟡 LINH HOẠT",
        content: "Khi đối thoại, các nhân vật cổ trang dùng đại từ xưng hô đúng kịch bản kiếm hiệp / huyền huyễn dứt khoát như: 'Bản tọa, ta, ngươi, tại hạ, huynh đài, đạo hữu'. Cấm dùng từ ngữ hiện đại như 'Tôi, cậu, bạn, tớ'.",
        desc: "Duy trì không khí gia văn trọn vẹn lý thú.",
        useCase: 'Roleplay',
        tags: ['historical', 'ancient'],
        scope: 'global',
        rating: '4.6'
    }
];

const ContextWindowModal: React.FC<ContextWindowModalProps> = ({
    show, onClose, activeWorld, handleUpdateContextConfig,
    settings, history, turnCount, tawaPresetConfig, gameTime, lastAction,
    dynamicRules = [], setDynamicRules, isInline = false,
    initialTab, allowedTabs
}) => {
    const { isMobile: isMobileMode } = useResponsive();
    const tabsToRender = allowedTabs || ['rules', 'config', 'debugger'];
    const [activeContextTab, setActiveContextTab] = useState<'config' | 'rules' | 'debugger'>(
        initialTab && tabsToRender.includes(initialTab) ? initialTab : (tabsToRender[0] || 'rules')
    );

    useEffect(() => {
        if (initialTab && tabsToRender.includes(initialTab)) {
            setActiveContextTab(initialTab);
        }
    }, [initialTab]);

    const [composerMode, setComposerMode] = useState<'advanced' | 'simple'>('advanced');
    
    // Core states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('ALL');
    const [selectedFilterStatus, setSelectedFilterStatus] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

    // Inline editing states
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [editingCategory, setEditingCategory] = useState('');
    const [editingPriority, setEditingPriority] = useState('');
    const [editingCondition, setEditingCondition] = useState('');
    const [editingContent, setEditingContent] = useState('');

    // Advanced Rule Editor target selection
    const [selectedRuleIdx, setSelectedRuleIdx] = useState<number | null>(null);
    const [editorTab, setEditorTab] = useState<'core' | 'trigger' | 'metadata'>('core');

    // Edit form states (or creation states)
    const [ruleTitle, setRuleTitle] = useState('');
    const [ruleCategory, setRuleCategory] = useState('🎭 Đóng vai');
    const [rulePriority, setRulePriority] = useState('🔴 TUYỆT ĐỐI');
    const [ruleContent, setRuleContent] = useState('');
    const [ruleCondition, setRuleCondition] = useState('');
    const [ruleTagsStr, setRuleTagsStr] = useState('');
    const [ruleScope, setRuleScope] = useState<'global' | 'chapter' | 'scene'>('global');
    const [ruleExpiry, setRuleExpiry] = useState<number>(0);

    // AI Assist Helpers
    const [aiAssistConcept, setAiAssistConcept] = useState('');
    const [aiAssistLoading, setAiAssistLoading] = useState(false);
    const [aiAssistOutput, setAiAssistOutput] = useState('');
    const [aiAssistConflictDetails, setAiAssistConflictDetails] = useState<string | null>(null);
    const [aiAssistSuggestions, setAiAssistSuggestions] = useState<{title: string, content: string}[]>([]);

    // Undo / Redo dynamic rule list stack (History depth of 15)
    const [ruleHistory, setRuleHistory] = useState<string[][]>([]);
    const [ruleHistoryPointer, setRuleHistoryPointer] = useState<number>(-1);

    // Visual Trigger Builder States
    const [triggerType, setTriggerType] = useState('turn_count');
    const [triggerOperator, setTriggerOperator] = useState('>');
    const [triggerValue, setTriggerValue] = useState('5');

    // Bulk Select & Collapsed categories
    const [bulkSelectedIdxs, setBulkSelectedIdxs] = useState<number[]>([]);
    const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Simulator states
    const [simulatorInput, setSimulatorInput] = useState('');
    const [simulatorOutput, setSimulatorOutput] = useState('');
    const [isSimulating, setIsSimulating] = useState(false);

    // Import/Export Modal Zone
    const [showImportExport, setShowImportExport] = useState(false);
    const [importExportText, setImportExportText] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [importError, setImportError] = useState('');
    const [importSuccess, setImportSuccess] = useState('');

    // Ratings & Preset selected usecase
    const [activePresetGroup, setActivePresetGroup] = useState<'ALL' | 'Roleplay' | 'Combat' | 'Storyline' | 'Safety' | 'Aesthetics'>('ALL');

    // Synchronize initial rules list with History Stack
    useEffect(() => {
        if (dynamicRules.length > 0 && ruleHistory.length === 0) {
            setRuleHistory([dynamicRules]);
            setRuleHistoryPointer(0);
        }
    }, [dynamicRules]);

    const recordHistory = (newList: string[]) => {
        if (!setDynamicRules) return;
        const trunk = ruleHistory.slice(0, ruleHistoryPointer + 1);
        trunk.push(newList);
        // limit history to 20 items
        if (trunk.length > 20) trunk.shift();
        setRuleHistory(trunk);
        setRuleHistoryPointer(trunk.length - 1);
        setDynamicRules(newList);
    };

    const handleUndo = () => {
        if (ruleHistoryPointer > 0) {
            const nextIdx = ruleHistoryPointer - 1;
            setRuleHistoryPointer(nextIdx);
            if (setDynamicRules) {
                setDynamicRules(ruleHistory[nextIdx]);
            }
        }
    };

    const handleRedo = () => {
        if (ruleHistoryPointer < ruleHistory.length - 1) {
            const nextIdx = ruleHistoryPointer + 1;
            setRuleHistoryPointer(nextIdx);
            if (setDynamicRules) {
                setDynamicRules(ruleHistory[nextIdx]);
            }
        }
    };

    // Real-time client evaluator
    const evaluateRuleConditionClient = (conditionStr?: string) => {
        if (!conditionStr || conditionStr.trim() === '' || conditionStr.toLowerCase() === 'always' || conditionStr === 'luôn luôn' || conditionStr === 'luôn áp dụng') {
            return { active: true, label: 'Luôn áp dụng' };
        }
        
        const cond = conditionStr.trim();
        const compRegex = /^([a-zA-Z_0-9.]+)\s*(>=|<=|==|===|=|>|<)\s*([a-zA-Z_0-9.-]+|'[^']*'|"[^"]*")$/;
        const match = cond.match(compRegex);

        let leftVal: any = undefined;
        let leftLabel = '';
        if (match) {
            const [, rawLeft, op, rawRight] = match;
            const left = rawLeft.trim();
            const right = rawRight.trim().replace(/^['"]|['"]$/g, '');

            if (left === 'turn' || left === 'turnCount' || left === 'turn_count') {
                leftVal = turnCount;
                leftLabel = `Lượt (${turnCount})`;
            } else if (left === 'hour' || left === 'time_hour') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.hour : 8;
                leftLabel = `Giờ (${leftVal}h)`;
            } else if (left === 'day' || left === 'time_day') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.day : 1;
                leftLabel = `Ngày (${leftVal})`;
            } else if (left === 'month' || left === 'time_month') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.month : 1;
                leftLabel = `Tháng (${leftVal})`;
            } else if (left === 'year' || left === 'time_year') {
                leftVal = typeof gameTime === 'object' ? (gameTime as any)?.year : 2024;
                leftLabel = `Năm (${leftVal})`;
            } else {
                const cleanKey = left.replace(/^(vars\.|var\.|biến\.)/, '');
                const tavoVars = (activeWorld as any)?.tavoVars || {};
                if (cleanKey in tavoVars) {
                    leftVal = tavoVars[cleanKey];
                    leftLabel = `Biến ${cleanKey} (${leftVal})`;
                } else {
                    leftLabel = `Biến ${cleanKey}`;
                }
            }

            if (leftVal === undefined) {
                return { active: false, label: `${leftLabel} ${op} ${right}` };
            }

            const rightNum = Number(right);
            const isRightNumeric = !isNaN(rightNum);
            const rightVal = isRightNumeric ? rightNum : right;

            let result = false;
            switch (op) {
                case '>': result = Number(leftVal) > Number(rightVal); break;
                case '<': result = Number(leftVal) < Number(rightVal); break;
                case '>=': result = Number(leftVal) >= Number(rightVal); break;
                case '<=': result = Number(leftVal) <= Number(rightVal); break;
                case '==':
                case '===':
                case '=':
                    result = String(leftVal) === String(rightVal); break;
            }

            return { 
                active: result, 
                label: `${leftLabel} ${op} ${right}` 
            };
        }

        const keywordRegex = /^(keyword|contains|chứa|player_msg_contains|tin_nhắn_chứa)\s*:\s*(.+)$/i;
        const kwMatch = cond.match(keywordRegex);
        if (kwMatch) {
            const searchStr = kwMatch[2].trim().replace(/^['"]|['"]$/g, '');
            const msg = (lastAction || '').toLowerCase();
            const contains = msg.includes(searchStr.toLowerCase());
            return {
                active: contains,
                label: `Tin nhắn chứa "${searchStr}"`
            };
        }

        return { active: true, label: `ĐK: ${cond}` };
    };

    const config = activeWorld?.config?.contextConfig || {
        items: {
          playerProfile: true, worldInfo: true, longTermMemory: true, relevantMemories: true, storyBible: true,
          entities: true, npcRegistry: true, timeSystem: true, reinforcement: true
        },
        maxEntities: 10, recentHistoryCount: 100
    };

    const toggleContextItem = (key: keyof ContextWindowConfig['items']) => {
        const newConfig = {
            ...config,
            items: {
                ...config.items,
                [key]: !config.items[key]
            }
        };
        handleUpdateContextConfig(newConfig);
    };

    const updateContextMaxEntities = (val: number) => {
        handleUpdateContextConfig({ ...config, maxEntities: val });
    };

    const updateContextHistoryCount = (val: number) => {
        handleUpdateContextConfig({ ...config, recentHistoryCount: val });
    };

    const updateContextMaxTokens = (val: number) => {
        handleUpdateContextConfig({ ...config, maxContextTokens: val });
    };

    // Parse Rules once
    const parsedRulesList = useMemo(() => {
        return dynamicRules.map((rule, idx) => parseRule(rule, idx));
    }, [dynamicRules]);

    // Local automatic conflict scanner
    const localConflicts = useMemo(() => {
        const activeList = parsedRulesList.filter(r => !r.isDisabled);
        const issues: Record<number, string[]> = {};

        for (let i = 0; i < activeList.length; i++) {
            for (let j = i + 1; j < activeList.length; j++) {
                const r1 = activeList[i];
                const r2 = activeList[j];

                // Name overlapping
                if (r1.title.toLowerCase() === r2.title.toLowerCase()) {
                    issues[r1.index] = [...(issues[r1.index] || []), `Trùng tên quy định với "${r2.title}"`];
                    issues[r2.index] = [...(issues[r2.index] || []), `Trùng tên quy định với "${r1.title}"`];
                }

                // Priority collision on same category
                if (r1.category === r2.category && r1.priority === '🔴 TUYỆT ĐỐI' && r2.priority === '🟢 KHUYẾN NGHỊ') {
                    const clean1 = r1.content.toLowerCase();
                    const clean2 = r2.content.toLowerCase();
                    // Basic overlap check
                    const common = clean1.split(/\s+/).filter(w => w.length > 5 && clean2.includes(w));
                    if (common.length > 2) {
                        issues[r1.index] = [...(issues[r1.index] || []), `Khả năng mạo lạm văn cảnh với "${r2.title}" (Cùng mục, độ cưỡng chế nghịch chiều)`];
                        issues[r2.index] = [...(issues[r2.index] || []), `Khả năng mạo lạm văn cảnh với "${r1.title}" (Cùng mục, độ cưỡng chế nghịch chiều)`];
                    }
                }
            }
        }
        return issues;
    }, [parsedRulesList]);

    // Search and filter list
    const filteredRules = useMemo(() => {
        return parsedRulesList.filter(rule => {
            const matchesSearch = searchQuery 
                ? rule.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                  rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (rule.tags && rule.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
                : true;
            
            const matchesCategory = selectedFilterCategory === 'ALL' 
                ? true 
                : rule.category === selectedFilterCategory;

            const matchesStatus = selectedFilterStatus === 'ALL' 
                ? true 
                : selectedFilterStatus === 'ACTIVE' 
                    ? !rule.isDisabled 
                    : rule.isDisabled;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [parsedRulesList, searchQuery, selectedFilterCategory, selectedFilterStatus]);

    // Token impact estimation (character counts / 3.8 average word tokens)
    const estimatedTokenUsage = useMemo(() => {
        const enabledRules = parsedRulesList.filter(r => !r.isDisabled);
        const characters = enabledRules.reduce((acc, r) => acc + (r.title.length + r.content.length + (r.condition?.length || 0)), 0);
        return Math.ceil(characters / 3.8);
    }, [parsedRulesList]);

    // Calculate IsDirty state for currently active rule inputs
    const isCurrentDirty = useMemo(() => {
        if (selectedRuleIdx === null) {
            // Check if any fields are written in a blank creation form
            return !!(ruleTitle.trim() || ruleContent.trim() || ruleCondition.trim() || ruleTagsStr.trim() || ruleExpiry > 0 || ruleScope !== 'global');
        }
        const initial = parsedRulesList[selectedRuleIdx];
        if (!initial) return false;

        const currentTags = ruleTagsStr.split(',').map(t => t.trim()).filter(Boolean);
        const initialTags = initial.tags || [];
        const tagsDiff = currentTags.join(',') !== initialTags.join(',');

        return (
            initial.title !== ruleTitle.trim() ||
            initial.content !== ruleContent.trim() ||
            (initial.condition || '') !== ruleCondition.trim() ||
            initial.category !== ruleCategory ||
            initial.priority !== rulePriority ||
            initial.scope !== ruleScope ||
            (initial.expiryTurns || 0) !== ruleExpiry ||
            tagsDiff
        );
    }, [
        selectedRuleIdx, ruleTitle, ruleContent, ruleCondition, ruleCategory, 
        rulePriority, ruleTagsStr, ruleScope, ruleExpiry, parsedRulesList
    ]);

    // Load full details of rule into Right panel editor
    const handleSelectRuleForEditing = (idx: number) => {
        const rule = parsedRulesList[idx];
        if (!rule) return;
        setSelectedRuleIdx(idx);
        setRuleTitle(rule.title);
        setRuleCategory(rule.category);
        setRulePriority(rule.priority);
        setRuleContent(rule.content);
        setRuleCondition(rule.condition || '');
        setRuleTagsStr(rule.tags ? rule.tags.join(', ') : '');
        setRuleScope(rule.scope || 'global');
        setRuleExpiry(rule.expiryTurns || 0);

        // Reset AI assists panel
        resetAiAssistConsole();
    };

    const handleOpenBlankCreation = () => {
        setSelectedRuleIdx(null);
        setRuleTitle('');
        setRuleCategory('🎭 Đóng vai');
        setRulePriority('🔴 TUYỆT ĐỐI');
        setRuleContent('');
        setRuleCondition('');
        setRuleTagsStr('');
        setRuleScope('global');
        setRuleExpiry(0);
        resetAiAssistConsole();
    };

    const resetAiAssistConsole = () => {
        setAiAssistConcept('');
        setAiAssistOutput('');
        setAiAssistConflictDetails(null);
        setAiAssistSuggestions([]);
    };

    // Save detailed rule (either overwrite selected or append new)
    const handleSaveDetailedRule = () => {
        if (!ruleContent.trim()) return;

        const parsedTags = ruleTagsStr.split(',').map(s => s.trim()).filter(Boolean);
        const serialized = serializeRule({
            isDisabled: selectedRuleIdx !== null ? parsedRulesList[selectedRuleIdx].isDisabled : false,
            category: ruleCategory,
            priority: rulePriority,
            title: ruleTitle.trim() || 'Không tên',
            content: ruleContent.trim(),
            condition: ruleCondition.trim(),
            tags: parsedTags,
            scope: ruleScope,
            expiryTurns: ruleExpiry > 0 ? ruleExpiry : undefined
        });

        const list = [...dynamicRules];
        if (selectedRuleIdx !== null) {
            // Overwrite existing
            list[selectedRuleIdx] = serialized;
            recordHistory(list);
        } else {
            // Append new rule
            list.push(serialized);
            recordHistory(list);
            // Select newly created rule
            setSelectedRuleIdx(list.length - 1);
        }
    };

    // Save detailed rule as a copy (Duplicate)
    const handleSaveAsCopy = () => {
        if (!ruleContent.trim()) return;
        const parsedTags = ruleTagsStr.split(',').map(s => s.trim()).filter(Boolean);
        const nameCopy = ruleTitle.trim() ? `${ruleTitle.trim()} (Bản sao)` : 'Bản sao';
        const serialized = serializeRule({
            isDisabled: false,
            category: ruleCategory,
            priority: rulePriority,
            title: nameCopy,
            content: ruleContent.trim(),
            condition: ruleCondition.trim(),
            tags: parsedTags,
            scope: ruleScope,
            expiryTurns: ruleExpiry > 0 ? ruleExpiry : undefined
        });

        const list = [...dynamicRules];
        list.push(serialized);
        recordHistory(list);
        setSelectedRuleIdx(list.length - 1);
    };

    // Delete active rule completely
    const handleRemoveRule = (index: number) => {
        const list = dynamicRules.filter((_, idx) => idx !== index);
        recordHistory(list);
        
        // Deselect or adjust pointer
        if (selectedRuleIdx === index) {
            setSelectedRuleIdx(null);
            handleOpenBlankCreation();
        } else if (selectedRuleIdx !== null && selectedRuleIdx > index) {
            setSelectedRuleIdx(selectedRuleIdx - 1);
        }
    };

    // Toggle rule status (Active / Inactive)
    const handleToggleRuleActive = (index: number) => {
        const parsed = parsedRulesList[index];
        const updated = serializeRule({
            ...parsed,
            isDisabled: !parsed.isDisabled
        });
        const list = [...dynamicRules];
        list[index] = updated;
        recordHistory(list);

        // Sync local edit panel state if currently editing this index
        if (selectedRuleIdx === index) {
            handleSelectRuleForEditing(index);
        }
    };

    // Visual Trigger Builder Injection
    const handleInjectTriggerBlock = () => {
        let blockStatement = '';
        if (triggerType === 'turn_count') {
            blockStatement = `turn ${triggerOperator} ${triggerValue}`;
        } else if (triggerType === 'keyword') {
            blockStatement = `keyword:${triggerValue.trim()}`;
        } else if (triggerType === 'hour') {
            blockStatement = `hour ${triggerOperator} ${triggerValue}`;
        } else if (triggerType === 'day') {
            blockStatement = `day ${triggerOperator} ${triggerValue}`;
        } else if (triggerType === 'custom_var') {
            blockStatement = `var.${triggerValue.trim()} ${triggerOperator} 1`;
        }

        const newCond = ruleCondition.trim() 
            ? `${ruleCondition.trim()} && ${blockStatement}` 
            : blockStatement;
        setRuleCondition(newCond);
    };

    // HTML5 Drag and Drop events to rearrange list swiftly
    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDropRearrange = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

        const list = [...dynamicRules];
        const movedItem = list[sourceIndex];
        list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, movedItem);
        recordHistory(list);

        // adjust selected pointer
        if (selectedRuleIdx === sourceIndex) {
            setSelectedRuleIdx(targetIndex);
        } else if (selectedRuleIdx !== null) {
            if (sourceIndex < selectedRuleIdx && targetIndex >= selectedRuleIdx) {
                setSelectedRuleIdx(selectedRuleIdx - 1);
            } else if (sourceIndex > selectedRuleIdx && targetIndex <= selectedRuleIdx) {
                setSelectedRuleIdx(selectedRuleIdx + 1);
            }
        }
    };

    // Quick loading a preset card with fine-tuning state open
    const handleSelectPreset = (preset: AdvancedPreset) => {
        setSelectedRuleIdx(null);
        setRuleTitle(preset.title);
        setRuleCategory(preset.category);
        setRulePriority(preset.priority);
        setRuleContent(preset.content);
        setRuleCondition(preset.condition || '');
        setRuleTagsStr(preset.tags ? preset.tags.join(', ') : '');
        setRuleScope(preset.scope || 'global');
        setRuleExpiry(preset.expiryTurns || 0);
        setEditorTab('core');
        resetAiAssistConsole();
    };

    // Bulk Actions handlers
    const handleToggleBulkSelect = (idx: number) => {
        if (bulkSelectedIdxs.includes(idx)) {
            setBulkSelectedIdxs(bulkSelectedIdxs.filter(i => i !== idx));
        } else {
            setBulkSelectedIdxs([...bulkSelectedIdxs, idx]);
        }
    };

    const handleBulkSelectAll = () => {
        if (bulkSelectedIdxs.length === filteredRules.length) {
            setBulkSelectedIdxs([]);
        } else {
            setBulkSelectedIdxs(filteredRules.map(r => r.index));
        }
    };

    const handleBulkEnable = () => {
        if (bulkSelectedIdxs.length === 0) return;
        const list = [...dynamicRules];
        bulkSelectedIdxs.forEach(idx => {
            const parsed = parsedRulesList[idx];
            if (parsed) {
                list[idx] = serializeRule({ ...parsed, isDisabled: false });
            }
        });
        recordHistory(list);
        setBulkSelectedIdxs([]);
    };

    const handleBulkDisable = () => {
        if (bulkSelectedIdxs.length === 0) return;
        const list = [...dynamicRules];
        bulkSelectedIdxs.forEach(idx => {
            const parsed = parsedRulesList[idx];
            if (parsed) {
                list[idx] = serializeRule({ ...parsed, isDisabled: true });
            }
        });
        recordHistory(list);
        setBulkSelectedIdxs([]);
    };

    const handleBulkDelete = () => {
        if (bulkSelectedIdxs.length === 0) return;
        const list = dynamicRules.filter((_, idx) => !bulkSelectedIdxs.includes(idx));
        recordHistory(list);
        setBulkSelectedIdxs([]);
        setSelectedRuleIdx(null);
        handleOpenBlankCreation();
        setShowDeleteConfirm(false);
    };

    const handleClearAll = () => {
        recordHistory([]);
        setBulkSelectedIdxs([]);
        setSelectedRuleIdx(null);
        handleOpenBlankCreation();
        setShowClearConfirm(false);
    };

    // Collapse/Expand group toggles
    const handleToggleCollapseCategory = (cat: string) => {
        if (collapsedCategories.includes(cat)) {
            setCollapsedCategories(collapsedCategories.filter(c => c !== cat));
        } else {
            setCollapsedCategories([...collapsedCategories, cat]);
        }
    };

    // AI Assist API Call handler
    const handleCallAiAssist = async (action: 'draft' | 'rephrase' | 'detect-conflict' | 'suggest') => {
        if (aiAssistLoading) return;
        setAiAssistLoading(true);
        setAiAssistOutput('');
        setAiAssistConflictDetails(null);
        setAiAssistSuggestions([]);

        try {
            const currentRuleData = {
                title: ruleTitle,
                category: ruleCategory,
                priority: rulePriority,
                content: ruleContent,
                condition: ruleCondition
            };

            const response = await fetch('/api/ai/rule-assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    currentRule: currentRuleData,
                    existingRules: parsedRulesList.map(r => ({ title: r.title, content: r.content })),
                    prompt: aiAssistConcept
                })
            });

            const data = await response.json();
            if (response.ok) {
                const text = data.result || '';
                if (action === 'draft' || action === 'rephrase') {
                    setAiAssistOutput(text.trim());
                } else if (action === 'detect-conflict') {
                    try {
                        const parsedJson = JSON.parse(text);
                        if (parsedJson.hasConflict) {
                            setAiAssistConflictDetails(parsedJson.explanation);
                        } else {
                            setAiAssistConflictDetails("✅ Không ghi nhận bất kỳ xung đột cốt lõi nào đối với hệ thống luật lệ hiện hữu!");
                        }
                    } catch {
                        setAiAssistConflictDetails(text);
                    }
                } else if (action === 'suggest') {
                    try {
                        const list = JSON.parse(text);
                        setAiAssistSuggestions(Array.isArray(list) ? list : []);
                    } catch {
                        // fallback mock from text
                        setAiAssistOutput(text);
                    }
                }
            } else {
                toast.error("Lỗi AI Trợ lý: " + (data.error || 'Unknown error'));
            }
        } catch (e: any) {
            toast.error("Lỗi kết nối bộ não AI: " + e.message + ". Vui lòng kiểm tra lại cấu hình GEMINI_API_KEY hoặc Proxy trên máy chủ.");
        } finally {
            setAiAssistLoading(false);
        }
    };

    // Run custom rule compilation in simulator
    const handleRunRuleSimulation = async () => {
        if (!simulatorInput.trim() || isSimulating) return;
        setIsSimulating(true);
        setSimulatorOutput('Đang gửi ngữ cảnh luật lệ tới bộ giả lập AI Tawa...');

        try {
            // Build the system instructions simulating the active rules
            const activeRulesText = parsedRulesList
                .filter(r => !r.isDisabled)
                .map(r => `[LUẬT LỆ: ${r.title}] (Độ Cưỡng Chế: ${r.priority}) - ${r.content}`)
                .join('\n');

            const payload = {
                model: settings?.aiModel || "gemini-3.5-flash",
                contents: [
                    { role: 'user', parts: [{ text: simulatorInput }] }
                ],
                config: {
                    systemInstruction: `Bạn là mô hình kiểm thử RPG chính văn. Hãy trả lời câu hỏi của người chơi, đồng thời tuân thủ TUYỆT ĐỐI các luật lệ bối cảnh cưỡng chế sau đây:\n\n${activeRulesText || "Không có luật lệ nào."}`,
                    temperature: 0.7
                }
            };

            const response = await fetch('/api/ai/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Không có câu trả lời.';
                setSimulatorOutput(text);
            } else {
                const errorData = await response.json();
                setSimulatorOutput(`⚠️ Lỗi giả lập (Phản hồi từ API): ${errorData.error || 'Server error'}`);
            }
        } catch (error: any) {
            setSimulatorOutput(`⚠️ Thất bại kết nối giả lập: ${error.message}`);
        } finally {
            setIsSimulating(false);
        }
    };

    // Swap position arrow keys helper
    const handleMoveRuleArrow = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= dynamicRules.length) return;

        const list = [...dynamicRules];
        const temp = list[index];
        list[index] = list[targetIndex];
        list[targetIndex] = temp;
        recordHistory(list);

        if (selectedRuleIdx === index) {
            setSelectedRuleIdx(targetIndex);
        } else if (selectedRuleIdx === targetIndex) {
            setSelectedRuleIdx(index);
        }
    };

    // Import/Export presets JSON
    const handleImportJson = (mode: 'merge' | 'replace') => {
        setImportError('');
        setImportSuccess('');
        try {
            const parsed = JSON.parse(importExportText);
            if (Array.isArray(parsed)) {
                if (mode === 'replace') {
                    recordHistory(parsed);
                    setImportSuccess(`Đã thay thế toàn bộ thành công ${parsed.length} quy tắc vào kịch bản!`);
                } else {
                    const currentSet = new Set(dynamicRules);
                    const mergedList = [...dynamicRules];
                    let addedCount = 0;
                    parsed.forEach((rule: string) => {
                        if (!currentSet.has(rule)) {
                            mergedList.push(rule);
                            addedCount++;
                        }
                    });
                    recordHistory(mergedList);
                    setImportSuccess(`Đã gộp thành công ${addedCount} quy tắc mới vào kịch bản hiện hữu!`);
                }
                setTimeout(() => {
                    setShowImportExport(false);
                    setImportSuccess('');
                }, 1800);
            } else {
                setImportError('Định dạng JSON không hợp lệ. Phải là mảng dạng ["chuỗi luật", "chuỗi luật 2"]');
            }
        } catch (e: any) {
            setImportError('Cú pháp JSON lỗi: ' + e.message);
        }
    };

    // Export action
    const handleExportJson = () => {
        setImportError('');
        setImportSuccess('');
        const data = JSON.stringify(dynamicRules, null, 2);
        setImportExportText(data);
        navigator.clipboard.writeText(data).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    const handleStartEditing = (rule: ParsedRule) => {
        setEditingIndex(rule.index);
        setEditingTitle(rule.title);
        setEditingCategory(rule.category);
        setEditingPriority(rule.priority);
        setEditingCondition(rule.condition || '');
        setEditingContent(rule.content);
    };

    const handleSaveInlineEdit = (index: number) => {
        const parsed = parsedRulesList[index];
        if (!parsed) return;
        
        const serialized = serializeRule({
            isDisabled: parsed.isDisabled,
            category: editingCategory,
            priority: editingPriority,
            title: editingTitle.trim() || 'Không tên',
            content: editingContent.trim(),
            condition: editingCondition.trim(),
            tags: parsed.tags,
            scope: parsed.scope,
            expiryTurns: parsed.expiryTurns
        });
        
        const list = [...dynamicRules];
        list[index] = serialized;
        recordHistory(list);
        setEditingIndex(null);
    };

    const handleMoveRule = handleMoveRuleArrow;

    const handleAddRule = () => {
        if (!ruleContent.trim()) return;
        const parsedTags = ruleTagsStr.split(',').map(s => s.trim()).filter(Boolean);
        const serialized = serializeRule({
            isDisabled: false,
            category: ruleCategory,
            priority: rulePriority,
            title: ruleTitle.trim() || 'Không tên',
            content: ruleContent.trim(),
            condition: ruleCondition.trim(),
            tags: parsedTags,
            scope: ruleScope,
            expiryTurns: ruleExpiry > 0 ? ruleExpiry : undefined
        });

        const list = [...dynamicRules];
        list.push(serialized);
        recordHistory(list);
        handleOpenBlankCreation();
    };

    if (!activeWorld) return null;

    const wrapperClasses = isInline 
        ? "w-full h-full flex flex-col overflow-hidden text-stone-900 dark:text-slate-100" 
        : "flex flex-col overflow-hidden text-stone-900 dark:text-slate-100 w-full h-full bg-stone-200 dark:bg-mystic-950 rounded-xl";

    const content = (
        <div className={wrapperClasses}>
            {/* Header */}
            <div className={`border-b border-stone-450 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between items-stretch gap-2 bg-stone-300 dark:bg-mystic-900/80 shrink-0 ${isInline ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center gap-2.5">
                    <div className={`${isInline ? 'p-1.5' : 'p-2'} bg-mystic-accent/15 rounded-lg text-mystic-accent`}>
                        <Database size={isInline ? 16 : 24} />
                    </div>
                    <div className="text-left w-full">
                        <h2 className={`font-bold text-stone-850 dark:text-slate-100 flex items-center gap-1.5 ${isInline ? 'text-sm/tight' : 'text-lg'}`}>
                            {tabsToRender.length === 1 && tabsToRender[0] === 'rules'
                                ? 'Bản Đồ Luật Lệ Tối Cao'
                                : (isInline ? 'Điều phối Luật lệ & Ngữ cảnh' : 'Trung tâm Điều phối Luật lệ & Ngữ cảnh')}
                            {!isInline && <span className="text-xs font-black uppercase text-mystic-accent bg-mystic-accent/10 px-2 py-0.5 rounded border border-mystic-accent/20 animate-pulse">Advanced Edition</span>}
                        </h2>
                        {!isInline && (
                            <p className="text-xs text-stone-550 dark:text-slate-450 uppercase tracking-widest font-black">
                                {tabsToRender.length === 1 && tabsToRender[0] === 'rules'
                                    ? 'Cưỡng chế điều khiển, áp chế quy tắc và thiết chế tối thượng của Tawa'
                                    : 'Thiết chế cấu hình cưỡng chế tối ưu ngôn từ AI Tawa'}
                            </p>
                        )}
                        {isInline && <p className="text-xs text-stone-550 dark:text-slate-450 uppercase tracking-widest font-bold">Cưỡng chế tối ưu ngôn từ AI Tawa</p>}
                    </div>
                </div>

                <div className="flex justify-between items-center gap-2">
                    <div 
                        className={`flex bg-stone-400/30 dark:bg-slate-800/50 rounded-lg p-0.5 ${isInline ? 'w-full grid' : 'p-1'}`}
                        style={isInline ? { gridTemplateColumns: `repeat(${tabsToRender.length}, minmax(0, 1fr))` } : undefined}
                    >
                        {tabsToRender.includes('rules') && (
                            <button
                                onClick={() => setActiveContextTab('rules')}
                                className={`text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center justify-center gap-1 ${
                                    isInline ? 'py-1 text-xs' : 'px-4 py-1.5'
                                } ${
                                    activeContextTab === 'rules'
                                        ? 'bg-mystic-accent text-mystic-900 shadow-md font-black'
                                        : 'text-stone-655 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <ListChecks size={isInline ? 11 : 14} /> 
                                <span>Luật ({dynamicRules.length})</span>
                            </button>
                        )}
                        {tabsToRender.includes('config') && (
                            <button
                                onClick={() => setActiveContextTab('config')}
                                className={`text-xs font-bold uppercase tracking-wider rounded-md transition-all text-center ${
                                    isInline ? 'py-1 text-xs' : 'px-4 py-1.5'
                                } ${
                                    activeContextTab === 'config'
                                        ? 'bg-mystic-accent text-mystic-900 shadow-md font-black'
                                        : 'text-stone-655 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                                }`}
                            >
                                Ngữ Cảnh
                            </button>
                        )}
                        {tabsToRender.includes('debugger') && (
                            <button
                                onClick={() => setActiveContextTab('debugger')}
                                className={`text-xs font-bold uppercase tracking-wider rounded-md transition-all text-center flex items-center justify-center gap-1 ${
                                    isInline ? 'py-1 text-xs' : 'px-4 py-1.5'
                                } ${
                                    activeContextTab === 'debugger'
                                        ? 'bg-mystic-accent text-mystic-900 shadow-md font-black'
                                        : 'text-stone-655 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-200'
                                }`}
                            >
                                <Code size={isInline ? 11 : 14} />
                                <span>Debugger</span>
                            </button>
                        )}
                    </div>

                    {!isInline && (
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-red-500/20 text-stone-500 hover:text-red-500 rounded-full transition-all"
                        >
                            <X size={26} />
                        </button>
                    )}
                </div>
            </div>

            {/* Body Container */}
            <div className="flex-1 overflow-hidden flex flex-col bg-stone-100 dark:bg-mystic-950">

                {/* TAB 1: RULES MANAGER */}
                {activeContextTab === 'rules' && (
                    <div className={`flex-1 overflow-y-auto custom-scrollbar ${isInline ? 'p-3 space-y-4' : 'p-5 space-y-6'}`}>
                        
                        {/* Introduction Callout */}
                        {isInline ? (
                            <div className="p-2.5 bg-stone-200 dark:bg-slate-900/50 rounded-lg border border-stone-300 dark:border-slate-850 flex justify-between items-center w-full gap-2 text-left">
                                <div className="flex gap-2 items-start">
                                    <Sparkles size={14} className="text-mystic-accent shrink-0 mt-0.5 animate-pulse" />
                                    <p className="text-xs text-stone-605 dark:text-slate-450 leading-normal">
                                        Quy chế cưỡng chế tối thượng được nhúng cố định thẳng vào System Prompt cốt lõi.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => {
                                        setImportExportText(JSON.stringify(dynamicRules, null, 2));
                                        setShowImportExport(true);
                                    }}
                                    className="px-2 py-1 bg-stone-300 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap shrink-0"
                                >
                                    Nhập/Xuất
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 flex justify-between items-center max-w-7xl mx-auto w-full gap-4">
                                <div className="flex gap-3 items-start text-left">
                                    <Sparkles size={18} className="text-mystic-accent shrink-0 mt-0.5 animate-pulse" />
                                    <div>
                                        <h3 className="text-sm font-bold text-stone-850 dark:text-slate-200">Kiểm soát dòng văn bằng Luật lệ Tối thượng (Rules and Constraints Panel)</h3>
                                        <p className="text-xs text-stone-605 dark:text-slate-450 leading-relaxed mt-0.5">
                                            Thiết chế này cho phép ghim trực tiếp quy tắc tùy biến vào sâu gốc rễ System Prompt của LLM. AI Tawa buộc phải thi triển tuyệt đối mà không bị các chỉ thị thông thường bẻ hướng.
                                        </p>
                                    </div>
                                </div>
                                <div className="shrink-0 flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setImportExportText(JSON.stringify(dynamicRules, null, 2));
                                            setShowImportExport(true);
                                        }}
                                        className="px-3 py-1.5 bg-stone-300 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                                    >
                                        <FileUp size={13} /> Nhập / Xuất luật
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Create Form & Presets Split */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-7xl mx-auto w-full">
                            
                            {/* Creator Card (7 Cols) */}
                            <div className={`bg-stone-200 dark:bg-slate-900/40 rounded-xl border border-stone-300 dark:border-slate-800 flex flex-col justify-between ${isInline ? 'lg:col-span-12 p-3 gap-3' : 'lg:col-span-7 p-5'}`}>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h4 className="text-xs font-black text-mystic-accent uppercase tracking-wider flex items-center gap-1.5">
                                                        <Settings size={13} /> Thiết Lập Luật Mới
                                                    </h4>
                                                    <div className="flex bg-stone-300 dark:bg-slate-800/80 rounded px-1.5 py-0.5 text-[10px]">
                                                        <button 
                                                            onClick={() => setComposerMode('advanced')}
                                                            className={`px-2 py-0.5 font-bold rounded transition-all ${composerMode === 'advanced' ? 'bg-mystic-accent text-mystic-900' : 'text-stone-500 dark:text-slate-400'}`}
                                                        >
                                                            Biên Soạn Chi Tiết
                                                        </button>
                                                        <button 
                                                            onClick={() => setComposerMode('simple')}
                                                            className={`px-2 py-0.5 font-bold rounded transition-all ${composerMode === 'simple' ? 'bg-mystic-accent text-mystic-900' : 'text-stone-500 dark:text-slate-400'}`}
                                                        >
                                                            Soạn Nhanh
                                                        </button>
                                                    </div>
                                                </div>

                                                {composerMode === 'advanced' ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                            {/* Title field */}
                                                            <div className="md:col-span-6 space-y-1 text-left">
                                                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Tên quy chế (Ví dụ OOC)</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={ruleTitle}
                                                                    onChange={(e) => setRuleTitle(e.target.value)}
                                                                    placeholder="Mẹo: Đặt súc tích làm từ khóa..."
                                                                    className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-305 dark:border-slate-850 rounded-lg px-3 py-1.5 text-xs text-stone-850 dark:text-slate-100 outline-none focus:border-mystic-accent transition-all"
                                                                />
                                                            </div>
                                                            {/* Category dropdown */}
                                                            <div className="md:col-span-3 space-y-1 text-left">
                                                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Loại hành vi</label>
                                                                <select 
                                                                    value={ruleCategory}
                                                                    onChange={(e) => setRuleCategory(e.target.value)}
                                                                    className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-305 dark:border-slate-850 rounded-lg px-2 py-1.5 text-xs text-stone-850 dark:text-slate-100 outline-none focus:border-mystic-accent transition-all"
                                                                >
                                                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                                </select>
                                                            </div>
                                                            {/* Priority dropdown */}
                                                            <div className="md:col-span-3 space-y-1 text-left">
                                                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Độ ưu tiên</label>
                                                                <select 
                                                                    value={rulePriority}
                                                                    onChange={(e) => setRulePriority(e.target.value)}
                                                                    className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-305 dark:border-slate-850 rounded-lg px-2 py-1.5 text-xs text-stone-850 dark:text-slate-100 outline-none focus:border-mystic-accent transition-all"
                                                                >
                                                                    {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        {/* Instruction text-area */}
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                            <div className="md:col-span-8 space-y-1 text-left">
                                                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Mô tả chỉ thị chi tiết</label>
                                                                <textarea
                                                                    value={ruleContent}
                                                                    onChange={(e) => setRuleContent(e.target.value)}
                                                                    placeholder="Nội dung luật buộc AI phải tôn trọng (ví dụ: Không bao giờ mô tả thế nhân vật của tôi...)"
                                                                    className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-305 dark:border-slate-850 rounded-xl px-4 py-3 text-xs text-stone-850 dark:text-slate-100 outline-none focus:border-mystic-accent transition-all resize-none h-[110px]"
                                                                />
                                                            </div>
                                                            <div className="md:col-span-4 space-y-2 text-left flex flex-col justify-between">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-1">
                                                                        <span>⚡ Điều kiện kích hoạt</span>
                                                                        <span className="text-[8px] text-amber-500 font-normal">[Nâng cao]</span>
                                                                    </label>
                                                                    <input 
                                                                        type="text" 
                                                                        value={ruleCondition}
                                                                        onChange={(e) => setRuleCondition(e.target.value)}
                                                                        placeholder="Ví dụ: turn > 10, hour = 18..."
                                                                        className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-305 dark:border-slate-850 rounded-lg px-3 py-1.5 text-xs text-stone-850 dark:text-slate-100 outline-none focus:border-mystic-accent transition-all"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <span className="text-[9px] text-stone-500 uppercase font-black tracking-wider block">Gợi ý nhanh (Bấm để chọn):</span>
                                                                    <div className="flex flex-wrap gap-1">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => setRuleCondition('turn > 5')}
                                                                            className="text-[9px] px-1.5 py-0.5 bg-stone-350 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded font-mono transition-colors border border-stone-400 dark:border-slate-700/50"
                                                                        >
                                                                            Lượt &gt; 5
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => setRuleCondition('hour >= 18')}
                                                                            className="text-[9px] px-1.5 py-0.5 bg-stone-350 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded font-mono transition-colors border border-stone-400 dark:border-slate-700/50"
                                                                        >
                                                                            Ban đêm (&gt;=18h)
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => setRuleCondition('keyword: chiến đấu')}
                                                                            className="text-[9px] px-1.5 py-0.5 bg-stone-350 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded font-mono transition-colors border border-stone-400 dark:border-slate-700/50"
                                                                        >
                                                                            Thoại chứa "chiến đấu"
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => setRuleCondition('')}
                                                                            className="text-[9px] px-1.5 py-0.5 bg-red-500/10 text-red-500 hover:bg-red-550/25 rounded font-mono transition-colors border border-red-500/20"
                                                                        >
                                                                            Xóa
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1 text-left">
                                                        <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Nội dung dòng văn chỉ thị trực tiếp</label>
                                                        <textarea
                                                            value={ruleContent}
                                                            onChange={(e) => setRuleContent(e.target.value)}
                                                            placeholder="Viết một văn phạm nhanh (Hệ thống sẽ mặc định nhóm Cấu Trúc chung)..."
                                                            className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-305 dark:border-slate-850 rounded-xl px-4 py-3 text-xs text-stone-850 dark:text-slate-100 outline-none focus:border-mystic-accent transition-all resize-none h-[162px]"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-4 flex justify-end">
                                                <Button 
                                                    onClick={handleAddRule}
                                                    disabled={!ruleContent.trim()}
                                                    className="w-full md:w-auto px-6 py-2 bg-mystic-accent text-mystic-900 font-black uppercase text-xs tracking-wider hover:bg-sky-400 flex items-center justify-center gap-1.5 rounded-lg shrink-0"
                                                >
                                                    <Plus size={15} /> Thêm Quy Tắc Vào Danh Sách
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Presets Sidebar (5 Cols) */}
                                        <div className={`bg-stone-200 dark:bg-slate-900/10 rounded-xl border border-stone-300 dark:border-slate-800 space-y-3 flex flex-col justify-start ${isInline ? 'lg:col-span-12 p-3' : 'lg:col-span-5 p-5'}`}>
                                            <h4 className="text-xs font-black text-stone-500 uppercase tracking-wider flex items-center gap-1.5 text-left">
                                                <Zap size={13} className="text-amber-500" /> Bản Mẫu Gợi Ý (Quick Presets)
                                            </h4>
                                            <p className="text-[10px] text-stone-500 text-left leading-normal">
                                                Nhấp vào để tải một quy chuẩn tiêu biểu vào Trình Biên Soạn, tha hồ hiệu chỉnh trước khi đưa vào hàng đợi:
                                            </p>

                                            <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar-slim pr-1">
                                                {PRESET_RULE_TEMPLATES.map((preset, idx) => {
                                                    const isLoadedInEditor = ruleContent === preset.content;
                                                    return (
                                                        <div 
                                                            key={idx}
                                                            onClick={() => handleSelectPreset(preset)}
                                                            className={`p-3 rounded-lg border text-left transition-all cursor-pointer hover:shadow-sm flex justify-between items-start gap-1 ${
                                                                isLoadedInEditor 
                                                                    ? 'bg-mystic-accent/15 border-mystic-accent'
                                                                    : 'bg-stone-50 dark:bg-slate-900/60 border-stone-300 dark:border-slate-850 hover:border-stone-400 dark:hover:border-slate-800'
                                                            }`}
                                                        >
                                                            <div className="flex-1 space-y-0.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[9px] font-black uppercase bg-stone-200 dark:bg-slate-800 text-stone-600 dark:text-slate-400 px-1 py-0.2 rounded font-mono">
                                                                        {preset.category}
                                                                    </span>
                                                                    <span className="font-bold text-xs text-stone-850 dark:text-slate-200 truncate max-w-[150px]">
                                                                        {preset.title}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-stone-550 dark:text-slate-500 line-clamp-1">
                                                                    {preset.desc}
                                                                </p>
                                                            </div>
                                                            <span className="text-[9px] font-black tracking-wider text-mystic-accent shrink-0 uppercase">
                                                                + Nạp chỉnh
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Filters & Actual Rules Queue */}
                                    <div className="max-w-7xl mx-auto w-full space-y-4">
                                        
                                        {/* Filter Sub-header */}
                                        <div className="flex flex-col md:flex-row gap-3 justify-between items-center border-b border-stone-350 dark:border-slate-800 pb-3">
                                            <div className="text-left">
                                                <h4 className="text-xs font-black text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                                                    Danh Sách Quy Chế Vận Hành ({filteredRules.length} / {dynamicRules.length})
                                                </h4>
                                                <p className="text-[10px] text-stone-500 mt-0.5">Bạn có thể thứ tự kéo ưu tiên, bật tắt nhanh chóng, hoặc tinh chỉnh văn phong bất cứ lúc nào</p>
                                            </div>

                                            {/* Search and filters UI */}
                                            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                                                {/* Search */}
                                                <div className="relative flex-1 md:flex-initial">
                                                    <Search size={14} className="absolute left-3 top-2.5 text-stone-450 dark:text-slate-500" />
                                                    <input 
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        placeholder="Lọc nội dung luật..."
                                                        className="w-full md:w-48 bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-stone-850 dark:text-slate-100 placeholder-stone-450 focus:outline-none focus:border-mystic-accent"
                                                    />
                                                </div>

                                                {/* Category Filter */}
                                                <select 
                                                    value={selectedFilterCategory}
                                                    onChange={(e) => setSelectedFilterCategory(e.target.value)}
                                                    className="bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-850 dark:text-slate-200 outline-none"
                                                >
                                                    <option value="ALL">Mọi nhóm</option>
                                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                </select>

                                                {/* Status Filter */}
                                                <select 
                                                    value={selectedFilterStatus}
                                                    onChange={(e) => setSelectedFilterStatus(e.target.value as any)}
                                                    className="bg-stone-50 dark:bg-slate-900 border border-stone-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-850 dark:text-slate-200 outline-none"
                                                >
                                                    <option value="ALL">Mọi trạng thái</option>
                                                    <option value="ACTIVE">Kích hoạt</option>
                                                    <option value="DISABLED">Đang tắt</option>
                                                </select>

                                                {dynamicRules.length > 0 && (
                                                    <button 
                                                        onClick={() => {
                                                            if (setDynamicRules) setDynamicRules([]);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/25 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-none flex items-center gap-1 shrink-0"
                                                    >
                                                        <Trash2 size={12} /> Xóa hết 
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Rules Cards Render */}
                                        {filteredRules.length === 0 ? (
                                            <div className="p-12 border-2 border-dashed border-stone-300 dark:border-slate-800 rounded-xl text-center space-y-2 bg-stone-200/50 dark:bg-slate-900/10 max-w-7xl mx-auto w-full">
                                                <AlertTriangle size={36} className="mx-auto text-stone-400 dark:text-slate-600" />
                                                <p className="text-xs font-bold text-stone-500 dark:text-slate-400">
                                                    Không tìm thấy điều luật vận hành nào phù hợp.
                                                </p>
                                                <p className="text-xs text-stone-400 dark:text-slate-600 max-w-sm mx-auto">
                                                    Hãy thử xóa bộ lọc tìm kiếm hoặc kích hoạt bản phối mẫu khuyên dùng ở trình bảng phía bên trên.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3 max-w-7xl mx-auto w-full">
                                                {filteredRules.map((parsedRule) => {
                                                    const isEditing = editingIndex === parsedRule.index;
                                                    const isSomeoneElseEditing = editingIndex !== null && !isEditing;
                                                    const catStyle = CATEGORY_STYLES[parsedRule.category] || CATEGORY_STYLES['⚙️ Khác'];
                                                    const prioStyle = PRIORITY_STYLES[parsedRule.priority] || PRIORITY_STYLES['🟡 LINH HOẠT'];
                                                    
                                                    // Real-time evaluation
                                                    const hasCond = parsedRule.condition && parsedRule.condition.trim() !== '';
                                                    const condEval = hasCond ? evaluateRuleConditionClient(parsedRule.condition) : { active: true, label: 'Luôn áp dụng' };

                                                    return (
                                                        <div 
                                                            key={parsedRule.index}
                                                            className={`border rounded-xl p-4 flex gap-4 transition-all duration-250 relative group text-left ${
                                                                isEditing
                                                                    ? 'bg-amber-500/5 dark:bg-amber-500/5 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.25)] scale-[1.015] z-10'
                                                                    : isSomeoneElseEditing
                                                                        ? 'opacity-30 border-stone-300 dark:border-slate-850 bg-stone-100/50 dark:bg-slate-900/10 select-none pointer-events-none'
                                                                        : parsedRule.isDisabled 
                                                                            ? 'opacity-60 border-stone-350 dark:border-slate-850 bg-stone-250/50 dark:bg-slate-950/20' 
                                                                            : 'bg-stone-200 dark:bg-slate-900 border-stone-300 dark:border-slate-800 hover:border-mystic-accent/30 shadow-sm'
                                                            }`}
                                                        >
                                                            {/* Side Priority controllers */}
                                                            <div className="flex flex-col items-center justify-between shrink-0 text-stone-400 border-r border-stone-300 dark:border-slate-800 pr-3 select-none">
                                                                <span className="text-xs font-black font-mono text-mystic-accent bg-mystic-accent/5 px-2 py-0.5 rounded border border-mystic-accent/10">
                                                                    #{parsedRule.index + 1}
                                                                </span>
                                                                <div className="flex flex-col gap-1.5 py-3">
                                                                    <button 
                                                                        disabled={parsedRule.index === 0}
                                                                        onClick={() => handleMoveRule(parsedRule.index, 'up')}
                                                                        className="p-1 text-stone-500 hover:text-mystic-accent disabled:opacity-20 rounded hover:bg-stone-300 dark:hover:bg-slate-800 transition-colors"
                                                                        title="Đưa lên trên đầu"
                                                                    >
                                                                        <ArrowUp size={13} />
                                                                    </button>
                                                                    <button 
                                                                        disabled={parsedRule.index === dynamicRules.length - 1}
                                                                        onClick={() => handleMoveRule(parsedRule.index, 'down')}
                                                                        className="p-1 text-stone-500 hover:text-mystic-accent disabled:opacity-20 rounded hover:bg-stone-300 dark:hover:bg-slate-800 transition-colors"
                                                                        title="Hạ xuống phía dưới"
                                                                    >
                                                                        <ArrowDown size={13} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Current Edit state indicator header */}
                                                            {isEditing && (
                                                                <div className="absolute top-3 right-4 flex items-center gap-1 bg-amber-500 text-stone-950 font-black text-xs uppercase tracking-widest px-2.5 py-0.5 rounded-full animate-pulse shadow-sm">
                                                                    ⚠️ ĐANG HIỆU CHỈNH (CHƯA LƯU)
                                                                </div>
                                                            )}

                                                            {/* Main Content Pane */}
                                                            <div className="flex-1 min-w-0">
                                                                {isEditing ? (
                                                                    <div className="space-y-3 pt-2">
                                                                        {/* Edit form */}
                                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                                                            <input 
                                                                                type="text"
                                                                                value={editingTitle}
                                                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                                                placeholder="Tên luật hệ..."
                                                                                className="md:col-span-4 bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-stone-850 dark:text-slate-100 focus:outline-none focus:border-mystic-accent"
                                                                            />
                                                                            <select 
                                                                                value={editingCategory}
                                                                                onChange={(e) => setEditingCategory(e.target.value)}
                                                                                className="md:col-span-3 bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-stone-850 dark:text-slate-100"
                                                                            >
                                                                                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                                            </select>
                                                                            <select 
                                                                                value={editingPriority}
                                                                                onChange={(e) => setEditingPriority(e.target.value)}
                                                                                className="md:col-span-2 bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-800 rounded px-2.5 py-1 text-xs text-stone-850 dark:text-slate-100"
                                                                            >
                                                                                {PRIORITIES.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                                                                            </select>
                                                                            <div className="md:col-span-3 space-y-1">
                                                                                <input 
                                                                                    type="text"
                                                                                    value={editingCondition}
                                                                                    onChange={(e) => setEditingCondition(e.target.value)}
                                                                                    placeholder="ĐK kích hoạt (ví dụ: turn > 5)"
                                                                                    className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-850 rounded px-2 py-1 text-xs text-stone-850 dark:text-slate-100 focus:outline-none focus:border-mystic-accent font-mono"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <textarea
                                                                            value={editingContent}
                                                                            onChange={(e) => setEditingContent(e.target.value)}
                                                                            className="w-full bg-stone-50 dark:bg-slate-950 border border-stone-300 dark:border-slate-850 rounded-lg p-3 text-xs text-stone-850 dark:text-slate-100 focus:outline-none focus:border-mystic-accent resize-none h-[80px]"
                                                                            rows={3}
                                                                        />
                                                                        <div className="flex justify-between items-center text-xs">
                                                                            <div className="text-xs text-stone-500 font-bold uppercase tracking-wider">
                                                                                Bấm "Hủy" hoặc "Lưu" để đóng phiên biên tập
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <button 
                                                                                    onClick={() => setEditingIndex(null)}
                                                                                    className="px-3 py-1 bg-stone-300 dark:bg-slate-800 hover:bg-stone-400 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-300 rounded font-bold transition-all"
                                                                                >
                                                                                    Hủy
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => handleSaveInlineEdit(parsedRule.index)}
                                                                                    className="px-4 py-1 bg-mystic-accent hover:bg-sky-400 text-mystic-900 rounded font-black flex items-center gap-1.5 transition-all shadow-sm"
                                                                                >
                                                                                    <Save size={12} /> Lưu 
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-2">
                                                                        {/* Display Meta Tags */}
                                                                        <div className="flex flex-wrap gap-2 items-center">
                                                                            <span className={`text-xs font-black px-2 py-0.5 rounded border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                                                                                {parsedRule.category}
                                                                            </span>
                                                                            <span className={`text-xs font-black px-2 py-0.5 rounded border inline-flex items-center gap-1.5 ${prioStyle.badge}`}>
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${prioStyle.dot} shrink-0`} />
                                                                                {parsedRule.priority}
                                                                            </span>
                                                                            
                                                                            {/* Real-time trigger state tag display */}
                                                                            {hasCond ? (
                                                                                condEval.active ? (
                                                                                    <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1">
                                                                                        <span>⚡ KÍCH HOẠT</span>
                                                                                        <span className="font-mono text-[10px] opacity-80">({condEval.label})</span>
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-xs font-black px-2 py-0.5 rounded bg-stone-300/40 dark:bg-slate-800 text-stone-500 dark:text-slate-450 border border-stone-350 dark:border-slate-800 inline-flex items-center gap-1">
                                                                                        <span>⏳ CHỜ ĐIỀU KIỆN</span>
                                                                                        <span className="font-mono text-[10px] opacity-80">({condEval.label})</span>
                                                                                    </span>
                                                                                )
                                                                            ) : (
                                                                                <span className="text-xs font-black px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 border border-sky-500/15">
                                                                                    🔥 LUÔN THI HÀNH
                                                                                </span>
                                                                            )}

                                                                            <span className="font-bold text-sm text-stone-850 dark:text-slate-200">
                                                                                {parsedRule.title}
                                                                            </span>
                                                                            {parsedRule.isDisabled && (
                                                                                <span className="text-xs font-black uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                                                                    ⚠️ Đang vô hiệu hóa
                                                                                </span>
                                                                            )}
                                                                        </div>
 
                                                                        {/* Text representation */}
                                                                        <p className="text-xs text-stone-650 dark:text-slate-300 leading-relaxed font-normal whitespace-pre-wrap pl-0.5">
                                                                            {parsedRule.content}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
 
                                                            {/* Controls sidebar */}
                                                            {!isEditing && (
                                                                <div className="flex items-center gap-2 border-l border-stone-300 dark:border-slate-800 pl-3 shrink-0">
                                                                    {/* Toggle active switch */}
                                                                    <button 
                                                                        onClick={() => handleToggleRuleActive(parsedRule.index)}
                                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${!parsedRule.isDisabled ? 'bg-mystic-accent' : 'bg-stone-350 dark:bg-slate-850'}`}
                                                                        title={parsedRule.isDisabled ? "Bật định hạn quy tắc" : "Tạm tắt quy tắc"}
                                                                    >
                                                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${!parsedRule.isDisabled ? 'translate-x-[18px]' : 'translate-x-1'}`} />
                                                                    </button>
 
                                                                    {/* Edit inline pen */}
                                                                    <button 
                                                                        onClick={() => handleStartEditing(parsedRule)}
                                                                        className="text-stone-500 hover:text-mystic-accent p-1.5 rounded-lg hover:bg-stone-300 dark:hover:bg-slate-800 transition-colors"
                                                                        title="Chỉnh sửa chi tiết"
                                                                    >
                                                                        <Edit2 size={13} />
                                                                    </button>
 
                                                                    {/* Trash */}
                                                                    <button 
                                                                        onClick={() => handleRemoveRule(parsedRule.index)}
                                                                        className="text-stone-505 hover:text-red-500 p-1.5 rounded-lg hover:bg-stone-300 dark:hover:bg-slate-800 transition-colors"
                                                                        title="Xóa quy chế này"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: IN-DEPTH CONTEXT COMPONENT (RAG TOGGLES) */}
                            {activeContextTab === 'config' && (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Left Column: Toggles */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black text-mystic-accent uppercase tracking-[0.2em] border-b border-mystic-accent/30 pb-2 text-left">Thành phần Ngữ cảnh</h3>
                                        
                                        <div className="space-y-3">
                                            {[
                                                { key: 'playerProfile', label: 'Hồ sơ nhân vật', desc: 'Thông tin chi tiết về nhân vật của bạn' },
                                                { key: 'worldInfo', label: 'Thông tin thế giới', desc: 'Bối cảnh, thể loại và cốt truyện chung' },
                                                { key: 'longTermMemory', label: 'Trí nhớ dài hạn (Summary)', desc: 'Bản tóm tắt các sự kiện đã qua' },
                                                { key: 'relevantMemories', label: 'Ký ức liên quan (RAG)', desc: 'Các đoạn hội thoại cũ được tìm thấy qua Vector Search' },
                                                { key: 'storyBible', label: 'Encyclopedia Encyclopedia', desc: 'Dữ kiện sự thật được hệ thống tự trích xuất linh hoạt' },
                                                { key: 'entities', label: 'Thực thể (NPCs/Items)', desc: 'Thông tin về các nhân vật và vật phẩm trong thế giới' },
                                                { key: 'npcRegistry', label: 'Danh sách tổng NPC (Registry)', desc: 'Danh sách rút gọn tất cả NPC để AI tham chiếu ID' },
                                                { key: 'timeSystem', label: 'Hệ thống thời gian', desc: 'Ngày, tháng, năm và lượt chơi hiện tại' },
                                                { key: 'reinforcement', label: 'Chỉ thị củng cố (Reinforcement)', desc: 'Các lệnh ép AI duy trì chất lượng văn phong' },
                                            ].map((item) => (
                                                <div key={item.key} className="flex items-center justify-between p-4 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 hover:border-mystic-accent/50 transition-all group text-left">
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">{item.label}</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">{item.desc}</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => toggleContextItem(item.key as keyof ContextWindowConfig['items'])}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${config.items[item.key as keyof typeof config.items] ? 'bg-mystic-accent' : 'bg-stone-400 dark:bg-slate-700'}`}
                                                    >
                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.items[item.key as keyof typeof config.items] ? 'translate-x-6' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Column: Numeric Limits */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black text-mystic-accent uppercase tracking-[0.2em] border-b border-mystic-accent/30 pb-2 text-left">Giới hạn Số lượng</h3>
                                        
                                        <div className="space-y-6">
                                            {/* Max Entities */}
                                            <div className="p-5 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 text-left">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">Số lượng Thực thể tối đa (NPCs)</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">Giới hạn số lượng NPC/Vật phẩm gửi cho AI mỗi lượt</p>
                                                    </div>
                                                    <div className="text-2xl font-black text-mystic-accent">{config.maxEntities}</div>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min="1" 
                                                    max="50" 
                                                    value={config.maxEntities} 
                                                    onChange={(e) => updateContextMaxEntities(parseInt(e.target.value))}
                                                    className="w-full h-2 bg-stone-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-mystic-accent"
                                                />
                                                <div className="flex justify-between text-xs text-stone-500 mt-2 font-bold select-none">
                                                    <span>1 NPC</span>
                                                    <span>50 NPCs</span>
                                                </div>
                                            </div>

                                            {/* Recent History Count */}
                                            <div className="p-5 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 text-left">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">Lịch sử gần đây (Recent History)</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">Số lượng tin nhắn gần nhất AI sẽ đọc trực tiếp</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="number" 
                                                            min="1" 
                                                            max="500" 
                                                            value={config.recentHistoryCount} 
                                                            onChange={(e) => updateContextHistoryCount(parseInt(e.target.value) || 1)}
                                                            className="w-16 bg-stone-305 dark:bg-slate-850 border border-stone-400 dark:border-slate-700 rounded px-2 py-1 text-center font-black text-mystic-accent outline-none focus:border-mystic-accent"
                                                        />
                                                        <span className="text-xs font-bold text-stone-550 dark:text-slate-400">câu</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs italic text-amber-600 dark:text-amber-500/70 bg-amber-500/5 p-2 rounded border border-amber-500/20">
                                                    * Số lượng càng cao AI càng nhớ tốt mạch diễn biến tức thời vừa xảy ra, tuy nhiên sẽ tăng độ trễ tiêu tốn Token bối cảnh.
                                                </p>
                                            </div>

                                            {/* Max Context Tokens */}
                                            <div className="p-5 bg-stone-200 dark:bg-slate-900/50 rounded-xl border border-stone-300 dark:border-slate-800 text-left">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-stone-800 dark:text-slate-200">Giới hạn Tokens ngữ cảnh (Max Context)</h4>
                                                        <p className="text-xs text-stone-500 dark:text-slate-500 mt-0.5">Tổng số lượng Token tối đa cho toàn bộ bối cảnh gửi đi</p>
                                                    </div>
                                                    <div className="text-[18px] font-black text-mystic-accent">{(config.maxContextTokens || 60000).toLocaleString()}</div>
                                                </div>
                                                <input 
                                                    type="range" 
                                                    min={4000} 
                                                    max={128000} 
                                                    step={2000}
                                                    value={config.maxContextTokens || 60000} 
                                                    onChange={(e) => updateContextMaxTokens(parseInt(e.target.value))}
                                                    className="w-full h-2 bg-stone-300 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-mystic-accent"
                                                />
                                                <div className="flex justify-between text-xs text-stone-550 mt-2 font-bold select-none">
                                                    <span>4k Tokens</span>
                                                    <span>128k Tokens (Thượng tầng Gemini)</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: TRÌNH DEBUGGER ĐIỀU TRA SÁT HẠCH */}
                            {activeContextTab === 'debugger' && (
                                <div className="flex-1 h-full p-2 overflow-hidden flex flex-col">
                                    <ContextDebuggerView 
                                        worldData={activeWorld}
                                        settings={settings}
                                        history={history}
                                        turnCount={turnCount}
                                        presetConfig={tawaPresetConfig}
                                        gameTime={gameTime}
                                        lastUserMessage={lastAction}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Footer area */}
                        {!isInline && (
                            <div className="p-4 border-t border-stone-440 dark:border-slate-800/80 bg-stone-300 dark:bg-mystic-900/80 flex justify-center gap-3 shrink-0 select-none">
                                <Button 
                                    onClick={onClose}
                                    className="px-14 py-2.5 bg-mystic-accent text-mystic-900 font-extrabold uppercase tracking-wider hover:bg-sky-400 shadow-md transition-all rounded-lg"
                                >
                                    Lưu & Áp Dụng Hệ Thống
                                </Button>
                            </div>
                        )}
        </div>
    );

    if (isInline) {
        return (
            <div className="w-full h-full relative select-none flex flex-col overflow-hidden">
                {content}
                
                {/* NESTED IMPORT/EXPORT DRAWER MODAL (IFRAME SAFE) */}
                {showImportExport && (
                    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
                        <div className="bg-stone-250 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 w-full max-w-xl rounded-xl shadow-2xl p-5 space-y-4">
                            <div className="flex justify-between items-center pb-2 border-b border-stone-300 dark:border-slate-800">
                                <div className="flex items-center gap-2 text-mystic-accent">
                                    <FileDown size={18} />
                                    <h3 className="font-bold text-sm text-stone-855 dark:text-slate-100">Giao dịch dữ liệu Luật lệ (Import / Export JSON)</h3>
                                </div>
                                <button 
                                    onClick={() => {
                                        setShowImportExport(false);
                                        setImportError('');
                                        setImportSuccess('');
                                    }}
                                    className="p-1 hover:bg-stone-300 dark:hover:bg-slate-800 rounded"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <p className="text-[11px] text-stone-550 dark:text-slate-400 text-left leading-relaxed">
                                Mã hóa luật gửi theo cấu trúc array của tệp tin. Bạn có thể chép mã này đi phân phối sang thế giới khác hoặc dán mã quy chế của người khác vào đây để tích hợp nhanh chóng.
                            </p>

                            <div className="space-y-1 text-left">
                                <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Khối mã JSON</label>
                                <textarea 
                                    value={importExportText}
                                    onChange={(e) => setImportExportText(e.target.value)}
                                    placeholder="Dán mảng JSON chứa các mẫu luật tại đây..."
                                    className="w-full h-44 bg-stone-50 dark:bg-slate-950 border border-stone-350 dark:border-slate-800 rounded-lg p-3 text-xs font-mono text-stone-850 dark:text-slate-300 focus:outline-none focus:border-mystic-accent resize-none h-48"
                                />
                            </div>

                            {/* Import/Export Status Feedback Banners */}
                            {importError && (
                                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                    <AlertTriangle size={14} /> {importError}
                                </div>
                            )}
                            {importSuccess && (
                                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                    <CheckCircle2 size={14} /> {importSuccess}
                                </div>
                            )}

                            <div className="flex gap-2 justify-end text-xs">
                                <button 
                                    onClick={handleExportJson}
                                    className="px-4 py-2 bg-stone-300 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded font-bold transition-all flex items-center gap-1.5"
                                >
                                    {isCopied ? <Check size={14} /> : <Clipboard size={14} />}
                                    {isCopied ? "Đã sao chép!" : "Sao chép mã xuất"}
                                </button>
                                <button 
                                    onClick={handleImportJson}
                                    className="px-5 py-2 bg-sky-500 text-white hover:bg-sky-400 rounded font-black transition-all flex items-center gap-1.5"
                                >
                                    <FileDown size={14} /> Đọc & Nhập luật
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <AnimatePresence>
            {show && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-4 pointer-events-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.23, ease: 'easeOut' }}
                        className="relative bg-stone-200 dark:bg-mystic-950 border border-stone-400 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-presence w-[98vw] max-w-[1400px] h-[95vh] md:h-[99vh]"
                    >
                        {content}
                    </motion.div>
                </div>
            )}

            {/* NESTED IMPORT/EXPORT DRAWER MODAL (IFRAME SAFE) */}
            {showImportExport && (
                <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
                    <div 
                        className="bg-stone-250 dark:bg-mystic-900 border border-stone-400 dark:border-slate-800 rounded-xl shadow-2xl p-5 space-y-4 w-[92vw] max-w-lg max-h-[85vh] overflow-y-auto"
                    >
                        <div className="flex justify-between items-center pb-2 border-b border-stone-300 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-mystic-accent">
                                <FileDown size={18} />
                                <h3 className="font-bold text-sm text-stone-855 dark:text-slate-100">Giao dịch dữ liệu Luật lệ (Import / Export JSON)</h3>
                            </div>
                            <button 
                                onClick={() => {
                                    setShowImportExport(false);
                                    setImportError('');
                                    setImportSuccess('');
                                }}
                                className="p-1 hover:bg-stone-300 dark:hover:bg-slate-800 rounded"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-[11px] text-stone-550 dark:text-slate-400 text-left leading-relaxed">
                            Mã hóa luật gửi theo cấu trúc array của tệp tin. Bạn có thể chép mã này đi phân phối sang thế giới khác hoặc dán mã quy chế của người khác vào đây để tích hợp nhanh chóng.
                        </p>

                        <div className="space-y-1 text-left">
                            <label className="text-[10px] font-black text-stone-500 uppercase tracking-wider">Khối mã JSON</label>
                            <textarea 
                                value={importExportText}
                                onChange={(e) => setImportExportText(e.target.value)}
                                placeholder="Dán mảng JSON chứa các mẫu luật tại đây..."
                                className="w-full h-44 bg-stone-50 dark:bg-slate-950 border border-stone-350 dark:border-slate-800 rounded-lg p-3 text-xs font-mono text-stone-850 dark:text-slate-300 focus:outline-none focus:border-mystic-accent resize-none h-48"
                            />
                        </div>

                        {/* Import/Export Status Feedback Banners */}
                        {importError && (
                            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                <AlertTriangle size={14} /> {importError}
                            </div>
                        )}
                        {importSuccess && (
                            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-500 text-xs font-semibold text-left flex gap-1.5 items-center">
                                <CheckCircle2 size={14} /> {importSuccess}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end text-xs">
                            <button 
                                onClick={handleExportJson}
                                className="px-4 py-2 bg-stone-300 dark:bg-slate-800 hover:bg-mystic-accent hover:text-mystic-900 rounded font-bold transition-all flex items-center gap-1.5"
                            >
                                {isCopied ? <Check size={14} /> : <Clipboard size={14} />}
                                {isCopied ? "Đã sao chép!" : "Sao chép mã xuất"}
                            </button>
                            <button 
                                onClick={handleImportJson}
                                className="px-5 py-2 bg-sky-500 text-white hover:bg-sky-400 rounded font-black transition-all flex items-center gap-1.5"
                            >
                                <FileDown size={14} /> Đọc & Nhập luật
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ContextWindowModal;
