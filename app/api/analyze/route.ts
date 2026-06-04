import { NextRequest, NextResponse } from "next/server";
import { ENTITY_CONTEXT } from "@/lib/context";

export async function POST(req: NextRequest) {
  const { title, url, date, srcName, country, focus } = await req.json();

  const ctx = ENTITY_CONTEXT[country];
  if (!ctx) return NextResponse.json({ error: "Unknown country" }, { status: 400 });

  const focusNote = focus ? `\n\n이번 주 담당자 포커스: "${focus}"` : "";

  const prompt = `당신은 해외 신재생에너지 법인의 시장동향 분석 전문가입니다.

${ctx.business}${focusNote}

아래 기사를 위 법인 사업 관점에서 분석하세요.

기사 제목: "${title}"
게재일: ${date}
출처: ${srcName} (${url})

JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "bullets": [
    "핵심 내용 1 (~했음 체, 1~2문장)",
    "핵심 내용 2",
    "핵심 내용 3",
    "핵심 내용 4",
    "핵심 내용 5"
  ],
  "implication": "법인 사업 관점 시사점 2~3줄. 구체적 프로젝트명·이슈와 연결. 보고체(~판단됨, ~필요함) 사용."
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
