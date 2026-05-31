import { useCallback } from "react";
import { ChatMessage, WorldData, AppSettings, GameTime, TawaPresetConfig } from "../../../../types";
import { gameplayAiService } from "../../../../services/ai/gameplay/service";
import { extractTagContent, parseChoices } from "../../../../utils/regex";
import { LsrParser } from "../../../../services/lsr/LsrParser";
import { dbService } from "../../../../services/db/indexedDB";

interface AIHookProps {
  setIsLoading: (val: boolean) => void;
  turnCount: number;
  activeWorld: WorldData | null;
  settings: AppSettings | null;
  gameTime: GameTime;
  setGameTime: (t: GameTime) => void;
  history: ChatMessage[];
  setHistory: (h: ChatMessage[]) => void;
  lsrRuntimeData: any;
  setLsrRuntimeData: (data: any) => void;
  dynamicRules: any;
  tawaPresetConfig: TawaPresetConfig | null;
  combinedRegexScripts: any[];
  updateTokenHistory: (tokens: number, text: string) => void;
  syncWorldState: (h: ChatMessage[], tc: number, gt: GameTime) => void;
  advanceTime: (gt: GameTime, cost: number) => GameTime;
}

export function useGameplayAI({
  setIsLoading,
  turnCount,
  activeWorld,
  settings,
  gameTime,
  setGameTime,
  history,
  setHistory,
  lsrRuntimeData,
  setLsrRuntimeData,
  dynamicRules,
  tawaPresetConfig,
  combinedRegexScripts,
  updateTokenHistory,
  syncWorldState,
  advanceTime
}: AIHookProps) {

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
      if (typeof window !== "undefined" && (window as any).eventSource) {
        (window as any).eventSource.emit('generation_started', {
          userInput,
          turnCount,
        });
      }

      try {
        const effectiveWorldData: WorldData = {
          ...(world || activeWorld!),
          lsrData: lsrRuntimeData,
          gameTime: time || gameTime,
          savedState: {
            history: currentHistory,
            turnCount: turnCount,
            gameTime: time || gameTime,
          },
          config: {
            ...(world || activeWorld!).config,
            rules: dynamicRules,
            tawaPreset: tawaPresetConfig || undefined,
            regexScripts: combinedRegexScripts,
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
        } catch {}

        const cotUsedValue = tawaPresetConfig?.assistant_prefill
          ? `Prefill: ${tawaPresetConfig.assistant_prefill}`
          : "Không dùng";

        const defaultMetadata = {
          presetUsed: presetName,
          cotUsed: cotUsedValue,
          worldInfoConfig: `${activeWorld?.entities?.length || 0} Entities`,
        };

        // If NOT regenerating, create a placeholder message first
        if (targetIndex === undefined) {
          const placeholderMsg: ChatMessage = {
            role: "model",
            text: "",
            timestamp: Date.now(),
            gameTime: time || gameTime,
            swipes: [""],
            swipeIndex: 0,
            choices: [],
            turnNumber: currentHistory.length === 0 ? 0 : turnCount + 1,
            userAction: currentHistory.length === 0 ? undefined : userInput,
            metadata: defaultMetadata,
          };
          workingHistory.push(placeholderMsg);
          targetIndex = workingHistory.length - 1;

          setHistory([...workingHistory]);
        } else {
          // If regenerating, prepare the new swipe slot
          const msg = { ...(workingHistory[targetIndex] || {}) } as ChatMessage;

          if (!msg.role) msg.role = "model";
          msg.metadata = defaultMetadata;

          const newSwipes = [...(msg.swipes || [msg.text || ""]), ""];
          msg.swipes = newSwipes;
          msg.swipeIndex = newSwipes.length - 1;
          msg.text = "";

          if (msg.turnNumber === undefined) {
            msg.turnNumber = targetIndex === 0 ? 0 : turnCount;
          }
          if (msg.userAction === undefined && targetIndex > 0) {
            msg.userAction = userInput;
          }

          workingHistory[targetIndex] = msg;
          setHistory([...workingHistory]);
        }

        await new Promise((r) => setTimeout(r, 0));

        const stream = gameplayAiService.generateStoryTurnStream(
          userInput,
          regenerateIndex !== undefined
            ? currentHistory.slice(0, regenerateIndex)
            : currentHistory,
          effectiveWorldData,
          currentSettings,
          tawaPresetConfig || undefined,
          time || gameTime,
        );

        let accumulatedText = "";
        let lastTokenCount = 0;
        let lastUIUpdateTime = 0;
        const UI_UPDATE_INTERVAL = 150;
        const groundingSources: { title: string; uri: string }[] = [];

        for await (const chunk of stream) {
          if (typeof chunk === "string") {
            accumulatedText += chunk;
          } else {
            if (chunk.text) accumulatedText += chunk.text;
            if (chunk.usageMetadata?.totalTokenCount) {
              lastTokenCount = chunk.usageMetadata.totalTokenCount;
            }
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
          if (now - lastUIUpdateTime > UI_UPDATE_INTERVAL) {
            if (targetIndex !== undefined && workingHistory[targetIndex]) {
              const msg = { ...workingHistory[targetIndex] };
              const swipes = [...(msg.swipes || [""])];
              const currentSwipeIdx = msg.swipeIndex || 0;

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
              lastUIUpdateTime = now;
            }
          }
        }

        // Final UI update
        if (targetIndex !== undefined && workingHistory[targetIndex]) {
          const msg = { ...workingHistory[targetIndex] };
          const swipes = [...(msg.swipes || [""])];
          const currentSwipeIdx = msg.swipeIndex || 0;

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

        if (lastTokenCount > 0) {
          updateTokenHistory(lastTokenCount, accumulatedText);
        } else if (accumulatedText.length > 0) {
          const estimatedTokens = Math.ceil(accumulatedText.length / 4);
          updateTokenHistory(estimatedTokens, accumulatedText);
        }

        let finalTime = time || gameTime;
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
          let timeCost = parseInt(timeCostStr || "1", 10);
          if (isNaN(timeCost) || timeCost < 1) timeCost = 1;
          finalTime = advanceTime(finalTime, timeCost);
        }

        setGameTime(finalTime);

        const tableStored = extractTagContent(accumulatedText, "table_stored");
        let nextLsrData = lsrRuntimeData;
        if (tableStored) {
          const parsedData = LsrParser.parseLsrString(tableStored);
          if (Object.keys(parsedData).length > 0) {
            nextLsrData = parsedData;
            setLsrRuntimeData(nextLsrData);
          }
        }

        const nextTurn = targetIndex === 0 ? 0 : turnCount + 1;
        const finalHistory = [...workingHistory];
        
        syncWorldState(finalHistory, nextTurn, finalTime);
        setIsLoading(false);
      } catch (e) {
        console.error("runStreamGeneration failed:", e);
        setIsLoading(false);
      }
    },
    [
      setIsLoading, turnCount, activeWorld, lsrRuntimeData, gameTime,
      dynamicRules, tawaPresetConfig, combinedRegexScripts, setHistory,
      updateTokenHistory, advanceTime, setGameTime, setLsrRuntimeData, syncWorldState
    ]
  );

  return {
    runStreamGeneration,
  };
}
