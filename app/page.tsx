"use client";
import { useState, useCallback } from "react";
import { ENTITY_CONTEXT, Article } from "@/lib/context";

const WEEKS = [
  { label: "2026년 23주차 (6/1~6/7)", value: "2026-W23" },
  { label: "2026년 22주차 (5/25~5/31)", value: "2026-W22" },
  { label: "2026년 21주차 (5/18~5/24)", value: "2026-W21" },
  { label: "2026년 20주차 (5/11~5/17)", value: "2026-W20" },
];

const CC_COLORS: Record<string, { text: string; bg: string }> = {
  JP: { text: "#C2410C", bg: "#FFF7ED" },
  US: { text: "#1D4ED8", bg: "#EFF6FF" },
  EU: { text: "#6D28D9", bg: "#F5F3FF" },
  AU: { text: "#065F46", bg: "#ECFDF5" },
};

export default function Dashboard() {
  const [tab, setTab] = useState("ALL");
  const [week, setWeek] = useState(WEEKS[0].value);
  const [focus, setFocus] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [searchMsg, setSearchMsg] = useState("");

  const weekLabel = WEEKS.find((w) => w.value === week)?.label || week;

  const handleSearch = useCallback(async (country = "ALL") => {
    setLoading(true);
    setSearchMsg("기사 탐색 중...");
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, week: weekLabel, focus }),
      });
      const data = await res.json();
      if (data.articles?.length) {
        setArticles((prev) => {
          const ids = new Set(prev.map((a) => a.id));
          return [...prev, ...data.articles.filter((a: Article) => !ids.has(a.id))];
        });
        setSearchMsg(data.articles.length + "건 추가됨");
      } else {
        setSearchMsg("기사를 찾지 못했습니다. 다시 시도해보세요.");
      }
    } catch {
      setSearchMsg("탐색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setTimeout(() => setSearchMsg(""), 3000);
    }
  }, [weekLabel, focus]);

  const handleExpand = useCallback(async (article: Article) => {
    if (expanded === article.id) { setExpanded(null); return; }
    setExpanded(article.id);
    if (article.analyzed) return;
    setAnalyzing(article.id);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...article, focus }),
      });
      const data = await res.json();
      setArticles((prev) =>
        prev.map((a) => a.id === article.id
          ? { ...a, bullets: data.bullets, implication: data.implication, analyzed: true }
          : a
        )
      );
    } catch {
      setArticles((prev) =>
        prev.map((a) => a.id === article.id
          ? { ...a, implication: "분석 중 오류. 원문 링크를 확인해주세요.", analyzed: true }
          : a
        )
      );
    } finally {
      setAnalyzing(null);
    }
  }, [expanded, focus]);

  const handleExport = useCallback(async (article: Article) => {
    if (!article.analyzed) { alert("먼저 기사를 클릭해 시사점을 생성해주세요."); return; }
    setExportingId(article.id);
    try {
      const res = await fetch("/api/ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(article),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `시장동향_${ENTITY_CONTEXT[article.country]?.name}_${article.date}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("PPT 생성 중 오류가 발생했습니다.");
    } finally {
      setExportingId(null);
    }
  }, []);

  const filtered = articles.filter((a) => tab === "ALL" || a.country === tab);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[15px] font-semibold text-gray-900">해외법인 시장동향</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">신재생에너지 주간 보고 · 기사 클릭 시 법인 관점 시사점 자동 생성</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="text-[12px] px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 focus:outline-none focus:border-orange-400"
            >
              {WEEKS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
            <button
              onClick={() => handleSearch("ALL")}
              disabled={loading}
              className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {loading ? <span className="flex gap-0.5">{[0,1,2].map(i=><span key={i} className="w-1 h-1 rounded-full bg-white animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</span> : "↻"}
              전체 탐색
            </button>
          </div>
        </div>

        {/* 포커스 바 */}
        <div className="max-w-4xl mx-auto px-5 pb-3">
          <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-xl px-3.5 py-2">
            <span className="text-[11px] font-semibold text-orange-500 whitespace-nowrap shrink-0">이번 주 포커스</span>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="예) 일본 FIT 매각 타이밍, 미국 Tax Equity 동향 (선택사항 — 입력 시 시사점 구체화)"
              className="flex-1 text-[12px] bg-transparent border-none outline-none text-gray-600 placeholder-gray-400"
            />
          </div>
        </div>

        {/* 탭 */}
        <div className="max-w-4xl mx-auto px-5 flex items-center border-t border-gray-100">
          {["ALL","JP","US","EU","AU"].map((cc) => {
            const ctx = cc === "ALL" ? null : ENTITY_CONTEXT[cc];
            const count = cc === "ALL" ? articles.length : articles.filter(a=>a.country===cc).length;
            return (
              <button key={cc} onClick={() => setTab(cc)}
                className={`text-[12px] px-4 py-2.5 font-medium border-b-2 transition-colors ${tab===cc ? "border-orange-500 text-orange-500" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
                {cc==="ALL" ? "전체" : `${ctx?.flag} ${ctx?.name}`}
                {count>0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-1 py-1.5">
            {(["JP","US","EU","AU"] as const).map((cc) => (
              <button key={cc} onClick={() => handleSearch(cc)} disabled={loading}
                title={`${ENTITY_CONTEXT[cc].name} 탐색`}
                className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500 disabled:opacity-40 transition-colors">
                {ENTITY_CONTEXT[cc].flag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 상태 메시지 */}
      {searchMsg && (
        <div className="max-w-4xl mx-auto px-5 pt-3">
          <div className="text-[12px] text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">{searchMsg}</div>
        </div>
      )}

      {/* 기사 목록 */}
      <div className="max-w-4xl mx-auto px-5 py-4">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3 opacity-30">📰</div>
            <p className="text-[13px]">상단 <strong className="text-gray-500">전체 탐색</strong> 버튼으로 이번 주 기사를 불러오세요.</p>
            <p className="text-[11px] mt-1 text-gray-400">기사를 클릭하면 법인 사업 관점 시사점이 즉시 생성됩니다.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((article) => {
              const cc = CC_COLORS[article.country] || CC_COLORS.JP;
              const ctx = ENTITY_CONTEXT[article.country];
              const isExp = expanded === article.id;
              const isAnz = analyzing === article.id;
              const isExp2 = exportingId === article.id;
              return (
                <div key={article.id} className={`bg-white rounded-xl border transition-all ${isExp ? "border-gray-300 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}>
                  <div className="flex items-start gap-3 px-4 py-3 cursor-pointer" onClick={() => handleExpand(article)}>
                    <span className="text-[15px] mt-0.5 shrink-0">{ctx?.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium leading-snug transition-colors ${isExp ? "text-orange-600" : "text-gray-900"}`}>{article.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{background:cc.bg,color:cc.text}}>{ctx?.name}</span>
                        <span className="text-[11px] text-gray-400">{article.srcName}</span>
                        <span className="text-[11px] text-gray-400">{article.date}</span>
                      </div>
                    </div>
                    <span className={`text-gray-400 text-[13px] mt-0.5 transition-transform ${isExp ? "rotate-180 text-orange-500" : ""}`}>▾</span>
                  </div>

                  {isExp && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      {isAnz ? (
                        <div className="flex items-center gap-2 text-[12px] text-gray-400 py-3">
                          <span className="flex gap-1">{[0,1,2].map(i=><span key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{animationDelay:`${i*0.2}s`}}/>)}</span>
                          법인 사업 관점에서 분석 중...
                        </div>
                      ) : article.analyzed ? (
                        <>
                          {article.implication && (
                            <div className="border-l-2 border-orange-400 bg-orange-50 rounded-r-lg px-3 py-2.5 mb-3">
                              <p className="text-[10px] font-bold text-orange-700 mb-1.5 tracking-wide">☞ 법인 관점 시사점</p>
                              <p className="text-[12px] text-orange-800 leading-relaxed">{article.implication}</p>
                            </div>
                          )}
                          {article.bullets && (
                            <ul className="space-y-1 mb-3">
                              {article.bullets.map((b,i) => (
                                <li key={i} className="text-[12px] text-gray-600 pl-4 relative leading-relaxed before:content-['—'] before:absolute before:left-0 before:text-gray-400 before:text-[11px]">{b}</li>
                              ))}
                            </ul>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-400 hover:text-gray-600 underline">원문 보기 ↗</a>
                            <button onClick={(e)=>{e.stopPropagation();handleExport(article);}} disabled={isExp2}
                              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition-colors font-medium">
                              {isExp2 ? "생성 중..." : "⬇ PPT 출력"}
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {articles.length > 0 && (
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-200">
          <span>{filtered.length}건 표시 · 총 {articles.length}건</span>
          <button onClick={() => { setArticles([]); setExpanded(null); }} className="hover:text-gray-600">목록 초기화</button>
        </div>
      )}
    </div>
  );
}
