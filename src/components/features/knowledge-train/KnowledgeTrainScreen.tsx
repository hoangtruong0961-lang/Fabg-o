import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService, DEFAULT_SETTINGS } from '../../../services/db/indexedDB';
import { vectorService } from '../../../services/ai/vectorService';
import { GraphRAGService } from '../../../services/ai/graph/GraphRAGService';
import { AppSettings, GameState, NavigationProps, StoredCharacter } from '../../../types';
import { ChevronLeft, FileText, Settings, Upload, Play, CheckCircle, Trash2, StopCircle, HardDrive, Cpu, Sparkles, BookOpen, GitBranch, Share2, Network, ArrowRight } from 'lucide-react';
import Button from '../../ui/Button';

// Smart sentence-boundary chunker
const chunkTextSmart = (text: string, wordsPerChunk: number, overlapWords: number) => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks: string[] = [];
  let i = 0;
  
  while (i < words.length) {
    let limit = Math.min(i + wordsPerChunk, words.length);
    
    // Attempt to locate a sentence breaker near the limit to avoid mid-phrase fragmentation
    if (limit < words.length) {
      let boundaryIndex = -1;
      const lookbackWindow = Math.max(10, Math.floor(wordsPerChunk * 0.2)); // up to 20% lookback
      
      const boundaryPunctuation = ['.', '?', '!', ';'];
      for (let j = limit; j > limit - lookbackWindow && j > i; j--) {
        const lastChar = words[j - 1]?.slice(-1);
        if (boundaryPunctuation.includes(lastChar) || words[j - 1]?.includes('\n')) {
          boundaryIndex = j;
          break;
        }
      }
      
      if (boundaryIndex !== -1) {
        limit = boundaryIndex;
      }
    }
    
    const chunkWords = words.slice(i, limit);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
    
    // Advance next start offset with safety boundary
    const stepSize = wordsPerChunk - overlapWords;
    if (stepSize <= 0) {
      i = limit;
    } else {
      const nextI = limit - overlapWords;
      if (nextI <= i) {
        i = limit; // Force advance to the chunk's end to avoid infinite loop
      } else {
        i = nextI;
      }
    }
  }
  return chunks;
};

// Simple text chunker (Fallback legacy)
const chunkTextLegacy = (text: string, wordsPerChunk: number, overlapWords: number) => {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunkWords = words.slice(i, i + wordsPerChunk);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
    i += (wordsPerChunk - overlapWords);
    if (wordsPerChunk - overlapWords <= 0) break;
  }
  return chunks;
};

// Text cleaning/denoising logic
const cleanTextData = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n') // Unify line endings
    .replace(/\n{3,}/g, '\n\n') // Flatten extensive spacing
    .replace(/[ \t]+/g, ' ') // Collapse horizontal double-spaces
    .trim();
};

