// ✅ Step 5: bot.js - handles commands, login, logout

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
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
  cleanupExpiredSessions,
  removeSessionByUsername,
} = require("./utils/loginSessionStore");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
console.log("🤖 Telegram bot is running...");

cleanupExpiredSessions(10 * 60 * 1000); // 10 minutes

const userStates = new Map();
const timeouts = new Map();
const dataVoltPath = path.join(__dirname, "data-volt");
if (!fs.existsSync(dataVoltPath)) fs.mkdirSync(dataVoltPath);

function startAutoLogout(chatId) {
  if (timeouts.has(chatId)) {
    clearTimeout(timeouts.get(chatId));
  }
  const timeout = setTimeout(() => {
    bot.sendMessage(chatId, "⏳ You have been logged out due to inactivity.");
    removeLoggedInUser(chatId);
    timeouts.delete(chatId);
  }, 5 * 60 * 1000);
  timeouts.set(chatId, timeout);
}

bot.onText(/\/logout/, (msg) => {
  const chatId = msg.chat.id;
  if (getLoggedInUser(chatId)) {
    clearTimeout(timeouts.get(chatId));
    removeLoggedInUser(chatId);
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
  bot.sendMessage(chatId, "🔐 Please enter your username:");
  userStates.set(chatId, { step: "login_username" });
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const session = userStates.get(chatId);
  const text = msg.text?.trim();

  if (!session || msg.text.startsWith("/")) return;

  if (session.step === "register_username") {
    if (/\s/.test(text)) {
      bot.sendMessage(
        chatId,
        "❌ Username must not contain spaces. Try again:"
      );
      return;
    }
    if (usernameExists(text)) {
      bot.sendMessage(chatId, "⚠️ Username already exists. Choose another:");
      return;
    }
    session.username = text;
    session.step = "register_email";
    bot.sendMessage(chatId, "📧 Now enter your email address:");
    return;
  }

  if (session.step === "register_email") {
    const otp = generateOtp(chatId, "register");
    session.email = text;
    try {
      await sendOtpEmail(text, otp);
      session.step = "register_otp";
      bot.sendMessage(chatId, "📨 OTP sent! Enter the code:");
    } catch (err) {
      console.error("Email error:", err);
      bot.sendMessage(chatId, "❌ Failed to send OTP. Try again later.");
      userStates.delete(chatId);
    }
    return;
  }

  if (session.step === "register_otp") {
    if (validateOtp(chatId, text, "register")) {
      addUser(session.username, session.email);
      verifyUser(session.username);
      const folderPath = path.join(dataVoltPath, session.username);
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);
      bot.sendMessage(
        chatId,
        `✅ Registration successful! Welcome, ${session.username}`
      );
    } else {
      bot.sendMessage(chatId, "❌ Invalid or expired OTP. Try again.");
    }
    userStates.delete(chatId);
    return;
  }

  if (session.step === "login_username") {
    if (!usernameExists(text)) {
      bot.sendMessage(chatId, "❌ Username not found. Try registering first.");
      userStates.delete(chatId);
      return;
    }
    if (!isVerified(text)) {
      bot.sendMessage(
        chatId,
        "⚠️ User not verified. Please complete registration."
      );
      userStates.delete(chatId);
      return;
    }
    const email = getUserEmail(text);
    const otp = generateOtp(chatId, "login");
    session.username = text;
    try {
      await sendOtpEmail(email, otp);
      session.step = "login_otp";
      bot.sendMessage(
        chatId,
        "📨 OTP sent to your email. Enter the code to login:"
      );
    } catch (err) {
      console.error("Email error:", err);
      bot.sendMessage(chatId, "❌ Failed to send OTP. Try again later.");
      userStates.delete(chatId);
    }
    return;
  }

  if (session.step === "login_otp") {
    if (validateOtp(chatId, text, "login")) {
      removeSessionByUsername(session.username); // ✅ Enforce one session per user
      setLoggedInUser(chatId, session.username);
      startAutoLogout(chatId);
      bot.sendMessage(
        chatId,
        `✅ Login successful. Welcome back, ${session.username}`
      );
    } else {
      bot.sendMessage(chatId, "❌ Invalid or expired OTP. Try again.");
    }
    userStates.delete(chatId);
  }
});
