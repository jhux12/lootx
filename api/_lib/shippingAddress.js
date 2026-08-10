const CODES = new Set(`AD AE AF AG AI AL AM AO AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' '));
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const LEGACY_COUNTRIES = { 'united states': 'US', usa: 'US', canada: 'CA', norway: 'NO', 'united kingdom': 'GB', uk: 'GB', australia: 'AU' };
export const normalizeAddress = (raw = {}) => ({ fullName: clean(raw.fullName, 120), street1: clean(raw.street1 ?? raw.street, 160), street2: clean(raw.street2, 160), city: clean(raw.city, 100), state: clean(raw.state, 100), postalCode: clean(raw.postalCode ?? raw.zipCode, 32), countryCode: clean(raw.countryCode || LEGACY_COUNTRIES[clean(raw.country, 80).toLowerCase()] || 'US', 2).toUpperCase(), phone: clean(raw.phone, 32) });
export const validateLocalAddress = (a) => {
  const messages = [];
  if (!a.fullName || !a.street1 || !a.city) messages.push('Name, address line 1, and city are required.');
  if (!CODES.has(a.countryCode)) messages.push('Select a recognized country.');
  if (['US', 'CA'].includes(a.countryCode) && !a.state) messages.push('State or province is required.');
  if (!a.postalCode) messages.push('Postal code is required.');
  if (a.countryCode === 'US' && !/^\d{5}(?:-\d{4})?$/.test(a.postalCode)) messages.push('Enter a valid US ZIP code.');
  if (a.countryCode === 'CA' && !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ][ -]?\d[ABCEGHJ-NPRSTVWXYZ]\d$/i.test(a.postalCode)) messages.push('Enter a valid Canadian postal code.');
  if (a.phone && !/^\+?[\d ()\-.]{7,25}$/.test(a.phone)) messages.push('Enter a valid phone number.');
  return messages;
};
export const toShippoAddress = (a) => ({ name: a.fullName, street1: a.street1, ...(a.street2 ? { street2: a.street2 } : {}), city: a.city, ...(a.state ? { state: a.state } : {}), zip: a.postalCode, country: a.countryCode, ...(a.phone ? { phone: a.phone } : {}) });
export const fromShippoAddress = (a = {}, fallback = {}) => normalizeAddress({ fullName: a.name ?? fallback.fullName, street1: a.street1, street2: a.street2, city: a.city, state: a.state, postalCode: a.zip, countryCode: a.country, phone: a.phone ?? fallback.phone });
