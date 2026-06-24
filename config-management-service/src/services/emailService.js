import nodemailer from 'nodemailer';

const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // 465 = implicit TLS; 587 = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Must match a sender verified with your provider (with Brevo single-sender
// verification this is your own email), otherwise the provider rejects the message.
const FROM = process.env.SMTP_FROM || '"Authzy" <no-reply@example.com>';
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendVerificationEmail(email, name, token) {
  const verifyUrl = `${FRONTEND}/verify?token=${token}`;
  const info = await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your email — Authzy',
    html: `
<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff">
  <h2 style="margin:0 0 8px;color:#1a1a2e;font-size:20px">Verify your email</h2>
  <p style="color:#555;font-size:14px;margin:0 0 24px">Hi ${name}, thanks for signing up. Click the button below to activate your account. The link expires in 24 hours.</p>
  <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a2e;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">Verify my email</a>
  <p style="color:#aaa;font-size:12px;margin:24px 0 0">Or copy this link: ${verifyUrl}</p>
  <p style="color:#ccc;font-size:12px;margin:8px 0 0">If you didn't create this account you can ignore this email.</p>
</div>`
  });
  console.log('Verification email sent to:', email, '| messageId:', info.messageId);
}
