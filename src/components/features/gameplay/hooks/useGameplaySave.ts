import { useCallback } from "react";
import { ChatMessage, WorldData, GameTime, SaveFile } from "../../../../types";
import { dbService } from "../../../../services/db/indexedDB";

interface SaveHookProps {
  activeWorld: WorldData | null;
  history: ChatMessage[];
  lsrRuntimeData: any;
  gameTime: GameTime;
  dynamicRules: any[];
  tawaPresetConfig: any;
  combinedRegexScripts: any[];
  turnCount: number;
  setIsSaving: (val: boolean) => void;
  tokenHistory: any[];
  totalTokens: number;
  lastTurnTotalTime: number;
}

export function useGameplaySave({
  activeWorld,
  history,
  lsrRuntimeData,
  gameTime,
  dynamicRules,
  tawaPresetConfig,
  combinedRegexScripts,
  turnCount,
  setIsSaving,
  tokenHistory,
  totalTokens,
  lastTurnTotalTime
}: SaveHookProps) {

  const handleManualSave = useCallback(async () => {
    if (!activeWorld) return;
    setIsSaving(true);

    const worldName = activeWorld.world?.worldName || "Unknown_World";
    const playerName = activeWorld.player?.name || "Unknown_Hero";
    const turnCountValue = history.filter((m) => m.role === "user").length;

    const saveData: WorldData = {
      ...activeWorld,
      lsrData: lsrRuntimeData,
      savedState: {
        history: history,
        turnCount: turnCountValue,
        gameTime: gameTime,
        aiMonitor: {
          tokenHistory: tokenHistory,
          totalTokens: totalTokens,
          lastTurnTotalTime: lastTurnTotalTime,
        },
      },
      config: {
        ...(activeWorld.config || { rules: [], regex_scripts: [] }),
        rules: dynamicRules,
        tawaPreset: tawaPresetConfig || undefined,
        regexScripts: combinedRegexScripts,
      },
    };

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
      console.error("Failed to save game manually:", error);
    } finally {
      setIsSaving(false);
    }
  }, [
    activeWorld, history, lsrRuntimeData, gameTime, dynamicRules,
    tawaPresetConfig, combinedRegexScripts, turnCount, setIsSaving,
    tokenHistory, totalTokens, lastTurnTotalTime
  ]);

  const triggerAutosave = useCallback(async (customHistory?: ChatMessage[]) => {
    if (!activeWorld) return;
    
    const worldName = activeWorld.world?.worldName || "Unknown_World";
    const turnCountValue = (customHistory || history).filter((m) => m.role === "user").length;

    const saveData: WorldData = {
      ...activeWorld,
      lsrData: lsrRuntimeData,
      savedState: {
        history: customHistory || history,
        turnCount: turnCountValue,
        gameTime: gameTime,
      },
      config: {
        ...(activeWorld.config || { rules: [], regex_scripts: [] }),
        rules: dynamicRules,
        tawaPreset: tawaPresetConfig || undefined,
        regexScripts: combinedRegexScripts,
      },
    };

    const slotId = `autosave-${worldName.replace(/\s+/g, "_")}-${turnCount}`;
    const autosaveFile: SaveFile = {
      id: slotId,
      name: `${worldName} - Turn ${turnCount} (Autosave)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: saveData,
    };

    try {
      await dbService.saveGameState(autosaveFile);
    } catch (e) {
      console.error("Failed to write autosave:", e);
    }
  }, [
    activeWorld, history, lsrRuntimeData, gameTime, dynamicRules,
    tawaPresetConfig, combinedRegexScripts, turnCount
  ]);

  return {
    handleManualSave,
    triggerAutosave
  };
}
