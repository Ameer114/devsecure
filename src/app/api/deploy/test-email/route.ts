import { sendSecurityAlertEmail } from "@/services/email";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      recipient?: string;
      smtpConfig?: {
        host?: string;
        port?: number;
        user?: string;
        pass?: string;
        from?: string;
      };
    };

    const recipient = body.recipient?.trim();
    if (!recipient) {
      return Response.json(
        { ok: false, error: "Please enter a valid recipient email address." },
        { status: 400 }
      );
    }

    const result = await sendSecurityAlertEmail({
      to: recipient,
      subject: "🛡️ [SecureShip Test] Real-time Security Alert Verification",
      repoFullName: "SecureShip/DevSecure",
      commitSha: "test_verification_sha",
      branch: "main",
      findingDetails: [
        {
          ruleId: "aws-access-key-id",
          title: "AWS Access Key ID exposed in configuration",
          filePath: "src/config/aws.ts",
          startLine: 14,
          severity: "CRITICAL",
        },
      ],
      aiExplanation:
        "An active AWS Access Key ID was detected in source code. This grants unauthenticated API calls to your cloud infrastructure.",
      aiSuggestion:
        "Move the secret to your local .env file, add .env to .gitignore, and access the token via process.env.AWS_ACCESS_KEY_ID.",
      smtpConfig: body.smtpConfig,
    });

    if (!result.ok) {
      return Response.json(
        {
          ok: false,
          error: result.error || "Failed to send email. Check your SMTP credentials.",
        },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      message: result.isRealDelivery
        ? `Test alert email successfully sent to ${recipient}! Check your inbox (or spam folder).`
        : `Test email created on Ethereal sandbox! View email preview: ${result.previewUrl}. To receive real emails in your inbox, enter your SMTP / Gmail credentials below.`,
      previewUrl: result.previewUrl || undefined,
      isRealDelivery: result.isRealDelivery,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
