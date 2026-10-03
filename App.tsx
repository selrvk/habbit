// app.tsx
import "./global.css";
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, StatusBar, Platform, Image, AppState, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { SettingsProvider } from './src/context/SettingsContext';
import { ProProvider } from './src/context/ProContext';
import { syncWidgetData, flushWidgetData } from "./src/utils/syncWidget";
import { widgetPayload } from './src/widgetPayload';
import { takeInbox, takeLink, onInboxChanged } from './src/utils/habbitInbox';
import { catchUpDay, type InboxEvent } from './src/inbox';
import { parseLink, type LinkTarget } from './src/links';
import { applyBackup, backUpToICloud, getCloudBackupStatus, loadICloudBackup, markBackupHandled, pickBackupFile, type CloudBackupMeta } from './src/utils/cloudBackup';
import { describeBackupContents, describeBackupTime, summarizeBackup, type BackupFile } from './src/backupFormat';

import { DEFAULT_BUDGET, DEFAULT_CURRENCY, DEFAULT_AVATAR, IMAGES } from './src/constants';
import { getTodayKey, addDaysToKey, parseDateKey, generateId, isScheduledForDay, defaultStats, migrateCommissions, formatTime, currencyStr } from './src/helpers';
import { streakContinues } from './src/dayRollover';
import { computeBudget, type BudgetPeriod, type TopUp } from './src/budget';
import { habitStats, type HabitSummary } from './src/habitStats';
import { logDueBills, type Bill } from './src/bills';
import { EMPTY_SAVINGS, leftoverOffer, parseSavings, storedSavings, type Savings, type SavingsJar } from './src/savings';
import { parseCustomCategories, setCustomCategories, type Category, type CustomCategory } from './src/categories';
import { CategoriesContext, type CategoriesValue } from './src/context/CategoriesContext';
import { focusMinutes, logFocus, nextBlock, parseFocusLog, parseFocusSession, pause as pauseFocus, resume as resumeFocus, settle, startBlock, type FocusLogEntry, type FocusSession } from './src/focus';
import { FocusSheet, type FocusDone } from './src/components/FocusSheet';
import { syncFocusActivity } from './src/utils/focusActivity';
import type { Jar } from './src/components/SavingsJar';
import notifee, { EventType } from '@notifee/react-native';
import { cancelAllNotifications, initNotifications, scheduleHabitNotifs, cancelHabitNotifs, cancelMidnightNotif, scheduleEveningCheckins, cancelEveningCheckins, scheduleBillReminders, scheduleWeeklyRecap, scheduleFocusNotifs, type Quiet } from './src/notifications';
import { recapWeek, weekSummary } from './src/weekSummary';
import { WeekRecapSheet, type WeekRecapData } from './src/components/WeekRecapSheet';
import { achievementById, newlyEarned, EARNED_BEFORE, type AchievementData, type Earned } from './src/achievements';
import { AchievementToast, type ToastItem } from './src/components/AchievementToast';
import { AchievementsSheet } from './src/components/AchievementsSheet';
import { STORAGE_COMMISSIONS, STORAGE_COMPLETION_HISTORY, STORAGE_FINANCE, STORAGE_FINANCE_HISTORY, STORAGE_ONBOARDED, STORAGE_SETTINGS, STORAGE_STATS, STORAGE_NOTIF_VERSION, STORAGE_TOPUPS, STORAGE_BILLS, STORAGE_SAVINGS, STORAGE_ACHIEVEMENTS, STORAGE_COACH_MESSAGES, STORAGE_CATEGORIES, STORAGE_FOCUS, STORAGE_FOCUS_LOG, ALL_STORAGE_KEYS } from './src/storage';
import type { Commission, CommissionsData, DailyTotal, EveningReminder, FinanceData, HabbitFormData, Settings, SpendingEntry, Stats, CompletionRecord, TabKey } from './src/types';

import { OnboardingScreen, HomeScreen, TasksScreen, FinanceScreen, ProfileScreen, SettingsScreen } from './src/screens';
import type { FinanceRequest } from './src/screens/FinanceScreen';
import { AddHabbitScreen } from './src/screens/AddHabbitScreen';
import { HabitDetailScreen } from './src/screens/HabitDetailScreen';
import { BottomNav } from './src/components/BottomNav';
import { CoachScreen } from "./src/screens/Coachscreen";

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
  focus:         data.focus ?? undefined,
});

