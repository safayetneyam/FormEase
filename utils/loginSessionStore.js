// ✅ Step 4: loginSessionStore.js - persistent login tracking
const fs = require("fs");
const path = require("path");

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
  let modified = false;
  for (const chatId in logins) {
    if (logins[chatId].username === username) {
      delete logins[chatId];
      modified = true;
    }
  }
  if (modified) {
    writeLogins(logins);
  }
}

function cleanupExpiredSessions(expiryInMs) {
  const logins = readLogins();
  const now = Date.now();
  let modified = false;
  for (const chatId in logins) {
    if (now - logins[chatId].loginTime > expiryInMs) {
      delete logins[chatId];
      modified = true;
    }
  }
  if (modified) {
    writeLogins(logins);
  }
}

module.exports = {
  setLoggedInUser,
  getLoggedInUser,
  removeLoggedInUser,
  removeSessionByUsername,
  cleanupExpiredSessions,
};
