// src/components/NetWorthSheet.tsx
//
// Net worth (netWorth.ts): the total, how it has moved month by month, and the accounts
// and debts behind it, each with a balance kept up by hand. Opened from Finance. Adding or
// editing an account swaps the sheet's content for the form, then back.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { currencyStr } from '../helpers';
import { CurrencyAmount } from './CurrencyAmount';
import { Icon } from './Icon';
import {
  ACCOUNT_KINDS, MAX_ACCOUNTS, changeSinceLastMonth, compactAmount, countsJars, kindOf, monthOf, worthTotals, worthTrend,
  type Account, type AccountData, type AccountKind, type NetWorth,
} from '../netWorth';
import { jarTotal, type Savings } from '../savings';

/** What the app hands the net worth UI: the state plus everything that changes it. */
export type Worth = {
  netWorth: NetWorth;
  /** Saves an account, or adds one (no id). */
  save: (data: AccountData, id?: string) => void;
  remove: (id: string) => void;
  setCountJars: (on: boolean) => void;
};

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', red: '#f09090', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG  = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const HAPTIC = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC),
};

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** The month's index, from "2026-10". */
const monthIndex = (month: string) => Number(month.slice(5, 7)) - 1;
/** "today" or "Oct 3". */
const updatedLabel = (day: string, todayKey: string) => {
  if (day === todayKey) return 'today';
  const d = new Date(day + 'T00:00:00');
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
};

type Form = { id?: string; kind: AccountKind; name: string; amount: string };

/**
 * The line under Finance's Net worth row: the total and how it moved since last month ("▲ ₱6,021
 * since September"), or the number of accounts in the first month. Null with nothing added yet.
 */
export const worthSummary = (netWorth: NetWorth, savings: Savings, currency: string, todayKey: string):
  { total: string; trend?: { text: string; up: boolean }; detail?: string } | null => {
  const n = netWorth.accounts.length;
  if (n === 0) return null;
  const { total } = worthTotals(netWorth, savings);
  const change = changeSinceLastMonth(netWorth, total, todayKey);
  // Whole amounts past 100, so the line fits beside the total.
  const moved = change && (Math.abs(change.amount) >= 100 ? Math.round(Math.abs(change.amount)).toLocaleString('en-US') : money(Math.abs(change.amount)));
  return {
    total: `${total < 0 ? '−' : ''}${currencyStr(currency, money(Math.abs(total)))}`,
    ...(change
      ? { trend: { text: `${change.amount > 0 ? '▲' : '▼'} ${currencyStr(currency, moved!)} since ${MONTH_LONG[monthIndex(change.since)]}`, up: change.amount > 0 } }
      : { detail: `${n} ${n === 1 ? 'account' : 'accounts'}` }),
  };
};

