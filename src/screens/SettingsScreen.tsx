// src/screens/SettingsScreen.tsx
//
// Settings page, opened from the gear icon on the Profile screen.

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Platform, Alert, Image
} from 'react-native';
import { useAppSettings } from './../context/SettingsContext';
import type { FontSize } from './../context/SettingsContext';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useFontSize } from '../hooks/useFontSize';
import { Linking } from 'react-native';
import { IMAGES } from '../constants';
import { currencyStr } from '../helpers';
import { TimeField } from '../components/TimePicker';
import { PERIOD_LABELS, type BudgetPeriod } from '../budget';
import type { EveningReminder } from '../types';
import { useProStatus } from '../context/ProContext';
import { getUserId } from '../utils/supabaseAuth';
import { syncRevenueCatUser } from '../utils/revenueCatIdentity';
import Purchases from 'react-native-purchases';

// ─── Design tokens (match the rest of the app) ────────────────────────────────

const C = {
  bg:        '#2A1A18',
  card:      '#5C3D2E',
  cardDeep:  '#4A2E20',
  accent:    '#D4956A',
  cream:     '#e8d5c0',
  muted:     'rgba(232,213,192,0.45)',
  dim:       'rgba(232,213,192,0.25)',
  border:    'rgba(212,149,106,0.2)',
  borderHi:  'rgba(212,149,106,0.45)',
  shadow:    '#1a0a08',
};

const HAPTIC = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light: () => ReactNativeHapticFeedback.trigger('impactLight',  HAPTIC),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC),
};


// ─── Sub-components ───────────────────────────────────────────────────────────

/** Section wrapper with a pill header — matches SectionDivider look */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const fs = useFontSize();
  return (
    <View style={{ marginBottom: 24 }}>
      <Text
        style={{ fontFamily: 'Jua', fontSize: fs(10), color: C.accent, opacity: 0.7, letterSpacing: 2, marginBottom: 10, marginLeft: 2 }}
      >
        {title.toUpperCase()}
      </Text>
      <View style={{
        backgroundColor: C.card, borderRadius: 18, borderWidth: 1,
        borderColor: C.border, overflow: 'hidden', shadowColor: C.shadow,
        shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 3,
      }}>
        {children}
      </View>
    </View>
  );
};

/** A single row inside a Section */
const Row = ({ icon, label, sublabel, rightEl, onPress, last = false }: {
  icon: string; label: string; sublabel?: string;
  rightEl?: React.ReactNode; onPress?: () => void; last?: boolean;
}) => {
  const fs = useFontSize();
  const Inner = (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: last ? 0 : 1, borderBottomColor: C.border,
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: 'rgba(212,149,106,0.14)',
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
      }}>
        <Text style={{ fontSize: fs(17) }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }}>{label}</Text>
          {sublabel
            ? <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, marginTop: 1 }}>{sublabel}</Text>
            : null}
      </View>
      {rightEl}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.75}>{Inner}</TouchableOpacity>;
  return Inner;
};

/** Toggle pill — same style as ProfileScreen */
const Toggle = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
  <TouchableOpacity
    onPress={() => { haptic.light(); onToggle(); }}
    activeOpacity={0.8}
    style={{
      width: 44, height: 26, borderRadius: 13,
      backgroundColor: enabled ? C.accent : 'rgba(212,149,106,0.2)',
      justifyContent: 'center', paddingHorizontal: 3,
      alignItems: enabled ? 'flex-end' : 'flex-start',
    }}
  >
    <View style={{
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: '#fff',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
    }} />
  </TouchableOpacity>
);

