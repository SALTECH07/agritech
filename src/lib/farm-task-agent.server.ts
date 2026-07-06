type AgentMessage = { role: "user" | "assistant" | "system"; content: string };
type Lang = "sw" | "en";

type FarmTask =
  | "irrigation"
  | "disease"
  | "fertilizer"
  | "soil"
  | "planting"
  | "harvest"
  | "device"
  | "weather"
  | "weekly_plan"
  | "general";

type CropMatch = {
  en: string;
  sw: string;
  words: string[];
};

type FarmFacts = {
  crop: string | null;
  stage: string | null;
  moisture: number | null;
  ph: number | null;
  thresholds: {
    on: number | null;
    off: number | null;
  };
  hasDeviceData: boolean;
};

const CROPS: CropMatch[] = [
  { en: "tomato", sw: "nyanya", words: ["tomato", "tomatoes", "nyanya"] },
  { en: "maize", sw: "mahindi", words: ["maize", "corn", "mahindi"] },
  { en: "rice", sw: "mpunga", words: ["rice", "mpunga"] },
  { en: "beans", sw: "maharage", words: ["beans", "bean", "maharage"] },
  { en: "onion", sw: "kitunguu", words: ["onion", "onions", "kitunguu", "vitunguu"] },
  { en: "cabbage", sw: "kabichi", words: ["cabbage", "kabichi"] },
  { en: "pepper", sw: "pilipili", words: ["pepper", "chilli", "chili", "pilipili"] },
  { en: "watermelon", sw: "tikiti maji", words: ["watermelon", "tikiti"] },
  { en: "cucumber", sw: "tango", words: ["cucumber", "tango"] },
  { en: "sweet potato", sw: "viazi vitamu", words: ["sweet potato", "viazi vitamu"] },
  { en: "potato", sw: "viazi", words: ["potato", "potatoes", "viazi"] },
  { en: "banana", sw: "ndizi", words: ["banana", "ndizi"] },
  { en: "cassava", sw: "muhogo", words: ["cassava", "muhogo"] },
  { en: "sunflower", sw: "alizeti", words: ["sunflower", "alizeti"] },
  { en: "groundnut", sw: "karanga", words: ["groundnut", "peanut", "karanga"] },
  { en: "sesame", sw: "ufuta", words: ["sesame", "ufuta"] },
  { en: "coffee", sw: "kahawa", words: ["coffee", "kahawa"] },
  { en: "tea", sw: "chai", words: ["tea", "chai"] },
  { en: "cotton", sw: "pamba", words: ["cotton", "pamba"] },
  { en: "sugarcane", sw: "miwa", words: ["sugarcane", "sugar cane", "miwa"] },
  { en: "avocado", sw: "parachichi", words: ["avocado", "parachichi"] },
  { en: "mango", sw: "embe", words: ["mango", "embe"] },
  { en: "citrus", sw: "michungwa", words: ["orange", "citrus", "chungwa", "michungwa"] },
  { en: "spinach", sw: "mchicha", words: ["spinach", "mchicha"] },
  { en: "okra", sw: "bamia", words: ["okra", "bamia"] },
  { en: "eggplant", sw: "bilinganya", words: ["eggplant", "aubergine", "bilinganya"] },
  { en: "carrot", sw: "karoti", words: ["carrot", "karoti"] },
];

function lastUserMessage(messages: AgentMessage[]) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i].content.trim();
  }
  return "";
}

