import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

// The country a number without a "+" is read as, and the one the phone field starts on.
export const DEFAULT_PHONE_COUNTRY: CountryCode = "IN";

// "+<country><number>" for the phone field, which takes nothing else. Contacts saved before the
// field existed were typed freehand; "" when one of those cannot be read as a number.
export function toE164(phone: string): string {
  return parsePhoneNumberFromString(phone, DEFAULT_PHONE_COUNTRY)?.number ?? "";
}

// Whether a number from the phone field ("+<country><number>") has the right number of digits for
// its country, so one left half typed fails. Freehand numbers saved before the field are let through.
export function isCompletePhone(phone: string): boolean {
  if (!phone.trim().startsWith("+")) return true;
  return parsePhoneNumberFromString(phone)?.isPossible() ?? false;
}

// For reading: "+91 83569 46202". Only numbers saved with their country code are reformatted;
// guessing a country for a freehand one could show somebody else's number.
export function formatPhone(phone: string): string {
  if (!phone.trim().startsWith("+")) return phone;
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
}
