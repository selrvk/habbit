#import <React/RCTBridgeModule.h>

static void reloadWidgetTimelines(void) {
  dispatch_async(dispatch_get_main_queue(), ^{
    Class helper = NSClassFromString(@"WidgetReloaderHelper");
    if (helper) {
      SEL sel = NSSelectorFromString(@"reloadAll");
      if ([helper respondsToSelector:sel]) {
        // Suppress ARC warning for performSelector with unknown return type
        IMP imp = [helper methodForSelector:sel];
        void (*func)(id, SEL) = (void *)imp;
        func(helper, sel);
      }
    }
  });
}

@interface WidgetReloader : NSObject <RCTBridgeModule>
@end

@implementation WidgetReloader

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(setData:(NSDictionary *)data) {
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.selrvk.habbit"];
  if (!defaults) {
    return;
  }
  NSError *error;
  NSData *jsonData = [NSJSONSerialization dataWithJSONObject:data options:0 error:&error];
  if (jsonData && !error) {
    NSString *jsonString = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    [defaults setObject:jsonString forKey:@"widgetData"];
  }
  reloadWidgetTimelines();
  // The "check off" quick action follows the snapshot.
  dispatch_async(dispatch_get_main_queue(), ^{
    Class helper = NSClassFromString(@"HabbitShortcutsHelper");
    SEL sel = NSSelectorFromString(@"snapshotChanged");
    if ([helper respondsToSelector:sel]) {
      void (*func)(id, SEL) = (void *)[helper methodForSelector:sel];
      func(helper, sel);
    }
  });
}

/** Whether the widgets may use the Pro looks (HabbitStore.isPro). Reloads them when it changes. */
RCT_EXPORT_METHOD(setPro:(BOOL)pro) {
  NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.selrvk.habbit"];
  if (!defaults || ([defaults objectForKey:@"isPro"] != nil && [defaults boolForKey:@"isPro"] == pro)) return;
  [defaults setBool:pro forKey:@"isPro"];
  reloadWidgetTimelines();
}

RCT_EXPORT_METHOD(reloadAll) {
  reloadWidgetTimelines();
}

/** The app's version and build, for Settings › About. */
- (NSDictionary *)constantsToExport {
  NSDictionary *info = NSBundle.mainBundle.infoDictionary;
  return @{ @"appVersion": info[@"CFBundleShortVersionString"] ?: @"", @"buildNumber": info[@"CFBundleVersion"] ?: @"" };
}

+ (BOOL)requiresMainQueueSetup { return NO; }

@end
