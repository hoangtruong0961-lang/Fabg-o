
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, Plus, Trash2, Edit2, Wand2, Play, 
  User, Compass, ScrollText, Users, Upload, Download, Clock,
  Eye, EyeOff, SlidersHorizontal, Globe2, Database,
  BookOpen, Search, ToggleLeft, ToggleRight, X
} from 'lucide-react';
import { NavigationProps, GameState, WorldData, AppSettings, PlayerProfile, WorldSettingConfig } from '../../../types';
import Button from '../../ui/Button';
import MarkdownRenderer from '../../common/MarkdownRenderer';
import { useWorldCreationStore } from '../../../store/worldCreationStore';
import EntityForm from './EntityForm';
import { CharacterSheetEditor } from './CharacterSheetEditor';
import { worldAiService } from '../../../services/ai/world-creation/service';
import { dbService } from '../../../services/db/indexedDB';
import { OUTPUT_LENGTHS, DIFFICULTY_LEVELS } from '../../../constants/promptTemplates';
import { Lorebook, LorebookEntry } from '../../../services/ai/lorebook/types';

const TABS = [
  { id: 0, label: "Nhân vật chính", icon: User },
  { id: 1, label: "Khởi hành thế giới", icon: Compass },
  { id: 4, label: "Nền tảng vĩ mô (Lớp 1)", icon: Globe2 },
  { id: 5, label: "Cấu trúc vùng miền (Lớp 2)", icon: Database },
  { id: 6, label: "Hồ sơ World Bible", icon: BookOpen },
  { id: 3, label: "Bách khoa toàn thư", icon: Users },
];

interface WorldCreationProps extends NavigationProps {
  initialData?: WorldData | null;
}

