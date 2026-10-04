// src/components/WeekRecapSheet.tsx
//
// The Sunday recap, as a page sheet with ‹ › to move between weeks. Everyone gets the
// numbers and a tip; Pro also gets Bonbon's note on the week and the last 8 weeks.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Image, ActivityIndicator } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { useProStatus } from '../context/ProContext';
import { PaywallScreen } from '../screens/PaywallScreen';
import { CurrencyAmount } from './CurrencyAmount';
import { categoryOf, type Category } from '../categories';
import { CategoryIcon, Icon, ProPill } from './Icon';
import type { IconName } from '../icons';
import { addDaysToKey, currencyStr, parseDateKey } from '../helpers';
import { periodStart } from '../budget';
import { weekLabel, weekSummary, weekTip, weekTrend, type WeekData } from '../weekSummary';
import { savedWeekNote, writeWeekNote } from '../utils/weekNote';
import { askAiConsent, getAiConsent, useAiConsent } from '../utils/aiConsent';
import { durationLabel } from '../focus';
import { CoachError } from '../utils/bonbonApi';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', red: '#f09090', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BONBON = { idle: require('../../assets/bonbon/idle.png'), thinking: require('../../assets/bonbon/thinking.png') };

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
const money  = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type WeekRecapData = WeekData & { currency: string; name: string; streak: number };

type Note = { status: 'idle' | 'loading' | 'done' | 'error'; text?: string };