/** Three-way font-size picker */
const FontSizePicker = () => {
  const { fontSize, setFontSize } = useAppSettings();
  const fs = useFontSize();

  const options: { key: FontSize; label: string; preview: number }[] = [
    { key: 'small',  label: 'Small',  preview: 13 },
    { key: 'medium', label: 'Medium', preview: 16 },
    { key: 'large',  label: 'Large',  preview: 19 },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 14 }}>
      {options.map(opt => {
        const selected = fontSize === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => { haptic.light(); setFontSize(opt.key); }}
            activeOpacity={0.75}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
              backgroundColor: selected ? 'rgba(212,149,106,0.22)' : 'rgba(212,149,106,0.06)',
              borderWidth: 1.5, borderColor: selected ? C.accent : C.border,
            }}
          >
            {/* "Aa" always renders at the option's own fixed size so you can compare them */}
            <Text style={{ fontFamily: 'DynaPuff', fontSize: opt.preview, color: selected ? C.accent : C.muted, marginBottom: 5 }}>
              Aa
            </Text>
            {/* The label underneath scales with the current setting */}
            <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: selected ? C.accent : C.dim, letterSpacing: 0.5 }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const CURRENCIES = [
  { symbol: '__carrot__', label: 'Carrot', isImage: true }, 
  { symbol: '₱', label: 'PHP' },
  { symbol: '$',  label: 'USD' },
  { symbol: '€',  label: 'EUR' },
  { symbol: '£',  label: 'GBP' },
  { symbol: '¥',  label: 'JPY' },
  { symbol: '₩',  label: 'KRW' },
];

