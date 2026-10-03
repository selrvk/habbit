// src/utils/coachPrompt.ts

import type { CoachContext } from './buildCoachContext';
import { getTodayKey } from '../helpers';

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
    .filter(day => day.habitsScheduled > 0 || day.spent > 0)
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
      return `  ${label}: ${habStr}${names} — ${spendStr}`;
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
If no note was recorded for an entry, say so honestly rather than guessing.
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
${snapshotLines.join('\n')}

SPENDING ENTRIES (last 7 days, individual transactions with notes)
${spendingEntriesBlock}`;
}