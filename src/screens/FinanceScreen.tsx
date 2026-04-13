import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, Animated, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES, CURRENCIES } from '../constants';
import { getLast7Days } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { SectionDivider } from '../components/SectionDivider';
import { NumpadModal } from '../components/NumpadModal';
import { WeeklyChart } from '../components/WeeklyChart';
import type { SpendingEntry, DailyTotal, ChartDay } from '../types';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
};

export const FinanceScreen = ({ spentToday, todayHistory, dailyTotals, allocatedPerDay, currency, onSetAllocated, onSetCurrency, onUndoEntry }: {
  spentToday: number; todayHistory: SpendingEntry[]; dailyTotals: DailyTotal[];
  allocatedPerDay: number; currency: string;
  onSetAllocated: (v: number) => void; onSetCurrency: (v: string) => void; onUndoEntry: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [selectedDay, setSelectedDay] = useState<ChartDay | null>(null);

  const isOverBudget  = spentToday > allocatedPerDay;
  const remaining     = Math.max(allocatedPerDay - spentToday, 0);
  const budgetPct     = Math.min((spentToday / allocatedPerDay) * 100, 100);
  const chartDays     = getLast7Days(dailyTotals, spentToday);
  const completedDays = dailyTotals.filter(d => d.total > 0);
  const avgSpend      = completedDays.length > 0 ? completedDays.reduce((s, d) => s + d.total, 0) / completedDays.length : null;

  // Resolve entries for the tapped day — today uses live todayHistory, past days use stored entries
  const selectedEntries: SpendingEntry[] = selectedDay
    ? selectedDay.isToday
      ? todayHistory
      : (dailyTotals.find(d => d.date === selectedDay.date)?.entries ?? [])
    : [];

  const handleDayPress = (day: ChartDay) => {
    haptic.light();
    setSelectedDay(day);
  };

  const handleUndoConfirm = (entry: SpendingEntry) => {
    haptic.warning();
    Alert.alert('Undo Entry', `Remove ${currency}${entry.amount.toFixed(2)} added at ${entry.time}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Undo', style: 'destructive', onPress: () => { haptic.error(); onUndoEntry(entry.id); } },
    ]);
  };

  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  const sheetPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) sheetTranslateY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        Animated.timing(sheetTranslateY, { toValue: 600, duration: 220, useNativeDriver: true }).start(() => {
          setSelectedDay(null);
          sheetTranslateY.setValue(0);
        });
      } else {
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
    },
  })).current;

  const closeSheet = () => {
    sheetTranslateY.setValue(0);
    setSelectedDay(null);
  };

  return (
    <>
      <NumpadModal visible={budgetModal} title="Set Daily Budget" hint={`Current budget: ${currency}${allocatedPerDay.toFixed(2)}`} confirmLabel="Set Budget to" amount={budgetInput} currency={currency} onChangeAmount={setBudgetInput}
        onConfirm={() => { onSetAllocated(parseFloat(budgetInput || '0')); setBudgetInput(''); setBudgetModal(false); }}
        onClose={() => { setBudgetModal(false); setBudgetInput(''); }} />

      {/* Day history modal */}
      <Modal visible={selectedDay !== null} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'flex-end' }}>

          {/* Backdrop tap to close */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setSelectedDay(null)}
          />

          {/* Sheet — plain View, not TouchableOpacity, so scroll works */}
          <Animated.View style={{ backgroundColor: '#3B2220', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 32, borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(212,149,106,0.35)', maxHeight: '75%' }}>
          <View {...sheetPanResponder.panHandlers} style={{ paddingBottom: 12, marginTop: -10, alignItems: 'center' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(212,149,106,0.3)', alignSelf: 'center', marginBottom: 18 }} />
          </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 16 }}>
                  {selectedDay?.isToday ? 'Today' : selectedDay?.dayName}
                </Text>
                <Text style={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.7)', fontSize: 12, marginTop: 2 }}>
                  {currency}{selectedDay?.total.toFixed(2)} spent
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedDay(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {selectedEntries.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.4 }}>No entry details recorded.</Text>
                </View>
              ) : (
                [...selectedEntries].reverse().map(entry => (
                  <View key={entry.id} style={{ backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderLeftWidth: 3, borderLeftColor: '#D4956A' }}>
                    <Image source={IMAGES.carrot} style={{ width: 18, height: 18, marginRight: 10 }} resizeMode="contain" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 15 }}>{currency}{entry.amount.toFixed(2)}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: 11, color: '#e8d5c0', opacity: 0.45, marginTop: 1 }}>{entry.time}</Text>
                      {entry.note ? <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.75)', marginTop: 3 }}>{entry.note}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

          </Animated.View>
          
        </View>
      </Modal>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: navHeight }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <View>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.7 }}>Track your</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 24 }}>Finance</Text>
          </View>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 }}>
            <Image source={IMAGES.carrots} style={{ width: 28, height: 28 }} resizeMode="contain" />
          </View>
        </View>

        {/* Currency picker */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 4 }}>
          <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 12, opacity: 0.5, marginRight: 4 }}>Currency</Text>
          {CURRENCIES.map(c => (
            <TouchableOpacity key={c} onPress={() => { haptic.light(); onSetCurrency(c); }} activeOpacity={0.7}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: currency === c ? '#D4956A' : 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: currency === c ? '#D4956A' : 'rgba(212,149,106,0.3)' }}>
              <Text style={{ fontFamily: 'Jua', fontSize: 13, color: currency === c ? '#fff' : 'rgba(232,213,192,0.6)' }}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionDivider title="✦ Today ✦" />

        {/* Budget card */}
        <TouchableOpacity onPress={() => { haptic.medium(); setBudgetModal(true); }} activeOpacity={0.8}
          style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 }}>
          <View>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Daily Budget</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image source={IMAGES.carrots} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 20 }}>{currency}{allocatedPerDay.toFixed(2)}</Text>
            </View>
          </View>
          <View style={{ backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.3)' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#D4956A' }}>Edit</Text>
          </View>
        </TouchableOpacity>

        {/* Spent / Remaining */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <View style={{ flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)' }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Spent Today</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Image source={IMAGES.carrot} style={{ width: 20, height: 20 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', fontSize: 18, color: isOverBudget ? '#f09090' : '#e8d5c0' }}>{currency}{spentToday.toFixed(2)}</Text>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)' }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Remaining</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Image source={isOverBudget ? IMAGES.carrot : IMAGES.carrots} style={{ width: 20, height: 20 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', fontSize: 18, color: isOverBudget ? '#f09090' : '#9de087' }}>{isOverBudget ? `-${currency}${(spentToday - allocatedPerDay).toFixed(2)}` : `${currency}${remaining.toFixed(2)}`}</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(232,213,192,0.55)' }}>Budget used today</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: 12, color: isOverBudget ? '#f09090' : 'rgba(212,149,106,0.8)' }}>{budgetPct.toFixed(0)}%{isOverBudget ? ' — over!' : ' of daily'}</Text>
          </View>
          <View style={{ width: '100%', height: 14, backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
            <View style={{ height: '100%', borderRadius: 8, width: `${budgetPct}%`, backgroundColor: isOverBudget ? '#f09090' : '#D4956A' }} />
          </View>
        </View>

        <SectionDivider title="✦ This Week ✦" />
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
          <WeeklyChart days={chartDays} allocatedPerDay={allocatedPerDay} currency={currency} onDayPress={handleDayPress} />
          <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(212,149,106,0.4)', textAlign: 'center', marginTop: 10 }}>Tap a bar to see details</Text>
        </View>
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
          <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.7 }}>Avg daily spend</Text>
          <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 18 }}>{avgSpend !== null ? `${currency}${avgSpend.toFixed(2)}` : '—'}</Text>
        </View>

        <SectionDivider title="✦ Today's History ✦" />
        {todayHistory.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Image source={IMAGES.carrot} style={{ width: 40, height: 40, marginBottom: 8, opacity: 0.4 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.4, textAlign: 'center' }}>No spending recorded yet today.</Text>
          </View>
        ) : (
          [...todayHistory].reverse().map(entry => (
            <View key={entry.id} style={{ backgroundColor: '#5C3D2E', borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderLeftWidth: 3, borderLeftColor: '#D4956A' }}>
              <Image source={IMAGES.carrot} style={{ width: 20, height: 20, marginRight: 10 }} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 16 }}>{currency}{entry.amount.toFixed(2)}</Text>
                <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#e8d5c0', opacity: 0.45 }}>{entry.time}</Text>
                {entry.note ? <Text style={{ fontFamily: 'Jua', fontSize: 12, color: 'rgba(212,149,106,0.75)', marginTop: 2 }}>{entry.note}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => handleUndoConfirm(entry)} activeOpacity={0.7}
                style={{ backgroundColor: 'rgba(200,80,60,0.1)', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(200,80,60,0.25)' }}>
                <Text style={{ fontFamily: 'Jua', fontSize: 12, color: '#f09090' }}>Undo</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
};