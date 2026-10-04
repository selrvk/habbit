// src/components/MonthSummarySheet.tsx
//
// The monthly recap, as a page sheet with ‹ › to move between months.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { CurrencyAmount } from './CurrencyAmount';
import { CategoryIcon, Icon } from './Icon';
import { UNCATEGORIZED, categoryOf } from '../categories';
import { currencyStr, parseDateKey } from '../helpers';
import { firstMonth, monthStart, monthSummary } from '../monthSummary';
import type { BudgetPeriod, TopUp } from '../budget';
import type { Bill } from '../bills';
import type { Savings } from '../savings';
import type { CompletionRecord, DailyTotal, SpendingEntry } from '../types';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', red: '#f09090', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };
const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
const money  = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayStr = (key: string) => { const d = parseDateKey(key); return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; };

export type MonthSummaryData = {
  todayKey: string;
  dailyTotals: DailyTotal[];
  todayHistory: SpendingEntry[];
  spentToday: number;
  topUps: TopUp[];
  bills: Bill[];
  savings: Savings;
  history: CompletionRecord[];
  budgetPeriod: BudgetPeriod;
  budgetAmount: number;
  currency: string;
};

export const MonthSummarySheet = ({ visible, initialMonth, data, onClose }: {
  visible: boolean;
  /** Any day in the month to open on. */
  initialMonth: string;
  data: MonthSummaryData;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(monthStart(initialMonth));
  useEffect(() => { if (visible) setMonth(monthStart(initialMonth)); }, [visible]);

  const s       = useMemo(() => monthSummary({ month, ...data }), [month, data]);
  const first   = firstMonth(data.dailyTotals, data.history, data.todayKey);
  const current = monthStart(data.todayKey);
  const cur     = data.currency;

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(16), marginBottom: 10 }}>{title}</Text>
      <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>{children}</View>
    </View>
  );

  const Amount = ({ n, size = 15, color = C.cream }: { n: number; size?: number; color?: string }) => (
    <CurrencyAmount currency={cur} amount={money(n)} imageSize={fs(size)} textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(size), color }} />
  );

  const NavButton = ({ label, enabled, to }: { label: string; enabled: boolean; to: string }) => (
    <TouchableOpacity onPress={enabled ? () => { haptic(); setMonth(to); } : undefined} disabled={!enabled} hitSlop={10}
      accessibilityLabel={label === '‹' ? 'Previous month' : 'Next month'}
      style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,149,106,0.12)', opacity: enabled ? 1 : 0.3 }}>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(18), color: C.accent, lineHeight: fs(22) }}>{label}</Text>
    </TouchableOpacity>
  );

  const change = s.prevSpent !== null && s.prevSpent > 0 ? (s.spent - s.prevSpent) / s.prevSpent : null;
  const vs     = s.inProgress ? `this time in ${s.prevName}` : s.prevName;
  const empty  = s.spent === 0 && s.habits.trackedDays === 0;

  const budgetLine = (() => {
    const b = s.budget;
    if (!b) return null;
    if (b.kind === 'weekly') return b.weeks === 0 ? null : `${b.weeksUnder} of ${b.weeks} week${b.weeks === 1 ? '' : 's'} under budget${b.weeksUnder === b.weeks ? ' 🎉' : ''}`;
    const amount = currencyStr(cur, money(Math.abs(b.left)));
    if (b.kind === 'monthly') {
      if (b.left < 0) return `Over your monthly budget by ${amount}`;
      return s.inProgress ? `${amount} left of your monthly budget` : `Under budget by ${amount} 🎉`;
    }
    return b.left < 0 ? `Over your daily budgets by ${amount} in total` : `Under your daily budgets by ${amount} in total 🎉`;
  })();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
          <NavButton label="‹" enabled={month > first} to={monthStart(month, -1)} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, letterSpacing: 1 }}>{s.inProgress ? 'SO FAR' : 'MONTHLY RECAP'}</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(18), color: C.cream }}>{s.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <NavButton label="›" enabled={month < current} to={monthStart(month, 1)} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}>
          {empty ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Icon name="bonbon" size={fs(56)} style={{ marginBottom: 10 }} />
              <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(14) }}>Nothing logged in {s.name}.</Text>
            </View>
          ) : (
            <>
              {/* ── Spent ── */}
              <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18, marginTop: 8, borderWidth: 1, borderColor: C.border }}>
                <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12) }}>Spent {s.inProgress ? 'so far' : `in ${s.name}`}</Text>
                <Amount n={s.spent} size={32} />
                <Text style={{ fontFamily: 'Jua', fontSize: fs(13), marginTop: 4, color: change === null ? C.muted : change > 0 ? C.red : C.green }}>
                  {change === null
                    ? (s.prevSpent === null ? 'Nothing logged the month before to compare with' : `vs nothing in ${s.prevName}`)
                    : `${change > 0 ? '▲' : '▼'} ${Math.abs(Math.round(change * 100))}% ${change > 0 ? 'more' : 'less'} than ${vs}`}
                </Text>
                <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12), marginTop: 6 }}>
                  {currencyStr(cur, money(s.avgPerDay))} a day on average
                </Text>
                {budgetLine && (
                  <Text style={{ fontFamily: 'Jua', color: s.budget && 'left' in s.budget && s.budget.left < 0 ? C.red : C.cream, fontSize: fs(14), marginTop: 10 }}>{budgetLine}</Text>
                )}
              </View>

              {/* ── Money tiles ── */}
              {(s.billsPaid > 0 || s.added > 0 || s.saved !== 0) && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  {[
                    { label: 'Bills paid', icon: 'receipt' as const, n: s.billsPaid, color: C.cream },
                    { label: 'Added', icon: 'money-bag' as const, n: s.added, color: C.green },
                    { label: 'Saved', icon: 'jar' as const, n: s.saved, color: C.green },
                  ].filter(t => t.n !== 0).map(t => (
                    <View key={t.label} style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Icon name={t.icon} size={fs(15)} />
                        <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(11) }}>{t.label}</Text>
                      </View>
                      <Amount n={t.n} size={14} color={t.color} />
                    </View>
                  ))}
                </View>
              )}

              {/* ── Categories ── */}
              {s.byCategory.length > 0 && (
                <Section title="Where it went">
                  <View style={{ gap: 12 }}>
                    {s.byCategory.map(c => {
                      const cat  = c.key === 'none' ? UNCATEGORIZED : categoryOf(c.key)!;
                      const diff = c.total - c.prev;
                      return (
                        <View key={c.key}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                            <View style={{ width: 28 }}><CategoryIcon category={cat} size={fs(20)} /></View>
                            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream, flex: 1 }}>{cat.label}</Text>
                            <Text style={{ fontFamily: 'Jua', fontSize: fs(11), marginRight: 8, color: c.prev === 0 ? C.muted : diff > 0 ? C.red : C.green }}>
                              {c.prev === 0 ? 'new' : `${diff > 0 ? '+' : '−'}${currencyStr(cur, money(Math.abs(diff)))}`}
                            </Text>
                            <Amount n={c.total} size={14} />
                          </View>
                          <View style={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden', marginLeft: 26 }}>
                            <View style={{ height: '100%', width: `${Math.max(c.share * 100, 2)}%`, borderRadius: 99, backgroundColor: cat.color }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, marginTop: 12 }}>Changes are against {vs}.</Text>
                </Section>
              )}

              {/* ── Biggest spends ── */}
              {s.topExpenses.length > 0 && (
                <Section title="Biggest spends">
                  {s.topExpenses.map((e, i) => (
                    <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(212,149,106,0.1)' }}>
                      <View style={{ width: 30 }}><CategoryIcon category={categoryOf(e.category)} size={fs(22)} dim={!e.category} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }} numberOfLines={1}>{e.note || categoryOf(e.category)?.label || 'Spending'}</Text>
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>{dayStr(e.date)}</Text>
                      </View>
                      <Amount n={e.amount} size={14} />
                    </View>
                  ))}
                  {s.busiestDay && (
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 10 }}>
                      Busiest day: {dayStr(s.busiestDay.date)} · {currencyStr(cur, money(s.busiestDay.total))}
                    </Text>
                  )}
                </Section>
              )}

              {/* ── Habits ── */}
              {s.habits.trackedDays > 0 && (
                <Section title="Habbits">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name="bonbon" size={fs(20)} />
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }}>
                      {s.habits.perfectDays} perfect day{s.habits.perfectDays === 1 ? '' : 's'} out of {s.habits.trackedDays}
                    </Text>
                  </View>
                  <View style={{ height: 8, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden', marginTop: 10 }}>
                    <View style={{ height: '100%', width: `${(s.habits.perfectDays / s.habits.trackedDays) * 100}%`, borderRadius: 99, backgroundColor: C.green }} />
                  </View>
                </Section>
              )}
            </>
          )}
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={{ backgroundColor: C.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: '#fff' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
