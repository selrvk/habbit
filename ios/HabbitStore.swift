// HabbitStore.swift
//
// What Siri, Shortcuts and quick actions share with the app, in the App Group:
// - "widgetData": the app's latest snapshot of today (src/utils/syncWidget.ts). Intents
//   answer from it ("₱350 left today") and update it, so the widget and the next question
//   see a change before the app has run.
// - "inbox": what was done outside the app, for the app to apply (src/inbox.ts).
//
// Compiled into the app and the widget extension (no UIKit here).

import Foundation
import WidgetKit

enum HabbitStore {
  static let inboxChanged = Notification.Name("HabbitInboxChanged")
  /** Set by the app: refreshes its quick actions after an intent changes the snapshot. */
  static var snapshotDidChange: (() -> Void)?

  private static let group       = "group.com.selrvk.habbit"
  private static let inboxKey    = "inbox"
  private static let snapshotKey = "widgetData"
  // If the app isn't opened for a long time, keep the newest events only.
  private static let maxQueued   = 500
  private static let lock        = NSLock()
  private static var defaults: UserDefaults? { UserDefaults(suiteName: group) }

  // MARK: Snapshot

  struct Habit {
    let id: String
    let label: String
    /// Fixed days (0 = Sunday); empty means every day.
    let days: [Int]
    let perWeek: Int?
    let times: Int
    var count: Int
    var done: Bool
    var skipped: Bool
    /// "N× a week" habits: times done this week, today included.
    var week: Int

    /// On that day's list. "N× a week" habits never are: they can be done any day.
    func isScheduled(on dow: Int) -> Bool { perWeek == nil && (days.isEmpty || days.contains(dow)) }

    var json: [String: Any] {
      var h: [String: Any] = ["id": id, "label": label, "days": days, "times": times, "count": count, "done": done, "skipped": skipped, "week": week]
      if let perWeek { h["perWeek"] = perWeek }
      return h
    }
  }

  /** A coming day's allowance, worked out as if nothing more is spent today (src/widgetPayload.ts). */
  struct Upcoming { let date: String; let allowance: Double; let periodLeft: Double }

  struct Snapshot {
    var json: [String: Any]
    private func number(_ key: String) -> NSNumber? { json[key] as? NSNumber }

    /** The day the app wrote this for, "yyyy-MM-dd". */
    var date: String? { json["date"] as? String }
    var isToday: Bool { date == todayKey() }
    var name: String { json["name"] as? String ?? "Friend" }
    var avatar: String { json["avatar"] as? String ?? "avatar_bunny" }
    var streak: Int { number("streak")?.intValue ?? 0 }
    var currency: String { json["currency"] as? String ?? "₱" }
    var completedCount: Int { number("completedCount")?.intValue ?? 0 }
    var totalCount: Int { number("totalCount")?.intValue ?? 0 }
    /** Habits on each weekday (0 = Sunday). */
    var scheduledByDow: [Int] { (json["scheduledByDow"] as? [NSNumber])?.map(\.intValue) ?? [] }
    var spentToday: Double { number("spentToday")?.doubleValue ?? 0 }
    var allowance: Double { number("allocatedPerDay")?.doubleValue ?? 0 }
    /** "daily", "weekly" or "monthly". */
    var budgetPeriod: String { json["budgetPeriod"] as? String ?? "daily" }
    var periodLeft: Double { number("periodLeft")?.doubleValue ?? allowance - spentToday }
    var upcoming: [Upcoming] {
      (json["upcoming"] as? [[String: Any]] ?? []).compactMap { u in
        guard let date = u["date"] as? String else { return nil }
        return Upcoming(date: date,
                        allowance: (u["allowance"] as? NSNumber)?.doubleValue ?? 0,
                        periodLeft: (u["periodLeft"] as? NSNumber)?.doubleValue ?? 0)
      }
    }

    var habits: [Habit] {
      (json["habits"] as? [[String: Any]] ?? []).compactMap { h in
        guard let id = h["id"] as? String, let label = h["label"] as? String else { return nil }
        let int = { (key: String) in (h[key] as? NSNumber)?.intValue }
        return Habit(
          id: id, label: label,
          days: (h["days"] as? [NSNumber])?.map(\.intValue) ?? [],
          perWeek: int("perWeek"), times: max(1, int("times") ?? 1),
          count: int("count") ?? 0, done: h["done"] as? Bool ?? false,
          skipped: h["skipped"] as? Bool ?? false, week: int("week") ?? 0)
      }
    }

