/**
 * Government ID types accepted for seller verification, per country.
 * `GLOBAL` types are offered to every country as a fallback.
 */

export type IdType = { value: string; label: string };

export const GLOBAL_IDS: IdType[] = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
];

export const COUNTRY_IDS: Record<string, IdType[]> = {
  IN: [
    { value: "aadhaar", label: "Aadhaar Card" },
    { value: "pan", label: "PAN Card" },
    { value: "voter_id", label: "Voter ID (EPIC)" },
    { value: "driving_licence_in", label: "Driving Licence" },
    { value: "passport_in", label: "Passport" },
  ],
  US: [
    { value: "ssn", label: "Social Security Number (SSN)" },
    { value: "state_id", label: "State ID Card" },
    { value: "drivers_license_us", label: "Driver's License" },
    { value: "passport_us", label: "US Passport" },
  ],
  GB: [
    { value: "uk_passport", label: "UK Passport" },
    { value: "uk_driving", label: "UK Driving Licence" },
    { value: "brp", label: "Biometric Residence Permit" },
    { value: "ni_number", label: "National Insurance Number" },
  ],
  CA: [
    { value: "ca_passport", label: "Canadian Passport" },
    { value: "sin", label: "Social Insurance Number (SIN)" },
    { value: "provincial_id", label: "Provincial ID / Driver's Licence" },
  ],
  AU: [
    { value: "au_passport", label: "Australian Passport" },
    { value: "medicare", label: "Medicare Card" },
    { value: "au_driving", label: "Driver Licence" },
  ],
  PK: [
    { value: "cnic", label: "CNIC" },
    { value: "nicop", label: "NICOP" },
    { value: "pk_passport", label: "Passport" },
  ],
  BD: [
    { value: "nid_bd", label: "National ID (NID)" },
    { value: "bd_passport", label: "Passport" },
  ],
  PH: [
    { value: "philsys", label: "PhilSys National ID" },
    { value: "umid", label: "UMID Card" },
    { value: "ph_passport", label: "Passport" },
  ],
  ID: [
    { value: "ktp", label: "KTP (e-ID)" },
    { value: "id_passport", label: "Passport" },
  ],
  NG: [
    { value: "nin", label: "National Identification Number (NIN)" },
    { value: "bvn", label: "Bank Verification Number (BVN)" },
    { value: "ng_passport", label: "Passport" },
  ],
  BR: [
    { value: "cpf", label: "CPF" },
    { value: "rg", label: "RG (Identity Card)" },
    { value: "br_passport", label: "Passport" },
  ],
  DE: [
    { value: "personalausweis", label: "Personalausweis (ID Card)" },
    { value: "de_passport", label: "Reisepass" },
  ],
  FR: [
    { value: "cni", label: "Carte Nationale d'Identité" },
    { value: "fr_passport", label: "Passeport" },
  ],
  AE: [
    { value: "emirates_id", label: "Emirates ID" },
    { value: "ae_passport", label: "Passport" },
  ],
  EG: [
    { value: "eg_nid", label: "National ID Card" },
    { value: "eg_passport", label: "Passport" },
  ],
  TR: [
    { value: "tc_kimlik", label: "T.C. Kimlik Card" },
    { value: "tr_passport", label: "Passport" },
  ],
  RU: [
    { value: "ru_internal", label: "Internal Passport" },
    { value: "ru_passport", label: "International Passport" },
  ],
  VN: [
    { value: "cccd", label: "Citizen Identity Card (CCCD)" },
    { value: "vn_passport", label: "Passport" },
  ],
};

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "AR", name: "Argentina" }, { code: "AU", name: "Australia" },
  { code: "BD", name: "Bangladesh" }, { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" }, { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" }, { code: "EG", name: "Egypt" },
  { code: "FR", name: "France" }, { code: "DE", name: "Germany" },
  { code: "IN", name: "India" }, { code: "ID", name: "Indonesia" },
  { code: "IT", name: "Italy" }, { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" }, { code: "MY", name: "Malaysia" },
  { code: "MX", name: "Mexico" }, { code: "NL", name: "Netherlands" },
  { code: "NG", name: "Nigeria" }, { code: "OTHER", name: "Other" },
  { code: "PK", name: "Pakistan" }, { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" }, { code: "RU", name: "Russia" },
  { code: "SA", name: "Saudi Arabia" }, { code: "SG", name: "Singapore" },
  { code: "ZA", name: "South Africa" }, { code: "KR", name: "South Korea" },
  { code: "ES", name: "Spain" }, { code: "SE", name: "Sweden" },
  { code: "TH", name: "Thailand" }, { code: "TR", name: "Turkey" },
  { code: "UA", name: "Ukraine" }, { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" },
  { code: "VN", name: "Vietnam" },
];

export const idTypesFor = (country: string): IdType[] => {
  const specific = COUNTRY_IDS[country] ?? [];
  const seen = new Set(specific.map((s) => s.label.toLowerCase()));
  return [...specific, ...GLOBAL_IDS.filter((g) => !seen.has(g.label.toLowerCase()))];
};

export const idLabel = (value: string) => {
  for (const list of [...Object.values(COUNTRY_IDS), GLOBAL_IDS])
    for (const t of list) if (t.value === value) return t.label;
  return value;
};

export const countryName = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.name ?? code;
