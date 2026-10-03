// BudgetWidget.swift
//
// What's left to spend today, on its own. Tapping it opens the app's expense pad.

import WidgetKit
import SwiftUI

struct BudgetWidgetView: View {
    @Environment(\.habbit) private var c
    var entry: HabbitEntry
    @Environment(\.widgetRenderingMode) private var mode

    private var spentShare: CGFloat {
        entry.allowance > 0 ? min(CGFloat(entry.spent / entry.allowance), 1) : (entry.spent > 0 ? 1 : 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(entry.isOver ? "Over today" : "Left today")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(HabbitMuted(0.5))
            Amount(value: abs(entry.left), currency: entry.currency, size: 28, color: entry.isOver ? c.red : c.accent)
                .widgetAccentable()
                .padding(.top, 2)

            // Today's spending against today's allowance.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(c.track(mode))
                    Capsule().fill(entry.isOver ? c.red : c.accent).frame(width: geo.size.width * spentShare)
                        .widgetAccentable()
                }
            }
            .frame(height: 6)
            .padding(.top, 8)

            Text(entry.periodNoun.map { "\(plainAmount(max(entry.periodLeft, 0), currency: entry.currency)) left \($0)" }
                 ?? "\(plainAmount(entry.spent, currency: entry.currency)) spent so far")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(HabbitMuted(0.5))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.top, 6)

            Spacer(minLength: 0)

            LogPill(title: "+ Log expense", size: 12, horizontal: 0, vertical: 7, fullWidth: true)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(todayLine(entry)). Tap to log an expense.")
        .widgetURL(URL(string: "habbit://spend")!)
        .containerBackground(c.bg, for: .widget)
    }
}

struct BudgetWidget: Widget {
    let kind = "HabbitBudget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: WidgetLookConfig.self, provider: BudgetProvider()) { entry in
            BudgetWidgetView(entry: entry).habbitLook(entry.look)
        }
        .configurationDisplayName("Budget")
        .description("What's left to spend today. Tap to log an expense.")
        .supportedFamilies([.systemSmall])
    }
}
