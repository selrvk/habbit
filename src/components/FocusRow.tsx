// src/components/FocusRow.tsx
//
// Home's way into the focus timer: it starts a quick session (one without a Habbit), or,
// while a timer runs for anything, shows its countdown and gets back to it.

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useFontSize } from '../hooks/useFontSize';
import { clock, durationLabel, timeLeft, type FocusSession } from '../focus';
import { Icon } from './Icon';

const C = { cream: '#e8d5c0', accent: '#D4956A', green: '#9de087', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };

export const FocusRow = ({ session, todayMinutes, onPress }: {
  /** The timer running, for a Habbit or a quick session. */
  session: FocusSession | null;
  /** Minutes focused today, all in. */
  todayMinutes: number;
  /** Opens the running timer, or the quick session's setup. */
  onPress: () => void;
}) => {
  const fs = useFontSize();
  const [now, setNow] = useState(Date.now());
  const paused = session?.pausedLeft !== undefined;
  useEffect(() => {
    if (!session || paused) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.id, session?.phase, session?.block, paused]);

  const onBreak = session?.phase === 'break';
  const left    = session ? clock(timeLeft(session, now)) : '';
  const round   = session && session.blocks > 1 ? `Round ${session.block} of ${session.blocks} · ` : '';
  const detail  = !session ? (todayMinutes > 0 ? `${durationLabel(todayMinutes)} focused today` : 'Start a session, no Habbit needed')
    : paused ? `${round}paused at ${left}`
    : onBreak ? `Break · ${left} until round ${session.block + 1}`
    : `${round}${left} left`;

  return (
    <TouchableOpacity onPress={() => { ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }); onPress(); }}
      activeOpacity={0.8} accessibilityRole="button"
      accessibilityLabel={session ? `${session.label} focus timer. ${detail}. Opens the timer` : `Focus timer. ${detail}. Starts a quick session`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 24,
        backgroundColor: session ? 'rgba(212,149,106,0.16)' : 'rgba(92,61,46,0.45)',
        borderWidth: 1, borderColor: session ? 'rgba(212,149,106,0.45)' : C.border,
      }}>
      <Icon name={onBreak ? 'coffee' : 'stopwatch'} size={fs(30)} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'DynaPuff', color: C.cream, fontSize: fs(15) }} numberOfLines={1}>{session ? session.label : 'Focus timer'}</Text>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), marginTop: 1, color: !session || paused ? C.muted : onBreak ? C.green : C.accent, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {session ? (
        <Text style={{ fontFamily: 'Jua', color: C.accent, fontSize: fs(20) }}>›</Text>
      ) : (
        <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,149,106,0.14)', borderWidth: 1.5, borderColor: C.accent }}>
          <Text style={{ fontSize: 13, color: C.accent, marginLeft: 2 }}>▶</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};
