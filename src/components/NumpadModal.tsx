import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Image, TouchableWithoutFeedback } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { applyNumpadKey } from '../helpers';

const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

export const NumpadModal = ({ visible, title, hint, confirmLabel, amount, currency, onChangeAmount, onConfirm, onClose }: {
  visible: boolean; title: string; hint?: string; confirmLabel: string; amount: string; currency: string;
  onChangeAmount: (v: string) => void; onConfirm: () => void; onClose: () => void;
}) => {
  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) haptic.medium();
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: visible ? 1 : 0.88, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: visible ? 1 : 0, duration: visible ? 180 : 140, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  const hasAmount = parseFloat(amount || '0') > 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '86%', backgroundColor: '#3B2220', borderRadius: 28, padding: 22, paddingBottom: 18, borderWidth: 1.5, borderColor: 'rgba(212,149,106,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: 12, opacity: 0.7, letterSpacing: 2, textTransform: 'uppercase' }}>{title}</Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: hasAmount ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingVertical: 16, paddingHorizontal: 20, marginBottom: hint ? 6 : 18, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={{ fontFamily: 'DynaPuff', fontSize: 18, color: 'rgba(212,149,106,0.6)' }}>{currency}</Text>
                  <Text style={{ fontFamily: 'DynaPuff', fontSize: 42, minWidth: 60, textAlign: 'center', color: hasAmount ? '#e8d5c0' : 'rgba(232,213,192,0.25)' }}>{amount === '' ? '0' : amount}</Text>
                </View>
              </View>
              {hint && <Text style={{ fontFamily: 'Jua', fontSize: 12, textAlign: 'center', color: 'rgba(232,213,192,0.35)', marginBottom: 16 }}>{hint}</Text>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {NUMPAD_KEYS.map(key => {
                  const isBack = key === '⌫'; const isDot = key === '.';
                  return (
                    <TouchableOpacity key={key} onPress={() => { haptic.light(); onChangeAmount(applyNumpadKey(amount, key)); }} activeOpacity={0.55}
                      style={{ width: '30.5%', paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isBack ? 'rgba(200,80,60,0.12)' : 'rgba(212,149,106,0.1)',
                        borderWidth: 1, borderColor: isBack ? 'rgba(200,80,60,0.25)' : 'rgba(212,149,106,0.2)' }}>
                      <Text style={{ fontFamily: isBack || isDot ? 'Jua' : 'DynaPuff', fontSize: isBack ? 18 : isDot ? 26 : 22, color: isBack ? '#f09090' : 'rgba(232,213,192,0.85)' }}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity onPress={hasAmount ? () => { haptic.success(); onConfirm(); } : undefined} activeOpacity={hasAmount ? 0.8 : 1}
                style={{ backgroundColor: hasAmount ? '#D4956A' : 'rgba(212,149,106,0.2)', borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: hasAmount ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: hasAmount ? 6 : 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {hasAmount && <Image source={IMAGES.carrot} style={{ width: 18, height: 18 }} resizeMode="contain" />}
                  <Text style={{ fontFamily: 'DynaPuff', color: hasAmount ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16 }}>{hasAmount ? `${confirmLabel} ${currency}${amount}` : confirmLabel}</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};