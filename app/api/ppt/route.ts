import { NextRequest, NextResponse } from "next/server";
import PptxGenJS from "pptxgenjs";

const COUNTRY_LABELS: Record<string, string> = {
  JP: "일본", US: "미국", EU: "유럽", AU: "호주",
};

const COUNTRY_COLORS: Record<string, { accent: string; bg: string }> = {
  JP: { accent: "E8521A", bg: "FFF4EE" },
  US: { accent: "1A56DB", bg: "EEF2FF" },
  EU: { accent: "7C3AED", bg: "F5F3FF" },
  AU: { accent: "059669", bg: "ECFDF5" },
};

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { title, bullets = [], implication = "", srcName, date, url, country } = data;

  const cfg = COUNTRY_COLORS[country] || COUNTRY_COLORS.JP;
  const countryLabel = COUNTRY_LABELS[country] || country;

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.defineLayout({ name: "CUSTOM", width: 10, height: 7.5 });

  const slide = pptx.addSlide();

  // 배경 — 흰색
  slide.background = { color: "FFFFFF" };

  // 상단 색상 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.08,
    fill: { color: cfg.accent },
    line: { color: cfg.accent },
  });

  // 국가 레이블 (좌상단)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 0.22, w: 0.9, h: 0.3,
    fill: { color: cfg.bg },
    line: { color: cfg.accent, width: 1 },
    rectRadius: 0.06,
  });
  slide.addText(countryLabel, {
    x: 0.4, y: 0.22, w: 0.9, h: 0.3,
    align: "center", valign: "middle",
    fontSize: 10, bold: true,
    color: cfg.accent,
    fontFace: "맑은 고딕",
  });

  // 구분선
  slide.addShape(pptx.ShapeType.line, {
    x: 0.4, y: 0.62, w: 9.2, h: 0,
    line: { color: "EBEBEB", width: 0.5 },
  });

  // 기사 제목
  slide.addText(`• ${title}`, {
    x: 0.4, y: 0.68, w: 9.2, h: 0.55,
    fontSize: 13.5, bold: true, color: "0F0F0F",
    fontFace: "맑은 고딕",
    valign: "middle",
    wrap: true,
  });

  // 본문 불렛
  const bulletItems = bullets.map((b: string) => ({
    text: b,
    options: {
      fontSize: 10.5,
      color: "3D3D3D",
      fontFace: "맑은 고딕",
      bullet: { type: "number", style: "romanLcParenBoth" },
      indentLevel: 1,
      paraSpaceBefore: 4,
      lineSpacingMultiple: 1.3,
    },
  }));

  if (bulletItems.length > 0) {
    slide.addText(bulletItems, {
      x: 0.55, y: 1.28, w: 9.0, h: 4.2,
      valign: "top",
      bullet: { indent: 15 },
    });
  }

  // 시사점 박스
  const implY = Math.min(1.38 + bullets.length * 0.42, 5.2);
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: implY, w: 9.2, h: 0.7,
    fill: { color: "EEF2FF" },
    line: { color: "1A56DB", width: 1.5 },
    rectRadius: 0.08,
  });
  slide.addText(`☞  ${implication}`, {
    x: 0.55, y: implY, w: 9.0, h: 0.7,
    fontSize: 10.5, color: "1A3A8A", bold: false,
    fontFace: "맑은 고딕",
    valign: "middle", wrap: true,
  });

  // 하단 출처 바
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.1, w: "100%", h: 0.4,
    fill: { color: "F7F7F7" },
    line: { color: "EBEBEB", width: 0.5 },
  });
  slide.addText([
    { text: `출처: ${srcName}, `, options: { color: "888888", fontSize: 9 } },
    { text: `${title} (${date})`, options: { color: "1A56DB", fontSize: 9, hyperlink: { url } } },
  ], {
    x: 0.4, y: 7.1, w: 9.2, h: 0.4,
    valign: "middle",
    fontFace: "맑은 고딕",
  });

  const buffer = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="market_report_${country}_${Date.now()}.pptx"`,
    },
  });
}
