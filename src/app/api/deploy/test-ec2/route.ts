import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const host = body.ec2Host?.trim();
    let user = body.ec2User?.trim() || "ec2-user";
    if (/^(linux\/unix|linux|unix)$/i.test(user)) {
      user = "ec2-user";
    }

    let keyPath = body.ec2KeyPath?.trim() || "";
    keyPath = keyPath.replace(/^["']+|["']+$/g, "");

    if (!host) {
      return Response.json(
        { ok: false, error: "Please enter an EC2 Host Public IP / DNS." },
        { status: 400 }
      );
    }

    if (keyPath && !fs.existsSync(keyPath)) {
      return Response.json(
        {
          ok: false,
          error: `Identity file not found on this computer: "${keyPath}". Please check the path.`,
        },
        { status: 400 }
      );
    }

    const sshArgs: string[] = ["-n", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10"];
    if (keyPath) {
      sshArgs.push("-i", keyPath);
    }
    sshArgs.push(
      `${user}@${host}`,
      "cat /etc/os-release | grep PRETTY_NAME; node -v 2>/dev/null || echo 'node: not installed'; git --version 2>/dev/null || echo 'git: not installed'; pm2 -v 2>/dev/null || echo 'pm2: not installed'"
    );

    const { stdout, stderr } = await execFileAsync("ssh", sshArgs);
    const output = (stdout || stderr).trim();

    return Response.json({
      ok: true,
      user,
      host,
      output,
      message: `SSH Connection Successful to ${user}@${host}!`,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    let suggestion = "";
    if (errMsg.includes("timed out") || errMsg.includes("Connection timed out")) {
      suggestion = "AWS EC2 connection timed out on port 22. In AWS Console -> Security Groups -> Edit Inbound Rules -> Add Port 22 (SSH) from 0.0.0.0/0 or your IP.";
    } else if (errMsg.includes("Permission denied")) {
      suggestion = "Authentication failed (publickey). Verify that the .pem key matches this instance and that the SSH user is correct (e.g. 'ec2-user' for Amazon Linux, 'ubuntu' for Ubuntu). Do not use 'Linux/UNIX'.";
    } else if (errMsg.includes("not accessible: No such file or directory")) {
      suggestion = "PEM key file path could not be accessed. Make sure the file exists and has no surrounding quotes.";
    }

    return Response.json(
      {
        ok: false,
        error: errMsg,
        suggestion,
      },
      { status: 500 }
    );
  }
}
