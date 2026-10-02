// HabbitControls.swift
//
// Controls for Control Center, the Lock Screen and the Action button: "Log Expense" opens the
// expense pad; "Next Habbit" checks off the next of today's Habbits without opening the app.

import AppIntents
import SwiftUI
import WidgetKit

struct LogExpenseControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "HabbitLogExpenseControl") {
            ControlWidgetButton(action: OpenScreenIntent(screen: .logExpense)) {
                Label("Log Expense", systemImage: "creditcard")
            }
            .tint(.habbitAccent)
        }
        .displayName("Log Expense")
        .description("Opens Habbit’s expense pad.")
    }
}

struct NextHabitControl: ControlWidget {
    /** Today's next unfinished Habbit, or nil when they're all done (or none are on). */
    struct Next {
        let id: String
        let label: String
        let progress: String
    }

    struct Provider: ControlValueProvider {
        var previewValue: Next? { Next(id: "", label: "Drink water", progress: "3 of 8 today") }

        func currentValue() async throws -> Next? {
            let snap = HabbitStore.snapshot().freshened()
            guard snap.date != nil, let h = snap.todays.first(where: { !$0.done }) else { return nil }
            return Next(id: h.id, label: h.label, progress: h.times > 1 ? "\(h.count) of \(h.times) today" : "Next Habbit")
        }
    }

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "HabbitNextHabitControl", provider: Provider()) { next in
            // With nothing left, the button does nothing (CheckOffWidgetIntent skips an empty id).
            ControlWidgetButton(action: CheckOffWidgetIntent(habitId: next?.id ?? "", label: next?.label ?? "")) {
                if let next {
                    Label(next.label, systemImage: "checkmark.circle")
                    Text(next.progress)
                } else {
                    Label("All done", systemImage: "checkmark.circle.fill")
                    Text("Nothing left")
                }
            }
            .tint(.habbitAccent)
        }
        .displayName("Next Habbit")
        .description("Checks off your next Habbit for today, without opening the app.")
    }
}
