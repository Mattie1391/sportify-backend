const nodeMailer = require("nodemailer");
const config = require("../config");
const gmailUserName = config.get("email.gmailUserName");
const gmailAppPassword = config.get("email.gmailAppPassword");
const generateError = require("./generateError");

//創建郵件傳輸器
const transporter = nodeMailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailUserName,
    pass: gmailAppPassword,
  },
});

function sendEmail(mailOptions) {
  //發送郵件
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      //如果發送郵件失敗，則回傳HTTP 500錯誤
      return next(generateError(500, "無法發送電子郵件，請稍後再試"));
    }
  });
}

function sendUserVerificationEmail(email, verificationLink) {
  const mailOptions = {
    from: "Sportify Plus <sportifyplus2025@gmail.com>", // 寄件者名稱和電子郵件
    to: email, // 收件者的電子郵件地址
    subject: "Sportify+認證郵件", // 郵件主旨
    text: `請點選以下連結認證您的帳號(一小時內有效)：\n${verificationLink}`, // 純文字內容
    html: `<p>請點選以下連結認證您的帳號(一小時內有效)：</p><a href="${verificationLink}">${verificationLink}</a>`, // HTML 格式內容
  };
  sendEmail(mailOptions);
}

function sendResetPasswordEmail(email, resetLink) {
  const mailOptions = {
    from: "Sportify Plus <sportifyplus2025@gmail.com>", // 寄件者名稱和電子郵件
    to: email, // 收件者的電子郵件地址
    subject: "Sportify+重設密碼郵件", // 郵件主旨
    text: `請點選以下連結重設您的密碼(一小時內有效)：\n${resetLink}`, // 純文字內容
    html: `<p>請點選以下連結重設您的密碼(一小時內有效)：</p><a href="${resetLink}">${resetLink}</a>`, // HTML 格式內容
  };
  sendEmail(mailOptions);
}

function sendReviewEmail(email, subject, text, reviewComment) {
  // 定義要發送的郵件內容
  const mailOptions = {
    from: "Sportify Plus <sportifyplus2025@gmail.com>", // 寄件者名稱和電子郵件
    to: email, // 收件者的電子郵件地址
    subject: subject, // 郵件主旨
    text: text, // 純文字內容
    html: `<a href="https://tteddhuang.github.io/sportify-plus/"><p>立即前往Sportify+查看</p></a><p>${reviewComment}`, // HTML 格式內容
  };
  sendEmail(mailOptions);
}

module.exports = {
  sendEmail,
  sendUserVerificationEmail,
  sendResetPasswordEmail,
  sendReviewEmail,
};