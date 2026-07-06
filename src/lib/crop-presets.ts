// Crop presets — automatic irrigation thresholds based on the crop the
// farmer selects when registering a device. Values are typical Tanzanian
// smallholder agronomy ranges (FAO / TARI reference moisture %).
//
// target_moisture   = ideal volumetric soil moisture
// pump_on_threshold = lower bound (kiwango cha chini cha maji) — pump auto-on
// pump_off_threshold= upper bound (kiwango cha juu cha maji) — pump auto-off

export type CropPreset = {
  key: string;
  // Swahili display name (primary, since most users)
  name_sw: string;
  name_en: string;
  // Common Swahili/English synonyms used for matching free-text input
  aliases: string[];
  target_moisture: number;
  pump_on_threshold: number;
  pump_off_threshold: number;
};

export type CropMoisturePlan = CropPreset & {
  min_moisture: number;
  max_moisture: number;
  analysis_sw: string;
  analysis_en: string;
};

export const DEFAULT_CROP_PRESET_KEY = "mahindi";

export const CROP_PRESETS: CropPreset[] = [
  {
    key: "mahindi",
    name_sw: "Mahindi",
    name_en: "Maize",
    aliases: ["maize", "corn", "mhindi"],
    target_moisture: 45,
    pump_on_threshold: 30,
    pump_off_threshold: 55,
  },
  {
    key: "mpunga",
    name_sw: "Mpunga",
    name_en: "Rice (paddy)",
    aliases: ["rice", "paddy", "wali"],
    target_moisture: 70,
    pump_on_threshold: 55,
    pump_off_threshold: 80,
  },
  {
    key: "mtama",
    name_sw: "Mtama",
    name_en: "Sorghum",
    aliases: ["sorghum"],
    target_moisture: 35,
    pump_on_threshold: 22,
    pump_off_threshold: 45,
  },
  {
    key: "uwele",
    name_sw: "Uwele",
    name_en: "Millet",
    aliases: ["millet", "pearl millet"],
    target_moisture: 30,
    pump_on_threshold: 20,
    pump_off_threshold: 40,
  },
  {
    key: "ngano",
    name_sw: "Ngano",
    name_en: "Wheat",
    aliases: ["wheat"],
    target_moisture: 40,
    pump_on_threshold: 28,
    pump_off_threshold: 50,
  },
  {
    key: "maharage",
    name_sw: "Maharage",
    name_en: "Beans",
    aliases: ["beans", "common bean"],
    target_moisture: 45,
    pump_on_threshold: 32,
    pump_off_threshold: 55,
  },
  {
    key: "njegere",
    name_sw: "Njegere",
    name_en: "Peas",
    aliases: ["peas"],
    target_moisture: 45,
    pump_on_threshold: 32,
    pump_off_threshold: 55,
  },
  {
    key: "karanga",
    name_sw: "Karanga",
    name_en: "Groundnut",
    aliases: ["groundnut", "peanut", "njugu"],
    target_moisture: 40,
    pump_on_threshold: 28,
    pump_off_threshold: 50,
  },
  {
    key: "alizeti",
    name_sw: "Alizeti",
    name_en: "Sunflower",
    aliases: ["sunflower"],
    target_moisture: 40,
    pump_on_threshold: 26,
    pump_off_threshold: 50,
  },
  {
    key: "ufuta",
    name_sw: "Ufuta",
    name_en: "Sesame",
    aliases: ["sesame", "simsim"],
    target_moisture: 35,
    pump_on_threshold: 22,
    pump_off_threshold: 45,
  },
  {
    key: "muhogo",
    name_sw: "Muhogo",
    name_en: "Cassava",
    aliases: ["cassava", "mhogo"],
    target_moisture: 35,
    pump_on_threshold: 22,
    pump_off_threshold: 45,
  },
  {
    key: "viazi_mviringo",
    name_sw: "Viazi mviringo",
    name_en: "Irish potato",
    aliases: ["potato", "irish potato"],
    target_moisture: 55,
    pump_on_threshold: 40,
    pump_off_threshold: 65,
  },
  {
    key: "viazi_vitamu",
    name_sw: "Viazi vitamu",
    name_en: "Sweet potato",
    aliases: ["sweet potato"],
    target_moisture: 50,
    pump_on_threshold: 35,
    pump_off_threshold: 60,
  },
  {
    key: "nyanya",
    name_sw: "Nyanya",
    name_en: "Tomato",
    aliases: ["tomato", "tomatoes"],
    target_moisture: 60,
    pump_on_threshold: 45,
    pump_off_threshold: 70,
  },
  {
    key: "vitunguu",
    name_sw: "Vitunguu",
    name_en: "Onion",
    aliases: ["onion", "onions"],
    target_moisture: 55,
    pump_on_threshold: 40,
    pump_off_threshold: 65,
  },
  {
    key: "matango",
    name_sw: "Matango",
    name_en: "Cucumber",
    aliases: ["cucumber", "cucumbers"],
    target_moisture: 60,
    pump_on_threshold: 45,
    pump_off_threshold: 72,
  },
  {
    key: "bamia",
    name_sw: "Bamia",
    name_en: "Okra",
    aliases: ["okra", "lady finger"],
    target_moisture: 52,
    pump_on_threshold: 38,
    pump_off_threshold: 65,
  },
  {
    key: "biringanya",
    name_sw: "Biringanya",
    name_en: "Eggplant",
    aliases: ["eggplant", "aubergine"],
    target_moisture: 58,
    pump_on_threshold: 42,
    pump_off_threshold: 70,
  },
  {
    key: "karoti",
    name_sw: "Karoti",
    name_en: "Carrot",
    aliases: ["carrot", "carrots"],
    target_moisture: 55,
    pump_on_threshold: 40,
    pump_off_threshold: 65,
  },
  {
    key: "mchicha",
    name_sw: "Mchicha",
    name_en: "Amaranth",
    aliases: ["amaranth", "spinach", "greens"],
    target_moisture: 62,
    pump_on_threshold: 48,
    pump_off_threshold: 72,
  },
  {
    key: "lettuce",
    name_sw: "Letusi",
    name_en: "Lettuce",
    aliases: ["lettuce", "salad"],
    target_moisture: 65,
    pump_on_threshold: 50,
    pump_off_threshold: 75,
  },
  {
    key: "pilipili",
    name_sw: "Pilipili",
    name_en: "Chili / Pepper",
    aliases: ["chili", "pepper", "capsicum"],
    target_moisture: 55,
    pump_on_threshold: 42,
    pump_off_threshold: 65,
  },
  {
    key: "kabichi",
    name_sw: "Kabichi",
    name_en: "Cabbage",
    aliases: ["cabbage"],
    target_moisture: 65,
    pump_on_threshold: 50,
    pump_off_threshold: 75,
  },
  {
    key: "sukuma",
    name_sw: "Sukuma wiki",
    name_en: "Kale",
    aliases: ["kale", "collard", "sukuma wiki"],
    target_moisture: 60,
    pump_on_threshold: 45,
    pump_off_threshold: 70,
  },
  {
    key: "matikiti",
    name_sw: "Matikiti",
    name_en: "Watermelon",
    aliases: ["watermelon", "melon"],
    target_moisture: 55,
    pump_on_threshold: 40,
    pump_off_threshold: 65,
  },
  {
    key: "tikitimaji",
    name_sw: "Tikiti maji",
    name_en: "Watermelon",
    aliases: ["watermelon"],
    target_moisture: 55,
    pump_on_threshold: 40,
    pump_off_threshold: 65,
  },
  {
    key: "pamba",
    name_sw: "Pamba",
    name_en: "Cotton",
    aliases: ["cotton"],
    target_moisture: 40,
    pump_on_threshold: 28,
    pump_off_threshold: 50,
  },
  {
    key: "tumbaku",
    name_sw: "Tumbaku",
    name_en: "Tobacco",
    aliases: ["tobacco"],
    target_moisture: 50,
    pump_on_threshold: 38,
    pump_off_threshold: 60,
  },
  {
    key: "kahawa",
    name_sw: "Kahawa",
    name_en: "Coffee",
    aliases: ["coffee"],
    target_moisture: 50,
    pump_on_threshold: 35,
    pump_off_threshold: 65,
  },
  {
    key: "chai",
    name_sw: "Chai",
    name_en: "Tea",
    aliases: ["tea"],
    target_moisture: 65,
    pump_on_threshold: 50,
    pump_off_threshold: 75,
  },
  {
    key: "miwa",
    name_sw: "Miwa",
    name_en: "Sugarcane",
    aliases: ["sugarcane", "cane"],
    target_moisture: 60,
    pump_on_threshold: 45,
    pump_off_threshold: 75,
  },
  {
    key: "ndizi",
    name_sw: "Ndizi",
    name_en: "Banana",
    aliases: ["banana", "bananas"],
    target_moisture: 65,
    pump_on_threshold: 50,
    pump_off_threshold: 75,
  },
  {
    key: "mananasi",
    name_sw: "Mananasi",
    name_en: "Pineapple",
    aliases: ["pineapple"],
    target_moisture: 50,
    pump_on_threshold: 35,
    pump_off_threshold: 60,
  },
  {
    key: "embe",
    name_sw: "Embe",
    name_en: "Mango",
    aliases: ["mango"],
    target_moisture: 45,
    pump_on_threshold: 30,
    pump_off_threshold: 60,
  },
  {
    key: "parachichi",
    name_sw: "Parachichi",
    name_en: "Avocado",
    aliases: ["avocado"],
    target_moisture: 55,
    pump_on_threshold: 40,
    pump_off_threshold: 70,
  },
  {
    key: "machungwa",
    name_sw: "Machungwa",
    name_en: "Orange",
    aliases: ["orange", "citrus"],
    target_moisture: 50,
    pump_on_threshold: 35,
    pump_off_threshold: 65,
  },
  {
    key: "korosho",
    name_sw: "Korosho",
    name_en: "Cashew",
    aliases: ["cashew"],
    target_moisture: 35,
    pump_on_threshold: 22,
    pump_off_threshold: 50,
  },
];

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findCropPreset(input: string): CropPreset | null {
  const q = normalize(input);
  if (!q) return null;
  // exact match by name or alias
  for (const c of CROP_PRESETS) {
    if (
      normalize(c.name_sw) === q ||
      normalize(c.name_en) === q ||
      c.key === q ||
      c.aliases.some((a) => normalize(a) === q)
    )
      return c;
  }
  // partial / contains match
  for (const c of CROP_PRESETS) {
    if (
      normalize(c.name_sw).startsWith(q) ||
      normalize(c.name_en).startsWith(q) ||
      c.aliases.some((a) => normalize(a).startsWith(q))
    )
      return c;
  }
  return null;
}

