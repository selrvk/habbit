# Habbit 3 (build 14): App Store submission

## Your steps, in order

1. **Privacy policy:** it's at <https://github.com/selrvk/habbit/blob/main/docs/privacy-policy.md>, where the paywall, Settings and Bonbon's consent card link to. Put the same URL in App Store Connect › App Privacy › Privacy Policy URL.
2. **RevenueCat:** remove the promotional Pro you gave yourself for testing.
3. **Google AI Studio:** check that the API key behind Bonbon is on a project with billing (the paid tier). The consent card and policy say Google doesn't train on Bonbon's chats, which is only true on the paid tier.
4. **Archive and upload:** in Xcode, choose Any iOS Device, then Product › Archive, then Distribute App › App Store Connect. It's already set to version 3, build 14.
5. **In App Store Connect,** fill in everything below, then on the version page add the subscriptions under "In-App Purchases and Subscriptions" if they show "Ready to Submit".
6. **Submit for review.**

---

## What's New in This Version

```
Habbit's biggest update yet!

• A streak for every Habbit, "3× a week" goals, and skip days that don't break your streak
• A page for each Habbit with its calendar, best streak and completion rate
• Focus timer, with a Live Activity on your Lock Screen
• Workout tracking: routines that take turns and a rest timer between sets
• Spending categories, recurring bills, savings jars and a monthly summary
• A Sunday recap of your week, and 26 achievements to earn
• New widgets: check off Habbits and log spending right from your Home Screen, Lock Screen and Control Center
• Siri and Shortcuts: "Log an expense in Habbit"
• iCloud backup, backup files and a spending export
• Fresh clay icons all through the app
```

## Promotional Text

```
Habits, spending, focus and workouts in one cozy app, with Bonbon the bunny cheering you on. Now with a focus timer, workout tracking and new widgets!
```

## Description

```
Habbit is a cozy habit tracker and budget buddy in one, with Bonbon, a bunny coach who knows how your week is really going.

BUILD HABITS THAT FIT YOUR LIFE
• Daily Habbits, "3× a week" goals, or several times a day (like 8 glasses of water)
• A streak for every Habbit, plus skip days for when life happens
• Reminders, and an evening check-in on days with Habbits left
• Each Habbit's calendar, best streak and completion rate

FOCUS AND WORKOUTS
• A focus timer with breaks, shown on your Lock Screen as a Live Activity
• Workout routines that take turns, with a rest timer between sets

KNOW WHERE YOUR MONEY GOES
• A daily, weekly or monthly budget that shows what's left today
• Spending categories, recurring bills and savings jars
• A monthly summary, and an export for your spreadsheet

MEET BONBON
Ask Bonbon how your habits went, where your money is going, or what to focus on next. Every Sunday you also get a recap of your week. Bonbon is powered by Google's Gemini AI, is for people 18 and older, and only uses your data after you allow it.

LOG FROM ANYWHERE
• Home Screen and Lock Screen widgets: check off Habbits and log spending without opening the app
• Siri and Shortcuts: "Log an expense in Habbit"
• A Log Expense button in Control Center

YOUR DATA STAYS YOURS
Everything is stored on your iPhone and backed up to your own iCloud. No ads, no tracking.

HABBIT PRO
• 50 Bonbon messages a day (10 on the free plan) and longer chat memory
• Bonbon's note on your week every Sunday, and your last 8 weeks side by side
• Your own spending categories and more than one savings jar
• Cream and Match iPhone widget looks
• Workout progress and personal bests

Habbit Pro is a monthly or yearly subscription. Payment is charged to your Apple ID, and it renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel it anytime in your App Store account settings.

Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://github.com/selrvk/habbit/blob/main/docs/privacy-policy.md
```

## Keywords (100 characters)

```
habit tracker,budget,expense,streak,routine,focus timer,pomodoro,workout,gym log,savings,goals,coach
```

## App Review Information › Notes

```
No sign-in is needed: Habbit creates an anonymous account automatically.

Bonbon (Chat tab) is an AI chat powered by Google's Gemini API through our server. Before anything is sent, the app shows a consent card with an age check ("Allow · I'm 18 or older" or "I'm under 18"); Google's Gemini API terms are for people 18 and older, so Bonbon stays off for anyone under 18 and the rest of the app works as usual. It can be turned off in Settings › Data & Privacy. The free plan has 10 messages a day, Pro has 50.

Habbit Pro: tap "Free plan · Unlock Pro" on the Profile tab, or any PRO label. There are monthly and yearly auto-renewing subscriptions. Restore purchases is on the paywall and in Settings.

Focus timer and Live Activity: add a Habbit (Habbits tab, +) with "Time it in focus blocks" on, then tap ▶ on its row on Home.
Workouts: add a Habbit with "Log my workouts" on, then tap ▶ on its row on Home.
Widgets: add the Habbit widgets from the Home Screen. The Habits widget checks off a Habbit with a tap.
Siri: "Log an expense in Habbit", "How much can I spend in Habbit".
```

## App Privacy (the data label)

Choose **"Yes, we collect data"**. For every type below, the answers are: used for **App Functionality** only, and **not used for tracking**.

| Data type | Linked to the user? | What it is |
|---|---|---|
| Identifiers › User ID | Yes | Anonymous account ID (message limits, Pro) |
| Usage Data › Product Interaction | Yes | Bonbon messages sent per day |
| Purchases › Purchase History | Yes | Subscription status, through RevenueCat |
| User Content › Other User Content | No | Messages to Bonbon, sent to Google's Gemini |
| Contact Info › Name | No | First name, included in Bonbon's summary |
| Health & Fitness › Fitness | No | Workouts, included in Bonbon's summary |
| Financial Info › Other Financial Info | No | Spending, included in Bonbon's summary |

Everything else you track stays on the phone and isn't "collected" in Apple's sense.

## Age Rating

Answer the questionnaire honestly. These points apply to Habbit:
- **AI chatbot / assistant:** yes, Bonbon.
- **Health, fitness or wellness topics:** yes, habits and workouts. No medical or treatment information.
- **Messaging between people, user content shared with others, unrestricted web access, advertising:** none.
- **Violence, mature themes, gambling:** none.


## Screenshots to retake

The current ones are from v2.0. Upload 6.9-inch screenshots (1320 × 2868, iPhone 17 Pro Max); App Store Connect scales them for the smaller sizes. Suggested set:
1. Home with streaks, a running focus timer and a workout in progress
2. A Habbit's page with its calendar and stats
3. Finance with categories, bills and a savings jar
4. Chat with Bonbon
5. The Sunday recap
6. Widgets on the Home Screen and Lock Screen
7. The workout screen with the rest timer
8. The focus timer and its Live Activity

I can take these on the simulator with good-looking sample data.

---

## Bonbon and Google's age rule

Google's Gemini API terms (updated April 28, 2026) say you must be 18 or older to use the API, and that it must not be used in an app "likely to be accessed by individuals under the age of 18". Habbit handles this with an age check on Bonbon: the consent card asks people to confirm they're 18 or older, and anyone who says they're under 18 gets everything except Bonbon. The rest of the app stays open to all ages, so this is the common middle ground rather than a full 18+ rating.
