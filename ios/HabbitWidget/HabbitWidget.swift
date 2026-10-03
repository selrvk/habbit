// HabbitWidget.swift
//
// The Habbit widget: today's Habbits and what's left to spend, on the Home Screen (small,
// medium) and the Lock Screen. It reads the app's snapshot of today (HabbitStore); one from
// an earlier day (the app hasn't been opened yet today) is shown as a fresh day.

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
    /** From the widget's settings (WidgetLook.swift). */
    var look = WidgetLook()

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

/**
 * Entries for now and for midnight, which flips the widget to a fresh day even if the app
 * isn't opened, refreshed every 15 minutes.
 */
func habbitTimeline<Entry: TimelineEntry>(_ entry: (Date) -> Entry) -> Timeline<Entry> {
    let now = Date()
    let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: now)!
    return Timeline(entries: [entry(now), entry(midnight)], policy: .after(nextUpdate))
}

/** The Habbit widget's: the day's summary, in the look from its settings. */
struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> HabbitEntry { .placeholder }

    func snapshot(for config: HabbitWidgetConfig, in context: Context) async -> HabbitEntry {
        (context.isPreview && HabbitStore.snapshot().date == nil ? .placeholder : HabbitEntry.load(at: Date()))
            .with(.resolved(config.theme, showAvatar: config.showAvatar))
    }

    func timeline(for config: HabbitWidgetConfig, in context: Context) async -> Timeline<HabbitEntry> {
        let look = WidgetLook.resolved(config.theme, showAvatar: config.showAvatar)
        return habbitTimeline { HabbitEntry.load(at: $0).with(look) }
    }
}

/** The Budget widget's: the same summary, with just a look. */
struct BudgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> HabbitEntry { .placeholder }

    func snapshot(for config: WidgetLookConfig, in context: Context) async -> HabbitEntry {
        (context.isPreview && HabbitStore.snapshot().date == nil ? .placeholder : HabbitEntry.load(at: Date()))
            .with(.resolved(config.theme))
    }

    func timeline(for config: WidgetLookConfig, in context: Context) async -> Timeline<HabbitEntry> {
        let look = WidgetLook.resolved(config.theme)
        return habbitTimeline { HabbitEntry.load(at: $0).with(look) }
    }
}

extension HabbitEntry {
    /** From the app's snapshot, already moved on to `date` (HabbitStore.Snapshot.freshened). */
    init(snapshot s: HabbitStore.Snapshot, date: Date) {
        self.init(
            date: date, completed: s.completedCount, total: s.totalCount, hasHabits: !s.habits.isEmpty || s.totalCount > 0,
            spent: s.spentToday, allowance: s.allowance, period: s.budgetPeriod, periodLeft: s.periodLeft,
            currency: s.currency, streak: s.streak, avatar: s.avatar)
    }

    /** The app's snapshot as of `date`. */
    static func load(at date: Date) -> HabbitEntry {
        HabbitEntry(snapshot: HabbitStore.snapshot().freshened(at: date), date: date)
    }

    func with(_ look: WidgetLook) -> HabbitEntry {
        var entry = self
        entry.look = look
        return entry
    }
}

// MARK: - Helpers

