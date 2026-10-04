// src/components/AchievementsSheet.tsx
//
// Every achievement, earned ones with the day they were earned, the rest with how far along.

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFontSize } from '../hooks/useFontSize';
import { parseDateKey } from '../helpers';
import { Icon } from './Icon';
import { ACHIEVEMENTS, EARNED_BEFORE, describe, progressText, type AchievementData, type AchievementGroup, type Earned } from '../achievements';

const C = { bg: '#2A1A18', card: '#5C3D2E', accent: '#D4956A', cream: '#e8d5c0', green: '#9de087', muted: 'rgba(232,213,192,0.55)', border: 'rgba(212,149,106,0.18)' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GROUPS: { key: AchievementGroup; title: string }[] = [
  { key: 'habits', title: 'Habbits' }, { key: 'money', title: 'Money' }, { key: 'bonbon', title: 'Bonbon' },
];

/** "Sep 28"; ✓ for ones earned by history from before achievements existed. */
const shortDate = (key: string) => {
  if (key === EARNED_BEFORE) return '✓';
  const d = parseDateKey(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export const AchievementsSheet = ({ visible, earned, data, onClose }: {
  visible: boolean; earned: Earned; data: AchievementData; onClose: () => void;
}) => {
  const fs     = useFontSize();
  const insets = useSafeAreaInsets();
  // Progress is only worked out while the sheet is open.
  const progress = useMemo(
    () => (visible ? Object.fromEntries(ACHIEVEMENTS.filter(a => a.progress && !earned[a.id]).map(a => [a.id, a.progress!(data)])) : {}),
    [visible, earned, data],
  );
  const total = ACHIEVEMENTS.length;
  const got   = ACHIEVEMENTS.filter(a => earned[a.id]).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 }}>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(22), color: C.cream }}>Achievements</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(13), color: C.muted, marginTop: 2 }}>{got} of {total} earned</Text>
          <View style={{ height: 8, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden', marginTop: 10 }}>
            <View style={{ height: '100%', width: `${(got / total) * 100}%`, borderRadius: 99, backgroundColor: C.accent }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}>
          {GROUPS.map(g => (
            <View key={g.key} style={{ marginTop: 20 }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: C.cream, marginBottom: 10 }}>{g.title}</Text>
              <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: C.border }}>
                {ACHIEVEMENTS.filter(a => a.group === g.key).map((a, i, list) => {
                  const when = earned[a.id];
                  const p    = progress[a.id];
                  const text = p ? progressText(a, p) : null;
                  return (
                    <View key={a.id} accessibilityLabel={`${a.title}. ${describe(a, data)}. ${when ? (when === EARNED_BEFORE ? 'Earned' : `Earned ${shortDate(when)}`) : text ?? 'Not earned yet'}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: 'rgba(212,149,106,0.1)' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: when ? 'rgba(212,149,106,0.22)' : 'rgba(232,213,192,0.05)', borderWidth: when ? 1.5 : 0, borderColor: C.accent }}>
                        <Icon name={a.icon} size={fs(28)} style={{ opacity: when ? 1 : 0.3 }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(14), color: when ? C.cream : C.muted }}>{a.title}</Text>
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: C.muted }}>{describe(a, data)}</Text>
                        {!when && p && p.target > 1 && (
                          <View style={{ height: 5, borderRadius: 99, backgroundColor: 'rgba(212,149,106,0.12)', overflow: 'hidden', marginTop: 6 }}>
                            <View style={{ height: '100%', width: `${(p.value / p.target) * 100}%`, borderRadius: 99, backgroundColor: C.accent }} />
                          </View>
                        )}
                      </View>
                      {when || text ? (
                        <Text style={{ fontFamily: 'Jua', fontSize: fs(12), color: when ? C.green : C.muted }}>
                          {when ? shortDate(when) : text}
                        </Text>
                      ) : (
                        <Icon name="padlock" size={fs(20)} style={{ opacity: 0.6 }} />
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: C.bg }}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={{ backgroundColor: C.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: '#fff' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
