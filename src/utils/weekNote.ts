// src/utils/weekNote.ts
//
// Bonbon's note on a week (Pro): a few sentences on what went well, the pattern worth
// noticing, and one tip, written from the week's recap. Written once per week and kept,
// so reopening the recap doesn't use up messages.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_WEEK_NOTES } from '../storage';
import { currencyStr, parseDateKey } from '../helpers';
import { categoryOf } from '../categories';
import { durationLabel } from '../focus';
import type { WeekSummary } from '../weekSummary';
import { askBonbon } from './bonbonApi';
import { consumeMessage } from './messageQuota';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const KEEP_WEEKS = 12;

type Notes = Record<string, { end: string; text: string }>;

const readNotes = async (): Promise<Notes> => {
  try { return JSON.parse((await AsyncStorage.getItem(STORAGE_WEEK_NOTES)) ?? '{}'); } catch { return {}; }
};

/** The note written for this week, if it was written with the week's days so far. */
export const savedWeekNote = async (s: WeekSummary): Promise<string | null> => {
  const note = (await readNotes())[s.start];
  return note && note.end === s.end ? note.text : null;
};

export const weekNotePrompt = (s: WeekSummary, name: string, currency: string, streak: number): string => {
  const money = (n: number) => currencyStr(currency, n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const pct   = (n: number) => `${Math.round(n * 100)}%`;
  const { habits: h, money: m, focus: f } = s;
  const lines = [
    `Week: ${s.label}${s.inProgress ? ' (Sunday is still going; today counts once it is done)' : ''}.`,
    `Current streak: ${streak} day${streak === 1 ? '' : 's'}.`,
    h.trackedDays > 0 ? `Perfect days (every habit done): ${h.perfectDays} of ${h.trackedDays}. Check-offs: ${h.done}.` : 'No habits tracked this week.',
    h.best ? `Strongest habit: ${h.best.label}, ${h.best.done} of ${h.best.of} days.` : '',
    h.slipped ? `Slipped most: ${h.slipped.label}, missed ${h.slipped.missed} of ${h.slipped.of} days.` : '',
    h.weekly.length > 0 ? `Weekly goals: ${h.weekly.map(w => `${w.label} ${w.done}/${w.target}`).join(', ')}.` : '',
    h.weekendDip ? `Weekends were harder: ${pct(h.weekendDip.weekend)} of habits done on weekends, ${pct(h.weekendDip.weekday)} on weekdays.` : '',
    f ? `Focus timer: ${durationLabel(f.minutes)} over ${f.days} day${f.days === 1 ? '' : 's'}${f.habits[0] ? `, most on ${f.habits[0].label}` : ''}${f.prevMinutes > 0 ? ` (week before: ${durationLabel(f.prevMinutes)}, ${f.minutes >= f.prevMinutes ? 'up' : 'down'} ${pct(Math.abs(f.minutes - f.prevMinutes) / f.prevMinutes)})` : ''}.` : '',
    `Spent: ${money(m.spent)}${m.prevSpent !== null ? ` (week before: ${money(m.prevSpent)})` : ''}.`,
    m.budget?.kind === 'weekly' ? `Weekly budget ${money(m.budget.budget)}: ${m.budget.left >= 0 ? `${money(m.budget.left)} left` : `${money(-m.budget.left)} over`}.` : '',
    m.budget?.kind === 'monthly' ? `${money(m.budget.left)} left in the monthly budget for ${m.budget.monthName}.` : '',
    m.budget?.kind === 'daily' ? `Under the daily budget on ${m.budget.daysUnder} of ${m.budget.days} days with spending.` : '',
    m.topCategory ? `Most went on ${categoryOf(m.topCategory.key)?.label ?? 'other things'} (${pct(m.topCategory.share)}).` : '',
    m.biggest ? `Biggest spend: ${money(m.biggest.amount)}${m.biggest.note ? ` on "${m.biggest.note}"` : ''}.` : '',
    m.saved > 0 ? `Put ${money(m.saved)} in their savings jar.` : '',
    s.bestDay ? `Best day: ${DAYS[parseDateKey(s.bestDay.date).getDay()]} (${s.bestDay.done} of ${s.bestDay.of} habits, ${money(s.bestDay.spent)} spent).` : '',
  ].filter(Boolean);

  return `You are Bonbon, the warm, encouraging bunny coach in a habit and money app called Habbit.
You're writing ${name}'s weekly recap note, shown under the week's numbers.
Write 2 or 3 short sentences, under 60 words in all, in plain, friendly language: one thing that went well, the most interesting pattern in the week, then one concrete tip for next week that starts with "Tip:".
The tip should help them keep their habits going or spend more wisely; never suggest spending money.
Don't list or repeat every number; the user can already see them. No headings, no bullet points, at most one emoji.
If the week was quiet, be kind and suggest one small step.

THIS WEEK
${lines.join('\n')}`;
};

/** Asks Bonbon for the week's note (one message from today's allowance) and keeps it. */
export const writeWeekNote = async (s: WeekSummary, name: string, currency: string, streak: number): Promise<string> => {
  const text = (await askBonbon({ system: weekNotePrompt(s, name, currency, streak), message: 'Write my weekly recap note.' })).trim();
  await consumeMessage();
  if (text) {
    const notes = await readNotes();
    notes[s.start] = { end: s.end, text };
    const kept = Object.fromEntries(Object.entries(notes).sort(([a], [b]) => b.localeCompare(a)).slice(0, KEEP_WEEKS));
    await AsyncStorage.setItem(STORAGE_WEEK_NOTES, JSON.stringify(kept)).catch(() => {});
  }
  return text;
};
