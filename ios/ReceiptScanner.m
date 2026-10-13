// ReceiptScanner.m
//
// Reads the text on a receipt (src/utils/receiptScan.ts). The photo comes from the document
// camera or the photo picker, and Apple's Vision finds the text on it, here on the phone.
// Only the text goes back to the app: the photo isn't saved or sent anywhere.

#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>
#import <UIKit/UIKit.h>
#import <Vision/Vision.h>
#import <VisionKit/VisionKit.h>
#import <PhotosUI/PhotosUI.h>

@interface ReceiptScanner : NSObject <RCTBridgeModule, VNDocumentCameraViewControllerDelegate, PHPickerViewControllerDelegate>
@property (nonatomic, copy) RCTPromiseResolveBlock scanResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock scanReject;
@end

@implementation ReceiptScanner

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup { return NO; }

/** Whether this device can scan with its camera (the simulator can't). */
RCT_EXPORT_METHOD(cameraAvailable:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  resolve(@(VNDocumentCameraViewController.isSupported));
}

/**
 * Shows the document camera ("camera") or the photo picker ("photos") and resolves with the
 * text found: [{ text, x, y, w, h }], sizes as fractions of the page with y running down
 * (a second page starts at y = 1). Resolves null when it's cancelled.
 */
RCT_EXPORT_METHOD(scan:(NSString *)source resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.scanResolve) { reject(@"busy", @"A scan is already open", nil); return; }
    UIViewController *top = RCTPresentedViewController();
    if (!top) { reject(@"no_screen", @"Nothing to show the scanner on", nil); return; }

    UIViewController *scanner;
    if ([source isEqualToString:@"camera"]) {
      if (!VNDocumentCameraViewController.isSupported) { reject(@"no_camera", @"This device can't scan with its camera", nil); return; }
      VNDocumentCameraViewController *camera = [VNDocumentCameraViewController new];
      camera.delegate = self;
      scanner = camera;
    } else {
      PHPickerConfiguration *config = [PHPickerConfiguration new];
      config.filter = PHPickerFilter.imagesFilter;
      config.selectionLimit = 1;
      PHPickerViewController *picker = [[PHPickerViewController alloc] initWithConfiguration:config];
      picker.delegate = self;
      scanner = picker;
    }
    self.scanResolve = resolve;
    self.scanReject  = reject;
    [top presentViewController:scanner animated:YES completion:nil];
  });
}

#pragma mark - Results

- (void)finishWith:(id)result {
  RCTPromiseResolveBlock resolve = self.scanResolve;
  self.scanResolve = nil;
  self.scanReject  = nil;
  if (resolve) resolve(result ?: [NSNull null]);
}

- (void)failWith:(NSString *)code message:(NSString *)message {
  RCTPromiseRejectBlock reject = self.scanReject;
  self.scanResolve = nil;
  self.scanReject  = nil;
  if (reject) reject(code, message, nil);
}

static CGImagePropertyOrientation orientationOf(UIImage *image) {
  switch (image.imageOrientation) {
    case UIImageOrientationUp:            return kCGImagePropertyOrientationUp;
    case UIImageOrientationDown:          return kCGImagePropertyOrientationDown;
    case UIImageOrientationLeft:          return kCGImagePropertyOrientationLeft;
    case UIImageOrientationRight:         return kCGImagePropertyOrientationRight;
    case UIImageOrientationUpMirrored:    return kCGImagePropertyOrientationUpMirrored;
    case UIImageOrientationDownMirrored:  return kCGImagePropertyOrientationDownMirrored;
    case UIImageOrientationLeftMirrored:  return kCGImagePropertyOrientationLeftMirrored;
    case UIImageOrientationRightMirrored: return kCGImagePropertyOrientationRightMirrored;
  }
  return kCGImagePropertyOrientationUp;
}

/** Finds the text on each page, off the main thread, then resolves. */
- (void)readPages:(NSArray<UIImage *> *)pages {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    NSMutableArray<NSDictionary *> *boxes = [NSMutableArray new];
    [pages enumerateObjectsUsingBlock:^(UIImage *page, NSUInteger index, BOOL *stop) {
      if (!page.CGImage) return;
      VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:nil];
      request.recognitionLevel = VNRequestTextRecognitionLevelAccurate;
      // Language correction "fixes" prices and shop names into words they aren't.
      request.usesLanguageCorrection = NO;
      VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:page.CGImage orientation:orientationOf(page) options:@{}];
      NSError *error;
      if (![handler performRequests:@[request] error:&error]) return;
      for (VNRecognizedTextObservation *found in request.results) {
        VNRecognizedText *text = [found topCandidates:1].firstObject;
        if (text.string.length == 0) continue;
        // Vision measures from the bottom left; the app reads from the top.
        CGRect box = found.boundingBox;
        [boxes addObject:@{
          @"text": text.string,
          @"x": @(box.origin.x),
          @"y": @((double)index + 1.0 - box.origin.y - box.size.height),
          @"w": @(box.size.width),
          @"h": @(box.size.height),
        }];
      }
    }];
    dispatch_async(dispatch_get_main_queue(), ^{ [self finishWith:boxes]; });
  });
}

#pragma mark - Document camera

- (void)documentCameraViewController:(VNDocumentCameraViewController *)controller didFinishWithScan:(VNDocumentCameraScan *)scan {
  NSMutableArray<UIImage *> *pages = [NSMutableArray new];
  // A long receipt can take a few pages; more than that isn't one.
  for (NSUInteger i = 0; i < MIN(scan.pageCount, (NSUInteger)4); i++) [pages addObject:[scan imageOfPageAtIndex:i]];
  [controller dismissViewControllerAnimated:YES completion:^{ [self readPages:pages]; }];
}

- (void)documentCameraViewControllerDidCancel:(VNDocumentCameraViewController *)controller {
  [controller dismissViewControllerAnimated:YES completion:^{ [self finishWith:nil]; }];
}

- (void)documentCameraViewController:(VNDocumentCameraViewController *)controller didFailWithError:(NSError *)error {
  [controller dismissViewControllerAnimated:YES completion:^{ [self failWith:@"camera_failed" message:error.localizedDescription ?: @"The camera couldn't scan"]; }];
}

#pragma mark - Photo picker

- (void)picker:(PHPickerViewController *)picker didFinishPicking:(NSArray<PHPickerResult *> *)results {
  // Nothing is answered until the picker has gone: the app may show an alert next.
  [picker dismissViewControllerAnimated:YES completion:^{
    NSItemProvider *provider = results.firstObject.itemProvider;
    if (!provider) { [self finishWith:nil]; return; }
    if (![provider canLoadObjectOfClass:UIImage.class]) { [self failWith:@"not_an_image" message:@"That isn't a photo Habbit can read"]; return; }
    [provider loadObjectOfClass:UIImage.class completionHandler:^(id<NSItemProviderReading> object, NSError *error) {
      UIImage *image = [(NSObject *)object isKindOfClass:UIImage.class] ? (UIImage *)object : nil;
      dispatch_async(dispatch_get_main_queue(), ^{
        if (!image) { [self failWith:@"not_an_image" message:error.localizedDescription ?: @"That photo couldn't be opened"]; return; }
        [self readPages:@[image]];
      });
    }];
  }];
}

@end
