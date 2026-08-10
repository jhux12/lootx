export const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ');
const CODES = new Set(COUNTRY_CODES);
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const LEGACY_COUNTRIES = { 'united states': 'US', 'united states of america': 'US', usa: 'US', canada: 'CA', norway: 'NO', 'united kingdom': 'GB', 'great britain': 'GB', uk: 'GB', australia: 'AU', germany: 'DE', france: 'FR', japan: 'JP' };
const NO_POSTAL_CODE = new Set(['AO', 'AG', 'AW', 'BS', 'BZ', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CF', 'KM', 'CG', 'CD', 'CK', 'CI', 'DJ', 'DM', 'GQ', 'ER', 'FJ', 'TF', 'GM', 'GH', 'GD', 'GN', 'GY', 'HK', 'IE', 'JM', 'KE', 'KI', 'MO', 'MW', 'ML', 'MR', 'MU', 'MS', 'NR', 'NU', 'KP', 'PA', 'QA', 'RW', 'KN', 'LC', 'ST', 'SC', 'SL', 'SB', 'SO', 'SR', 'SY', 'TZ', 'TL', 'TG', 'TK', 'TO', 'TT', 'TV', 'UG', 'AE', 'VU', 'YE', 'ZW']);
const STATE_REQUIRED = new Set(['US', 'CA', 'AU']);

export const normalizeCountryCode = (value) => {
  const input = clean(value, 80);
  if (!input) return '';
  const code = LEGACY_COUNTRIES[input.toLowerCase()] ?? (input.length === 2 ? input.toUpperCase() : undefined);
  return code && CODES.has(code) ? code : input.toUpperCase();
};

export const countryAddressRules = (countryCode) => {
  const code = normalizeCountryCode(countryCode);
  return { stateRequired: STATE_REQUIRED.has(code), postalRequired: !NO_POSTAL_CODE.has(code) };
};

export const normalizeAddress = (raw = {}) => ({
  fullName: clean(raw.fullName ?? raw.name, 120),
  street1: clean(raw.street1 ?? raw.street ?? raw.address_line_1, 160),
  street2: clean(raw.street2 ?? raw.address_line_2, 160),
  city: clean(raw.city ?? raw.city_locality, 100),
  state: clean(raw.state ?? raw.state_province, 100),
  postalCode: clean(raw.postalCode ?? raw.zipCode ?? raw.zip ?? raw.postal_code, 32),
  countryCode: normalizeCountryCode(raw.countryCode ?? raw.country ?? raw.country_code),
  phone: clean(raw.phone, 32),
  email: clean(raw.email, 254)
});

export const validateLocalAddress = (address) => {
  const a = normalizeAddress(address); const rules = countryAddressRules(a.countryCode); const messages = [];
  if (!a.fullName) messages.push('Enter the recipient name.');
  if (!a.street1) messages.push('Enter an address.');
  if (!a.city) messages.push('Enter a city or locality.');
  if (!CODES.has(a.countryCode)) messages.push('Select a country.');
  if (rules.stateRequired && !a.state) messages.push('State or province is required for this destination.');
  if (rules.postalRequired && !a.postalCode) messages.push('Enter a postal code.');
  if (a.countryCode === 'US' && a.postalCode && !/^\d{5}(?:-\d{4})?$/.test(a.postalCode)) messages.push('Enter a valid US ZIP code.');
  if (a.countryCode === 'CA' && a.postalCode && !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ][ -]?\d[ABCEGHJ-NPRSTVWXYZ]\d$/i.test(a.postalCode)) messages.push('Enter a valid Canadian postal code.');
  if (a.phone && !/^\+?[\d ()\-.]{7,25}$/.test(a.phone)) messages.push('Enter a valid phone number, including its international calling code when applicable.');
  return messages;
};

export const toShippoAddress = (a) => ({ name: a.fullName, street1: a.street1, ...(a.street2 ? { street2: a.street2 } : {}), city: a.city, ...(a.state ? { state: a.state } : {}), ...(a.postalCode ? { zip: a.postalCode } : {}), country: normalizeCountryCode(a.countryCode), ...(a.phone ? { phone: a.phone } : {}), ...(a.email ? { email: a.email } : {}) });
export const fromShippoAddress = (a = {}, fallback = {}) => normalizeAddress({ fullName: a.name ?? fallback.fullName, street1: a.street1 ?? a.address_line_1 ?? fallback.street1, street2: a.street2 ?? a.address_line_2 ?? fallback.street2, city: a.city ?? a.city_locality ?? fallback.city, state: a.state ?? a.state_province ?? fallback.state, postalCode: a.zip ?? a.postal_code ?? fallback.postalCode, countryCode: a.country ?? a.country_code ?? fallback.countryCode, phone: a.phone ?? fallback.phone, email: a.email ?? fallback.email });

const definiteInvalidMessage = (message) => {
  const value = `${message?.code ?? ''} ${message?.type ?? ''} ${message?.text ?? message ?? ''}`.toLowerCase();
  return /(invalid|missing|required|not found|undeliverable|incomplete|unknown street|house number)/.test(value) && !/(not validated|could not validate|unable to validate|validation unavailable)/.test(value);
};

export const interpretShippoValidation = ({ validation = {}, countryCode, changed = false }) => {
  const messages = Array.isArray(validation.messages) ? validation.messages : [];
  if (validation.is_valid === true) return { status: changed ? 'corrected' : 'valid', messages };
  if (messages.some(definiteInvalidMessage)) return { status: 'invalid', messages };
  return { status: normalizeCountryCode(countryCode) === 'US' ? 'invalid' : 'inconclusive', messages };
};
