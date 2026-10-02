// HabbitWidget.swift
//
// The Habbit widget: today's Habbits and what's left to spend, on the Home Screen (small,
// medium) and the Lock Screen. It reads the app's snapshot of today (HabbitStore). When the
// snapshot is from an earlier day (the app hasn't been opened yet today), it shows a fresh
// day: nothing done, nothing spent, and the allowance the app worked out for that day.

import WidgetKit
import SwiftUI

// MARK: - Data Model

struct HabbitEntry: TimelineEntry {
    let date: Date
    let completed: Int
    let total: Int
    /** Any Habbits at all; total is 0 on a rest day too. */
    let hasHabits: Bool
    let spent: Double
    let allowance: Double
    /** "daily", "weekly" or "monthly". */
    let period: String
    let periodLeft: Double
    let currency: String
    let streak: Int
    let avatar: String

    var left: Double { allowance - spent }
    var isOver: Bool { left < 0 }
    var allDone: Bool { total > 0 && completed >= total }
    var habitShare: CGFloat { total > 0 ? min(CGFloat(completed) / CGFloat(total), 1) : 0 }

    /** "Keep going", "All done", "Rest day", "No Habbits yet". */
    var title: String {
        !hasHabits ? "No Habbits yet" : total == 0 ? "Rest day" : allDone ? "All done" : "Keep going"
    }
    var subtitle: String {
        !hasHabits ? "Tap to add one" : total == 0 ? "Nothing on today" : "\(completed) of \(total) Habbits"
    }
    /** "this week" / "this month"; nil for daily budgets. */
    var periodNoun: String? { period == "weekly" ? "this week" : period == "monthly" ? "this month" : nil }
    /** Where a tap goes. */
    var url: URL { URL(string: hasHabits ? "habbit://home" : "habbit://habits/new")! }

    static let placeholder = HabbitEntry(
        date: Date(), completed: 1, total: 3, hasHabits: true, spent: 380, allowance: 500,
        period: "weekly", periodLeft: 2400, currency: "₱", streak: 12, avatar: "avatar_bunny")
}

// MARK: - Provider

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> HabbitEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (HabbitEntry) -> Void) {
        completion(context.isPreview && HabbitStore.snapshot().date == nil ? .placeholder : loadEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabbitEntry>) -> Void) {
        let now = Date()
        // A second entry at midnight flips the widget to a fresh day even if the app isn't opened.
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: now)!
        completion(Timeline(entries: [loadEntry(at: now), loadEntry(at: midnight)], policy: .after(nextUpdate)))
    }

    private func loadEntry(at entryDate: Date) -> HabbitEntry {
        let snap = HabbitStore.snapshot()
        var completed  = snap.completedCount
        var total      = snap.totalCount
        var spent      = snap.spentToday
        var allowance  = snap.allowance
        var periodLeft = snap.periodLeft
        var streak     = snap.streak

        // Written on an earlier day: show a fresh one.
        let entryKey = HabbitStore.dayKey(entryDate)
        if let dataKey = snap.date, dataKey < entryKey {
            let yesterdayKey = HabbitStore.dayKey(Calendar.current.date(byAdding: .day, value: -1, to: entryDate)!)
            // Yesterday ended with Habbits unfinished → the streak is broken.
            if dataKey == yesterdayKey && total > 0 && completed < total { streak = 0 }
            let weekday = Calendar.current.component(.weekday, from: entryDate) - 1 // 0 = Sunday
            if snap.scheduledByDow.count == 7 { total = snap.scheduledByDow[weekday] }
            completed = 0
            spent = 0
            // The app works out the coming days' allowances; past them, keep the last one.
            if let day = snap.upcoming.first(where: { $0.date == entryKey }) ?? snap.upcoming.last {
                allowance = day.allowance
                periodLeft = day.periodLeft
            }
        }

        return HabbitEntry(
            date: entryDate, completed: completed, total: total, hasHabits: !snap.habits.isEmpty || total > 0,
            spent: spent, allowance: allowance, period: snap.budgetPeriod, periodLeft: periodLeft,
            currency: snap.currency, streak: streak, avatar: snap.avatar)
    }
}

// MARK: - Helpers

private func peekImageName(for avatar: String) -> String {
    switch avatar {
    case "avatar_bear":    return "BearPeek"
    case "avatar_fox":     return "FoxPeek"
    case "avatar_hamster": return "HamsterPeek"
    case "avatar_panda":   return "PandaPeek"
    default:               return "BunnyPeek"
    }
}

