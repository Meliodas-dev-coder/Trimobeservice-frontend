// French "montant en toutes lettres" for Malagasy invoices (MGA = Ariary).
//
// Follows the local convention of pluralizing "mille" → "milles" when it carries
// a multiplier greater than one (e.g. "cinquante milles"). Set MILLE_PLURAL to
// false for the invariable standard-French spelling ("cinquante mille").
//
// The vingt/cent plural-"s" rules are applied: they take an "s" only when they
// end the number, and stay invariable before "mille" — so 200 000 is
// "deux cent mille", while 200 000 000 is "deux cents millions".
const MILLE_PLURAL = true;

const BELOW_20 = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

// noS suppresses the trailing plural "s" on vingt/cent (used when the group is a
// multiplier of "mille", where they stay invariable).
function below100(n, noS) {
  if (n < 20) return BELOW_20[n];
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens === 7) return unit === 1 ? 'soixante et onze' : `soixante-${BELOW_20[10 + unit]}`;
  if (tens === 8) {
    if (unit === 0) return noS ? 'quatre-vingt' : 'quatre-vingts';
    return `quatre-vingt-${BELOW_20[unit]}`;
  }
  if (tens === 9) return `quatre-vingt-${BELOW_20[10 + unit]}`;
  const word = TENS[tens];
  if (unit === 0) return word;
  if (unit === 1) return `${word} et un`;
  return `${word}-${BELOW_20[unit]}`;
}

function below1000(n, noS) {
  if (n < 100) return below100(n, noS);
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  let s;
  if (hundreds === 1) s = 'cent';
  else s = `${BELOW_20[hundreds]}${rem === 0 && !noS ? ' cents' : ' cent'}`;
  if (rem > 0) s += ` ${below100(rem, noS)}`;
  return s;
}

// frenchNumberToWords spells the integer part of a non-negative number.
export function frenchNumberToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'zéro';

  const milliards = Math.floor(n / 1000000000);
  n %= 1000000000;
  const millions = Math.floor(n / 1000000);
  n %= 1000000;
  const milliers = Math.floor(n / 1000);
  const rest = n % 1000;

  const parts = [];
  if (milliards > 0) parts.push(`${below1000(milliards, false)} ${milliards === 1 ? 'milliard' : 'milliards'}`);
  if (millions > 0) parts.push(`${below1000(millions, false)} ${millions === 1 ? 'million' : 'millions'}`);
  if (milliers > 0) {
    if (milliers === 1) parts.push('mille');
    else parts.push(`${below1000(milliers, true)} ${MILLE_PLURAL ? 'milles' : 'mille'}`);
  }
  if (rest > 0) parts.push(below1000(rest, false));
  return parts.join(' ');
}

// currencyInWords spells the currency name (MGA → "Ariary").
export function currencyInWords(code) {
  if (!code || String(code).toUpperCase() === 'MGA') return 'Ariary';
  return code;
}

// amountToFrenchWords → e.g. "trois millions cinquante milles Ariary".
export function amountToFrenchWords(value, currency) {
  const prefix = Number(value) < 0 ? 'moins ' : '';
  return `${prefix}${frenchNumberToWords(value)} ${currencyInWords(currency)}`;
}
