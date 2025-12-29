
import { GoogleGenAI, Type, GenerateContentResponse, Modality } from "@google/genai";
import { UserProfile, Message, Language, Scheme } from "../types";

export const getAIClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const getLangName = (lang: Language) => {
  const mapping = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    mr: 'Marathi',
    ta: 'Tamil',
    te: 'Telugu',
    pa: 'Punjabi'
  };
  return mapping[lang];
};

export const SAHAYAK_PURPOSE = "I am Sahayak.AI, your dedicated assistant for Indian Government schemes. My purpose is to help you understand, find, and apply for welfare programs that benefit you. Please ask me about schemes, upload a government document for analysis, or check your eligibility. I cannot assist with unrelated topics.";

export const DOMAIN_GUARD = `
  STRICT DOMAIN LIMITATION:
  You are Sahayak.AI. Your purpose is to bridge the gap between citizens and government welfare through intelligent, simple conversation.
  You MUST ONLY answer questions related to:
  1. Indian Government Schemes (Central and State).
  2. Eligibility for these schemes based on user profiles.
  3. Analysis and explanation of uploaded government documents/notices.
  4. Application processes for these schemes.

  If the user asks about ANY unrelated topic (e.g., general news, sports, coding, recipes, casual chat, or general knowledge), you MUST NOT answer. Instead, respond with exactly this purpose statement:
  "${SAHAYAK_PURPOSE}"
`;

export const FORMATTING_INSTRUCTIONS = `
  FORMATTING GUIDELINES (CRITICAL):
  - Use ACTUAL NEWLINE CHARACTERS (hitting Enter twice) for line breaks. 
  - NEVER output the literal characters "\\n". 
  - Ensure DOUBLE SPACING between all paragraphs and sections.
  - Use Bold headers (e.g., **Section Title**) to categorize information.
  - Use Bullet Points (•) for lists.
  - Use Numbered Lists (1., 2.) for steps.
  - Use relevant Emojis (🏛️, 📄, ✅, 💰, 📅) at the start of key points.
  - Ensure words are not cramped; prioritize a clean, spacious, and highly legible layout.
`;

export const getSystemInstruction = (profile: UserProfile, language: Language = 'en') => {
  const langName = getLangName(language);
  return `
    ${DOMAIN_GUARD}
    
    PROFILE CONTEXT:
    - Name: ${profile.name}
    - Age: ${profile.age}
    - Income: ₹${profile.income}
    - Category: ${profile.category}
    - Education: ${profile.education}
    - Gender: ${profile.gender}
    - State: ${profile.state}

    GOALS:
    1. Respond primarily in ${langName}.
    2. Simplify legal jargon into easy-to-understand language.
    3. Be encouraging, empathetic, and professional.

    ${FORMATTING_INSTRUCTIONS}
  `;
};

export const getGeminiChat = (profile: UserProfile, history: Message[] = [], language: Language = 'en') => {
  const ai = getAIClient();
  const systemInstruction = getSystemInstruction(profile, language);

  // Gemini chat history MUST start with a 'user' message.
  let geminiHistory: any[] = [];
  let foundFirstUser = false;

  for (const msg of history) {
    if (msg.role === 'user') foundFirstUser = true;
    if (foundFirstUser && msg.content && msg.content !== "VOICE_MESSAGE_INTERNAL_PLACEHOLDER") {
      geminiHistory.push({
        role: msg.role,
        parts: [{ text: msg.transcription || msg.content }]
      });
    }
  }

  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction,
    },
    history: geminiHistory,
  });
};

export const generatePersonalizedWelcome = async (profile: UserProfile, language: Language = 'en'): Promise<string> => {
  const ai = getAIClient();
  const langName = getLangName(language);
  const prompt = `
    Generate a warm welcome for ${profile.name} from ${profile.state} in ${langName}.
    Invite them to ask questions or upload documents.
    Use double line breaks between paragraphs, emojis, and bullet points for maximum readability.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
    });
    return response.text || "Welcome to Sahayak.AI.";
  } catch (error) {
    return `Namaste ${profile.name}, I am Sahayak.AI.`;
  }
};

export const suggestSchemes = async (profile: UserProfile, language: Language = 'en'): Promise<{ intro: string, schemes: Scheme[] }> => {
  const ai = getAIClient();
  const langName = getLangName(language);
  const prompt = `
    Find 3-4 most relevant Indian Government Schemes (Central or ${profile.state} State) for a citizen with this profile:
    State: ${profile.state}, Income: ₹${profile.income}, Category: ${profile.category}, Age: ${profile.age}, Gender: ${profile.gender}.
    
    For each scheme, provide:
    1. name: Name of the scheme.
    2. description: What it is (simple explanation).
    3. benefits: A list of 3-4 key benefits.
    4. whyItFits: Why this specifically fits the user's current profile.
    5. link: Official portal URL.
    6. category: One word like 'Health', 'Education', 'Pension', 'Business'.

    Also provide a short intro text in ${langName} explaining that these were handpicked based on the profile details.
    
    Return the entire response ONLY as a JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intro: { type: Type.STRING },
            schemes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  benefits: { type: Type.ARRAY, items: { type: Type.STRING } },
                  whyItFits: { type: Type.STRING },
                  link: { type: Type.STRING },
                  category: { type: Type.STRING }
                },
                required: ["name", "description", "benefits", "whyItFits"]
              }
            }
          },
          required: ["intro", "schemes"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    return {
      intro: data.intro || "Here are some schemes picked for you:",
      schemes: (data.schemes || []).map((s: any, i: number) => ({ 
        ...s, 
        id: s.id || `scheme-${i}-${Date.now()}` 
      }))
    };
  } catch (e) {
    console.error("Failed to parse scheme suggestions:", e);
    return { intro: "I encountered an error finding schemes. Please try again or ask about a specific category.", schemes: [] };
  }
};

