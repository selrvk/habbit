// app.tsx

import "./global.css";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Platform,
  Animated, PanResponder, Modal, TouchableWithoutFeedback,
  TextInput, KeyboardAvoidingView, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const JUA = 'font-jua';
const DYNAPUFF = 'font-dynapuff';

const STORAGE_COMMISSIONS     = '@habbit_rabbit_commissions';
const STORAGE_FINANCE         = '@habbit_rabbit_finance';
const STORAGE_FINANCE_HISTORY = '@habbit_rabbit_finance_history';
const STORAGE_SETTINGS        = '@habbit_rabbit_settings';
const STORAGE_STATS           = '@habbit_rabbit_stats';

const AVATARS = ['🐰','🐹','🐻','🐼','🦊'];

type Commission      = { id: string; label: string; completed: boolean };
type CommissionsData = { items: Commission[]; date: string };
type SpendingEntry   = { id: string; amount: number; time: string };
type FinanceData     = { spentToday: number; date: string; history: SpendingEntry[] };
type DailyTotal      = { date: string; total: number };
type Settings        = { allocatedPerDay: number; currency: string; name: string; avatar: string };
type Stats           = { currentStreak: number; bestStreak: number; totalCompleted: number; lastFullDate: string };
type ChartDay        = { date: string; dayName: string; total: number; isToday: boolean };
type TabKey          = 'home' | 'tasks' | 'finance' | 'profile';

const getTodayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const getYesterdayKey = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const getFormattedDate = () => {
  const d = new Date();
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return { dayName: days[d.getDay()], month: months[d.getMonth()], date: d.getDate(), year: d.getFullYear() };
};
const formatTime = () => {
  const d = new Date(); const h = d.getHours(); const m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const generateId = () => Date.now().toString() + Math.random().toString(36).slice(2, 6);
const applyNumpadKey = (current: string, key: string): string => {
  if (key === '⌫') return current.slice(0, -1);
  if (key === '.') { if (current.includes('.')) return current; return (current === '' ? '0' : current) + '.'; }
  if (current.includes('.')) { const dec = current.split('.')[1]; if (dec && dec.length >= 2) return current; }
  if (current === '0' && key !== '.') return key;
  return current + key;
};
const getLast7Days = (dailyTotals: DailyTotal[], spentToday: number): ChartDay[] => {
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { date: key, dayName: dayNames[d.getDay()], total: i === 6 ? spentToday : (dailyTotals.find(t => t.date === key)?.total ?? 0), isToday: i === 6 };
  });
};
const defaultStats = (): Stats => ({ currentStreak: 0, bestStreak: 0, totalCompleted: 0, lastFullDate: '' });

// ─── Numpad Modal ─────────────────────────────────────────────────────────────

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

