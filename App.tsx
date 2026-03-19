// app.tsx

import "./global.css";

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Animated,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const JUA = 'font-jua';
const DYNAPUFF = 'font-dynapuff';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = '@habbit_rabbit_commissions';

const DEFAULT_COMMISSIONS = [
  { id: '1', label: 'Fix bed' },
  { id: '2', label: 'Exercise' },
  { id: '3', label: 'Read 10 pages' },
  { id: '4', label: 'Drink 8 glasses of water' },
  { id: '5', label: 'Meditate' },
  { id: '6', label: 'No junk food' },
  { id: '7', label: 'Sleep before midnight' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Commission = {
  id: string;
  label: string;
  completed: boolean;
};

// ─── Swipeable Task Item ──────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 80;

const SwipeableTaskItem = ({
  item,
  onComplete,
  onUncomplete,
}: {
  item: Commission;
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeProgress = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 2) && Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (item.completed) {
          if (gestureState.dx < 0) {
            translateX.setValue(Math.max(gestureState.dx, -SWIPE_THRESHOLD));
            swipeProgress.setValue(Math.abs(Math.max(gestureState.dx, -SWIPE_THRESHOLD)) / SWIPE_THRESHOLD);
          }
        } else {
          if (gestureState.dx > 0) {
            translateX.setValue(Math.min(gestureState.dx, SWIPE_THRESHOLD));
            swipeProgress.setValue(Math.min(gestureState.dx, SWIPE_THRESHOLD) / SWIPE_THRESHOLD);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!item.completed && gestureState.dx > SWIPE_THRESHOLD) {
          Animated.sequence([
            Animated.timing(translateX, { toValue: 120, duration: 150, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => onComplete(item.id));
          Animated.timing(swipeProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
        } else if (item.completed && gestureState.dx < -SWIPE_THRESHOLD) {
          Animated.sequence([
            Animated.timing(translateX, { toValue: -120, duration: 150, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => onUncomplete(item.id));
          Animated.timing(swipeProgress, { toValue: 0, duration: 350, useNativeDriver: false }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }).start();
          Animated.timing(swipeProgress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const hintBg = swipeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [
      item.completed ? 'rgba(200,80,60,0.0)' : 'rgba(100,180,80,0.0)',
      item.completed ? 'rgba(200,80,60,0.25)' : 'rgba(100,180,80,0.25)',
    ],
  });

  return (
    <View className="mb-2.5">
      {/* Background hint */}
      <Animated.View
        className="absolute inset-0 rounded-xl flex-row items-center px-4"
        style={{ backgroundColor: hintBg }}
      >
        {item.completed ? (
          <Text className={`${JUA} text-xs ml-auto`} style={{ color: '#f09090' }}>✕ undo</Text>
        ) : (
          <Text className={`${JUA} text-xs`} style={{ color: '#9de087' }}>✓ done!</Text>
        )}
      </Animated.View>

      {/* Card */}
      <Animated.View
        style={{
          transform: [{ translateX }],
          borderLeftWidth: 3,
          borderLeftColor: item.completed ? '#6B5040' : '#D4956A',
          borderRadius: 12,
          backgroundColor: '#5C3D2E',
          shadowColor: '#1a0a08',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: item.completed ? 0.08 : 0.18,
          shadowRadius: 4,
          elevation: item.completed ? 1 : 3,
          opacity: item.completed ? 0.55 : 1,
        }}
        {...panResponder.panHandlers}
      >
        <View className="px-4 py-4 flex-row items-center justify-between">
          <Text
            className={`${JUA} text-cream text-base flex-1 mr-3`}
            style={item.completed ? { textDecorationLine: 'line-through' } : {}}
          >
            {item.label}
          </Text>
          <View
            className="w-5 h-5 rounded-full border-2 items-center justify-center"
            style={{
              borderColor: item.completed ? '#D4956A' : 'rgba(212,149,106,0.5)',
              backgroundColor: item.completed ? '#D4956A' : 'transparent',
            }}
          >
            {item.completed && (
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✓</Text>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

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

const BottomNav = ({ active }: { active: string }) => {
  const items = [
    { icon: '🏠', label: 'Home',    key: 'home'    },
    { icon: '📋', label: 'Tasks',   key: 'tasks'   },
    { icon: '🥕', label: 'Finance', key: 'finance' },
    { icon: '🐰', label: 'Profile', key: 'profile' },
  ];
  return (
    <View
      className="flex-row bg-card border-t-2 border-accent/30 pt-2.5"
      style={{ paddingBottom: Platform.OS === 'ios' ? 24 : 12 }}
    >
      {items.map(({ icon, label, key }) => {
        const isActive = active === key;
        return (
          <TouchableOpacity key={key} className="flex-1 items-center" activeOpacity={0.7}>
            <View className={`w-10 h-8 rounded-xl justify-center items-center ${isActive ? 'bg-bg' : ''}`}>
              <Text className="text-xl">{icon}</Text>
            </View>
            <Text className={`${JUA} text-xs mt-0.5 ${isActive ? 'text-accent' : 'text-cream opacity-40'}`}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const quickAmounts = ['+1', '+5', '+10', '+20', '+50', '+100'];
  const [amount, setAmount] = useState('0.00');

  const spentToday = 150;
  const allocatedDay = 500;
  const isOverBudget = spentToday > allocatedDay;

  const completedCount = commissions.filter(c => c.completed).length;
  const totalCount = commissions.length;
  const activeTasks = commissions.filter(c => !c.completed);
  const completedTasks = commissions.filter(c => c.completed);
  const allDone = totalCount > 0 && completedCount === totalCount;

  // ── Load persisted data on mount ──
  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setCommissions(JSON.parse(stored));
        } else {
          const initial = DEFAULT_COMMISSIONS.map(c => ({ ...c, completed: false }));
          setCommissions(initial);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
        }
      } catch {
        setCommissions(DEFAULT_COMMISSIONS.map(c => ({ ...c, completed: false })));
      }
    };
    load();
  }, []);

  // ── Persist on every change ──
  useEffect(() => {
    if (commissions.length === 0) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(commissions)).catch(() => {});
  }, [commissions]);

  const handleComplete = (id: string) =>
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, completed: true } : c));

  const handleUncomplete = (id: string) =>
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, completed: false } : c));

  const handleQuick = (val: string) => {
    const add = parseInt(val.replace('+', ''));
    setAmount(prev => (parseFloat(prev) + add).toFixed(2));
  };

  return (
    <View className="flex-1 bg-bg pt-10">
      <StatusBar barStyle="light-content" backgroundColor="#3B2220" />

      <ScrollView
        className="flex"
        contentContainerClassName="px-4 pt-3.5 pb-6"
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ── */}
        <View className="flex-row items-center gap-x-3.5 mb-6">
          <View
            className="p-0.5 rounded-full"
            style={{
              borderWidth: 2,
              borderColor: '#D4956A',
              shadowColor: '#D4956A',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.45,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <View className="w-12 h-12 rounded-full bg-card justify-center items-center">
              <Text className="text-3xl">🐰</Text>
            </View>
          </View>
          <View>
            <Text className={`${JUA} text-cream text-sm opacity-70`}>Welcome back,</Text>
            <Text className={`${DYNAPUFF} text-cream text-2xl tracking-wide`}>Charles</Text>
          </View>
        </View>

        {/* ── Today's Performance ── */}
        <Text className={`${JUA} text-accent text-xs tracking-widest mb-2.5 uppercase`}>
          Today's Performance
        </Text>
        <View
          className="bg-card rounded-2xl py-4 px-3.5 flex-row items-center mb-5"
          style={{
            shadowColor: '#1a0a08',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.2,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          <View className="flex-1">
            <Text className={`${JUA} text-cream text-xs opacity-70`}>Saturday</Text>
            <Text className={`${DYNAPUFF} text-cream text-base leading-tight`}>March 8</Text>
            <Text className={`${JUA} text-cream text-xs opacity-70`}>2026</Text>
          </View>
          <View className="w-px h-12 bg-accent opacity-30 mx-3" />
          {/* Commissions badge — updates live */}
          <View
            className="flex-1 items-center rounded-xl py-2"
            style={{ backgroundColor: allDone ? 'rgba(100,160,90,0.12)' : 'rgba(212,149,106,0.08)' }}
          >
            <Text className={`${JUA} text-cream text-xs opacity-75`}>Commissions</Text>
            <Text className={`${DYNAPUFF} text-sm mt-0.5`} style={{ color: allDone ? '#9de087' : '#D4956A' }}>
              {allDone ? 'Nice one!' : `${completedCount}/${totalCount}`}
            </Text>
            <Text className="text-xl mt-1">🥕</Text>
          </View>
          <View className="w-px h-12 bg-accent opacity-30 mx-3" />
          <View
            className="flex-1 items-center rounded-xl py-2"
            style={{ backgroundColor: 'rgba(200,80,60,0.12)' }}
          >
            <Text className={`${JUA} text-cream text-xs opacity-75`}>Finance</Text>
            <Text className={`${DYNAPUFF} text-sm mt-0.5`} style={{ color: '#f09090' }}>Oh no...</Text>
            <Text className="text-xl mt-1">🥕</Text>
          </View>
        </View>

        {/* ── Commissions ── */}
        <SectionDivider title="✦ Commissions ✦" />

        {/* Progress counter */}
        <View className="items-center mb-1">
          <View className="flex-row items-baseline gap-x-1.5">
            <Text className={`${DYNAPUFF} text-4xl`} style={{ color: allDone ? '#9de087' : '#D4956A' }}>
              {completedCount}
            </Text>
            <Text className={`${DYNAPUFF} text-cream text-xl opacity-60`}>/{totalCount}</Text>
            <Text className={`${JUA} text-cream text-base opacity-70 ml-1`}>finished</Text>
          </View>
          {/* Progress bar */}
          <View className="w-48 h-1.5 bg-card rounded-full mt-2 mb-1 overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%',
                backgroundColor: allDone ? '#9de087' : '#D4956A',
              }}
            />
          </View>
        </View>

        <Text className={`${JUA} text-accent text-xs text-center mb-4 opacity-70`}>
          {allDone ? '🎉 All done for today!' : 'Swipe right to complete · left to undo'}
        </Text>

        {/* Active tasks */}
        {activeTasks.map(item => (
          <SwipeableTaskItem
            key={item.id}
            item={item}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
          />
        ))}

        {/* Completed tasks collapsible */}
        {completedTasks.length > 0 && (
          <>
            <TouchableOpacity
              className="items-center mt-1 mb-1 py-2"
              onPress={() => setShowCompleted(v => !v)}
            >
              <Text className={`${JUA} text-accent text-sm opacity-80`}>
                Completed ({completedTasks.length}) {showCompleted ? '∧' : '›'}
              </Text>
            </TouchableOpacity>
            {showCompleted && completedTasks.map(item => (
              <SwipeableTaskItem
                key={item.id}
                item={item}
                onComplete={handleComplete}
                onUncomplete={handleUncomplete}
              />
            ))}
          </>
        )}

        {/* ── Finance ── */}
        <SectionDivider title="✦ Finance ✦" />

        <View className="flex-row gap-x-2.5 mb-4">
          <View
            className="flex-1 bg-card rounded-2xl p-3.5"
            style={{
              borderWidth: 1,
              borderColor: isOverBudget ? 'rgba(200,80,60,0.4)' : 'rgba(212,149,106,0.2)',
              shadowColor: '#1a0a08',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className={`${JUA} text-cream text-xs opacity-70 mb-2`}>Spent Today</Text>
            <View className="flex-row items-center gap-x-1.5">
              <Text className="text-lg">🥕</Text>
              <Text className={`${DYNAPUFF} text-lg`} style={{ color: isOverBudget ? '#f09090' : '#e8d5c0' }}>
                {spentToday.toFixed(2)}
              </Text>
            </View>
          </View>
          <View
            className="flex-1 bg-card rounded-2xl p-3.5"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(212,149,106,0.2)',
              shadowColor: '#1a0a08',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text className={`${JUA} text-cream text-xs opacity-70 mb-2`}>Allocated a Day</Text>
            <View className="flex-row items-center gap-x-1.5">
              <Text className="text-lg">🥕</Text>
              <Text className={`${DYNAPUFF} text-cream text-lg`}>{allocatedDay.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Budget bar */}
        <View className="mb-4">
          <View className="w-full h-2 bg-card rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.min((spentToday / allocatedDay) * 100, 100)}%`,
                backgroundColor: isOverBudget ? '#f09090' : '#D4956A',
              }}
            />
          </View>
          <Text className={`${JUA} text-cream text-xs opacity-50 mt-1 text-right`}>
            {((spentToday / allocatedDay) * 100).toFixed(0)}% of daily budget
          </Text>
        </View>

        {/* Quick-add */}
        <View className="flex-row gap-x-2.5 mb-3 items-stretch">
          <View
            className="w-[44%] bg-card rounded-2xl px-4 py-3.5 justify-center"
            style={{
              borderWidth: 1.5,
              borderColor: '#D4956A',
              shadowColor: '#D4956A',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
              elevation: 4,
            }}
          >
            <Text className={`${JUA} text-accent text-xs opacity-70 mb-1`}>Adding</Text>
            <View className="flex-row items-center gap-x-1">
              <Text className="text-base">🥕</Text>
              <Text className={`${DYNAPUFF} text-cream text-lg`}>₱ {amount}</Text>
            </View>
          </View>
          <View className="flex-1 flex-row flex-wrap gap-1.5 content-start">
            {quickAmounts.map((v, i) => (
              <TouchableOpacity
                key={i}
                className="rounded-full py-1.5 items-center justify-center"
                style={{
                  backgroundColor: 'rgba(212,149,106,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(212,149,106,0.4)',
                  width: '30%',
                }}
                onPress={() => handleQuick(v)}
                activeOpacity={0.6}
              >
                <Text className={`${JUA} text-accent text-xs`}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          className="rounded-2xl py-4 items-center mt-1"
          style={{
            backgroundColor: '#D4956A',
            shadowColor: '#D4956A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 6,
          }}
          activeOpacity={0.8}
        >
          <Text className={`${DYNAPUFF} text-cream text-base`}>🥕 Add to Spent Today</Text>
        </TouchableOpacity>

      </ScrollView>

      <BottomNav active="home" />
    </View>
  );
}