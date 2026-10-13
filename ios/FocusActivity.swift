// FocusActivity.swift
//
// The focus timer as a Live Activity: its countdown on the Lock Screen and in the Dynamic
// Island (drawn by HabbitWidget/FocusLiveActivity.swift). The app keeps it in step with its
// own timer (src/utils/focusActivity.ts → FocusActivityController.sync). A session runs on
// by itself from round to break to round (src/focus.ts), and the activity can follow only
// one switch without the app (see FocusLiveActivity.swift), so `following` here mirrors
// focus.ts. The pause button runs in the app's process: it updates the activity straight
// away and tells the app through the inbox, so the app's timer pauses too. Compiled into
// the app and the widget extension. ("block" in names is a round.)

import ActivityKit
import AppIntents
import Foundation
import UserNotifications

struct FocusActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /// "focus" or "break".
    var phase: String
    var block: Int
    var blocks: Int
    var minutes: Int
    var breakMinutes: Int
    /// A longer break after every fourth round (nil or 0: the usual break).
    var longBreakMinutes: Int?
    /// When the phase started (as if never paused, for the progress bar) and ends.
    var startedAt: Date
    var endsAt: Date
    /// Seconds left, while paused.
    var pausedLeft: Double?
    /// The day's last block is done.
    var done: Bool

    var paused: Bool { pausedLeft != nil }

    /// Minutes of break after round `block`: none after the last, the long one after every fourth.
    static func restMinutes(after block: Int, of blocks: Int, breakMinutes: Int, longBreakMinutes: Int?) -> Int {
      if block >= blocks { return 0 }
      if let long = longBreakMinutes, long > 0, block % 4 == 0 { return long }
      return breakMinutes
    }
    var restMinutes: Int {
      Self.restMinutes(after: block, of: blocks, breakMinutes: breakMinutes, longBreakMinutes: longBreakMinutes)
    }
    var onLongBreak: Bool { phase == "break" && (longBreakMinutes ?? 0) > 0 && block % 4 == 0 }

    /// What follows this phase, starting when it ends: a round's break (or the next round
    /// when there's no break), a break's next round, or nil after the last round.
    var following: ContentState? {
      var next = self
      next.pausedLeft = nil
      next.startedAt = endsAt
      if phase == "focus" {
        if block >= blocks { return nil }
        if restMinutes > 0 {
          next.phase = "break"
          next.endsAt = endsAt.addingTimeInterval(Double(restMinutes) * 60)
          return next
        }
      }
      next.phase = "focus"
      next.block = block + 1
      next.endsAt = endsAt.addingTimeInterval(Double(minutes) * 60)
      return next
    }

    /// When the whole session ends if it runs on from here.
    var sessionEndsAt: Date {
      var end = endsAt
      var phase = following
      while let next = phase { end = next.endsAt; phase = next.following }
      return end
    }
  }

  var habitId: String
  var label: String
}

@objc(FocusActivityController)
final class FocusActivityController: NSObject {
  private static let lastRequestKey = "focusActivitySession"

  /**
   * From the app (main thread): the running session as JSON ({ session, done }), or "" when
   * there's none. Starts a Live Activity for a new block, updates it as the timer moves on,
   * and ends it when the timer stops.
   */
  @objc static func sync(_ json: String) {
    Task { await apply(json) }
  }

