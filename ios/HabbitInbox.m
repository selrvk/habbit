// HabbitInbox.m
//
// Hands the app what Siri, Shortcuts and quick actions did while it wasn't looking
// (HabbitStore.swift queues it; src/inbox.ts applies it), and a link left by an intent that
// opened the app. "changed" tells a running app to take them now.

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Swift classes are reached by name, as in WidgetReloader.m: DailyTracker-Swift.h can't be
// imported from Objective-C here.
static NSString *const kInboxChanged = @"HabbitInboxChanged"; // HabbitStore.inboxChanged

static NSString *takeFrom(NSString *className) {
  Class store = NSClassFromString(className);
  SEL sel = NSSelectorFromString(@"take");
  if (!store || ![store respondsToSelector:sel]) return nil;
  NSString *(*take)(id, SEL) = (void *)[store methodForSelector:sel];
  return take(store, sel);
}

@interface HabbitInbox : RCTEventEmitter <RCTBridgeModule>
@end

@implementation HabbitInbox {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return NO; }
// HabbitLinkStore is main-thread only.
- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

- (instancetype)init {
  if ((self = [super init])) {
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(inboxChanged)
                                                 name:kInboxChanged
                                               object:nil];
  }
  return self;
}

- (void)dealloc {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (NSArray<NSString *> *)supportedEvents { return @[@"changed"]; }
- (void)startObserving { _hasListeners = YES; }
- (void)stopObserving { _hasListeners = NO; }

- (void)inboxChanged {
  if (_hasListeners) [self sendEventWithName:@"changed" body:nil];
}

/** The queued events as JSON (an array), emptying the queue. */
RCT_EXPORT_METHOD(take:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  resolve(takeFrom(@"HabbitInboxStore") ?: @"[]");
}

/** A habbit:// link left by an intent that opened the app, or null. */
RCT_EXPORT_METHOD(takeLink:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  resolve(takeFrom(@"HabbitLinkStore") ?: (id)[NSNull null]);
}

@end
