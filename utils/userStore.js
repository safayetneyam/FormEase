// ✅ Step 1: userStore.js - manage user data (add, verify, check)

const fs = require("fs");
const path = require("path");

const usersFilePath = path.join(__dirname, "../security/users.json");

if (!fs.existsSync(path.dirname(usersFilePath))) {
  fs.mkdirSync(path.dirname(usersFilePath));
}
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, "{}", "utf-8");
}

function readUsers() {
  return JSON.parse(fs.readFileSync(usersFilePath, "utf-8"));
}

function writeUsers(users) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
}

function usernameExists(username) {
  const users = readUsers();
  return Object.hasOwn(users, username);
}

function addUser(username, email) {
  const users = readUsers();
  users[username] = { email, verified: false };
  writeUsers(users);
}

function verifyUser(username) {
  const users = readUsers();
  if (users[username]) {
    users[username].verified = true;
    writeUsers(users);
  }
}

function getUserEmail(username) {
  const users = readUsers();
  return users[username]?.email || null;
}

function isVerified(username) {
  const users = readUsers();
  return users[username]?.verified || false;
}

module.exports = {
  readUsers,
  writeUsers,
  usernameExists,
  addUser,
  verifyUser,
  getUserEmail,
  isVerified,
};
