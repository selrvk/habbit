import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { getFormattedDate, getTodayKey, generateId, formatTime, isScheduledForDay } from '../helpers';
import { STORAGE_FINANCE } from '../storage';
import { useNavHeight } from '../hooks/useNavHeight';
import { SectionDivider } from '../components/SectionDivider';
import { NumpadModal } from '../components/NumpadModal';
import { SwipeableTaskItem } from '../components/SwipeableTaskItem';
import { avatarImage } from '../helpers';
import type { Commission, SpendingEntry } from '../types';
import { useFontSize } from '../hooks/useFontSize';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:  () => ReactNativeHapticFeedback.trigger('impactLight',  HAPTIC_OPTIONS),
  medium: () => ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS),
};

export const HomeScreen = ({ commissions, setCommissions, spentToday, setSpentToday, todayHistory, setTodayHistory, allocatedPerDay, currency, name, avatar, onGoToTasks, onCommissionComplete, onCommissionUncomplete }: {
  commissions: Commission[]; setCommissions: React.Dispatch<React.SetStateAction<Commission[]>>;
  spentToday: number; setSpentToday: React.Dispatch<React.SetStateAction<number>>;
  todayHistory: SpendingEntry[]; setTodayHistory: React.Dispatch<React.SetStateAction<SpendingEntry[]>>;
  allocatedPerDay: number; currency: string; name: string; avatar: string;
  onGoToTasks: () => void; onCommissionComplete: (id: string) => void; onCommissionUncomplete: (id: string) => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();
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
    const newSpent = spentToday + toAdd;
    const newHistory = [...todayHistory, entry];
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

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <View style={{ padding: 2, borderRadius: 99, borderWidth: 2, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 6 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center' }}>
              <Image source={avatarImage(avatar)} style={{ width: 36, height: 36 }} resizeMode="contain" />
            </View>
          </View>
          <View>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, opacity: 0.7 }}>Welcome back,</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 24 }}>{name}</Text>
          </View>
        </View>

        {/* Today's Performance */}
        <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: fs(12), letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Today's Performance</Text>
        <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 20, shadowColor: '#1a0a08', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.7 }}>{today.dayName}</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(16), lineHeight: fs(20) }}>{today.month} {today.date}</Text>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.7 }}>{today.year}</Text>
          </View>
          <View style={{ width: 1, height: 48, backgroundColor: '#D4956A', opacity: 0.3, marginHorizontal: 12 }} />
          <View style={{ flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 8, backgroundColor: commissionsGood ? 'rgba(100,160,90,0.12)' : 'rgba(212,149,106,0.08)' }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.75 }}>Habbits</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), marginTop: 2, color: commissionsGood ? '#9de087' : '#D4956A' }}>
              {!hasCommissions ? 'Not set' : !hasTodayCommissions ? 'Rest day!' : allDone ? 'Nice one!' : `${completedCount}/${totalCount}`}
            </Text>
            <Image source={commissionsGood ? IMAGES.carrots : IMAGES.carrot} style={{ width: 28, height: 28, marginTop: 4 }} resizeMode="contain" />
          </View>
          <View style={{ width: 1, height: 48, backgroundColor: '#D4956A', opacity: 0.3, marginHorizontal: 12 }} />
          <View style={{ flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 8, backgroundColor: financeGood ? 'rgba(100,160,90,0.12)' : 'rgba(200,80,60,0.12)' }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.75 }}>Finance</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), marginTop: 2, color: financeGood ? '#9de087' : '#f09090' }}>{financeGood ? 'On track!' : 'Oh no...'}</Text>
            <Image source={financeGood ? IMAGES.carrots : IMAGES.carrot} style={{ width: 28, height: 28, marginTop: 4 }} resizeMode="contain" />
          </View>
        </View>

        {/* Habbits */}
        <SectionDivider title="✦ Habbits ✦" />
        {!hasCommissions ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
            <Image source={IMAGES.bunny} style={{ width: 52, height: 52, marginBottom: 12, opacity: 0.7 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(16), marginBottom: 8 }}>No Habbits set!</Text>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.5, textAlign: 'center', marginBottom: 20 }}>Head over to the Habbits tab to{'\n'}add your daily Habbits.</Text>
            <TouchableOpacity onPress={() => { haptic.light(); onGoToTasks(); }} activeOpacity={0.8}
              style={{ backgroundColor: 'rgba(212,149,106,0.15)', borderRadius: 99, paddingVertical: 10, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(212,149,106,0.4)' }}>
              <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: fs(14) }}>Go to Habbits →</Text>
            </TouchableOpacity>
          </View>
        ) : !hasTodayCommissions ? (
          <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 }}>
            <Text style={{ fontSize: fs(44), marginBottom: 12 }}>😴</Text>
            <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(16), marginBottom: 8 }}>Rest day!</Text>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.5, textAlign: 'center' }}>No Habbits scheduled for {today.dayName}.{'\n'}Enjoy your break! 🐰</Text>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(36), color: allDone ? '#9de087' : '#D4956A' }}>{completedCount}</Text>
                <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(20), opacity: 0.6, marginBottom: 2 }}>/{totalCount}</Text>
                <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(16), opacity: 0.7, marginBottom: 2, marginLeft: 4 }}>finished</Text>
              </View>
              <View style={{ width: 192, height: 6, backgroundColor: '#5C3D2E', borderRadius: 99, marginTop: 8, marginBottom: 4, overflow: 'hidden' }}>
                <View style={{ height: '100%', borderRadius: 99, width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%', backgroundColor: allDone ? '#9de087' : '#D4956A' }} />
              </View>
            </View>
            <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: fs(14), textAlign: 'center', marginBottom: 16, opacity: 0.7 }}>{allDone ? '🎉 All done for today!' : 'Swipe right to complete · left to undo'}</Text>
            {activeTasks.map(item => <SwipeableTaskItem key={item.id} item={item} onComplete={onCommissionComplete} onUncomplete={onCommissionUncomplete} onSwipeStart={handleSwipeStart} onSwipeEnd={handleSwipeEnd} />)}
            {completedTasks.length > 0 && (
              <>
                <TouchableOpacity style={{ alignItems: 'center', marginTop: 4, marginBottom: 4, paddingVertical: 8 }} onPress={() => { haptic.light(); setShowCompleted(v => !v); }}>
                  <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: fs(14), opacity: 0.8 }}>Completed ({completedTasks.length}) {showCompleted ? '∧' : '›'}</Text>
                </TouchableOpacity>
                {showCompleted && completedTasks.map(item => <SwipeableTaskItem key={item.id} item={item} onComplete={onCommissionComplete} onUncomplete={onCommissionUncomplete} onSwipeStart={handleSwipeStart} onSwipeEnd={handleSwipeEnd} />)}
              </>
            )}
          </>
        )}

        {/* Finance summary */}
        <SectionDivider title="✦ Finance ✦" />
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)' }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.7, marginBottom: 8 }}>Spent Today</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image source={IMAGES.carrot} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(18), color: isOverBudget ? '#f09090' : '#e8d5c0' }}>{currency}{spentToday.toFixed(2)}</Text>
            </View>
          </View>
          <View style={{ flex: 1, backgroundColor: '#5C3D2E', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)' }}>
            <Text style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: fs(12), opacity: 0.7, marginBottom: 8 }}>Allocated a Day</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image source={IMAGES.carrots} style={{ width: 22, height: 22 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: fs(18) }}>{currency}{allocatedPerDay.toFixed(2)}</Text>
            </View>
          </View>
        </View>
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.55)' }}>Budget used today</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: isOverBudget ? '#f09090' : 'rgba(212,149,106,0.8)' }}>{budgetPct.toFixed(0)}%{isOverBudget ? ' — over!' : ' of daily'}</Text>
          </View>
          <View style={{ width: '100%', height: 14, backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
            <View style={{ height: '100%', borderRadius: 8, width: `${budgetPct}%`, backgroundColor: isOverBudget ? '#f09090' : '#D4956A' }} />
          </View>
        </View>
        <TouchableOpacity style={{ backgroundColor: '#D4956A', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 }}
          onPress={() => { haptic.medium(); setModalVisible(true); }} activeOpacity={0.8}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image source={IMAGES.carrot} style={{ width: 20, height: 20 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(16) }}>Add to Spent Today</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
};