export const WeekRecapSheet = ({ visible, initialWeek, data, onClose }: {
  visible: boolean;
  /** Any day in the week to open on. */
  initialWeek: string;
  data: WeekRecapData;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const { isPro } = useProStatus();
  const aiConsent = useAiConsent();
  const [week, setWeek]       = useState(periodStart('weekly', initialWeek));
  const [note, setNote]       = useState<Note>({ status: 'idle' });
  const [paywall, setPaywall] = useState(false);
  useEffect(() => { if (visible) setWeek(periodStart('weekly', initialWeek)); }, [visible]);

  const s       = useMemo(() => weekSummary(week, data), [week, data]);
  const tip     = useMemo(() => weekTip(s, data.commissions), [s, data.commissions]);
  const trend   = useMemo(() => (isPro ? weekTrend(week, data) : []), [isPro, week, data]);
  const current = periodStart('weekly', data.todayKey);
  const first   = periodStart('weekly', [data.dailyTotals[0]?.date, data.history[0]?.date, data.todayKey].filter(Boolean).sort()[0]!);
  const cur     = data.currency;
  const empty   = s.habits.trackedDays === 0 && s.money.spent === 0 && !s.focus;

  const write = async () => {
    setNote({ status: 'loading' });
    try {
      const text = await writeWeekNote(s, data.name, cur, data.streak);
      setNote(text ? { status: 'done', text } : { status: 'error', text: 'Bonbon came back with nothing. Try again?' });
    } catch (e) {
      setNote({ status: 'error', text: e instanceof CoachError && e.code === 'daily_limit'
        ? 'Bonbon has used up today’s messages. Try again tomorrow 🐰'
        : 'Bonbon couldn’t write this one just now. Check your connection and try again.' });
    }
  };

  // Pro: a saved note, or a new one for the week the recap opened on (others on request).
  // Written on its own only once Bonbon may use Google's AI; until then the button asks.
  useEffect(() => {
    if (!visible || !isPro || empty) return;
    let cancelled = false;
    setNote({ status: 'idle' });
    Promise.all([savedWeekNote(s), getAiConsent()]).then(([text, allowed]) => {
      if (cancelled) return;
      if (text) setNote({ status: 'done', text });
      else if (allowed && week === periodStart('weekly', initialWeek)) write();
    });
    return () => { cancelled = true; };
  }, [visible, isPro, s.start, s.end, empty]);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(16), marginBottom: 10 }}>{title}</Text>
      <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border }}>{children}</View>
    </View>
  );

  /** `icon`: a clay icon, or a category (its icon or emoji). */
  type RecapRow = { key: string; icon: IconName | Category | undefined; title: string; detail: string };
  const Row = ({ icon, title, detail, last = false }: { icon: IconName | Category | undefined; title: string; detail: string; last?: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(212,149,106,0.1)' }}>
      <View style={{ width: 34 }}>{typeof icon === 'string' ? <Icon name={icon} size={fs(24)} /> : <CategoryIcon category={icon} size={fs(24)} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>{detail}</Text>
      </View>
    </View>
  );

  const Amount = ({ n, size = 15, color = C.cream }: { n: number; size?: number; color?: string }) => (
    <CurrencyAmount currency={cur} amount={money(n)} imageSize={fs(size)} textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(size), color }} />
  );

  const NavButton = ({ label, enabled, to }: { label: string; enabled: boolean; to: string }) => (
    <TouchableOpacity onPress={enabled ? () => { haptic(); setWeek(to); } : undefined} disabled={!enabled} hitSlop={10}
      accessibilityLabel={label === '‹' ? 'Previous week' : 'Next week'}
      style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,149,106,0.12)', opacity: enabled ? 1 : 0.3 }}>
      <Text style={{ fontFamily: 'Jua', fontSize: fs(18), color: C.accent, lineHeight: fs(22) }}>{label}</Text>
    </TouchableOpacity>
  );

  const { habits: h, money: m, focus: f } = s;
  const change = m.prevSpent ? (m.spent - m.prevSpent) / m.prevSpent : null;
  const focusChange = f && f.prevMinutes > 0 ? (f.minutes - f.prevMinutes) / f.prevMinutes : null;
  const budgetLine = (() => {
    const b = m.budget;
    if (!b) return null;
    if (b.kind === 'daily') return `Under your daily budget on ${b.daysUnder} of ${b.days} day${b.days === 1 ? '' : 's'}${b.daysUnder === b.days ? ' 🎉' : ''}`;
    const amount = currencyStr(cur, money(Math.abs(b.left)));
    if (b.kind === 'monthly') return b.left < 0 ? `${amount} over your ${b.monthName} budget` : `${amount} left for the rest of ${b.monthName}`;
    if (b.left < 0) return `${amount} over this week’s budget`;
    return s.inProgress ? `${amount} left of this week’s budget` : `Under budget by ${amount} 🎉`;
  })();
  const overBudget = !!m.budget && 'left' in m.budget && m.budget.left < 0;

  // Bonbon's note (Pro) or what Pro would add (free); the tip shows when there's no note.
  const showTip = !isPro || note.status !== 'done';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Modal visible={paywall} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaywall(false)}>
          <PaywallScreen onClose={() => setPaywall(false)} />
        </Modal>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 }}>
          <NavButton label="‹" enabled={week > first} to={addDaysToKey(week, -7)} />
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, letterSpacing: 1 }}>{s.inProgress ? 'THIS WEEK SO FAR' : 'YOUR WEEK'}</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(18), color: C.cream }}>{s.label}</Text>
          </View>
          <NavButton label="›" enabled={week < current} to={addDaysToKey(week, 7)} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}>
          {empty ? (
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Image source={BONBON.idle} style={{ width: 56, height: 56, marginBottom: 10 }} resizeMode="contain" />
              <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(14), textAlign: 'center' }}>Nothing tracked this week.</Text>
            </View>
          ) : (
            <>
              {/* ── At a glance ── */}
              <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18, marginTop: 8, borderWidth: 1, borderColor: C.border }}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12) }}>Perfect days</Text>
                    <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(28), color: h.trackedDays > 0 && h.perfectDays === h.trackedDays ? C.green : C.cream }}>
                      {h.trackedDays > 0 ? `${h.perfectDays}/${h.trackedDays}` : '—'}
                    </Text>
                    <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12) }}>{h.done} check-off{h.done === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12) }}>Spent</Text>
                    <Amount n={m.spent} size={24} />
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), marginTop: 4, color: change === null ? C.muted : change > 0 ? C.red : C.green }}>
                      {change === null ? (m.prevSpent === null ? 'Nothing the week before' : 'vs nothing last week')
                        : `${change > 0 ? '▲' : '▼'} ${Math.abs(Math.round(change * 100))}% vs last week`}
                    </Text>
                  </View>
                </View>
                {h.trackedDays > 0 && (
                  <View style={{ height: 8, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden', marginTop: 14 }}>
                    <View style={{ height: '100%', width: `${(h.perfectDays / h.trackedDays) * 100}%`, borderRadius: 99, backgroundColor: C.green }} />
                  </View>
                )}
                {budgetLine && (
                  <Text style={{ fontFamily: 'Jua', color: overBudget ? C.red : C.cream, fontSize: fs(14), marginTop: 12 }}>{budgetLine}</Text>
                )}
              </View>

              {/* ── Bonbon ── */}
              <TouchableOpacity activeOpacity={isPro ? 1 : 0.8} disabled={isPro} onPress={() => { haptic(); setPaywall(true); }}
                style={{ flexDirection: 'row', gap: 12, backgroundColor: 'rgba(212,149,106,0.12)', borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
                <Image source={note.status === 'loading' ? BONBON.thinking : BONBON.idle} style={{ width: 48, height: 48 }} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: C.cream }}>Bonbon’s take</Text>
                    {!isPro && <ProPill />}
                  </View>
                  {!isPro ? (
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, lineHeight: fs(19) }}>
                      A note from Bonbon on your week every Sunday, spotting what worked and what to try next. Tap to see Pro.
                    </Text>
                  ) : note.status === 'loading' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={C.accent} />
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted }}>Bonbon is looking over your week…</Text>
                    </View>
                  ) : note.status === 'done' ? (
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream, lineHeight: fs(21) }}>{note.text}</Text>
                  ) : (
                    <>
                      {note.status === 'error' && <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginBottom: 8 }}>{note.text}</Text>}
                      {aiConsent !== 'allowed' && (
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, lineHeight: fs(19), marginBottom: 8 }}>
                          {aiConsent === 'under18'
                            ? 'Bonbon’s notes are for people 18 and older. You can change your answer in Settings › Data & Privacy.'
                            : 'Bonbon writes this with Google’s Gemini AI, from this week’s recap.'}
                        </Text>
                      )}
                      {aiConsent !== 'under18' && (
                        <TouchableOpacity onPress={async () => { haptic(); if (aiConsent === 'allowed' || await askAiConsent()) write(); }} activeOpacity={0.8}
                          style={{ alignSelf: 'flex-start', backgroundColor: C.accent, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 14 }}>
                          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: '#fff' }}>{note.status === 'error' ? 'Try again' : 'Ask Bonbon about this week'}</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {showTip && (
                <View style={{ flexDirection: 'row', gap: 10, backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 10, borderWidth: 1, borderColor: C.border }}>
                  <Icon name="lightbulb" size={fs(22)} />
                  <Text style={{ flex: 1, fontFamily: 'Jua', fontSize: fs(13), color: C.cream, lineHeight: fs(19) }}>{tip}</Text>
                </View>
              )}

              {/* ── Habits ── */}
              {(h.best || h.slipped || h.weekly.length > 0) && (
                <Section title="Habbits">
                  {[
                    h.best && { key: 'best', icon: 'star' as IconName, title: h.best.label, detail: `Done ${h.best.done} of ${h.best.of} days` },
                    h.slipped && { key: 'slipped', icon: 'rain-cloud' as IconName, title: h.slipped.label, detail: `Missed ${h.slipped.missed} of ${h.slipped.of} days` },
                    ...h.weekly.map(w => ({ key: `weekly-${w.label}`, icon: (w.done >= w.target ? 'check' : 'calendar') as IconName, title: w.label, detail: `${w.done} of ${w.target} this week` })),
                  ].filter((r): r is { key: string; icon: IconName; title: string; detail: string } => !!r).map(({ key, ...r }, i, list) => (
                    <Row key={key} {...r} last={i === list.length - 1} />
                  ))}
                </Section>
              )}

              {/* ── Focus ── */}
              {f && (
                <Section title="Focus">
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(24), color: C.cream }}>{durationLabel(f.minutes)}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }} numberOfLines={1}>
                        {f.habits.length === 1 ? `${f.habits[0].label} · ` : ''}over {f.days} day{f.days === 1 ? '' : 's'}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), marginBottom: 2, color: focusChange !== null && focusChange > 0 ? C.green : C.muted }}>
                      {focusChange === null ? 'None the week before'
                        : focusChange === 0 ? 'Same as last week'
                        : `${focusChange > 0 ? '▲' : '▼'} ${Math.abs(Math.round(focusChange * 100))}% vs last week`}
                    </Text>
                  </View>
                  {f.habits.length > 1 && (
                    <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(212,149,106,0.1)' }}>
                      {f.habits.slice(0, 3).map((x, i, list) => (
                        <Row key={x.id} icon="stopwatch" title={x.label} detail={durationLabel(x.minutes)} last={i === list.length - 1} />
                      ))}
                    </View>
                  )}
                </Section>
              )}

              {/* ── Money ── */}
              {(m.topCategory || m.biggest || m.saved !== 0) && (
                <Section title="Money">
                  {([
                    m.topCategory && {
                      key: 'top', icon: categoryOf(m.topCategory.key),
                      title: `Most went on ${categoryOf(m.topCategory.key)?.label.toLowerCase() ?? 'other things'}`,
                      detail: `${currencyStr(cur, money(m.topCategory.total))} · ${Math.round(m.topCategory.share * 100)}% of the week`,
                    },
                    m.biggest && {
                      key: 'biggest', icon: categoryOf(m.biggest.category) ?? ('money-wings' as IconName),
                      title: `Biggest: ${m.biggest.note || categoryOf(m.biggest.category)?.label || 'Spending'}`,
                      detail: `${currencyStr(cur, money(m.biggest.amount))} on ${DAYS[parseDateKey(m.biggest.date).getDay()]}`,
                    },
                    m.saved !== 0 && {
                      key: 'saved', icon: 'jar' as IconName, title: m.saved > 0 ? 'Saved to your jar' : 'Taken from your jar', detail: currencyStr(cur, money(Math.abs(m.saved))),
                    },
                  ] as (RecapRow | false | null)[]).filter((r): r is RecapRow => !!r).map(({ key, ...r }, i, list) => (
                    <Row key={key} {...r} last={i === list.length - 1} />
                  ))}
                </Section>
              )}

              {/* ── Best day ── */}
              {s.bestDay && (
                <Section title="Best day">
                  <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(18), color: C.cream }}>{DAYS[parseDateKey(s.bestDay.date).getDay()]}</Text>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginTop: 2 }}>
                    {s.bestDay.done === s.bestDay.of ? `All ${s.bestDay.of} Habbit${s.bestDay.of === 1 ? '' : 's'} done` : `${s.bestDay.done} of ${s.bestDay.of} Habbits done`}
                    {' · '}{s.bestDay.spent > 0 ? `${currencyStr(cur, money(s.bestDay.spent))} spent` : 'nothing spent'}
                  </Text>
                </Section>
              )}

              {/* ── Last 8 weeks ── */}
              <Section title="Your last 8 weeks">
                {isPro ? (
                  <Trend weeks={trend} fs={fs} cur={cur} />
                ) : (
                  <TouchableOpacity onPress={() => { haptic(); setPaywall(true); }} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Icon name="chart-up" size={fs(28)} />
                    <Text style={{ flex: 1, fontFamily: 'Jua', fontSize: fs(13), color: C.muted }}>See how your perfect days and spending move week to week.</Text>
                    <ProPill />
                  </TouchableOpacity>
                )}
              </Section>
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

