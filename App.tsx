// app.tsx
import "./global.css";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StatusBar, Platform, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { SettingsProvider } from './src/context/SettingsContext';
import { ProProvider } from './src/context/ProContext';
import { syncWidgetData } from "./src/utils/syncWidget";

import { DEFAULT_BUDGET, DEFAULT_CURRENCY, DEFAULT_AVATAR, IMAGES } from './src/constants';
import { getTodayKey, getYesterdayKey, generateId, isScheduledForDay, defaultStats, migrateCommissions, formatTime } from './src/helpers';
import { cancelAllNotifications, initNotifications, scheduleHabitNotifs, cancelHabitNotifs, scheduleMidnightNotif, cancelMidnightNotif } from './src/notifications';
import { STORAGE_COMMISSIONS, STORAGE_COMPLETION_HISTORY, STORAGE_FINANCE, STORAGE_FINANCE_HISTORY, STORAGE_ONBOARDED, STORAGE_SETTINGS, STORAGE_STATS, ALL_STORAGE_KEYS } from './src/storage';
import type { Commission, CommissionsData, DailyTotal, FinanceData, HabbitFormData, Settings, SpendingEntry, Stats, CompletionRecord, TabKey } from './src/types';

import { OnboardingScreen, HomeScreen, TasksScreen, FinanceScreen, ProfileScreen, SettingsScreen } from './src/screens';
import { AddHabbitScreen } from './src/screens/AddHabbitScreen';
import { BottomNav } from './src/components/BottomNav';
import { CoachScreen } from "./src/screens/Coachscreen";

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
};

// Sub-screen state for the tasks tab
type TasksSubScreen =
  | { mode: 'add' }
  | { mode: 'edit'; item: Commission };

