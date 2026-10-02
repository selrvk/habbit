// HabbitWidgetIntents.swift
//
// Intents for the widgets' and controls' buttons, compiled into the app and the widget
// extension. The check-off is a LiveActivityIntent, which iOS runs in the app's process
// (starting it in the background if needed), so the app applies it straight away and
// quiets that habit's reminders, as a tap in the app would.

import AppIntents
import Foundation

// MARK: - Opening a screen

enum HabbitScreen: String, AppEnum {
  case today, habits, logExpense, addHabit, money, bonbon

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Screen"
  static var caseDisplayRepresentations: [HabbitScreen: DisplayRepresentation] = [
    .today: "Today", .habits: "Habits", .logExpense: "Log Expense",
    .addHabit: "Add Habit", .money: "Money", .bonbon: "Bonbon",
  ]

  /// The app's link for the screen (src/links.ts).
  var url: URL {
    switch self {
    case .today:      return URL(string: "habbit://home")!
    case .habits:     return URL(string: "habbit://habits")!
    case .logExpense: return URL(string: "habbit://spend")!
    case .addHabit:   return URL(string: "habbit://habits/new")!
    case .money:      return URL(string: "habbit://finance")!
    case .bonbon:     return URL(string: "habbit://coach")!
    }
  }
}

/// The Log Expense control's button. Hidden from Shortcuts, which has OpenHabbitIntent: this
/// one is also in the widget extension, where controls need it.
struct OpenScreenIntent: AppIntent {
  static var title: LocalizedStringResource = "Open a Screen in Habbit"
  static var isDiscoverable = false
  // Opens the app, which then takes the link (OpenURLIntent won't open a custom scheme).
  static var openAppWhenRun = true

  @Parameter(title: "Screen")
  var screen: HabbitScreen

  init() {}

  init(screen: HabbitScreen) {
    self.screen = screen
  }

  func perform() async throws -> some IntentResult {
    HabbitStore.leaveLink(screen.url)
    return .result()
  }
}

// MARK: - Checking off

struct CheckOffWidgetIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Check Off a Habit from the Widget"
  // Only for the widget's and control's buttons: Siri and Shortcuts have CheckOffHabitIntent.
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
    // The Next Habbit control with everything done.
    guard !habitId.isEmpty else { return .result() }
    _ = HabbitStore.checkOff(habitId: habitId, label: label)
    return .result()
  }
}
