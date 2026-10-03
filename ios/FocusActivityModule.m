// FocusActivityModule.m
//
// Keeps the focus timer's Live Activity in step with the app's timer (src/utils/focusActivity.ts).
// The work is in FocusActivity.swift, reached by name as in WidgetReloader.m.

#import <React/RCTBridgeModule.h>

@interface FocusActivity : NSObject <RCTBridgeModule>
@end

@implementation FocusActivity

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return NO; }

/** The running session as JSON ({ session, done }), or "" when there's none. */
RCT_EXPORT_METHOD(sync:(NSString *)json) {
  dispatch_async(dispatch_get_main_queue(), ^{
    Class controller = NSClassFromString(@"FocusActivityController");
    SEL sel = NSSelectorFromString(@"sync:");
    if (![controller respondsToSelector:sel]) return;
    void (*func)(id, SEL, NSString *) = (void *)[controller methodForSelector:sel];
    func(controller, sel, json ?: @"");
  });
}

@end
