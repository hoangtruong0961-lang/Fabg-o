import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import _ from "lodash";
import {
  NavigationProps,
  GameState,
  ChatMessage,
  AppSettings,
  SaveFile,
  WorldData,
  TawaPresetConfig,
  GameTime,
  Entity,
  ImageMetadata,
} from "../../../../types";
import { gameplayAiService } from "../../../../services/ai/gameplay/service";
import { dbService } from "../../../../services/db/indexedDB";
import {
  INITIAL_GAME_TIME,
  formatGameTime,
  advanceTime,
} from "../../../../utils/timeUtils";
import { useResponsive } from "../../../../hooks/useResponsive";
import { tavoRegistry } from "../../../../services/api/tavoApi";
import { useModalState } from "./useModalState";
import { useAiMonitor } from "./useAiMonitor";
import { LsrParser } from "../../../../services/lsr/LsrParser";
import { getRegexedString, extractTagContent, parseChoices } from "../../../../utils/regex";
import { storyBibleService } from "../../../../services/ai/storyBibleService";
import { useSaveSystem } from "./useSaveSystem";
import { FateSettings } from "../modals/FateSettingsModal";
import { DEFAULT_CRISES } from "../modals/FateRollOverlayModal";
import { useLsr } from "./useLsr";
import { useGameConfig } from "./useGameConfig";
import { useGameEngine } from "./useGameEngine";
import { processScheduleAutoprogression } from "../../../../services/schedule/ScheduleAutoEngine";
import { parseBuiltinPreset } from "../components/TawaPresetManager";
import tawaReYilPresetData from "../../../../assets/presets/tawa_re_yil.json";
import tawaDeltaPresetData from "../../../../assets/presets/tawa_delta_combined.json";

const MESSAGES_PER_PAGE = 10;

