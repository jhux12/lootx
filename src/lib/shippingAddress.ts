import type { ShippingAddress } from '../../types';

export const COUNTRY_CODES = (`AD AE AF AG AI AL AM AO AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`).split(' ');

export const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

export const emptyShippingAddress = (): ShippingAddress => ({
  fullName: '', street1: '', street2: '', city: '', state: '', postalCode: '', countryCode: 'US',
  phone: '', validated: false, validationStatus: 'unvalidated', validatedAt: null, shippoAddressId: null
});

const legacyCountries: Record<string, string> = {
  'united states': 'US', usa: 'US', canada: 'CA', norway: 'NO', 'united kingdom': 'GB', uk: 'GB', australia: 'AU'
};

export const normalizeCountryCode = (value: unknown): string => {
  const input = String(value ?? '').trim();
  return legacyCountries[input.toLowerCase()] ?? input.toUpperCase();
};

export function normalizeStoredShippingAddress(value: unknown): ShippingAddress {
  const a = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const country = normalizeCountryCode(a.countryCode ?? a.country ?? 'US');
  return {
    fullName: String(a.fullName ?? ''), street1: String(a.street1 ?? a.street ?? ''), street2: String(a.street2 ?? ''),
    city: String(a.city ?? ''), state: String(a.state ?? ''), postalCode: String(a.postalCode ?? a.zipCode ?? ''),
    countryCode: COUNTRY_CODES.includes(country) ? country : 'US', phone: String(a.phone ?? ''),
    validated: a.validated === true, validationStatus: ['valid', 'corrected', 'inconclusive', 'invalid'].includes(String(a.validationStatus)) ? a.validationStatus as ShippingAddress['validationStatus'] : 'unvalidated',
    validatedAt: typeof a.validatedAt === 'string' ? a.validatedAt : null,
    shippoAddressId: typeof a.shippoAddressId === 'string' ? a.shippoAddressId : null
  };
}

export const countryAddressRules = (code: string) => ({
  cityLabel: code === 'GB' ? 'City / Town' : 'City',
  stateLabel: code === 'US' ? 'State' : code === 'CA' ? 'Province' : code === 'GB' ? 'County / Region' : 'State / Province / Region',
  postalLabel: code === 'US' ? 'ZIP Code' : code === 'GB' ? 'Postcode' : 'Postal Code',
  stateRequired: code === 'US' || code === 'CA' || code === 'AU', postalRequired: !['AO', 'AG', 'AW', 'BS', 'BZ', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CF', 'KM', 'CG', 'CD', 'CK', 'CI', 'DJ', 'DM', 'GQ', 'ER', 'FJ', 'TF', 'GM', 'GH', 'GD', 'GN', 'GY', 'HK', 'IE', 'JM', 'KE', 'KI', 'MO', 'MW', 'ML', 'MR', 'MU', 'MS', 'NR', 'NU', 'KP', 'PA', 'QA', 'RW', 'KN', 'LC', 'ST', 'SC', 'SL', 'SB', 'SO', 'SR', 'SY', 'TZ', 'TL', 'TG', 'TK', 'TO', 'TT', 'TV', 'UG', 'AE', 'VU', 'YE', 'ZW'].includes(code)
});

export function validateShippingAddress(address: ShippingAddress): Record<string, string> {
  const errors: Record<string, string> = {}; const rules = countryAddressRules(address.countryCode);
  if (!address.fullName.trim()) errors.fullName = 'Enter the recipient name.';
  if (!address.street1.trim()) errors.street1 = 'Enter an address.';
  if (!address.city.trim()) errors.city = 'Enter a city or town.';
  if (!COUNTRY_CODES.includes(address.countryCode)) errors.countryCode = 'Select a recognized country.';
  if (rules.stateRequired && !address.state?.trim()) errors.state = `Enter a ${rules.stateLabel.toLowerCase()}.`;
  if (rules.postalRequired && !address.postalCode.trim()) errors.postalCode = `Enter a ${rules.postalLabel.toLowerCase()}.`;
  if (address.countryCode === 'US' && !/^\d{5}(?:-\d{4})?$/.test(address.postalCode.trim())) errors.postalCode = 'Enter a valid US ZIP code.';
  if (address.countryCode === 'CA' && !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ][ -]?\d[ABCEGHJ-NPRSTVWXYZ]\d$/i.test(address.postalCode.trim())) errors.postalCode = 'Enter a valid Canadian postal code.';
  if (address.phone?.trim() && !/^\+?[\d ()\-.]{7,25}$/.test(address.phone.trim())) errors.phone = 'Enter a valid phone number.';
  return errors;
}
