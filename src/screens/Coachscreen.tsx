// src/screens/CoachScreen.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert,
} from 'react-native';
import { useNavHeight } from '../hooks/useNavHeight';
import { STORAGE_COACH_MESSAGES } from '../storage';
import { useFontSize } from '../hooks/useFontSize';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { buildCoachContext } from '../utils/buildCoachContext';
import { buildSystemPrompt } from '../utils/coachPrompt';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';
import { getAccessToken, clearSession } from '../utils/supabaseAuth';
import { syncRevenueCatUser } from '../utils/revenueCatIdentity';
import {
  getRemainingMessages,
  consumeMessage,
  MESSAGE_LIMITS,
  HISTORY_LIMITS,
} from '../utils/messageQuota';
import { useProStatus } from '../context/ProContext';
import type { CoachContext } from '../utils/buildCoachContext';
import type { BudgetState } from '../budget';

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
  talking2:  require('../../assets/bonbon/talking-2.png'),
};

// ─── Types ────────────────────────────────────────────────────────────────────

type BunnyState = 'idle' | 'thinking' | 'talking';

interface Message {
  id: string;
  from: 'bunny' | 'user';
  text: string;
  /** Shown in the chat but never sent to the model (greetings, errors, quota notices). */
  local?: boolean;
}

const MAX_STORED_MESSAGES = 100;

interface CoachScreenProps {
  name: string;
  streak: number;
  budget?: BudgetState;
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
  <View style={{ paddingHorizontal:16, paddingTop: 8, paddingBottom: 12, gap: 8 }}>
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
          backgroundColor: '#2A1A18', 
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
  const recentHistory = history.filter(m => !m.local).slice(-historyLimit);

  const history_ = recentHistory
    .slice(0, -1)
    .map(m => ({ role: m.from === 'user' ? 'user' : 'model', text: m.text.slice(0, 2000) }))
    .filter((_, i, arr) => !(i === 0 && arr[0].role === 'model'));

  // Must stay within the server's limits (see supabase/functions/gemini-proxy).
  const body = JSON.stringify({
    system:  systemPrompt.slice(0, 8000),
    history: history_,
    message: userText.slice(0, 1000),
  });

  const post = async () => fetch(`${SUPABASE_URL}/functions/v1/gemini-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${await getAccessToken()}`,
    },
    body,
  });

  // The server checks Pro for the session's user, so RevenueCat must be on that user too.
  // Done for free users as well: the server's RevenueCat lookup creates the customer if it
  // doesn't exist, which would stop a later login from carrying purchases over.
  await syncRevenueCatUser().catch(() => null);

  let res = await post();
  if (res.status === 401) {
    // Stale or revoked session: start a fresh anonymous one and try once more.
    await clearSession();
    await syncRevenueCatUser().catch(() => null);
    res = await post();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CoachError(data.error ?? `http_${res.status}`);
  return data.text ?? '';
}

