/**
 * Country flag emoji utilities
 * Converts country names to flag emojis using ISO 3166-1 alpha-2 codes
 */

/** Common country name to ISO 3166-1 alpha-2 code mapping */
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  // Americas
  'brazil': 'BR',
  'brasil': 'BR',
  'argentina': 'AR',
  'chile': 'CL',
  'colombia': 'CO',
  'peru': 'PE',
  'uruguay': 'UY',
  'united states': 'US',
  'usa': 'US',
  'us': 'US',
  'canada': 'CA',
  'mexico': 'MX',
  'costa rica': 'CR',
  'ecuador': 'EC',
  'venezuela': 'VE',
  'bolivia': 'BO',
  'paraguay': 'PY',

  // Europe
  'germany': 'DE',
  'deutschland': 'DE',
  'france': 'FR',
  'spain': 'ES',
  'españa': 'ES',
  'italy': 'IT',
  'italia': 'IT',
  'portugal': 'PT',
  'united kingdom': 'GB',
  'uk': 'GB',
  'england': 'GB',
  'netherlands': 'NL',
  'belgium': 'BE',
  'switzerland': 'CH',
  'austria': 'AT',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'poland': 'PL',
  'sweden': 'SE',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'greece': 'GR',
  'croatia': 'HR',
  'slovenia': 'SI',
  'romania': 'RO',
  'hungary': 'HU',
  'ireland': 'IE',
  'scotland': 'GB',
  'wales': 'GB',

  // Asia
  'japan': 'JP',
  'china': 'CN',
  'south korea': 'KR',
  'korea': 'KR',
  'taiwan': 'TW',
  'vietnam': 'VN',
  'thailand': 'TH',
  'indonesia': 'ID',
  'malaysia': 'MY',
  'philippines': 'PH',
  'singapore': 'SG',
  'india': 'IN',
  'nepal': 'NP',
  'iran': 'IR',
  'israel': 'IL',
  'turkey': 'TR',
  'türkiye': 'TR',
  'united arab emirates': 'AE',
  'uae': 'AE',
  'saudi arabia': 'SA',
  'qatar': 'QA',

  // Oceania
  'australia': 'AU',
  'new zealand': 'NZ',

  // Africa
  'south africa': 'ZA',
  'morocco': 'MA',
  'egypt': 'EG',
  'kenya': 'KE',
  'tanzania': 'TZ',
  'nigeria': 'NG',
};

/**
 * Canonical (preferred) country names for display
 * Maps lowercase variants to a single display name
 */
const CANONICAL_COUNTRY_NAMES: Record<string, string> = {
  // Americas
  'brazil': 'Brazil',
  'brasil': 'Brazil',
  'usa': 'USA',
  'us': 'USA',
  'united states': 'USA',
  
  // Europe
  'deutschland': 'Germany',
  'españa': 'Spain',
  'italia': 'Italy',
  'uk': 'UK',
  'united kingdom': 'UK',
  'england': 'UK',
  'scotland': 'UK',
  'wales': 'UK',
  'czech republic': 'Czechia',
  
  // Asia
  'korea': 'South Korea',
  'south korea': 'South Korea',
  'türkiye': 'Turkey',
  'uae': 'UAE',
  'united arab emirates': 'UAE',
};

/**
 * Normalize a country name to its canonical form
 * This ensures variants like "Brasil" and "Brazil" return the same name
 */
export function normalizeCountryName(countryName: string | undefined | null): string {
  if (!countryName) return '';
  
  const normalized = countryName.toLowerCase().trim();
  return CANONICAL_COUNTRY_NAMES[normalized] || countryName;
}


/**
 * Convert a 2-letter ISO country code to a flag emoji
 * Uses Unicode regional indicator symbols
 */
export function countryCodeToFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  const code = countryCode.toUpperCase();
  const offsetA = 0x1f1e6; // Regional Indicator Symbol Letter A
  const codePointA = 'A'.charCodeAt(0);

  const firstChar = code.charCodeAt(0) - codePointA + offsetA;
  const secondChar = code.charCodeAt(1) - codePointA + offsetA;

  return String.fromCodePoint(firstChar, secondChar);
}

/**
 * Get flag emoji from country name
 * Returns empty string if country is not recognized
 */
export function getCountryFlag(countryName: string | undefined | null): string {
  if (!countryName) {
    return '';
  }

  const normalized = countryName.toLowerCase().trim();
  const code = COUNTRY_NAME_TO_CODE[normalized];

  if (code) {
    return countryCodeToFlag(code);
  }

  // Try direct 2-letter code (in case country is already a code)
  if (normalized.length === 2) {
    return countryCodeToFlag(normalized);
  }

  return '';
}

/**
 * Get country code from country name
 */
export function getCountryCode(countryName: string | undefined | null): string | null {
  if (!countryName) {
    return null;
  }

  const normalized = countryName.toLowerCase().trim();
  return COUNTRY_NAME_TO_CODE[normalized] || null;
}
