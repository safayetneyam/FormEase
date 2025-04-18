// ✅ Step 3: otpManager.js - manages OTP generation and expiration

const otpCache = {}; // { chatId: { otp, expiresAt, type } }

function generateOtp(chatId, type = "register") {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpCache[chatId] = {
    otp,
    type,
    expiresAt: Date.now() + 2 * 60 * 1000,
  };
  return otp;
}

function validateOtp(chatId, inputOtp, expectedType) {
  const record = otpCache[chatId];
  if (!record) return false;
  if (record.type !== expectedType) return false;
  if (record.otp !== inputOtp) return false;
  if (Date.now() > record.expiresAt) return false;
  delete otpCache[chatId];
  return true;
}

module.exports = {
  generateOtp,
  validateOtp,
};
