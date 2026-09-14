// Convert an amount to Indian English words, e.g. ₹1,234.50 ->
// "One Thousand Two Hundred Thirty-Four Rupees and Fifty Paise Only".
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ' ' + ONES[o] : ''}`;
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let s = '';
  if (h) s += `${ONES[h]} Hundred`;
  if (rest) s += `${s ? ' ' : ''}${twoDigits(rest)}`;
  return s;
}

export function rupeesToWords(num) {
  const value = Math.abs(Number(num) || 0);
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);

  let words = '';
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  if (crore) words += `${twoDigits(crore)} Crore `;
  if (lakh) words += `${twoDigits(lakh)} Lakh `;
  if (thousand) words += `${twoDigits(thousand)} Thousand `;
  if (rest) words += threeDigits(rest);

  let out = words.trim() ? words.trim() : 'Zero';
  out += ' Rupees';
  if (paise) out += ` and ${twoDigits(paise)} Paise`;
  out += ' Only';

  return out;
}