const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

const { sendImageToVision } = require("./visionService");
const { sendTextToGemini } = require("./geminiService");
const { clearTempImages, removeTxtFile } = require("./tempCleaner");

const dataVoltDir = path.join(__dirname, "..", "data-volt");
const tempProcessDir = path.join(__dirname, "..", "temp-process");
const tempInfoDir = path.join(__dirname, "..", "temp-info");

// ✅ Ensure temp-info/<username>.txt exists and append text
async function appendToTextFile(username, text) {
  if (!fs.existsSync(tempInfoDir)) {
    fs.mkdirSync(tempInfoDir, { recursive: true });
  }

  const txtPath = path.join(tempInfoDir, `${username}.txt`);
  fs.appendFileSync(txtPath, `\n\n${text}`);
}

// ✅ Process image directly with Vision API
async function processImage(filePath, username) {
  const imageBuffer = fs.readFileSync(filePath);
  const text = await sendImageToVision(imageBuffer);
  await appendToTextFile(
    username,
    `--- FILE: ${path.basename(filePath)} ---\n${text}`
  );
}

// ✅ NEW: Convert PDF to image per page using puppeteer and pdf-lib
async function processPdf(filePath, username) {
  const outputPath = path.join(tempProcessDir, username);
  if (!fs.existsSync(tempProcessDir)) fs.mkdirSync(tempProcessDir);
  if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });

  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  for (let i = 0; i < totalPages; i++) {
    const pageBase64 = Buffer.from(pdfBytes).toString("base64");

    const html = `
      <html>
        <body style="margin:0; padding:0;">
          <embed src="data:application/pdf;base64,${pageBase64}#page=${
      i + 1
    }" type="application/pdf" width="800" height="1000" />
        </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: "networkidle0" });
    const screenshotPath = path.join(outputPath, `page-${i + 1}.png`);
    await page.screenshot({ path: screenshotPath });

    await processImage(screenshotPath, username);
  }

  await browser.close();
  clearTempImages(outputPath);
}

// ✅ Convert DOCX to HTML → render in Puppeteer → screenshot → Vision
async function processDocx(filePath, username) {
  const htmlResult = await mammoth.convertToHtml({ path: filePath });
  const html = htmlResult.value;

  if (!fs.existsSync(tempProcessDir)) fs.mkdirSync(tempProcessDir);
  const outputPath = path.join(tempProcessDir, username);
  if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath, { recursive: true });

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const viewWidth = 1200;
  const viewHeight = 1600;

  await page.setViewport({ width: viewWidth, height: viewHeight });

  const styledHtml = `
      <html>
        <head>
          <style>
            body {
              font-family: Arial;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;

  await page.setContent(styledHtml, { waitUntil: "networkidle0" });

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const totalScreens = Math.ceil(scrollHeight / viewHeight);

  for (let i = 0; i < totalScreens; i++) {
    const scrollY = i * viewHeight;

    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Wait for scroll to settle

    const imagePath = path.join(outputPath, `docx-part-${i + 1}.png`);
    await page.screenshot({ path: imagePath });

    await processImage(imagePath, username);
  }

  await browser.close();
  clearTempImages(outputPath);
}

// ✅ Append plain .txt file directly
async function processTxt(filePath, username) {
  const text = fs.readFileSync(filePath, "utf-8");
  await appendToTextFile(
    username,
    `--- FILE: ${path.basename(filePath)} ---\n${text}`
  );
}

// ✅ Main controller
async function processFilesForUser(username) {
  const userPath = path.join(dataVoltDir, username);
  if (!fs.existsSync(userPath)) throw new Error("User vault not found.");

  const files = fs.readdirSync(userPath);

  for (const file of files) {
    const fullPath = path.join(userPath, file);
    const ext = path.extname(file).toLowerCase();

    try {
      if ([".jpg", ".jpeg", ".png"].includes(ext)) {
        await processImage(fullPath, username);
      } else if (ext === ".pdf") {
        await processPdf(fullPath, username);
      } else if (ext === ".doc" || ext === ".docx") {
        await processDocx(fullPath, username);
      } else if (ext === ".txt") {
        await processTxt(fullPath, username);
      }
    } catch (err) {
      console.error(`❌ Failed to process file: ${file}`, err);
    }
  }

  const textPath = path.join(tempInfoDir, `${username}.txt`);
  const finalText = fs.existsSync(textPath)
    ? fs.readFileSync(textPath, "utf-8")
    : "";
  if (finalText.length > 0) {
    const jsonOutput = await sendTextToGemini(finalText);
    const outputPath = path.join(tempInfoDir, `${username}-labels.json`);
    fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
  }

  removeTxtFile(username); // 🧹 Clean up .txt file after Gemini
}

module.exports = { processFilesForUser };
