const nodemailer = require('nodemailer');
const env = require('../env.json');

async function sendMail(productName, content) {
  console.log();
  console.log('Enviando email: ', productName);

  const transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: true,
    auth: {
      user: env.email.user,
      pass: env.email.pass,
    },
  });

  return transporter.sendMail({
    from: env.email.email,
    to: env.email.email,
    subject: `Alerta de Preços - ${productName}`,
    text: content,
    html: content,
  });
}

module.exports = { sendMail };