// Some avatars render visually wider than others — push those further off-screen
// so they peek less and don't overlap the text block.
// Lower x = more peek (further left), higher x = less peek.
private func peekOffsetX(for avatar: String, base: CGFloat) -> CGFloat {
    switch avatar {
    case "avatar_panda":   return base + 20  // wide — peek less
    case "avatar_bear":    return base + 8
    case "avatar_hamster": return base + 16
    case "avatar_fox":     return base - 4
    default:               return base + 12  // bunny — peek slightly more than before
    }
}

// Per-avatar size tweak for the small widget peek.
private func peekSize(for avatar: String, base: CGFloat) -> CGFloat {
    return base - 14
}

/** "₱120", "₱1.5k", "₱2m"; no symbol for the carrot currency (shown as an icon). */
private func formatAmount(_ value: Double, currency: String) -> String {
    let prefix = currency == "__carrot__" ? "" : currency
    if value >= 1_000_000 {
        let m = value / 1_000_000
        return "\(prefix)\(m.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", m) : String(format: "%.1f", m))m"
    } else if value >= 1000 {
        let k = value / 1000
        return "\(prefix)\(k.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", k) : String(format: "%.1f", k))k"
    }
    return "\(prefix)\(String(format: "%.0f", value))"
}

/** Text-only amount for the Lock Screen, where the carrot is an emoji. */
private func plainAmount(_ value: Double, currency: String) -> String {
    currency == "__carrot__" ? "🥕\(formatAmount(value, currency: currency))" : formatAmount(value, currency: currency)
}

/** "₱120 left today" or "₱97 over today". */
private func todayLine(_ entry: HabbitEntry) -> String {
    "\(plainAmount(abs(entry.left), currency: entry.currency)) \(entry.isOver ? "over" : "left") today"
}

// Inline carrot icon used when the user's currency is the carrot PNG.
private struct CarrotIcon: View {
    let size: CGFloat
    let color: Color
    var body: some View {
        Image("CarrotCurrency")
            .resizable()
            .renderingMode(.template)
            .scaledToFit()
            .foregroundColor(color)
            .frame(width: size, height: size)
    }
}

