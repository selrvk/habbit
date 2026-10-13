// src/utils/receiptScan.ts
//
// Scanning a receipt into the spending sheet (receipt.ts has the reading). The photo comes
// from the document camera or the photo picker and its text is found on the phone
// (ios/ReceiptScanner.m). Where Bonbon may read receipts (aiConsent.ts), the text also goes
// to him for the category and a tidier shop name; that counts as one of the day's messages.
// Whatever comes back only fills in the sheet. Saving is still the user's tap.

import { ActionSheetIOS, Alert, TurboModuleRegistry, type TurboModule } from 'react-native';
import { amountText, fillFrom, parseReceiptReply, receiptPrompt, rowsFromBoxes, type AiRead, type TextBox } from '../receipt';
import { pickableCategories } from '../categories';
import { receiptAiAllowed } from './aiConsent';
import { askBonbon } from './bonbonApi';
import { consumeMessage, getRemainingMessages } from './messageQuota';

interface ReceiptScannerModule extends TurboModule {
  cameraAvailable(): Promise<boolean>;
  scan(source: 'camera' | 'photos'): Promise<TextBox[] | null>;
}

const Native = TurboModuleRegistry.get<ReceiptScannerModule>('ReceiptScanner');

/** Whether this build can scan (iOS only for now). */
export const canScanReceipts = Native != null;

/**
 * What a scan puts in the spending sheet. `sure` is false when the amount is the phone's
 * best guess, or wasn't found.
 */
export type ScanFill = { amount?: string; note?: string; category?: string; sure: boolean };

// How long Bonbon gets before the phone's own reading is used.
const AI_WAIT_MS = 9000;

const pickSource = (camera: boolean): Promise<'camera' | 'photos' | null> => {
  if (!camera) return Promise.resolve('photos');
  return new Promise(resolve => ActionSheetIOS.showActionSheetWithOptions(
    { title: 'Scan a receipt', options: ['Take a photo', 'Choose a photo', 'Cancel'], cancelButtonIndex: 2 },
    i => resolve(i === 0 ? 'camera' : i === 1 ? 'photos' : null),
  ));
};

/** Bonbon's reading, or null: not allowed, out of messages for today, offline, too slow, or no sense in the reply. */
const askBonbonToRead = async (lines: string[], isPro: boolean): Promise<AiRead | null> => {
  try {
    if (!(await receiptAiAllowed())) return null;
    if ((await getRemainingMessages(isPro)) <= 0) return null;
    const categories = pickableCategories().map(c => ({ key: c.key, label: c.label }));
    const reply = await Promise.race([
      askBonbon({ system: receiptPrompt(lines, categories), message: 'Read this receipt.' }),
      new Promise<null>(resolve => setTimeout(() => resolve(null), AI_WAIT_MS)),
    ]);
    // Sent, so the server counted it, even if the answer came too late to use.
    consumeMessage();
    return reply === null ? null : parseReceiptReply(reply, categories.map(c => c.key));
  } catch {
    return null;
  }
};

/** Runs a scan from start to finish. Null when it was cancelled or nothing could be read (the user has been told). */
export const scanReceipt = async (isPro: boolean): Promise<ScanFill | null> => {
  if (!Native) return null;
  const source = await pickSource(await Native.cameraAvailable().catch(() => false));
  if (!source) return null;

  let boxes: TextBox[] | null;
  try {
    boxes = await Native.scan(source);
  } catch {
    Alert.alert('Couldn’t read that', 'Something went wrong with the photo. Try again, or type the amount in.');
    return null;
  }
  if (!boxes) return null;

  const lines = rowsFromBoxes(boxes);
  if (lines.length === 0) {
    Alert.alert('No writing found', 'Habbit couldn’t find any text on that photo. Try a clearer one, or type the amount in.');
    return null;
  }

  const fill = fillFrom(lines, await askBonbonToRead(lines, isPro));
  return {
    ...(fill.amount !== undefined ? { amount: amountText(fill.amount) } : {}),
    ...(fill.note ? { note: fill.note } : {}),
    ...(fill.category ? { category: fill.category } : {}),
    sure: fill.sure,
  };
};
