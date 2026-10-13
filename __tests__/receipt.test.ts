import {
  amountText, amountsIn, fillFrom, parseReceiptReply, readReceipt, receiptPrompt, receiptTextForAi, rowsFromBoxes, shopOf, totalOf,
  type TextBox,
} from '../src/receipt';

const box = (text: string, x: number, y: number, w = 0.2, h = 0.02): TextBox => ({ text, x, y, w, h });

describe('rowsFromBoxes', () => {
  it('puts a label and its amount on one line, and keeps lines in order', () => {
    const rows = rowsFromBoxes([
      box('250.00', 0.7, 0.502), box('TOTAL', 0.1, 0.5), box('JOLLIBEE', 0.3, 0.05), box('1 Chickenjoy', 0.1, 0.3), box('250.00', 0.7, 0.301),
      box('  ', 0.1, 0.9),
    ]);
    expect(rows).toEqual(['JOLLIBEE', '1 Chickenjoy  250.00', 'TOTAL  250.00']);
  });

  it('keeps a second page after the first', () => {
    expect(rowsFromBoxes([box('page two', 0.1, 1.1), box('page one', 0.1, 0.9)])).toEqual(['page one', 'page two']);
  });
});

// A fast-food receipt, a grocery one, and one with the amount read onto its own line.
const jollibee = [
  'JOLLIBEE', 'SM City North EDSA', 'VAT REG TIN 000-123-456-000', 'OFFICIAL RECEIPT', '1 C1 Chickenjoy  99.00', '1 Jolly Spaghetti  65.00', '1 Peach Mango Pie  39.00',
  'SUBTOTAL  203.00', 'VATable Sales  181.25', 'VAT 12%  21.75', 'TOTAL  203.00', 'CASH  500.00', 'CHANGE  297.00', 'Thank you!',
];
const grocery = [
  'OFFICIAL RECEIPT', 'PUREGOLD PRICE CLUB', '123 Main St. Quezon City', 'Tel 8123-4567', 'RICE 5KG  289.50', 'EGGS 12S  108.00', 'MILK 1L  96.75',
  'TOTAL ITEMS  3', 'SUB TOTAL  494.25', 'LESS DISCOUNT  20.00', 'AMOUNT DUE  474.25', 'TOTAL  494.25', 'CARD 4111 1111 1111 1111  474.25',
];

describe('totalOf', () => {
  it('takes the line that says total, not the subtotal, tax, cash or change', () => {
    expect(totalOf(jollibee)).toEqual({ total: 203, sure: true });
  });

  it('prefers "amount due" to a plain total, and ignores item counts and card lines', () => {
    expect(totalOf(grocery)).toEqual({ total: 474.25, sure: true });
  });

  it('reads an amount on the line below its label, and a whole amount on the label’s line', () => {
    expect(totalOf(['COFFEE SHOP', 'Latte  180.00', 'TOTAL DUE', '180.00', 'CASH', '200.00'])).toEqual({ total: 180, sure: true });
    expect(totalOf(['Haircut', 'TOTAL: P 1,250'])).toEqual({ total: 1250, sure: true });
  });

  it('reads thousands and either decimal mark', () => {
    expect(totalOf(['GRAND TOTAL  12,345.60'])).toEqual({ total: 12345.6, sure: true });
    expect(totalOf(['TOTAL  1 234,56'])).toEqual({ total: 1234.56, sure: true });
  });

  it('guesses the largest amount when nothing says total, leaving out cash and change', () => {
    expect(totalOf(['Latte  180.00', 'Muffin  95.00', 'CASH  500.00', 'CHANGE  225.00'])).toEqual({ total: 180, sure: false });
    expect(totalOf(['no amounts here', 'Tel 8123-4567'])).toBeNull();
  });
});

describe('shopOf', () => {
  it('finds the name near the top, past headings, addresses and numbers', () => {
    expect(shopOf(jollibee)).toBe('Jollibee');
    expect(shopOf(grocery)).toBe('Puregold Price Club');
    expect(shopOf(['12345', '***', 'SM SUPERMARKET', 'Makati'])).toBe('SM Supermarket');
    expect(shopOf(['7-ELEVEN', 'x'])).toBe('7-Eleven');
    expect(shopOf(['Kape’t Tinapay'])).toBe('Kape’t Tinapay');
    expect(shopOf(['KFC BGC', 'x'])).toBe('KFC BGC');
    expect(shopOf(['THE OLD BAR AND GRILL'])).toBe('The Old Bar And Grill');
    expect(shopOf(['000-111', '250.00'])).toBeUndefined();
  });
});

