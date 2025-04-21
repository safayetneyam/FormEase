const fs = require("fs");
const path = require("path");
// const fetch = require("node-fetch");
const { getLoggedInUser } = require("../utils/loginSessionStore");

const formMemory = new Map(); // Holds form upload state per chatId

module.exports = (bot) => {
  // /form command – expect one PDF
  bot.onText(/\/form/, (msg) => {
    const chatId = msg.chat.id;
    const user = getLoggedInUser(chatId);

    if (!user) {
      bot.sendMessage(chatId, "❌ Please login first to upload a form.");
      return;
    }

    formMemory.set(chatId, { expectingForm: true, received: false });
    bot.sendMessage(
      chatId,
      "📄 Please upload your PDF form now. Only the first file will be accepted."
    );
  });

  // Handles file upload after /form
  bot.on("document", async (msg) => {
    const chatId = msg.chat.id;
    const user = getLoggedInUser(chatId);
    const memory = formMemory.get(chatId);

    if (!user || !memory?.expectingForm) return;

    // If a file has already been received, ignore further files
    if (memory.received) {
      bot.sendMessage(
        chatId,
        "⚠️ You’ve already uploaded a form. Only the first PDF will be used."
      );
      return;
    }

    const document = msg.document;
    const mimeType = document.mime_type || "";

    if (!mimeType.includes("pdf")) {
      bot.sendMessage(chatId, "⚠️ Please upload a valid PDF file.");
      return;
    }

    const fileId = document.file_id;
    const fileName = document.file_name;

    try {
      const fileLink = await bot.getFileLink(fileId);
      const res = await fetch(fileLink);
      const buffer = await res.arrayBuffer();

      formMemory.set(chatId, {
        expectingForm: true,
        received: true,
        formBuffer: Buffer.from(buffer),
        formName: fileName,
      });

      bot.sendMessage(
        chatId,
        `✅ Form '${fileName}' received. Now type /submit_form to save it.`
      );
    } catch (err) {
      bot.sendMessage(chatId, "❌ Failed to download the form.");
    }
  });

  // /submit_form command – saves the PDF to form-volt/<username>
  bot.onText(/\/submit_form/, (msg) => {
    const chatId = msg.chat.id;
    const user = getLoggedInUser(chatId);
    const memory = formMemory.get(chatId);

    if (!user) {
      bot.sendMessage(chatId, "❌ Please login first to submit a form.");
      return;
    }

    if (!memory?.formBuffer) {
      bot.sendMessage(
        chatId,
        "📭 No form found. Please use /form to upload your PDF form first."
      );
      return;
    }

    const userVoltPath = path.join(__dirname, "..", "form-volt", user.username);
    if (!fs.existsSync(userVoltPath)) {
      fs.mkdirSync(userVoltPath, { recursive: true });
    }

    // Remove any existing forms in the folder
    const existingForms = fs.readdirSync(userVoltPath);
    for (const file of existingForms) {
      fs.unlinkSync(path.join(userVoltPath, file));
    }

    // Save new form
    const savePath = path.join(userVoltPath, memory.formName);
    fs.writeFileSync(savePath, memory.formBuffer);

    formMemory.delete(chatId); // Clear the session

    bot.sendMessage(
      chatId,
      `✅ Your form has been submitted and saved successfully.`
    );
  });
};