export const NetWorthSheet = ({ visible, worth, savings, currency, todayKey, onClose }: {
  visible: boolean;
  worth: Worth;
  savings: Savings;
  currency: string;
  todayKey: string;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => { if (!visible) setForm(null); }, [visible]);

  const { netWorth } = worth;
  const totals   = worthTotals(netWorth, savings);
  const trend    = worthTrend(netWorth, todayKey);
  const owned    = netWorth.accounts.filter(a => a.kind !== 'debt');
  const debts    = netWorth.accounts.filter(a => a.kind === 'debt');
  const jars     = savings.jars;
  const jarsHold = Math.round(jars.reduce((s, j) => s + jarTotal(j), 0) * 100) / 100;
  const full     = netWorth.accounts.length >= MAX_ACCOUNTS;

  const label = { fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.75)', letterSpacing: 1.5, textTransform: 'uppercase' } as const;
  const sym   = currency === '__carrot__' ? '🥕' : currency;

  const add  = (kind: AccountKind) => { haptic.light(); setForm({ kind, name: '', amount: '' }); };
  const edit = (a: Account) => { haptic.light(); setForm({ id: a.id, kind: a.kind, name: a.name, amount: String(a.balance) }); };

  // ── The form ──
  const value   = parseFloat(form?.amount || '0');
  const canSave = !!form && form.name.trim().length > 0 && form.amount !== '' && value >= 0;
  const owes    = form?.kind === 'debt';
  const save = () => {
    if (!form || !canSave) return;
    haptic.success();
    worth.save({ name: form.name, kind: form.kind, balance: value }, form.id);
    setForm(null);
  };

  const row = (a: Account, i: number) => (
    <TouchableOpacity key={a.id} onPress={() => edit(a)} activeOpacity={0.7} accessibilityHint="Change the balance"
      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(212,149,106,0.1)' }}>
      <Icon name={kindOf(a.kind).icon} size={fs(26)} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }} numberOfLines={1}>{a.name}</Text>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }} numberOfLines={1}>{kindOf(a.kind).label} · updated {updatedLabel(a.updatedAt, todayKey)}</Text>
      </View>
      <CurrencyAmount currency={currency} amount={money(a.balance)} imageSize={fs(15)}
        textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(15), color: a.kind === 'debt' ? C.red : C.cream }} />
    </TouchableOpacity>
  );

  const group = { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' } as const;
  const addChip = (text: string, kind: AccountKind) => (
    <TouchableOpacity onPress={() => add(kind)} accessibilityRole="button" accessibilityLabel={text}
      style={{ backgroundColor: 'rgba(212,149,106,0.14)', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(212,149,106,0.35)' }}>
      <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(12) }}>+ Add</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => (form ? setForm(null) : onClose())}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => setForm(null)} disabled={!form} hitSlop={12} style={{ minWidth: 60 }}>
            {form && <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: 'rgba(232,213,192,0.6)' }}>Cancel</Text>}
          </TouchableOpacity>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }}>
            {!form ? 'Net worth' : owes ? (form.id ? 'Something you owe' : 'New debt') : form.id ? 'Edit account' : 'New account'}
          </Text>
          <TouchableOpacity onPress={onClose} disabled={!!form} hitSlop={12} style={{ minWidth: 60, alignItems: 'flex-end' }}>
            {!form && <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: C.accent }}>Done</Text>}
          </TouchableOpacity>
        </View>

        {form ? (
          <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              <Text style={[label, { marginTop: 12, marginBottom: 8, marginLeft: 4 }]}>What is it?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ACCOUNT_KINDS.map(k => {
                  const active = k.key === form.kind;
                  return (
                    <TouchableOpacity key={k.key} onPress={() => { haptic.light(); setForm({ ...form, kind: k.key }); }} activeOpacity={0.7}
                      accessibilityRole="button" accessibilityLabel={k.label} accessibilityState={{ selected: active }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 99, backgroundColor: active ? C.accent : 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: active ? C.accent : 'rgba(212,149,106,0.22)' }}>
                      <Icon name={k.icon} size={fs(18)} />
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: active ? '#fff' : 'rgba(232,213,192,0.65)' }}>{k.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[label, { marginTop: 20, marginBottom: 8, marginLeft: 4 }]}>What do you call it?</Text>
              <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: form.name.trim() ? C.accent : 'rgba(212,149,106,0.2)' }}>
                <TextInput value={form.name} onChangeText={name => setForm({ ...form, name })} maxLength={30} returnKeyType="next"
                  placeholder={`e.g. ${kindOf(form.kind).suggestions[0]}`} placeholderTextColor="rgba(232,213,192,0.25)"
                  style={{ fontFamily: 'Jua', fontSize: fs(18), color: C.cream, paddingVertical: 16 }} />
              </View>
              {form.name.trim() === '' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {kindOf(form.kind).suggestions.map(s => (
                    <TouchableOpacity key={s} onPress={() => { haptic.light(); setForm({ ...form, name: s }); }} activeOpacity={0.7}
                      style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.65)' }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[label, { marginTop: 20, marginBottom: 8, marginLeft: 4 }]}>{owes ? 'How much do you owe?' : 'How much is in it?'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: form.amount !== '' ? C.accent : 'rgba(212,149,106,0.2)' }}>
                <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(20), color: 'rgba(212,149,106,0.7)', marginRight: 6 }}>{sym}</Text>
                <TextInput value={form.amount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="rgba(232,213,192,0.25)" selectTextOnFocus
                  onChangeText={v => { const clean = v.replace(/[^0-9.]/g, ''); const [whole, dec] = clean.split('.'); setForm({ ...form, amount: dec !== undefined ? `${whole}.${dec.slice(0, 2)}` : whole }); }}
                  maxLength={13} style={{ flex: 1, fontFamily: 'DynaPuff', fontSize: fs(22), color: C.cream, paddingVertical: 14 }} />
              </View>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 10, marginLeft: 4 }}>
                Change it here whenever it changes. Logging spending doesn't touch it.
              </Text>

              {form.id && (
                <TouchableOpacity
                  onPress={() => {
                    haptic.light();
                    Alert.alert('Remove it?', `"${form.name.trim() || 'This'}" comes off your net worth. Months already kept in the trend stay as they were.`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => { worth.remove(form.id!); setForm(null); } },
                    ]);
                  }}
                  style={{ alignSelf: 'center', marginTop: 24, paddingVertical: 10, paddingHorizontal: 20 }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.red }}>Remove</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
              <TouchableOpacity onPress={save} disabled={!canSave} activeOpacity={0.8}
                style={{ backgroundColor: canSave ? C.accent : 'rgba(212,149,106,0.18)', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: canSave ? '#fff' : 'rgba(255,255,255,0.3)' }}>{form.id ? 'Save' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : netWorth.accounts.length === 0 ? (
          // ── Nothing yet ──
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: insets.bottom + 40 }}>
            <Icon name="money-bag" size={fs(72)} />
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(22), color: C.cream, marginTop: 14, textAlign: 'center' }}>What does it all add up to?</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: fs(20) }}>
              Add what you have, like cash, a bank account or an e‑wallet, and anything you owe. You keep the balances up to date, and Habbit does the adding.
            </Text>
            <TouchableOpacity onPress={() => add('cash')} activeOpacity={0.85}
              style={{ backgroundColor: C.accent, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 28, marginTop: 22 }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: '#fff' }}>Add the first one</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // ── The total, the trend and the accounts ──
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.border, alignItems: 'center' }}>
              <Text style={label}>Net worth</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                accessibilityLabel={`Net worth ${totals.total < 0 ? 'minus ' : ''}${money(Math.abs(totals.total))}`}>
                {totals.total < 0 && <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(32), color: C.red }}>−</Text>}
                <CurrencyAmount currency={currency} amount={money(Math.abs(totals.total))} imageSize={fs(28)}
                  textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(32), color: totals.total < 0 ? C.red : C.cream }} />
              </View>
              {trend.change && trend.change.amount !== 0 && (
                <Text style={{ fontFamily: 'Jua', fontSize: fs(13), marginTop: 2, color: trend.change.amount > 0 ? C.green : C.red }}>
                  {trend.change.amount > 0 ? '▲' : '▼'} {currencyStr(currency, money(Math.abs(trend.change.amount)))} since {MONTH_LONG[monthIndex(trend.change.since)]}
                </Text>
              )}
              <View style={{ flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(212,149,106,0.14)', alignSelf: 'stretch' }}>
                {[{ title: 'You have', n: totals.have + totals.jars, color: C.cream }, { title: 'You owe', n: totals.owe, color: totals.owe > 0 ? C.red : C.cream }].map(s => (
                  <View key={s.title} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>{s.title}</Text>
                    <CurrencyAmount currency={currency} amount={money(s.n)} imageSize={fs(15)} textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: s.color }} />
                  </View>
                ))}
              </View>
            </View>

            {/* ── Month by month ── */}
            {trend.points.length > 1 ? (
              <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
                <Text style={label}>Month by month</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 }}>
                  {(() => {
                    const top = Math.max(...trend.points.map(p => Math.abs(p.total)), 1);
                    return trend.points.map(p => {
                      const current = p.month === monthOf(todayKey);
                      return (
                        <View key={p.month} style={{ flex: 1, alignItems: 'center' }}
                          accessibilityLabel={`${MONTH_LONG[monthIndex(p.month)]}: ${p.total < 0 ? 'minus ' : ''}${money(Math.abs(p.total))}`}>
                          <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: p.total < 0 ? C.red : C.muted, marginBottom: 4 }} numberOfLines={1}>{compactAmount(p.total)}</Text>
                          <View style={{ width: '100%', height: Math.max(4, Math.round((Math.abs(p.total) / top) * 72)), borderRadius: 8, backgroundColor: p.total < 0 ? 'rgba(240,144,144,0.55)' : current ? C.accent : 'rgba(212,149,106,0.38)' }} />
                          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: current ? C.cream : C.muted, marginTop: 5 }}>{MONTH_SHORT[monthIndex(p.month)]}</Text>
                        </View>
                      );
                    });
                  })()}
                </View>
              </View>
            ) : (
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 12 }}>
                Each month's total is kept, so a trend builds up here.
              </Text>
            )}

            {/* ── What you have ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17) }}>What you have</Text>
              {!full && addChip('Add something you have', 'cash')}
            </View>
            {(owned.length > 0 || jars.length > 0) && (
              <View style={group}>
                {owned.map(row)}
                {jars.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: owned.length === 0 ? 0 : 1, borderTopColor: 'rgba(212,149,106,0.1)' }}>
                    <Icon name="jar" size={fs(26)} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }}>Savings {jars.length === 1 ? 'jar' : 'jars'}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }} numberOfLines={1}>
                        {currencyStr(currency, money(jarsHold))} · {countsJars(netWorth) ? 'counted in' : 'left out'}
                      </Text>
                    </View>
                    <Switch value={countsJars(netWorth)} onValueChange={v => { haptic.light(); worth.setCountJars(v); }}
                      accessibilityLabel="Count savings jars in net worth"
                      trackColor={{ false: 'rgba(212,149,106,0.2)', true: C.accent }} thumbColor="#fff" ios_backgroundColor="rgba(212,149,106,0.2)" />
                  </View>
                )}
              </View>
            )}
            {jars.length > 0 && (
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 8, marginLeft: 4 }}>
                Leave the jars out if their money already sits in an account above, so it isn't counted twice.
              </Text>
            )}

            {/* ── What you owe ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(17) }}>What you owe</Text>
              {!full && addChip('Add something you owe', 'debt')}
            </View>
            {debts.length > 0 ? <View style={group}>{debts.map(row)}</View> : (
              <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginLeft: 4 }}>Nothing owed. A credit card balance or a loan goes here.</Text>
            )}

            <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 24 }}>
              These are balances you keep up by hand. They stay on your iPhone and in your backups.
            </Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};
