// HabbitIntents.swift
//
// Siri and Shortcuts: log an expense, check off a habit and ask how the day is going,
// without opening the app (HabbitStore queues the change and answers), plus "Open Habbit"
// to a screen. Also the home-screen quick actions.

import AppIntents
import UIKit

// MARK: - Spending

/// The app's spending categories (src/categories.ts).
enum SpendingCategory: String, AppEnum {
  case food, transport, shopping, fun, bills, health, other

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Category"
  static var caseDisplayRepresentations: [SpendingCategory: DisplayRepresentation] = [
    .food: "Food", .transport: "Transport", .shopping: "Shopping", .fun: "Fun",
    .bills: "Bills", .health: "Health", .other: "Other",
  ]
}

struct LogExpenseIntent: AppIntent {
  static var title: LocalizedStringResource = "Log an Expense"
  static var description = IntentDescription("Adds spending to today in Habbit, without opening the app.")

  @Parameter(title: "Amount", requestValueDialog: "How much did you spend?")
  var amount: Double

  @Parameter(title: "Category")
  var category: SpendingCategory?

  @Parameter(title: "Note")
  var note: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Log \(\.$amount) for \(\.$category)") { \.$note }
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let value = (amount * 100).rounded() / 100
    guard value > 0, value < 100_000_000 else { throw $amount.needsValueError("How much did you spend?") }
    return .result(dialog: "\(HabbitStore.logSpending(amount: value, category: category?.rawValue, note: note))")
  }
}

struct BudgetLeftIntent: AppIntent {
  static var title: LocalizedStringResource = "Budget Left Today"
  static var description = IntentDescription("Tells you how much you can still spend today.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    .result(dialog: "\(HabbitStore.budgetLeft())")
  }
}

// MARK: - Habits

struct HabitEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Habit"
  static var defaultQuery = HabitQuery()

  let id: String
  let label: String

  var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(label)") }
}

struct HabitQuery: EntityStringQuery {
  private func all() -> [HabitEntity] {
    HabbitStore.snapshot().habits.map { HabitEntity(id: $0.id, label: $0.label) }
  }

  func entities(for identifiers: [String]) async throws -> [HabitEntity] {
    all().filter { identifiers.contains($0.id) }
  }

  func entities(matching string: String) async throws -> [HabitEntity] {
    let query = string.lowercased()
    return all().filter { $0.label.lowercased().contains(query) }
  }

  func suggestedEntities() async throws -> [HabitEntity] { all() }
}

struct CheckOffHabitIntent: AppIntent {
  static var title: LocalizedStringResource = "Check Off a Habit"
  static var description = IntentDescription("Marks a habit done for today in Habbit, without opening the app.")

  @Parameter(title: "Habit", requestValueDialog: "Which habit?")
  var habit: HabitEntity

  static var parameterSummary: some ParameterSummary { Summary("Check off \(\.$habit)") }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    .result(dialog: "\(HabbitStore.checkOff(habitId: habit.id, label: habit.label))")
  }
}

struct TodayIntent: AppIntent {
  static var title: LocalizedStringResource = "How’s My Day"
  static var description = IntentDescription("Tells you which habits are left today and how much you can still spend.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    .result(dialog: "\(HabbitStore.todaySummary())")
  }
}

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

struct OpenHabbitIntent: AppIntent {
  static var title: LocalizedStringResource = "Open Habbit"
  static var description = IntentDescription("Opens Habbit to a screen, like the expense pad.")
  // Opens the app, which then takes the link (OpenURLIntent won't open a custom scheme).
  static var openAppWhenRun = true

  @Parameter(title: "Screen", default: .today)
  var screen: HabbitScreen

  static var parameterSummary: some ParameterSummary { Summary("Open \(\.$screen) in Habbit") }

  @MainActor
  func perform() async throws -> some IntentResult {
    HabbitLinkStore.open(screen.url)
    return .result()
  }
}

// MARK: - Siri phrases

