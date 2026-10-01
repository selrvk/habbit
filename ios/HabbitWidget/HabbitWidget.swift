// HabbitWidget.swift

import WidgetKit
import SwiftUI

// MARK: - Data Model

struct HabbitEntry: TimelineEntry {
    let date: Date
    let name: String
    let completed: Int
    let total: Int
    let spent: Double
    let budget: Double
    let currency: String
    let streak: Int
    let avatar: String
    let upcomingHabbit: String
}

// MARK: - Provider

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> HabbitEntry {
        HabbitEntry(
            date: Date(), name: "Friend",
            completed: 1, total: 3,
            spent: 3000, budget: 10000,
            currency: "₱", streak: 200,
            avatar: "avatar_bunny",
            upcomingHabbit: "Drink water 8x a day"
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (HabbitEntry) -> Void) {
        completion(loadEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabbitEntry>) -> Void) {
        let now = Date()
        // A second entry at midnight flips the widget to a fresh day even if the app isn't opened.
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: now)!
        completion(Timeline(entries: [loadEntry(at: now), loadEntry(at: midnight)], policy: .after(nextUpdate)))
    }

    private static let dayKeyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private func loadEntry(at entryDate: Date) -> HabbitEntry {
        let defaults = UserDefaults(suiteName: "group.com.selrvk.habbit")
        let raw = defaults?.string(forKey: "widgetData") ?? "{}"
        guard let data = raw.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return HabbitEntry(
                date: entryDate, name: "Friend",
                completed: 0, total: 0,
                spent: 0, budget: 500,
                currency: "₱", streak: 0,
                avatar: "avatar_bunny",
                upcomingHabbit: ""
            )
        }

        // Numbers from JSONSerialization come back as NSNumber — bridge through that
        // so we don't silently fall through on an Int-vs-Double mismatch.
        var completed = (json["completedCount"] as? NSNumber)?.intValue ?? 0
        var total = (json["totalCount"] as? NSNumber)?.intValue ?? 0
        var spent = (json["spentToday"] as? NSNumber)?.doubleValue ?? 0
        let budget = (json["allocatedPerDay"] as? NSNumber)?.doubleValue ?? 500
        var streak = (json["streak"] as? NSNumber)?.intValue ?? 0
        var upcoming = json["upcomingHabbit"] as? String ?? ""

        // The app wrote this on an earlier day and hasn't been opened since: show a fresh day.
        let entryKey = Provider.dayKeyFormatter.string(from: entryDate)
        if let dataKey = json["date"] as? String, dataKey < entryKey {
            let yesterdayKey = Provider.dayKeyFormatter.string(
                from: Calendar.current.date(byAdding: .day, value: -1, to: entryDate)!)
            // Yesterday ended with habits unfinished → the streak is broken.
            if dataKey == yesterdayKey && total > 0 && completed < total { streak = 0 }

            let weekday = Calendar.current.component(.weekday, from: entryDate) - 1 // 0 = Sunday
            if let byDow = json["scheduledByDow"] as? [NSNumber], byDow.count == 7 {
                total = byDow[weekday].intValue
            }
            completed = 0
            spent = 0
            upcoming = ""
        }

        return HabbitEntry(
            date: entryDate,
            name: json["name"] as? String ?? "Friend",
            completed: completed,
            total: total,
            spent: spent,
            budget: budget,
            currency: json["currency"] as? String ?? "₱",
            streak: streak,
            avatar: json["avatar"] as? String ?? "avatar_bunny",
            upcomingHabbit: upcoming
        )
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

    private var habitPct: CGFloat {
        guard entry.total > 0 else { return 0 }
        return min(CGFloat(entry.completed) / CGFloat(entry.total), 1.0)
    }
    private var isOver:  Bool { entry.spent > entry.budget }
    private var allDone: Bool { entry.completed == entry.total && entry.total > 0 }
    private var noHabits: Bool { entry.total == 0 }
    private var hasStreak: Bool { entry.streak > 0 }

    var body: some View {
        ZStack {
            // Avatar peek — rotated left 90°, hugging the right edge
            Image(peekImageName(for: entry.avatar))
                .resizable()
                .scaledToFit()
                .frame(
                    width: peekSize(for: entry.avatar, base: 140),
                    height: peekSize(for: entry.avatar, base: 140)
                )
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
                    HStack(spacing: 3) {
                        Image("StreakFire")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 14)
                            .opacity(hasStreak ? 1 : 0.3)
                        Text("\(entry.streak)")
                            .font(.system(size: 13, weight: .black))
                            .foregroundColor(hasStreak ? .habbitCream : Color.habbitCream.opacity(0.4))
                            .lineLimit(1)
                    }
                }

                Spacer().frame(height: 6)

                // Main (left-aligned): ring + message
                VStack(alignment: .leading, spacing: 6) {
                    ZStack {
                        Circle()
                            .stroke(Color.habbitBar, lineWidth: 3)
                        Circle()
                            .trim(from: 0, to: habitPct)
                            .stroke(
                                allDone ? Color.habbitGreen : Color.habbitAccent,
                                style: StrokeStyle(lineWidth: 3, lineCap: .round)
                            )
                            .rotationEffect(.degrees(-90))

                        if allDone {
                            Image(systemName: "checkmark")
                                .font(.system(size: 16, weight: .heavy))
                                .foregroundColor(.habbitGreen)
                        } else if noHabits {
                            Text("—")
                                .font(.system(size: 16, weight: .black))
                                .foregroundColor(Color.habbitCream.opacity(0.5))
                        } else {
                            Text("\(entry.completed)")
                                .font(.system(size: 16, weight: .black))
                                .foregroundColor(.habbitAccent)
                        }
                    }
                    .frame(width: 42, height: 42)

                    VStack(alignment: .leading, spacing: 1) {
                        Text(noHabits ? "Add habbits" :
                             allDone   ? "All done" : "Keep going")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundColor(allDone ? .habbitCream : .habbitAccent)
                            .lineLimit(1)
                        Text(noHabits ? "No habbits" : "\(entry.completed) of \(entry.total) habbits")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundColor(Color.habbitCream.opacity(0.45))
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: 96, alignment: .leading)

                Spacer(minLength: 0)

                // Bottom: spent / budget
                VStack(alignment: .leading, spacing: 1) {
                    Text("Spent")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(Color.habbitCream.opacity(0.45))
                    HStack(spacing: 2) {
                        if entry.currency == "__carrot__" {
                            CarrotIcon(size: 14, color: isOver ? .habbitRed : .habbitAccent)
                        }
                        Text("\(formatAmount(entry.spent, currency: entry.currency)) / \(formatAmount(entry.budget, currency: entry.currency))")
                            .font(.system(size: 17, weight: .black))
                            .foregroundColor(isOver ? .habbitRed : .habbitAccent)
                            .lineLimit(1)
                            .minimumScaleFactor(0.6)
                    }
                }
                .frame(maxWidth: 100, alignment: .leading)
                .padding(.top, 8)
            }
            .padding(.leading, 6)
            .padding(.trailing, 10)
            .padding(.vertical, 2)
        }
        .containerBackground(Color.habbitBg, for: .widget)
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    var entry: HabbitEntry

    private var habitPct: CGFloat {
        guard entry.total > 0 else { return 0 }
        return min(CGFloat(entry.completed) / CGFloat(entry.total), 1.0)
    }
    private var isOver:  Bool { entry.spent > entry.budget }
    private var allDone: Bool { entry.completed == entry.total && entry.total > 0 }
    private var noHabits: Bool { entry.total == 0 }
    private var hasStreak: Bool { entry.streak > 0 }

    var body: some View {
        ZStack {
            // Avatar peek — large, hugging the right edge
            Image(peekImageName(for: entry.avatar))
                .resizable()
                .scaledToFit()
                .frame(width: 240, height: 240)
                .offset(x: 70, y: 0)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)

            VStack(alignment: .leading, spacing: 0) {
                // Top: date + streak
                HStack(alignment: .center, spacing: 10) {
                    Text(entry.date, format: .dateTime.month(.abbreviated).day())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(Color.habbitCream.opacity(0.45))
                        .textCase(.uppercase)
                    HStack(spacing: 3) {
                        Image("StreakFire")
                            .resizable()
                            .scaledToFit()
                            .frame(height: 14)
                            .opacity(hasStreak ? 1 : 0.3)
                        Text("\(entry.streak)")
                            .font(.system(size: 14, weight: .black))
                            .foregroundColor(hasStreak ? .habbitCream : Color.habbitCream.opacity(0.4))
                            .lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }

                Spacer(minLength: 0)

                // Main: ring + message
                HStack(alignment: .center, spacing: 12) {
                    ZStack {
                        Circle()
                            .stroke(Color.habbitBar, lineWidth: 4)
                        Circle()
                            .trim(from: 0, to: habitPct)
                            .stroke(
                                allDone ? Color.habbitGreen : Color.habbitAccent,
                                style: StrokeStyle(lineWidth: 4, lineCap: .round)
                            )
                            .rotationEffect(.degrees(-90))

                        if allDone {
                            Image(systemName: "checkmark")
                                .font(.system(size: 22, weight: .heavy))
                                .foregroundColor(.habbitGreen)
                        } else if noHabits {
                            Text("—")
                                .font(.system(size: 22, weight: .black))
                                .foregroundColor(Color.habbitCream.opacity(0.5))
                        } else {
                            VStack(spacing: 0) {
                                Text("\(entry.completed)")
                                    .font(.system(size: 22, weight: .black))
                                    .foregroundColor(.habbitAccent)
                                    .lineLimit(1)
                                Text("of \(entry.total)")
                                    .font(.system(size: 9, weight: .bold))
                                    .foregroundColor(Color.habbitAccent.opacity(0.5))
                            }
                        }
                    }
                    .frame(width: 64, height: 64)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(noHabits ? "Add a habbit" :
                             allDone   ? "All done" : "Keep going")
                            .font(.system(size: 18, weight: .heavy))
                            .foregroundColor(allDone ? .habbitCream : .habbitAccent)
                            .lineLimit(1)
                        Text(noHabits ? "no habbits today" :
                             "\(entry.completed) habbit\(entry.completed == 1 ? "" : "s") done today")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(Color.habbitCream.opacity(0.45))
                            .lineLimit(1)
                    }
                }

                Spacer(minLength: 0)

                // Bottom: spent + budget
                HStack(spacing: 20) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("SPENT")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color.habbitCream.opacity(0.45))
                            .tracking(0.3)
                        HStack(spacing: 2) {
                            if entry.currency == "__carrot__" {
                                CarrotIcon(size: 12, color: isOver ? .habbitRed : .habbitAccent)
                            }
                            Text(formatAmount(entry.spent, currency: entry.currency))
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundColor(isOver ? .habbitRed : .habbitAccent)
                                .lineLimit(1)
                        }
                    }
                    VStack(alignment: .leading, spacing: 2) {
                        Text("BUDGET")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(Color.habbitCream.opacity(0.45))
                            .tracking(0.3)
                        HStack(spacing: 2) {
                            if entry.currency == "__carrot__" {
                                CarrotIcon(size: 12, color: .habbitAccent)
                            }
                            Text(formatAmount(entry.budget, currency: entry.currency))
                                .font(.system(size: 13, weight: .heavy))
                                .foregroundColor(.habbitAccent)
                                .lineLimit(1)
                        }
                    }
                }
                .padding(.bottom, 36)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .padding(14)
        }
        .containerBackground(Color.habbitBg, for: .widget)
    }
}