export function getDefaultCropPreset(): CropPreset {
  return findCropPreset(DEFAULT_CROP_PRESET_KEY) ?? CROP_PRESETS[0];
}

export function getCropMoisturePlan(input: string): CropMoisturePlan {
  const preset = findCropPreset(input) ?? getDefaultCropPreset();
  return {
    ...preset,
    min_moisture: preset.pump_on_threshold,
    max_moisture: preset.pump_off_threshold,
    analysis_sw: `AI imeweka unyevu wa chini ${preset.pump_on_threshold}%, lengo ${preset.target_moisture}%, na juu ${preset.pump_off_threshold}% kwa ${preset.name_sw}.`,
    analysis_en: `AI set minimum moisture at ${preset.pump_on_threshold}%, target at ${preset.target_moisture}%, and maximum at ${preset.pump_off_threshold}% for ${preset.name_en}.`,
  };
}

function cleanMoisture(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function resolveCropMoistureSettings(
  crop: string | undefined,
  values?: {
    target_moisture?: unknown;
    pump_on_threshold?: unknown;
    pump_off_threshold?: unknown;
  },
) {
  const plan = getCropMoisturePlan(crop ?? "");
  let pump_on_threshold = cleanMoisture(values?.pump_on_threshold, plan.pump_on_threshold);
  let pump_off_threshold = cleanMoisture(values?.pump_off_threshold, plan.pump_off_threshold);
  let target_moisture = cleanMoisture(values?.target_moisture, plan.target_moisture);

  if (pump_on_threshold >= pump_off_threshold) {
    pump_on_threshold = plan.pump_on_threshold;
    pump_off_threshold = plan.pump_off_threshold;
  }

  if (target_moisture <= pump_on_threshold || target_moisture >= pump_off_threshold) {
    target_moisture = plan.target_moisture;
  }

  return {
    crop: crop?.trim() || plan.name_sw,
    target_moisture,
    pump_on_threshold,
    pump_off_threshold,
    moisture_plan: plan,
  };
}
