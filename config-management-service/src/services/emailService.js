import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAILTRAP_HOST,
  port: Number(process.env.MAILTRAP_PORT),
  auth: {
    user: process.env.MAILTRAP_USER,
    pass: process.env.MAILTRAP_PASS
  }
});

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

export async function sendVerificationEmail(email, name, token) {
  const verifyUrl = `${FRONTEND}/verify?token=${token}`;
  const info = await transporter.sendMail({
    from: '"ConfigHub" <noreply@confighub.dev>',
    to: email,
    subject: 'Verify your email — ConfigHub',
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
