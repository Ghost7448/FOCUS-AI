export async function sendSecurityEmail(to: string, subject: string, html: string) {
  const { SL_API_KEY, SL_FROM } = process.env;

  if (!SL_API_KEY || !SL_FROM) {
    if (process.env.NODE_ENV !== "production" && process.env.EMAIL_VERIFICATION_REQUIRED === "false") return false;
    throw new Error("Email delivery is not configured. Set SL_API_KEY and SL_FROM.");
  }

  const response = await fetch("https://sendliberty.com/api/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SL_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: SL_FROM,
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Sendliberty API error:", response.status, details.slice(0, 500));
    throw new Error(`Sendliberty email request failed with status ${response.status}.`);
  }

  return true;
}
