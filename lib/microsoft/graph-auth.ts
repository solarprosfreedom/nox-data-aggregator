let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function azureEnv() {
  return {
    tenantId: process.env.AZURE_TENANT_ID?.trim() ?? "",
    clientId: process.env.AZURE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.AZURE_CLIENT_SECRET?.trim() ?? "",
    from:
      process.env.LOGIN_EMAIL_FROM?.trim() ??
      process.env.WELCOME_EMAIL_FROM?.trim() ??
      "",
  };
}

export function isGraphMailConfigured() {
  const { tenantId, clientId, clientSecret, from } = azureEnv();
  return Boolean(tenantId && clientId && clientSecret && from);
}

export function requireAzureConfig() {
  const cfg = azureEnv();
  if (!cfg.tenantId || !cfg.clientId || !cfg.clientSecret || !cfg.from) {
    throw new Error("Microsoft Graph not configured.");
  }
  return cfg;
}

export async function getGraphAccessToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = requireAzureConfig();
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Azure token request failed: ${data.error_description ?? data.error ?? "Unknown"}`
    );
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.accessToken;
}

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
