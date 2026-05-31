import { useCallback, useRef, useEffect } from "react";
import { ChatMessage, WorldData, AppSettings } from "../../../../types";
import { vectorService } from "../../../../services/ai/vectorService";

interface MemoryHookProps {
  activeWorld: WorldData | null;
  settings: AppSettings | null;
  history: ChatMessage[];
  turnCount: number;
  isReady: boolean;
  lsrRuntimeData: any;
  setLsrRuntimeData: (data: any) => void;
  onUpdateWorld: ((data: Partial<WorldData>) => void) | undefined;
}

export function useGameplayMemory({
  activeWorld,
  settings,
  history,
  turnCount,
  isReady,
  lsrRuntimeData,
  setLsrRuntimeData,
  onUpdateWorld
}: MemoryHookProps) {

  const lastVectorizedTurnRef = useRef<number>(-1);

  const handleUpdateLsrData = useCallback((newData: Record<string, any[]>) => {
    setLsrRuntimeData(newData);
    if (activeWorld && onUpdateWorld) {
      onUpdateWorld({
        lsrData: newData,
      });
    }
  }, [activeWorld, onUpdateWorld, setLsrRuntimeData]);

  // Scheduled Vectorization (Every 50 turns)
  useEffect(() => {
    if (!activeWorld || !settings?.enableVectorMemory || !isReady)
      return;

    const currentTurn = turnCount;
    const shouldVectorize =
      currentTurn > 0 &&
      currentTurn % 50 === 0 &&
      currentTurn !== lastVectorizedTurnRef.current;

    if (shouldVectorize) {
      lastVectorizedTurnRef.current = currentTurn;
      setTimeout(() => {
        vectorService.vectorizeAllHistory(history, settings);
      }, 2000);
    }
  }, [turnCount, activeWorld, settings, isReady, history]);

  return {
    handleUpdateLsrData,
  };
}
