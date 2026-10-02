// src/components/CategoryEditor.tsx
//
// Make or edit a custom spending category: a name, an emoji and a colour. Shown as a page
// sheet from the category picker and from Settings.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { CATEGORY_COLORS, CATEGORY_EMOJIS, newCategoryKey, pickableCategories, type Category, type CustomCategory } from '../categories';

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', muted: 'rgba(232,213,192,0.5)', border: 'rgba(212,149,106,0.2)' };

const Label = ({ children }: { children: React.ReactNode }) => {
  const fs = useFontSize();
  return (
    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.75)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 20, marginLeft: 4 }}>{children}</Text>
  );
};

export const CategoryEditor = ({ visible, category, custom, onSave, onRemove, onClose }: {
  visible: boolean;
  /** The category being edited, or undefined for a new one. */
  category?: CustomCategory;
  /** All custom categories, to suggest an unused emoji and colour and catch duplicate names. */
  custom: CustomCategory[];
  onSave: (category: Category) => void;
  onRemove?: () => void;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();

  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState(CATEGORY_EMOJIS[0]);
  const [color, setColor] = useState(CATEGORY_COLORS[0]);

  // Fill the form each time it opens; a new one starts with an emoji and colour not in use.
  useEffect(() => {
    if (!visible) return;
    const live = custom.filter(c => !c.archived);
    setLabel(category?.label ?? '');
    setEmoji(category?.emoji ?? CATEGORY_EMOJIS.find(e => !live.some(c => c.emoji === e)) ?? CATEGORY_EMOJIS[0]);
    setColor(category?.color ?? CATEGORY_COLORS.find(k => !live.some(c => c.color === k)) ?? CATEGORY_COLORS[0]);
  }, [visible]);

  const name      = label.trim();
  const duplicate = pickableCategories(custom).find(c => c.key !== category?.key && c.label.toLowerCase() === name.toLowerCase());
  const canSave   = name.length > 0 && !duplicate;

  const save = () => {
    if (!canSave) return;
    haptic();
    onSave({ key: category?.key ?? newCategoryKey(), label: name, emoji, color });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ minWidth: 60 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: 'rgba(232,213,192,0.6)' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }}>{category ? 'Edit category' : 'New category'}</Text>
          <View style={{ minWidth: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {/* How it'll look in the picker */}
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <View style={{ width: 92, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: `${color}2E`, borderWidth: 1.5, borderColor: color }}>
              <Text style={{ fontSize: 30 }}>{emoji}</Text>
              <Text numberOfLines={1} style={{ fontFamily: 'Jua', fontSize: fs(12), marginTop: 4, paddingHorizontal: 6, color: C.cream }}>{name || 'Name'}</Text>
            </View>
          </View>

          <Label>Name</Label>
          <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: duplicate ? '#f09090' : name ? C.accent : C.border }}>
            <TextInput value={label} onChangeText={setLabel} placeholder="e.g. Coffee" placeholderTextColor="rgba(232,213,192,0.25)"
              maxLength={14} returnKeyType="done" autoCapitalize="words"
              style={{ fontFamily: 'Jua', fontSize: fs(18), color: C.cream, paddingVertical: 16 }} />
          </View>
          {duplicate && (
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#f09090', marginTop: 6, marginLeft: 4 }}>You already have {duplicate.emoji} {duplicate.label}.</Text>
          )}

          <Label>Emoji</Label>
          <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 8, flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
            {CATEGORY_EMOJIS.map(e => {
              const active = e === emoji;
              return (
                <View key={e} style={{ width: '12.5%', aspectRatio: 1, padding: 2 }}>
                  <TouchableOpacity onPress={() => { haptic(); setEmoji(e); }} activeOpacity={0.7}
                    accessibilityRole="button" accessibilityLabel={e} accessibilityState={{ selected: active }}
                    style={{ flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(212,149,106,0.35)' : 'transparent' }}>
                    <Text style={{ fontSize: fs(20) }}>{e}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Label>Colour</Label>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            {CATEGORY_COLORS.map(k => {
              const active = k === color;
              return (
                <TouchableOpacity key={k} onPress={() => { haptic(); setColor(k); }} activeOpacity={0.7}
                  accessibilityRole="button" accessibilityLabel={`Colour ${CATEGORY_COLORS.indexOf(k) + 1}`} accessibilityState={{ selected: active }}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: k, borderWidth: 3, borderColor: active ? C.cream : 'transparent' }} />
              );
            })}
          </View>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 10, marginLeft: 4 }}>Used for it in “Where it went” and your recaps.</Text>

          {category && onRemove && (
            <TouchableOpacity
              onPress={() => {
                haptic();
                Alert.alert('Remove category', `Stop offering ${category.emoji} ${category.label}? Expenses already in it keep it.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: onRemove },
                ]);
              }}
              style={{ alignSelf: 'center', marginTop: 28, paddingVertical: 10, paddingHorizontal: 20 }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: '#f09090' }}>Remove category</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
          <TouchableOpacity onPress={save} disabled={!canSave} activeOpacity={0.8}
            style={{ backgroundColor: canSave ? C.accent : 'rgba(212,149,106,0.18)', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: canSave ? '#fff' : 'rgba(255,255,255,0.3)' }}>{category ? 'Save changes' : 'Add category'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