/** Rows of bars, one per week: the share of perfect days, spending, and focus time (if any). */
const Trend = ({ weeks, fs, cur }: { weeks: ReturnType<typeof weekTrend>; fs: (n: number) => number; cur: string }) => {
  const maxSpent = Math.max(...weeks.map(w => w.spent), 1);
  const maxFocus = Math.max(...weeks.map(w => w.focusMinutes));
  const Bars = ({ title, values, color, caption }: { title: string; values: (number | null)[]; color: string; caption: string }) => (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.cream }}>{title}</Text>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>{caption}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 54 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', backgroundColor: 'rgba(212,149,106,0.08)', borderRadius: 6, overflow: 'hidden' }}>
            {v !== null && <View style={{ height: `${Math.max(v * 100, 4)}%`, backgroundColor: color, opacity: i === values.length - 1 ? 1 : 0.6, borderRadius: 6 }} />}
          </View>
        ))}
      </View>
    </View>
  );
  const last = weeks[weeks.length - 1];
  return (
    <View>
      <Bars title="Perfect days" color={C.green}
        values={weeks.map(w => (w.trackedDays > 0 ? w.perfectDays / w.trackedDays : null))}
        caption={last.trackedDays > 0 ? `${last.perfectDays}/${last.trackedDays} that week` : ''} />
      <Bars title="Spent" color={C.accent}
        values={weeks.map(w => (w.spent > 0 ? w.spent / maxSpent : null))}
        caption={`${currencyStr(cur, money(last.spent))} that week`} />
      {maxFocus > 0 && (
        <Bars title="Focus" color={C.cream}
          values={weeks.map(w => (w.focusMinutes > 0 ? w.focusMinutes / maxFocus : null))}
          caption={last.focusMinutes > 0 ? `${durationLabel(last.focusMinutes)} that week` : ''} />
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>{weekLabel(weeks[0].start).split(' – ')[0]}</Text>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>{weekLabel(last.start).split(' – ')[0]}</Text>
      </View>
    </View>
  );
};
