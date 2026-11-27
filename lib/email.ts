export async function sendSecurityEmail(to: string, subject: string, html: string) {
  const { RESEND_API_KEY, RESEND_FROM } = process.env;

  if (!RESEND_API_KEY || !RESEND_FROM) {
    if (process.env.NODE_ENV !== "production" && process.env.EMAIL_VERIFICATION_REQUIRED === "false") return false;
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html })
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Resend API error:", response.status, details.slice(0, 500));
    throw new Error(`Resend email request failed with status ${response.status}.`);
  }

  return true;
}
