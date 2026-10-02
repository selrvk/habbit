// HabitsWidget.swift
//
// "Today's Habbits": a checkbox for each of today's Habbits, checked off without opening the
// app (CheckOffWidgetIntent). The large size adds the week so far and what's left to spend.

import WidgetKit
import SwiftUI
import AppIntents

struct HabitsEntry: TimelineEntry {
    struct Row: Identifiable {
        let id: String
        let label: String
        let done: Bool
        let count: Int
        let times: Int
        /** "N× a week" habits: the goal and how many this week. */
        let goal: Int?
        let week: Int
    }

    let date: Date
    let summary: HabbitEntry
    /** Today's Habbits, unfinished first. */
    let rows: [Row]
    let week: [HabbitStore.Day]

    static let placeholder = HabitsEntry(
        date: Date(), summary: .placeholder,
        rows: [
            Row(id: "1", label: "Read 20 pages", done: false, count: 0, times: 1, goal: nil, week: 0),
            Row(id: "2", label: "Drink water", done: false, count: 3, times: 8, goal: nil, week: 0),
            Row(id: "3", label: "Gym", done: false, count: 0, times: 1, goal: 3, week: 1),
            Row(id: "4", label: "Meditate", done: true, count: 0, times: 1, goal: nil, week: 0),
        ],
        week: [])
}

struct HabitsProvider: TimelineProvider {
    func placeholder(in context: Context) -> HabitsEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (HabitsEntry) -> Void) {
        completion(context.isPreview && HabbitStore.snapshot().date == nil ? .placeholder : load(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HabitsEntry>) -> Void) {
        let now = Date()
        let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: now)!
        completion(Timeline(entries: [load(at: now), load(at: midnight)], policy: .after(nextUpdate)))
    }

    private func load(at date: Date) -> HabitsEntry {
        let s   = HabbitStore.snapshot().freshened(at: date)
        let dow = HabbitStore.weekday(of: HabbitStore.dayKey(date))
        // The day's Habbits (skipped ones aside), then "N× a week" ones still to do this week.
        let rows = s.habits.compactMap { h -> HabitsEntry.Row? in
            let row = HabitsEntry.Row(id: h.id, label: h.label, done: h.done, count: h.count, times: h.times, goal: h.perWeek, week: h.week)
            if let goal = h.perWeek { return h.done || h.week < goal ? row : nil }
            return h.isScheduled(on: dow) && !h.skipped ? row : nil
        }
        return HabitsEntry(
            date: date, summary: HabbitEntry(snapshot: s, date: date),
            rows: rows.filter { !$0.done } + rows.filter(\.done), week: s.week)
    }
}

// MARK: - Pieces

/** One Habbit: tapping an unfinished one checks it off (one step for "3× a day" ones). */
private struct HabitRowView: View {
    let row: HabitsEntry.Row
    var compact = false
    @Environment(\.widgetRenderingMode) private var mode

    private var detail: String? {
        if row.times > 1 { return "\(row.count)/\(row.times)" }
        if let goal = row.goal { return "\(row.week)/\(goal) wk" }
        return nil
    }

    private var content: some View {
        HStack(spacing: 7) {
            Image(systemName: row.done ? "checkmark.circle.fill" : "circle")
                .font(.system(size: compact ? 17 : 19, weight: .semibold))
                .foregroundColor(row.done ? .habbitGreen : .habbitAccent)
                .widgetAccentable(!row.done)
            Text(row.label)
                .font(.system(size: compact ? 12 : 14, weight: .bold))
                .foregroundColor(row.done ? Color.habbitCream.opacity(0.45) : .habbitCream)
                .strikethrough(row.done, color: Color.habbitCream.opacity(0.45))
                .lineLimit(1)
            Spacer(minLength: 2)
            if let detail {
                Text(detail)
                    .font(.system(size: compact ? 10 : 11, weight: .heavy))
                    .foregroundColor(Color.habbitAccent.opacity(row.done ? 0.5 : 0.9))
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, compact ? 5 : 7)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.habbitCardFill(mode)))
    }

    var body: some View {
        if row.done {
            content.accessibilityLabel("\(row.label), done")
        } else {
            Button(intent: CheckOffWidgetIntent(habitId: row.id, label: row.label)) { content }
                .buttonStyle(.plain)
                .accessibilityLabel("Check off \(row.label)")
        }
    }
}

