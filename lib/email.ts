import nodemailer from "nodemailer";

export async function sendSecurityEmail(to: string, subject: string, html: string) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    if (process.env.NODE_ENV !== "production" && process.env.EMAIL_VERIFICATION_REQUIRED === "false") return false;
    throw new Error("Email delivery is not configured. Set the SMTP environment variables.");
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
  await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
  return true;
}
