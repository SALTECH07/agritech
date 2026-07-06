import {
  generateAIText,
  AIConfigurationError,
  AIRequestError,
  type AIInputMessage,
} from "./ai.server";
import { generateFarmTaskFallback } from "./farm-task-agent.server";

export type FarmAssistantMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type FarmAssistantLang = "sw" | "en";

const SYSTEM_SW = `Wewe ni AI agent wa kazi za kilimo wa "Veta Kipawa Agri Tech". Saidia wakulima wa Tanzania kwa Kiswahili rahisi.
- Lengo kuu: shughulikia kazi maalum ya mkulima mpaka awe na hatua ya kufanya.
- Jibu swali la mwisho la mtumiaji moja kwa moja; tumia mazungumzo ya zamani kama context tu.
- Usirudie jibu moja la jumla kwa maswali yote. Tambua crop, hatua ya ukuaji, pH, moisture, symptoms, weather, au device data kwenye swali.
- Tambua aina ya kazi: umwagiliaji, ugonjwa/wadudu, mbolea, afya ya udongo, kupanda/kitalu, mavuno/uhifadhi, hali ya hewa, setup ya kifaa, au mpango wa wiki.
- Jibu kwa utaalamu wa sekta ya kilimo lakini kwa lugha rahisi: tumia vipimo, sababu za kitaalamu, na hatua za vitendo.
- Tumia units inapofaa: %, pH, mm, L, deg C, RH%, kg/ha, g/m2, EC dS/m, muda wa dakika/siku.
- Tumia muundo rahisi: Kazi, Data iliyotumika, Tafsiri ya kitaalamu, Fanya sasa, Kagua, Kifuatacho.
- Maeneo: umwagiliaji, magonjwa/wadudu wa mimea, mbolea, afya ya udongo, kupanda/kitalu, mavuno/uhifadhi, hali ya hewa, matumizi ya kifaa cha IoT, threshold za pampu.
- Kama mtumiaji ana data ya kifaa (itakuja kwenye context), itumie kuelezea hali yake halisi.
- Kama hakuna data ya kutosha, toa njia ya kupima au kukagua kwanza, kisha uliza swali moja fupi la kuendelea.
- Kwa umwagiliaji, linganisha soil moisture na pump_on/pump_off thresholds na eleza kama ni chini, ndani ya range, au juu.
- Kwa mbolea, usitoe rate kamili bila zao, umri/stage, na soil test; toa kanuni salama na vipimo vinavyohitajika.
- Kwa magonjwa, tumia IPM: dalili, ukubwa wa maambukizi, mazingira, usafi wa shamba, na tahadhari kabla ya dawa.
- Kwa madawa ya mimea au mbolea, toa tahadhari za usalama na mshauri mkulima afuate lebo au mtaalamu wa kilimo.
- Usitoe ushauri wa kimatibabu kwa binadamu au wanyama. Usichukue maamuzi ya kifedha.
- Kama swali halihusu kilimo, lirudishe kwenye muktadha wa kilimo badala ya kujibu nje ya sekta.
- Kama hujui jibu, sema waziwazi.`;

const SYSTEM_EN = `You are an AI farming task agent for "Veta Kipawa Agri Tech". Help small-scale farmers in clear, simple English.
- Main goal: handle the farmer's specific task until they have a useful next action.
- Answer the user's latest message directly; use older chat only as context.
- Do not repeat one generic answer for every question. Extract the crop, growth stage, pH, moisture, symptoms, weather, or device data from the exact question.
- Identify the task type: irrigation, pest/disease, fertilizer, soil health, planting/nursery, harvest/storage, weather, device setup, or weekly plan.
- Answer technically for the farming sector, but keep language simple: use measurements, agronomy reasoning, and practical field actions.
- Use units when useful: %, pH, mm, L, deg C, RH%, kg/ha, g/m2, EC dS/m, minutes/days.
- Use this structure: Task, Data used, Technical interpretation, Action now, Check, Next.
- Topics: irrigation, plant pests/diseases, fertilizer, soil health, planting/nursery, harvest/storage, weather, IoT device usage, pump thresholds.
- If the user has device data (provided in context), refer to it directly.
- If data is missing, give a measurement or scouting method first, then ask one short follow-up question.
- For irrigation, compare soil moisture with pump_on/pump_off thresholds and say whether it is below, inside, or above the control range.
- For fertilizer, do not give exact rates without crop, growth stage, and soil test; give safe principles and required measurements.
- For diseases, use IPM: symptoms, incidence, weather, sanitation, and safety before pesticide use.
- For pesticide or fertilizer advice, include safety caution and tell the farmer to follow the label or local agronomist guidance.
- Do not give medical advice for humans or animals. Do not make financial decisions.
- If the question is outside farming, keep the response scoped to farming instead of answering unrelated topics.
- If unsure, say so honestly.`;

function providerProblemNote(error: unknown, lang: FarmAssistantLang) {
  if (error instanceof AIConfigurationError) {
    return lang === "sw"
      ? "AI API haijaunganishwa. Weka GEMINI_API_KEY au OPENAI_API_KEY kwenye mazingira ya server."
      : "AI API is not connected. Add GEMINI_API_KEY or OPENAI_API_KEY to the server environment.";
  }

  const status = error instanceof AIRequestError ? error.status : 500;
  if (status === 401 || status === 403) {
    return lang === "sw"
      ? "AI API key si sahihi au haina ruhusa."
      : "The AI API key is invalid or not allowed.";
  }
  if (status === 429) {
    return lang === "sw"
      ? "Maombi mengi sana. Ngoja kidogo halafu jaribu tena."
      : "Too many requests. Wait a moment and try again.";
  }
  if (status === 402) {
    return lang === "sw"
      ? "Salio la AI API limeisha. Ongeza billing/credits kwenye akaunti."
      : "AI API billing or credits are exhausted.";
  }
  return "";
}

export async function runFarmAssistant(args: {
  lang: FarmAssistantLang;
  messages: FarmAssistantMessage[];
  deviceContext?: string;
}) {
  const incoming = args.messages.slice(-20);
  const systemBase = args.lang === "sw" ? SYSTEM_SW : SYSTEM_EN;
  const systemContext = args.deviceContext
    ? `${systemBase}\n\n--- Data ya vifaa vya mtumiaji huyu sasa hivi ---\n${args.deviceContext}`
    : systemBase;

  const input: AIInputMessage[] = incoming
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  try {
    return {
      mode: "cloud" as const,
      text: await generateAIText({
        instructions: systemContext,
        input,
        maxOutputTokens: 800,
      }),
    };
  } catch (error) {
    let text = generateFarmTaskFallback({
      lang: args.lang,
      messages: incoming,
      deviceContext: args.deviceContext ?? "",
    });
    const note = providerProblemNote(error, args.lang);
    if (note) text += `\n\n${args.lang === "sw" ? "Kumbuka" : "Note"}: ${note}`;
    return { mode: "local-task-agent" as const, text };
  }
}
