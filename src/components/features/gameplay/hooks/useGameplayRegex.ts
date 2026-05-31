import { useCallback } from "react";
import { WorldData, RegexScript } from "../../../../types";
import { getRegexedString } from "../../../../utils/regex";

interface RegexHookProps {
  activeWorld: WorldData | null;
  combinedRegexScripts: RegexScript[];
}

export function useGameplayRegex({
  activeWorld,
  combinedRegexScripts
}: RegexHookProps) {

  const applyRegexInput = useCallback((text: string): string => {
    if (!activeWorld || !combinedRegexScripts || combinedRegexScripts.length === 0) {
      return text;
    }

    const currentPlayerName = activeWorld.player?.name || "User";
    const currentCharName = activeWorld.entities?.[0]?.name || "Character";
    const isDebug = typeof window !== "undefined" && (window as any).__TAWA_REGEX_DEBUG__ === true;

    let finalUserText = text;

    if (finalUserText.startsWith("/")) {
      // Applied placement 3 (Slash Command) if starting in "/"
      finalUserText = getRegexedString(finalUserText, 3, combinedRegexScripts, {
        userName: currentPlayerName,
        charName: currentCharName,
        depth: 0,
        isDebug,
        isPrompt: false,
        isMarkdown: false,
      });
    }

    // Applied placement 1 (Standard User Prompt Filters)
    finalUserText = getRegexedString(finalUserText, 1, combinedRegexScripts, {
      userName: currentPlayerName,
      charName: currentCharName,
      depth: 0,
      isDebug,
      isPrompt: false,
      isMarkdown: false,
    });

    return finalUserText;
  }, [activeWorld, combinedRegexScripts]);

  const applyRegexResponse = useCallback((text: string): string => {
    if (!activeWorld || !combinedRegexScripts || combinedRegexScripts.length === 0) {
      return text;
    }

    const currentPlayerName = activeWorld.player?.name || "User";
    const currentCharName = activeWorld.entities?.[0]?.name || "Character";
    const isDebug = typeof window !== "undefined" && (window as any).__TAWA_REGEX_DEBUG__ === true;

    // Applied placement 2 (Standard AI Response Filters)
    return getRegexedString(text, 2, combinedRegexScripts, {
      userName: currentPlayerName,
      charName: currentCharName,
      depth: 0,
      isDebug,
      isPrompt: false,
      isMarkdown: false,
    });
  }, [activeWorld, combinedRegexScripts]);

  return {
    applyRegexInput,
    applyRegexResponse
  };
}
