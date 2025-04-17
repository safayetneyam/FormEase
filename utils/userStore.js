// ✅ Step 1: userStore.js - manage user data (add, verify, check)

const fs = require("fs");
const path = require("path");

const usersFilePath = path.join(__dirname, "../security/users.json");

// Ensure security folder and users.json exist
if (!fs.existsSync(path.dirname(usersFilePath))) {
  fs.mkdirSync(path.dirname(usersFilePath));
}

if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, "{}", "utf-8");
}

// Read users.json
function readUsers() {
  const data = fs.readFileSync(usersFilePath, "utf-8");
  return JSON.parse(data);
}

// Write to users.json
function writeUsers(users) {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
}

// Check if username exists
function usernameExists(username) {
  const users = readUsers();
  return Object.hasOwn(users, username);
}

// Add new user
function addUser(username, email) {
  const users = readUsers();
  users[username] = { email, verified: false };
  writeUsers(users);
}

// Verify user after OTP success
function verifyUser(username) {
  const users = readUsers();
  if (users[username]) {
    users[username].verified = true;
    writeUsers(users);
  }
}

// Get email for user
function getUserEmail(username) {
  const users = readUsers();
  return users[username]?.email || null;
}

// Check if verified
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