export const useGameplayCore = ({
  onNavigate,
  activeWorld,
  onUpdateWorld,
}: NavigationProps) => {
  // Game Engine
  const {
    isLoading,
    setIsLoading,
    history,
    setHistory,
    lastAction,
    setLastAction,
    turnCount,
    setTurnCount,
    historyRef,
    turnCountRef,
    lastActionRef,
    syncEngineFromSave,
  } = useGameEngine(activeWorld);
  // Game Config
  const {
    settings,
    setSettings,
    tawaPresetConfig,
    setTawaPresetConfig,
    dynamicRules,
    setDynamicRules,
    combinedRegexScripts,
    setCombinedRegexScripts,
    gameTime,
    setGameTime,
    dynamicRulesRef,
    tawaPresetConfigRef,
    gameTimeRef,
    loadInitialSettings,
    syncConfigFromSave,
    reloadRegexScripts,
  } = useGameConfig(activeWorld);

  // Save System
  const {
    autosaveList,
    manualSaveList,
    initialSaveList,
    activeSaveTab,
    setActiveSaveTab,
    isSaving,
    setIsSaving,
    loadSaveLists,
    handleDeleteSave,
  } = useSaveSystem();

  const {
    tokenHistory,
    totalTokens,
    lastTurnTotalTime,
    currentProcessingTime,
    setCurrentProcessingTime,
    processingStartTimeRef,
    tokenHistoryRef,
    totalTokensRef,
    lastTurnTotalTimeRef,
    startProcessing,
    endProcessing,
    updateTokenHistoryItem: updateTokenHistory,
    syncFromSave: syncAiMonitorFromSave,
  } = useAiMonitor(activeWorld);

  // UI States
  const {
    showCharModal,
    setShowCharModal,
    showGlobalModal,
    setShowGlobalModal,
    showHistoryModal,
    setShowHistoryModal,
    showContextModal,
    setShowContextModal,
    showImageLibrary,
    setShowImageLibrary,
    showLogConsole,
    setShowLogConsole,
    showRegexModal,
    setShowRegexModal,
    showCalendarModal,
    setShowCalendarModal,
    showMobileSidebar,
    setShowMobileSidebar,
    showStoryDebugModal,
    setShowStoryDebugModal,
    selectedDebugMessageIndex,
    setSelectedDebugMessageIndex,
  } = useModalState();
  const [selectingAvatarFor, setSelectingAvatarFor] = useState<{
    type: "player" | "entity";
    id?: string;
  } | null>(null);

  const [isTavernHelperReady, setIsTavernHelperReady] = useState(false);
  const isTavernHelperReadyRef = useRef(false);
  useEffect(() => {
    isTavernHelperReadyRef.current = isTavernHelperReady;
  }, [isTavernHelperReady]);

  // Fate Encounter States
  const [showFateSettingsModal, setShowFateSettingsModal] = useState(false);
  const [showFateRollModal, setShowFateRollModal] = useState(false);
  const [pendingActionText, setPendingActionText] = useState("");
  const [fateSettings, setFateSettings] = useState<FateSettings>({
    enabled: false,
    diceType: "D20",
    dc: 8,
    autoRoll: false,
    cheatEnabled: true,
    rate: 100,
    onlyHiddenFromSchedule: false,
  });

  // Sync Fate Settings per World
  useEffect(() => {
    if (activeWorld?.extensions?.fate_settings) {
      setFateSettings(activeWorld.extensions.fate_settings);
    } else {
      setFateSettings({
        enabled: false,
        diceType: "D20",
        dc: 8,
        autoRoll: false,
        cheatEnabled: true,
        rate: 100,
        onlyHiddenFromSchedule: false,
      });
    }
  }, [activeWorld?.id]);

  const handleUpdateFateSettings = (newSettings: FateSettings) => {
    setFateSettings(newSettings);
    if (onUpdateWorld && activeWorld) {
      onUpdateWorld({
        extensions: {
          ...(activeWorld.extensions || {}),
          fate_settings: newSettings,
        },
      });
    }
  };

  const [showTokenDetails, setShowTokenDetails] = useState(true);
  const [showStatsDetails, setShowStatsDetails] = useState(true);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const [activeContextTab, setActiveContextTab] = useState<
    "config" | "debugger"
  >("config");
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [lastNavigatedTurn, setLastNavigatedTurn] = useState<number | null>(
    null,
  );
  const pendingScrollTurnRef = useRef<number | null>(null);

  const combinedRegexScriptsRef = useRef<
    import("../../../../types").RegexScript[]
  >([]);
  useEffect(() => {
    combinedRegexScriptsRef.current = combinedRegexScripts;
  }, [combinedRegexScripts]);

  useEffect(() => {
    const handleReload = () => reloadRegexScripts();
    window.addEventListener("reload_regex_scripts", handleReload);
    return () =>
      window.removeEventListener("reload_regex_scripts", handleReload);
  }, [reloadRegexScripts]);

  // Listener for dynamic core memory summary & Persona drift updates
  useEffect(() => {
    const handleSummaryUpdate = (e: any) => {
      const newSummary = e.detail;
      if (newSummary && onUpdateWorld) {
        // Update the ref so current state captures it immediately
        activeWorldSummaryRef.current = newSummary;
        // Trigger world update to save to IndexedDB
        onUpdateWorld({ summary: newSummary });
      }
    };

    const handlePersonaDrift = (e: any) => {
      const driftResult = e.detail;
      if (driftResult && driftResult.hasDrift) {
        toast.warning(
          <div className="flex flex-col gap-1">
            <b>Cảnh báo AI đi lạc (OOC):</b>
            <span>{driftResult.reason}</span>
            <span className="text-xs opacity-70">
              StoryBible đã tự động theo dõi để nắn chỉnh ở lượt tới.
            </span>
          </div>,
          { duration: 8000 },
        );
      }
    };

    window.addEventListener("tavo_summary_update", handleSummaryUpdate);
    window.addEventListener("tavo_persona_drift", handlePersonaDrift);

    return () => {
      window.removeEventListener("tavo_summary_update", handleSummaryUpdate);
      window.removeEventListener("tavo_persona_drift", handlePersonaDrift);
    };
  }, [onUpdateWorld]);

  const gameInputRef = useRef<any>(null);

  useEffect(() => {
    tavoRegistry.getInputValue = () => gameInputRef.current?.getInputValue?.() || '';
    tavoRegistry.setInputValue = (v: string) => gameInputRef.current?.setInputValue?.(v);
    tavoRegistry.appendInputValue = (v: string) => gameInputRef.current?.appendInputValue?.(v);
    tavoRegistry.clearInputValue = () => gameInputRef.current?.clearInputValue?.();
    tavoRegistry.sendInput = () => gameInputRef.current?.sendInput?.();
    tavoRegistry.focusInput = () => gameInputRef.current?.focusInput?.();
  }, []);

  useEffect(() => {
    // 1. Definition of Event Emitter, SlashCommandParser, and Extension Settings Storage Proxy
    class SimpleEventEmitter {
      private listeners: { [event: string]: Function[] } = {};
      
      on(event: string, callback: Function) {
        if (!this.listeners[event]) {
          this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return this;
      }
      
      off(event: string, callback: Function) {
        if (!this.listeners[event]) return this;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        return this;
      }
      
      emit(event: string, ...args: any[]) {
        if (!this.listeners[event]) return false;
        this.listeners[event].forEach(cb => {
          try {
            cb(...args);
          } catch (e) {
            console.error(`[EventSource Bridge] Error in listener for event ${event}:`, e);
          }
        });
        return true;
      }
    }

    class SlashCommandParser {
      static commands: { [name: string]: any } = {};

      static addCommandObject(cmdObj: any) {
        if (!cmdObj || !cmdObj.name) return;
        const name = cmdObj.name.toLowerCase();
        this.commands[name] = cmdObj;
        if (Array.isArray(cmdObj.aliases)) {
          cmdObj.aliases.forEach((alias: string) => {
            this.commands[alias.toLowerCase()] = cmdObj;
          });
        }
        console.log(`[SlashCommandParser] Registered command: /${name}`);
      }

      static getCommand(name: string) {
        return this.commands[name.toLowerCase()];
      }

      addCommandObject(cmdObj: any) {
        SlashCommandParser.addCommandObject(cmdObj);
      }
    }

    const eventSource = new SimpleEventEmitter();
    const event_types = {
      MESSAGE_RECEIVED: 'message_received',
      MESSAGE_SENT: 'message_sent',
      CHAT_CHANGED: 'chat_changed',
      CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
      GENERATION_STARTED: 'generation_started',
      GENERATION_ENDED: 'generation_ended',
      GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts',
      SYSTEM_MESSAGE_RECEIVED: 'system_message_received',
      USER_MESSAGE_RENDERED: 'user_message_rendered',
    };

    (window as any).eventSource = eventSource;
    (window as any).event_types = event_types;
    (window as any).SlashCommandParser = SlashCommandParser;
    (window as any).promptMiddleware = (window as any).promptMiddleware || [];

    const rawSettings: any = {};
    let debounceTimer: any = null;

    const saveSettingsDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const settingsObj = await dbService.getSettings();
          const existingExtSettings = settingsObj.extensionSettings || {};
          const worldId = activeWorldRef.current?.id || 'default';
          
          await dbService.saveSettings({
            ...settingsObj,
            extensionSettings: {
              ...existingExtSettings,
              [worldId]: { ...rawSettings }
            }
          } as any);
          console.log(`[TavernHelper Bridge] Saved extension settings for world ${worldId} to DB:`, rawSettings);
        } catch(e) {
          console.error('[TavernHelper Bridge] Error saving extension settings:', e);
        }
      }, 300);
    };

    (window as any).saveSettingsDebounced = saveSettingsDebounced;

    const makeDeepProxy = (obj: any, onWrite: () => void): any => {
      if (obj !== null && typeof obj === 'object') {
        return new Proxy(obj, {
          get(target, prop) {
            if (typeof prop === 'symbol') return Reflect.get(target, prop);
            const val = target[prop.toString()];
            if (val !== null && typeof val === 'object') {
              return makeDeepProxy(val, onWrite);
            }
            return val;
          },
          set(target, prop, value) {
            if (typeof prop === 'symbol') return Reflect.set(target, prop, value);
            target[prop.toString()] = value;
            onWrite();
            return true;
          },
          deleteProperty(target, prop) {
            if (typeof prop === 'symbol') return Reflect.deleteProperty(target, prop);
            delete target[prop.toString()];
            onWrite();
            return true;
          }
        });
      }
      return obj;
    };

    (window as any).extension_settings = makeDeepProxy(rawSettings, saveSettingsDebounced);

    // TavernHelper Cache
    const tavernHelperCache: any = {
      presets: [],
      loadedPresetName: "Tawa Re = YIL丨Alpha V1",
      worldbooks: [],
      globalWorldbooks: [],
      variables: {},
    };

    // Prefetch all data for TavernHelper synchronously caching
    const initTavernHelper = async () => {
      setIsTavernHelperReady(false);
      try {
        const { tavoApi } = await import('../../../../services/api/tavoApi');
        const dbPresets = await tavoApi.preset.all();
        const fullPresets = [];
        for (const p of dbPresets) {
          const full = await tavoApi.preset.get(p.id);
          if (full) fullPresets.push(full);
        }
        
        let hasTawaPreset = fullPresets.some((p: any) => p.name === "Tawa Re = YIL" || p.name === "Tawa Re = YIL丨Alpha V1");
        if (!hasTawaPreset) {
          try {
            const tawaData = await import('../../../../assets/presets/tawa_re_yil.json');
            if (tawaData) {
               fullPresets.push({
                 id: "builtin_tawa_re_yil",
                 name: "Tawa Re = YIL丨Alpha V1",
                 prompts: tawaData.prompts || [],
                 extensions: tawaData.extensions || {}
               });
            }
          } catch(e) {}
        }

        let hasTawaDeltaPreset = fullPresets.some((p: any) => p.id === "builtin_tawa_delta" || p.name === "Tawa Delta Combined" || p.name === "Tawa Delta Combined丨Mới Nhất");
        if (!hasTawaDeltaPreset) {
          try {
            const tawaDeltaData = await import('../../../../assets/presets/tawa_delta_combined.json');
            if (tawaDeltaData) {
               fullPresets.push({
                 id: "builtin_tawa_delta",
                 name: "Tawa Delta Combined丨Mới Nhất",
                 prompts: tawaDeltaData.prompts || tawaDeltaData.modules || [],
                 extensions: tawaDeltaData.extensions || {}
               });
            }
          } catch(e) {}
        }
        tavernHelperCache.presets = fullPresets;

        const dbWbs = await tavoApi.lorebook.all();
        tavernHelperCache.worldbooks = dbWbs;

        const activeWorld = activeWorldRef.current;
        const variablesObj = activeWorld?.tavoVars || {};

        const currentChatInfo = await tavoApi.chat.current();
        const activeLobNames = currentChatInfo?.lorebooks?.map((l: any) => l.name) || [];
        tavernHelperCache.globalWorldbooks = activeLobNames;

        let globalVars = {};
        try {
          const settingsObj = await dbService.getSettings();
          globalVars = settingsObj?.tavoGlobalVars || {};
          
          // Prefetch extension settings
          const extSettings = settingsObj?.extensionSettings || {};
          const worldId = activeWorld?.id || 'default';
          const worldExtSettings = extSettings[worldId] || {};
          
          // Clear active memory settings to prevent cross-leakage
          for (const key in rawSettings) {
             delete rawSettings[key];
          }
          for (const key in worldExtSettings) {
            rawSettings[key] = worldExtSettings[key];
          }
          console.log(`[TavernHelper Bridge] Successfully hydrated extension settings for world ${worldId}:`, rawSettings);
        } catch(e) {}

        tavernHelperCache.variables = { ...globalVars, ...variablesObj };
        tavernHelperCache.loadedPresetName = activeWorld?.extensions?.presetName || "Tawa Re = YIL丨Alpha V1";

        // Emit chat_changed on load/init
        eventSource.emit('chat_changed', activeWorld?.id);
      } catch (err) {
        console.error('[TavernHelper Bridge] Initialization error:', err);
      } finally {
        setIsTavernHelperReady(true);
      }
    };

    initTavernHelper();

    // 2. Define SillyTavern & jQuery bridge on window
    const stBridge: any = {
      eventSource: eventSource,
      event_types: event_types,
      getContext: () => ({
        getCurrentChatId: () => activeWorldRef.current?.id || 'default',
        chatId: activeWorldRef.current?.id || 'default',
        characterId: activeWorldRef.current?.world?.characterId || 0,
        characters: [
          {
            name: activeWorldRef.current?.world?.name || 'Character',
            chat: activeWorldRef.current?.id || 'default',
          }
        ],
        executeSlashCommands: (command: string) => {
          (window as any).executeSlashCommands?.(command);
        },
        typeInput: (text: string) => {
          tavoRegistry.setInputValue?.(text);
          setIsInputCollapsed(false);
        },
        sendInput: () => {
          tavoRegistry.sendInput?.();
        }
      }),
      triggerSlash: (command: string) => {
        (window as any).executeSlashCommands?.(command);
      }
    };

    const jqBridge = function(selector: string) {
      if (typeof selector !== 'string') return { val: () => '', trigger: () => jqBridge, click: () => jqBridge, focus: () => jqBridge };

      const isTextarea = selector.includes('send_textarea') || selector.includes('textarea') || selector.includes('chat-textarea');
      const isSendButton = selector.includes('send_btn') || selector.includes('send-btn');

      if (isTextarea) {
        return {
          val: function(value?: string) {
            if (value !== undefined) {
              tavoRegistry.setInputValue?.(value);
              setIsInputCollapsed(false);
              return this;
            }
            return tavoRegistry.getInputValue?.() || '';
          },
          trigger: function(eventName: string) {
            return this;
          },
          focus: function() {
            tavoRegistry.focusInput?.();
            return this;
          }
        };
      }

      if (isSendButton) {
        return {
          click: function() {
            tavoRegistry.sendInput?.();
            return this;
          }
        };
      }

      try {
        const el = document.querySelector(selector);
        if (el) {
          return {
            val: function(val?: string) { 
              if (val !== undefined) (el as any).value = val; 
              return val !== undefined ? this : (el as any).value; 
            },
            click: function() { el.click(); return this; },
            trigger: function() { return this; },
            focus: function() { el.focus(); return this; }
          };
        }
      } catch(e) {}

      return {
        val: () => '',
        trigger: function() { return this; },
        click: function() { return this; },
        focus: function() { return this; }
      };
    };

    // TavernHelper full bridge implementation
    const tavernHelper = {
      getPresetNames: () => {
        return tavernHelperCache.presets.map((p: any) => p.name || 'Unnamed Preset');
      },
      getPreset: (name: string) => {
        const preset = tavernHelperCache.presets.find((p: any) => p.name === name || p.id === name);
        if (!preset) {
           return {
              name: name,
              prompts: [],
              extensions: { regex_scripts: [] }
           };
        }
        return preset;
      },
      getLoadedPresetName: () => {
        return tavernHelperCache.loadedPresetName;
      },
      getWorldbookNames: () => {
        return tavernHelperCache.worldbooks.map((wb: any) => wb.name || 'Unnamed Lorebook');
      },
      getWorldbooks: () => {
        return tavernHelperCache.worldbooks || [];
      },
      getWorldbook: (name: string) => {
        return tavernHelperCache.worldbooks.find((wb: any) => wb.name === name);
      },
      getGlobalWorldbookNames: () => {
        return tavernHelperCache.globalWorldbooks;
      },
      rebindGlobalWorldbooks: async (newList: string[]) => {
        console.log('[TavernHelper] Rebinding global worldbooks:', newList);
        tavernHelperCache.globalWorldbooks = newList;
        
        try {
          const { tavoApi } = await import('../../../../services/api/tavoApi');
          const activeChat = await tavoApi.chat.current();
          if (activeChat) {
             const updatedLorebooks = newList.map(name => {
                const found = tavernHelperCache.worldbooks.find((wb: any) => wb.name === name);
                return {
                   id: found?.id || Date.now(),
                   name: name,
                   entries: found?.entries || []
                };
             });
             
             await tavoApi.chat.update({
                ...activeChat,
                lorebooks: updatedLorebooks
             });
             
             if (onUpdateWorld && activeWorldRef.current) {
                onUpdateWorld({
                   ...activeWorldRef.current,
                   lorebook: updatedLorebooks[0] ? {
                      name: updatedLorebooks[0].name,
                      entries: updatedLorebooks[0].entries
                   } : undefined
                });
             }
          }
        } catch (e) {
          console.error('[TavernHelper Bridge] rebindGlobalWorldbooks error:', e);
        }
        return true;
      },
      updatePresetWith: async (presetName: string, data: any) => {
        console.log('[TavernHelper] Updating preset:', presetName, data);
        let presetIdx = tavernHelperCache.presets.findIndex((p: any) => p.name === presetName || p.id === presetName);
        
        try {
          const { tavoApi } = await import('../../../../services/api/tavoApi');
          if (presetIdx !== -1) {
             const updatedPreset = { ...tavernHelperCache.presets[presetIdx], ...data };
             tavernHelperCache.presets[presetIdx] = updatedPreset;
             await tavoApi.preset.update(updatedPreset);
          } else {
             const newPreset = { id: presetName, name: presetName, ...data };
             tavernHelperCache.presets.push(newPreset);
             await tavoApi.preset.create(newPreset);
          }
          window.dispatchEvent(new CustomEvent('tavo_presets_updated', { detail: { presetName, data } }));
        } catch (e) {
          console.error('[TavernHelper Bridge] updatePresetWith error:', e);
        }
        return true;
      },
      getVariables: () => {
        return tavernHelperCache.variables;
      },
      getCurrentMessageId: () => {
        const messages = historyRef.current || [];
        return messages.length > 0 ? messages.length - 1 : 0;
      },
      updateVariablesWith: async (data: any) => {
        console.log('[TavernHelper] Updating variables:', data);
        if (!data || typeof data !== 'object') return false;
        
        try {
          const { tavoApi } = await import('../../../../services/api/tavoApi');
          tavernHelperCache.variables = { ...tavernHelperCache.variables, ...data };
          for (const key in data) {
             await tavoApi.set(key, data[key], 'chat');
             window.dispatchEvent(new CustomEvent('tavo_vars_updated', { detail: { key, val: data[key] } }));
          }
        } catch (e) {
          console.error('[TavernHelper Bridge] updateVariablesWith error:', e);
        }
        return true;
      },
      updateWorldbookWith: async (name: string, data: any) => {
        console.log('[TavernHelper] updateWorldbookWith called:', name, data);
        if (!name) return false;
        
        try {
          const { tavoApi } = await import('../../../../services/api/tavoApi');
          
          let wbIdx = tavernHelperCache.worldbooks.findIndex((wb: any) => wb.name === name || wb.id === name);
          
          let entriesArray: any[] = [];
          if (Array.isArray(data)) {
            entriesArray = data;
          } else if (data && typeof data === 'object') {
            if (Array.isArray(data.entries)) {
              entriesArray = data.entries;
            } else if (data.entries && typeof data.entries === 'object') {
              entriesArray = Object.values(data.entries);
            } else {
              entriesArray = Object.values(data);
            }
          }

          const entriesRecord: Record<string, any> = {};
          entriesArray.forEach((e: any, i: number) => {
             const uid = e.uid || e.identifier || String(i);
             entriesRecord[uid] = {
               uid,
               key: e.key || e.keys || [],
               comment: e.comment || '',
               content: e.content || e.value || '',
               enabled: e.enabled !== false,
               ...e
             };
          });

          let updatedBook: any;
          if (wbIdx !== -1) {
            updatedBook = {
               ...tavernHelperCache.worldbooks[wbIdx],
               entries: entriesArray
            };
            tavernHelperCache.worldbooks[wbIdx] = updatedBook;
            await tavoApi.lorebook.update(updatedBook);
          } else {
            updatedBook = {
               id: name.toLowerCase().replace(/\s+/g, '_') || Date.now().toString(),
               name: name,
               entries: entriesArray
            };
            tavernHelperCache.worldbooks.push(updatedBook);
            await tavoApi.lorebook.create(updatedBook);
          }

          const activeWorld = activeWorldRef.current;
          if (activeWorld) {
            const currentChatInfo = await tavoApi.chat.current();
            const activeLobNames = currentChatInfo?.lorebooks?.map((l: any) => l.name) || [];
            
            if (activeLobNames.includes(name) || activeLobNames.length === 0) {
              const updatedLorebookObj = {
                 name: name,
                 entries: entriesRecord
              };
              
              if (onUpdateWorld) {
                 onUpdateWorld({
                    lorebook: updatedLorebookObj
                 });
              }
            }
          }

          window.dispatchEvent(new CustomEvent('tavo_lorebooks_updated', { detail: { name, data: updatedBook } }));
          return true;
        } catch (e) {
          console.error('[TavernHelper Bridge] updateWorldbookWith error:', e);
          return false;
        }
      }
    };

    // Event system helpers (Phase 1)
    const eventOn = (type: string, cb: Function) => eventSource.on(type, cb);
    const eventOnce = (type: string, cb: Function) => {
      const wrap = (...a: any[]) => { cb(...a); eventSource.off(type, wrap); };
      eventSource.on(type, wrap);
    };
    const eventOff = (type: string, cb: Function) => eventSource.off(type, cb);
    const eventEmit = (type: string, ...data: any[]) => eventSource.emit(type, ...data);

    // Variable helpers (Phase 2)
    const getVariables = (option?: any) => {
      if (typeof option === 'string') {
        return tavernHelperCache.variables[option];
      }
      return tavernHelperCache.variables;
    };
    const setVariables = async (data: any, option?: any) => {
      return await tavernHelper.updateVariablesWith(data);
    };

    // Message CRUD helpers (Phase 2)
    const getMessages = (option?: any) => {
      let list = [...(historyRef.current || [])];
      if (option?.role) {
        list = list.filter(m => m.role === option.role);
      }
      return list;
    };
    const setMessage = (message_id: number, fields: any) => {
      console.log('[SillyTavern Bridge] setMessage called:', message_id, fields);
      if (typeof message_id !== 'number') return;
      setHistory((prev: any) => {
        const next = prev.map((m: any, i: number) => {
          if (i === message_id) {
            const mappedText = typeof fields.message === 'string' ? fields.message : (fields.text || m.text || m.content);
            return { 
              ...m, 
              text: mappedText,
              content: mappedText,
              ...fields 
            };
          }
          return m;
        });
        syncWorldState(next, turnCountRef.current, gameTimeRef.current);
        return next;
      });
    };
    const createMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
      console.log('[SillyTavern Bridge] createMessage called:', role, content);
      const newMsg = {
        role,
        text: content,
        content: content,
        timestamp: Date.now()
      };
      setHistory((prev: any) => {
        const next = [...prev, newMsg];
        syncWorldState(next, turnCountRef.current, gameTimeRef.current);
        return next;
      });
      return newMsg;
    };
    const deleteMessage = (message_id: number) => {
      console.log('[SillyTavern Bridge] deleteMessage called:', message_id);
      if (typeof message_id !== 'number') return;
      setHistory((prev: any) => {
        const next = prev.filter((_: any, i: number) => i !== message_id);
        syncWorldState(next, turnCountRef.current, gameTimeRef.current);
        return next;
      });
    };

    const getCurrentMessageId = () => {
      const messages = historyRef.current || [];
      return messages.length > 0 ? messages.length - 1 : 0;
    };

    // Prompt injection registers (Phase 4)
    const registerPromptMiddleware = (fn: Function) => {
      if (typeof fn === 'function') {
        (window as any).promptMiddleware.push(fn);
      }
    };
    const registerPromptInjection = (fn: Function) => {
      if (typeof fn === 'function') {
        (window as any).promptMiddleware.push(fn);
      }
    };

    // Case-extended event types for case-insensitivity
    const tavern_events_extended = { ...event_types };
    Object.keys(event_types).forEach(key => {
      (tavern_events_extended as any)[key.toLowerCase()] = (event_types as any)[key];
    });

    const win = window as any;
    win.SillyTavern = stBridge;
    win.$ = jqBridge;
    win.jQuery = jqBridge;
    win.TavernHelper = tavernHelper;
    win.tavernHelper = tavernHelper;
    win.eventOn = eventOn;
    win.eventOnce = eventOnce;
    win.eventOff = eventOff;
    win.eventEmit = eventEmit;
    win.tavern_events = tavern_events_extended;
    win._ = _;
    win.getVariables = getVariables;
    win.setVariables = setVariables;
    win.getMessages = getMessages;
    win.setMessage = setMessage;
    win.createMessage = createMessage;
    win.deleteMessage = deleteMessage;
    win.getCurrentMessageId = getCurrentMessageId;
    win.registerPromptMiddleware = registerPromptMiddleware;
    win.registerPromptInjection = registerPromptInjection;

    const sendOpeningDataDirect = async (text: string, data?: any) => {
      console.log('[SillyTavern Bridge] sendOpeningData direct function called:', text, data);
      if (data && typeof data === 'object') {
        try {
          await setVariables(data);
          console.log('[SillyTavern Bridge] sendOpeningData variables synced:', data);
        } catch (e) {
          console.error('[SillyTavern Bridge] sendOpeningData variable sync failed:', e);
        }
      }
      if (text && typeof text === 'string') {
        if (handleSendRef.current) {
          handleSendRef.current(text);
        } else {
          console.warn('[SillyTavern Bridge] handleSendRef is not ready yet for sendOpeningData');
        }
      }
    };
    win.sendOpeningData = sendOpeningDataDirect;
    stBridge.sendOpeningData = sendOpeningDataDirect;
    
    const waitGlobalInitialized = () => {
      return new Promise<boolean>((resolve) => {
        const start = Date.now();
        const check = () => {
          if (isTavernHelperReadyRef.current || Date.now() - start > 4000) {
            resolve(true);
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    };
    win.waitGlobalInitialized = waitGlobalInitialized;

    try {
      if (win.parent) {
        const pWin = win.parent as any;
        pWin.TavernHelper = tavernHelper;
        pWin.tavernHelper = tavernHelper;
        pWin.SillyTavern = stBridge;
        pWin.$ = jqBridge;
        pWin.jQuery = jqBridge;
        pWin.eventSource = eventSource;
        pWin.event_types = event_types;
        pWin.tavern_events = tavern_events_extended;
        pWin.eventOn = eventOn;
        pWin.eventOnce = eventOnce;
        pWin.eventOff = eventOff;
        pWin.eventEmit = eventEmit;
        pWin._ = _;
        pWin.getVariables = getVariables;
        pWin.setVariables = setVariables;
        pWin.getMessages = getMessages;
        pWin.setMessage = setMessage;
        pWin.createMessage = createMessage;
        pWin.deleteMessage = deleteMessage;
        pWin.getCurrentMessageId = getCurrentMessageId;
        pWin.waitGlobalInitialized = waitGlobalInitialized;
        pWin.registerPromptMiddleware = registerPromptMiddleware;
        pWin.registerPromptInjection = registerPromptInjection;
        pWin.triggerSlash = (command: string) => win.executeSlashCommands?.(command);
        pWin.executeSlashCommands = (command: string) => win.executeSlashCommands?.(command);
        pWin.sendOpeningData = sendOpeningDataDirect;
      }
    } catch(e){}

    win.triggerSlash = (command: string) => {
      win.executeSlashCommands?.(command);
    };

    win.executeSlashCommands = async (command: string) => {
      console.log('[SillyTavern Bridge] Slash command received:', command);
      if (!command) return;
      
      const trimCmd = command.trim();
      let slashName = '';
      let slashArgs = '';
      
      if (trimCmd.startsWith('/')) {
        const spaceIdx = trimCmd.indexOf(' ');
        if (spaceIdx !== -1) {
          slashName = trimCmd.substring(1, spaceIdx).trim().toLowerCase();
          slashArgs = trimCmd.substring(spaceIdx + 1).trim();
        } else {
          slashName = trimCmd.substring(1).trim().toLowerCase();
        }
      }

      // 1. Try custom SlashCommandParser registry first
      if (slashName) {
        const cmdObj = (window as any).SlashCommandParser?.getCommand(slashName);
        if (cmdObj && typeof cmdObj.callback === 'function') {
          try {
            const argsObj: any = {};
            const words = slashArgs.split(/\s+/);
            words.forEach((w: string) => {
              const eq = w.indexOf('=');
              if (eq !== -1) {
                argsObj[w.substring(0, eq)] = w.substring(eq + 1);
              }
            });
            console.log(`[SillyTavern Bridge] Executing registered custom command /${slashName}`);
            return await cmdObj.callback(argsObj, slashArgs);
          } catch(e) {
            console.error(`[SillyTavern Bridge] Error in custom slash command /${slashName}:`, e);
          }
        }
      }

      // Helper to extract argument value from named args (e.g. value="test" or key='something')
      const getCommandArgValue = (argsText: string, keyName: string = "value"): string => {
        const trimmed = argsText.trim();
        if (!trimmed) return "";
        
        const prefix = `${keyName}=`;
        if (trimmed.startsWith(prefix)) {
          let val = trimmed.substring(prefix.length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          return val;
        }
        
        if (trimmed.includes('=')) {
          const regex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
          let match;
          const params: Record<string, string> = {};
          while ((match = regex.exec(trimmed)) !== null) {
            const key = match[1].toLowerCase();
            const value = match[2] || match[3] || match[4] || "";
            params[key] = value;
          }
          if (params[keyName]) {
            return params[keyName];
          }
        }

        let val = trimmed;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        return val;
      };

      const getCommandArg = (key: string) => {
        return getCommandArgValue(slashArgs, key);
      };

      // 2. Fallbacks to virtualized internal commands
      if (slashName === 'setinput') {
        const val = getCommandArg('value') || slashArgs;
        tavoRegistry.setInputValue?.(val);
        setIsInputCollapsed(false);
        setTimeout(() => {
          tavoRegistry.focusInput?.();
        }, 50);
        return;
      }
      
      if (slashName === 'send') {
        const val = getCommandArg('value') || slashArgs;
        if (val) {
          tavoRegistry.setInputValue?.(val);
          setIsInputCollapsed(false);
          setTimeout(() => {
            tavoRegistry.sendInput?.();
          }, 50);
        } else {
          tavoRegistry.sendInput?.();
        }
        return;
      }

      if (slashName === 'sys' || slashName === 'system') {
        const val = getCommandArg('value') || slashArgs;
        if (val) {
          const sysMsg: ChatMessage = {
            role: "system",
            text: val,
            timestamp: Date.now(),
            gameTime: gameTimeRef.current || gameTime,
            turnNumber: turnCountRef.current || turnCount,
          };
          setHistory((prev: any) => {
            const next = [...prev, sysMsg];
            syncWorldState(next, turnCountRef.current, gameTimeRef.current);
            return next;
          });
        }
        return;
      }

      if (slashName === 'pop') {
        setHistory((prev: any) => {
          if (prev.length === 0) return prev;
          const next = prev.slice(0, -1);
          syncWorldState(next, turnCountRef.current, gameTimeRef.current);
          return next;
        });
        return;
      }

      if (slashName === 'delete') {
        const num = parseInt(getCommandArg('value') || slashArgs, 10);
        if (!isNaN(num)) {
          setHistory((prev: any) => {
            const next = prev.filter((_: any, i: number) => i !== num);
            syncWorldState(next, turnCountRef.current, gameTimeRef.current);
            return next;
          });
        }
        return;
      }

      if (slashName === 'getvar') {
        const key = getCommandArg('key') || slashArgs;
        if (key) {
          const val = tavernHelperCache.variables[key] || '';
          console.log(`[Slash Command /getvar] ${key} = ${val}`);
          return val;
        }
        return;
      }

      if (slashName === 'setvar') {
        const params = slashArgs.trim();
        let key = '';
        let val = '';
        
        const eqIdx = params.indexOf('=');
        if (eqIdx !== -1) {
          key = params.substring(0, eqIdx).trim();
          val = params.substring(eqIdx + 1).trim();
        } else {
          const spIdx = params.indexOf(' ');
          if (spIdx !== -1) {
            key = params.substring(0, spIdx).trim();
            val = params.substring(spIdx + 1).trim();
          } else {
            key = params;
          }
        }
        
        if (key) {
          if (key.startsWith('key=')) {
            key = key.substring(4).trim();
          }
          if (val.startsWith('value=')) {
            val = val.substring(6).trim();
          }
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          
          console.log(`[Slash Command /setvar] Setting variable: ${key} = ${val}`);
          try {
            const { tavoApi } = await import('../../../../services/api/tavoApi');
            await tavoApi.set(key, val);
            tavernHelperCache.variables[key] = val;
            window.dispatchEvent(new CustomEvent('tavo_vars_updated', { detail: { key, val } }));
          } catch(e) {}
        }
        return;
      }

      if (slashName === 'echo' || slashName === 'display') {
        const val = getCommandArg('value') || slashArgs;
        if (val) {
          console.log(`[Slash Command /echo] Display alert: ${val}`);
        }
        return;
      }

      if (slashName === 'clear' || slashName === 'wipe') {
        setHistory([]);
        syncWorldState([], 0, gameTimeRef.current);
        return;
      }

      if (!trimCmd.startsWith('/')) {
        tavoRegistry.setInputValue?.(trimCmd);
        setIsInputCollapsed(false);
        setTimeout(() => {
          tavoRegistry.sendInput?.();
        }, 50);
      }
    };

    // 2. Click interceptor for choices embedded in chat logs (HTML)
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-reply], [data-choice], [data-action], .quick-reply, .silly_choice, .qr-btn, .reply-btn, .tawa-choice');
      if (!target) return;

      let text = '';
      if (target.getAttribute('data-reply')) {
        text = target.getAttribute('data-reply') || '';
      } else if (target.getAttribute('data-choice')) {
        text = target.getAttribute('data-choice') || '';
      } else if (target.getAttribute('data-action')) {
        text = target.getAttribute('data-action') || '';
      } else if (
        target.classList.contains('quick-reply') || 
        target.classList.contains('silly_choice') || 
        target.classList.contains('qr-btn') || 
        target.classList.contains('reply-btn') ||
        target.classList.contains('tawa-choice')
      ) {
        text = target.textContent || '';
      }

      if (text) {
        text = text.trim();
        text = text.replace(/^(\d+\s*[│|.]\s*)/, '');
        text = text.replace(/^(\[\d+\]\s*)/, '');
        
        tavoRegistry.setInputValue?.(text);
        setIsInputCollapsed(false);
        
        setTimeout(() => {
          tavoRegistry.focusInput?.();
        }, 80);

        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', handleDocumentClick);

    return () => {
      const win = window as any;
      delete win.SillyTavern;
      delete win.$;
      delete win.jQuery;
      delete win.TavernHelper;
      delete win.tavernHelper;
      delete win.eventOn;
      delete win.eventOnce;
      delete win.eventOff;
      delete win.eventEmit;
      delete win.tavern_events;
      delete win._;
      delete win.getVariables;
      delete win.setVariables;
      delete win.getMessages;
      delete win.setMessage;
      delete win.createMessage;
      delete win.deleteMessage;
      delete win.getCurrentMessageId;
      delete win.registerPromptMiddleware;
      delete win.registerPromptInjection;

      try {
        if (win.parent) {
          const pWin = win.parent as any;
          delete pWin.TavernHelper;
          delete pWin.tavernHelper;
          delete pWin.SillyTavern;
          delete pWin.$;
          delete pWin.jQuery;
          delete pWin.eventSource;
          delete pWin.event_types;
          delete pWin.tavern_events;
          delete pWin.eventOn;
          delete pWin.eventOnce;
          delete pWin.eventOff;
          delete pWin.eventEmit;
          delete pWin._;
          delete pWin.getVariables;
          delete pWin.setVariables;
          delete pWin.getMessages;
          delete pWin.setMessage;
          pWin.createMessage && delete pWin.createMessage;
          pWin.deleteMessage && delete pWin.deleteMessage;
          pWin.getCurrentMessageId && delete pWin.getCurrentMessageId;
          pWin.registerPromptMiddleware && delete pWin.registerPromptMiddleware;
          pWin.registerPromptInjection && delete pWin.registerPromptInjection;
          pWin.triggerSlash && delete pWin.triggerSlash;
          pWin.executeSlashCommands && delete pWin.executeSlashCommands;
        }
      } catch(e){}
      delete win.triggerSlash;
      delete win.executeSlashCommands;
      delete win.eventSource;
      delete win.event_types;
      delete win.SlashCommandParser;
      delete win.promptMiddleware;
      delete win.extension_settings;
      delete win.saveSettingsDebounced;
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [setIsInputCollapsed]);

  const handleSendRef = useRef<((text: string) => Promise<void>) | null>(null);
  const executeWidgetActionRef = useRef<(action: string, payload: any) => void>(null as any);

  useEffect(() => {
    const handleWidgetAction = (e: any) => {
      const { action, payload } = e.detail;
      if (action) {
        executeWidgetActionRef.current?.(action, payload);
      }
    };
    window.addEventListener("tawa_widget_action", handleWidgetAction);
    return () =>
      window.removeEventListener("tawa_widget_action", handleWidgetAction);
  }, []);

  const handleTawaConfigChange = useCallback(
    (config: TawaPresetConfig) => {
      setTawaPresetConfig(config);
      tawaPresetConfigRef.current = config;
      reloadRegexScripts();
    },
    [reloadRegexScripts],
  );

  const handleAvatarSelect = async (image: ImageMetadata) => {
    if (!selectingAvatarFor) return;

    if (selectingAvatarFor.type === "player") {
      const updatedWorld = {
        ...activeWorld,
        player: { ...activeWorld.player, avatar: image.data },
      };
      onUpdateWorld(updatedWorld);
    } else if (selectingAvatarFor.type === "entity" && selectingAvatarFor.id) {
      const updatedEntities = activeWorld.entities.map((e) =>
        e.id === selectingAvatarFor.id ? { ...e, avatar: image.data } : e,
      );
      const updatedWorld = {
        ...activeWorld,
        entities: updatedEntities,
      };
      onUpdateWorld(updatedWorld);
    }

    setSelectingAvatarFor(null);
    setShowImageLibrary(false);
  };

  // LSR State
  const {
    lsrTables,
    setLsrTables,
    lsrRuntimeData,
    setLsrRuntimeData,
    activeLsrTableId,
    setActiveLsrTableId,
    lsrViewMode,
    setLsrViewMode,
    lsrRuntimeDataRef,
  } = useLsr(activeWorld);

  const handleUpdateLsrData = useCallback((newData: Record<string, any[]>) => {
    setLsrRuntimeData(newData);
    lsrRuntimeDataRef.current = newData;
    if (activeWorld && onUpdateWorld) {
      onUpdateWorld({
        ...activeWorld,
        lsrData: newData,
      });
    }
  }, [activeWorld, onUpdateWorld, setLsrRuntimeData, lsrRuntimeDataRef]);

  const { isMobile } = useResponsive();

  const [isDead, setIsDead] = useState(false);

  const checkDeathStatus = useCallback((historyList: ChatMessage[], lsrData?: Record<string, unknown[]>) => {
    const isTormentDifficulty = activeWorldRef.current?.config?.difficulty?.id === 'torment' || settings?.difficulty?.id === 'torment';
    if (!isTormentDifficulty) return false;

    // 1. Scan last AI responses (e.g. last 1 or 2 messages in reverse order)
    const modelMessages = historyList.filter(m => m.role === 'model');
    if (modelMessages.length === 0) return false;
    
    // We can check the latest model response
    const lastModelMsg = modelMessages[modelMessages.length - 1];
    const textToSearch = lastModelMsg.text.toLowerCase();
    
    const deathKeywords = [
      "bạn đã chết",
      "bạn đã tử vong",
      "ngươi đã chết",
      "ngươi đã tử vong",
      "trò chơi kết thúc",
      "game over",
      "you died",
      "you have died",
      "nhân vật đã chết",
      "bị giết chết",
      "hồn phi phách tán",
      "tử vong"
    ];
    
    if (deathKeywords.some(keyword => textToSearch.includes(keyword))) {
      return true;
    }
    
    // 2. Scan LSR stats
    if (lsrData && lsrData['2']) {
      const t2 = lsrData['2'] as any[][];
      const playerStats = t2.map(row => ({ name: row[0], value: row[1], desc: row[2] }));
      const healthStat = playerStats.find(s => 
        s.name?.toLowerCase().includes('máu') || 
        s.name?.toLowerCase().includes('thể lực') || 
        s.name?.toLowerCase().includes('hp')
      );
      if (healthStat) {
        const valStr = String(healthStat.value).toLowerCase().trim();
        if (valStr === '0' || valStr === '0%' || valStr === 'cạn kiệt' || valStr === 'chết' || valStr === 'tử vong') {
          return true;
        }
      }
    }
    
    return false;
  }, [settings]);

  const triggerPermadeath = useCallback(async () => {
    setIsDead(true);
    // Delete save files
    const worldName = activeWorldRef.current?.world?.worldName;
    const worldId = activeWorldRef.current?.id;
    if (worldName || worldId) {
      try {
        const saves = await dbService.getAllSaves();
        for (const save of saves) {
          const sData = save.data as WorldData;
          if ((worldId && sData?.id === worldId) || (worldName && sData?.world?.worldName === worldName)) {
            await dbService.deleteSave(save.id);
          }
        }
        toast.error("Chế độ Địa Ngục: Nhân vật đã tử vong. Toàn bộ file lưu của thế giới này đã bị xóa sạch vĩnh viễn!");
      } catch (err) {
        console.error("Permadeath save deletion failed:", err);
      }
    }
  }, []);

  const [isReadyRef_flag, setIsReadyRef_flag] = useState(false); // Just a dummy to prevent unused
  const [tavoSelectState, setTavoSelectState] = useState<{
    options: any[];
    title?: string;
    defaultValue?: any;
    resolve: (val: any) => void;
  } | null>(null);

  useEffect(() => {
    tavoRegistry.activeWorld = activeWorld || null;
    tavoRegistry.updateWorld = onUpdateWorld || null;
    tavoRegistry.getHistory = () => historyRef.current;
    tavoRegistry.updateHistory = (h: ChatMessage[]) => {
      setHistory(h);
      historyRef.current = h;
    };
    tavoRegistry.showSelect = (
      options: any[],
      title?: string,
      defaultValue?: any,
    ) => {
      return new Promise<any>((resolve) => {
        setTavoSelectState({ options, title, defaultValue, resolve });
      });
    };
    tavoRegistry.generateText = async (promptText: string, options: any) => {
      // Implement tavo.generate
      const { dbService } = await import("../../../../services/db/indexedDB");
      const settings = (await dbService.getSettings()) as any; // We need current settings
      const { getAiClient } = await import("../../../../services/ai/client");
      const { getAiModel } =
        await import("../../../../services/ai/gameplay/service");
      const { buildPromptFromHistory } =
        await import("../../../../services/ai/gameplay/prompts");
      const client = getAiClient(settings);
      const modelName = getAiModel(settings);

      let finalPrompt = promptText;
      if (options?.context) {
        // Build context
        const ctxText = buildPromptFromHistory(
          options.preset
            ? { ...activeWorld?.config?.tawaPreset, ...options.preset }
            : (activeWorld?.config?.tawaPreset as any),
          historyRef.current,
          activeWorld!,
          gameTimeRef.current,
          promptText, // Append to the end as userInput
          settings,
        );
        finalPrompt = ctxText.prompt;
      }

      const modelOpts: any = {
        model: modelName,
        contents: finalPrompt,
        config: {
          temperature: options?.settings?.temperature ?? 0.7,
          topP: options?.settings?.topP ?? 0.9,
        },
      };

      if (
        options?.settings?.maxOutputTokens ||
        options?.settings?.maxCompletionTokens
      ) {
        modelOpts.config.maxOutputTokens =
          options.settings.maxOutputTokens ||
          options.settings.maxCompletionTokens;
      }

      const response = await client.models.generateContent(modelOpts);
      return response.text() || "";
    };

    return () => {
      tavoRegistry.generateText = null;
      tavoRegistry.showSelect = null;
    };
  }, [activeWorld, onUpdateWorld, setHistory]);

  // --- DERIVED STATE (MUST BE BEFORE HOOKS THAT USE THEM) ---
  const totalPages =
    history.length <= 11
      ? 1
      : 1 + Math.ceil((history.length - 11) / MESSAGES_PER_PAGE);
  const startIndex =
    currentPage === 1 ? 0 : 11 + (currentPage - 2) * MESSAGES_PER_PAGE;
  const endIndex = currentPage === 1 ? 11 : startIndex + MESSAGES_PER_PAGE;
  const displayedMessages = history.slice(startIndex, endIndex);

  const initializedRef = useRef(false);
  const isReadyRef = useRef(false); // Guard for syncing state - ALWAYS false initially
  const lastWorldRef = useRef<WorldData | null>(null);
  const initialStartedRef = useRef(false); // Guard for initial generation
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for state data to ensure up-to-date values in callbacks without triggering re-renders or loops

  const activeWorldSummaryRef = useRef<string | undefined>(
    activeWorld?.summary,
  );

  const activeWorldRef = useRef<WorldData | null>(activeWorld);

  // Helper to sync state back to App.tsx
  const syncWorldState = useCallback(
    (
      currentHistory?: ChatMessage[],
      currentTurn?: number,
      currentTime?: GameTime,
      currentLsrData?: Record<string, unknown[]>,
      currentSummary?: string,
    ) => {
      if (!isReadyRef.current) return; // Guard against stale sync during init
      // console.log(`GameplayScreen: Syncing state to App.tsx (Turn ${currentTurn !== undefined ? currentTurn : turnCountRef.current})...`);
      if (onUpdateWorld) {
        // Wrap in setTimeout to avoid "Cannot update a component while rendering" error
        setTimeout(() => {
          onUpdateWorld({
            summary: currentSummary || activeWorldSummaryRef.current,
            lsrData: currentLsrData || lsrRuntimeDataRef.current,
            config: {
              ...activeWorldRef.current?.config,
              rules: dynamicRulesRef.current,
              tawaPreset: tawaPresetConfigRef.current,
            },
            savedState: {
              history: currentHistory || historyRef.current,
              turnCount:
                currentTurn !== undefined ? currentTurn : turnCountRef.current,
              gameTime: currentTime || gameTimeRef.current,
              aiMonitor: {
                tokenHistory: tokenHistoryRef.current,
                totalTokens: totalTokensRef.current,
                lastTurnTotalTime: lastTurnTotalTimeRef.current,
              },
            },
          });
        }, 0);
      }
    },
    [onUpdateWorld],
  );

  // Sync refs with state
  useEffect(() => {
    tokenHistoryRef.current = tokenHistory;
  }, [tokenHistory]);
  useEffect(() => {
    totalTokensRef.current = totalTokens;
  }, [totalTokens]);
  useEffect(() => {
    lastTurnTotalTimeRef.current = lastTurnTotalTime;
  }, [lastTurnTotalTime]);

  useEffect(() => {
    activeWorldRef.current = activeWorld;
  }, [activeWorld]);

  // Auto-save changes (like sandbox variables) to IndexedDB
  useEffect(() => {
    if (!activeWorld || !activeWorld.activeSaveId || !isReadyRef.current) return;

    // Set a debounced timer to save the active world state to IndexedDB
    const timer = setTimeout(async () => {
      try {
        const saves = await dbService.getAllSaves();
        const existingSave = saves.find((s) => s.id === activeWorld.activeSaveId);

        // Prepare the updated SaveFile object
        const updatedSave: SaveFile = {
          id: activeWorld.activeSaveId,
          name:
            existingSave?.name ||
            `${activeWorld.world?.worldName || "Unknown World"} - Lượt ${turnCount} (Tự động)`,
          createdAt: existingSave?.createdAt || Date.now(),
          updatedAt: Date.now(),
          data: {
            ...activeWorld,
            lsrData: lsrRuntimeDataRef.current || activeWorld.lsrData,
            savedState: {
              ...(activeWorld.savedState || { history: [], turnCount: 0 }),
              history: historyRef.current || activeWorld.savedState?.history || [],
              turnCount:
                turnCountRef.current !== undefined
                  ? turnCountRef.current
                  : activeWorld.savedState?.turnCount || 0,
              gameTime: gameTimeRef.current || activeWorld.savedState?.gameTime,
            },
          },
        };

        await dbService.saveAutosave(updatedSave);
        console.log(
          `[AutoSave] Automatically saved modifications to active slot: ${activeWorld.activeSaveId}`,
        );
      } catch (err) {
        console.error(
          "[AutoSave] Failed to auto-save activeWorld changes:",
          err,
        );
      }
    }, 1500); // 1.5 second debounce

    return () => clearTimeout(timer);
  }, [activeWorld, turnCount]);
  useEffect(() => {
    combinedRegexScriptsRef.current = combinedRegexScripts;
  }, [combinedRegexScripts]);

  // CẢI TIẾN: Đồng bộ dữ liệu LSR sang danh sách thực thể (entities) để có thể tương tác
  useEffect(() => {
    if (!isReadyRef.current || !lsrRuntimeData || !activeWorld) return;

    const currentEntities = activeWorld.entities || [];
    const newEntities: Entity[] = [...currentEntities];
    let hasChanges = false;

    // Helper to add entity if not exists
    const addEntityIfNew = (
      rawName: string,
      type: Entity["type"],
      description?: string,
    ) => {
      const name = rawName ? rawName.trim() : "";
      if (!name || name === "" || name.length < 2) return;

      // CẢI TIẾN: Không thêm người chơi (PC) vào danh sách thực thể NPC
      const playerName = activeWorld.player?.name ? activeWorld.player.name.trim() : "";
      if (
        playerName &&
        (name.toLowerCase() === playerName.toLowerCase() ||
          name.toLowerCase() === "user" ||
          name.toLowerCase() === "player")
      )
        return;

      // Tránh trùng lặp (không phân biệt hoa thường)
      const exists = newEntities.some(
        (e) => (e.name ? e.name.trim().toLowerCase() : "") === name.toLowerCase(),
      );
      if (!exists) {
        newEntities.push({
          id: crypto.randomUUID(),
          name: name,
          type,
          description:
            description || `Thực thể được phát hiện qua hệ thống LSR.`,
          personality: "",
          avatar: "",
        });
        hasChanges = true;
      }
    };

    // Table #1 & #2: Characters
    ["1", "2"].forEach((tableId) => {
      const rows = (lsrRuntimeData[tableId] as any[]) || [];
      rows.forEach((row) => {
        const name = row["0"];
        if (name) addEntityIfNew(name, "NPC", row["3"] || row["6"]);
      });
    });

    // Table #6: Items
    const itemRows = (lsrRuntimeData["6"] as any[]) || [];
    itemRows.forEach((row) => {
      const name = row["0"];
      if (name) addEntityIfNew(name, "ITEM", row["5"]);
    });

    // Table #8: Locations
    const locRows = (lsrRuntimeData["8"] as any[]) || [];
    locRows.forEach((row) => {
      const name = row["0"];
      if (name) addEntityIfNew(name, "LOCATION", row["2"]);
    });

    if (hasChanges && onUpdateWorld) {
      // console.log("GameplayScreen: Syncing new entities from LSR data...", newEntities.length);
      onUpdateWorld({ entities: newEntities });
    }
  }, [lsrRuntimeData, activeWorld, onUpdateWorld]);

  // Contextual Player Character Sheet Auto-Sync Engine (Turn-by-turn or LSR Updates)
  useEffect(() => {
    if (!isReadyRef.current || !lsrRuntimeData || !activeWorld || !onUpdateWorld) return;
    const t2 = (lsrRuntimeData["2"] as any[]) || [];
    if (t2.length === 0) return;

    let updatedPlayer = { ...activeWorld.player };
    const lockedFields = updatedPlayer.lockedFields || [];
    let hasChanges = false;

    // Helper to check lock and apply
    const applyUpdate = (field: keyof typeof updatedPlayer, nextVal: string) => {
      if (lockedFields.includes(field)) return;
      if (updatedPlayer[field] !== nextVal) {
        (updatedPlayer as any)[field] = nextVal;
        hasChanges = true;
      }
    };

    t2.forEach((row) => {
      const key = row["0"] || row[0];
      const val = row["1"] || row[1];
      const desc = row["2"] || row[2] || "";
      if (!key || !val) return;

      const cleanKey = key.trim().toLowerCase();
      const cleanVal = val.trim();
      const combinedVal = desc.trim() ? `${cleanVal} (${desc.trim()})` : cleanVal;

      if (cleanKey === "tên" || cleanKey === "tên nhân vật" || cleanKey === "họ tên" || cleanKey === "chính" || cleanKey === "nhân vật chính" || cleanKey === "name") {
        if (cleanVal && cleanVal.toLowerCase() !== "user" && cleanVal.toLowerCase() !== "player" && cleanVal.toLowerCase() !== "chưa rõ") {
          applyUpdate("name", cleanVal);
        }
      } else if (cleanKey === "tuổi" || cleanKey === "age") {
        applyUpdate("age", cleanVal);
      } else if (cleanKey === "giới tính" || cleanKey === "gender") {
        applyUpdate("gender", cleanVal);
      } else if (cleanKey === "ngoại hình" || cleanKey === "appearance" || cleanKey === "diện mạo" || cleanKey === "trang phục" || cleanKey === "quần áo") {
        applyUpdate("appearance", combinedVal);
      } else if (cleanKey === "giọng nói" || cleanKey === "văn phong" || cleanKey === "giọng nói/văn phong" || cleanKey === "voice" || cleanKey === "tone" || cleanKey === "giọng") {
        applyUpdate("voiceAndTone", combinedVal);
      } else if (cleanKey === "giá trị" || cleanKey === "giá trị cốt lõi" || cleanKey === "core values" || cleanKey === "values") {
        applyUpdate("coreValues", combinedVal);
      } else if (cleanKey === "giới hạn hành vi" || cleanKey === "giới hạn" || cleanKey === "hard limits" || cleanKey === "limits") {
        applyUpdate("hardLimits", combinedVal);
      } else if (cleanKey === "biến cố định hình" || cleanKey === "biến cố" || cleanKey === "sự kiện định hình" || cleanKey === "defining events") {
        applyUpdate("definingEvents", combinedVal);
      } else if (cleanKey === "tâm trạng" || cleanKey === "mood" || cleanKey === "trạng thái" || cleanKey === "tâm trạng hiện tại") {
        applyUpdate("currentMood", combinedVal);
      } else if (cleanKey === "ứng xử quan hệ" || cleanKey === "quan hệ" || cleanKey === "thiết lập quan hệ" || cleanKey === "relationship" || cleanKey === "relationship tags") {
        applyUpdate("relationshipTags", combinedVal);
      } else if (cleanKey === "điểm mạnh" || cleanKey === "strengths" || cleanKey === "ưu điểm") {
        applyUpdate("strengths", combinedVal);
      } else if (cleanKey === "điểm yếu" || cleanKey === "weaknesses" || cleanKey === "nhược điểm") {
        applyUpdate("weaknesses", combinedVal);
      } else if (cleanKey === "vai trò" || cleanKey === "vai trò cốt truyện" || cleanKey === "role" || cleanKey === "narrative role") {
        applyUpdate("narrativeRole", combinedVal);
      } else if (cleanKey === "mâu thuẫn" || cleanKey === "mâu thuẫn nội tâm" || cleanKey === "contradictions") {
        applyUpdate("contradictions", combinedVal);
      } else if (cleanKey === "phản ứng thất bại" || cleanKey === "failure mode" || cleanKey === "thất bại") {
        applyUpdate("failureMode", combinedVal);
      } else if (cleanKey === "tính cách" || cleanKey === "personality") {
        applyUpdate("personality", combinedVal);
      } else if (cleanKey === "tiểu sử" || cleanKey === "background" || cleanKey === "backstory") {
        applyUpdate("background", combinedVal);
      } else if (cleanKey === "kỹ năng" || cleanKey === "skills" || cleanKey === "skill") {
        applyUpdate("skills", combinedVal);
      } else if (cleanKey === "mục tiêu" || cleanKey === "goal") {
        applyUpdate("goal", combinedVal);
      }
    });

    if (hasChanges) {
      console.log("GameplayScreen: Successfully AUTO-SYNCED Player Character Profile! Name:", updatedPlayer.name);
      onUpdateWorld({ player: updatedPlayer });
    }
  }, [lsrRuntimeData, activeWorld, onUpdateWorld]);

  // Chat Message Narrative Scanner for Auto-naming Protagonist
  useEffect(() => {
    if (!isReadyRef.current || !activeWorld || !onUpdateWorld || !history) return;
    const currentName = activeWorld.player?.name || "";
    const isGeneric = !currentName || currentName.toLowerCase() === "user" || currentName.toLowerCase() === "player" || currentName.toLowerCase() === "người chơi";
    
    if (isGeneric && history.length > 0) {
      // Find the first user message or any text claiming identity
      for (const msg of history) {
        if (msg.role === "user" && msg.content && typeof msg.content === "string") {
          const text = msg.content;
          // Vietnamese patterns
          const viPatterns = [
            /tôi tên là\s+([A-ZÀ-Ỹa-zà-ỹ\s]{2,20})/i,
            /tên tôi là\s+([A-ZÀ-Ỹa-zà-ỹ\s]{2,20})/i,
            /tên mình là\s+([A-ZÀ-Ỹa-zà-ỹ\s]{2,20})/i,
            /gọi tôi là\s+([A-ZÀ-Ỹa-zà-ỹ\s]{2,20})/i,
            /tên tớ là\s+([A-ZÀ-Ỹa-zà-ỹ\s]{2,20})/i,
            /gọi tớ là\s+([A-ZÀ-Ỹa-zà-ỹ\s]{2,20})/i,
            /tôi là/i, // Special check below
          ];
          // English patterns
          const enPatterns = [
            /my name is\s+([A-Za-z\s]{2,20})/i,
            /call me\s+([A-Za-z\s]{2,20})/i,
            /i am/i, // Special check below
          ];

          let foundName = "";
          
          // Check regex with explicit capture groups first
          for (const regex of [viPatterns[0], viPatterns[1], viPatterns[2], viPatterns[3], viPatterns[4], viPatterns[5], enPatterns[0], enPatterns[1]]) {
            const m = text.match(regex);
            if (m && m[1]) {
              const nameCandidate = m[1].trim().split(/[.,?!;\n]/)[0].trim();
              if (nameCandidate && nameCandidate.length > 1 && nameCandidate.length < 20) {
                foundName = nameCandidate;
                break;
              }
            }
          }

          // Fallback simple checks for "Tôi là X" / "I am X"
          if (!foundName) {
            const viIamMatch = text.match(/tôi là\s+([A-ZÀ-Ỹ][a-zà-ỹ\s]{1,15})/);
            if (viIamMatch && viIamMatch[1]) {
              const nameCandidate = viIamMatch[1].trim().split(/[.,?!;\n]/)[0].trim();
              if (nameCandidate && nameCandidate.length > 1 && nameCandidate.toLowerCase() !== "ai") {
                foundName = nameCandidate;
              }
            }
          }

          if (!foundName) {
            const enIamMatch = text.match(/i am\s+([A-Z][a-z\s]{1,15})/);
            if (enIamMatch && enIamMatch[1]) {
              const nameCandidate = enIamMatch[1].trim().split(/[.,?!;\n]/)[0].trim();
              if (nameCandidate && nameCandidate.length > 1) {
                foundName = nameCandidate;
              }
            }
          }

          if (foundName) {
            console.log("Narrative Scanner: Detected player name candidate:", foundName);
            onUpdateWorld({
              player: {
                ...activeWorld.player,
                name: foundName
              }
            });
            toast.success(`✨ Đã đồng bộ tên nhân vật chính từ lời nói của bạn: "${foundName}"!`);
            break; 
          }
        }
      }
    }
  }, [history, activeWorld, onUpdateWorld]);

  // Sync dynamic rules and tawa preset back to world state when they change
  useEffect(() => {
    if (
      isReadyRef.current &&
      (dynamicRules.length > 0 || combinedRegexScripts.length > 0)
    ) {
      syncWorldState();
    }
  }, [dynamicRules, combinedRegexScripts, syncWorldState]);

  useEffect(() => {
    if (isReadyRef.current) {
      syncWorldState();
    }
  }, [tawaPresetConfig, syncWorldState]);

  // Task: Scheduled Vectorization (Every 10 turns)
  const lastVectorizedTurnRef = useRef<number>(-1);

  useEffect(() => {
    if (!activeWorld || !settings?.enableVectorMemory || !isReadyRef.current)
      return;

    const currentTurn = turnCount;
    const shouldVectorize =
      currentTurn > 0 &&
      currentTurn % 50 === 0 &&
      currentTurn !== lastVectorizedTurnRef.current;

    if (shouldVectorize) {
      lastVectorizedTurnRef.current = currentTurn;
      // Small delay to ensure state is settled
      setTimeout(() => {
        vectorService.vectorizeAllHistory(historyRef.current, settings);
      }, 2000);
    }
  }, [turnCount, activeWorld, settings, isReadyRef]);

  // Timer Logic
  useEffect(() => {
    if (isLoading) {
      startProcessing();
      timerRef.current = setInterval(() => {
        setCurrentProcessingTime((prev) => prev + 100);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      endProcessing();
      // Sync one last time to capture the final processing time
      syncWorldState();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    isLoading,
    syncWorldState,
    startProcessing,
    endProcessing,
    setCurrentProcessingTime,
  ]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds}`;
  };

  // Sync AI Monitor data whenever it changes to persist across navigation
  // REMOVED to prevent infinite loop. Syncing is now handled manually after AI responses.

  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const AIMonitor = () => {
    // Determine effective proxy and model
    let activeProxy = settings?.proxies?.find(
      (p) => p.id === settings.activeProxyId,
    );
    if (!activeProxy && (settings?.proxyEnabled || settings?.proxyUrl)) {
      activeProxy = {
        id: "legacy",
        name: settings?.proxyName || "Legacy Proxy",
        url: settings?.proxyUrl || "",
        key: settings?.proxyKey || "",
        model: settings?.proxyModel || "",
        models: settings?.proxyModels || [],
        isActive: true,
        type:
          settings?.proxyUrl?.includes("moonshot") ||
          settings?.proxyUrl?.includes("kimi")
            ? "openai"
            : settings?.proxyEnabled
              ? "openai"
              : "google",
      } as any;
    }

    const isProxy = !!activeProxy?.url && !!activeProxy?.key;
    const activeModel =
      activeProxy && activeProxy.model ? activeProxy.model : settings?.aiModel;

    return (
      <div className="p-3 bg-stone-300 dark:bg-slate-900/80 rounded-lg border border-stone-400 dark:border-slate-700 space-y-2 font-mono text-[10px] mt-2">
        <div className="flex justify-between items-center border-b border-stone-400 dark:border-slate-800 pb-1.5">
          <span className="text-stone-500 dark:text-slate-500 uppercase font-bold">
            AI Monitor
          </span>
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="w-1.5 h-1.5 rounded-full bg-mystic-accent animate-pulse" />
            )}
            <span
              className={
                isLoading
                  ? "text-mystic-accent"
                  : "text-stone-400 dark:text-slate-600"
              }
            >
              {isLoading ? "PROCESSING" : "IDLE"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-slate-500 uppercase">
              Connection
            </span>
            <span className={isProxy ? "text-sky-500" : "text-emerald-500"}>
              {isProxy
                ? `REVERSE PROXY (${activeProxy?.name || "Unknown"})`
                : "DIRECT API"}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-slate-500 uppercase">
              Active Model
            </span>
            <span
              className="text-stone-700 dark:text-slate-300 truncate"
              title={activeModel}
            >
              {activeModel}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-stone-500 dark:text-slate-500 uppercase">
              Timer
            </span>
            <span className="text-amber-500 font-bold">
              {formatTime(
                isLoading ? currentProcessingTime : lastTurnTotalTime,
              )}
            </span>
          </div>

          <div className="flex flex-col">
            <div
              className="flex justify-between items-center cursor-pointer hover:text-mystic-accent transition-colors"
              onClick={() => setShowTokenDetails(!showTokenDetails)}
            >
              <span className="text-stone-500 dark:text-slate-500 uppercase">
                Tokens (Last 5)
              </span>
              <span className="text-[8px] opacity-50">
                {showTokenDetails ? "Ẩn" : "Hiện"} chi tiết
              </span>
            </div>
            <div className="flex gap-1 items-end h-4 mt-1">
              {tokenHistory.length > 0 ? (
                tokenHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="bg-mystic-accent/30 border-t border-mystic-accent w-2"
                    style={{
                      height: `${Math.min(100, (entry.tokens / 4000) * 100)}%`,
                    }}
                    title={`${entry.tokens} tokens, ${entry.words} words`}
                  />
                ))
              ) : (
                <span className="text-stone-400">No data</span>
              )}
            </div>

            {showTokenDetails && tokenHistory.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-stone-400/30 dark:border-slate-800/50 pt-1">
                {tokenHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-[9px] text-stone-600 dark:text-slate-400"
                  >
                    <span>#{tokenHistory.length - i}</span>
                    <span>{formatNumber(entry.tokens)} tkn</span>
                    <span>{formatNumber(entry.words)} chữ</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col border-t border-stone-400 dark:border-slate-800 pt-1">
            <div
              className="flex justify-between items-center cursor-pointer hover:text-mystic-accent transition-colors"
              onClick={() => setShowStatsDetails(!showStatsDetails)}
            >
              <span className="text-stone-500 dark:text-slate-500 uppercase">
                Thống kê
              </span>
              <span className="text-[8px] opacity-50">
                {showStatsDetails ? "Ẩn" : "Hiện"} chi tiết
              </span>
            </div>

            {showStatsDetails && (
              <div className="flex flex-col gap-0.5 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex justify-between">
                  <span>Gần nhất:</span>
                  <span className="text-stone-700 dark:text-slate-300">
                    {tokenHistory.length > 0
                      ? formatNumber(tokenHistory[0].tokens)
                      : 0}{" "}
                    tkn
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Số chữ:</span>
                  <span className="text-stone-700 dark:text-slate-300">
                    {tokenHistory.length > 0
                      ? formatNumber(tokenHistory[0].words)
                      : 0}{" "}
                    chữ
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tổng cộng:</span>
                  <span className="text-mystic-accent font-bold">
                    {formatNumber(totalTokens)} tkn
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Trung bình:</span>
                  <span className="text-stone-700 dark:text-slate-300">
                    {tokenHistory.length > 0
                      ? formatNumber(
                          Math.round(
                            tokenHistory.reduce((a, b) => a + b.tokens, 0) /
                              tokenHistory.length,
                          ),
                        )
                      : 0}{" "}
                    tkn
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  // Refs for auto-scrolling
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // --- Handlers (Defined as functions to avoid ReferenceError) ---

  // --- Auto-Scroll & Pagination Logic ---
  useEffect(() => {
    const totalPages =
      history.length <= 11
        ? 1
        : 1 + Math.ceil((history.length - 11) / MESSAGES_PER_PAGE);
    // Auto switch to last page when new message arrives
    if (history.length > 0) {
      setCurrentPage(totalPages);
    }
  }, [history.length]);

  // Scroll handler to detect if user is at the bottom
  const handleScroll = () => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollViewportRef.current;
      // Check if user is near bottom (e.g. 50px tolerance)
      const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 50;
      shouldAutoScrollRef.current = isAtBottom;
    }
  };

  useEffect(() => {
    if (pendingScrollTurnRef.current !== null) {
      const turnNumber = pendingScrollTurnRef.current;
      // Đợi một chút để DOM cập nhật sau khi chuyển trang
      const timer = setTimeout(() => {
        const element = document.getElementById(`turn-${turnNumber}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
          pendingScrollTurnRef.current = null;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentPage, displayedMessages]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // Khi AI vừa kết thúc lượt, ưu tiên cuộn đến đầu dòng "Lượt" mới nhất
      if (!isLoading && history.length > 0) {
        const lastMsg = history[history.length - 1];
        if (lastMsg.role === "model" && lastMsg.turnNumber !== undefined) {
          // Đợi DOM render xong ID
          const scrollTimeout = setTimeout(() => {
            const element = document.getElementById(
              `turn-${lastMsg.turnNumber}`,
            );
            if (element) {
              element.scrollIntoView({ behavior: "smooth" });
              setLastNavigatedTurn(lastMsg.turnNumber);
            } else if (chatEndRef.current) {
              chatEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
          }, 150);
          return () => clearTimeout(scrollTimeout);
        }
      }

      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [history, isLoading]);

  // Force scroll when page changes (navigating history)
  useEffect(() => {
    if (chatEndRef.current && pendingScrollTurnRef.current === null) {
      chatEndRef.current.scrollIntoView({ behavior: "auto" });
      shouldAutoScrollRef.current = true;
    }
  }, [currentPage]);

  // --- Handlers ---
  const triggerInitialSave = useCallback(
    async (world: WorldData, time: GameTime) => {
      if (!isReadyRef.current) return;
      try {
        // console.log("GameplayScreen: Triggering Initial Save (Bản lưu lượt 0)...");
        const worldData: WorldData = {
          ...world,
          lsrData: lsrRuntimeDataRef.current,
          config: {
            ...(world.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRulesRef.current,
            tawaPreset: tawaPresetConfigRef.current,
            regexScripts: combinedRegexScriptsRef.current,
          },
          savedState: {
            history: [],
            turnCount: 0,
            gameTime: time,
            aiMonitor: {
              tokenHistory: tokenHistoryRef.current,
              totalTokens: totalTokensRef.current,
              lastTurnTotalTime: lastTurnTotalTimeRef.current,
            },
          },
        };
        const worldName = world.world?.worldName || "Unknown_World";
        const slotId = `initial-${worldName.replace(/\s+/g, "_")}-start`;

        await dbService.saveAutosave({
          id: slotId,
          name: `${worldName} - Bản lưu lượt 0`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: worldData,
        });
      } catch (err) {
        console.error("Initial save failed", err);
      }
    },
    [],
  );

  const triggerAutosave = useCallback(
    async (
      currentHistory: ChatMessage[],
      currentTurn: number,
      currentTime: GameTime,
      currentLsrData?: Record<string, unknown[]>,
    ) => {
      if (!activeWorldRef.current || !isReadyRef.current) return;
      try {
        // console.log(`GameplayScreen: Triggering Autosave for Turn ${currentTurn}...`);
        const worldData: WorldData = {
          ...activeWorldRef.current,
          lsrData: currentLsrData || lsrRuntimeDataRef.current, // Use provided data or ref
          config: {
            ...(activeWorldRef.current.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRulesRef.current,
            tawaPreset: tawaPresetConfigRef.current,
            regexScripts: combinedRegexScriptsRef.current,
          },
          savedState: {
            history: currentHistory,
            turnCount: currentTurn,
            gameTime: currentTime,
            aiMonitor: {
              tokenHistory: tokenHistoryRef.current,
              totalTokens: totalTokensRef.current,
              lastTurnTotalTime: lastTurnTotalTimeRef.current,
            },
          },
        };

        const worldName =
          activeWorldRef.current.world?.worldName || "Unknown_World";
        const slotId = `autosave-${worldName.replace(/\s+/g, "_")}-${currentTurn}`;

        // Update activeSaveId to point to the new turn's slot
        worldData.activeSaveId = slotId;

        await dbService.saveAutosave({
          id: slotId,
          name: `${worldName} - Lượt ${currentTurn} (Tự động)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: worldData,
        });

        // Sync back to parent React store
        if (onUpdateWorld) {
          onUpdateWorld({ activeSaveId: slotId });
        }
      } catch (err) {
        console.error("Autosave failed", err);
      }
    },
    [onUpdateWorld],
  );

  const handleSend = async (textToSend: string, isFateBypass: boolean = false) => {
    if (!textToSend || isLoading || !activeWorld || !settings) return;

    // Handle internal Regex Slash Commands
    const trimText = textToSend.trim();
    if (trimText === '/regex-state' || trimText.startsWith('/regex-off ') || trimText.startsWith('/regex-on ')) {
        const isState = trimText === '/regex-state';
        const isOff = trimText.startsWith('/regex-off ');
        const isOn = trimText.startsWith('/regex-on ');
        const targetName = isOff ? trimText.replace('/regex-off ', '').trim() : (isOn ? trimText.replace('/regex-on ', '').trim() : '');

        let statusMessage = "";

        if (isState) {
            statusMessage = "**Regex Scripts State:**\n\n";
            if (!combinedRegexScripts || combinedRegexScripts.length === 0) {
                 statusMessage += "No regex scripts found.";
            } else {
                 combinedRegexScripts.forEach(script => {
                     statusMessage += `- **${script.scriptName}**: ${script.disabled ? '🔴 OFF' : '🟢 ON'} *(Placement: ${script.placement.join(', ')})*\n`;
                 });
            }
        } else if (targetName && combinedRegexScripts) {
            let found = false;
            
            // We need to mutate the actual sources to persist
            // 1. Settings (Global)
            const globals = [...(settings.regex_scripts || [])];
            let modifiedGlobals = false;
            globals.forEach(s => {
                if (s.scriptName === targetName) {
                    s.disabled = isOff;
                    modifiedGlobals = true;
                    found = true;
                }
            });
            if (modifiedGlobals) {
                const newSettings = { ...settings, regex_scripts: globals };
                setSettings(newSettings);
                dbService.saveSettings(newSettings);
            }

            // 2. ActiveWorld (Scoped)
            const scopeds = [...(activeWorld.extensions?.regex_scripts || [])];
            let modifiedScopeds = false;
            scopeds.forEach(s => {
                if (s.scriptName === targetName) {
                    s.disabled = isOff;
                    modifiedScopeds = true;
                    found = true;
                }
            });
            if (modifiedScopeds && onUpdateWorld) {
                onUpdateWorld({
                    extensions: {
                        ...(activeWorld.extensions || {}),
                        regex_scripts: scopeds
                    }
                });
            }

            // 3. Current combined (for immediate UI reflection without full reload)
            const updatedCombined = combinedRegexScripts.map(s => {
                if (s.scriptName === targetName) return { ...s, disabled: isOff };
                return s;
            });
            setCombinedRegexScripts(updatedCombined);

            // Trigger reload from DB basically
            setTimeout(() => reloadRegexScripts(), 100);

            if (found) {
                statusMessage = `Regex script \`${targetName}\` has been turned **${isOff ? 'OFF' : 'ON'}**.`;
            } else {
                statusMessage = `Regex script \`${targetName}\` not found in current scope.`;
            }
        }

        // Add to history as a system message
        const sysMsg: ChatMessage = {
            role: "system",
            text: statusMessage,
            timestamp: Date.now(),
            gameTime: gameTime,
            turnNumber: turnCount,
        };
        const newHistory = [...history, sysMsg];
        setHistory(newHistory);
        syncWorldState(newHistory, turnCount, gameTime);
        setTimeout(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, 50);
        return;
    }

    // Intercept with Fate Encounter Roll if enabled and not bypassed
    const isSlash = trimText.startsWith("/");
    if (fateSettings.enabled && !isSlash && !isFateBypass) {
      const shouldTrigger = (Math.random() * 100) <= (fateSettings.rate ?? 100);
      if (shouldTrigger) {
        setPendingActionText(textToSend);
        if (fateSettings.autoRoll) {
          // Auto roll backstage
          const maxVal = fateSettings.diceType === "D20" ? 20 : 100;
          const roll = Math.floor(Math.random() * maxVal) + 1;
          const failed = roll < fateSettings.dc;
          
          if (failed) {
            toast.error(`🎲 Định mệnh đổ ${fateSettings.diceType} = ${roll} (Thất bại < DC ${fateSettings.dc})! Biến cố Ám Tuyến ập đến...`);
            
            if (fateSettings.onlyHiddenFromSchedule) {
              // Extract from 7-day schedule
              const scheduleEvents: any[] = [];
              const worldId = activeWorld.id || "default";
              ["user", "char"].forEach((p) => {
                const cached = dbService.getKeyValueSync(`ark-schedule-v5-${worldId}-${p}`);
                if (cached) {
                  try {
                    const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
                    if (parsed.days) {
                      parsed.days.forEach((d: any) => {
                        if (d.events) {
                          d.events.forEach((ev: any) => {
                            if (ev.type === "hidden") scheduleEvents.push(ev);
                          });
                        }
                      });
                    }
                  } catch(e){}
                }
              });

              const selectedEvent = scheduleEvents.length > 0
                ? scheduleEvents[Math.floor(Math.random() * scheduleEvents.length)]
                : DEFAULT_CRISES[Math.floor(Math.random() * DEFAULT_CRISES.length)];

              const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn thực hiện hành động trên nhưng đã tung thất bại xúc xắc định mệnh ${fateSettings.diceType} = ${roll} (Dưới độ khó DC ${fateSettings.dc}).\n\nBIẾN CỐ ÁM TUYẾN: ${selectedEvent.title}.\nDiễn biến biến cố bất ngờ: ${selectedEvent.description}`;
              handleSend(injectText, true);
            } else {
              // Procedural dynamic generation using AI backstage!
              const toastId = toast.loading("🎲 Định mệnh tăm tối xoay vần... Hệ thống đang dùng AI dệt kết biến cố tương thích bối cảnh...");
              
              // We execute in an IIFE or similar asynchronous routine
              (async () => {
                try {
                  const { getAiClient } = await import("../../../../services/ai/client");
                  const { getAiModel } = await import("../../../../services/ai/gameplay/service");
                  const { formatGameTime } = await import("../../../../utils/timeUtils");

                  const client = getAiClient(settings || undefined);
                  const activeModel = getAiModel(settings || undefined);

                  const historyText = history.slice(-10)
                    .map(m => {
                      const speaker = m.role === "user" ? activeWorld.player.name : (activeWorld.entities?.[0]?.name || "AI");
                      return `${speaker}: ${m.text}`;
                    })
                    .join("\n\n");

                  const prompt = `Bạn là Dungeon Master trong trò chơi nhập vai dã sử / kỳ ảo trinh thám. Người chơi vừa thực hiện hành động sau nhưng đã tung xúc xắc định mệnh thất bại (Fate Roll Failure):
"${textToSend}"

Bối cảnh thế giới hiện hành:
- Thế giới nhập vai: ${activeWorld.world?.name || "Tự do khám phá"}
- Mô tả bối cảnh: ${activeWorld.world?.description || ""}
- Nhân vật chính: ${activeWorld.player.name} (${activeWorld.player.appearance || "Nhân vật chính"})
- Người đối thoại chủ chốt: ${activeWorld.entities?.[0]?.name || "AI"} (${activeWorld.entities?.[0]?.description || ""})
- Mốc thời gian game: ${gameTime ? formatGameTime(gameTime) : "Hiện tại"}

Lịch sử trò chuyện gần đây để bắt bối cảnh:
${historyText}

Hãy tạo ra một biến cố Ám tuyến phi thường đột ngột trực tiếp dội thẳng vào thế giới xung quanh họ (phù hợp với thế giới dã sử trinh thám và triệt tiêu tính hòa bình lúc này). Biến cố phải tạo ra thử thách trực diện (nhờ vả bị bẫy, rơi mật thư đầy ký tự lạ ám chỉ sát thủ đang săn đuổi, bóng đen đột kích trong sương mù, sập hầm cơ quan ẩn mật giấu kín...).

Yêu cầu định dạng JSON chính xác tuyệt đối sau:
{
  "title": "<Tiêu đề biến cố giật gân, mười chữ trở lại>",
  "description": "<Dòng miêu tả kịch tính giàu văn phong văn học gợi mở, khoảng 100 chữ bằng tiếng Việt>",
  "location": "<Vị trí chính xác phát sinh biến cố>"
}`;

                  const response = await client.models.generateContent({
                    model: activeModel,
                    contents: prompt,
                    config: {
                      temperature: 0.85,
                      responseMimeType: "application/json"
                    }
                  });

                  const responseText = response.text ? response.text.trim() : "";
                  const parsed = JSON.parse(responseText);

                  if (parsed.title && parsed.description) {
                    const loc = parsed.location ? ` (Địa điểm: ${parsed.location})` : "";
                    const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn thực hiện hành động trên nhưng đã tung thất bại xúc xắc định mệnh ${fateSettings.diceType} = ${roll} (Dưới độ khó DC ${fateSettings.dc}).\n\nBIẾN CỐ ÁM TUYẾN ẬP XUỐNG: "${parsed.title}"${loc}\nDiễn biến biến cố bất ngờ: ${parsed.description}\n\n(AI/Dungeon Master hãy kết hợp sự kiện bất ngờ khốc liệt này vào mạch truyện để dồn dập kịch tính hóa màn chơi kế tiếp nhé!)`;
                    toast.dismiss(toastId);
                    handleSend(injectText, true);
                  } else {
                    throw new Error("Cấu trúc JSON không hợp lệ");
                  }
                } catch (err) {
                  console.error("Lỗi sinh biến cố AI trong auto-roll, chuyển về mặc định:", err);
                  const randomPick = DEFAULT_CRISES[Math.floor(Math.random() * DEFAULT_CRISES.length)];
                  const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn thực hiện hành động trên nhưng đã tung thất bại xúc xắc định mệnh ${fateSettings.diceType} = ${roll} (Dưới độ khó DC ${fateSettings.dc}).\n\nBIẾN CỐ ÁM TUYẾN: ${randomPick.title}.\nDiễn biến biến cố bất ngờ: ${randomPick.description}`;
                  toast.dismiss(toastId);
                  handleSend(injectText, true);
                }
              })();
            }
          } else {
            toast.success(`🎲 Định mệnh đổ ${fateSettings.diceType} = ${roll} (Thành công >= DC ${fateSettings.dc})! Thân thể bình an.`);
            const injectText = `${textToSend}\n\n[🎲 BÁO CÁO HỆ THỐNG - XÚC XẮC ĐỊNH MỆNH]: Bạn tung thành công xúc xắc Số phận ${fateSettings.diceType} = ${roll} (Đạt hoặc vượt độ khó DC ${fateSettings.dc}). Trực giác hoàn hảo mách bảo, bạn nương theo thời thế né tránh nguy ngại.`;
            handleSend(injectText, true);
          }
          return;
        } else {
          // Interactive mode
          setShowFateRollModal(true);
          return;
        }
      }
    }

    // Apply Format User Input regex (Placement 1) - Destructive only
    let finalUserText = textToSend;
    const isDebug =
      typeof window !== "undefined" &&
      (window as any).__TAWA_REGEX_DEBUG__ === true;
    const currentPlayerName = activeWorld.player?.name || "User";
    const currentCharName = activeWorld.entities?.[0]?.name || "Character";

    if (combinedRegexScripts) {
      if (finalUserText.startsWith("/")) {
        // Apply placement 3 (Slash Command) if it looks like a slash command
        finalUserText = getRegexedString(finalUserText, 3, combinedRegexScripts, {
          userName: currentPlayerName,
          charName: currentCharName,
          depth: 0,
          isDebug,
          isPrompt: false,
          isMarkdown: false,
        });
      }

      // Then apply standard user input mapping
      finalUserText = getRegexedString(finalUserText, 1, combinedRegexScripts, {
        userName: currentPlayerName,
        charName: currentCharName,
        depth: 0,
        isDebug,
        isPrompt: false,
        isMarkdown: false,
      });
    }

    setLastAction(textToSend); // Giữ text nguyên bản cho input box history? Tốt hơn là giữ raw
    setLastNavigatedTurn(null);

    // Thời gian sẽ được AI quyết định trong phản hồi tiếp theo
    const userMsg: ChatMessage = {
      role: "user",
      text: finalUserText,
      timestamp: Date.now(),
      gameTime: gameTime, // Giữ nguyên thời gian hiện tại cho tin nhắn người dùng
      turnNumber: turnCount + 1, // User action starts the new turn
    };
    const newHistory = [...history, userMsg];
    setHistory(newHistory);
    syncWorldState(newHistory, turnCount, gameTime);

    // Emit user send events
    (window as any).eventSource?.emit('message_sent', userMsg);
    (window as any).eventSource?.emit('user_message_rendered', userMsg);

    // Force auto-scroll on send
    shouldAutoScrollRef.current = true;

    if (settings.streamResponse) {
      await runStreamGeneration(
        userMsg.text,
        newHistory,
        settings,
        undefined,
        activeWorld,
        gameTime,
      );
    } else {
      setIsLoading(true);
      (window as any).eventSource?.emit('generation_started', {
        userInput: userMsg.text,
        turnCount: turnCount + 1
      });
      try {
        const effectiveWorldData: WorldData = {
          ...activeWorld,
          lsrData: lsrRuntimeDataRef.current, // Sử dụng dữ liệu LSR hiện tại từ Ref để tránh stale
          gameTime: gameTime,
          savedState: {
            history: newHistory,
            turnCount: turnCount,
            gameTime: gameTime,
          },
          config: {
            ...(activeWorld.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRules,
            tawaPreset: tawaPresetConfig,
            regexScripts: combinedRegexScripts,
          },
        };

        const result = await gameplayAiService.generateStoryTurn(
          userMsg.text,
          newHistory,
          effectiveWorldData,
          settings,
          tawaPresetConfig,
          gameTime,
        );
        if (result.usage?.totalTokenCount) {
          updateTokenHistory(result.usage.totalTokenCount, result.text);
        } else if (result.text) {
          // Fallback: Ước tính token nếu không có dữ liệu (thường do dùng Proxy)
          const estimatedTokens = Math.ceil(result.text.length / 4);
          updateTokenHistory(estimatedTokens, result.text);
        }
        processAIResponse(result.text, false, gameTime, undefined, result.groundingSources);
      } catch (error: any) {
        console.error("AI Generation failed:", error);
        setIsLoading(false);
        const detailedError = error instanceof Error ? error.message : String(error);
        processAIResponse(
          `*(Hệ thống: Có lỗi xảy ra trong quá trình tạo phản hồi. Chi tiết lỗi: ${detailedError}. Vui lòng kiểm tra cấu hình mạng hoặc API Key/Proxy trong Cài đặt và thử lại!)*`,
          false,
          gameTime,
        );
      }

      // Trigger Memory Archiving check
    }
  };

  // Fetch saves when history modal opens
  useEffect(() => {
    if (showHistoryModal) {
      loadSaveLists();
    }
  }, [showHistoryModal, loadSaveLists]);

  // Automated Schedule Progression & Butterfly Effect Hook
  const prevGameTimeRef = useRef<GameTime | null>(null);
  useEffect(() => {
    if (!activeWorld || !gameTime) return;

    if (prevGameTimeRef.current) {
      const isChanged =
        prevGameTimeRef.current.year !== gameTime.year ||
        prevGameTimeRef.current.month !== gameTime.month ||
        prevGameTimeRef.current.day !== gameTime.day ||
        prevGameTimeRef.current.hour !== gameTime.hour ||
        prevGameTimeRef.current.minute !== gameTime.minute;

      if (isChanged) {
        const runProgression = async () => {
          try {
            const result = await processScheduleAutoprogression(
              activeWorld.id || "default",
              gameTime,
              activeWorld,
              settings,
              (effect) => {
                toast.warning(`🦋 HIỆU ỨNG CÁNH BƯỚM: Lịch trình bị bỏ lỡ tạo ra biến số dòng thời gian!`, {
                  description: `${effect.title}: ${effect.consequence}`,
                  duration: 8000
                });
              }
            );

            if (result.processed && result.newRipples.length > 0) {
              const updated = [...historyRef.current];
              result.newRipples.forEach(rip => {
                updated.push({
                  role: "system",
                  text: `[🦋 HIỆU ỨNG CÁNH BƯỚM]: Hành động trễ nải hoặc dịch chuyển thời gian đã làm dở dang sự kiện "${rip.eventTitle}" tại ${rip.eventLocation}.\n\nTuyến tính bị lệch hướng: "${rip.title}"\nHệ quả cốt truyện: ${rip.consequence}\nTác động thế giới quan: ${rip.rippleEffect}\n\n(AI hãy tích hợp sâu sắc hệ quả gián tiếp kịch tính này vào lời thoại, miêu tả thế giới, và phản ứng kế tiếp của các nhân vật)`,
                  timestamp: Date.now(),
                  gameTime,
                  turnNumber: turnCountRef.current
                });
              });
              setHistory(updated);
              syncWorldState(updated, turnCountRef.current, gameTime);
            }
          } catch (e) {
            console.error("Lỗi tự động hóa tiến triển lịch trình:", e);
          }
        };
        runProgression();
      }
    }
    prevGameTimeRef.current = gameTime;
  }, [gameTime, activeWorld, settings, syncWorldState]);

  const handleLoadSave = (save: SaveFile) => {
    if (!save.data) return;
    const worldData = save.data as WorldData;
    if (!worldData.savedState) {
      return;
    }

    // Check for permadeath
    const dead = checkDeathStatus(worldData.savedState.history, worldData.lsrData);
    if (dead) {
      triggerPermadeath();
      setShowHistoryModal(false);
      return;
    }

    // Restore state
    const time = worldData.savedState.gameTime || INITIAL_GAME_TIME;
    setGameTime(time);
    gameTimeRef.current = time;

    setTurnCount(worldData.savedState.turnCount);
    turnCountRef.current = worldData.savedState.turnCount;

    setHistory(worldData.savedState.history);
    historyRef.current = worldData.savedState.history;

    setLsrRuntimeData(worldData.lsrData || {});
    lsrRuntimeDataRef.current = worldData.lsrData || {};

    // Mark as ready
    isReadyRef.current = true;

    // Attach active save ID
    worldData.activeSaveId = save.id;

    // Update activeWorld in parent
    if (onUpdateWorld) {
      onUpdateWorld(worldData);
    }

    setShowHistoryModal(false);
  };

  const handleRegenerate = async (msgIndex: number) => {
    if (isLoading || !activeWorld || !settings) return;

    // Determine context: history up to msgIndex - 1 (the user message triggering this)
    const prevHistory = history.slice(0, msgIndex);
    const userTriggerMsg = history[msgIndex - 1];

    // CRITICAL FIX: Use the gameTime from the user message as the starting point for regeneration
    // This prevents time from "stacking" or advancing incorrectly when retrying.
    const startTime = userTriggerMsg?.gameTime || gameTime;

    // Handle Turn 0 correctly: if msgIndex is 0, it's the opening narrative
    const userInput =
      msgIndex === 0
        ? "Hãy bắt đầu câu chuyện."
        : userTriggerMsg?.text || "Continue";

    // Force auto-scroll on regenerate
    shouldAutoScrollRef.current = true;

    if (settings.streamResponse) {
      // Pass the correct startTime to runStreamGeneration
      await runStreamGeneration(
        userInput,
        history,
        settings,
        msgIndex,
        activeWorld,
        startTime,
      );
    } else {
      setIsLoading(true);
      try {
        const effectiveWorldData: WorldData = {
          ...activeWorld,
          lsrData: lsrRuntimeDataRef.current,
          config: {
            ...(activeWorld.config || { rules: [], regex_scripts: [] }),
            rules: dynamicRules,
            tawaPreset: tawaPresetConfig,
            regexScripts: combinedRegexScripts,
          },
        };

        const result = await gameplayAiService.generateStoryTurn(
          userInput,
          prevHistory,
          effectiveWorldData,
          settings,
          tawaPresetConfig,
          startTime, // Use startTime here too
        );

        if (result.usage?.totalTokenCount) {
          updateTokenHistory(result.usage.totalTokenCount, result.text);
        } else if (result.text) {
          // Fallback: Ước tính token nếu không có dữ liệu (thường do dùng Proxy)
          const estimatedTokens = Math.ceil(result.text.length / 4);
          updateTokenHistory(estimatedTokens, result.text);
        }

        // Apply Format AI Output regex (Placement 3 & Placement 2) - Permanently (Destructive only)
        let finalRegenText = result.text;
        const isDebugRegen =
          typeof window !== "undefined" &&
          (window as any).__TAWA_REGEX_DEBUG__ === true;
        const playerNameToUseRegen = activeWorld.player?.name || "User";
        if (combinedRegexScripts) {
          // 1. Áp dụng các script Placement 3 (After AI Response - mặc định chỉnh sửa lưu trữ)
          finalRegenText = getRegexedString(
            finalRegenText,
            3,
            combinedRegexScripts,
            {
              userName: playerNameToUseRegen,
              charName: "Character",
              depth: 0,
              isDebug: isDebugRegen,
              isPrompt: false,
              isMarkdown: false,
            },
          );
          // 2. Áp dụng các script Placement 2 không đánh dấu là markdownOnly (chỉnh sửa lưu trữ)
          finalRegenText = getRegexedString(
            finalRegenText,
            2,
            combinedRegexScripts,
            {
              userName: playerNameToUseRegen,
              charName: "Character",
              depth: 0,
              isDebug: isDebugRegen,
              isPrompt: false,
              isMarkdown: false,
            },
          );
        }

        // updateMessageSwipes needs to handle time sync correctly
        updateMessageSwipes(msgIndex, finalRegenText, startTime);
        setIsLoading(false);
      } catch (error: any) {
        console.error("AI Regeneration failed:", error);
        setIsLoading(false);
        // Can't replace message inline if it failed completely, so we just stop loading
        const errDesc = error instanceof Error ? error.message : String(error);
        toast.error(`Lỗi tái tạo phản hồi (AI Regeneration): ${errDesc}. Vui lòng thử lại hoặc kiểm tra kết nối!`);
      }
    }
  };

  const runStreamGeneration = useCallback(
    async (
      userInput: string,
      currentHistory: ChatMessage[],
      currentSettings: AppSettings,
      regenerateIndex?: number,
      world?: WorldData,
      time?: GameTime,
    ) => {
      setIsLoading(true);
      (window as any).eventSource?.emit('generation_started', {
        userInput,
        turnCount: turnCountRef.current
      });
      try {
        const effectiveWorldData: WorldData = {
          ...(world || activeWorldRef.current!),
          lsrData: lsrRuntimeDataRef.current, // Sử dụng dữ liệu LSR hiện tại từ state
          gameTime: time || gameTimeRef.current,
          savedState: {
            history: currentHistory,
            turnCount: turnCountRef.current,
            gameTime: time || gameTimeRef.current,
          },
          config: {
            ...(world || activeWorldRef.current!).config,
            rules: dynamicRulesRef.current,
            tawaPreset: tawaPresetConfigRef.current,
            regexScripts: combinedRegexScriptsRef.current,
          },
        };

        const workingHistory =
          regenerateIndex !== undefined
            ? [...currentHistory.slice(0, regenerateIndex + 1)]
            : [...currentHistory];
        let targetIndex = regenerateIndex;

        let presetName = "Mặc định";
        try {
          const activeId =
            dbService.getKeyValueSync("tawa_active_preset_id_v4") || "default";
          const presetsRaw = dbService.getKeyValueSync("tawa_presets_list_v4");
          if (presetsRaw) {
            const presets = typeof presetsRaw === "string" ? JSON.parse(presetsRaw) : presetsRaw;
            const active = presets.find((p: any) => p.id === activeId);
            if (active) presetName = active.name;
          }
        } catch (e) {
          // Ignored empty catch block
        }
        const currentPreset = tawaPresetConfigRef.current;
        const cotUsedValue = currentPreset?.assistant_prefill
          ? `Prefill: ${currentPreset.assistant_prefill}`
          : "Không dùng";

        const defaultMetadata = {
          presetUsed: presetName,
          cotUsed: cotUsedValue,
          worldInfoConfig: `${activeWorldRef.current?.entities?.length || 0} Entities`,
        };

        // If NOT regenerating, create a placeholder message first
        if (targetIndex === undefined) {
          const placeholderMsg: ChatMessage = {
            role: "model",
            text: "",
            timestamp: Date.now(),
            gameTime: time || gameTimeRef.current,
            swipes: [""],
            swipeIndex: 0,
            choices: [],
            turnNumber:
              currentHistory.length === 0 ? 0 : turnCountRef.current + 1,
            userAction: currentHistory.length === 0 ? undefined : userInput,
            metadata: defaultMetadata,
          };
          workingHistory.push(placeholderMsg);
          targetIndex = workingHistory.length - 1;

          // Update state with placeholder
          setHistory([...workingHistory]);
        } else {
          // If regenerating, prepare the new swipe slot
          // workingHistory[targetIndex] should now exist because we passed the full history
          const msg = { ...(workingHistory[targetIndex] || {}) } as ChatMessage;

          // Ensure role and basic properties are present
          if (!msg.role) msg.role = "model";
          msg.metadata = defaultMetadata;

          const newSwipes = [...(msg.swipes || [msg.text || ""]), ""]; // Add empty slot
          msg.swipes = newSwipes;
          msg.swipeIndex = newSwipes.length - 1;
          msg.text = ""; // Clear current text for streaming visual

          // Ensure turn info is present even for legacy messages being regenerated
          if (msg.turnNumber === undefined) {
            msg.turnNumber = targetIndex === 0 ? 0 : turnCountRef.current;
          }
          if (msg.userAction === undefined && targetIndex > 0) {
            msg.userAction = userInput;
          }

          workingHistory[targetIndex] = msg;
          // Update state for visual feedback
          setHistory([...workingHistory]);
        }

        // Small delay to ensure state update (optional but safe)
        await new Promise((r) => setTimeout(r, 0));

        const stream = gameplayAiService.generateStoryTurnStream(
          userInput,
          regenerateIndex !== undefined
            ? currentHistory.slice(0, regenerateIndex)
            : currentHistory,
          effectiveWorldData,
          currentSettings,
          tawaPresetConfigRef.current,
          time || gameTimeRef.current,
        );

        let accumulatedText = "";
        let lastTokenCount = 0;
        let lastUIUpdateTime = 0;
        const UI_UPDATE_INTERVAL = 150; // Tần suất cập nhật UI (ms) - Giúp ổn định khi chuyển tab
        const groundingSources: { title: string; uri: string }[] = [];

        for await (const chunk of stream) {
          if (typeof chunk === "string") {
            accumulatedText += chunk;
          } else {
            if (chunk.text) accumulatedText += chunk.text;
            if (chunk.usageMetadata?.totalTokenCount) {
              lastTokenCount = chunk.usageMetadata.totalTokenCount;
            }
            // Safely retrieve grounding metadata from the stream chunk
            const gChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (gChunks && Array.isArray(gChunks)) {
              gChunks.forEach((gChunk: any) => {
                if (gChunk.web && gChunk.web.uri && gChunk.web.title) {
                  if (!groundingSources.some(s => s.uri === gChunk.web.uri)) {
                    groundingSources.push({
                      title: gChunk.web.title,
                      uri: gChunk.web.uri
                    });
                  }
                }
              });
            }
          }

          const now = Date.now();
          // Chỉ cập nhật UI nếu đã qua khoảng thời gian chỉ định hoặc là chunk cuối (thông qua việc kết thúc loop)
          if (now - lastUIUpdateTime > UI_UPDATE_INTERVAL) {
            if (targetIndex !== undefined && workingHistory[targetIndex]) {
              const msg = { ...workingHistory[targetIndex] };

              const swipes = [...(msg.swipes || [""])];
              const currentSwipeIdx = msg.swipeIndex || 0;

              // FILTER: Remove thinking blocks from UI display during streaming
              let displayContent = accumulatedText;
              const thinkingPatterns = [
                /<(?:thinking|think|thinhking|thought|thoughts)>[\s\S]*?<\/(?:thinking|think|thinhking|thought|thoughts)>/gi,
                /<(?:thinking|think|thinhking|thought|thoughts)>[\s\S]*$/gi, // Handle unclosed thinking tag while streaming
              ];
              thinkingPatterns.forEach((pattern) => {
                displayContent = displayContent.replace(pattern, "");
              });

              swipes[currentSwipeIdx] = displayContent;

              const branchesContent =
                extractTagContent(accumulatedText, "branches") ||
                extractTagContent(accumulatedText, "choices") ||
                extractTagContent(accumulatedText, "actions");
              const choicesList = parseChoices(branchesContent);

              msg.swipes = swipes;
              msg.text = accumulatedText;
              msg.choices = choicesList;
              msg.groundingSources = groundingSources.length > 0 ? groundingSources : undefined;

              workingHistory[targetIndex] = msg;
              setHistory([...workingHistory]);
              lastUIUpdateTime = now;
            }
          }
        }

        // ĐẢM BẢO CẬP NHẬT LẦN CUỐI CÙNG KHI KẾT THÚC LUỒNG
        if (targetIndex !== undefined && workingHistory[targetIndex]) {
          const msg = { ...workingHistory[targetIndex] };
          const swipes = [...(msg.swipes || [""])];
          const currentSwipeIdx = msg.swipeIndex || 0;

          // FILTER: Remove thinking blocks from UI display
          let displayContent = accumulatedText;
          const thinkingPatterns = [
            /<(?:thinking|think|thinhking|thought|thoughts)>[\s\S]*?<\/(?:thinking|think|thinhking|thought|thoughts)>/gi,
            /<(?:thinking|think|thinhking|thought|thoughts)>[\s\S]*$/gi,
          ];
          thinkingPatterns.forEach((pattern) => {
            displayContent = displayContent.replace(pattern, "");
          });

          swipes[currentSwipeIdx] = displayContent;

          const branchesContent =
            extractTagContent(accumulatedText, "branches") ||
            extractTagContent(accumulatedText, "choices") ||
            extractTagContent(accumulatedText, "actions");
          const choicesList = parseChoices(branchesContent);

          msg.swipes = swipes;
          msg.text = accumulatedText;
          msg.choices = choicesList;
          msg.groundingSources = groundingSources.length > 0 ? groundingSources : undefined;

          workingHistory[targetIndex] = msg;
          setHistory([...workingHistory]);
        }

        // Update token history once after stream completes
        if (lastTokenCount > 0) {
          updateTokenHistory(lastTokenCount, accumulatedText);
        } else if (accumulatedText.length > 0) {
          // Fallback: Ước tính token nếu không có dữ liệu (thường do dùng Proxy)
          const estimatedTokens = Math.ceil(accumulatedText.length / 4);
          updateTokenHistory(estimatedTokens, accumulatedText);
        }

        // Finalize parsing (Branches/Choices and Time)
        let finalTime = time || gameTimeRef.current;

        // Trích xuất thời gian tiêu tốn hoặc thiết lập lại thời gian từ AI
        const setTimeStr = extractTagContent(accumulatedText, "set_time");
        if (setTimeStr) {
          const parts = setTimeStr
            .split("|")
            .map((p) => parseInt(p.trim(), 10));
          if (parts.length === 5 && !parts.some(isNaN)) {
            finalTime = {
              year: parts[0],
              month: parts[1],
              day: parts[2],
              hour: parts[3],
              minute: parts[4],
            };
          }
        } else {
          const timeCostStr = extractTagContent(accumulatedText, "time_cost");
          let timeCost = parseInt(timeCostStr || "1", 10); // Mặc định 1 phút nếu không có thẻ
          if (isNaN(timeCost) || timeCost < 1) timeCost = 1; // Đảm bảo tối thiểu 1 phút
          finalTime = advanceTime(finalTime, timeCost);
        }

        setGameTime(finalTime);

        // Extract incrementalSummary
        const incrementalSummary = extractTagContent(
          accumulatedText,
          "incrementalSummary",
        );

        // Task: Parse LSR Data for immediate sync after stream
        const tableStored = extractTagContent(accumulatedText, "table_stored");
        let nextLsrData = lsrRuntimeDataRef.current;
        if (tableStored) {
          // console.log("GameplayScreen: Detected <table_stored> tag. Parsing...");
          const parsedData = LsrParser.parseLsrString(tableStored);
          // Guard: Only overwrite if we actually found some data in the tag
          if (Object.keys(parsedData).length > 0) {
            nextLsrData = parsedData;
            // console.log("GameplayScreen: Parsed LSR Data from <table_stored>:", nextLsrData);
            setLsrRuntimeData(nextLsrData);
          } else {
            console.warn(
              "GameplayScreen: <table_stored> was present but empty or unparseable. Keeping current data.",
            );
          }
        } else {
          const tableEdit = extractTagContent(accumulatedText, "tableEdit");
          if (tableEdit) {
            // console.log("GameplayScreen: Detected <tableEdit> tag. Merging edits...");
            const parsedEdits = LsrParser.parseLsrString(tableEdit);
            if (Object.keys(parsedEdits).length > 0) {
              // console.log("GameplayScreen: Parsed LSR Edits:", parsedEdits);
              nextLsrData = LsrParser.mergeLsrData(
                lsrRuntimeDataRef.current,
                parsedEdits,
              );
              setLsrRuntimeData(nextLsrData);
            }
          }
        }

        // CRITICAL: Calculate finalHistory EXPLICITLY from workingHistory
        if (targetIndex !== undefined && workingHistory[targetIndex]) {
          const msg = { ...workingHistory[targetIndex] };

          const branchesContent =
            extractTagContent(accumulatedText, "branches") ||
            extractTagContent(accumulatedText, "choices") ||
            extractTagContent(accumulatedText, "actions");
          const choicesList = parseChoices(branchesContent);

          const finalAccumulatedText = accumulatedText;

          msg.choices = choicesList;
          msg.gameTime = finalTime;
          msg.incrementalSummary = incrementalSummary;
          msg.text = finalAccumulatedText; // Ensure text is fully captured and formatted

          let presetName = "Mặc định";
          try {
            const activeId =
              dbService.getKeyValueSync("tawa_active_preset_id_v4") || "default";
            const presetsRaw = dbService.getKeyValueSync("tawa_presets_list_v4");
            if (presetsRaw) {
              const presets = typeof presetsRaw === "string" ? JSON.parse(presetsRaw) : presetsRaw;
              const active = presets.find((p: any) => p.id === activeId);
              if (active) presetName = active.name;
            }
          } catch (e: any) {
            console.warn("GameplayScreen: Failed to parse presets:", e);
          }
          const currentPreset = tawaPresetConfigRef.current;
          const cotUsedValue = currentPreset?.assistant_prefill
            ? `Prefill: ${currentPreset.assistant_prefill}`
            : "Không dùng";

          msg.metadata = {
            presetUsed: presetName,
            cotUsed: cotUsedValue,
            worldInfoConfig: `${activeWorldRef.current?.entities?.length || 0} Entities`,
          };

          // Also update the current swipe if regenerating
          if (msg.swipes && msg.swipeIndex !== undefined) {
            msg.swipes[msg.swipeIndex] = finalAccumulatedText;
          }

          workingHistory[targetIndex] = msg;
        }

        const finalHistory = [...workingHistory];
        setHistory(finalHistory);

        if (targetIndex !== undefined && regenerateIndex === undefined) {
          // Only increment turnCount if it's NOT the initial message (Turn 0)
          const isInitial = currentHistory.length === 0;
          const newTurnCount = isInitial
            ? turnCountRef.current
            : turnCountRef.current + 1;

          if (!isInitial) {
            setTurnCount(newTurnCount);
          }

          // console.log(`GameplayScreen: Finalizing Turn ${newTurnCount}. History length: ${finalHistory.length}`);

          // Trigger Autosave after stream completes
          triggerAutosave(finalHistory, newTurnCount, finalTime, nextLsrData);
          // Sync state after stream completes
          syncWorldState(
            finalHistory,
            newTurnCount,
            finalTime,
            nextLsrData,
            incrementalSummary,
          );
        } else {
          // If regenerating or no target, just sync current state
          syncWorldState(
            finalHistory,
            turnCountRef.current,
            finalTime,
            nextLsrData,
            incrementalSummary,
          );
        }
        setIsLoading(false);

        // Emit SillyTavern style events for streaming completed
        if (targetIndex !== undefined && workingHistory[targetIndex]) {
          const finalMsg = workingHistory[targetIndex];
          (window as any).eventSource?.emit('generation_ended', accumulatedText);
          (window as any).eventSource?.emit('message_received', finalMsg);
          (window as any).eventSource?.emit('character_message_rendered', finalMsg);
        }

        // Trigger Memory Archiving check after stream
      } catch (err: any) {
        console.error("Lỗi trong quá trình stream:", err);
        setIsLoading(false);
        if (targetIndex !== undefined) {
          setHistory((prev) => {
            const newH = [...prev];
            if (newH[targetIndex]) {
              newH[targetIndex].text +=
                "\n\n**[LỖI HỆ THỐNG: Quá trình tạo phản hồi bị ngắt quãng. Nguyên nhân có thể do hạn mức, cấu hình hoặc mạng.]**\nChi tiết: " +
                err.message;
            }
            return newH;
          });
        }
      }
    },
    [syncWorldState, triggerAutosave],
  );

  const processAIResponse = useCallback(
    (responseText: string, initial = false, time?: GameTime, alternateGreetings?: string[], groundingSources?: { title: string; uri: string }[]) => {
      const branchesContent =
        extractTagContent(responseText, "branches") ||
        extractTagContent(responseText, "choices") ||
        extractTagContent(responseText, "actions");
      const choicesList = parseChoices(branchesContent);

      // Trích xuất thời gian tiêu tốn hoặc thiết lập lại thời gian từ AI
      const setTimeStr = extractTagContent(responseText, "set_time");
      let updatedTime = time || gameTimeRef.current;

      if (setTimeStr) {
        const parts = setTimeStr.split("|").map((p) => parseInt(p.trim(), 10));
        if (parts.length === 5 && !parts.some(isNaN)) {
          updatedTime = {
            year: parts[0],
            month: parts[1],
            day: parts[2],
            hour: parts[3],
            minute: parts[4],
          };
        }
      } else {
        const timeCostStr = extractTagContent(responseText, "time_cost");
        let timeCost = parseInt(timeCostStr || (initial ? "0" : "1"), 10);
        if (!initial && (isNaN(timeCost) || timeCost < 1)) timeCost = 1; // Đảm bảo tối thiểu 1 phút cho hành động (trừ mở đầu)

        if (timeCost > 0 || initial) {
          updatedTime = advanceTime(updatedTime, timeCost);
        }
      }

      setGameTime(updatedTime);

      // Extract incrementalSummary
      const incrementalSummary = extractTagContent(
        responseText,
        "incrementalSummary",
      );

      let finalResponseText = responseText;
      const isDebugAI =
        typeof window !== "undefined" &&
        (window as any).__TAWA_REGEX_DEBUG__ === true;
      const playerNameToUse = activeWorldRef.current?.player?.name || "User";
      
      const applyRegex = (text: string) => {
        let result = text;
        if (combinedRegexScriptsRef.current) {
          // 1. Áp dụng các script Placement 3 (After AI Response - mặc định chỉnh sửa lưu trữ)
          result = getRegexedString(
            result,
            3,
            combinedRegexScriptsRef.current,
            {
              userName: playerNameToUse,
              charName: "Character",
              depth: 0,
              isDebug: isDebugAI,
              isPrompt: false,
              isMarkdown: false,
            },
          );
          // 2. Áp dụng các script Placement 2 không đánh dấu là markdownOnly (chỉnh sửa lưu trữ)
          result = getRegexedString(
            result,
            2,
            combinedRegexScriptsRef.current,
            {
              userName: playerNameToUse,
              charName: "Character",
              depth: 0,
              isDebug: isDebugAI,
              isPrompt: false,
              isMarkdown: false,
            },
          );
        }
        return result;
      };

      finalResponseText = applyRegex(finalResponseText);
      
      let finalSwipes = [finalResponseText];
      if (alternateGreetings && alternateGreetings.length > 0) {
        finalSwipes = [finalResponseText, ...alternateGreetings.map(applyRegex)];
      }

      let presetName = "Mặc định";
      try {
        const activeId =
          dbService.getKeyValueSync("tawa_active_preset_id_v4") || "default";
        const presetsRaw = dbService.getKeyValueSync("tawa_presets_list_v4");
        if (presetsRaw) {
          const presets = typeof presetsRaw === "string" ? JSON.parse(presetsRaw) : presetsRaw;
          const active = presets.find((p: any) => p.id === activeId);
          if (active) presetName = active.name;
        }
      } catch (e: any) {
        console.warn("GameplayScreen: Failed to parse presets:", e);
      }

      const currentPresetForMeta = tawaPresetConfigRef.current;
      const cotUsedValue = currentPresetForMeta?.assistant_prefill
        ? `Prefill: ${currentPresetForMeta.assistant_prefill}`
        : "Không dùng";

      const metadata = {
        presetUsed: presetName,
        cotUsed: cotUsedValue,
        worldInfoConfig: `${activeWorldRef.current?.entities?.length || 0} Entities`,
      };

      const modelMsg: ChatMessage = {
        role: "model",
        text: finalResponseText,
        timestamp: Date.now(),
        gameTime: updatedTime,
        choices: choicesList,
        swipes: finalSwipes,
        swipeIndex: 0,
        turnNumber: initial ? 0 : turnCountRef.current + 1,
        userAction: initial ? undefined : lastActionRef.current,
        incrementalSummary: incrementalSummary,
        metadata: metadata,
        groundingSources: groundingSources,
      };

      const newHistory = [...historyRef.current, modelMsg];
      // Task: Parse LSR Data for immediate sync
      const tableStored = extractTagContent(responseText, "table_stored");
      let nextLsrData = lsrRuntimeDataRef.current;
      if (tableStored) {
        // console.log("GameplayScreen (processAIResponse): Detected <table_stored>. Parsing...");
        const parsedData = LsrParser.parseLsrString(tableStored);
        if (Object.keys(parsedData).length > 0) {
          nextLsrData = parsedData;
          // console.log("GameplayScreen (processAIResponse): Parsed LSR Data:", nextLsrData);
          setLsrRuntimeData(nextLsrData);
        } else {
          console.warn(
            "GameplayScreen (processAIResponse): <table_stored> was empty or unparseable.",
          );
        }
      } else {
        const tableEdit = extractTagContent(responseText, "tableEdit");
        if (tableEdit) {
          // console.log("GameplayScreen (processAIResponse): Detected <tableEdit>. Merging edits...");
          const parsedEdits = LsrParser.parseLsrString(tableEdit);
          if (Object.keys(parsedEdits).length > 0) {
            // console.log("GameplayScreen (processAIResponse): Parsed LSR Edits:", parsedEdits);
            nextLsrData = LsrParser.mergeLsrData(
              lsrRuntimeDataRef.current,
              parsedEdits,
            );
            setLsrRuntimeData(nextLsrData);
          }
        }
      }

      setHistory(newHistory);

      // Emit SillyTavern style events
      (window as any).eventSource?.emit('generation_ended', responseText);
      (window as any).eventSource?.emit('message_received', modelMsg);
      (window as any).eventSource?.emit('character_message_rendered', modelMsg);

      const dead = checkDeathStatus(newHistory, nextLsrData);
      if (dead) {
        triggerPermadeath();
      }

      if (!initial) {
        const newTurnCount = turnCountRef.current + 1;
        setTurnCount(newTurnCount);
        // Sync & Autosave
        syncWorldState(
          newHistory,
          newTurnCount,
          updatedTime,
          nextLsrData,
          incrementalSummary,
        );
        triggerAutosave(newHistory, newTurnCount, updatedTime, nextLsrData);
      } else {
        // Initial message (Opening)
        syncWorldState(
          newHistory,
          turnCountRef.current,
          updatedTime,
          nextLsrData,
          incrementalSummary,
        );
        triggerAutosave(
          newHistory,
          turnCountRef.current,
          updatedTime,
          nextLsrData,
        );
      }
      setIsLoading(false);
    },
    [syncWorldState, triggerAutosave],
  );

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleSendInitial = useCallback(
    async (currentSettings: AppSettings, world: WorldData, time: GameTime) => {
      setIsLoading(true);
      // Enable auto scroll for initial load
      shouldAutoScrollRef.current = true;

      try {
        const campaignId =
          world.id ||
          `campaign-${world.world?.worldName?.replace(/\s+/g, "")}-${world.player?.name?.replace(/\s+/g, "")}`;
        storyBibleService
          .initialize(world, currentSettings, campaignId)
          .catch((err) => {
            console.error("Background StoryBible init failed", err);
          });
      } catch (e) {
        console.error("Failed to start StoryBible init", e);
      }

      // Nếu có firstMessage từ thẻ SillyTavern, sử dụng trực tiếp làm initial message
      if (
        world.world?.firstMessage &&
        world.world?.firstMessage.trim().length > 0
      ) {
        let rawFirstMsg = world.world?.firstMessage.trim();

        // CẢI TIẾN: Thay thế macro cơ bản của ST để lời chào đầu tự nhiên hơn
        const playerName = world.player?.name || "User";
        const charName = world.entities?.[0]?.name || "Character";
        
        const replaceMacros = (text: string) => {
          const res = text.replace(/\{\{\s*user\s*\}\}/gi, playerName);
          return res.replace(/\{\{\s*char\s*\}\}/gi, charName);
        };
        
        rawFirstMsg = replaceMacros(rawFirstMsg);
        
        const alternateGreetings = world.entities?.[0]?.alternate_greetings?.map(replaceMacros) || [];

        processAIResponse(rawFirstMsg, true, time, alternateGreetings);
        return;
      }

      // CẢI TIẾN: Tạo prompt mở đầu chi tiết hơn dựa trên kịch bản khởi đầu (nếu có)
      const startingScenario = world.world.startingScenario || "";
      const initialPrompt = startingScenario
        ? `Hãy bắt đầu câu chuyện dựa trên kịch bản khởi đầu này: "${startingScenario}". Hãy viết một mở đầu cực kỳ ấn tượng, sống động và lôi cuốn.`
        : "Hãy bắt đầu câu chuyện một cách tự nhiên và lôi cuốn nhất dựa trên bối cảnh thế giới và nhân vật đã thiết lập. Hãy thiết lập bối cảnh hiện tại một cách sống động.";

      if (currentSettings.streamResponse) {
        await runStreamGeneration(
          initialPrompt,
          [],
          currentSettings,
          undefined,
          world,
          time,
        );
      } else {
        const opening = await gameplayAiService.generateStoryTurn(
          initialPrompt,
          [],
          world,
          currentSettings,
          tawaPresetConfig,
          time,
        );
        if (opening.usage?.totalTokenCount) {
          updateTokenHistory(opening.usage.totalTokenCount, opening.text);
        } else if (opening.text) {
          const estimatedTokens = Math.ceil(opening.text.length / 4);
          updateTokenHistory(estimatedTokens, opening.text);
        }
        processAIResponse(opening.text, true, time);
      }
    },
    [runStreamGeneration, processAIResponse, tawaPresetConfig],
  );

  // --- Initial Load ---
  useEffect(() => {
    // If world session changes (e.g. from Menu), allow re-initialization
    if (
      activeWorld &&
      (!lastWorldRef.current ||
        activeWorld.sessionId !== lastWorldRef.current.sessionId)
    ) {
      // console.log("GameplayScreen: New world detected, resetting initialization.");
      initializedRef.current = false;
      lastWorldRef.current = activeWorld;
      initialStartedRef.current = false;
      isReadyRef.current = false; // Reset ready state for new world
    }

    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      // console.log("GameplayScreen: Starting initialization...");
      const s = await dbService.getSettings();
      setSettings(s);

      // Load LSR Definitions
      setLsrTables(LsrParser.parseDefinitions());

      if (activeWorld) {
        // Sync initial rules from world config
        setDynamicRules(activeWorld.config?.rules || []);

        // Sync Tawa Preset from world config
        if (activeWorld.config?.tawaPreset) {
          setTawaPresetConfig(activeWorld.config.tawaPreset);
          tawaPresetConfigRef.current = activeWorld.config.tawaPreset;
          const activePresetId = activeWorld.config.tawaPreset.id || "builtin_tawa_re_yil";
          dbService.setKeyValue("tawa_active_preset_id_v4", activePresetId);
        } else {
          try {
            // Automatically load and persist the default "Tawa Re = YIL" preset when starting a new world!
            const defaultSavedPreset = parseBuiltinPreset("builtin_tawa_re_yil", "Tawa Re = YIL丨Alpha V1", tawaReYilPresetData);
            setTawaPresetConfig(defaultSavedPreset.config);
            tawaPresetConfigRef.current = defaultSavedPreset.config;
            dbService.setKeyValue("tawa_active_preset_id_v4", "builtin_tawa_re_yil");

            // Populate presets list in DB if empty so PresetManager loading presets list works flawlessly
            const currentPresets = dbService.getKeyValueSync("tawa_presets_list_v4");
            if (!currentPresets) {
              const defaultPresetsList = [
                defaultSavedPreset,
                parseBuiltinPreset("builtin_tawa_delta", "Tawa Delta Combined丨Mới Nhất", tawaDeltaPresetData)
              ];
              dbService.setKeyValue("tawa_presets_list_v4", defaultPresetsList);
            }

            if (onUpdateWorld) {
              const updatedConfig = {
                ...(activeWorld.config || {}),
                tawaPreset: defaultSavedPreset.config,
                regexScripts: defaultSavedPreset.config.regexScripts
              };
              onUpdateWorld({ config: updatedConfig });
            }
          } catch (e) {
            console.error("Failed to load default Tawa preset", e);
          }
        }

        reloadRegexScripts();

        // Load LSR Data
        if (activeWorld.lsrData) {
          setLsrRuntimeData(activeWorld.lsrData);
        }

        const worldDataWithState = activeWorld as WorldData;
        if (
          worldDataWithState.savedState &&
          worldDataWithState.savedState.history.length > 0
        ) {
          // console.log("GameplayScreen: Loading saved state, history length:", worldDataWithState.savedState.history.length);
          setHistory(worldDataWithState.savedState.history);
          historyRef.current = worldDataWithState.savedState.history;

          const dead = checkDeathStatus(worldDataWithState.savedState.history, worldDataWithState.lsrData);
          if (dead) {
            triggerPermadeath();
          }

          setTurnCount(worldDataWithState.savedState.turnCount);
          turnCountRef.current = worldDataWithState.savedState.turnCount;

          if (worldDataWithState.savedState.gameTime) {
            setGameTime(worldDataWithState.savedState.gameTime);
            gameTimeRef.current = worldDataWithState.savedState.gameTime;
          }

          // Restore AI Monitor state
          syncAiMonitorFromSave(worldDataWithState.savedState.aiMonitor);

          // Mark as ready AFTER state is set
          isReadyRef.current = true;
          // console.log("GameplayScreen: Initialization complete (Loaded Save).");
        } else {
          // console.log("GameplayScreen: No saved state found, starting new game.");
          // New world or empty history: Reset AI Monitor
          syncAiMonitorFromSave(null);

          if (s && !initialStartedRef.current) {
            // Initial Start: Generate opening
            initialStartedRef.current = true;
            const initialTime =
              worldDataWithState.gameTime || INITIAL_GAME_TIME;
            setGameTime(initialTime);

            // Mark as ready BEFORE initial generation so it can sync
            isReadyRef.current = true;

            // Trigger Initial Save (Bản lưu lượt 0) BEFORE opening generation
            await triggerInitialSave(worldDataWithState, initialTime);

            handleSendInitial(s, worldDataWithState, initialTime);
            // console.log("GameplayScreen: Initialization complete (New Game).");
          }
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorld, handleSendInitial, triggerInitialSave]);

  const updateMessageSwipes = (
    index: number,
    newText: string,
    overrideTime?: GameTime,
  ) => {
    // Task: Parse LSR Data for immediate sync during swipe/regen
    const tableStored = extractTagContent(newText, "table_stored");
    let nextLsrData = lsrRuntimeDataRef.current;
    if (tableStored) {
      // console.log("GameplayScreen (updateMessageSwipes): Detected <table_stored>. Parsing...");
      nextLsrData = LsrParser.parseLsrString(tableStored);
      // console.log("GameplayScreen (updateMessageSwipes): Parsed LSR Data:", nextLsrData);
      setLsrRuntimeData(nextLsrData);
    } else {
      const tableEdit = extractTagContent(newText, "tableEdit");
      if (tableEdit) {
        // console.log("GameplayScreen (updateMessageSwipes): Detected <tableEdit>. Parsing edits...");
        const parsedEdits = LsrParser.parseLsrString(tableEdit);
        // console.log("GameplayScreen (updateMessageSwipes): Parsed LSR Edits:", parsedEdits);
        nextLsrData = LsrParser.mergeLsrData(
          lsrRuntimeDataRef.current,
          parsedEdits,
        );
        setLsrRuntimeData(nextLsrData);
      }
    }

    setHistory((prev) => {
      // Truncate history to the current index to ensure story divergence
      const updated = prev.slice(0, index + 1);
      const msg = { ...(updated[index] || {}) } as ChatMessage;

      // Ensure role is present
      if (!msg.role) msg.role = "model";

      const branchesContent =
        extractTagContent(newText, "branches") ||
        extractTagContent(newText, "choices") ||
        extractTagContent(newText, "actions");
      const choicesList = parseChoices(branchesContent);

      const currentSwipes = msg.swipes || [msg.text];
      const newSwipes = [...currentSwipes, newText];

      msg.swipes = newSwipes;
      msg.swipeIndex = newSwipes.length - 1;
      msg.text = newText;
      msg.choices = choicesList; // Update choices to latest generation

      // Calculate final time for this swipe
      let finalTime = overrideTime || gameTime;
      const setTimeStr = extractTagContent(newText, "set_time");
      if (setTimeStr) {
        const parts = setTimeStr.split("|").map((p) => parseInt(p.trim(), 10));
        if (parts.length === 5 && !parts.some(isNaN)) {
          finalTime = {
            year: parts[0],
            month: parts[1],
            day: parts[2],
            hour: parts[3],
            minute: parts[4],
          };
        }
      } else {
        const timeCostStr = extractTagContent(newText, "time_cost");
        let timeCost = parseInt(timeCostStr || "1", 10);
        if (isNaN(timeCost) || timeCost < 1) timeCost = 1;
        finalTime = advanceTime(finalTime, timeCost);
      }

      msg.gameTime = finalTime;
      setGameTime(finalTime);

      // Extract incrementalSummary
      const incrementalSummary = extractTagContent(
        newText,
        "incrementalSummary",
      );
      msg.incrementalSummary = incrementalSummary;

      // Ensure turn info is present even for legacy messages being regenerated
      if (msg.turnNumber === undefined) {
        msg.turnNumber = index === 0 ? 0 : turnCount;
      }
      if (msg.userAction === undefined && index > 0) {
        msg.userAction = updated[index - 1].text;
      }

      updated[index] = msg;

      // Sync state back to parent
      syncWorldState(
        updated,
        turnCount,
        finalTime,
        nextLsrData,
        incrementalSummary,
      );
      return updated;
    });
  };

  const handleToggleHideMessage = useCallback(
    (index: number) => {
      setHistory((prev) => {
        const newHistory = [...prev];
        if (newHistory[index]) {
          newHistory[index] = {
            ...newHistory[index],
            isHidden: !newHistory[index].isHidden,
          };
          setTimeout(() => syncWorldState(newHistory), 0);
        }
        return newHistory;
      });
    },
    [syncWorldState],
  );

  const handleMessageUpdate = useCallback((index: number, newText: string) => {
    setHistory((prev) => {
      const newHistory = [...prev];
      if (newHistory[index]) {
        const msgToEdit = newHistory[index];
        const currentPlayerName =
          activeWorldRef.current?.player?.name || "User";
        // Apply only regex scripts that have runOnEdit = true
        let finalText = newText;
        const isDebug =
          typeof window !== "undefined" &&
          (window as any).__TAWA_REGEX_DEBUG__ === true;
        let scriptsToRunOnEdit: any[] = [];
        if (combinedRegexScriptsRef.current) {
          scriptsToRunOnEdit = [
            ...combinedRegexScriptsRef.current.filter((s: any) => s.runOnEdit),
          ];
        }
        if (scriptsToRunOnEdit.length > 0) {
          const messageDepth =
            newHistory.length > 0 ? newHistory.length - 1 - index : -1;
          const placement = msgToEdit.role === "user" ? 1 : 2;
          if (placement === 2) {
            // Apply Placement 3 edits
            finalText = getRegexedString(
              finalText,
              3,
              scriptsToRunOnEdit,
              {
                userName: currentPlayerName,
                charName: "Character",
                depth: messageDepth,
                isDebug,
                isEdit: true,
                isPrompt: false,
                isMarkdown: false,
              },
            );
          }
          finalText = getRegexedString(
            finalText,
            placement,
            scriptsToRunOnEdit,
            {
              userName: currentPlayerName,
              charName: "Character",
              depth: messageDepth,
              isDebug,
              isEdit: true,
              isPrompt: false,
              isMarkdown: false,
            },
          );
        }

        // Update raw text
        const msg = { ...newHistory[index] };
        msg.text = finalText;

        // Also update the specific swipe if it exists
        if (msg.swipes && msg.swipeIndex !== undefined) {
          const newSwipes = [...msg.swipes];
          newSwipes[msg.swipeIndex] = finalText;
          msg.swipes = newSwipes;
        }

        if (msg.role === "model") {
          const branchesContent =
            extractTagContent(finalText, "branches") ||
            extractTagContent(finalText, "choices") ||
            extractTagContent(finalText, "actions");
          msg.choices = parseChoices(branchesContent);
        }
        newHistory[index] = msg;
        setTimeout(() => syncWorldState(newHistory), 0);
      }
      return newHistory;
    });
  }, [syncWorldState]);

  const handleEntityClick = useCallback(
    (id: string) => {
      const entity = activeWorld?.entities.find((e) => e.id === id);
      if (entity) setSelectedEntity(entity);
    },
    [activeWorld?.entities],
  );

  const executeWidgetAction = useCallback((action: string, payload: any) => {
    if (!action) return;
    const normAction = action.toUpperCase();

    switch (normAction) {
      case "UPDATE_LSR":
        if (payload && typeof payload === "object") {
          setLsrRuntimeData((prev) => {
            const nextData = { ...prev };
            for (const key in payload) {
              if (Array.isArray(payload[key])) {
                nextData[key] = payload[key];
              }
            }
            return nextData;
          });
        }
        break;
      case "OVERWRITE_LSR":
        if (payload && typeof payload === "object") {
          setLsrRuntimeData(payload);
        }
        break;
      case "SEND_MESSAGE":
      case "SEND_INPUT":
      case "SENDINPUT":
      case "SENDREPLY":
      case "SEND_REPLY":
        if (
          typeof payload === "string" &&
          payload.trim() &&
          handleSendRef.current
        ) {
          handleSendRef.current(payload);
        } else if (
          payload &&
          typeof payload.text === "string" &&
          payload.text.trim() &&
          handleSendRef.current
        ) {
          handleSendRef.current(payload.text);
        }
        break;
      case "SEND_OPENING_DATA":
      case "OPENING_DATA":
      case "SENDOPENINGDATA":
      case "OPENINGDATA":
        if (payload) {
          (async () => {
            let textVal = "";
            let dataVal = null;
            if (typeof payload === "string") {
              textVal = payload;
            } else if (payload && typeof payload === "object") {
              textVal = payload.text || payload.message || payload.content || "";
              dataVal = payload.data || payload.variables || payload.payload || null;
            }
            if (dataVal && typeof dataVal === "object") {
              try {
                const setVarsFn = (window as any).setVariables || (window as any).parent?.setVariables;
                if (typeof setVarsFn === "function") {
                  await setVarsFn(dataVal);
                  console.log("[SillyTavern Bridge] Synced variables from widget SEND_OPENING_DATA action:", dataVal);
                }
              } catch (e) {
                console.warn("[SillyTavern Bridge] Failed to update variables for SEND_OPENING_DATA widget action:", e);
              }
            }
            if (textVal && typeof textVal === "string") {
              console.log("[SillyTavern Bridge] Handling SEND_OPENING_DATA widget action content:", textVal);
              if (handleSendRef.current) {
                handleSendRef.current(textVal);
              } else {
                handleSend(textVal);
              }
            }
          })();
        }
        break;
      case "EDIT_LAST_MESSAGE":
      case "EDITLASTMESSAGE":
        if (payload && typeof payload === "string" && history.length > 0) {
          const lastUserMsgIndex = [...history]
            .reverse()
            .findIndex((m) => m.role === "user");
          if (lastUserMsgIndex !== -1) {
            const realIndex = history.length - 1 - lastUserMsgIndex;
            handleMessageUpdate(realIndex, payload);
          }
        } else if (payload && typeof payload.text === "string" && history.length > 0) {
          const lastUserMsgIndex = [...history]
            .reverse()
            .findIndex((m) => m.role === "user");
          if (lastUserMsgIndex !== -1) {
            const realIndex = history.length - 1 - lastUserMsgIndex;
            handleMessageUpdate(realIndex, payload.text);
          }
        }
        break;
      case "NAVIGATE":
        if (payload && typeof payload === "string") {
          onNavigate(payload as any);
        }
        break;
      case "SHOW_MODAL": {
        const pStr = String(payload).toLowerCase();
        if (pStr === "character") setShowCharModal(true);
        else if (pStr === "history") setShowHistoryModal(true);
        else if (pStr === "regex") setShowRegexModal(true);
        else if (pStr === "context") setShowContextModal(true);
        else if (pStr === "library") setShowImageLibrary(true);
        else if (pStr === "console") setShowLogConsole(true);
        break;
      }
      case "UPDATE_PERSONA":
        if (payload && onUpdateWorld && activeWorldRef.current) {
          onUpdateWorld({ player: { ...activeWorldRef.current.player, ...payload } });
        }
        break;
      case "UPDATE_WORLDBOOK":
      case "UPDATE_LOREBOOK":
        if (payload) {
          const wbName = payload.name || payload.worldbook || "Active Worldbook";
          const wbData = payload.data || payload.entries || payload;
          const tHelper = (window as any).TavernHelper;
          if (tHelper) {
            tHelper.updateWorldbookWith(wbName, wbData);
          } else {
            console.warn("[SillyTavern Bridge] TavernHelper not initialized yet for UPDATE_WORLDBOOK");
          }
        }
        break;
      case "TOAST":
        toast(payload?.message || payload);
        break;
    }
  }, [onNavigate, setShowCharModal, setShowHistoryModal, setShowRegexModal, setShowContextModal, setShowImageLibrary, setShowLogConsole, onUpdateWorld, handleSend, history, handleMessageUpdate]);

  useEffect(() => {
    executeWidgetActionRef.current = executeWidgetAction;
  }, [executeWidgetAction]);

  // Handle messages from HTML widget iframes
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security check: validate event origin (only current origin, sandboxed "null" origin, or empty string are allowed)
      if (event.origin !== window.location.origin && event.origin !== "null" && event.origin !== "") {
        return;
      }
      const data = event.data;
      if (data && typeof data === "object") {
        const type = data.type;
        const text = data.text;
        const payload = data.payload || data.data || data.variables;
        const msgText = data.text || data.message || data.content || (typeof data.payload === 'string' ? data.payload : '');

        switch (type) {
          case "TAWA_WIDGET_ACTION": {
            const act = data.action;
            const pay = data.payload || data.data;
            if (act) {
              executeWidgetActionRef.current?.(act, pay);
            }
            break;
          }
          case "sendReply":
          case "send_input":
          case "sendInput":
            if (msgText && typeof msgText === "string" && !isLoading) {
              if (handleSendRef.current) {
                handleSendRef.current(msgText);
              } else {
                handleSend(msgText, false);
              }
            }
            break;
          case "sendOpeningData":
          case "send_opening_data":
          case "opening_data":
          case "openingData":
          case "sendOpening": {
            (async () => {
              if (payload && typeof payload === "object") {
                try {
                  await setVariables(payload);
                  console.log("[SillyTavern Bridge] Synced variables from postMessage sendOpeningData payload:", payload);
                } catch (e) {
                  console.warn("[SillyTavern Bridge] Failed to update variables for openingData:", e);
                }
              }
              if (msgText && typeof msgText === "string") {
                console.log("[SillyTavern Bridge] Handling sendOpeningData content:", msgText);
                if (!isLoading) {
                  if (handleSendRef.current) {
                    handleSendRef.current(msgText);
                  } else {
                    handleSend(msgText);
                  }
                }
              }
            })();
            break;
          }
          case "edit_last_message":
          case "editLastMessage":
            if (msgText && typeof msgText === "string" && history.length > 0) {
              const lastUserMsgIndex = [...history]
                .reverse()
                .findIndex((m) => m.role === "user");
              if (lastUserMsgIndex !== -1) {
                const realIndex = history.length - 1 - lastUserMsgIndex;
                handleMessageUpdate(realIndex, msgText);
              }
            }
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, history]);

  const handleSwipe = (msgIndex: number, direction: "prev" | "next") => {
    const msg = history[msgIndex];
    if (!msg.swipes || msg.swipes.length === 0) return;

    const currentIndex = msg.swipeIndex || 0;
    let newIndex = currentIndex;

    if (direction === "prev") {
      if (currentIndex > 0) newIndex--;
    } else {
      if (currentIndex < msg.swipes.length - 1) {
        newIndex++;
      } else {
        // Trigger Regenerate if at the end
        handleRegenerate(msgIndex);
        return;
      }
    }

    const newText = msg.swipes[newIndex];

    // Task: Parse LSR Data for immediate sync during swipe
    const tableStored = extractTagContent(newText, "table_stored");
    let nextLsrData = lsrRuntimeDataRef.current;
    if (tableStored) {
      // console.log("GameplayScreen (handleSwipe): Detected <table_stored>. Parsing...");
      const parsedData = LsrParser.parseLsrString(tableStored);
      if (Object.keys(parsedData).length > 0) {
        nextLsrData = parsedData;
        setLsrRuntimeData(nextLsrData);
      }
    } else {
      const tableEdit = extractTagContent(newText, "tableEdit");
      if (tableEdit) {
        // console.log("GameplayScreen (handleSwipe): Detected <tableEdit>. Merging edits...");
        const parsedEdits = LsrParser.parseLsrString(tableEdit);
        if (Object.keys(parsedEdits).length > 0) {
          nextLsrData = LsrParser.mergeLsrData(
            lsrRuntimeDataRef.current,
            parsedEdits,
          );
          setLsrRuntimeData(nextLsrData);
        }
      }
    }

    // Extract incrementalSummary
    const incrementalSummary = extractTagContent(newText, "incrementalSummary");

    setHistory((prev) => {
      const updated = [...prev];
      const updatedMsg = { ...updated[msgIndex] };

      updatedMsg.swipeIndex = newIndex;
      updatedMsg.text = newText;

      // Re-parse choices for this specific swipe version
      const branchesContent =
        extractTagContent(newText, "branches") ||
        extractTagContent(newText, "choices") ||
        extractTagContent(newText, "actions");
      updatedMsg.choices = parseChoices(branchesContent);
      updatedMsg.incrementalSummary = incrementalSummary;

      updated[msgIndex] = updatedMsg;

      // Sync state back to parent
      syncWorldState(
        updated,
        turnCount,
        gameTime,
        nextLsrData,
        incrementalSummary,
      );

      return updated;
    });
  };

  const handleExit = () => {
    onNavigate(GameState.MENU);
  };

  const scrollToTurn = (turnNumber: number) => {
    // Tìm index của tin nhắn đầu tiên thuộc lượt này
    const msgIndex = history.findIndex((m) => m.turnNumber === turnNumber);
    if (msgIndex === -1) return;

    // Tính toán trang chứa tin nhắn này
    const targetPage =
      msgIndex < 11 ? 1 : 1 + Math.ceil((msgIndex - 11) / MESSAGES_PER_PAGE);

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      pendingScrollTurnRef.current = turnNumber;
    } else {
      const element = document.getElementById(`turn-${turnNumber}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
    setLastNavigatedTurn(turnNumber);
    shouldAutoScrollRef.current = false;
  };

  const findCurrentTurnInView = () => {
    if (!scrollViewportRef.current) return null;
    const viewport = scrollViewportRef.current;
    const viewportRect = viewport.getBoundingClientRect();
    const midPoint = viewportRect.top + viewportRect.height / 3; // Check top third

    // Find all turn elements in the current viewport
    const turnElements = Array.from(viewport.querySelectorAll('[id^="turn-"]'));
    let closestTurn = null;
    let minDistance = Infinity;

    for (const el of turnElements) {
      const rect = el.getBoundingClientRect();
      // If the element is visible in the viewport
      if (rect.bottom > viewportRect.top && rect.top < viewportRect.bottom) {
        const distance = Math.abs(rect.top - midPoint);
        if (distance < minDistance) {
          minDistance = distance;
          const turnId = el.id.replace("turn-", "");
          closestTurn = parseInt(turnId, 10);
        }
      }
    }
    return closestTurn;
  };

  const scrollToTop = () => {
    // Lấy danh sách tất cả các số lượt hiện có, sắp xếp tăng dần
    const allTurns = Array.from(
      new Set(
        history
          .filter((m) => m.turnNumber !== undefined)
          .map((m) => m.turnNumber as number),
      ),
    ).sort((a, b) => a - b);

    if (allTurns.length === 0) {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    // Ưu tiên sử dụng lượt đang hiển thị nếu có
    const currentTurn = findCurrentTurnInView() ?? lastNavigatedTurn;

    let targetTurn: number;
    if (currentTurn === null) {
      // Nếu không xác định được, nhảy đến lượt cuối cùng
      targetTurn = allTurns[allTurns.length - 1];
    } else {
      const currentIndex = allTurns.indexOf(currentTurn);
      if (currentIndex > 0) {
        targetTurn = allTurns[currentIndex - 1];
      } else {
        // Nếu đã ở lượt đầu, quay lại lượt cuối
        targetTurn = allTurns[allTurns.length - 1];
      }
    }

    scrollToTurn(targetTurn);
  };

  const scrollToBottom = () => {
    // Lấy danh sách tất cả các số lượt hiện có, sắp xếp tăng dần
    const allTurns = Array.from(
      new Set(
        history
          .filter((m) => m.turnNumber !== undefined)
          .map((m) => m.turnNumber as number),
      ),
    ).sort((a, b) => a - b);

    if (allTurns.length === 0) {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    // Ưu tiên sử dụng lượt đang hiển thị nếu có
    const currentTurn = findCurrentTurnInView() ?? lastNavigatedTurn;

    let targetTurn: number;
    if (currentTurn === null) {
      // Nếu không xác định được, nhảy đến lượt đầu tiên
      targetTurn = allTurns[0];
    } else {
      const currentIndex = allTurns.indexOf(currentTurn);
      if (currentIndex !== -1 && currentIndex < allTurns.length - 1) {
        targetTurn = allTurns[currentIndex + 1];
      } else {
        // Nếu đã ở lượt cuối, cuộn xuống cuối hẳn
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
        setLastNavigatedTurn(null);
        shouldAutoScrollRef.current = true;
        return;
      }
    }

    scrollToTurn(targetTurn);
  };

  const handleManualSave = async () => {
    if (!activeWorld) return;
    setIsSaving(true);

    const worldName = activeWorld?.world?.worldName || "Unknown_World";
    const playerName = activeWorld?.player?.name || "Unknown_Hero";
    const turnCountValue = history.filter((m) => m.role === "user").length;

    // 1. Prepare Save Data
    const saveData: WorldData = {
      ...activeWorld,
      lsrData: lsrRuntimeData, // CRITICAL: Include latest LSR data
      savedState: {
        history: history,
        turnCount: turnCountValue,
        gameTime: gameTime,
        aiMonitor: {
          tokenHistory: tokenHistoryRef.current,
          totalTokens: totalTokensRef.current,
          lastTurnTotalTime: lastTurnTotalTimeRef.current,
        },
      },
      config: {
        ...(activeWorld.config || { rules: [], regex_scripts: [] }),
        rules: dynamicRules,
        tawaPreset: tawaPresetConfig,
        regexScripts: combinedRegexScripts,
      },
    };

    // 2. Save to Database (Internal)
    // Use deterministic ID for manual save: manual-[worldName]-[turnCount]
    const saveId = `manual-${worldName.replace(/\s+/g, "_")}-${turnCount}`;
    const saveFile: SaveFile = {
      id: saveId,
      name: `${worldName} - Turn ${turnCount} (Manual)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: saveData,
    };

    try {
      await dbService.saveGameState(saveFile);

      // 3. Download to Computer
      // Format: ARK_save_[world_name]_[player_name]_[turn_number].json
      const fileName = `ARK_save_${worldName.replace(/\s+/g, "_")}_${playerName.replace(/\s+/g, "_")}_${turnCountValue}.json`;

      const blob = new Blob([JSON.stringify(saveData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to save game:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStreamResponse = async () => {
    if (!settings) return;
    const newSetting = !settings.streamResponse;
    setSettings({ ...settings, streamResponse: newSetting });
    await dbService.saveSettings({ ...settings, streamResponse: newSetting });
  };

  const handleGoToSettings = () => {
    syncWorldState();
    onNavigate(GameState.SETTINGS);
  };

  const handleUpdateContextConfig = (newConfig: ContextWindowConfig) => {
    if (onUpdateWorld && activeWorld) {
      onUpdateWorld({
        config: {
          ...(activeWorld.config || { rules: [], regex_scripts: [] }),
          contextConfig: newConfig,
        },
      });
    }
  };

  return {
    // Engine & State
    isLoading,
    setIsLoading,
    isDead,
    setIsDead,
    history,
    setHistory,
    lastAction,
    setLastAction,
    turnCount,
    setTurnCount,
    settings,
    setSettings,
    tawaPresetConfig,
    setTawaPresetConfig,
    dynamicRules,
    setDynamicRules,
    combinedRegexScripts,
    setCombinedRegexScripts,
    gameTime,
    setGameTime,

    // Modal States
    showCharModal,
    setShowCharModal,
    showGlobalModal,
    setShowGlobalModal,
    showHistoryModal,
    setShowHistoryModal,
    showContextModal,
    setShowContextModal,
    showImageLibrary,
    setShowImageLibrary,
    showLogConsole,
    setShowLogConsole,
    showRegexModal,
    setShowRegexModal,
    showCalendarModal,
    setShowCalendarModal,
    showMobileSidebar,
    setShowMobileSidebar,
    showStoryDebugModal,
    setShowStoryDebugModal,
    selectedDebugMessageIndex,
    setSelectedDebugMessageIndex,
    selectingAvatarFor,
    setSelectingAvatarFor,

    // UI States
    showTokenDetails,
    setShowTokenDetails,
    showStatsDetails,
    setShowStatsDetails,
    isInputCollapsed,
    setIsInputCollapsed,
    activeContextTab,
    setActiveContextTab,
    selectedEntity,
    setSelectedEntity,
    currentPage,
    setCurrentPage,

    // Save System
    autosaveList,
    manualSaveList,
    initialSaveList,
    activeSaveTab,
    setActiveSaveTab,
    isSaving,
    setIsSaving,
    loadSaveLists,
    handleDeleteSave,

    // AI Monitor
    tokenHistory,
    totalTokens,
    lastTurnTotalTime,
    currentProcessingTime,

    // Core Refs & Scroll
    scrollViewportRef,
    chatEndRef,
    handleScroll,
    scrollToTop,
    scrollToBottom,

    // Derived UI
    totalPages,
    displayedMessages,
    startIndex,

    // Functions
    handleSend,
    handleRegenerate,
    processAIResponse,
    handleSwipe,
    handleMessageUpdate,
    handleToggleHideMessage,
    handleEntityClick,
    handleAvatarSelect,
    handleManualSave,
    handleLoadSave,
    handleGoToSettings,
    handleExit,
    toggleStreamResponse,
    handleUpdateContextConfig,
    handleTawaConfigChange,

    // Extra
    isMobile,
    AIMonitor,
    lsrTables,
    lsrRuntimeData,
    handleUpdateLsrData,
    activeLsrTableId,
    setActiveLsrTableId,
    lsrViewMode,
    setLsrViewMode,
    tavoSelectState,
    setTavoSelectState,
    gameInputRef,
    isTavernHelperReady,

    // Fate Roll Exports
    fateSettings,
    showFateSettingsModal,
    setShowFateSettingsModal,
    showFateRollModal,
    setShowFateRollModal,
    pendingActionText,
    handleUpdateFateSettings,
  };
};
