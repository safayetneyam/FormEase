// ✅ Step 4: loginSessionStore.js - persistent login tracking

const fs = require("fs");
const path = require("path");
const { loadJson, saveJson } = require("./jsonUtils");

const loginFilePath = path.join(__dirname, "../security/loggedin.json");
if (!fs.existsSync(loginFilePath)) {
  fs.writeFileSync(loginFilePath, "{}", "utf-8");
}

function readLogins() {
  return JSON.parse(fs.readFileSync(loginFilePath, "utf-8"));
}

function writeLogins(data) {
  fs.writeFileSync(loginFilePath, JSON.stringify(data, null, 2), "utf-8");
}

function setLoggedInUser(chatId, username) {
  const logins = readLogins();
  logins[chatId] = {
    username,
    loginTime: Date.now(),
  };
  writeLogins(logins);
}

function getLoggedInUser(chatId) {
  const logins = readLogins();
  return logins[chatId] || null;
}

function removeLoggedInUser(chatId) {
  const logins = readLogins();
  if (logins[chatId]) {
    delete logins[chatId];
    writeLogins(logins);
  }
}

function removeSessionByUsername(username) {
  const logins = readLogins();
  let removedChatId = null;
  for (const chatId in logins) {
    if (logins[chatId].username === username) {
      removedChatId = chatId;
      delete logins[chatId];
      break;
    }
  }
  writeLogins(logins);
  return removedChatId;
}

function cleanupLoggedInSessions() {
  const sessions = loadJson(loginFilePath);
  saveJson(loginFilePath, {}); // Clear all sessions
}

module.exports = {
  setLoggedInUser,
  getLoggedInUser,
  removeLoggedInUser,
  removeSessionByUsername,
  cleanupLoggedInSessions,
};
