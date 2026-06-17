import {
  getGraphAccessToken,
  GRAPH_BASE,
  requireAzureConfig,
} from "@/lib/microsoft/graph-auth";

export async function sendMailAsUser(options: {
  to: string | string[];
  subject: string;
  body: string;
  contentType?: "text" | "html";
}) {
  const { from } = requireAzureConfig();
  const to = (Array.isArray(options.to) ? options.to : [options.to])
    .map((a) => a.trim())
    .filter(Boolean);
  if (!to.length) throw new Error("Recipient email is required");

  const token = await getGraphAccessToken();
  const contentType = options.contentType === "html" ? "HTML" : "Text";

  const res = await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(from)}/sendMail`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: options.subject,
          body: { contentType, content: options.body },
          toRecipients: to.map((address) => ({
            emailAddress: { address },
          })),
        },
        saveToSentItems: true,
      }),
    }
  );

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = (await res.json()) as { error?: { message?: string } };
      detail = err.error?.message ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Graph sendMail failed (${res.status}): ${detail}`);
  }

  return { from, to };
}
