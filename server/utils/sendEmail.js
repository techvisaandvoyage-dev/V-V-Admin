const nodemailer = require('nodemailer');
const { JWT } = require('google-auth-library');

let missingEmailEnvLogged = false;

/**
 * Mail config resolution (no UI changes — uses existing Admin fields).
 *
 * - Normal OTP email: SMTP via smtpEmailUser + smtpEmailPass (or EMAIL_* env).
 * - Hybrids: Admin mailbox + EMAIL_PASS only in .env, or EMAIL_USER in .env + pass saved only in Admin
 *   (avoids "signup worked, login mail didn't" when credentials were split across DB vs env).
 * - Optional "Firebase-linked" path: same service account as Firebase Admin (`FIREBASE_SERVICE_ACCOUNT_JSON` in server/.env)
 *   + Google Workspace domain-wide delegation:
 *   set "Nodemailer service" to `gmail-oauth`, "SMTP email" to the mailbox to send as,
 *   leave SMTP password empty. (Firebase Auth does not send custom HTML OTP; this uses
 *   Gmail SMTP with OAuth2 + that service account.)
 */
const normalizeSmtpService = (serviceRaw) => {
  let service = String(serviceRaw || 'gmail').trim() || 'gmail';
  if (service.toLowerCase() === 'gmail-oauth') service = 'gmail';
  return service;
};

const createSmtpTransportOptions = (config) => {
  if (String(config.service || '').toLowerCase() === 'brevo') {
    return {
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    };
  }

  return {
    service: config.service,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  };
};

const getMailConfig = async () => {
  let s = null;
  try {
    const Settings = require('../models/Settings');
    s = await Settings.findOne({ singleton: 'global' }).lean();
  } catch {
    /* settings unavailable */
  }

  const envUser = String(process.env.BREVO_SMTP_USER || process.env.EMAIL_USER || '').trim();
  const envPass = String(process.env.BREVO_SMTP_KEY || process.env.EMAIL_PASS || '').trim();
  const envService = String(process.env.EMAIL_SERVICE || (process.env.BREVO_SMTP_USER ? 'brevo' : 'gmail')).trim() || 'gmail';
  const envSa = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();

  if (s) {
    const user = String(s.smtpEmailUser || '').trim();
    const pass = String(s.smtpEmailPass || '').trim();
    const serviceField = String(s.smtpEmailService || process.env.EMAIL_SERVICE || 'gmail').trim() || 'gmail';
    const saRaw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || s.firebaseServiceAccountJson || '').trim();

    const from = String(s.smtpFromEmail || '').trim();

    if (user && pass) {
      return { kind: 'smtp', user, pass, from, service: normalizeSmtpService(serviceField) };
    }

    if (user && !pass && serviceField.toLowerCase() === 'gmail-oauth' && saRaw) {
      try {
        const serviceAccount = JSON.parse(saRaw);
        if (serviceAccount?.client_email && serviceAccount?.private_key) {
          return { kind: 'gmail-oauth-delegated', delegatedUser: user, serviceAccount };
        }
      } catch {
        /* invalid JSON */
      }
    }

    /* Admin saved the send-from address but app password only lives in .env */
    if (user && !pass && envPass && serviceField.toLowerCase() !== 'gmail-oauth') {
      return { kind: 'smtp', user, pass: envPass, from, service: normalizeSmtpService(serviceField) };
    }
  }

  if (envUser && envPass) {
    return {
      kind: 'smtp',
      user: envUser,
      pass: envPass,
      from: String(process.env.EMAIL_FROM || '').trim(),
      service: normalizeSmtpService(envService),
    };
  }

  if (envUser && !envPass && envService.toLowerCase() === 'gmail-oauth' && envSa) {
    try {
      const serviceAccount = JSON.parse(envSa);
      if (serviceAccount?.client_email && serviceAccount?.private_key) {
        return { kind: 'gmail-oauth-delegated', delegatedUser: envUser, serviceAccount };
      }
    } catch {
      /* invalid JSON */
    }
  }

  /* .env mailbox + password stored only in Admin (e.g. cleared EMAIL_PASS from env) */
  if (s && envUser && !envPass) {
    const dbPass = String(s.smtpEmailPass || '').trim();
    const dbService = String(s.smtpEmailService || process.env.EMAIL_SERVICE || 'gmail').trim() || 'gmail';
    if (dbPass && dbService.toLowerCase() !== 'gmail-oauth') {
      return {
        kind: 'smtp',
        user: envUser,
        pass: dbPass,
        from: String(s.smtpFromEmail || '').trim(),
        service: normalizeSmtpService(dbService),
      };
    }
  }

  return null;
};

const createMailTransport = async (config) => {
  if (config.kind === 'smtp') {
    const transporter = nodemailer.createTransport(createSmtpTransportOptions(config));
    return { transporter, fromAddress: config.from || config.user };
  }

  if (config.kind === 'gmail-oauth-delegated') {
    const key = String(config.serviceAccount.private_key || '').replace(/\\n/g, '\n');
    const client = new JWT({
      email: config.serviceAccount.client_email,
      key,
      scopes: ['https://mail.google.com/'],
      subject: config.delegatedUser,
    });
    const accessTokenResult = await client.getAccessToken();
    const accessToken =
      typeof accessTokenResult === 'string' ? accessTokenResult : accessTokenResult?.token;
    if (!accessToken) {
      throw new Error('Gmail OAuth: no access token (check Workspace domain-wide delegation)');
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: config.delegatedUser,
        accessToken,
      },
    });
    return { transporter, fromAddress: config.delegatedUser };
  }

  throw new Error('Unknown mail configuration');
};

const sendEmail = async (options) => {
  const config = await getMailConfig();
  if (!config) {
    if (!missingEmailEnvLogged) {
      missingEmailEnvLogged = true;
      console.warn(
        '[Email] Not configured. Use Admin → SMTP (user + app password), or EMAIL_USER/EMAIL_PASS in .env, ' +
          'or split: Admin SMTP user + EMAIL_PASS in .env (or EMAIL_USER + Admin SMTP password). ' +
          'Or gmail-oauth + service account JSON + delegated mailbox (see server/utils/sendEmail.js).'
      );
    }
    return false;
  }

  let transporter;
  let fromAddress;
  try {
    ({ transporter, fromAddress } = await createMailTransport(config));
  } catch (error) {
    console.error('[Email] Transport error:', error.message || error);
    return false;
  }

  const mailOptions = {
    from: `Visa & Voyage Security <${fromAddress}>`,
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
