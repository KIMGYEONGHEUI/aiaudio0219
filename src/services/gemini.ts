import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateStory = async (input: string, mode: 'text' | 'voice' | 'image', genre: string) => {
  const model = "gemini-3-flash-preview";
  
  let prompt = "";
  if (mode === 'text') {
    prompt = `Create a short audiobook story based on this prompt: "${input}". 
    Genre: ${genre}. 
    The story should be engaging, descriptive, and suitable for an audiobook. 
    Return the response in JSON format with "title" and "content" fields.`;
  } else if (mode === 'voice') {
    prompt = `The following is a transcript of a user's voice input: "${input}". 
    Expand this into a full, polished audiobook story. 
    Genre: ${genre}. 
    Return the response in JSON format with "title" and "content" fields.`;
  } else if (mode === 'image') {
    // For image, input will be base64
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: input.split(',')[1], mimeType: "image/png" } },
            { text: `Analyze this image and write a short audiobook story inspired by it. 
            Genre: ${genre}. 
            Return the response in JSON format with "title" and "content" fields.` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["title", "content"]
        }
      }
    });
    return JSON.parse(response.text);
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          content: { type: Type.STRING }
        },
        required: ["title", "content"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateAudio = async (text: string, voiceName: string = 'Kore') => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName as any },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};
