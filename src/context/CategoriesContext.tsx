// src/context/CategoriesContext.tsx
//
// The user's own spending categories, for the pickers and the Settings sheet to read and
// change. App.tsx owns them: it loads, saves and backs them up.

import { createContext, useContext } from 'react';
import type { Category, CustomCategory } from '../categories';

export type CategoriesValue = {
  custom: CustomCategory[];
  /** Adds a new one, or updates the one with the same key. Returns the key it's saved under. */
  save: (category: Category) => string;
  /** Archives it: no longer offered, but expenses already in it keep its name. */
  remove: (key: string) => void;
};

export const CategoriesContext = createContext<CategoriesValue>({ custom: [], save: c => c.key, remove: () => {} });

export const useCategories = () => useContext(CategoriesContext);
