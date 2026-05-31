import { useEffect, useRef } from "react";
import { ChatMessage, WorldData, AppSettings, GameTime } from "../../../../types";
import { processScheduleAutoprogression } from "../../../../services/schedule/ScheduleAutoEngine";
import { toast } from "sonner";

interface TimerHookProps {
  activeWorld: WorldData | null;
  gameTime: GameTime;
  settings: AppSettings | null;
  history: ChatMessage[];
  setHistory: (history: ChatMessage[]) => void;
  turnCount: number;
  syncWorldState: (h: ChatMessage[], tc: number, gt: GameTime) => void;
  isLoading: boolean;
  startProcessing: () => void;
  endProcessing: () => void;
  setCurrentProcessingTime: (setter: (prev: number) => number) => void;
}

export function useGameplayTimer({
  activeWorld,
  gameTime,
  settings,
  history,
  setHistory,
  turnCount,
  syncWorldState,
  isLoading,
  startProcessing,
  endProcessing,
  setCurrentProcessingTime
}: TimerHookProps) {

  const prevGameTimeRef = useRef<GameTime | null>(null);
  const stopwatchRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Process CPU stopwatch during thinking states
  useEffect(() => {
    if (isLoading) {
      startProcessing();
      stopwatchRef.current = setInterval(() => {
        setCurrentProcessingTime((prev) => prev + 100);
      }, 100);
    } else {
      if (stopwatchRef.current) {
        clearInterval(stopwatchRef.current);
        stopwatchRef.current = null;
      }
      endProcessing();
    }
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    };
  }, [isLoading, startProcessing, endProcessing, setCurrentProcessingTime]);

  // 2. Automated Schedule Progression & Butterfly Effects
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
              const updated = [...history];
              result.newRipples.forEach(rip => {
                updated.push({
                  role: "system",
                  text: `[🦋 HIỆU ỨNG CÁNH BƯỚM]: Hành động trễ nải hoặc dịch chuyển thời gian đã làm dở dang sự kiện "${rip.eventTitle}" tại ${rip.eventLocation}.\n\nTuyến tính bị lệch hướng: "${rip.title}"\nHệ quả cốt truyện: ${rip.consequence}\nTác động thế giới quan: ${rip.rippleEffect}\n\n(AI hãy tích hợp sâu sắc hệ quả gián tiếp kịch tính này vào lời thoại, miêu tả thế giới, và phản ứng kế tiếp của các nhân vật)`,
                  timestamp: Date.now(),
                  gameTime,
                  turnNumber: turnCount
                });
              });
              setHistory(updated);
              syncWorldState(updated, turnCount, gameTime);
            }
          } catch (e) {
            console.error("Lỗi tự động hóa tiến triển lịch trình:", e);
          }
        };
        runProgression();
      }
    }
    prevGameTimeRef.current = gameTime;
  }, [gameTime, activeWorld, settings, history, setHistory, turnCount, syncWorldState]);
}
