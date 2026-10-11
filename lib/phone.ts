import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

// The country a number without a "+" is read as, and the one the phone field starts on.
export const DEFAULT_PHONE_COUNTRY: CountryCode = "IN";

// "+<country><number>" for the phone field, which takes nothing else. Contacts saved before the
// field existed were typed freehand; "" when one of those cannot be read as a number.
export function toE164(phone: string): string {
  return parsePhoneNumberFromString(phone, DEFAULT_PHONE_COUNTRY)?.number ?? "";
}

// For reading: "+91 83569 46202". Only numbers saved with their country code are reformatted;
// guessing a country for a freehand one could show somebody else's number.
export function formatPhone(phone: string): string {
  if (!phone.trim().startsWith("+")) return phone;
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
}