/** Error codes from the gemini-proxy function: daily_limit, rate_limited, busy, … */
class CoachError extends Error {
  constructor(public code: string) { super(code); }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const BunnyAvatar = ({ state, frame = 0 }: { state: BunnyState; frame?: number }) => {
  const source = state === 'talking'
    ? (frame === 0 ? IMAGES.talking : IMAGES.talking2)
    : IMAGES[state];

  return (
    <Image source={source} style={{ width: 52, height: 52 }} resizeMode="contain" />
  );
};

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

// Memoized so a typewriter tick only re-renders the bubble being typed.
const MessageBubble = React.memo(({ msg, text, avatarState, frame, fontSize }: {
  msg: Message; text: string; avatarState: BunnyState; frame: number; fontSize: number;
}) => (
  <View style={{ flexDirection: msg.from === 'bunny' ? 'row' : 'row-reverse', alignItems: 'flex-end', marginBottom: 10, gap: 8 }}>
    {msg.from === 'bunny' && <BunnyAvatar state={avatarState} frame={frame} />}
    <View style={{
      maxWidth: '76%',
      backgroundColor: msg.from === 'bunny' ? '#5C3D2E' : 'rgba(212,149,106,0.18)',
      borderRadius: 16,
      borderBottomLeftRadius:  msg.from === 'bunny' ? 4 : 16,
      borderBottomRightRadius: msg.from === 'user'  ? 4 : 16,
      paddingHorizontal: 14, paddingVertical: 10,
      borderWidth: 1,
      borderColor: msg.from === 'bunny' ? 'rgba(212,149,106,0.18)' : 'rgba(212,149,106,0.32)',
    }}>
      <Text style={{ fontFamily: JUA, color: '#e8d5c0', fontSize, lineHeight: Math.round(fontSize * 1.5) }}>
        {formatMessageText(text)}
      </Text>
    </View>
  </View>
));

// ─── Screen ───────────────────────────────────────────────────────────────────

export const CoachScreen: React.FC<CoachScreenProps> = ({ name, streak, budget }) => {
  const [talkFrame, setTalkFrame]   = useState(0);
  const talkCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isPro } = useProStatus();
  const [messages, setMessages]       = useState<Message[]>([]);
  const [remaining, setRemaining]     = useState<number | null>(null);
  const [input, setInput]             = useState('');
  const [bunnyState, setBunnyState]   = useState<BunnyState>('idle');
  const [isReplying, setIsReplying]   = useState(false);
  const [hasLoaded, setHasLoaded]     = useState(false);  
  const scrollRef                     = useRef<ScrollView>(null);
  const navHeight                     = useNavHeight();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const fs                            = useFontSize();

  const contextRef = useRef<CoachContext | null>(null);

  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  

  useEffect(() => {
    if (bunnyState === 'talking') {
      talkCycleRef.current = setInterval(() => {
        setTalkFrame(f => (f === 0 ? 1 : 0));
      }, 280); // ms per frame — adjust to taste
    } else {
      if (talkCycleRef.current) {
        clearInterval(talkCycleRef.current);
        talkCycleRef.current = null;
      }
      setTalkFrame(0);
    }
    return () => {
      if (talkCycleRef.current) clearInterval(talkCycleRef.current);
      
    };
  }, [bunnyState]);

  // ── Greeting helper ───────────────────────────────────────────────────────
  const getGreeting = () => name
    ? `Hey ${name}! 🐰 I'm Bonbon, your habit and finance coach. Ask me how your week is going, where your money's been going, or what to focus on next!`
    : `Hey there! 🐰 I'm Bonbon, your habit and finance coach. Ask me how your week is going, where your money's been going, or what to focus on next!`;

  // ── Quota refresh ─────────────────────────────────────────────────────────
  useEffect(() => {
    getRemainingMessages(isPro).then(setRemaining);
  }, [messages, isPro]);

  // ── Typewriter effect ─────────────────────────────────────────────────────
  // The full reply goes into `messages` once (so it's saved once, complete); only the
  // revealed portion lives in `typing`, so each tick re-renders just that one bubble.
  const [typing, setTyping] = useState<{ id: string; text: string } | null>(null);

