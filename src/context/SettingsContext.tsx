// src/context/SettingsContext.tsx
//
// Provides font-size scale and theme preference to every screen.
// Wrap the root <App> with <SettingsProvider> and read values with
// useAppSettings() anywhere you need them.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FontSize = 'small' | 'medium' | 'large';
export type Theme    = 'dark';   // 'light' ready to unlock later

export interface AppSettings {
  fontSize:        FontSize;
  theme:           Theme;
  setFontSize:     (s: FontSize) => void;
  setTheme:        (t: Theme)    => void;
  /** Multiply any base pt value by this to get a scaled size.
   *  small → 0.88 · medium → 1.0 · large → 1.14  */
  fontScale:       number;
}

// ─── Scale map ────────────────────────────────────────────────────────────────

export const FONT_SCALE: Record<FontSize, number> = {
  small:  0.88,
  medium: 1.0,
  large:  1.14,
};

// ─── Context ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@habbit_app_settings';

const defaultValue: AppSettings = {
  fontSize:    'medium',
  theme:       'dark',
  setFontSize: () => {},
  setTheme:    () => {},
  fontScale:   1.0,
};

const SettingsContext = createContext<AppSettings>(defaultValue);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');
  const [theme,    setThemeState]    = useState<Theme>('dark');

  // Load persisted prefs once
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved.fontSize) setFontSizeState(saved.fontSize);
        if (saved.theme)    setThemeState(saved.theme);
      } catch {}
    });
  }, []);

  const persist = useCallback((next: { fontSize?: FontSize; theme?: Theme }) => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      const current = raw ? JSON.parse(raw) : {};
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...next })).catch(() => {});
    });
  }, []);

  const setFontSize = useCallback((s: FontSize) => {
    setFontSizeState(s);
    persist({ fontSize: s });
  }, [persist]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    persist({ theme: t });
  }, [persist]);

  return (
    <SettingsContext.Provider value={{
      fontSize,
      theme,
      setFontSize,
      setTheme,
      fontScale: FONT_SCALE[fontSize],
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAppSettings = () => useContext(SettingsContext);