// src/screens/CoachScreen.tsx

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
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { buildCoachContext } from '../utils/buildCoachContext';
import { buildSystemPrompt } from '../utils/coachPrompt';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import {
  getRemainingMessages,
  consumeMessage,
  MESSAGE_LIMITS,
  HISTORY_LIMITS,
} from '../utils/messageQuota';
import { useProStatus } from '../context/ProContext';
import type { CoachContext } from '../utils/buildCoachContext';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const JUA      = 'Jua';
const DYNAPUFF = 'DynaPuff';

const HAPTIC = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };
const haptic = {
  light:   () => ReactNativeHapticFeedback.trigger('impactLight',         HAPTIC),
  success: () => ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC),
};

const IMAGES = {
  idle:     require('../../assets/bonbon/idle.png'),
  thinking: require('../../assets/bonbon/thinking.png'),
  talking:  require('../../assets/bonbon/talking.png'),
};

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

const formatMessageText = (text: string) =>
  text.replace(/__carrot__/g, '🥕');

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "How did my habits go this week?",
  "Where am I spending the most money?",
  "What should I focus on today?",
];

const SuggestedPrompts = ({ onSelect }: { onSelect: (t: string) => void }) => (
  <View style={{ paddingBottom: 12, gap: 8 }}>
    {SUGGESTED_PROMPTS.map(p => (
      <TouchableOpacity
        key={p}
        onPress={() => onSelect(p)}
        activeOpacity={0.7}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(212,149,106,0.22)',
        }}
      >
        <Text style={{ fontFamily: JUA, fontSize: 13, color: 'rgba(232,213,192,0.75)' }}>
          {p}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ─── API call ─────────────────────────────────────────────────────────────────

async function sendMessage(
  userText: string,
  cachedContext: CoachContext,          // ← receives pre-built context
  history: Message[],
  isPro: boolean,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(cachedContext);

  const historyLimit  = isPro ? HISTORY_LIMITS.pro : HISTORY_LIMITS.free;
  const recentHistory = history.slice(-historyLimit);

  const geminiHistory = recentHistory
    .slice(0, -1)
    .map(m => ({
      role:  m.from === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }))
    .filter((_, i, arr) => !(i === 0 && arr[0].role === 'model'));

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [
      ...geminiHistory,
      { role: 'user', parts: [{ text: userText }] },
    ],
  };

  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/gemini-proxy`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    },
  );

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const BunnyAvatar = ({ state }: { state: BunnyState }) => (
  <Image
    source={IMAGES[state]}
    style={{ width: 52, height: 52 }}
    resizeMode="contain"
  />
);

const ThinkingBubble = () => (
  <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 8 }}>
    <BunnyAvatar state="thinking" />
    <View style={{
      backgroundColor: '#5C3D2E',
      borderRadius: 16, borderBottomLeftRadius: 4,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1, borderColor: 'rgba(212,149,106,0.15)',
    }}>
      <Text style={{ fontFamily: JUA, color: 'rgba(232,213,192,0.4)', fontSize: 15, letterSpacing: 4 }}>
        • • •
      </Text>
    </View>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export const CoachScreen: React.FC<CoachScreenProps> = ({ name, streak }) => {
  const { isPro } = useProStatus();
  const [messages, setMessages]       = useState<Message[]>([]);
  const [remaining, setRemaining]     = useState<number | null>(null);
  const [input, setInput]             = useState('');
  const [bunnyState, setBunnyState]   = useState<BunnyState>('idle');
  const [isReplying, setIsReplying]   = useState(false);
  const [hasLoaded, setHasLoaded]     = useState(false);   // ← fix #4: moved inside component
  const scrollRef                     = useRef<ScrollView>(null);
  const navHeight                     = useNavHeight();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const fs                            = useFontSize();

  // ── fix #5: cache context so we don't do 6 AsyncStorage reads per message ─
  const contextRef = useRef<CoachContext | null>(null);

  const isTypingRef   = useRef(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Greeting helper ───────────────────────────────────────────────────────
  const getGreeting = () => name
    ? `Hey ${name}! 🐰 I'm Bonbon, your habit and finance coach. Ask me how your week is going, where your money's been going, or what to focus on next!`
    : `Hey there! 🐰 I'm Bonbon, your habit and finance coach. Ask me how your week is going, where your money's been going, or what to focus on next!`;

  // ── Quota refresh ─────────────────────────────────────────────────────────
  useEffect(() => {
    getRemainingMessages(isPro).then(setRemaining);
  }, [messages, isPro]);

  // ── Typewriter effect ─────────────────────────────────────────────────────
  const startTypewriter = (msgId: string, fullText: string, onDone: () => void) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);

    let i = 0;
    const SPEED_MS = 18;
    isTypingRef.current = true;

    typewriterRef.current = setInterval(() => {
      i += 1;
      setMessages(prev =>
        prev.map(m => m.id === msgId ? { ...m, text: fullText.slice(0, i) } : m),
      );
      scrollRef.current?.scrollToEnd({ animated: false });

      if (i >= fullText.length) {
        clearInterval(typewriterRef.current!);
        typewriterRef.current = null;
        isTypingRef.current   = false;

        setMessages(prev => {
          const final = prev.map(m => m.id === msgId ? { ...m, text: fullText } : m);
          AsyncStorage.setItem(STORAGE_COACH_MESSAGES, JSON.stringify(final)).catch(() => {});
          return final;
        });

        onDone();
      }
    }, SPEED_MS);
  };

  // ── Clean up typewriter on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, []);

  // ── Persist messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length === 0) return;
    AsyncStorage.setItem(STORAGE_COACH_MESSAGES, JSON.stringify(messages)).catch(() => {});
  }, [messages]);

  // ── Load or greet on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_COACH_MESSAGES);
        if (raw) {
          setMessages(JSON.parse(raw));
          setHasLoaded(true);   // ← fix #4: set inside async after data loads
          return;
        }
      } catch {}

      setBunnyState('talking');
      setTimeout(() => {
        setMessages([{ id: uid(), from: 'bunny', text: getGreeting() }]);
        setBunnyState('idle');
        setHasLoaded(true);     // ← also set after greeting
      }, 500);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [messages, isReplying]);

  // ── Clear chat ────────────────────────────────────────────────────────────
  const handleClearChat = () => {
    Alert.alert('Clear Chat', 'Delete all messages with Bonbon?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        typewriterRef.current = null;
        contextRef.current    = null;   // ← reset cached context on clear
        await AsyncStorage.removeItem(STORAGE_COACH_MESSAGES);
        setMessages([]);
        setBunnyState('talking');
        setTimeout(() => {
          setMessages([{ id: uid(), from: 'bunny', text: getGreeting() }]);
          setBunnyState('idle');
        }, 500);
      }},
    ]);
  };

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || isReplying) return;

    const quota = await getRemainingMessages(isPro);

    if (quota <= 0) {
      const limit = isPro ? MESSAGE_LIMITS.pro : MESSAGE_LIMITS.free;
      setMessages(prev => [...prev, {
        id: uid(), from: 'bunny',
        text: isPro
          ? `You've hit your ${limit} message limit for today — I'll be back tomorrow! 🐰`
          : `You've used your ${limit} free messages for today! Upgrade for up to ${MESSAGE_LIMITS.pro} messages/day. 🐰`,
      }]);
      return;
    }

    const userMsg: Message = { id: uid(), from: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsReplying(true);
    setBunnyState('thinking');
    haptic.light();

    try {
      // ── fix #5: build context once, reuse for entire conversation ──────────
      if (!contextRef.current) {
        contextRef.current = await buildCoachContext(name, streak);
      }

      const reply = await sendMessage(
        text,
        contextRef.current,
        [...messages, userMsg],
        isPro,
      );
      await consumeMessage();

      const replyId = uid();
      setMessages(prev => [...prev, { id: replyId, from: 'bunny', text: '' }]);
      setBunnyState('talking');

      startTypewriter(replyId, formatMessageText(reply), () => {
        setBunnyState('idle');
        setIsReplying(false);
        haptic.success();
      });

    } catch (e) {
      const msg = String(e).includes('429')
        ? "I'm a little overwhelmed right now — try again in a moment! 🐰"
        : String(e).includes('network') || String(e).includes('fetch')
        ? "I couldn't reach my brain just now. Check your connection? 🐰"
        : "Oops, something went wrong on my end! 🐰";

      setMessages(prev => [...prev, { id: uid(), from: 'bunny', text: msg }]);
      setBunnyState('idle');
      setIsReplying(false);
    }
  };

  // ── Index of last bunny message (drives avatar state) ─────────────────────
  const lastBunnyIndex = (() => {
    let last = -1;
    messages.forEach((m, i) => { if (m.from === 'bunny') last = i; });
    return last;
  })();

  // ── fix #4: blank screen while AsyncStorage loads ─────────────────────────
  if (!hasLoaded) return <View style={{ flex: 1, backgroundColor: '#2A1A18' }} />;

  // ─────────────────────────────────────────────────────────────────────────
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
              Bonbon
            </Text>
          </View>

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
        {messages.map((msg, index) => (
          <View
            key={msg.id}
            style={{
              flexDirection: msg.from === 'bunny' ? 'row' : 'row-reverse',
              alignItems: 'flex-end',
              marginBottom: 10,
              gap: 8,
            }}
          >
            {msg.from === 'bunny' && (
              <BunnyAvatar state={index === lastBunnyIndex ? bunnyState : 'idle'} />
            )}

            <View style={{
              maxWidth: '76%',
              backgroundColor: msg.from === 'bunny' ? '#5C3D2E' : 'rgba(212,149,106,0.18)',
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
                {formatMessageText(msg.text)}
              </Text>
            </View>
          </View>
        ))}

        {isReplying && bunnyState === 'thinking' && <ThinkingBubble />}

        {/* ── fix #2: suggested prompts after every bunny reply ──────────────── */}
      {messages.length > 0 &&
        messages[messages.length - 1]?.from === 'bunny' &&
        !isReplying &&
        !input.trim() && (
        <SuggestedPrompts
          onSelect={(text) => {
            haptic.light();
            setInput(text);
          }}
        />
      )}
      
      </ScrollView>

      {/* ── fix #3: quota counter always visible for free users ────────────── */}
      {!isPro && remaining !== null && (
        <Text style={{
          fontFamily: JUA, fontSize: 11, textAlign: 'center', paddingBottom: 4,
          color: remaining <= 3
            ? (remaining === 0 ? '#f09090' : '#f5c26b')
            : 'rgba(232,213,192,0.3)',
        }}>
          {remaining === 0
            ? 'No messages left today'
            : `${remaining} / ${MESSAGE_LIMITS.free} messages left today`}
        </Text>
      )}

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
          onContentSizeChange={() =>           // ← fix #6: scroll when input grows
            scrollRef.current?.scrollToEnd({ animated: true })
          }
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
          <Text style={{
            fontSize: 18,
            color: input.trim() && !isReplying ? '#fff' : 'rgba(232,213,192,0.3)',
          }}>
            ↑
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};