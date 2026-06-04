export const ENTITY_CONTEXT: Record<string, {
  name: string; flag: string; color: string; bg: string; business: string;
}> = {
  JP: {
    name: "일본", flag: "🇯🇵", color: "#F97316", bg: "#FFF7ED",
    business: `일본법인 사업 컨텍스트:
- C&I PPA 소형 PV 권리 매각 (Orix 향, 주고쿠 지방 0.3~1.2MW 다수)
- BESS 독립 개발·매각: 카마1호(50MW/174MWh), 겐카이초(32.4MW), 유수이·사츠마초 등 소형 BESS군
- 기존 FIT 자산 운영 및 FIT→FIP 전환 추진
- 매각 완료: 고겐1·2(이익 50.8억엔), 진행 중: 쿠시로·호코타·아키바·이나시키(신규 매각처 선정 중)
- 핵심 이슈: FY2027 FIT/FIP 지원 종료, 출력억제 리스크, BESS LTDA 입찰 전략, 포스트-FIT 수익화(Merchant·PPA·FIP)`,
  },
  US: {
    name: "미국", flag: "🇺🇸", color: "#3B82F6", bg: "#EFF6FF",
    business: `미국법인 사업 컨텍스트 (174PG + HWR 통합):
- 대형·중소형 PV·BESS 개발, PPA 협상, Tax Equity 매각, O&M 수주
- 주요 프로젝트: Oberon II(100MW TX, Disney PPA, Sol Systems NBO 협의), Oberon III(165MW TX), Boulder Solar 3(128MW+BESS NV, NVE PPA $49.95/MWh, Tax Equity NBO 6월초), Bonanza Peak(600MW CA), Astoria BESS(100MW NY, 공사 중 COD 26.12월), Taormina/Lavender BESS(각 230MW TX, CPS Shortlist 대기)
- 핵심 이슈: IRA Tax Equity·ITC, PPA 협상, 계통연계 비용, FEOC 규정 강화`,
  },
  EU: {
    name: "유럽", flag: "🇪🇺", color: "#8B5CF6", bg: "#F5F3FF",
    business: `유럽법인 사업 컨텍스트 (스페인·이탈리아·아일랜드):
- BESS·PV+ESS 개발·매각, B2B PPA 유동화
- 주요 자산: 이탈리아 Trullo BESS(6x100MW, Trullo B SPA 6월 목표, Vault RTB 매각), 스페인 B2B PPA 유동화 1·2차(Lux co. 구조 설계), 아일랜드 Shannonbridge(63.2MW BESS, LCIS2 대관), Las Mesas(스페인, 철수 가능성)
- 핵심 이슈: AU/CdS 인허가 지연, BESS 매각 타이밍, PPA 유동화 구조, REPowerEU 정책`,
  },
  AU: {
    name: "호주", flag: "🇦🇺", color: "#10B981", bg: "#ECFDF5",
    business: `호주법인 사업 컨텍스트:
- PV+BESS Hybrid 개발·매각
- 주요 프로젝트: Gregadoo(65MW+200MW BESS NSW, FIA·SSIA 개시, TransGrid 설계 협의), Jindera(120MW+200MW BESS NSW, GPS 6월초 제출)
- 핵심 이슈: NEM 계통 혼잡, TransGrid 연계 지연, SSD 인허가`,
  },
};

export const SOURCES: Record<string, { name: string; url: string; key: string }[]> = {
  JP: [
    { name: "Japan Energy Hub", url: "https://japanenergyhub.com/", key: "jeh" },
    { name: "Solar Journal", url: "https://solarjournal.jp/", key: "sj" },
    { name: "PV Magazine Japan", url: "https://www.pv-magazine.com/region/japan/", key: "pvmag" },
    { name: "Nikkei BP Mega Solar", url: "https://project.nikkeibp.co.jp/ms/mega-solar/", key: "nikkei" },
  ],
  US: [
    { name: "PV Tech", url: "https://www.pv-tech.org/", key: "pvtech" },
    { name: "PV Magazine US", url: "https://www.pv-magazine-usa.com/", key: "pvmag" },
    { name: "Canary Media", url: "https://www.canarymedia.com/", key: "canary" },
  ],
  EU: [
    { name: "Recharge News", url: "https://www.rechargenews.com/", key: "recharge" },
    { name: "PV Magazine EU", url: "https://www.pv-magazine.com/", key: "pvmag" },
    { name: "Wind Europe", url: "https://windeurope.org/newsroom/", key: "windeu" },
  ],
  AU: [
    { name: "RenewEconomy", url: "https://reneweconomy.com.au/", key: "re" },
    { name: "PV Magazine AU", url: "https://www.pv-magazine-australia.com/", key: "pvmag" },
    { name: "Clean Energy Council", url: "https://www.cleanenergycouncil.org.au/", key: "cec" },
  ],
};

export type Article = {
  id: string;
  title: string;
  date: string;
  url: string;
  srcName: string;
  country: string;
  bullets?: string[];
  implication?: string;
  analyzed?: boolean;
};
