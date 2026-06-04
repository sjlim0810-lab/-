import { NextRequest, NextResponse } from "next/server";
import { ENTITY_CONTEXT } from "@/lib/context";

export async function POST(req: NextRequest) {
  const { title, url, date, srcName, country, focus } = await req.json();

  const ctx = ENTITY_CONTEXT[country];
  if (!ctx) return NextResponse.json({ error: "Unknown country" }, { status: 400 });

  const focusNote = focus ? `\n\n이번 주 담당자 포커스: "${focus}"` : "";

  const prompt = `당신은 해외 신재생에너지 법인의 시장동향 분석 전문가입니다.

${ctx.business}${focusNote}

아래 기사를 웹에서 검색·열람한 후, 위 법인 사업 관점에서 분석하세요.

기사 제목: "${title}"
게재일: ${date}
출처: ${srcName} (${url})

지침:
- 불렛 7~8개, 보고체(~했음, ~확인되었음, ~판단됨)
- 내용이 겹치면 자연스럽게 통합하여 7~8개 이내로 유지
- 제언은 구체적 프로젝트명·이슈와 연결, 2~3줄

JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "bullets": [
    "핵심 내용 1 (~했음 체, 1~2문장)",
    "핵심 내용 2",
    "핵심 내용 3",
    "핵심 내용 4",
    "핵심 내용 5",
    "핵심 내용 6",
    "핵심 내용 7"
  ],
  "implication": "법인 사업 관점 시사점 2~3줄. 구체적 프로젝트명·이슈와 연결. 보고체 사용."
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    // 웹 검색 결과 포함 모든 텍스트 블록에서 JSON 추출
    const textBlock = data.content?.filter((b: { type: string }) => b.type === "text").pop();
    const raw = textBlock?.text || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
