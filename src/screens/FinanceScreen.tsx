import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, Animated, PanResponder } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { getLast7Days, currencyStr, addDaysToKey } from '../helpers';
import { useNavHeight } from '../hooks/useNavHeight';
import { NumpadModal } from '../components/NumpadModal';
import { WeeklyChart } from '../components/WeeklyChart';
import type { SpendingEntry, DailyTotal, ChartDay, CompletionRecord } from '../types';
import { useFontSize } from '../hooks/useFontSize';
import { CurrencyAmount } from '../components/CurrencyAmount';
import { PERIOD_LABELS, periodStart, type BudgetPeriod, type BudgetState, type TopUp } from '../budget';
import { UNCATEGORIZED, categoryOf, spendingByCategory } from '../categories';
import { CategoryGrid } from '../components/CategoryGrid';
import { BillEditor, dueLabel, type BillFormData } from '../components/BillEditor';
import { billScheduleLabel, upcomingDueDate, type Bill } from '../bills';
import { LeftoverBanner, SavingsJars, type Jar } from '../components/SavingsJar';
import { MonthSummarySheet, type MonthSummaryData } from '../components/MonthSummarySheet';
import { monthLabel, monthStart } from '../monthSummary';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        HAPTIC_OPTIONS),
  error:   () => ReactNativeHapticFeedback.trigger('notificationError',   HAPTIC_OPTIONS),
  warning: () => ReactNativeHapticFeedback.trigger('notificationWarning', HAPTIC_OPTIONS),
};

const C = {
  cream:  '#e8d5c0',
  accent: '#D4956A',
  card:   '#5C3D2E',
  green:  '#9de087',
  red:    '#f09090',
  amber:  '#f5c26b',
  muted:  'rgba(232,213,192,0.55)',
  border: 'rgba(212,149,106,0.18)',
};

