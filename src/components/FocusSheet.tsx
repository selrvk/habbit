// src/components/FocusSheet.tsx
//
// The focus timer, full screen: a ring of ticks counting down the block (or the break after
// it), with pause and stop. Closing it doesn't stop the timer: it carries on, with a
// notification when the block ends. The app counts the block (App.tsx, focus.ts).

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, Alert } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { avatarImage } from '../helpers';
import { clock, durationLabel, progress, timeLeft, type FocusSession } from '../focus';
import { Icon } from './Icon';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', muted: 'rgba(232,213,192,0.5)', track: 'rgba(212,149,106,0.16)' };

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

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

export type FocusDone = { label: string; minutes: number; blocks: number };

export const FocusSheet = ({ visible, session, doneSoFar, done, avatar, todayMinutes, onPause, onResume, onStop, onNext, onElapsed, onClose }: {
  visible: boolean;
  session: FocusSession | null;
  /** How many of the day's blocks the habit has had (focus or tapped), for the break. */
  doneSoFar: number;
  /** Shown once the day's last block is done. */
  done: FocusDone | null;
  avatar: string;
  /** Minutes focused today, all habits. */
  todayMinutes: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  /** Starts the next block (after a break, or skipping it). */
  onNext: () => void;
  /** The block's countdown reached zero with the sheet open. */
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
  }, [ticking, session?.id, session?.phase]);

  // Tell the app once when a block runs out while it's on screen.
  const elapsedFor = useRef<string | null>(null);
  const left = session ? timeLeft(session, now) : 0;
  useEffect(() => {
    if (!visible || !session || session.phase !== 'focus' || paused || left > 0) return;
    if (elapsedFor.current === session.id) return;
    elapsedFor.current = session.id;
    haptic.success();
    onElapsed();
  }, [visible, session, paused, left, onElapsed]);

  const onBreak   = session?.phase === 'break';
  const breakOver = onBreak && left === 0;

  const confirmStop = () => {
    if (!session) return;
    haptic.light();
    const focused = Math.floor((session.minutes * 60_000 - left) / 60_000);
    Alert.alert('Stop this block?', `It won’t count${focused > 0 ? `, though you’ve focused ${durationLabel(focused)}` : ''}. You can start a fresh one any time.`, [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: onStop },
    ]);
  };

  const title = done ? 'All done for today!' : !session ? '' : onBreak ? (breakOver ? 'Break’s over' : 'Take a breather') : paused ? 'Paused' : 'Focus';
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

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), letterSpacing: 2, color: onBreak ? C.green : C.accent, opacity: 0.85 }}>
            {title.toUpperCase()}
          </Text>
          <Text numberOfLines={2} style={{ fontFamily: 'DynaPuff', fontSize: fs(26), color: C.cream, textAlign: 'center', marginTop: 6 }}>
            {done?.label ?? session?.label ?? ''}
          </Text>
          {session && session.blocks > 1 && (
            <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.muted, marginTop: 4 }}>
              {onBreak ? `${Math.min(doneSoFar, session.blocks)} of ${session.blocks} done` : `Block ${session.block} of ${session.blocks}`}
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
                  : onBreak ? (breakOver ? 'Ready when you are' : 'until the next block') : paused ? 'paused' : 'left'}
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
            <Button label={doneSoFar >= session.blocks ? 'Finish' : breakOver ? `Start block ${doneSoFar + 1}` : 'Skip break'} primary onPress={() => { haptic.success(); onNext(); }} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button label="Stop" onPress={confirmStop} />
            <Button label={paused ? 'Resume' : 'Pause'} primary onPress={() => { haptic.light(); (paused ? onResume : onPause)(); }} />
          </View>
        )}
        {session && !done && (
          <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted, textAlign: 'center', marginTop: 12 }}>
            {onBreak ? 'Stretch, sip some water, look away from the screen.' : 'You can close this. The timer keeps going and lets you know when it’s done.'}
          </Text>
        )}
      </View>
    </Modal>
  );
};
