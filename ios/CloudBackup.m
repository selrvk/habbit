// CloudBackup.m
//
// iCloud backup through the iCloud key-value store, plus the file helpers behind
// "Export backup", "Import backup" and "Export spending". The backup is stored as
// zlib-compressed JSON; the key-value store allows 1 MB per app in total.

#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

static NSString *const kBackupKey = @"habbit.backup";
static NSString *const kMetaKey   = @"habbit.backupMeta";
// Leaves room for the meta dictionary inside the 1 MB quota.
static const NSUInteger kMaxBackupBytes = 950 * 1024;

@interface CloudBackup : NSObject <RCTBridgeModule, UIDocumentPickerDelegate>
@property (nonatomic, copy) RCTPromiseResolveBlock pickResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock pickReject;
@end

@implementation CloudBackup

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return NO; }

/** Whether an iCloud account is signed in. Without one, saves stay on this device only. */
RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  resolve(@([NSFileManager defaultManager].ubiquityIdentityToken != nil));
}

/** The small summary saved next to the backup, or null when there is no backup. */
RCT_EXPORT_METHOD(getMeta:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSUbiquitousKeyValueStore *store = [NSUbiquitousKeyValueStore defaultStore];
  [store synchronize];
  NSDictionary *meta = [store dictionaryForKey:kMetaKey];
  resolve(meta ?: [NSNull null]);
}

/** The backup JSON, or null when there is no backup. */
RCT_EXPORT_METHOD(load:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSUbiquitousKeyValueStore *store = [NSUbiquitousKeyValueStore defaultStore];
  [store synchronize];
  NSData *compressed = [store dataForKey:kBackupKey];
  if (!compressed) { resolve([NSNull null]); return; }

  NSError *error = nil;
  NSData *data = [compressed decompressedDataUsingAlgorithm:NSDataCompressionAlgorithmZlib error:&error];
  NSString *json = data ? [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] : nil;
  if (!json) { reject(@"corrupt", @"The iCloud backup couldn’t be read.", error); return; }
  resolve(json);
}

/** Replaces the backup. `meta` must only hold strings and numbers. Resolves with the stored size. */
RCT_EXPORT_METHOD(save:(NSString *)json
                  meta:(NSDictionary *)meta
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  // Usually called as the app goes to the background: finish before being suspended.
  __block UIBackgroundTaskIdentifier task = UIBackgroundTaskInvalid;
  task = [[UIApplication sharedApplication] beginBackgroundTaskWithName:@"iCloud backup" expirationHandler:^{
    [[UIApplication sharedApplication] endBackgroundTask:task];
    task = UIBackgroundTaskInvalid;
  }];

  NSError *error = nil;
  NSData *compressed = [[json dataUsingEncoding:NSUTF8StringEncoding]
                        compressedDataUsingAlgorithm:NSDataCompressionAlgorithmZlib error:&error];
  if (!compressed) {
    reject(@"compress_failed", @"Couldn’t prepare the backup.", error);
  } else if (compressed.length > kMaxBackupBytes) {
    reject(@"too_large", @"Your data is too large for iCloud backup. Export a backup file instead.", nil);
  } else {
    NSUbiquitousKeyValueStore *store = [NSUbiquitousKeyValueStore defaultStore];
    [store setData:compressed forKey:kBackupKey];
    [store setDictionary:meta forKey:kMetaKey];
    [store synchronize];
    resolve(@(compressed.length));
  }

  if (task != UIBackgroundTaskInvalid) [[UIApplication sharedApplication] endBackgroundTask:task];
}

/** Writes a file to the temporary folder for sharing. Resolves with its file:// URL. */
RCT_EXPORT_METHOD(writeTempFile:(NSString *)name
                  contents:(NSString *)contents
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject) {
  NSString *safeName = [[name componentsSeparatedByCharactersInSet:
                         [NSCharacterSet characterSetWithCharactersInString:@"/:\\"]] componentsJoinedByString:@"-"];
  NSURL *url = [[NSURL fileURLWithPath:NSTemporaryDirectory()] URLByAppendingPathComponent:safeName];
  NSError *error = nil;
  if (![contents writeToURL:url atomically:YES encoding:NSUTF8StringEncoding error:&error]) {
    reject(@"write_failed", @"Couldn’t create the file.", error);
    return;
  }
  resolve(url.absoluteString);
}

/** Lets the user pick a backup file. Resolves with its text, or null if they cancel. */
RCT_EXPORT_METHOD(pickFile:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.pickResolve) { reject(@"busy", @"A file picker is already open.", nil); return; }
    UIViewController *presenter = RCTPresentedViewController();
    if (!presenter) { reject(@"no_window", @"Couldn’t open the file picker.", nil); return; }

    UIDocumentPickerViewController *picker =
      [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:@[UTTypeJSON, UTTypePlainText] asCopy:YES];
    picker.delegate = self;
    picker.allowsMultipleSelection = NO;
    self.pickResolve = resolve;
    self.pickReject = reject;
    [presenter presentViewController:picker animated:YES completion:nil];
  });
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls {
  RCTPromiseResolveBlock resolve = self.pickResolve;
  RCTPromiseRejectBlock reject = self.pickReject;
  self.pickResolve = nil;
  self.pickReject = nil;
  if (!resolve) return;

  NSError *error = nil;
  NSURL *url = urls.firstObject;
  NSString *contents = url ? [NSString stringWithContentsOfURL:url encoding:NSUTF8StringEncoding error:&error] : nil;
  if (contents) resolve(contents);
  else reject(@"read_failed", @"That file couldn’t be read.", error);
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller {
  RCTPromiseResolveBlock resolve = self.pickResolve;
  self.pickResolve = nil;
  self.pickReject = nil;
  if (resolve) resolve([NSNull null]);
}

@end
