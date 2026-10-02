// src/components/CategoriesSheet.tsx
//
// Settings → Spending categories: the built-in ones, and your own to add (Pro), edit or
// remove. Categories you made stay yours to use and edit if Pro ends.

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { CATEGORIES, MAX_CUSTOM_CATEGORIES, type CustomCategory } from '../categories';
import { useCategories } from '../context/CategoriesContext';
import { useProStatus } from '../context/ProContext';
import { PaywallScreen } from '../screens/PaywallScreen';
import { CategoryEditor } from './CategoryEditor';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', muted: 'rgba(232,213,192,0.5)', border: 'rgba(212,149,106,0.2)' };

export const CategoriesSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const { custom, save, remove } = useCategories();
  const { isPro } = useProStatus();
  const [editing, setEditing] = useState<'new' | CustomCategory | null>(null);
  const [paywall, setPaywall] = useState(false);

  const yours  = custom.filter(c => !c.archived);
  const canAdd = yours.length < MAX_CUSTOM_CATEGORIES;

  const Heading = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.75)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 20, marginLeft: 4 }}>{children}</Text>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <View style={{ minWidth: 60 }} />
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }}>Spending categories</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ minWidth: 60, alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: C.accent }}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
          <Heading>Yours</Heading>
          <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)', overflow: 'hidden' }}>
            {yours.length === 0 && (
              <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, padding: 16 }}>
                Make your own, like ☕ Coffee or 🐶 Pets. They show up whenever you log an expense.
              </Text>
            )}
            {yours.map((c, i) => (
              <TouchableOpacity key={c.key} onPress={() => { haptic(); setEditing(c); }} activeOpacity={0.75}
                accessibilityRole="button" accessibilityLabel={`${c.label}, edit`}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.border }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${c.color}38`, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: fs(17) }}>{c.emoji}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: 'Jua', fontSize: fs(15), color: C.cream }}>{c.label}</Text>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color, marginRight: 10 }} />
                <Text style={{ fontSize: fs(15), color: C.muted }}>›</Text>
              </TouchableOpacity>
            ))}
            {canAdd ? (
              <TouchableOpacity onPress={() => { haptic(); if (isPro) setEditing('new'); else setPaywall(true); }} activeOpacity={0.75}
                accessibilityRole="button" accessibilityLabel={isPro ? 'New category' : 'New category, with Habbit Pro'}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: yours.length > 0 ? 1 : 0, borderTopColor: C.border }}>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: C.accent, flex: 1 }}>＋ New category</Text>
                {!isPro && (
                  <View style={{ backgroundColor: 'rgba(212,149,106,0.2)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: C.accent }}>🥕 PRO</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border }}>
                That's {MAX_CUSTOM_CATEGORIES}, the most there can be. Remove one to make room.
              </Text>
            )}
          </View>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 8, marginLeft: 4 }}>
            Tip: hold one of yours in the category picker to edit it.
          </Text>

          <Heading>Built in</Heading>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.18)' }}>
                <Text style={{ fontSize: fs(14) }}>{c.emoji}</Text>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: 'rgba(232,213,192,0.7)' }}>{c.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <CategoryEditor
          visible={editing !== null}
          category={editing === 'new' || editing === null ? undefined : editing}
          custom={custom}
          onSave={c => { save(c); setEditing(null); }}
          onRemove={editing && editing !== 'new' ? () => { remove(editing.key); setEditing(null); } : undefined}
          onClose={() => setEditing(null)}
        />
        <Modal visible={paywall} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaywall(false)}>
          <PaywallScreen onClose={() => setPaywall(false)} />
        </Modal>
      </View>
    </Modal>
  );
};
