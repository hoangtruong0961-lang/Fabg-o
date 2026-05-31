import { useCallback } from "react";
import { ChatMessage, WorldData, AppSettings, RegexScript, TawaPresetConfig } from "../../../../types";
import { extractTagContent, parseChoices } from "../../../../utils/regex";
import { LsrParser } from "../../../../services/lsr/LsrParser";
import { gameplayAiService } from "../../../../services/ai/gameplay/service";

interface HistoryHookProps {
  history: ChatMessage[];
  setHistory: (history: ChatMessage[]) => void;
  turnCount: number;
  setTurnCount: (tc: number) => void;
  gameTime: any;
  activeWorld: WorldData | null;
  settings: AppSettings | null;
  combinedRegexScripts: RegexScript[];
  syncWorldState: (h: ChatMessage[], tc: number, gt: any) => void;
  checkDeathStatus: (h: ChatMessage[], d: any) => boolean;
  triggerPermadeath: () => void;
  setIsLoading: (loading: boolean) => void;
  isLoading: boolean;
  tawaPresetConfig: TawaPresetConfig | null;
  updateTokenHistory: (tokens: number, text: string) => void;
  processAIResponse: (text: string, isStream: boolean, gt: any, onDone?: () => void, grounding?: any[]) => void;
  runStreamGeneration: (text: string, hist: ChatMessage[], settings: AppSettings, onDone?: () => void, world?: any, gt?: any) => Promise<void>;
  applyRegex: (text: string, placement: number, depth: number) => string;
}

export function useGameplayHistory({
  history,
  setHistory,
  turnCount,
  setTurnCount,
  gameTime,
  activeWorld,
  settings,
  combinedRegexScripts,
  syncWorldState,
  checkDeathStatus,
  triggerPermadeath,
  setIsLoading,
  isLoading,
  tawaPresetConfig,
  updateTokenHistory,
  processAIResponse,
  runStreamGeneration,
  applyRegex
}: HistoryHookProps) {

  const handleToggleHideMessage = useCallback((index: number) => {
    setHistory(
      history.map((msg, i) => {
        if (i === index) {
          return { ...msg, isHidden: !msg.isHidden };
        }
        return msg;
      })
    );
  }, [history, setHistory]);

  const handleMessageUpdate = useCallback((index: number, newText: string) => {
    const updated = history.map((msg, i) => {
      if (i === index) {
        return {
          ...msg,
          text: newText,
          swipes: msg.swipes ? msg.swipes.map((s, swIdx) => swIdx === (msg.swipeIndex || 0) ? newText : s) : [newText]
        };
      }
      return msg;
    });
    setHistory(updated);
    if (activeWorld) {
      syncWorldState(updated, turnCount, gameTime);
    }
  }, [history, setHistory, activeWorld, turnCount, gameTime, syncWorldState]);

  const handleSwipe = useCallback((msgIndex: number, direction: "prev" | "next") => {
    const msg = history[msgIndex];
    if (!msg || !msg.swipes || msg.swipes.length <= 1) return;
    
    let nextIndex = (msg.swipeIndex || 0) + (direction === "next" ? 1 : -1);
    if (nextIndex < 0) nextIndex = msg.swipes.length - 1;
    if (nextIndex >= msg.swipes.length) nextIndex = 0;

    const updated = history.map((m, i) => {
      if (i === msgIndex) {
        return { ...m, swipeIndex: nextIndex, text: m.swipes?.[nextIndex] || m.text };
      }
      return m;
    });

    setHistory(updated);
    if (activeWorld) {
      syncWorldState(updated, turnCount, gameTime);
    }
  }, [history, setHistory, activeWorld, turnCount, gameTime, syncWorldState]);

  const handleRegenerate = useCallback(async (msgIndex: number) => {
    if (isLoading || !activeWorld || !settings) return;
    
    setIsLoading(true);
    try {
      const truncatedHistory = history.slice(0, msgIndex);
      const lastUserMsg = truncatedHistory[truncatedHistory.length - 1];
      if (!lastUserMsg) {
        setIsLoading(false);
        return;
      }

      const effectiveWorldData: WorldData = {
        ...activeWorld,
        savedState: {
          history: truncatedHistory,
          turnCount: turnCount,
          gameTime: gameTime,
        }
      };

      if (settings.streamResponse) {
        await runStreamGeneration(
          lastUserMsg.text,
          truncatedHistory,
          settings,
          () => {
            setIsLoading(false);
          },
          effectiveWorldData,
          gameTime
        );
      } else {
        const result = await gameplayAiService.generateStoryTurn(
          lastUserMsg.text,
          truncatedHistory,
          effectiveWorldData,
          settings,
          tawaPresetConfig || undefined,
          gameTime,
        );

        const estimatedTokens = result.usage?.totalTokenCount 
          ? (result.usage.totalTokenCount as number) 
          : Math.ceil(result.text.length / 4);

        updateTokenHistory(estimatedTokens, result.text);
        processAIResponse(result.text, false, gameTime, undefined, result.groundingSources);
      }
    } catch (e) {
      console.error("Regenerate failed:", e);
      setIsLoading(false);
    }
  }, [
    isLoading, activeWorld, settings, history, turnCount, gameTime,
    runStreamGeneration, tawaPresetConfig, updateTokenHistory, processAIResponse, setIsLoading
  ]);

  return {
    handleToggleHideMessage,
    handleMessageUpdate,
    handleSwipe,
    handleRegenerate
  };
}
