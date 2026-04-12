// src/hooks/useFontSize.ts
import { useAppSettings } from '../context/SettingsContext';

export const useFontSize = () => {
  const { fontScale } = useAppSettings();
  return (base: number) => Math.round(base * fontScale);
};