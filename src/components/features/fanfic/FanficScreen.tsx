
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, Plus, Trash2, Edit2, Wand2, Play, 
  User, Compass, ScrollText, Users, Upload, Download, Clock,
  X, Search, ChevronRight, Eye, EyeOff, FileText, Globe2, SlidersHorizontal, Database, BookOpen
} from 'lucide-react';
import { NavigationProps, GameState, WorldData, AppSettings } from '../../../types';
import Button from '../../ui/Button';
import MarkdownRenderer from '../../common/MarkdownRenderer';
import { useWorldCreationStore } from '../../../store/worldCreationStore';
import EntityForm from '../world-creation/EntityForm';
import { CharacterSheetEditor } from '../world-creation/CharacterSheetEditor';
import { worldAiService } from '../../../services/ai/world-creation/service';
import { fanficAiService, FanficCharacter } from '../../../services/ai/fanfic/service';
import { dbService } from '../../../services/db/indexedDB';
import { DIFFICULTY_LEVELS } from '../../../constants/promptTemplates';

const TABS = [
  { id: 0, label: "Nhân vật chính", icon: User },
  { id: 1, label: "Khởi hành thế giới", icon: Compass },
  { id: 4, label: "Nền tảng vĩ mô (Lớp 1)", icon: Globe2 },
  { id: 5, label: "Cấu trúc vùng miền (Lớp 2)", icon: Database },
  { id: 6, label: "Hồ sơ World Bible", icon: BookOpen },
  { id: 3, label: "Bách khoa toàn thư", icon: Users },
];

interface FanficScreenProps extends NavigationProps {
  onGameStart?: (data: WorldData) => void;
  initialData?: WorldData | null;
}

interface WorkCharacter {
  name?: string;
  role?: string;
  gender?: string;
  age?: string;
  personality?: string;
  description?: string;
  appearance?: string;
  skills?: string;
  goal?: string;
  lineage?: string;
  identities?: { name: string; role: string }[];
}

interface ImportedWork {
  title?: string;
  worldSetting?: string;
  plot?: string;
  characters?: WorkCharacter[];
}

