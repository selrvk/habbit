import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    HabbitStore.snapshotDidChange = { HabbitShortcutsHelper.snapshotChanged() }

    // A quick action that launched the app does its part now, and its link becomes the
    // launch URL (Linking.getInitialURL). Returning false stops iOS calling performActionFor too.
    var options = launchOptions ?? [:]
    let quickAction = launchOptions?[.shortcutItem] as? UIApplicationShortcutItem
    if let quickAction, let url = QuickActions.handle(quickAction) { options[.url] = url }

    factory.startReactNative(
      withModuleName: "DailyTracker",
      in: window,
      launchOptions: options
    )

    return quickAction == nil
  }

  // habbit:// links (src/links.ts).
  func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    RCTLinkingManager.application(app, open: url, options: options)
  }

  // A quick action while the app is running or suspended.
  func application(
    _ application: UIApplication,
    performActionFor shortcutItem: UIApplicationShortcutItem,
    completionHandler: @escaping (Bool) -> Void
  ) {
    guard let url = QuickActions.handle(shortcutItem) else { return completionHandler(false) }
    completionHandler(RCTLinkingManager.application(application, open: url, options: [:]))
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