function detectTask(text: string): FarmTask {
  const q = text.toLowerCase();
  if (
    /(disease|pest|insect|fung|blight|wilt|rot|spots?|yellow|majani|leaf|wadudu|ugonjwa|madoa|kuoza|kunyauka)/.test(
      q,
    )
  ) {
    return "disease";
  }
  if (/(irrigat|water|pump|moisture|dry|wet|unyevu|mwagil|pampu|maji)/.test(q)) {
    return "irrigation";
  }
  if (
    /(fertiliz|mbolea|nutrient|nitrogen|phosph|potassium|npk|manure|compost|urea|dap|can)/.test(q)
  ) {
    return "fertilizer";
  }
  if (/(soil|ph|ec|salinity|organic matter|udongo|rutuba|chumvi)/.test(q)) {
    return "soil";
  }
  if (/(plant|sow|seed|germinat|nursery|transplant|spacing|panda|mbegu|kitalu|hamishia)/.test(q)) {
    return "planting";
  }
  if (/(harvest|storage|post.?harvest|market|mavuno|hifadhi|kuuza|soko)/.test(q)) {
    return "harvest";
  }
  if (/(weather|rain|mvua|joto|forecast|upepo|humidity|hali ya hewa)/.test(q)) {
    return "weather";
  }
  if (
    /(device|sensor|api|controller|microcontroller|kifaa|gps|telemetry|reading|device data|sensor data)/.test(
      q,
    )
  ) {
    return "device";
  }
  if (/(week|wiki|schedule|ratiba|calendar|mpango wa wiki)/.test(q)) {
    return "weekly_plan";
  }
  return "general";
}

function hasDeviceData(deviceContext?: string) {
  if (!deviceContext) return false;
  return !/(hana kifaa|no device|hakuna vipimo bado|no readings yet)/i.test(deviceContext);
}

function extractNumber(text: string | undefined, patterns: RegExp[]) {
  if (!text) return null;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }
  return null;
}

