// src/utils/coachPrompt.ts

import type { CoachContext } from './buildCoachContext';
import { getTodayKey } from '../helpers';
import { durationLabel, type FocusOverview } from '../focus';
import type { WorkoutOverview } from '../workout';

/** The FOCUS TIMER section: what's running, and time focused lately. */
export function focusStatus(f: FocusOverview): string {
  const lines: string[] = [];
  const r = f.running;
  if (r) {
    const time  = new Date(f.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const block = r.blocks > 1 ? `block ${r.block} of ${r.blocks}` : 'a block';
    lines.push(`Running as of ${time}: ${r.label}, `
      + (r.phase === 'focus'
        ? `${block} ${r.paused ? `paused with ${r.minutesLeft} min left` : r.minutesLeft > 0 ? `with ${r.minutesLeft} min left` : 'just finished'}.`
        : `on a break after ${block}, ${r.minutesLeft > 0 ? `${r.minutesLeft} min left` : 'ready for the next block'}.`));
  }
  lines.push(`Focused today: ${f.todayMinutes > 0 ? durationLabel(f.todayMinutes) : 'nothing yet'}.`);
  lines.push(f.weekMinutes > 0
    ? `Last 7 days: ${durationLabel(f.weekMinutes)} over ${f.weekDays} day${f.weekDays === 1 ? '' : 's'}`
      + (f.byHabit.length > 0 ? ` (${f.byHabit.map(h => `${h.label} ${durationLabel(h.minutes)}`).join(', ')})` : '')
      + `; the 7 days before: ${f.prevWeekMinutes > 0 ? `${durationLabel(f.prevWeekMinutes)}, so ${f.weekMinutes >= f.prevWeekMinutes ? 'up' : 'down'} ${Math.round(Math.abs(f.weekMinutes - f.prevWeekMinutes) / f.prevWeekMinutes * 100)}%` : 'none'}.`
    : 'Nothing focused in the last 7 days.');
  if (f.timed.length > 0) {
    lines.push(`Habits with a focus timer: ${f.timed.map(t => `${t.label} (${t.minutes}-min blocks${t.breakMinutes > 0 ? `, ${t.breakMinutes}-min breaks` : ''})`).join(', ')}.`);
  }
  return lines.join('\n');
}

/** The WORKOUTS section: the one in progress, routines, recent workouts and exercises. */
export function workoutStatus(w: WorkoutOverview): string {
  const lines: string[] = [];
  const day = (key: string) => new Date(key + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const r = w.running;
  if (r) {
    const time = new Date(w.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    lines.push(`In progress as of ${time}: ${r.label}, ${r.routineName}, ${r.minutes} min in, ${r.setsDone} set${r.setsDone === 1 ? '' : 's'} done`
      + (r.restLeft ? `, resting (${r.restLeft}s left)` : '')
      + (r.next ? `; next up: ${r.next}.` : '; every set is ticked off, ready to finish.'));
  }
  for (const h of w.habits) {
    lines.push(`${h.label}: routines ${h.routines.join(' → ')}${h.routines.length > 1 ? ' (they take turns)' : ''}`
      + `${h.next ? `; next up: ${h.next}` : ''}; weights in ${h.unit}; ${h.restSeconds > 0 ? `${h.restSeconds}s rest between sets` : 'no rest timer'}.`);
  }
  lines.push(w.recent.length > 0
    ? `Last 7 days: ${w.recent.length} workout${w.recent.length === 1 ? '' : 's'} (the 7 days before: ${w.prevWeekCount}): `
      + w.recent.map(x => `${day(x.date)} ${x.routineName} (${x.minutes} min, ${x.sets} sets${x.volume > 0 ? `, ${x.volume.toLocaleString('en-US')} ${x.unit} lifted` : ''})`).join('; ') + '.'
    : `No workouts in the last 7 days (the 7 days before: ${w.prevWeekCount}).`);
  if (w.exercises.length > 0) {
    lines.push('Exercises (last time; best ever):');
    for (const e of w.exercises) lines.push(`  ${e.name}: ${e.last}${e.best ? `; best ${e.best}` : ''} (${e.times} time${e.times === 1 ? '' : 's'})`);
  }
  return lines.join('\n');
}

export function buildSystemPrompt(ctx: CoachContext): string {
  const sym = ctx.currency === 'USD' ? '$'
    : ctx.currency === 'PHP' ? '₱'
    : ctx.currency === 'EUR' ? '€'
    : ctx.currency === 'GBP' ? '£'
    : ctx.currency === '__carrot__' ? '🥕'
    : ctx.currency;

  const habitStatus = ctx.habits.total === 0
    ? 'No habits set up yet.'
    : `${ctx.habits.completedToday}/${ctx.habits.total} done today. `
    + `${ctx.habits.daysFullyCompletedLast7}/7 full days completed this week.`
    + (ctx.habits.habitsMostMissed.length > 0
        ? ` Still pending today: ${ctx.habits.habitsMostMissed.join(', ')}.`
        : ' All habits done today!')
    + (ctx.habits.weeklyGoals.length > 0
        ? ` Weekly goals (any days, Monday to Sunday): ${ctx.habits.weeklyGoals.map(g => `${g.label} ${g.done}/${g.target}`).join(', ')}.`
        : '');

  const periodStatus = ctx.budgetPeriod
    ? `The user budgets ${ctx.budgetPeriod.period}: ${sym}${ctx.budgetPeriod.budget} this ${ctx.budgetPeriod.period === 'weekly' ? 'week' : 'month'}, `
      + `${sym}${ctx.budgetPeriod.left} left with ${ctx.budgetPeriod.daysLeft} day(s) to go. `
      + (ctx.budgetPeriod.billsSetAside > 0 ? `${sym}${ctx.budgetPeriod.billsSetAside} of that is set aside for bills. ` : '')
      + `Today's allowance adapts to what's left. `
    : '';
  const billsStatus = ctx.bills.length > 0
    ? `Recurring bills (logged automatically on the day; they don't count against the daily allowance): `
      + ctx.bills.map(b => `${b.name} ${sym}${b.amount} ${b.schedule.toLowerCase()}${b.next ? `, next ${b.next}` : ''}`).join('; ') + '. '
    : '';

  const lastMonthStatus = ctx.lastMonth
    ? `Last month (${ctx.lastMonth.name}) they spent ${sym}${ctx.lastMonth.spent}`
      + (ctx.lastMonth.prevSpent !== null ? ` (vs ${sym}${ctx.lastMonth.prevSpent} in ${ctx.lastMonth.prevName})` : '')
      + (ctx.lastMonth.topCategory ? `, most on ${ctx.lastMonth.topCategory}` : '') + '. '
    : '';
  const savingsStatus = ctx.savingsGoals.length > 0
    ? `Savings jars: ${ctx.savingsGoals.map(g => `"${g.name}" ${sym}${g.saved} of ${sym}${g.target}`).join(', ')}. `
    : '';
  const financeStatus = periodStatus + billsStatus + savingsStatus + lastMonthStatus + (ctx.dailyBudget === 0
    ? `Spent ${sym}${ctx.finance.spentToday} today. No daily budget set.`
    : `Spent ${sym}${ctx.finance.spentToday} of ${sym}${Math.round(ctx.dailyBudget * 100) / 100} allowed today `
    + `(${ctx.finance.budgetUsedTodayPct}% of budget). `
    + `Weekly average: ${sym}${ctx.finance.dailyAverageSpend}/day. `
    + `Total this week: ${sym}${ctx.finance.totalSpentLast7Days}.`);

  // ── Weekly snapshot table ──────────────────────────────────────────────────
  const snapshotLines = ctx.weeklySnapshot
    .filter(day => day.habitsScheduled > 0 || day.spent > 0 || day.focusMinutes > 0 || day.workouts.length > 0)
    .map(day => {
      const isToday  = day.date === getTodayKey();
      const label    = isToday ? 'Today' : day.dayName;
      const habStr   = day.habitsScheduled > 0
        ? `${day.habitsCompleted}/${day.habitsScheduled} habits`
        : 'no habits scheduled';
      const spendStr = day.spent > 0 ? `${sym}${day.spent.toFixed(2)} spent` : 'no spend logged';
      const names    = day.habitLabelsCompleted.length > 0
        ? ` (${day.habitLabelsCompleted.join(', ')})`
        : '';
      const focusStr = day.focusMinutes > 0 ? ` — ${durationLabel(day.focusMinutes)} focused` : '';
      const workStr  = day.workouts.length > 0 ? ` — workout: ${day.workouts.join(', ')}` : '';
      return `  ${label}: ${habStr}${names} — ${spendStr}${focusStr}${workStr}`;
    });

  // ── Individual spending entries ────────────────────────────────────────────
  let spendingEntriesBlock: string;

  if (ctx.recentSpendingEntries.length === 0) {
    spendingEntriesBlock = '  No individual spending entries recorded this week.';
  } else {
    const todayStr = getTodayKey();
    spendingEntriesBlock = ctx.recentSpendingEntries.map(e => {
      const isToday  = e.date === todayStr;
      const dayLabel = isToday ? 'Today' : new Date(e.date + 'T00:00:00')
        .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr  = e.time ? ` at ${e.time}` : '';
      const noteStr  = e.note ? ` — "${e.note}"` : ' — (no note)';
      const catStr   = e.category ? ` [${e.category}]` : '';
      return `  ${dayLabel}${timeStr}: ${sym}${e.amount.toFixed(2)}${catStr}${noteStr}`;
    }).join('\n');
  }

  return `You are Bonbon, a warm and encouraging habit and finance coach inside a mobile app called Habbit.
You speak directly to the user in a friendly, concise tone — no corporate jargon, no walls of text.
Keep responses to 2–4 sentences unless the user explicitly asks for more detail.
Use the user's name naturally but sparingly — not in every message.
Never repeat the raw numbers back robotically. Interpret them and give one clear, actionable insight.
Look for patterns between habit completion and spending — e.g. days where habits were skipped often show higher spend. Only mention this if the data actually supports it, don't force it.
When the user asks a vague question like "how did my week go?", lead with the most interesting pattern you see, not a list of stats.
When the user asks what they spent money on, use the SPENDING ENTRIES section below — it contains the actual items and notes.
Habits can be timed with the focus timer (set up when editing a habit, started with the ▶︎ on it): blocks of focused time, each finished block counting as one check-off. The FOCUS TIMER section has the user's numbers; it's a good thing to suggest for habits like studying or reading.
Habits can also log workouts: routines (like Push, Pull, Legs) that take turns, with sets × reps and weights filled in from last time, a rest timer between sets, and finishing one checks the habit off. The WORKOUTS section has the user's routines, recent workouts and lifts. Keep training advice general and safe: consistency, rest days, small steady weight increases; never tell them to push through pain, and suggest a professional for injuries or health questions.
If no note was recorded for an entry, say so honestly rather than guessing.
If the user asks something completely unrelated to habits or finances, gently redirect them.

USER PROFILE
Name: ${ctx.userName}
Current streak: ${ctx.streak} day${ctx.streak === 1 ? '' : 's'}
Best streak ever: ${ctx.bestStreak} day${ctx.bestStreak === 1 ? '' : 's'}

HABITS TODAY
${habitStatus}
${ctx.focus ? `\nFOCUS TIMER\n${focusStatus(ctx.focus)}\n` : ''}${ctx.workouts ? `\nWORKOUTS\n${workoutStatus(ctx.workouts)}\n` : ''}
SPENDING TODAY
${financeStatus}

LAST 7 DAYS (habits + spending + focus + workouts per day)
${snapshotLines.join('\n')}

SPENDING ENTRIES (last 7 days, individual transactions with notes)
${spendingEntriesBlock}`;
}