/** Shown instead of the list when there's nothing to tick. */
private struct EmptyHabits: View {
    let summary: HabbitEntry
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        VStack(spacing: 4) {
            // Emoji would be blobs on tinted and clear Home Screens: symbols there.
            if mode.isAccented {
                Image(systemName: !summary.hasHabits ? "plus.circle" : summary.total == 0 ? "moon.zzz.fill" : "party.popper.fill")
                    .font(.system(size: 24, weight: .semibold)).foregroundColor(.habbitAccent).widgetAccentable()
            } else {
                Text(!summary.hasHabits ? "🐣" : summary.total == 0 ? "😴" : "🎉").font(.system(size: 26))
            }
            Text(!summary.hasHabits ? "No Habbits yet" : summary.total == 0 ? "Rest day" : "All done for today")
                .font(.system(size: 14, weight: .heavy)).foregroundColor(.habbitCream)
            Text(!summary.hasHabits ? "Tap to add your first one" : summary.total == 0 ? "Nothing on today" : mode.isAccented ? "Nice work" : "Nice work 🐰")
                .font(.system(size: 11, weight: .semibold)).foregroundStyle(HabbitMuted(0.5))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct HabitsHeader: View {
    let entry: HabitsEntry
    var hidden = 0

    var body: some View {
        HStack(spacing: 8) {
            Text("Today's Habbits").font(.system(size: 13, weight: .heavy)).foregroundColor(.habbitAccent).widgetAccentable()
            if entry.summary.total > 0 {
                Text("\(entry.summary.completed)/\(entry.summary.total)")
                    .font(.system(size: 12, weight: .heavy))
                    .foregroundColor(entry.summary.allDone ? .habbitGreen : Color.habbitCream.opacity(0.6))
            }
            if hidden > 0 {
                Text("+\(hidden) more").font(.system(size: 10, weight: .semibold)).foregroundStyle(HabbitMuted(0.4))
            }
            Spacer(minLength: 0)
            StreakBadge(streak: entry.summary.streak, size: 13)
        }
    }
}

// MARK: - Medium: up to six, in two columns

private struct HabitsMediumView: View {
    let entry: HabitsEntry
    private let maxRows = 6

    var body: some View {
        let shown = Array(entry.rows.prefix(maxRows))
        VStack(alignment: .leading, spacing: 8) {
            HabitsHeader(entry: entry, hidden: entry.rows.count - shown.count)
            if shown.isEmpty {
                EmptyHabits(summary: entry.summary)
            } else if shown.count <= 3 {
                VStack(spacing: 5) { ForEach(shown) { HabitRowView(row: $0) } }
                Spacer(minLength: 0)
            } else {
                let half = (shown.count + 1) / 2
                HStack(alignment: .top, spacing: 6) {
                    VStack(spacing: 5) { ForEach(shown.prefix(half)) { HabitRowView(row: $0, compact: true) } }
                    VStack(spacing: 5) { ForEach(shown.dropFirst(half)) { HabitRowView(row: $0, compact: true) } }
                }
                Spacer(minLength: 0)
            }
        }
    }
}

// MARK: - Large: the list, the week, and money

private struct WeekStrip: View {
    let days: [HabbitStore.Day]
    private let letters = ["M", "T", "W", "T", "F", "S", "S"]
    @Environment(\.widgetRenderingMode) private var mode

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(days.prefix(7).enumerated()), id: \.offset) { i, day in
                VStack(spacing: 4) {
                    Text(letters[i]).font(.system(size: 10, weight: .bold)).foregroundStyle(HabbitMuted(0.45))
                    ZStack {
                        // On tinted and clear Home Screens only transparency tells days apart.
                        switch day.state {
                        case "done":
                            Circle().fill(Color.habbitGreen.opacity(mode.isAccented ? 0.5 : 1)).widgetAccentable()
                            Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy))
                                .foregroundColor(mode.isAccented ? .habbitCream : .habbitBg)
                        case "missed":
                            Circle().fill(Color.habbitRed.opacity(mode.isAccented ? 0.25 : 0.35))
                        case "today":
                            Circle().stroke(Color.habbitAccent, lineWidth: 2).widgetAccentable()
                        case "rest":
                            Circle().fill(mode.isAccented ? Color.clear : Color.habbitBar)
                            Text("–").font(.system(size: 10, weight: .bold)).foregroundStyle(HabbitMuted(0.4))
                        default:
                            Circle().stroke(Color.habbitTrack(mode), lineWidth: 1.5)
                        }
                    }
                    .frame(width: 22, height: 22)
                }
                .frame(maxWidth: .infinity)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("\(letters[i]): \(day.state)")
            }
        }
    }
}

