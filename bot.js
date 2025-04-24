// bot.js

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
// const fetch = require("node-fetch");

const {
  usernameExists,
  addUser,
  verifyUser,
  getUserEmail,
  isVerified,
} = require("./utils/userStore");
const { sendOtpEmail } = require("./utils/emailService");
const { generateOtp, validateOtp } = require("./utils/otpManager");
const {
  setLoggedInUser,
  getLoggedInUser,
  removeLoggedInUser,
  cleanupLoggedInSessions,
  removeSessionByUsername,
} = require("./utils/loginSessionStore");
const {
  getUserVoltFiles,
  getTempFiles,
  saveTempFile,
  moveFilesToVolt,
} = require("./utils/fileUtils");
const { processFilesForUser } = require("./label-process/fileProcessor");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
console.log("🤖 Telegram bot is running...");

cleanupLoggedInSessions();

// ================= BOT COMMAND | FORM COMMANDS =================

const registerSubmitFormCommands = require("./bot-command/submit_form");
registerSubmitFormCommands(bot);

const processForm = require("./bot-command/process_form");
processForm(bot);

const getForm = require("./bot-command/get_form");
getForm(bot);

// ===============================================================

const userStates = new Map();
const timeouts = new Map();
const uploadState = new Map();

const dataVoltPath = path.join(__dirname, "data-volt");
if (!fs.existsSync(dataVoltPath)) fs.mkdirSync(dataVoltPath);

function startAutoLogout(chatId, username) {
  if (timeouts.has(chatId)) {
    clearTimeout(timeouts.get(chatId));
  }

  const timeout = setTimeout(() => {
    const session = getLoggedInUser(chatId);

    // Only send message if this chatId is still linked to the same username
    if (session && session.username === username) {
      bot.sendMessage(chatId, "⏳ You have been logged out due to inactivity.");
    }

    removeLoggedInUser(chatId);
    timeouts.delete(chatId);
  }, 10 * 60 * 1000);

  timeouts.set(chatId, timeout);
}

bot.onText(/\/logout/, (msg) => {
  const chatId = msg.chat.id;
  if (getLoggedInUser(chatId)) {
    clearTimeout(timeouts.get(chatId));
    removeLoggedInUser(chatId);
    uploadState.set(chatId, false);
    const tempPath = path.join(__dirname, "temp-uploads", String(chatId));
    if (fs.existsSync(tempPath)) {
      fs.rmSync(tempPath, { recursive: true });
    }
    bot.sendMessage(chatId, "✅ You have been logged out.");
  } else {
    bot.sendMessage(chatId, "ℹ️ You are not currently logged in.");
  }
});

bot.onText(/\/register/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "📛 Please enter a username (no spaces):");
  userStates.set(chatId, { step: "register_username" });
});

bot.onText(/\/login/, (msg) => {
  const chatId = msg.chat.id;

  const currentUser = getLoggedInUser(chatId);
  if (currentUser) {
    bot.sendMessage(chatId, "✅ You're already logged in from this device.");
    return;
  }

  bot.sendMessage(chatId, "🔐 Please enter your username:");
  userStates.set(chatId, { step: "login_username" });
});

bot.onText(/\/files/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getLoggedInUser(chatId);
  if (!user) {
    bot.sendMessage(chatId, "❌ Please login first to upload in your volt.");
    return;
  }

  const files = getUserVoltFiles(user.username);
  const formatted = files.length
    ? files.map((f, i) => `${i + 1}. ${f}`).join("\n")
    : "📂 No files in your volt yet.";
  bot.sendMessage(
    chatId,
    `📁 Your volt files:\n${formatted}\n\n📤 Now upload files. When done, type /submit_files to confirm.`
  );
  uploadState.set(chatId, true);
});

bot.onText(/\/submit_files/, (msg) => {
  const chatId = msg.chat.id;
  const user = getLoggedInUser(chatId);
  if (!user) {
    bot.sendMessage(chatId, "❌ Please login first to submit files.");
    return;
  }

  const tempFiles = getTempFiles(chatId);
  if (!tempFiles.length) {
    bot.sendMessage(chatId, "📭 No files were uploaded yet.");
    return;
  }

  const moved = moveFilesToVolt(chatId, user.username);
  const list = moved.map((f, i) => `${i + 1}. ${f}`).join("\n");
  bot.sendMessage(chatId, `✅ Files successfully saved to your volt:\n${list}`);
  uploadState.set(chatId, false);
});

