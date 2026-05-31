import { GameTime } from "../../utils/timeUtils";
import { getAiClient } from "../ai/client";
import { dbService } from "../db/indexedDB";

export interface ButterflyEffect {
  id: string;
  worldId: string;
  perspective: "user" | "char";
  timestamp: number;
  gameTime: GameTime;
  eventTitle: string;
  eventTime: string;
  eventLocation: string;
  chaosAdded: number;
  title: string;
  consequence: string;
  rippleEffect: string;
}

export interface EventItem {
  type: "main" | "hidden" | "bond";
  title: string;
  description: string;
  time: string;
  location: string;
  npcDynamic: string;
  status?: "todo" | "done" | "missed";
}

export interface parsedDays {
  dayNum: string;
  events: EventItem[];
  weather?: string;
  omen?: string;
}

export interface ScheduleData {
  days: parsedDays[];
  future: EventItem[];
  startDate: string | null;
  thought: string | null;
  raw: string;
}

// 20 rich pre-fabricated templates of consequences for instant fallback when offline or during quick ticks
const fallbackButterflyConsequences = [
  {
    title: "🔒 Tin tức phong tỏa",
    consequence: "Do bỏ lỡ mốc điều nghiên đã định, hành tung mật vụ liên quan đột ngột thắt chặt. Cơ quan chức năng địa phương lập tức ban hành lệnh cấm tuần tra dân sự.",
    rippleEffect: "Độ nghi kỵ tại phủ thành tăng cao thêm 15%, cản trở nghiêm trọng các hoạt động tra vấn về sau.",
    chaos: 8
  },
  {
    title: "🍂 Nhân duyên rạn nứt",
    consequence: "Đối phương chờ đợi mòn mỏi dưới sương đêm lạnh giá nhưng không thấy ai xuất hiện. Sự thất vọng chất chứa đẩy khoảng cách tình cảm rào rạt rẽ lối.",
    rippleEffect: "Mức độ thân thiết sụt giảm trầm trọng, xuất hiện tâm lý đề phòng sâu sắc.",
    chaos: 12
  },
  {
    title: "🕯️ Chiếc bóng trong đêm",
    consequence: "Gợi ý bí ẩn tại di chỉ hoang phế đã bị kẻ thứ ba phát hiện và thủ tiêu toàn bộ vết tích trước khi bạn đến. Manh mối ám tiên tri nát vụn dưới chân bốt canh.",
    rippleEffect: "Mất đi vĩnh viễn quyền tra cứu mật quyển, phe phản địch nắm giữ thế chủ động săn đuổi mật báo.",
    chaos: 10
  },
  {
    title: "🪙 Giao dịch đổ bể",
    consequence: "Thương nhân hắc thị bị lộ hành tung do không nhận được tiếp viện kịp lúc. Ông ta đã vội vã phiêu dạt mang theo chiếc rương đựng mảnh vỡ thiên thạch báu vật.",
    rippleEffect: "Bạn không thể mua các vật phẩm kỳ bí độc quyền trong vòng 3 ngày kế tiếp.",
    chaos: 15
  },
  {
    title: "⚡ Dập tắt hy vọng",
    consequence: "Lời cầu viện của binh đoàn đồn trú biên cương bị trì hoãn vô định. Pháo đài bốc cháy ngùn ngụt giữa tiếng cười man rợ của dã thú dị vực.",
    rippleEffect: "Bản đồ khu vực phía Tây trở nên nguy hiểm tột độ với tần suất quái thú tuần kích gia tăng vượt bậc.",
    chaos: 18
  }
];

// Helper to check if t1 is after or equal to t2
export const isTimeAfterOrEqual = (t1: GameTime, t2: GameTime): boolean => {
  if (t1.year !== t2.year) return t1.year > t2.year;
  if (t1.month !== t2.month) return t1.month > t2.month;
  if (t1.day !== t2.day) return t1.day > t2.day;
  if (t1.hour !== t2.hour) return t1.hour > t2.hour;
  return t1.minute >= t2.minute;
};

