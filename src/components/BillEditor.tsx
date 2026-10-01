// src/components/BillEditor.tsx
//
// Add or edit a recurring bill: name, amount, monthly day or weekday, whether it comes out
// of the budget, and a due-day reminder. Shown as a page sheet from Finance.

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Switch, Pressable, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DAY_LABELS } from '../constants';
import { useFontSize } from '../hooks/useFontSize';
import { billScheduleLabel, upcomingDueDate, type Bill, type BillRepeat } from '../bills';
import { PERIOD_LABELS, type BudgetPeriod } from '../budget';

export type BillFormData = Omit<Bill, 'id' | 'startDate' | 'lastLogged'>;

const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

const SUGGESTIONS = ['Rent', 'Internet', 'Phone', 'Electricity', 'Water', 'Spotify', 'Netflix'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', muted: 'rgba(232,213,192,0.5)', border: 'rgba(212,149,106,0.2)' };

const Label = ({ children }: { children: React.ReactNode }) => {
  const fs = useFontSize();
  return (
    <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.75)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 20, marginLeft: 4 }}>{children}</Text>
  );
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>{children}</View>
);

const ToggleRow = ({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) => {
  const fs = useFontSize();
  return (
    <Pressable onPress={() => { haptic(); onChange(!value); }} accessibilityRole="switch" accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: C.cream }}>{title}</Text>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 2 }}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={v => { haptic(); onChange(v); }}
        trackColor={{ false: 'rgba(212,149,106,0.2)', true: C.accent }} thumbColor="#fff" ios_backgroundColor="rgba(212,149,106,0.2)" />
    </Pressable>
  );
};