bot.on("document", async (msg) => {
  const chatId = msg.chat.id;
  const user = getLoggedInUser(chatId);
  if (!user) {
    bot.sendMessage(chatId, "❌ You must be logged in to upload files.");
    return;
  }

  if (!uploadState.get(chatId)) {
    bot.sendMessage(chatId, "⚠️ Entered Upload Command");
    return;
  }

  const fileId = msg.document.file_id;
  const fileName = msg.document.file_name;
  const fileLink = await bot.getFileLink(fileId);

  const res = await fetch(fileLink);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  saveTempFile(chatId, fileName, buffer);
  bot.sendMessage(
    chatId,
    `📎 File '${fileName}' received and saved temporarily.`
  );
});

// ✅ NEW: /process_file command
bot.onText(/\/process_file/, async (msg) => {
  const chatId = msg.chat.id;
  const user = getLoggedInUser(chatId);
  if (!user) {
    bot.sendMessage(chatId, "❌ You must be logged in to process your files.");
    return;
  }

  try {
    await processFilesForUser(user.username);
    bot.sendMessage(
      chatId,
      "✅ Files processed and label JSON generated successfully!"
    );
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, "❌ Failed to process files. Please try again.");
  }
});

// ✅ Continue handling OTP flow and registration logic
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const session = userStates.get(chatId);
  if (!session || !text || text.startsWith("/")) return;

  if (session.step === "register_username") {
    if (text.includes(" ")) {
      bot.sendMessage(chatId, "❌ Username must not contain spaces.");
      return;
    }
    if (usernameExists(text)) {
      bot.sendMessage(
        chatId,
        "❌ Username already exists. Try a different one."
      );
      return;
    }

    session.username = text;
    session.step = "register_email";
    bot.sendMessage(chatId, "📧 Enter your email to receive OTP:");
  } else if (session.step === "register_email") {
    const email = text;
    session.email = email;
    session.otp = generateOtp(chatId, "register");
    await sendOtpEmail(email, session.otp);
    session.step = "register_otp";
    bot.sendMessage(chatId, "📩 OTP sent to your email. Please enter the OTP:");
  } else if (session.step === "register_otp") {
    if (validateOtp(chatId, text, "register")) {
      addUser(session.username, session.email);
      const userPath = path.join(dataVoltPath, session.username);
      if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
      verifyUser(session.username);
      bot.sendMessage(chatId, "✅ Registration complete. You can now /login.");
      userStates.delete(chatId);
    } else {
      bot.sendMessage(chatId, "❌ Invalid OTP. Try again.");
    }
  } else if (session.step === "login_username") {
    const username = text;
    if (!usernameExists(username) || !isVerified(username)) {
      bot.sendMessage(chatId, "❌ Invalid or unverified username.");
      return;
    }

    session.username = username;
    session.otp = generateOtp(chatId, "login");
    const email = getUserEmail(username);
    await sendOtpEmail(email, session.otp);
    session.step = "login_otp";
    bot.sendMessage(
      chatId,
      "📩 OTP sent to your registered email. Please enter it:"
    );
  } else if (session.step === "login_otp") {
    if (validateOtp(chatId, text, "login")) {
      const oldChatId = removeSessionByUsername(session.username);
      if (oldChatId && oldChatId !== chatId) {
        bot.sendMessage(
          oldChatId,
          "⚠️ You have been logged out. This account was accessed from another device."
        );
      }
      setLoggedInUser(chatId, session.username);
      startAutoLogout(chatId, session.username);
      uploadState.set(chatId, false);
      bot.sendMessage(
        chatId,
        `✅ Login successful. Welcome back, ${session.username}`
      );
      userStates.delete(chatId);
    } else {
      bot.sendMessage(chatId, "❌ Incorrect OTP. Try again.");
    }
  }
});
