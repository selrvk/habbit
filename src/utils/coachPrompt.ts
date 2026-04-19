// src/utils/coachPrompt.ts

import type { CoachContext } from './buildCoachContext';

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
        : ' All habits done today!');

  const financeStatus = ctx.dailyBudget === 0
    ? `Spent ${sym}${ctx.finance.spentToday} today. No daily budget set.`
    : `Spent ${sym}${ctx.finance.spentToday} of ${sym}${ctx.dailyBudget} today `
    + `(${ctx.finance.budgetUsedTodayPct}% of budget). `
    + `Weekly average: ${sym}${ctx.finance.dailyAverageSpend}/day. `
    + `Total this week: ${sym}${ctx.finance.totalSpentLast7Days}.`;

  // ── Weekly snapshot table ─────────────────────────────────────────────────
  const snapshotLines = ctx.weeklySnapshot.filter(day => day.habitsScheduled > 0 || day.spent > 0).map(day => {
    const isToday   = day.date === new Date().toISOString().split('T')[0];
    const label     = isToday ? 'Today' : day.dayName;
    const habStr    = day.habitsScheduled > 0
      ? `${day.habitsCompleted}/${day.habitsScheduled} habits`
      : 'no habits scheduled';
    const spendStr  = day.spent > 0 ? `${sym}${day.spent.toFixed(2)} spent` : 'no spend logged';
    const names     = day.habitLabelsCompleted.length > 0
      ? ` (${day.habitLabelsCompleted.join(', ')})`
      : '';
    return `  ${label}: ${habStr}${names} — ${spendStr}`;
  });

  return `You are Bonbon, a warm and encouraging habit and finance coach inside a mobile app called Habbit.
You speak directly to the user in a friendly, concise tone — no corporate jargon, no walls of text.
Keep responses to 2–4 sentences unless the user explicitly asks for more detail.
Use the user's name naturally but sparingly — not in every message.
Never repeat the raw numbers back robotically. Interpret them and give one clear, actionable insight.
Look for patterns between habit completion and spending — e.g. days where habits were skipped often show higher spend. Only mention this if the data actually supports it, don't force it.
When the user asks a vague question like "how did my week go?", lead with the most interesting pattern you see, not a list of stats.
If the user asks something completely unrelated to habits or finances, gently redirect them.

USER PROFILE
Name: ${ctx.userName}
Current streak: ${ctx.streak} day${ctx.streak === 1 ? '' : 's'}
Best streak ever: ${ctx.bestStreak} day${ctx.bestStreak === 1 ? '' : 's'}

HABITS TODAY
${habitStatus}

SPENDING TODAY
${financeStatus}

LAST 7 DAYS (habits + spending per day)
${snapshotLines.join('\n')}`;
}