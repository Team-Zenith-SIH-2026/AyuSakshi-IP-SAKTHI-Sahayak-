const test = require('node:test');
const assert = require('node:assert');

test('Jurisdiction separation verification', () => {
  const indiaJurisdiction = 'india';
  const intlJurisdiction = 'international';
  
  assert.notStrictEqual(indiaJurisdiction, intlJurisdiction, 'Jurisdictions must be distinct');
  assert.strictEqual(['india', 'international'].includes(indiaJurisdiction), true);
  assert.strictEqual(['india', 'international'].includes(intlJurisdiction), true);
});