// Formulate event time
export const getEventGameTime = (startDateStr: string | null, dayNumStr: string, eventTimeStr: string, fallbackTime: GameTime): GameTime => {
  const dayNum = parseInt(dayNumStr, 10) || 1;
  const match = eventTimeStr.match(/(\d{1,2}):(\d{2})/);
  let hour = 9;
  let minute = 0;
  
  if (match) {
    hour = parseInt(match[1], 10);
    minute = parseInt(match[2], 10);
  } else {
    const clean = eventTimeStr.toLowerCase();
    if (clean.includes("sáng")) { hour = 8; minute = 0; }
    else if (clean.includes("trưa")) { hour = 12; minute = 0; }
    else if (clean.includes("chiều")) { hour = 15; minute = 0; }
    else if (clean.includes("tối")) { hour = 19; minute = 0; }
    else if (clean.includes("đêm") || clean.includes("muộn")) { hour = 22; minute = 0; }
  }

  if (startDateStr) {
    try {
      const parts = startDateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        
        const baseDate = new Date(year, month - 1, day);
        if (!isNaN(baseDate.getTime())) {
          baseDate.setDate(baseDate.getDate() + (dayNum - 1));
          return {
            year: baseDate.getFullYear(),
            month: baseDate.getMonth() + 1,
            day: baseDate.getDate(),
            hour,
            minute
          };
        }
      }
    } catch (e) {
      console.error("Lỗi biên dịch StartDate sự kiện:", e);
    }
  }

  return {
    year: fallbackTime.year,
    month: fallbackTime.month,
    day: fallbackTime.day + (dayNum - 1),
    hour,
    minute
  };
};

export const getCacheKey = (worldId: string, perspective: "user" | "char"): string => {
  return `ark-schedule-v5-${worldId}-${perspective}`;
};

export const getButterflyEffectsKey = (worldId: string): string => {
  return `ark-butterfly-effects-${worldId}`;
};

