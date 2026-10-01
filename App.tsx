// app.tsx
import "./global.css";
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StatusBar, Platform, Image, AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { SettingsProvider } from './src/context/SettingsContext';
import { ProProvider } from './src/context/ProContext';
import { syncWidgetData, flushWidgetData } from "./src/utils/syncWidget";
import { applyBackup, backUpToICloud, getCloudBackupStatus, loadICloudBackup, markBackupHandled, pickBackupFile, type CloudBackupMeta } from './src/utils/cloudBackup';
import { describeBackupContents, describeBackupTime, summarizeBackup, type BackupFile } from './src/backupFormat';

import { DEFAULT_BUDGET, DEFAULT_CURRENCY, DEFAULT_AVATAR, IMAGES } from './src/constants';
import { getTodayKey, addDaysToKey, parseDateKey, generateId, isScheduledForDay, countsToday, defaultStats, migrateCommissions, formatTime } from './src/helpers';
import { rolloverFinance, rolloverHabits, streakContinues } from './src/dayRollover';
import { computeBudget, type BudgetPeriod, type TopUp } from './src/budget';
import { habitStats, type HabitSummary } from './src/habitStats';
import { cancelAllNotifications, initNotifications, scheduleHabitNotifs, cancelHabitNotifs, cancelMidnightNotif, scheduleEveningCheckins, cancelEveningCheckins, type Quiet } from './src/notifications';
import { STORAGE_COMMISSIONS, STORAGE_COMPLETION_HISTORY, STORAGE_FINANCE, STORAGE_FINANCE_HISTORY, STORAGE_ONBOARDED, STORAGE_SETTINGS, STORAGE_STATS, STORAGE_NOTIF_VERSION, STORAGE_TOPUPS, ALL_STORAGE_KEYS } from './src/storage';
import type { Commission, CommissionsData, DailyTotal, EveningReminder, HabbitFormData, Settings, SpendingEntry, Stats, CompletionRecord, TabKey } from './src/types';

import { OnboardingScreen, HomeScreen, TasksScreen, FinanceScreen, ProfileScreen, SettingsScreen } from './src/screens';
import { AddHabbitScreen } from './src/screens/AddHabbitScreen';
import { HabitDetailScreen } from './src/screens/HabitDetailScreen';
import { BottomNav } from './src/components/BottomNav';
import { CoachScreen } from "./src/screens/Coachscreen";

const scheduledByDow = (items: Commission[]) =>
  [0, 1, 2, 3, 4, 5, 6].map(dow => items.filter(c => isScheduledForDay(c, dow)).length);

/**
 * How long a habit's reminders are quiet: until Monday once an "N× a week" habit has met
 * its goal, until tomorrow once a habit is done or skipped today.
 */
const quietModeOf = (c: Commission, s: HabitSummary): Quiet | null =>
  s.weekDone ? 'week' : c.completed || c.skipped ? 'today' : null;

const quietMap = (items: Commission[], history: CompletionRecord[], todayKey: string) =>
  new Map(items.map(c => [c.id, quietModeOf(c, habitStats(c, history, todayKey))]));

/** The habit fields the add/edit form controls. Weekly habits are once a day, any day. */
const formFields = (data: HabbitFormData) => ({
  label:         data.label,
  days:          data.perWeek ? [] : data.days,
  perWeek:       data.perWeek ?? undefined,
  timesPerDay:   data.perWeek ? 1 : data.timesPerDay,
  reminderTime:  data.reminderTime,
  reminderTimes: data.reminderTimes,
  reminderSplit: data.reminderSplit,
});

const DEFAULT_EVENING_REMINDER: EveningReminder = { enabled: false, hour: 20, minute: 0 };

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

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
  | { mode: 'detail'; id: string }
  /** fromDetail: closing the editor goes back to the habit's page. */
  | { mode: 'edit'; item: Commission; fromDetail?: boolean };

/** Where the add/edit screen goes when it closes. */
const afterEditor = (prev: TasksSubScreen | null): TasksSubScreen | null =>
  prev?.mode === 'edit' && prev.fromDetail ? { mode: 'detail', id: prev.item.id } : null;

