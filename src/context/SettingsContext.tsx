// src/context/SettingsContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FontSize = 'small' | 'medium' | 'large';

const SCALE: Record<FontSize, number> = {
  small:  0.88,
  medium: 1,
  large:  1.18,
};

interface AppSettings {
  fontSize:    FontSize;
  setFontSize: (s: FontSize) => void;
  fontScale:   number;  
}

const SettingsContext = createContext<AppSettings>({
  fontSize: 'medium', setFontSize: () => {}, fontScale: 1,
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');

  useEffect(() => {
    AsyncStorage.getItem('settings_fontSize').then(v => {
      if (v === 'small' || v === 'medium' || v === 'large') setFontSizeState(v);
    });
  }, []);

  const setFontSize = (s: FontSize) => {
    setFontSizeState(s);
    AsyncStorage.setItem('settings_fontSize', s);
  };

  return (
    <SettingsContext.Provider value={{ fontSize, setFontSize, fontScale: SCALE[fontSize] }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useAppSettings = () => useContext(SettingsContext);