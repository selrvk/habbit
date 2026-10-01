import { parseLink } from '../src/links';

describe('parseLink', () => {
  it('opens screens', () => {
    expect(parseLink('habbit://')).toEqual({ screen: 'home' });
    expect(parseLink('habbit://habits')).toEqual({ screen: 'habits' });
    expect(parseLink('habbit://habits/new')).toEqual({ screen: 'new-habit' });
    expect(parseLink('habbit://habits/17591234567890abc')).toEqual({ screen: 'habit', id: '17591234567890abc' });
    expect(parseLink('habbit://finance')).toEqual({ screen: 'finance' });
    expect(parseLink('habbit://add-money')).toEqual({ screen: 'add-money' });
    expect(parseLink('habbit://recap')).toEqual({ screen: 'recap' });
    expect(parseLink('HABBIT://Coach')).toEqual({ screen: 'coach' });
    expect(parseLink('habbit://profile/')).toEqual({ screen: 'profile' });
  });

  it('fills in an expense', () => {
    expect(parseLink('habbit://spend')).toEqual({ screen: 'spend' });
    expect(parseLink('habbit://spend?amount=150&category=Food&note=Lunch%20with%20Ana'))
      .toEqual({ screen: 'spend', amount: '150', category: 'food', note: 'Lunch with Ana' });
    expect(parseLink('habbit://spend?amount=12.345&note=coffee+run')).toEqual({ screen: 'spend', amount: '12.35', note: 'coffee run' });
  });

  it('drops values it cannot use', () => {
    expect(parseLink('habbit://spend?amount=-4&category=rent&note=%E0%A4%A')).toEqual({ screen: 'spend' });
    expect(parseLink('habbit://spend?amount=abc')).toEqual({ screen: 'spend' });
    expect(parseLink(`habbit://spend?note=${'a'.repeat(100)}`)).toEqual({ screen: 'spend', note: 'a'.repeat(60) });
  });

  it('ignores other links', () => {
    expect(parseLink('https://example.com/spend')).toBeNull();
    expect(parseLink('habbit://delete-everything')).toBeNull();
    expect(parseLink('habbit://constructor')).toBeNull();
  });
});
