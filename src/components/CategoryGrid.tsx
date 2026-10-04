// src/components/CategoryGrid.tsx
//
// The spending categories as a 4-column grid of tappable tiles: the built-in ones, the
// user's own, and "New" to make one (Pro). Holding one of your own edits it.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { MAX_CUSTOM_CATEGORIES, pickableCategories, type CustomCategory } from '../categories';
import { useCategories } from '../context/CategoriesContext';
import { useProStatus } from '../context/ProContext';
import { PaywallScreen } from '../screens/PaywallScreen';
import { CategoryEditor } from './CategoryEditor';
import { CategoryIcon } from './Icon';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

const tileStyle = { width: '23%' as const, paddingVertical: 8, borderRadius: 12, alignItems: 'center' as const, borderWidth: 1 };

/** Tapping the selected tile again clears it (onChange(undefined)). A new category is picked. */
export const CategoryGrid = ({ value, onChange }: { value?: string; onChange: (key: string | undefined) => void }) => {
  const { custom, save, remove } = useCategories();
  const { isPro } = useProStatus();
  // null: closed; 'new'; or the category being edited.
  const [editing, setEditing] = useState<'new' | CustomCategory | null>(null);
  const [paywall, setPaywall] = useState(false);

  const canAdd = custom.filter(c => !c.archived).length < MAX_CUSTOM_CATEGORIES;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {pickableCategories(custom).map(c => {
        const active = c.key === value;
        const own    = custom.find(k => k.key === c.key);
        return (
          <TouchableOpacity key={c.key} onPress={() => { haptic(); onChange(active ? undefined : c.key); }} activeOpacity={0.7}
            onLongPress={own ? () => { haptic(); setEditing(own); } : undefined}
            accessibilityRole="button" accessibilityLabel={c.label} accessibilityState={{ selected: active }}
            accessibilityHint={own ? 'Hold to edit' : undefined}
            style={{
              ...tileStyle,
              backgroundColor: active ? '#D4956A' : 'rgba(212,149,106,0.1)',
              borderColor: active ? '#D4956A' : 'rgba(212,149,106,0.2)',
            }}>
            <CategoryIcon category={c} size={24} />
            <Text numberOfLines={1} style={{ fontFamily: 'Jua', fontSize: 10, marginTop: 2, paddingHorizontal: 2, color: active ? '#fff' : 'rgba(232,213,192,0.7)' }}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}

      {canAdd && (
        <TouchableOpacity onPress={() => { haptic(); if (isPro) setEditing('new'); else setPaywall(true); }} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={isPro ? 'New category' : 'New category, with Habbit Pro'}
          style={{ ...tileStyle, borderStyle: 'dashed', borderColor: 'rgba(212,149,106,0.35)', backgroundColor: 'transparent' }}>
          <Text style={{ fontSize: 18, color: '#D4956A', lineHeight: 22 }}>＋</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: 10, marginTop: 2, color: 'rgba(232,213,192,0.7)' }}>{isPro ? 'New' : 'New · PRO'}</Text>
        </TouchableOpacity>
      )}

      <CategoryEditor
        visible={editing !== null}
        category={editing === 'new' || editing === null ? undefined : editing}
        custom={custom}
        onSave={c => { const key = save(c); if (editing === 'new') onChange(key); setEditing(null); }}
        onRemove={editing && editing !== 'new' ? () => { remove(editing.key); setEditing(null); } : undefined}
        onClose={() => setEditing(null)}
      />
      <Modal visible={paywall} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaywall(false)}>
        <PaywallScreen onClose={() => setPaywall(false)} />
      </Modal>
    </View>
  );
};