  const startTypewriter = (msg: Message, onDone: () => void) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);

    const CHARS_PER_TICK = 3;
    const TICK_MS        = 30;
    let shown = 0;

    setTyping({ id: msg.id, text: '' });
    setMessages(prev => [...prev, msg]);

    typewriterRef.current = setInterval(() => {
      shown += CHARS_PER_TICK;
      if (shown >= msg.text.length) {
        clearInterval(typewriterRef.current!);
        typewriterRef.current = null;
        setTyping(null);
        onDone();
        return;
      }
      setTyping({ id: msg.id, text: msg.text.slice(0, shown) });
    }, TICK_MS);
  };

  // ── Clean up typewriter on unmount ────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      if (talkCycleRef.current)  clearInterval(talkCycleRef.current);
    };
  }, []);

  // ── Persist messages (only when a message is added, never per typewriter tick) ──
  useEffect(() => {
    if (messages.length === 0) return;
    AsyncStorage.setItem(STORAGE_COACH_MESSAGES, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))).catch(() => {});
  }, [messages]);

  // ── Load or greet on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_COACH_MESSAGES);
        if (raw) {
          setMessages(JSON.parse(raw));
          setHasLoaded(true);   
          return;
        }
      } catch {}

      setBunnyState('talking');
      setTimeout(() => {
        setMessages([{ id: uid(), from: 'bunny', text: getGreeting(), local: true }]);
        setBunnyState('idle');
        setHasLoaded(true);
      }, 500);
    })();
  }, []); 

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
        setTyping(null);
        contextRef.current    = null;   // ← reset cached context on clear
        await AsyncStorage.removeItem(STORAGE_COACH_MESSAGES);
        setMessages([]);
        setBunnyState('talking');
        setTimeout(() => {
          setMessages([{ id: uid(), from: 'bunny', text: getGreeting(), local: true }]);
          setBunnyState('idle');
        }, 500);
      }},
    ]);
  };

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isReplying) return;

    const quota = await getRemainingMessages(isPro);

    if (quota <= 0) {
      const limit = isPro ? MESSAGE_LIMITS.pro : MESSAGE_LIMITS.free;
      setMessages(prev => [...prev, {
        id: uid(), from: 'bunny',
        text: isPro
          ? `You've hit your ${limit} message limit for today — I'll be back tomorrow! 🐰`
          : `You've used your ${limit} free messages for today! Upgrade for up to ${MESSAGE_LIMITS.pro} messages/day. 🐰`,
        local: true,
      }]);
      setBunnyState('idle');   
      setIsReplying(false);  
      return;
    }

    const userMsg: Message = { id: uid(), from: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsReplying(true);
    setBunnyState('thinking');
    haptic.light();

    try {

      if (!contextRef.current) {
        contextRef.current = await buildCoachContext(name, streak, budget);
      }

      const reply = await sendMessage(
        text,
        contextRef.current,
        [...messages, userMsg],
        isPro,
      );
      await consumeMessage();

      setBunnyState('talking');
      startTypewriter({ id: uid(), from: 'bunny', text: formatMessageText(reply) }, () => {
        setBunnyState('idle');
        setIsReplying(false);
        haptic.success();
      });

    } catch (e) {
      const code = e instanceof CoachError ? e.code : '';
      const msg = code === 'daily_limit'
        ? "That's all the chatting I can do today — I'll be back tomorrow! 🐰"
        : code === 'rate_limited' || code === 'busy'
        ? "I'm a little overwhelmed right now — try again in a moment! 🐰"
        : !code && /network|fetch|auth/i.test(String(e))
        ? "I couldn't reach my brain just now. Check your connection? 🐰"
        : "Oops, something went wrong on my end! 🐰";

      setMessages(prev => [...prev, { id: uid(), from: 'bunny', text: msg, local: true }]);
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

        <View style={{ height: 1, backgroundColor: 'rgba(212,149,106,0.12)', marginTop: 12, marginBottom: 12 }} />
      </View>

      {/* ── Message list ───────────────────────────────────────────────────── */}

      <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: messages.length === 1 
          && messages[0]?.from === 'bunny' 
          && !isReplying && !input.trim() ? 140 : 8, }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => { if (typing) scrollRef.current?.scrollToEnd({ animated: false }); }}
      >
        {messages.map((msg, index) => {
          const isLastBunny = index === lastBunnyIndex;
          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              text={typing?.id === msg.id ? typing.text : msg.text}
              avatarState={isLastBunny ? bunnyState : 'idle'}
              frame={isLastBunny ? talkFrame : 0}
              fontSize={fs(13)}
            />
          );
        })}

        {isReplying && bunnyState === 'thinking' && <ThinkingBubble />}
      </ScrollView>

      {messages.length === 1 &&
        messages[0]?.from === 'bunny' &&
        !isReplying &&
        !input.trim() && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <SuggestedPrompts
            onSelect={(text) => {
              haptic.light();
              handleSend(text);
            }}
          />
        </View>
      )}
      </View>

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
          onSubmitEditing={() => handleSend()}
          // Return sends (keyboard stays open) instead of inserting a newline; the box still
          // grows for long or pasted multi-line messages.
          submitBehavior="submit"
          editable={!isReplying}
          multiline
          maxLength={1000}
          onContentSizeChange={() =>          
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
          onPress={() => handleSend()}
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