// BudgetWidget.swift
//
// What's left to spend today, on its own. Tapping it opens the app's expense pad.

import WidgetKit
import SwiftUI

struct BudgetWidgetView: View {
    var entry: HabbitEntry

    private var spentShare: CGFloat {
        entry.allowance > 0 ? min(CGFloat(entry.spent / entry.allowance), 1) : (entry.spent > 0 ? 1 : 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(entry.isOver ? "Over today" : "Left today")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(Color.habbitCream.opacity(0.5))
            Amount(value: abs(entry.left), currency: entry.currency, size: 28, color: entry.isOver ? .habbitRed : .habbitAccent)
                .padding(.top, 2)

            // Today's spending against today's allowance.
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.habbitBar)
                    Capsule().fill(entry.isOver ? Color.habbitRed : Color.habbitAccent).frame(width: geo.size.width * spentShare)
                }
            }
            .frame(height: 6)
            .padding(.top, 8)

            Text(entry.periodNoun.map { "\(plainAmount(max(entry.periodLeft, 0), currency: entry.currency)) left \($0)" }
                 ?? "\(plainAmount(entry.spent, currency: entry.currency)) spent so far")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(Color.habbitCream.opacity(0.5))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .padding(.top, 6)

            Spacer(minLength: 0)

            Text("+ Log expense")
                .font(.system(size: 12, weight: .heavy))
                .foregroundColor(.habbitBg)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background(Capsule().fill(Color.habbitAccent))
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(todayLine(entry)). Tap to log an expense.")
        .widgetURL(URL(string: "habbit://spend")!)
        .containerBackground(Color.habbitBg, for: .widget)
    }
}

struct BudgetWidget: Widget {
    let kind = "HabbitBudget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            BudgetWidgetView(entry: entry)
        }
        .configurationDisplayName("Budget")
        .description("What's left to spend today. Tap to log an expense.")
        .supportedFamilies([.systemSmall])
    }
}