private struct HabitsLargeView: View {
    let entry: HabitsEntry
    private let maxRows = 6

    var body: some View {
        let s = entry.summary
        let shown = Array(entry.rows.prefix(maxRows))
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                HabitRing(entry: s, size: 38, line: 3, font: 14)
                VStack(alignment: .leading, spacing: 1) {
                    Text(s.title).font(.system(size: 16, weight: .heavy)).foregroundColor(s.allDone ? .habbitCream : .habbitAccent).widgetAccentable()
                    Text(s.subtitle).font(.system(size: 11, weight: .semibold)).foregroundStyle(HabbitMuted(0.5))
                }
                Spacer(minLength: 0)
                StreakBadge(streak: s.streak, size: 15)
            }

            if shown.isEmpty {
                EmptyHabits(summary: s).frame(maxHeight: 150)
            } else {
                VStack(spacing: 5) { ForEach(shown) { HabitRowView(row: $0) } }
                if entry.rows.count > shown.count {
                    Text("+\(entry.rows.count - shown.count) more in the app")
                        .font(.system(size: 10, weight: .semibold)).foregroundStyle(HabbitMuted(0.4))
                }
            }

            Spacer(minLength: 0)

            if entry.week.count == 7 {
                WeekStrip(days: entry.week)
            }

            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(s.isOver ? "OVER TODAY" : "LEFT TODAY").font(.system(size: 9, weight: .bold)).foregroundStyle(HabbitMuted(0.45))
                    Amount(value: abs(s.left), currency: s.currency, size: 15, color: s.isOver ? .habbitRed : .habbitAccent).widgetAccentable()
                }
                if let noun = s.periodNoun {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(noun.uppercased()).font(.system(size: 9, weight: .bold)).foregroundStyle(HabbitMuted(0.45))
                        HStack(alignment: .firstTextBaseline, spacing: 3) {
                            Amount(value: max(s.periodLeft, 0), currency: s.currency, size: 15, color: .habbitCream)
                            Text("left").font(.system(size: 10, weight: .semibold)).foregroundStyle(HabbitMuted(0.45))
                        }
                    }
                }
                Spacer(minLength: 0)
                Link(destination: URL(string: "habbit://spend")!) {
                    LogPill(title: "+ Log", size: 12, horizontal: 10, vertical: 6)
                }
                .accessibilityLabel("Log an expense")
            }
        }
    }
}

struct HabitsWidgetView: View {
    var entry: HabitsEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            if family == .systemLarge { HabitsLargeView(entry: entry) } else { HabitsMediumView(entry: entry) }
        }
        .widgetURL(entry.summary.url)
        .containerBackground(Color.habbitBg, for: .widget)
    }
}

struct HabitsWidget: Widget {
    let kind = "HabbitHabits"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HabitsProvider()) { entry in
            HabitsWidgetView(entry: entry)
        }
        .configurationDisplayName("Today's Habbits")
        .description("Check off your Habbits right from the Home Screen.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}