// ─── Number formatter ─────────────────────────────────────────────────────────
const fmt = (n: number): string => {
  if (n >= 1_000_000) {
    const stepped = Math.floor((n / 1_000_000) * 10) / 10;
    return `${stepped.toFixed(1)}M`;
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const barColor = (ratio: number): string => (ratio > 1 ? C.red : ratio > 0.8 ? C.amber : C.accent);

const PERIOD_HINTS: Record<BudgetPeriod, string> = {
  daily:   'Resets every day at midnight.',
  weekly:  'Monday to Sunday. Your daily allowance adjusts as you spend.',
  monthly: '1st to end of month. Your daily allowance adjusts as you spend.',
};

const Bar = ({ ratio, height = 10 }: { ratio: number; height?: number }) => (
  <View style={{ height, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden' }}>
    <View style={{ height: '100%', borderRadius: 99, width: `${Math.max(0, Math.min(ratio, 1)) * 100}%`, backgroundColor: barColor(ratio) }} />
  </View>
);

// Unified row for today's activity: spending (−) and money added (+).
type ActivityRow =
  | { kind: 'spend'; id: string; amount: number; time: string; note?: string; category?: string; billId?: string }
  | { kind: 'topup'; id: string; amount: number; time?: string; note?: string };

/** Something to open on arrival, asked for by a link (src/links.ts). */
export type FinanceRequest =
  | { kind: 'spend'; amount?: string; category?: string; note?: string }
  | { kind: 'money' }
  | { kind: 'recap' };

/** "Coffee" (note), else the category's name, else "Spending". */
const entryTitle = (e: { note?: string; category?: string }) => e.note || categoryOf(e.category)?.label || 'Spending';

export const FinanceScreen = ({
  spentToday, todayHistory, dailyTotals, budget, budgetAmount, topUpsToday, currency, todayKey,
  onSetBudget, onAddMoney, onUndoTopUp, onAddSpending, onUndoEntry, onSetEntryCategory,
  bills, onSaveBill, onDeleteBill, jar, topUps, completionHistory, request, onRequestHandled,
}: {
  spentToday: number;
  todayHistory: SpendingEntry[];
  dailyTotals: DailyTotal[];
  budget: BudgetState;
  budgetAmount: number;
  topUpsToday: TopUp[];
  currency: string;
  todayKey: string;
  onSetBudget: (period: BudgetPeriod, amount: number) => void;
  onAddMoney: (amount: string, note?: string) => void;
  onUndoTopUp: (id: string) => void;
  onAddSpending: (amount: string, note?: string, category?: string) => void;
  onUndoEntry: (id: string) => void;
  onSetEntryCategory: (id: string, category: string | undefined) => void;
  bills: Bill[];
  onSaveBill: (data: BillFormData, id?: string) => void;
  onDeleteBill: (id: string) => void;
  jar: Jar;
  topUps: TopUp[];
  completionHistory: CompletionRecord[];
  request?: FinanceRequest | null;
  onRequestHandled?: () => void;
}) => {
  const navHeight = useNavHeight();
  const fs = useFontSize();

  // ── modal states ──────────────────────────────────────────────────────────
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [editPeriod, setEditPeriod]   = useState<BudgetPeriod>(budget.period);
  const [spendModal,  setSpendModal]  = useState(false);
  const [spendInput,  setSpendInput]  = useState('');
  const [spendPrefill, setSpendPrefill] = useState<{ note?: string; category?: string }>({});
  const [moneyModal,  setMoneyModal]  = useState(false);
  const [moneyInput,  setMoneyInput]  = useState('');
  const [selectedDay, setSelectedDay] = useState<ChartDay | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  // null: closed; 'new': adding; otherwise the bill being edited.
  const [billEditor, setBillEditor]   = useState<Bill | 'new' | null>(null);
  const [summaryMonth, setSummaryMonth] = useState<string | null>(null);
  const summaryData: MonthSummaryData = useMemo(() => ({
    todayKey, dailyTotals, todayHistory, spentToday, topUps, bills, savings: jar.savings,
    history: completionHistory, budgetPeriod: budget.period, budgetAmount, currency,
  }), [todayKey, dailyTotals, todayHistory, spentToday, topUps, bills, jar.savings, completionHistory, budget.period, budgetAmount, currency]);
  // Early in a month, point at last month's finished recap.
  const recapLastMonth = Number(todayKey.slice(8)) <= 7 && dailyTotals.some(d => d.date >= monthStart(todayKey, -1) && d.date < monthStart(todayKey));
  const recapMonth     = recapLastMonth ? monthStart(todayKey, -1) : monthStart(todayKey);
  // A link asked for something. Whatever's open closes first, and the new one opens a
  // moment later: iOS can't present a sheet while another is closing.
  useEffect(() => {
    if (!request) return;
    setBudgetModal(false); setMoneyModal(false); setSpendModal(false);
    setSelectedDay(null); setEditingId(null); setBillEditor(null); setSummaryMonth(null);
    const timer = setTimeout(() => {
      onRequestHandled?.();
      if (request.kind === 'spend') {
        setSpendInput(request.amount ?? '');
        setSpendPrefill({ note: request.note, category: request.category });
        setSpendModal(true);
      } else if (request.kind === 'money') {
        setMoneyInput(''); setMoneyModal(true);
      } else {
        setSummaryMonth(recapMonth);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [request]);

  const sortedBills = bills
    .map(b => ({ bill: b, next: upcomingDueDate(b, todayKey) ?? '9999' }))
    .sort((a, b) => a.next.localeCompare(b.next));
  const editing = editingId ? todayHistory.find(e => e.id === editingId) ?? null : null;

  // ── derived values ────────────────────────────────────────────────────────
  const period       = budget.period;
  const noun         = PERIOD_LABELS[period].noun;
  const isDaily      = period === 'daily';
  const leftToday    = budget.leftToday;
  const isOverToday  = leftToday < 0;
  const todayRatio   = budget.dailyAllowance > 0 ? budget.spentToday / budget.dailyAllowance : budget.spentToday > 0 ? 2 : 0;
  const periodRatio  = budget.periodBudget > 0 ? budget.periodSpent / budget.periodBudget : 0;
  const chartDays    = getLast7Days(dailyTotals, spentToday);
  const weekTotal    = chartDays.reduce((s, d) => s + d.total, 0);
  const pastDays     = dailyTotals.filter(d => d.total > 0);
  const avgSpend     = pastDays.length > 0 ? pastDays.reduce((s, d) => s + d.total, 0) / pastDays.length : null;

  const activity: ActivityRow[] = [
    ...todayHistory.map(e => ({ kind: 'spend' as const, ...e })),
    ...topUpsToday.map(t => ({ kind: 'topup' as const, ...t })),
  ].sort((a, b) => b.id.localeCompare(a.id)); // ids start with a timestamp → newest first

  // Where the money went in this budget period (the last 7 days for daily budgets).
  const breakdownFrom  = isDaily ? addDaysToKey(todayKey, -6) : periodStart(period, todayKey);
  const breakdown      = spendingByCategory(dailyTotals, todayHistory, breakdownFrom, todayKey);
  const breakdownLabel = isDaily ? 'Last 7 days' : `This ${noun}`;

  const selectedEntries: SpendingEntry[] = selectedDay
    ? selectedDay.isToday
      ? todayHistory
      : (dailyTotals.find(d => d.date === selectedDay.date)?.entries ?? [])
    : [];

  // ── handlers ──────────────────────────────────────────────────────────────
  const openBudgetEditor = () => {
    haptic.medium();
    setEditPeriod(period);
    setBudgetInput('');
    setBudgetModal(true);
  };

  const removeEntry = (id: string) => {
    const entry = todayHistory.find(e => e.id === id);
    if (!entry) return;
    haptic.warning();
    Alert.alert('Remove entry', `Remove ${currencyStr(currency, fmt(entry.amount))} (${entryTitle(entry)}) from today?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { haptic.error(); setEditingId(null); onUndoEntry(id); } },
    ]);
  };

  const handleUndo = (row: ActivityRow) => {
    haptic.warning();
    const what = row.kind === 'spend' ? 'spending' : 'added money';
    Alert.alert(
      'Undo entry',
      `Remove ${currencyStr(currency, fmt(row.amount))} of ${what}${row.time ? ` from ${row.time}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo', style: 'destructive', onPress: () => {
          haptic.error();
          if (row.kind === 'spend') onUndoEntry(row.id); else onUndoTopUp(row.id);
        } },
      ],
    );
  };

  // ── bottom sheet pan responder ────────────────────────────────────────────
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) sheetTranslateY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80 || g.vy > 0.5) {
        Animated.timing(sheetTranslateY, { toValue: 600, duration: 220, useNativeDriver: true })
          .start(() => { setSelectedDay(null); sheetTranslateY.setValue(0); });
      } else {
        Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start();
      }
    },
    onPanResponderTerminate: () =>
      Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }).start(),
  })).current;

  const label = { fontFamily: 'Jua', fontSize: fs(12), color: C.muted } as const;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Budget editor: period + amount ── */}
      <NumpadModal
        visible={budgetModal}
        title="Your budget"
        hint={PERIOD_HINTS[editPeriod]}
        confirmLabel={`Set ${PERIOD_LABELS[editPeriod].adjective.toLowerCase()} budget to`}
        amount={budgetInput}
        currency={currency}
        onChangeAmount={setBudgetInput}
        onConfirm={() => { onSetBudget(editPeriod, parseFloat(budgetInput || '0')); setBudgetInput(''); setBudgetModal(false); }}
        onClose={() => { setBudgetModal(false); setBudgetInput(''); }}
        headerExtra={
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(212,149,106,0.1)', borderRadius: 12, padding: 3 }}>
            {(['daily', 'weekly', 'monthly'] as const).map(p => {
              const active = p === editPeriod;
              return (
                <TouchableOpacity key={p} onPress={() => { haptic.light(); setEditPeriod(p); }} activeOpacity={0.8}
                  accessibilityRole="button" accessibilityState={{ selected: active }}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: active ? C.accent : 'transparent' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: active ? '#fff' : C.muted }}>{PERIOD_LABELS[p].adjective}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        }
      />

      {/* ── Add spending ── */}
      <NumpadModal
        visible={spendModal}
        title="Add spending"
        hint={`${isOverToday ? 'Over by' : 'Left today:'} ${currencyStr(currency, fmt(Math.abs(leftToday)))}`}
        confirmLabel="Add"
        amount={spendInput}
        currency={currency}
        onChangeAmount={setSpendInput}
        onConfirm={(note, category) => { onAddSpending(spendInput, note, category); setSpendInput(''); setSpendPrefill({}); setSpendModal(false); }}
        onClose={() => { setSpendModal(false); setSpendInput(''); setSpendPrefill({}); }}
        withNote
        withCategory
        notePlaceholder="Add a note (optional)"
        initialNote={spendPrefill.note}
        initialCategory={spendPrefill.category}
      />

      <BillEditor
        visible={billEditor !== null}
        bill={billEditor === 'new' || billEditor === null ? undefined : billEditor}
        currency={currency}
        budgetPeriod={period}
        todayKey={todayKey}
        onSave={data => { onSaveBill(data, billEditor && billEditor !== 'new' ? billEditor.id : undefined); setBillEditor(null); }}
        onDelete={billEditor && billEditor !== 'new' ? () => { onDeleteBill(billEditor.id); setBillEditor(null); } : undefined}
        onClose={() => setBillEditor(null)}
      />

      <MonthSummarySheet visible={summaryMonth !== null} initialMonth={summaryMonth ?? todayKey} data={summaryData} onClose={() => setSummaryMonth(null)} />

      {/* ── Edit one of today's entries: category, or remove it ── */}
      <Modal visible={editing !== null} transparent animationType="fade" onRequestClose={() => setEditingId(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} activeOpacity={1} onPress={() => setEditingId(null)} />
          {editing && (
            <View style={{ backgroundColor: '#3B2220', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(212,149,106,0.35)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12) }}>{entryTitle(editing)} · {editing.billId ? 'Bill' : editing.time}</Text>
                  <CurrencyAmount currency={currency} amount={fmt(editing.amount)} imageSize={fs(24)}
                    textStyle={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(26) }} />
                </View>
                <TouchableOpacity onPress={() => setEditingId(null)} hitSlop={12} accessibilityLabel="Close">
                  <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: fs(18) }}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={[label, { marginBottom: 8 }]}>Category</Text>
              <CategoryGrid value={editing.category} onChange={key => { onSetEntryCategory(editing.id, key); setEditingId(null); }} />
              <TouchableOpacity onPress={() => removeEntry(editing.id)} style={{ alignSelf: 'center', marginTop: 20, paddingVertical: 8, paddingHorizontal: 16 }}>
                <Text style={{ fontFamily: 'Jua', color: C.red, fontSize: fs(14) }}>Remove entry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Add money (top-up) ── */}
      <NumpadModal
        visible={moneyModal}
        title="Add money"
        hint={`Adds to this ${noun}'s budget`}
        confirmLabel="Add"
        amount={moneyInput}
        currency={currency}
        onChangeAmount={setMoneyInput}
        onConfirm={note => { onAddMoney(moneyInput, note); setMoneyInput(''); setMoneyModal(false); }}
        onClose={() => { setMoneyModal(false); setMoneyInput(''); }}
        withNote
        notePlaceholder="Where's it from? (optional)"
      />

      {/* ── Day history bottom sheet ── */}
      <Modal visible={selectedDay !== null} transparent animationType="fade" onRequestClose={() => setSelectedDay(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'flex-end' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={() => setSelectedDay(null)}
          />
          <Animated.View style={{
            transform: [{ translateY: sheetTranslateY }],
            backgroundColor: '#3B2220', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            paddingTop: 24, paddingHorizontal: 24, paddingBottom: 32,
            borderWidth: 1.5, borderBottomWidth: 0, borderColor: 'rgba(212,149,106,0.35)', maxHeight: '75%',
          }}>
            <View {...sheetPanResponder.panHandlers} style={{ paddingBottom: 12, marginTop: -10, alignItems: 'center' }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(212,149,106,0.3)', alignSelf: 'center', marginBottom: 18 }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View>
                <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(16) }}>
                  {selectedDay?.isToday ? 'Today' : selectedDay?.dayName}
                </Text>
                <CurrencyAmount currency={currency} amount={`${fmt(selectedDay?.total ?? 0)} spent`}
                  textStyle={{ fontFamily: 'Jua', color: 'rgba(212,149,106,0.7)', fontSize: fs(12) }} imageSize={fs(12)} />
              </View>
              <TouchableOpacity onPress={() => setSelectedDay(null)} hitSlop={12}>
                <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: fs(18) }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {selectedEntries.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                  <Text style={{ fontFamily: 'Jua', color: C.cream, fontSize: fs(14), opacity: 0.4 }}>No entry details recorded.</Text>
                </View>
              ) : (
                [...selectedEntries].reverse().map(entry => (
                  <View key={entry.id} style={{ backgroundColor: C.card, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
                    <Text style={{ fontSize: fs(18), marginRight: 10, opacity: entry.category ? 1 : 0.3 }}>{categoryOf(entry.category)?.emoji ?? '•'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }}>{entryTitle(entry)}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, marginTop: 1 }}>{entry.time}</Text>
                    </View>
                    <CurrencyAmount currency={currency} amount={fmt(entry.amount)}
                      textStyle={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(15) }} imageSize={fs(15)} />
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: navHeight }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(24) }}>Finance</Text>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13) }}>
              {PERIOD_LABELS[period].adjective} budget · {currencyStr(currency, fmt(budgetAmount))}
            </Text>
          </View>
          <TouchableOpacity onPress={openBudgetEditor} activeOpacity={0.8} accessibilityLabel="Edit budget"
            style={{ backgroundColor: 'rgba(212,149,106,0.14)', borderRadius: 99, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
            <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(13) }}>Edit budget</Text>
          </TouchableOpacity>
        </View>

        <LeftoverBanner jar={jar} currency={currency} />

        {/* ── Today + period card ── */}
        <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: isOverToday ? 'rgba(240,144,144,0.4)' : C.border }}>
          <Text style={label}>{isOverToday ? 'Over today by' : 'Left to spend today'}</Text>
          <CurrencyAmount currency={currency} amount={fmt(Math.abs(leftToday))} imageSize={fs(28)}
            textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(32), color: isOverToday ? C.red : C.cream, marginVertical: 2 }} />
          <Text style={[label, { marginBottom: 10 }]}>
            {currencyStr(currency, fmt(budget.spentToday))} spent of {currencyStr(currency, fmt(budget.dailyAllowance))}
            {isDaily ? '' : ' allowed today'}
          </Text>
          <Bar ratio={todayRatio} />

          {!isDaily && (
            <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(212,149,106,0.14)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: budget.periodLeft < 0 ? C.red : C.cream }}>
                  {currencyStr(currency, fmt(Math.abs(budget.periodLeft)))} {budget.periodLeft < 0 ? 'over' : 'left'} this {noun}
                </Text>
                <Text style={label}>{budget.daysLeft === 1 ? 'last day' : `${budget.daysLeft} days to go`}</Text>
              </View>
              <Bar ratio={periodRatio} height={6} />
              {budget.topUpsThisPeriod > 0 && (
                <Text style={[label, { marginTop: 8, color: 'rgba(157,224,135,0.8)' }]}>
                  Includes {currencyStr(currency, fmt(budget.topUpsThisPeriod))} added this {noun}
                </Text>
              )}
              {budget.billsSetAside > 0 && (
                <Text style={[label, { marginTop: budget.topUpsThisPeriod > 0 ? 2 : 8 }]}>
                  🧾 {currencyStr(currency, fmt(budget.billsSetAside))} set aside for bills this {noun}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ── Actions ── */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => { haptic.medium(); setSpendModal(true); }} activeOpacity={0.85}
            style={{ flex: 3, backgroundColor: C.accent, borderRadius: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Image source={IMAGES.carrot} style={{ width: 20, height: 20 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: fs(15) }}>Add spending</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.medium(); setMoneyModal(true); }} activeOpacity={0.85}
            accessibilityHint={`Adds money to this ${noun}'s budget`}
            style={{ flex: 2, backgroundColor: 'rgba(157,224,135,0.12)', borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(157,224,135,0.35)' }}>
            <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(15) }}>+ Money</Text>
          </TouchableOpacity>
        </View>

        <SavingsJars jar={jar} currency={currency} />

        {/* ── Today's activity ── */}
        <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17), marginBottom: 10 }}>Today</Text>
        {activity.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 20, marginBottom: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13) }}>Nothing logged yet today.</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: C.card, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
            {activity.map((row, i) => (
              <TouchableOpacity key={row.id}
                onPress={() => { if (row.kind === 'spend') { haptic.light(); setEditingId(row.id); } else handleUndo(row); }}
                onLongPress={() => (row.kind === 'spend' ? removeEntry(row.id) : handleUndo(row))}
                activeOpacity={0.7}
                accessibilityHint={row.kind === 'spend' ? 'Change its category or remove it' : 'Opens undo'}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(212,149,106,0.1)' }}>
                <Text style={{ fontSize: fs(18), marginRight: 10, opacity: row.kind === 'spend' && !row.category ? 0.3 : 1 }}>
                  {row.kind === 'topup' ? '💰' : categoryOf(row.category)?.emoji ?? '•'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }} numberOfLines={1}>
                    {row.kind === 'spend' ? entryTitle(row) : row.note || 'Money added'}
                  </Text>
                  {row.kind === 'spend' && row.billId
                    ? <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>Bill · logged automatically</Text>
                    : row.time ? <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>{row.time}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: row.kind === 'spend' ? C.cream : C.green }}>{row.kind === 'spend' ? '−' : '+'}</Text>
                  <CurrencyAmount currency={currency} amount={fmt(row.amount)} imageSize={fs(15)}
                    textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: row.kind === 'spend' ? C.cream : C.green }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Bills: recurring, logged automatically on the day ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 }}>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17) }}>Bills</Text>
          {bills.length > 0 && (
            <TouchableOpacity onPress={() => { haptic.light(); setBillEditor('new'); }} accessibilityLabel="Add bill"
              style={{ backgroundColor: 'rgba(212,149,106,0.14)', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
              <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(12) }}>+ Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {bills.length === 0 ? (
          <TouchableOpacity onPress={() => { haptic.light(); setBillEditor('new'); }} activeOpacity={0.8}
            style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: fs(24) }}>🧾</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Jua', color: C.cream, fontSize: fs(14) }}>Add rent, subscriptions and other bills</Text>
              <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12), marginTop: 2 }}>Add them once — they're logged for you on the day.</Text>
            </View>
            <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(20) }}>+</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ backgroundColor: C.card, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
            {sortedBills.map(({ bill, next }, i) => (
              <TouchableOpacity key={bill.id} onPress={() => { haptic.light(); setBillEditor(bill); }} activeOpacity={0.7}
                accessibilityHint="Edit this bill"
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(212,149,106,0.1)' }}>
                <Text style={{ fontSize: fs(18), marginRight: 10 }}>🧾</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }} numberOfLines={1}>{bill.name}</Text>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }} numberOfLines={1}>
                    {billScheduleLabel(bill)}{next !== '9999' ? ` · next ${dueLabel(next, todayKey)}` : ''}{!isDaily && !bill.inBudget ? ' · not in budget' : ''}
                  </Text>
                </View>
                <CurrencyAmount currency={currency} amount={fmt(bill.amount)} imageSize={fs(15)}
                  textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: C.cream }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Where it went: spending by category this period ── */}
        {breakdown.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, marginBottom: 10 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17) }}>Where it went</Text>
              <Text style={label}>{breakdownLabel}</Text>
            </View>
            <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, gap: 12 }}>
              {breakdown.map(b => {
                const cat = b.key === 'none' ? UNCATEGORIZED : categoryOf(b.key)!;
                return (
                  <View key={b.key} accessible accessibilityLabel={`${cat.label}: ${currencyStr(currency, fmt(b.total))}, ${Math.round(b.share * 100)} percent`}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                      <Text style={{ fontSize: fs(15), width: 26 }}>{cat.emoji}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream, flex: 1 }}>{cat.label}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginRight: 8 }}>{Math.round(b.share * 100)}%</Text>
                      <CurrencyAmount currency={currency} amount={fmt(b.total)} imageSize={fs(13)}
                        textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: C.cream }} />
                    </View>
                    <View style={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden', marginLeft: 26 }}>
                      <View style={{ height: '100%', width: `${Math.max(b.share * 100, 2)}%`, borderRadius: 99, backgroundColor: cat.color }} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── Monthly recap ── */}
        <TouchableOpacity onPress={() => { haptic.light(); setSummaryMonth(recapMonth); }} activeOpacity={0.8}
          style={{ backgroundColor: recapLastMonth ? 'rgba(212,149,106,0.16)' : C.card, borderRadius: 16, padding: 16, marginTop: 12, marginBottom: 12, borderWidth: 1, borderColor: recapLastMonth ? 'rgba(212,149,106,0.45)' : C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: fs(24) }}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Jua', color: C.cream, fontSize: fs(14) }}>
              {recapLastMonth ? `Your ${monthLabel(recapMonth).name} recap is ready` : `${monthLabel(recapMonth).name} so far`}
            </Text>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12), marginTop: 2 }}>Spending vs last month, categories and how your budget went</Text>
          </View>
          <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(20) }}>›</Text>
        </TouchableOpacity>

        {/* ── This week ── */}
        <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17), marginTop: 12, marginBottom: 10 }}>This week</Text>
        <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
          <WeeklyChart days={chartDays} allocatedPerDay={budget.dailyAllowance} currency={currency} onDayPress={day => { haptic.light(); setSelectedDay(day); }} />
          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: 'rgba(212,149,106,0.5)', textAlign: 'center', marginTop: 10 }}>
            {weekTotal > 0 ? 'Tap a bar to see that day' : 'Your spending will show up here'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: C.border }}>
            <Text style={[label, { marginBottom: 4 }]}>Avg per day</Text>
            {avgSpend !== null
              ? <CurrencyAmount currency={currency} amount={fmt(avgSpend)} imageSize={fs(18)} textStyle={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }} />
              : <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }}>—</Text>}
          </View>
          <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: C.border }}>
            <Text style={[label, { marginBottom: 4 }]}>Last 7 days</Text>
            <CurrencyAmount currency={currency} amount={fmt(weekTotal)} imageSize={fs(18)} textStyle={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }} />
          </View>
        </View>
      </ScrollView>
    </>
  );
};