export default function App() {
  const [isOnboarded, setIsOnboarded]             = useState<boolean | null>(null);
  const [activeTab, setActiveTab]                 = useState<TabKey>('home');
  const [tasksSubScreen, setTasksSubScreen]       = useState<TasksSubScreen | null>(null);
  const [commissions, setCommissions]             = useState<Commission[]>([]);
  const [spentToday, setSpentToday]               = useState(0);
  const [todayHistory, setTodayHistory]           = useState<SpendingEntry[]>([]);
  const [dailyTotals, setDailyTotals]             = useState<DailyTotal[]>([]);
  const [allocatedPerDay, setAllocatedPerDay]     = useState(DEFAULT_BUDGET);
  const [currency, setCurrency]                   = useState(DEFAULT_CURRENCY);
  const [name, setName]                           = useState('Friend');
  const [avatar, setAvatar]                       = useState<string>(DEFAULT_AVATAR);
  const [stats, setStats]                         = useState<Stats>(defaultStats());
  const [completionHistory, setCompletionHistory] = useState<CompletionRecord[]>([]);
  const [midnightNotifEnabled, setMidnightNotifEnabled] = useState(false);

  const hasLoaded    = useRef(false);
  const todayKey     = getTodayKey();
  const yesterdayKey = getYesterdayKey();

  const saveStats             = useCallback((s: Stats) => AsyncStorage.setItem(STORAGE_STATS, JSON.stringify(s)).catch(() => {}), []);
  const saveCompletionHistory = useCallback((r: CompletionRecord[]) => AsyncStorage.setItem(STORAGE_COMPLETION_HISTORY, JSON.stringify(r)).catch(() => {}), []);

  const updateWidget = useCallback(() => {
          const todayDow = new Date().getDay();
          const todaysScheduled = commissions.filter(c => isScheduledForDay(c, todayDow));

          syncWidgetData({
            name,
            completedCount: todaysScheduled.filter(c => c.completed).length,
            totalCount: todaysScheduled.length,
            spentToday,
            allocatedPerDay,
            currency,
            streak: stats.currentStreak,
            upcomingHabbit: todaysScheduled.find(c => !c.completed)?.label ?? '',
          });
        }, [commissions, spentToday, stats, name, allocatedPerDay, currency]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    updateWidget();
  }, [updateWidget]);

  useEffect(() => {
    const load = async () => {

      let loadedName = 'Friend';
      let loadedCurrency = DEFAULT_CURRENCY;
      let loadedBudget = DEFAULT_BUDGET;
      let loadedSpent = 0;
      let migrated: Commission[] = [];
      let loadedStats = defaultStats(); 

      try {
        
        await initNotifications();
        const onboarded = await AsyncStorage.getItem(STORAGE_ONBOARDED);
        if (!onboarded) { setIsOnboarded(false); return; }
        setIsOnboarded(true);
        const storedS = await AsyncStorage.getItem(STORAGE_SETTINGS);
        if (storedS) {
          const s: Settings = JSON.parse(storedS);
          if (s.name)            { setName(s.name); loadedName = s.name; }
          if (s.currency)        { setCurrency(s.currency); loadedCurrency = s.currency; }
          if (s.allocatedPerDay) { setAllocatedPerDay(s.allocatedPerDay); loadedBudget = s.allocatedPerDay; }
          if (s.avatar)          setAvatar(s.avatar);
          if (s.midnightNotifEnabled !== undefined) setMidnightNotifEnabled(s.midnightNotifEnabled);
        }

        const storedCH = await AsyncStorage.getItem(STORAGE_COMPLETION_HISTORY);
        let loadedHistory: CompletionRecord[] = storedCH ? JSON.parse(storedCH) : [];
        const storedSt = await AsyncStorage.getItem(STORAGE_STATS);
        loadedStats = defaultStats();
        if (storedSt) loadedStats = JSON.parse(storedSt);
        const storedH = await AsyncStorage.getItem(STORAGE_FINANCE_HISTORY);
        let existingTotals: DailyTotal[] = storedH ? JSON.parse(storedH).dailyTotals ?? [] : [];
        const storedF = await AsyncStorage.getItem(STORAGE_FINANCE);
        if (storedF) {
          const parsed: FinanceData = JSON.parse(storedF);
          if (parsed.date === todayKey) { setSpentToday(parsed.spentToday); loadedSpent = parsed.spentToday; setTodayHistory(parsed.history ?? []); }
          else {
            if (parsed.spentToday > 0) {
              existingTotals = [...existingTotals.filter(t => t.date !== parsed.date), { date: parsed.date, total: parsed.spentToday, entries: parsed.history ?? [] }].sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
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
          migrated = migrateCommissions(parsed.items);
          if (parsed.date === todayKey) {
            setCommissions(migrated);
          } else {
            const doneCount   = migrated.filter(c => c.completed).length;
            const allWereDone = migrated.length > 0 && migrated.every(c => c.completed);
            if (doneCount > 0) loadedStats = { ...loadedStats, totalCompleted: loadedStats.totalCompleted + doneCount };
            if (migrated.length > 0 && !loadedHistory.some(r => r.date === parsed.date)) {
              loadedHistory = [...loadedHistory, { 
                date: parsed.date, 
                completed: allWereDone,
                completedIds: migrated.filter(c => c.completed).map(c => c.id),
                scheduledIds: migrated
                  .filter(c => isScheduledForDay(c, new Date(parsed.date + 'T00:00:00').getDay()))
                  .map(c => c.id),
              }].sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
            }
            if (allWereDone && parsed.date === yesterdayKey) {
              const newStreak = loadedStats.currentStreak + 1;
              loadedStats = { ...loadedStats, currentStreak: newStreak, bestStreak: Math.max(newStreak, loadedStats.bestStreak), lastFullDate: parsed.date };
            } else if (parsed.date < yesterdayKey) {
              loadedStats = { ...loadedStats, currentStreak: 0 };
            }
            // Reset completed + completionCount for the new day
            const reset = migrated.map(c => ({ ...c, completed: false, completionCount: 0 }));
            migrated = reset;
            setCommissions(reset);
            await AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: reset, date: todayKey }));
          }
        }
        if (loadedStats.lastFullDate && loadedStats.lastFullDate < yesterdayKey) loadedStats = { ...loadedStats, currentStreak: 0 };
        setStats(loadedStats); saveStats(loadedStats);
        setCompletionHistory(loadedHistory); saveCompletionHistory(loadedHistory);
      } catch { setIsOnboarded(true); }
      finally { 
        hasLoaded.current = true; 
        const todayDow = new Date().getDay();
        const todaysScheduled = migrated.filter(c => isScheduledForDay(c, todayDow));
        syncWidgetData({
          name: loadedName,
          completedCount: todaysScheduled.filter(c => c.completed).length,
          totalCount: todaysScheduled.length,
          spentToday: loadedSpent,
          allocatedPerDay: loadedBudget,
          currency: loadedCurrency,
          streak: loadedStats.currentStreak,
          upcomingHabbit: todaysScheduled.find(c => !c.completed)?.label ?? '',
        });
      }
    };
    load();
  }, []);

  const handleOnboardingComplete = useCallback(async (result: any) => {
    const { name: onboardName, firstHabbit, budget, currency: onboardCurrency } = result;
    setName(onboardName); setAllocatedPerDay(budget); setCurrency(onboardCurrency);
    await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify({ allocatedPerDay: budget, currency: onboardCurrency, name: onboardName, avatar: DEFAULT_AVATAR, midnightNotifEnabled: false }));
    if (firstHabbit) {
      const initial: Commission[] = [{
        id: generateId(), label: firstHabbit, completed: false, days: [],
        reminderTime: null, timesPerDay: 1, completionCount: 0,
        reminderTimes: [], reminderSplit: null,
      }];
      setCommissions(initial);
      await AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: initial, date: todayKey }));
    }
    await AsyncStorage.setItem(STORAGE_ONBOARDED, 'true');
    hasLoaded.current = true; setIsOnboarded(true);
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
      const todayDow2 = new Date().getDay();
      const updated = [...prev, {
        date: todayKey,
        completed: true,
        completedIds: commissions.filter(c => c.completed).map(c => c.id),
        scheduledIds: commissions.filter(c => isScheduledForDay(c, todayDow2)).map(c => c.id),
      }].sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
      saveCompletionHistory(updated); return updated;
    });
    updateWidget();
  }, [commissions]);

  const saveSettings = useCallback((partial: Partial<Settings>) => {
    AsyncStorage.getItem(STORAGE_SETTINGS).then(s => {
      const current: Settings = s ? JSON.parse(s) : { allocatedPerDay: DEFAULT_BUDGET, currency: DEFAULT_CURRENCY, name: 'Friend', avatar: DEFAULT_AVATAR, midnightNotifEnabled: false };
      AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify({ ...current, ...partial })).catch(() => {});
    });
  }, []);

  const handleSetAllocated        = useCallback((v: number)  => { setAllocatedPerDay(v); saveSettings({ allocatedPerDay: v }); }, []);
  const handleSetCurrency         = useCallback((v: string)  => { setCurrency(v); saveSettings({ currency: v }); }, []);
  const handleSetName             = useCallback((v: string)  => { setName(v); saveSettings({ name: v }); }, []);
  const handleSetAvatar           = useCallback((v: string)  => { setAvatar(v); saveSettings({ avatar: v }); }, []);
  const handleToggleMidnightNotif = useCallback((enabled: boolean) => {
    setMidnightNotifEnabled(enabled); saveSettings({ midnightNotifEnabled: enabled });
    if (enabled) { scheduleMidnightNotif(); } else { cancelMidnightNotif(); }
  }, []);

  // ── Commission complete: for multi-times habits, increment count ──────────
  const handleCommissionComplete = useCallback((id: string) => {
    setCommissions(p => p.map(c => {
      if (c.id !== id) return c;
      const tpd = c.timesPerDay ?? 1;
      if (tpd === 1) return { ...c, completed: true };
      const newCount = (c.completionCount ?? 0) + 1;
      return { ...c, completionCount: newCount, completed: newCount >= tpd };
    }));
    updateWidget()
    setStats(prev => { const updated = { ...prev, totalCompleted: prev.totalCompleted + 1 }; saveStats(updated); return updated; });
  }, []);

  // ── Commission uncomplete: for multi-times habits, decrement count ────────
  const handleCommissionUncomplete = useCallback((id: string) => {
    setCommissions(p => p.map(c => {
      if (c.id !== id) return c;
      const tpd = c.timesPerDay ?? 1;
      if (tpd === 1) return { ...c, completed: false };
      const newCount = Math.max((c.completionCount ?? 0) - 1, 0);
      return { ...c, completionCount: newCount, completed: false };
    }));
    setStats(prev => { const updated = { ...prev, totalCompleted: Math.max(prev.totalCompleted - 1, 0) }; saveStats(updated); return updated; });
  }, []);

  // ── Add: receives full HabbitFormData, closes sub-screen ─────────────────
  const handleAdd = useCallback((data: HabbitFormData) => {
    const newItem: Commission = {
      id: generateId(),
      label: data.label,
      completed: false,
      days: data.days,
      reminderTime: data.reminderTime,
      timesPerDay: data.timesPerDay,
      completionCount: 0,
      reminderTimes: data.reminderTimes,
      reminderSplit: data.reminderSplit,
    };
    setCommissions(p => [...p, newItem]);
    scheduleHabitNotifs(newItem);
    setTasksSubScreen(null);
  }, []);

  // ── Edit: receives id + full HabbitFormData, closes sub-screen ───────────
  const handleEdit = useCallback((id: string, data: HabbitFormData) => {
    setCommissions(p => p.map(c => {
      if (c.id !== id) return c;
      const updated: Commission = {
        ...c,
        label: data.label,
        days: data.days,
        reminderTime: data.reminderTime,
        timesPerDay: data.timesPerDay,
        reminderTimes: data.reminderTimes,
        reminderSplit: data.reminderSplit,
      };
      scheduleHabitNotifs(updated);
      return updated;
    }));
    setTasksSubScreen(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setCommissions(p => p.filter(c => c.id !== id));
    cancelHabitNotifs(id);
    setTasksSubScreen(null);
  }, []);

  const handleUndoEntry = useCallback((id: string) => {
    setTodayHistory(prev => {
      const entry = prev.find(e => e.id === id); if (!entry) return prev;
      const newHistory = prev.filter(e => e.id !== id);
      const newSpent   = Math.max(spentToday - entry.amount, 0);
      setSpentToday(newSpent);
      AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: newSpent, date: todayKey, history: newHistory })).catch(() => {});
      return newHistory;
    });
  }, [spentToday, todayKey]);

  const handleFinanceAddSpend = useCallback((amount: string, note?: string) => {
    const toAdd = parseFloat(amount || '0');
    if (toAdd <= 0) return;
    const entry: SpendingEntry = { id: generateId(), amount: toAdd, time: formatTime(), note };
    const newSpent   = spentToday + toAdd;
    const newHistory = [...todayHistory, entry];
    setSpentToday(newSpent);
    setTodayHistory(newHistory);
    AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: newSpent, date: todayKey, history: newHistory })).catch(() => {});
    updateWidget();
  }, [spentToday, todayHistory, todayKey]);

  // ── Reset: also zeroes out completionCount ────────────────────────────────
  const handleResetToday = useCallback(() => {
    const reset = commissions.map(c => ({ ...c, completed: false, completionCount: 0 }));
    setCommissions(reset);
    AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: reset, date: todayKey })).catch(() => {});
    setSpentToday(0); setTodayHistory([]);
    AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: 0, date: todayKey, history: [] })).catch(() => {});
    setCompletionHistory(prev => { const updated = prev.filter(r => r.date !== todayKey); saveCompletionHistory(updated); return updated; });
    setStats(prev => { if (prev.lastFullDate !== todayKey) return prev; const updated = { ...prev, currentStreak: Math.max(prev.currentStreak - 1, 0), lastFullDate: yesterdayKey }; saveStats(updated); return updated; });
    updateWidget();
  }, [commissions, todayKey]);