const WorldCreationScreen: React.FC<WorldCreationProps> = ({ onNavigate, onGameStart, initialData }) => {
  const store = useWorldCreationStore();
  
  // Destructure state from store for convenience
  const state = {
    currentTab: store.currentTab,
    player: store.player,
    world: store.world,
    config: store.config,
    entities: Array.isArray(store.entities) ? store.entities : [],
    gameTime: store.gameTime,
    lorebook: store.lorebook,
    isGenerating: store.isGenerating,
    generatingField: store.generatingField
  };

  const [showEntityForm, setShowEntityForm] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [conceptInput, setConceptInput] = useState('');
  const [aiModel, setAiModel] = useState<string>('gemini-3.1-pro-preview');
  const [worldSubTab, setWorldSubTab] = useState<'info' | 'foundation' | 'regional' | 'compiled'>('info');

  const [loreSearchTerm, setLoreSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  const [knowledgeFileName, setKnowledgeFileName] = useState<string | null>(null);
  const [knowledgeFileSize, setKnowledgeFileSize] = useState<string | null>(null);
  const [knowledgeContent, setKnowledgeContent] = useState<string | null>(null);
  const [isGeneratingFromKnowledge, setIsGeneratingFromKnowledge] = useState<boolean>(false);

  // --- Dynamic World Bible Compiler ---
  // Periodically combines the world building sub-fields into a pristine context document
  useEffect(() => {
    const w = state.world;
    const parts: string[] = [];
    
    if (w.worldName) {
        parts.push(`# ${w.worldName.toUpperCase()}`);
        if (w.genre) {
            parts.push(`*Thể loại: ${w.genre}*\n`);
        }
    }
    
    if (w.corePremise) parts.push(`## 📌 GIẢ THUYẾT CỐT LÕI (CORE PREMISE)\n${w.corePremise}`);
    if (w.cosmology) parts.push(`## 🔮 VŨ TRỤ HỌC & ĐỊA GIỚI (COSMOLOGY)\n${w.cosmology}`);
    if (w.timeline) parts.push(`## ⏳ DÒNG THỜI GIAN & LỊCH SỬ (TIMELINE)\n${w.timeline}`);
    if (w.geography) parts.push(`## 🗺️ ĐỊA LÝ & KHÍ HẬU (GEOGRAPHY & CLIMATE)\n${w.geography}`);
    if (w.factionsPower) parts.push(`## 🛡️ PHE PHÁI & CƠ CẤU QUYỀN LỰC (FACTIONS & POWER)\n${w.factionsPower}`);
    if (w.economyResources) parts.push(`## 🪙 KINH TẾ & TÀI NGUYÊN (ECONOMY & RESOURCES)\n${w.economyResources}`);
    if (w.culturalIdentity) parts.push(`## 🎭 BẢN SẮC VĂN HÓA & NGHI LỄ (CULTURE & TABOOS)\n${w.culturalIdentity}`);
    if (w.adventureHooks) parts.push(`## 🪝 MÓC PHIÊU LƯU (ADVENTURE HOOKS)\n${w.adventureHooks}`);
    
    const compiled = parts.join('\n\n');
    
    // Safety check to keep manual context edit if it satisfies some rules or prevent endless loops
    if (compiled && compiled !== state.world.context) {
        store.updateWorld('context', compiled);
    }
  }, [
    state.world.worldName,
    state.world.genre,
    state.world.corePremise,
    state.world.cosmology,
    state.world.timeline,
    state.world.geography,
    state.world.factionsPower,
    state.world.economyResources,
    state.world.culturalIdentity,
    state.world.adventureHooks
  ]);

  // --- Bidirectional Entity & Encyclopedia (Lorebook) Synchronizer ---
  useEffect(() => {
    const currentEntities = state.entities || [];
    const currentLorebook = state.lorebook || { entries: {} };
    const currentEntries = currentLorebook.entries || {};

    let entitiesChanged = false;
    let lorebookChanged = false;

    const nextEntities = [...currentEntities];
    const nextEntries = { ...currentEntries };

    // 1. Sync Entities -> Lorebook Entries
    currentEntities.forEach((entity) => {
      const entryId = entity.id;
      const existingEntry = currentEntries[entryId];

      const content = entity.type === 'NPC'
        ? `Họ Tên: ${entity.name}\nTuổi: ${entity.age || 'Chưa rõ'}\nGiới tính: ${entity.gender || 'Chưa rõ'}\nTính cách: ${entity.personality || 'Chưa rõ'}\nNgoại hình: ${entity.appearance || 'Chưa rõ'}\nTiểu sử: ${entity.description || entity.background || 'Chưa rõ'}`
        : entity.description;

      const expectedComment = `[Entity:${entity.type}] ${entity.name}`;
      const expectedKeys = [entity.name];

      if (!existingEntry) {
        nextEntries[entryId] = {
          uid: entryId,
          key: expectedKeys,
          content: content,
          comment: expectedComment,
          constant: false,
          disable: false,
          order: entity.type === 'NPC' ? 50 : 100,
        };
        lorebookChanged = true;
      } else {
        const hasKeyDiff = JSON.stringify(existingEntry.key) !== JSON.stringify(expectedKeys);
        const hasCommentDiff = existingEntry.comment !== expectedComment;
        const hasContentDiff = existingEntry.content !== content;

        if (hasKeyDiff || hasCommentDiff || hasContentDiff) {
          nextEntries[entryId] = {
            ...existingEntry,
            key: expectedKeys,
            comment: expectedComment,
            content: content,
          };
          lorebookChanged = true;
        }
      }
    });

    // 2. Sync Lorebook Entries -> Entities (Only imports missing entries as entities, no overwrite reversion)
    Object.keys(currentEntries).forEach((entryId) => {
      const entry = currentEntries[entryId];
      const existingEntityIndex = nextEntities.findIndex((e) => String(e.id) === String(entryId));

      let type: import('../../../types').EntityType = 'CUSTOM';
      let name = entry.key[0] || 'Chưa đặt tên';

      if (entry.comment) {
        const match = entry.comment.match(/^\[Entity:(NPC|LOCATION|ITEM|FACTION|CUSTOM)\]\s*(.*)$/);
        if (match) {
          type = match[1] as import('../../../types').EntityType;
          if (match[2]) name = match[2];
        } else if (entry.comment.startsWith('NPC:') || entry.comment.toLowerCase().includes('character')) {
          type = 'NPC';
        } else if (entry.comment.startsWith('LOCATION:') || entry.comment.toLowerCase().includes('location')) {
          type = 'LOCATION';
        } else if (entry.comment.startsWith('ITEM:') || entry.comment.toLowerCase().includes('item')) {
          type = 'ITEM';
        } else if (entry.comment.startsWith('FACTION:') || entry.comment.toLowerCase().includes('faction')) {
          type = 'FACTION';
        }
      }

      if (existingEntityIndex === -1) {
        const hasEntityPrefix = entry.comment && entry.comment.startsWith('[Entity:');
        
        if (hasEntityPrefix) {
          delete nextEntries[entryId];
          lorebookChanged = true;
        } else {
          nextEntities.push({
            id: String(entry.uid),
            name: name,
            type: type,
            description: entry.content,
            personality: '',
            avatar: ''
          });
          entitiesChanged = true;

          nextEntries[entryId] = {
            ...entry,
            comment: `[Entity:${type}] ${name}`
          };
          lorebookChanged = true;
        }
      }
    });

    if (lorebookChanged) {
      store.updateLorebook({
        ...currentLorebook,
        entries: nextEntries
      });
    }

    if (entitiesChanged) {
      store.setEntities(nextEntities);
    }
  }, [state.entities, state.lorebook, store]);

  // --- AI Helper Function (UPDATED WITH VALIDATION & ENRICHMENT) ---
  const handleAiGenerate = async (field: string, category: 'player' | 'world') => {
    // 1. Validation Logic
    if (category === 'player') {
        const { name, gender, age } = state.player;
        if (!name || !gender || !age) {
            return;
        }
    } else if (category === 'world') {
        if (!state.world.genre && field !== 'genre') {
            return;
        }
    }

    store.setGenerating(true, field);
    try {
      // 2. Build Explicit Context
      const contextData = category === 'player' 
        ? { ...state.player, genre: state.world.genre } 
        : { 
            genre: state.world.genre, 
            worldName: state.world.worldName, 
            concept: conceptInput,
            corePremise: state.world.corePremise,
            cosmology: state.world.cosmology,
            timeline: state.world.timeline,
            geography: state.world.geography,
            factionsPower: state.world.factionsPower,
            economyResources: state.world.economyResources,
            culturalIdentity: state.world.culturalIdentity,
            adventureHooks: state.world.adventureHooks
          };

      // 3. Get Current Value for Enrichment
      let currentValue = "";
      if (category === 'player') {
          // @ts-expect-error - Dynamic access
          currentValue = state.player[field] || "";
      } else {
          // @ts-expect-error - Dynamic access
          currentValue = state.world[field] || "";
      }

      const content = await worldAiService.generateFieldContent(category, field, contextData, aiModel, currentValue, settings || undefined);
      
      // Dispatch based on field type
      if (['name', 'gender', 'age', 'personality', 'background', 'appearance', 'skills', 'goal'].includes(field)) {
        store.updatePlayer(field as keyof PlayerProfile, content);
      } else if (['worldName', 'context', 'genre', 'corePremise', 'cosmology', 'timeline', 'geography', 'factionsPower', 'economyResources', 'culturalIdentity', 'adventureHooks'].includes(field)) {
        store.updateWorld(field as keyof WorldSettingConfig, content);
      }
    } catch (error: unknown) {
      console.error("AI Error", error);
    } finally {
      store.setGenerating(false);
    }
  };
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bgImage, setBgImage] = useState<string | null>("https://i.ibb.co/cS6YkxK1/f0c7caebe311a0c1e0e5e7a3ca5599e7.jpg");
  const bgBlur = dbService.getKeyValueSync('ark_v2_bg_blur') !== false && dbService.getKeyValueSync('ark_v2_bg_blur') !== 'false';
  
  // Initial Load (Settings, Import Data, and Background)
  useEffect(() => {
    store.reset(); // Reset on clear mount if needed, or you can omit
    dbService.getSettings().then(s => {
      setSettings(s);
      if (s.aiModel) setAiModel(s.aiModel);
    });

    dbService.getAsset('ark_v2_custom_bg').then(savedBg => {
      if (savedBg) {
        setBgImage(savedBg);
      } else {
        dbService.getAsset('ark_v1_custom_bg').then(legacyBg => {
          if (legacyBg) {
            setBgImage(legacyBg);
          } else {
            setBgImage("https://i.ibb.co/cS6YkxK1/f0c7caebe311a0c1e0e5e7a3ca5599e7.jpg");
          }
        });
      }
    });

    // Check if there is initial data passed from Main Menu Import
    if (initialData) {
       store.importData(initialData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const handleAiSuggestTime = async () => {
    if (!state.world.genre) {
        return;
    }

    store.setGenerating(true, 'gameTime');
    try {
      const timeData = await worldAiService.generateInitialTime(state.world.genre, state.world.context, aiModel, settings || undefined);
      store.autoFillAll({ gameTime: timeData });
    } catch (error: unknown) {
      console.error("AI Time Error", error);
    } finally {
      store.setGenerating(false);
    }
  };

  const handleAutoFillAll = async () => {
    if (!conceptInput.trim()) return;
    store.setGenerating(true);
    try {
      const data = await worldAiService.generateFullWorld(conceptInput, aiModel, settings || undefined);
      store.autoFillAll(data);
    } finally {
      store.setGenerating(false);
    }
  };

  const handleKnowledgeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setKnowledgeFileName(file.name);
    const sizeInKb = file.size / 1024;
    const formattedSize = sizeInKb > 1024 
      ? `${(sizeInKb / 1024).toFixed(1)} MB` 
      : `${sizeInKb.toFixed(1)} KB`;
    setKnowledgeFileSize(formattedSize);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setKnowledgeContent(text);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleClearKnowledge = () => {
    setKnowledgeFileName(null);
    setKnowledgeFileSize(null);
    setKnowledgeContent(null);
  };

  const handleWorldGenFromKnowledge = async () => {
    if (!knowledgeContent?.trim()) return;
    setIsGeneratingFromKnowledge(true);
    store.setGenerating(true);
    try {
      const promptText = `DỰA TRÊN TÀI LIỆU TRI THỨC (KNOWLEDGE BASE / TRAIN DATA) SAU ĐÂY:\n\n${knowledgeContent}\n\nHãy tạo ra một thế giới đầy đủ cốt truyện và nhân vật chính hoàn toàn khớp với chi tiết tài liệu trên.`;
      const data = await worldAiService.generateFullWorld(promptText, aiModel, settings || undefined);
      store.autoFillAll(data);
    } catch (error: unknown) {
      console.error("Knowledge world generation failed", error);
      alert("Lỗi khi nạp tài liệu và tạo thế giới.");
    } finally {
      setIsGeneratingFromKnowledge(false);
      store.setGenerating(false);
    }
  };

  // --- Import / Export Logic ---
  const handleExportWorld = () => {
    if (!settings) return;

    const exportData: WorldData = {
        player: state.player,
        world: state.world,
        config: {
            ...state.config,
            difficulty: settings.difficulty,
            outputLength: settings.outputLength,
            perspective: settings.perspective,
            customMinWords: settings.customMinWords,
            customMaxWords: settings.customMaxWords
        },
        entities: state.entities,
        gameTime: state.gameTime,
        lorebook: state.lorebook
    };
    
    const worldName = state.world.worldName.replace(/\s+/g, '_') || 'unknown_world';
    const playerName = state.player.name.replace(/\s+/g, '_') || 'unknown_player';
    const timestamp = Date.now();
    const fileName = `ARK_${worldName}_${playerName}_${timestamp}.json`;
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content) as WorldData;
        
        if (!parsedData.player || !parsedData.world || !parsedData.config) {
            throw new Error("Cấu trúc file không hợp lệ");
        }

        store.importData(parsedData);
      } catch (error: unknown) {
        console.error(error);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset
  };

   // --- Start Game Logic ---
  const handleStartGame = async () => {
     if (!settings) return;

     const worldData: WorldData = {
        id: initialData?.id || `campaign-${crypto.randomUUID()}`,
        player: state.player,
        world: state.world,
        config: {
            ...state.config,
            difficulty: settings.difficulty,
            outputLength: settings.outputLength,
            perspective: settings.perspective,
            customMinWords: settings.customMinWords,
            customMaxWords: settings.customMaxWords
        },
        entities: state.entities,
        gameTime: state.gameTime,
        lorebook: state.lorebook,
        savedState: { history: [], turnCount: 0 }
     };
     
     if (!worldData.player.name || !worldData.world.worldName) {
         return;
     }

     const saveId = `autosave-${Date.now()}`;
     try {
         await dbService.saveAutosave({
             id: saveId,
             name: `${worldData.world.worldName} - Khởi tạo`,
             createdAt: Date.now(),
             updatedAt: Date.now(),
             data: worldData
         });
     } catch (err: unknown) {
         console.error("Autosave failed", err);
     }

     worldData.activeSaveId = saveId;

     if (onGameStart) {
         onGameStart(worldData);
     }
  };

  // --- RENDER FUNCTIONS FOR TABS ---

  const renderPlayerTab = () => (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-2 mb-2">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <User size={16} className="text-mystic-accent" />
          <span>Thiết lập Nhân Vật Chính (Main Character)</span>
        </h3>
      </div>
      <CharacterSheetEditor 
         data={state.player} 
         onChange={(field, value) => store.updatePlayer(field as any, value)} 
      />
    </div>
  );

  const renderWorldDepartureTab = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Compass size={16} className="text-mystic-accent" />
            <span>Thiết Lập Khởi Hành Thế Giới</span>
          </h3>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Mốc Khởi Điểm Bối Cảnh</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <InputGroup 
            label="Tên thế giới" 
            value={state.world.worldName} 
            onChange={(v) => store.updateWorld('worldName', v)} 
            onAi={() => handleAiGenerate('worldName', 'world')}
            loading={state.isGenerating && state.generatingField === 'worldName'}
            placeholder="Ví dụ: Đại Việt Cổ Nhạc, Vực Thẳm Vô Tận..."
            description="Tên gọi chính thức định đoạt thực thể hiện sinh."
          />
          <InputGroup 
            label="Thể loại (Genre)" 
            value={state.world.genre} 
            onChange={(v) => store.updateWorld('genre', v)} 
            onAi={() => handleAiGenerate('genre', 'world')}
            loading={state.isGenerating && state.generatingField === 'genre'}
            placeholder="Ví dụ: Tiên Hiệp Ma pháp, Kỳ Ảo Đông Phương, Cyberpunk..."
            description="Thể loại nền định hình phương vị gieo ý tưởng AI."
          />
        </div>

        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#cbd2df]/20 dark:border-[#142042]/10">
            <SlidersHorizontal size={15} className="text-mystic-accent" />
            <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Độ Khó Thế Giới Hoạt Động
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DIFFICULTY_LEVELS.map((diff) => {
              const isSelected = settings?.difficulty?.id === diff.id;
              
              const innerShadow = isSelected 
                ? 'shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042]' 
                : 'shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042]';
              
              let highlightBorder = isSelected 
                ? 'border-mystic-accent/30 dark:border-mystic-accent/10 text-mystic-accent font-extrabold shadow-sm' 
                : 'border-transparent text-slate-800 dark:text-slate-300';
              
              let icon = "🌐";
              let selectBadge = "text-slate-500 bg-slate-100 dark:bg-slate-800";
              if (diff.id === 'easy') {
                icon = "🌸";
                if (isSelected) selectBadge = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold";
              } else if (diff.id === 'normal') {
                icon = "⚖️";
                if (isSelected) selectBadge = "bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold";
              } else if (diff.id === 'hard') {
                icon = "⚔️";
                if (isSelected) selectBadge = "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold";
              } else if (diff.id === 'torment') {
                icon = "💀";
                if (isSelected) selectBadge = "bg-red-500/15 text-red-650 dark:text-red-400 font-black";
              }

              return (
                <button
                  key={diff.id}
                  type="button"
                  onClick={() => {
                    if (!settings) return;
                    const newSettings = { ...settings, difficulty: diff };
                    setSettings(newSettings);
                    dbService.saveSettings(newSettings);
                  }}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 justify-between h-36 bg-[#e6ebf4] dark:bg-[#0b1329] ${innerShadow} ${highlightBorder} group`}
                >
                  <div className="flex items-center gap-2 mb-1.5 w-full">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs ${selectBadge}`}>
                      {icon}
                    </span>
                    <span className="font-black text-[10px] uppercase tracking-wide">
                      {diff.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold flex-grow">
                    {diff.id === 'easy' && "Bình yên sủng vật ngọt ngào, người chơi bất tử luôn gặp đại vận."}
                    {diff.id === 'normal' && "Mọi chuyện xảy ra cân bằng hợp lý, không chết vô cớ."}
                    {diff.id === 'hard' && "Bước đi sai sẽ tích tụ bất lợi trầm trọng, chân thực kịch liệt."}
                    {diff.id === 'torment' && "Một mạng sụp đổ lập tức xóa file save tại chỗ, cực độ khốc liệt."}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-5 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-[#cbd2df]/20 dark:border-[#142042]/10">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={14} className="text-mystic-accent" />
                Thời Sơ Điểm
              </span>
              <button 
                type="button"
                onClick={handleAiSuggestTime}
                disabled={state.isGenerating}
                className="flex items-center gap-1 font-extrabold text-[9px] uppercase text-mystic-accent hover:text-blue-550 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {state.isGenerating && state.generatingField === 'gameTime' ? (
                  <span className="animate-spin block w-2.5 h-2.5 border-2 border-mystic-accent border-t-transparent rounded-full" />
                ) : (
                  <Sparkles size={11} className="text-mystic-accent animate-pulse" />
                )}
                <span>AI gợi ý</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 flex-grow items-start my-1">
              <TimeInput 
                label="Năm" 
                value={state.gameTime.year} 
                onChange={(v) => store.updateGameTime('year', v)} 
              />
              <TimeInput 
                label="Tháng" 
                value={state.gameTime.month} 
                min={1} max={12}
                onChange={(v) => store.updateGameTime('month', v)} 
              />
              <TimeInput 
                label="Ngày" 
                value={state.gameTime.day} 
                min={1} max={31}
                onChange={(v) => store.updateGameTime('day', v)} 
              />
              <TimeInput 
                label="Giờ" 
                value={state.gameTime.hour} 
                min={0} max={23}
                onChange={(v) => store.updateGameTime('hour', v)} 
              />
              <div className="col-span-2">
                <TimeInput 
                  label="Phút" 
                  value={state.gameTime.minute} 
                  min={0} max={59}
                  onChange={(v) => store.updateGameTime('minute', v)} 
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-normal italic pt-2 border-t border-[#cbd2df]/15 dark:border-[#142042]/5">
              Để mốc bắt đầu chuyến phiêu lưu in-game.
            </p>
          </div>

          <div className="md:col-span-2">
            <TextAreaGroup 
              label="Kịch Bản Mở Đầu (The Starting Scenario)" 
              value={state.world.startingScenario || ''} 
              onChange={(v) => store.updateWorld('startingScenario', v)} 
              onAi={() => handleAiGenerate('startingScenario', 'world')}
              loading={state.isGenerating && state.generatingField === 'startingScenario'}
              height="h-32"
              placeholder="Bạn xuất hiện tại đâu, trong trạng thái nào? Ví dụ: Bạn tỉnh giấc giữa vách đá hoang tàn, sấm chớp rền rĩ, bên cạnh chiếc la bàn kỳ quái..."
              description="Những dòng văn mở điểm để khởi động bộ não dẫn thoại đầu tiên của AI."
            />
          </div>
        </div>
      </div>
    );
  };

  const renderWorldFoundationTab = () => {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Globe2 size={16} className="text-mystic-accent" />
            <span>Nền Tảng Vĩ Mô Cốt Tủy (Lớp 1)</span>
          </h3>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/10">Foundation Layer</span>
        </div>

        <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed flex items-start gap-2.5 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10">
          <span className="text-sm shrink-0">🛡️</span>
          <span>
            <strong>BỐI CẢNH VĨ MÔ:</strong> Định hành khung cốt tủy cố định không bao giờ thay biến về định luật vật lý/ma pháp, kỷ nguyên văn tự lịch sử thô sơ. AI sẽ bám chặt lấy lớp nền móng vĩ mô này trong suốt quá trình phân vai.
          </span>
        </div>

        <div className="space-y-5">
          <TextAreaGroup 
            label="Giả Thuyết Cốt Lõi Thế Giới (Core Premise)" 
            value={state.world.corePremise || ''} 
            onChange={(v) => store.updateWorld('corePremise', v)} 
            onAi={() => handleAiGenerate('corePremise', 'world')}
            loading={state.isGenerating && state.generatingField === 'corePremise'}
            height="h-28"
            placeholder="Ví dụ: Thiên thể nứt rơi ma cốt thần thiêng hạ giới, tàn hại sinh linh hoang biến yêu quỷ hoành hành..."
            description="Bản tóm tắt ý niệm tối thượng khai mở vũ trụ và mâu thuẫn trung tâm câu chuyện."
          />

          <TextAreaGroup 
            label="Vũ Trụ Học & Định Luật Tự Nhiên (Cosmology & System Laws)" 
            value={state.world.cosmology || ''} 
            onChange={(v) => store.updateWorld('cosmology', v)} 
            onAi={() => handleAiGenerate('cosmology', 'world')}
            loading={state.isGenerating && state.generatingField === 'cosmology'}
            height="h-28"
            placeholder="Ví dụ: Nước sông âm phủ rẽ làm ba nhánh luân hồi, ma thuật vận khí từ khí hải đinh thần nội tại..."
            description="Định luật siêu nhiên, cấu trúc không gian hư thực, quy định phản phệ phép thuật bắt buộc tuân lệnh."
          />

          <TextAreaGroup 
            label="Dòng Lịch Sử & Biên Niên Kỷ Nguyên (Timeline)" 
            value={state.world.timeline || ''} 
            onChange={(v) => store.updateWorld('timeline', v)} 
            onAi={() => handleAiGenerate('timeline', 'world')}
            loading={state.isGenerating && state.generatingField === 'timeline'}
            height="h-28"
            placeholder="Ví dụ: 
- Kỷ Sáng Thế (Năm 0 - 600): Thần minh khai quang lập nên lục địa.
- Kỷ Sương Mù (Năm 600 - nay): Thần sa cơ lụi tàn, sương lạnh trùm phủ phàm giới."
            description="Sắp xếp cột mốc thời gian vĩ đại tạo ra cán cân hiện thực xã hội câu chuyện hôm nay."
          />
        </div>
      </div>
    );
  };

  const renderWorldRegionalTab = () => {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Database size={16} className="text-mystic-accent" />
            <span>Khung Cấu Trúc Vùng Miền & Khế Ước (Lớp 2)</span>
          </h3>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10">Regional Framework</span>
        </div>

        <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl text-[11px] text-slate-600 dark:text-slate-350 leading-relaxed flex items-start gap-2.5 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10">
          <span className="text-sm shrink-0">🗺️</span>
          <span>
            <strong>BỐI CẢNH TRUNG MÔ:</strong> Tập trung chạm chi tiết đặc tả địa lý cụ thể, phong thổ thành trì mấu chốt, kinh tế giao thương, các phe cánh lũng đoạn quyền lực cùng những mầm mống mạo hiểm sẵn có.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextAreaGroup 
            label="Địa Lý & Hệ Khí Hậu" 
            value={state.world.geography || ''} 
            onChange={(v) => store.updateWorld('geography', v)} 
            onAi={() => handleAiGenerate('geography', 'world')}
            loading={state.isGenerating && state.generatingField === 'geography'}
            height="h-32"
            placeholder="Ví dụ: Vùng cao nguyên xơ gió đá dựng tàn tích, sương muối buốt da quanh năm ngập bão cát hỏa tinh..."
            description="Cấu trúc quy luật thời tiết khắc nghiệt cùng lãnh hải trọng điểm chiếm cứ."
          />

          <TextAreaGroup 
            label="Phe Kháng & Cơ Cấu Quyền Vị" 
            value={state.world.factionsPower || ''} 
            onChange={(v) => store.updateWorld('factionsPower', v)} 
            onAi={() => handleAiGenerate('factionsPower', 'world')}
            loading={state.isGenerating && state.generatingField === 'factionsPower'}
            height="h-32"
            placeholder="Ví dụ: Triều đình lụi tàn thế phong tôn vương lập chúa; Đạo giáo tranh đạo quyền lực ngầm hành án..."
            description="Các thế lực mâu thuẫn khốc hại thao túng mạch sinh hoạt bối cảnh."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TextAreaGroup 
            label="Kinh Tế Ngầm & Tài Nguyên Phát Vị" 
            value={state.world.economyResources || ''} 
            onChange={(v) => store.updateWorld('economyResources', v)} 
            onAi={() => handleAiGenerate('economyResources', 'world')}
            loading={state.isGenerating && state.generatingField === 'economyResources'}
            height="h-32"
            placeholder="Ví dụ: Ngọc bích hóa lỏng nạp nguyên lực chế đạn súng bùa; Giao dịch qua vẩy bạc rồng của vương triều cũ..."
            description="Sự phân bổ vật quý, phương tiện mua sắm, các mạch khoáng linh khí khai sinh cuộc đổi chác."
          />

          <TextAreaGroup 
            label="Cấm Kỵ Nghi Lễ & Bản Sắc Tôn Giáo" 
            value={state.world.culturalIdentity || ''} 
            onChange={(v) => store.updateWorld('culturalIdentity', v)} 
            onAi={() => handleAiGenerate('culturalIdentity', 'world')}
            loading={state.isGenerating && state.generatingField === 'culturalIdentity'}
            height="h-32"
            placeholder="Ví dụ: Bộ tộc thợ rèn cấm lấy nước giếng thánh tưới lò lung; Tuyệt cấm chép miệng khi nghe sấm động..."
            description="Nhiếp chính văn hóa đời sống dân thường và những ranh giới bất khả xâm phạm kẻo gieo rắc kiếp tinh."
          />
        </div>

        <TextAreaGroup 
          label="Móc Xích Phiêu Lưu Đón Tiếp (Adventure Hooks)" 
          value={state.world.adventureHooks || ''} 
          onChange={(v) => store.updateWorld('adventureHooks', v)} 
          onAi={() => handleAiGenerate('adventureHooks', 'world')}
          loading={state.isGenerating && state.generatingField === 'adventureHooks'}
          height="h-24"
          placeholder="Ví dụ: 
- Tiên tổ đại đăng bốc hỏa hắc ám giữa canh ba trong đêm rằm mờ.
- Thương lái vận tiêu bị phục kích tàn phế ngay cửa ngõ thung lũng đá..."
          description="Những quả bom nổ chậm về nhiệm vụ kích động người chơi bước chân dấn thân khám phá."
        />
      </div>
    );
  };

  const renderWorldCompiledTab = () => {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <BookOpen size={16} className="text-mystic-accent" />
            <span>Thư Viện World Bible Thao Tác Tối Cao</span>
          </h3>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10">Dynamic Compiler</span>
        </div>

        <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed flex items-start gap-2.5 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10">
          <span className="text-sm shrink-0">📚</span>
          <span>
            <strong>SIÊU TỔ HỢP TRÍ TUỆ:</strong> Bản tập đại thành Markdown của tất cả các Lớp bối cảnh vĩ mô và vi mô phía trước. Đây là nguồn tri thức duy nhất nạp cho tâm trí của AI. Bạn có thể tự mình điều chỉnh, sửa thô hay tối ưu hóa dữ liệu văn tự tối cao này.
          </span>
        </div>

        <TextAreaGroup 
          label="Văn Bản Bối Cảnh Tối Thượng (World Context Document)" 
          value={state.world.context} 
          onChange={(v) => store.updateWorld('context', v)} 
          height="h-[360px]"
          placeholder="Nội dung bối cảnh đang chờ bạn nhập các mục thông tin trước hoặc ấn AI tạo nhanh..."
          description="Gốc gác thần hồn lưu trữ toàn bộ lịch sử nhân gian của thế giới của bạn."
        />
      </div>
    );
  };



  const renderEntitiesTab = () => {
    // Lọc danh sách thực thể bách khoa
    const filteredEntities = state.entities.filter(ent => {
      // 1. Lọc theo danh mục
      if (selectedCategoryFilter !== 'ALL' && ent.type !== selectedCategoryFilter) {
        return false;
      }
      // 2. Lọc theo từ khóa tìm kiếm
      if (!loreSearchTerm) return true;
      const lowerSearch = loreSearchTerm.toLowerCase();
      return (
        ent.name.toLowerCase().includes(lowerSearch) ||
        (ent.description && ent.description.toLowerCase().includes(lowerSearch)) ||
        (ent.personality && ent.personality.toLowerCase().includes(lowerSearch)) ||
        (ent.background && ent.background.toLowerCase().includes(lowerSearch))
      );
    });

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* Header & Công cụ hành động */}
        <div className="border-b border-slate-200 dark:border-slate-700/60 pb-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-1" style={{ fontFamily: 'Arial', lineHeight: '18px' }}>
              <BookOpen size={18} className="text-mystic-accent" /> Cẩm Nang Bách Khoa (Encyclopedia)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý toàn bộ NPC, địa danh, thần khí, phe phái và kỳ thư trong game. AI tự động sắp xếp và ghi nhớ sâu làm bối cảnh RPG.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Thanh tìm kiếm */}
            <div className="relative flex items-center min-w-[200px]">
              <Search size={14} className="absolute left-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm nội dung entry..." 
                value={loreSearchTerm}
                onChange={(e) => setLoreSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium rounded-xl appearance-none focus:outline-none focus:border-mystic-accent transition-colors shadow-inner"
              />
            </div>
            {/* Nút thêm thực thể mới */}
            <Button 
              variant="primary" 
              onClick={() => { setEditingEntityId(null); setShowEntityForm(true); }} 
              icon={<Plus size={16} />}
              className="font-bold whitespace-nowrap"
            >
              Thêm Thẻ Bách Khoa
            </Button>
          </div>
        </div>

        {/* Bộ lọc nhanh bách khoa (Encyclopedia Quick Categories) */}
        <div className="flex gap-1 overflow-x-auto pb-3 mb-4 shrink-0 scrollbar-none custom-scrollbar border-b border-dashed border-slate-200 dark:border-slate-800">
          {[
            { id: 'ALL', label: 'Tất cả thẻ', icon: '📖', count: state.entities.length },
            { id: 'NPC', label: 'Nhân vật (NPC)', icon: '👥', count: state.entities.filter(e => e.type === 'NPC').length },
            { id: 'LOCATION', label: 'Địa điểm / Địa danh', icon: '🗺️', count: state.entities.filter(e => e.type === 'LOCATION').length },
            { id: 'ITEM', label: 'Cổ vật & Vật phẩm', icon: '⚔️', count: state.entities.filter(e => e.type === 'ITEM').length },
            { id: 'FACTION', label: 'Phe phái & Tổ chức', icon: '🛡️', count: state.entities.filter(e => e.type === 'FACTION').length },
            { id: 'CUSTOM', label: 'Tri thức & Khái niệm', icon: '📜', count: state.entities.filter(e => e.type === 'CUSTOM').length }
          ].map(cat => {
            const isSelected = selectedCategoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-mystic-accent/10 border-mystic-accent/40 text-mystic-accent font-extrabold shadow-sm'
                    : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-mystic-accent/25' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Danh sách các thẻ */}
        <div className="flex-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map(ent => {
              // Xác định nhãn & màu sắc đại diện cho phân loại bách khoa
              const catConfig = {
                NPC: { label: 'Nhân vật', color: 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10', icon: '👥' },
                LOCATION: { label: 'Địa danh', color: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', icon: '🗺️' },
                ITEM: { label: 'Vật phẩm', color: 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10', icon: '⚔️' },
                FACTION: { label: 'Tổ chức', color: 'border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10', icon: '🛡️' },
                CUSTOM: { label: 'Tri thức', color: 'border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10', icon: '📜' }
              }[ent.type] || { label: 'Tùy biến', color: 'border-slate-400 bg-slate-100 text-slate-600', icon: '📝' };

              return (
                <div 
                  key={ent.id} 
                  className="bg-white dark:bg-slate-950/25 border border-slate-200 dark:border-slate-850/80 p-4.5 rounded-2xl hover:border-mystic-accent hover:shadow-[0_4px_12px_-5px_rgba(var(--color-mystic-accent),0.15)] transition-all group relative flex flex-col"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase tracking-wider flex items-center gap-1 ${catConfig.color}`}>
                        <span>{catConfig.icon}</span>
                        <span>{catConfig.label}</span>
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingEntityId(ent.id); setShowEntityForm(true); }} 
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-mystic-accent transition-colors"
                        title="Chỉnh sửa mục từ"
                      >
                        <Edit2 size={14}/>
                      </button>
                      <button 
                        onClick={() => {
                          if (window.confirm(`Bạn có chắc chắn muốn xóa "${ent.name}" khỏi Cẩm Nang Bách Khoa?`)) {
                            store.removeEntity(ent.id);
                          }
                        }} 
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-red-500 transition-colors"
                        title="Xóa mục từ"
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </div>

                  <h4 className="font-extrabold text-slate-800 dark:text-slate-100 mb-1.5 truncate text-sm leading-tight">
                    {ent.name}
                  </h4>

                  {/* Hiển thị chi tiết thông tin theo loại nếu là NPC */}
                  {ent.type === 'NPC' ? (
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="space-y-1 my-1">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-bold text-slate-600 dark:text-slate-300">Giới tính:</span> {ent.gender || 'Chưa rõ'}
                          <span className="text-slate-300">|</span>
                          <span className="font-bold text-slate-600 dark:text-slate-300">Tuổi:</span> {ent.age !== undefined ? `${ent.age} tuổi` : 'Chưa rõ'}
                        </div>
                        {ent.narrativeRole && (
                          <div className="text-[10px] bg-mystic-accent/5 text-mystic-accent border border-mystic-accent/10 px-2 py-0.5 rounded-md inline-block font-mono font-semibold">
                            Archetype: {ent.narrativeRole}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 mb-2 pt-1 border-t border-slate-100 dark:border-slate-900/80 leading-relaxed font-normal">
                        {ent.description || ent.personality || ent.background || 'Chưa có thông tin bách khoa.'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-4 mb-3 flex-1 leading-relaxed font-normal" style={{ wordBreak: 'break-word' }}>
                      {ent.description || 'Chưa có thông tin bách khoa chi tiết.'}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Khi không hiển thị mục từ nào */}
            {filteredEntities.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl flex flex-col items-center justify-center p-12 text-slate-400 dark:text-slate-500 text-center">
                <Database size={36} className="mb-3 text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Thư viện bách khoa không có kết quả phù hợp</p>
                <p className="text-xs mt-1 text-slate-500">
                  {state.entities.length === 0 
                    ? 'Thế giới đang đợi bạn sáng tạo nét chấm bút đầu tiên. Hãy nhấn "Thêm Thẻ Bách Khoa" ngay.'
                    : 'Hãy thử đổi cụm từ tìm kiếm hoặc chuyển đổi bộ lọc danh mục bách khoa ở trên.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentTabIndex = TABS.findIndex(t => t.id === state.currentTab);
  const nextTab = currentTabIndex < TABS.length - 1 ? TABS[currentTabIndex + 1].id : null;
  const prevTab = currentTabIndex > 0 ? TABS[currentTabIndex - 1].id : null;

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-[#e6ebf4] dark:bg-[#0b1329]">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />

      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-8 relative z-10 w-full overflow-hidden mt-safe">
          {/* Header */}
          <div className="w-full max-w-5xl flex items-center justify-between mb-4 mt-2 gap-2">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onNavigate(GameState.MENU)} 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-2 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/20 cursor-pointer"
              >
                  <ArrowLeft size={16} /> 
                  <span className="hidden sm:inline font-black uppercase tracking-wider text-[10px]">Quay lại</span>
              </button>
            </div>
            
            <h2 className="hidden md:block text-lg lg:text-xl font-black text-slate-800 dark:text-white drop-shadow-md tracking-[0.2em] uppercase font-sans text-center flex-1">
                Khởi Tạo Thế Giới
            </h2>
            
            {/* Top Right Controls Block (Bắt đầu sits at the far edge) */}
            <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
              <button 
                onClick={handleImportClick} 
                title="Nhập cấu hình thế giới" 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-[#cbd2df]/20 dark:border-[#142042]/15"
              >
                  <Upload size={14} /> <span className="hidden sm:inline">Nhập</span>
              </button>
              
              <button 
                onClick={handleExportWorld} 
                title="Xuất cấu hình thế giới" 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-[#cbd2df]/20 dark:border-[#142042]/15"
              >
                  <Download size={14} /> <span className="hidden sm:inline">Xuất</span>
              </button>
              
              <button 
                onClick={() => setShowAiModal(true)} 
                title="AI Sáng Tạo Quick Pane" 
                className="text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3.5 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-[10px] font-extrabold uppercase tracking-wider cursor-pointer border border-[#cbd2df]/20 dark:border-[#142042]/15 animate-pulse"
              >
                  <Sparkles size={14} className="text-amber-550" /> <span>AI Tạo Nhanh</span>
              </button>
              
              <button 
                 disabled={!state.player.name || !state.world.worldName}
                 onClick={handleStartGame}
                 title="Bắt Đầu Trò Chơi" 
                 className="text-white bg-gradient-to-br from-mystic-accent to-blue-600 hover:from-blue-500 hover:to-mystic-accent transition-all flex items-center gap-1.5 p-2.5 px-4 rounded-2xl shadow-[4px_4px_8px_rgba(56,189,248,0.25)] hover:shadow-[5px_5px_12px_rgba(56,189,248,0.4)] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-wider cursor-pointer border border-transparent"
              >
                  <Play size={13} className="fill-white" /> <span>Bắt đầu</span>
              </button>
            </div>
          </div>

          {/* Main Wizard Card */}
          <div className="w-full max-w-5xl h-[max(620px,76vh)] flex flex-row bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/30 dark:border-[#142042]/20 rounded-3xl shadow-[12px_12px_24px_#cbd2df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#030610,-12px_-12px_24px_#142042] overflow-hidden mx-auto min-h-0">
            
            {/* Steps Left Sidebar (Only Icons, compact, styled for Neumorphism) */}
            <div className="w-16 md:w-20 bg-[#e6ebf4]/90 dark:bg-[#0b1329]/90 border-r border-[#cbd2df]/30 dark:border-[#142042]/20 flex flex-col items-center py-8 gap-6 shrink-0 shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
              {TABS.map((tab, idx) => {
                const isActive = state.currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => store.setTab(tab.id)}
                    title={tab.label}
                    className={`w-11 h-11 md:w-13 md:h-13 rounded-2xl flex items-center justify-center transition-all duration-300 relative group ${
                      isActive
                        ? 'bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_-4px_-4px_8px_#142042] text-mystic-accent border border-[#cbd2df]/40 dark:border-[#030610]/40'
                        : 'bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] text-slate-500 dark:text-slate-400 hover:text-mystic-accent cursor-pointer border border-transparent'
                    }`}
                  >
                    <tab.icon size={18} className={isActive ? 'scale-110 animate-pulse' : 'hover:scale-110 transition-transform'} />
                  </button>
                );
              })}
            </div>

            {/* Right Side Content Panel */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#e6ebf4] dark:bg-[#0b1329] overflow-hidden">
              {/* Content Panel Area */}
              <div className="flex-grow overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 relative">
                 <AnimatePresence mode="wait">
                    {state.currentTab === 0 && <motion.div key="tab0" initial={{opacity:0, y:-10, filter: 'blur(4px)'}} animate={{opacity:1, y:0, filter: 'blur(0px)'}} exit={{opacity:0, y:10, filter: 'blur(4px)'}} transition={{ duration: 0.2 }} className="h-full max-w-4xl mx-auto">{renderPlayerTab()}</motion.div>}
                    {state.currentTab === 1 && <motion.div key="tab1" initial={{opacity:0, y:-10, filter: 'blur(4px)'}} animate={{opacity:1, y:0, filter: 'blur(0px)'}} exit={{opacity:0, y:10, filter: 'blur(4px)'}} transition={{ duration: 0.2 }} className="h-full max-w-4xl mx-auto">{renderWorldDepartureTab()}</motion.div>}
                    {state.currentTab === 4 && <motion.div key="tab4" initial={{opacity:0, y:-10, filter: 'blur(4px)'}} animate={{opacity:1, y:0, filter: 'blur(0px)'}} exit={{opacity:0, y:10, filter: 'blur(4px)'}} transition={{ duration: 0.2 }} className="h-full max-w-4xl mx-auto">{renderWorldFoundationTab()}</motion.div>}
                    {state.currentTab === 5 && <motion.div key="tab5" initial={{opacity:0, y:-10, filter: 'blur(4px)'}} animate={{opacity:1, y:0, filter: 'blur(0px)'}} exit={{opacity:0, y:10, filter: 'blur(4px)'}} transition={{ duration: 0.2 }} className="h-full max-w-4xl mx-auto">{renderWorldRegionalTab()}</motion.div>}
                    {state.currentTab === 6 && <motion.div key="tab6" initial={{opacity:0, y:-10, filter: 'blur(4px)'}} animate={{opacity:1, y:0, filter: 'blur(0px)'}} exit={{opacity:0, y:10, filter: 'blur(4px)'}} transition={{ duration: 0.2 }} className="h-full max-w-4xl mx-auto">{renderWorldCompiledTab()}</motion.div>}
                    {state.currentTab === 3 && <motion.div key="tab3" initial={{opacity:0, y:-10, filter: 'blur(4px)'}} animate={{opacity:1, y:0, filter: 'blur(0px)'}} exit={{opacity:0, y:10, filter: 'blur(4px)'}} transition={{ duration: 0.2 }} className="h-full max-w-4xl mx-auto">{renderEntitiesTab()}</motion.div>}
                 </AnimatePresence>
              </div>
              
              {/* Bottom Info & Action Bar */}
              <div className="p-4 md:p-6 bg-[#e6ebf4]/95 dark:bg-[#0b1329]/95 backdrop-blur-md border-t border-[#cbd2df]/30 dark:border-[#142042]/20 flex items-center justify-between gap-4 shrink-0">
                 <div className="flex gap-3">
                    {prevTab !== null && (
                      <button 
                         className="py-2.5 px-5 text-xs font-black bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/20 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all cursor-pointer font-sans"
                         onClick={() => store.setTab(prevTab)}
                      >
                         Quay Lại
                      </button>
                    )}
                    {nextTab !== null && (
                      <button 
                         className="py-2.5 px-5 text-xs font-black bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/20 rounded-2xl text-mystic-accent hover:text-blue-500 transition-all cursor-pointer font-sans"
                         onClick={() => store.setTab(nextTab)}
                      >
                         Tiếp Tục
                      </button>
                    )}
                 </div>

                 <div className="hidden lg:flex items-center gap-4 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[inset_2px_2px_5px_#cbd2df,inset_-2px_-2px_5px_#ffffff] dark:shadow-[inset_2px_2px_5px_#030610,inset_-2px_-2px_5px_#142042] rounded-2xl p-2 px-4 border border-[#cbd2df]/20 dark:border-[#142042]/10">
                     <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                         <User size={13} className="text-mystic-accent shrink-0" />
                         <span className="font-bold max-w-[130px] truncate">{state.player.name || <span className="text-slate-400 font-normal italic">Chưa có nhân vật</span>}</span>
                     </div>
                     <div className="w-[1px] h-3 bg-slate-300 dark:bg-slate-850" />
                     <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                         <Compass size={13} className="text-mystic-accent shrink-0" />
                         <span className="font-bold max-w-[130px] truncate">{state.world.worldName || <span className="text-slate-400 font-normal italic">Chưa có bối cảnh</span>}</span>
                     </div>
                 </div>
              </div>
            </div>
          </div>
      </div>

      {showEntityForm && (
        <EntityForm 
            initialData={editingEntityId ? state.entities.find(e => e.id === editingEntityId) : undefined}
            onCancel={() => setShowEntityForm(false)}
            onSave={(entity) => {
                if (editingEntityId) {
                    store.updateEntity(editingEntityId, entity);
                } else {
                    store.addEntity(entity);
                }
                setShowEntityForm(false);
            }}
            settings={settings}
        />
      )}

      {/* Neumorphic AI Quick Creation Modal Backdrop */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-xl bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/35 dark:border-[#142042]/20 rounded-3xl p-6 shadow-[15px_15px_30px_rgba(0,0,0,0.1),-15px_-15px_30px_rgba(255,255,255,0.7)] dark:shadow-[15px_15px_30px_rgba(0,0,0,0.4),-15px_-15px_30px_rgba(255,255,255,0.02)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500 animate-pulse" /> Sáng Tạo Thế Giới Bằng AI
                </h3>
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-slate-500 hover:text-red-500 transition-all cursor-pointer border border-[#cbd2df]/20 dark:border-[#142042]/10"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Section 1: Concept input */}
                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_4px_#030610,inset_-4px_-4px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 space-y-3">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">💡 Nhập ý tưởng sơ khởi</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Mô tả bất kỳ ý tưởng bối cảnh thô sơ nào bạn muốn (Ví dụ: Đô thị tu tiên, Cyberpunk Ma Pháp, v.v.).
                  </p>
                  <input 
                    value={conceptInput}
                    onChange={(e) => setConceptInput(e.target.value)}
                    placeholder="Mô tả ý tưởng bối cảnh..."
                    className="w-full bg-slate-100/30 dark:bg-slate-900/30 border border-[#cbd2df]/30 dark:border-[#142042]/20 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-mystic-accent transition-all"
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={async () => {
                        await handleAutoFillAll();
                        setShowAiModal(false);
                      }}
                      disabled={state.isGenerating || !conceptInput.trim()}
                      className="py-2.5 px-5 text-xs font-extrabold bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-amber-600 dark:text-amber-400 rounded-xl hover:text-amber-500 flex items-center gap-1.5 transition-all disabled:opacity-40 border border-transparent cursor-pointer"
                    >
                      <Sparkles size={14} className="text-amber-500 animate-pulse" />
                      {state.isGenerating ? "Đang xử lý..." : "Tạo Nhanh Bằng AI"}
                    </button>
                  </div>
                </div>

                {/* Section 2: Knowledge File upload */}
                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_4px_#030610,inset_-4px_-4px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10 space-y-3">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">📂 Hồ Sơ Tri Thức (Train Data)</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Bổ sung tệp tài liệu bối cảnh của riêng bạn (TXT, MD, JSON, CSV). AI sẽ lấy làm khuôn mẫu sinh dữ liệu.
                  </p>
                  
                  <div className="flex items-center gap-2 bg-slate-150/30 dark:bg-slate-900/30 rounded-xl p-3 border border-[#cbd2df]/30 dark:border-[#142042]/20">
                    <input 
                      type="file" 
                      id="knowledge-file-popup" 
                      className="hidden" 
                      accept=".txt,.md,.json,.csv"
                      onChange={handleKnowledgeUpload} 
                    />
                    {knowledgeFileName ? (
                      <div className="flex-1 flex items-center justify-between min-w-0 text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <Database size={15} className="text-emerald-500 shrink-0 animate-pulse" />
                          <div className="flex flex-col min-w-0 text-left">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{knowledgeFileName}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{knowledgeFileSize}</span>
                          </div>
                        </div>
                        <button 
                          onClick={handleClearKnowledge} 
                          title="Xóa tài liệu"
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label 
                        htmlFor="knowledge-file-popup" 
                        className="flex-1 flex items-center gap-2 cursor-pointer text-slate-450 hover:text-slate-600 dark:hover:text-slate-350 transition-colors"
                      >
                        <Upload size={15} className="text-slate-400 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-left">Tải lên Tri Thức Pháp Điển...</span>
                      </label>
                    )}
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      disabled={!knowledgeContent || state.isGenerating}
                      onClick={async () => {
                        await handleWorldGenFromKnowledge();
                        setShowAiModal(false);
                      }}
                      className="py-2.5 px-5 text-xs font-extrabold bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-emerald-600 dark:text-emerald-400 rounded-xl hover:text-emerald-500 flex items-center gap-1.5 transition-all disabled:opacity-40 border border-transparent cursor-pointer"
                    >
                      <Database size={14} className="text-emerald-550" />
                      AI GEN KNOWLEDGE
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, placeholder, onAi, loading = false, description }: { label: string, value: string, onChange: (v: string) => void, placeholder?: string, onAi?: () => void, loading?: boolean, description?: string }) => (
    <div className="mb-4 relative flex flex-col p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_4px_4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15">
        <div className="flex justify-between items-center mb-1">
            <label className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">{label}</label>
            {onAi && (
                <button 
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAi();
                    }} 
                    disabled={loading} 
                    className="group flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/35 dark:border-[#142042]/20 text-[10px] text-slate-600 dark:text-slate-300 font-bold hover:text-mystic-accent transition-all cursor-pointer z-10"
                >
                    {loading ? (
                        <span className="animate-spin block w-3 h-3 border-2 border-mystic-accent border-t-transparent rounded-full" />
                    ) : (
                        <Sparkles size={11} className="group-hover:scale-110 transition-transform" />
                    )}
                    <span>AI Gợi ý</span>
                </button>
            )}
        </div>
        <input 
            type="text" 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent px-1 py-1 text-slate-900 dark:text-slate-100 outline-none text-xs font-semibold focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
            placeholder={placeholder}
        />
        {description && (
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-2 italic font-medium leading-normal">
              {description}
            </p>
        )}
    </div>
);

const TimeInput = ({ label, value, onChange, min, max }: { label: string, value: number, onChange: (v: number) => void, min?: number, max?: number }) => (
    <div className="flex flex-col gap-1.5 p-3 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_4px_4px_8px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10">
        <label className="text-[10px] uppercase font-black tracking-wider text-slate-550 dark:text-slate-400 text-center">{label}</label>
        <input 
            type="number" 
            value={isNaN(value) ? '' : value}
            min={min}
            max={max}
            onChange={(e) => {
                if (e.target.value === '') {
                    onChange(0);
                } else {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) onChange(val);
                }
            }}
            className="w-full bg-transparent border-none text-stone-900 dark:text-slate-100 outline-none text-center text-xs font-bold font-mono focus:ring-0"
        />
    </div>
);

const TextAreaGroup = ({ label, value, onChange, onAi, height = 'h-24', loading = false, placeholder, description }: { label: string, value: string, onChange: (v: string) => void, onAi?: () => void, height?: string, loading?: boolean, placeholder?: string, description?: string }) => {
    const [isPreview, setIsPreview] = useState(false);
    
    return (
        <div className="relative flex flex-col mb-4 p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_4px_4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                    <label className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">{label}</label>
                    <button 
                        type="button"
                        onClick={() => setIsPreview(!isPreview)}
                        className="text-slate-450 hover:text-mystic-accent transition-colors"
                        title={isPreview ? "Chỉnh sửa" : "Xem trước Markdown"}
                    >
                        {isPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                </div>
                {onAi && (
                    <button 
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAi();
                        }} 
                        disabled={loading} 
                        className="group flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/35 dark:border-[#142042]/20 text-[10px] text-slate-600 dark:text-slate-300 font-bold hover:text-mystic-accent transition-all cursor-pointer z-10"
                    >
                        {loading ? (
                            <span className="animate-spin block w-3 h-3 border-2 border-mystic-accent border-t-transparent rounded-full" />
                        ) : (
                            <Sparkles size={11} className="group-hover:scale-110 transition-transform" />
                        )}
                        <span>AI Gợi ý</span>
                    </button>
                )}
            </div>
            {isPreview ? (
                <div className={`w-full bg-slate-100/30 dark:bg-slate-900/30 rounded-xl p-3 text-stone-900 dark:text-slate-100 overflow-y-auto custom-scrollbar text-xs leading-relaxed ${height}`}>
                    <MarkdownRenderer content={value || "*Chưa có nội dung*"} />
                </div>
            ) : (
                <textarea 
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-transparent px-1 py-1 text-slate-900 dark:text-slate-100 outline-none text-xs font-medium resize-none focus:ring-0 custom-scrollbar ${height}`}
                    placeholder={placeholder}
                />
            )}
            {description && (
                <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-2 italic font-medium leading-normal">
                  {description}
                </p>
            )}
        </div>
    );
};

export default WorldCreationScreen;
