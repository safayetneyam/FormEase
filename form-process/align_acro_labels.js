const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const username = process.argv[2];
const fileBase = process.argv[3];

const acroPath = path.join(
  __dirname,
  "..",
  "temp-process",
  username,
  `${fileBase}-acro.json`
);
const infoPath = path.join(
  __dirname,
  "..",
  "temp-info",
  `${username}-labels.json`
);
const outputPath = path.join(
  __dirname,
  "..",
  "temp-process",
  username,
  `${fileBase}-final-acro.json`
);

if (!fs.existsSync(acroPath) || !fs.existsSync(infoPath)) {
  console.error("❌ Required files missing.");
  process.exit(1);
}

const acroFields = JSON.parse(fs.readFileSync(acroPath, "utf-8")); // List of acro field names
const userLabels = JSON.parse(fs.readFileSync(infoPath, "utf-8"));

const acroList = acroFields.join("\n");
const labelList = Object.entries(userLabels)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n");

const prompt = `
You are given:

1. A list of AcroForm field names (used in a PDF form):
${acroList}

2. A list of user-provided information (label: value pairs):
${labelList}

Your task is:
- Try to match each acro field name (from list 1) with the **most relevant** value from list 2.
- For example, if the user's full name is "Ammar Bin Halim" and an acro field is "First Name", return "Ammar".
- If it's "Last Name", return "Halim".
- If no logical match is found, **omit that field entirely** from your output.

Output a **valid JSON object**, like this:
{
  "form1[0].#subform[1].FirstName[0]": "Ammar",
  "form1[0].#subform[1].MiddleName[0]": "Bin",
  "form1[0].#subform[1].LastName[0]": "Halim"
}
No explanations. Only JSON.
`;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function alignFields() {
  try {
    const response = await axios.post(GEMINI_URL, {
      contents: [{ parts: [{ text: prompt }] }],
    });

    let raw = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Remove ```json markdown wrappers
    raw = raw.replace(/```json|```/g, "").trim();

    const result = JSON.parse(raw); // Attempt to parse
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
    console.log("✅ Saved aligned data:", outputPath);
  } catch (err) {
    console.error("❌ Gemini API error:", err.message);
  }
}

alignFields();
