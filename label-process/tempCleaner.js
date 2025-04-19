// label-process/tempCleaner.js

const fs = require("fs");
const path = require("path");

const tempProcessDir = path.join(__dirname, "..", "temp-process");
const tempInfoDir = path.join(__dirname, "..", "temp-info");

// 🔁 Delete all files in temp-process/<username>
function clearTempImages(usernamePath) {
  if (fs.existsSync(usernamePath)) {
    const files = fs.readdirSync(usernamePath);
    for (const file of files) {
      fs.unlinkSync(path.join(usernamePath, file));
    }
    fs.rmdirSync(usernamePath); // Remove empty folder
  }
}

// 🧽 Delete temp-info/<username>.txt after Gemini processing
function removeTxtFile(username) {
  const filePath = path.join(tempInfoDir, `${username}.txt`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

module.exports = { clearTempImages, removeTxtFile };