struct HabbitShortcuts: AppShortcutsProvider {
  static var shortcutTileColor: ShortcutTileColor = .orange

  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: LogExpenseIntent(), phrases: [
      "Log an expense in \(.applicationName)",
      "Log spending in \(.applicationName)",
      "Add an expense in \(.applicationName)",
      "Log \(\.$category) in \(.applicationName)",
      "Log a \(\.$category) expense in \(.applicationName)",
    ], shortTitle: "Log Expense", systemImageName: "creditcard")

    // Siri asks which habit. A phrase per habit ("Check off \(\.$habit)") was tried: Shortcuts
    // and Spotlight merged them into one entry that showed one habit and checked off another.
    AppShortcut(intent: CheckOffHabitIntent(), phrases: [
      "Check off a habit in \(.applicationName)",
      "Mark a habit done in \(.applicationName)",
    ], shortTitle: "Check Off Habit", systemImageName: "checkmark.circle")

    AppShortcut(intent: TodayIntent(), phrases: [
      "How’s my day in \(.applicationName)",
      "What’s left today in \(.applicationName)",
    ], shortTitle: "How’s My Day", systemImageName: "sun.max")

    AppShortcut(intent: BudgetLeftIntent(), phrases: [
      "How much can I spend in \(.applicationName)",
      "How much money is left in \(.applicationName)",
      "What’s my budget in \(.applicationName)",
    ], shortTitle: "Budget Left", systemImageName: "banknote")

    AppShortcut(intent: OpenHabbitIntent(), phrases: [
      "Open \(\.$screen) in \(.applicationName)",
    ], shortTitle: "Open Habbit", systemImageName: "arrow.up.forward.app")
  }
}

// MARK: - Quick actions

/// Home-screen quick actions: the static ones in Info.plist open a link; the dynamic one
/// checks off today's next habit.
enum QuickActions {
  private static let checkOffType = "com.selrvk.habbit.checkoff"

  /// Does the action's part and returns the link to open.
  static func handle(_ item: UIApplicationShortcutItem) -> URL? {
    if item.type == checkOffType, let id = item.userInfo?["habitId"] as? String {
      _ = HabbitStore.checkOff(habitId: id, label: item.localizedTitle)
      return URL(string: "habbit://home")
    }
    return (item.userInfo?["url"] as? String).flatMap(URL.init(string:))
  }

  static func update(from snap: HabbitStore.Snapshot) {
    let next = snap.date != nil ? snap.todays.first(where: { !$0.done }) : nil
    let items = next.map {
      [UIApplicationShortcutItem(
        type: checkOffType, localizedTitle: $0.label, localizedSubtitle: "Check off",
        icon: UIApplicationShortcutIcon(systemImageName: "checkmark.circle"),
        userInfo: ["habitId": $0.id as NSString])]
    } ?? []
    let current = UIApplication.shared.shortcutItems ?? []
    if current.map(\.localizedTitle) != items.map(\.localizedTitle)
        || current.map({ $0.userInfo?["habitId"] as? String }) != items.map({ $0.userInfo?["habitId"] as? String }) {
      UIApplication.shared.shortcutItems = items
    }
  }
}

/// Called when the snapshot changes (from the app via WidgetReloader, or from an intent):
/// refreshes the "check off" quick action.
@objc(HabbitShortcutsHelper)
final class HabbitShortcutsHelper: NSObject {
  /// Main thread only (quick actions are UIKit).
  @objc static func snapshotChanged() {
    QuickActions.update(from: HabbitStore.snapshot().freshened())
  }
}

/// A link for the app to open, left by an intent that opened the app. The app may still be
/// starting, so it takes the link when it's ready (or straight away, told by "changed").
/// Main thread only.
@objc(HabbitLinkStore)
final class HabbitLinkStore: NSObject {
  private static var pending: String?

  static func open(_ url: URL) {
    pending = url.absoluteString
    NotificationCenter.default.post(name: HabbitStore.inboxChanged, object: nil)
  }

  @objc static func take() -> String? {
    defer { pending = nil }
    return pending
  }
}

/// The queue for the HabbitInbox native module (HabbitInbox.m).
@objc(HabbitInboxStore)
final class HabbitInboxStore: NSObject {
  @objc static func take() -> String { HabbitStore.take() }
}
