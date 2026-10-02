// HabbitWidgetIntents.swift
//
// The buttons in the widgets, compiled into the app and the widget extension. They're
// LiveActivityIntents, which iOS runs in the app's process (starting it in the background
// if needed), so the app applies a check-off straight away and quiets that habit's
// reminders, as a tap in the app would.

import AppIntents

struct CheckOffWidgetIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Check Off a Habit from the Widget"
  // Only for the widget's buttons: Siri and Shortcuts have CheckOffHabitIntent.
  static var isDiscoverable = false

  @Parameter(title: "Habit ID")
  var habitId: String

  @Parameter(title: "Habit")
  var label: String

  init() {}

  init(habitId: String, label: String) {
    self.habitId = habitId
    self.label = label
  }

  func perform() async throws -> some IntentResult {
    _ = HabbitStore.checkOff(habitId: habitId, label: label)
    return .result()
  }
}
