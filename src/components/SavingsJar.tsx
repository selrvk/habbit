// src/components/SavingsJar.tsx
//
// Savings jars: the Finance cards (progress, add / take out; several jars swipe side to
// side) and the goal editor. What's left of a budget is offered as one line at the foot of
// the jar's card, below the buttons for logging spending, so it's never in the way.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { CurrencyAmount } from './CurrencyAmount';
import { NumpadModal } from './NumpadModal';
import { Icon, ProPill } from './Icon';
import { PaywallScreen } from '../screens/PaywallScreen';
import { useProStatus } from '../context/ProContext';
import { MAX_JARS, jarTotal, type JarEntry, type LeftoverMode, type LeftoverOffer, type Savings, type SavingsGoal, type SavingsJar } from '../savings';

export type GoalFormData = Omit<SavingsGoal, 'createdAt'>;

/** What the app hands the jar UI: the state plus everything that changes it. */
export type Jar = {
  savings: Savings;
  /** A leftover to ask about (none while leftovers go into a jar by themselves, or are off). */
  offer: LeftoverOffer | null;
  /** How leftovers are handled, and the jar they go into by themselves. */
  leftover: { mode: LeftoverMode; jarId?: string };
  setLeftover: (mode: LeftoverMode, jarId?: string) => void;
  /** Saves a jar's goal, or starts a new jar (id null). Returns the jar's id. */
  saveJar: (id: string | null, goal: GoalFormData) => string;
  deleteJar: (id: string) => void;
  add: (id: string, amount: number, note?: string) => void;
  takeOut: (id: string, amount: number, note?: string) => void;
  /** Puts the leftover on offer into that jar. */
  takeOffer: (id: string) => void;
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

const LEFTOVER_MODES: { key: LeftoverMode; label: string; hint: string }[] = [
  { key: 'ask',  label: 'Ask me',           hint: 'When a budget ends with money left, this jar offers to take it.' },
  { key: 'auto', label: 'Add it by itself', hint: 'It goes into this jar by itself. You’ll find it in the jar’s history.' },
  { key: 'off',  label: 'Don’t offer',      hint: 'Leftovers are never offered.' },
];

// ─── Goal editor ──────────────────────────────────────────────────────────────

export const JarEditor = ({ visible, goal, entries, currency, leftover, onSave, onDelete, onClose }: {
  visible: boolean;
  goal: SavingsGoal | null;
  entries: JarEntry[];
  currency: string;
  /** How leftovers are handled, for a jar that exists. `elsewhere` names another jar they go into by themselves. */
  leftover?: { mode: LeftoverMode; elsewhere?: string };
  /** `mode` is given only when it was changed. */
  onSave: (goal: GoalFormData, mode?: LeftoverMode) => void;
  onDelete?: () => void;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const [name, setName]     = useState('');
  const [emoji, setEmoji]   = useState(EMOJIS[0]);
  const [target, setTarget] = useState('');
  // Not set until picked: while leftovers go into another jar, none of the choices is this jar's.
  const [mode, setMode]     = useState<LeftoverMode | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(goal?.name ?? '');
    setEmoji(goal?.emoji ?? EMOJIS[0]);
    setTarget(goal ? String(goal.target) : '');
    setMode(null);
  }, [visible]);

  const shownMode = mode ?? (leftover?.elsewhere ? null : leftover?.mode ?? null);

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

          {goal && leftover && (
            <>
              <Text style={label}>When there's budget left over</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {LEFTOVER_MODES.map(m => {
                  const active = m.key === shownMode;
                  return (
                    <TouchableOpacity key={m.key} onPress={() => { haptic.light(); setMode(m.key); }} activeOpacity={0.7}
                      accessibilityRole="button" accessibilityLabel={m.label} accessibilityState={{ selected: active }}
                      style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 99, backgroundColor: active ? C.accent : 'rgba(212,149,106,0.08)', borderWidth: 1, borderColor: active ? C.accent : 'rgba(212,149,106,0.22)' }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: active ? '#fff' : 'rgba(232,213,192,0.65)' }}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, marginTop: 10, marginLeft: 4 }}>
                {shownMode ? LEFTOVER_MODES.find(m => m.key === shownMode)?.hint : `Right now it goes into “${leftover.elsewhere}” by itself.`}
              </Text>
            </>
          )}

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
                Alert.alert('Delete this jar?', `This deletes "${goal.name}" and its history. It doesn't touch your budget or spending.`, [
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
            onPress={() => { haptic.success(); onSave({ name: name.trim(), emoji, target: Math.round(value * 100) / 100 }, mode ?? undefined); }}
            style={{ backgroundColor: canSave ? C.accent : 'rgba(212,149,106,0.18)', borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: canSave ? '#fff' : 'rgba(255,255,255,0.3)' }}>{goal ? 'Save changes' : 'Start saving'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Finance cards ────────────────────────────────────────────────────────────

/** One jar: its goal and progress (tap to edit and see its history), with Add and Take out. */
const JarCard = ({ jar, api, currency }: { jar: SavingsJar; api: Jar; currency: string }) => {
  const fs = useFontSize();
  const [editor, setEditor] = useState(false);
  const [numpad, setNumpad] = useState<'add' | 'take' | null>(null);
  const [input, setInput]   = useState('');
  const { goal, entries } = jar;
  const saved   = jarTotal(jar);
  const pct     = goal.target > 0 ? Math.min(saved / goal.target, 1) : 0;
  const reached = saved >= goal.target;
  const offer   = api.offer;
  // Another jar that leftovers go into by themselves.
  const autoJar = api.leftover.mode === 'auto' && api.leftover.jarId !== jar.id ? api.savings.jars.find(j => j.id === api.leftover.jarId) : undefined;

  const closeNumpad = () => { setNumpad(null); setInput(''); };

  return (
    <>
      <JarEditor visible={editor} goal={goal} entries={entries} currency={currency}
        leftover={{ mode: api.leftover.mode, elsewhere: autoJar?.goal.name }}
        onSave={(g, mode) => { api.saveJar(jar.id, g); if (mode) api.setLeftover(mode, jar.id); setEditor(false); }}
        onDelete={() => { api.deleteJar(jar.id); setEditor(false); }}
        onClose={() => setEditor(false)} />
      <NumpadModal
        visible={numpad !== null}
        title={numpad === 'take' ? 'Take out of the jar' : 'Add to the jar'}
        hint={numpad === 'take' ? `${goal.emoji} ${currency === '__carrot__' ? '🥕' : currency}${money(saved)} in the jar` : `${goal.emoji} ${goal.name}`}
        confirmLabel={numpad === 'take' ? 'Take out' : 'Add'}
        amount={input}
        currency={currency}
        onChangeAmount={setInput}
        onConfirm={note => {
          const value = parseFloat(input || '0');
          if (value > 0) (numpad === 'take' ? api.takeOut : api.add)(jar.id, Math.min(value, numpad === 'take' ? saved : Infinity), note);
          closeNumpad();
        }}
        onClose={closeNumpad}
        withNote
        notePlaceholder={numpad === 'take' ? 'What for? (optional)' : 'Where’s it from? (optional)'}
      />
      <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: reached ? 'rgba(157,224,135,0.4)' : C.border }}>
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
        {offer && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(157,224,135,0.22)' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                <CurrencyAmount currency={currency} amount={money(offer.amount)} imageSize={fs(13)}
                  textStyle={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(13) }} />
                <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(13) }}> left over {offer.label} 🎉</Text>
              </View>
              <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(11), marginTop: 1 }}>Put it in this jar?</Text>
            </View>
            <TouchableOpacity onPress={() => { haptic.success(); api.takeOffer(jar.id); }} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel={`Add what was left over ${offer.label} to ${goal.name}`}
              style={{ borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: 'rgba(157,224,135,0.22)', borderWidth: 1, borderColor: 'rgba(157,224,135,0.45)' }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(13) }}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { haptic.light(); api.skipOffer(); }} activeOpacity={0.7} hitSlop={8}
              accessibilityRole="button" accessibilityLabel="Not this time"
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(232,213,192,0.2)' }}>
              <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13) }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
};

