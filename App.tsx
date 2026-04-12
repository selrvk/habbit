// app.tsx

import "./global.css";
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Platform,
  Animated, PanResponder, Modal, TouchableWithoutFeedback,
  TextInput, KeyboardAvoidingView, Alert, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { JUA, DYNAPUFF, DEFAULT_BUDGET, DEFAULT_AVATAR, IMAGES, OVER, PILL_H, NAV_BUFFER, DEFAULT_CURRENCY, AVATAR_KEYS, CURRENCIES, DAY_LABELS, CAL_DAY_LABELS } from './src/constants';
import { applyNumpadKey, avatarImage, getTodayKey, getYesterdayKey, getFormattedDate, formatTime, formatTime12, generateId, getLast7Days, isScheduledForDay, buildCalendarGrid, migrateCommissions, defaultStats, daysLabel } from "./src/helpers";
import { initNotifications, scheduleHabitNotifs, cancelHabitNotifs, scheduleMidnightNotif, cancelMidnightNotif } from "./src/notifications";
import { STORAGE_COMMISSIONS, STORAGE_COMPLETION_HISTORY, STORAGE_FINANCE, STORAGE_FINANCE_HISTORY, STORAGE_ONBOARDED, STORAGE_SETTINGS, STORAGE_STATS, ALL_STORAGE_KEYS } from "./src/storage";
import { ReminderTime, Commission, CommissionsData, SpendingEntry, FinanceData, DailyTotal, Settings, Stats, ChartDay, TabKey, CompletionRecord, OnboardingResult, AvatarKey } from "./src/types";

// Components
import { SectionDivider }      from './src/components/SectionDivider';
import { DayPicker }           from './src/components/DayPicker';
import { TimePicker }          from './src/components/TimePicker';
import { NumpadModal }         from './src/components/NumpadModal';
import { TextModal }           from './src/components/TextModal';
import { CommissionModal }     from './src/components/CommissionModal';
import { WeeklyChart }         from './src/components/WeeklyChart';
import { CompletionCalendar }  from './src/components/CompletionCalendar';
import { SwipeableTaskItem }   from './src/components/SwipeableTaskItem';
import { BottomNav }           from './src/components/BottomNav';

// ─── Haptic helpers ───────────────────────────────────────────────────────────

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
};

// For nav bar
const useNavHeight = () => {
  const insets = useSafeAreaInsets();
  return OVER + PILL_H + insets.bottom + NAV_BUFFER;
};

// ─── Onboarding ───────────────────────────────────────────────────────────────
// Steps: 0 Welcome → 1 Name → 2 First Habbit → 3 Daily Budget → 4 Tour

const ONBOARD_STEPS = 5;

