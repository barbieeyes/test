/* ===== 광합성 추정 모델 (투명하게 공개하는 계산식) =====
 * 1) 광합성유효광량자속밀도 PPFD(µmol/m²/s) ≈ 전천일사량 SW(W/m²) × 0.45(PAR 비율) × 4.57(µmol/J)
 * 2) 잎 단위 순광합성 A = [α·I·Amax / (α·I + Amax)] × f(T) × f(VPD) − Rd   (직각쌍곡선 광반응곡선)
 * 3) 군락 단위: 유효 엽면적 = (1 − e^(−k·LAI)) / k  (Beer 법칙, k = 0.5)
 * 4) g CO₂/h·m² = A(µmol/m²/s) × 3600 × 44.01×10⁻⁶
 * 계수는 교과·문헌의 대표값이며, 현장 측정값이 아닌 '추정치'입니다.
 */
(function (root) {
  const PS_TYPES = {
    C3:  { label: "C₃",  amax: 22, alpha: 0.05,  topt: 25, rdFrac: 0.06, vpdSensitive: true,
           note: "대부분의 식물. 강광·고온에서 광호흡으로 효율이 떨어져요." },
    C4:  { label: "C₄",  amax: 38, alpha: 0.065, topt: 33, rdFrac: 0.05, vpdSensitive: true,
           note: "옥수수·강아지풀 등. 강광·고온에서 효율이 높아요." },
    CAM: { label: "CAM", amax: 3,  alpha: 0.03,  topt: 30, rdFrac: 0.10, vpdSensitive: false,
           note: "다육식물 등. 낮에는 기공을 닫고 밤에 CO₂를 고정해요(낮 값은 매우 작음)." },
  };
  const FORMS = {
    "목본":     { amaxScale: 1.0,  lai: 4.0 },
    "초본":     { amaxScale: 1.0,  lai: 2.5 },
    "양치식물": { amaxScale: 0.45, lai: 1.5 },
    "이끼류":   { amaxScale: 0.2,  lai: 1.0 },
  };
  const K_EXT = 0.5;
  const G_PER_UMOL_HOUR = 3600 * 44.01e-6; // = 0.158436

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d);

  function ppfdFromSW(sw) { return Math.max(0, num(sw, 0)) * 0.45 * 4.57; }
  function parIndex(ppfd) { return Math.round(clamp(num(ppfd, 0) / 2000 * 100, 0, 100)); }
  function activity(ppfd) {
    const p = num(ppfd, 0);
    if (p >= 800) return { key: "high", label: "활발" };
    if (p >= 200) return { key: "mid", label: "보통" };
    return { key: "low", label: "음지" };
  }
  function vpdKPa(tempC, rh) {
    const es = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    return Math.max(0, es * (1 - clamp(num(rh, 60), 0, 100) / 100));
  }

  /** 기상값 + 식물 정보 → 추정 광합성 속도·탄소 고정 잠재량 */
  function estimate({ sw, temp, rh, psType = "C3", growthForm = "초본", lai }) {
    const P = PS_TYPES[psType] || PS_TYPES.C3;
    const F = FORMS[growthForm] || FORMS["초본"];
    const T = num(temp, 20);
    const I = ppfdFromSW(sw);
    const amax = P.amax * F.amaxScale;
    const fT = Math.exp(-Math.pow((T - P.topt) / 12, 2));
    const vpd = vpdKPa(T, rh);
    const fVPD = P.vpdSensitive ? (vpd <= 1 ? 1 : clamp(1 - (vpd - 1) * 0.35, 0.3, 1)) : 1;
    const gross = I > 0 ? (P.alpha * I * amax) / (P.alpha * I + amax) : 0;
    const rd = P.rdFrac * amax * fT;
    const aLeaf = Math.max(0, gross * fT * fVPD - rd); // µmol CO₂/m²(잎)/s
    const L = clamp(num(lai, F.lai), 0.1, 10);
    const effLeaf = (1 - Math.exp(-K_EXT * L)) / K_EXT;
    const aCanopy = aLeaf * effLeaf;                     // µmol CO₂/m²(지면)/s
    const gco2 = aCanopy * G_PER_UMOL_HOUR;             // g CO₂/h·m²(지면)
    return {
      ppfd: Math.round(I), aLeaf: +aLeaf.toFixed(2), aCanopy: +aCanopy.toFixed(2),
      gco2: +gco2.toFixed(2), lai: +L.toFixed(1), effLeaf: +effLeaf.toFixed(2),
      fT: +fT.toFixed(2), fVPD: +fVPD.toFixed(2), vpd: +vpd.toFixed(2), amax: +amax.toFixed(1),
    };
  }

  root.PSModel = { PS_TYPES, FORMS, ppfdFromSW, parIndex, activity, vpdKPa, estimate, clamp };
  if (typeof module !== "undefined") module.exports = root.PSModel;
})(typeof window !== "undefined" ? window : globalThis);