const FanficScreen: React.FC<FanficScreenProps> = ({ onNavigate, onGameStart, initialData }) => {
  const store = useWorldCreationStore();
  const state = {
    currentTab: store.currentTab,
    player: store.player,
    world: store.world,
    config: store.config,
    entities: store.entities,
    gameTime: store.gameTime,
    lorebook: store.lorebook,
    isGenerating: store.isGenerating,
    generatingField: store.generatingField
  };

  const [showEntityForm, setShowEntityForm] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [originalWorkName, setOriginalWorkName] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [analyzedCharacters, setAnalyzedCharacters] = useState<FanficCharacter[]>([]);
  const [importedWorks, setImportedWorks] = useState<ImportedWork[]>([]);
  const [showWorkSelector, setShowWorkSelector] = useState(false);
  const [workSearchTerm, setWorkSearchTerm] = useState('');
  const [workFilterCountry, setWorkFilterCountry] = useState('All');
  const [workFilterGenre, setWorkFilterGenre] = useState('All');
  const [workSortBy, setWorkSortBy] = useState<'title' | 'chars_desc' | 'chars_asc'>('title');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalysisCollapsed, setIsAnalysisCollapsed] = useState(false);
  const [aiModel, setAiModel] = useState<string>('gemini-3.1-pro-preview');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showAiQuickFillModal, setShowAiQuickFillModal] = useState(false);
  const [showAiKnowledgeModal, setShowAiKnowledgeModal] = useState(false);

  const [knowledgeFileName, setKnowledgeFileName] = useState<string | null>(null);
  const [knowledgeFileSize, setKnowledgeFileSize] = useState<string | null>(null);
  const [knowledgeContent, setKnowledgeContent] = useState<string | null>(null);
  const [isGeneratingFromKnowledge, setIsGeneratingFromKnowledge] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const txtFileInputRef = useRef<HTMLInputElement>(null);
  const [bgImage, setBgImage] = useState<string | null>("https://i.ibb.co/cS6YkxK1/f0c7caebe311a0c1e0e5e7a3ca5599e7.jpg");
  const bgBlur = dbService.getKeyValueSync('ark_v2_bg_blur') !== false && dbService.getKeyValueSync('ark_v2_bg_blur') !== 'false';
  
  useEffect(() => {
    store.reset(); // Reset global store on mount for FanficScreen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleAnalyze = async () => {
    if (!originalContent.trim() && !originalWorkName.trim()) {
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await fanficAiService.analyzeFanfic(originalContent, originalWorkName, settings || undefined);
      setAnalyzedCharacters(result.characters);
      
      // Tự động cập nhật bối cảnh thế giới từ tóm tắt
      store.updateWorld('context', result.summary);
      setIsAnalysisCollapsed(true);
    } catch (error: any) {
      console.error("Analyze Error", error);
      alert("Lỗi khi phân tích: " + (error?.message || "Không rõ nguyên nhân. Vui lòng kiểm tra lại nội dung."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTxtFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalContent(e.target?.result as string);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Initial Load (Settings & Import Data)
  useEffect(() => {
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

    // Check if there is initial data passed
    if (initialData) {
       store.importData(initialData);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

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
        ? `Họ Tên: ${entity.name}\nTuỏi: ${entity.age || 'Chưa rõ'}\nGiới tính: ${entity.gender || 'Chưa rõ'}\nTính cách: ${entity.personality || 'Chưa rõ'}\nNgoại hình: ${entity.appearance || 'Chưa rõ'}\nTiểu sử: ${entity.description || entity.background || 'Chưa rõ'}`
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

  // --- AI Helper Function ---
  const handleAiGenerate = async (field: string, category: 'player' | 'world') => {
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
      const contextData = category === 'player' 
        ? { ...state.player, genre: state.world.genre } 
        : { genre: state.world.genre, worldName: state.world.worldName, originalWorkName };

      let currentValue = "";
      if (category === 'player') {
          // @ts-expect-error - Dynamic access
          currentValue = state.player[field] || "";
      } else {
          // @ts-expect-error - Dynamic access
          currentValue = state.world[field] || "";
      }

      const content = await worldAiService.generateFieldContent(category, field, contextData, aiModel, currentValue, settings || undefined);
      
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
    if (!originalWorkName.trim()) return;
    store.setGenerating(true);
    try {
      // Sử dụng tên tác phẩm gốc và tóm tắt (nếu có) làm ý tưởng để AI tạo thế giới đồng nhân
      let concept = `Đồng nhân của tác phẩm: ${originalWorkName}`;
      if (state.world.context) {
        concept += `\n\nBối cảnh và nội dung gốc:\n${state.world.context}`;
      }
      
      // Thu thập dữ liệu hiện tại để AI tôn trọng
      const existingData = {
        player: state.player,
        world: state.world,
        entities: state.entities,
        rules: state.config.rules,
        gameTime: state.gameTime
      };

      const data = await worldAiService.generateFullWorld(concept, aiModel, settings || undefined, existingData);
      store.autoFillAll(data);
    } catch (error: unknown) {
      console.error("AI AutoFill Error", error);
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
      const promptText = `DỰA TRÊN TÀI LIỆU TRI THỨC ĐỒNG NHÂN / TRAIN DATA (KNOWLEDGE BASE) SAU ĐÂY:\n\n${knowledgeContent}\n\nHãy tạo ra một thế giới đồng nhân đầy đủ cốt truyện, bối cảnh và nhân vật chính hoàn toàn dựa trên và khớp với chi tiết của tài liệu tri thức đặc trưng trên.`;
      const data = await worldAiService.generateFullWorld(promptText, aiModel, settings || undefined);
      store.autoFillAll(data);
    } catch (error: unknown) {
      console.error("Knowledge world generation failed", error);
      alert("Lỗi khi nạp tài liệu và tạo thế giới đồng nhân.");
    } finally {
      setIsGeneratingFromKnowledge(false);
      store.setGenerating(false);
    }
  };

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
        gameTime: state.gameTime
    };
    
    const worldName = state.world.worldName.replace(/\s+/g, '_') || 'unknown_world';
    const playerName = state.player.name.replace(/\s+/g, '_') || 'unknown_player';
    const timestamp = Date.now();
    const fileName = `FANFIC_${worldName}_${playerName}_${timestamp}.json`;
    
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

  const applyWorkData = (work: ImportedWork) => {
    setOriginalWorkName(work.title || '');
    
    // Kết hợp bối cảnh và cốt truyện để làm context thế giới
    let context = "";
    if (work.worldSetting) context += `BỐI CẢNH:\n${work.worldSetting}\n\n`;
    if (work.plot) context += `CỐT TRUYỆN:\n${work.plot}`;
    
    store.updateWorld('context', context.trim());
    
    // Chuyển đổi danh sách nhân vật sang định dạng FanficCharacter
    if (work.characters && Array.isArray(work.characters)) {
      const mappedChars: FanficCharacter[] = work.characters.map((c: WorkCharacter) => {
        let background = c.description || '';
        if (c.lineage) background += `\nLai lịch: ${c.lineage}`;
        if (c.identities && Array.isArray(c.identities)) {
          background += `\nDanh tính khác: ${c.identities.map((i: { name: string; role: string }) => `${i.name} (${i.role})`).join(', ')}`;
        }

        return {
          name: c.name || '',
          role: c.role || '',
          gender: c.gender || 'Chưa rõ',
          age: c.age || 'Chưa rõ',
          personality: c.personality || 'Chưa rõ',
          background: background.trim() || 'Chưa rõ',
          appearance: c.appearance || 'Chưa rõ',
          skills: c.skills || 'Chưa rõ',
          goal: c.goal || 'Chưa rõ'
        };
      });
      setAnalyzedCharacters(mappedChars);
      
      // Thêm các nhân vật quan trọng vào danh sách thực thể (NPC) nếu chưa có nhiều
      if (state.entities.length < 5) {
        work.characters.slice(0, 15).forEach((c: WorkCharacter) => {
          // Kiểm tra xem thực thể đã tồn tại chưa
          if (c.name && !state.entities.some(e => e.name === c.name)) {
            let desc = c.description || c.role || 'Nhân vật từ tác phẩm gốc';
            if (c.identities && Array.isArray(c.identities)) {
              desc += ` (Danh tính: ${c.identities.map((i: { name: string; role: string }) => i.name).join(', ')})`;
            }

            store.addEntity({
                name: c.name,
                type: 'NPC',
                description: desc,
                properties: {
                  role: c.role,
                  lineage: c.lineage,
                  identities: c.identities
                }
            });
          }
        });
      }
    }
    
    setIsAnalysisCollapsed(true);
    setShowWorkSelector(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        
        // Kiểm tra xem đây là danh sách tác phẩm gốc (định dạng người dùng cung cấp)
        if (Array.isArray(parsedData) && parsedData.length > 0 && (parsedData[0].title || parsedData[0].worldSetting)) {
          setImportedWorks(parsedData);
          setShowWorkSelector(true);
        } 
        // Kiểm tra nếu là một tác phẩm đơn lẻ
        else if (parsedData.title && (parsedData.worldSetting || parsedData.characters)) {
          applyWorkData(parsedData);
        }
        // Đây là dữ liệu lưu game chuẩn (WorldData)
        else if (parsedData.player && parsedData.world) {
          store.importData(parsedData as WorldData);
        } else {
          console.warn("Định dạng tệp không được hỗ trợ");
        }
      } catch (error: unknown) {
        console.error("Import Error", error);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleStartGame = async () => {
     if (!settings) return;

     const saveId = `autosave-fanfic-${Date.now()}`;
     const worldData: WorldData = {
        id: initialData?.id || `campaign-${crypto.randomUUID()}`,
        activeSaveId: saveId,
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

     try {
         await dbService.saveAutosave({
             id: saveId,
             name: `[Đồng Nhân] ${worldData.world.worldName}`,
             createdAt: Date.now(),
             updatedAt: Date.now(),
             data: worldData
         });
     } catch (err: unknown) {
         console.error("Autosave failed", err);
     }

     if (onGameStart) {
         onGameStart(worldData);
     }
  };

  const handleAiGenPlayerKnowledge = async () => {
    if (!state.player.knowledge_train?.trim()) {
        alert("Vui lòng nhập dữ liệu gốc (Knowledge Base) vào bảng Nhân Vật Chính trước.");
        return;
    }

    store.setGenerating(true, 'knowledge_train');
    try {
      const generatedSheet = await worldAiService.generateCharacterSheetFromKnowledge(state.player.knowledge_train, aiModel, settings || undefined);
      
      // Update each generated field into the player store
      Object.entries(generatedSheet).forEach(([field, value]) => {
        if (value && typeof value === 'string') {
          store.updatePlayer(field as any, value);
        }
      });
      // Keep the original knowledge_train value
      store.updatePlayer('knowledge_train', state.player.knowledge_train);

    } catch (error) {
      console.error(error);
      alert("Lỗi khi tạo hình nhân vật từ Knowledge.");
    } finally {
      store.setGenerating(false);
    }
  };

  const renderPlayerTab = () => (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center border-b border-[#cbd2df]/30 dark:border-[#142042]/15 pb-2 mb-2">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <User size={16} className="text-mystic-accent" />
          <span>Thiết lập Nhân Vật Chính (Main Character)</span>
        </h3>
        <button
            type="button"
            onClick={handleAiGenPlayerKnowledge}
            disabled={state.isGenerating || !state.player.knowledge_train?.trim()}
            className="group flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/35 dark:border-[#142042]/20 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:text-emerald-500 transition-all cursor-pointer z-10"
        >
            {state.isGenerating && state.generatingField === 'knowledge_train' ? (
                <span className="animate-spin block w-2.5 h-2.5 border-2 border-emerald-500 border-t-transparent rounded-full" />
            ) : (
                <Sparkles size={11} className="group-hover:scale-110 transition-transform text-emerald-500" />
            )}
            <span>AI GEN KNOWLEDGE</span>
        </button>
      </div>

      {analyzedCharacters.length > 0 && (
        <div className="bg-[#e6ebf4] dark:bg-[#0b1329] p-4 rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_4px_4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15 mb-4">
          <label className="block text-xs font-black text-mystic-accent uppercase tracking-wider mb-2">Chọn nhân vật từ tác phẩm gốc</label>
          <div className="w-full bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl p-2.5 border border-[#cbd2df]/30 dark:border-[#142042]/15 focus-within:ring-1 focus-within:ring-mystic-accent/30 shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042]">
              <select 
                className="w-full bg-transparent border-none text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                onChange={(e) => {
                  const charName = e.target.value;
                  if (charName === 'new') {
                    store.updatePlayer('name', '');
                    return;
                  }
                  const char = analyzedCharacters.find(c => c.name === charName);
                  if (char) {
                    store.updatePlayer('name', char.name || '');
                    store.updatePlayer('gender', char.gender || '');
                    store.updatePlayer('age', char.age || '');
                    store.updatePlayer('personality', char.personality || '');
                    store.updatePlayer('background', char.background || '');
                    store.updatePlayer('appearance', char.appearance || '');
                    store.updatePlayer('skills', char.skills || '');
                    store.updatePlayer('goal', char.goal || '');
                  }
                }}
              >
                <option value="new" className="bg-[#e6ebf4] dark:bg-[#0b1329]">-- Tạo nhân vật mới tự do --</option>
                {analyzedCharacters.map(char => (
                  <option key={char.name} value={char.name} className="bg-[#e6ebf4] dark:bg-[#0b1329]">{char.name} ({char.role})</option>
                ))}
              </select>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 italic font-medium leading-normal">* Chọn một nhân vật để tự động điền thông tin chi tiết.</p>
        </div>
      )}

      <CharacterSheetEditor 
         data={state.player} 
         onChange={(field, value) => store.updatePlayer(field as any, value)} 
      />
    </div>
  );

  const renderWorldDepartureTab = () => {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Compass size={16} className="text-mystic-accent" />
            <span>Thiết Lập Khởi Hành Thế Giới Đồng Nhân</span>
          </h3>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Mốc Khởi Điểm Bối Cảnh</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <InputGroup 
            label="Tên thế giới đồng nhân" 
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
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all duration-200 justify-between h-36 bg-[#e6ebf4] dark:bg-[#0b1329] ${innerShadow} ${highlightBorder} group cursor-pointer`}
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
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Globe2 size={16} className="text-mystic-accent" />
            <span>Nền Tảng Vĩ Mô Cốt Tủy (Lớp 1)</span>
          </h3>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/10">Foundation Layer</span>
        </div>

        <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed flex items-start gap-2.5 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10">
          <span className="text-sm shrink-0">🛡️</span>
          <span>
            <strong>BỐI CẢNH VĨ MÔ:</strong> Định hình khung cốt tủy cố định không bao giờ thay biến về định luật vật lý/ma pháp, kỷ nguyên văn tự lịch sử thô sơ. AI sẽ bám chặt lấy lớp nền móng vĩ mô này trong suốt quá trình phân vai.
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
- Kỷ Sáng Thế (Năm 0 - 650): Thần minh khai quang lập nên lục địa.
- Kỷ Sương Mù (Năm 650 - nay): Thần sa cơ lụi tàn, sương lạnh trùm phủ phàm giới."
            description="Sắp xếp cột mốc thời gian vĩ đại tạo ra cán cân hiện thực xã hội câu chuyện hôm nay."
          />
        </div>
      </div>
    );
  };

  const renderWorldRegionalTab = () => {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Database size={16} className="text-mystic-accent" />
            <span>Khung Cấu Trúc Vùng Miền & Khế Ước (Lớp 2)</span>
          </h3>
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10">Regional Framework</span>
        </div>

        <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl text-[11px] text-slate-650 dark:text-slate-350 leading-relaxed flex items-start gap-2.5 shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/10">
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
          label="Móc Xích Phiêu Adventure Hooks" 
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
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
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



  const renderEntitiesTab = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
       <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-0.5 mb-1 flex items-center gap-2" style={{ fontFamily: 'Arial', lineHeight: '18px' }}>
          <Users size={18} className="text-mystic-accent" /> Danh Sách Thực Thể & NPC
       </h3>
       <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
             Thêm các nhân vật phụ hoặc địa danh quan trọng từ tác phẩm gốc.
          </p>
          <Button variant="primary" onClick={() => { setEditingEntityId(null); setShowEntityForm(true); }} icon={<Plus size={16} />}>
             Thêm thực thể
          </Button>
       </div>

       <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 custom-scrollbar pr-2">
            {state.entities.map(ent => (
                <div key={ent.id} className="bg-stone-100 dark:bg-slate-800 border border-stone-400 dark:border-slate-700 p-4 rounded-lg hover:border-mystic-accent/50 transition-colors group relative">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                ent.type === 'NPC' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 
                                ent.type === 'LOCATION' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 
                                ent.type === 'ITEM' ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200' :
                                'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                            }`}>
                                {ent.type}
                            </span>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{ent.name}</h4>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingEntityId(ent.id); setShowEntityForm(true); }} className="p-1 hover:text-mystic-accent"><Edit2 size={14}/></button>
                            <button onClick={() => store.removeEntity(ent.id)} className="p-1 hover:text-red-400"><Trash2 size={14}/></button>
                        </div>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{ent.description}</p>
                </div>
            ))}
            {state.entities.length === 0 && (
                <div className="col-span-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center h-32 text-slate-400 dark:text-slate-500">
                    Chưa có thực thể nào.
                </div>
            )}
       </div>
    </div>
  );

  const currentTabIndex = TABS.findIndex(t => t.id === state.currentTab);
  const nextTab = currentTabIndex < TABS.length - 1 ? TABS[currentTabIndex + 1].id : null;
  const prevTab = currentTabIndex > 0 ? TABS[currentTabIndex - 1].id : null;

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      {/* Background Layer */}
      {bgImage && (
        <>
          <div 
            className="absolute inset-0 z-0 transition-all duration-700"
            style={{ 
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `brightness(0.4) ${bgBlur ? 'blur(8px)' : 'blur(0px)'}`
            }}
          />
          <div className="absolute inset-0 z-0 bg-stone-100/30 dark:bg-black/40 backdrop-blur-[4px]" />
        </>
      )}

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
                Đồng Nhân Creator
            </h2>
            
            {/* Top Controls Block */}
            <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
              <button 
                onClick={() => setShowWorkSelector(true)}
                disabled={importedWorks.length === 0}
                title="Xem Lịch Sử" 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent disabled:opacity-40 transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/15 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                  <Clock size={14} /> <span className="hidden sm:inline">Lịch Sử</span>
              </button>

              <button 
                onClick={handleImportClick} 
                title="Nhập cấu hình" 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/15 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                  <Upload size={14} /> <span className="hidden sm:inline">Nhập</span>
              </button>
              
              <button 
                onClick={handleExportWorld} 
                title="Xuất cấu hình" 
                className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/15 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
              >
                  <Download size={14} /> <span className="hidden sm:inline">Xuất</span>
              </button>
              
              <button 
                onClick={() => setShowAiQuickFillModal(true)} 
                title="AI Khởi Tạo Nhanh Đồng Nhân" 
                className="text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3.5 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/15 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer animate-pulse"
              >
                  <Sparkles size={14} className="text-amber-550" /> <span>AI Tạo Nhanh</span>
              </button>

              <button 
                onClick={() => setShowAiKnowledgeModal(true)} 
                title="AI GEN KNOWLEDGE" 
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-all flex items-center gap-1.5 bg-[#e6ebf4] dark:bg-[#0b1329] p-2.5 px-3.5 rounded-2xl shadow-[4px_4px_8px_#cbd2df,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#030610,-4px_-4px_8px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] border border-[#cbd2df]/20 dark:border-[#142042]/15 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer animate-pulse"
              >
                  <Database size={14} className="text-emerald-555" /> <span>AI Gen Knowledge</span>
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
                    className={`w-11 h-11 md:w-13 md:h-13 rounded-2xl flex items-center justify-center transition-all duration-300 relative group cursor-pointer ${
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
               <div className="TEMPORARY_DELETED_CONTAINER hidden">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Original work IP/Name input */}
                 <div className="flex-1 w-full flex flex-col gap-2">
                     <div className="flex justify-between items-center px-1">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tác Phẩm Gốc</span>
                         <button 
                             onClick={() => setIsAnalysisCollapsed(!isAnalysisCollapsed)}
                             className="text-[10px] text-mystic-accent hover:underline transition-all flex items-center gap-1 cursor-pointer"
                         >
                             <FileText size={12}/> {isAnalysisCollapsed ? 'Phân Tích Tác Phẩm' : 'Ẩn Phân Tích'}
                         </button>
                     </div>
                     <div className="w-full bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 focus-within:border-mystic-accent/50 focus-within:shadow-[0_0_15px_rgba(56,189,248,0.15)] flex gap-3 items-center transition-all">
                        <div className="p-2 bg-mystic-accent/10 rounded-xl">
                            <Wand2 className="text-mystic-accent shrink-0" size={20} />
                        </div>
                        <input 
                           value={originalWorkName}
                           onChange={(e) => setOriginalWorkName(e.target.value)}
                           placeholder="Nhập IP/Tên Tác Phẩm (VD: Harry Potter, Genshin Impact)..."
                           className="flex-1 bg-transparent border-none text-sm font-medium text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
                        />
                     </div>
                 </div>

                 {/* Knowledge uploader block */}
                 <div className="flex-1 w-full flex flex-col gap-2">
                     <div className="flex items-center px-1">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Train Data / Knowledge</span>
                     </div>
                     <div className="w-full h-[54px] bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 border border-slate-200 dark:border-slate-800 flex items-center gap-3 transition-all">
                        <input 
                          type="file" 
                          id="knowledge-file-fanfic" 
                          className="hidden" 
                          accept=".txt,.md,.json,.csv"
                          onChange={handleKnowledgeUpload} 
                        />
                        {knowledgeFileName ? (
                          <div className="flex-1 flex items-center justify-between min-w-0 px-2 text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2 min-w-0">
                              <Database size={18} className="text-emerald-500 shrink-0" />
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{knowledgeFileName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{knowledgeFileSize}</span>
                              </div>
                            </div>
                            <button 
                              onClick={handleClearKnowledge} 
                              title="Xóa tài liệu"
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors ml-2 cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <label 
                            htmlFor="knowledge-file-fanfic" 
                            className="flex-1 flex items-center gap-2 px-2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          >
                            <Database size={18} className="text-slate-400 shrink-0" />
                            <span className="text-xs font-bold uppercase tracking-wider text-left">Tải lên Train Data / Knowledge...</span>
                          </label>
                        )}
                     </div>
                 </div>
               </div>

               {/* Action buttons row */}
               <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                 <Button 
                    variant="ghost" 
                    className="py-2.5 px-4 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 transition-all font-bold group rounded-xl" 
                    onClick={() => setShowWorkSelector(true)}
                    disabled={importedWorks.length === 0}
                 >
                    <div className="flex items-center justify-center gap-2">
                        <Clock size={14} className="group-hover:scale-110 transition-transform" />
                        Lịch Sử
                    </div>
                 </Button>

                 <Button 
                    variant="ghost" 
                    className="py-2.5 px-5 text-xs bg-gradient-to-br from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-all font-bold group rounded-xl" 
                    onClick={handleAutoFillAll}
                    isLoading={state.isGenerating && !state.generatingField && !isGeneratingFromKnowledge}
                 >
                    <div className="flex items-center justify-center gap-2">
                        <Sparkles size={14} className="group-hover:rotate-12 group-hover:scale-110 transition-transform text-amber-500" />
                        Tạo Nhanh Đồng Nhân
                    </div>
                 </Button>

                 <Button 
                    variant="ghost" 
                    className="py-2.5 px-5 text-xs bg-gradient-to-br from-emerald-500/10 to-green-500/10 hover:from-emerald-500/20 hover:to-green-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all font-bold group rounded-2xl disabled:opacity-50 disabled:grayscale cursor-pointer" 
                    disabled={!knowledgeContent || state.isGenerating}
                    onClick={handleWorldGenFromKnowledge}
                    isLoading={isGeneratingFromKnowledge}
                 >
                    <div className="flex items-center justify-center gap-2">
                        <Database size={14} className="group-hover:scale-110 transition-transform text-emerald-500" />
                        AI GEN KNOWLEDGE
                    </div>
                 </Button>
               </div>
            </div>


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
            
            {/* Bottom Action Bar */}
            <div className="p-4 md:p-6 bg-[#e6ebf4]/95 dark:bg-[#0b1329]/95 backdrop-blur-md border-t border-[#cbd2df]/30 dark:border-[#142042]/20 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 rounded-b-3xl">
               <div className="flex gap-2 w-full sm:w-auto">
                  {prevTab !== null ? (
                     <Button 
                        variant="ghost" 
                        className="flex-1 sm:flex-none py-3 px-5 text-sm font-semibold bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 transition-colors" 
                        onClick={() => store.setTab(prevTab)}
                     >
                        Quay Lại
                     </Button>
                  ) : (
                     <div className="w-0 sm:w-20" />
                   )}
                   
                  {nextTab !== null ? (
                     <Button 
                        variant="primary" 
                        className="flex-1 sm:flex-none py-3 px-5 text-sm font-semibold bg-gradient-to-r from-mystic-accent/90 to-blue-600/90 text-white hover:from-mystic-accent hover:to-blue-600 rounded-2xl transition-all shadow-md cursor-pointer" 
                        onClick={() => store.setTab(nextTab)}
                     >
                        Tiếp Tục
                     </Button>
                   ) : (
                     <div className="w-0" />
                   )}
               </div>

               <div className="hidden lg:flex items-center gap-4 bg-white dark:bg-slate-950 rounded-2xl p-2 px-4 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 hover:shadow-md">
                   <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                       <User size={14} className="text-mystic-accent shrink-0" />
                       <span className="font-bold max-w-[150px] truncate">{state.player.name || <span className="text-slate-400 font-normal italic">Chưa có VN</span>}</span>
                   </div>
                   <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800" />
                   <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                       <Compass size={14} className="text-mystic-accent shrink-0" />
                       <span className="font-bold max-w-[150px] truncate">{state.world.worldName || <span className="text-slate-400 font-normal italic">Chưa có bối cảnh</span>}</span>
                   </div>
               </div>

               <div className="w-full sm:w-auto sm:min-w-[240px]">
                  <Button 
                     variant="primary" 
                     className="w-full py-4 shadow-[0_4px_20px_rgba(56,189,248,0.25)] hover:shadow-[0_6px_25px_rgba(56,189,248,0.4)] hover:-translate-y-1 text-sm font-black uppercase tracking-widest bg-gradient-to-r from-mystic-accent to-blue-600 hover:from-blue-500 hover:to-mystic-accent transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group rounded-2xl cursor-pointer"
                     disabled={state.entities.length < 1 || !state.player.name || !state.world.worldName}
                     onClick={handleStartGame}
                  >
                     <div className="flex items-center justify-center gap-2">
                         <Play size={20} className="group-disabled:opacity-50 group-hover:translate-x-1 transition-transform fill-white" />
                         Tạo Trò Chơi
                     </div>
                  </Button>
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
        />
      )}

      {showWorkSelector && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20 backdrop-blur-[2px] animate-in fade-in duration-300">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowWorkSelector(false)} 
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative bg-white dark:bg-slate-900 w-full max-w-md h-full shadow-[-20px_0_50px_rgba(0,0,0,0.1)] border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
          >
            {/* Header - Minimal & Clean */}
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-mystic-accent/10 rounded-lg flex items-center justify-center">
                  <Sparkles className="text-mystic-accent" size={16} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white">Thư viện tác phẩm</h3>
              </div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    setImportedWorks([]);
                    setShowWorkSelector(false);
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Xóa tất cả"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  onClick={() => setShowWorkSelector(false)}
                  className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Search & Filters - Compact List Style */}
            <div className="p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Tìm kiếm tác phẩm..."
                  value={workSearchTerm}
                  onChange={(e) => setWorkSearchTerm(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs outline-none focus:ring-1 focus:ring-mystic-accent transition-all"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={workFilterCountry}
                  onChange={(e) => setWorkFilterCountry(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[10px] font-bold outline-none"
                >
                  <option value="All">Quốc gia</option>
                  {Array.from(new Set(importedWorks.map(w => w.country).filter(Boolean))).sort().map(c => (
                    <option key={c as string} value={c as string}>{c as string}</option>
                  ))}
                </select>
                <select
                  value={workFilterGenre}
                  onChange={(e) => setWorkFilterGenre(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[10px] font-bold outline-none"
                >
                  <option value="All">Thể loại</option>
                  {Array.from(new Set(importedWorks.map(w => w.genre).filter(Boolean))).sort().map(g => (
                    <option key={g as string} value={g as string}>{g as string}</option>
                  ))}
                </select>
                <select
                  value={workSortBy}
                  onChange={(e) => setWorkSortBy(e.target.value as 'title' | 'chars_desc' | 'chars_asc')}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 text-[10px] font-bold outline-none"
                >
                  <option value="title">Tên A-Z</option>
                  <option value="chars_desc">Nhiều NV</option>
                  <option value="chars_asc">Ít NV</option>
                </select>
              </div>
            </div>
            
            {/* List Content - Clean & Dense */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {importedWorks
                .filter(work => {
                  const matchesSearch = 
                    (work.title?.toLowerCase() || "").includes(workSearchTerm.toLowerCase()) || 
                    (work.description?.toLowerCase() || "").includes(workSearchTerm.toLowerCase());
                  const matchesCountry = workFilterCountry === 'All' || work.country === workFilterCountry;
                  const matchesGenre = workFilterGenre === 'All' || work.genre === workFilterGenre;
                  return matchesSearch && matchesCountry && matchesGenre;
                })
                .sort((a, b) => {
                  if (workSortBy === 'title') return (a.title || "").localeCompare(b.title || "");
                  if (workSortBy === 'chars_desc') return (b.characters?.length || 0) - (a.characters?.length || 0);
                  if (workSortBy === 'chars_asc') return (a.characters?.length || 0) - (b.characters?.length || 0);
                  return 0;
                })
                .map((work, idx) => (
                <button
                  key={work.id || idx}
                  onClick={() => applyWorkData(work)}
                  className="w-full flex flex-col p-5 border-b border-slate-50 dark:border-slate-800/50 hover:bg-mystic-accent/5 transition-all text-left group"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-mystic-accent transition-colors line-clamp-1 text-sm">
                      {work.title}
                    </h4>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-mystic-accent group-hover:translate-x-1 transition-all" />
                  </div>
                  
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                    {work.description || work.plot || "Không có mô tả."}
                  </p>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      <Users size={10} className="text-mystic-accent" />
                      <span>{work.characters?.length || 0} Nhân vật</span>
                    </div>
                    {work.genre && (
                      <span className="text-[9px] font-bold text-mystic-accent bg-mystic-accent/10 px-1.5 py-0.5 rounded">
                        {work.genre}
                      </span>
                    )}
                    {work.country && (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {work.country}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              
              {/* Empty State */}
              {importedWorks.length > 0 && importedWorks.filter(work => {
                  const matchesSearch = 
                    (work.title?.toLowerCase() || "").includes(workSearchTerm.toLowerCase());
                  const matchesCountry = workFilterCountry === 'All' || work.country === workFilterCountry;
                  const matchesGenre = workFilterGenre === 'All' || work.genre === workFilterGenre;
                  return matchesSearch && matchesCountry && matchesGenre;
                }).length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 px-10 text-center">
                  <Search size={32} className="mb-4 opacity-10" />
                  <p className="text-sm font-medium">Không tìm thấy tác phẩm phù hợp</p>
                  <button 
                    onClick={() => { setWorkSearchTerm(''); setWorkFilterCountry('All'); setWorkFilterGenre('All'); }}
                    className="mt-4 text-[11px] font-bold text-mystic-accent hover:underline uppercase tracking-widest"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              )}
            </div>

            {/* Footer - Subtle Stats */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 font-medium text-center uppercase tracking-[0.2em]">
                Chọn một tác phẩm để áp dụng dữ liệu
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* AI Quick Creation Modal */}
      <AnimatePresence>
        {showAiQuickFillModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-xl bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/35 dark:border-[#142042]/20 rounded-3xl p-6 shadow-[15px_15px_30px_rgba(0,0,0,0.1),-15px_-15px_30px_rgba(255,255,255,0.7)] dark:shadow-[15px_15px_30px_rgba(0,0,0,0.4),-15px_-15px_30px_rgba(255,255,255,0.02)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-500 animate-pulse" /> AI Khởi Tạo Nhanh Đồng Nhân
                </h3>
                <button 
                  onClick={() => setShowAiQuickFillModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-slate-500 hover:text-red-500 transition-all cursor-pointer border border-[#cbd2df]/20 dark:border-[#142042]/10"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-5">
                {/* Original Work Name */}
                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] border border-[#cbd2df]/10 dark:border-[#142042]/5 flex flex-col gap-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">💡 Tên Tác Phẩm Gốc (IP)</label>
                  <input 
                    value={originalWorkName}
                    onChange={(e) => setOriginalWorkName(e.target.value)}
                    placeholder="Ví dụ: Harry Potter, Genshin Impact, Naruto..."
                    className="w-full bg-[#e6ebf4]/20 dark:bg-[#0b1329]/20 border border-[#cbd2df]/35 dark:border-[#142042]/20 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-mystic-accent transition-all"
                  />
                </div>

                {/* Original Content text area */}
                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] border border-[#cbd2df]/10 dark:border-[#142042]/5 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">📝 Nội Dung Phân Tích (Tùy Chọn)</label>
                    <div className="flex gap-2">
                      <input type="file" ref={txtFileInputRef} onChange={handleTxtFileChange} accept=".txt" className="hidden" />
                      <button 
                        onClick={() => txtFileInputRef.current?.click()}
                        className="text-[10px] py-1 px-2.5 font-bold bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] hover:text-mystic-accent transition-colors cursor-pointer border border-[#cbd2df]/20 dark:border-[#142042]/10 rounded-lg flex items-center gap-1"
                      >
                        <Upload size={11} /> Tải TXT
                      </button>
                    </div>
                  </div>
                  <textarea 
                    value={originalContent}
                    onChange={(e) => setOriginalContent(e.target.value)}
                    placeholder="Dán nội dung, tóm tắt chương hoặc đoạn văn bối cảnh chính để AI phân tích chuẩn xác bối cảnh..."
                    className="w-full h-32 bg-[#e6ebf4]/20 dark:bg-[#0b1329]/20 border border-[#cbd2df]/35 dark:border-[#142042]/20 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-200 focus:border-mystic-accent focus:ring-1 focus:ring-mystic-accent outline-none resize-none custom-scrollbar"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowAiQuickFillModal(false)}
                    className="py-2 px-5 text-xs font-bold bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-slate-600 dark:text-slate-400 rounded-xl hover:text-red-500 transition-all cursor-pointer border border-[#cbd2df]/10 dark:border-[#142042]/5"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      if (originalContent.trim() && !isAnalyzing) {
                        await handleAnalyze();
                      }
                      await handleAutoFillAll();
                      setShowAiQuickFillModal(false);
                    }}
                    disabled={state.isGenerating || !originalWorkName.trim()}
                    className="py-2 px-5 text-xs font-black uppercase tracking-wider bg-gradient-to-br from-mystic-accent to-blue-600 text-white rounded-xl flex items-center gap-2 transition-all disabled:opacity-40 disabled:grayscale cursor-pointer shadow-[0_4px_12px_rgba(56,189,248,0.2)] hover:shadow-[0_4px_16px_rgba(56,189,248,0.35)]"
                  >
                    <Sparkles size={13} className="text-white fill-white animate-pulse" />
                    <span>{state.isGenerating ? "Đang Khởi Tạo..." : "Khởi Tạo"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Knowledge Base Modal */}
      <AnimatePresence>
        {showAiKnowledgeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-xl bg-[#e6ebf4] dark:bg-[#0b1329] border border-[#cbd2df]/35 dark:border-[#142042]/20 rounded-3xl p-6 shadow-[15px_15px_30px_rgba(0,0,0,0.1),-15px_-15px_30px_rgba(255,255,255,0.7)] dark:shadow-[15px_15px_30px_rgba(0,0,0,0.4),-15px_-15px_30px_rgba(255,255,255,0.02)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Database size={18} className="text-[#10b981] animate-pulse" /> AI GEN KNOWLEDGE
                </h3>
                <button 
                  onClick={() => setShowAiKnowledgeModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-slate-500 hover:text-red-500 transition-all cursor-pointer border border-[#cbd2df]/20 dark:border-[#142042]/10"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-5">
                {/* Knowledge File Upload Zone */}
                <div className="p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_3px_3px_6px_#cbd2df,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#030610,inset_-3px_-3px_6px_#142042] border border-[#cbd2df]/10 dark:border-[#142042]/5 flex flex-col gap-2">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">📂 Tải Lên Hồ Sơ Tri Thức (Train Data / Knowledge Base)</label>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium line-clamp-2">
                    Bổ sung tệp tài liệu bối cảnh của riêng bạn (TXT, MD, JSON, CSV). AI sẽ lấy làm nền tảng tri thức chuẩn sinh ra toàn bộ thế giới đồng nhân!
                  </p>
                  
                  <div className="w-full h-24 border-2 border-dashed border-[#cbd2df]/50 dark:border-[#142042]/45 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl flex items-center justify-center bg-[#e6ebf4]/20 dark:bg-[#0b1329]/20 transition-all p-4 relative">
                    <input 
                      type="file" 
                      id="knowledge-file-popup" 
                      className="hidden" 
                      accept=".txt,.md,.json,.csv"
                      onChange={handleKnowledgeUpload} 
                    />
                    {knowledgeFileName ? (
                      <div className="flex items-center justify-between w-full px-4 text-left">
                        <div className="flex items-center gap-3">
                          <Database size={24} className="text-emerald-500 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[280px]">{knowledgeFileName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{knowledgeFileSize}</span>
                          </div>
                        </div>
                        <button 
                          onClick={handleClearKnowledge} 
                          className="py-1 px-2.5 bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[2px_2px_4px_#cbd2df,-2px_-2px_4px_#ffffff] dark:shadow-[2px_2px_4px_#030610,-2px_-2px_4px_#142042] hover:text-red-500 transition-colors border border-[#cbd2df]/20 dark:border-[#142042]/10 rounded-xl cursor-pointer text-[10px] font-bold"
                        >
                          Xóa
                        </button>
                      </div>
                    ) : (
                      <label 
                        htmlFor="knowledge-file-popup" 
                        className="flex flex-col items-center gap-2 cursor-pointer text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors text-center w-full h-full justify-center"
                      >
                        <Upload size={24} className="mb-0.5 text-slate-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Tải lên Train Data / Knowledge...</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowAiKnowledgeModal(false)}
                    className="py-2 px-5 text-xs font-bold bg-[#e6ebf4] dark:bg-[#0b1329] shadow-[3px_3px_6px_#cbd2df,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#030610,-3px_-3px_6px_#142042] active:shadow-[inset_2px_2px_4px_#cbd2df,inset_-2px_-2px_4px_#ffffff] dark:active:shadow-[inset_2px_2px_4px_#030610,inset_-2px_-2px_4px_#142042] text-slate-600 dark:text-slate-400 rounded-xl hover:text-red-500 transition-all cursor-pointer border border-[#cbd2df]/10 dark:border-[#142042]/5"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={async () => {
                      await handleWorldGenFromKnowledge();
                      setShowAiKnowledgeModal(false);
                    }}
                    disabled={!knowledgeContent || state.isGenerating}
                    className="py-2.5 px-6 text-xs font-black uppercase tracking-wider bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl flex items-center gap-2 transition-all disabled:opacity-40 disabled:grayscale cursor-pointer shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.35)]"
                  >
                    <Sparkles size={13} className="text-white fill-white animate-pulse" />
                    <span>{state.isGenerating ? "Sáng Tạo..." : "Khởi Tạo"}</span>
                  </button>
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
            <label className="text-sm font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">{label}</label>
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
                        <span className="animate-spin block w-2.5 h-2.5 border-2 border-mystic-accent border-t-transparent rounded-full" />
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
    <div className="flex flex-col gap-0.5">
        <label className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 text-center">{label}</label>
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
            className="w-full bg-stone-100 dark:bg-mystic-900 border border-stone-400 dark:border-slate-700 rounded p-1 text-stone-900 dark:text-slate-100 outline-none focus:border-mystic-accent text-center text-xs font-mono"
        />
    </div>
);

const TextAreaGroup = ({ label, value, onChange, onAi, height = 'h-24', loading = false, placeholder, description }: { label: string, value: string, onChange: (v: string) => void, onAi?: () => void, height?: string, loading?: boolean, placeholder?: string, description?: string }) => {
    const [isPreview, setIsPreview] = useState(false);
    
    return (
        <div className="relative flex flex-col mb-4 p-4 bg-[#e6ebf4] dark:bg-[#0b1329] rounded-2xl shadow-[inset_4px_4px_8px_#cbd2df,inset_-4px_-4px_8px_#ffffff] dark:shadow-[inset_4px_4px_8px_#030610,inset_4px_4px_8px_#142042] border border-[#cbd2df]/30 dark:border-[#142042]/15">
            <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">{label}</label>
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
                            <span className="animate-spin block w-2.5 h-2.5 border-2 border-mystic-accent border-t-transparent rounded-full" />
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
                    className={`w-full bg-transparent px-1 py-1 text-slate-900 dark:text-slate-100 outline-none text-xs font-semibold resize-none focus:ring-0 custom-scrollbar ${height}`}
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

export default FanficScreen;