const OnboardingScreen = ({ onComplete }: { onComplete: (result: OnboardingResult) => void }) => {
  const [step, setStep]             = useState(0);
  const [name, setName]             = useState('');
  const [habbit, setHabbit]         = useState('');
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetCurrency, setBudgetCurrency] = useState(DEFAULT_CURRENCY);

  const nameRef   = useRef<TextInput>(null);
  const habbitRef = useRef<TextInput>(null);
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animateToNext = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim,   { toValue: -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep); slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim,   { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }),
      ]).start();
    });
  };

  const goNext = () => {
    haptic.light(); animateToNext(step + 1);
    if (step === 0) setTimeout(() => nameRef.current?.focus(), 420);
    if (step === 1) setTimeout(() => habbitRef.current?.focus(), 420);
  };

  const handleFinish = () => {
    haptic.success();
    const parsedBudget = parseFloat(budgetInput || '0');
    onComplete({
      name: name.trim() || 'Friend',
      firstHabbit: habbit.trim() || null,
      budget: parsedBudget > 0 ? parsedBudget : DEFAULT_BUDGET,
      currency: budgetCurrency,
    });
  };

  const canProceedStep1 = name.trim().length > 0;
  const budgetSet = parseFloat(budgetInput || '0') > 0;

  const Dots = () => (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 40 }}>
      {Array.from({ length: ONBOARD_STEPS }).map((_, i) => (
        <View key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === step ? '#D4956A' : 'rgba(212,149,106,0.25)' }} />
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {

      // ── 0: Welcome ───────────────────────────────────────────────────────
      case 0: return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Dots />
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2.5, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }}>
            <Image source={IMAGES.appLogo} style={{ width: 72, height: 72 }} resizeMode="contain" />
          </View>
          <Text className={DYNAPUFF} style={{ fontSize: 32, color: '#e8d5c0', marginBottom: 6, textAlign: 'center' }}>Habbit</Text>
          <Text className={JUA} style={{ fontSize: 13, color: 'rgba(212,149,106,0.8)', marginBottom: 20, textAlign: 'center', letterSpacing: 1 }}>YOUR DAILY COMPANION</Text>
          <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 18, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)', width: '100%' }}>
            <Text className={JUA} style={{ fontSize: 13, color: 'rgba(232,213,192,0.7)', textAlign: 'center', lineHeight: 20 }}>
              Yes, <Text style={{ color: '#D4956A' }}>Habbit</Text> is spelled with two B's on purpose 🐰{'\n'}
              It's a nod to <Text style={{ color: '#D4956A' }}>Habit</Text> + <Text style={{ color: '#D4956A' }}>Rabbit</Text> — your furry companion for building better daily routines and staying on budget.
            </Text>
          </View>
          <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 48, shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}>
            <Text className={DYNAPUFF} style={{ color: '#fff', fontSize: 17 }}>Let's get started 🥕</Text>
          </TouchableOpacity>
        </View>
      );

      // ── 1: Name ──────────────────────────────────────────────────────────
      case 1: return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Text style={{ fontSize: 48, marginBottom: 16 }}>👋</Text>
            <Text className={DYNAPUFF} style={{ fontSize: 26, color: '#e8d5c0', marginBottom: 8, textAlign: 'center' }}>What's your name?</Text>
            <Text className={JUA} style={{ fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 32, textAlign: 'center' }}>This will appear on your home screen.</Text>
            <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: canProceedStep1 ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 20, paddingVertical: 4, marginBottom: 32, width: '100%' }}>
              <TextInput ref={nameRef} value={name} onChangeText={setName} placeholder="e.g. Charles" placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={() => canProceedStep1 && goNext()} maxLength={24} style={{ fontFamily: 'DynaPuff', fontSize: 22, color: '#e8d5c0', paddingVertical: 16, textAlign: 'center' }} />
            </View>
            <TouchableOpacity onPress={canProceedStep1 ? goNext : undefined} activeOpacity={canProceedStep1 ? 0.85 : 1} style={{ backgroundColor: canProceedStep1 ? '#D4956A' : 'rgba(212,149,106,0.25)', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: canProceedStep1 ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: canProceedStep1 ? 6 : 0 }}>
              <Text className={DYNAPUFF} style={{ color: canProceedStep1 ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16 }}>{canProceedStep1 ? `Nice to meet you, ${name.trim()} 🐰` : 'Enter your name'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      );

      // ── 2: First Habbit ──────────────────────────────────────────────────
      case 2: return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
            <Text className={DYNAPUFF} style={{ fontSize: 26, color: '#e8d5c0', marginBottom: 8, textAlign: 'center' }}>Add your first Habbit</Text>
            <Text className={JUA} style={{ fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 32, textAlign: 'center' }}>What's one thing you want to do every day?</Text>
            <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: habbit.trim().length > 0 ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 20, paddingVertical: 4, marginBottom: 12, width: '100%' }}>
              <TextInput ref={habbitRef} value={habbit} onChangeText={setHabbit} placeholder="e.g. Drink 8 glasses of water" placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={goNext} maxLength={60} style={{ fontFamily: 'Jua', fontSize: 16, color: '#e8d5c0', paddingVertical: 16, textAlign: 'center' }} />
            </View>
            <Text className={JUA} style={{ fontSize: 11, color: 'rgba(212,149,106,0.55)', marginBottom: 28, textAlign: 'center' }}>✦ Don't worry, you can edit your Habbits anytime! ✦</Text>
            <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, marginBottom: 12 }}>
              <Text className={DYNAPUFF} style={{ color: '#fff', fontSize: 16 }}>{habbit.trim().length > 0 ? 'Add Habbit →' : "I'll add one later →"}</Text>
            </TouchableOpacity>
            {habbit.trim().length === 0 && <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.3)', textAlign: 'center' }}>You can skip this and add from the Habbits tab</Text>}
          </View>
        </KeyboardAvoidingView>
      );

      // ── 3: Daily Budget ──────────────────────────────────────────────────
      case 3: return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Image source={IMAGES.carrots} style={{ width: 52, height: 52, marginBottom: 16 }} resizeMode="contain" />
            <Text className={DYNAPUFF} style={{ fontSize: 26, color: '#e8d5c0', marginBottom: 8, textAlign: 'center' }}>Set a daily budget</Text>
            <Text className={JUA} style={{ fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 28, textAlign: 'center' }}>How much do you want to spend each day?</Text>

            {/* Currency picker */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
              {CURRENCIES.map(c => (
                <TouchableOpacity key={c} onPress={() => { haptic.light(); setBudgetCurrency(c); }} activeOpacity={0.7}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: budgetCurrency === c ? '#D4956A' : 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: budgetCurrency === c ? '#D4956A' : 'rgba(212,149,106,0.3)' }}>
                  <Text className={DYNAPUFF} style={{ fontSize: 15, color: budgetCurrency === c ? '#fff' : 'rgba(232,213,192,0.6)' }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount display + input */}
            <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: budgetSet ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 20, paddingVertical: 4, marginBottom: 12, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
              <Text className={DYNAPUFF} style={{ fontSize: 22, color: 'rgba(212,149,106,0.6)' }}>{budgetCurrency}</Text>
              <TextInput
                value={budgetInput}
                onChangeText={v => {
                  // Allow only numbers and a single decimal
                  const clean = v.replace(/[^0-9.]/g, '');
                  const parts = clean.split('.');
                  const formatted = parts.length > 1 ? `${parts[0]}.${parts[1].slice(0, 2)}` : clean;
                  setBudgetInput(formatted);
                }}
                placeholder="0"
                placeholderTextColor="rgba(232,213,192,0.25)"
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={goNext}
                maxLength={8}
                style={{ fontFamily: 'DynaPuff', fontSize: 32, color: budgetSet ? '#e8d5c0' : 'rgba(232,213,192,0.25)', paddingVertical: 18, minWidth: 80, textAlign: 'center' }}
              />
            </View>

            <Text className={JUA} style={{ fontSize: 11, color: 'rgba(212,149,106,0.5)', marginBottom: 28, textAlign: 'center' }}>
              ✦ You can change this anytime in the Finance tab ✦
            </Text>

            <TouchableOpacity onPress={goNext} activeOpacity={0.85}
              style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, marginBottom: 12 }}>
              <Text className={DYNAPUFF} style={{ color: '#fff', fontSize: 16 }}>
                {budgetSet ? `Set budget to ${budgetCurrency}${budgetInput} →` : "I'll set it later →"}
              </Text>
            </TouchableOpacity>

            {!budgetSet && (
              <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.3)', textAlign: 'center' }}>
                We'll start you off at {DEFAULT_CURRENCY}{DEFAULT_BUDGET} — easy to change anytime
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      );

      // ── 4: Tour ──────────────────────────────────────────────────────────
      case 4:
        const TAB_TOUR = [
          { image: IMAGES.home,    name: 'Home',    desc: 'Your daily dashboard — Habbits & finance at a glance' },
          { image: IMAGES.tasks,   name: 'Habbits', desc: 'Add, edit, schedule and manage your daily Habbits' },
          { image: IMAGES.carrots, name: 'Finance', desc: 'Track your daily spending against your budget' },
          { image: IMAGES.bunny,   name: 'Profile', desc: 'Your stats, streak, and app preferences' },
        ];
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
            <Text className={DYNAPUFF} style={{ fontSize: 26, color: '#e8d5c0', marginBottom: 6, textAlign: 'center' }}>You're all set{name.trim() ? `, ${name.trim()}` : ''}!</Text>
            <Text className={JUA} style={{ fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 28, textAlign: 'center' }}>Here's a quick look around:</Text>
            <View style={{ width: '100%', gap: 10, marginBottom: 32 }}>
              {TAB_TOUR.map(tab => (
                <View key={tab.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#5C3D2E', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
                  <Image source={tab.image} style={{ width: 28, height: 28 }} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text className={DYNAPUFF} style={{ fontSize: 14, color: '#e8d5c0', marginBottom: 1 }}>{tab.name}</Text>
                    <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.45)', lineHeight: 16 }}>{tab.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleFinish} activeOpacity={0.85} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}>
              <Text className={DYNAPUFF} style={{ color: '#fff', fontSize: 17 }}>Let's hop to it! 🐰</Text>
            </TouchableOpacity>
          </View>
        );

      default: return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2A1A18' }}>
      <StatusBar barStyle="light-content" backgroundColor="#2A1A18" />
      <Animated.View style={{ flex: 1, opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
        {renderStep()}
      </Animated.View>
    </View>
  );
};

// ─── Profile Screen ───────────────────────────────────────────────────────────

const ProfileScreen = ({ name, avatar, stats, completionHistory, todayKey, midnightNotifEnabled,
  onSetName, onSetAvatar, onResetToday, onDeleteAllData, onToggleMidnightNotif }: {
  name: string; avatar: string; stats: Stats; completionHistory: CompletionRecord[]; todayKey: string;
  midnightNotifEnabled: boolean;
  onSetName: (v: string) => void; onSetAvatar: (v: string) => void;
  onResetToday: () => void; onDeleteAllData: () => void; onToggleMidnightNotif: (v: boolean) => void;
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
    Alert.alert('Delete All Data', 'This will permanently delete everything. The app will restart as if it was never opened. Are you absolutely sure?', [
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

  const StatCard = ({ emoji, label, value, showDaysSuffix = false, accent = false }: {
    emoji: string; label: string; value: number | string; showDaysSuffix?: boolean; accent?: boolean;
  }) => (
    <View style={{ flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: accent ? 'rgba(212,149,106,0.4)' : 'rgba(212,149,106,0.15)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
      <Text style={{ fontSize: 28, marginBottom: 6 }}>{emoji}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
        <Text className={DYNAPUFF} style={{ fontSize: 32, color: accent ? '#D4956A' : '#e8d5c0', lineHeight: 36 }}>{value}</Text>
        {showDaysSuffix && <Text className={JUA} style={{ fontSize: 12, color: accent ? 'rgba(212,149,106,0.7)' : 'rgba(232,213,192,0.5)', marginBottom: 4 }}>days</Text>}
      </View>
      <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.5)', textAlign: 'center', marginTop: 2 }}>{label}</Text>
    </View>
  );

  const ToggleRow = ({ icon, title, subtitle, enabled, onToggle }: { icon: string; title: string; subtitle: string; enabled: boolean; onToggle: () => void }) => (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#5C3D2E', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: enabled ? 'rgba(212,149,106,0.3)' : 'rgba(212,149,106,0.12)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text className={JUA} style={{ fontSize: 13, color: '#e8d5c0' }}>{title}</Text>
          <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.45)', marginTop: 1 }}>{subtitle}</Text>
        </View>
      </View>
      <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: enabled ? '#D4956A' : 'rgba(212,149,106,0.2)', justifyContent: 'center', paddingHorizontal: 3, alignItems: enabled ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }} />
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <TextModal visible={nameModal} title="Edit Name" placeholder="Your name" initialValue={name} onSave={(v) => { onSetName(v); setNameModal(false); }} onClose={() => setNameModal(false)} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: navHeight }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2.5, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 }}>
            <Image source={avatarImage(avatar)} style={{ width: 62, height: 62 }} resizeMode="contain" />
          </View>
          <TouchableOpacity onPress={() => { haptic.light(); setNameModal(true); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text className={DYNAPUFF} style={{ fontSize: 26, color: '#e8d5c0' }}>{name}</Text>
            <View style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}>
              <Text className={JUA} style={{ fontSize: 11, color: '#D4956A' }}>Edit</Text>
            </View>
          </TouchableOpacity>
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
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={IMAGES.carrot} style={{ width: 28, height: 28 }} resizeMode="contain" />
            <View>
              <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.5)', marginBottom: 2 }}>Total Habbits Completed</Text>
              <Text className={DYNAPUFF} style={{ fontSize: 28, color: '#e8d5c0' }}>{stats.totalCompleted}</Text>
            </View>
          </View>
          <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.3)' }}>all time</Text>
        </View>
        {stats.currentStreak === 0 && <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.3)', textAlign: 'center', marginTop: 6, marginBottom: 4 }}>Complete all Habbits today to start your streak! 🔥</Text>}
        <SectionDivider title="✦ Completion History ✦" />
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}>
          {completionHistory.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Image source={IMAGES.bunny} style={{ width: 40, height: 40, marginBottom: 8, opacity: 0.4 }} resizeMode="contain" />
              <Text className={JUA} style={{ fontSize: 12, color: 'rgba(232,213,192,0.4)', textAlign: 'center' }}>Complete all your Habbits for a day{'\n'}to start building your history!</Text>
            </View>
          ) : <CompletionCalendar records={completionHistory} todayKey={todayKey} />}
        </View>
        <SectionDivider title="✦ Notifications ✦" />
        <ToggleRow icon="🌙" title="New Day Reminder" subtitle="Notifies at midnight when your Habbits reset" enabled={midnightNotifEnabled} onToggle={() => { haptic.light(); onToggleMidnightNotif(!midnightNotifEnabled); }} />
        <Text className={JUA} style={{ fontSize: 12, color: 'rgba(232,213,192,0.4)', textAlign: 'center', marginTop: 10, marginBottom: 4 }}>Per-Habbit reminders are set inside each Habbit ✦ tap Edit on any Habbit</Text>
        <SectionDivider title="✦ Danger Zone ✦" />
        <TouchableOpacity onPress={handleReset} activeOpacity={0.8} style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(200,80,60,0.3)', marginBottom: 12 }}>
          <Text className={DYNAPUFF} style={{ color: '#f09090', fontSize: 15 }}>Reset Today's Data</Text>
          <Text className={JUA} style={{ color: 'rgba(240,144,144,0.5)', fontSize: 11, marginTop: 3 }}>Unchecks Habbits · clears spending</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteAll} activeOpacity={0.8} style={{ backgroundColor: 'rgba(180,40,40,0.15)', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(200,60,60,0.5)' }}>
          <Text className={DYNAPUFF} style={{ color: '#ff6b6b', fontSize: 15 }}>Delete All Data</Text>
          <Text className={JUA} style={{ color: 'rgba(255,107,107,0.5)', fontSize: 11, marginTop: 3 }}>Resets app completely · cannot be undone</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
};

// ─── Finance Screen ───────────────────────────────────────────────────────────

const FinanceScreen = ({ spentToday, todayHistory, dailyTotals, allocatedPerDay, currency, onSetAllocated, onSetCurrency, onUndoEntry }: {
  spentToday: number; todayHistory: SpendingEntry[]; dailyTotals: DailyTotal[]; allocatedPerDay: number; currency: string;
  onSetAllocated: (v: number) => void; onSetCurrency: (v: string) => void; onUndoEntry: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const isOverBudget = spentToday > allocatedPerDay;
  const remaining = Math.max(allocatedPerDay - spentToday, 0);
  const budgetPct = Math.min((spentToday / allocatedPerDay) * 100, 100);
  const chartDays = getLast7Days(dailyTotals, spentToday);
  const completedDays = dailyTotals.filter(d => d.total > 0);
  const avgSpend = completedDays.length > 0 ? completedDays.reduce((s, d) => s + d.total, 0) / completedDays.length : null;
  const handleUndoConfirm = (entry: SpendingEntry) => {
    haptic.warning();
    Alert.alert('Undo Entry', `Remove ${currency}${entry.amount.toFixed(2)} added at ${entry.time}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Undo', style: 'destructive', onPress: () => { haptic.error(); onUndoEntry(entry.id); } },
    ]);
  };
  return (
    <>
      <NumpadModal visible={budgetModal} title="Set Daily Budget" hint={`Current budget: ${currency}${allocatedPerDay.toFixed(2)}`} confirmLabel="Set Budget to" amount={budgetInput} currency={currency} onChangeAmount={setBudgetInput} onConfirm={() => { onSetAllocated(parseFloat(budgetInput || '0')); setBudgetInput(''); setBudgetModal(false); }} onClose={() => { setBudgetModal(false); setBudgetInput(''); }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: navHeight }} showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-1">
          <View><Text className={`${JUA} text-cream text-sm opacity-70`}>Track your</Text><Text className={`${DYNAPUFF} text-cream text-2xl`}>Finance</Text></View>
          <View className="w-12 h-12 rounded-full bg-card justify-center items-center" style={{ borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}>
            <Image source={IMAGES.carrots} style={{ width: 28, height: 28 }} resizeMode="contain" />
          </View>
        </View>
        <View className="flex-row items-center gap-x-2 mt-4 mb-1">
          <Text className={`${JUA} text-cream text-xs opacity-50 mr-1`}>Currency</Text>
          {CURRENCIES.map(c => (
            <TouchableOpacity key={c} onPress={() => { haptic.light(); onSetCurrency(c); }} activeOpacity={0.7} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: currency === c ? '#D4956A' : 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: currency === c ? '#D4956A' : 'rgba(212,149,106,0.3)' }}>
              <Text className={JUA} style={{ fontSize: 13, color: currency === c ? '#fff' : 'rgba(232,213,192,0.6)' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SectionDivider title="✦ Today ✦" />
        <TouchableOpacity onPress={() => { haptic.medium(); setBudgetModal(true); }} activeOpacity={0.8} className="bg-card rounded-2xl p-4 mb-3 flex-row items-center justify-between" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
          <View>
            <Text className={`${JUA} text-cream text-xs opacity-60 mb-1`}>Daily Budget</Text>
            <View className="flex-row items-center gap-x-1.5">
              <Image source={IMAGES.carrots} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text className={`${DYNAPUFF} text-cream text-xl`}>{currency}{allocatedPerDay.toFixed(2)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}><Text className={`${JUA} text-xs`} style={{ color: '#D4956A' }}>Edit</Text></View>
        </TouchableOpacity>
        <View className="flex-row gap-x-2.5 mb-3">
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-60 mb-1.5`}>Spent Today</Text>
            <View className="flex-row items-center gap-x-1">
              <Image source={IMAGES.carrot} style={{ width: 20, height: 20 }} resizeMode="contain" />
              <Text className={`${DYNAPUFF} text-lg`} style={{ color: isOverBudget ? '#f09090' : '#e8d5c0' }}>{currency}{spentToday.toFixed(2)}</Text>
            </View>
          </View>
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-60 mb-1.5`}>Remaining</Text>
            <View className="flex-row items-center gap-x-1">
              <Image source={isOverBudget ? IMAGES.carrot : IMAGES.carrots} style={{ width: 20, height: 20 }} resizeMode="contain" />
              <Text className={`${DYNAPUFF} text-lg`} style={{ color: isOverBudget ? '#f09090' : '#9de087' }}>{isOverBudget ? `-${currency}${(spentToday - allocatedPerDay).toFixed(2)}` : `${currency}${remaining.toFixed(2)}`}</Text>
            </View>
          </View>
        </View>
        {/* ── Budget progress bar — thicker and clearly labelled ── */}
        <View className="mb-4">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <Text className={JUA} style={{ fontSize: 12, color: 'rgba(232,213,192,0.55)' }}>Budget used today</Text>
            <Text className={JUA} style={{ fontSize: 12, color: isOverBudget ? '#f09090' : 'rgba(212,149,106,0.8)' }}>{budgetPct.toFixed(0)}%{isOverBudget ? ' — over!' : ' of daily'}</Text>
          </View>
          <View style={{ width: '100%', height: 14, backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
            <View style={{ height: '100%', borderRadius: 8, width: `${budgetPct}%`, backgroundColor: isOverBudget ? '#f09090' : '#D4956A' }} />
          </View>
        </View>
        <SectionDivider title="✦ This Week ✦" />
        <View className="bg-card rounded-2xl p-4 mb-3" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}>
          <WeeklyChart days={chartDays} allocatedPerDay={allocatedPerDay} currency={currency} />
        </View>
        <View className="bg-card rounded-2xl px-4 py-3.5 mb-2 flex-row items-center justify-between" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}>
          <Text className={`${JUA} text-cream text-sm opacity-70`}>Avg daily spend</Text>
          <Text className={`${DYNAPUFF} text-cream text-lg`}>{avgSpend !== null ? `${currency}${avgSpend.toFixed(2)}` : '—'}</Text>
        </View>
        <SectionDivider title="✦ Today's History ✦" />
        {todayHistory.length === 0 ? (
          <View className="items-center py-6">
            <Image source={IMAGES.carrot} style={{ width: 40, height: 40, marginBottom: 8, opacity: 0.4 }} resizeMode="contain" />
            <Text className={`${JUA} text-cream text-sm opacity-40 text-center`}>No spending recorded yet today.</Text>
          </View>
        ) : (
          [...todayHistory].reverse().map(entry => (
            <View key={entry.id} className="bg-card rounded-xl mb-2 flex-row items-center px-4 py-3.5" style={{ borderLeftWidth: 3, borderLeftColor: '#D4956A', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 }}>
              <Image source={IMAGES.carrot} style={{ width: 20, height: 20, marginRight: 10 }} resizeMode="contain" />
              <View className="flex-1">
                <Text className={`${DYNAPUFF} text-cream text-base`}>{currency}{entry.amount.toFixed(2)}</Text>
                <Text className={`${JUA} text-xs opacity-45`} style={{ color: '#e8d5c0' }}>{entry.time}</Text>
              </View>
              <TouchableOpacity onPress={() => handleUndoConfirm(entry)} activeOpacity={0.7} style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)' }}>
                <Text className={`${JUA} text-xs`} style={{ color: '#f09090' }}>Undo</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
};

// ─── Tasks Screen ─────────────────────────────────────────────────────────────

const TasksScreen = ({ commissions, onAdd, onEdit, onDelete }: {
  commissions: Commission[];
  onAdd: (label: string, days: number[], reminderTime: ReminderTime | null) => void;
  onEdit: (id: string, label: string, days: number[], reminderTime: ReminderTime | null) => void;
  onDelete: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Commission | null>(null);
  const openAdd = () => { setEditingItem(null); setModalVisible(true); };
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
        <View className="flex-row items-center justify-between mb-1">
          <View><Text className={`${JUA} text-cream text-sm opacity-70`}>Manage your</Text><Text className={`${DYNAPUFF} text-cream text-2xl`}>Habbits</Text></View>
          <View className="w-12 h-12 rounded-full bg-card justify-center items-center" style={{ borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}>
            <Image source={IMAGES.tasks} style={{ width: 28, height: 28 }} resizeMode="contain" />
          </View>
        </View>
        <SectionDivider title={`✦ ${commissions.length} Habbit${commissions.length !== 1 ? 's' : ''} ✦`} />
        {/* Add button always visible at the top — keeps it in thumb reach */}
        <TouchableOpacity onPress={openAdd} activeOpacity={0.8} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 15, alignItems: 'center', marginBottom: 16, shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}>
          <Text className={`${DYNAPUFF} text-cream text-base`}>+ Add Habbit</Text>
        </TouchableOpacity>
        {commissions.length === 0 && (
          <View className="items-center py-6">
            <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 10, opacity: 0.6 }} resizeMode="contain" />
            <Text className={`${DYNAPUFF} text-cream text-lg mb-2`}>No Habbits yet!</Text>
            <Text className={`${JUA} text-cream text-sm opacity-50 text-center`}>Tap the button above to add{'\n'}your first daily Habbit.</Text>
          </View>
        )}
        {commissions.map(item => (
          <View key={item.id} className="bg-card rounded-xl mb-2.5 overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: '#D4956A', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <View className="flex-row items-center">
              <View className="px-3 py-4 opacity-30"><Text style={{ color: '#D4956A', fontSize: 14 }}>☰</Text></View>
              <View style={{ flex: 1, paddingVertical: 10 }}>
                <Text className={`${JUA} text-cream text-base`} numberOfLines={1}>{item.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  {/* Schedule pill */}
                  <View style={{ backgroundColor: 'rgba(212,149,106,0.18)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
                    <Text className={JUA} style={{ fontSize: 12, color: 'rgba(212,149,106,0.9)' }}>{daysLabel(item.days ?? [])}</Text>
                  </View>
                  {/* Reminder pill — only shown when set */}
                  {item.reminderTime && (
                    <View style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(212,149,106,0.28)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ fontSize: 10 }}>🔔</Text>
                      <Text className={JUA} style={{ fontSize: 12, color: 'rgba(212,149,106,0.8)' }}>{formatTime12(item.reminderTime.hour, item.reminderTime.minute)}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View className="flex-row items-center pr-3 gap-x-1">
                <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.7} style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)' }}><Text className={`${JUA} text-xs`} style={{ color: '#D4956A' }}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} activeOpacity={0.7} style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)' }}><Text className={`${JUA} text-xs`} style={{ color: '#f09090' }}>✕</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
};

// ─── Home Screen ──────────────────────────────────────────────────────────────

const HomeScreen = ({ commissions, setCommissions, spentToday, setSpentToday, todayHistory, setTodayHistory, allocatedPerDay, currency, name, avatar, onGoToTasks, onCommissionComplete, onCommissionUncomplete }: {
  commissions: Commission[]; setCommissions: React.Dispatch<React.SetStateAction<Commission[]>>;
  spentToday: number; setSpentToday: React.Dispatch<React.SetStateAction<number>>;
  todayHistory: SpendingEntry[]; setTodayHistory: React.Dispatch<React.SetStateAction<SpendingEntry[]>>;
  allocatedPerDay: number; currency: string; name: string; avatar: string;
  onGoToTasks: () => void; onCommissionComplete: (id: string) => void; onCommissionUncomplete: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingAmount, setAddingAmount]   = useState('');
  const [modalVisible, setModalVisible]   = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const today    = getFormattedDate();
  const todayKey = getTodayKey();

  const todaysCommissions   = commissions.filter(c => isScheduledForDay(c, today.dow));
  const completedCount      = todaysCommissions.filter(c => c.completed).length;
  const totalCount          = todaysCommissions.length;
  const activeTasks         = todaysCommissions.filter(c => !c.completed);
  const completedTasks      = todaysCommissions.filter(c => c.completed);
  const allDone             = totalCount > 0 && completedCount === totalCount;
  const isOverBudget        = spentToday > allocatedPerDay;
  const budgetPct           = Math.min((spentToday / allocatedPerDay) * 100, 100);
  const hasCommissions      = commissions.length > 0;
  const hasTodayCommissions = todaysCommissions.length > 0;
  const commissionsGood     = allDone && hasTodayCommissions;
  const financeGood         = !isOverBudget;

  const saveFinance = useCallback((amount: number, history: SpendingEntry[]) => {
    AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: amount, date: todayKey, history })).catch(() => {});
  }, [todayKey]);

  const handleConfirm = () => {
    const toAdd = parseFloat(addingAmount || '0');
    if (toAdd <= 0) return;
    const entry: SpendingEntry = { id: generateId(), amount: toAdd, time: formatTime() };
    const newSpent = spentToday + toAdd; const newHistory = [...todayHistory, entry];
    setSpentToday(newSpent); setTodayHistory(newHistory);
    saveFinance(newSpent, newHistory);
    setAddingAmount(''); setModalVisible(false);
  };

  const handleSwipeStart = useCallback(() => setScrollEnabled(false), []);
  const handleSwipeEnd   = useCallback(() => setScrollEnabled(true),  []);

  return (
    <>
      <NumpadModal visible={modalVisible} title="Add to Spent Today" confirmLabel="Add" amount={addingAmount} currency={currency} onChangeAmount={setAddingAmount} onConfirm={handleConfirm} onClose={() => { setModalVisible(false); setAddingAmount(''); }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: navHeight }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEnabled={scrollEnabled}>
        <View className="flex-row items-center gap-x-3.5 mb-6">
          <View className="p-0.5 rounded-full" style={{ borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 6 }}>
            <View className="w-12 h-12 rounded-full bg-card justify-center items-center"><Image source={avatarImage(avatar)} style={{ width: 36, height: 36 }} resizeMode="contain" /></View>
          </View>
          <View><Text className={`${JUA} text-cream text-sm opacity-70`}>Welcome back,</Text><Text className={`${DYNAPUFF} text-cream text-2xl tracking-wide`}>{name}</Text></View>
        </View>
        <Text className={`${JUA} text-accent text-xs tracking-widest mb-2.5 uppercase`}>Today's Performance</Text>
        <View className="bg-card rounded-2xl py-4 px-3.5 flex-row items-center mb-5" style={{ shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}>
          <View className="flex-1">
            <Text className={`${JUA} text-cream text-xs opacity-70`}>{today.dayName}</Text>
            <Text className={`${DYNAPUFF} text-cream text-base leading-tight`}>{today.month} {today.date}</Text>
            <Text className={`${JUA} text-cream text-xs opacity-70`}>{today.year}</Text>
          </View>
          <View className="w-px h-12 bg-accent opacity-30 mx-3" />
          <View className="flex-1 items-center rounded-xl py-2" style={{ backgroundColor: commissionsGood ? 'rgba(100,160,90,0.12)' : 'rgba(212,149,106,0.08)' }}>
            <Text className={`${JUA} text-cream text-xs opacity-75`}>Habbits</Text>
            <Text className={`${DYNAPUFF} text-sm mt-0.5`} style={{ color: commissionsGood ? '#9de087' : '#D4956A' }}>
              {!hasCommissions ? 'Not set' : !hasTodayCommissions ? 'Rest day!' : allDone ? 'Nice one!' : `${completedCount}/${totalCount}`}
            </Text>
            <Image source={commissionsGood ? IMAGES.carrots : IMAGES.carrot} style={{ width: 28, height: 28, marginTop: 4 }} resizeMode="contain" />
          </View>
          <View className="w-px h-12 bg-accent opacity-30 mx-3" />
          <View className="flex-1 items-center rounded-xl py-2" style={{ backgroundColor: financeGood ? 'rgba(100,160,90,0.12)' : 'rgba(200,80,60,0.12)' }}>
            <Text className={`${JUA} text-cream text-xs opacity-75`}>Finance</Text>
            <Text className={`${DYNAPUFF} text-sm mt-0.5`} style={{ color: financeGood ? '#9de087' : '#f09090' }}>{financeGood ? 'On track!' : 'Oh no...'}</Text>
            <Image source={financeGood ? IMAGES.carrots : IMAGES.carrot} style={{ width: 28, height: 28, marginTop: 4 }} resizeMode="contain" />
          </View>
        </View>
        <SectionDivider title="✦ Habbits ✦" />
        {!hasCommissions ? (
          <View className="items-center py-8 px-4">
            <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 12, opacity: 0.7 }} resizeMode="contain" />
            <Text className={`${DYNAPUFF} text-cream text-base mb-2`}>No Habbits set!</Text>
            <Text className={`${JUA} text-cream text-xs opacity-50 text-center mb-5`}>Head over to the Habbits tab to{'\n'}add your daily Habbits.</Text>
            <TouchableOpacity onPress={() => { haptic.light(); onGoToTasks(); }} activeOpacity={0.8} style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 99, paddingVertical: 10, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(212,149,106,0.4)' }}>
              <Text className={`${JUA} text-accent text-sm`}>Go to Habbits →</Text>
            </TouchableOpacity>
          </View>
        ) : !hasTodayCommissions ? (
          <View className="items-center py-8 px-4">
            <Text style={{ fontSize: 44, marginBottom: 12 }}>😴</Text>
            <Text className={`${DYNAPUFF} text-cream text-base mb-2`}>Rest day!</Text>
            <Text className={`${JUA} text-cream text-xs opacity-50 text-center`}>No Habbits scheduled for {today.dayName}.{'\n'}Enjoy your break! 🐰</Text>
          </View>
        ) : (
          <>
            <View className="items-center mb-1">
              <View className="flex-row items-baseline gap-x-1.5">
                <Text className={`${DYNAPUFF} text-4xl`} style={{ color: allDone ? '#9de087' : '#D4956A' }}>{completedCount}</Text>
                <Text className={`${DYNAPUFF} text-cream text-xl opacity-60`}>/{totalCount}</Text>
                <Text className={`${JUA} text-cream text-base opacity-70 ml-1`}>finished</Text>
              </View>
              <View className="w-48 h-1.5 bg-card rounded-full mt-2 mb-1 overflow-hidden">
                <View className="h-full rounded-full" style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%', backgroundColor: allDone ? '#9de087' : '#D4956A' }} />
              </View>
            </View>
            <Text className={`${JUA} text-accent text-sm text-center mb-4 opacity-70`}>{allDone ? '🎉 All done for today!' : 'Swipe right to complete · left to undo'}</Text>
            {activeTasks.map(item => <SwipeableTaskItem key={item.id} item={item} onComplete={onCommissionComplete} onUncomplete={onCommissionUncomplete} onSwipeStart={handleSwipeStart} onSwipeEnd={handleSwipeEnd} />)}
            {completedTasks.length > 0 && (
              <>
                <TouchableOpacity className="items-center mt-1 mb-1 py-2" onPress={() => { haptic.light(); setShowCompleted(v => !v); }}>
                  <Text className={`${JUA} text-accent text-sm opacity-80`}>Completed ({completedTasks.length}) {showCompleted ? '∧' : '›'}</Text>
                </TouchableOpacity>
                {showCompleted && completedTasks.map(item => <SwipeableTaskItem key={item.id} item={item} onComplete={onCommissionComplete} onUncomplete={onCommissionUncomplete} onSwipeStart={handleSwipeStart} onSwipeEnd={handleSwipeEnd} />)}
              </>
            )}
          </>
        )}
        <SectionDivider title="✦ Finance ✦" />
        <View className="flex-row gap-x-2.5 mb-4">
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-70 mb-2`}>Spent Today</Text>
            <View className="flex-row items-center gap-x-1.5">
              <Image source={IMAGES.carrot} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text className={`${DYNAPUFF} text-lg`} style={{ color: isOverBudget ? '#f09090' : '#e8d5c0' }}>{currency}{spentToday.toFixed(2)}</Text>
            </View>
          </View>
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-70 mb-2`}>Allocated a Day</Text>
            <View className="flex-row items-center gap-x-1.5">
              <Image source={IMAGES.carrots} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text className={`${DYNAPUFF} text-cream text-lg`}>{currency}{allocatedPerDay.toFixed(2)}</Text>
            </View>
          </View>
        </View>
        {/* ── Budget progress bar — thicker and clearly labelled ── */}
        <View className="mb-5">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <Text className={JUA} style={{ fontSize: 12, color: 'rgba(232,213,192,0.55)' }}>Budget used today</Text>
            <Text className={JUA} style={{ fontSize: 12, color: isOverBudget ? '#f09090' : 'rgba(212,149,106,0.8)' }}>{budgetPct.toFixed(0)}%{isOverBudget ? ' — over!' : ' of daily'}</Text>
          </View>
          <View style={{ width: '100%', height: 14, backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
            <View style={{ height: '100%', borderRadius: 8, width: `${budgetPct}%`, backgroundColor: isOverBudget ? '#f09090' : '#D4956A' }} />
          </View>
        </View>
        <TouchableOpacity className="rounded-2xl py-4 items-center" style={{ backgroundColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }} onPress={() => { haptic.medium(); setModalVisible(true); }} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={IMAGES.carrot} style={{ width: 20, height: 20 }} resizeMode="contain" />
            <Text className={`${DYNAPUFF} text-cream text-base`}>Add to Spent Today</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [isOnboarded, setIsOnboarded]             = useState<boolean | null>(null);
  const [activeTab, setActiveTab]                 = useState<TabKey>('home');
  const [commissions, setCommissions]             = useState<Commission[]>([]);
  const [spentToday, setSpentToday]               = useState(0);
  const [todayHistory, setTodayHistory]           = useState<SpendingEntry[]>([]);
  const [dailyTotals, setDailyTotals]             = useState<DailyTotal[]>([]);
  const [allocatedPerDay, setAllocatedPerDay]     = useState(DEFAULT_BUDGET);
  const [currency, setCurrency]                   = useState(DEFAULT_CURRENCY);
  const [name, setName]                           = useState('Friend');
  const [avatar, setAvatar]                       = useState(DEFAULT_AVATAR);
  const [stats, setStats]                         = useState<Stats>(defaultStats());
  const [completionHistory, setCompletionHistory] = useState<CompletionRecord[]>([]);
  const [midnightNotifEnabled, setMidnightNotifEnabled] = useState(false);

  const hasLoaded    = useRef(false);
  const todayKey     = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  const saveStats             = useCallback((s: Stats) => AsyncStorage.setItem(STORAGE_STATS, JSON.stringify(s)).catch(() => {}), []);
  const saveCompletionHistory = useCallback((r: CompletionRecord[]) => AsyncStorage.setItem(STORAGE_COMPLETION_HISTORY, JSON.stringify(r)).catch(() => {}), []);

  useEffect(() => {
    const load = async () => {
      try {
        await initNotifications();
        const onboarded = await AsyncStorage.getItem(STORAGE_ONBOARDED);
        if (!onboarded) { setIsOnboarded(false); return; }
        setIsOnboarded(true);
        const storedS = await AsyncStorage.getItem(STORAGE_SETTINGS);
        if (storedS) {
          const s: Settings = JSON.parse(storedS);
          if (s.allocatedPerDay) setAllocatedPerDay(s.allocatedPerDay);
          if (s.currency)        setCurrency(s.currency);
          if (s.name)            setName(s.name);
          if (s.avatar)          setAvatar(s.avatar);
          if (s.midnightNotifEnabled !== undefined) setMidnightNotifEnabled(s.midnightNotifEnabled);
        }
        const storedCH = await AsyncStorage.getItem(STORAGE_COMPLETION_HISTORY);
        let loadedHistory: CompletionRecord[] = storedCH ? JSON.parse(storedCH) : [];
        const storedSt = await AsyncStorage.getItem(STORAGE_STATS);
        let loadedStats = defaultStats();
        if (storedSt) loadedStats = JSON.parse(storedSt);
        const storedH = await AsyncStorage.getItem(STORAGE_FINANCE_HISTORY);
        let existingTotals: DailyTotal[] = storedH ? JSON.parse(storedH).dailyTotals ?? [] : [];
        const storedF = await AsyncStorage.getItem(STORAGE_FINANCE);
        if (storedF) {
          const parsed: FinanceData = JSON.parse(storedF);
          if (parsed.date === todayKey) { setSpentToday(parsed.spentToday); setTodayHistory(parsed.history ?? []); }
          else {
            if (parsed.spentToday > 0) {
              existingTotals = [...existingTotals.filter(t => t.date !== parsed.date), { date: parsed.date, total: parsed.spentToday }].sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
              await AsyncStorage.setItem(STORAGE_FINANCE_HISTORY, JSON.stringify({ dailyTotals: existingTotals }));
            }
            setSpentToday(0); setTodayHistory([]);
            await AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: 0, date: todayKey, history: [] }));
          }
        }
        setDailyTotals(existingTotals);
        const storedC = await AsyncStorage.getItem(STORAGE_COMMISSIONS);
        if (storedC) {
          const parsed: CommissionsData = JSON.parse(storedC);
          const migrated = migrateCommissions(parsed.items);
          if (parsed.date === todayKey) {
            setCommissions(migrated);
          } else {
            const doneCount   = migrated.filter(c => c.completed).length;
            const allWereDone = migrated.length > 0 && migrated.every(c => c.completed);
            if (doneCount > 0) loadedStats = { ...loadedStats, totalCompleted: loadedStats.totalCompleted + doneCount };
            if (migrated.length > 0 && !loadedHistory.some(r => r.date === parsed.date)) {
              loadedHistory = [...loadedHistory, { date: parsed.date, completed: allWereDone }].sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
            }
            if (allWereDone && parsed.date === yesterdayKey) {
              const newStreak = loadedStats.currentStreak + 1;
              loadedStats = { ...loadedStats, currentStreak: newStreak, bestStreak: Math.max(newStreak, loadedStats.bestStreak), lastFullDate: parsed.date };
            } else if (parsed.date < yesterdayKey) {
              loadedStats = { ...loadedStats, currentStreak: 0 };
            }
            const reset = migrated.map(c => ({ ...c, completed: false }));
            setCommissions(reset);
            await AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: reset, date: todayKey }));
          }
        }
        if (loadedStats.lastFullDate && loadedStats.lastFullDate < yesterdayKey) loadedStats = { ...loadedStats, currentStreak: 0 };
        setStats(loadedStats); saveStats(loadedStats);
        setCompletionHistory(loadedHistory); saveCompletionHistory(loadedHistory);
      } catch { setIsOnboarded(true); }
      finally { hasLoaded.current = true; }
    };
    load();
  }, []);

  // ── Onboarding complete ────────────────────────────────────────────────────

  const handleOnboardingComplete = useCallback(async (result: OnboardingResult) => {
    const { name: onboardName, firstHabbit, budget, currency: onboardCurrency } = result;
    setName(onboardName);
    setAllocatedPerDay(budget);
    setCurrency(onboardCurrency);
    await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify({
      allocatedPerDay: budget, currency: onboardCurrency,
      name: onboardName, avatar: DEFAULT_AVATAR, midnightNotifEnabled: false,
    }));
    if (firstHabbit) {
      const initial: Commission[] = [{ id: generateId(), label: firstHabbit, completed: false, days: [], reminderTime: null }];
      setCommissions(initial);
      await AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: initial, date: todayKey }));
    }
    await AsyncStorage.setItem(STORAGE_ONBOARDED, 'true');
    hasLoaded.current = true;
    setIsOnboarded(true);
  }, [todayKey]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: commissions, date: todayKey })).catch(() => {});
  }, [commissions]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    const todayDow = new Date().getDay();
    const todaysScheduled = commissions.filter(c => isScheduledForDay(c, todayDow));
    if (todaysScheduled.length === 0) return;
    const allDone = todaysScheduled.every(c => c.completed);
    if (!allDone || stats.lastFullDate === todayKey) return;
    setStats(prev => {
      if (prev.lastFullDate === todayKey) return prev;
      const newStreak = prev.lastFullDate === yesterdayKey ? prev.currentStreak + 1 : 1;
      const updated = { ...prev, currentStreak: newStreak, bestStreak: Math.max(newStreak, prev.bestStreak), lastFullDate: todayKey };
      saveStats(updated); return updated;
    });
    setCompletionHistory(prev => {
      if (prev.some(r => r.date === todayKey)) return prev;
      const updated = [...prev, { date: todayKey, completed: true }].sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
      saveCompletionHistory(updated); return updated;
    });
  }, [commissions]);

  const saveSettings = useCallback((partial: Partial<Settings>) => {
    AsyncStorage.getItem(STORAGE_SETTINGS).then(s => {
      const current: Settings = s ? JSON.parse(s) : { allocatedPerDay: DEFAULT_BUDGET, currency: DEFAULT_CURRENCY, name: 'Friend', avatar: DEFAULT_AVATAR, midnightNotifEnabled: false };
      AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify({ ...current, ...partial })).catch(() => {});
    });
  }, []);

  const handleSetAllocated = useCallback((v: number) => { setAllocatedPerDay(v); saveSettings({ allocatedPerDay: v }); }, []);
  const handleSetCurrency  = useCallback((v: string) => { setCurrency(v); saveSettings({ currency: v }); }, []);
  const handleSetName      = useCallback((v: string) => { setName(v); saveSettings({ name: v }); }, []);
  const handleSetAvatar    = useCallback((v: string) => { setAvatar(v); saveSettings({ avatar: v }); }, []);

  const handleToggleMidnightNotif = useCallback((enabled: boolean) => {
    setMidnightNotifEnabled(enabled);
    saveSettings({ midnightNotifEnabled: enabled });
    if (enabled) { scheduleMidnightNotif(); } else { cancelMidnightNotif(); }
  }, []);

  const handleCommissionComplete = useCallback((id: string) => {
    setCommissions(p => p.map(c => c.id === id ? { ...c, completed: true } : c));
    setStats(prev => { const updated = { ...prev, totalCompleted: prev.totalCompleted + 1 }; saveStats(updated); return updated; });
  }, []);
  const handleCommissionUncomplete = useCallback((id: string) => {
    setCommissions(p => p.map(c => c.id === id ? { ...c, completed: false } : c));
    setStats(prev => { const updated = { ...prev, totalCompleted: Math.max(prev.totalCompleted - 1, 0) }; saveStats(updated); return updated; });
  }, []);

  const handleAdd = useCallback((label: string, days: number[], reminderTime: ReminderTime | null) => {
    const newItem: Commission = { id: generateId(), label, completed: false, days, reminderTime };
    setCommissions(p => [...p, newItem]);
    scheduleHabitNotifs(newItem);
  }, []);
  const handleEdit = useCallback((id: string, label: string, days: number[], reminderTime: ReminderTime | null) => {
    setCommissions(p => p.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, label, days, reminderTime };
      scheduleHabitNotifs(updated);
      return updated;
    }));
  }, []);
  const handleDelete = useCallback((id: string) => {
    setCommissions(p => p.filter(c => c.id !== id));
    cancelHabitNotifs(id);
  }, []);

  const handleUndoEntry = useCallback((id: string) => {
    setTodayHistory(prev => {
      const entry = prev.find(e => e.id === id);
      if (!entry) return prev;
      const newHistory = prev.filter(e => e.id !== id);
      const newSpent   = Math.max(spentToday - entry.amount, 0);
      setSpentToday(newSpent);
      AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: newSpent, date: todayKey, history: newHistory })).catch(() => {});
      return newHistory;
    });
  }, [spentToday, todayKey]);

  const handleResetToday = useCallback(() => {
    const reset = commissions.map(c => ({ ...c, completed: false }));
    setCommissions(reset);
    AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: reset, date: todayKey })).catch(() => {});
    setSpentToday(0); setTodayHistory([]);
    AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: 0, date: todayKey, history: [] })).catch(() => {});
    setCompletionHistory(prev => { const updated = prev.filter(r => r.date !== todayKey); saveCompletionHistory(updated); return updated; });
    setStats(prev => {
      if (prev.lastFullDate !== todayKey) return prev;
      const updated = { ...prev, currentStreak: Math.max(prev.currentStreak - 1, 0), lastFullDate: yesterdayKey };
      saveStats(updated); return updated;
    });
  }, [commissions, todayKey]);

  const handleDeleteAllData = useCallback(async () => {
    for (const c of commissions) { await cancelHabitNotifs(c.id); }
    await cancelMidnightNotif();
    try { await AsyncStorage.multiRemove(ALL_STORAGE_KEYS); } catch {}
    setIsOnboarded(false); setActiveTab('home'); setCommissions([]);
    setSpentToday(0); setTodayHistory([]); setDailyTotals([]);
    setAllocatedPerDay(DEFAULT_BUDGET); setCurrency(DEFAULT_CURRENCY); setName('Friend');
    setAvatar(DEFAULT_AVATAR); setStats(defaultStats()); setCompletionHistory([]);
    setMidnightNotifEnabled(false);
    hasLoaded.current = false;
  }, [commissions]);

  if (isOnboarded === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#2A1A18', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#2A1A18" />
        <Image source={IMAGES.appLogo} style={{ width: 64, height: 64 }} resizeMode="contain" />
      </View>
    );
  }

  if (!isOnboarded) return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':    return <HomeScreen commissions={commissions} setCommissions={setCommissions} spentToday={spentToday} setSpentToday={setSpentToday} todayHistory={todayHistory} setTodayHistory={setTodayHistory} allocatedPerDay={allocatedPerDay} currency={currency} name={name} avatar={avatar} onGoToTasks={() => setActiveTab('tasks')} onCommissionComplete={handleCommissionComplete} onCommissionUncomplete={handleCommissionUncomplete} />;
      case 'tasks':   return <TasksScreen commissions={commissions} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} />;
      case 'finance': return <FinanceScreen spentToday={spentToday} todayHistory={todayHistory} dailyTotals={dailyTotals} allocatedPerDay={allocatedPerDay} currency={currency} onSetAllocated={handleSetAllocated} onSetCurrency={handleSetCurrency} onUndoEntry={handleUndoEntry} />;
      case 'profile': return <ProfileScreen name={name} avatar={avatar} stats={stats} completionHistory={completionHistory} todayKey={todayKey} midnightNotifEnabled={midnightNotifEnabled} onSetName={handleSetName} onSetAvatar={handleSetAvatar} onResetToday={handleResetToday} onDeleteAllData={handleDeleteAllData} onToggleMidnightNotif={handleToggleMidnightNotif} />;
    }
  };

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-bg" style={{ paddingTop: Platform.OS === 'ios' ? 58 : 28 }}>
        <StatusBar barStyle="light-content" backgroundColor="#3B2220" />
        <View className="flex-1">{renderScreen()}</View>
        <BottomNav active={activeTab} onPress={setActiveTab} />
      </View>
    </SafeAreaProvider>
  );
}