const CurrencyPicker = ({ currency, onSetCurrency }: { currency: string; onSetCurrency: (v: string) => void }) => {
  const fs = useFontSize();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 }}>
      {CURRENCIES.map(c => {
        const selected = currency === c.symbol;
        return (
          <TouchableOpacity
            key={c.symbol}
            onPress={() => { haptic.light(); onSetCurrency(c.symbol); }}
            activeOpacity={0.75}
            style={{
              alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
              borderRadius: 12, minWidth: 64,
              backgroundColor: selected ? 'rgba(212,149,106,0.22)' : 'rgba(212,149,106,0.06)',
              borderWidth: 1.5, borderColor: selected ? C.accent : C.border,
            }}
          >
            {c.isImage
              ? <Image source={IMAGES.carrot_currency} style={{ width: fs(20), height: fs(20) }} resizeMode="contain" />
              : <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(16), color: selected ? C.accent : C.muted }}>
                  {c.symbol}
                </Text>
            }
            <Text style={{ fontFamily: 'Jua', fontSize: fs(10), color: selected ? C.accent : C.dim, marginTop: 3, letterSpacing: 0.5 }}>
              {c.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

interface SettingsScreenProps {
  currency:              string;
  budgetPeriod:          BudgetPeriod;
  budgetAmount:          number;
  eveningReminder:       EveningReminder;
  onSetEveningReminder:  (v: EveningReminder) => void;
  onOpenBudget:          () => void;
  onSetCurrency:         (v: string) => void;
  onResetToday:          () => void;
  onDeleteAllData:       () => void;
  onBack:                () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  currency,
  budgetPeriod,
  budgetAmount,
  eveningReminder,
  onSetEveningReminder,
  onOpenBudget,
  onSetCurrency,
  onResetToday,
  onDeleteAllData,
  onBack,
}) => {
  const fs = useFontSize();

  const { isPro, restorePurchases } = useProStatus();
  const [restoring, setRestoring] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  // RevenueCat must be logged in as the account id for the coach to recognise Pro.
  const [purchasesLinked, setPurchasesLinked] = useState<boolean | null>(null);

  const refreshAccount = async () => {
    try {
      const [id, rcId] = await Promise.all([getUserId(), Purchases.getAppUserID()]);
      setAccountId(id);
      setPurchasesLinked(id === rcId);
    } catch {}
  };
  useEffect(() => { refreshAccount(); }, []);

  const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  const handleLink = async () => {
    haptic.light();
    try {
      await syncRevenueCatUser();
      await refreshAccount();
      Alert.alert('Linked', 'Purchases are linked to this account. Restore purchases if Pro still isn’t recognised.');
    } catch (e) {
      Alert.alert('Couldn’t link purchases', errorText(e));
    }
  };

  const handleRestore = async () => {
    haptic.light();
    setRestoring(true);
    try {
      await restorePurchases();
      await refreshAccount();
      Alert.alert('Restore complete', 'Any purchases on this Apple ID are now on this account.');
    } catch (e) {
      Alert.alert('Restore failed', errorText(e));
    } finally {
      setRestoring(false);
    }
  };

  const handleReset = () => {
    haptic.light();
    Alert.alert("Reset Today's Data", "This will uncheck all of today's Habbits and clear today's spending. Are you sure?", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onResetToday },
    ]);
    };

    const handleDeleteAll = () => {
    haptic.light();
    Alert.alert('Delete All Data', 'This will permanently delete everything. Are you absolutely sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: () =>
        Alert.alert('Are you sure?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Yes, delete everything', style: 'destructive', onPress: onDeleteAllData },
        ])
        },
    ]);
    };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: (Platform.OS === 'ios' ? 4 : 12),
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
      }}>
        <TouchableOpacity
          onPress={() => { haptic.light(); onBack(); }}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: 'rgba(212,149,106,0.12)',
            borderWidth: 1, borderColor: C.border,
            justifyContent: 'center', alignItems: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ fontSize: 16, color: C.accent }}>←</Text>
        </TouchableOpacity>

        <View>
          <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, letterSpacing: 1 }}>APP</Text>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: fs(22), color: C.cream, lineHeight: fs(28) }}>Settings</Text>
        </View>
      </View>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Appearance ─────────────────────────────────────────────── */}
        <Section title="Appearance">
          {/* Font size */}
          <View>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
            }}>
              <View style={{
                width: 34, height: 34, borderRadius: 10,
                backgroundColor: 'rgba(212,149,106,0.14)',
                justifyContent: 'center', alignItems: 'center',
                marginRight: 12,
              }}>
                <Text style={{ fontSize: fs(17) }}>🔡</Text>
              </View>
              <View>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }}>Text Size</Text>
                <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, marginTop: 1 }}>
                  Adjusts text throughout the app
                </Text>
              </View>
            </View>
            <FontSizePicker />
          </View>
        </Section>

        {/* ── Finance ────────────────────────────────────────────────── */}
      <Section title="Finance">
        <Row
          icon="🥕"
          label="Budget"
          sublabel={`${PERIOD_LABELS[budgetPeriod].adjective} · ${currencyStr(currency, budgetAmount.toLocaleString('en-US'))} — edit in Finance`}
          onPress={() => { haptic.light(); onOpenBudget(); }}
          rightEl={<Text style={{ fontSize: fs(15), color: C.muted }}>›</Text>}
        />
        <View>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
          }}>
            <View style={{
              width: 34, height: 34, borderRadius: 10,
              backgroundColor: 'rgba(212,149,106,0.14)',
              justifyContent: 'center', alignItems: 'center', marginRight: 12,
            }}>
              <Text style={{ fontSize: fs(17) }}>💰</Text>
            </View>
            <View>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream }}>Currency</Text>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(11), color: C.muted, marginTop: 1 }}>
                Used across Finance and Home
              </Text>
            </View>
          </View>
          <CurrencyPicker currency={currency} onSetCurrency={onSetCurrency} />
        </View>
      </Section>

        {/* ── Notifications ──────────────────────────────────────────── */}
        <Section title="Notifications">
          <Row
            icon="🌙"
            label="Evening check-in"
            sublabel={eveningReminder.enabled
              ? 'Only on days with Habbits still left'
              : 'A nudge in the evening if Habbits are left'}
            last={!eveningReminder.enabled}
            rightEl={
              <Toggle
                enabled={eveningReminder.enabled}
                onToggle={() => onSetEveningReminder({ ...eveningReminder, enabled: !eveningReminder.enabled })}
              />
            }
          />
          {eveningReminder.enabled && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
              <Text style={{ fontFamily: 'Jua', fontSize: fs(14), color: C.cream, marginLeft: 46 }}>Remind me at</Text>
              <TimeField
                title="Evening check-in"
                hour={eveningReminder.hour}
                minute={eveningReminder.minute}
                onChange={(hour, minute) => onSetEveningReminder({ ...eveningReminder, hour, minute })}
              />
            </View>
          )}
        </Section>

        {/* ── Data ───────────────────────────────────────────────────── */}
        <Section title="Data & Privacy">
          <Row
            icon="📄"
            label="Terms of Use"
            sublabel="EULA · opens in browser"
            onPress={() => {
              haptic.light();
              Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
            }}
            rightEl={<Text style={{ fontSize: 13, color: C.muted }}>›</Text>}
          />
          <Row
            icon="🔒"
            label="Privacy Policy"
            sublabel="How your data is handled"
            last
            onPress={() => {
              haptic.light();
              Linking.openURL('https://docs.google.com/document/d/e/2PACX-1vS6O5IJ28VMu6mbxgFHUhSFA-qbGt76PgLwlp4yLztI8l1AP3cKXaUZhlHAdPcQkvH7VHxDithqqFFa/pub');
            }}
            rightEl={<Text style={{ fontSize: 13, color: C.muted }}>›</Text>}
          />
        </Section>

        {/* ── About ──────────────────────────────────────────────────── */}
        {/* ── Subscription ───────────────────────────────────────────── */}
        <Section title="Subscription">
          <Row
            icon="🥕"
            label={isPro ? 'Habbit Pro' : 'Free plan'}
            sublabel={isPro ? 'Thanks for supporting Habbit!' : 'Upgrade from your Profile'}
          />
          <Row
            icon="🔄"
            label={restoring ? 'Restoring…' : 'Restore purchases'}
            sublabel="Already subscribed on this Apple ID? Bring it back here."
            onPress={restoring ? undefined : handleRestore}
            rightEl={<Text style={{ fontSize: fs(15), color: C.muted }}>›</Text>}
          />
          <Row
            icon="🪪"
            label="Account ID"
            sublabel={`${accountId ?? '—'}\n${purchasesLinked === null ? '' : purchasesLinked ? 'Purchases linked ✓' : 'Purchases not linked — tap to fix'}`}
            onPress={purchasesLinked === false ? handleLink : undefined}
            last
          />
        </Section>

        <Section title="About">
          <Row
            icon="🐰"
            label="Habbit"
            sublabel="Your daily companion"
            rightEl={
              <Text style={{ fontFamily: 'Jua', fontSize: 12, color: C.muted }}>v2.0</Text>
            }
          />
          <Row
            icon="✉️"
            label="Send Feedback"
            sublabel="Help make Habbit better"
            last
            rightEl={
              <Text style={{ fontSize: 13, color: C.muted }}>›</Text>
            }
            onPress={() => {
              haptic.light();
              Linking.openURL(
                'mailto:selrvk@gmail.com?subject=Habbit%20Feedback'
              );
            }}
          />
        </Section>
            
        {/* ── Danger Zone ───────────────────────────────────────────── */}
        <Section title="Danger Zone">
        <Row
            icon="🔄"
            label="Reset Today's Data"
            sublabel="Unchecks Habbits · clears today's spending"
            last={false}
            onPress={handleReset}
            rightEl={<Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(240,144,144,0.6)' }}>›</Text>}
        />
        <Row
            icon="🗑️"
            label="Delete All Data"
            sublabel="Resets app completely · cannot be undone"
            last
            onPress={handleDeleteAll}
            rightEl={<Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(255,107,107,0.6)' }}>›</Text>}
        />
        </Section>

      </ScrollView>
    </View>
  );
};