/** The tab each link opens on. */
const LINK_TABS: Record<LinkTarget['screen'], TabKey> = {
  home: 'home', habits: 'tasks', 'new-habit': 'tasks', habit: 'tasks',
  finance: 'finance', spend: 'finance', 'add-money': 'finance', recap: 'finance', week: 'home',
  coach: 'chat', profile: 'profile', focus: 'home',
};

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
  const [bills, setBills]                         = useState<Bill[]>([]);
  const [savings, setSavings]                     = useState<Savings>(EMPTY_SAVINGS);
  const [customCategories, setCustomCats]         = useState<CustomCategory[]>([]);
  const [focusSession, setFocusSession]           = useState<FocusSession | null>(null);
  const focusRef                                  = useRef<FocusSession | null>(null);
  const [focusLog, setFocusLog]                   = useState<FocusLogEntry[]>([]);
  const focusLogRef                               = useRef<FocusLogEntry[]>([]);
  const [focusOpen, setFocusOpen]                 = useState(false);
  const [focusDone, setFocusDone]                 = useState<FocusDone | null>(null);
  const [currency, setCurrency]                 = useState(DEFAULT_CURRENCY);
  const [name, setName]                           = useState('Friend');
  const [avatar, setAvatar]                       = useState<string>(DEFAULT_AVATAR);
  const [stats, setStats]                         = useState<Stats>(defaultStats());
  const [completionHistory, setCompletionHistory] = useState<CompletionRecord[]>([]);
  const [eveningReminder, setEveningReminder]     = useState<EveningReminder>(DEFAULT_EVENING_REMINDER);
  const [weeklyRecap, setWeeklyRecap]             = useState(true);
  // The week the recap sheet is open on (its Monday), or null when closed.
  const [recapOpen, setRecapOpen]                 = useState<string | null>(null);

  // The day the in-memory state belongs to. Only advanced by catchUp, so data is
  // never written under a new date before the previous day has been rolled over.
  const [dayKey, setDayKey] = useState(getTodayKey);
  const hasLoaded    = useRef(false);
  // Set once loadAll has finished: queued events and links wait for it.
  const [ready, setReady] = useState(false);
  // Achievements earned (null until loaded), the unlock banners waiting to show, and the list.
  const [earned, setEarned]                 = useState<Earned | null>(null);
  const [toasts, setToasts]                 = useState<ToastItem[]>([]);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const earnedRef = useRef<Earned>({});
  earnedRef.current = earned ?? earnedRef.current;
  // No achievements saved yet: what's earned from past history is announced in one banner.
  const achievementsFirstRun = useRef(false);
  const [pendingLink, setPendingLink]       = useState<LinkTarget | null>(null);
  const [financeRequest, setFinanceRequest] = useState<FinanceRequest | null>(null);
  // Each habit's "done or skipped today" state as of the last reminder planning.
  const quietById    = useRef<Map<string, Quiet | null>>(new Map());
  const todayKey     = dayKey;
  const yesterdayKey = addDaysToKey(dayKey, -1);
  const dayDow       = parseDateKey(dayKey).getDay();

  const budget = useMemo(
    () => computeBudget({ period: budgetPeriod, amount: budgetAmount, todayKey: dayKey, spentToday, todayHistory, dailyTotals, topUps, bills }),
    [budgetPeriod, budgetAmount, dayKey, spentToday, todayHistory, dailyTotals, topUps, bills],
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
    syncWidgetData(widgetPayload({
      todayKey: dayKey, name, avatar, currency, streak: stats.currentStreak, commissions, history: completionHistory,
      thisWeek: c => habitStatsById[c.id]?.thisWeek ?? 0,
      budget: { period: budgetPeriod, amount: budgetAmount, spentToday, todayHistory, dailyTotals, topUps, bills },
    }));
  }, [dayKey, name, avatar, currency, stats.currentStreak, commissions, completionHistory, habitStatsById, budgetPeriod, budgetAmount, spentToday, todayHistory, dailyTotals, topUps, bills]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    updateWidget();
  }, [updateWidget]);

  // Latest state for catchUp, which runs from AppState/timer/inbox callbacks.
  const liveState = useRef({ dayKey, commissions, spentToday, todayHistory, dailyTotals, stats, completionHistory, bills });
  liveState.current = { dayKey, commissions, spentToday, todayHistory, dailyTotals, stats, completionHistory, bills };

  // Brings the app up to the current day and applies what Siri, Shortcuts and quick actions
  // did meanwhile (src/inbox.ts). iOS usually suspends the app instead of killing it, so
  // the load effect alone would miss midnight: this runs on resume, at midnight, and when
  // something is queued while the app is running.
  const catchUp = useCallback((events: InboxEvent[] = []) => {
    if (!hasLoaded.current) return;
    const s = liveState.current;
    const newKey = getTodayKey();
    if (newKey === s.dayKey && events.length === 0) return;

    const r = catchUpDay({
      habits: { date: s.dayKey, commissions: s.commissions, stats: s.stats, history: s.completionHistory },
      finance: { spentToday: s.spentToday, date: s.dayKey, history: s.todayHistory },
      dailyTotals: s.dailyTotals,
      bills: s.bills,
    }, newKey, events);

    setDayKey(newKey);
    if (r.financeChanged) {
      setSpentToday(r.finance.spentToday); setTodayHistory(r.finance.history); setDailyTotals(r.dailyTotals);
      AsyncStorage.setItem(STORAGE_FINANCE_HISTORY, JSON.stringify({ dailyTotals: r.dailyTotals })).catch(() => {});
      AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify(r.finance)).catch(() => {});
    }
    if (r.billsChanged) { setBills(r.bills); AsyncStorage.setItem(STORAGE_BILLS, JSON.stringify(r.bills)).catch(() => {}); }
    if (r.habitsChanged) setCommissions(r.commissions); // persisted by the commissions effect under the new dayKey
    if (r.stats !== s.stats) { setStats(r.stats); saveStats(r.stats); }
    if (r.history !== s.completionHistory) { setCompletionHistory(r.history); saveCompletionHistory(r.history); }
  }, [saveStats, saveCompletionHistory]);

  // ── Focus timer (focus.ts) ─────────────────────────────────────────────────
  /**
   * Saves the running session (or clears it), and plans its notifications and Live Activity.
   * `finished`: the session just finished the day's last block, for the activity to show.
   * `fromActivity`: paused or resumed on the Live Activity, which has already planned (or
   * removed) the notifications; replanning them here could leave none if the app is
   * suspended halfway.
   */
  const saveFocusSession = useCallback((next: FocusSession | null, finished?: FocusSession, fromActivity = false) => {
    focusRef.current = next;
    setFocusSession(next);
    (next ? AsyncStorage.setItem(STORAGE_FOCUS, JSON.stringify(next)) : AsyncStorage.removeItem(STORAGE_FOCUS)).catch(() => {});
    if (!fromActivity) scheduleFocusNotifs(next);
    if (!next && finished) syncFocusActivity(finished, true);
    else syncFocusActivity(next);
  }, []);

  /** Pause or resume pressed on the Live Activity (queued by the native side, as of `at`). */
  const applyFocusActions = useCallback((events: InboxEvent[]) => {
    for (const e of events) {
      const s = focusRef.current;
      if (e.kind !== 'focus' || !s || s.phase !== 'focus') continue;
      // Pressed after the block ran out: it's done, so it counts rather than pausing at 0:00.
      if (e.action === 'pause' && s.pausedLeft === undefined && e.at >= s.endsAt) continue;
      const next = e.action === 'pause' ? pauseFocus(s, e.at) : resumeFocus(s, e.at);
      if (next !== s) saveFocusSession(next, undefined, true);
    }
  }, [saveFocusSession]);

  const addFocusTime = useCallback((entry: FocusLogEntry) => {
    focusLogRef.current = logFocus(focusLogRef.current, entry);
    setFocusLog(focusLogRef.current);
    AsyncStorage.setItem(STORAGE_FOCUS_LOG, JSON.stringify(focusLogRef.current)).catch(() => {});
  }, []);

  /** "Study · 4 blocks · 1h 40m": the day's last block is done. */
  const finishFocus = useCallback((s: FocusSession) => {
    const day = getTodayKey();
    setFocusDone({ label: s.label, blocks: s.block, minutes: focusMinutes(focusLogRef.current, day, day, s.habitId) });
  }, []);

  /**
   * A block that has run out becomes a check-off (returned, for catchUp, so it counts on the
   * day it ended) and its minutes, then its break starts. Safe to call any time.
   */
  const settleFocus = useCallback((): InboxEvent[] => {
    const before = focusRef.current;
    const r = settle(before, Date.now(), getTodayKey());
    if (r.session === before) return [];
    if (r.logged) addFocusTime(r.logged);
    const finished = before && r.logged && !r.session ? before : undefined;
    if (finished) finishFocus(finished);
    saveFocusSession(r.session, finished);
    return r.events;
  }, [addFocusTime, finishFocus, saveFocusSession]);

  const startFocus = useCallback((habitId: string) => {
    const running = focusRef.current;
    if (running?.habitId === habitId) { setFocusOpen(true); return; }
    const habit = liveState.current.commissions.find(c => c.id === habitId);
    if (!habit?.focus) return;
    const focus = habit.focus;
    const begin = () => {
      setFocusDone(null);
      saveFocusSession(startBlock({ ...habit, focus }, Date.now(), generateId()));
      setFocusOpen(true);
    };
    if (!running) { begin(); return; }
    Alert.alert(`Stop the ${running.label} timer?`, 'One focus timer runs at a time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: `Start ${habit.label}`, onPress: begin },
    ]);
  }, [saveFocusSession]);

  const focusHandlers = useMemo(() => ({
    onPause:  () => { if (focusRef.current) saveFocusSession(pauseFocus(focusRef.current, Date.now())); },
    onResume: () => { if (focusRef.current) saveFocusSession(resumeFocus(focusRef.current, Date.now())); },
    onStop:   () => { saveFocusSession(null); setFocusOpen(false); },
    onNext:   () => {
      const s = focusRef.current;
      if (!s) return;
      const next = nextBlock(s, liveState.current.commissions.find(c => c.id === s.habitId), Date.now(), generateId());
      if (!next) finishFocus(s);
      saveFocusSession(next, next ? undefined : s);
    },
    onClose:  () => { setFocusOpen(false); setFocusDone(null); },
  }), [saveFocusSession, finishFocus]);

  const drainInbox = useCallback(async () => {
    if (!hasLoaded.current) return;
    const events = await takeInbox();
    applyFocusActions(events);
    catchUp([...events, ...settleFocus()]);
  }, [catchUp, settleFocus, applyFocusActions]);

  /** The block ran out with the app open. */
  const onFocusElapsed = useCallback(() => {
    if (hasLoaded.current) catchUp(settleFocus());
  }, [catchUp, settleFocus]);

  // Count the block when it runs out with the app open, even with the timer closed.
  useEffect(() => {
    if (!focusSession || focusSession.phase !== 'focus' || focusSession.pausedLeft !== undefined) return;
    const t = setTimeout(onFocusElapsed, Math.max(0, focusSession.endsAt - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [focusSession, onFocusElapsed]);


  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        flushWidgetData();
      } else if (state === 'active' && hasLoaded.current) {
        drainInbox();
        updateWidget();
        flushWidgetData();
      }
    });
    return () => sub.remove();
  }, [updateWidget, drainInbox]);

  // Roll over at midnight while the app is open in the foreground.
  useEffect(() => {
    const next = new Date(); next.setHours(24, 0, 1, 0);
    const timer = setTimeout(drainInbox, next.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [dayKey, drainInbox]);

  // Loads everything from storage. Runs at launch and again after restoring a backup.
  const loadAll = useCallback(async () => {
    const todayKey = getTodayKey();
    setDayKey(todayKey);
    let loadedName = 'Friend';
    let loadedCurrency = DEFAULT_CURRENCY;
    let loadedPeriod: BudgetPeriod = 'daily';
    let loadedAmount = DEFAULT_BUDGET;
    let loadedTopUps: TopUp[] = [];
    let loadedBills: Bill[] = [];
    let loadedTodayHistory: SpendingEntry[] = [];
    let loadedTotals: DailyTotal[] = [];
    let loadedSpent = 0;
    let loadedAvatar: string = DEFAULT_AVATAR;
    let migrated: Commission[] = [];
    let loadedStats = defaultStats();
    let loadedHistory: CompletionRecord[] = [];
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
        setWeeklyRecap(s.weeklyRecap ?? true);
      }
      scheduleWeeklyRecap(storedS ? JSON.parse(storedS).weeklyRecap ?? true : true);

      const storedCH = await AsyncStorage.getItem(STORAGE_COMPLETION_HISTORY);
      const storedSt = await AsyncStorage.getItem(STORAGE_STATS);
      const storedH  = await AsyncStorage.getItem(STORAGE_FINANCE_HISTORY);
      const storedF  = await AsyncStorage.getItem(STORAGE_FINANCE);
      const storedB  = await AsyncStorage.getItem(STORAGE_BILLS);
      const storedC  = await AsyncStorage.getItem(STORAGE_COMMISSIONS);
      const storedCommissions: CommissionsData | null = storedC ? JSON.parse(storedC) : null;
      const storedFinance: FinanceData = storedF ? JSON.parse(storedF) : { spentToday: 0, date: todayKey, history: [] };
      const stored = {
        habits: {
          date:        storedCommissions?.date ?? todayKey,
          commissions: storedCommissions ? migrateCommissions(storedCommissions.items) : [],
          stats:       storedSt ? JSON.parse(storedSt) as Stats : defaultStats(),
          history:     storedCH ? JSON.parse(storedCH) as CompletionRecord[] : [],
        },
        finance:     { ...storedFinance, history: storedFinance.history ?? [] },
        dailyTotals: (storedH ? JSON.parse(storedH).dailyTotals : null) ?? [],
        bills:       storedB ? JSON.parse(storedB) as Bill[] : [],
      };

      // The focus timer: a block that ran out while the app was closed counts below.
      const storedFL = await AsyncStorage.getItem(STORAGE_FOCUS_LOG);
      focusLogRef.current = parseFocusLog(storedFL ? JSON.parse(storedFL) : []);
      setFocusLog(focusLogRef.current);
      const storedFS = await AsyncStorage.getItem(STORAGE_FOCUS);
      focusRef.current = parseFocusSession(storedFS ? JSON.parse(storedFS) : null);
      setFocusSession(focusRef.current);
      const inbox = await takeInbox();
      applyFocusActions(inbox);
      const unsettled = focusRef.current;
      const focusEvents = settleFocus();
      // Settling updates the Live Activity itself; otherwise bring it in step (or end a stray one).
      if (focusRef.current === unsettled) syncFocusActivity(focusRef.current);

      // Up to today: the new day, bills that came due, and what Siri and quick actions did.
      const day = catchUpDay(stored, todayKey, [...inbox, ...focusEvents]);

      loadedTotals = day.dailyTotals; loadedSpent = day.finance.spentToday; loadedTodayHistory = day.finance.history; loadedBills = day.bills;
      setSpentToday(loadedSpent); setTodayHistory(loadedTodayHistory); setBills(loadedBills); setDailyTotals(loadedTotals);
      if (day.financeChanged) {
        await AsyncStorage.setItem(STORAGE_FINANCE_HISTORY, JSON.stringify({ dailyTotals: loadedTotals }));
        await AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify(day.finance));
      }
      if (day.billsChanged) await AsyncStorage.setItem(STORAGE_BILLS, JSON.stringify(loadedBills));
      scheduleBillReminders(loadedBills, loadedCurrency);
      const storedA = await AsyncStorage.getItem(STORAGE_ACHIEVEMENTS);
      const savedAchievements: { earned?: Earned } | null = storedA ? JSON.parse(storedA) : null;
      achievementsFirstRun.current = !savedAchievements?.earned;
      earnedRef.current = savedAchievements?.earned ?? {};
      setEarned(earnedRef.current);
      const storedSv = await AsyncStorage.getItem(STORAGE_SAVINGS);
      setSavings(parseSavings(storedSv ? JSON.parse(storedSv) : null));
      const storedCats = await AsyncStorage.getItem(STORAGE_CATEGORIES);
      const loadedCats = parseCustomCategories(storedCats ? JSON.parse(storedCats) : []);
      setCustomCategories(loadedCats);
      setCustomCats(loadedCats);
      const storedT = await AsyncStorage.getItem(STORAGE_TOPUPS);
      loadedTopUps  = storedT ? JSON.parse(storedT) as TopUp[] : [];
      setTopUps(loadedTopUps);

      migrated = day.commissions; loadedStats = day.stats; loadedHistory = day.history;
      newDay = day.newDay;
      setCommissions(migrated);
      if (day.habitsChanged) await AsyncStorage.setItem(STORAGE_COMMISSIONS, JSON.stringify({ items: migrated, date: todayKey }));
      // Re-plan every habit's reminders on a new day, so habits that were done or skipped
      // (and so quiet) yesterday get their repeating reminders back. v3 re-plans once for
      // everyone: quiet reminders are new, and older versions never scheduled split ones.
      const quietNow = quietMap(migrated, loadedHistory, todayKey);
      if (newDay || (await AsyncStorage.getItem(STORAGE_NOTIF_VERSION)) !== '3') {
        for (const c of migrated) await scheduleHabitNotifs(c, quietNow.get(c.id) ?? null);
        await AsyncStorage.setItem(STORAGE_NOTIF_VERSION, '3');
      } else if (day.habitsChanged) {
        // Check-offs from a widget or Siri: quiet those habits' reminders as a tap would.
        const quietBefore = quietMap(stored.habits.commissions, stored.habits.history, todayKey);
        for (const c of migrated) {
          if ((quietBefore.get(c.id) ?? null) !== (quietNow.get(c.id) ?? null)) await scheduleHabitNotifs(c, quietNow.get(c.id) ?? null);
        }
      }
      quietById.current = quietNow;
      setStats(loadedStats); saveStats(loadedStats);
      setCompletionHistory(loadedHistory); saveCompletionHistory(loadedHistory);
    } catch { setIsOnboarded(true); }
    finally { 
      hasLoaded.current = true; 
      syncWidgetData(widgetPayload({
        todayKey, name: loadedName, avatar: loadedAvatar, currency: loadedCurrency, streak: loadedStats.currentStreak,
        commissions: migrated, history: loadedHistory, thisWeek: c => habitStats(c, loadedHistory, todayKey).thisWeek,
        budget: { period: loadedPeriod, amount: loadedAmount, spentToday: loadedSpent, todayHistory: loadedTodayHistory, dailyTotals: loadedTotals, topUps: loadedTopUps, bills: loadedBills },
      }));
      setReady(true);
    }
  }, [saveStats, saveCompletionHistory, settleFocus, applyFocusActions]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Anything queued while loadAll was running.
  useEffect(() => { if (ready) drainInbox(); }, [ready, drainInbox]);

  // ── Links: quick actions, Shortcuts and habbit:// URLs (src/links.ts) ──────
  const openLater = useCallback((url: string | null) => { const t = url ? parseLink(url) : null; if (t) setPendingLink(t); }, []);
  const takeLeftLink = useCallback(() => { takeLink().then(openLater); }, [openLater]);
  useEffect(() => {
    Linking.getInitialURL().then(openLater).catch(() => {});
    takeLeftLink();
    const sub = Linking.addEventListener('url', ({ url }) => openLater(url));
    return () => sub.remove();
  }, [openLater, takeLeftLink]);

  // A notification with a link (the Sunday recap) was tapped.
  useEffect(() => {
    const linkOf = (n?: { data?: Record<string, unknown> }) => (typeof n?.data?.link === 'string' ? n.data.link : null);
    notifee.getInitialNotification().then(n => openLater(linkOf(n?.notification))).catch(() => {});
    return notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) openLater(linkOf(detail.notification));
    });
  }, [openLater]);

  // Siri or Shortcuts queued something, or left a link, while the app is running.
  useEffect(() => onInboxChanged(() => { drainInbox(); takeLeftLink(); }), [drainInbox, takeLeftLink]);
  // A Control Center or Lock Screen button runs in the widget extension and can't tell a
  // running app, so look again whenever the app comes to the front.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') takeLeftLink(); });
    return () => sub.remove();
  }, [takeLeftLink]);

  // Opened once loaded; ignored before onboarding.
  useEffect(() => {
    if (!pendingLink || !ready) return;
    const t = pendingLink;
    setPendingLink(null);
    if (!isOnboardedRef.current) return;
    setActiveTab(LINK_TABS[t.screen]);
    setTasksSubScreen(
      t.screen === 'new-habit' ? { mode: 'add' }
      : t.screen === 'habit' && liveState.current.commissions.some(c => c.id === t.id) ? { mode: 'detail', id: t.id }
      : null,
    );
    if (t.screen === 'week') setRecapOpen(recapWeek(liveState.current.dayKey));
    if (t.screen === 'focus') setFocusOpen(true);
    setFinanceRequest(
      t.screen === 'spend' ? { kind: 'spend', amount: t.amount, category: t.category, note: t.note }
      : t.screen === 'add-money' ? { kind: 'money' }
      : t.screen === 'recap' ? { kind: 'recap' }
      : null,
    );
  }, [pendingLink, ready]);

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
    setBills([]);
    setSavings(EMPTY_SAVINGS);
    setCustomCategories([]); setCustomCats([]);
    focusRef.current = null; setFocusSession(null); setFocusOpen(false); setFocusDone(null);
    focusLogRef.current = []; setFocusLog([]);
    AsyncStorage.removeItem(STORAGE_FOCUS).catch(() => {});
    setCurrency(DEFAULT_CURRENCY);
    setName('Friend');
    setAvatar(DEFAULT_AVATAR);
    setStats(defaultStats());
    setCompletionHistory([]);
    setEveningReminder(DEFAULT_EVENING_REMINDER);
    setWeeklyRecap(true);
    setRecapOpen(null);
    setEarned(null); earnedRef.current = {};
    setToasts([]); setAchievementsOpen(false);
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
    scheduleWeeklyRecap(true);
    achievementsFirstRun.current = false; earnedRef.current = {}; setEarned({});
    AsyncStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify({ earned: {} })).catch(() => {});
    hasLoaded.current = true; setIsOnboarded(true); setReady(true);
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
  }, [commissions, ready]);

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
  // ── Bills ────────────────────────────────────────────────────────────────
  const saveBills = useCallback((b: Bill[]) => AsyncStorage.setItem(STORAGE_BILLS, JSON.stringify(b)).catch(() => {}), []);

  /** Adds (no id) or updates a bill, logging it straight away if it's due today. */
  const handleSaveBill = useCallback((data: Omit<Bill, 'id' | 'startDate' | 'lastLogged'>, id?: string) => {
    const s = liveState.current;
    const yesterday = addDaysToKey(s.dayKey, -1);
    const next: Bill[] = id
      // An edit never logs past dates under the new schedule.
      ? s.bills.map(b => (b.id === id ? { ...b, ...data, lastLogged: b.lastLogged && b.lastLogged > yesterday ? b.lastLogged : yesterday } : b))
      : [...s.bills, { id: generateId(), ...data, startDate: s.dayKey }];
    const fin = logDueBills(next, { spentToday: s.spentToday, date: s.dayKey, history: s.todayHistory }, s.dailyTotals, s.dayKey);
    setBills(fin.bills); saveBills(fin.bills);
    if (fin.changed) {
      setSpentToday(fin.finance.spentToday); setTodayHistory(fin.finance.history); setDailyTotals(fin.dailyTotals);
      AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify(fin.finance)).catch(() => {});
      AsyncStorage.setItem(STORAGE_FINANCE_HISTORY, JSON.stringify({ dailyTotals: fin.dailyTotals })).catch(() => {});
    }
    scheduleBillReminders(fin.bills, currency);
  }, [saveBills, currency]);

  /** Past payments stay in the history. */
  const handleDeleteBill = useCallback((id: string) => {
    const next = liveState.current.bills.filter(b => b.id !== id);
    setBills(next); saveBills(next);
    scheduleBillReminders(next, currency);
  }, [saveBills, currency]);

  // ── Savings jar ──────────────────────────────────────────────────────────
  const updateSavings = useCallback((fn: (s: Savings) => Savings) => {
    setSavings(prev => {
      const next = fn(prev);
      AsyncStorage.setItem(STORAGE_SAVINGS, JSON.stringify(storedSavings(next))).catch(() => {});
      return next;
    });
  }, []);

  // ── Custom spending categories (Pro to add; categories.ts) ──────────────
  const updateCategories = useCallback((fn: (list: CustomCategory[]) => CustomCategory[]) => {
    setCustomCats(prev => {
      const next = fn(prev);
      setCustomCategories(next); // before the re-render, so categoryOf sees the change
      AsyncStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const categoriesValue: CategoriesValue = useMemo(() => ({
    custom: customCategories,
    save: (c: Category) => {
      // A new one named like a removed one brings that back, so its old expenses join up.
      const isNew   = !customCategories.some(k => k.key === c.key);
      const revived = isNew ? customCategories.find(k => k.archived && k.label.toLowerCase() === c.label.toLowerCase()) : undefined;
      const key     = revived?.key ?? c.key;
      const saved: CustomCategory = { key, label: c.label, emoji: c.emoji, color: c.color };
      updateCategories(list => (list.some(k => k.key === key) ? list.map(k => (k.key === key ? saved : k)) : [...list, saved]));
      return key;
    },
    remove: (key: string) => updateCategories(list => list.map(k => (k.key === key ? { ...k, archived: true } : k))),
  }), [customCategories, updateCategories]);

  // What was left of last week's or month's budget, offered once.
  const offer = useMemo(
    () => leftoverOffer({ period: budgetPeriod, amount: budgetAmount, todayKey: dayKey, dailyTotals, topUps, bills, lastOffered: savings.lastOffered }),
    [budgetPeriod, budgetAmount, dayKey, dailyTotals, topUps, bills, savings.lastOffered],
  );

  const jar: Jar = useMemo(() => {
    const entry = (amount: number, kind: 'leftover' | 'deposit' | 'withdraw', note?: string) =>
      ({ id: generateId(), amount, date: dayKey, kind, ...(note ? { note } : {}) });
    const inJar = (id: string, fn: (j: SavingsJar) => SavingsJar) => (s: Savings): Savings =>
      ({ ...s, jars: s.jars.map(j => (j.id === id ? fn(j) : j)) });
    return {
      savings,
      offer,
      saveJar: (id, goal) => {
        if (id) { updateSavings(inJar(id, j => ({ ...j, goal: { ...goal, createdAt: j.goal.createdAt } }))); return id; }
        const newId = `jar-${generateId()}`;
        updateSavings(s => ({ ...s, jars: [...s.jars, { id: newId, goal: { ...goal, createdAt: dayKey }, entries: [] }] }));
        return newId;
      },
      deleteJar: id => updateSavings(s => ({ ...s, jars: s.jars.filter(j => j.id !== id) })),
      add:       (id, amount, note) => updateSavings(inJar(id, j => ({ ...j, entries: [...j.entries, entry(amount, 'deposit', note)] }))),
      takeOut:   (id, amount, note) => updateSavings(inJar(id, j => ({ ...j, entries: [...j.entries, entry(-amount, 'withdraw', note)] }))),
      takeOffer: id => {
        if (!offer) return;
        const put = inJar(id, j => ({ ...j, entries: [...j.entries, entry(offer.amount, 'leftover', `Left over ${offer.label}`)] }));
        updateSavings(s => ({ ...put(s), lastOffered: offer.periodStart }));
      },
      skipOffer: () => { if (offer) updateSavings(s => ({ ...s, lastOffered: offer.periodStart })); },
    };
  }, [savings, offer, dayKey, updateSavings]);

  const handleSetCurrency         = useCallback((v: string)  => { setCurrency(v); saveSettings({ currency: v }); }, []);
  const handleSetName             = useCallback((v: string)  => { setName(v); saveSettings({ name: v }); }, []);
  const handleSetAvatar           = useCallback((v: string)  => { setAvatar(v); saveSettings({ avatar: v }); }, []);
  const handleSetWeeklyRecap = useCallback((v: boolean) => {
    setWeeklyRecap(v); saveSettings({ weeklyRecap: v }); scheduleWeeklyRecap(v);
  }, [saveSettings]);

  // ── Sunday recap ─────────────────────────────────────────────────────────
  const weekData: WeekRecapData = useMemo(() => ({
    todayKey: dayKey, commissions, history: completionHistory, dailyTotals, todayHistory, spentToday, topUps, bills, savings, focusLog,
    budgetPeriod, budgetAmount, currency, name, streak: stats.currentStreak,
  }), [dayKey, commissions, completionHistory, dailyTotals, todayHistory, spentToday, topUps, bills, savings, focusLog, budgetPeriod, budgetAmount, currency, name, stats.currentStreak]);

  // ── Achievements ─────────────────────────────────────────────────────────
  const achievementData: AchievementData = useMemo(() => ({
    todayKey: dayKey, stats, history: completionHistory, commissions, dailyTotals, todayHistory, spentToday, topUps, bills, savings,
    budgetPeriod, budgetAmount,
  }), [dayKey, stats, completionHistory, commissions, dailyTotals, todayHistory, spentToday, topUps, bills, savings, budgetPeriod, budgetAmount]);

  /** Saves newly earned achievements and announces them (several from past history in one banner). */
  const award = useCallback((ids: string[], fromHistory = false) => {
    const fresh = ids.filter(id => !earnedRef.current[id] && achievementById(id));
    if (fresh.length === 0) return;
    const when = fromHistory ? EARNED_BEFORE : liveState.current.dayKey;
    const next = { ...earnedRef.current, ...Object.fromEntries(fresh.map(id => [id, when])) };
    earnedRef.current = next;
    setEarned(next);
    AsyncStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify({ earned: next })).catch(() => {});
    haptic.success();
    setToasts(q => [...q, ...(fromHistory && fresh.length > 1
      ? [{ key: `history-${fresh.length}`, emoji: '🏅', title: `${fresh.length} achievements earned`, subtitle: 'From everything you’ve done so far. Tap to see them.', plural: true }]
      : fresh.map(id => { const a = achievementById(id)!; return { key: id, emoji: a.emoji, title: a.title, subtitle: typeof a.description === 'string' ? a.description : a.description(achievementData) }; }))]);
  }, [achievementData]);

  // Checked a moment after anything changes, so a burst of taps is checked once.
  useEffect(() => {
    if (!ready || earned === null || !isOnboarded) return;
    const t = setTimeout(async () => {
      const ids = newlyEarned(achievementData, earnedRef.current);
      if (!achievementsFirstRun.current) { award(ids); return; }
      achievementsFirstRun.current = false;
      // Chats from before achievements existed count too.
      const chats = await AsyncStorage.getItem(STORAGE_COACH_MESSAGES).catch(() => null);
      try { if ((JSON.parse(chats ?? '[]') as { from?: string }[]).some(m => m.from === 'user')) ids.push('hello-bonbon'); } catch {}
      if (ids.length > 0) award(ids, true);
      else AsyncStorage.setItem(STORAGE_ACHIEVEMENTS, JSON.stringify({ earned: earnedRef.current })).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [ready, earned, isOnboarded, achievementData, award]);

  // On Home from Sunday evening (this week) through Monday (last week).
  const homeRecap = useMemo(() => {
    const dow = parseDateKey(dayKey).getDay();
    if (!(dow === 1 || (dow === 0 && new Date().getHours() >= 18))) return null;
    const s = weekSummary(recapWeek(dayKey), weekData);
    const parts = [
      s.habits.trackedDays > 0 ? `${s.habits.perfectDays} of ${s.habits.trackedDays} perfect days` : null,
      s.money.spent > 0 ? `${currencyStr(currency, s.money.spent.toLocaleString('en-US', { maximumFractionDigits: 2 }))} spent` : null,
    ].filter(Boolean);
    if (parts.length === 0) return null;
    return { title: dow === 0 ? 'Your week in review' : 'Last week in review', detail: parts.join(' · ') };
  }, [dayKey, weekData, currency]);

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
    if (focusRef.current?.habitId === id) saveFocusSession(null);
    setTasksSubScreen(null);
  }, [saveFocusSession]);

  const handleSetEntryCategory = useCallback((id: string, category: string | undefined) => {
    setTodayHistory(prev => {
      const updated = prev.map(e => (e.id === id ? { ...e, category } : e));
      AsyncStorage.setItem(STORAGE_FINANCE, JSON.stringify({ spentToday: liveState.current.spentToday, date: todayKey, history: updated })).catch(() => {});
      return updated;
    });
  }, [todayKey]);

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

  const handleFinanceAddSpend = useCallback((amount: string, note?: string, category?: string) => {
    const toAdd = parseFloat(amount || '0');
    if (toAdd <= 0) return;
    const entry: SpendingEntry = { id: generateId(), amount: toAdd, time: formatTime(), note, ...(category ? { category } : {}) };
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
            jar={jar}
            weekRecap={homeRecap}
            onOpenWeekRecap={() => setRecapOpen(recapWeek(todayKey))}
            focusSession={focusSession}
            onStartFocus={startFocus}
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
              focusLog={focusLog}
              focusRunning={focusSession?.habitId === detailHabit.id}
              onStartFocus={() => startFocus(detailHabit.id)}
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
            onSetEntryCategory={handleSetEntryCategory}
            todayKey={todayKey}
            bills={bills}
            onSaveBill={handleSaveBill}
            onDeleteBill={handleDeleteBill}
            jar={jar}
            topUps={topUps}
            completionHistory={completionHistory}
            onAddSpending={handleFinanceAddSpend}
            request={financeRequest}
            onRequestHandled={() => setFinanceRequest(null)}
          />
        );

      case 'chat':
        return <CoachScreen name={name} streak={stats.currentStreak} budget={budget} onChatted={() => award(['hello-bonbon'])} />;

      case 'profile':
        return (  
          <ProfileScreen
            name={name} avatar={avatar} stats={stats}
            completionHistory={completionHistory} todayKey={todayKey}
            onSetName={handleSetName} onSetAvatar={handleSetAvatar}
            onOpenSettings={() => setActiveTab('settings')}
            onOpenWeekRecap={() => setRecapOpen(recapWeek(todayKey))}
            earned={earned ?? {}}
            onOpenAchievements={() => setAchievementsOpen(true)}
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
            weeklyRecap={weeklyRecap}
            onSetWeeklyRecap={handleSetWeeklyRecap}
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
      <CategoriesContext.Provider value={categoriesValue}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#2A1A18', paddingTop: Platform.OS === 'ios' ? 58 : 28 }}>
            <StatusBar barStyle="light-content" backgroundColor="#3B2220" />
            <View style={{ flex: 1 }}>{renderScreen()}</View>
            {/* Closing a recap (not opening it) earns "Look Back", so its banner isn't hidden behind the sheet. */}
            <WeekRecapSheet visible={recapOpen !== null} initialWeek={recapOpen ?? todayKey} data={weekData} onClose={() => { setRecapOpen(null); award(['look-back']); }} />
            <AchievementsSheet visible={achievementsOpen} earned={earned ?? {}} data={achievementData} onClose={() => setAchievementsOpen(false)} />
            <FocusSheet
              visible={focusOpen && (!!focusSession || !!focusDone)}
              session={focusSession} done={focusDone} avatar={avatar}
              doneSoFar={commissions.find(c => c.id === focusSession?.habitId)?.completionCount ?? 0}
              todayMinutes={focusMinutes(focusLog, todayKey, todayKey)}
              {...focusHandlers}
              onElapsed={onFocusElapsed}
            />
            {toasts.length > 0 && (
              <AchievementToast item={toasts[0]} avatar={avatar} onPress={() => setAchievementsOpen(true)} onDone={() => setToasts(q => q.slice(1))} />
            )}
            {showBottomNav && <BottomNav active={activeTab} onPress={setActiveTab} avatar={avatar} />}
          </View>
        </SafeAreaProvider>
      </CategoriesContext.Provider>
      </SettingsProvider>
    </ProProvider>  
  );
}