const NumpadModal = ({ visible, title, hint, confirmLabel, amount, currency, onChangeAmount, onConfirm, onClose }: {
  visible: boolean; title: string; hint?: string; confirmLabel: string; amount: string; currency: string;
  onChangeAmount: (v: string) => void; onConfirm: () => void; onClose: () => void;
}) => {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: visible ? 1 : 0.88, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: visible ? 1 : 0, duration: visible ? 180 : 140, useNativeDriver: true }),
    ]).start();
  }, [visible]);
  const hasAmount = parseFloat(amount || '0') > 0;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '86%', backgroundColor: '#3B2220', borderRadius: 28, padding: 22, paddingBottom: 18, borderWidth: 1.5, borderColor: 'rgba(212,149,106,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <Text className={`${JUA} text-accent text-xs tracking-widest uppercase`} style={{ opacity: 0.7 }}>{title}</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: hasAmount ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingVertical: 16, paddingHorizontal: 20, marginBottom: hint ? 6 : 18, alignItems: 'center', shadowColor: hasAmount ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text className={DYNAPUFF} style={{ fontSize: 18, color: 'rgba(212,149,106,0.6)' }}>{currency}</Text>
                  <Text className={DYNAPUFF} style={{ fontSize: 42, minWidth: 60, textAlign: 'center', color: hasAmount ? '#e8d5c0' : 'rgba(232,213,192,0.25)' }}>{amount === '' ? '0' : amount}</Text>
                </View>
              </View>
              {hint && <Text className={`${JUA} text-xs text-center mb-4`} style={{ color: 'rgba(232,213,192,0.35)' }}>{hint}</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {NUMPAD_KEYS.map((key) => {
                  const isBack = key === '⌫'; const isDot = key === '.';
                  return (
                    <TouchableOpacity key={key} onPress={() => onChangeAmount(applyNumpadKey(amount, key))} activeOpacity={0.55} style={{ width: '30.5%', paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isBack ? 'rgba(200,80,60,0.12)' : 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: isBack ? 'rgba(200,80,60,0.25)' : 'rgba(212,149,106,0.2)' }}>
                      <Text className={isBack || isDot ? JUA : DYNAPUFF} style={{ fontSize: isBack ? 18 : isDot ? 26 : 22, color: isBack ? '#f09090' : 'rgba(232,213,192,0.85)' }}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity onPress={hasAmount ? onConfirm : undefined} activeOpacity={hasAmount ? 0.8 : 1} style={{ backgroundColor: hasAmount ? '#D4956A' : 'rgba(212,149,106,0.2)', borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: hasAmount ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: hasAmount ? 6 : 0 }}>
                <Text className={DYNAPUFF} style={{ color: hasAmount ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16 }}>{hasAmount ? `${confirmLabel} ${currency}${amount}` : confirmLabel}</Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ─── Text Modal ───────────────────────────────────────────────────────────────

const TextModal = ({ visible, title, placeholder, initialValue, onSave, onClose }: {
  visible: boolean; title: string; placeholder: string; initialValue: string; onSave: (v: string) => void; onClose: () => void;
}) => {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      setText(initialValue);
      Animated.parallel([Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }), Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true })]).start();
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      Animated.parallel([Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, tension: 120, friction: 8 }), Animated.timing(opacityAnim, { toValue: 0, duration: 140, useNativeDriver: true })]).start();
    }
  }, [visible]);
  const canSave = text.trim().length > 0;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '86%', backgroundColor: '#3B2220', borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: 'rgba(212,149,106,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <Text className={`${JUA} text-accent text-xs tracking-widest uppercase`} style={{ opacity: 0.7 }}>{title}</Text>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 16 }}>✕</Text></TouchableOpacity>
                </View>
                <View style={{ backgroundColor: '#5C3D2E', borderRadius: 14, borderWidth: 1.5, borderColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20 }}>
                  <TextInput ref={inputRef} value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={() => canSave && onSave(text.trim())} maxLength={24} style={{ fontFamily: 'Jua', fontSize: 18, color: '#e8d5c0', paddingVertical: 14 }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ flex: 1, backgroundColor: 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text className={`${JUA} text-sm`} style={{ color: 'rgba(232,213,192,0.55)' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={canSave ? () => onSave(text.trim()) : undefined} activeOpacity={canSave ? 0.8 : 1} style={{ flex: 2, backgroundColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: canSave ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: canSave ? 6 : 0 }}>
                    <Text className={DYNAPUFF} style={{ color: canSave ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15 }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Commission Modal ─────────────────────────────────────────────────────────

const CommissionModal = ({ visible, initialValue, onSave, onClose }: {
  visible: boolean; initialValue: string; onSave: (label: string) => void; onClose: () => void;
}) => {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const isEdit = initialValue !== '';
  useEffect(() => {
    if (visible) {
      setText(initialValue);
      Animated.parallel([Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }), Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true })]).start();
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      Animated.parallel([Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, tension: 120, friction: 8 }), Animated.timing(opacityAnim, { toValue: 0, duration: 140, useNativeDriver: true })]).start();
    }
  }, [visible]);
  const canSave = text.trim().length > 0;
  const handleSave = () => { if (!canSave) return; onSave(text.trim()); setText(''); };
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '86%', backgroundColor: '#3B2220', borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: 'rgba(212,149,106,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <Text className={`${JUA} text-accent text-xs tracking-widest uppercase`} style={{ opacity: 0.7 }}>{isEdit ? 'Edit Habbit' : 'New Habbit'}</Text>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 16 }}>✕</Text></TouchableOpacity>
                </View>
                <View style={{ backgroundColor: '#5C3D2E', borderRadius: 14, borderWidth: 1.5, borderColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20 }}>
                  <TextInput ref={inputRef} value={text} onChangeText={setText} placeholder="e.g. Drink 8 glasses of water" placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={handleSave} maxLength={60} style={{ fontFamily: 'Jua', fontSize: 16, color: '#e8d5c0', paddingVertical: 14 }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ flex: 1, backgroundColor: 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text className={`${JUA} text-sm`} style={{ color: 'rgba(232,213,192,0.55)' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={canSave ? handleSave : undefined} activeOpacity={canSave ? 0.8 : 1} style={{ flex: 2, backgroundColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: canSave ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: canSave ? 6 : 0 }}>
                    <Text className={DYNAPUFF} style={{ color: canSave ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15 }}>{isEdit ? 'Save Changes' : 'Add Habbit'}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Weekly Chart ─────────────────────────────────────────────────────────────

const WeeklyChart = ({ days, allocatedPerDay, currency }: { days: ChartDay[]; allocatedPerDay: number; currency: string }) => {
  const CHART_H = 100;
  const maxVal = Math.max(allocatedPerDay, ...days.map(d => d.total), 1);
  const budgetY = CHART_H - (allocatedPerDay / maxVal) * CHART_H;
  return (
    <View>
      <View style={{ height: CHART_H + 4, flexDirection: 'row', alignItems: 'flex-end', position: 'relative' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: budgetY, height: 1, backgroundColor: 'rgba(212,149,106,0.3)' }} />
        <View style={{ position: 'absolute', right: 0, top: budgetY - 10 }}>
          <Text className={JUA} style={{ fontSize: 9, color: 'rgba(212,149,106,0.5)' }}>budget</Text>
        </View>
        {days.map((day) => {
          const barH = day.total > 0 ? Math.max((day.total / maxVal) * CHART_H, 4) : 0;
          const over = day.total > allocatedPerDay;
          return (
            <View key={day.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H }}>
              {day.total > 0 && <Text style={{ fontSize: 8, marginBottom: 2, color: over ? '#f09090' : 'rgba(232,213,192,0.5)', fontFamily: 'Jua' }}>{day.total >= 1000 ? `${(day.total/1000).toFixed(1)}k` : day.total.toFixed(0)}</Text>}
              <View style={{ width: '65%', height: barH, borderRadius: 4, backgroundColor: day.isToday ? (over ? '#f09090' : '#D4956A') : (over ? 'rgba(240,144,144,0.45)' : 'rgba(212,149,106,0.35)') }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {days.map((day) => (
          <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
            <Text className={JUA} style={{ fontSize: 10, color: day.isToday ? '#D4956A' : 'rgba(232,213,192,0.45)' }}>{day.isToday ? 'Today' : day.dayName}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ─── Swipeable Task ───────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 60;

const SwipeableTaskItem = ({ item, onComplete, onUncomplete }: { item: Commission; onComplete: (id: string) => void; onUncomplete: (id: string) => void }) => {
  const translateX    = useRef(new Animated.Value(0)).current;
  const swipeProgress = useRef(new Animated.Value(0)).current;
  const itemRef         = useRef(item);
  const onCompleteRef   = useRef(onComplete);
  const onUncompleteRef = useRef(onUncomplete);
  useEffect(() => { itemRef.current = item; });
  useEffect(() => { onCompleteRef.current = onComplete; });
  useEffect(() => { onUncompleteRef.current = onUncomplete; });
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy * 2) && Math.abs(g.dx) > 5,
    onPanResponderMove: (_, g) => {
      if (itemRef.current.completed) {
        if (g.dx < 0) { translateX.setValue(Math.max(g.dx, -SWIPE_THRESHOLD)); swipeProgress.setValue(Math.abs(Math.max(g.dx, -SWIPE_THRESHOLD)) / SWIPE_THRESHOLD); }
      } else {
        if (g.dx > 0) { translateX.setValue(Math.min(g.dx, SWIPE_THRESHOLD)); swipeProgress.setValue(Math.min(g.dx, SWIPE_THRESHOLD) / SWIPE_THRESHOLD); }
      }
    },
    onPanResponderRelease: (_, g) => {
      const cur = itemRef.current;
      if (!cur.completed && g.dx > SWIPE_THRESHOLD) {
        Animated.sequence([Animated.timing(translateX, { toValue: 120, duration: 150, useNativeDriver: true }), Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true })]).start(() => onCompleteRef.current(cur.id));
        Animated.timing(swipeProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
      } else if (cur.completed && g.dx < -SWIPE_THRESHOLD) {
        Animated.sequence([Animated.timing(translateX, { toValue: -120, duration: 150, useNativeDriver: true }), Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true })]).start(() => onUncompleteRef.current(cur.id));
        Animated.timing(swipeProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
      } else {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }).start();
        Animated.timing(swipeProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      }
    },
  })).current;
  const hintBg = swipeProgress.interpolate({ inputRange: [0, 1], outputRange: [item.completed ? 'rgba(200,80,60,0.0)' : 'rgba(100,180,80,0.0)', item.completed ? 'rgba(200,80,60,0.25)' : 'rgba(100,180,80,0.25)'] });
  return (
    <View className="mb-2.5">
      <Animated.View className="absolute inset-0 rounded-xl flex-row items-center px-4" style={{ backgroundColor: hintBg }}>
        {item.completed ? <Text className={`${JUA} text-xs ml-auto`} style={{ color: '#f09090' }}>✕ undo</Text> : <Text className={`${JUA} text-xs`} style={{ color: '#9de087' }}>✓ done!</Text>}
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }], borderLeftWidth: 3, borderLeftColor: item.completed ? '#6B5040' : '#D4956A', borderRadius: 12, backgroundColor: '#5C3D2E', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: item.completed ? 0.08 : 0.18, shadowRadius: 4, elevation: item.completed ? 1 : 3, opacity: item.completed ? 0.55 : 1 }} {...panResponder.panHandlers}>
        <View className="px-4 py-4 flex-row items-center justify-between">
          <Text className={`${JUA} text-cream text-base flex-1 mr-3`} style={item.completed ? { textDecorationLine: 'line-through' } : {}}>{item.label}</Text>
          <View className="w-5 h-5 rounded-full border-2 items-center justify-center" style={{ borderColor: item.completed ? '#D4956A' : 'rgba(212,149,106,0.5)', backgroundColor: item.completed ? '#D4956A' : 'transparent' }}>
            {item.completed && <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Section Divider ──────────────────────────────────────────────────────────

const SectionDivider = ({ title }: { title: string }) => (
  <View className="flex-row items-center gap-x-2.5 my-5">
    <View className="flex-1 flex-row items-center gap-x-1">
      <View className="w-1 h-1 rounded-full bg-accent opacity-40" />
      <View className="flex-1 h-px bg-accent opacity-25" />
      <View className="w-1.5 h-1.5 rounded-full bg-accent opacity-50" />
    </View>
    <View className="bg-card border border-accent/40 rounded-full px-4 py-1">
      <Text className={`${DYNAPUFF} text-cream text-sm`}>{title}</Text>
    </View>
    <View className="flex-1 flex-row items-center gap-x-1">
      <View className="w-1.5 h-1.5 rounded-full bg-accent opacity-50" />
      <View className="flex-1 h-px bg-accent opacity-25" />
      <View className="w-1 h-1 rounded-full bg-accent opacity-40" />
    </View>
  </View>
);

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

const BottomNav = ({ active, onPress }: { active: TabKey; onPress: (key: TabKey) => void }) => {
  const items: { icon: string; label: string; key: TabKey }[] = [
    { icon: '🏠', label: 'Home', key: 'home' },
    { icon: '📋', label: 'Habbits', key: 'tasks' },
    { icon: '🥕', label: 'Finance', key: 'finance' },
    { icon: '🐰', label: 'Profile', key: 'profile' },
  ];
  return (
    <View className="flex-row bg-card border-t-2 border-accent/30 pt-2.5" style={{ paddingBottom: Platform.OS === 'ios' ? 24 : 12 }}>
      {items.map(({ icon, label, key }) => {
        const isActive = active === key;
        return (
          <TouchableOpacity key={key} className="flex-1 items-center" activeOpacity={0.7} onPress={() => onPress(key)}>
            <View className={`w-10 h-8 rounded-xl justify-center items-center ${isActive ? 'bg-bg' : ''}`}>
              <Text className="text-xl">{icon}</Text>
            </View>
            <Text className={`${JUA} text-xs mt-0.5 ${isActive ? 'text-accent' : 'text-cream opacity-40'}`}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Profile Screen ───────────────────────────────────────────────────────────

const ProfileScreen = ({ name, avatar, stats, onSetName, onSetAvatar, onResetToday }: {
  name: string; avatar: string; stats: Stats;
  onSetName: (v: string) => void; onSetAvatar: (v: string) => void; onResetToday: () => void;
}) => {
  const [nameModal, setNameModal] = useState(false);
  const handleReset = () => Alert.alert("Reset Today's Data", "This will uncheck all of today's Habbits and clear today's spending. Are you sure?", [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: onResetToday }]);
  const StatCard = ({ emoji, label, value, accent = false }: { emoji: string; label: string; value: string; accent?: boolean }) => (
    <View style={{ flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: accent ? 'rgba(212,149,106,0.4)' : 'rgba(212,149,106,0.15)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
      <Text style={{ fontSize: 28, marginBottom: 6 }}>{emoji}</Text>
      <Text className={DYNAPUFF} style={{ fontSize: 28, color: accent ? '#D4956A' : '#e8d5c0', marginBottom: 2 }}>{value}</Text>
      <Text className={JUA} style={{ fontSize: 10, color: 'rgba(232,213,192,0.5)', textAlign: 'center' }}>{label}</Text>
    </View>
  );
  return (
    <>
      <TextModal visible={nameModal} title="Edit Name" placeholder="Your name" initialValue={name} onSave={(v) => { onSetName(v); setNameModal(false); }} onClose={() => setNameModal(false)} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 2.5, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 }}>
            <Text style={{ fontSize: 44 }}>{avatar}</Text>
          </View>
          <TouchableOpacity onPress={() => setNameModal(true)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text className={DYNAPUFF} style={{ fontSize: 26, color: '#e8d5c0' }}>{name}</Text>
            <View style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}>
              <Text className={JUA} style={{ fontSize: 11, color: '#D4956A' }}>Edit</Text>
            </View>
          </TouchableOpacity>
        </View>
        <SectionDivider title="✦ Choose Avatar ✦" />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 4 }}>
          {AVATARS.map(a => (
            <TouchableOpacity key={a} onPress={() => onSetAvatar(a)} activeOpacity={0.7} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: avatar === a ? 'rgba(212,149,106,0.2)' : '#5C3D2E', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: avatar === a ? '#D4956A' : 'rgba(212,149,106,0.15)', shadowColor: avatar === a ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: avatar === a ? 4 : 0 }}>
              <Text style={{ fontSize: 28 }}>{a}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SectionDivider title="✦ Your Stats ✦" />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <StatCard emoji="🔥" label="Current Streak" value={`${stats.currentStreak}d`} accent={stats.currentStreak > 0} />
          <StatCard emoji="⭐" label="Best Streak" value={`${stats.bestStreak}d`} />
        </View>
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 28 }}>🥕</Text>
            <View>
              <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.5)', marginBottom: 2 }}>Total Habbits Completed</Text>
              <Text className={DYNAPUFF} style={{ fontSize: 28, color: '#e8d5c0' }}>{stats.totalCompleted}</Text>
            </View>
          </View>
          <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.3)' }}>all time</Text>
        </View>
        {stats.currentStreak === 0 && <Text className={JUA} style={{ fontSize: 11, color: 'rgba(232,213,192,0.3)', textAlign: 'center', marginTop: 6, marginBottom: 4 }}>Complete all Habbits today to start your streak! 🔥</Text>}
        <SectionDivider title="✦ Danger Zone ✦" />
        <TouchableOpacity onPress={handleReset} activeOpacity={0.8} style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 16, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(200,80,60,0.3)' }}>
          <Text className={DYNAPUFF} style={{ color: '#f09090', fontSize: 15 }}>Reset Today's Data</Text>
          <Text className={JUA} style={{ color: 'rgba(240,144,144,0.5)', fontSize: 11, marginTop: 3 }}>Unchecks Habbits · clears spending</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
};

// ─── Finance Screen ───────────────────────────────────────────────────────────

const CURRENCIES = ['₱','$','€','£','¥'];

const FinanceScreen = ({ spentToday, todayHistory, dailyTotals, allocatedPerDay, currency, onSetAllocated, onSetCurrency, onUndoEntry }: {
  spentToday: number; todayHistory: SpendingEntry[]; dailyTotals: DailyTotal[]; allocatedPerDay: number; currency: string;
  onSetAllocated: (v: number) => void; onSetCurrency: (v: string) => void; onUndoEntry: (id: string) => void;
}) => {
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const isOverBudget = spentToday > allocatedPerDay;
  const remaining = Math.max(allocatedPerDay - spentToday, 0);
  const budgetPct = Math.min((spentToday / allocatedPerDay) * 100, 100);
  const chartDays = getLast7Days(dailyTotals, spentToday);
  const completedDays = dailyTotals.filter(d => d.total > 0);
  const avgSpend = completedDays.length > 0 ? completedDays.reduce((s, d) => s + d.total, 0) / completedDays.length : null;
  const handleUndoConfirm = (entry: SpendingEntry) => Alert.alert('Undo Entry', `Remove ${currency}${entry.amount.toFixed(2)} added at ${entry.time}?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Undo', style: 'destructive', onPress: () => onUndoEntry(entry.id) }]);
  return (
    <>
      <NumpadModal visible={budgetModal} title="Set Daily Budget" hint={`Current budget: ${currency}${allocatedPerDay.toFixed(2)}`} confirmLabel="Set Budget to" amount={budgetInput} currency={currency} onChangeAmount={setBudgetInput} onConfirm={() => { onSetAllocated(parseFloat(budgetInput || '0')); setBudgetInput(''); setBudgetModal(false); }} onClose={() => { setBudgetModal(false); setBudgetInput(''); }} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between mb-1">
          <View><Text className={`${JUA} text-cream text-sm opacity-70`}>Track your</Text><Text className={`${DYNAPUFF} text-cream text-2xl`}>Finance</Text></View>
          <View className="w-12 h-12 rounded-full bg-card justify-center items-center" style={{ borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}><Text className="text-2xl">🥕</Text></View>
        </View>
        <View className="flex-row items-center gap-x-2 mt-4 mb-1">
          <Text className={`${JUA} text-cream text-xs opacity-50 mr-1`}>Currency</Text>
          {CURRENCIES.map(c => (
            <TouchableOpacity key={c} onPress={() => onSetCurrency(c)} activeOpacity={0.7} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: currency === c ? '#D4956A' : 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: currency === c ? '#D4956A' : 'rgba(212,149,106,0.3)' }}>
              <Text className={JUA} style={{ fontSize: 13, color: currency === c ? '#fff' : 'rgba(232,213,192,0.6)' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SectionDivider title="✦ Today ✦" />
        <TouchableOpacity onPress={() => setBudgetModal(true)} activeOpacity={0.8} className="bg-card rounded-2xl p-4 mb-3 flex-row items-center justify-between" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
          <View><Text className={`${JUA} text-cream text-xs opacity-60 mb-1`}>Daily Budget</Text><View className="flex-row items-center gap-x-1.5"><Text className="text-base">🥕</Text><Text className={`${DYNAPUFF} text-cream text-xl`}>{currency}{allocatedPerDay.toFixed(2)}</Text></View></View>
          <View style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}><Text className={`${JUA} text-xs`} style={{ color: '#D4956A' }}>Edit</Text></View>
        </TouchableOpacity>
        <View className="flex-row gap-x-2.5 mb-3">
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-60 mb-1.5`}>Spent Today</Text>
            <View className="flex-row items-center gap-x-1"><Text>🥕</Text><Text className={`${DYNAPUFF} text-lg`} style={{ color: isOverBudget ? '#f09090' : '#e8d5c0' }}>{currency}{spentToday.toFixed(2)}</Text></View>
          </View>
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-60 mb-1.5`}>Remaining</Text>
            <View className="flex-row items-center gap-x-1"><Text>🥕</Text><Text className={`${DYNAPUFF} text-lg`} style={{ color: isOverBudget ? '#f09090' : '#9de087' }}>{isOverBudget ? `-${currency}${(spentToday - allocatedPerDay).toFixed(2)}` : `${currency}${remaining.toFixed(2)}`}</Text></View>
          </View>
        </View>
        <View className="mb-1">
          <View className="w-full h-2 bg-card rounded-full overflow-hidden"><View className="h-full rounded-full" style={{ width: `${budgetPct}%`, backgroundColor: isOverBudget ? '#f09090' : '#D4956A' }} /></View>
          <Text className={`${JUA} text-cream text-xs opacity-40 mt-1 text-right`}>{budgetPct.toFixed(0)}% of daily budget</Text>
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
          <View className="items-center py-6"><Text style={{ fontSize: 36, marginBottom: 8 }}>🥕</Text><Text className={`${JUA} text-cream text-sm opacity-40 text-center`}>No spending recorded yet today.</Text></View>
        ) : (
          [...todayHistory].reverse().map(entry => (
            <View key={entry.id} className="bg-card rounded-xl mb-2 flex-row items-center px-4 py-3.5" style={{ borderLeftWidth: 3, borderLeftColor: '#D4956A', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 2 }}>
              <Text className="text-base mr-2">🥕</Text>
              <View className="flex-1"><Text className={`${DYNAPUFF} text-cream text-base`}>{currency}{entry.amount.toFixed(2)}</Text><Text className={`${JUA} text-xs opacity-45`} style={{ color: '#e8d5c0' }}>{entry.time}</Text></View>
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

const TasksScreen = ({ commissions, onAdd, onEdit, onDelete }: { commissions: Commission[]; onAdd: (l: string) => void; onEdit: (id: string, l: string) => void; onDelete: (id: string) => void }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<Commission | null>(null);
  const openAdd = () => { setEditingItem(null); setModalVisible(true); };
  const openEdit = (item: Commission) => { setEditingItem(item); setModalVisible(true); };
  const closeModal = () => { setModalVisible(false); setEditingItem(null); };
  const handleSave = (label: string) => { editingItem ? onEdit(editingItem.id, label) : onAdd(label); closeModal(); };
  const handleDelete = (item: Commission) => Alert.alert('Remove Habbit', `Remove "${item.label}"?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => onDelete(item.id) }]);
  return (
    <>
      <CommissionModal visible={modalVisible} initialValue={editingItem?.label ?? ''} onSave={handleSave} onClose={closeModal} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between mb-1">
          <View><Text className={`${JUA} text-cream text-sm opacity-70`}>Manage your</Text><Text className={`${DYNAPUFF} text-cream text-2xl`}>Habbits</Text></View>
          <View className="w-12 h-12 rounded-full bg-card justify-center items-center" style={{ borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}><Text className="text-2xl">📋</Text></View>
        </View>
        <SectionDivider title={`✦ ${commissions.length} Habbit${commissions.length !== 1 ? 's' : ''} ✦`} />
        {commissions.length === 0 && (
          <View className="items-center py-10"><Text style={{ fontSize: 48, marginBottom: 12 }}>🐰</Text><Text className={`${DYNAPUFF} text-cream text-lg mb-2`}>No Habbits yet!</Text><Text className={`${JUA} text-cream text-sm opacity-50 text-center`}>Add your first daily Habbit{'\n'}using the button below.</Text></View>
        )}
        {commissions.map(item => (
          <View key={item.id} className="bg-card rounded-xl mb-2.5 flex-row items-center overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: '#D4956A', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <View className="px-3 py-4 opacity-30"><Text style={{ color: '#D4956A', fontSize: 14 }}>☰</Text></View>
            <Text className={`${JUA} text-cream text-base flex-1 py-4`} numberOfLines={1}>{item.label}</Text>
            <View className="flex-row items-center pr-3 gap-x-1">
              <TouchableOpacity onPress={() => openEdit(item)} activeOpacity={0.7} style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)' }}><Text className={`${JUA} text-xs`} style={{ color: '#D4956A' }}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} activeOpacity={0.7} style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)' }}><Text className={`${JUA} text-xs`} style={{ color: '#f09090' }}>✕</Text></TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={openAdd} activeOpacity={0.8} className="rounded-2xl py-4 items-center mt-4" style={{ backgroundColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}>
          <Text className={`${DYNAPUFF} text-cream text-base`}>+ Add Habbit</Text>
        </TouchableOpacity>
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
  const [showCompleted, setShowCompleted] = useState(false);
  const [addingAmount, setAddingAmount] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const today = getFormattedDate();
  const todayKey = getTodayKey();
  const completedCount = commissions.filter(c => c.completed).length;
  const totalCount = commissions.length;
  const activeTasks = commissions.filter(c => !c.completed);
  const completedTasks = commissions.filter(c => c.completed);
  const allDone = totalCount > 0 && completedCount === totalCount;
  const isOverBudget = spentToday > allocatedPerDay;
  const budgetPct = Math.min((spentToday / allocatedPerDay) * 100, 100);
  const hasCommissions = commissions.length > 0;
  const saveFinance = useCallback((amount: number, history: SpendingEntry[]) => {
    AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: amount, date: todayKey, history })).catch(() => {});
  }, [todayKey]);
  const handleConfirm = () => {
    const toAdd = parseFloat(addingAmount || '0');
    if (toAdd <= 0) return;
    const entry: SpendingEntry = { id: generateId(), amount: toAdd, time: formatTime() };
    const newSpent = spentToday + toAdd;
    const newHistory = [...todayHistory, entry];
    setSpentToday(newSpent); setTodayHistory(newHistory);
    saveFinance(newSpent, newHistory);
    setAddingAmount(''); setModalVisible(false);
  };
  return (
    <>
      <NumpadModal visible={modalVisible} title="Add to Spent Today" confirmLabel="Add" amount={addingAmount} currency={currency} onChangeAmount={setAddingAmount} onConfirm={handleConfirm} onClose={() => { setModalVisible(false); setAddingAmount(''); }} />
      <ScrollView className="flex" contentContainerClassName="px-4 pt-3.5 pb-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-x-3.5 mb-6">
          <View className="p-0.5 rounded-full" style={{ borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 6 }}>
            <View className="w-12 h-12 rounded-full bg-card justify-center items-center"><Text className="text-3xl">{avatar}</Text></View>
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
          <View className="flex-1 items-center rounded-xl py-2" style={{ backgroundColor: allDone && hasCommissions ? 'rgba(100,160,90,0.12)' : 'rgba(212,149,106,0.08)' }}>
            <Text className={`${JUA} text-cream text-xs opacity-75`}>Habbits</Text>
            <Text className={`${DYNAPUFF} text-sm mt-0.5`} style={{ color: allDone && hasCommissions ? '#9de087' : '#D4956A' }}>{!hasCommissions ? 'Not set' : allDone ? 'Nice one!' : `${completedCount}/${totalCount}`}</Text>
            <Text className="text-xl mt-1">🥕</Text>
          </View>
          <View className="w-px h-12 bg-accent opacity-30 mx-3" />
          <View className="flex-1 items-center rounded-xl py-2" style={{ backgroundColor: isOverBudget ? 'rgba(200,80,60,0.12)' : 'rgba(100,160,90,0.12)' }}>
            <Text className={`${JUA} text-cream text-xs opacity-75`}>Finance</Text>
            <Text className={`${DYNAPUFF} text-sm mt-0.5`} style={{ color: isOverBudget ? '#f09090' : '#9de087' }}>{isOverBudget ? 'Oh no...' : 'On track!'}</Text>
            <Text className="text-xl mt-1">🥕</Text>
          </View>
        </View>
        <SectionDivider title="✦ Habbits ✦" />
        {!hasCommissions ? (
          <View className="items-center py-8 px-4">
            <Text style={{ fontSize: 44, marginBottom: 12 }}>🐰</Text>
            <Text className={`${DYNAPUFF} text-cream text-base mb-2`}>No Habbits set!</Text>
            <Text className={`${JUA} text-cream text-xs opacity-50 text-center mb-5`}>Head over to the Habbits tab to{'\n'}add your daily Habbits.</Text>
            <TouchableOpacity onPress={onGoToTasks} activeOpacity={0.8} style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 99, paddingVertical: 10, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(212,149,106,0.4)' }}>
              <Text className={`${JUA} text-accent text-sm`}>Go to Habbits →</Text>
            </TouchableOpacity>
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
            <Text className={`${JUA} text-accent text-xs text-center mb-4 opacity-70`}>{allDone ? '🎉 All done for today!' : 'Swipe right to complete · left to undo'}</Text>
            {activeTasks.map(item => <SwipeableTaskItem key={item.id} item={item} onComplete={onCommissionComplete} onUncomplete={onCommissionUncomplete} />)}
            {completedTasks.length > 0 && (
              <>
                <TouchableOpacity className="items-center mt-1 mb-1 py-2" onPress={() => setShowCompleted(v => !v)}>
                  <Text className={`${JUA} text-accent text-sm opacity-80`}>Completed ({completedTasks.length}) {showCompleted ? '∧' : '›'}</Text>
                </TouchableOpacity>
                {showCompleted && completedTasks.map(item => <SwipeableTaskItem key={item.id} item={item} onComplete={onCommissionComplete} onUncomplete={onCommissionUncomplete} />)}
              </>
            )}
          </>
        )}
        <SectionDivider title="✦ Finance ✦" />
        <View className="flex-row gap-x-2.5 mb-4">
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-70 mb-2`}>Spent Today</Text>
            <View className="flex-row items-center gap-x-1.5"><Text className="text-lg">🥕</Text><Text className={`${DYNAPUFF} text-lg`} style={{ color: isOverBudget ? '#f09090' : '#e8d5c0' }}>{currency}{spentToday.toFixed(2)}</Text></View>
          </View>
          <View className="flex-1 bg-card rounded-2xl p-3.5" style={{ borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
            <Text className={`${JUA} text-cream text-xs opacity-70 mb-2`}>Allocated a Day</Text>
            <View className="flex-row items-center gap-x-1.5"><Text className="text-lg">🥕</Text><Text className={`${DYNAPUFF} text-cream text-lg`}>{currency}{allocatedPerDay.toFixed(2)}</Text></View>
          </View>
        </View>
        <View className="mb-5">
          <View className="w-full h-2 bg-card rounded-full overflow-hidden"><View className="h-full rounded-full" style={{ width: `${budgetPct}%`, backgroundColor: isOverBudget ? '#f09090' : '#D4956A' }} /></View>
          <Text className={`${JUA} text-cream text-xs opacity-50 mt-1 text-right`}>{budgetPct.toFixed(0)}% of daily budget</Text>
        </View>
        <TouchableOpacity className="rounded-2xl py-4 items-center" style={{ backgroundColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <Text className={`${DYNAPUFF} text-cream text-base`}>🥕 Add to Spent Today</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab]             = useState<TabKey>('home');
  const [commissions, setCommissions]         = useState<Commission[]>([]);
  const [spentToday, setSpentToday]           = useState(0);
  const [todayHistory, setTodayHistory]       = useState<SpendingEntry[]>([]);
  const [dailyTotals, setDailyTotals]         = useState<DailyTotal[]>([]);
  const [allocatedPerDay, setAllocatedPerDay] = useState(500);
  const [currency, setCurrency]               = useState('₱');
  const [name, setName]                       = useState('Charles');
  const [avatar, setAvatar]                   = useState('🐰');
  const [stats, setStats]                     = useState<Stats>(defaultStats());

  // ── KEY FIX: prevents the persist useEffect from overwriting storage
  //    before the async load has finished reading it ──────────────────────────
  const hasLoaded = useRef(false);

  const todayKey     = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  const saveStats = useCallback((s: Stats) => {
    AsyncStorage.setItem(STORAGE_STATS, JSON.stringify(s)).catch(() => {});
  }, []);

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const storedS = await AsyncStorage.getItem(STORAGE_SETTINGS);
        if (storedS) {
          const s: Settings = JSON.parse(storedS);
          if (s.allocatedPerDay) setAllocatedPerDay(s.allocatedPerDay);
          if (s.currency)        setCurrency(s.currency);
          if (s.name)            setName(s.name);
          if (s.avatar)          setAvatar(s.avatar);
        }
        const storedSt = await AsyncStorage.getItem(STORAGE_STATS);
        let loadedStats = defaultStats();
        if (storedSt) loadedStats = JSON.parse(storedSt);
        const storedH = await AsyncStorage.getItem(STORAGE_FINANCE_HISTORY);
        let existingTotals: DailyTotal[] = storedH ? JSON.parse(storedH).dailyTotals ?? [] : [];
        const storedF = await AsyncStorage.getItem(STORAGE_FINANCE);
        if (storedF) {
          const parsed: FinanceData = JSON.parse(storedF);
          if (parsed.date === todayKey) {
            setSpentToday(parsed.spentToday);
            setTodayHistory(parsed.history ?? []);
          } else {
            if (parsed.spentToday > 0) {
              existingTotals = [...existingTotals.filter(t => t.date !== parsed.date), { date: parsed.date, total: parsed.spentToday }]
                .sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
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
          if (parsed.date === todayKey) {
            setCommissions(parsed.items);
          } else {
            const doneCount = parsed.items.filter(c => c.completed).length;
            if (doneCount > 0) loadedStats = { ...loadedStats, totalCompleted: loadedStats.totalCompleted + doneCount };
            const allWereDone = parsed.items.length > 0 && parsed.items.every(c => c.completed);
            if (allWereDone && parsed.date === yesterdayKey) {
              const newStreak = loadedStats.currentStreak + 1;
              loadedStats = { ...loadedStats, currentStreak: newStreak, bestStreak: Math.max(newStreak, loadedStats.bestStreak), lastFullDate: parsed.date };
            } else if (parsed.date < yesterdayKey) {
              loadedStats = { ...loadedStats, currentStreak: 0 };
            }
            const reset = parsed.items.map(c => ({ ...c, completed: false }));
            setCommissions(reset);
            await AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: reset, date: todayKey }));
          }
        }
        if (loadedStats.lastFullDate && loadedStats.lastFullDate < yesterdayKey) {
          loadedStats = { ...loadedStats, currentStreak: 0 };
        }
        setStats(loadedStats);
        saveStats(loadedStats);
      } catch {
        // fail silently
      } finally {
        // ── Mark load as complete so the persist effect can now safely run ──
        hasLoaded.current = true;
      }
    };
    load();
  }, []);

  // ── Persist commissions — guarded by hasLoaded so it never fires before
  //    the initial load finishes, preventing empty [] from overwriting data ───
  useEffect(() => {
    if (!hasLoaded.current) return;
    AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: commissions, date: todayKey })).catch(() => {});
  }, [commissions]);

  // ── Streak: fires when all commissions become completed ───────────────────

  useEffect(() => {
    if (!hasLoaded.current) return;
    if (commissions.length === 0) return;
    const allDone = commissions.every(c => c.completed);
    if (!allDone) return;
    if (stats.lastFullDate === todayKey) return;
    setStats(prev => {
      if (prev.lastFullDate === todayKey) return prev;
      const newStreak = prev.lastFullDate === yesterdayKey ? prev.currentStreak + 1 : 1;
      const newBest   = Math.max(newStreak, prev.bestStreak);
      const updated   = { ...prev, currentStreak: newStreak, bestStreak: newBest, lastFullDate: todayKey };
      saveStats(updated);
      return updated;
    });
  }, [commissions]);

  const saveSettings = useCallback((partial: Partial<Settings>) => {
    AsyncStorage.getItem(STORAGE_SETTINGS).then(s => {
      const current: Settings = s ? JSON.parse(s) : { allocatedPerDay: 500, currency: '₱', name: 'Charles', avatar: '🐰' };
      AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify({ ...current, ...partial })).catch(() => {});
    });
  }, []);

  const handleSetAllocated = useCallback((v: number) => { setAllocatedPerDay(v); saveSettings({ allocatedPerDay: v }); }, []);
  const handleSetCurrency  = useCallback((v: string) => { setCurrency(v); saveSettings({ currency: v }); }, []);
  const handleSetName      = useCallback((v: string) => { setName(v); saveSettings({ name: v }); }, []);
  const handleSetAvatar    = useCallback((v: string) => { setAvatar(v); saveSettings({ avatar: v }); }, []);

  const handleCommissionComplete = useCallback((id: string) => {
    setCommissions(p => p.map(c => c.id === id ? { ...c, completed: true } : c));
    setStats(prev => { const updated = { ...prev, totalCompleted: prev.totalCompleted + 1 }; saveStats(updated); return updated; });
  }, []);

  const handleCommissionUncomplete = useCallback((id: string) => {
    setCommissions(p => p.map(c => c.id === id ? { ...c, completed: false } : c));
    setStats(prev => { const updated = { ...prev, totalCompleted: Math.max(prev.totalCompleted - 1, 0) }; saveStats(updated); return updated; });
  }, []);

  const handleAdd    = useCallback((label: string) => setCommissions(p => [...p, { id: generateId(), label, completed: false }]), []);
  const handleEdit   = useCallback((id: string, label: string) => setCommissions(p => p.map(c => c.id === id ? { ...c, label } : c)), []);
  const handleDelete = useCallback((id: string) => setCommissions(p => p.filter(c => c.id !== id)), []);

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
    setStats(prev => {
      if (prev.lastFullDate !== todayKey) return prev;
      const updated = { ...prev, currentStreak: Math.max(prev.currentStreak - 1, 0), lastFullDate: yesterdayKey };
      saveStats(updated); return updated;
    });
  }, [commissions, todayKey]);

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen commissions={commissions} setCommissions={setCommissions} spentToday={spentToday} setSpentToday={setSpentToday} todayHistory={todayHistory} setTodayHistory={setTodayHistory} allocatedPerDay={allocatedPerDay} currency={currency} name={name} avatar={avatar} onGoToTasks={() => setActiveTab('tasks')} onCommissionComplete={handleCommissionComplete} onCommissionUncomplete={handleCommissionUncomplete} />;
      case 'tasks':
        return <TasksScreen commissions={commissions} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} />;
      case 'finance':
        return <FinanceScreen spentToday={spentToday} todayHistory={todayHistory} dailyTotals={dailyTotals} allocatedPerDay={allocatedPerDay} currency={currency} onSetAllocated={handleSetAllocated} onSetCurrency={handleSetCurrency} onUndoEntry={handleUndoEntry} />;
      case 'profile':
        return <ProfileScreen name={name} avatar={avatar} stats={stats} onSetName={handleSetName} onSetAvatar={handleSetAvatar} onResetToday={handleResetToday} />;
    }
  };

  return (
    <View className="flex-1 bg-bg pt-10">
      <StatusBar barStyle="light-content" backgroundColor="#3B2220" />
      <View className="flex-1">{renderScreen()}</View>
      <BottomNav active={activeTab} onPress={setActiveTab} />
    </View>
  );
}