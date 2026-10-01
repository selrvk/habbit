import {
  BACKUP_SECTIONS, BackupError, backupToStorage, createBackup, describeBackupContents, describeBackupTime,
  parseBackup, spendingCsv, summarizeBackup,
} from '../src/backupFormat';

const habits = { items: [{ id: 'a', label: 'Water' }, { id: 'b', label: 'Read' }], date: '2026-10-01' };
const today  = { spentToday: 120, date: '2026-10-01', history: [{ id: 'x', amount: 120, time: '9:05 AM', note: 'Coffee' }] };
const stored: Record<string, string | null> = {
  [BACKUP_SECTIONS.habits]:   JSON.stringify(habits),
  [BACKUP_SECTIONS.today]:    JSON.stringify(today),
  [BACKUP_SECTIONS.spending]: JSON.stringify({ dailyTotals: [{ date: '2026-09-30', total: 50 }] }),
  [BACKUP_SECTIONS.stats]:    JSON.stringify({ currentStreak: 3, bestStreak: 5, totalCompleted: 40, lastFullDate: '2026-09-30' }),
  [BACKUP_SECTIONS.topUps]:   null,
};

describe('backup round trip', () => {
  const file = createBackup(stored, new Date('2026-10-01T10:00:00Z'));

  it('keeps every stored section and skips empty ones', () => {
    expect(file.createdAt).toBe('2026-10-01T10:00:00.000Z');
    expect(file.data.habits).toEqual(habits);
    expect(file.data.topUps).toBeUndefined();
  });

  it('survives being written to a file and read back', () => {
    expect(parseBackup(JSON.stringify(file, null, 2))).toEqual(file);
  });

  it('restores stored values and clears sections the backup lacks', () => {
    const { set, remove } = backupToStorage(file);
    expect(JSON.parse(set[BACKUP_SECTIONS.habits])).toEqual(habits);
    expect(remove).toContain(BACKUP_SECTIONS.topUps);
    expect(remove).not.toContain(BACKUP_SECTIONS.habits);
  });

  it('summarizes habits and days with spending (today included)', () => {
    expect(summarizeBackup(file)).toEqual({ createdAt: file.createdAt, habits: 2, spendingDays: 2 });
    expect(describeBackupContents({ habits: 1, spendingDays: 2 })).toBe('1 habbit · 2 days of spending');
  });
});

describe('parseBackup', () => {
  const valid = { app: 'habbit', version: 1, createdAt: '2026-10-01T10:00:00Z', data: { habits } };

  it('rejects files that are not Habbit backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ app: 'other', version: 1, data: {} }))).toThrow('isn’t a Habbit backup');
  });

  it('rejects backups from a newer app version', () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, version: 99 }))).toThrow('newer version');
  });

  it('rejects damaged sections', () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, data: { habits: { items: 'nope' } } }))).toThrow('damaged');
  });

  it('ignores unknown sections', () => {
    expect(parseBackup(JSON.stringify({ ...valid, data: { habits, extra: 1 } })).data).toEqual({ habits });
  });
});

describe('spendingCsv', () => {
  it('lists spending and added money oldest first, escaping notes', () => {
    const csv = spendingCsv({
      dailyTotals: [
        { date: '2026-09-29', total: 300 }, // old history without entries
        { date: '2026-09-30', total: 80, entries: [
          { id: '2', amount: 30, time: '1:15 PM', note: 'Lunch, "big"', category: 'food' },
          { id: '1', amount: 50, time: '9:00 AM', note: '=cmd' },
        ] },
      ],
      today,
      topUps: [{ id: 't', amount: 1000, date: '2026-09-30', time: '12:00 PM', note: 'Allowance' }],
    });
    expect(csv.trim().split('\n')).toEqual([
      'Date,Time,Type,Category,Amount,Note',
      '2026-09-29,,Spent,,300,(day total)',
      '2026-09-30,9:00 AM,Spent,,50,\'=cmd',
      '2026-09-30,12:00 PM,Added money,,1000,Allowance',
      '2026-09-30,1:15 PM,Spent,Food,30,"Lunch, ""big"""',
      '2026-10-01,9:05 AM,Spent,,120,Coffee',
    ]);
  });
});

describe('describeBackupTime', () => {
  const now = new Date(2026, 9, 1, 15, 0); // Oct 1 2026, 3:00 PM local

  it('uses relative times for recent backups', () => {
    expect(describeBackupTime(new Date(2026, 9, 1, 14, 59, 40).toISOString(), now)).toBe('just now');
    expect(describeBackupTime(new Date(2026, 9, 1, 14, 48).toISOString(), now)).toBe('12 min ago');
    expect(describeBackupTime(new Date(2026, 9, 1, 9, 5).toISOString(), now)).toBe('today at 9:05 AM');
    expect(describeBackupTime(new Date(2026, 8, 30, 21, 40).toISOString(), now)).toBe('yesterday at 9:40 PM');
  });

  it('uses dates for older backups', () => {
    expect(describeBackupTime(new Date(2026, 8, 3).toISOString(), now)).toBe('Sep 3');
    expect(describeBackupTime(new Date(2025, 11, 2).toISOString(), now)).toBe('Dec 2, 2025');
  });
});
