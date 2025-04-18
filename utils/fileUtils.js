// ✅ Step 6: fileUtils.js - file handling logic for uploads and submissions

const fs = require("fs");
const path = require("path");

const tempUploadRoot = path.join(__dirname, "../temp-uploads");
const dataVoltRoot = path.join(__dirname, "../data-volt");

if (!fs.existsSync(tempUploadRoot)) fs.mkdirSync(tempUploadRoot);

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getUserVoltFiles(username) {
  const userVolt = path.join(dataVoltRoot, username);
  if (!fs.existsSync(userVolt)) return [];
  return fs.readdirSync(userVolt);
}

function getTempFiles(chatId) {
  const userTemp = path.join(tempUploadRoot, chatId.toString());
  if (!fs.existsSync(userTemp)) return [];
  return fs.readdirSync(userTemp);
}

function saveTempFile(chatId, fileName, buffer) {
  const userTemp = path.join(tempUploadRoot, chatId.toString());
  ensureDirExists(userTemp);
  fs.writeFileSync(path.join(userTemp, fileName), buffer);
}

function moveFilesToVolt(chatId, username) {
  const userTemp = path.join(tempUploadRoot, chatId.toString());
  const userVolt = path.join(dataVoltRoot, username);
  if (!fs.existsSync(userTemp)) return [];
  ensureDirExists(userVolt);

  const movedFiles = [];
  for (const file of fs.readdirSync(userTemp)) {
    const src = path.join(userTemp, file);
    const dest = path.join(userVolt, file);
    fs.renameSync(src, dest);
    movedFiles.push(file);
  }
  fs.rmdirSync(userTemp, { recursive: true });
  return movedFiles;
}

module.exports = {
  getUserVoltFiles,
  getTempFiles,
  saveTempFile,
  moveFilesToVolt,
};
