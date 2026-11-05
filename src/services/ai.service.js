import { GoogleGenAI } from '@google/genai';
import { config } from '../config/config.js';

let aiClient = null;
if (config.geminiApiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
    console.log('[AI] Google Gemini GenAI client initialized.');
  } catch (err) {
    console.warn('[AI] Failed to initialize Gemini GenAI client:', err.message);
  }
} else {
  console.log('[AI] GEMINI_API_KEY not provided. Operating with high-fidelity procedural simulation AI engine.');
}

/**
 * Generate NPC response based on persistent identity, personality, schedule, and recent memories
 */
export async function generateNpcDialogue({ npc, player, message, memories = [] }) {
  const memoryContext = memories.length > 0
    ? memories.map(m => `- ${m.memory_type}: ${m.context}`).join('\n')
    : 'No prior memories with this citizen.';

  const prompt = `You are roleplaying as ${npc.name}, a persistent citizen on the planet Veridia Prime in the virtual universe of Aetheria.
Your Profile:
- Age: ${npc.age}
- Occupation: ${npc.occupation}
- Personality: ${npc.personality}
- Background: ${npc.background}
- Personal Goals: ${npc.goals}
- Daily Routine: ${typeof npc.schedule_json === 'string' ? npc.schedule_json : JSON.stringify(npc.schedule_json)}

Citizen Interacting With You:
- Name: ${player.character_name} (@${player.username})
- Age & Stage: ${player.virtual_age} (${player.life_stage})
- Reputation: ${player.reputation}
- Level: ${player.level}

Your Past Memories of This Citizen:
${memoryContext}

Citizen says: "${message}"

Respond strictly in character. Keep the tone authentic, futuristic, and concise (2-4 sentences). 
Provide your response in JSON format with two keys:
1. "reply": Your spoken in-character dialogue.
2. "newMemory": A brief 1-sentence note of what you learned or how you felt about this interaction to record in your long-term memory.
3. "emotionalImpact": A number from 1 to 10 indicating how memorable or impactful this exchange was.`;

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        }
      });
      const parsed = JSON.parse(response.text.trim());
      return {
        reply: parsed.reply,
        newMemory: parsed.newMemory || `Spoke with ${player.character_name} about recent affairs.`,
        emotionalImpact: parsed.emotionalImpact || 4,
      };
    } catch (err) {
      console.warn('[AI] Gemini call failed, falling back to procedural NPC generation:', err.message);
    }
  }

  // Procedural Fallback Engine
  const proceduralResponses = {
    'Dean of Quantum Sciences': [
      `Greetings, ${player.character_name}. The telemetry from our deep-space array is exhibiting fascinating quantum fluctuations today. What brings you to the academy?`,
      `Ah, a curious mind! In quantum sciences, every inquiry shifts the probability cloud of our future. Let us examine your hypothesis together.`,
      `The binary stars of Veridia Prime emit rare tachyon waves at this hour. If you are here to study, the laboratory consoles are at your disposal.`
    ],
    'President of the Arcadian Senate': [
      `Welcome, citizen ${player.character_name}. The Arcadian Senate is actively debating economic dividends and planetary defense. Your civic engagement is vital to our democracy.`,
      `A fair society requires active voices like yours. Have you reviewed the latest legislative docket in the government portal?`,
      `Our sovereignty thrives on transparency. If you have concerns regarding trade tariffs or public works, my office will ensure your voice is counted.`
    ],
    'Chief Editor of The Veridian Chronicle': [
      `Hold on—let me mark that down. As editor of The Veridian Chronicle, I'm always looking for front-page stories. Do you have news from the outer districts?`,
      `Truth is the greatest currency on Veridia Prime. What you just observed might make the morning edition!`,
      `The holo-press never sleeps, ${player.character_name}. If you witness significant transactions or civic reforms, bring the leads directly to my desk.`
    ],
    'Founder of Apex Cybernetics': [
      `Welcome to Apex Cybernetics! Whether you need high-spec neural visors or kinetic exosuits, we build the finest tech on Veridia Prime.`,
      `Business is surging in Solaris Basin today. If you're looking to purchase inventory or trade raw materials, you've come to the right place.`,
      `A sharp citizen always invests in upgrades. Take a look at our marketplace listings—precision engineering guaranteed.`
    ]
  };

  const defaultReplies = proceduralResponses[npc.occupation] || [
    `Greetings, ${player.character_name}. It's good to see another citizen active in Solaris Basin today. How can I assist you?`,
    `The developments across Veridia Prime are moving quickly. Stay alert and keep your comms active.`,
    `A pleasure to meet you. In a civilization this young, every choice we make carves history.`
  ];

  const reply = defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  return {
    reply,
    newMemory: `Met ${player.character_name} in the city and discussed current civic affairs.`,
    emotionalImpact: 5,
  };
}

/**
 * AI Assistant & Tutorial Guide (ANI - Aetheria Navigation Intelligence)
 */
