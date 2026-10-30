import { normalizePhoneForWhatsApp, generateWhatsAppUrl, generateWhatsAppWebUrl } from './whatsappUtils.js';

console.log('Testing WhatsApp JS utils...');

// 1. Phone number normalization
const phoneTests = [
  { input: '+91 98765 43210', expected: '919876543210' },
  { input: '9876543210', expected: '919876543210' },
  { input: '09876543210', expected: '919876543210' },
  { input: '919876543210', expected: '919876543210' },
  { input: '+9109876543210', expected: '919876543210' },
  { input: '00919876543210', expected: '919876543210' },
  { input: '+1 (555) 234-5678', expected: '15552345678' },
  { input: '15552345678', expected: '15552345678' }
];

for (const t of phoneTests) {
  const res = normalizePhoneForWhatsApp(t.input);
  if (!res.isValid || res.digits !== t.expected) {
    throw new Error('Failed normalization for ' + t.input + ': got ' + JSON.stringify(res));
  }
}

// 2. Invalid phones
const invalidPhones = ['123', 'phone', '', null, undefined, '1111111111', '1234567890'];
for (const inv of invalidPhones) {
  const res = normalizePhoneForWhatsApp(inv);
  if (res.isValid) {
    throw new Error('Expected invalid for ' + inv + ' but got valid');
  }
}

// 3. WhatsApp click-to-chat URL format
const message = 'Inquiry for Temperature Scanner\nModel: MS-801\nTarget Price: $120.00';
const waUrl = generateWhatsAppUrl('9876543210', message);
console.log('Sample wa.me URL:', waUrl);

if (!waUrl.startsWith('https://wa.me/919876543210?text=')) {
  throw new Error('Invalid URL prefix: ' + waUrl);
}
if (waUrl.split('?')[0].includes('+')) {
  throw new Error('Phone part must not contain +');
}
if (!waUrl.includes('%0A') || !waUrl.includes('%24120.00')) {
  throw new Error('Message not properly encodeURIComponent encoded');
}

// 4. WhatsApp Web URL format
const webUrl = generateWhatsAppWebUrl('9876543210', message);
console.log('Sample WhatsApp Web URL:', webUrl);
if (!webUrl.startsWith('https://web.whatsapp.com/send?phone=919876543210&text=')) {
  throw new Error('Invalid Web URL: ' + webUrl);
}

// 5. Empty message validation
let caught = false;
try {
  generateWhatsAppUrl('9876543210', '   ');
} catch (e) {
  caught = true;
}
if (!caught) throw new Error('Empty message was not rejected');

console.log('ALL JS UTILS TESTS PASSED SUCCESSFULLY!');
