import WidgetKit
import Foundation

@objc(WidgetReloaderHelper)
class WidgetReloaderHelper: NSObject {
  @objc static func reloadAll() {
    WidgetCenter.shared.reloadAllTimelines()
  }
}
