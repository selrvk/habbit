import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { daysLabel, formatTime12 } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { SectionDivider } from '../components/SectionDivider';
import { CommissionModal } from '../components/CommissionModal';
import type { Commission, ReminderTime } from '../types';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
};

export const TasksScreen = ({ commissions, onAdd, onEdit, onDelete }: {
  commissions: Commission[];
  onAdd:    (label: string, days: number[], reminderTime: ReminderTime | null) => void;
  onEdit:   (id: string, label: string, days: number[], reminderTime: ReminderTime | null) => void;
  onDelete: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem]   = useState<Commission | null>(null);

  const openAdd  = () => { setEditingItem(null); setModalVisible(true); };
  const openEdit = (item: Commission) => { setEditingItem(item); setModalVisible(true); };
  const closeModal = () => { setModalVisible(false); setEditingItem(null); };

  const handleSave = (label: string, days: number[], reminderTime: ReminderTime | null) => {
    editingItem ? onEdit(editingItem.id, label, days, reminderTime) : onAdd(label, days, reminderTime);
    closeModal();
  };

  const handleDelete = (item: Commission) => {
    haptic.warning();
    Alert.alert('Remove Habbit', `Remove "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { haptic.error(); onDelete(item.id); } },
    ]);
  };

  return (
    <>
      <CommissionModal visible={modalVisible} initialValue={editingItem?.label ?? ''} initialDays={editingItem?.days ?? []} initialReminderTime={editingItem?.reminderTime ?? null} onSave={handleSave} onClose={closeModal} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: navHeight }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
        <TouchableOpacity onPress={openAdd} activeOpacity={0.8}
          style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 16, shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}>
          <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 16 }}>+ Add Habbit</Text>
        </TouchableOpacity>
        {commissions.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 10, opacity: 0.6 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 18, marginBottom: 8 }}>No Habbits yet!</Text>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.5, textAlign: 'center' }}>Tap the button above to add{'\n'}your first daily Habbit.</Text>
          </View>
        )}
        {commissions.map(item => (
          <View key={item.id} style={{ backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderLeftWidth: 3, borderLeftColor: '#D4956A', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 16, opacity: 0.3 }}>
                <Text style={{ color: '#D4956A', fontSize: 14 }}>☰</Text>
              </View>
              <View style={{ flex: 1, paddingVertical: 10 }}>
                <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 16 }} numberOfLines={1}>{item.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <View style={{ backgroundColor: 'rgba(212,149,106,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.9)' }}>{daysLabel(item.days ?? [])}</Text>
                  </View>
                  {item.reminderTime && (
                    <View style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.28)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 10 }}>🔔</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.8)' }}>{formatTime12(item.reminderTime.hour, item.reminderTime.minute)}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 4 }}>
                <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.7}
                  style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#D4956A' }}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} activeOpacity={0.7}
                  style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#f09090' }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
};