export default function App() {
  const [isOnboarded, setIsOnboarded]             = useState<boolean | null>(null);
  const [activeTab, setActiveTab]                 = useState<TabKey>('home');
  const [tasksSubScreen, setTasksSubScreen]       = useState<TasksSubScreen | null>(null);
  const [commissions, setCommissions]             = useState<Commission[]>([]);
  const [spentToday, setSpentToday]               = useState(0);
  const [todayHistory, setTodayHistory]           = useState<SpendingEntry[]>([]);
  const [dailyTotals, setDailyTotals]             = useState<DailyTotal[]>([]);
  const [budgetPeriod, setBudgetPeriod]           = useState<BudgetPeriod>('daily');
  const [budgetAmount, setBudgetAmount]           = useState(DEFAULT_BUDGET);
  const [topUps, setTopUps]                       = useState<TopUp[]>([]);
  const [currency, setCurrency]                 = useState(DEFAULT_CURRENCY);
  const [name, setName]                           = useState('Friend');
  const [avatar, setAvatar]                       = useState<string>(DEFAULT_AVATAR);
  const [stats, setStats]                         = useState<Stats>(defaultStats());
  const [completionHistory, setCompletionHistory] = useState<CompletionRecord[]>([]);
  const [eveningReminder, setEveningReminder]     = useState<EveningReminder>(DEFAULT_EVENING_REMINDER);

  // The day the in-memory state belongs to. Only advanced by rolloverIfNewDay, so data is
  // never written under a new date before the previous day has been rolled over.
  const [dayKey, setDayKey] = useState(getTodayKey);
  const hasLoaded    = useRef(false);
  // Each habit's "done or skipped today" state as of the last reminder planning.
  const quietById    = useRef<Map<string, Quiet | null>>(new Map());
  const todayKey     = dayKey;
  const yesterdayKey = addDaysToKey(dayKey, -1);
  const dayDow       = parseDateKey(dayKey).getDay();

  const budget = useMemo(
    () => computeBudget({ period: budgetPeriod, amount: budgetAmount, todayKey: dayKey, spentToday, dailyTotals, topUps }),
    [budgetPeriod, budgetAmount, dayKey, spentToday, dailyTotals, topUps],
  );
  // What can be spent today. For weekly/monthly budgets this adapts to the rest of the period.
  const allocatedPerDay = budget.dailyAllowance;

  // Each habit's streak and history, worked out from the daily records.
  const habitStatsById = useMemo(() => {
    const byId: Record<string, HabitSummary> = {};
    for (const c of commissions) byId[c.id] = habitStats(c, completionHistory, dayKey);
    return byId;
  }, [commissions, completionHistory, dayKey]);

  const saveStats             = useCallback((s: Stats) => AsyncStorage.setItem(STORAGE_STATS, JSON.stringify(s)).catch(() => {}), []);
  const saveCompletionHistory = useCallback((r: CompletionRecord[]) => AsyncStorage.setItem(STORAGE_COMPLETION_HISTORY, JSON.stringify(r)).catch(() => {}), []);

  const updateWidget = useCallback(() => {
          const todaysScheduled = commissions.filter(c => countsToday(c, dayDow));

          syncWidgetData({
            name,
            date: dayKey,
            scheduledByDow: scheduledByDow(commissions),
            completedCount: todaysScheduled.filter(c => c.completed).length,
            totalCount: todaysScheduled.length,
            spentToday,
            allocatedPerDay,
            currency,
            streak: stats.currentStreak,
            avatar,
            upcomingHabbit: todaysScheduled.find(c => !c.completed)?.label ?? '',
          });
        }, [commissions, spentToday, stats, name, allocatedPerDay, currency, avatar, dayDow, dayKey]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    updateWidget();
  }, [updateWidget]);

  // Latest state for rolloverIfNewDay, which runs from AppState/timer callbacks.
  const liveState = useRef({ dayKey, commissions, spentToday, todayHistory, dailyTotals, stats, completionHistory });
  liveState.current = { dayKey, commissions, spentToday, todayHistory, dailyTotals, stats, completionHistory };

  // iOS usually suspends the app instead of killing it, so the load effect alone
  // would miss midnight. Called on resume and by a timer at midnight.
  const rolloverIfNewDay = useCallback(() => {
    if (!hasLoaded.current) return;
    const s = liveState.current;
    const newKey = getTodayKey();
    if (newKey === s.dayKey) return;

    const fin = rolloverFinance({ spentToday: s.spentToday, date: s.dayKey, history: s.todayHistory }, s.dailyTotals, newKey);
    const hab = rolloverHabits({ date: s.dayKey, commissions: s.commissions, stats: s.stats, history: s.completionHistory }, newKey);

    setDayKey(newKey);
    setSpentToday(0); setTodayHistory([]); setDailyTotals(fin.dailyTotals);
    setCommissions(hab.commissions); // persisted by the commissions effect under the new dayKey
    setStats(hab.stats); saveStats(hab.stats);
    setCompletionHistory(hab.history); saveCompletionHistory(hab.history);
    AsyncStorage.setItem(STORAGE_FINANCE_HISTORY, JSON.stringify({ dailyTotals: fin.dailyTotals })).catch(() => {});
    AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify(fin.finance)).catch(() => {});
  }, [saveStats, saveCompletionHistory]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        flushWidgetData();
      } else if (state === 'active' && hasLoaded.current) {
        rolloverIfNewDay();
        updateWidget();
        flushWidgetData();
      }
    });
    return () => sub.remove();
  }, [updateWidget, rolloverIfNewDay]);

  // Roll over at midnight while the app is open in the foreground.
  useEffect(() => {
    const next = new Date(); next.setHours(24, 0, 1, 0);
    const timer = setTimeout(rolloverIfNewDay, next.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [dayKey, rolloverIfNewDay]);

  // Loads everything from storage. Runs at launch and again after restoring a backup.
  const loadAll = useCallback(async () => {
    const todayKey = getTodayKey();
    setDayKey(todayKey);
    let loadedName = 'Friend';
    let loadedCurrency = DEFAULT_CURRENCY;
    let loadedPeriod: BudgetPeriod = 'daily';
    let loadedAmount = DEFAULT_BUDGET;
    let loadedTopUps: TopUp[] = [];
    let loadedTotals: DailyTotal[] = [];
    let loadedSpent = 0;
    let loadedAvatar: string = DEFAULT_AVATAR;
    let migrated: Commission[] = [];
    let loadedStats = defaultStats();
    let newDay = false;

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
        // Budgets predating budget periods were always daily (allocatedPerDay).
        loadedPeriod = s.budgetPeriod ?? 'daily';
        loadedAmount = s.budgetAmount ?? s.allocatedPerDay ?? DEFAULT_BUDGET;
        setBudgetPeriod(loadedPeriod); setBudgetAmount(loadedAmount);
        if (s.avatar)          { setAvatar(s.avatar); loadedAvatar = s.avatar; }
        // The midnight "new day" ping was replaced by the evening check-in.
        setEveningReminder(s.eveningReminder ?? { ...DEFAULT_EVENING_REMINDER, enabled: !!s.midnightNotifEnabled });
        if (s.midnightNotifEnabled) cancelMidnightNotif();
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
        const r = rolloverFinance(JSON.parse(storedF), existingTotals, todayKey);
        existingTotals = r.dailyTotals;
        loadedSpent = r.finance.spentToday;
        setSpentToday(r.finance.spentToday); setTodayHistory(r.finance.history ?? []);
        if (r.changed) {
          await AsyncStorage.setItem(STORAGE_FINANCE_HISTORY, JSON.stringify({ dailyTotals: existingTotals }));
          await AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify(r.finance));
        }
      }
      setDailyTotals(existingTotals);
      loadedTotals = existingTotals;
      const storedT = await AsyncStorage.getItem(STORAGE_TOPUPS);
      loadedTopUps  = storedT ? JSON.parse(storedT) as TopUp[] : [];
      setTopUps(loadedTopUps);
      const storedC = await AsyncStorage.getItem(STORAGE_COMMISSIONS);
      if (storedC) {
        const parsed: CommissionsData = JSON.parse(storedC);
        const r = rolloverHabits(
          { date: parsed.date, commissions: migrateCommissions(parsed.items), stats: loadedStats, history: loadedHistory },
          todayKey,
        );
        migrated = r.commissions; loadedStats = r.stats; loadedHistory = r.history;
        newDay = r.changed;
        setCommissions(migrated);
        if (r.changed) await AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: migrated, date: todayKey }));
      }
      // Re-plan every habit's reminders on a new day, so habits that were done or skipped
      // (and so quiet) yesterday get their repeating reminders back. v3 re-plans once for
      // everyone: quiet reminders are new, and older versions never scheduled split ones.
      if (newDay || (await AsyncStorage.getItem(STORAGE_NOTIF_VERSION)) !== '3') {
        for (const c of migrated) await scheduleHabitNotifs(c, quietModeOf(c, habitStats(c, loadedHistory, todayKey)));
        await AsyncStorage.setItem(STORAGE_NOTIF_VERSION, '3');
      }
      quietById.current = quietMap(migrated, loadedHistory, todayKey);
      setStats(loadedStats); saveStats(loadedStats);
      setCompletionHistory(loadedHistory); saveCompletionHistory(loadedHistory);
    } catch { setIsOnboarded(true); }
    finally { 
      hasLoaded.current = true; 
      const todayDow = new Date().getDay();
      const todaysScheduled = migrated.filter(c => countsToday(c, todayDow));
      syncWidgetData({
        name: loadedName,
        date: todayKey,
        scheduledByDow: scheduledByDow(migrated),
        completedCount: todaysScheduled.filter(c => c.completed).length,
        totalCount: todaysScheduled.length,
        spentToday: loadedSpent,
        allocatedPerDay: computeBudget({
          period: loadedPeriod, amount: loadedAmount, todayKey, spentToday: loadedSpent, dailyTotals: loadedTotals, topUps: loadedTopUps,
        }).dailyAllowance,
        currency: loadedCurrency,
        streak: loadedStats.currentStreak,
        avatar: loadedAvatar,
        upcomingHabbit: todaysScheduled.find(c => !c.completed)?.label ?? '',
      });
    }
  }, [saveStats, saveCompletionHistory]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Backup ────────────────────────────────────────────────────────────────

  const isOnboardedRef = useRef(isOnboarded);
  isOnboardedRef.current = isOnboarded;

  const resetState = useCallback(() => {
    setActiveTab('home');
    setTasksSubScreen(null);
    setCommissions([]);
    setSpentToday(0);
    setTodayHistory([]);
    setDailyTotals([]);
    setBudgetPeriod('daily');
    setBudgetAmount(DEFAULT_BUDGET);
    setTopUps([]);
    setCurrency(DEFAULT_CURRENCY);
    setName('Friend');
    setAvatar(DEFAULT_AVATAR);
    setStats(defaultStats());
    setCompletionHistory([]);
    setEveningReminder(DEFAULT_EVENING_REMINDER);
  }, []);

  // Replaces all data with a backup and reloads. Restoring the iCloud backup also lets this
  // install keep it up to date from now on.
  const restoreBackup = useCallback(async (file: BackupFile, fromICloud: boolean) => {
    hasLoaded.current = false;
    await cancelAllNotifications();
    await applyBackup(file);
    if (fromICloud) await markBackupHandled(file.createdAt);
    resetState();
    await loadAll();
    haptic.success();
    Alert.alert('Welcome back! 🐰', `Restored ${describeBackupContents(summarizeBackup(file))}.`);
  }, [resetState, loadAll]);

  const restoreFromICloud = useCallback(async () => {
    try {
      const file = await loadICloudBackup();
      if (!file) { Alert.alert('No backup found', 'There’s no Habbit backup in this iCloud account yet.'); return; }
      await restoreBackup(file, true);
    } catch (e) {
      Alert.alert('Couldn’t restore', errorMessage(e));
    }
  }, [restoreBackup]);

  /** Returns true once restored. With `confirm`, asks first, since it replaces existing data. */
  const importBackupFile = useCallback(async (confirm: boolean): Promise<boolean> => {
    try {
      const file = await pickBackupFile();
      if (!file) return false;
      if (!confirm) { await restoreBackup(file, false); return true; }
      Alert.alert(
        'Replace everything?',
        `This backup is from ${describeBackupTime(file.createdAt)} (${describeBackupContents(summarizeBackup(file))}). It replaces all Habbits, spending and stats on this phone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Restore', style: 'destructive', onPress: () => { restoreBackup(file, false).catch(e => Alert.alert('Couldn’t restore', errorMessage(e))); } },
        ],
      );
    } catch (e) {
      Alert.alert('Couldn’t import', errorMessage(e));
    }
    return false;
  }, [restoreBackup]);

  // Another install's backup is in iCloud (a reinstall, a new phone, or iCloud delivering it
  // after onboarding). Automatic backup is paused until the user picks one, so ask once.
  const backupPromptOpen = useRef(false);
  const offerCloudBackup = useCallback(async () => {
    if (backupPromptOpen.current || !isOnboardedRef.current) return;
    const status = await getCloudBackupStatus().catch(() => null);
    const meta = status?.needsDecision ? status.meta : null;
    if (!meta || backupPromptOpen.current) return;
    backupPromptOpen.current = true;
    Alert.alert(
      'Found an iCloud backup',
      `Backed up ${describeBackupTime(meta.createdAt)} · ${describeBackupContents(meta)}.\n\nRestore it? This replaces what’s on this phone. Keeping this phone’s data replaces the backup instead.`,
      [
        { text: 'Keep this phone’s data', onPress: () => { backupPromptOpen.current = false; markBackupHandled(meta.createdAt); } },
        { text: 'Restore', onPress: () => { backupPromptOpen.current = false; restoreFromICloud(); } },
      ],
      { cancelable: false },
    );
  }, [restoreFromICloud]);

  useEffect(() => { if (isOnboarded) offerCloudBackup(); }, [isOnboarded, offerCloudBackup]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!hasLoaded.current || !isOnboardedRef.current) return;
      if (state === 'background') backUpToICloud().catch(() => {});
      else if (state === 'active') offerCloudBackup();
    });
    return () => sub.remove();
  }, [offerCloudBackup]);

  // On a fresh install iCloud can take a few seconds to deliver an existing backup, so keep
  // checking while onboarding is open.
  const [onboardingBackup, setOnboardingBackup] = useState<CloudBackupMeta | null>(null);
  useEffect(() => {
    if (isOnboarded !== false) return;
    let stopped = false;
    (async () => {
      for (let i = 0; i < 30 && !stopped; i++) {
        const status = await getCloudBackupStatus().catch(() => null);
        if (stopped) return;
        if (status?.meta) { setOnboardingBackup(status.meta); return; }
        await new Promise<void>(r => setTimeout(r, 2000));
      }
    })();
    return () => { stopped = true; };
  }, [isOnboarded]);

  const handleOnboardingComplete = useCallback(async (result: any) => {
    const { name: onboardName, firstHabbit, budget: onboardBudget, budgetPeriod: onboardPeriod = 'daily', currency: onboardCurrency } = result;
    setName(onboardName); setBudgetAmount(onboardBudget); setBudgetPeriod(onboardPeriod); setCurrency(onboardCurrency);
    await AsyncStorage.setItem(STORAGE_SETTINGS, JSON.stringify({
      allocatedPerDay: onboardBudget, budgetAmount: onboardBudget, budgetPeriod: onboardPeriod,
      currency: onboardCurrency, name: onboardName, avatar: DEFAULT_AVATAR, midnightNotifEnabled: false,
    }));
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

  // A habit that's done or skipped goes quiet until tomorrow (a weekly one that met its goal,
  // until Monday); un-doing it, or a new day or week, brings its reminders back. Only habits
  // whose quiet state changed are re-planned; loadAll sets the starting point.
  useEffect(() => {
    if (!hasLoaded.current) return;
    const prev = quietById.current;
    const next = new Map<string, Quiet | null>();
    for (const c of commissions) {
      const mode = habitStatsById[c.id] ? quietModeOf(c, habitStatsById[c.id]) : null;
      next.set(c.id, mode);
      if ((prev.get(c.id) ?? null) !== mode) scheduleHabitNotifs(c, mode);
    }
    quietById.current = next;
  }, [commissions, habitStatsById]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    const todaysScheduled = commissions.filter(c => isScheduledForDay(c, dayDow));
    // Skipped habits are taken out of the day; if everything is skipped it's a rest day.
    const counted = todaysScheduled.filter(c => !c.skipped);
    const allDone = counted.length > 0 && counted.every(c => c.completed);

    // A habit was un-completed (or everything skipped) after today's credit: revert it.
    if (!allDone && stats.lastFullDate === todayKey) {
      setStats(prev => {
        if (prev.lastFullDate !== todayKey || !prev.beforeToday) return prev;
        const updated = { ...prev, ...prev.beforeToday, beforeToday: undefined };
        saveStats(updated); return updated;
      });
      setCompletionHistory(prev => {
        const updated = prev.filter(r => r.date !== todayKey);
        saveCompletionHistory(updated); return updated;
      });
      return;
    }

    if (!allDone || stats.lastFullDate === todayKey) return;
    setStats(prev => {
      if (prev.lastFullDate === todayKey) return prev;
      const newStreak = streakContinues(prev, todayKey, commissions, completionHistory) ? prev.currentStreak + 1 : 1;
      const updated = {
        ...prev,
        currentStreak: newStreak, bestStreak: Math.max(newStreak, prev.bestStreak), lastFullDate: todayKey,
        beforeToday: { currentStreak: prev.currentStreak, bestStreak: prev.bestStreak, lastFullDate: prev.lastFullDate },
      };
      saveStats(updated); return updated;
    });
    setCompletionHistory(prev => {
      if (prev.some(r => r.date === todayKey)) return prev;
      const updated = [...prev, {
        date: todayKey,
        completed: true,
        completedIds: todaysScheduled.filter(c => c.completed).map(c => c.id),
        scheduledIds: todaysScheduled.map(c => c.id),
        skippedIds:   todaysScheduled.filter(c => c.skipped).map(c => c.id),
      }].sort((a, b) => a.date.localeCompare(b.date));
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

  const handleSetBudget = useCallback((period: BudgetPeriod, amount: number) => {
    setBudgetPeriod(period); setBudgetAmount(amount);
    saveSettings({ budgetPeriod: period, budgetAmount: amount });
  }, [saveSettings]);

  const saveTopUps = useCallback((t: TopUp[]) => AsyncStorage.setItem(STORAGE_TOPUPS, JSON.stringify(t)).catch(() => {}), []);

  // "I got extra money": adds to the current period's budget instead of re-entering the total.
  const handleAddMoney = useCallback((amount: string, note?: string) => {
    const value = parseFloat(amount || '0');
    if (value <= 0) return;
    setTopUps(prev => {
      const updated = [...prev, { id: generateId(), amount: value, date: todayKey, time: formatTime(), note }];
      saveTopUps(updated); return updated;
    });
  }, [todayKey, saveTopUps]);

  const handleUndoTopUp = useCallback((id: string) => {
    setTopUps(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveTopUps(updated); return updated;
    });
  }, [saveTopUps]);
  const handleSetCurrency         = useCallback((v: string)  => { setCurrency(v); saveSettings({ currency: v }); }, []);
  const handleSetName             = useCallback((v: string)  => { setName(v); saveSettings({ name: v }); }, []);
  const handleSetAvatar           = useCallback((v: string)  => { setAvatar(v); saveSettings({ avatar: v }); }, []);
  const handleSetEveningReminder = useCallback((v: EveningReminder) => {
    setEveningReminder(v); saveSettings({ eveningReminder: v, midnightNotifEnabled: false });
  }, [saveSettings]);

  // Re-plan the evening check-ins when habits, the day or the setting change (debounced,
  // since every tap on a habit changes `commissions`).
  useEffect(() => {
    if (!hasLoaded.current) return;
    const t = setTimeout(() => {
      if (eveningReminder.enabled) scheduleEveningCheckins(eveningReminder, commissions);
      else cancelEveningCheckins();
    }, 800);
    return () => clearTimeout(t);
  }, [eveningReminder, commissions, dayKey]);

  // ── Commission complete: for multi-times habits, increment count ──────────
  // totalCompleted counts habits finished, not taps: an 8× habit counts once, on the 8th tap.
  const handleCommissionComplete = useCallback((id: string) => {
    const cur = liveState.current.commissions.find(c => c.id === id);
    const finishes = !!cur && !cur.completed && ((cur.timesPerDay ?? 1) === 1 || (cur.completionCount ?? 0) + 1 >= cur.timesPerDay);
    setCommissions(p => p.map(c => {
      if (c.id !== id) return c;
      const tpd = c.timesPerDay ?? 1;
      if (tpd === 1) return { ...c, completed: true, skipped: false };
      const newCount = (c.completionCount ?? 0) + 1;
      return { ...c, completionCount: newCount, completed: newCount >= tpd, skipped: false };
    }));
    if (finishes) setStats(prev => { const updated = { ...prev, totalCompleted: prev.totalCompleted + 1 }; saveStats(updated); return updated; });
  }, [saveStats]);

  // ── Commission uncomplete: for multi-times habits, decrement count ────────
  const handleCommissionUncomplete = useCallback((id: string) => {
    const wasDone = !!liveState.current.commissions.find(c => c.id === id)?.completed;
    setCommissions(p => p.map(c => {
      if (c.id !== id) return c;
      const tpd = c.timesPerDay ?? 1;
      if (tpd === 1) return { ...c, completed: false };
      const newCount = Math.max((c.completionCount ?? 0) - 1, 0);
      return { ...c, completionCount: newCount, completed: false };
    }));
    if (wasDone) setStats(prev => { const updated = { ...prev, totalCompleted: Math.max(prev.totalCompleted - 1, 0) }; saveStats(updated); return updated; });
  }, [saveStats]);

  // ── Skip: take habits out of today without breaking any streak ───────────
  const setSkipped = useCallback((ids: string[], skipped: boolean) => {
    if (ids.length === 0) return;
    setCommissions(p => p.map(c => (ids.includes(c.id) ? { ...c, skipped } : c)));
  }, []);
  // Callers check the weekly skip allowance first (habitStatsById[id].skips).
  const handleSkipMany = useCallback((ids: string[]) => setSkipped(ids, true), [setSkipped]);
  const handleSkip     = useCallback((id: string) => setSkipped([id], true),  [setSkipped]);
  const handleUnskip   = useCallback((id: string) => setSkipped([id], false), [setSkipped]);

  // ── Add: receives full HabbitFormData, closes sub-screen ─────────────────
  const handleAdd = useCallback((data: HabbitFormData) => {
    const newItem: Commission = { id: generateId(), completed: false, completionCount: 0, ...formFields(data) };
    setCommissions(p => [...p, newItem]);
    scheduleHabitNotifs(newItem);
    setTasksSubScreen(null);
  }, []);

  // ── Edit: receives id + full HabbitFormData, closes sub-screen ───────────
  const handleEdit = useCallback((id: string, data: HabbitFormData) => {
    const { commissions: current, completionHistory: history, dayKey: today } = liveState.current;
    const cur = current.find(c => c.id === id);
    if (cur) {
      const updated: Commission = { ...cur, ...formFields(data) };
      const mode = quietModeOf(updated, habitStats(updated, history, today));
      quietById.current.set(id, mode); // planned here, so the quiet effect leaves it alone
      scheduleHabitNotifs(updated, mode);
      setCommissions(p => p.map(c => (c.id === id ? { ...c, ...formFields(data) } : c)));
    }
    setTasksSubScreen(afterEditor);
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
  }, [spentToday, todayHistory, todayKey]);

  // ── Reset: also zeroes out completionCount ────────────────────────────────
  const handleResetToday = useCallback(() => {
    const reset = commissions.map(c => ({ ...c, completed: false, completionCount: 0, skipped: false }));
    setCommissions(reset);
    AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: reset, date: todayKey })).catch(() => {});
    setSpentToday(0); setTodayHistory([]);
    AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: 0, date: todayKey, history: [] })).catch(() => {});
    setCompletionHistory(prev => { const updated = prev.filter(r => r.date !== todayKey); saveCompletionHistory(updated); return updated; });
    setStats(prev => {
      if (prev.lastFullDate !== todayKey) return prev;
      const updated = prev.beforeToday
        ? { ...prev, ...prev.beforeToday, beforeToday: undefined }
        : { ...prev, currentStreak: Math.max(prev.currentStreak - 1, 0), lastFullDate: yesterdayKey };
      saveStats(updated); return updated;
    });
    updateWidget();
  }, [commissions, todayKey]);

  // The iCloud backup is kept: onboarding offers it again, so this can still be undone there.
  const handleDeleteAllData = useCallback(async () => {
    await cancelAllNotifications();
    await Promise.all(ALL_STORAGE_KEYS.map(key => AsyncStorage.removeItem(key))); // full wipe
    hasLoaded.current = false;
    setIsOnboarded(false);
    resetState();
  }, [resetState]);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (isOnboarded === null) return (
    <View style={{ flex: 1, backgroundColor: '#2A1A18', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar barStyle="light-content" backgroundColor="#2A1A18" />
      <Image source={IMAGES.appLogo} style={{ width: 64, height: 64 }} resizeMode="contain" />
    </View>
  );

  if (!isOnboarded) return (
    <OnboardingScreen
      onComplete={handleOnboardingComplete}
      cloudBackup={onboardingBackup}
      onRestoreCloud={restoreFromICloud}
      onDeclineCloud={() => { if (onboardingBackup) markBackupHandled(onboardingBackup.createdAt); }}
      onImportFile={async () => {
        // Choosing a file over the iCloud backup that was on offer counts as deciding on it.
        if ((await importBackupFile(false)) && onboardingBackup) markBackupHandled(onboardingBackup.createdAt);
      }}
    />
  );

  

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            commissions={commissions}
            habitStats={habitStatsById}
            spentToday={spentToday}
            allocatedPerDay={allocatedPerDay}
            budget={budget}
            currency={currency}
            name={name}
            avatar={avatar}
            streak={stats.currentStreak}
            onAddHabit={() => { setActiveTab('tasks'); setTasksSubScreen({ mode: 'add' }); }}
            onGoToFinance={() => setActiveTab('finance')}
            onAddSpending={handleFinanceAddSpend}
            onCommissionComplete={handleCommissionComplete}
            onCommissionUncomplete={handleCommissionUncomplete}
            onSkip={handleSkip}
            onUnskip={handleUnskip}
            onSkipMany={handleSkipMany}
          />
        );

      case 'tasks': {
        const detailHabit = tasksSubScreen?.mode === 'detail' ? commissions.find(c => c.id === tasksSubScreen.id) : undefined;
        if (detailHabit) {
          return (
            <HabitDetailScreen
              habit={detailHabit}
              history={completionHistory}
              todayKey={todayKey}
              onBack={() => setTasksSubScreen(null)}
              onEdit={() => setTasksSubScreen({ mode: 'edit', item: detailHabit, fromDetail: true })}
              onSkip={() => handleSkip(detailHabit.id)}
              onUnskip={() => handleUnskip(detailHabit.id)}
            />
          );
        }
        // Sub-screen: add or edit
        if (tasksSubScreen?.mode === 'add' || tasksSubScreen?.mode === 'edit') {
          return (
            <AddHabbitScreen
              initialValue={tasksSubScreen.mode === 'edit' ? tasksSubScreen.item : undefined}
              onSave={
                tasksSubScreen.mode === 'edit'
                  ? (data) => handleEdit(tasksSubScreen.item.id, data)
                  : handleAdd
              }
              onClose={() => setTasksSubScreen(afterEditor)}
              onDelete={tasksSubScreen.mode === 'edit' ? () => handleDelete(tasksSubScreen.item.id) : undefined}
            />
          );
        }
        return (
          <TasksScreen
            commissions={commissions}
            completionHistory={completionHistory}
            habitStats={habitStatsById}
            todayKey={todayKey}
            onNavigateAdd={() => setTasksSubScreen({ mode: 'add' })}
            onOpenHabit={(item) => setTasksSubScreen({ mode: 'detail', id: item.id })}
          />
        );
      }

      case 'finance':
        return (
          <FinanceScreen
            spentToday={spentToday}
            todayHistory={todayHistory}
            dailyTotals={dailyTotals}
            budget={budget}
            budgetAmount={budgetAmount}
            topUpsToday={topUps.filter(t => t.date === todayKey)}
            currency={currency}
            onSetBudget={handleSetBudget}
            onAddMoney={handleAddMoney}
            onUndoTopUp={handleUndoTopUp}
            onUndoEntry={handleUndoEntry}
            onAddSpending={handleFinanceAddSpend}
          />
        );

      case 'chat':
        return <CoachScreen name={name} streak={stats.currentStreak} budget={budget} />;

      case 'profile':
        return (  
          <ProfileScreen
            name={name} avatar={avatar} stats={stats}
            completionHistory={completionHistory} todayKey={todayKey}
            onSetName={handleSetName} onSetAvatar={handleSetAvatar}
            onOpenSettings={() => setActiveTab('settings')}
          />
        );

      case 'settings':
        return (
          <SettingsScreen
            currency={currency}
            budgetPeriod={budgetPeriod}
            budgetAmount={budgetAmount}
            eveningReminder={eveningReminder}
            onSetEveningReminder={handleSetEveningReminder}
            onOpenBudget={() => setActiveTab('finance')}
            onResetToday={handleResetToday}
            onDeleteAllData={handleDeleteAllData}
            onRestoreFromICloud={restoreFromICloud}
            onImportBackupFile={() => importBackupFile(true).then(() => {})}
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