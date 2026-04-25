const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Configured to use a dummy host if ENV vars are not set
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'dummy@gmail.com',
      pass: process.env.EMAIL_PASS || 'dummy-pass',
    },
  });

  const mailOptions = {
    from: `Visa & Voyage Security <${process.env.EMAIL_USER || 'noreply@visaandvoyage.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Email could not be sent: ', error);
    return false;
  }
};

module.exports = sendEmail;