export interface DocumentAnalysisResult {
  summary: string;
  requiredDocuments: string[];
  contactInfo: string;
  importantDates: string[];
  importantLinks: string[];
  eligibilityCriteria: string[];
  howToApply: string[];
  isValidScheme: boolean;
}

export const analyzeDocument = async (base64Data: string, mimeType: string, profile: UserProfile, language: Language = 'en'): Promise<DocumentAnalysisResult> => {
  const ai = getAIClient();
  const prompt = `
    ${DOMAIN_GUARD}
    
    TASK: Determine if the provided document is an official Indian Government scheme notice, application form, guidelines, or related document.
    
    IF THE DOCUMENT IS OFF-TOPIC (not a scheme/government document):
    - Set the 'summary' field to: "${SAHAYAK_PURPOSE}"
    - Set 'isValidScheme' to false.
    - Leave all array fields empty [].
    
    IF THE DOCUMENT IS ON-TOPIC:
    Analyze the document based on your extensive knowledge of Indian welfare programs.
    1. isValidScheme: true.
    2. SUMMARY: A helpful summary in ${getLangName(language)}. Use double line breaks between paragraphs.
    3. REQUIRED DOCUMENTS: List of standard documents needed.
    4. CONTACT INFO: Provide available helpdesk phone, email, and nodal office address. 
    5. IMPORTANT DATES: Mention application deadlines if found.
    6. IMPORTANT LINKS: Official government portal URLs associated with this scheme.
    7. ELIGIBILITY: Clear bullet points.
    8. PROCESS: Step-by-step how to apply.
    
    Return JSON format. Ensure all text fields use actual newlines, NOT literal "\\n" characters.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            requiredDocuments: { type: Type.ARRAY, items: { type: Type.STRING } },
            contactInfo: { type: Type.STRING },
            importantDates: { type: Type.ARRAY, items: { type: Type.STRING } },
            importantLinks: { type: Type.ARRAY, items: { type: Type.STRING } },
            eligibilityCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
            howToApply: { type: Type.ARRAY, items: { type: Type.STRING } },
            isValidScheme: { type: Type.BOOLEAN }
          },
          required: ["summary", "requiredDocuments", "contactInfo", "importantDates", "importantLinks", "eligibilityCriteria", "howToApply", "isValidScheme"]
        }
      }
    });

    return JSON.parse(response.text || "{}") as DocumentAnalysisResult;
  } catch (e) {
    console.error("Document analysis parse error:", e);
    return {
      summary: "Document analysis failed due to a processing error.",
      requiredDocuments: [],
      contactInfo: "Unavailable",
      importantDates: [],
      importantLinks: [],
      eligibilityCriteria: [],
      howToApply: [],
      isValidScheme: false
    };
  }
};

export interface AudioProcessingResult {
  transcription: string;
  answer: string;
}

export const processAudioInput = async (base64Data: string, mimeType: string, profile: UserProfile, language: Language = 'en'): Promise<AudioProcessingResult> => {
  const ai = getAIClient();
  const prompt = `
    ${DOMAIN_GUARD}

    TASK: 
    1. Transcribe the user audio in ${getLangName(language)} VERBATIM. 
    2. If the user's query is unrelated to government schemes, the 'answer' MUST BE exactly: "${SAHAYAK_PURPOSE}"
    3. If the query is related, provide a detailed, well-structured answer.
    
    FORMAT:
    Return as JSON.
    Use ACTUAL NEWLINE CHARACTERS in the answer for double-spaced paragraphs. 
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { 
            transcription: { type: Type.STRING, description: "Verbatim transcription" }, 
            answer: { type: Type.STRING, description: "Structured answer with actual newlines" } 
          },
          required: ["transcription", "answer"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Audio processing failed:", e);
    return { transcription: "Error transcribing audio.", answer: "I couldn't process your voice request. Please try again." };
  }
};

export const textToSpeech = async (text: string): Promise<string | undefined> => {
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text: `Read: ${text}` }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) return `data:audio/pcm;base64,${base64Audio}`;
  } catch (err) {
    console.error("TTS generation error:", err);
  }
  return undefined;
};