const handleDeleteAllData = useCallback(async () => {
  await cancelAllNotifications();
  await Promise.all(ALL_STORAGE_KEYS.map(key => AsyncStorage.removeItem(key))); // full wipe
  setIsOnboarded(false); // ← back in
  setActiveTab('home');
  setTasksSubScreen(null);
  hasLoaded.current = false;
  setCommissions([]);
  setSpentToday(0);
  setTodayHistory([]);
  setDailyTotals([]);
  setAllocatedPerDay(DEFAULT_BUDGET);
  setCurrency(DEFAULT_CURRENCY);
  setName('Friend');
  setAvatar(DEFAULT_AVATAR);
  setStats(defaultStats());
  setCompletionHistory([]);
  setMidnightNotifEnabled(false);
}, [commissions]);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (isOnboarded === null) return (
    <View style={{ flex: 1, backgroundColor: '#2A1A18', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar barStyle="light-content" backgroundColor="#2A1A18" />
      <Image source={IMAGES.appLogo} style={{ width: 64, height: 64 }} resizeMode="contain" />
    </View>
  );

  if (!isOnboarded) return <OnboardingScreen onComplete={handleOnboardingComplete} />;

  

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            commissions={commissions}
            setCommissions={setCommissions}
            spentToday={spentToday}
            setSpentToday={setSpentToday}
            todayHistory={todayHistory}
            setTodayHistory={setTodayHistory}
            allocatedPerDay={allocatedPerDay}
            currency={currency}
            name={name}
            avatar={avatar}
            onGoToTasks={() => setActiveTab('tasks')}
            onCommissionComplete={handleCommissionComplete}
            onCommissionUncomplete={handleCommissionUncomplete}
          />
        );

      case 'tasks':
        // Sub-screen: add or edit
        if (tasksSubScreen !== null) {
          return (
            <AddHabbitScreen
              initialValue={tasksSubScreen.mode === 'edit' ? tasksSubScreen.item : undefined}
              onSave={
                tasksSubScreen.mode === 'edit'
                  ? (data) => handleEdit(tasksSubScreen.item.id, data)
                  : handleAdd
              }
              onClose={() => setTasksSubScreen(null)}
            />
          );
        }
        return (
          <TasksScreen
            commissions={commissions}
            completionHistory={completionHistory} 
            todayKey={todayKey}                   
            onNavigateAdd={() => setTasksSubScreen({ mode: 'add' })}
            onNavigateEdit={(item) => setTasksSubScreen({ mode: 'edit', item })}
            onDelete={handleDelete}
          />
        );

      case 'finance':
        return (
          <FinanceScreen
            spentToday={spentToday}
            todayHistory={todayHistory}
            dailyTotals={dailyTotals}
            allocatedPerDay={allocatedPerDay}
            currency={currency}
            onSetAllocated={handleSetAllocated}
            onUndoEntry={handleUndoEntry}
            onAddSpending={handleFinanceAddSpend}
          />
        );

      case 'chat':
        return <CoachScreen name={name} streak={stats.currentStreak} />;

      case 'profile':
        return (  
          <ProfileScreen
            name={name} avatar={avatar} stats={stats}
            completionHistory={completionHistory} todayKey={todayKey}
            midnightNotifEnabled={midnightNotifEnabled}
            onSetName={handleSetName} onSetAvatar={handleSetAvatar}
            onResetToday={handleResetToday} onDeleteAllData={handleDeleteAllData}
            onToggleMidnightNotif={handleToggleMidnightNotif}
            onOpenSettings={() => setActiveTab('settings')}
          />
        );

      case 'settings':
        return (
          <SettingsScreen
            currency={currency}
            allocatedPerDay={allocatedPerDay}
            midnightNotifEnabled={midnightNotifEnabled}
            onResetToday={handleResetToday}
            onDeleteAllData={handleDeleteAllData}
            onToggleMidnightNotif={handleToggleMidnightNotif}
            onBack={() => setActiveTab('profile')}
            onSetCurrency={handleSetCurrency}
          />
        );
    }
  };

  // Hide BottomNav when on tasks sub-screen (add/edit page)
  const showBottomNav = activeTab !== 'settings' && tasksSubScreen === null;

  return (
    <ProProvider>  
      <SettingsProvider>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#2A1A18', paddingTop: Platform.OS === 'ios' ? 58 : 28 }}>
            <StatusBar barStyle="light-content" backgroundColor="#3B2220" />
            <View style={{ flex: 1 }}>{renderScreen()}</View>
            {showBottomNav && <BottomNav active={activeTab} onPress={setActiveTab} avatar={avatar} />}
          </View>
        </SafeAreaProvider>
      </SettingsProvider>
    </ProProvider>  
  );
}