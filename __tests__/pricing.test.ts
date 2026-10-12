import { yearlySaving } from '../src/utils/pricing';

describe('yearlySaving', () => {
  it('is the percent a year saves over 12 months, rounded down', () => {
    expect(yearlySaving(99, 990)).toBe(16);   // 2 months free: 16.67%
    expect(yearlySaving(4.99, 29.99)).toBe(49);
    expect(yearlySaving(100, 600)).toBe(50);
  });

  it('claims nothing when a year costs the same or more', () => {
    expect(yearlySaving(99, 1188)).toBeNull();
    expect(yearlySaving(99, 1490)).toBeNull();
    expect(yearlySaving(99, 1187)).toBeNull(); // under 1%
  });

  it('claims nothing without both prices', () => {
    expect(yearlySaving(0, 990)).toBeNull();
    expect(yearlySaving(99, 0)).toBeNull();
    expect(yearlySaving(NaN, 990)).toBeNull();
  });
});
