const fs = require("fs");

function loadJson(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data ? JSON.parse(data) : {};
  } catch (err) {
    return {};
  }
}

function saveJson(filePath, jsonData) {
  fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2));
}

module.exports = {
  loadJson,
  saveJson,
};
