// src/components/FocusSheet.tsx
//
// The focus timer, full screen: a ring of ticks counting down the round (or the break after
// it), with pause and stop. It moves from round to break to round by itself. Closing it
// doesn't stop the timer: it carries on, with a notification at each switch. The app counts
// the rounds (App.tsx, focus.ts). A quick session (one without a habit) is set up here
// first (QuickFocusSetup.tsx), and the sheet carries straight on to its timer.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, Alert } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { avatarImage } from '../helpers';
import { breakMinutesAfter, clock, durationLabel, onLongBreak, progress, sessionEndsAt, timeLeft, type FocusSession, type QuickFocusSettings } from '../focus';
import { QuickFocusSetup } from './QuickFocusSetup';
import { Icon } from './Icon';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', muted: 'rgba(232,213,192,0.5)', track: 'rgba(212,149,106,0.16)' };

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

/** "3:40 PM". */
const endTime = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const TICKS = 60;
const RING  = 270;

/** 60 ticks around a circle, filled clockwise from the top as the phase goes by. */
const TickRing = ({ share, color }: { share: number; color: string }) => {
  const filled = Math.round(share * TICKS);
  return (
    <View style={{ width: RING, height: RING }}>
      {Array.from({ length: TICKS }, (_, i) => (
        <View key={i} style={{ position: 'absolute', left: RING / 2 - 2, top: 0, width: 4, height: RING, transform: [{ rotate: `${(i * 360) / TICKS}deg` }] }}>
          <View style={{ width: 4, height: i % 5 === 0 ? 18 : 12, borderRadius: 2, backgroundColor: i < filled ? color : C.track }} />
        </View>
      ))}
    </View>
  );
};

const Button = ({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) => {
  const fs = useFontSize();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={{
        flex: 1, borderRadius: 16, paddingVertical: 15, alignItems: 'center',
        backgroundColor: primary ? C.accent : 'transparent', borderWidth: primary ? 0 : 1.5, borderColor: 'rgba(232,213,192,0.25)',
      }}>
      <Text style={{ fontFamily: primary ? 'DynaPuff' : 'Jua', fontSize: fs(16), color: primary ? '#fff' : C.cream }}>{label}</Text>
    </TouchableOpacity>
  );
};

/** `quick`: a session without a habit, so it's the session that's done, not the day. */
export type FocusDone = { label: string; minutes: number; blocks: number; quick?: boolean };

