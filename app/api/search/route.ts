import { NextRequest, NextResponse } from "next/server";
import { ENTITY_CONTEXT, SOURCES } from "@/lib/context";

export async function POST(req: NextRequest) {
  const { country, week, focus, sources: clientSources } = await req.json();

  const countries = country === "ALL" ? ["JP", "US", "EU", "AU"] : [country];

  const sourceList = countries.map((cc) => {
    const ctx = ENTITY_CONTEXT[cc];
    const srcs = (clientSources?.[cc] ?? SOURCES[cc] ?? []) as { name: string; url: string }[];
    return `${ctx.flag} ${ctx.name}: ${srcs.map((s) => `${s.name}(${s.url})`).join(", ")}`;
  }).join("\n");

  const focusNote = focus ? `\n이번 주 포커스: "${focus}"` : "";

  const prompt = `당신은 해외 신재생에너지 시장동향 수집 전문가입니다.${focusNote}

아래 소스에서 ${week} 내에 게재된 주요 기사를 국가별 2~3건씩 수집하세요.
반드시 웹 검색으로 실제 기사를 확인 후 응답하세요.

탐색 소스:
${sourceList}

조건:
- 게재일이 반드시 "${week}" 범위 내 기사만 포함
- 제목은 한글로 번역
- 실제 존재하는 URL만 사용

JSON 배열로만 응답하세요 (마크다운 없이):
[
  {
    "id": "고유ID(영문숫자8자)",
    "title": "기사 제목 (한글)",
    "date": "M/DD",
    "url": "원문 URL",
    "srcName": "소스 매체명",
    "country": "JP 또는 US 또는 EU 또는 AU"
  }
]`;

  try {
    // 1차 시도: 웹검색 베타 포함
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5-20251101",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();

    // 웹검색 베타 미지원 시 일반 모드로 폴백
    if (data.error) {
      console.error("Web search attempt failed:", JSON.stringify(data.error));
      return await searchFallback(prompt);
    }

    const textBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === "text");
    const raw = textBlocks.map((b: { text: string }) => b.text).join("");
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ articles: [] });
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ articles: parsed });

  } catch (e) {
    console.error("Search error:", e);
    return NextResponse.json({ articles: [] }, { status: 500 });
  }
}

// 웹검색 베타 없이 일반 claude로 폴백
async function searchFallback(prompt: string) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt + "\n\n※ 웹 검색 없이 알고 있는 최신 정보 기준으로 응답하세요." }],
      }),
    });
    const data = await res.json();
    if (data.error) {
      console.error("Fallback also failed:", JSON.stringify(data.error));
      return NextResponse.json({ articles: [], error: data.error.message }, { status: 500 });
    }
    const raw = data.content?.[0]?.text ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ articles: [] });
    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ articles: parsed, fallback: true });
  } catch (e) {
    console.error("Fallback error:", e);
    return NextResponse.json({ articles: [] }, { status: 500 });
  }
}
