import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES, AVATAR_KEYS } from '../constants';
import { avatarImage } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { SectionDivider } from '../components/SectionDivider';
import { TextModal } from '../components/TextModal';
import { CompletionCalendar } from '../components/CompletionCalendar';
import type { Stats, CompletionRecord } from '../types';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light: () => ReactNativeHapticFeedback.trigger('impactLight',       HAPTIC_OPTIONS),
  error: () => ReactNativeHapticFeedback.trigger('notificationError', HAPTIC_OPTIONS),
};

export const ProfileScreen = ({ name, avatar, stats, completionHistory, todayKey, midnightNotifEnabled, onSetName, onSetAvatar, onResetToday, onDeleteAllData, onToggleMidnightNotif, onOpenSettings }: {
  name: string; avatar: string; stats: Stats; completionHistory: CompletionRecord[]; todayKey: string;
  midnightNotifEnabled: boolean;
  onSetName: (v: string) => void; onSetAvatar: (v: string) => void;
  onResetToday: () => void; onDeleteAllData: () => void; onToggleMidnightNotif: (v: boolean) => void;
  onOpenSettings: () => void;
}) => {
  const navHeight = useNavHeight();
  const [nameModal, setNameModal] = useState(false);

  const handleReset = () => {
    haptic.error();
    Alert.alert("Reset Today's Data", "This will uncheck all of today's Habbits and clear today's spending. Are you sure?", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => { haptic.error(); onResetToday(); } },
    ]);
  };

  const handleDeleteAll = () => {
    haptic.error();
    Alert.alert('Delete All Data', 'This will permanently delete everything. Are you absolutely sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: () => {
        haptic.error();
        Alert.alert('Are you sure?', 'This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, delete everything', style: 'destructive', onPress: () => { haptic.error(); onDeleteAllData(); } },
        ]);
      }},
    ]);
  };

  const StatCard = ({ emoji, label, value, showDaysSuffix = false, accent = false }: { emoji: string; label: string; value: number | string; showDaysSuffix?: boolean; accent?: boolean }) => (
    <View style={{ flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: accent ? 'rgba(212,149,106,0.4)' : 'rgba(212,149,106,0.15)' }}>
      <Text style={{ fontSize: 28, marginBottom: 6 }}>{emoji}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: 32, color: accent ? '#D4956A' : '#e8d5c0', lineHeight: 36 }}>{value}</Text>
        {showDaysSuffix && <Text style={{ fontFamily: 'Jua', fontSize: 12, color: accent ? 'rgba(212,149,106,0.7)' : 'rgba(232,213,192,0.5)', marginBottom: 4 }}>days</Text>}
      </View>
      <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.5)', textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );

  const ToggleRow = ({ icon, title, subtitle, enabled, onToggle }: { icon: string; title: string; subtitle: string; enabled: boolean; onToggle: () => void }) => (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#5C3D2E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: enabled ? 'rgba(212,149,106,0.3)' : 'rgba(212,149,106,0.12)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Jua', fontSize: 13, color: '#e8d5c0' }}>{title}</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.45)', marginTop: 1 }}>{subtitle}</Text>
        </View>
      </View>
      <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: enabled ? '#D4956A' : 'rgba(212,149,106,0.2)', justifyContent: 'center', paddingHorizontal: 3, alignItems: enabled ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <TextModal visible={nameModal} title="Edit Name" placeholder="Your name" initialValue={name} onSave={v => { onSetName(v); setNameModal(false); }} onClose={() => setNameModal(false)} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: navHeight }} showsVerticalScrollIndicator={false}>

        <View style={{ marginBottom: 8 }}>
          {/* Gear button */}
          <TouchableOpacity
            onPress={() => { haptic.light(); onOpenSettings(); }}
            activeOpacity={0.7}
            style={{
              alignSelf: 'flex-end',
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: 'rgba(212,149,106,0.12)',
              borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)',
              justifyContent: 'center', alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>

          {/* Avatar + name — keep exactly as-is, just change alignItems wrapper */}
          <View style={{ alignItems: 'center' }}>
            {/* ...your existing avatar image and name TouchableOpacity... */}
            <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2.5, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 }}>
              <Image source={avatarImage(avatar)} style={{ width: 62, height: 62 }} resizeMode="contain" />
            </View>
            <TouchableOpacity onPress={() => { haptic.light(); setNameModal(true); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: 26, color: '#e8d5c0' }}>{name}</Text>
              <View style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}>
                <Text style={{ fontFamily: 'Jua', fontSize: 11, color: '#D4956A' }}>Edit</Text>
              </View>
          </TouchableOpacity>
          </View>
        </View>

        <SectionDivider title="✦ Choose Avatar ✦" />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
          {AVATAR_KEYS.map(key => {
            const isSelected = avatar === key;
            return (
              <TouchableOpacity key={key} onPress={() => { haptic.light(); onSetAvatar(key); }} activeOpacity={0.7}
                style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: isSelected ? 'rgba(212,149,106,0.2)' : '#5C3D2E', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: isSelected ? '#D4956A' : 'rgba(212,149,106,0.15)', shadowColor: isSelected ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: isSelected ? 4 : 0 }}>
                <Image source={avatarImage(key)} style={{ width: 38, height: 38 }} resizeMode="contain" />
              </TouchableOpacity>
            );
          })}
        </View>

        <SectionDivider title="✦ Your Stats ✦" />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard emoji="🔥" label="Current Streak" value={stats.currentStreak} showDaysSuffix accent={stats.currentStreak > 0} />
          <StatCard emoji="⭐" label="Best Streak" value={stats.bestStreak} showDaysSuffix />
        </View>
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)', marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={IMAGES.carrot} style={{ width: 28, height: 28 }} resizeMode="contain" />
            <View>
              <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.5)', marginBottom: 2 }}>Total Habbits Completed</Text>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: 28, color: '#e8d5c0' }}>{stats.totalCompleted}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.3)' }}>all time</Text>
        </View>
        {stats.currentStreak === 0 && <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.3)', textAlign: 'center', marginTop: 6, marginBottom: 4 }}>Complete all Habbits today to start your streak! 🔥</Text>}

        <SectionDivider title="✦ Completion History ✦" />
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
          {completionHistory.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Image source={IMAGES.bunny} style={{ width: 40, height: 40, marginBottom: 8, opacity: 0.4 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(232,213,192,0.4)', textAlign: 'center' }}>Complete all your Habbits for a day{'\n'}to start building your history!</Text>
            </View>
          ) : <CompletionCalendar records={completionHistory} todayKey={todayKey} />}
        </View>
      </ScrollView>
    </>
  );
};