describe('what Bonbon gets', () => {
  it('blanks long runs of digits and keeps amounts', () => {
    const text = receiptTextForAi(grocery);
    expect(text).toContain('CARD #  474.25');
    expect(text).toContain('AMOUNT DUE  474.25');
    expect(receiptTextForAi(['TIN 000-123-456-000', 'Tel 0917 123 4567'])).toBe('TIN #\nTel #');
    expect(receiptTextForAi(Array.from({ length: 200 }, (_, i) => `line ${i}`)).split('\n')).toHaveLength(80);
  });

  it('is asked for JSON, with the categories to choose from', () => {
    const prompt = receiptPrompt(jollibee, [{ key: 'food', label: 'Food' }, { key: 'c-1', label: 'Pets' }]);
    expect(prompt).toContain('food (Food), c-1 (Pets)');
    expect(prompt).toContain('RECEIPT TEXT:\nJOLLIBEE');
  });
});

describe('parseReceiptReply', () => {
  const keys = ['food', 'transport'];

  it('reads the JSON, with or without wrapping around it', () => {
    expect(parseReceiptReply('{"total": 203, "shop": "Jollibee", "category": "food"}', keys)).toEqual({ total: 203, shop: 'Jollibee', category: 'food' });
    expect(parseReceiptReply('```json\n{"total": "₱1,203.50", "shop": " Jollibee ", "category": "food"}\n```', keys)).toEqual({ total: 1203.5, shop: 'Jollibee', category: 'food' });
  });

  it('tidies a shop name that comes back in capitals', () => {
    expect(parseReceiptReply('{"shop": "JOLLIBEE"}', keys)).toEqual({ shop: 'Jollibee' });
    expect(parseReceiptReply('{"shop": "KFC"}', keys)).toEqual({ shop: 'KFC' });
    expect(parseReceiptReply('{"shop": "McDonald\'s"}', keys)).toEqual({ shop: 'McDonald\'s' });
    expect(parseReceiptReply('{"shop": "***"}', keys)).toEqual({});
  });

  it('drops what isn’t shaped right', () => {
    expect(parseReceiptReply('{"total": null, "shop": null, "category": "pets"}', keys)).toEqual({});
    expect(parseReceiptReply('{"total": -5, "shop": 7}', keys)).toEqual({});
    expect(parseReceiptReply('Sorry, I can’t read that.', keys)).toBeNull();
    expect(parseReceiptReply('{broken', keys)).toBeNull();
  });
});

describe('fillFrom', () => {
  it('uses what the phone read when Bonbon isn’t asked', () => {
    expect(fillFrom(jollibee, null)).toEqual({ amount: 203, note: 'Jollibee', sure: true });
    expect(readReceipt(jollibee)).toEqual({ total: 203, sure: true, shop: 'Jollibee' });
  });

  it('takes Bonbon’s shop and category, and his total only when it’s printed on the receipt', () => {
    expect(fillFrom(grocery, { total: 474.25, shop: 'Puregold', category: 'food' })).toEqual({ amount: 474.25, note: 'Puregold', category: 'food', sure: true });
    // 4,742.50 isn't on the receipt, so the phone's reading stands.
    expect(fillFrom(grocery, { total: 4742.5, shop: 'Puregold' })).toMatchObject({ amount: 474.25, note: 'Puregold' });
  });

  it('says when the amount is only a guess, or missing', () => {
    expect(fillFrom(['Latte  180.00', 'Muffin  95.00'], null)).toEqual({ amount: 180, sure: false });
    expect(fillFrom(['CORNER CAFE', 'thanks'], null)).toEqual({ note: 'Corner Cafe', sure: false });
    // Bonbon's total settles a guess when it's printed there.
    expect(fillFrom(['Latte  180.00', 'Muffin  95.00', '275.00'], { total: 275 })).toEqual({ amount: 275, sure: true });
  });

  it('lists amounts and writes one for the number pad', () => {
    expect(amountsIn(['TOTAL  1,250', 'x 99.50'])).toEqual(expect.arrayContaining([1250, 99.5]));
    expect([203, 474.25, 1234.5, 99.999].map(amountText)).toEqual(['203', '474.25', '1234.5', '100']);
  });
});
