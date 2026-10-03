// HabbitStore.swift
//
// What Siri, Shortcuts and quick actions share with the app, in the App Group:
// - "widgetData": the app's latest snapshot of today (src/utils/syncWidget.ts). Intents
//   answer from it ("₱350 left today") and update it, so the widget and the next question
//   see a change before the app has run.
// - "inbox": what was done outside the app, for the app to apply (src/inbox.ts).
// - "pendingLink": a screen for the app to open, left by an intent that opens the app
//   (src/links.ts).
// - "isPro": whether the widgets may use the Pro looks.
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
  private static let linkKey     = "pendingLink"
  private static let proKey      = "isPro"
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

  /** A day of this week (Monday to Sunday): "done", "missed", "rest", "today" or "future". */
  struct Day {
    let date: String
    let state: String
    let spent: Double
    var json: [String: Any] { ["date": date, "state": state, "spent": spent] }
  }

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

    var week: [Day] {
      (json["week"] as? [[String: Any]] ?? []).compactMap { d in
        guard let date = d["date"] as? String, let state = d["state"] as? String else { return nil }
        return Day(date: date, state: state, spent: (d["spent"] as? NSNumber)?.doubleValue ?? 0)
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

    /// The day's habits as the app counts them: scheduled that day and not skipped.
    var todays: [Habit] {
      let dow = date.map(HabbitStore.weekday(of:)) ?? HabbitStore.weekday()
      return habits.filter { $0.isScheduled(on: dow) && !$0.skipped }
    }

    /**
     * The snapshot as `day` starts, when it was written on an earlier day (the app hasn't
     * been opened since): nothing done or spent, the allowance the app worked out for that
     * day, "N× a week" counts reset on a new week, and the week strip moved on. The streak
     * breaks if the old day was left unfinished or Habbits were on in between, as the app
     * will decide when it opens. A snapshot from that day comes back unchanged.
     */
    func freshened(at day: Date = Date()) -> Snapshot {
      let key = HabbitStore.dayKey(day)
      guard let old = date, old < key else { return self }
      let byDow   = scheduledByDow.count == 7 ? scheduledByDow : Array(repeating: 0, count: 7)
      let hadOn   = { (k: String) in byDow[HabbitStore.weekday(of: k)] > 0 }
      let monday  = HabbitStore.mondayKey(key)
      let newWeek = HabbitStore.mondayKey(old) != monday
      var s = self

      var broken = totalCount > 0 && completedCount < totalCount
      var k = HabbitStore.addDays(old, 1)
      for _ in 0..<31 where k < key { if hadOn(k) { broken = true }; k = HabbitStore.addDays(k, 1) }
      if broken { s.json["streak"] = 0 }

      let dow = HabbitStore.weekday(of: key)
      let fresh = habits.map { h -> Habit in
        var h = h; h.done = false; h.count = 0; h.skipped = false
        if newWeek { h.week = 0 }
        return h
      }
      s.json["date"]           = key
      s.json["habits"]         = fresh.map(\.json)
      s.json["completedCount"] = 0
      s.json["totalCount"]     = byDow[dow]
      s.json["upcomingHabbit"] = fresh.first(where: { $0.isScheduled(on: dow) })?.label ?? ""
      s.json["spentToday"]     = 0
      if let next = upcoming.first(where: { $0.date == key }) ?? upcoming.last {
        s.json["allocatedPerDay"] = next.allowance
        s.json["periodLeft"]      = next.periodLeft
      }

      // The old day is finished now; days the app never saw count as missed if Habbits were on.
      let oldState = totalCount == 0 ? "rest" : completedCount >= totalCount ? "done" : "missed"
      let unseen = { (k: String) in hadOn(k) ? "missed" : "rest" }
      let days: [Day] = newWeek || week.first?.date != monday
        ? (0..<7).map { i in
            let d = HabbitStore.addDays(monday, i)
            return Day(date: d, state: d < key ? unseen(d) : d == key ? "today" : "future", spent: 0)
          }
        : week.map { d in
            d.date == key ? Day(date: d.date, state: "today", spent: 0)
            : d.date == old ? Day(date: d.date, state: oldState, spent: d.spent)
            : d.date < key && d.state == "future" ? Day(date: d.date, state: unseen(d.date), spent: 0)
            : d
          }
      s.json["week"] = days.map(\.json)
      return s
    }
  }

  static func snapshot() -> Snapshot {
    guard let raw = defaults?.string(forKey: snapshotKey),
          let json = try? JSONSerialization.jsonObject(with: Data(raw.utf8)) as? [String: Any]
    else { return Snapshot(json: [:]) }
    return Snapshot(json: json)
  }

  /// Changes the snapshot (moved on to today first, if it's older) and reloads widgets.
  private static func updateSnapshot(_ change: (inout Snapshot) -> Void) {
    lock.lock()
    var snap = snapshot().freshened()
    guard snap.date != nil else { lock.unlock(); return } // the app hasn't written one yet
    change(&snap)
    if let data = try? JSONSerialization.data(withJSONObject: snap.json) {
      defaults?.set(String(decoding: data, as: UTF8.self), forKey: snapshotKey)
    }
    lock.unlock()
    WidgetCenter.shared.reloadAllTimelines()
    ControlCenter.shared.reloadAllControls()
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

  /// Whether the user has Pro, as the app last saw it (WidgetReloader.setPro): the widgets'
  /// Pro looks need it.
  static func isPro() -> Bool { defaults?.bool(forKey: proKey) ?? false }

  // MARK: Links

  /// Leaves a habbit:// link for the app to open as it comes up. Intents that open the app
  /// can run in the widget extension (Control Center), so it goes through the App Group.
  static func leaveLink(_ url: URL) {
    defaults?.set(["url": url.absoluteString, "at": Date().timeIntervalSince1970], forKey: linkKey)
    DispatchQueue.main.async { NotificationCenter.default.post(name: inboxChanged, object: nil) }
  }

  /// The link left by leaveLink, emptying it. One left over a minute ago (the app didn't
  /// open, say the phone stayed locked) is dropped rather than opened out of the blue later.
  static func takeLink() -> String? {
    guard let left = defaults?.dictionary(forKey: linkKey) else { return nil }
    defaults?.removeObject(forKey: linkKey)
    let at = (left["at"] as? NSNumber)?.doubleValue ?? 0
    return Date().timeIntervalSince1970 - at < 60 ? left["url"] as? String : nil
  }

  // MARK: Actions (each returns what Siri says)

  static func logSpending(amount: Double, category: String?, note: String?) -> String {
    var event: [String: Any] = ["id": newId(), "kind": "spend", "date": todayKey(), "time": timeLabel(), "amount": amount]
    if let category { event["category"] = category }
    let note = note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if !note.isEmpty { event["note"] = String(note.prefix(60)) }
    queue(event)

    let snap   = snapshot().freshened()
    let what   = category.flatMap { $0 == "other" ? nil : " for \($0)" } ?? (note.isEmpty ? "" : " for \(note.prefix(60))")
    let logged = "Logged \(money(amount, snap.currency))\(what)."
    guard snap.date != nil else { return logged }
    updateSnapshot { s in
      s.json["spentToday"] = s.spentToday + amount
      s.json["periodLeft"] = s.periodLeft - amount
      s.json["week"] = s.week.map { $0.state == "today" ? Day(date: $0.date, state: $0.state, spent: $0.spent + amount).json : $0.json }
    }
    let left = snap.allowance - (snap.spentToday + amount)
    return left >= 0
      ? "\(logged) \(money(left, snap.currency)) left today."
      : "\(logged) That’s \(money(-left, snap.currency)) over today’s budget."
  }

  static func checkOff(habitId: String, label: String) -> String {
    let snap = snapshot().freshened()
    let dow  = weekday()
    guard let habit = snap.habits.first(where: { $0.id == habitId }) else {
      // Not in the snapshot yet (the app hasn't written one): the app decides.
      queue(["id": newId(), "kind": "habit", "date": todayKey(), "habitId": habitId])
      return "Checked off \(label)."
    }
    if habit.perWeek == nil && !habit.isScheduled(on: dow) { return "\(habit.label) isn’t on for today." }
    if habit.done {
      if let goal = habit.perWeek { return "\(habit.label)’s already done today. That’s \(habit.week) of \(goal) this week." }
      return "\(habit.label)’s already done today."
    }
    queue(["id": newId(), "kind": "habit", "date": todayKey(), "habitId": habit.id])

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
    let snap = snapshot().freshened()
    let spent = snap.spentToday
    let left  = snap.allowance - spent
    if left < 0 { return "You’re \(money(-left, snap.currency)) over today’s budget." }
    return spent > 0
      ? "You have \(money(left, snap.currency)) left to spend today, after \(money(spent, snap.currency)) so far."
      : "You have \(money(left, snap.currency)) to spend today."
  }

  static func todaySummary() -> String {
    let snap   = snapshot().freshened()
    let todays = snap.todays
    let done   = todays.filter(\.done)
    let toGo   = todays.filter { !$0.done }
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
  static func weekday(of key: String) -> Int {
    dayFormatter.date(from: key).map { Calendar.current.component(.weekday, from: $0) - 1 } ?? weekday()
  }
  static func addDays(_ key: String, _ n: Int) -> String {
    guard let d = dayFormatter.date(from: key), let moved = Calendar.current.date(byAdding: .day, value: n, to: d) else { return key }
    return dayKey(moved)
  }
  /// The Monday of that day's week (weeks run Monday to Sunday, as in the app).
  static func mondayKey(_ key: String) -> String { addDays(key, -((weekday(of: key) + 6) % 7)) }
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
