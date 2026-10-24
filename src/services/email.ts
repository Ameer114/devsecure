import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/lib/logger";

export interface SendAlertParams {
  to: string;
  subject: string;
  repoFullName: string;
  commitSha: string;
  branch: string;
  findingDetails: {
    ruleId: string;
    title: string;
    filePath?: string | null;
    startLine?: number | null;
    severity?: string;
  }[];
  aiExplanation?: string;
  aiSuggestion?: string;
  smtpConfig?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
  };
}

export async function sendSecurityAlertEmail(params: SendAlertParams): Promise<{
  ok: boolean;
  messageId?: string;
  previewUrl?: string | false;
  isRealDelivery?: boolean;
  error?: string;
}> {
  try {
    const { to, subject, repoFullName, commitSha, branch, findingDetails, aiExplanation, aiSuggestion } = params;

    // Use environment variables or provided config
    const host = params.smtpConfig?.host || process.env.SMTP_HOST;
    const port = params.smtpConfig?.port || Number(process.env.SMTP_PORT) || 587;
    const user = params.smtpConfig?.user || process.env.SMTP_USER;
    const pass = params.smtpConfig?.pass || process.env.SMTP_PASS;
    const from = params.smtpConfig?.from || process.env.SMTP_FROM || `"SecureShip Security Gate" <alerts@secureship.local>`;

    let transporter: Transporter;

    if (host && user && pass) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      // Create ephemeral Ethereal test account if no live SMTP is set up
      try {
        const testAccount = await Promise.race([
          nodemailer.createTestAccount(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Ethereal test account timeout")), 4000)
          ),
        ]);
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        logger.info("Using ephemeral Ethereal SMTP for alert delivery", { user: testAccount.user });
      } catch (etherealErr) {
        logger.warn("Ethereal sandbox unavailable or timed out, using resilient fallback transport", {
          etherealErr,
        });
        transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }

    const findingListHtml = findingDetails
      .map(
        (f) => `
        <li style="margin-bottom: 12px; padding: 10px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
          <strong style="color: #991b1b;">[${f.severity || "CRITICAL"}] ${f.title}</strong><br/>
          <span style="font-family: monospace; font-size: 13px; color: #374151;">Location: ${f.filePath ?? "Unknown"}${f.startLine ? `:${f.startLine}` : ""}</span><br/>
          <span style="font-family: monospace; font-size: 12px; color: #6b7280;">Rule ID: ${f.ruleId}</span>
        </li>`
      )
      .join("");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #1f2937; line-height: 1.5;">
        <div style="background-color: #0f172a; padding: 20px; border-radius: 8px 8px 0 0; border-bottom: 3px solid #ef4444;">
          <h1 style="color: #ffffff; font-size: 20px; margin: 0;">🛡️ SecureShip Security Release Gate Alert</h1>
          <p style="color: #94a3b8; font-size: 13px; margin: 5px 0 0 0;">Automated pipeline policy enforcement notification</p>
        </div>
        
        <div style="padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background-color: #ffffff;">
          <p style="font-size: 15px; margin-top: 0;">
            A deployment attempt to <strong>${repoFullName}</strong> on branch <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${branch}</code> 
            (commit <code style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${commitSha.slice(0, 7)}</code>) was 
            <strong style="color: #dc2626;">BLOCKED</strong> by the deterministic policy release gate.
          </p>

          <h3 style="color: #0f172a; font-size: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">Detected Security Findings:</h3>
          <ul style="list-style: none; padding-left: 0; margin-top: 10px;">
            ${findingListHtml}
          </ul>

          ${
            aiExplanation
              ? `
            <div style="margin-top: 20px; padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <h4 style="margin: 0 0 6px 0; color: #0284c7; font-size: 13px;">🤖 AI Remediation Analysis (Groq Llama 3.3)</h4>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #334155;">${aiExplanation}</p>
              ${aiSuggestion ? `<p style="margin: 0; font-size: 13px; color: #166534; font-weight: 500;">Remediation: ${aiSuggestion}</p>` : ""}
            </div>`
              : ""
          }

          <div style="margin-top: 24px; padding: 12px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 12px; color: #92400e;">
            🔒 <strong>Zero-Secret Policy:</strong> SecureShip never logs or emails the actual secret value. Findings identify the rule and line number so you can rotate and scrub the token immediately.
          </div>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info("Security alert email sent", {
      messageId: info.messageId,
      recipient: to,
      previewUrl: previewUrl || undefined,
    });

    return {
      ok: true,
      messageId: info.messageId,
      previewUrl,
      isRealDelivery: Boolean(host && user && pass),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error("Failed to send alert email", { error });
    return { ok: false, error };
  }
}
