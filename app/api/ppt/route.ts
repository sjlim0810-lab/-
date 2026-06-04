import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const data = await req.json();

  const tmpDir = os.tmpdir();
  const outPath = path.join(tmpDir, `slide_${Date.now()}.pptx`);
  const templatePath = path.join(process.cwd(), "public", "template.pptx");
  const scriptPath = path.join(process.cwd(), "scripts", "generate_ppt.py");

  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({ error: "Template not found" }, { status: 500 });
  }

  const payload = JSON.stringify(data).replace(/'/g, "\\'");

  try {
    await execAsync(`python3 "${scriptPath}" '${payload}' "${templatePath}" "${outPath}"`);
    const fileBuffer = fs.readFileSync(outPath);
    fs.unlinkSync(outPath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="market_report_${data.country}_${Date.now()}.pptx"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "PPT generation failed" }, { status: 500 });
  }
}
