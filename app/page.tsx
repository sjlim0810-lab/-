"use client";
import { useState, useCallback } from "react";
import { ENTITY_CONTEXT, Article } from "@/lib/context";

const WEEKS = [
  { label: "2026년 23주차 (6/1~6/7)", value: "2026-W23" },
  { label: "2026년 22주차 (5/25~5/31)", value: "2026-W22" },
  { label: "2026년 21주차 (5/18~5/24)", value: "2026-W21" },
  { label: "2026년 20주차 (5/11~5/17)", value: "2026-W20" },
];

const COUNTRY_CONFIG = {
  JP: { label: "일본", flag: "🇯🇵", accent: "#E8521A", bg: "#FFF4EE", badge: "#FDE8DB" },
  US: { label: "미국", flag: "🇺🇸", accent: "#1A56DB", bg: "#EEF2FF", badge: "#DBEAFE" },
  EU: { label: "유럽", flag: "🇪🇺", accent: "#7C3AED", bg: "#F5F3FF", badge: "#EDE9FE" },
  AU: { label: "호주", flag: "🇦🇺", accent: "#059669", bg: "#ECFDF5", badge: "#D1FAE5" },
} as const;

type CountryKey = keyof typeof COUNTRY_CONFIG;

export default function Dashboard() {
  const [tab, setTab] = useState<string>("ALL");
  const [week, setWeek] = useState(WEEKS[0].value);
  const [focus, setFocus] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null); // country or "ALL"
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const weekLabel = WEEKS.find((w) => w.value === week)?.label || week;

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSearch = useCallback(async (country: string) => {
    setLoading(country);
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
        showToast(`${data.articles.length}건 추가됨`, "ok");
        if (country !== "ALL") setTab(country);
      } else {
        showToast("기사를 찾지 못했습니다.", "err");
      }
    } catch {
      showToast("탐색 중 오류가 발생했습니다.", "err");
    } finally {
      setLoading(null);
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
    if (!article.analyzed) { showToast("먼저 기사를 클릭해 시사점을 생성해주세요.", "err"); return; }
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
      showToast("PPT 다운로드 완료!", "ok");
    } catch {
      showToast("PPT 생성 중 오류가 발생했습니다.", "err");
    } finally {
      setExportingId(null);
    }
  }, []);

  const filtered = articles.filter((a) => tab === "ALL" || a.country === tab);
  const isLoadingAny = loading !== null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 100,
          padding: "10px 16px",
          background: toast.type === "ok" ? "#0F0F0F" : "#DC2626",
          color: "#fff", borderRadius: 10, fontSize: 12,
          fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          animation: "fadeIn 0.2s ease"
        }}>
          {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      {/* 사이드바 + 메인 레이아웃 */}
      <div style={{ display: "flex", maxWidth: 1200, margin: "0 auto", minHeight: "100vh" }}>

        {/* 사이드바 */}
        <aside style={{
          width: 220, flexShrink: 0, padding: "28px 20px",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column", gap: 8,
          position: "sticky", top: 0, height: "100vh", overflow: "auto",
          background: "#fff"
        }}>
          {/* 로고 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 10px",
              background: "var(--ox-light)", borderRadius: 8,
              marginBottom: 6
            }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ox)", letterSpacing: "0.05em" }}>RE INSIGHT</span>
            </div>
            <p style={{ fontSize: 10.5, color: "var(--text-muted)", lineHeight: 1.5, paddingLeft: 2 }}>
              해외법인 신재생에너지<br />주간 시장동향 대시보드
            </p>
          </div>

          {/* 주차 선택 */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>주차 선택</p>
            <select
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              style={{
                width: "100%", fontSize: 11.5, padding: "7px 10px",
                border: "1px solid var(--border)", borderRadius: 8,
                background: "#fff", color: "var(--text-primary)",
                outline: "none", cursor: "pointer"
              }}
            >
              {WEEKS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </div>

          {/* 법인 탐색 */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>법인 탐색</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* 전체 탐색 */}
              <button
                onClick={() => { handleSearch("ALL"); setTab("ALL"); }}
                disabled={isLoadingAny}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px",
                  background: tab === "ALL" ? "var(--ox)" : "transparent",
                  color: tab === "ALL" ? "#fff" : "var(--text-primary)",
                  border: "1px solid",
                  borderColor: tab === "ALL" ? "var(--ox)" : "var(--border)",
                  borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  transition: "all 0.15s", opacity: isLoadingAny ? 0.6 : 1
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 14 }}>🌐</span> 전체
                </span>
                {loading === "ALL" ? <LoadingDots color={tab === "ALL" ? "#fff" : "var(--ox)"} /> : (
                  articles.length > 0 && <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 20,
                    background: tab === "ALL" ? "rgba(255,255,255,0.25)" : "var(--ox-light)",
                    color: tab === "ALL" ? "#fff" : "var(--ox)", fontWeight: 600
                  }}>{articles.length}</span>
                )}
              </button>

              {/* 국가별 */}
              {(Object.keys(COUNTRY_CONFIG) as CountryKey[]).map((cc) => {
                const cfg = COUNTRY_CONFIG[cc];
                const cnt = articles.filter(a => a.country === cc).length;
                const isActive = tab === cc;
                const isLoading = loading === cc;
                return (
                  <div key={cc} style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => setTab(cc)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "9px 12px",
                        background: isActive ? cfg.bg : "transparent",
                        color: isActive ? cfg.accent : "var(--text-secondary)",
                        border: "1px solid",
                        borderColor: isActive ? cfg.accent + "50" : "var(--border)",
                        borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: isActive ? 600 : 400,
                        transition: "all 0.15s"
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 14 }}>{cfg.flag}</span> {cfg.label}
                      </span>
                      {cnt > 0 && (
                        <span style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 20,
                          background: isActive ? cfg.badge : "#F0F0F0",
                          color: isActive ? cfg.accent : "var(--text-muted)", fontWeight: 600
                        }}>{cnt}</span>
                      )}
                    </button>
                    <button
                      onClick={() => handleSearch(cc)}
                      disabled={isLoadingAny}
                      title={`${cfg.label} 탐색`}
                      style={{
                        width: 30, display: "flex", alignItems: "center", justifyContent: "center",
                        border: "1px solid var(--border)", borderRadius: 9,
                        background: "#fff", cursor: "pointer", fontSize: 11,
                        color: "var(--text-muted)", transition: "all 0.15s",
                        opacity: isLoadingAny ? 0.5 : 1, flexShrink: 0
                      }}
                    >
                      {isLoading ? <LoadingDots color="var(--ox)" small /> : "↻"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 목록 초기화 */}
          {articles.length > 0 && (
            <button
              onClick={() => { setArticles([]); setExpanded(null); setTab("ALL"); }}
              style={{
                marginTop: "auto", paddingTop: 16, fontSize: 11,
                color: "var(--text-muted)", background: "none", border: "none",
                cursor: "pointer", textAlign: "left"
              }}
            >
              ↺ 목록 초기화 ({articles.length}건)
            </button>
          )}
        </aside>

        {/* 메인 콘텐츠 */}
        <main style={{ flex: 1, padding: "28px 32px", minWidth: 0 }}>

          {/* 헤더 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                  {tab === "ALL" ? "전체 기사" : `${COUNTRY_CONFIG[tab as CountryKey]?.flag} ${COUNTRY_CONFIG[tab as CountryKey]?.label} 시장동향`}
                </h1>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {weekLabel} · {filtered.length}건
                  {tab !== "ALL" && <span style={{ color: "var(--text-muted)" }}> · 기사 클릭 시 법인 관점 시사점 자동 생성</span>}
                </p>
              </div>
            </div>

            {/* 포커스 입력 */}
            <div style={{
              marginTop: 16, display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)"
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ox)", whiteSpace: "nowrap" }}>이번 주 포커스</span>
              <div style={{ width: 1, height: 14, background: "var(--border)" }} />
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="예) 일본 FIT 매각 타이밍, 미국 Tax Equity 동향 (입력 시 시사점 구체화)"
                style={{
                  flex: 1, fontSize: 12, border: "none", outline: "none",
                  color: "var(--text-primary)", background: "transparent"
                }}
              />
            </div>
          </div>

          {/* 기사 목록 */}
          {filtered.length === 0 ? (
            <EmptyState onSearch={() => handleSearch(tab === "ALL" ? "ALL" : tab)} loading={isLoadingAny} tab={tab} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((article, idx) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  idx={idx}
                  isExpanded={expanded === article.id}
                  isAnalyzing={analyzing === article.id}
                  isExporting={exportingId === article.id}
                  onExpand={() => handleExpand(article)}
                  onExport={() => handleExport(article)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── 서브 컴포넌트 ── */

function LoadingDots({ color = "#fff", small = false }: { color?: string; small?: boolean }) {
  const size = small ? 3 : 4;
  return (
    <span style={{ display: "flex", gap: small ? 2 : 3, alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <span key={i} className="pulse-dot" style={{
          width: size, height: size, borderRadius: "50%", background: color,
          display: "block", animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </span>
  );
}

function EmptyState({ onSearch, loading, tab }: { onSearch: () => void; loading: boolean; tab: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 20px", textAlign: "center"
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "var(--ox-light)", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 28, marginBottom: 20
      }}>📰</div>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)" }}>
        아직 기사가 없습니다
      </h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.7 }}>
        탐색 버튼을 눌러 이번 주 기사를 불러오세요.<br />
        기사를 클릭하면 법인 사업 관점 시사점이 즉시 생성됩니다.
      </p>
      <button
        onClick={onSearch}
        disabled={loading}
        style={{
          padding: "10px 24px", background: "var(--ox)",
          color: "#fff", border: "none", borderRadius: 10,
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          opacity: loading ? 0.6 : 1, transition: "opacity 0.2s"
        }}
      >
        {loading ? <><LoadingDots />탐색 중...</> : `↻ ${tab === "ALL" ? "전체" : ""} 기사 탐색`}
      </button>
    </div>
  );
}

function ArticleCard({
  article, idx, isExpanded, isAnalyzing, isExporting, onExpand, onExport
}: {
  article: Article; idx: number;
  isExpanded: boolean; isAnalyzing: boolean; isExporting: boolean;
  onExpand: () => void; onExport: () => void;
}) {
  const cc = article.country as CountryKey;
  const cfg = COUNTRY_CONFIG[cc] || COUNTRY_CONFIG.JP;

  return (
    <div
      className="fade-in"
      style={{
        background: "#fff",
        border: "1px solid",
        borderColor: isExpanded ? cfg.accent + "40" : "var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        transition: "border-color 0.2s, box-shadow 0.2s",
        boxShadow: isExpanded ? `0 2px 16px ${cfg.accent}15` : "none",
        animationDelay: `${idx * 0.04}s`
      }}
    >
      {/* 카드 헤더 */}
      <div
        onClick={onExpand}
        style={{
          display: "flex", alignItems: "flex-start", gap: 14,
          padding: "14px 16px", cursor: "pointer"
        }}
      >
        {/* 국가 배지 */}
        <div style={{
          flexShrink: 0, marginTop: 2,
          width: 36, height: 36, borderRadius: 9,
          background: cfg.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, border: `1px solid ${cfg.accent}20`
        }}>
          {cfg.flag}
        </div>

        {/* 제목 + 메타 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13, fontWeight: 600, lineHeight: 1.5,
            color: isExpanded ? cfg.accent : "var(--text-primary)",
            marginBottom: 5, transition: "color 0.2s"
          }}>
            {article.title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10.5, fontWeight: 600, padding: "2px 7px",
              borderRadius: 5, background: cfg.badge, color: cfg.accent
            }}>{cfg.label}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{article.srcName}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "'DM Mono', monospace" }}>{article.date}</span>
            {article.analyzed && (
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 5,
                background: "#F0FDF4", color: "#059669", fontWeight: 600
              }}>✓ 분석 완료</span>
            )}
          </div>
        </div>

        {/* 토글 아이콘 */}
        <span style={{
          flexShrink: 0, marginTop: 8, color: isExpanded ? cfg.accent : "var(--text-muted)",
          fontSize: 11, transition: "transform 0.2s, color 0.2s",
          transform: isExpanded ? "rotate(180deg)" : "none",
          display: "block"
        }}>▾</span>
      </div>

      {/* 확장 영역 */}
      {isExpanded && (
        <div style={{
          borderTop: `1px solid ${cfg.accent}20`,
          background: `${cfg.bg}60`,
          padding: "16px 16px 16px 66px",
          animation: "fadeIn 0.2s ease"
        }}>
          {isAnalyzing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", color: "var(--text-muted)", fontSize: 12 }}>
              <LoadingDots color={cfg.accent} />
              <span>법인 사업 관점에서 기사 분석 중...</span>
            </div>
          ) : article.analyzed ? (
            <>
              {/* 시사점 */}
              {article.implication && (
                <div style={{
                  borderLeft: `3px solid ${cfg.accent}`,
                  background: "#fff", borderRadius: "0 10px 10px 0",
                  padding: "12px 14px", marginBottom: 16,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.04)"
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: cfg.accent, marginBottom: 7, letterSpacing: "0.06em" }}>
                    ☞ 법인 관점 시사점
                  </p>
                  <p style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.75 }}>
                    {article.implication}
                  </p>
                </div>
              )}

              {/* 불렛 */}
              {article.bullets && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {article.bullets.map((b, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65 }}>
                      <span style={{ flexShrink: 0, marginTop: 5, width: 16, height: 2, background: cfg.accent + "60", borderRadius: 1 }} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {/* 푸터 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${cfg.accent}20` }}>
                <a href={article.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.color = cfg.accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  원문 보기 ↗
                </a>
                <button
                  onClick={(e) => { e.stopPropagation(); onExport(); }}
                  disabled={isExporting}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    background: isExporting ? "#F0F0F0" : cfg.accent,
                    color: isExporting ? "var(--text-muted)" : "#fff",
                    border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600,
                    transition: "all 0.2s"
                  }}
                >
                  {isExporting ? <><LoadingDots />생성 중...</> : "⬇ PPT 출력"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
