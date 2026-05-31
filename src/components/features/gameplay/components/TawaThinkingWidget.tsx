import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Heart, ChevronDown } from 'lucide-react';
import { MarkdownRenderer } from '../../../common/MarkdownRenderer';

interface TawaThinkingWidgetProps {
  thinkingContent: string;
  charName?: string;
  isOpen: boolean;
  onToggle: () => void;
  contentBeautify?: boolean;
}

export const TawaThinkingWidget: React.FC<TawaThinkingWidgetProps> = ({
  thinkingContent,
  charName = 'Tawa',
  isOpen,
  onToggle,
  contentBeautify = true,
}) => {
  // Generate a random set of bubbles once when component mounts
  const bubbles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const size = Math.random() * 50 + 15; // 15px to 65px
      const duration = Math.random() * 8 + 8; // 8s to 16s
      const delay = Math.random() * 4; // 0s to 4s
      const left = Math.random() * 100; // 0% to 100%
      const swayX = (Math.random() - 0.5) * 80; // -40px to 40px
      const swayXEnd = (Math.random() - 0.5) * 80; // -40px to 40px
      const opacity = Math.random() * 0.4 + 0.2; // 0.2 to 0.6
      
      const colors = [
        'rgba(244, 114, 182, 0.4)', // Pink 400
        'rgba(249, 168, 212, 0.3)', // Pink 300
        'rgba(251, 207, 232, 0.5)', // Pink 200
        'rgba(192, 132, 252, 0.3)', // Purple 400
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];

      return {
        id: i,
        size,
        duration,
        delay,
        left,
        swayX,
        swayXEnd,
        opacity,
        color,
      };
    });
  }, []);

  if (!thinkingContent) return null;

  const displayName = charName || 'Nhân vật';

  return (
    <div className="w-full my-4 select-none font-sans">
      {/* Styles for bubble floating animations */}
      <style>{`
        @keyframes tawaBubbleRise {
          0% {
            transform: translate3d(0, 10px, 0) scale(0.8);
            opacity: 0;
          }
          15% {
            opacity: var(--bubble-opacity, 0.5);
          }
          90% {
            opacity: var(--bubble-opacity, 0.5);
          }
          100% {
            transform: translate3d(var(--sway-x-end, 20px), -180px, 0) scale(0.6);
            opacity: 0;
          }
        }
        .tawa-pulse-heart {
          animation: tawaHeartPulse 1.6s ease-in-out infinite;
        }
        @keyframes tawaHeartPulse {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.3); }
          28% { transform: scale(1); }
          42% { transform: scale(1.2); }
          70% { transform: scale(1); }
        }
      `}</style>

      {/* Main Collapsible Card Container */}
      <div 
        className={`w-full border rounded-2xl overflow-hidden transition-all duration-300 relative ${
          contentBeautify
            ? 'bg-[#FFF9FA] dark:bg-[#1E1218] border-[#FBCFE8] dark:border-[#4A2435] shadow-[0_8px_25px_-8px_rgba(244,114,182,0.25)] hover:shadow-[0_12px_30px_-5px_rgba(244,114,182,0.35)]'
            : 'bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 shadow-sm'
        }`}
      >
        {/* Animated Particles/Bubbles Background */}
        {contentBeautify && isOpen && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-100 transition-opacity duration-500">
            {bubbles.map((b) => (
              <div
                key={b.id}
                className="absolute rounded-full"
                style={{
                  width: `${b.size}px`,
                  height: `${b.size}px`,
                  left: `${b.left}%`,
                  bottom: `-10px`,
                  background: `radial-gradient(circle at 35% 35%, ${b.color}, transparent 75%)`,
                  filter: 'blur(1.5px)',
                  animation: `tawaBubbleRise ${b.duration}s linear infinite`,
                  animationDelay: `${b.delay}s`,
                  // @ts-ignore
                  '--sway-x-end': `${b.swayXEnd}px`,
                  '--bubble-opacity': b.opacity,
                }}
              />
            ))}
          </div>
        )}

        {/* Collapsible Trigger Summary Header */}
        <button
          onClick={onToggle}
          className={`w-full flex justify-between items-center px-5 py-4 cursor-pointer relative z-10 transition-colors duration-200 text-left outline-none select-none ${
            contentBeautify
              ? 'bg-[#FEEFF4]/80 dark:bg-[#2F1522]/80 hover:bg-[#FDE7F0] dark:hover:bg-[#3D1E2D]'
              : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200/50 dark:hover:bg-stone-800/80'
          }`}
        >
          <span className="flex items-center gap-2.5">
            {contentBeautify ? (
              <span className="tawa-pulse-heart inline-block text-base leading-none">💕</span>
            ) : (
              <Brain className="w-4 h-4 text-stone-500" />
            )}
            <span 
              className={`font-semibold text-[13.5px] md:text-sm tracking-wide ${
                contentBeautify
                  ? 'text-[#584964] dark:text-[#ECD4E2] font-semibold'
                  : 'text-stone-700 dark:text-stone-300'
              }`}
            >
              {contentBeautify ? `${displayName} đang suy nghĩ ✨` : `Dòng tư duy của ${displayName}`}
            </span>
          </span>

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className={`flex-shrink-0 ${contentBeautify ? 'text-[#F472B6]' : 'text-stone-500'}`}
          >
            <ChevronDown size={18} />
          </motion.div>
        </button>

        {/* Expandable Content Area */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
              className="relative z-10 overflow-hidden"
            >
              <div 
                className={`px-5 py-4 border-t ${
                  contentBeautify
                    ? 'border-[#FBCFE8]/40 dark:border-[#4A2435]/40 text-[#6D5B79] dark:text-[#D4C0CD]'
                    : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                }`}
              >
                {/* Scrollable container for thoughts */}
                <div className="max-h-[350px] overflow-y-auto pr-1">
                  <MarkdownRenderer
                    content={thinkingContent}
                    regexScripts={[]}
                    className={`text-sm leading-relaxed !font-medium ${
                      contentBeautify
                        ? '!text-[#6D5B79] dark:!text-[#D4C0CD]'
                        : ''
                    }`}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