/** An amount in the app's currency, with the carrot as an icon. */
private struct Amount: View {
    let value: Double
    let currency: String
    let size: CGFloat
    let color: Color
    var body: some View {
        HStack(spacing: 2) {
            if currency == "__carrot__" { CarrotIcon(size: size * 0.85, color: color) }
            Text(formatAmount(value, currency: currency))
                .font(.system(size: size, weight: .black))
                .foregroundColor(color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }
}

/** Progress ring with the count, a tick when all are done, or a dash when nothing's on. */
private struct HabitRing: View {
    let entry: HabbitEntry
    let size: CGFloat
    let line: CGFloat
    let font: CGFloat
    var showTotal = false

    var body: some View {
        ZStack {
            Circle().stroke(Color.habbitBar, lineWidth: line)
            Circle()
                .trim(from: 0, to: entry.habitShare)
                .stroke(entry.allDone ? Color.habbitGreen : Color.habbitAccent, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
            if entry.allDone {
                Image(systemName: "checkmark").font(.system(size: font, weight: .heavy)).foregroundColor(.habbitGreen)
            } else if entry.total == 0 {
                Text(entry.hasHabits ? "😴" : "+").font(.system(size: font, weight: .black)).foregroundColor(Color.habbitCream.opacity(0.6))
            } else {
                VStack(spacing: 0) {
                    Text("\(entry.completed)").font(.system(size: font, weight: .black)).foregroundColor(.habbitAccent).lineLimit(1)
                    if showTotal {
                        Text("of \(entry.total)").font(.system(size: 9, weight: .bold)).foregroundColor(Color.habbitAccent.opacity(0.5))
                    }
                }
            }
        }
        .frame(width: size, height: size)
    }
}

private struct StreakBadge: View {
    let streak: Int
    let size: CGFloat
    var body: some View {
        HStack(spacing: 3) {
            Image("StreakFire").resizable().scaledToFit().frame(height: size).opacity(streak > 0 ? 1 : 0.3)
            Text("\(streak)")
                .font(.system(size: size - 1, weight: .black))
                .foregroundColor(streak > 0 ? .habbitCream : Color.habbitCream.opacity(0.4))
                .lineLimit(1)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(streak) day streak")
    }
}

// MARK: - Colors

extension Color {
    static let habbitBg       = Color(red: 0.11, green: 0.04, blue: 0.02)   // #1c0a06
    static let habbitAccent   = Color(red: 0.83, green: 0.58, blue: 0.42)   // #d29460
    static let habbitCream    = Color(red: 1.00, green: 0.97, blue: 0.94)   // #fff8f0
    static let habbitBar      = Color(red: 0.24, green: 0.09, blue: 0.06)   // #3d170e
    static let habbitRed      = Color(red: 0.94, green: 0.56, blue: 0.56)
    static let habbitGreen    = Color(red: 0.62, green: 0.83, blue: 0.53)
    static let habbitCard     = Color(red: 0.16, green: 0.06, blue: 0.03)   // slightly lighter than bg
}

// MARK: - Widget Entry View (Router)

struct HabbitWidgetView: View {
    var entry: HabbitEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:          SmallWidgetView(entry: entry)
        case .systemMedium:         MediumWidgetView(entry: entry)
        case .accessoryCircular:    CircularLockScreenView(entry: entry)
        case .accessoryRectangular: RectangularLockScreenView(entry: entry)
        case .accessoryInline:      InlineLockScreenView(entry: entry)
        default:                    SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Small Widget

struct SmallWidgetView: View {
    var entry: HabbitEntry

    var body: some View {
        ZStack {
            // Avatar peek — rotated left 90°, hugging the right edge
            Image(peekImageName(for: entry.avatar))
                .resizable()
                .scaledToFit()
                .frame(width: peekSize(for: entry.avatar, base: 140), height: peekSize(for: entry.avatar, base: 140))
                .rotationEffect(.degrees(-90), anchor: .center)
                .offset(x: peekOffsetX(for: entry.avatar, base: 30), y: 10)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)

            VStack(alignment: .leading, spacing: 0) {
                // Top: date + streak
                HStack(alignment: .center, spacing: 0) {
                    Text(entry.date, format: .dateTime.month(.abbreviated).day())
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color.habbitCream.opacity(0.45))
                    Spacer(minLength: 0)
                    StreakBadge(streak: entry.streak, size: 14)
                }

                Spacer().frame(height: 6)

                // Main: ring + message
                VStack(alignment: .leading, spacing: 6) {
                    HabitRing(entry: entry, size: 42, line: 3, font: 16)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(entry.title)
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundColor(entry.allDone ? .habbitCream : .habbitAccent)
                            .lineLimit(1)
                        Text(entry.subtitle)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundColor(Color.habbitCream.opacity(0.45))
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: 96, alignment: .leading)

                Spacer(minLength: 0)

                // Bottom: what's left to spend today
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.isOver ? "Over today" : "Left today")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(Color.habbitCream.opacity(0.45))
                    Amount(value: abs(entry.left), currency: entry.currency, size: 17, color: entry.isOver ? .habbitRed : .habbitAccent)
                }
                .frame(maxWidth: 100, alignment: .leading)
                .padding(.top, 8)
            }
            .padding(.leading, 6)
            .padding(.trailing, 10)
            .padding(.vertical, 2)
        }
        .widgetURL(entry.url)
        .containerBackground(Color.habbitBg, for: .widget)
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    var entry: HabbitEntry

    private func column(_ label: String, _ value: Double, _ color: Color, suffix: String? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(Color.habbitCream.opacity(0.45))
                .tracking(0.3)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Amount(value: value, currency: entry.currency, size: 13, color: color)
                if let suffix {
                    Text(suffix).font(.system(size: 10, weight: .semibold)).foregroundColor(Color.habbitCream.opacity(0.45))
                }
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top: date + streak
            HStack(alignment: .center, spacing: 10) {
                Text(entry.date, format: .dateTime.month(.abbreviated).day())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(Color.habbitCream.opacity(0.45))
                    .textCase(.uppercase)
                StreakBadge(streak: entry.streak, size: 14)
                Spacer(minLength: 0)
            }

            Spacer(minLength: 0)

            // Main: ring + message
            HStack(alignment: .center, spacing: 12) {
                HabitRing(entry: entry, size: 56, line: 4, font: 20, showTotal: true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.title)
                        .font(.system(size: 18, weight: .heavy))
                        .foregroundColor(entry.allDone ? .habbitCream : .habbitAccent)
                        .lineLimit(1)
                    Text(entry.subtitle)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color.habbitCream.opacity(0.45))
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            // Bottom: today's money, then the week's (or month's) or what's been spent
            HStack(alignment: .bottom, spacing: 18) {
                column(entry.isOver ? "OVER TODAY" : "LEFT TODAY", abs(entry.left), entry.isOver ? .habbitRed : .habbitAccent)
                if let noun = entry.periodNoun {
                    column(noun.uppercased(), max(entry.periodLeft, 0), .habbitCream, suffix: "left")
                } else {
                    column("SPENT", entry.spent, .habbitCream)
                }
                Link(destination: URL(string: "habbit://spend")!) {
                    Text("+ Log")
                        .font(.system(size: 11, weight: .heavy))
                        .foregroundColor(.habbitBg)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Color.habbitAccent))
                }
                .accessibilityLabel("Log an expense")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
        // Avatar peek — large, hugging the right edge. A background, so its size can't
        // stretch the layout past the widget (it used to push the top and bottom rows out).
        .background(alignment: .trailing) {
            Image(peekImageName(for: entry.avatar))
                .resizable()
                .scaledToFit()
                .frame(width: 240, height: 240)
                .offset(x: 70, y: 0)
        }
        .widgetURL(entry.url)
        .containerBackground(Color.habbitBg, for: .widget)
    }
}

// MARK: - Lock Screen: Rectangular

struct RectangularLockScreenView: View {
    var entry: HabbitEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                Text(entry.total > 0 ? "\(entry.completed)/\(entry.total) Habbits" : entry.title)
                    .font(.system(size: 14, weight: .heavy))
                    .lineLimit(1)
                    .widgetAccentable()
                Spacer(minLength: 0)
                if entry.streak > 0 {
                    Image(systemName: "flame.fill").font(.system(size: 11, weight: .bold))
                    Text("\(entry.streak)").font(.system(size: 13, weight: .heavy))
                }
            }
            .accessibilityElement(children: .combine)
            if entry.total > 0 {
                Gauge(value: Double(entry.completed), in: 0...Double(entry.total)) { EmptyView() }
                    .gaugeStyle(.accessoryLinearCapacity)
                    .widgetAccentable()
            }
            Text(todayLine(entry))
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .widgetURL(entry.url)
        .containerBackground(for: .widget) { }
    }
}

