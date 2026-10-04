// src/components/WhatsNewSheet.tsx
//
// "What's new in Habbit 3": a few pages to swipe through, shown once to people updating from
// an earlier version (App.tsx). New installs skip it; onboarding covers the same ground.

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
export const WHATS_NEW_VERSION = '3';

type Page = { icons: IconName[]; title: string; lines: string[]; hint?: string };

const PAGES: Page[] = [
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
      'Time a Habbit in focus blocks, with the timer on your Lock Screen',
      'Log workouts: routines that take turns, last time’s weights and a rest timer between sets',
    ],
    hint: 'Turn them on when you add or edit a Habbit.' },
  { icons: ['jar', 'receipt'], title: 'Money that explains itself',
    lines: [
      'Categories, so you can see where it all went',
      'Bills that log themselves when they’re due',
      'A savings jar for what’s left over',
      'A summary of every month',
    ] },
  { icons: ['lightning'], title: 'Log from anywhere',
    lines: [
      'New widgets: check off Habbits and log spending from your Home Screen',
      'Siri and Shortcuts: “Log an expense in Habbit”',
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

export const WhatsNewSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
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
