import { NextRequest, NextResponse } from "next/server";
import { ENTITY_CONTEXT, SOURCES } from "@/lib/context";

export async function POST(req: NextRequest) {
  const { country, week, focus } = await req.json();

  const countries = country === "ALL" ? ["JP", "US", "EU", "AU"] : [country];

  const sourceList = countries.map((cc) => {
    const ctx = ENTITY_CONTEXT[cc];
    const srcs = SOURCES[cc] || [];
    return `${ctx.flag} ${ctx.name}: ${srcs.map((s) => s.url).join(", ")}`;
  }).join("\n");

  const focusNote = focus ? `\n이번 주 포커스: "${focus}"` : "";

  const prompt = `당신은 해외 신재생에너지 시장동향 수집 전문가입니다.${focusNote}

아래 소스에서 ${week} 주요 기사를 국가별 2~3건씩 수집하세요.

탐색 소스:
${sourceList}

JSON 배열로만 응답하세요 (마크다운 없이):
[
  {
    "id": "고유ID(영문숫자)",
    "title": "기사 제목 (한글 번역, 원문이 외국어여도 한글로)",
    "date": "M/DD",
    "url": "원문 URL",
    "srcName": "소스 매체명",
    "country": "JP 또는 US 또는 EU 또는 AU"
  }
]

반드시 실제 존재하는 최근 기사만 포함하세요.`;

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
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    const raw = textBlock?.text || "[]";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return NextResponse.json({ articles: parsed });
  } catch {
    return NextResponse.json({ articles: [] }, { status: 500 });
  }
}
