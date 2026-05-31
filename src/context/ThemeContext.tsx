import React, { createContext, useContext, useEffect, useState } from 'react';
import { dbService } from '../services/db/indexedDB';
import { CustomTheme } from '../types';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  visualEffects: boolean;
  setVisualEffects: (enabled: boolean) => void;
  layoutZoom: number;
  setLayoutZoom: (zoom: number) => void;

  // Custom Themes supporting
  useCustomTheme: boolean;
  setUseCustomTheme: (enabled: boolean) => void;
  customThemes: CustomTheme[];
  setCustomThemes: (themes: CustomTheme[]) => void;
  activeCustomThemeId: string;
  setActiveCustomThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [fontFamily, setFontFamilyState] = useState<string>('Lora');
  const [fontSize, setFontSizeState] = useState<number>(16);
  const [visualEffects, setVisualEffectsState] = useState<boolean>(true);
  const [layoutZoom, setLayoutZoomState] = useState<number>(100);

  // Custom Theme state variables
  const [useCustomTheme, setUseCustomTheme] = useState<boolean>(false);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [activeCustomThemeId, setActiveCustomThemeId] = useState<string>('');

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await dbService.getSettings();
      setThemeState(settings.theme || 'dark');
      setFontFamilyState(settings.systemFont || 'Lora');
      setFontSizeState(settings.fontSize || 16);
      setVisualEffectsState(settings.visualEffects !== undefined ? settings.visualEffects : true);
      setLayoutZoomState(settings.layoutZoom !== undefined ? settings.layoutZoom : 100);

      // Load custom themes from indexedDB
      setUseCustomTheme(!!settings.useCustomTheme);
      setCustomThemes(settings.customThemes || []);
      setActiveCustomThemeId(settings.activeCustomThemeId || '');
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    // If using custom theme, determine if dark or light is optimal based on isDark field
    if (useCustomTheme && activeCustomThemeId) {
      const activeTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (activeTheme) {
        root.classList.add(activeTheme.isDark ? 'dark' : 'light');
      } else {
        root.classList.add(theme);
      }
    } else {
      root.classList.add(theme);
    }
  }, [theme, useCustomTheme, activeCustomThemeId, customThemes]);

  // Handle CSS variable generation and injection for Custom Theme
  useEffect(() => {
    const root = window.document.documentElement;
    let styleElement = document.getElementById('custom-theme-overrides');

    if (useCustomTheme && activeCustomThemeId) {
      const activeTheme = customThemes.find(t => t.id === activeCustomThemeId);
      if (activeTheme) {
        root.classList.add('custom-theme-active');

        // Create style tag if it does not exist
        if (!styleElement) {
          styleElement = document.createElement('style');
          styleElement.id = 'custom-theme-overrides';
          document.head.appendChild(styleElement);
        }

        const primaryColor = activeTheme.primaryColor;
        const secondaryColor = activeTheme.secondaryColor;
        const accentColor = activeTheme.accentColor;
        const successColor = activeTheme.successColor;
        const warningColor = activeTheme.warningColor;
        const errorColor = activeTheme.errorColor;
        const mutedColor = activeTheme.mutedColor;

        // Populate CSS Custom Variables on :root and override selectors
        styleElement.innerHTML = `
          :root {
            --theme-bg: ${primaryColor};
            --theme-bg-trans: ${primaryColor}cc;
            --theme-text: ${secondaryColor};
            --theme-accent: ${accentColor};
            --theme-success: ${successColor};
            --theme-warning: ${warningColor};
            --theme-error: ${errorColor};
            --theme-muted: ${mutedColor};
          }

          html.custom-theme-active,
          html.custom-theme-active body,
          html.custom-theme-active #root,
          html.custom-theme-active .screen,
          html.custom-theme-active [class*="bg-[#0b1329]"],
          html.custom-theme-active [class*="bg-[#e6ebf4]"],
          html.custom-theme-active [class*="bg-[#010514]"],
          html.custom-theme-active [class*="bg-stone-50"],
          html.custom-theme-active [class*="bg-slate-900"],
          html.custom-theme-active [class*="bg-slate-950"],
          html.custom-theme-active [class*="bg-slate-900/"],
          html.custom-theme-active [class*="bg-slate-950/"],
          html.custom-theme-active [class*="bg-[#0b1329]/"] {
            background-color: var(--theme-bg) !important;
          }

          html.custom-theme-active [class*="bg-[#e6ebf4]/50"] {
            background-color: rgba(128,128,128,0.15) !important;
          }

          html.custom-theme-active,
          html.custom-theme-active p,
          html.custom-theme-active h1,
          html.custom-theme-active h2,
          html.custom-theme-active h3,
          html.custom-theme-active h4,
          html.custom-theme-active h5,
          html.custom-theme-active h6,
          html.custom-theme-active span,
          html.custom-theme-active label,
          html.custom-theme-active button,
          html.custom-theme-active [class*="text-slate-100"],
          html.custom-theme-active [class*="text-slate-200"],
          html.custom-theme-active [class*="text-slate-300"],
          html.custom-theme-active [class*="text-slate-700"],
          html.custom-theme-active [class*="text-slate-800"],
          html.custom-theme-active [class*="text-slate-900"],
          html.custom-theme-active [class*="text-stone-"] {
            color: var(--theme-text) !important;
          }

          html.custom-theme-active [class*="text-slate-400"],
          html.custom-theme-active [class*="text-slate-500"],
          html.custom-theme-active [class*="text-slate-600"] {
            color: var(--theme-muted) !important;
          }

          html.custom-theme-active [class*="text-mystic-accent"] {
            color: var(--theme-accent) !important;
          }

          html.custom-theme-active [class*="bg-mystic-accent"] {
            background-color: var(--theme-accent) !important;
            color: #ffffff !important;
          }

          html.custom-theme-active [class*="border-mystic-accent"] {
            border-color: var(--theme-accent) !important;
          }

          /* Theme indicators */
          html.custom-theme-active [class*="border-[#cbd2df]"],
          html.custom-theme-active [class*="border-[#142042]"] {
            border-color: rgba(128, 128, 128, 0.15) !important;
          }

          html.custom-theme-active [class*="shadow-"] {
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08) !important;
          }
        `;
      }
    } else {
      root.classList.remove('custom-theme-active');
      if (styleElement) {
        styleElement.remove();
      }
    }
  }, [useCustomTheme, activeCustomThemeId, customThemes]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--font-system', fontFamily);
    root.style.setProperty('--font-size-base', `${fontSize}px`);
  }, [fontFamily, fontSize]);

  useEffect(() => {
    const docEl = window.document.documentElement;
    const viewportMeta = document.querySelector('meta[name="viewport"]');

    const updateScaling = () => {
      // Thiết lập hiển thị zoom tùy chọn
      docEl.style.zoom = (layoutZoom / 100).toString();
      docEl.style.transform = '';
      docEl.style.transformOrigin = '';
      docEl.style.width = '';
      docEl.style.height = '';
      docEl.style.overflow = '';
      document.body.style.overflow = '';
      
      const root = document.getElementById('root');
      if (root) {
        root.style.width = '100%';
        root.style.height = '100%';
        root.style.transform = '';
        root.style.transformOrigin = '';
        root.style.overflow = '';
        root.style.position = '';
        root.style.left = '';
        root.style.top = '';
      }

      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }
    };

    updateScaling();
    window.addEventListener('resize', updateScaling);
    return () => {
      window.removeEventListener('resize', updateScaling);
    };
  }, [layoutZoom]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setThemeState(newTheme);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const setFontFamily = (font: string) => {
    setFontFamilyState(font);
  };

  const setFontSize = (size: number) => {
    setFontSizeState(size);
  };

  const setVisualEffects = (enabled: boolean) => {
    setVisualEffectsState(enabled);
  };

  const setLayoutZoom = (zoom: number) => {
    setLayoutZoomState(zoom);
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, toggleTheme, setTheme, 
      fontFamily, setFontFamily, 
      fontSize, setFontSize,
      visualEffects, setVisualEffects,
      layoutZoom, setLayoutZoom,
      useCustomTheme, setUseCustomTheme,
      customThemes, setCustomThemes,
      activeCustomThemeId, setActiveCustomThemeId
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
