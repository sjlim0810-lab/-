"use client";
import { useState, useCallback, useEffect } from "react";
import { ENTITY_CONTEXT, SOURCES, Article } from "@/lib/context";

// 월 기준 주차: 각 월의 1일이 포함된 주가 1주차
// 예) 6/1(월)~6/7(일) = 6월 1주차
function generateWeeks(): { label: string; value: string; dateRange: string }[] {
  const weeks: { label: string; value: string; dateRange: string }[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  for (let month = 1; month <= 12; month++) {
    const firstDay = new Date(year, month - 1, 1);
    if (firstDay > now) break;

    // 해당 월 1일이 속한 주의 월요일
    const dow = firstDay.getDay();
    const mondayOfFirstWeek = new Date(firstDay);
    mondayOfFirstWeek.setDate(firstDay.getDate() - (dow === 0 ? 6 : dow - 1));

    const lastDay = new Date(year, month, 0);
    let weekNum = 1;
    let cursor = new Date(mondayOfFirstWeek);

    while (true) {
      const monday = new Date(cursor);
      const sunday = new Date(cursor);
      sunday.setDate(sunday.getDate() + 6);

      // 이 주가 해당 월에 걸쳐있는지
      const inMonth = monday.getMonth() + 1 === month || sunday.getMonth() + 1 === month;
      if (!inMonth || monday > now) break;

      weeks.push({
        label: `${month}월 ${weekNum}주차`,
        value: `${year}-${String(month).padStart(2, "0")}-W${weekNum}`,
        dateRange: `${fmt(monday)}~${fmt(sunday)}`,
      });

      weekNum++;
      cursor.setDate(cursor.getDate() + 7);
      if (monday > lastDay) break;
    }
  }

  return weeks.reverse();
}

const WEEKS = generateWeeks();

const COUNTRY_CONFIG = {
  JP: { label: "일본", flag: "🇯🇵", accent: "#E8521A", bg: "#FFF4EE", badge: "#FDE8DB" },
  US: { label: "미국", flag: "🇺🇸", accent: "#1A56DB", bg: "#EEF2FF", badge: "#DBEAFE" },
  EU: { label: "유럽", flag: "🇪🇺", accent: "#7C3AED", bg: "#F5F3FF", badge: "#EDE9FE" },
  AU: { label: "호주", flag: "🇦🇺", accent: "#059669", bg: "#ECFDF5", badge: "#D1FAE5" },
} as const;

type CountryKey = keyof typeof COUNTRY_CONFIG;
type SourceItem = { name: string; url: string; key: string };
type CustomSources = Record<string, SourceItem[]>;

const STORAGE_KEY = "re_insight_sources_v1";

function loadSources(): CustomSources {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSources(custom: CustomSources) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(custom)); } catch {}
}

function mergeSources(custom: CustomSources): CustomSources {
  const merged: CustomSources = {};
  for (const cc of ["JP", "US", "EU", "AU"]) {
    const base = SOURCES[cc] || [];
    const extra = custom[cc] || [];
    const seen = new Set(base.map((s) => s.url));
    merged[cc] = [...base, ...extra.filter((s) => !seen.has(s.url))];
  }
  return merged;
}

