import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Animated, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const haptic = {
  medium:  () => ReactNativeHapticFeedback.trigger('impactMedium',        { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false }),
};

export const TextModal = ({ visible, title, placeholder, initialValue, onSave, onClose }: {
  visible: boolean; title: string; placeholder: string; initialValue: string;
  onSave: (v: string) => void; onClose: () => void;
}) => {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);
  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setText(initialValue); haptic.medium();
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 0.88, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const canSave = text.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={{ flex: 1, backgroundColor: 'rgba(18,7,5,0.80)', justifyContent: 'center', alignItems: 'center', opacity: opacityAnim }}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }], width: '86%', backgroundColor: '#3B2220', borderRadius: 24, padding: 22, borderWidth: 1.5, borderColor: 'rgba(212,149,106,0.35)', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.55, shadowRadius: 28, elevation: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <Text style={{ fontFamily: 'Jua', color: '#D4956A', fontSize: 12, opacity: 0.7, letterSpacing: 2, textTransform: 'uppercase' }}>{title}</Text>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={{ color: 'rgba(232,213,192,0.4)', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ backgroundColor: '#5C3D2E', borderRadius: 14, borderWidth: 1.5, borderColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 16, paddingVertical: 4, marginBottom: 20 }}>
                  <TextInput ref={inputRef} value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={() => canSave && (haptic.success(), onSave(text.trim()))} maxLength={24}
                    style={{ fontFamily: 'Jua', fontSize: 18, color: '#e8d5c0', paddingVertical: 14 }} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={onClose} activeOpacity={0.7}
                    style={{ flex: 1, backgroundColor: 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Jua', fontSize: 14, color: 'rgba(232,213,192,0.55)' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={canSave ? () => { haptic.success(); onSave(text.trim()); } : undefined} activeOpacity={canSave ? 0.8 : 1}
                    style={{ flex: 2, backgroundColor: canSave ? '#D4956A' : 'rgba(212,149,106,0.2)', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: canSave ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: canSave ? 6 : 0 }}>
                    <Text style={{ fontFamily: 'DynaPuff', color: canSave ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 15 }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};