// MARK: - Lock Screen: Rectangular

struct RectangularLockScreenView: View {
    var entry: HabbitEntry

    var body: some View {
        HStack(spacing: 10) {
            Image("AppLogo-BW")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 28, height: 28)
                .widgetAccentable()

            VStack(alignment: .leading, spacing: 2) {
                Text("\(entry.completed)/\(entry.total) habbits")
                    .font(.system(size: 13, weight: .black))
                    .widgetAccentable()
                HStack(spacing: 2) {
                    if entry.currency == "__carrot__" {
                        CarrotIcon(size: 10, color: .primary)
                            .widgetAccentable()
                        Text("\(String(format: "%.0f", entry.spent)) spent")
                            .font(.system(size: 11))
                    } else {
                        Text("\(entry.currency)\(String(format: "%.0f", entry.spent)) spent")
                            .font(.system(size: 11))
                    }
                }
            }

            Spacer()

            Text("\(entry.streak)d")
                .font(.system(size: 12, weight: .bold))
        }
        .containerBackground(for: .widget) { }
    }
}

// MARK: - Lock Screen: Circular

struct CircularLockScreenView: View {
    var entry: HabbitEntry

    var body: some View {
        VStack(spacing: 2) {
            Image("AppLogo-BW")
                .resizable()
                .renderingMode(.template)
                .scaledToFit()
                .frame(width: 24, height: 24)
                .widgetAccentable()
            Text("\(entry.completed)/\(entry.total)")
                .font(.system(size: 11, weight: .black))
        }
        .containerBackground(for: .widget) { }
    }
}

// MARK: - Lock Screen: Inline

struct InlineLockScreenView: View {
    var entry: HabbitEntry

    var body: some View {
        Label {
            Text("\(entry.streak)d streak  •  \(entry.completed)/\(entry.total) habbits")
                .font(.system(size: 12, weight: .semibold))
        } icon: {
            Image("AppLogo-BW")
                .renderingMode(.template)
        }
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
        .description("Your daily habits and budget at a glance.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}