/** Finance's savings: a prompt to start a jar, or the jars (side by side to swipe through). */
export const SavingsJars = ({ jar, currency }: { jar: Jar; currency: string }) => {
  const fs = useFontSize();
  const { isPro } = useProStatus();
  const jars = jar.savings.jars;
  const [editor, setEditor]   = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [width, setWidth]     = useState(0);
  const [page, setPage]       = useState(0);
  const scroller = useRef<ScrollView>(null);

  // A new jar is added at the end: show it. A deleted one can leave the page past the end.
  const count = useRef(jars.length);
  useEffect(() => {
    const grew = jars.length > count.current;
    count.current = jars.length;
    const to = grew ? jars.length - 1 : Math.min(page, Math.max(jars.length - 1, 0));
    if (to !== page) setPage(to);
    if (width > 0) requestAnimationFrame(() => scroller.current?.scrollTo({ x: to * width, animated: grew }));
  }, [jars.length]);

  // A first jar starts with the leftover on offer, if there is one.
  const offer = jars.length === 0 ? jar.offer : null;
  const editorModal = (
    <JarEditor visible={editor} goal={null} entries={[]} currency={currency}
      onSave={g => { const id = jar.saveJar(null, g); if (offer) jar.takeOffer(id); setEditor(false); }}
      onClose={() => setEditor(false)} />
  );

  if (jars.length === 0) {
    return (
      <>
        {editorModal}
        <TouchableOpacity onPress={() => { haptic.light(); setEditor(true); }} activeOpacity={0.8}
          style={{ backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="jar" size={fs(32)} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Jua', color: C.cream, fontSize: fs(14) }}>Saving for something?</Text>
            <Text style={{ fontFamily: 'Jua', color: offer ? C.green : C.muted, fontSize: fs(12), marginTop: 2 }}>
              {offer ? `You had ${currency === '__carrot__' ? '🥕 ' : currency}${money(offer.amount)} left over ${offer.label}. Start a jar with it.` : 'Start a jar and watch it fill up.'}
            </Text>
          </View>
          <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(20) }}>+</Text>
        </TouchableOpacity>
      </>
    );
  }

  const total = Math.round(jars.reduce((s, j) => s + jarTotal(j), 0) * 100) / 100;

  return (
    <View style={{ marginBottom: 24 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {editorModal}
      <Modal visible={paywall} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaywall(false)}>
        <PaywallScreen onClose={() => setPaywall(false)} />
      </Modal>

      {/* The pages need the width, so until it's measured show the first jar on its own. */}
      {jars.length === 1 || width === 0 ? (
        <JarCard jar={jars[Math.min(page, jars.length - 1)]} api={jar} currency={currency} />
      ) : (
        <>
          <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            contentOffset={{ x: page * width, y: 0 }}
            onMomentumScrollEnd={e => width > 0 && setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
            {jars.map(j => (
              <View key={j.id} style={{ width }}>
                <JarCard jar={j} api={jar} currency={currency} />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 }}
            accessibilityLabel={`Jar ${page + 1} of ${jars.length}`}>
            {jars.map((j, i) => (
              <View key={j.id} style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? C.accent : 'rgba(212,149,106,0.3)' }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 6 }}>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12) }}>{currency === '__carrot__' ? '🥕 ' : currency}{money(total)} saved across {jars.length} jars</Text>
          </View>
        </>
      )}

      {jars.length < MAX_JARS && (
        <TouchableOpacity onPress={() => { haptic.light(); if (isPro) setEditor(true); else setPaywall(true); }} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={isPro ? 'Start another jar' : 'Start another jar, with Habbit Pro'}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'center', marginTop: 10, paddingVertical: 6, paddingHorizontal: 12 }}>
          <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(13) }}>＋ Start another jar</Text>
          {!isPro && <ProPill />}
        </TouchableOpacity>
      )}
    </View>
  );
};
