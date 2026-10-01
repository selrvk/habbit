// src/utils/cloudBackup.ts
//
// Automatic iCloud backup, backup files and the spending CSV.
//
// There is one iCloud backup per Apple ID. An install only replaces it when the backup is
// its own, or when the user has already seen it and chosen restore or "keep this phone's
// data" (the "handled" marker). So a fresh install, whose data is still empty, can never
// overwrite a backup it hasn't offered to restore.

import { Share, TurboModuleRegistry, type TurboModule } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BACKUP_SECTIONS, BACKUP_VERSION, backupToStorage, createBackup, parseBackup, spendingCsv, summarizeBackup,
  type BackupFile, type BackupSummary,
} from '../backupFormat';
import { STORAGE_FINANCE, STORAGE_FINANCE_HISTORY, STORAGE_NOTIF_VERSION, STORAGE_ONBOARDED, STORAGE_TOPUPS } from '../storage';
import { getTodayKey } from '../helpers';

interface CloudBackupModule extends TurboModule {
  isAvailable(): Promise<boolean>;
  getMeta(): Promise<object | null>;
  load(): Promise<string | null>;
  save(json: string, meta: object): Promise<number>;
  writeTempFile(name: string, contents: string): Promise<string>;
  pickFile(): Promise<string | null>;
}

const Native = TurboModuleRegistry.get<CloudBackupModule>('CloudBackup');

// Per-install markers. Not part of backups, and kept by "Delete All Data".
const STORAGE_INSTALL_ID     = '@habbit_rabbit_install_id';
const STORAGE_BACKUP_HANDLED = '@habbit_rabbit_backup_handled';

export type CloudBackupMeta = BackupSummary & { installId: string; version: number };

export type CloudBackupStatus = {
  /** False when no iCloud account is signed in (or on platforms without the module). */
  available: boolean;
  meta: CloudBackupMeta | null;
  /** This install made the backup, so it keeps it up to date. */
  ours: boolean;
  /** Another install's backup that this one hasn't offered yet: automatic backup is paused. */
  needsDecision: boolean;
};

const getInstallId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(STORAGE_INSTALL_ID);
  if (existing) return existing;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(STORAGE_INSTALL_ID, id);
  return id;
};

const readMeta = async (): Promise<CloudBackupMeta | null> => {
  const m: any = await Native?.getMeta().catch(() => null);
  if (!m || typeof m.createdAt !== 'string' || typeof m.installId !== 'string') return null;
  return {
    createdAt: m.createdAt, installId: m.installId, version: Number(m.version) || 1,
    habits: Number(m.habits) || 0, spendingDays: Number(m.spendingDays) || 0,
  };
};

export const getCloudBackupStatus = async (): Promise<CloudBackupStatus> => {
  if (!Native) return { available: false, meta: null, ours: false, needsDecision: false };
  const [available, meta, installId, handled] = await Promise.all([
    Native.isAvailable().catch(() => false), readMeta(), getInstallId(), AsyncStorage.getItem(STORAGE_BACKUP_HANDLED),
  ]);
  const ours = !!meta && meta.installId === installId;
  return { available, meta, ours, needsDecision: !!meta && !ours && meta.createdAt !== handled };
};

/** The user has seen this backup and chose restore or "keep this phone's data". */
export const markBackupHandled = (createdAt: string) =>
  AsyncStorage.setItem(STORAGE_BACKUP_HANDLED, createdAt).catch(() => {});

/** A snapshot of this install's data. */
export const readLocalBackup = async (): Promise<BackupFile> =>
  createBackup(await AsyncStorage.getMany(Object.values(BACKUP_SECTIONS)));

let lastSavedData: string | null = null;

/**
 * Saves this install's data to iCloud. Skipped when another install's backup is waiting for
 * a decision, and (unless `always`) when nothing changed since the last save this session.
 */
export const backUpToICloud = async (always = false): Promise<'saved' | 'unchanged' | 'needs_decision' | 'unsupported'> => {
  if (!Native) return 'unsupported';
  const status = await getCloudBackupStatus();
  if (status.needsDecision) return 'needs_decision';

  const file = await readLocalBackup();
  const data = JSON.stringify(file.data);
  if (!always && status.ours && data === lastSavedData) return 'unchanged';

  const meta: CloudBackupMeta = { ...summarizeBackup(file), installId: await getInstallId(), version: BACKUP_VERSION };
  await Native.save(JSON.stringify(file), meta);
  lastSavedData = data;
  return 'saved';
};

export const loadICloudBackup = async (): Promise<BackupFile | null> => {
  const json = await Native?.load();
  return json ? parseBackup(json) : null;
};

/**
 * Replaces this install's data with a backup. The caller reloads app state afterwards.
 * Notifications are rescheduled by the next load (the notif version marker is cleared).
 */
export const applyBackup = async (file: BackupFile) => {
  const { set, remove } = backupToStorage(file);
  await AsyncStorage.removeMany([...remove, STORAGE_NOTIF_VERSION]);
  await AsyncStorage.setMany({ ...set, [STORAGE_ONBOARDED]: 'true' });
  lastSavedData = null;
};

// ── Files ───────────────────────────────────────────────────────────────────

const shareFile = async (name: string, contents: string) => {
  if (!Native) throw new Error('Files aren’t supported on this device yet.');
  const url = await Native.writeTempFile(name, contents);
  await Share.share({ url });
};

export const exportBackupFile = async () => {
  const file = await readLocalBackup();
  await shareFile(`Habbit Backup ${getTodayKey()}.json`, JSON.stringify(file, null, 2));
};

/** Lets the user pick a backup file. Null if they cancel; throws BackupError if it isn't one. */
export const pickBackupFile = async (): Promise<BackupFile | null> => {
  if (!Native) throw new Error('Files aren’t supported on this device yet.');
  const text = await Native.pickFile();
  return text === null ? null : parseBackup(text);
};

export const exportSpendingCsv = async () => {
  const stored = await AsyncStorage.getMany([STORAGE_FINANCE, STORAGE_FINANCE_HISTORY, STORAGE_TOPUPS]);
  const fin = stored[STORAGE_FINANCE], hist = stored[STORAGE_FINANCE_HISTORY], tops = stored[STORAGE_TOPUPS];
  const csv = spendingCsv({
    today:       fin ? JSON.parse(fin) : null,
    dailyTotals: hist ? JSON.parse(hist).dailyTotals ?? [] : [],
    topUps:      tops ? JSON.parse(tops) : [],
  });
  await shareFile(`Habbit Spending ${getTodayKey()}.csv`, csv);
};
