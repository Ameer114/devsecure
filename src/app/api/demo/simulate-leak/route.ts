import fs from "node:fs";
import path from "node:path";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: "inject" | "cleanup";
      targetFolder?: string;
    };

    let targetDir = process.cwd();
    if (body.targetFolder?.trim()) {
      const candidate = path.resolve(body.targetFolder.trim());
      if (fs.existsSync(candidate)) {
        targetDir = candidate;
      }
    }

    const testFilePath = path.join(targetDir, "test-security-leak-demo.js");
    const action = body.action || "inject";

    if (action === "inject") {
      const mockCode = `// [SECURESHIP DEMO FILE]
// This temporary file was created to test the SecureShip Security Release Gate.
// Notice that the secret scanner will detect the exposed AWS key and halt cloud deployment.

const config = {
  service: "aws-s3-backup",
  awsAccessKey: "AKIAIOSFODNN7EXAMPLE",
  awsSecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

export default config;
`;
      fs.writeFileSync(testFilePath, mockCode, "utf-8");
      return Response.json({
        ok: true,
        action: "inject",
        filePath: testFilePath,
        message: 'Temporary test file "test-security-leak-demo.js" created with an exposed AWS Access Key. Now run the CI/CD pipeline to watch SecureShip block the deployment!',
      });
    } else {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      return Response.json({
        ok: true,
        action: "cleanup",
        filePath: testFilePath,
        message: 'Temporary test file "test-security-leak-demo.js" removed. Your repository is clean again and ready to deploy!',
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