export default function Dashboard() {
  const [tab, setTab] = useState<string>("ALL");
  const [week, setWeek] = useState(WEEKS[0].value);
  const [focus, setFocus] = useState("");
  const [articles, setArticles] = useState<Article[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [customSources, setCustomSources] = useState<CustomSources>({});
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [newCc, setNewCc] = useState<CountryKey>("JP");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => { setCustomSources(loadSources()); }, []);

  const allSources = mergeSources(customSources);
  const selectedWeek = WEEKS.find((w) => w.value === week);
  const weekLabel = selectedWeek ? `${selectedWeek.label} (${selectedWeek.dateRange})` : week;

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddSource = () => {
    if (!newUrl.trim()) return;
    let url = newUrl.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    const name = newName.trim() || new URL(url).hostname.replace("www.", "");
    const key = Date.now().toString(36);
    const updated = {
      ...customSources,
      [newCc]: [...(customSources[newCc] || []), { name, url, key }],
    };
    setCustomSources(updated);
    saveSources(updated);
    setNewUrl("");
    setNewName("");
    showToast(`${name} 추가됨`, "ok");
  };

  const handleRemoveSource = (cc: string, key: string) => {
    const isBase = (SOURCES[cc] || []).some((s) => s.key === key);
    if (isBase) { showToast("기본 소스는 삭제할 수 없습니다.", "err"); return; }
    const updated = {
      ...customSources,
      [cc]: (customSources[cc] || []).filter((s) => s.key !== key),
    };
    setCustomSources(updated);
    saveSources(updated);
  };

  const handleSearch = useCallback(async (country: string) => {
    setLoading(country);
    try {
      const sources = country === "ALL"
        ? Object.fromEntries(Object.keys(allSources).map((k) => [k, allSources[k]]))
        : { [country]: allSources[country] || [] };
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, week: weekLabel, focus, sources }),
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
  }, [weekLabel, focus, allSources]);

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
    <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", flexDirection: "column" }}>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 200,
          padding: "9px 14px",
          background: toast.type === "ok" ? "#0F0F0F" : "#DC2626",
          color: "#fff", borderRadius: 9, fontSize: 12, fontWeight: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)", animation: "fadeIn 0.2s ease"
        }}>
          {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}

      {/* 소스 편집 모달 */}
      {showSources && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16
        }} onClick={() => setShowSources(false)}>
          <div style={{
            background: "#fff", borderRadius: 14, width: "100%", maxWidth: 560,
            maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.18)"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700 }}>탐색 소스 관리</p>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>국가별 기사 탐색에 사용할 웹사이트를 추가·삭제하세요</p>
              </div>
              <button onClick={() => setShowSources(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", lineHeight: 1 }}>×</button>
            </div>

            {/* 추가 폼 */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", background: "#FAFAFA" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>새 소스 추가</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select value={newCc} onChange={(e) => setNewCc(e.target.value as CountryKey)}
                  style={{ fontSize: 12, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                  {(Object.keys(COUNTRY_CONFIG) as CountryKey[]).map((cc) => (
                    <option key={cc} value={cc}>{COUNTRY_CONFIG[cc].flag} {COUNTRY_CONFIG[cc].label}</option>
                  ))}
                </select>
                <input value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="매체명 (선택)"
                  style={{ flex: "0 0 140px", fontSize: 12, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, outline: "none" }} />
                <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com"
                  onKeyDown={(e) => e.key === "Enter" && handleAddSource()}
                  style={{ flex: 1, minWidth: 160, fontSize: 12, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, outline: "none" }} />
                <button onClick={handleAddSource}
                  style={{ padding: "7px 16px", background: "var(--ox)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  + 추가
                </button>
              </div>
            </div>

            {/* 국가별 소스 목록 */}
            <div style={{ padding: "16px 20px" }}>
              {(Object.keys(COUNTRY_CONFIG) as CountryKey[]).map((cc) => {
                const cfg = COUNTRY_CONFIG[cc];
                const srcs = allSources[cc] || [];
                const baseSrcs = SOURCES[cc] || [];
                return (
                  <div key={cc} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 14 }}>{cfg.flag}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cfg.accent }}>{cfg.label}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{srcs.length}개</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {srcs.map((src) => {
                        const isBase = baseSrcs.some((b) => b.key === src.key);
                        return (
                          <div key={src.key} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "8px 12px", borderRadius: 8,
                            background: isBase ? "#FAFAFA" : cfg.bg,
                            border: `1px solid ${isBase ? "var(--border)" : cfg.accent + "30"}`
                          }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{src.name}</p>
                              <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340 }}>{src.url}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              {isBase && <span style={{ fontSize: 9, padding: "2px 6px", background: "#F0F0F0", color: "var(--text-muted)", borderRadius: 4, fontWeight: 600 }}>기본</span>}
                              <button onClick={() => handleRemoveSource(cc, src.key)}
                                disabled={isBase}
                                style={{
                                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                                  border: "none", borderRadius: 5, cursor: isBase ? "not-allowed" : "pointer",
                                  background: isBase ? "transparent" : "#FEE2E2", color: isBase ? "var(--text-muted)" : "#DC2626",
                                  fontSize: 13, fontWeight: 700, opacity: isBase ? 0.3 : 1
                                }}>×</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 전체 레이아웃 */}
      <div style={{ display: "flex", flex: 1, width: "100%", minHeight: "100vh" }}>

        {/* 사이드바 */}
        <aside style={{
          width: sidebarOpen ? 210 : 0,
          flexShrink: 0,
          overflow: "hidden",
          transition: "width 0.2s ease",
          borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
          background: "#fff",
          display: "flex", flexDirection: "column",
          position: "sticky", top: 0, height: "100vh"
        }}>
          <div style={{ width: 210, padding: "20px 16px", display: "flex", flexDirection: "column", gap: 6, height: "100%", overflowY: "auto" }}>
            {/* 로고 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", background: "var(--ox-light)", borderRadius: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 15 }}>⚡</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ox)", letterSpacing: "0.05em" }}>RE INSIGHT</span>
              </div>
              <p style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.5, paddingLeft: 2 }}>
                해외법인 신재생에너지<br />주간 시장동향 대시보드
              </p>
            </div>

            {/* 주차 */}
            <p style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>주차 선택</p>
            <select value={week} onChange={(e) => setWeek(e.target.value)}
              style={{ width: "100%", fontSize: 11.5, padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", color: "var(--text-primary)", outline: "none", marginBottom: 14 }}>
              {WEEKS.map((w) => <option key={w.value} value={w.value}>{w.label} ({w.dateRange})</option>)}
            </select>

            {/* 법인 탐색 */}
            <p style={{ fontSize: 9.5, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>법인 탐색</p>

            <button onClick={() => { handleSearch("ALL"); setTab("ALL"); }} disabled={isLoadingAny}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 11px",
                background: tab === "ALL" ? "var(--ox)" : "transparent",
                color: tab === "ALL" ? "#fff" : "var(--text-primary)",
                border: "1px solid", borderColor: tab === "ALL" ? "var(--ox)" : "var(--border)",
                borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 600,
                transition: "all 0.15s", opacity: isLoadingAny ? 0.6 : 1, marginBottom: 3
              }}>
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

            {(Object.keys(COUNTRY_CONFIG) as CountryKey[]).map((cc) => {
              const cfg = COUNTRY_CONFIG[cc];
              const cnt = articles.filter(a => a.country === cc).length;
              const isActive = tab === cc;
              return (
                <div key={cc} style={{ display: "flex", gap: 4, marginBottom: 3 }}>
                  <button onClick={() => setTab(cc)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 11px",
                      background: isActive ? cfg.bg : "transparent",
                      color: isActive ? cfg.accent : "var(--text-secondary)",
                      border: "1px solid", borderColor: isActive ? cfg.accent + "50" : "var(--border)",
                      borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: isActive ? 600 : 400,
                      transition: "all 0.15s"
                    }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 14 }}>{cfg.flag}</span> {cfg.label}
                    </span>
                    {cnt > 0 && (
                      <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: isActive ? cfg.badge : "#F0F0F0", color: isActive ? cfg.accent : "var(--text-muted)", fontWeight: 600 }}>{cnt}</span>
                    )}
                  </button>
                  <button onClick={() => handleSearch(cc)} disabled={isLoadingAny} title={`${cfg.label} 탐색`}
                    style={{
                      width: 30, display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px solid var(--border)", borderRadius: 9,
                      background: "#fff", cursor: "pointer", fontSize: 11, color: "var(--text-muted)",
                      opacity: isLoadingAny ? 0.5 : 1, flexShrink: 0
                    }}>
                    {loading === cc ? <LoadingDots color="var(--ox)" small /> : "↻"}
                  </button>
                </div>
              );
            })}

            {/* 소스 편집 버튼 */}
            <button onClick={() => setShowSources(true)}
              style={{
                marginTop: 12, display: "flex", alignItems: "center", gap: 6,
                padding: "8px 11px", border: "1px dashed var(--border)", borderRadius: 9,
                background: "transparent", cursor: "pointer", fontSize: 11.5, color: "var(--text-muted)",
                width: "100%", transition: "all 0.15s"
              }}>
              ⚙ 탐색 소스 편집
            </button>

            {articles.length > 0 && (
              <button onClick={() => { setArticles([]); setExpanded(null); setTab("ALL"); }}
                style={{ marginTop: "auto", paddingTop: 16, fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                ↺ 목록 초기화 ({articles.length}건)
              </button>
            )}
          </div>
        </aside>

        {/* 메인 */}
        <main style={{ flex: 1, padding: "24px 28px", minWidth: 0, background: "var(--surface)" }}>

          {/* 탑바 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ flexShrink: 0, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14, color: "var(--text-muted)" }}>
              {sidebarOpen ? "←" : "→"}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 2 }}>
                {tab === "ALL" ? "전체 기사" : `${COUNTRY_CONFIG[tab as CountryKey]?.flag} ${COUNTRY_CONFIG[tab as CountryKey]?.label} 시장동향`}
              </h1>
              <p style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {weekLabel} · {filtered.length}건
              </p>
            </div>
          </div>

          {/* 포커스 */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
            background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 18
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ox)", whiteSpace: "nowrap" }}>이번 주 포커스</span>
            <div style={{ width: 1, height: 14, background: "var(--border)" }} />
            <input value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder="예) 일본 FIT 매각 타이밍, 미국 Tax Equity 동향 (입력 시 시사점 구체화)"
              style={{ flex: 1, fontSize: 12, border: "none", outline: "none", color: "var(--text-primary)", background: "transparent", fontFamily: "inherit" }} />
          </div>

          {/* 기사 목록 */}
          {filtered.length === 0 ? (
            <EmptyState onSearch={() => handleSearch(tab === "ALL" ? "ALL" : tab)} loading={isLoadingAny} tab={tab} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((article, idx) => (
                <ArticleCard key={article.id} article={article} idx={idx}
                  isExpanded={expanded === article.id}
                  isAnalyzing={analyzing === article.id}
                  isExporting={exportingId === article.id}
                  onExpand={() => handleExpand(article)}
                  onExport={() => handleExport(article)} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center" }}>
      <div style={{ width: 60, height: 60, borderRadius: 14, background: "var(--ox-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 18 }}>📰</div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 7 }}>아직 기사가 없습니다</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 22, lineHeight: 1.7 }}>
        탐색 버튼으로 이번 주 기사를 불러오세요.<br />기사 클릭 시 법인 관점 시사점이 즉시 생성됩니다.
      </p>
      <button onClick={onSearch} disabled={loading}
        style={{ padding: "9px 22px", background: "var(--ox)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.6 : 1 }}>
        {loading ? <><LoadingDots />탐색 중...</> : `↻ ${tab === "ALL" ? "전체" : ""} 기사 탐색`}
      </button>
    </div>
  );
}

function ArticleCard({ article, idx, isExpanded, isAnalyzing, isExporting, onExpand, onExport }:
  { article: Article; idx: number; isExpanded: boolean; isAnalyzing: boolean; isExporting: boolean; onExpand: () => void; onExport: () => void; }) {
  const cc = article.country as CountryKey;
  const cfg = COUNTRY_CONFIG[cc] || COUNTRY_CONFIG.JP;
  return (
    <div className="fade-in" style={{
      background: "#fff", border: "1px solid",
      borderColor: isExpanded ? cfg.accent + "40" : "var(--border)",
      borderRadius: 12, overflow: "hidden", transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: isExpanded ? `0 2px 16px ${cfg.accent}12` : "none",
      animationDelay: `${idx * 0.04}s`
    }}>
      <div onClick={onExpand} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "13px 15px", cursor: "pointer" }}>
        <div style={{ flexShrink: 0, marginTop: 2, width: 34, height: 34, borderRadius: 9, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, border: `1px solid ${cfg.accent}20` }}>
          {cfg.flag}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, color: isExpanded ? cfg.accent : "var(--text-primary)", marginBottom: 5, transition: "color 0.2s" }}>
            {article.title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: cfg.badge, color: cfg.accent }}>{cfg.label}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{article.srcName}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{article.date}</span>
            {article.analyzed && <span style={{ fontSize: 9.5, padding: "2px 6px", borderRadius: 5, background: "#F0FDF4", color: "#059669", fontWeight: 600 }}>✓ 분석 완료</span>}
          </div>
        </div>
        <span style={{ flexShrink: 0, marginTop: 9, color: isExpanded ? cfg.accent : "var(--text-muted)", fontSize: 11, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▾</span>
      </div>

      {isExpanded && (
        <div style={{ borderTop: `1px solid ${cfg.accent}20`, background: `${cfg.bg}60`, padding: "15px 15px 15px 63px", animation: "fadeIn 0.2s ease" }}>
          {isAnalyzing ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", color: "var(--text-muted)", fontSize: 12 }}>
              <LoadingDots color={cfg.accent} />
              <span>법인 사업 관점에서 기사 분석 중...</span>
            </div>
          ) : article.analyzed ? (
            <>
              {article.implication && (
                <div style={{ borderLeft: `3px solid ${cfg.accent}`, background: "#fff", borderRadius: "0 9px 9px 0", padding: "11px 13px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: cfg.accent, marginBottom: 6, letterSpacing: "0.06em" }}>☞ 법인 관점 시사점</p>
                  <p style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.75 }}>{article.implication}</p>
                </div>
              )}
              {article.bullets && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
                  {article.bullets.map((b, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65 }}>
                      <span style={{ flexShrink: 0, marginTop: 6, width: 14, height: 2, background: cfg.accent + "60", borderRadius: 1 }} />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 11, borderTop: `1px solid ${cfg.accent}20` }}>
                <a href={article.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "var(--text-muted)", textDecoration: "none" }}>원문 보기 ↗</a>
                <button onClick={(e) => { e.stopPropagation(); onExport(); }} disabled={isExporting}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, background: isExporting ? "#F0F0F0" : cfg.accent, color: isExporting ? "var(--text-muted)" : "#fff", border: "none", cursor: "pointer", fontSize: 11.5, fontWeight: 600, transition: "all 0.2s" }}>
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