function extractMoisture(question: string, deviceContext?: string) {
  return (
    extractNumber(question, [
      /(?:soil\s*)?moisture[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
      /unyevu[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
    ]) ??
    extractNumber(deviceContext, [
      /(?:soil_moisture|soil moisture|unyevu udongo)=?([0-9]+(?:\.[0-9]+)?)%?/i,
    ])
  );
}

function extractSoilPh(question: string, deviceContext?: string) {
  return (
    extractNumber(question, [
      /(?:soil\s*)?pH[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)/i,
      /udongo[^0-9]{0,12}pH[^0-9]{0,12}([0-9]+(?:\.[0-9]+)?)/i,
    ]) ?? extractNumber(deviceContext, [/(?:soil_ph|soil pH|pH)=?([0-9]+(?:\.[0-9]+)?)/i])
  );
}

function extractThresholds(question: string, deviceContext?: string) {
  const text = `${question}\n${deviceContext ?? ""}`;
  const on = extractNumber(text, [
    /pump_on\s*<?\s*([0-9]+(?:\.[0-9]+)?)%?/i,
    /pump on[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
    /minimum moisture[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
    /min moisture[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
  ]);
  const off = extractNumber(text, [
    /pump_off\s*>?\s*([0-9]+(?:\.[0-9]+)?)%?/i,
    /pump off[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
    /maximum moisture[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
    /max moisture[^0-9]{0,20}([0-9]+(?:\.[0-9]+)?)%?/i,
  ]);
  return { on, off };
}

function extractCrop(question: string, lang: Lang) {
  const q = question.toLowerCase();
  const crop = CROPS.find((entry) =>
    entry.words.some((word) =>
      new RegExp(`(^|[^a-z])${word.replace(/\s+/g, "\\s+")}([^a-z]|$)`, "i").test(q),
    ),
  );
  if (!crop) return null;
  return lang === "sw" ? crop.sw : crop.en;
}

function extractStage(question: string, lang: Lang) {
  const q = question.toLowerCase();
  const stageMap: Array<{ en: string; sw: string; words: string[] }> = [
    { en: "nursery", sw: "kitalu", words: ["nursery", "kitalu"] },
    { en: "germination", sw: "kuota", words: ["germination", "germinating", "kuota"] },
    { en: "seedling", sw: "mche mdogo", words: ["seedling", "seedlings", "mche"] },
    { en: "vegetative growth", sw: "ukuaji wa majani", words: ["vegetative", "majani"] },
    { en: "flowering", sw: "kutoa maua", words: ["flowering", "flower", "maua"] },
    { en: "fruiting", sw: "kutengeneza matunda", words: ["fruiting", "fruit", "matunda"] },
    { en: "maturity", sw: "kukomaa", words: ["maturity", "mature", "kukomaa"] },
    { en: "harvest", sw: "mavuno", words: ["harvest", "mavuno"] },
  ];
  const stage = stageMap.find((entry) => entry.words.some((word) => q.includes(word)));
  if (!stage) return null;
  return lang === "sw" ? stage.sw : stage.en;
}

function buildFacts(question: string, lang: Lang, deviceContext?: string): FarmFacts {
  return {
    crop: extractCrop(question, lang),
    stage: extractStage(question, lang),
    moisture: extractMoisture(question, deviceContext),
    ph: extractSoilPh(question, deviceContext),
    thresholds: extractThresholds(question, deviceContext),
    hasDeviceData: hasDeviceData(deviceContext),
  };
}

function enBasis(facts: FarmFacts) {
  return [
    facts.crop ? `crop: ${facts.crop}` : "crop: not specified",
    facts.stage ? `stage: ${facts.stage}` : "stage: not specified",
    facts.moisture === null ? "soil moisture: not available" : `soil moisture: ${facts.moisture}%`,
    facts.ph === null ? "soil pH: not available" : `soil pH: ${facts.ph}`,
    facts.thresholds.on === null ? "pump_on: not available" : `pump_on: <${facts.thresholds.on}%`,
    facts.thresholds.off === null
      ? "pump_off: not available"
      : `pump_off: >${facts.thresholds.off}%`,
  ].join("; ");
}

function swBasis(facts: FarmFacts) {
  return [
    facts.crop ? `zao: ${facts.crop}` : "zao: halijatajwa",
    facts.stage ? `hatua: ${facts.stage}` : "hatua: haijatajwa",
    facts.moisture === null ? "soil moisture: haipo" : `soil moisture: ${facts.moisture}%`,
    facts.ph === null ? "pH ya udongo: haipo" : `pH ya udongo: ${facts.ph}`,
    facts.thresholds.on === null ? "pump_on: haipo" : `pump_on: <${facts.thresholds.on}%`,
    facts.thresholds.off === null ? "pump_off: haipo" : `pump_off: >${facts.thresholds.off}%`,
  ].join("; ");
}

function phAdvice(ph: number | null, lang: Lang) {
  if (ph === null) {
    return lang === "sw"
      ? "Pima pH ya udongo kabla ya kuweka dozi kubwa ya mbolea."
      : "Measure soil pH before applying a heavy fertilizer dose.";
  }
  if (ph < 5.5) {
    return lang === "sw"
      ? `pH ${ph} ni tindikali; P, Ca, Mg na baadhi ya virutubisho vinaweza kufungwa. Fikiria ushauri wa chokaa baada ya soil test.`
      : `pH ${ph} is acidic; P, Ca, Mg, and some nutrients can become less available. Consider lime advice after a soil test.`;
  }
  if (ph > 7.5) {
    return lang === "sw"
      ? `pH ${ph} iko juu; micronutrients kama Fe, Zn na Mn zinaweza kupungua kupatikana. Tumia mbolea kwa uangalifu na fuata soil test.`
      : `pH ${ph} is high; micronutrients like Fe, Zn, and Mn may become less available. Use fertilizer carefully and follow a soil test.`;
  }
  return lang === "sw"
    ? `pH ${ph} iko karibu na range nzuri kwa mazao mengi; endelea kutumia soil test kuamua N, P na K.`
    : `pH ${ph} is near a useful range for many crops; still use a soil test to decide N, P, and K.`;
}

function moistureAdvice(facts: FarmFacts, lang: Lang) {
  const { moisture, thresholds } = facts;
  if (moisture === null) {
    return lang === "sw"
      ? "Sina soil moisture ya sasa; pima udongo sentimita 5-10 chini au refresh sensor."
      : "I do not have current soil moisture; probe soil at 5-10 cm depth or refresh the sensor.";
  }
  if (thresholds.on !== null && moisture < thresholds.on) {
    return lang === "sw"
      ? `Soil moisture ${moisture}% iko chini ya pump_on ${thresholds.on}%; mwagilia kwa pulse fupi kisha pima tena.`
      : `Soil moisture ${moisture}% is below pump_on ${thresholds.on}%; irrigate in a short pulse, then recheck.`;
  }
  if (thresholds.off !== null && moisture > thresholds.off) {
    return lang === "sw"
      ? `Soil moisture ${moisture}% iko juu ya pump_off ${thresholds.off}%; usimwagilie sasa ili kuepuka waterlogging.`
      : `Soil moisture ${moisture}% is above pump_off ${thresholds.off}%; do not irrigate now to avoid waterlogging.`;
  }
  return lang === "sw"
    ? `Soil moisture ${moisture}% iko ndani au karibu na target; fuatilia kabla ya kuwasha pampu.`
    : `Soil moisture ${moisture}% is inside or near the target range; monitor before switching the pump on.`;
}

function enPlan(task: FarmTask, question: string, deviceContext?: string) {
  const facts = buildFacts(question, "en", deviceContext);
  const basis = enBasis(facts);
  const crop = facts.crop ?? "the crop";
  const stage = facts.stage ?? "the current growth stage";
  const nextWithData = facts.hasDeviceData
    ? "Refresh the device after 30-60 minutes and compare the new reading with the field observation."
    : "Add device readings or tell me crop, stage, moisture, pH, and symptoms so I can make the next answer more exact.";

  const plans: Record<FarmTask, string> = {
    irrigation: `**Task:** Irrigation decision for ${crop}.

**Data used:** ${basis}.

**Technical interpretation:** ${moistureAdvice(facts, "en")} For water volume, 1 mm over 1 m2 equals 1 L.

**Action now:** If the root zone is dry, irrigate in short cycles, stop before runoff, and wait for water to move down before repeating.

**Check:** Probe 5-10 cm deep, confirm the sensor after 30-60 minutes, and avoid standing water around roots.

**Next:** ${nextWithData}`,
    disease: `**Task:** Pest or disease diagnosis for ${crop}.

**Data used:** ${basis}.

**Technical interpretation:** A good diagnosis needs symptom pattern, affected plant percentage, leaf underside checks, humidity/rain history, and ${stage}. Use IPM before pesticide.

**Action now:** Scout at least 20 plants in a W pattern. Record spots, yellowing, wilting, insect eggs, stem damage, and severity from 0-5.

**Check:** Photograph upper leaf, lower leaf, stem, fruit, and root zone. Avoid overhead watering if fungal disease is possible.

**Next:** Tell me the crop, symptom color/shape, and how many plants are affected. Follow pesticide labels or a local agronomist before spraying.`,
    fertilizer: `**Task:** Fertilizer plan for ${crop}.

**Data used:** ${basis}.

**Technical interpretation:** Fertilizer depends on ${stage}, soil pH, soil test, leaf color, and demand for N, P, K, Ca, Mg, and micronutrients. ${phAdvice(facts.ph, "en")}

**Action now:** Do not use one blanket dose. Use a split application near the root zone, water lightly after application, and avoid fertilizer touching stems.

**Check:** Watch leaf color, new growth, root activity, and leaf-edge burn for 3-5 days.

**Next:** Tell me available fertilizer names and the crop age; I can turn this into a step-by-step schedule.`,
    soil: `**Task:** Soil health check for ${crop}.

**Data used:** ${basis}.

**Technical interpretation:** ${phAdvice(facts.ph, "en")} Soil structure, organic matter, drainage, EC/salinity, and compaction also control root growth.

**Action now:** Take soil from 5-15 cm depth in 5-10 points, mix it, and test pH. If soil is hard, add organic matter and reduce traffic when wet.

**Check:** After irrigation, water should enter the soil without ponding for long. Roots should be white/cream, not black and rotten.

**Next:** Share pH, soil texture, and crop problem so I can give a soil correction plan.`,
    planting: `**Task:** Planting or crop establishment for ${crop}.

**Data used:** ${basis}.

**Technical interpretation:** Good establishment depends on seed quality, nursery hygiene, spacing, soil moisture, and transplant timing.

**Action now:** Plant into moist soil, keep the nursery clean, avoid overcrowding, and transplant during cool hours to reduce stress.

**Check:** Count germination after 5-10 days depending on crop, remove weak seedlings, and watch damping-off disease.

**Next:** Tell me crop, seed age, spacing, and field size so I can calculate a planting plan.`,
    harvest: `**Task:** Harvest and post-harvest handling for ${crop}.

**Data used:** ${basis}.

**Technical interpretation:** Harvest timing depends on maturity stage, market distance, temperature, and expected shelf life.

**Action now:** Harvest during cool hours, sort damaged produce, keep produce shaded, and avoid rough handling.

**Check:** Record harvest kg, rejected kg, price, and storage losses so the farm can improve profit next cycle.

**Next:** Tell me crop and market date so I can advise harvest maturity and handling.`,
    device: `**Task:** Device and data setup.

**Data used:** ${basis}.

**Technical interpretation:** The controller should send timestamped telemetry such as soil_moisture %, soil_ph, air_temp deg C, air_humidity RH%, water_level %, and pump_on status.

**Action now:** Create the device, copy the generated Device Key and Send readings API URL, then send one JSON test reading with the X-API-Key header.

**Check:** Confirm the device page changes from offline to online and the latest reading updates.

**Next:** If readings fail, check Wi-Fi, API URL, Device Key, payload field names, and the controller serial monitor.`,
    weather: `**Task:** Weather-based farm action for ${crop}.

**Data used:** ${basis}.

**Technical interpretation:** Irrigation, fertilizer, and spraying depend on rainfall in mm, temperature, wind, relative humidity, and ${stage}.

**Action now:** Delay spraying before rain or during strong wind. If hot and dry, check soil moisture early morning and late afternoon.

**Check:** Keep fertilizer off leaves during hot midday conditions and avoid irrigation that leaves leaves wet overnight.

**Next:** Tell me district, crop, and today's forecast if you want a weather-specific plan.`,
    weekly_plan: `**Task:** Weekly farming plan for ${crop}.

**Data used:** ${basis}.

**Today:** Record soil moisture %, pH, crop stage, leaf color, pests, pump status, rainfall, and any fertilizer used.

**Midweek:** Irrigate only when moisture drops below the crop threshold. Scout 20 plants and compare sensor data with field soil feel.

**End of week:** Record growth, disease pressure, irrigation time, costs, harvest, and sales.

**Next:** ${nextWithData}`,
    general: `**Task:** Farming-sector answer.

**Data used:** ${basis}.

**Technical interpretation:** I will keep the answer inside farming. Your question is: "${question || "farm advice"}". The best technical answer needs crop, stage, soil moisture %, pH, weather, and visible symptoms.

**Action now:** Check the crop leaves, soil moisture, pH if available, pump/device status, and recent rain.

**Check:** Write down crop, field location, crop age, sensor values, and the problem you see.

**Next:** Ask the exact farming task, for example irrigation, fertilizer, disease, planting, harvest, weather, or device setup.`,
  };

  return plans[task];
}

function swPlan(task: FarmTask, question: string, deviceContext?: string) {
  const facts = buildFacts(question, "sw", deviceContext);
  const basis = swBasis(facts);
  const crop = facts.crop ?? "zao";
  const stage = facts.stage ?? "hatua ya sasa ya ukuaji";
  const nextWithData = facts.hasDeviceData
    ? "Refresh kifaa baada ya dakika 30-60 na linganisha kipimo kipya na hali ya shambani."
    : "Ongeza vipimo vya kifaa au niambie zao, hatua, soil moisture, pH na dalili ili jibu lijalo liwe sahihi zaidi.";

  const plans: Record<FarmTask, string> = {
    irrigation: `**Kazi:** Uamuzi wa umwagiliaji kwa ${crop}.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** ${moistureAdvice(facts, "sw")} Kwa hesabu ya maji, 1 mm juu ya 1 m2 ni takriban 1 L.

**Fanya sasa:** Kama mizizi iko kwenye ukame, mwagilia kwa mizunguko mifupi, simamisha kabla maji hayajatiririka, kisha subiri maji yashuke.

**Kagua:** Pima udongo sentimita 5-10 chini, angalia sensor baada ya dakika 30-60, na epuka maji kusimama kwenye mizizi.

**Kifuatacho:** ${nextWithData}`,
    disease: `**Kazi:** Uchunguzi wa wadudu au ugonjwa kwa ${crop}.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** Utambuzi mzuri unahitaji muonekano wa dalili, asilimia ya mimea iliyoathirika, ukaguzi wa chini ya majani, historia ya mvua/unyevu, na ${stage}. Tumia IPM kabla ya dawa.

**Fanya sasa:** Kagua angalau mimea 20 kwa mpangilio wa W. Andika madoa, njano, kunyauka, mayai ya wadudu, uharibifu wa shina, na severity 0-5.

**Kagua:** Piga picha juu/chini ya jani, shina, tunda, na eneo la mizizi. Epuka kumwagilia juu ya majani kama ugonjwa wa fangasi unawezekana.

**Kifuatacho:** Niambie zao, rangi/umbo la dalili, na mimea mingapi imeathirika. Fuata lebo ya dawa au mtaalamu wa kilimo kabla ya kupuliza.`,
    fertilizer: `**Kazi:** Mpango wa mbolea kwa ${crop}.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** Mbolea hutegemea ${stage}, pH ya udongo, soil test, rangi ya majani, na mahitaji ya N, P, K, Ca, Mg na micronutrients. ${phAdvice(facts.ph, "sw")}

**Fanya sasa:** Usitumie dozi moja kubwa kwa shamba lote bila kupima. Tumia split application karibu na mizizi, mwagilia kidogo baada ya kuweka, na epuka mbolea kugusa shina.

**Kagua:** Angalia rangi ya majani, ukuaji mpya, mizizi, na kuchomeka kingo za majani kwa siku 3-5.

**Kifuatacho:** Niambie majina ya mbolea ulizonazo na umri wa zao; nitakutengenezea ratiba ya hatua kwa hatua.`,
    soil: `**Kazi:** Ukaguzi wa afya ya udongo kwa ${crop}.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** ${phAdvice(facts.ph, "sw")} Muundo wa udongo, organic matter, drainage, EC/salinity, na compaction pia vinaamua ukuaji wa mizizi.

**Fanya sasa:** Chukua udongo sentimita 5-15 chini kutoka sehemu 5-10, changanya, kisha pima pH. Kama udongo ni mgumu, ongeza organic matter na punguza kutembea shambani udongo ukiwa na maji.

**Kagua:** Baada ya kumwagilia, maji yaingie ardhini bila kusimama muda mrefu. Mizizi iwe nyeupe/cream, isiwe nyeusi na kuoza.

**Kifuatacho:** Tuma pH, aina ya udongo, na tatizo la zao ili nitoe mpango wa kurekebisha udongo.`,
    planting: `**Kazi:** Kupanda au kuanzisha ${crop}.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** Uotaji mzuri hutegemea ubora wa mbegu, usafi wa kitalu, nafasi ya kupanda, soil moisture, na muda sahihi wa kuhamishia miche.

**Fanya sasa:** Panda kwenye udongo wenye unyevu, weka kitalu safi, epuka msongamano, na hamishia miche wakati wa ubaridi ili kupunguza stress.

**Kagua:** Hesabu uotaji baada ya siku 5-10 kulingana na zao, ondoa miche dhaifu, na angalia damping-off.

**Kifuatacho:** Niambie zao, umri wa mbegu, spacing, na ukubwa wa shamba ili nihesabu mpango wa kupanda.`,
    harvest: `**Kazi:** Mavuno na uhifadhi kwa ${crop}.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** Muda wa kuvuna hutegemea hatua ya kukomaa, umbali wa soko, joto, na muda wa kuhifadhi.

**Fanya sasa:** Vuna wakati wa ubaridi, tenga mazao yaliyoharibika, weka kivulini, na epuka kubamiza mazao.

**Kagua:** Andika kg zilizovunwa, kg zilizokataliwa, bei, na hasara za uhifadhi ili kuboresha faida msimu ujao.

**Kifuatacho:** Niambie zao na siku ya soko ili nitoe ushauri wa ukomavu na handling.`,
    device: `**Kazi:** Setup ya kifaa na data.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** Controller itume telemetry yenye soil_moisture %, soil_ph, air_temp deg C, air_humidity RH%, water_level %, na pump_on status.

**Fanya sasa:** Tengeneza kifaa, nakili Device Key na Send readings API URL, kisha tuma JSON test reading yenye X-API-Key header.

**Kagua:** Hakikisha ukurasa wa kifaa unatoka offline kwenda online na latest reading inabadilika.

**Kifuatacho:** Kama readings hazifiki, kagua Wi-Fi, API URL, Device Key, field names za payload, na Serial Monitor ya controller.`,
    weather: `**Kazi:** Hatua ya shamba kulingana na hali ya hewa kwa ${crop}.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** Umwagiliaji, mbolea, na kupuliza hutegemea mvua kwa mm, joto, upepo, relative humidity, na ${stage}.

**Fanya sasa:** Chelewesha kupuliza kama mvua inakaribia au kuna upepo mkali. Kama kuna joto na ukame, pima soil moisture asubuhi na jioni.

**Kagua:** Usiache mbolea kwenye majani wakati wa jua kali na epuka kumwagilia kiasi cha kuacha majani yakiwa na maji usiku.

**Kifuatacho:** Niambie wilaya, zao, na forecast ya leo kama unataka mpango wa hali ya hewa.`,
    weekly_plan: `**Kazi:** Mpango wa wiki kwa ${crop}.

**Data iliyotumika:** ${basis}.

**Leo:** Andika soil moisture %, pH, hatua ya zao, rangi ya majani, wadudu, hali ya pampu, mvua, na mbolea iliyotumika.

**Katikati ya wiki:** Mwagilia tu kama moisture imeshuka chini ya threshold ya zao. Kagua mimea 20 na linganisha sensor na hali halisi ya udongo.

**Mwisho wa wiki:** Andika ukuaji, dalili za magonjwa, muda wa umwagiliaji, gharama, mavuno, na mauzo.

**Kifuatacho:** ${nextWithData}`,
    general: `**Kazi:** Jibu la sekta ya kilimo.

**Data iliyotumika:** ${basis}.

**Tafsiri ya kitaalamu:** Nitajibu ndani ya kilimo. Swali lako ni: "${question || "ushauri wa shamba"}". Jibu sahihi linahitaji zao, hatua ya ukuaji, soil moisture %, pH, hali ya hewa, na dalili zinazoonekana.

**Fanya sasa:** Kagua majani ya zao, soil moisture, pH kama ipo, hali ya pampu/kifaa, na mvua za karibuni.

**Kagua:** Andika zao, eneo la shamba, umri wa zao, vipimo vya sensor, na tatizo unaloona.

**Kifuatacho:** Uliza kazi maalum kama umwagiliaji, mbolea, ugonjwa, kupanda, mavuno, hali ya hewa, au setup ya kifaa.`,
  };

  return plans[task];
}

export function generateFarmTaskFallback(args: {
  lang: Lang;
  messages: AgentMessage[];
  deviceContext?: string;
}) {
  const question = lastUserMessage(args.messages);
  const task = detectTask(question);
  return args.lang === "sw"
    ? swPlan(task, question, args.deviceContext)
    : enPlan(task, question, args.deviceContext);
}