  private static func apply(_ json: String) async {
    let current = Activity<FocusActivityAttributes>.activities
    guard let data = json.data(using: .utf8),
          let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let s = payload["session"] as? [String: Any],
          let habitId = s["habitId"] as? String, let label = s["label"] as? String,
          let sessionId = s["id"] as? String, let state = contentState(s, done: payload["done"] as? Bool ?? false)
    else {
      for activity in current { await activity.end(nil, dismissalPolicy: .immediate) }
      return
    }

    let content = ActivityContent(state: state, staleDate: state.done || state.paused ? nil : state.endsAt)
    for activity in current where activity.attributes.habitId != habitId {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    if let activity = current.first(where: { $0.attributes.habitId == habitId }) {
      if state.done {
        await activity.end(content, dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
      } else {
        await activity.update(content)
      }
      return
    }
    // None for this habit: start one for a new block, but not again for a block whose
    // activity was swiped away.
    let defaults = UserDefaults.standard
    guard !state.done, defaults.string(forKey: lastRequestKey) != sessionId,
          ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    defaults.set(sessionId, forKey: lastRequestKey)
    _ = try? Activity.request(attributes: FocusActivityAttributes(habitId: habitId, label: label), content: content)
  }

  /// focus.ts's FocusSession → the activity's state.
  private static func contentState(_ s: [String: Any], done: Bool) -> FocusActivityAttributes.ContentState? {
    guard let phase = s["phase"] as? String, let endsAtMs = (s["endsAt"] as? NSNumber)?.doubleValue else { return nil }
    let minutes      = (s["minutes"] as? NSNumber)?.intValue ?? 25
    let breakMinutes = (s["breakMinutes"] as? NSNumber)?.intValue ?? 0
    let longBreak    = (s["longBreakMinutes"] as? NSNumber)?.intValue
    let block        = (s["block"] as? NSNumber)?.intValue ?? 1
    let blocks       = (s["blocks"] as? NSNumber)?.intValue ?? 1
    let rest         = FocusActivityAttributes.ContentState.restMinutes(after: block, of: blocks, breakMinutes: breakMinutes, longBreakMinutes: longBreak)
    let length       = Double(phase == "break" ? rest : minutes) * 60
    let pausedLeft   = (s["pausedLeft"] as? NSNumber).map { $0.doubleValue / 1000 }
    // While paused, endsAt is when it would have ended: what's left from now.
    let endsAt = pausedLeft.map { Date().addingTimeInterval($0) } ?? Date(timeIntervalSince1970: endsAtMs / 1000)
    return .init(
      phase: phase, block: block, blocks: blocks,
      minutes: minutes, breakMinutes: breakMinutes, longBreakMinutes: longBreak,
      startedAt: endsAt.addingTimeInterval(-length), endsAt: endsAt,
      pausedLeft: pausedLeft, done: done)
  }

  /// The pause button: pauses or resumes the activity straight away. Returns what it resumed.
  @discardableResult
  static func setPaused(_ pause: Bool, at now: Date) async -> (label: String, state: FocusActivityAttributes.ContentState)? {
    var resumed: (label: String, state: FocusActivityAttributes.ContentState)?
    for activity in Activity<FocusActivityAttributes>.activities {
      var state = activity.content.state
      guard state.phase == "focus", !state.done, state.paused != pause else { continue }
      // The block has run out: it's done, not paused (the app counts it).
      if pause && state.endsAt <= now { continue }
      if pause {
        state.pausedLeft = max(0, state.endsAt.timeIntervalSince(now))
      } else if let left = state.pausedLeft {
        state.endsAt = now.addingTimeInterval(left)
        state.startedAt = state.endsAt.addingTimeInterval(-Double(state.minutes) * 60)
        state.pausedLeft = nil
      }
      await activity.update(ActivityContent(state: state, staleDate: state.paused ? nil : state.endsAt))
      if !pause { resumed = (activity.attributes.label, state) }
    }
    return resumed
  }

  // MARK: Notifications
  // The same ones notifications.ts plans (ids "focus-0" up, one for each switch still ahead:
  // focus.ts's upcomingTransitions and transitionText), for when the button resumes the
  // timer: the app may be suspended again before it can plan them. Built the way notifee
  // builds them, so tapping one still opens the timer.

  /// How many switches are planned ahead (FOCUS_NOTIFS in notifications.ts).
  static let plannedNotifications = 10
  /// Every id a session's notifications can have ("focus-end" and "focus-break" are older).
  static var notificationIds: [String] { (0..<plannedNotifications).map { "focus-\($0)" } + ["focus-end", "focus-break"] }

  static func scheduleNotifications(label: String, state: FocusActivityAttributes.ContentState) {
    var phase: FocusActivityAttributes.ContentState? = state
    var index = 0
    while let s = phase, index < plannedNotifications {
      let title: String, body: String
      if s.phase == "break" {
        title = "Break’s over 🐰"
        body = "\(label): round \(s.block + 1) of \(s.blocks) starts now."
      } else if s.block >= s.blocks {
        title = s.blocks > 1 ? "All \(s.blocks) rounds done 🎉" : "Focus round done 🥕"
        body = "\(label) is done for today. Great focus!"
      } else {
        title = "Round \(s.block) of \(s.blocks) done 🥕"
        body = s.restMinutes > 0 ? "\(label): enjoy a \(s.restMinutes)-minute break." : "\(label): round \(s.block + 1) starts now."
      }
      schedule(id: "focus-\(index)", title: title, body: body, at: s.endsAt)
      index += 1
      phase = s.following
    }
  }

  private static func schedule(id: String, title: String, body: String, at date: Date) {
    let wait = date.timeIntervalSinceNow
    guard wait > 1 else { return }
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    let link = "habbit://focus"
    content.userInfo = [
      "link": link,
      "__notifee_notification": [
        "id": id, "title": title, "body": body, "data": ["link": link],
        // notifee's defaults: shown even while the app is open.
        "ios": ["foregroundPresentationOptions": ["alert": true, "badge": true, "sound": true, "banner": true, "list": true]],
      ] as [String: Any],
    ]
    let request = UNNotificationRequest(identifier: id, content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: wait, repeats: false))
    UNUserNotificationCenter.current().add(request)
  }
}

/// The Live Activity's pause / resume button.
struct FocusPauseIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause or Resume the Focus Timer"
  static var isDiscoverable = false

  @Parameter(title: "Pause")
  var pause: Bool

  init() {}

  init(pause: Bool) {
    self.pause = pause
  }

  func perform() async throws -> some IntentResult {
    let now = Date()
    let resumed = await FocusActivityController.setPaused(pause, at: now)
    // A paused round mustn't announce that it's done; a resumed one needs its notifications
    // again (notifications.ts plans the same ones when the app gets to run).
    if pause {
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: FocusActivityController.notificationIds)
    } else if let resumed {
      FocusActivityController.scheduleNotifications(label: resumed.label, state: resumed.state)
    }
    HabbitStore.queueFocus(action: pause ? "pause" : "resume", at: now)
    return .result()
  }
}
