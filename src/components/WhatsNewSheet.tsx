// src/components/WhatsNewSheet.tsx
//
// "What's new": a few pages to swipe through, shown once to people updating from an earlier
// version (App.tsx). Someone who saw the pages for Habbit 3 gets the short set for 3.1; someone
// coming straight from before 3 gets the whole tour, with 3.1 folded in. New installs skip it;
// onboarding covers the same ground.

import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useFontSize } from '../hooks/useFontSize';
import { Icon } from './Icon';
import type { IconName } from '../icons';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };
const haptic = () => ReactNativeHapticFeedback.trigger('impactLight', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });

/** Bump when there's a new set of pages to show; people who've seen this one get it again. */
export const WHATS_NEW_VERSION = '3.1';
/** The version whose pages were the whole tour: having seen it, only what came after is new. */
const TOUR_VERSION = '3';

type Page = { icons: IconName[]; title: string; lines: string[]; hint?: string };

/** For someone who has seen Habbit 3's pages: what 3.1 added. */
const NEW_PAGES: Page[] = [
  { icons: ['bonbon'], title: 'New in Habbit 3.1',
    lines: ['A lot of this came from your feedback. Thank you! Here’s what changed.'] },
  { icons: ['stopwatch', 'coffee'], title: 'A real Pomodoro timer',
    lines: [
      'Focus rounds and breaks now run one after the other, by themselves',
      'Pick how many rounds, with a longer break after every fourth',
      'Quick focus: start a session without a Habbit, from the Focus timer on Home',
    ],
    hint: 'Hold the app icon for Start Focus, or say “Start a focus timer in Habbit”.' },
  { icons: ['money-bag', 'receipt'], title: 'More for your money',
    lines: [
      'Scan a receipt to fill in an expense',
      'Net worth: add up what you have and what you owe',
      'Yearly bills, and reminders a day or a week ahead',
      'Leftover budget is offered to your jar quietly, on daily budgets too',
    ],
    hint: 'Net worth is on the Finance tab, below the month’s recap.' },
  { icons: ['dumbbell'], title: 'Planks count too',
    lines: [
      'Time holds like planks and wall sits in a workout',
      'Your longest hold counts as a personal best',
    ],
    hint: 'Edit a routine and switch an exercise from Reps to Time.' },
];

/** The whole tour, for someone coming from before Habbit 3. */
const TOUR_PAGES: Page[] = [
  { icons: ['bonbon'], title: 'Welcome to Habbit 3',
    lines: ['Our biggest update yet! Here’s a quick look at what’s new.'] },
  { icons: ['fire', 'calendar'], title: 'Habbits that fit real life',
    lines: [
      'A streak for every Habbit, not just one for the day',
      '“3× a week” goals, for things like the gym',
      'Skip a day when life happens, without losing your streak',
      'Tap a Habbit to see its calendar and best streak',
    ] },
  { icons: ['stopwatch', 'dumbbell'], title: 'Focus and workouts',
    lines: [
      'Time a Habbit in focus rounds with breaks, with the timer on your Lock Screen',
      'Or start a quick focus session from Home, no Habbit needed',
      'Log workouts: routines that take turns, last time’s weights, timed holds like planks, and a rest timer between sets',
    ],
    hint: 'Turn them on when you add or edit a Habbit.' },
  { icons: ['jar', 'receipt'], title: 'Money that explains itself',
    lines: [
      'Categories, so you can see where it all went',
      'Bills that log themselves when they’re due, monthly, weekly or yearly',
      'A savings jar for what’s left over',
      'A summary of every month, and your net worth',
    ] },
  { icons: ['lightning'], title: 'Log from anywhere',
    lines: [
      'New widgets: check off Habbits and log spending from your Home Screen',
      'Siri and Shortcuts: “Log an expense in Habbit”',
      'Scan a receipt to fill in an expense',
      'Hold the app icon for quick actions',
    ],
    hint: 'To add a widget, hold your Home Screen, then tap Edit.' },
  { icons: ['trophy', 'cloud'], title: 'And a few more things',
    lines: [
      'A recap of your week every Sunday',
      '26 achievements to earn',
      'Automatic iCloud backup, so a new phone keeps everything',
    ] },
];

export const WhatsNewSheet = ({ visible, seen, onClose }: {
  visible: boolean;
  /** The WHATS_NEW_VERSION last seen, if any: it decides between the short set and the whole tour. */
  seen: string | null;
  onClose: () => void;
}) => {
  const PAGES = seen === TOUR_VERSION ? NEW_PAGES : TOUR_PAGES;
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [page, setPage]   = useState(0);
  const last = page === PAGES.length - 1;

  const next = () => {
    haptic();
    if (last) { onClose(); return; }
    scroll.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 18, height: 52 }}>
          {!last && (
            <TouchableOpacity onPress={() => { haptic(); onClose(); }} hitSlop={12}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(15), color: C.muted }}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {width > 0 && (
          <ScrollView
            ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            style={{ flex: 1 }}
          >
            {PAGES.map(p => (
              <ScrollView key={p.title} style={{ width }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 24 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
                  {p.icons.map(icon => <Icon key={icon} name={icon} size={fs(84)} />)}
                </View>
                <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(26), color: C.cream, textAlign: 'center', marginBottom: 20 }}>{p.title}</Text>
                {p.lines.length === 1 ? (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(16), color: C.muted, textAlign: 'center', lineHeight: fs(24) }}>{p.lines[0]}</Text>
                ) : (
                  <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18, gap: 14, borderWidth: 1, borderColor: C.border }}>
                    {p.lines.map(line => (
                      <View key={line} style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginTop: fs(8) }} />
                        <Text style={{ flex: 1, fontFamily: 'Jua', fontSize: fs(15), color: C.cream, lineHeight: fs(22) }}>{line}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {p.hint && (
                  <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, textAlign: 'center', marginTop: 14 }}>{p.hint}</Text>
                )}
              </ScrollView>
            ))}
          </ScrollView>
        )}

        <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {PAGES.map((p, i) => (
              <View key={p.title} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? C.accent : 'rgba(212,149,106,0.25)' }} />
            ))}
          </View>
          <TouchableOpacity onPress={next} activeOpacity={0.85}
            style={{ backgroundColor: C.accent, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: '#fff' }}>{last ? 'Let’s go!' : page === 0 ? 'Show me' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
