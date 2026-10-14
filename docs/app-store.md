# Habbit 3.1 (build 17): App Store submission

## Your steps, in order

1. **Privacy policy:** the published Google Doc needs the three additions below, since 3.1 adds net worth and receipt scanning. Edit the same document so the link stays the same (<https://docs.google.com/document/d/e/2PACX-1vRaehJ-88IhMU8NCGtolO_JnG-gJBGN_eze6f3AMwz_5wUFT52NT8pZYG-fmp7t6c3IIcCTfC7WibFn/pub>), and change its effective date. The full text is in `docs/privacy-policy.md`.
   - Under "The short version", add the line: *The camera is used only to scan a receipt. The photo stays on your iPhone.*
   - Under "What stays on your iPhone", add the line: *the account balances and debts you enter for your net worth (these are never sent to Bonbon)*
   - After the Bonbon section, add the section **Scanning receipts** from `docs/privacy-policy.md`.
2. **Prices:** in App Store Connect › Subscriptions, check the yearly price in each country against twelve months of the monthly one. The US prices are fine ($0.99 and $9.99); the Philippines was the one where yearly cost more.
3. **Test on your iPhone** what the simulator couldn't show: scanning a receipt with the camera, the screen staying awake while a plank is timed, and the focus timer on the Lock Screen across a few rounds with the app closed.
4. **Archive and upload:** in Xcode, choose Any iOS Device, then Product › Archive, then Distribute App › App Store Connect. It's already set to version 3.1, build 17.
5. **In App Store Connect,** create version 3.1 and paste in "What's New" below. The promotional text, description and keywords below are updated too; the review notes have a new paragraph about the camera.
6. **Submit for review.**

The data label, age rating and screenshots don't have to change. New screenshots would help show the receipt scan and net worth, and I can take them on the simulator.

---

## What's New in This Version

```
A lot of this update came from your feedback. Thank you!

• The focus timer is now a real Pomodoro: rounds and breaks run one after the other by themselves
• Quick focus: start a session without a Habbit, from Home, the app icon or Siri
• Scan a receipt to fill in an expense
• Net worth: add up what you have and what you owe, and watch it month by month
• Yearly bills, and reminders a day, three days or a week ahead
• Leftover budget is offered to your savings jar quietly, on daily budgets too
• Workouts: time holds like planks and wall sits
• Forgot to tick a Habbit off? Mark it done the next day and keep your streak
• Log spending on an earlier day, and change or remove anything you've logged
• Swipe from the left edge to go back
• Copy your Account ID in Settings, and other small fixes
```

## Promotional Text

```
Habits, spending, focus and workouts in one cozy app, with Bonbon the bunny cheering you on. Now with a Pomodoro timer, receipt scanning and net worth!
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
• A Pomodoro focus timer: rounds and breaks that run by themselves, shown on your Lock Screen as a Live Activity
• Quick focus sessions, with or without a Habbit
• Workout routines that take turns, with a rest timer between sets and timed holds like planks

KNOW WHERE YOUR MONEY GOES
• A daily, weekly or monthly budget that shows what's left today
• Scan a receipt to fill in an expense
• Spending categories, bills that log themselves (weekly, monthly or yearly) and savings jars
• Net worth: what you have and what you owe, month by month
• A monthly summary, and an export for your spreadsheet

MEET BONBON
Ask Bonbon how your habits went, where your money is going, or what to focus on next. Every Sunday you also get a recap of your week. Bonbon is powered by Google's Gemini AI, is for people 18 and older, and only uses your data after you allow it.

LOG FROM ANYWHERE
• Home Screen and Lock Screen widgets: check off Habbits and log spending without opening the app
• Siri and Shortcuts: "Log an expense in Habbit", "Start a focus timer in Habbit"
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
Privacy Policy: https://docs.google.com/document/d/e/2PACX-1vRaehJ-88IhMU8NCGtolO_JnG-gJBGN_eze6f3AMwz_5wUFT52NT8pZYG-fmp7t6c3IIcCTfC7WibFn/pub
```

## Keywords (100 characters)

```
habit tracker,budget,expense,receipt,net worth,streak,focus timer,pomodoro,workout,gym log,savings
```

## App Review Information › Notes

```
No sign-in is needed: Habbit creates an anonymous account automatically.

Bonbon (Chat tab) is an AI chat powered by Google's Gemini API through our server. Before anything is sent, the app shows a consent card with an age check ("Allow · I'm 18 or older" or "I'm under 18"); Google's Gemini API terms are for people 18 and older, so Bonbon stays off for anyone under 18 and the rest of the app works as usual. It can be turned off in Settings › Data & Privacy. The free plan has 10 messages a day, Pro has 50.

Habbit Pro: tap "Free plan · Unlock Pro" on the Profile tab, or any PRO label. There are monthly and yearly auto-renewing subscriptions. Restore purchases is on the paywall and in Settings.

Camera: used only to scan a receipt. In the "Add spending" sheet, tap "Scan a receipt" and take or choose a photo. The text is read on the device (Apple's Vision) and fills in the amount and shop for the user to check; the photo isn't saved or uploaded. If Bonbon's AI is on, the app asks once whether Bonbon may also read receipts; only then is the receipt's text (never the photo) sent to pick a category. That can be turned off in Settings › Data & Privacy.

Focus timer and Live Activity: tap "Focus timer" on Home for a quick session, or add a Habbit (Habbits tab, +) with "Time it in focus rounds" on, then tap ▶ on its row on Home.
Workouts: add a Habbit with "Log my workouts" on, then tap ▶ on its row on Home.
Widgets: add the Habbit widgets from the Home Screen. The Habits widget checks off a Habbit with a tap.
Siri: "Log an expense in Habbit", "How much can I spend in Habbit", "Start a focus timer in Habbit".
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
| Financial Info › Other Financial Info | No | Spending, included in Bonbon's summary; the text of a scanned receipt, when the user lets Bonbon read receipts |

Everything else you track stays on the phone and isn't "collected" in Apple's sense.

Receipt photos are read on the phone and never leave it, so **Photos or Videos** stays unticked. The camera is used only for scanning a receipt.

## Age Rating

Answer the questionnaire honestly. These points apply to Habbit:
- **AI chatbot / assistant:** yes, Bonbon.
- **Health, fitness or wellness topics:** yes, habits and workouts. No medical or treatment information.
- **Messaging between people, user content shared with others, unrestricted web access, advertising:** none.
- **Violence, mature themes, gambling:** none.


## Screenshots

The current set is from version 3 and still fits. If you'd like 3.1 to show, these would be the ones to add or swap in (6.9-inch, 1320 × 2868, iPhone 17 Pro Max):
1. The spending sheet filled in from a scanned receipt
2. Net worth with its month-by-month bars
3. The focus timer mid-session, showing the round and the break to come

I can take these on the simulator with good-looking sample data.

---

## Bonbon and Google's age rule

Google's Gemini API terms (updated April 28, 2026) say you must be 18 or older to use the API, and that it must not be used in an app "likely to be accessed by individuals under the age of 18". Habbit handles this with an age check on Bonbon: the consent card asks people to confirm they're 18 or older, and anyone who says they're under 18 gets everything except Bonbon. The rest of the app stays open to all ages, so this is the common middle ground rather than a full 18+ rating.