// MARK: - Lock Screen: Circular

struct CircularLockScreenView: View {
    var entry: HabbitEntry

    var body: some View {
        Group {
            if entry.total > 0 {
                Gauge(value: Double(entry.completed), in: 0...Double(entry.total)) {
                    EmptyView()
                } currentValueLabel: {
                    if entry.allDone {
                        Image(systemName: "checkmark").font(.system(size: 16, weight: .heavy))
                    } else {
                        Text("\(entry.completed)/\(entry.total)").font(.system(size: 14, weight: .heavy))
                    }
                }
                .gaugeStyle(.accessoryCircularCapacity)
                .widgetAccentable()
            } else {
                ZStack {
                    AccessoryWidgetBackground()
                    Image("AppLogo-BW").resizable().renderingMode(.template).scaledToFit().frame(width: 26, height: 26).widgetAccentable()
                }
            }
        }
        .accessibilityLabel(entry.total > 0 ? "\(entry.completed) of \(entry.total) Habbits done" : entry.title)
        .widgetURL(entry.url)
        .containerBackground(for: .widget) { }
    }
}

// MARK: - Lock Screen: Inline

struct InlineLockScreenView: View {
    var entry: HabbitEntry

    var body: some View {
        Label {
            Text(entry.total > 0
                 ? "\(entry.completed)/\(entry.total) Habbits · \(plainAmount(abs(entry.left), currency: entry.currency)) \(entry.isOver ? "over" : "left")"
                 : todayLine(entry))
        } icon: {
            Image("AppLogo-BW").renderingMode(.template)
        }
        .widgetURL(entry.url)
        .containerBackground(for: .widget) { }
    }
}

// MARK: - Widget Configuration

struct HabbitWidget: Widget {
    let kind: String = "HabbitWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            HabbitWidgetView(entry: entry)
        }
        .configurationDisplayName("Habbit")
        .description("Your daily Habbits and what's left to spend.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}
