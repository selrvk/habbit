// src/screens/CoachScreen.tsx
//
// Minimal chat scaffold — bunny greets on mount and replies with
// placeholder messages. Swap sendMessage() logic when the real
// backend is ready; everything else (UI, state shape) can stay.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert,
} from 'react-native';
import { SectionDivider } from '../components/SectionDivider';
import { useNavHeight } from '../hooks/useNavHeight';
import { STORAGE_COACH_MESSAGES } from '../storage';
import { useFontSize } from '../hooks/useFontSize';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const JUA      = 'Jua';
const DYNAPUFF = 'DynaPuff';

const IMAGES = {
  idle:     require('../../assets/bonbon/idle.png'),
  thinking: require('../../assets/bonbon/thinking.png'),
  talking:  require('../../assets/bonbon/talking.png'),
};

// ─── Placeholder replies ──────────────────────────────────────────────────────
// Replace this array (or the whole sendMessage fn) with a real API call later.

const SILLY_REPLIES = [
  "There's nothing down this rabbit hole… yet!",
  "Oops! This bunny hasn't learned that trick yet. Stay tuned!",
  "Feature still under construction — my ears aren't ready!",
  "I'd answer, but I'm just a placeholder bunny for now!",
  "Shh… the real coach is still in the oven.",
  "Nope, nope, nope! Nothing to see here (yet).",
  "My crystal ball is fuzzy on that one. Try again later?",
  "I'm just vibing here until the real coach shows up!",
  "Hmm, very interesting question… that I totally cannot answer yet.",
  "Top secret. Classified. Coming soon. You know the drill!",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type BunnyState = 'idle' | 'thinking' | 'talking';

interface Message {
  id: string;
  from: 'bunny' | 'user';
  text: string;
}

interface CoachScreenProps {
  name: string;
  streak: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2);

/**
 * sendMessage — drop-in replacement point.
 * Currently returns a random silly string after a fake delay.
 * When the feature goes live, swap this for your real API call
 * and keep the rest of the component untouched.
 */
async function sendMessage(_userText: string, _ctx: { name: string; streak: number }): Promise<string> {
  await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
  return SILLY_REPLIES[Math.floor(Math.random() * SILLY_REPLIES.length)];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const BunnyAvatar = ({ state }: { state: BunnyState; size?: number }) => (
  <Image
  source={IMAGES[state]}
  style={{ width: 52, height: 52 }}
  resizeMode="contain"
/>
);

const ThinkingBubble = () => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 8 }}>
    <BunnyAvatar state="thinking" size={32} />
    <View
      style={{
        backgroundColor: '#5C3D2E',
        borderRadius: 16, borderBottomLeftRadius: 4,
        paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
      }}
    >
      <Text style={{ fontFamily: JUA, color: 'rgba(232,213,192,0.4)', fontSize: 15, letterSpacing: 4 }}>
        • • •
      </Text>
    </View>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export const CoachScreen: React.FC<CoachScreenProps> = ({ name, streak }) => {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState('');
  const [bunnyState, setBunnyState] = useState<BunnyState>('idle');
  const [isReplying, setIsReplying] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const navHeight = useNavHeight();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const fs = useFontSize();

  // ── Initial greeting on mount ──────────────────────────────────────────────
  useEffect(() => {
    setBunnyState('talking');
    const greeting = name
      ? `Hey there, ${name}! 👋 This feature isn't available yet — stay tuned! 🐰`
      : `Hey there! 👋 This feature isn't available yet — stay tuned! 🐰`;

    const timer = setTimeout(() => {
      setMessages([{ id: uid(), from: 'bunny', text: greeting }]);
      setBunnyState('idle');
    }, 500);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load persisted messages on mount — only greet if history is empty
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_COACH_MESSAGES);
        if (raw) {
          setMessages(JSON.parse(raw));
          return;
        }
      } catch {}

      // First time — show greeting
      setBunnyState('talking');
      const greeting = name
        ? `Hey there, ${name}! 👋 This feature isn't available yet — stay tuned! 🐰`
        : `Hey there! 👋 This feature isn't available yet — stay tuned! 🐰`;
      setTimeout(() => {
        setMessages([{ id: uid(), from: 'bunny', text: greeting }]);
        setBunnyState('idle');
      }, 500);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist messages whenever they change
  useEffect(() => {
    if (messages.length === 0) return;
    AsyncStorage.setItem(STORAGE_COACH_MESSAGES, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  useEffect(() => {
    const show = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        () => setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => setKeyboardOpen(false)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, isReplying]);

  const handleClearChat = () => {
    Alert.alert('Clear Chat', 'Delete all messages with Bonbon?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem(STORAGE_COACH_MESSAGES);
        setMessages([]);
      }},
    ]);
  };

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isReplying) return;

    // Append user message
    setMessages(prev => [...prev, { id: uid(), from: 'user', text }]);
    setInput('');
    setIsReplying(true);
    setBunnyState('thinking');

    try {
      // ← Swap sendMessage() for your real backend call here
      const reply = await sendMessage(text, { name, streak });
      setBunnyState('talking');
      setMessages(prev => [...prev, { id: uid(), from: 'bunny', text: reply }]);
    } catch {
      setMessages(prev => [...prev, {
        id: uid(), from: 'bunny',
        text: "Oops, something went wrong on my end! 🐰",
      }]);
    } finally {
      setIsReplying(false);
      // Return to idle after the talking animation has a moment to show
      setTimeout(() => setBunnyState('idle'), 1800);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={70}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 4,
        }}>
          <View>
            <Text style={{ fontFamily: JUA, color: '#e8d5c0', fontSize: 14, opacity: 0.7 }}>
              Chat with
            </Text>
            <Text style={{ fontFamily: DYNAPUFF, color: '#e8d5c0', fontSize: 24 }}>
              Your Coach
            </Text>
          </View>

          {/* Clear chat button — replaces the bunny avatar */}
          <TouchableOpacity
            onPress={handleClearChat}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 12, paddingVertical: 7,
              backgroundColor: 'rgba(212,149,106,0.12)',
              borderRadius: 12,
              borderWidth: 1, borderColor: 'rgba(212,149,106,0.25)',
            }}
          >
            <Text style={{ fontFamily: JUA, fontSize: 12, color: 'rgba(232,213,192,0.6)' }}>
              Clear chat
            </Text>
          </TouchableOpacity>
        </View>

        <SectionDivider title="✦ Bonbon ✦" />
      </View>

      {/* ── Message list ───────────────────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map(msg => (
          <View
            key={msg.id}
            style={{
              flexDirection: msg.from === 'bunny' ? 'row' : 'row-reverse',
              alignItems: 'flex-end',
              marginBottom: 10,
              gap: 8,
            }}
          >
            {msg.from === 'bunny' && <BunnyAvatar state="idle" size={32} />}

            <View style={{
              maxWidth: '76%',
              backgroundColor: msg.from === 'bunny'
                ? '#5C3D2E'
                : 'rgba(212,149,106,0.18)',
              borderRadius: 16,
              borderBottomLeftRadius:  msg.from === 'bunny' ? 4 : 16,
              borderBottomRightRadius: msg.from === 'user'  ? 4 : 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: msg.from === 'bunny'
                ? 'rgba(212,149,106,0.18)'
                : 'rgba(212,149,106,0.32)',
            }}>
              <Text style={{
                fontFamily: JUA,
                color: '#e8d5c0',
                fontSize: fs(13),
                lineHeight: 20,
              }}>
                {msg.text}
              </Text>
            </View>
          </View>
        ))}

        {/* Typing indicator while bunny is "thinking" */}
        {isReplying && <ThinkingBubble />}
      </ScrollView>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        paddingBottom: keyboardOpen ? 10 : 10 + navHeight,  
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(212,149,106,0.12)',
        backgroundColor: '#3B2220',
      }}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Message Bonbon…"
          placeholderTextColor="rgba(232,213,192,0.28)"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!isReplying}
          multiline
          style={{
            flex: 1,
            backgroundColor: '#5C3D2E',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 10,
            fontFamily: JUA,
            color: '#e8d5c0',
            fontSize: fs(13),
            borderWidth: 1,
            borderColor: 'rgba(212,149,106,0.22)',
            maxHeight: 100,
          }}
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={!input.trim() || isReplying}
          activeOpacity={0.75}
          style={{
            width: 42, height: 42,
            borderRadius: 21,
            backgroundColor: input.trim() && !isReplying
              ? '#D4956A'
              : 'rgba(212,149,106,0.15)',
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: input.trim() && !isReplying
              ? 'transparent'
              : 'rgba(212,149,106,0.2)',
          }}
        >
          <Text style={{ fontSize: 18, color: input.trim() && !isReplying ? '#fff' : 'rgba(232,213,192,0.3)' }}>
            ↑
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};