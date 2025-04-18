// ✅ Step 2: emailService.js - send OTP using Gmail via Nodemailer

const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function sendOtpEmail(to, otp) {
  await transporter.sendMail({
    from: `"OTP Bot" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    text: `Your OTP is: ${otp}. It is valid for 2 minutes.`,
  });
}

module.exports = { sendOtpEmail };
