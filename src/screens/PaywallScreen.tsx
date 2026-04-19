import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useProStatus } from '../context/ProContext';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const JUA = 'Jua';
const DYNAPUFF = 'DynaPuff';
const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = { light: () => ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS) };

interface PaywallScreenProps {
  onClose: () => void;
}

export const PaywallScreen: React.FC<PaywallScreenProps> = ({ onClose }) => {
  const { purchasePro, restorePurchases, monthlyPrice, yearlyPrice } = useProStatus();
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<'monthly' | 'yearly'>('monthly'); // default to monthly

  const handlePurchase = async () => {
    try {
      setLoading(true);
      await purchasePro(selected);
      onClose();
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      await restorePurchases();
      Alert.alert('Restored!', 'Your Pro subscription has been restored.');
      onClose();
    } catch {
      Alert.alert('Restore failed', 'No previous purchases found.');
    } finally {
      setLoading(false);
    }
  };

  const OptionCard = ({ period, price, label, sublabel }: {
    period: 'monthly' | 'yearly';
    price: string | null;
    label: string;
    sublabel: string;
  }) => {
    const isSelected = selected === period;
    return (
      <TouchableOpacity
        onPress={() => { haptic.light(); setSelected(period); }}
        activeOpacity={0.8}
        style={{
          flex: 1,
          backgroundColor: isSelected ? 'rgba(212,149,106,0.15)' : '#5C3D2E',
          borderRadius: 16, padding: 16, alignItems: 'center',
          borderWidth: 2,
          borderColor: isSelected ? '#D4956A' : 'rgba(212,149,106,0.15)',
        }}
      >
        <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.6)', marginBottom: 4 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: 'DynaPuff', fontSize: 20, color: isSelected ? '#D4956A' : '#e8d5c0' }}>
          {price ?? '—'}
        </Text>
        <Text style={{ fontFamily: 'Jua', fontSize: 10, color: 'rgba(232,213,192,0.4)', marginTop: 4 }}>
          {sublabel}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2A1A18', padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 28, textAlign: 'center', marginBottom: 8 }}>
        Habbit Pro 🐰
      </Text>
      <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
        Unlock everything Bonbon has to offer
      </Text>

      {/* Features */}
      {[
        '🥕  50 daily Bonbon messages',
        '📜  Longer AI chat memory',
        '📊  Monthly habits & finance reports',
      ].map(f => (
        <Text key={f} style={{ fontFamily: 'Jua', color: '#e8d5c0', fontSize: 14, marginBottom: 12 }}>
          {f}
        </Text>
      ))}

      {/* Plan selector */}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 20 }}>
        <OptionCard
          period="monthly"
          price={monthlyPrice}
          label="Monthly"
          sublabel="per month"
        />
        <OptionCard
          period="yearly"
          price={yearlyPrice}
          label="Yearly"
          sublabel="best value 🎉"
        />
      </View>

      {/* Purchase button */}
      <TouchableOpacity
        onPress={handlePurchase}
        disabled={loading}
        style={{
          backgroundColor: '#D4956A',
          borderRadius: 16, paddingVertical: 16, alignItems: 'center',
        }}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 16 }}>
              {selected === 'yearly'
                ? `Get Yearly — ${yearlyPrice ?? '...'}`
                : `Get Monthly — ${monthlyPrice ?? '...'}`
              }
            </Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRestore} disabled={loading} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.4)', fontSize: 12 }}>
          Restore purchases
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.3)', fontSize: 12 }}>
          Not now
        </Text>
      </TouchableOpacity>
    </View>
  );
};