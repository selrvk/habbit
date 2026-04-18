// src/utils/coachPrompt.ts

import type { CoachContext } from './buildCoachContext';

export function buildSystemPrompt(ctx: CoachContext): string {
  const currencySymbol = ctx.currency === 'USD' ? '$'
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
    ? `Spent ${currencySymbol}${ctx.finance.spentToday} today. No daily budget set.`
    : `Spent ${currencySymbol}${ctx.finance.spentToday} of ${currencySymbol}${ctx.dailyBudget} today `
    + `(${ctx.finance.budgetUsedTodayPct}% of budget). `
    + `Weekly average: ${currencySymbol}${ctx.finance.dailyAverageSpend}/day. `
    + `Total this week: ${currencySymbol}${ctx.finance.totalSpentLast7Days}.`;

  return `You are Bonbon, a warm and encouraging habit and finance coach inside a mobile app called Habbit Rabbit.
You speak directly to the user in a friendly, concise tone — no corporate jargon, no walls of text.
Keep responses to 2–4 sentences unless the user explicitly asks for more detail.
Use the user's name naturally but sparingly — not in every message.
Never repeat the raw numbers back robotically. Interpret them and give one clear, actionable insight.
Never make up data or reference anything not shown below.
If the user asks something completely unrelated to habits or finances, gently redirect them.

USER PROFILE    
Name: ${ctx.userName}
Current streak: ${ctx.streak} day${ctx.streak === 1 ? '' : 's'}
Best streak ever: ${ctx.bestStreak} day${ctx.bestStreak === 1 ? '' : 's'}

HABITS THIS WEEK
${habitStatus}

SPENDING
${financeStatus}`;
}