// src/components/NumpadModal.tsx

import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Animated, Image, TextInput, TouchableWithoutFeedback, Platform } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IMAGES } from '../constants';
import { applyNumpadKey } from '../helpers';
import { CurrencyAmount } from './CurrencyAmount';

const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

const NOTE_MODAL_SHIFT = Platform.OS === 'ios' ? -130 : -110;

export const NumpadModal = ({ visible, title, hint, confirmLabel, amount, currency, onChangeAmount, onConfirm, onClose, withNote = false }: {
  visible: boolean; title: string; hint?: string; confirmLabel: string; amount: string; currency: string;
  onChangeAmount: (v: string) => void; onConfirm: (note?: string) => void; onClose: () => void;
  withNote?: boolean;
}) => {
  const scaleAnim      = useRef(new Animated.Value(0.88)).current;
  const opacityAnim    = useRef(new Animated.Value(0)).current;
  const noteAnim       = useRef(new Animated.Value(0)).current;
  // Proactively shifts the modal up before the keyboard appears — avoids the
  // reactive jump caused by KeyboardAvoidingView.
  const modalShiftAnim = useRef(new Animated.Value(0)).current;
  const noteInputRef   = useRef<TextInput>(null);
  const [step, setStep] = useState<'amount' | 'note'>('amount');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      haptic.medium();
      setStep('amount');
      setNote('');
      noteAnim.setValue(0);
      modalShiftAnim.setValue(0);
    }
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: visible ? 1 : 0.88, useNativeDriver: true, tension: 120, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: visible ? 1 : 0, duration: visible ? 180 : 140, useNativeDriver: true }),
    ]).start();
  }, [visible]);

const goToNote = () => {
    haptic.success();
    // 1. Set state first so the UI prepares
    setStep('note');
    
    // 2. Animate immediately. 
    // We use a slightly faster duration to ensure the modal is already 
    // moving up by the time the keyboard starts its "slide" animation.
    Animated.parallel([
      Animated.spring(noteAnim, { 
        toValue: 1, 
        useNativeDriver: true, 
        tension: 140, // Increased tension for snappiness
        friction: 10 
      }),
      Animated.spring(modalShiftAnim, { 
        toValue: NOTE_MODAL_SHIFT, 
        useNativeDriver: true, 
        tension: 140, 
        friction: 10 
      }),
    ]).start();

    // 3. Delay focus slightly so the keyboard doesn't "punch" the modal upward
    setTimeout(() => noteInputRef.current?.focus(), 100);
  };

  const handleConfirm = (skipNote = false) => {
    haptic.success();
    onConfirm(skipNote ? undefined : note.trim() || undefined);
    setStep('amount');
    setNote('');
    noteAnim.setValue(0);
    modalShiftAnim.setValue(0);
  };

  const hasAmount = parseFloat(amount || '0') > 0;

  const noteSlideY    = noteAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const noteOpacity   = noteAnim;
  const numpadOpacity = noteAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'center', opacity: opacityAnim }}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View style={{
              transform: [{ scale: scaleAnim }, { translateY: modalShiftAnim }],
              width: '86%',
              alignSelf: 'center',
              backgroundColor: '#3B2220',
              borderRadius: 28,
              padding: 22,
              paddingBottom: 18,
              borderWidth: 1.5,
              borderColor: 'rgba(212,149,106,0.35)',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 14 },
              shadowOpacity: 0.55,
              shadowRadius: 28,
              elevation: 24,
            }}>

              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: 12, opacity: 0.7, letterSpacing: 2, textTransform: 'uppercase' }}>
                  {step === 'note' ? 'Add a note' : title}
                </Text>
                <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Amount display — always visible, dims on note step */}
              <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: step === 'note' ? 'rgba(212,149,106,0.15)' : (hasAmount ? '#D4956A' : 'rgba(212,149,106,0.2)'), paddingVertical: 16, paddingHorizontal: 20, marginBottom: hint && step === 'amount' ? 6 : 18, alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <CurrencyAmount
                    currency={currency}
                    amount={amount === '' ? '0' : amount}
                    textStyle={{
                      fontFamily: 'DynaPuff',
                      fontSize: 42,
                      minWidth: 60,
                      textAlign: 'center',
                      color: step === 'note' ? 'rgba(232,213,192,0.3)' : (hasAmount ? '#e8d5c0' : 'rgba(232,213,192,0.25)'),
                    }}
                    size={42}
                  />
                </View>
              </View>

              {hint && step === 'amount' && (
                <Text style={{ fontFamily: 'Jua', fontSize: 12, textAlign: 'center', color: 'rgba(232,213,192,0.35)', marginBottom: 16 }}>{hint}</Text>
              )}

              {/* Note step */}
              {step === 'note' && (
                <Animated.View style={{ opacity: noteOpacity, transform: [{ translateY: noteSlideY }], marginBottom: 16 }}>
                  <View style={{ backgroundColor: '#5C3D2E', borderRadius: 14, borderWidth: 1.5, borderColor: note.trim() ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 12 }}>
                    <TextInput
                      ref={noteInputRef}
                      value={note}
                      onChangeText={setNote}
                      placeholder="What was this for? (optional)"
                      placeholderTextColor="rgba(232,213,192,0.25)"
                      returnKeyType="done"
                      onSubmitEditing={() => handleConfirm(false)}
                      maxLength={60}
                      style={{ fontFamily: 'Jua', fontSize: 15, color: '#e8d5c0', paddingVertical: 14 }}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={() => handleConfirm(true)} activeOpacity={0.7}
                      style={{ flex: 1, backgroundColor: 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ fontFamily: 'Jua', fontSize: 14, color: 'rgba(232,213,192,0.55)' }}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleConfirm(false)} activeOpacity={0.8}
                      style={{ flex: 2, backgroundColor: '#D4956A', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}>
                      <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 15 }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {/* Numpad — hidden on note step */}
              {step === 'amount' && (
                <Animated.View style={{ opacity: numpadOpacity }}>
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
                  <TouchableOpacity onPress={hasAmount ? (withNote ? goToNote : () => { haptic.success(); onConfirm(); }) : undefined} activeOpacity={hasAmount ? 0.8 : 1}
                    style={{ backgroundColor: hasAmount ? '#D4956A' : 'rgba(212,149,106,0.2)', borderRadius: 16, paddingVertical: 15, alignItems: 'center', shadowColor: hasAmount ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: hasAmount ? 6 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {hasAmount && <Image source={IMAGES.carrot} style={{ width: 18, height: 18 }} resizeMode="contain" />}
                      {hasAmount ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 16 }}>{confirmLabel} </Text>
                          <CurrencyAmount
                            currency={currency}
                            amount={amount}
                            textStyle={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 16 }}
                            size={16}
                          />
                        </View>
                      ) : (
                        <Text style={{ fontFamily: 'DynaPuff', color: 'rgba(255,255,255,0.3)', fontSize: 16 }}>
                          {confirmLabel}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}

            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};