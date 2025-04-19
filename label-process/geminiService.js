// label-process/geminiService.js

const axios = require("axios");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function sendTextToGemini(rawText) {
  const prompt = `
    You are a highly precise document extraction assistant. Extract all identifiable "label: value" pairs from the provided document text, and return them as a structured JSON object.
    
    Requirements:
    1. Do not omit any information from the text — extract every detail.
    2. If a main label (like "Father's Information") has sub-labels (like Name, Address, Phone), reflect the hierarchy in the labels:
       - Example: "Father's Name", "Father's Address", "Father's Phone"
    3. If a label is implied but not explicitly written, infer a clear and meaningful label.
    4. Keep the label formatting consistent and human-readable.
    5. Output must be in **valid JSON only** — no code blocks, no explanations, no markdown.
    
    Document Text:
    """
    ${rawText}
    """
    
    Return:
    A valid JSON object with "label: value" pairs.
    `;
  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const res = await axios.post(GEMINI_URL, body, {
      headers: { "Content-Type": "application/json" },
    });

    const output = res.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // ✅ Remove Markdown code fences like ```json ... ```
    const cleaned = output
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
    return {};
  }
}

module.exports = { sendTextToGemini };
