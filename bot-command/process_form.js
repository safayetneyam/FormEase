const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { getLoggedInUser } = require("../utils/loginSessionStore");

module.exports = (bot) => {
  bot.onText(/\/process_form/, async (msg) => {
    const chatId = msg.chat.id;
    const session = getLoggedInUser(chatId);

    if (!session) {
      bot.sendMessage(chatId, "❌ Please login first to process your form.");
      return;
    }

    const username = session.username;
    const formDir = path.join(__dirname, "..", "form-volt", username);
    const tempDir = path.join(__dirname, "..", "temp-process", username);
    const infoPath = path.join(
      __dirname,
      "..",
      "temp-info",
      `${username}-labels.json`
    );

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
    const acroPath = path.join(tempDir, `${fileBase}-acro.json`);
    const finalPath = path.join(tempDir, `${fileBase}-final-acro.json`);

    if (!fs.existsSync(infoPath)) {
      bot.sendMessage(
        chatId,
        "❌ You need to run /process_file first to extract your label info."
      );
      return;
    }

    fs.mkdirSync(tempDir, { recursive: true });
    bot.sendMessage(chatId, `📄 Processing form: ${filename}`);

    // Step 1: Extract Acro fields
    const extractCmd = `python ./form-process/fill_form.py ${username} ${filename}`;
    exec(extractCmd, (err) => {
      if (err || !fs.existsSync(acroPath)) {
        bot.sendMessage(chatId, "❌ Failed to extract AcroForm fields.");
        return;
      }

      // Step 2: Align using Gemini
      const alignCmd = `node ./form-process/align_acro_labels.js ${username} ${fileBase} full`;
      exec(alignCmd, (err) => {
        if (err || !fs.existsSync(finalPath)) {
          bot.sendMessage(
            chatId,
            "❌ Gemini failed to align your form fields."
          );
          return;
        }

        // ✅ Keep acro.json — do NOT delete here
        bot.sendMessage(
          chatId,
          "✅ Form field alignment completed. Use /get_form to receive your filled form."
        );
      });
    });
  });
};