/** "today", "tomorrow" or "Nov 1". */
export const dueLabel = (due: string, todayKey: string) => {
  const d = new Date(due + 'T00:00:00');
  const t = new Date(todayKey + 'T00:00:00');
  const days = Math.round((d.getTime() - t.getTime()) / 86_400_000);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export const BillEditor = ({ visible, bill, currency, budgetPeriod, todayKey, onSave, onDelete, onClose }: {
  visible: boolean;
  /** The bill being edited, or undefined for a new one. */
  bill?: Bill;
  currency: string;
  budgetPeriod: BudgetPeriod;
  todayKey: string;
  onSave: (data: BillFormData) => void;
  onDelete?: () => void;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();

  const [name, setName]         = useState('');
  const [amount, setAmount]     = useState('');
  const [repeat, setRepeat]     = useState<BillRepeat>('monthly');
  const [day, setDay]           = useState(1);
  const [inBudget, setInBudget] = useState(true);
  const [remind, setRemind]     = useState(true);

  // Fill the form each time it opens.
  useEffect(() => {
    if (!visible) return;
    setName(bill?.name ?? '');
    setAmount(bill ? String(bill.amount) : '');
    setRepeat(bill?.repeat ?? 'monthly');
    setDay(bill?.day ?? new Date(todayKey + 'T00:00:00').getDate());
    setInBudget(bill?.inBudget ?? true);
    setRemind(bill?.remind ?? true);
  }, [visible]);

  const setRepeatKeepingSense = (r: BillRepeat) => {
    haptic();
    setRepeat(r);
    const today = new Date(todayKey + 'T00:00:00');
    setDay(r === 'weekly' ? today.getDay() : today.getDate());
  };

  const value   = parseFloat(amount || '0');
  const canSave = name.trim().length > 0 && value > 0;
  const isDaily = budgetPeriod === 'daily';

  // Preview the next due date as the new/edited bill would see it.
  const preview: Bill = { id: '', name, amount: value, repeat, day, inBudget, remind, startDate: bill?.startDate ?? todayKey, lastLogged: bill?.lastLogged };
  const next    = upcomingDueDate(preview, todayKey);
  const summary = `${billScheduleLabel({ repeat, day })}${next ? ` · next ${dueLabel(next, todayKey)}` : ''}`;

  const save = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), amount: Math.round(value * 100) / 100, repeat, day, inBudget, remind });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ minWidth: 60 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: 'rgba(232,213,192,0.6)' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }}>{bill ? 'Edit bill' : 'New bill'}</Text>
          <View style={{ minWidth: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Label>What's the bill?</Label>
          <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: name.trim() ? C.accent : C.border }}>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Rent" placeholderTextColor="rgba(232,213,192,0.25)"
              maxLength={40} returnKeyType="next" style={{ fontFamily: 'Jua', fontSize: fs(18), color: C.cream, paddingVertical: 16 }} />
          </View>
          {!bill && name.trim() === '' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {SUGGESTIONS.map(s => (
                <TouchableOpacity key={s} onPress={() => { haptic(); setName(s); }} activeOpacity={0.7}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.22)' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(232,213,192,0.65)' }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Label>How much?</Label>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: value > 0 ? C.accent : C.border }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(20), color: 'rgba(212,149,106,0.7)', marginRight: 6 }}>{currency === '__carrot__' ? '🥕' : currency}</Text>
            <TextInput value={amount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="rgba(232,213,192,0.25)"
              onChangeText={v => { const clean = v.replace(/[^0-9.]/g, ''); const [whole, dec] = clean.split('.'); setAmount(dec !== undefined ? `${whole}.${dec.slice(0, 2)}` : whole); }}
              maxLength={10} style={{ flex: 1, fontFamily: 'DynaPuff', fontSize: fs(22), color: C.cream, paddingVertical: 14 }} />
          </View>

          <Label>When is it due?</Label>
          <Card>
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(212,149,106,0.1)', borderRadius: 12, padding: 3, marginBottom: 14 }}>
              {(['monthly', 'weekly'] as const).map(r => (
                <TouchableOpacity key={r} onPress={() => setRepeatKeepingSense(r)} activeOpacity={0.8}
                  accessibilityRole="button" accessibilityState={{ selected: repeat === r }}
                  style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: repeat === r ? C.accent : 'transparent' }}>
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: repeat === r ? '#fff' : 'rgba(232,213,192,0.6)' }}>{r === 'monthly' ? 'Every month' : 'Every week'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {repeat === 'monthly' ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => {
                    const active = d === day;
                    return (
                      <View key={d} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                        <TouchableOpacity onPress={() => { haptic(); setDay(d); }} activeOpacity={0.7}
                          accessibilityLabel={`Day ${d}`} accessibilityState={{ selected: active }}
                          style={{ flex: 1, borderRadius: 99, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? C.accent : 'transparent' }}>
                          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: active ? '#fff' : 'rgba(232,213,192,0.7)' }}>{d}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                {day > 28 && (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 6 }}>In shorter months it's due on the last day.</Text>
                )}
              </>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {DAY_LABELS.map((l, i) => {
                  const active = i === day;
                  return (
                    <TouchableOpacity key={i} onPress={() => { haptic(); setDay(i); }} activeOpacity={0.7}
                      accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]} accessibilityState={{ selected: active }}
                      style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: active ? C.accent : 'rgba(212,149,106,0.05)', borderWidth: 1.5, borderColor: active ? C.accent : 'rgba(212,149,106,0.15)' }}>
                      <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: active ? '#fff' : 'rgba(232,213,192,0.4)' }}>{l}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Card>

          <Label>Options</Label>
          <Card>
            {isDaily ? (
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>
                Your budget is daily, so bills are logged and tracked but don't count against it.
              </Text>
            ) : (
              <ToggleRow title="Comes out of my budget"
                sub={`Set aside from your ${PERIOD_LABELS[budgetPeriod].adjective.toLowerCase()} budget up front, so your daily amount already allows for it.`}
                value={inBudget} onChange={setInBudget} />
            )}
            <View style={{ height: 1, backgroundColor: 'rgba(212,149,106,0.12)', marginVertical: 14 }} />
            <ToggleRow title="Remind me on the day" sub="A nudge at 9 AM when it's due." value={remind} onChange={setRemind} />
          </Card>

          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 18 }}>
            {summary}{'\n'}It's logged as Bills spending on the day, automatically.
          </Text>

          {bill && onDelete && (
            <TouchableOpacity
              onPress={() => {
                haptic();
                Alert.alert('Delete bill', `Stop tracking "${bill.name}"? Payments already logged stay in your history.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: onDelete },
                ]);
              }}
              style={{ alignSelf: 'center', marginTop: 24, paddingVertical: 10, paddingHorizontal: 20 }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: '#f09090' }}>Delete bill</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
          <TouchableOpacity onPress={save} disabled={!canSave} activeOpacity={0.8}
            style={{ backgroundColor: canSave ? C.accent : 'rgba(212,149,106,0.18)', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: canSave ? '#fff' : 'rgba(255,255,255,0.3)' }}>{bill ? 'Save changes' : 'Add bill'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