export const getButterflyEffects = (worldId: string): ButterflyEffect[] => {
  const cached = dbService.getKeyValueSync(getButterflyEffectsKey(worldId));
  if (!cached) return [];
  if (typeof cached === "string") {
    try {
      return JSON.parse(cached);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(cached) ? cached : [];
};

export const saveButterflyEffects = (worldId: string, effects: ButterflyEffect[]): void => {
  dbService.setKeyValue(getButterflyEffectsKey(worldId), effects);
};

export const calculateChaosIndex = (worldId: string): number => {
  const effects = getButterflyEffects(worldId);
  const baseChaos = effects.reduce((sum, f) => sum + f.chaosAdded, 0);
  return Math.min(100, Math.max(0, baseChaos));
};

export const clearButterflyEffects = (worldId: string): void => {
  dbService.removeKeyValue(getButterflyEffectsKey(worldId));
};

// Procedural consequence generation with AI-driven core logic
export const generateButterflyEffect = async (
  worldId: string,
  perspective: "user" | "char",
  gameTime: GameTime,
  event: EventItem,
  worldContext: any,
  settings: any
): Promise<ButterflyEffect> => {
  const effects = getButterflyEffects(worldId);
  const totalChaos = calculateChaosIndex(worldId);
  
  // Use unique ID
  const newId = `eff-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const chaosAdded = event.type === "main" ? 15 : event.type === "bond" ? 12 : 10;

  try {
    const aiClient = getAiClient(settings || undefined);
    const activeModel = settings?.aiModel || "gemini-2.1-pro-preview";
    
    const worldName = worldContext?.world?.name || "Thế giới nhập vai";
    const worldDesc = worldContext?.world?.description || "Bối cảnh dã sử kì bí";
    const playerName = worldContext?.player?.name || "Người chơi";
    const companionName = worldContext?.entities?.[0]?.name || "Đồng minh";

    const prompt = `Bạn là một nhà thiết kế trò chơi dã sử nhập vai cốt truyện kịch tính nhiều rẽ nhánh. Người chơi (hoặc NPC đồng hành) vừa bỏ lỡ một mốc lịch trình cực kỳ quan trọng dẫn đến việc kích hoạt HIỆU ỨNG CÁNH BƯỚM (Butterfly Effect - Hệ quả mang tính dây chuyền của thuyết hỗn loạn).

Thông tin bối cảnh thế giới:
- Thế giới: ${worldName}
- Mô tả: ${worldDesc}

Sự kiện bị BỎ LỠ (Nhân vật đã không hoàn thành / không xuất hiện đúng giờ):
- Tiêu đề sự kiện: ${event.title}
- Loại sự kiện: ${event.type === "main" ? "Chính Tuyến" : event.type === "bond" ? "Liên Kết Nhân Duyên" : "Ám Tuyến Tiên Tri"}
- Địa điểm: ${event.location}
- Thời gian: ${event.time}
- Mô tả sự kiện gốc: ${event.description}
- Phản ứng NPC liên đới gốc: ${event.npcDynamic}

Hãy mô tả hệ quả xích móc xô đẩy (Butterfly Effect) diễn ra thầm lặng trong bóng tối khiến dòng thời gian bị lệch hướng (Timeline Divergence).
Văn phong trinh thám, dã sử kì vĩ, truyền cảm sâu lắng tiếng Việt.

Yêu cầu định dạng JSON chính xác sau:
{
  "title": "<Tiêu đề ngắn gọn giật gân, ví dụ: 'Chiếc Bóng Trượt Dốc', 'Lời Hứa Sương Đêm Đổ Vỡ'>",
  "consequence": "<Miêu tả chi tiết hệ quả cốt truyện sâu sắc từ 40 đến 70 từ tiếng Việt, chỉ ra phản ứng dây chuyền thầm lặng vì nhân vật không có mặt>",
  "rippleEffect": "<1 câu trạng thái ảnh hưởng thực tế, ví dụ: 'Mức sát khí phủ thành tăng 15%', 'NPC rạn nứt lòng tin sâu đậm'>"
}

Không viết gì thêm ngoài khối JSON trên.`;

    const response = await aiClient.models.generateContent({
      model: activeModel,
      contents: prompt,
      config: {
        temperature: 0.85,
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    if (parsed.title && parsed.consequence) {
      return {
        id: newId,
        worldId,
        perspective,
        timestamp: Date.now(),
        gameTime,
        eventTitle: event.title,
        eventTime: event.time,
        eventLocation: event.location,
        chaosAdded,
        title: parsed.title,
        consequence: parsed.consequence,
        rippleEffect: parsed.rippleEffect || "Hệ quả chưa rõ ràng ghim sâu."
      };
    }
  } catch (e) {
    console.error("AI butterfly generation failed, falling back to local formulas:", e);
  }

  // Fallback procedural selection
  const randNum = Math.floor(Math.random() * fallbackButterflyConsequences.length);
  const picked = fallbackButterflyConsequences[randNum];

  let specTitle = picked.title;
  let specConseq = picked.consequence;
  let specRipple = picked.rippleEffect;

  if (event.type === "bond") {
    specTitle = "🥀 Nhân duyên dang dở";
    specConseq = `Bỏ lỡ hẹn gặp với nhân vật tại ${event.location} khiến mọi hoài bão lãng mạn lơ lửng sụp đổ. Đối phương cảm nhận sâu sắc sự lạnh nhạt bí ẩn.`;
    specRipple = `Sợi chỉ liên kết duyên kiếp mỏng manh rạn nứt sâu sắc, khó có cơ hội hàn gắn trong ngày kế tiếp.`;
  } else if (event.type === "hidden") {
    specTitle = "👁️ Ám tuyến vuột mất";
    specConseq = `Mối nghi ngờ tại ${event.location} không được soi tỏ kịp thời. Kẻ ám sát ẩn nấp trong sương mù đã trốn thoát thành công, mang đi mật quyển quan trọng.`;
    specRipple = `Thế lực thù địch tăng cường phòng vệ, các manh mối mật thám tương lai khó giải mã hơn.`;
  }

  return {
    id: newId,
    worldId,
    perspective,
    timestamp: Date.now(),
    gameTime,
    eventTitle: event.title,
    eventTime: event.time,
    eventLocation: event.location,
    chaosAdded,
    title: specTitle,
    consequence: specConseq,
    rippleEffect: specRipple
  };
};

/**
 * Sweeps all schedules across 'user' and 'char' perspectives.
 * Transitions overdue todo events to missed and spins up the Butterfly ripple effect!
 */
export const processScheduleAutoprogression = async (
  worldId: string,
  currentGameTime: GameTime,
  worldContext: any,
  settings: any,
  onTriggerEffect?: (effect: ButterflyEffect) => void
): Promise<{ processed: boolean; missedEvents: any[]; newRipples: ButterflyEffect[] }> => {
  const perspectives: Array<"user" | "char"> = ["user", "char"];
  const missedEvents: any[] = [];
  const newRipples: ButterflyEffect[] = [];
  let scheduleUpdated = false;

  for (const perspective of perspectives) {
    const key = getCacheKey(worldId, perspective);
    const cached = dbService.getKeyValueSync(key);
    if (!cached) continue;

    try {
      const schedule: ScheduleData = typeof cached === "string" ? JSON.parse(cached) : cached;
      if (!schedule.days || schedule.days.length === 0) continue;

      let fileModified = false;
      const progressDays = schedule.days.map((day) => {
        const progressEvents = day.events.map((event) => {
          // Check if event is todo and we are past its time
          if (!event.status || event.status === "todo") {
            const eventTimeCoord = getEventGameTime(schedule.startDate, day.dayNum, event.time, currentGameTime);
            const isOverdue = isTimeAfterOrEqual(currentGameTime, eventTimeCoord);

            if (isOverdue) {
              // Mark as missed!
              event.status = "missed";
              fileModified = true;
              missedEvents.push({
                perspective,
                event,
                dayNum: day.dayNum
              });
            }
          }
          return event;
        });

        return {
          ...day,
          events: progressEvents
        };
      });

      if (fileModified) {
        // Re-serialize raw text
        const lines: string[] = [];
        if (schedule.thought) {
          lines.push(`<!-- Phân tích và dự phóng cốt truyện: ${schedule.thought} -->`);
        }
        lines.push("<calendar_widget>");
        if (schedule.startDate) {
          lines.push(`StartDate: ${schedule.startDate}`);
        }
        progressDays.forEach((day) => {
          let dayLine = `Day: ${day.dayNum}`;
          if (day.weather) dayLine += ` | Weather: ${day.weather}`;
          if (day.omen) dayLine += ` | Omen: ${day.omen}`;
          lines.push(dayLine);
          
          day.events.forEach((ev) => {
            lines.push(`Event: ${ev.type}|${ev.title}|${ev.description}|${ev.time}|${ev.location}|${ev.npcDynamic || "Không"}|${ev.status}`);
          });
        });

        if (schedule.future && schedule.future.length > 0) {
          lines.push("Future:");
          schedule.future.forEach((ev) => {
            lines.push(`Event: ${ev.type}|${ev.title}|${ev.description}|${ev.time}|${ev.location}|${ev.npcDynamic || "Không"}|${ev.status || "todo"}`);
          });
        }
        lines.push("</calendar_widget>");

        // Save back
        const updatedSchedule: ScheduleData = {
          ...schedule,
          days: progressDays,
          raw: lines.join("\n")
        };
        
        dbService.setKeyValue(key, updatedSchedule);
        scheduleUpdated = true;
      }
    } catch (e) {
      console.error(`Progression scan failed for ${perspective}:`, e);
    }
  }

  // Handle missed consequences
  if (missedEvents.length > 0) {
    const activeRipples = getButterflyEffects(worldId);
    
    for (const item of missedEvents) {
      // Generate a brand new Butterfly Effect consequence!
      const effect = await generateButterflyEffect(
        worldId,
        item.perspective,
        currentGameTime,
        item.event,
        worldContext,
        settings
      );
      
      activeRipples.push(effect);
      newRipples.push(effect);

      if (onTriggerEffect) {
        onTriggerEffect(effect);
      }
    }

    saveButterflyEffects(worldId, activeRipples);
  }

  return {
    processed: scheduleUpdated,
    missedEvents,
    newRipples
  };
};
