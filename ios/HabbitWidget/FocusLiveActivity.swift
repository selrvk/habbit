// FocusLiveActivity.swift
//
// The focus timer's Live Activity (FocusActivity.swift): the countdown on the Lock Screen and
// in the Dynamic Island, with a pause button. The countdowns run by themselves. The session
// moves from round to break to round on its own, but the activity only changes when the app
// updates it or when it goes stale, so it can follow one switch without the app: once the
// phase it was given runs out, it shows the one that follows. After that it waits at 0:00
// until the app next runs (opening it, or tapping one of the notifications each switch sends).

import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

/** What to show, from the activity's state and whether its block has run out. */
private struct FocusDisplay {
  let kicker: String
  /// Shorter, for the Dynamic Island.
  let short: String
  let title: String
  /// The countdown's range, or nil for a fixed time (paused) or none (done).
  let range: ClosedRange<Date>?
  let fixedLeft: Double?
  let color: Color
  let canPause: Bool
  let paused: Bool

  /// When the whole session wraps up, while more than the phase shown is still to come.
  let sessionEnds: Date?

  init(_ context: ActivityViewContext<FocusActivityAttributes>) {
    let s = context.state
    title = context.attributes.label
    paused = s.paused
    // Stale: the phase the app last gave has run out, so show the one after it.
    let shown: FocusActivityAttributes.ContentState? = context.isStale ? s.following : s
    guard !s.done, let p = shown else {
      kicker = "All done 🎉"; short = "Done 🎉"; range = nil; fixedLeft = nil; color = .habbitGreen; canPause = false
      sessionEnds = nil
      return
    }
    let round = p.blocks > 1 ? "Round \(p.block) of \(p.blocks)" : "Focus"
    if p.phase == "focus" {
      kicker = p.paused ? "Paused" : round
      short = p.paused ? "Paused" : p.blocks > 1 ? "Round \(p.block)/\(p.blocks)" : "Focus"
      range = p.paused ? nil : p.startedAt...p.endsAt
      fixedLeft = p.pausedLeft
      color = .habbitAccent
    } else {
      kicker = "\(p.onLongBreak ? "Long break" : "Break") · \(p.block) of \(p.blocks) done"
      short = "Break"
      range = p.startedAt...p.endsAt
      fixedLeft = nil
      color = .habbitGreen
    }
    // The button works on the phase the app knows about, so not once the activity has moved on.
    canPause = p.phase == "focus" && !context.isStale
    sessionEnds = !p.paused && p.following != nil ? p.sessionEndsAt : nil
  }
}

/** "12:34" counting down, or fixed while paused. */
private struct Countdown: View {
  let display: FocusDisplay
  var size: CGFloat
  var body: some View {
    Group {
      if let range = display.range {
        Text(timerInterval: range, countsDown: true)
      } else if let left = display.fixedLeft {
        Text(Duration.seconds(left.rounded(.up)).formatted(.time(pattern: left >= 3600 ? .hourMinuteSecond : .minuteSecond)))
      } else {
        Text("✓")
      }
    }
    .font(.system(size: size, weight: .heavy, design: .rounded))
    .monospacedDigit()
    .foregroundStyle(display.paused ? Color.habbitCream.opacity(0.5) : Color.habbitCream)
  }
}

private struct PauseButton: View {
  let display: FocusDisplay
  var size: CGFloat = 44
  var body: some View {
    Button(intent: FocusPauseIntent(pause: !display.paused)) {
      Image(systemName: display.paused ? "play.fill" : "pause.fill")
        .font(.system(size: size * 0.4, weight: .bold))
        .foregroundStyle(Color.habbitBg)
        .frame(width: size, height: size)
        .background(Circle().fill(Color.habbitAccent))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(display.paused ? "Resume" : "Pause")
  }
}

private struct ProgressBar: View {
  let display: FocusDisplay
  let state: FocusActivityAttributes.ContentState
  var body: some View {
    Group {
      if let range = display.range {
        ProgressView(timerInterval: range, countsDown: false) { EmptyView() } currentValueLabel: { EmptyView() }
      } else {
        let total = Double(state.minutes) * 60
        ProgressView(value: display.fixedLeft.map { total > 0 ? 1 - $0 / total : 1 } ?? 1)
      }
    }
    .progressViewStyle(.linear)
    .tint(display.color)
  }
}

private struct FocusLockScreen: View {
  let context: ActivityViewContext<FocusActivityAttributes>
  var body: some View {
    let d = FocusDisplay(context)
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text(d.kicker.uppercased())
            .font(.system(size: 11, weight: .bold)).tracking(0.8)
            .foregroundStyle(d.color)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
          Text(d.title)
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(Color.habbitCream)
            .lineLimit(1)
        }
        Spacer(minLength: 8)
        Countdown(display: d, size: 34)
        if d.canPause { PauseButton(display: d) }
      }
      ProgressBar(display: d, state: context.state)
      if let ends = d.sessionEnds {
        Text("All rounds wrap up at \(ends.formatted(date: .omitted, time: .shortened))")
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(Color.habbitCream.opacity(0.55))
          .lineLimit(1)
      }
    }
    .padding(16)
  }
}

struct FocusLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FocusActivityAttributes.self) { context in
      FocusLockScreen(context: context)
        .activityBackgroundTint(Color.habbitBg)
        .activitySystemActionForegroundColor(Color.habbitCream)
        .widgetURL(URL(string: "habbit://focus"))
    } dynamicIsland: { context in
      let d = FocusDisplay(context)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(d.short).font(.system(size: 12, weight: .bold)).foregroundStyle(d.color).lineLimit(1)
            Text(d.title).font(.system(size: 15, weight: .bold)).foregroundStyle(Color.habbitCream).lineLimit(1)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Countdown(display: d, size: 28).padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack(spacing: 12) {
            ProgressBar(display: d, state: context.state)
            if d.canPause { PauseButton(display: d, size: 36) }
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: d.paused ? "pause.fill" : "timer").foregroundStyle(d.color)
      } compactTrailing: {
        Countdown(display: d, size: 14)
          .frame(maxWidth: 46)
          .multilineTextAlignment(.trailing)
      } minimal: {
        Image(systemName: d.paused ? "pause.fill" : "timer").foregroundStyle(d.color)
      }
      .widgetURL(URL(string: "habbit://focus"))
      .keylineTint(d.color)
    }
  }
}
