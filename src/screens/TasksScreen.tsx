// src/screens/TasksScreen.tsx

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { daysLabel, formatTime12 } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { SectionDivider } from '../components/SectionDivider';
import type { Commission } from '../types';
import { useFontSize } from '../hooks/useFontSize';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
};

export const TasksScreen = ({
  commissions,
  onNavigateAdd,
  onNavigateEdit,
  onDelete,
}: {
  commissions: Commission[];
  onNavigateAdd: () => void;
  onNavigateEdit: (item: Commission) => void;
  onDelete: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();

  const handleDelete = (item: Commission) => {
    haptic.warning();
    Alert.alert('Remove Habbit', `Remove "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { haptic.error(); onDelete(item.id); } },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: navHeight }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <View>
          <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.7 }}>Manage your</Text>
          <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 24 }}>Habbits</Text>
        </View>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}>
          <Image source={IMAGES.tasks} style={{ width: 28, height: 28 }} resizeMode="contain" />
        </View>
      </View>

      <SectionDivider title={`✦ ${commissions.length} Habbit${commissions.length !== 1 ? 's' : ''} ✦`} />

      {/* ── Add button ── */}
      <TouchableOpacity
        onPress={onNavigateAdd}
        activeOpacity={0.8}
        style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 16, shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}>
        <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(16) }}>+ Add Habbit</Text>
      </TouchableOpacity>

      {/* ── Empty state ── */}
      {commissions.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 10, opacity: 0.6 }} resizeMode="contain" />
          <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(18), marginBottom: 8 }}>No Habbits yet!</Text>
          <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(14), opacity: 0.5, textAlign: 'center' }}>
            Tap the button above to add{'\n'}your first daily Habbit.
          </Text>
        </View>
      )}

      {/* ── Habbit list ── */}
      {commissions.map(item => {
        const timesPerDay = item.timesPerDay ?? 1;
        const isMulti = timesPerDay > 1;

        // Build reminder summary chips
        const reminderChips: { key: string; label: string }[] = [];
        if (item.reminderTime) {
          reminderChips.push({ key: 'single', label: `🔔 ${formatTime12(item.reminderTime.hour, item.reminderTime.minute)}` });
        }
        if (item.reminderTimes && item.reminderTimes.length > 0) {
          reminderChips.push({ key: 'manual', label: `🔔 ×${item.reminderTimes.length} manual` });
        }
        if (item.reminderSplit) {
          reminderChips.push({
            key: 'split',
            label: `🔔 ${formatTime12(item.reminderSplit.startHour, item.reminderSplit.startMinute)} – ${formatTime12(item.reminderSplit.endHour, item.reminderSplit.endMinute)}`,
          });
        }

        return (
          <View
            key={item.id}
            style={{ backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderLeftWidth: 3, borderLeftColor: '#D4956A', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 16, opacity: 0.3 }}>
                <Text style={{ color: '#D4956A', fontSize: fs(14) }}>☰</Text>
              </View>
              <View style={{ flex: 1, paddingVertical: 10 }}>
                {/* Label + frequency badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(16) }} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {isMulti && (
                    <View style={{ backgroundColor: 'rgba(212,149,106,0.22)', borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(212,149,106,0.45)' }}>
                      <Text style={{ fontFamily: 'DynaPuff', fontSize: 10, color: '#D4956A' }}>{timesPerDay}×</Text>
                    </View>
                  )}
                </View>
                {/* Meta chips */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: 'rgba(212,149,106,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.9)' }}>
                      {daysLabel(item.days ?? [])}
                    </Text>
                  </View>
                  {reminderChips.map(chip => (
                    <View key={chip.key} style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.28)' }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.8)' }}>{chip.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Edit / Delete */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 4 }}>
                <TouchableOpacity
                  onPress={() => onNavigateEdit(item)}
                  activeOpacity={0.7}
                  style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#D4956A' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.7}
                  style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: '#f09090' }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};