export async function getAssistantHelp({ query, playerContext = {} }) {
  const prompt = `You are ANI (Aetheria Navigation Intelligence), the friendly, knowledgeable, and futuristic AI assistant for the virtual universe of Aetheria.
Explain gameplay rules, character progression, currency, careers, businesses, elections, missions, and navigation concisely and clearly.

Player State:
- Character: ${playerContext.character_name || 'New Arrival'}
- Level: ${playerContext.level || 1}
- Planet: ${playerContext.planet || 'Veridia Prime'}
- Wallet: ${playerContext.balance || 0} Credits

User Question: "${query}"

Guidelines:
- Explain mechanics accurately (text-based civilization simulator, server-authoritative economy, real-time chat, democratic elections, persistent database).
- Be polite, supportive, and use subtle sci-fi terminology.
- Keep response under 150 words.`;

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { temperature: 0.5 }
      });
      return response.text.trim();
    } catch (err) {
      console.warn('[AI] Gemini assistant call failed, using procedural fallback:', err.message);
    }
  }

  // Procedural Assistant Responses
  const lower = query.toLowerCase();
  if (lower.includes('currency') || lower.includes('wallet') || lower.includes('money') || lower.includes('credit')) {
    return 'Credits (₡) are the official planetary currency of Veridia Prime. You can earn credits by securing a job, graduating from academies, trading in the Marketplace, or claiming mission rewards. All transactions are securely audited in our double-entry database ledger.';
  }
  if (lower.includes('job') || lower.includes('career') || lower.includes('work') || lower.includes('salary')) {
    return 'To begin a career, navigate to the Career Portal. Available roles range from Junior Cyber-Security Specialist to Orbital Spaceflight Navigator. Each position requires specific skill proficiencies and provides automated daily salary payouts.';
  }
  if (lower.includes('business') || lower.includes('company') || lower.includes('shop') || lower.includes('product')) {
    return 'Citizens can establish their own corporations in the Business Dashboard. Once registered, you can manufacture virtual products, set profit margins, hire fellow citizens, and list merchandise directly on the global Marketplace.';
  }
  if (lower.includes('election') || lower.includes('vote') || lower.includes('government') || lower.includes('president')) {
    return 'Neo-Arcadia operates as a representative Cyber-Parliament. Any active citizen can register a political party, draft proposed legislation, and cast an authenticated vote during general election cycles via the Government Portal.';
  }
  if (lower.includes('mission') || lower.includes('quest') || lower.includes('reward') || lower.includes('xp')) {
    return 'Daily and storyline missions are accessible via the Missions Portal. Completing activities such as social postings, academic enrollment, and marketplace trades unlocks Experience Points (XP), reputation, and currency bonuses.';
  }

  return 'Welcome to Aetheria! You are currently exploring Veridia Prime in the Andromeda-Sigma Sector. You can explore careers, open businesses, build families, participate in parliamentary elections, and communicate with other citizens and persistent AI NPCs across real-time lounges.';
}

/**
 * Generate AI World Newspaper Article grounded in ACTUAL database events
 */
export async function generateNewspaperArticle({ events = [], planetName = 'Veridia Prime' }) {
  const eventsSummary = events.length > 0
    ? events.map(e => `- [${e.category.toUpperCase()}] ${e.headline}: ${e.article}`).join('\n')
    : '- General peaceful expansion across Solaris Basin with active citizen trade.';

  const prompt = `You are Aria Solis, Chief Editor of The Veridian Chronicle, the premier newspaper of ${planetName}.
Write a captivating, grounded news article summarizing the recent real events that transpired in the database.
CRITICAL RULE: Ground your report strictly in the provided real recorded events. Do not invent fake dates or imaginary factions.

Recent Recorded Database Events:
${eventsSummary}

Produce a JSON response with:
1. "headline": An exciting futuristic headline.
2. "edition": "Vol. 2185 - Evening Edition"
3. "lead": A punchy opening paragraph.
4. "body": 2-3 short journalistic paragraphs analyzing these developments.
5. "editorial": A brief 1-sentence thought from Aria Solis.`;

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.6,
        }
      });
      return JSON.parse(response.text.trim());
    } catch (err) {
      console.warn('[AI] Gemini newspaper generation failed, using procedural fallback:', err.message);
    }
  }

  return {
    headline: 'Solaris Basin Surges: Civic & Commercial Milestones Sweeping Veridia Prime',
    edition: 'Vol. 2185 - Daily Holonet Dispatch',
    lead: 'From the crystal towers of Aethel City to the orbital telemetry docks of Nova Haven, citizen activity has reached record momentum.',
    body: 'Recent records confirm expanding commercial registration at the Apex Cybernetics exchange, accompanied by active parliamentary debates on citizen dividends. The Ministry of Finance reports stable Credit circulation and zero fraudulent balance deviations across the planetary ledger.\n\nAcademic enrollment at the Imperial Polytechnic also marks an influx of young researchers dedicated to decoding cosmic radio frequencies in the outer sectors.',
    editorial: 'Civilization is not merely built with titanium and glass; it is forged by the daily choices of our citizens.'
  };
}

export default {
  generateNpcDialogue,
  getAssistantHelp,
  generateNewspaperArticle,
};
