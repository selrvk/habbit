// src/components/SavingsJar.tsx
//
// Savings jars: the Finance cards (progress, add / take out; several jars swipe side to
// side), the goal editor, and the "you had money left over" banner shown on Home and Finance.

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
import { MAX_JARS, jarTotal, type JarEntry, type LeftoverOffer, type Savings, type SavingsGoal, type SavingsJar } from '../savings';

export type GoalFormData = Omit<SavingsGoal, 'createdAt'>;

/** What the app hands the jar UI: the state plus everything that changes it. */
export type Jar = {
  savings: Savings;
  offer: LeftoverOffer | null;
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
            onPress={() => { haptic.success(); onSave({ name: name.trim(), emoji, target: Math.round(value * 100) / 100 }); }}
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

  const closeNumpad = () => { setNumpad(null); setInput(''); };

  return (
    <>
      <JarEditor visible={editor} goal={goal} entries={entries} currency={currency}
        onSave={g => { api.saveJar(jar.id, g); setEditor(false); }}
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

  const editorModal = (
    <JarEditor visible={editor} goal={null} entries={[]} currency={currency}
      onSave={g => { jar.saveJar(null, g); setEditor(false); }}
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
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12), marginTop: 2 }}>Start a jar and watch it fill up.</Text>
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

// ─── Leftover banner ──────────────────────────────────────────────────────────

/**
 * "You had ₱340 left over last week" with Skip and Add (or Start a jar when there isn't one,
 * or a choice of jars when there are several).
 */
export const LeftoverBanner = ({ jar, currency }: { jar: Jar; currency: string }) => {
  const fs = useFontSize();
  const [editor, setEditor] = useState(false);
  const offer = jar.offer;
  if (!offer) return null;
  const jars = jar.savings.jars;
  const only = jars.length === 1 ? jars[0] : null;

  return (
    <>
      <JarEditor visible={editor} goal={null} entries={[]} currency={currency}
        onSave={g => { jar.takeOffer(jar.saveJar(null, g)); setEditor(false); }}
        onClose={() => setEditor(false)} />
      <View style={{ backgroundColor: 'rgba(100,160,90,0.14)', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(157,224,135,0.3)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {only ? <Text style={{ fontSize: fs(26) }}>{only.goal.emoji}</Text> : <Icon name="jar" size={fs(34)} />}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(14) }}>You had </Text>
              <CurrencyAmount currency={currency} amount={money(offer.amount)} imageSize={fs(13)}
                textStyle={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(14) }} />
              <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(14) }}> left {offer.label}! 🎉</Text>
            </View>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(12), marginTop: 2 }}>
              {only ? `Put it in your "${only.goal.name}" jar?` : jars.length > 1 ? 'Which jar should it go in?' : 'Start a savings jar with it?'}
            </Text>
          </View>
        </View>
        {jars.length > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {jars.map(j => (
              <TouchableOpacity key={j.id} onPress={() => { haptic.success(); jar.takeOffer(j.id); }} activeOpacity={0.85}
                accessibilityLabel={`Add it to ${j.goal.name}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(157,224,135,0.22)', borderWidth: 1, borderColor: 'rgba(157,224,135,0.45)' }}>
                <Text style={{ fontSize: fs(15) }}>{j.goal.emoji}</Text>
                <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(13) }} numberOfLines={1}>{j.goal.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity onPress={() => { haptic.light(); jar.skipOffer(); }} activeOpacity={0.8}
            style={{ flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(232,213,192,0.2)' }}>
            <Text style={{ fontFamily: 'Jua', color: C.muted, fontSize: fs(13) }}>Not this time</Text>
          </TouchableOpacity>
          {jars.length <= 1 && (
            <TouchableOpacity onPress={() => { if (only) { haptic.success(); jar.takeOffer(only.id); } else { haptic.light(); setEditor(true); } }} activeOpacity={0.85}
              style={{ flex: 2, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(157,224,135,0.22)', borderWidth: 1, borderColor: 'rgba(157,224,135,0.45)' }}>
              <Text style={{ fontFamily: 'DynaPuff', color: C.green, fontSize: fs(13) }}>{only ? 'Add to jar' : 'Start a jar'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
};
