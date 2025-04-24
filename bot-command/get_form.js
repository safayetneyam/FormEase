const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { getLoggedInUser } = require("../utils/loginSessionStore");

module.exports = (bot) => {
  bot.onText(/\/get_form/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getLoggedInUser(chatId);

    if (!session) {
      bot.sendMessage(chatId, "❌ Please login first to get your filled form.");
      return;
    }

    const username = session.username;
    const formDir = path.join(__dirname, "..", "form-volt", username);
    const tempDir = path.join(__dirname, "..", "temp-process", username);
    const filledDir = path.join(__dirname, "..", "filled-forms", username);

    if (!fs.existsSync(formDir)) {
      bot.sendMessage(chatId, "📭 No form directory found.");
      return;
    }

    const pdfFiles = fs.readdirSync(formDir).filter((f) => f.endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      bot.sendMessage(chatId, "📭 No PDF form found in your folder.");
      return;
    }

    const filename = pdfFiles[0];
    const fileBase = path.parse(filename).name;
    const finalJsonPath = path.join(tempDir, `${fileBase}-final-acro.json`);
    const acroJsonPath = path.join(tempDir, `${fileBase}-acro.json`);
    const filledPdfPath = path.join(filledDir, `${fileBase}-filled.pdf`);

    if (!fs.existsSync(finalJsonPath)) {
      bot.sendMessage(
        chatId,
        "⚠️ Final mapped data not found. Please run /process_form first."
      );
      return;
    }

    fs.mkdirSync(filledDir, { recursive: true });
    bot.sendMessage(chatId, "🛠️ Filling your form...");

    const fillCmd = `python ./form-process/fill_form.py ${username} ${filename}`;
    exec(fillCmd, (err) => {
      if (err || !fs.existsSync(filledPdfPath)) {
        bot.sendMessage(chatId, "❌ Failed to generate filled form.");
        return;
      }

      bot.sendDocument(
        chatId,
        filledPdfPath,
        {},
        {
          filename: `${fileBase}-filled.pdf`,
          contentType: "application/pdf",
        }
      );

      // ✅ After sending, delete both JSONs
      if (fs.existsSync(finalJsonPath)) fs.unlinkSync(finalJsonPath);
      if (fs.existsSync(acroJsonPath)) fs.unlinkSync(acroJsonPath);
    });
  });
};