export default function KnowledgeTrainScreen({ onNavigate }: NavigationProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [files, setFiles] = useState<File[]>([]);
  const [storyName, setStoryName] = useState('');
  const [wordsPerChunk, setWordsPerChunk] = useState(500);
  const [overlapWords, setOverlapWords] = useState(50);
  
  // Advanced Optimization States
  const [enableSmartChunking, setEnableSmartChunking] = useState(true);
  const [denoiseText, setDenoiseText] = useState(true);
  const [saveToLocalStore, setSaveToLocalStore] = useState(true);
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('global');

  // Sub-Strategy State Variables
  const [chunkingStrategy, setChunkingStrategy] = useState<'parent-child' | 'standard'>('parent-child');
  const [wordsPerChild, setWordsPerChild] = useState(120);
  const [useLangGraph, setUseLangGraph] = useState(true);

  // LangGraph pipeline live states
  const [activeLangGraphNode, setActiveLangGraphNode] = useState<string | null>(null);
  const [langGraphNodeStatus, setLangGraphNodeStatus] = useState<Record<string, 'idle' | 'running' | 'completed'>>({
    initialize: 'idle',
    clean_text: 'idle',
    sieve_slices: 'idle',
    extract_meta: 'idle',
    link_relations: 'idle'
  });
  const [liveEntities, setLiveEntities] = useState<{ name: string; label: string; description: string }[]>([]);
  const [liveEdges, setLiveEdges] = useState<{ source: string; target: string; relationship: string; description?: string }[]>([]);

  const [logs, setLogs] = useState<string[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef<boolean>(false);

  const [bgImage, setBgImage] = useState<string | null>("https://i.ibb.co/cS6YkxK1/f0c7caebe311a0c1e0e5e7a3ca5599e7.jpg");
  const bgBlur = dbService.getKeyValueSync('ark_v2_bg_blur') !== false && dbService.getKeyValueSync('ark_v2_bg_blur') !== 'false';

  useEffect(() => {
    dbService.getSettings().then(s => {
      if (s) setSettings(s);
    });

    dbService.getAllCharacters().then(chars => {
      if (chars) {
        setCharacters(chars);
      }
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
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      if (e.target.files.length > 0 && !storyName) {
         setStoryName(e.target.files[0].name.replace('.txt', ''));
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addLog = (msg: string) => {
    setLogs(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`];
      return newLogs.length > 100 ? newLogs.slice(newLogs.length - 100) : newLogs;
    });
  };

  const startTraining = async () => {
    if (files.length === 0) {
      addLog("Lỗi: Vui lòng chọn ít nhất 1 file TXT.");
      return;
    }
    if (!storyName.trim()) {
      addLog("Lỗi: Vui lòng nhập Tên Story.");
      return;
    }

    setIsTraining(true);
    isCancelledRef.current = false;
    setLogs([]);
    setLiveEntities([]);
    setLiveEdges([]);
    setLangGraphNodeStatus({
      initialize: 'idle',
      clean_text: 'idle',
      sieve_slices: 'idle',
      extract_meta: 'idle',
      link_relations: 'idle'
    });
    setActiveLangGraphNode(null);

    addLog(`🚀 Khởi động quy trình Train Dữ Liệu Toàn Diện ...`);
    addLog(`📁 Đang xử lý ${files.length} tệp tin văn bản nguồn.`);

    try {
      let combinedText = '';
      for (const file of files) {
        addLog(`📖 Đang tiến hành đọc: ${file.name}...`);
        const text = await file.text();
        combinedText += text + '\n\n';
      }

      if (denoiseText) {
        addLog("✨ Đang khử nhiễu văn bản thô (Chuẩn hóa xuống dòng, loại bỏ khoảng trắng thừa)...");
        combinedText = cleanTextData(combinedText);
      }

      const totalWords = combinedText.split(/\s+/).filter(w => w.length > 0).length;
      addLog(`📊 Tổng lượng từ vựng khả thi: ${totalWords} từ.`);

      // Generate Parent chunks based on wordsPerChunk (e.g. 600 words)
      const parentChunks = enableSmartChunking 
        ? chunkTextSmart(combinedText, wordsPerChunk, overlapWords)
        : chunkTextLegacy(combinedText, wordsPerChunk, overlapWords);

      addLog(`🧩 Chiến lược: ${chunkingStrategy === 'parent-child' ? "Truy xuất cấu trúc Parent-Child [Được đề xuất]" : "Truy xuất Thô Standard Chunks"}`);
      addLog(`📦 Chia thành: ${parentChunks.length} phân đoạn cha (Parent, Max Words: ${wordsPerChunk}, Overlapping: ${overlapWords}).`);

      setProgress({ current: 0, total: parentChunks.length });

      const embeddedData: any[] = [];
      let successCount = 0;
      let failCount = 0;

      const targetDocId = selectedCharacterId === 'global' ? storyName : selectedCharacterId;

      if (saveToLocalStore) {
        addLog(`🧹 Đang dọn dẹp các vector kiến thức cũ cùng định danh (${targetDocId}) khỏi IndexedDB để ghi đè...`);
        try {
          await dbService.deleteVectorsByDocId(targetDocId);
          addLog(`✅ Đã làm sạch các phân đoạn vector lưu trữ cũ.`);
        } catch (e: any) {
          addLog(`⚠️ Cảnh báo dọn dẹp cũ: ${e.message}`);
        }
      }

      // Loop over parent chunks
      for (let pIdx = 0; pIdx < parentChunks.length; pIdx++) {
        // Yield to main thread to prevent UI freezing and tab crash
        await new Promise(resolve => setTimeout(resolve, 0));

        if (isCancelledRef.current) {
          addLog("🛑 Tiến trình training đã bị dừng bởi người dùng.");
          break;
        }

        const parentText = parentChunks[pIdx];
        const parentChunkId = `${storyName.replace(/\s+/g, '_')}_parent_${pIdx}`;
        addLog(`\n━━━━━━━━━━ [PHẦN ĐOẠN ${pIdx + 1}/${parentChunks.length}] ━━━━━━━━━━`);

        // LangGraph metadata & relationship extraction state flow
        let entities: any[] = [];
        let edges: any[] = [];

        if (useLangGraph) {
          addLog(`🤖 Kích hoạt quy trình LangGraph Metadata flow cho phân đoạn ${pIdx + 1}...`);
          try {
            const results = await GraphRAGService.runLangGraphMetadataFlow(
              parentText,
              targetDocId,
              settings,
              (node, status, data) => {
                setActiveLangGraphNode(node);
                setLangGraphNodeStatus(prev => ({ ...prev, [node]: status }));
                if (status === 'completed' && data) {
                  if (node === 'extract_meta' && data.entities) {
                    setLiveEntities(prev => [...prev, ...data.entities].slice(-30)); // retain last 30 for visualization
                  }
                  if (node === 'link_relations' && data.edges) {
                    setLiveEdges(prev => [...prev, ...data.edges].slice(-30));
                  }
                }
              }
            );
            entities = results.entities;
            edges = results.edges;
            addLog(`🧬 LangGraph hoàn tất: Trích xuất ${entities.length} thực thể, kết nối ${edges.length} quan hệ.`);
          } catch (err: any) {
            addLog(`⚠️ Lỗi chạy luồng LangGraph: ${err.message}. Tiếp tục quy trình sao lưu RAG.`);
          }
        }

        if (chunkingStrategy === 'parent-child') {
          // Parent-Child chunking
          // 1. Split parent into child sub-chunks (e.g. 120 words)
          const childTexts = enableSmartChunking
            ? chunkTextSmart(parentText, wordsPerChild, Math.floor(wordsPerChild * 0.15))
            : chunkTextLegacy(parentText, wordsPerChild, Math.floor(wordsPerChild * 0.15));

          addLog(`🧬 Phân lập thành ${childTexts.length} phân đoạn con (Child Chunks, cỡ ~${wordsPerChild} từ)...`);

          // 2. Save Parent Header Vector (has metadata, no embedding or empty to save API cost)
          if (saveToLocalStore) {
            await dbService.saveVector({
              id: parentChunkId,
              text: parentText,
              embedding: new Array(768).fill(0), // Dummy container embed
              timestamp: Date.now(),
              role: 'novel_source',
              docId: targetDocId,
              category: 'lore',
              isParent: true,
              childIds: childTexts.map((_, cIdx) => `${parentChunkId}_child_${cIdx}`),
              tags: entities.map(e => e.name),
              relatedEntries: entities.map(e => e.name)
            });
          }

          // 3. Generate Embeddings for each child chunk and link them to parent
          for (let cIdx = 0; cIdx < childTexts.length; cIdx++) {
            const childText = childTexts[cIdx];
            const childId = `${parentChunkId}_child_${cIdx}`;
            
            try {
              const embedding = await vectorService.getEmbedding(childText, settings);
              if (embedding) {
                const embeddedItem = {
                  id: childId,
                  text: childText,
                  embedding,
                  meta: {
                    story: storyName,
                    parentId: parentChunkId,
                    childIndex: cIdx
                  }
                };
                embeddedData.push(embeddedItem);
                successCount++;

                if (saveToLocalStore) {
                  await dbService.saveVector({
                    id: childId,
                    text: childText,
                    embedding,
                    timestamp: Date.now(),
                    role: 'novel_source',
                    docId: targetDocId,
                    category: 'lore',
                    parentId: parentChunkId
                  });
                }
              } else {
                failCount++;
              }
            } catch (err: any) {
              failCount++;
              addLog(`⚠️ Thất bại tạo child embed ${cIdx + 1}: ${err.message}`);
            }
          }
        } else {
          // Standard traditional chunking (old behavior)
          try {
            const embedding = await vectorService.getEmbedding(parentText, settings);
            if (embedding) {
              const embeddedItem = {
                id: parentChunkId,
                text: parentText,
                embedding,
                meta: {
                  story: storyName,
                  chunkIndex: pIdx
                }
              };
              embeddedData.push(embeddedItem);
              successCount++;

              if (saveToLocalStore) {
                await dbService.saveVector({
                  id: parentChunkId,
                  text: parentText,
                  embedding,
                  timestamp: Date.now(),
                  role: 'novel_source',
                  docId: targetDocId,
                  category: 'lore',
                  tags: entities.map(e => e.name),
                  relatedEntries: entities.map(e => e.name)
                });
              }
            } else {
              failCount++;
            }
          } catch (err: any) {
            failCount++;
            addLog(`⚠️ Thất bại tạo standard chunk embed: ${err.message}`);
          }
        }

        setProgress(prev => ({ ...prev, current: pIdx + 1 }));
      }

      if (!isCancelledRef.current) {
        addLog(`\n🎉 Quy trình hoàn tất! Thành công: ${successCount} phân đoạn con, Thất bại: ${failCount}.`);
        
        if (saveToLocalStore && successCount > 0) {
          addLog(`💾 [DATABASE] Đã đồng bộ thành công các vector Parent-Child và LangGraph Metadata vào IndexedDB.`);
          addLog(`💬 Trạng thái: SẴN SÀNG. Nhân vật ${selectedCharacterId === 'global' ? `liên kết với kịch bản "${storyName}"` : `"${characters.find(c => c.id === selectedCharacterId)?.name}"`} sẽ tự động truy xuất đa cấp Parent-Child và mở rộng ngữ án Graph RAG khi đàm thoại!`);
        }

        addLog(`📂 Đang xuất tệp lưu trữ rời JSON chứa kết quả phân tích...`);
        exportData(embeddedData);
        
        embeddedData.length = 0;
        addLog("🧹 Đã dọn dẹp bộ nhớ đệm tạm thời.");
        addLog("✨ Hệ thống RAG thông suốt mĩ mãn!");
      }

    } catch (err: any) {
       addLog(`❌ Hệ thống gặp sự cố bất ngờ: ${err.message}`);
    } finally {
       setIsTraining(false);
       setActiveLangGraphNode(null);
    }
  };

  const exportData = (data: any[]) => {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `Knowledge_${storyName.replace(/\s+/g, '_')}_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        addLog("✅ Đã xuất tệp tin JSON tải xuống thành công.");
    } catch(err) {
        addLog("❌ Lỗi xuất dữ liệu kéo xuống hoặc hỗ trợ trình duyệt: " + err);
    }
  };

  const stopTraining = () => {
    isCancelledRef.current = true;
  };

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
              filter: `brightness(0.3) ${bgBlur ? 'blur(8px)' : 'blur(0px)'}`
            }}
          />
          <div className="absolute inset-0 z-0 bg-stone-100/30 dark:bg-black/50 backdrop-blur-[4px]" />
        </>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-8 relative z-10 w-full overflow-hidden mt-safe">
        {/* Header */}
        <div className="w-full max-w-5xl flex items-center justify-between mb-4 mt-2">
          <div className="w-32 flex justify-start">
            <button 
              onClick={() => onNavigate(GameState.MENU)} 
              disabled={isTraining} 
              className="text-slate-600 dark:text-slate-300 hover:text-mystic-accent transition-colors flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl backdrop-blur-md shadow-sm border border-slate-200 dark:border-slate-800 disabled:opacity-50"
            >
              <ChevronLeft size={18} /> <span className="hidden sm:inline font-bold uppercase tracking-wider text-xs">Menu</span>
            </button>
          </div>
          <h2 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white drop-shadow-md tracking-[0.2em] uppercase font-serif text-center flex-1">
              Train Knowledge base
          </h2>
          <div className="w-32 flex justify-end" />
        </div>

        {/* Dynamic Wizard Card */}
        <div className="w-full max-w-5xl flex-1 flex flex-col bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl min-h-0 mx-auto p-4 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Section */}
            <div className="space-y-4 bg-stone-100/40 dark:bg-slate-900/40 p-6 rounded-2xl border border-stone-200 dark:border-white/5 backdrop-blur-md">
              <h2 className="font-bold text-mystic-accent uppercase tracking-widest text-xs flex items-center gap-2">
                 <FileText size={16} /> 1. Dữ liệu văn bản nguồn
              </h2>
              
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Chọn file TXT từ máy</label>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".txt"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isTraining}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full justify-center bg-mystic-accent text-mystic-950 font-bold"
                  disabled={isTraining}
                >
                  <Upload size={16} className="mr-2" /> Chọn files (.txt)
                </Button>
              </div>

              {files.length > 0 && (
                <div className="bg-stone-200/50 dark:bg-slate-800/50 p-3 rounded-lg border border-stone-300 dark:border-white/5">
                  <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-bold font-mono">Files đã tải ({files.length})</div>
                  <ul className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {files.map((f, idx) => (
                      <li key={idx} className="flex items-center justify-between text-xs bg-stone-300/80 dark:bg-slate-900/80 px-3 py-2 rounded-md">
                        <span className="truncate max-w-[180px] text-stone-900 dark:text-slate-300">{f.name}</span>
                        <button onClick={() => removeFile(idx)} disabled={isTraining} className="text-red-500 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-bold font-mono">Đặt tên kịch bản / Story Name</label>
                <input 
                  type="text" 
                  value={storyName}
                  onChange={(e) => setStoryName(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-[#0a0f1d] border border-stone-300 dark:border-mystic-accent/30 rounded-lg px-4 py-2.5 text-xs text-stone-900 dark:text-slate-200 focus:outline-none focus:border-mystic-accent transition-colors font-semibold"
                  placeholder="Ví dụ: world_lore, bieu_cam_game..."
                  disabled={isTraining}
                />
              </div>

              {/* Dynamic character locking */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-bold font-mono">Liên kết với nhân vật nào?</label>
                <select
                  value={selectedCharacterId}
                  onChange={(e) => {
                    setSelectedCharacterId(e.target.value);
                    if (e.target.value !== 'global') {
                      const found = characters.find(c => c.id === e.target.value);
                      if (found && !storyName) {
                        setStoryName(found.name.replace(/\s+/g, '_') + '_knowledge');
                      }
                    }
                  }}
                  className="w-full bg-stone-50 dark:bg-[#0a0f1d] border border-stone-300 dark:border-slate-800 rounded-lg px-3 py-2.5 text-xs text-stone-900 dark:text-slate-200 focus:outline-none focus:border-mystic-accent font-semibold"
                  disabled={isTraining}
                >
                  <option value="global">Không liên kết riêng (Chia sẻ chung toàn hệ thống)</option>
                  {characters.map(char => (
                    <option key={char.id} value={char.id}>Nhân vật: {char.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  Đồng bộ bộ nhớ riêng để khi chat với nhân vật ấy, AI sẽ ưu tiên gọi ý thức kiến thức này.
                </p>
              </div>
            </div>

            {/* Settings Section */}
            <div className="space-y-4 bg-stone-100/40 dark:bg-slate-900/40 p-6 rounded-2xl border border-stone-200 dark:border-white/5 backdrop-blur-md flex flex-col justify-between">
              <div className="space-y-4">
                <h2 className="font-bold text-mystic-accent uppercase tracking-widest text-xs flex items-center gap-2">
                   <Settings size={16} /> 2. Cấu hình Retrieval & Chunking
                </h2>

                {/* Strategy Selector */}
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold font-mono">Chiến lược phân mảnh (Strategy)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setChunkingStrategy('parent-child')}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                        chunkingStrategy === 'parent-child'
                          ? 'bg-mystic-accent/15 border-mystic-accent text-mystic-accent shadow-[0_0_12px_rgba(244,63,94,0.1)]'
                          : 'bg-stone-50 dark:bg-[#0a0f1d] border-stone-200 dark:border-slate-800 text-slate-500 hover:text-slate-700'
                      }`}
                      disabled={isTraining}
                    >
                      Parent-Child Chunking
                    </button>
                    <button
                      type="button"
                      onClick={() => setChunkingStrategy('standard')}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border transition-all ${
                        chunkingStrategy === 'standard'
                          ? 'bg-mystic-accent/15 border-mystic-accent text-mystic-accent shadow-[0_0_12px_rgba(244,63,94,0.1)]'
                          : 'bg-stone-50 dark:bg-[#0a0f1d] border-stone-200 dark:border-slate-800 text-slate-500 hover:text-slate-700'
                      }`}
                      disabled={isTraining}
                    >
                      Standard Chunking
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-bold">
                      {chunkingStrategy === 'parent-child' ? 'Đoạn Cha (Parent words)' : 'Độ dài đoạn (Words)'}
                    </label>
                    <input 
                      type="number"
                      value={wordsPerChunk}
                      onChange={(e) => setWordsPerChunk(parseInt(e.target.value) || 500)}
                      min={50}
                      className="w-full bg-stone-50 dark:bg-[#0a0f1d] border border-stone-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold"
                      disabled={isTraining}
                    />
                  </div>

                  {chunkingStrategy === 'parent-child' ? (
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-bold">Đoạn Con (Child words)</label>
                      <input 
                        type="number"
                        value={wordsPerChild}
                        onChange={(e) => setWordsPerChild(Math.min(wordsPerChunk - 1, parseInt(e.target.value) || 120))}
                        min={10}
                        max={wordsPerChunk - 1}
                        className="w-full bg-stone-50 dark:bg-[#0a0f1d] border border-stone-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold"
                        disabled={isTraining}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-bold">Từ trùng lặp (Overlap)</label>
                      <input 
                        type="number"
                        value={overlapWords}
                        onChange={(e) => setOverlapWords(parseInt(e.target.value) || 50)}
                        min={0}
                        max={wordsPerChunk - 1}
                        className="w-full bg-stone-50 dark:bg-[#0a0f1d] border border-stone-300 dark:border-slate-700/50 rounded-lg px-3 py-2 text-xs text-stone-900 dark:text-slate-200 outline-none font-semibold"
                        disabled={isTraining}
                      />
                    </div>
                  )}
                </div>

                {/* Highly advanced matching configurations */}
                <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={enableSmartChunking}
                      onChange={(e) => setEnableSmartChunking(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-slate-700 text-mystic-accent focus:ring-mystic-accent bg-slate-950 w-4 h-4"
                    />
                    <span className="text-xs text-stone-800 dark:text-slate-300 font-medium">Bật Chém Chữ Đọc Câu Thông Minh (Ưu tiên ngắt câu)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={denoiseText}
                      onChange={(e) => setDenoiseText(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-slate-700 text-mystic-accent focus:ring-mystic-accent bg-slate-950 w-4 h-4"
                    />
                    <span className="text-xs text-stone-800 dark:text-slate-300 font-medium">Khử Nhiễu văn bản (Khoảng trắng, dòng trống thừa)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={useLangGraph}
                      onChange={(e) => setUseLangGraph(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-slate-700 text-mystic-accent focus:ring-mystic-accent bg-slate-950 w-4 h-4"
                    />
                    <span className="text-xs text-mystic-accent font-semibold flex items-center gap-1">
                      <Network size={14} /> Chạy luồng đồ thị trạng thái LangGraph AI Metadata
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={saveToLocalStore}
                      onChange={(e) => setSaveToLocalStore(e.target.checked)}
                      disabled={isTraining}
                      className="rounded border-slate-700 text-mystic-accent focus:ring-mystic-accent bg-slate-950 w-4 h-4"
                    />
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">Đồng bộ trực tiếp Vector vào bộ nhớ Game</span>
                  </label>
                </div>

                <div className="p-3.5 bg-mystic-accent/5 border border-mystic-accent/15 rounded-xl text-xs">
                   <h3 className="text-[10px] uppercase tracking-widest text-mystic-accent mb-0.5 font-bold flex items-center gap-1 font-sans">
                     <Sparkles size={12} /> Chiến lược bồi đắp ngữ diệu
                   </h3>
                   <p className="text-[11px] text-slate-800 dark:text-slate-300 font-medium leading-relaxed">
                     {chunkingStrategy === 'parent-child' 
                       ? "Sử dụng Parent-Child giúp tìm kiếm chính xác theo các câu thoại ngắn (Child) nhưng bơm tải toàn bộ đoạn văn cảnh (Parent) vào bộ não GPT để giữ trọn vẹn văn phong."
                       : "Sử dụng Standard trả về đúng đoạn tìm thấy có sự tương hợp cao, phù hợp với tài liệu tham khảo rời rạc."}
                   </p>
                </div>
              </div>

              <div className="pt-4">
                {!isTraining ? (
                  <Button 
                    onClick={startTraining} 
                    className="w-full justify-center bg-green-500 hover:bg-green-600 text-green-950 font-black tracking-widest py-3 rounded-xl shadow-lg shadow-green-500/10 active:scale-[0.98] transition-transform uppercase text-xs font-sans"
                  >
                    <Play size={16} className="mr-2" /> Bắt đầu Train Kiến Thức
                  </Button>
                ) : (
                  <Button 
                    onClick={stopTraining} 
                    className="w-full justify-center bg-red-500 hover:bg-red-600 text-white font-black tracking-widest py-3 rounded-xl active:scale-[0.98] transition-transform uppercase text-xs animate-pulse font-sans"
                  >
                    <StopCircle size={16} className="mr-2" /> Dừng tiến hành
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* LangGraph Node/Pipeline Visualizer Block */}
          {useLangGraph && (
            <div className="bg-[#0b101c]/80 dark:bg-slate-950/80 p-5 rounded-2xl border border-slate-800 backdrop-blur-md space-y-4">
              <h3 className="text-xs font-black text-slate-100 uppercase tracking-[0.15em] flex items-center gap-2">
                <Network size={16} className="text-mystic-accent animate-spin" style={{ animationDuration: '6s' }} /> 
                Quy trình Đồ thị Trạng thái LangGraph Metadata
              </h3>
              
              {/* Sequential nodes flow */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
                {[
                  { id: 'initialize', label: '1. Khoang Nạp Chunks', desc: 'Đọc & Khởi tạo State', icon: FileText },
                  { id: 'clean_text', label: '2. Denoise Clean', desc: 'Lọc ký tự rác', icon: Cpu },
                  { id: 'sieve_slices', label: '3. Phân Đoạn Multi-RAG', desc: 'Kiến tạo quan hệ Cha-Con', icon: GitBranch },
                  { id: 'extract_meta', label: '4. AI Metadata Scribe', desc: 'Mô hình phân tích thực thể', icon: Sparkles },
                  { id: 'link_relations', label: '5. Sơ Đồ Graph Index', desc: 'Mapping tri thức', icon: Share2 },
                ].map((node, nIdx) => {
                  const status = langGraphNodeStatus[node.id];
                  const isActive = activeLangGraphNode === node.id;
                  const Icon = node.icon;
                  return (
                    <div 
                      key={node.id}
                      className={`p-3 rounded-xl border relative transition-all duration-300 ${
                        status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                          : isActive
                          ? 'bg-mystic-accent/10 border-mystic-accent/60 text-mystic-accent animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                          : 'bg-slate-900/60 border-slate-900 text-slate-500'
                      }`}
                    >
                      <div className="absolute top-2 right-2 flex items-center justify-center">
                        {status === 'completed' ? (
                          <span className="w-4 h-4 rounded-full bg-emerald-500 text-[10px] text-slate-950 flex items-center justify-center font-bold">✓</span>
                        ) : isActive ? (
                          <span className="w-2 h-2 rounded-full bg-mystic-accent animate-ping" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-800" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={isActive ? 'text-mystic-accent' : status === 'completed' ? 'text-emerald-400' : 'text-slate-500'} />
                        <span className="text-[11px] font-black tracking-wide font-sans">{node.label}</span>
                      </div>
                      <p className="text-[9px] leading-tight text-slate-400 font-mono mt-1">{node.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Live entities list */}
              {(liveEntities.length > 0 || liveEdges.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-900">
                  {/* Extracted entities */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
                      <Cpu size={12} className="text-blue-400" /> Thực thể vừa lọc (Live Entities):
                    </h4>
                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto custom-scrollbar p-2 bg-[#090d19] rounded-lg">
                      {liveEntities.map((ent, eIdx) => (
                        <span key={eIdx} className="text-[9px] bg-blue-500/10 border border-blue-400/20 text-blue-300 font-mono px-2 py-0.5 rounded-full" title={ent.description}>
                          [{ent.label}] {ent.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Extracted relationships */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] uppercase font-mono text-slate-400 flex items-center gap-1">
                      <Share2 size={12} className="text-mystic-accent" /> Bản đồ nháp quan hệ (Live Relations):
                    </h4>
                    <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto custom-scrollbar p-2 bg-[#090d19] rounded-lg">
                      {liveEdges.map((edg, edIdx) => (
                        <span key={edIdx} className="text-[9px] bg-pink-500/10 border border-pink-400/20 text-pink-300 font-mono px-2 py-0.5 rounded">
                          {edg.source} ➔ ({edg.relationship}) ➔ {edg.target}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Terminal Box */}
          <div className="bg-[#0b0f19] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl flex flex-col h-[280px] shrink-0">
             <div className="bg-[#141b2d] px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                   <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 animate-ping inline-block" />
                   ark_rag_engine_training ~/ session_logs
                </span>
                {isTraining && progress.total > 0 && (
                  <span className="text-xs font-mono text-mystic-accent font-bold">
                    {Math.round((progress.current / progress.total) * 100)}% Phân tích
                  </span>
                )}
             </div>
             <div 
               ref={logContainerRef}
               className="flex-1 p-4 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1 custom-scrollbar leading-relaxed"
             >
               {logs.length === 0 && (
                 <div className="text-slate-500 italic">Vui lòng tải lên tài liệu nguồn và cấu hình rồi nhấn khởi động...</div>
               )}
               {logs.map((log, i) => (
                 <div key={i} className="border-l border-slate-800 pl-2">
                   {log}
                 </div>
               ))}
             </div>
             {isTraining && (
               <div className="h-1 bg-slate-900 w-full">
                 <div 
                   className="h-full bg-gradient-to-r from-mystic-accent to-green-400 transition-all duration-300"
                   style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                 />
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
