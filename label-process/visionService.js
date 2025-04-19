// label-process/visionService.js

const axios = require("axios");

const API_KEY = process.env.GOOGLE_VISION_API_KEY;
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

async function sendImageToVision(imageBuffer) {
  const base64Image = imageBuffer.toString("base64");

  const body = {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: "TEXT_DETECTION" }],
      },
    ],
  };

  try {
    const response = await axios.post(VISION_URL, body);
    const annotation =
      response.data.responses?.[0]?.fullTextAnnotation?.text || "";
    return annotation.trim();
  } catch (err) {
    console.error("❌ Vision API error:", err.message);
    return "";
  }
}

module.exports = { sendImageToVision };