func peekImageName(for avatar: String) -> String {
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
func peekOffsetX(for avatar: String, base: CGFloat) -> CGFloat {
    switch avatar {
    case "avatar_panda":   return base + 20  // wide — peek less
    case "avatar_bear":    return base + 8
    case "avatar_hamster": return base + 16
    case "avatar_fox":     return base - 4
    default:               return base + 12  // bunny — peek slightly more than before
    }
}

// Per-avatar size tweak for the small widget peek.
func peekSize(for avatar: String, base: CGFloat) -> CGFloat {
    return base - 14
}

/** "₱120", "₱1.5k", "₱2m"; no symbol for the carrot currency (shown as an icon). */
func formatAmount(_ value: Double, currency: String) -> String {
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
func plainAmount(_ value: Double, currency: String) -> String {
    currency == "__carrot__" ? "🥕\(formatAmount(value, currency: currency))" : formatAmount(value, currency: currency)
}

/** "₱120 left today" or "₱97 over today". */
func todayLine(_ entry: HabbitEntry) -> String {
    "\(plainAmount(abs(entry.left), currency: entry.currency)) \(entry.isOver ? "over" : "left") today"
}

// Inline carrot icon used when the user's currency is the carrot PNG.
struct CarrotIcon: View {
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
struct Amount: View {
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
struct HabitRing: View {
    @Environment(\.habbit) private var c
    let entry: HabbitEntry
    let size: CGFloat
    let line: CGFloat
    let font: CGFloat
    var showTotal = false
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        ZStack {
            Circle().stroke(c.track(mode), lineWidth: line)
            Circle()
                .trim(from: 0, to: entry.habitShare)
                .stroke(entry.allDone ? c.green : c.accent, style: StrokeStyle(lineWidth: line, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .widgetAccentable()
            if entry.allDone {
                Image(systemName: "checkmark").font(.system(size: font, weight: .heavy)).foregroundColor(c.green).widgetAccentable()
            } else if entry.total == 0 {
                if entry.hasHabits && mode.isAccented {
                    Image(systemName: "moon.zzz.fill").font(.system(size: font * 0.8, weight: .bold)).foregroundStyle(HabbitMuted(0.6))
                } else {
                    Text(entry.hasHabits ? "😴" : "+").font(.system(size: font, weight: .black)).foregroundStyle(HabbitMuted(0.6))
                }
            } else {
                VStack(spacing: 0) {
                    Text("\(entry.completed)").font(.system(size: font, weight: .black)).foregroundColor(c.accent).lineLimit(1)
                    if showTotal {
                        Text("of \(entry.total)").font(.system(size: 9, weight: .bold)).foregroundColor(c.accent.opacity(0.5))
                    }
                }
                .widgetAccentable()
            }
        }
        .frame(width: size, height: size)
    }
}

struct StreakBadge: View {
    @Environment(\.habbit) private var c
    let streak: Int
    let size: CGFloat
    var body: some View {
        HStack(spacing: 3) {
            // A cream silhouette: drawn in the look's text colour, so it shows on Cream too.
            Image("StreakFire").renderingMode(.template).resizable().scaledToFit().frame(height: size)
                .foregroundStyle(c.text).opacity(streak > 0 ? 1 : 0.3)
            Text("\(streak)")
                .font(.system(size: size - 1, weight: .black))
                .foregroundColor(streak > 0 ? c.text : c.text.opacity(0.4))
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

// MARK: - Tinted and clear Home Screens
//
// There the system drops the widget's background and draws everything in one colour, keeping
// only transparency: a solid shape hides what's drawn on it, and pictures turn into
// silhouettes. So fills behind text and progress tracks go faint, the avatar is greyscale,
// and .widgetAccentable() marks what takes the tint (progress, amounts, the Log button).

extension WidgetRenderingMode {
    var isAccented: Bool { self == .accented }
}

/** Secondary text: faint, but stronger on tinted and clear Home Screens, where it sits on glass. */
struct HabbitMuted: ShapeStyle {
    var opacity: Double

    init(_ opacity: Double) { self.opacity = opacity }

    func resolve(in environment: EnvironmentValues) -> Color {
        environment.habbit.text.opacity(environment.widgetRenderingMode.isAccented ? max(opacity, 0.7) : opacity)
    }
}

/** The avatar peeking in: greyscale on tinted and clear Home Screens. */
func peekImage(for avatar: String) -> some View {
    Image(peekImageName(for: avatar)).resizable().widgetAccentedRenderingMode(.desaturated)
}

/** "+ Log": an accent pill, or a faint one with light text on tinted and clear Home Screens. */
struct LogPill: View {
    @Environment(\.habbit) private var c
    let title: String
    let size: CGFloat
    var horizontal: CGFloat = 9
    var vertical: CGFloat = 5
    var fullWidth = false
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        Text(title)
            .font(.system(size: size, weight: .heavy))
            .foregroundColor(mode.isAccented ? c.text : c.onAccent)
            .frame(maxWidth: fullWidth ? .infinity : nil)
            .padding(.horizontal, horizontal)
            .padding(.vertical, vertical)
            .background(Capsule().fill(c.accent.opacity(mode.isAccented ? 0.25 : 1)))
            .widgetAccentable()
    }
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
    @Environment(\.habbit) private var c
    var entry: HabbitEntry

    var body: some View {
        ZStack {
            // Avatar peek — rotated left 90°, hugging the right edge
            if entry.look.showAvatar {
                peekImage(for: entry.avatar)
                    .scaledToFit()
                    .frame(width: peekSize(for: entry.avatar, base: 140), height: peekSize(for: entry.avatar, base: 140))
                    .rotationEffect(.degrees(-90), anchor: .center)
                    .offset(x: peekOffsetX(for: entry.avatar, base: 30), y: 10)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            }

            VStack(alignment: .leading, spacing: 0) {
                // Top: date + streak
                HStack(alignment: .center, spacing: 0) {
                    Text(entry.date, format: .dateTime.month(.abbreviated).day())
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(HabbitMuted(0.45))
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
                            .foregroundColor(entry.allDone ? c.text : c.accent)
                            .lineLimit(1)
                            .widgetAccentable()
                        Text(entry.subtitle)
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(HabbitMuted(0.45))
                            .lineLimit(1)
                    }
                }
                .frame(maxWidth: 96, alignment: .leading)

                Spacer(minLength: 0)

                // Bottom: what's left to spend today
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.isOver ? "Over today" : "Left today")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(HabbitMuted(0.45))
                    Amount(value: abs(entry.left), currency: entry.currency, size: 17, color: entry.isOver ? c.red : c.accent)
                        .widgetAccentable()
                }
                .frame(maxWidth: 100, alignment: .leading)
                .padding(.top, 8)
            }
            .padding(.leading, 6)
            .padding(.trailing, 10)
            .padding(.vertical, 2)
        }
        .widgetURL(entry.url)
        .containerBackground(c.bg, for: .widget)
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    @Environment(\.habbit) private var c
    var entry: HabbitEntry

    private func column(_ label: String, _ value: Double, _ color: Color, suffix: String? = nil, accent: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(HabbitMuted(0.45))
                .tracking(0.3)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Amount(value: value, currency: entry.currency, size: 13, color: color).widgetAccentable(accent)
                if let suffix {
                    Text(suffix).font(.system(size: 10, weight: .semibold)).foregroundStyle(HabbitMuted(0.45))
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
                    .foregroundStyle(HabbitMuted(0.45))
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
                        .foregroundColor(entry.allDone ? c.text : c.accent)
                        .lineLimit(1)
                        .widgetAccentable()
                    Text(entry.subtitle)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(HabbitMuted(0.45))
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            // Bottom: today's money, then the week's (or month's) or what's been spent
            HStack(alignment: .bottom, spacing: 18) {
                column(entry.isOver ? "OVER TODAY" : "LEFT TODAY", abs(entry.left), entry.isOver ? c.red : c.accent, accent: true)
                if let noun = entry.periodNoun {
                    column(noun.uppercased(), max(entry.periodLeft, 0), c.text, suffix: "left")
                } else {
                    column("SPENT", entry.spent, c.text)
                }
                Link(destination: URL(string: "habbit://spend")!) {
                    LogPill(title: "+ Log", size: 11)
                }
                .accessibilityLabel("Log an expense")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
        // Avatar peek — large, hugging the right edge. A background, so its size can't
        // stretch the layout past the widget (it used to push the top and bottom rows out).
        .background(alignment: .trailing) {
            if entry.look.showAvatar {
                peekImage(for: entry.avatar)
                    .scaledToFit()
                    .frame(width: 240, height: 240)
                    .offset(x: 70, y: 0)
            }
        }
        .widgetURL(entry.url)
        .containerBackground(c.bg, for: .widget)
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
        AppIntentConfiguration(kind: kind, intent: HabbitWidgetConfig.self, provider: Provider()) { entry in
            HabbitWidgetView(entry: entry).habbitLook(entry.look)
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
