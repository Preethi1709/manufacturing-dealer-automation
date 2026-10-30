/**
 * WhatsApp integration utilities for phone normalization and click-to-chat URL generation.
 * Follows WhatsApp official click-to-chat specifications (https://faq.whatsapp.com/591338728999884/).
 * Format: https://wa.me/<number>?text=<urlencodedtext>
 * The phone number must contain digits only, including country code, with no '+', spaces, or hyphens.
 */

/**
 * Normalizes a phone number to digits-only E.164 standard.
 * Special handling for Indian numbers (+91, 0 prefix, 10-digit mobile) without duplicating '91'.
 *
 * @param {string} rawPhone - Raw phone string from user input or supplier directory
 * @param {string} [defaultCountry='IN'] - Default country code if missing
 * @returns {{ isValid: boolean, digits: string, error: string }}
 */
export function normalizePhoneForWhatsApp(rawPhone, defaultCountry = 'IN') {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, digits: '', error: 'Supplier phone number is required for WhatsApp outreach.' };
  }
  let raw = rawPhone.trim();
  if (raw.toLowerCase().startsWith('tel:')) {
    raw = raw.slice(4).trim();
  }
  raw = raw.split('?')[0].trim();

  const hasPlus = raw.startsWith('+');
  const hasDoubleZero = raw.startsWith('00');
  let digits = raw.replace(/\D/g, '');

  if (!digits) {
    return { isValid: false, digits: '', error: 'Phone number must contain numeric digits.' };
  }

  // Reject dummy repeating numbers (e.g. 11111111) or sequential test patterns
  const uniqueDigits = new Set(digits.split(''));
  if (uniqueDigits.size <= 2 && digits.length >= 8) {
    return { isValid: false, digits, error: 'Invalid phone number: dummy or repeated digits detected.' };
  }
  if (['1234567890', '0123456789', '0987654321'].includes(digits)) {
    return { isValid: false, digits, error: 'Invalid phone number: sequential test numbers cannot be messaged.' };
  }

  // If starts with + or 00
  if (hasPlus || hasDoubleZero) {
    let d = hasDoubleZero ? digits.slice(2) : digits;
    // Strip redundant local trunk 0 in +91 0XXXXXXXXXX (13 digits starting with 910)
    if (d.startsWith('910') && d.length === 13) {
      d = '91' + d.slice(3);
    }
    if (d.length >= 8 && d.length <= 15) {
      return { isValid: true, digits: d, error: '' };
    }
    return { isValid: false, digits: d, error: `Invalid phone length (${d.length} digits). Expected 8 to 15 digits.` };
  }

  // Indian numbers:
  // 1. Starts with 910 and has 13 digits (e.g. 9109876543210 -> strip local trunk 0)
  if (digits.startsWith('910') && digits.length === 13) {
    digits = '91' + digits.slice(3);
  }
  // 2. Starts with 91 and has 12 digits (already international Indian) -> do NOT duplicate 91!
  if (digits.startsWith('91') && digits.length === 12 && '6789'.includes(digits[2])) {
    return { isValid: true, digits, error: '' };
  }
  // 3. Starts with 0 and has 11 digits (e.g. 09876543210) -> replace 0 with 91
  if (digits.startsWith('0') && digits.length === 11 && '6789'.includes(digits[1])) {
    return { isValid: true, digits: '91' + digits.slice(1), error: '' };
  }
  // 4. Indian landline STD with 0 (e.g. 022XXXXXXXX or 011XXXXXXXX)
  if (digits.startsWith('0') && (digits.length === 10 || digits.length === 11)) {
    return { isValid: true, digits: '91' + digits.slice(1), error: '' };
  }
  // 5. 10 digits Indian mobile starting with 6,7,8,9
  if (digits.length === 10 && '6789'.includes(digits[0])) {
    if (defaultCountry === 'IN') {
      return { isValid: true, digits: '91' + digits, error: '' };
    } else if (defaultCountry === 'US') {
      return { isValid: true, digits: '1' + digits, error: '' };
    }
  }
  // 6. US numbers: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1') && defaultCountry === 'US') {
    return { isValid: true, digits, error: '' };
  }
  // 7. General fallback for international numbers between 10 and 15 digits
  if (digits.length >= 10 && digits.length <= 15) {
    return { isValid: true, digits, error: '' };
  }

  return {
    isValid: false,
    digits,
    error: `Invalid phone number format: '${rawPhone}'. Please enter an international phone number with country code (e.g. +91 98765 43210 or +1 555 123 4567).`
  };
}

/**
 * Builds the official WhatsApp click-to-chat URL:
 * https://wa.me/INTERNATIONAL_NUMBER?text=ENCODED_MESSAGE
 *
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Message text to prefill
 * @returns {string} Fully formed wa.me URL
 */
export function generateWhatsAppUrl(phoneNumber, message) {
  const norm = normalizePhoneForWhatsApp(phoneNumber);
  if (!norm.isValid) {
    throw new Error(norm.error);
  }
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (!cleanMessage) {
    throw new Error('RFQ message body is empty. Please enter or generate the inquiry message before sending.');
  }
  const encodedText = encodeURIComponent(cleanMessage);
  return `https://wa.me/${norm.digits}?text=${encodedText}`;
}

/**
 * Builds direct WhatsApp Web URL for in-browser use:
 * https://web.whatsapp.com/send?phone=INTERNATIONAL_NUMBER&text=ENCODED_MESSAGE
 *
 * @param {string} phoneNumber - Phone number
 * @param {string} message - Message text to prefill
 * @returns {string} Direct web.whatsapp.com URL
 */
export function generateWhatsAppWebUrl(phoneNumber, message) {
  const norm = normalizePhoneForWhatsApp(phoneNumber);
  if (!norm.isValid) {
    throw new Error(norm.error);
  }
  const cleanMessage = typeof message === 'string' ? message.trim() : '';
  if (!cleanMessage) {
    throw new Error('RFQ message body is empty.');
  }
  const encodedText = encodeURIComponent(cleanMessage);
  return `https://web.whatsapp.com/send?phone=${norm.digits}&text=${encodedText}`;
}
