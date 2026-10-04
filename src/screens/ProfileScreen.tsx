import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES, AVATAR_KEYS } from '../constants';
import { avatarImage } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { useFontSize } from '../hooks/useFontSize';
import { TextModal } from '../components/TextModal';
import { CompletionCalendar } from '../components/CompletionCalendar';
import { useProStatus } from '../context/ProContext';
import { PaywallScreen } from './PaywallScreen';
import type { Stats, CompletionRecord } from '../types';
import { ACHIEVEMENTS, earnedSortKey, type Earned } from '../achievements';
import { Icon } from '../components/Icon';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light: () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS),
};

const C = {
  cream:  '#e8d5c0',
  accent: '#D4956A',
  card:   '#5C3D2E',
  muted:  'rgba(232,213,192,0.55)',
  border: 'rgba(212,149,106,0.18)',
};

export const ProfileScreen = ({ name, avatar, stats, completionHistory, todayKey, onSetName, onSetAvatar, onOpenSettings, onOpenWeekRecap, earned, onOpenAchievements }: {
  name: string; avatar: string; stats: Stats; completionHistory: CompletionRecord[]; todayKey: string;
  onSetName: (v: string) => void; onSetAvatar: (v: string) => void;
  onOpenSettings: () => void;
  onOpenWeekRecap: () => void;
  earned: Earned;
  onOpenAchievements: () => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();
  const [nameModal, setNameModal]       = useState(false);
  const [showPaywall, setShowPaywall]   = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const { isPro } = useProStatus();

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17), marginTop: 24, marginBottom: 10 }}>{children}</Text>
  );

  const StatCard = ({ emoji, label, value, suffix, accent = false }: { emoji: any; label: string; value: number; suffix?: string; accent?: boolean }) => (
    <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: accent ? 'rgba(212,149,106,0.45)' : C.border }}>
      <Image source={emoji} style={{ width: 40, height: 40, marginBottom: 4 }} resizeMode="contain" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(28), color: accent ? C.accent : C.cream, lineHeight: fs(32) }}>{value}</Text>
        {suffix && <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginBottom: 4 }}>{suffix}</Text>}
      </View>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );

  return (
    <>
      <Modal visible={showPaywall} animationType="slide" presentationStyle="pageSheet">
        <PaywallScreen onClose={() => setShowPaywall(false)} />
      </Modal>
      <TextModal visible={nameModal} title="Edit Name" placeholder="Your name" initialValue={name} onSave={v => { onSetName(v); setNameModal(false); }} onClose={() => setNameModal(false)} />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: navHeight }} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(24) }}>Profile</Text>
          <TouchableOpacity
            onPress={() => { haptic.light(); onOpenSettings(); }}
            activeOpacity={0.7}
            accessibilityLabel="Settings"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}>
            <Icon name="gear" size={fs(18)} />
            <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(13) }}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* ── Identity ── */}
        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <TouchableOpacity
            onPress={() => { haptic.light(); setPickingAvatar(v => !v); }}
            activeOpacity={0.8}
            accessibilityLabel="Change avatar"
            style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5, borderColor: C.accent }}>
            <Image source={avatarImage(avatar)} style={{ width: 66, height: 66 }} resizeMode="contain" />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#2A1A18' }}>
              <Text style={{ color: '#fff', fontSize: 13 }}>✎</Text>
            </View>
          </TouchableOpacity>

          {pickingAvatar && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {AVATAR_KEYS.map(key => {
                const selected = avatar === key;
                return (
                  <TouchableOpacity key={key}
                    onPress={() => { haptic.light(); onSetAvatar(key); setPickingAvatar(false); }}
                    activeOpacity={0.7}
                    accessibilityState={{ selected }}
                    style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: selected ? 'rgba(212,149,106,0.25)' : C.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: selected ? C.accent : 'transparent' }}>
                    <Image source={avatarImage(key)} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity onPress={() => { haptic.light(); setNameModal(true); }} activeOpacity={0.8} accessibilityLabel={`Name: ${name}. Tap to edit`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(24), color: C.cream }}>{name}</Text>
            <Text style={{ fontSize: fs(14), color: C.muted }}>✎</Text>
          </TouchableOpacity>

          {isPro ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
              <Icon name="carrot" size={fs(18)} />
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(13), color: C.accent }}>Habbit Pro</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { haptic.light(); setShowPaywall(true); }} activeOpacity={0.8}
              style={{ marginTop: 8, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)', backgroundColor: 'rgba(212,149,106,0.08)' }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.accent }}>Free plan · Unlock Pro →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Stats ── */}
        <SectionTitle>Your stats</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatCard emoji={require('./../../assets/emojis/Fire.png')} label="Current streak" value={stats.currentStreak} suffix="days" accent={stats.currentStreak > 0} />
          <StatCard emoji={require('./../../assets/emojis/Star.png')} label="Best streak" value={stats.bestStreak} suffix="days" />
          <StatCard emoji={IMAGES.carrots} label="Habbits done" value={stats.totalCompleted} />
        </View>
        {stats.currentStreak === 0 && (
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 10 }}>
            Finish all of today's Habbits to start a streak 🔥
          </Text>
        )}

        {/* ── Achievements: the latest few, newest first ── */}
        {(() => {
          const got    = ACHIEVEMENTS.filter(a => earned[a.id]);
          const recent = [...got].sort((a, b) => earnedSortKey(earned[b.id]).localeCompare(earnedSortKey(earned[a.id]))).slice(0, 6);
          return (
            <TouchableOpacity onPress={() => { haptic.light(); onOpenAchievements(); }} activeOpacity={0.8}
              accessibilityLabel={`Achievements: ${got.length} of ${ACHIEVEMENTS.length} earned`}
              style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: C.cream }}>Achievements</Text>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.accent }}>{got.length} of {ACHIEVEMENTS.length} ›</Text>
              </View>
              {recent.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {recent.map(a => (
                    <View key={a.id} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,149,106,0.22)', borderWidth: 1.5, borderColor: C.accent }}>
                      <Icon name={a.icon} size={fs(25)} />
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 6 }}>Check off your first Habbit to earn one 🐣</Text>
              )}
            </TouchableOpacity>
          );
        })()}

        <TouchableOpacity onPress={() => { haptic.light(); onOpenWeekRecap(); }} activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
          <Image source={require('../../assets/bonbon/idle.png')} style={{ width: 34, height: 34 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: C.cream }}>Weekly recaps</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>How each week went, with a tip for the next</Text>
          </View>
          <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(20) }}>›</Text>
        </TouchableOpacity>

        {/* ── History ── */}
        <SectionTitle>History</SectionTitle>
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>
          {completionHistory.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Image source={IMAGES.bunny} style={{ width: 40, height: 40, marginBottom: 8, opacity: 0.5 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center' }}>
                Your days will fill in here as you go.
              </Text>
            </View>
          ) : <CompletionCalendar records={completionHistory} todayKey={todayKey} />}
        </View>
      </ScrollView>
    </>
  );
};
