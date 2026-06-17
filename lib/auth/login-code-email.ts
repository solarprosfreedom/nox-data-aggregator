import { sendMailAsUser } from "@/lib/microsoft/graph-mail";

function loginCodeHtml(code: string) {
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:32px;background:#0f172a;font-family:sans-serif;">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;">
    <div style="width:48px;height:48px;line-height:48px;border-radius:12px;background:#0891b2;color:#fff;font-size:22px;font-weight:700;margin:0 auto;">N</div>
    <h1 style="font-size:20px;color:#0f172a;">NOX PWR sign-in code</h1>
    <p style="color:#64748b;font-size:14px;">Enter this code on the sign-in page.</p>
    <div style="font-size:28px;font-weight:700;letter-spacing:6px;color:#0e7490;padding:14px;background:#ecfeff;border-radius:10px;">${code}</div>
  </div>
</body>
</html>`;
}

export async function sendLoginCodeEmail(options: { to: string; code: string }) {
  await sendMailAsUser({
    to: options.to,
    subject: `${options.code} is your NOX PWR sign-in code`,
    body: loginCodeHtml(options.code),
    contentType: "html",
  });
}
