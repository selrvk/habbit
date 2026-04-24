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
}

RCT_EXPORT_METHOD(reloadAll) {
  reloadWidgetTimelines();
}

+ (BOOL)requiresMainQueueSetup { return NO; }

@end
