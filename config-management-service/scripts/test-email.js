// Quick SMTP smoke test — verifies your SMTP_* creds and sends one email.
// Usage:  node scripts/test-email.js you@example.com
import '../src/config.js';
import nodemailer from 'nodemailer';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-email.js <recipient-email>');
  process.exit(1);
}

const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missing = required.filter((k) => !process.env[k] || process.env[k].startsWith('REPLACE_WITH'));
if (missing.length) {
  console.error(`These SMTP vars are unset or still placeholders: ${missing.join(', ')}`);
  console.error('Fill them in config-management-service/.env first.');
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

try {
  await transporter.verify();
  console.log('✓ SMTP connection + auth OK');
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: 'Test email from config-management-service',
    text: 'If you can read this, your SMTP setup works.',
  });
  console.log('✓ Sent. messageId:', info.messageId);
  console.log('  Check the inbox (and spam) of:', to);
} catch (err) {
  console.error('✗ Failed:', err.message);
  if (/auth/i.test(err.message)) console.error('  → Check SMTP_USER / SMTP_PASS (Brevo login email + SMTP key).');
  if (/sender|from|not.*verif/i.test(err.message)) console.error('  → SMTP_FROM must be a sender you verified in Brevo.');
  process.exit(1);
}
