import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Image, Linking } from 'react-native';
import { useProStatus } from '../context/ProContext';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// Legal URLs — Terms uses Apple's standard EULA (also listed in App Store Connect).
const TERMS_URL   = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://docs.google.com/document/d/e/2PACX-1vS6O5IJ28VMu6mbxgFHUhSFA-qbGt76PgLwlp4yLztI8l1AP3cKXaUZhlHAdPcQkvH7VHxDithqqFFa/pub';

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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Text style={{ fontFamily: 'DynaPuff', color: '#e8d5c0', fontSize: 28 }}>
          Habbit Pro
        </Text>
        <Image
          source={require('../../assets/bonbon/idle.png')}
          style={{ width: 36, height: 36, marginLeft: 8 }}
          resizeMode="contain"
        />
      </View>
      <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
        Unlock everything Bonbon has to offer
      </Text>

      {/* Features */}
      {[
        '🥕  50 daily Bonbon messages',
        '📜  Longer AI chat memory',
        '📊  & more soon!',
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

      <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.45)', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 }}>
        All proceeds go toward keeping Habbit alive and in active development :D
      </Text>

      <TouchableOpacity onPress={handleRestore} disabled={loading} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.4)', fontSize: 12 }}>
          Restore purchases
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} style={{ marginTop: 12, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.3)', fontSize: 12 }}>
          Not now
        </Text>
      </TouchableOpacity>

      {/* Subscription disclosure — required by App Store Guideline 3.1.2 */}
      <Text style={{
        fontFamily: 'Jua',
        color: 'rgba(232,213,192,0.4)',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 14,
        paddingHorizontal: 8,
      }}>
        Habbit Pro — {monthlyPrice ?? '...'}/month or {yearlyPrice ?? '...'}/year.
        Payment is charged to your Apple ID. Subscription auto-renews unless cancelled
        at least 24 hours before the end of the current period. Manage or cancel anytime
        in your App Store account settings.
      </Text>

      {/* Legal links — required by App Store Guideline 3.1.2 */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
        <TouchableOpacity onPress={() => { haptic.light(); Linking.openURL(TERMS_URL); }}>
          <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.55)', fontSize: 11, textDecorationLine: 'underline' }}>
            Terms of Use
          </Text>
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.3)', fontSize: 11, marginHorizontal: 8 }}>•</Text>
        <TouchableOpacity onPress={() => { haptic.light(); Linking.openURL(PRIVACY_URL); }}>
          <Text style={{ fontFamily: 'Jua', color: 'rgba(232,213,192,0.55)', fontSize: 11, textDecorationLine: 'underline' }}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};