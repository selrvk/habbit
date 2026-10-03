// FocusLiveActivity.swift
//
// The focus timer's Live Activity (FocusActivity.swift): the countdown on the Lock Screen and
// in the Dynamic Island, with a pause button. The countdowns run by themselves; once a block
// runs out (the activity goes stale) it shows the break that follows, until the app catches up.

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

  init(_ context: ActivityViewContext<FocusActivityAttributes>) {
    let s = context.state
    let label = context.attributes.label
    let of = s.blocks > 1 ? " \(s.block) of \(s.blocks)" : ""
    paused = s.paused
    let finished = s.done || (context.isStale && s.phase == "focus" && s.block >= s.blocks)
    short = finished ? "Done 🎉" : s.paused ? "Paused" : s.phase == "break" || context.isStale ? "Break" : s.blocks > 1 ? "Block \(s.block)/\(s.blocks)" : "Focus"
    if finished {
      kicker = "All done 🎉"; title = label; range = nil; fixedLeft = nil; color = .habbitGreen; canPause = false
    } else if s.phase == "focus" && !context.isStale {
      kicker = s.paused ? "Paused" : s.blocks > 1 ? "Block\(of)" : "Focus"
      title = label; range = s.paused ? nil : s.startedAt...s.endsAt; fixedLeft = s.pausedLeft
      color = .habbitAccent; canPause = true
    } else if s.phase == "focus", let breakEnds = s.breakEndsAt {
      kicker = "Break · \(s.block) of \(s.blocks) done"; title = label; range = s.endsAt...breakEnds; fixedLeft = nil
      color = .habbitGreen; canPause = false
    } else if s.phase == "break" && !context.isStale {
      kicker = "Break · \(s.block) of \(s.blocks) done"; title = label; range = s.startedAt...s.endsAt; fixedLeft = nil
      color = .habbitGreen; canPause = false
    } else {
      kicker = s.phase == "break" ? "Break’s over" : "Block\(of) done"; title = "Ready for the next block?"
      range = nil; fixedLeft = 0; color = .habbitGreen; canPause = false
    }
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
