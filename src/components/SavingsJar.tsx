// src/components/SavingsJar.tsx
//
// The savings jar: the Finance card (progress, add / take out), the goal editor, and the
// "you had money left over" banner shown on Home and Finance.

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { CurrencyAmount } from './CurrencyAmount';
import { NumpadModal } from './NumpadModal';
import { jarTotal, type JarEntry, type LeftoverOffer, type Savings, type SavingsGoal } from '../savings';

export type GoalFormData = Omit<SavingsGoal, 'createdAt'>;

/** What the app hands the jar UI: the state plus everything that changes it. */
export type Jar = {
  savings: Savings;
  offer: LeftoverOffer | null;
  saveGoal: (goal: GoalFormData) => void;
  deleteJar: () => void;
  add: (amount: number, note?: string) => void;
  takeOut: (amount: number, note?: string) => void;
  takeOffer: () => void;
  skipOffer: () => void;
};

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };
const EMOJIS = ['🎯', '📱', '💻', '✈️', '🏠', '🚗', '🎮', '🎁', '🎓', '🐰'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (key: string) => { const d = new Date(key + 'T00:00:00'); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const entryLabel = (e: JarEntry) => e.note || (e.kind === 'leftover' ? 'Left over' : e.kind === 'withdraw' ? 'Taken out' : 'Added');

// ─── Goal editor ──────────────────────────────────────────────────────────────

export const JarEditor = ({ visible, goal, entries, currency, onSave, onDelete, onClose }: {
  visible: boolean;
  goal: SavingsGoal | null;
  entries: JarEntry[];
  currency: string;
  onSave: (goal: GoalFormData) => void;
  onDelete?: () => void;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const [name, setName]     = useState('');
  const [emoji, setEmoji]   = useState(EMOJIS[0]);
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(goal?.name ?? '');
    setEmoji(goal?.emoji ?? EMOJIS[0]);
    setTarget(goal ? String(goal.target) : '');
  }, [visible]);

  const value   = parseFloat(target || '0');
  const canSave = name.trim().length > 0 && value > 0;
  const label   = { fontFamily: 'Jua', fontSize: fs(12), color: 'rgba(212,149,106,0.75)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 20, marginLeft: 4 } as const;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ minWidth: 60 }}>
            <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: 'rgba(232,213,192,0.6)' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(18) }}>{goal ? 'Savings jar' : 'New savings jar'}</Text>
          <View style={{ minWidth: 60 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={label}>What are you saving for?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {EMOJIS.map(e => (
              <TouchableOpacity key={e} onPress={() => { haptic.light(); setEmoji(e); }} accessibilityLabel={`Icon ${e}`} accessibilityState={{ selected: e === emoji }}
                style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: e === emoji ? C.accent : 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: e === emoji ? C.accent : 'rgba(212,149,106,0.2)' }}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: name.trim() ? C.accent : 'rgba(212,149,106,0.2)' }}>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. New phone" placeholderTextColor="rgba(232,213,192,0.25)"
              maxLength={40} style={{ fontFamily: 'Jua', fontSize: fs(18), color: C.cream, paddingVertical: 16 }} />
          </View>

          <Text style={label}>Goal</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1.5, borderColor: value > 0 ? C.accent : 'rgba(212,149,106,0.2)' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(20), color: 'rgba(212,149,106,0.7)', marginRight: 6 }}>{currency === '__carrot__' ? '🥕' : currency}</Text>
            <TextInput value={target} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="rgba(232,213,192,0.25)"
              onChangeText={v => { const clean = v.replace(/[^0-9.]/g, ''); const [whole, dec] = clean.split('.'); setTarget(dec !== undefined ? `${whole}.${dec.slice(0, 2)}` : whole); }}
              maxLength={10} style={{ flex: 1, fontFamily: 'DynaPuff', fontSize: fs(22), color: C.cream, paddingVertical: 14 }} />
          </View>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 10, marginLeft: 4 }}>
            The jar tracks money you've actually put aside. It doesn't change your budget.
          </Text>

          {goal && entries.length > 0 && (
            <>
              <Text style={label}>History</Text>
              <View style={{ backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
                {[...entries].reverse().slice(0, 30).map((e, i) => (
                  <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(212,149,106,0.1)' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }} numberOfLines={1}>{entryLabel(e)}</Text>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted }}>{shortDate(e.date)}</Text>
                    </View>
                    <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: e.amount >= 0 ? C.green : C.cream }}>{e.amount >= 0 ? '+' : '−'}</Text>
                    <CurrencyAmount currency={currency} amount={money(Math.abs(e.amount))} imageSize={fs(14)}
                      textStyle={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: e.amount >= 0 ? C.green : C.cream }} />
                  </View>
                ))}
              </View>
            </>
          )}

          {goal && onDelete && (
            <TouchableOpacity
              onPress={() => {
                haptic.light();
                Alert.alert('Empty the jar?', `This deletes "${goal.name}" and its history. It doesn't touch your budget or spending.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: onDelete },
                ]);
              }}
              style={{ alignSelf: 'center', marginTop: 24, paddingVertical: 10, paddingHorizontal: 20 }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: '#f09090' }}>Delete jar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
          <TouchableOpacity disabled={!canSave} activeOpacity={0.8}
            onPress={() => { haptic.success(); onSave({ name: name.trim(), emoji, target: Math.round(value * 100) / 100 }); }}
            style={{ backgroundColor: canSave ? C.accent : 'rgba(212,149,106,0.18)', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: canSave ? '#fff' : 'rgba(255,255,255,0.3)' }}>{goal ? 'Save changes' : 'Start saving'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Finance card ─────────────────────────────────────────────────────────────

export const SavingsJarCard = ({ jar, currency }: { jar: Jar; currency: string }) => {
  const fs = useFontSize();
  const [editor, setEditor]     = useState(false);
  const [numpad, setNumpad]     = useState<'add' | 'take' | null>(null);
  const [input, setInput]       = useState('');
  const { goal, entries } = jar.savings;
  const saved = jarTotal(jar.savings);

  const closeNumpad = () => { setNumpad(null); setInput(''); };

  const modals = (
    <>
      <JarEditor visible={editor} goal={goal} entries={entries} currency={currency}
        onSave={g => { jar.saveGoal(g); setEditor(false); }}
        onDelete={() => { jar.deleteJar(); setEditor(false); }}
        onClose={() => setEditor(false)} />
      <NumpadModal
        visible={numpad !== null}
        title={numpad === 'take' ? 'Take out of the jar' : 'Add to the jar'}
        hint={numpad === 'take' ? `${goal?.emoji ?? ''} ${currency === '__carrot__' ? '🥕' : currency}${money(saved)} in the jar` : 'Money you’ve put aside'}
        confirmLabel={numpad === 'take' ? 'Take out' : 'Add'}
        amount={input}
        currency={currency}
        onChangeAmount={setInput}
        onConfirm={note => {
          const value = parseFloat(input || '0');
          if (value > 0) (numpad === 'take' ? jar.takeOut : jar.add)(Math.min(value, numpad === 'take' ? saved : Infinity), note);
          closeNumpad();
        }}
        onClose={closeNumpad}
        withNote
        notePlaceholder={numpad === 'take' ? 'What for? (optional)' : 'Where’s it from? (optional)'}
      />
    </>
  );

  if (!goal) {
    return (
      <>
        {modals}
        <TouchableOpacity onPress={() => { haptic.light(); setEditor(true); }} activeOpacity={0.8}
          style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: fs(24) }}>🫙</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Jua', color: C.cream, fontSize: fs(14) }}>Saving for something?</Text>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12), marginTop: 2 }}>Start a jar and watch it fill up.</Text>
          </View>
          <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(20) }}>+</Text>
        </TouchableOpacity>
      </>
    );
  }

  const pct     = goal.target > 0 ? Math.min(saved / goal.target, 1) : 0;
  const reached = saved >= goal.target;

  return (
    <>
      {modals}
      <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: reached ? 'rgba(157,224,135,0.4)' : C.border }}>
        <TouchableOpacity onPress={() => { haptic.light(); setEditor(true); }} activeOpacity={0.8} accessibilityHint="Edit the jar and see its history">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: fs(22), marginRight: 8 }}>{goal.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(11), letterSpacing: 1 }}>SAVINGS JAR</Text>
              <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(16) }} numberOfLines={1}>{goal.name}</Text>
            </View>
            <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(13) }}>Edit ›</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <CurrencyAmount currency={currency} amount={money(saved)} imageSize={fs(22)}
              textStyle={{ fontFamily: 'DynaPuff', color: reached ? C.green : C.cream, fontSize: fs(24) }} />
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13) }}>of {currency === '__carrot__' ? '🥕 ' : currency}{money(goal.target)}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden' }}>
            <View style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 99, backgroundColor: reached ? C.green : C.accent }} />
          </View>
          <Text style={{ fontFamily: 'Jua', color: reached ? C.green : C.muted, fontSize: fs(12), marginTop: 6 }}>
            {reached ? 'You reached your goal! 🎉' : `${Math.round(pct * 100)}% · ${currency === '__carrot__' ? '🥕 ' : currency}${money(goal.target - saved)} to go`}
          </Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <TouchableOpacity onPress={() => { haptic.light(); setNumpad('add'); }} activeOpacity={0.85}
            style={{ flex: 2, backgroundColor: 'rgba(157,224,135,0.12)', borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(157,224,135,0.35)' }}>
            <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(14) }}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.light(); if (saved > 0) setNumpad('take'); }} activeOpacity={saved > 0 ? 0.85 : 1}
            style={{ flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,213,192,0.2)', opacity: saved > 0 ? 1 : 0.4 }}>
            <Text style={{ fontFamily: 'Jua', color: C.cream, fontSize: fs(14) }}>Take out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

// ─── Leftover banner ──────────────────────────────────────────────────────────

/** "You had ₱340 left over last week" with Add / Skip (or Start a jar when there isn't one). */
export const LeftoverBanner = ({ jar, currency }: { jar: Jar; currency: string }) => {
  const fs = useFontSize();
  const [editor, setEditor] = useState(false);
  const offer = jar.offer;
  if (!offer) return null;
  const goal = jar.savings.goal;

  return (
    <>
      <JarEditor visible={editor} goal={null} entries={[]} currency={currency}
        onSave={g => { jar.saveGoal(g); jar.takeOffer(); setEditor(false); }}
        onClose={() => setEditor(false)} />
      <View style={{ backgroundColor: 'rgba(100,160,90,0.14)', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(157,224,135,0.3)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: fs(26) }}>{goal?.emoji ?? '🫙'}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(14) }}>You had </Text>
              <CurrencyAmount currency={currency} amount={money(offer.amount)} imageSize={fs(13)}
                textStyle={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(14) }} />
              <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(14) }}> left {offer.label}! 🎉</Text>
            </View>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12), marginTop: 2 }}>
              {goal ? `Put it in your "${goal.name}" jar?` : 'Start a savings jar with it?'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity onPress={() => { haptic.light(); jar.skipOffer(); }} activeOpacity={0.8}
            style={{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,213,192,0.2)' }}>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13) }}>Not this time</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { if (goal) { haptic.success(); jar.takeOffer(); } else { haptic.light(); setEditor(true); } }} activeOpacity={0.85}
            style={{ flex: 2, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(157,224,135,0.22)', borderWidth: 1, borderColor: 'rgba(157,224,135,0.45)' }}>
            <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(13) }}>{goal ? 'Add to jar' : 'Start a jar'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};
