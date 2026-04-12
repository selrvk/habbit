import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, Platform, Animated, Image, KeyboardAvoidingView } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { JUA, DYNAPUFF, DEFAULT_BUDGET, DEFAULT_CURRENCY, CURRENCIES, IMAGES } from '../constants';
import type { OnboardingResult } from '../types';

const HAPTIC_OPTIONS = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC_OPTIONS),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS),
};

const ONBOARD_STEPS = 5;

export const OnboardingScreen = ({ onComplete }: { onComplete: (result: OnboardingResult) => void }) => {
  const [step, setStep]                       = useState(0);
  const [name, setName]                       = useState('');
  const [habbit, setHabbit]                   = useState('');
  const [budgetInput, setBudgetInput]         = useState('');
  const [budgetCurrency, setBudgetCurrency]   = useState(DEFAULT_CURRENCY);

  const nameRef     = useRef<TextInput>(null);
  const habbitRef   = useRef<TextInput>(null);
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const animateToNext = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim,   { toValue: -30, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep); slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim,   { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }),
      ]).start();
    });
  };

  const goNext = () => {
    haptic.light(); animateToNext(step + 1);
    if (step === 0) setTimeout(() => nameRef.current?.focus(), 420);
    if (step === 1) setTimeout(() => habbitRef.current?.focus(), 420);
  };

  const handleFinish = () => {
    haptic.success();
    const parsedBudget = parseFloat(budgetInput || '0');
    onComplete({
      name: name.trim() || 'Friend',
      firstHabbit: habbit.trim() || null,
      budget: parsedBudget > 0 ? parsedBudget : DEFAULT_BUDGET,
      currency: budgetCurrency,
    });
  };

  const canProceedStep1 = name.trim().length > 0;
  const budgetSet       = parseFloat(budgetInput || '0') > 0;

  const Dots = () => (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 40 }}>
      {Array.from({ length: ONBOARD_STEPS }).map((_, i) => (
        <View key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, backgroundColor: i === step ? '#D4956A' : 'rgba(212,149,106,0.25)' }} />
      ))}
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 0: return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Dots />
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#5C3D2E', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2.5, borderColor: '#D4956A', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }}>
            <Image source={IMAGES.appLogo} style={{ width: 72, height: 72 }} resizeMode="contain" />
          </View>
          <Text style={{ fontFamily: 'DynaPuff', fontSize: 32, color: '#e8d5c0', marginBottom: 6, textAlign: 'center' }}>Habbit</Text>
          <Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(212,149,106,0.8)', marginBottom: 20, textAlign: 'center', letterSpacing: 1 }}>YOUR DAILY COMPANION</Text>
          <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, padding: 18, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(212,149,106,0.2)', width: '100%' }}>
            <Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(232,213,192,0.7)', textAlign: 'center', lineHeight: 20 }}>
              Yes, <Text style={{ color: '#D4956A' }}>Habbit</Text> is spelled with two B's on purpose 🐰{'\n'}
              It's a nod to <Text style={{ color: '#D4956A' }}>Habit</Text> + <Text style={{ color: '#D4956A' }}>Rabbit</Text> — your furry companion for building better daily routines and staying on budget.
            </Text>
          </View>
          <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 48, shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}>
            <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 17 }}>Let's get started 🥕</Text>
          </TouchableOpacity>
        </View>
      );

      case 1: return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Text style={{ fontSize: 48, marginBottom: 16 }}>👋</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: 26, color: '#e8d5c0', marginBottom: 8, textAlign: 'center' }}>What's your name?</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 32, textAlign: 'center' }}>This will appear on your home screen.</Text>
            <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: canProceedStep1 ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 20, paddingVertical: 4, marginBottom: 32, width: '100%' }}>
              <TextInput ref={nameRef} value={name} onChangeText={setName} placeholder="e.g. Charles" placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={() => canProceedStep1 && goNext()} maxLength={24}
                style={{ fontFamily: 'DynaPuff', fontSize: 22, color: '#e8d5c0', paddingVertical: 16, textAlign: 'center' }} />
            </View>
            <TouchableOpacity onPress={canProceedStep1 ? goNext : undefined} activeOpacity={canProceedStep1 ? 0.85 : 1}
              style={{ backgroundColor: canProceedStep1 ? '#D4956A' : 'rgba(212,149,106,0.25)', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: canProceedStep1 ? '#D4956A' : 'transparent', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: canProceedStep1 ? 6 : 0 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: canProceedStep1 ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: 16 }}>{canProceedStep1 ? `Nice to meet you, ${name.trim()} 🐰` : 'Enter your name'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      );

      case 2: return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: 26, color: '#e8d5c0', marginBottom: 8, textAlign: 'center' }}>Add your first Habbit</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 32, textAlign: 'center' }}>What's one thing you want to do every day?</Text>
            <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: habbit.trim().length > 0 ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 20, paddingVertical: 4, marginBottom: 12, width: '100%' }}>
              <TextInput ref={habbitRef} value={habbit} onChangeText={setHabbit} placeholder="e.g. Drink 8 glasses of water" placeholderTextColor="rgba(232,213,192,0.25)" returnKeyType="done" onSubmitEditing={goNext} maxLength={60}
                style={{ fontFamily: 'Jua', fontSize: 16, color: '#e8d5c0', paddingVertical: 16, textAlign: 'center' }} />
            </View>
            <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(212,149,106,0.55)', marginBottom: 28, textAlign: 'center' }}>✦ Don't worry, you can edit your Habbits anytime! ✦</Text>
            <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, marginBottom: 12 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 16 }}>{habbit.trim().length > 0 ? 'Add Habbit →' : "I'll add one later →"}</Text>
            </TouchableOpacity>
            {habbit.trim().length === 0 && <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.3)', textAlign: 'center' }}>You can skip this and add from the Habbits tab</Text>}
          </View>
        </KeyboardAvoidingView>
      );

      case 3: return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Image source={IMAGES.carrots} style={{ width: 52, height: 52, marginBottom: 16 }} resizeMode="contain" />
            <Text style={{ fontFamily: 'DynaPuff', fontSize: 26, color: '#e8d5c0', marginBottom: 8, textAlign: 'center' }}>Set a daily budget</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 28, textAlign: 'center' }}>How much do you want to spend each day?</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
              {CURRENCIES.map(c => (
                <TouchableOpacity key={c} onPress={() => { haptic.light(); setBudgetCurrency(c); }} activeOpacity={0.7}
                  style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, backgroundColor: budgetCurrency === c ? '#D4956A' : 'rgba(212,149,106,0.1)', borderWidth: 1, borderColor: budgetCurrency === c ? '#D4956A' : 'rgba(212,149,106,0.3)' }}>
                  <Text style={{ fontFamily: 'DynaPuff', fontSize: 15, color: budgetCurrency === c ? '#fff' : 'rgba(232,213,192,0.6)' }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ backgroundColor: '#5C3D2E', borderRadius: 16, borderWidth: 1.5, borderColor: budgetSet ? '#D4956A' : 'rgba(212,149,106,0.2)', paddingHorizontal: 20, paddingVertical: 4, marginBottom: 12, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
              <Text style={{ fontFamily: 'DynaPuff', fontSize: 22, color: 'rgba(212,149,106,0.6)' }}>{budgetCurrency}</Text>
              <TextInput value={budgetInput} onChangeText={v => { const clean = v.replace(/[^0-9.]/g, ''); const parts = clean.split('.'); setBudgetInput(parts.length > 1 ? `${parts[0]}.${parts[1].slice(0,2)}` : clean); }}
                placeholder="0" placeholderTextColor="rgba(232,213,192,0.25)" keyboardType="decimal-pad" returnKeyType="done" onSubmitEditing={goNext} maxLength={8}
                style={{ fontFamily: 'DynaPuff', fontSize: 32, color: budgetSet ? '#e8d5c0' : 'rgba(232,213,192,0.25)', paddingVertical: 18, minWidth: 80, textAlign: 'center' }} />
            </View>
            <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(212,149,106,0.5)', marginBottom: 28, textAlign: 'center' }}>✦ You can change this anytime in the Finance tab ✦</Text>
            <TouchableOpacity onPress={goNext} activeOpacity={0.85} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6, marginBottom: 12 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 16 }}>{budgetSet ? `Set budget to ${budgetCurrency}${budgetInput} →` : "I'll set it later →"}</Text>
            </TouchableOpacity>
            {!budgetSet && <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.3)', textAlign: 'center' }}>We'll start you off at {DEFAULT_CURRENCY}{DEFAULT_BUDGET} — easy to change anytime</Text>}
          </View>
        </KeyboardAvoidingView>
      );

      case 4:
        const TAB_TOUR = [
          { image: IMAGES.home,    name: 'Home',    desc: 'Your daily dashboard — Habbits & finance at a glance' },
          { image: IMAGES.tasks,   name: 'Habbits', desc: 'Add, edit, schedule and manage your daily Habbits' },
          { image: IMAGES.carrots, name: 'Finance', desc: 'Track your daily spending against your budget' },
          { image: IMAGES.bunny,   name: 'Profile', desc: 'Your stats, streak, and app preferences' },
        ];
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Dots />
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎉</Text>
            <Text style={{ fontFamily: 'DynaPuff', fontSize: 26, color: '#e8d5c0', marginBottom: 6, textAlign: 'center' }}>You're all set{name.trim() ? `, ${name.trim()}` : ''}!</Text>
            <Text style={{ fontFamily: 'Jua', fontSize: 13, color: 'rgba(232,213,192,0.5)', marginBottom: 28, textAlign: 'center' }}>Here's a quick look around:</Text>
            <View style={{ width: '100%', gap: 10, marginBottom: 32 }}>
              {TAB_TOUR.map(tab => (
                <View key={tab.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#5C3D2E', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)' }}>
                  <Image source={tab.image} style={{ width: 28, height: 28 }} resizeMode="contain" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'DynaPuff', fontSize: 14, color: '#e8d5c0', marginBottom: 1 }}>{tab.name}</Text>
                    <Text style={{ fontFamily: 'Jua', fontSize: 11, color: 'rgba(232,213,192,0.45)', lineHeight: 16 }}>{tab.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={handleFinish} activeOpacity={0.85} style={{ backgroundColor: '#D4956A', borderRadius: 18, paddingVertical: 16, width: '100%', alignItems: 'center', shadowColor: '#D4956A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}>
              <Text style={{ fontFamily: 'DynaPuff', color: '#fff', fontSize: 17 }}>Let's hop to it! 🐰</Text>
            </TouchableOpacity>
          </View>
        );

      default: return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#2A1A18' }}>
      <StatusBar barStyle="light-content" backgroundColor="#2A1A18" />
      <Animated.View style={{ flex: 1, opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
        {renderStep()}
      </Animated.View>
    </View>
  );
};