// WidgetLook.swift
//
// How a widget looks, from its settings (hold it → Edit Widget): Cocoa (the dark default),
// or with Pro, Cream (light) or Match iPhone (Cream in Light Mode, Cocoa in Dark Mode). The
// Habbit widget can also hide the avatar. Views take their colours from the palette in the
// environment (\.habbit) rather than the fixed Cocoa colours.

import AppIntents
import SwiftUI
import WidgetKit

enum WidgetTheme: String, AppEnum {
    case cocoa, cream, auto

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Look"
    // The widget editor's menu doesn't show subtitles, so Pro is in the names.
    static var caseDisplayRepresentations: [WidgetTheme: DisplayRepresentation] = [
        .cocoa: "Cocoa",
        .cream: "Cream · Pro",
        .auto:  "Match iPhone · Pro",
    ]
}

/** The Habbit widget's settings. */
struct HabbitWidgetConfig: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Habbit"
    static var description = IntentDescription("Choose how the widget looks.")

    @Parameter(title: "Look", default: .cocoa)
    var theme: WidgetTheme

    @Parameter(title: "Show Your Avatar", default: true)
    var showAvatar: Bool
}

/** The other widgets' settings: just the look. */
struct WidgetLookConfig: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Look"
    static var description = IntentDescription("Choose how the widget looks.")

    @Parameter(title: "Look", default: .cocoa)
    var theme: WidgetTheme
}

struct WidgetLook {
    var theme: WidgetTheme = .cocoa
    var showAvatar = true

    /** A widget's settings as shown: the Pro looks stay Cocoa without Pro. */
    static func resolved(_ theme: WidgetTheme, showAvatar: Bool = true) -> WidgetLook {
        WidgetLook(theme: theme == .cocoa || HabbitStore.isPro() ? theme : .cocoa, showAvatar: showAvatar)
    }
}

struct HabbitPalette {
    var bg: Color
    /** Behind a row of text. */
    var card: Color
    /** The unfilled part of a ring or bar. */
    var bar: Color
    var accent: Color
    var text: Color
    var red: Color
    var green: Color
    /** Text and ticks on an accent or green fill. */
    var onAccent: Color

    static let cocoa = HabbitPalette(
        bg: .habbitBg, card: .habbitCard, bar: .habbitBar, accent: .habbitAccent, text: .habbitCream,
        red: .habbitRed, green: .habbitGreen, onAccent: .habbitBg)

    // Darker accent, green and red than Cocoa's, so they read on the light background.
    static let cream = HabbitPalette(
        bg:       Color(red: 1.00, green: 0.97, blue: 0.94),   // #fff8f0
        card:     Color(red: 0.95, green: 0.89, blue: 0.83),   // #f3e4d4
        bar:      Color(red: 0.92, green: 0.84, blue: 0.76),   // #ead6c2
        accent:   Color(red: 0.72, green: 0.39, blue: 0.18),   // #b8642e
        text:     Color(red: 0.24, green: 0.09, blue: 0.06),   // #3d170e
        red:      Color(red: 0.75, green: 0.27, blue: 0.25),   // #c0443f
        green:    Color(red: 0.29, green: 0.56, blue: 0.21),   // #4a8f36
        onAccent: .white)

    static func of(_ theme: WidgetTheme, dark: Bool) -> HabbitPalette {
        switch theme {
        case .cocoa: return .cocoa
        case .cream: return .cream
        case .auto:  return dark ? .cocoa : .cream
        }
    }

    /** Behind text: faint on tinted and clear Home Screens, where a solid fill would hide it. */
    func cardFill(_ mode: WidgetRenderingMode) -> Color { mode.isAccented ? text.opacity(0.12) : card }
    /** The unfilled part of a ring or bar: faint on tinted and clear Home Screens. */
    func track(_ mode: WidgetRenderingMode) -> Color { mode.isAccented ? text.opacity(0.22) : bar }
}

extension EnvironmentValues {
    @Entry var habbit: HabbitPalette = .cocoa
}

private struct HabbitLookModifier: ViewModifier {
    let theme: WidgetTheme
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        content.environment(\.habbit, HabbitPalette.of(theme, dark: scheme == .dark))
    }
}

extension View {
    /** Gives the widget its look's colours. */
    func habbitLook(_ look: WidgetLook) -> some View { modifier(HabbitLookModifier(theme: look.theme)) }
}