export const FocusSheet = ({ visible, session, setup, doneSoFar, done, avatar, todayMinutes, onPause, onResume, onStop, onNext, onElapsed, onClose }: {
  visible: boolean;
  session: FocusSession | null;
  /** Setting up a quick session, while nothing's running: what it starts from, and starting it. */
  setup: { initial: QuickFocusSettings; onStart: (settings: QuickFocusSettings, label: string) => void } | null;
  /** How many of the day's rounds the habit has had (timed or tapped), for the break. */
  doneSoFar: number;
  /** Shown once the day's last round is done. */
  done: FocusDone | null;
  avatar: string;
  /** Minutes focused today, all habits. */
  todayMinutes: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /** Skips the break: the next round starts now. */
  onNext: () => void;
  /** A round's or break's countdown reached zero with the sheet open. */
  onElapsed: () => void;
  onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());

  const paused  = session?.pausedLeft !== undefined;
  const ticking = visible && !!session && !paused;
  useEffect(() => {
    if (!ticking) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [ticking, session?.id, session?.phase, session?.block]);

  // Tell the app once when a round or a break runs out while it's on screen: it moves on.
  const elapsedFor = useRef<string | null>(null);
  const left = session ? timeLeft(session, now) : 0;
  useEffect(() => {
    if (!visible || !session || paused || left > 0) return;
    const phase = `${session.id}-${session.block}-${session.phase}`;
    if (elapsedFor.current === phase) return;
    elapsedFor.current = phase;
    haptic.success();
    onElapsed();
  }, [visible, session, paused, left, onElapsed]);

  const onBreak = session?.phase === 'break';
  const rounds  = session?.blocks ?? 1;
  // After this round: a break, the next round straight away, or nothing more.
  const restNext = session && !onBreak ? breakMinutesAfter(session) : 0;
  const lastRound = !!session && session.block >= rounds;

  const confirmStop = () => {
    if (!session) return;
    haptic.light();
    const focused = Math.floor((session.minutes * 60_000 - left) / 60_000);
    Alert.alert('Stop this round?', `It won’t count${focused > 0 ? `, though you’ve focused ${durationLabel(focused)}` : ''}.${session.block > 1 ? ' The rounds you’ve finished stay.' : ''} You can start again any time.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: onStop },
    ]);
  };

  const title = done ? (done.quick ? 'Session complete!' : 'All done for today!') : !session ? '' : paused ? 'Paused' : onBreak ? (onLongBreak(session) ? 'Long break' : 'Take a breather') : 'Focus';
  const ringColor = onBreak ? C.green : C.accent;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { haptic.light(); onClose(); }} hitSlop={12}
            accessibilityLabel={session ? 'Close. The timer keeps running' : 'Close'}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,149,106,0.12)' }}>
            <Text style={{ fontSize: fs(18), color: C.accent }}>⌄</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>
            {todayMinutes > 0 ? `Focused today · ${durationLabel(todayMinutes)}` : ''}
          </Text>
        </View>

        {setup && !session && !done ? <QuickFocusSetup initial={setup.initial} onStart={setup.onStart} /> : (<>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), letterSpacing: 2, color: onBreak ? C.green : C.accent, opacity: 0.85 }}>
            {title.toUpperCase()}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: 'DynaPuff', fontSize: fs(26), color: C.cream, textAlign: 'center', marginTop: 6 }}>
            {done?.label ?? session?.label ?? ''}
          </Text>
          {session && session.blocks > 1 && (
            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.muted, marginTop: 4 }}>
              {onBreak ? `${Math.min(doneSoFar, session.blocks)} of ${session.blocks} rounds done` : `Round ${session.block} of ${session.blocks}`}
            </Text>
          )}

          <View style={{ marginTop: 28, alignItems: 'center', justifyContent: 'center' }}>
            <TickRing share={done ? 1 : session ? progress(session, now) : 0} color={done ? C.green : ringColor} />
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <Image source={avatarImage(avatar)} style={{ width: 64, height: 64, marginBottom: 6, opacity: paused ? 0.5 : 1 }} resizeMode="contain" />
              {done ? (
                <Icon name="party-popper" size={fs(44)} />
              ) : (
                <Text accessibilityLabel={`${Math.ceil(left / 60_000)} minutes left`}
                  style={{ fontFamily: 'DynaPuff', fontSize: fs(48), color: paused ? C.muted : C.cream, fontVariant: ['tabular-nums'] }}>
                  {clock(left)}
                </Text>
              )}
              <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginTop: 2 }}>
                {done ? `${done.blocks > 1 ? `${done.blocks} of ${done.blocks} done · ` : ''}${durationLabel(done.minutes)} focused`
                  : paused ? 'paused' : onBreak ? `until round ${session!.block + 1}` : 'left'}
              </Text>
            </View>
          </View>
        </View>

        {done ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button label="Close" primary onPress={() => { haptic.light(); onClose(); }} />
          </View>
        ) : !session ? null : onBreak ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button label="Done for now" onPress={() => { haptic.light(); onStop(); }} />
            <Button label={doneSoFar >= session.blocks ? 'Finish' : 'Skip break'} primary onPress={() => { haptic.success(); onNext(); }} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button label="Stop" onPress={confirmStop} />
            <Button label={paused ? 'Resume' : 'Pause'} primary onPress={() => { haptic.light(); (paused ? onResume : onPause)(); }} />
          </View>
        )}
        {session && !done && (
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 12 }}>
            {onBreak ? `Stretch, sip some water, look away from the screen. Round ${session.block + 1} starts by itself.`
              : lastRound ? 'You can close this. The timer keeps going and lets you know when it’s done.'
              : `You can close this. ${restNext > 0 ? `A ${restNext}-minute break` : `Round ${session.block + 1}`} follows by itself, and it all wraps up around ${endTime(sessionEndsAt(session, now))}.`}
          </Text>
        )}
        </>)}
      </View>
    </Modal>
  );
};