    /// Today's habits as the app counts them: scheduled today and not skipped.
    var todays: [Habit] {
      let dow = HabbitStore.weekday()
      return habits.filter { $0.isScheduled(on: dow) && !(isToday && $0.skipped) }
    }
  }

  static func snapshot() -> Snapshot {
    guard let raw = defaults?.string(forKey: snapshotKey),
          let json = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any]
    else { return Snapshot(json: [:]) }
    return Snapshot(json: json)
  }

  /// Changes today's snapshot (an older one is left for the app to replace) and reloads widgets.
  private static func updateSnapshot(_ change: (inout Snapshot) -> Void) {
    lock.lock()
    var snap = snapshot()
    guard snap.isToday else { lock.unlock(); return }
    change(&snap)
    if let data = try? JSONSerialization.data(withJSONObject: snap.json) {
      defaults?.set(String(decoding: data, as: UTF8.self), forKey: snapshotKey)
    }
    lock.unlock()
    WidgetCenter.shared.reloadAllTimelines()
    if let snapshotDidChange { DispatchQueue.main.async(execute: snapshotDidChange) }
  }

  // MARK: Inbox

  private static func queue(_ event: [String: Any]) {
    lock.lock()
    var list = (try? JSONSerialization.jsonObject(with: Data((defaults?.string(forKey: inboxKey) ?? "[]").utf8))) as? [[String: Any]] ?? []
    list.append(event)
    if list.count > maxQueued { list.removeFirst(list.count - maxQueued) }
    if let data = try? JSONSerialization.data(withJSONObject: list) {
      defaults?.set(String(decoding: data, as: UTF8.self), forKey: inboxKey)
    }
    lock.unlock()
    DispatchQueue.main.async { NotificationCenter.default.post(name: inboxChanged, object: nil) }
  }

  /// Hands the queued events (JSON) to the app and empties the queue.
  static func take() -> String {
    lock.lock(); defer { lock.unlock() }
    let raw = defaults?.string(forKey: inboxKey) ?? "[]"
    defaults?.removeObject(forKey: inboxKey)
    return raw
  }

  // MARK: Actions (each returns what Siri says)

  static func logSpending(amount: Double, category: String?, note: String?) -> String {
    var event: [String: Any] = ["id": newId(), "kind": "spend", "date": todayKey(), "time": timeLabel(), "amount": amount]
    if let category { event["category"] = category }
    let note = note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !note.isEmpty { event["note"] = String(note.prefix(60)) }
    queue(event)

    let snap   = snapshot()
    let what   = category.flatMap { $0 == "other" ? nil : " for \($0)" } ?? (note.isEmpty ? "" : " for \(note.prefix(60))")
    let logged = "Logged \(money(amount, snap.currency))\(what)."
    guard snap.isToday else { return logged }
    updateSnapshot { $0.json["spentToday"] = $0.spentToday + amount }
    let left = snap.allowance - (snap.spentToday + amount)
    return left >= 0
      ? "\(logged) \(money(left, snap.currency)) left today."
      : "\(logged) That’s \(money(-left, snap.currency)) over today’s budget."
  }

  static func checkOff(habitId: String, label: String) -> String {
    let snap = snapshot()
    let dow  = weekday()
    guard let habit = snap.habits.first(where: { $0.id == habitId }) else {
      // Not in the snapshot yet (the app hasn't written one): the app decides.
      queue(["id": newId(), "kind": "habit", "date": todayKey(), "habitId": habitId])
      return "Checked off \(label)."
    }
    if habit.perWeek == nil && !habit.isScheduled(on: dow) { return "\(habit.label) isn’t on for today." }
    if snap.isToday && habit.done {
      if let goal = habit.perWeek { return "\(habit.label)’s already done today. That’s \(habit.week) of \(goal) this week." }
      return "\(habit.label)’s already done today."
    }
    queue(["id": newId(), "kind": "habit", "date": todayKey(), "habitId": habit.id])
    guard snap.isToday else { return habit.times > 1 ? "Counted one \(habit.label)." : "Nice, \(habit.label)’s done!" }

    var updated = habit
    updated.count   = habit.times > 1 ? habit.count + 1 : habit.count
    updated.done    = habit.times == 1 || updated.count >= habit.times
    updated.skipped = false
    if updated.done && habit.perWeek != nil { updated.week += 1 }

    var reply = ""
    updateSnapshot { s in
      let wasAllDone = !s.todays.isEmpty && s.todays.allSatisfy(\.done)
      s.json["habits"] = s.habits.map { ($0.id == updated.id ? updated : $0).json }
      let todays = s.todays
      s.json["completedCount"] = todays.filter(\.done).count
      s.json["totalCount"]     = todays.count
      s.json["upcomingHabbit"] = todays.first(where: { !$0.done })?.label ?? ""
      // Finishing the day adds to the streak, as the app will when it sees this.
      if !wasAllDone && !todays.isEmpty && todays.allSatisfy(\.done) {
        s.json["streak"] = ((s.json["streak"] as? NSNumber)?.intValue ?? 0) + 1
      }
      let left = todays.filter { !$0.done }.count
      if !updated.done {
        reply = "\(habit.label): \(updated.count) of \(habit.times) today."
      } else if let goal = habit.perWeek {
        reply = "Nice, \(habit.label)’s done! That’s \(updated.week) of \(goal) this week."
      } else {
        reply = left == 0 ? "Nice, \(habit.label)’s done! That’s everything for today 🎉" : "Nice, \(habit.label)’s done! \(left) more to go today."
      }
    }
    return reply.isEmpty ? "Nice, \(habit.label)’s done!" : reply
  }

  static func budgetLeft() -> String {
    let snap = snapshot()
    let spent = snap.isToday ? snap.spentToday : 0
    let left  = snap.allowance - spent
    if left < 0 { return "You’re \(money(-left, snap.currency)) over today’s budget." }
    return spent > 0
      ? "You have \(money(left, snap.currency)) left to spend today, after \(money(spent, snap.currency)) so far."
      : "You have \(money(left, snap.currency)) to spend today."
  }

  static func todaySummary() -> String {
    let snap   = snapshot()
    let todays = snap.todays
    let done   = snap.isToday ? todays.filter(\.done) : []
    let toGo   = todays.filter { !snap.isToday || !$0.done }
    let habits: String
    if todays.isEmpty {
      habits = "No habits on today."
    } else if toGo.isEmpty {
      habits = "All \(todays.count) habits done 🎉"
    } else {
      habits = "\(done.count) of \(todays.count) habits done. Still to go: \(listed(toGo.map(\.label)))."
    }
    return "\(habits) \(budgetLeft())"
  }

  // MARK: Formatting

  private static let dayFormatter: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f
  }()

  private static let timeFormatter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "h:mm a"
    return f
  }()

  static func todayKey() -> String { dayFormatter.string(from: Date()) }
  static func dayKey(_ date: Date) -> String { dayFormatter.string(from: date) }
  /// 0 = Sunday, as in the app.
  static func weekday() -> Int { Calendar.current.component(.weekday, from: Date()) - 1 }
  /// "9:05 PM", like the app's formatTime.
  private static func timeLabel() -> String { timeFormatter.string(from: Date()) }

  /// An id like the app's generateId: milliseconds, then 4 random characters.
  private static func newId() -> String {
    let chars = Array("abcdefghijklmnopqrstuvwxyz0123456789")
    return "\(Int64(Date().timeIntervalSince1970 * 1000))" + String((0..<4).map { _ in chars.randomElement()! })
  }

  static func money(_ amount: Double, _ currency: String) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale(identifier: "en_US")
    f.minimumFractionDigits = amount == amount.rounded() ? 0 : 2
    f.maximumFractionDigits = 2
    let n = f.string(from: NSNumber(value: amount)) ?? String(amount)
    return currency == "__carrot__" ? "🥕 \(n)" : "\(currency)\(n)"
  }

  /// "Read", "Read and Gym", "Read, Gym and Water", "Read, Gym, Water and 2 more".
  private static func listed(_ names: [String]) -> String {
    switch names.count {
    case 0: return ""
    case 1: return names[0]
    case 2...3: return names.dropLast().joined(separator: ", ") + " and " + names.last!
    default: return names.prefix(3).joined(separator: ", ") + " and \(names.count - 3) more"
    }
  }
}
