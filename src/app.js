/* ===== 기후행동 실천모임 에코쌤즈 · 따로 또 같이 광합성 지도 ===== */
const { useState, useEffect, useRef, useMemo, useCallback } = React;
/* htm → React: HTML식 속성(class, stroke-width, onInput)을 React 속성으로 바꿔 줌 */
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
function h(type, props, ...children) {
  if (props) {
    const p = {};
    for (const k in props) {
      const v = props[k];
      if (k === "class") p.className = v;
      else if (k === "for") p.htmlFor = v;
      else if (k === "onInput" && (type === "input" || type === "textarea")) p.onChange = v;
      else if (k.includes("-") && !k.startsWith("aria-") && !k.startsWith("data-") && !k.startsWith("--")) p[camel(k)] = v;
      else p[k] = v;
    }
    props = p;
  }
  return React.createElement(type, props, ...children);
}
const html = htm.bind(h);
const M = window.PSModel;
const EM = window.EcoMedia;
const EH = window.EcoHwpx;

/* ---------- 상수 ---------- */
/* 연구원 색: 붉은 잎 → 노란 잎 → 연두 잎 → 진초록 잎 */
const RESEARCHERS = [
  { name: "이정연", color: "#DC4B31" },
  { name: "신민화", color: "#EDB000" },
  { name: "이귀리", color: "#86BF2F" },
  { name: "정종화", color: "#1F7A3E" },
];
/* 따로(개인) 탐구의 기본 위치 = 각자의 우리 동네.
   개인정보 보호를 위해 코드에는 '동' 수준의 이름·좌표만 둬요.
   정확한 위치는 각자 '따로' 탭에서 '지금 위치로 바꾸기'를 누르면 그 휴대폰에만 저장돼요. */
const HOME_DEFAULT = {
  "이정연": { label: "위례동", lat: 37.4855, lng: 127.1470 },
  "신민화": { label: "대치동", lat: 37.5000, lng: 127.0560 },
  "이귀리": { label: "둔촌동", lat: 37.5270, lng: 127.1390 },
  "정종화": { label: "일원동", lat: 37.4835, lng: 127.0830 },
};
const TEAM_PIN = "2144"; // 팀 공용 입장 비밀번호 (화면 잠금용이며 보안 장치는 아님)
const MODES = EM.MODE_INFO; // solo = 따로(우리 동네), team = 같이(학교)
const FORM_LIST = ["목본", "초본", "양치식물", "이끼류"];
const PS_LIST = ["C3", "C4", "CAM"];
const DEFAULT_CENTER = [37.4775, 127.1420];
const DEFAULT_MODEL = "claude-sonnet-5-5";
const LS_SET = "ecossam.v1.settings";
const LS_AUTH = "ecossam.v2.auth"; // 한 번 입장하면 그 기기에서는 로그아웃 전까지 자동 입장
const LS_OLD = "ecossam.v1.records";
const LS_HOME = "ecossam.v2.home";
const ACT_COLOR = { high: "#16A34A", mid: "#65A30D", low: "#D98E04" };
const TABS = [
  { id: "today", label: "오늘", icon: "Sun" },
  { id: "solo", label: "따로", icon: "House" },
  { id: "team", label: "같이", icon: "School" },
  { id: "map", label: "지도", icon: "Map" },
  { id: "activity", label: "활동", icon: "Users" },
  { id: "archive", label: "아카이브", icon: "Film" },
];

const rColor = (n) => (RESEARCHERS.find((r) => r.name === n) || {}).color || "#94A3B8";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtDate = (ts) => new Date(ts).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtDay = (ts) => new Date(ts).toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });
const fix = (v, d = 1) => (typeof v === "number" && isFinite(v) ? v.toFixed(d) : "–");
const speciesKey = (r) => (r.scientificName || r.koreanName || "").trim().toLowerCase();

/* ---------- 저장소: 설정은 LocalStorage, 기록·사진은 IndexedDB ---------- */
const store = {
  get(k, d) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const session = {
  get(k) { try { const s = sessionStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
};
const getHome = (name) => { const base = HOME_DEFAULT[name] || { label: "우리 동네", lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
  const mine = (store.get(LS_HOME, {}) || {})[name]; return mine ? { ...base, lat: mine.lat, lng: mine.lng, custom: true } : base; };
const setHome = (name, v) => { const all = store.get(LS_HOME, {}) || {}; all[name] = v; store.set(LS_HOME, all); };
const db = {
  _p: null, mem: new Map(),
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res) => {
      try {
        const rq = indexedDB.open("ecossam", 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore("records", { keyPath: "id" });
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return this._p;
  },
  async all() {
    const d = await this.open(); if (!d) return [...this.mem.values()];
    return new Promise((res) => { const rq = d.transaction("records").objectStore("records").getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]); });
  },
  async put(r) {
    const d = await this.open(); if (!d) { this.mem.set(r.id, r); return true; }
    return new Promise((res) => { const t = d.transaction("records", "readwrite"); t.objectStore("records").put(r); t.oncomplete = () => res(true); t.onerror = () => res(false); t.onabort = () => res(false); });
  },
  async del(id) {
    const d = await this.open(); if (!d) { this.mem.delete(id); return; }
    return new Promise((res) => { const t = d.transaction("records", "readwrite"); t.objectStore("records").delete(id); t.oncomplete = () => res(); t.onerror = () => res(); });
  },
};

/* ---------- 예시 데이터 ---------- */
function sampleRecords() {
  const base = Date.now() - 86400000;
  const mk = (i, o) => {
    const est = M.estimate({ sw: o.w.sw, temp: o.w.temp, rh: o.w.rh, psType: o.psType, growthForm: o.growthForm });
    const ppfd = M.ppfdFromSW(o.w.sw);
    return { id: "sample" + i, sample: true, ts: base + i * 3600000, photo: null, notes: "예시 기록입니다. 아카이브 탭에서 ‘예시 지우기’로 정리하세요.",
      accuracy: null, source: "map", ai: null, lai: est.lai, ...o, weather: { ...o.w, ppfd: Math.round(ppfd), par: M.parIndex(ppfd) }, model: est };
  };
  const hm = HOME_DEFAULT["정종화"];
  return [
    mk(1, { mode: "team", place: "학교 화단", researcher: "이정연", lat: 37.4783, lng: 127.1490, koreanName: "갈대", scientificName: "Phragmites australis", confidence: 90,
      growthForm: "초본", psType: "C3", w: { temp: 24, rh: 55, cloud: 10, sw: 720 } }),
    mk(2, { mode: "team", place: "운동장 가장자리", researcher: "신민화", lat: 37.4771, lng: 127.1452, koreanName: "강아지풀", scientificName: "Setaria viridis", confidence: 85,
      growthForm: "초본", psType: "C4", w: { temp: 27, rh: 48, cloud: 5, sw: 810 } }),
    mk(3, { mode: "solo", place: hm.label, researcher: "정종화", lat: hm.lat + 0.0008, lng: hm.lng - 0.0006, koreanName: "신갈나무", scientificName: "Quercus mongolica", confidence: 80,
      growthForm: "목본", psType: "C3", w: { temp: 19, rh: 70, cloud: 80, sw: 140 } }),
  ];
}

/* ---------- 사진 ---------- */
const HEIC_LIB = "https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js";
const loadScript = (src) => new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = () => rej(new Error("변환 도구를 불러오지 못했어요")); document.head.appendChild(el); });
/** 사진(파일/Blob)을 maxDim 이하 JPEG dataURL로. 큰 사진도 메모리를 덜 쓰게 objectURL·ImageBitmap으로 읽는다 */
async function decodeScaled(blob, maxDim, q) {
  const draw = (src, w0, h0) => {
    const s = Math.min(1, maxDim / Math.max(w0, h0)), w = Math.max(1, Math.round(w0 * s)), hh = Math.max(1, Math.round(h0 * s));
    const c = document.createElement("canvas"); c.width = w; c.height = hh; c.getContext("2d").drawImage(src, 0, 0, w, hh);
    return c.toDataURL("image/jpeg", q);
  };
  if (window.createImageBitmap) {
    try { const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" }); const out = draw(bmp, bmp.width, bmp.height); bmp.close && bmp.close(); return out; } catch (e) {}
  }
  const u = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = u; });
    return draw(img, img.naturalWidth, img.naturalHeight);
  } finally { URL.revokeObjectURL(u); }
}
/** 앨범 사진 읽기: 일반 JPG/PNG는 바로, 갤럭시·아이폰 HEIC(고효율) 사진은 JPG로 바꿔서 */
async function resizeImage(file, maxDim, q) {
  const heic = /hei[cf]/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || "");
  if (!heic) { try { return await decodeScaled(file, maxDim, q); } catch (e) { if (file.type && !/octet|^$/.test(file.type)) throw e; } }
  if (!window.heic2any) await loadScript(HEIC_LIB);
  const out = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return decodeScaled(Array.isArray(out) ? out[0] : out, maxDim, q);
}

/* ---------- 팀 공용 저장소 (Supabase) ----------
 * 기록은 이 휴대폰(IndexedDB)에 먼저 저장 → 서버(eco_items 표)로 올리고, 다른 선생님 기록을 내려받아 합친다.
 * 사진은 eco-photos 보관함에 올리고 주소만 기록에 남긴다(보관함이 안 되면 사진을 기록 안에 그대로 넣는다). */
const SB_URL = "https://hcvaaxxwqqrbpnloyjzr.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdmFheHh3cXFyYnBubG95anpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjI1MTgsImV4cCI6MjEwMTU5ODUxOH0.8TKT8aExXiyazDY313G9BHTvZCSu2yrTdxlgwxpNCB8";
const LS_SINCE = "ecossam.v3.sync.since", LS_DELQ = "ecossam.v3.sync.deletes";
const sbH = (extra) => ({ apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "x-team-pin": TEAM_PIN, ...(extra || {}) });
const PHOTO_KEYS = ["photo", "raw"];
const isData = (v) => typeof v === "string" && v.startsWith("data:");
const cloud = {
  storageOk: true,
  async pull(since) {
    const q = `${SB_URL}/rest/v1/eco_items?select=id,kind,data,deleted,updated_at&order=updated_at.asc&limit=500` + (since ? `&updated_at=gt.${encodeURIComponent(since)}` : "");
    const r = await fetch(q, { headers: sbH(), cache: "no-store" });
    if (!r.ok) throw new Error("pull " + r.status + " " + (await r.text()).slice(0, 120));
    return r.json();
  },
  async upsert(rows) {
    if (!rows.length) return;
    const r = await fetch(`${SB_URL}/rest/v1/eco_items?on_conflict=id`, { method: "POST",
      headers: sbH({ "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }), body: JSON.stringify(rows) });
    if (!r.ok) throw new Error("push " + r.status + " " + (await r.text()).slice(0, 160));
  },
  async upload(path, dataUrl) {
    if (!this.storageOk) return null;
    const f = dataUrlToFile(dataUrl, path.split("/").pop());
    const r = await fetch(`${SB_URL}/storage/v1/object/eco-photos/${path}`, { method: "POST", headers: sbH({ "content-type": f.type || "image/jpeg" }), body: f });
    if (!r.ok) { if (r.status === 400 || r.status === 403 || r.status === 404) this.storageOk = false; return null; }
    return `${SB_URL}/storage/v1/object/public/eco-photos/${path}`;
  },
};
const rnd = () => Math.random().toString(36).slice(2, 8);
/** 기록 속 사진(dataURL)을 보관함에 올리고 주소로 바꾼 사본 */
async function toCloudItem(it) {
  const o = { ...it }; delete o._dirty; delete o._synced;
  const kind = o.kind || "plant";
  for (const k of PHOTO_KEYS) if (isData(o[k])) { const u = await cloud.upload(`${kind}/${o.id}/${k}-${rnd()}.jpg`, o[k]).catch(() => null); if (u) o[k] = u; }
  if (Array.isArray(o.photos)) {
    o.photos = await Promise.all(o.photos.map(async (ph, i) => { const q = { ...ph };
      for (const k of PHOTO_KEYS) if (isData(q[k])) { const u = await cloud.upload(`${kind}/${o.id}/${i}-${k}-${rnd()}.jpg`, q[k]).catch(() => null); if (u) q[k] = u; }
      return q; }));
  }
  return o;
}
/** 사진 주소든 dataURL이든 바이트로 */
async function photoBytes(u) {
  if (isData(u)) return dataUrlBytes(u);
  const r = await fetch(u); return new Uint8Array(await r.arrayBuffer());
}
async function photoDataUrl(u) {
  if (!u || isData(u)) return u;
  const b = await (await fetch(u)).blob();
  return new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(b); });
}

/* ---------- 기상 (Open-Meteo) ---------- */
async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
    `&current=temperature_2m,relative_humidity_2m,cloud_cover,shortwave_radiation,is_day&timezone=Asia%2FSeoul`;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("기상 서버 응답 " + r.status);
    const d = await r.json(); const c = d.current;
    if (!c) throw new Error("기상 데이터 형식이 달라요");
    const ppfd = M.ppfdFromSW(c.shortwave_radiation);
    return { temp: c.temperature_2m, rh: c.relative_humidity_2m, cloud: c.cloud_cover, sw: c.shortwave_radiation,
      isDay: c.is_day, ppfd: Math.round(ppfd), par: M.parIndex(ppfd), lat, lng, fetchedAt: Date.now() };
  } finally { clearTimeout(t); }
}

/** 지난 시각의 기상값 (앨범 사진용): 최근 3개월은 예보 API, 그 전은 과거 기록 API */
async function fetchWeatherAt(lat, lng, ts) {
  const d = new Date(ts), p2 = (n) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const recent = Date.now() - ts < 85 * 864e5;
  const base = recent ? "https://api.open-meteo.com/v1/forecast" : "https://archive-api.open-meteo.com/v1/archive";
  const url = `${base}?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&start_date=${day}&end_date=${day}` +
    `&hourly=temperature_2m,relative_humidity_2m,cloud_cover,shortwave_radiation,is_day&timezone=Asia%2FSeoul`;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("기상 기록 서버 응답 " + r.status);
    const j = await r.json(), h = j.hourly;
    if (!h || !h.time || !h.time.length) throw new Error("그날 기상 기록이 없어요");
    // 정시 값 중 촬영 시각과 가장 가까운 것 (일사량은 앞 1시간 평균이라 다음 정시를 우선)
    const want = d.getHours() + d.getMinutes() / 60 + 0.5;
    let k = Math.min(h.time.length - 1, Math.max(0, Math.round(want)));
    const sw = h.shortwave_radiation[k];
    if (sw == null && h.temperature_2m[k] == null) throw new Error("그 시각 기상 기록이 없어요");
    const ppfd = M.ppfdFromSW(sw || 0);
    return { temp: h.temperature_2m[k], rh: h.relative_humidity_2m[k], cloud: h.cloud_cover[k], sw: sw || 0, isDay: h.is_day ? h.is_day[k] : null,
      ppfd: Math.round(ppfd), par: M.parIndex(ppfd), lat, lng, at: ts, fetchedAt: Date.now(), past: true };
  } finally { clearTimeout(t); }
}

/* ---------- Claude 비전 분석 ---------- */
function buildPrompt(w, lat, lng, mode, pn) {
  const pnText = pn && pn.length ? `
[사진 비교 데이터베이스 Pl@ntNet이 비슷한 사진들과 비교해 뽑은 후보 (점수 = 사진 유사도)]
${pn.map((c, i) => `${i + 1}. ${c.sci}${c.family ? ` (${c.family})` : ""} ${c.score}%${c.common.length ? ` · 영어 이름 ${c.common.join(", ")}` : ""}`).join("\n")}
이 후보들과 사진을 함께 보고 가장 맞는 종을 고르세요. 점수가 낮거나 사진과 안 맞으면 후보 밖에서 직접 판단해도 됩니다.
candidates에는 위 후보들 중 고른 것을 뺀 나머지를 (국명을 붙여) 넣고, confidence는 Pl@ntNet 점수를 참고해 정하세요.` : "";
  return `한국 ${mode === "solo" ? "주택가·동네" : "학교 교정"}(위도 ${lat.toFixed(3)}, 경도 ${lng.toFixed(3)})에서 찍은 식물 사진입니다. 사진 속 식물의 종을 알려 주세요.${pnText}
- 한국에서 실제로 볼 수 있는 종 기준. 원예 품종이면 대표 종명을 쓰세요.
- 사진에 이름표·안내판 글씨가 보이면 참고하되, 실제 모습과 맞는지 확인하세요.
- 확실하지 않으면 신뢰도를 낮추고, 비슷한 후보를 함께 주세요.
아래 형식의 JSON 하나만 출력하세요. 다른 말, 마크다운, 코드펜스 금지. 문자열 안에 큰따옴표(")를 쓰지 마세요.
{"koreanName":"국명","scientificName":"학명(속명 종소명)","family":"과 이름(예: 국화과)","confidence":0~100 정수,
 "candidates":[{"koreanName":"다른 후보 국명","scientificName":"학명","confidence":정수}],
 "growthForm":"목본|초본|양치식물|이끼류","photosynthesisType":"C3|C4|CAM","laiEstimate":0.5~8 숫자,
 "climateIndicator":true 또는 false,"note":"알아본 근거나 더 정확히 찍을 부위를 한 문장으로"}
candidates는 최대 3개, 없으면 [].`;
}
/** AI 답에서 JSON 꺼내기 (코드펜스·앞뒤 말·끝 쉼표 정도는 고쳐서 읽는다) */
function pickJSON(text) {
  let t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0) throw new Error("no json");
  t = e > s ? t.slice(s, e + 1) : t.slice(s);
  try { return JSON.parse(t); } catch (e1) {}
  const fixed = t.replace(/[“”]/g, "'").replace(/,\s*([}\]])/g, "$1").replace(/:\s*(\d+)\s*%/g, ": $1");
  try { return JSON.parse(fixed); } catch (e2) {}
  // 끝이 잘렸으면 열린 괄호를 닫아 본다
  let open = [], inStr = false, esc = false;
  for (const ch of fixed) { if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === "{" || ch === "[") open.push(ch); else if (ch === "}" || ch === "]") open.pop(); }
  const closed = (inStr ? fixed + '"' : fixed).replace(/,\s*$/, "") + open.reverse().map((c) => (c === "{" ? "}" : "]")).join("");
  return JSON.parse(closed);
}
function parseAI(text) {
  const o = pickJSON(text);
  if (!PS_LIST.includes(o.photosynthesisType)) o.photosynthesisType = "C3";
  if (!FORM_LIST.includes(o.growthForm)) o.growthForm = "초본";
  o.confidence = M.clamp(Math.round(Number(String(o.confidence).replace(/[^\d.]/g, "")) || 0), 0, 100);
  o.candidates = Array.isArray(o.candidates) ? o.candidates.filter((c) => c && c.koreanName).slice(0, 3) : [];
  // 예전 화면과 맞추기
  if (!o.taxonomy) o.taxonomy = { family: o.family || "" };
  if (!o.carbonFixationEst) o.carbonFixationEst = { laiEstimate: o.laiEstimate, comment: "" };
  if (!o.ecologicalInsight) o.ecologicalInsight = { climateIndicator: !!o.climateIndicator, note: o.note || "", classroom: "" };
  return o;
}

/** Claude 부르기: 이 기기에 키가 있으면 직접, 없으면 팀 공용 서버(/api/ai)로 */
const TEAM_AI = "/api/ai";
const aiReady = (st) => !!(st && (st.apiKey || st.team));
async function callClaude(st, { max_tokens = 1400, system, content }) {
  const body = { model: (st && st.model) || DEFAULT_MODEL, max_tokens, system, messages: [{ role: "user", content }] };
  const direct = !!(st && st.apiKey);
  const r = await fetch(direct ? "https://api.anthropic.com/v1/messages" : TEAM_AI, {
    method: "POST",
    headers: direct
      ? { "content-type": "application/json", "x-api-key": st.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
      : { "content-type": "application/json", "x-team-pin": TEAM_PIN },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = ""; try { const j = await r.json(); msg = (j.error && (j.error.message || j.error)) || ""; } catch (e) {}
    if (!direct && r.status === 503) throw new Error("팀 공용 AI 키가 아직 연결되지 않았어요. 설정에서 이 기기용 키를 넣거나 관리자에게 알려 주세요.");
    if (r.status === 401) throw new Error(direct ? "API 키가 올바르지 않아요. 설정에서 키를 다시 확인하세요." : "팀 공용 AI 키가 올바르지 않아요. 관리자에게 알려 주세요.");
    if (r.status === 404) throw new Error(`모델 '${body.model}'을 찾을 수 없어요. 설정에서 모델 이름을 바꿔 보세요.`);
    if (r.status === 429) throw new Error("요청이 많아 잠시 막혔어요. 1분 뒤 다시 시도하세요.");
    if (r.status === 400 && /credit|balance/i.test(String(msg))) throw new Error("API 크레딧이 부족해요. console.anthropic.com에서 충전해 주세요.");
    throw new Error(`AI 요청 실패 (${r.status}) ${msg}`.trim());
  }
  const d = await r.json();
  const text = (d.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  if (d.stop_reason === "max_tokens" && !/\}\s*$/.test(text.trim())) throw new Error("AI 답이 너무 길어 중간에 끊겼어요. 한 번 더 눌러 주세요.");
  return text;
}
/** Pl@ntNet: 전 세계 식물 사진 데이터와 비교해 후보 뽑기 (키는 사이트 주소로 잠겨 있어 브라우저에서 바로 부름) */
async function plantnetIdentify(key, dataUrl) {
  const fd = new FormData();
  fd.append("images", dataUrlToFile(dataUrl, "plant.jpg")); fd.append("organs", "auto");
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(key)}&nb-results=5`, { method: "POST", body: fd, signal: ctrl.signal });
    if (r.status === 404) return { list: [], notPlant: true };
    if (!r.ok) throw new Error("Pl@ntNet " + r.status);
    const j = await r.json();
    return { list: (j.results || []).map((x) => ({ sci: x.species.scientificNameWithoutAuthor, family: x.species.family && x.species.family.scientificNameWithoutAuthor,
      common: (x.species.commonNames || []).slice(0, 2), score: Math.round((x.score || 0) * 100) })), left: j.remainingIdentificationRequests };
  } finally { clearTimeout(t); }
}
async function analyzePlant({ settings, dataUrl, weather, lat, lng, mode }) {
  const b64 = dataUrl.split(",")[1];
  let pn = null, pnErr = "";
  if (settings && settings.plantnet) { try { pn = await plantnetIdentify(settings.plantnet, dataUrl); } catch (e) { pnErr = e.message || String(e); } }
  const text = await callClaude(settings, { max_tokens: 6000, system: "당신은 한국 식물 동정 도우미입니다. 응답은 반드시 유효한 JSON 객체 하나여야 합니다.",
    content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } }, { type: "text", text: buildPrompt(weather, lat, lng, mode, pn && pn.list) }] });
  let o;
  try { o = parseAI(text); } catch (e) { try { console.warn("AI 응답", text); } catch (x) {} throw new Error("AI 응답을 해석하지 못했어요. 한 번 더 눌러 주세요."); }
  // Pl@ntNet 점수를 후보·답에 붙이기
  if (pn && pn.list.length) {
    const norm = (x) => String(x || "").toLowerCase().split(" ").slice(0, 2).join(" ");
    const scoreOf = (sci) => { const m = pn.list.find((c) => norm(c.sci) === norm(sci)); return m ? m.score : null; };
    o.pnScore = scoreOf(o.scientificName);
    o.candidates = o.candidates.map((c) => ({ ...c, pnScore: scoreOf(c.scientificName) }));
    o.plantnet = pn.list; o.source = "plantnet+claude";
  } else o.source = pnErr ? "claude (Pl@ntNet 실패)" : "claude";
  return o;
}

/* ---------- 협의회 녹음 정리 ---------- */
function minutesPrompt({ transcript, when, place, people, title, content }) {
  return `당신은 학교 교사 연구 모임 '기후행동 실천모임 에코쌤즈'의 협의회 서기입니다. 아래는 휴대폰 음성 인식으로 받아 적은 회의 원문입니다.
음성 인식이라 띄어쓰기·맞춤법 오류, 잘린 문장, 같은 말 반복, 잡담이 섞여 있습니다. 문맥으로 바로잡되, 원문에 없는 사실·숫자·이름·날짜는 절대 지어내지 마세요.
회의 정보: 일시 ${when}, 장소 ${place || "미기재"}, 참석 ${people.join(", ") || "미기재"}${title ? `, 기존 안건 "${title}"` : ""}.
${content ? `이미 적혀 있던 메모(함께 반영):\n${content}\n` : ""}
학교 협의록에 바로 옮겨 적을 수 있게 공문체(~함, ~하기로 함)로 간결하게 정리하고, 아래 JSON 하나만 출력하세요. 마크다운·코드펜스 금지.
{
 "title": "안건을 한 줄로 (25자 이내)",
 "content": "협의 내용. 주제별로 '1. 소주제' 다음 줄에 '- 핵심 내용' 형식, 줄바꿈은 \\n",
 "decisions": "결정 사항. '- ' 로 시작하는 줄들, 없으면 빈 문자열",
 "todos": [{"what": "할 일", "who": "참석자 이름 중 담당(모르면 빈 문자열)", "when": "기한(말한 경우만)"}]
}

[회의 원문]
${transcript}`;
}
function parseMinutes(text) {
  const t = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  const o = JSON.parse(s >= 0 && e > s ? t.slice(s, e + 1) : t);
  return { title: String(o.title || "").trim(), content: String(o.content || "").trim(), decisions: String(o.decisions || "").trim(),
    todos: Array.isArray(o.todos) ? o.todos.filter((x) => x && x.what).map((x) => ({ what: String(x.what), who: String(x.who || ""), when: String(x.when || "") })) : [] };
}
async function summarizeMeeting(settings, info) {
  const text = await callClaude(settings, { max_tokens: 10000, system: "응답은 반드시 유효한 JSON 객체 하나여야 합니다.", content: [{ type: "text", text: minutesPrompt(info) }] });
  try { return parseMinutes(text); } catch (e) { throw new Error("AI 정리 결과를 해석하지 못했어요. 다시 눌러 보세요."); }
}
const todosToText = (todos) => (todos || []).map((t) => `- ${t.what}${t.who ? ` (담당: ${t.who})` : ""}${t.when ? ` · ${t.when}` : ""}`).join("\n");
const textToTodos = (s) => String(s || "").split("\n").map((l) => l.replace(/^\s*[-•·*]\s*/, "").trim()).filter(Boolean).map((l) => {
  const m = l.match(/^(.*?)(?:\s*\(담당:\s*([^)]*)\))?(?:\s*·\s*(.+))?$/); return { what: (m && m[1]) || l, who: (m && m[2]) || "", when: (m && m[3]) || "" }; });

/* ---------- 내보내기 ---------- */
function saveFile(name, blobOrText, type) {
  const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText], { type });
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
async function shareFile(name, blob) {
  try {
    const f = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return true; }
  } catch (e) { if (e && e.name === "AbortError") return true; }
  return false;
}
/** dataURL → File (동기: 아이폰은 버튼을 누른 그 순간에 공유 창을 열어야 해서 기다림 없이 만든다) */
function dataUrlToFile(url, name) {
  const i = url.indexOf(","), mime = (url.slice(5, i).split(";")[0]) || "image/jpeg", b = atob(url.slice(i + 1)), a = new Uint8Array(b.length);
  for (let k = 0; k < b.length; k++) a[k] = b.charCodeAt(k);
  return new File([a], name, { type: mime });
}
const IN_APP = typeof navigator !== "undefined" && /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp|BAND\//i.test(navigator.userAgent || "");
const IS_IOS = typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
/** 어디서든 사진을 앨범에 저장하는 창 열기 */
const openSaver = (items, title) => window.dispatchEvent(new CustomEvent("eco-save", { detail: { items, title } }));

/** 앨범에 저장: 공유 창(아이폰 '이미지 저장', 안드로이드 '갤러리'), 안 되면 길게 눌러 저장 */
function PhotoSaver({ items: given, title, onClose }) {
  const [msg, setMsg] = useState(""), [done, setDone] = useState({});
  // 서버에 있는 사진은 미리 받아 둔다 (아이폰은 버튼을 누른 순간 바로 공유 창을 열어야 해서)
  const [items, setItems] = useState(() => (given.every((it) => isData(it.url)) ? given : null));
  useEffect(() => { if (items) return; let live = true;
    Promise.all(given.map(async (it) => ({ ...it, url: await photoDataUrl(it.url).catch(() => it.url) }))).then((x) => { if (live) setItems(x); });
    return () => { live = false; }; }, []);
  if (!items) return html`<div class="modal-bg" onClick=${onClose}><div class="modal max-w-md text-center py-8" onClick=${(e) => e.stopPropagation()}>
    <${Icon} name="Loader2" size=${24} className="animate-spin text-photon" /><p class="mt-2 text-[14px]">사진 ${given.length}장 준비하는 중…</p></div></div>`;
  const CH = 10; // 한 번에 공유할 장수 (아이폰은 너무 많으면 실패)
  const chunks = []; for (let i = 0; i < items.length; i += CH) chunks.push(items.slice(i, i + CH));
  const canShareFiles = (() => { try { return !!(navigator.canShare && navigator.canShare({ files: [dataUrlToFile(items[0].url, items[0].name)] })); } catch (e) { return false; } })();
  const shareChunk = (ci) => {
    setMsg("");
    try {
      const files = chunks[ci].map((it) => dataUrlToFile(it.url, it.name));
      navigator.share({ files }).then(() => setDone((d) => ({ ...d, [ci]: true })), (e) => {
        if (e && e.name === "AbortError") return;
        setMsg("저장 창을 열지 못했어요. 아래 사진을 길게 눌러 '사진 앱에 저장(이미지 저장)'을 눌러 주세요.");
      });
    } catch (e) { setMsg("저장 창을 열지 못했어요. 아래 사진을 길게 눌러 저장해 주세요."); }
  };
  const download = () => chunks.flat().forEach((it, i) => setTimeout(() => saveFile(it.name, dataUrlToFile(it.url, it.name)), i * 350));
  return html`<div class="modal-bg" onClick=${onClose}>
    <div class="modal max-w-md" role="dialog" aria-modal="true" aria-label="앨범에 저장" onClick=${(e) => e.stopPropagation()}>
      <div class="flex items-center gap-2 mb-2"><${Icon} name="ImageDown" size=${20} className="text-photon" />
        <h2 class="font-display text-[20px] text-snow">${title || "앨범에 저장"}</h2>
        <button type="button" class="icon-btn ml-auto" onClick=${onClose} aria-label="닫기"><${Icon} name="X" size=${18} /></button></div>
      ${IN_APP && html`<div class="err mb-3">카카오톡·네이버 같은 앱 안에서 열려 있어 저장이 막힐 수 있어요. 오른쪽 위(또는 아래) <b>⋯ 메뉴 → 다른 브라우저로 열기</b>(사파리·크롬)로 열면 바로 저장돼요.</div>`}
      ${canShareFiles
        ? html`<div class="grid gap-2">${chunks.map((c, ci) => html`<button key=${ci} type="button" class="btn-save" onClick=${() => shareChunk(ci)}>
            <${Icon} name=${done[ci] ? "Check" : "ImageDown"} size=${18} />${chunks.length > 1 ? `${ci * CH + 1}~${ci * CH + c.length}번째 ` : ""}사진 ${c.length}장 앨범에 저장${done[ci] ? " ✓" : ""}</button>`)}
            <p class="text-[12px] text-mist leading-relaxed">${IS_IOS ? "열리는 창에서 <이미지 저장> 또는 <N개의 이미지 저장>을 누르세요." : "열리는 창에서 갤러리(사진) 또는 '기기에 저장'을 고르세요."}</p></div>`
        : html`<button type="button" class="btn-save" onClick=${download}><${Icon} name="Download" size=${18} />사진 ${items.length}장 내려받기</button>
            <p class="text-[12px] text-mist mt-2 leading-relaxed">내려받은 사진은 '다운로드' 폴더에 들어가요. 갤러리 앱에서 '다운로드' 앨범을 보세요.</p>`}
      ${msg && html`<div class="err mt-2">${msg}</div>`}
      <p class="text-[12.5px] text-snow font-semibold mt-3 mb-1.5">또는 사진을 <b>길게 눌러</b> 저장</p>
      <div class="saver-grid">${items.slice(0, 60).map((it, i) => html`<img key=${i} src=${it.url} alt=${it.name} />`)}</div>
      ${items.length > 60 && html`<p class="text-[12px] text-mist mt-1">… 외 ${items.length - 60}장</p>`}
    </div>
  </div>`;
}
const today = () => new Date().toISOString().slice(0, 10);
function toGeoJSON(recs) {
  return JSON.stringify({ type: "FeatureCollection", name: "에코쌤즈_따로또같이_광합성지도", features: recs.map((r) => ({
    type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    properties: { id: r.id, mode: MODES[r.mode] ? MODES[r.mode].label : "", place: r.place || "", datetime: new Date(r.ts).toISOString(),
      researcher: r.researcher, koreanName: r.koreanName, scientificName: r.scientificName, confidence: r.confidence, growthForm: r.growthForm,
      photosynthesisType: r.psType, family: r.ai && r.ai.taxonomy ? r.ai.taxonomy.family : "", temp_c: r.weather.temp, rh_pct: r.weather.rh,
      cloud_pct: r.weather.cloud, sw_wm2: r.weather.sw, ppfd: r.weather.ppfd, par_index: r.weather.par, activity: M.activity(r.weather.ppfd).label,
      a_leaf_umol: r.model.aLeaf, lai: r.model.lai, gco2_h_m2: r.model.gco2, gps_accuracy_m: r.accuracy, location_source: r.source || "", sample: !!r.sample, notes: r.notes || "" } })) }, null, 2);
}
function toCSV(recs) {
  const head = ["일시", "따로/같이", "장소", "연구원", "위도", "경도", "위치 기준", "GPS정확도(m)", "국명", "학명", "신뢰도(%)", "과", "생활형", "광합성유형",
    "기온(℃)", "습도(%)", "운량(%)", "일사량(W/m²)", "PPFD(µmol/m²/s)", "PAR지수", "광합성활성", "잎 순광합성(µmol/m²/s)",
    "LAI", "탄소고정(gCO₂/h·m²)", "기후지표종", "메모", "AI 광합성 해설", "AI 기후지표 근거", "AI 수업 연계 조언", "예시"];
  const src = { gps: "GPS", map: "지도 지정", home: "우리 동네 기본 위치", photo: "사진 위치정보", default: "임시 위치" };
  const rows = recs.map((r) => [new Date(r.ts).toLocaleString("ko-KR"), MODES[r.mode] ? MODES[r.mode].label : "", r.place || "", r.researcher, r.lat, r.lng, src[r.source] || "", r.accuracy ?? "",
    r.koreanName, r.scientificName, r.confidence ?? "", r.ai && r.ai.taxonomy ? r.ai.taxonomy.family : "", r.growthForm, r.psType,
    r.weather.temp, r.weather.rh, r.weather.cloud, r.weather.sw, r.weather.ppfd, r.weather.par, M.activity(r.weather.ppfd).label,
    r.model.aLeaf, r.model.lai, r.model.gco2, r.ai && r.ai.ecologicalInsight && r.ai.ecologicalInsight.climateIndicator ? "O" : "",
    (r.notes || "").replace(/\n/g, " "), (r.ai && r.ai.carbonFixationEst && r.ai.carbonFixationEst.comment) || "",
    (r.ai && r.ai.ecologicalInsight && r.ai.ecologicalInsight.note) || "", (r.ai && r.ai.ecologicalInsight && r.ai.ecologicalInsight.classroom) || "", r.sample ? "O" : ""]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  return "﻿" + head.join(",") + "\n" + rows.join("\n");
}

/* ---------- 아이콘 (Lucide) ---------- */
function Icon({ name, size = 18, className = "", stroke = 2 }) {
  const lib = window.lucide && window.lucide.icons;
  const ALIAS = { Loader2: "LoaderCircle", LoaderCircle: "Loader2", Table2: "Table", Settings2: "Settings", House: "Home", Home: "House" };
  let node = lib && (lib[name] || lib[ALIAS[name]]);
  if (!node) return html`<span style=${{ width: size, height: size, display: "inline-block" }}></span>`;
  if (node[0] === "svg") node = node[2] || [];
  return html`<svg xmlns="http://www.w3.org/2000/svg" width=${size} height=${size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width=${stroke} stroke-linecap="round" stroke-linejoin="round" class=${"shrink-0 " + className}
    aria-hidden="true">${node.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}</svg>`;
}

/* ---------- 작은 컴포넌트 ---------- */
const Dot = ({ color, size = 8 }) => html`<span class="inline-block rounded-full shrink-0" style=${{ width: size, height: size, background: color }}></span>`;
const Chip = ({ on, onClick, children, color }) => html`<button type="button" onClick=${onClick}
  class=${"chip " + (on ? "chip-on" : "")} style=${on && color ? { borderColor: color, background: color } : null}>${children}</button>`;
const Label = ({ children }) => html`<div class="lbl">${children}</div>`;
const ModeTag = ({ mode, small }) => { const m = MODES[mode] || MODES.team;
  return html`<span class=${"mode-tag" + (small ? " mode-tag-s" : "")} style=${{ color: m.color, borderColor: m.color }}>${m.label}</span>`; };

function ParGauge({ par, ppfd, size = 132 }) {
  const r = 52, c = Math.PI * r, v = M.clamp(par || 0, 0, 100);
  const act = M.activity(ppfd);
  return html`<svg viewBox="0 0 128 76" width=${size} height=${size * 76 / 128} role="img" aria-label=${`PAR 지수 ${v}`}>
    <defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="#F5B70B"/><stop offset=".45" stop-color="#84CC16"/><stop offset="1" stop-color="#16A34A"/></linearGradient></defs>
    <path d="M12 68 A52 52 0 0 1 116 68" fill="none" stroke="#E6EFDC" stroke-width="10" stroke-linecap="round"/>
    <path d="M12 68 A52 52 0 0 1 116 68" fill="none" stroke="url(#pg)" stroke-width="10" stroke-linecap="round"
      stroke-dasharray=${`${(c * v) / 100} ${c}`} style=${{ transition: "stroke-dasharray .8s ease" }}/>
    <text x="64" y="58" text-anchor="middle" class="mono" font-size="24" font-weight="700" fill="#1D3B2A">${v}</text>
    <text x="64" y="72" text-anchor="middle" font-size="9" fill=${ACT_COLOR[act.key]}>${act.label}</text>
  </svg>`;
}

/* ---------- 포스터식 머리 그림 ---------- */
const ART = (() => {
  const sprig = (x, y, k, c, flip) => {
    const d = flip ? -1 : 1; let o = `<path d="M${x} ${y} Q${x + d * 22 * k} ${y - 85 * k} ${x + d * 10 * k} ${y - 170 * k}" fill="none" stroke="${c}" stroke-width="${5 * k}" stroke-linecap="round"/>`;
    for (let i = 0; i < 7; i++) {
      const t = (i + 1) / 8, px = x + d * 18 * k * Math.sin(t * 3), py = y - t * 165 * k, side = i % 2 ? 1 : -1;
      const lx = px + side * 15 * k, rot = side * d * 38;
      o += `<ellipse cx="${lx.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(17 - i) * k}" ry="${7 * k}" transform="rotate(${rot} ${lx.toFixed(1)} ${py.toFixed(1)})" fill="${c}"/>`;
    }
    return o;
  };
  const eye = (x, y, r) => `<ellipse cx="${x}" cy="${y}" rx="${r * 0.78}" ry="${r}" fill="#fff" stroke="#1D3B2A" stroke-width="2"/><ellipse cx="${x + r * 0.12}" cy="${y + r * 0.15}" rx="${r * 0.42}" ry="${r * 0.55}" fill="#1D3B2A"/><circle cx="${x - r * 0.05}" cy="${y - r * 0.2}" r="${r * 0.16}" fill="#fff"/>`;
  return `
  <path d="M0 300 L0 205 Q130 150 270 192 Q390 228 480 186 Q610 136 735 186 Q860 232 1000 172 L1000 300 Z" fill="#C6DE3A"/>
  <g fill="#2E8B4E"><circle cx="330" cy="200" r="62"/><circle cx="420" cy="150" r="58"/><circle cx="585" cy="140" r="58"/><circle cx="690" cy="196" r="66"/></g>
  ${sprig(150, 290, 1.05, "#3E9E3A", false)}${sprig(205, 295, 0.7, "#5DB548", true)}${sprig(850, 292, 1.05, "#A6D93C", true)}${sprig(800, 296, 0.68, "#7CC242", false)}
  <g>
    <rect x="300" y="128" width="84" height="175" rx="12" fill="#F6EBDD" stroke="#1D3B2A" stroke-width="2"/>
    <rect x="292" y="104" width="100" height="32" rx="8" fill="#3B8FD1" stroke="#1D3B2A" stroke-width="2"/>
    <circle cx="308" cy="118" r="5" fill="#9FD3F5"/>
    <rect x="296" y="158" width="92" height="56" rx="8" fill="#3B8FD1" stroke="#1D3B2A" stroke-width="2"/>
    ${eye(329, 184, 12)}${eye(355, 184, 12)}
    <path d="M332 203 Q342 210 352 203" fill="none" stroke="#1D3B2A" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="292" cy="250" r="15" fill="#3B8FD1" stroke="#1D3B2A" stroke-width="2"/>
  </g>
  <g>
    <circle cx="500" cy="196" r="92" fill="#4FB7E8" stroke="#1D3B2A" stroke-width="2.5"/>
    <path d="M430 150 Q455 128 482 142 Q500 160 480 178 Q462 196 474 214 Q470 240 444 236 Q420 214 424 186 Q418 166 430 150 Z" fill="#5CB85C"/>
    <path d="M540 128 Q570 136 576 160 Q588 190 566 206 Q544 214 538 194 Q534 174 520 166 Q514 144 540 128 Z" fill="#5CB85C"/>
    <path d="M512 248 Q540 240 556 256 Q540 280 512 276 Q500 262 512 248 Z" fill="#5CB85C"/>
    ${eye(482, 192, 15)}${eye(516, 192, 15)}
    <path d="M490 222 L499 230 L508 222" fill="none" stroke="#1D3B2A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g>
    <path d="M668 170 L760 162 L770 300 L676 300 Z" fill="#3B8FD1" stroke="#1D3B2A" stroke-width="2"/>
    <path d="M612 182 Q612 112 650 112 Q688 112 688 182" fill="none" stroke="#F2D94E" stroke-width="12" stroke-linecap="round"/>
    <path d="M592 176 L712 176 L726 304 L578 304 Z" fill="#F2D94E" stroke="#1D3B2A" stroke-width="2.2" stroke-linejoin="round"/>
    ${eye(636, 222, 13)}${eye(664, 222, 13)}
    <path d="M638 246 Q650 256 662 246" fill="none" stroke="#1D3B2A" stroke-width="2.5" stroke-linecap="round"/>
    <g stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M690 196 L704 184"/><path d="M694 212 L712 206"/><path d="M684 186 L692 170"/></g>
    <circle cx="722" cy="256" r="15" fill="#3B8FD1" stroke="#1D3B2A" stroke-width="2"/>
  </g>
  <path d="M0 300 L0 246 Q170 214 340 252 Q510 288 660 250 Q830 210 1000 242 L1000 300 Z" fill="#8CC63F"/>
  <path d="M0 300 L0 284 Q500 258 1000 284 L1000 300 Z" fill="#F6FAF2"/>`;
})();

function Hero({ children }) {
  return html`<header class="hero">
    <div class="hero-in">
      ${children}
      <h1 class="hero-title"><span class="y">기후행동 실천모임</span> <span class="w">에코쌤즈</span></h1>
      <div class="hero-sub">함께 배우고, 함께 실천하는 기후행동!</div>
      <div class="hero-motto"><span class="m-solo">따로</span><span class="m-amp">또</span><span class="m-team">같이</span><span class="m-rest">우리 지역 광합성 지도</span></div>
    </div>
    <svg class="hero-art" viewBox="0 0 1000 300" preserveAspectRatio="xMidYMax slice" role="img"
      aria-label="텀블러, 지구, 장바구니 캐릭터가 언덕과 풀잎 사이에서 웃고 있는 그림" dangerouslySetInnerHTML=${{ __html: ART }}></svg>
  </header>`;
}

/** 언제나 위에 있는 이동 막대: 뒤로 · 처음(로고) · 멤버 전환 · 설정 · 나가기 */
function NavBar({ tab, name, canBack, onBack, onHome, onSwitch, onSettings, onLogout, hasKey }) {
  const t = TABS.find((x) => x.id === tab) || TABS[0];
  const sub = { solo: "각자 우리 동네에서", team: "학교에서 다 같이", map: "따로 또 같이, 한 장의 지도", activity: "우리가 함께한 순간", archive: "사진·영상·데이터로 남기기", today: "따로 또 같이" }[tab];
  return html`<div class="strip">
    <div class="strip-in">
      <button type="button" class="nav-btn" onClick=${onBack} aria-label=${canBack ? "뒤로 가기" : "처음 화면으로"} disabled=${!canBack && tab === "today"}>
        <${Icon} name="ChevronLeft" size=${22} /><span class="nav-lbl">뒤로</span></button>
      <button type="button" class="nav-logo" onClick=${onHome} aria-label="처음 화면(오늘)으로">
        <span class="strip-team">기후행동 실천모임 <b>에코쌤즈</b></span>
        <span class="strip-title"><${Icon} name=${t.icon} size=${18} />${t.label}<small>${sub}</small></span>
      </button>
      <div class="flex items-center gap-1.5 shrink-0 ml-auto">
        <button type="button" class="nav-me" onClick=${onSwitch} aria-label="멤버 전환">
          <${Dot} color=${rColor(name)} size=${10} /><span>${name}</span><${Icon} name="Repeat" size=${14} /></button>
        <button type="button" class=${"strip-btn" + (hasKey ? " on" : "")} onClick=${onSettings} aria-label="AI 분석 설정"><${Icon} name="Settings2" size=${17} /></button>
        <button type="button" class="nav-out" onClick=${onLogout}><${Icon} name="LogOut" size=${16} /><span class="nav-lbl">나가기</span></button>
      </div>
    </div>
  </div>`;
}

function SwitchModal({ me, onPick, onClose }) {
  return html`<div class="modal-bg" onClick=${onClose}>
    <div class="modal max-w-sm" role="dialog" aria-modal="true" aria-label="멤버 전환" onClick=${(e) => e.stopPropagation()}>
      <div class="flex items-center gap-2 mb-3"><${Icon} name="Repeat" size=${19} className="text-photon" />
        <h2 class="font-display text-[20px] text-snow">멤버 전환</h2>
        <button type="button" class="icon-btn ml-auto" onClick=${onClose} aria-label="닫기"><${Icon} name="X" size=${18} /></button></div>
      <p class="text-[13px] text-mist mb-3">이 휴대폰에서 기록할 사람을 바꿔요. 이미 팀 비밀번호로 열린 기기라 다시 묻지 않아요.</p>
      <div class="who-grid">${RESEARCHERS.map((r) => html`<button key=${r.name} type="button" class=${"who-b" + (me === r.name ? " who-on" : "")} onClick=${() => onPick(r.name)}>
        <${Dot} color=${r.color} size=${10} /><span class="grid text-left leading-tight">${r.name}<small>${HOME_DEFAULT[r.name].label}${me === r.name ? " · 지금" : ""}</small></span></button>`)}</div>
    </div>
  </div>`;
}

function TabBar({ tab, setTab, counts }) {
  return html`<nav class="tabbar" aria-label="화면 이동">
    ${TABS.map((t) => html`<button key=${t.id} type="button" class=${"tab" + (tab === t.id ? " tab-on" : "") + " tab-" + t.id}
      onClick=${() => setTab(t.id)} aria-current=${tab === t.id ? "page" : null}>
      <span class="tab-ic"><${Icon} name=${t.icon} size=${21} />${counts[t.id] ? html`<i>${counts[t.id]}</i>` : null}</span>${t.label}</button>`)}
  </nav>`;
}

/* ---------- 입장 (연구원별 로그인) ---------- */
function Gate({ onLogin }) {
  const [name, setName] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (!name) { setErr("이름을 먼저 골라 주세요."); return; }
    if (pin !== TEAM_PIN) { setErr("비밀번호가 맞지 않아요. 다시 입력해 주세요."); setPin(""); setShake(false); requestAnimationFrame(() => setShake(true)); return; }
    onLogin(name);
  };
  return html`<div class="gate">
    <${Hero} />
    <div class="wrap pb-12">
      <form class=${"gate-card grid gap-4" + (shake ? " shake" : "")} onSubmit=${submit} onAnimationEnd=${() => setShake(false)}>
        <div class="text-center"><span class="pill-h">연구원 입장</span>
          <p class="text-[13px] text-mist mt-2">내 이름을 고르고 팀 비밀번호를 입력하세요.</p></div>
        <div class="who-grid" role="radiogroup" aria-label="연구원 이름">
          ${RESEARCHERS.map((r) => html`<button key=${r.name} type="button" role="radio" aria-checked=${name === r.name}
            class=${"who-b" + (name === r.name ? " who-on" : "")} onClick=${() => { setName(r.name); setErr(""); }}>
            <${Dot} color=${r.color} size=${10} /><span class="grid text-left leading-tight">${r.name}<small>${HOME_DEFAULT[r.name].label}</small></span></button>`)}
        </div>
        <label class="fld"><span>비밀번호</span>
          <input id="pinIn" class="pin-in" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"
            value=${pin} onInput=${(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(""); }} /></label>
        ${err && html`<div class="err" role="alert">${err}</div>`}
        <button type="submit" class="gate-go">${name ? `${name} 님, 탐사 시작` : "탐사 시작"}</button>
      </form>
    </div>
  </div>`;
}

/* ---------- 프레임 사진 (기록 카드 공용) ---------- */
function Print({ rec, onOpen, tilt }) {
  const m = MODES[rec.mode] || MODES.team;
  return html`<button type="button" class="print" style=${{ "--tilt": `${tilt || 0}deg` }} onClick=${() => onOpen(rec.id)}
    aria-label=${`${rec.koreanName || "식물"} 기록 열기`}>
    ${rec.photo ? html`<img src=${rec.photo} alt="" loading="lazy" />`
      : html`<span class="print-empty"><span class="print-ph"><${Icon} name="Leaf" size=${30} /></span>
          <b>${rec.koreanName || "이름 모를 식물"}</b><small>${m.label} · ${rec.researcher}</small>
          <em class="mono">${EM.stampDate(rec.ts)}</em></span>`}
    ${rec.sample && html`<span class="print-sample">예시</span>`}
  </button>`;
}

/* ---------- 오늘 ---------- */
function WeatherCard({ w, state, err, onRefresh, gps }) {
  const act = w ? M.activity(w.ppfd) : null;
  return html`<section class="glass p-4 grid gap-3">
    <div class="flex items-center gap-2 flex-wrap"><h2 class="pill-h"><${Icon} name="Sun" size=${17} />오늘의 빛</h2>
      <span class="text-[12px] text-mist">${gps ? "내 위치 기준" : "기본 위치 기준"}${w ? ` · ${new Date(w.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 갱신` : ""}</span>
      <button type="button" class="link-btn ml-auto" onClick=${onRefresh}><${Icon} name="RefreshCw" size=${13} />새로 고침</button></div>
    <div class="flex items-center gap-4 flex-wrap">
      <${ParGauge} par=${w ? w.par : 0} ppfd=${w ? w.ppfd : 0} />
      <div class="grid grid-cols-2 gap-2 flex-1 min-w-[200px]">
        ${[["Sun", "일사량", w && fix(w.sw, 0), "W/m²"], ["Thermometer", "기온", w && fix(w.temp), "℃"],
           ["Droplets", "습도", w && fix(w.rh, 0), "%"], ["Cloud", "운량", w && fix(w.cloud, 0), "%"]].map(([ic, k, v, u]) => html`
          <div key=${k} class="stat"><div class="flex items-center gap-1.5 text-mist text-[12px]"><${Icon} name=${ic} size=${13} />${k}</div>
            <div class="mono text-[19px] text-snow leading-tight mt-0.5">${v || "–"}<span class="text-[11px] text-mist ml-1">${u}</span></div></div>`)}
      </div>
    </div>
    <div class="text-[13px]" style=${{ color: act ? ACT_COLOR[act.key] : "#5F7A68" }}>
      ${state === "loading" ? "빛 정보를 불러오는 중…" : state === "error" ? err
        : w ? `지금 광합성 활성은 ‘${act.label}’ (PPFD ${w.ppfd} µmol/m²/s). ${act.key === "high" ? "잎이 가장 바쁘게 일하는 시간이에요." : act.key === "mid" ? "기록하기 좋은 빛이에요." : "그늘·저녁 빛이에요. 음지 식물을 찾아보세요."}` : ""}</div>
  </section>`;
}

/** 어디서든 눈에 띄는 협의회 바로가기 */
function MeetBar({ meetings = [], onAdd, onList }) {
  const last = meetings[0];
  return html`<div class="meet-bar">
    <button type="button" class="meet-bar-main" onClick=${onAdd}>
      <span class="meet-bar-ic"><${Icon} name="Mic" size=${24} /></span>
      <span class="flex-1 min-w-0"><b>협의회 기록하기</b><small>녹음 → 정리하기 한 번이면 협의록 완성</small></span>
      <${Icon} name="ChevronRight" size=${20} /></button>
    <button type="button" class="meet-bar-list" onClick=${onList}>
      <b class="mono">${meetings.length}</b><small>${last ? `최근 ${new Date(last.ts).getMonth() + 1}/${new Date(last.ts).getDate()}` : "협의록"}</small></button>
  </div>`;
}

function TodayView({ me, records, meetings = [], weather, wState, wErr, gps, onRefresh, onAdd, onOpen, goTab, onAddMeeting, onMeetings }) {
  const solo = records.filter((r) => r.mode === "solo"), team = records.filter((r) => r.mode === "team");
  const mineToday = solo.filter((r) => r.researcher === me && fmtDay(r.ts) === fmtDay(Date.now())).length;
  const teamToday = team.filter((r) => fmtDay(r.ts) === fmtDay(Date.now())).length;
  const recent = records.slice(0, 6);
  const sp = (a) => new Set(a.map(speciesKey).filter(Boolean)).size;
  return html`<div class="grid gap-4">
    <div class="duo">
      <button type="button" class="duo-b duo-solo" onClick=${() => onAdd("solo")}>
        <span class="duo-k">따로</span><b>우리 동네 식물 기록</b><small>${getHome(me).label} 주변 · 오늘 ${mineToday}건</small>
        <span class="duo-go"><${Icon} name="Camera" size=${20} /></span></button>
      <button type="button" class="duo-b duo-team" onClick=${() => onAdd("team")}>
        <span class="duo-k">같이</span><b>학교 식물 수집</b><small>교정에서 다 함께 · 오늘 ${teamToday}건</small>
        <span class="duo-go"><${Icon} name="Camera" size=${20} /></span></button>
    </div>
    <${MeetBar} meetings=${meetings} onAdd=${onAddMeeting} onList=${onMeetings} />
    <${WeatherCard} w=${weather} state=${wState} err=${wErr} onRefresh=${onRefresh} gps=${gps} />
    <section class="glass p-4 grid gap-3">
      <h2 class="pill-h justify-self-start"><${Icon} name="Sprout" size=${17} />우리가 모은 초록</h2>
      <div class="tally">
        <button type="button" onClick=${() => goTab("solo")}><span style=${{ color: MODES.solo.color }}>따로</span><b class="mono">${solo.length}</b><small>${sp(solo)}종</small></button>
        <span class="tally-amp" aria-hidden="true">+</span>
        <button type="button" onClick=${() => goTab("team")}><span style=${{ color: MODES.team.color }}>같이</span><b class="mono">${team.length}</b><small>${sp(team)}종</small></button>
        <span class="tally-amp" aria-hidden="true">=</span>
        <button type="button" onClick=${() => goTab("map")}><span>모두</span><b class="mono">${records.length}</b><small>${sp(records)}종</small></button>
      </div>
      ${recent.length ? html`<div class="strip-prints">${recent.map((r, i) => html`<${Print} key=${r.id} rec=${r} onOpen=${onOpen} tilt=${i % 2 ? 2 : -2} />`)}</div>`
        : html`<p class="text-[13px] text-mist">아직 기록이 없어요. 위의 ‘따로’ 또는 ‘같이’를 눌러 첫 식물을 찍어 보세요.</p>`}
    </section>
  </div>`;
}

/* ---------- 따로: 각자 우리 동네 ---------- */
function SoloView({ me, records, gps, onAdd, onOpen, say }) {
  const [who, setWho] = useState(me);
  const [, bump] = useState(0);
  const solo = records.filter((r) => r.mode === "solo");
  const mine = solo.filter((r) => r.researcher === who);
  const home = getHome(who);
  const useGpsAsHome = () => {
    if (!gps) { say("GPS 위치를 아직 못 잡았어요. 위치 권한을 허용해 주세요."); return; }
    setHome(me, { lat: +gps.lat.toFixed(6), lng: +gps.lng.toFixed(6) }); bump((x) => x + 1); say("지금 위치를 우리 동네 기본 위치로 저장했어요 (이 휴대폰에만)");
  };
  return html`<div class="grid gap-4">
    <div class="lanes">
      ${RESEARCHERS.map((r) => { const list = solo.filter((x) => x.researcher === r.name);
        return html`<button key=${r.name} type="button" class=${"lane" + (who === r.name ? " lane-on" : "")} style=${{ "--c": r.color }} onClick=${() => setWho(r.name)}>
          <span class="lane-top"><${Dot} color=${r.color} size=${9} /><b>${r.name}</b>${r.name === me ? html`<em>나</em>` : null}</span>
          <span class="lane-home"><${Icon} name="MapPin" size=${11} />${getHome(r.name).label}</span>
          <span class="lane-n mono">${list.length}<small>건 · ${new Set(list.map(speciesKey).filter(Boolean)).size}종</small></span>
          <span class="lane-thumbs">${list.slice(0, 3).map((x) => x.photo ? html`<img key=${x.id} src=${x.photo} alt="" />` : html`<i key=${x.id}><${Icon} name="Leaf" size=${12} /></i>`)}</span>
        </button>`; })}
    </div>
    <section class="glass p-4 grid gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <h2 class="pill-h pill-solo"><${Icon} name="House" size=${17} />${who === me ? "나의 동네 도감" : `${who} 님의 동네 도감`}</h2>
        <span class="text-[12px] text-mist">${mine.length}건</span>
        ${who === me && html`<button type="button" class="btn-add ml-auto" style=${{ "--c": MODES.solo.color }} onClick=${() => onAdd("solo")}><${Icon} name="Plus" size=${17} />따로 기록</button>`}
      </div>
      <div class="home-line"><${Icon} name="MapPin" size=${14} /><span>탐구 기본 위치 <b>${home.label}</b>${who === me ? html` <span class="text-mist">${home.custom ? "· 내가 정한 정확한 위치 (이 휴대폰에만 저장)" : "· 동 중심"}</span>` : null}</span>
        ${who === me && html`<button type="button" class="link-btn ml-auto" onClick=${useGpsAsHome}><${Icon} name="LocateFixed" size=${13} />지금 위치로 바꾸기</button>`}</div>
      ${mine.length ? html`<div class="prints">${mine.map((r, i) => html`<${Print} key=${r.id} rec=${r} onOpen=${onOpen} tilt=${[-2, 1.5, -1, 2][i % 4]} />`)}</div>`
        : html`<div class="empty-note">${who === me ? `${home.label} 주변의 화단, 산책로, 가로수… 우리 동네 식물을 하나 찍어 첫 칸을 채워 보세요.` : `${who} 님은 아직 동네 기록이 없어요.`}</div>`}
    </section>
  </div>`;
}

/* ---------- 같이: 학교 식물 표본함 ---------- */
function TeamView({ records, meetings, sub, setSub, onAdd, onOpen, onAddMeeting, onOpenMeeting, onExportMinutes }) {
  const seg = html`<div class="seg3" role="tablist" aria-label="같이 보기">
    <button type="button" role="tab" aria-selected=${sub === "plants"} class=${"seg3-b" + (sub === "plants" ? " on" : "")} onClick=${() => setSub("plants")}>학교 식물 표본함</button>
    <button type="button" role="tab" aria-selected=${sub === "meetings"} class=${"seg3-b" + (sub === "meetings" ? " on s-meeting" : "")} onClick=${() => setSub("meetings")}>협의회 기록 ${meetings.length}</button>
  </div>`;
  if (sub === "meetings") return html`<div class="grid gap-4">${seg}<${MeetingList} meetings=${meetings} onAdd=${onAddMeeting} onOpen=${onOpenMeeting} onExport=${onExportMinutes} /></div>`;
  const total = records.filter((r) => r.mode === "team");
  const groups = useMemo(() => {
    const m = new Map();
    total.slice().sort((a, b) => a.ts - b.ts).forEach((r) => { const k = speciesKey(r) || "미동정-" + r.id; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return [...m.values()];
  }, [records]);
  return html`<div class="grid gap-4">
    ${seg}
    <${MeetBar} meetings=${meetings} onAdd=${onAddMeeting} onList=${() => setSub("meetings")} />
    <section class="glass p-4 grid gap-3">
      <div class="flex items-center gap-2 flex-wrap">
        <h2 class="pill-h"><${Icon} name="School" size=${17} />학교 식물 표본함</h2>
        <span class="text-[12px] text-mist">${groups.length}종 · ${total.length}건 · 넷이 함께 모은 교정 식물</span>
        <button type="button" class="btn-add ml-auto" style=${{ "--c": MODES.team.color }} onClick=${() => onAdd("team")}><${Icon} name="Plus" size=${17} />같이 수집</button>
      </div>
      <div class="contrib">${RESEARCHERS.map((r) => { const n = total.filter((x) => x.researcher === r.name).length;
        return html`<span key=${r.name} style=${{ "--c": r.color, flexGrow: Math.max(n, 0.5) }} title=${`${r.name} ${n}건`}><b>${r.name}</b>${n}</span>`; })}</div>
    </section>
    ${groups.length ? html`<div class="herb-grid">${groups.map((g, i) => { const r = g[0], last = g[g.length - 1];
      const who = [...new Set(g.map((x) => x.researcher))];
      return html`<article key=${r.id} class="herb" style=${{ "--tilt": `${[-0.6, 0.5, -0.3, 0.7][i % 4]}deg` }}>
        <span class="tape" aria-hidden="true"></span>
        <button type="button" class="herb-photo" onClick=${() => onOpen(last.id)} aria-label=${`${r.koreanName || "식물"} 열기`}>
          ${last.photo ? html`<img src=${last.photo} alt="" loading="lazy" />` : html`<span><${Icon} name="Leaf" size=${34} /></span>`}</button>
        <div class="herb-label">
          <div class="herb-no mono">에코쌤즈 학교표본 No.${String(i + 1).padStart(3, "0")}</div>
          <div class="herb-name">${r.koreanName || "미동정"}${r.sample ? html` <span class="badge text-amber">예시</span>` : null}</div>
          <div class="herb-sci">${r.scientificName || "학명 미상"}</div>
          <dl>
            <dt>과</dt><dd>${(r.ai && r.ai.taxonomy && r.ai.taxonomy.family) || "–"}</dd>
            <dt>유형</dt><dd>${M.PS_TYPES[r.psType].label} · ${r.growthForm}</dd>
            <dt>채집</dt><dd>${fmtDay(r.ts)}${g.length > 1 ? ` 외 ${g.length - 1}회` : ""}</dd>
            <dt>채집자</dt><dd>${who.map((n) => html`<span key=${n} class="inline-flex items-center gap-1 mr-1.5"><${Dot} color=${rColor(n)} size=${7} />${n}</span>`)}</dd>
            <dt>탄소</dt><dd class="mono">${fix(r.model.gco2, 2)} g/h·m²</dd>
          </dl>
        </div>
      </article>`; })}</div>`
      : html`<div class="empty-note">학교 화단, 운동장 가장자리, 담장 밑… 교정의 식물을 같이 모아 표본함을 채워요.</div>`}
  </div>`;
}

/* ---------- 지도 바탕: 위성사진(기본) · 지명 · 일반 지도 ---------- */
const ESRI_SAT = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const OSM_STD = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_SOFT = "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> 기여자';
const MAX_Z = 21;      // 21단계: 1칸 ≈ 0.06m (원본 타일은 19단계까지, 그 위는 확대만)
const PICK_Z = 17;     // 위치 고를 때 처음 보이는 단계: 동네 블록 몇 개가 한눈에
const LS_BASE = "ecossam.v2.base";
/** 바탕 지도: 기본은 부드러운 일반 지도, 오른쪽 위 버튼 하나로 위성사진과 바꾸기 (마지막 선택을 기억) */
function addBaseLayers(map, togglePos = "topright") {
  const layers = {
    map: L.tileLayer(OSM_SOFT, { subdomains: "abc", maxNativeZoom: 19, maxZoom: MAX_Z, attribution: OSM_ATTR }),
    sat: L.tileLayer(ESRI_SAT, { maxNativeZoom: 19, maxZoom: MAX_Z, className: "sat-tiles", attribution: "위성사진 &copy; Esri, Maxar, Earthstar Geographics" }),
  };
  // 부드러운 지도 서버가 막히면 OSM 기본 지도로
  let fellBack = false;
  layers.map.on("tileerror", () => { if (fellBack) return; fellBack = true; const std = L.tileLayer(OSM_STD, { maxNativeZoom: 19, maxZoom: MAX_Z, attribution: OSM_ATTR });
    const on = map.hasLayer(layers.map); if (on) map.removeLayer(layers.map); layers.map = std; if (on) std.addTo(map); });
  let cur = store.get(LS_BASE, "map") === "sat" ? "sat" : "map";
  layers[cur].addTo(map);
  const Ctl = L.Control.extend({
    onAdd() {
      const b = L.DomUtil.create("button", "base-tog");
      b.type = "button";
      const paint = () => { b.innerHTML = cur === "map" ? "<span>🛰️</span>위성" : "<span>🗺️</span>지도"; b.setAttribute("aria-label", cur === "map" ? "위성사진으로 보기" : "일반 지도로 보기"); };
      paint();
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, "click", (e) => { L.DomEvent.stop(e); map.removeLayer(layers[cur]); cur = cur === "map" ? "sat" : "map"; layers[cur].addTo(map); store.set(LS_BASE, cur); paint(); });
      return b;
    },
  });
  new Ctl({ position: togglePos }).addTo(map);
  L.control.scale({ metric: true, imperial: false, maxWidth: 110 }).addTo(map);
}
const mPerPx = (lat, z) => 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);

/** 지도 위에 콕 찍어 위치 정하기 (핀 끌기·지도 누르기) */
function LocPicker({ pos, onPick, color }) {
  const elRef = useRef(null), mapRef = useRef(null), pinRef = useRef(null), accRef = useRef(null), cbRef = useRef(onPick);
  const [z, setZ] = useState(PICK_Z);
  cbRef.current = onPick;
  const start = pos || { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
  useEffect(() => {
    if (!window.L || !elRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true, maxZoom: MAX_Z, tap: true }).setView([start.lat, start.lng], pos ? PICK_Z : 16);
    addBaseLayers(map);
    const icon = L.divIcon({ className: "", iconSize: [34, 44], iconAnchor: [17, 42], html: `<span class="pick-pin" style="--c:${color || "#DC4B31"}"><i></i></span>` });
    const pin = L.marker([start.lat, start.lng], { draggable: true, icon, autoPan: true }).addTo(map);
    const send = (ll) => cbRef.current({ lat: +ll.lat.toFixed(7), lng: +ll.lng.toFixed(7), accuracy: null, source: "map" });
    pin.on("dragend", () => send(pin.getLatLng()));
    map.on("click", (e) => { pin.setLatLng(e.latlng); send(e.latlng); });
    map.on("zoomend", () => setZ(map.getZoom()));
    mapRef.current = map; pinRef.current = pin; setZ(map.getZoom());
    setTimeout(() => map.invalidateSize(), 150);
    return () => map.remove();
  }, []);
  useEffect(() => {
    const map = mapRef.current, pin = pinRef.current; if (!map || !pin || !pos) return;
    const cur = pin.getLatLng();
    if (Math.abs(cur.lat - pos.lat) > 1e-8 || Math.abs(cur.lng - pos.lng) > 1e-8) { pin.setLatLng([pos.lat, pos.lng]); map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), PICK_Z)); }
    if (accRef.current) { accRef.current.remove(); accRef.current = null; }
    if (pos.source === "gps" && pos.accuracy) accRef.current = L.circle([pos.lat, pos.lng], { radius: pos.accuracy, color: "#2B9BD6", weight: 1.5, fillOpacity: 0.12, interactive: false }).addTo(map);
  }, [pos && pos.lat, pos && pos.lng, pos && pos.source]);
  const res = mPerPx(start.lat, z);
  return html`<div class="pickwrap">
    <div ref=${elRef} class="pickmap" role="application" aria-label="위치 고르기 지도. 지도를 누르거나 핀을 끌어 위치를 정해요."></div>
    <div class="pick-read mono">확대 ${z} · 1칸 ≈ ${res < 1 ? (res * 100).toFixed(0) + "cm" : res.toFixed(1) + "m"}${z < 19 ? " · 정확히: 두 손가락으로 확대" : ""}</div>
  </div>`;
}

/* ---------- 지도 ---------- */
function MapPanel({ records, homes, selectedId, onSelect, onMapPick, gpsPos, follow, setFollow }) {
  const elRef = useRef(null), mapRef = useRef(null), layerRef = useRef(null), meRef = useRef(null), pickRef = useRef(onMapPick);
  const [ok, setOk] = useState(true);
  pickRef.current = onMapPick;
  const fit = () => {
    const map = mapRef.current; if (!map) return;
    const pts = records.map((r) => [r.lat, r.lng]).concat(homes.map((x) => [x.lat, x.lng]));
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 17 });
  };
  useEffect(() => {
    if (!window.L || !elRef.current) { setOk(false); return; }
    const map = L.map(elRef.current, { zoomControl: true, maxZoom: MAX_Z }).setView(DEFAULT_CENTER, 13);
    addBaseLayers(map, "bottomright");
    layerRef.current = L.layerGroup().addTo(map);
    map.on("click", (e) => pickRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map; setTimeout(() => { map.invalidateSize(); fit(); }, 200);
    return () => map.remove();
  }, []);
  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current; if (!map || !layer) return;
    layer.clearLayers();
    homes.forEach((x) => {
      L.marker([x.lat, x.lng], { interactive: false, keyboard: false, icon: L.divIcon({ className: "", iconSize: [0, 0], iconAnchor: [0, 0],
        html: `<span class="home-pin" style="--c:${rColor(x.name)}"><i>⌂</i>${x.name} · ${x.label}</span>` }) }).addTo(layer);
    });
    records.forEach((r) => {
      const act = M.activity(r.weather.ppfd), sel = r.id === selectedId;
      const icon = L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 15],
        html: `<span class="pin pin-${act.key} pin-${r.mode}${sel ? " pin-sel" : ""}${r.sample ? " pin-sample" : ""}" style="--rc:${rColor(r.researcher)}"><i></i><b></b></span>` });
      const m = L.marker([r.lat, r.lng], { icon, title: `${MODES[r.mode].label} · ${r.koreanName || "미동정"} · ${act.label}` });
      m.on("click", (e) => { L.DomEvent.stopPropagation(e); onSelect(r.id); });
      m.addTo(layer);
    });
  }, [records, homes, selectedId, onSelect]);
  useEffect(() => { fit(); }, [records.length, homes.length]);
  useEffect(() => {
    const map = mapRef.current; if (!map || !gpsPos) return;
    const ll = [gpsPos.lat, gpsPos.lng];
    if (!meRef.current) { meRef.current = L.marker(ll, { interactive: false, icon: L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: '<span class="me"><i></i></span>' }) }).addTo(map); }
    else meRef.current.setLatLng(ll);
    if (follow) map.panTo(ll, { animate: true });
  }, [gpsPos, follow]);
  const goMe = () => { const map = mapRef.current; if (map && gpsPos) map.setView([gpsPos.lat, gpsPos.lng], 18); setFollow(!follow); };
  return html`<div class="relative">
    <div ref=${elRef} class="mapbox" role="application" aria-label="광합성 지도. 지도를 누르면 그 자리에 새 기록을 만들어요."></div>
    ${!ok && html`<div class="absolute inset-0 grid place-items-center text-mist text-sm p-6 text-center">지도를 불러오지 못했어요. 인터넷 연결을 확인하세요.</div>`}
    <div class="map-tools">
      <button type="button" class=${"tool " + (follow ? "tool-on" : "")} onClick=${goMe} aria-pressed=${follow}><${Icon} name="LocateFixed" size=${16} /><span>${follow ? "따라가는 중" : "내 위치"}</span></button>
      <button type="button" class="tool" onClick=${fit}><${Icon} name="Maximize2" size=${16} /><span>전체 보기</span></button>
    </div>
    <div class="legend">
      ${RESEARCHERS.map((r) => html`<span key=${r.name} class="flex items-center gap-1"><${Dot} color=${r.color} size=${10} />${r.name}</span>`)}
      <span class="text-mist">● 따로 ■ 같이 · 빨리 깜빡일수록 광합성 활발</span>
    </div>
  </div>`;
}

function MapView({ records, gps, follow, setFollow, onMapPick, onOpen, openId }) {
  const [fMode, setFMode] = useState("all"), [fWho, setFWho] = useState("all"), [fForm, setFForm] = useState("all"), [sort, setSort] = useState("carbon");
  const filtered = useMemo(() => {
    const a = records.filter((r) => (fMode === "all" || r.mode === fMode) && (fWho === "all" || r.researcher === fWho) && (fForm === "all" || r.growthForm === fForm));
    return [...a].sort(sort === "carbon" ? (x, y) => (y.model.gco2 || 0) - (x.model.gco2 || 0) : (x, y) => y.ts - x.ts);
  }, [records, fMode, fWho, fForm, sort]);
  const homes = useMemo(() => fMode === "team" ? [] : RESEARCHERS.filter((r) => fWho === "all" || r.name === fWho).map((r) => ({ name: r.name, ...getHome(r.name) })), [fMode, fWho]);
  const sumG = filtered.reduce((s, r) => s + (r.model.gco2 || 0), 0);
  return html`<div class="grid gap-3">
    <div class="glass p-3 grid gap-2">
      <div class="seg3" role="group" aria-label="따로 또 같이 보기">
        ${[["all", "모두"], ["solo", "따로 · 우리 동네"], ["team", "같이 · 학교"]].map(([k, l]) => html`<button key=${k} type="button"
          class=${"seg3-b" + (fMode === k ? " on" : "") + " s-" + k} onClick=${() => setFMode(k)}>${l}</button>`)}
      </div>
      <div class="flex flex-wrap gap-1.5 items-center"><span class="lbl mr-1 mb-0">연구원</span>
        <${Chip} on=${fWho === "all"} onClick=${() => setFWho("all")}>전체</${Chip}>
        ${RESEARCHERS.map((r) => html`<${Chip} key=${r.name} on=${fWho === r.name} color=${r.color} onClick=${() => setFWho(r.name)}><${Dot} color=${fWho === r.name ? "#fff" : r.color} size=${6} />${r.name}</${Chip}>`)}</div>
      <div class="flex flex-wrap gap-1.5 items-center"><span class="lbl mr-1 mb-0">군락</span>
        <${Chip} on=${fForm === "all"} onClick=${() => setFForm("all")}>전체</${Chip}>
        ${FORM_LIST.map((g) => html`<${Chip} key=${g} on=${fForm === g} onClick=${() => setFForm(g)}>${g}</${Chip}>`)}</div>
    </div>
    <${MapPanel} records=${filtered} homes=${homes} selectedId=${openId} onSelect=${onOpen} onMapPick=${onMapPick} gpsPos=${gps} follow=${follow} setFollow=${setFollow} />
    <p class="text-[12px] text-mist -mt-1">⌂는 각자의 우리 동네, 동그라미는 따로·네모는 같이 기록이에요. 왼쪽 위 겹 버튼으로 위성사진·일반 지도를 바꿀 수 있고, 지도를 누르면 그 자리에 새 기록을 만들어요.</p>
    <section class="glass p-3 grid gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-display text-[17px] text-snow">${filtered.length}곳 · 탄소 고정 합계 <span class="mono text-photon">${fix(sumG, 1)}</span> <small class="text-mist text-[12px]">g/h·m²</small></span>
        <button type="button" class="link-btn ml-auto" onClick=${() => setSort(sort === "carbon" ? "recent" : "carbon")}>
          <${Icon} name="ArrowDownWideNarrow" size=${14} />${sort === "carbon" ? "탄소 고정 높은 순" : "최신 순"}</button>
      </div>
      <div class="rank">
        ${filtered.slice(0, 40).map((r, i) => { const act = M.activity(r.weather.ppfd); return html`<button key=${r.id} type="button" class="rank-row" onClick=${() => onOpen(r.id)}>
          <span class="mono rank-i">${i + 1}</span>
          ${r.photo ? html`<img src=${r.photo} alt="" />` : html`<span class="rank-ph"><${Icon} name="Leaf" size=${16} /></span>`}
          <span class="min-w-0 flex-1 text-left"><b>${r.koreanName || "미동정"}</b><small><${ModeTag} mode=${r.mode} small=${true} /> ${r.researcher} · ${r.place || MODES[r.mode].place}</small></span>
          <span class="text-right"><b class="mono">${fix(r.model.gco2, 2)}</b><small style=${{ color: ACT_COLOR[act.key] }}>PAR ${r.weather.par}</small></span>
        </button>`; })}
        ${!filtered.length && html`<div class="empty-note">조건에 맞는 기록이 없어요.</div>`}
      </div>
    </section>
  </div>`;
}

/* ---------- 아카이브 ---------- */
function VideoMaker({ records, onClose }) {
  const withPhoto = records.filter((r) => r.photo);
  const [scope, setScope] = useState("all");
  const [per, setPer] = useState(2.2);
  const [state, setState] = useState("idle"), [prog, setProg] = useState(0), [err, setErr] = useState("");
  const [out, setOut] = useState(null);
  const group = (r) => r.kind === "activity" || r.kind === "meeting";
  const inScope = (r, k) => k === "all" || (k === "activity" ? group(r) : !group(r) && r.mode === k);
  const list = withPhoto.filter((r) => inScope(r, scope)).slice().sort((a, b) => a.ts - b.ts);
  const secs = Math.round(2.6 + list.length * per + 3.6);
  useEffect(() => () => { if (out) URL.revokeObjectURL(out.url); }, [out]);
  const run = async () => {
    setState("rec"); setErr(""); setProg(0); if (out) { URL.revokeObjectURL(out.url); setOut(null); }
    try {
      const title = scope === "solo" ? "따로 · 우리 동네" : scope === "team" ? "같이 · 학교 식물" : scope === "activity" ? "우리의 활동" : "따로 또 같이";
      const r = await EM.makeVideo(list.map((x) => ({ ...x })), { per, title, onProgress: setProg });
      setOut({ ...r, url: URL.createObjectURL(r.blob), name: `에코쌤즈_${title.replace(/[ ·]+/g, "_")}_${today()}.${r.ext}` }); setState("done");
    } catch (e) { setErr(e.message || String(e)); setState("error"); }
  };
  return html`<div class="modal-bg" onClick=${state === "rec" ? null : onClose}>
    <div class="modal max-w-lg" role="dialog" aria-modal="true" aria-label="아카이브 영상 만들기" onClick=${(e) => e.stopPropagation()}>
      <div class="flex items-center gap-2 mb-3"><${Icon} name="Clapperboard" size=${20} className="text-photon" />
        <h2 class="font-display text-[20px] text-snow">한 번에 영상 만들기</h2>
        ${state !== "rec" && html`<button type="button" class="icon-btn ml-auto" onClick=${onClose} aria-label="닫기"><${Icon} name="X" size=${18} /></button>`}</div>
      ${state !== "done" ? html`<div class="grid gap-3">
        <div class="seg3">${[["all", "모두"], ["solo", "따로"], ["team", "같이"], ["activity", "활동·협의"]].map(([k, l]) => html`<button key=${k} type="button" disabled=${state === "rec"}
          class=${"seg3-b" + (scope === k ? " on" : "") + " s-" + k} onClick=${() => setScope(k)}>${l} ${withPhoto.filter((r) => inScope(r, k)).length}</button>`)}</div>
        <label class="fld"><span>사진 한 장당 ${per.toFixed(1)}초</span>
          <input id="perIn" type="range" min="1.2" max="4" step="0.2" value=${per} disabled=${state === "rec"} onInput=${(e) => setPer(Number(e.target.value))} /></label>
        <p class="text-[13px] text-mist">세로 영상(720×1280)으로 만들어요. 여는 장면 → 사진 ${list.length}장 → 우리 기록 요약 순서이고, 약 ${secs}초 걸려요. 만드는 동안 이 화면을 켜 두세요.</p>
        ${state === "rec" && html`<div class="grid gap-1.5"><div class="bar"><i style=${{ width: Math.round(prog * 100) + "%" }}></i></div>
          <span class="text-[12px] text-mist mono">${Math.round(prog * 100)}% · 녹화 중</span></div>`}
        ${state === "error" && html`<div class="err">${err}</div>`}
        <button type="button" class="btn-save" disabled=${!list.length || state === "rec"} onClick=${run}>
          <${Icon} name=${state === "rec" ? "Loader2" : "Film"} size=${18} className=${state === "rec" ? "animate-spin" : ""} />
          ${state === "rec" ? "영상 만드는 중…" : list.length ? `사진 ${list.length}장으로 영상 만들기` : "사진이 있는 기록이 필요해요"}</button>
      </div>` : html`<div class="grid gap-3">
        <video src=${out.url} controls playsInline class="w-full rounded-xl border-2 border-[#2FA463] bg-black max-h-[60vh]"></video>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn-save" onClick=${() => { const f = new File([out.blob], out.name, { type: out.blob.type });
            if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch((e) => { if (!e || e.name !== "AbortError") saveFile(out.name, out.blob); }); else saveFile(out.name, out.blob); }}>
            <${Icon} name="Download" size=${17} />앨범에 저장</button>
          <button type="button" class="btn-primary" onClick=${async () => { if (!(await shareFile(out.name, out.blob))) saveFile(out.name, out.blob); }}><${Icon} name="Share2" size=${17} />공유</button>
        </div>
        <p class="text-[12px] text-mist">${out.ext === "webm" ? "WebM 형식이에요. 카카오톡·유튜브에는 그대로 올라가요. 한글·PPT에 넣으려면 MP4로 변환하세요." : "MP4 형식이라 휴대폰·PPT에서 바로 열려요."} · ${out.seconds}초</p>
        <button type="button" class="btn-ghost justify-center" onClick=${() => setState("idle")}>다시 만들기</button>
      </div>`}
    </div>
  </div>`;
}

function SyncCard({ sync, onSync }) {
  const st = sync.state;
  const label = st === "ok" ? "팀 공용 저장소와 맞춰졌어요" : st === "syncing" ? "맞추는 중…" : st === "offline" ? "인터넷이 끊겨 있어요 · 이 휴대폰에 먼저 저장돼요" : st === "error" ? "저장소 연결이 잠시 안 돼요 · 이 휴대폰에 먼저 저장돼요" : "준비 중";
  return html`<div class=${"sync-card s-" + st}>
    <${Icon} name=${st === "ok" ? "Cloud" : st === "syncing" ? "RefreshCw" : "CloudOff"} size=${18} className=${st === "syncing" ? "animate-spin" : ""} />
    <span class="flex-1 min-w-0"><b>${label}</b><small>${sync.at ? `마지막 확인 ${fmtDate(sync.at)}` : ""}${st === "ok" && (sync.up || sync.got) ? ` · 올림 ${sync.up || 0} · 받음 ${sync.got || 0}` : ""}${sync.msg ? ` · ${sync.msg}` : ""}</small></span>
    <button type="button" class="mini-btn" onClick=${onSync} disabled=${st === "syncing"}><${Icon} name="RefreshCw" size=${13} />지금 맞추기</button>
  </div>`;
}
function ArchiveView({ records, acts, meetings, onOpen, onOpenAct, onOpenMeeting, onClearSamples, onImport, sync, onSync }) {
  const [video, setVideo] = useState(false);
  const [zipState, setZipState] = useState(""), [zipErr, setZipErr] = useState("");
  const fileRef = useRef(null);
  const real = records.filter((r) => !r.sample);
  const nPhotos = real.filter((r) => r.photo).length + acts.filter((a) => a.photo).length + meetings.reduce((k, m) => k + (m.photos || []).length, 0);
  const getAll = async () => {
    setZipErr(""); setZipState("사진 모으는 중…");
    try { const blob = await buildAllZip({ records, acts, meetings }, setZipState); saveFile(`에코쌤즈_자료묶음_${today()}.zip`, blob); setZipState(""); }
    catch (e) { setZipState(""); setZipErr(e.message || "자료 묶음을 만들지 못했어요."); }
  };
  const all = useMemo(() => records.concat(acts, meetingPhotos(meetings)).sort((a, b) => b.ts - a.ts), [records, acts, meetings]);
  const photos = all.filter((r) => r.photo);
  const byDay = useMemo(() => {
    const m = new Map(); all.forEach((r) => { const d = fmtDay(r.ts); if (!m.has(d)) m.set(d, []); m.get(d).push(r); });
    return [...m.entries()];
  }, [all]);
  const samples = records.length - real.length;
  return html`<div class="grid gap-4">
    <button type="button" class="reel" onClick=${() => setVideo(true)}>
      <span class="reel-holes" aria-hidden="true"></span>
      <span class="reel-body"><${Icon} name="Clapperboard" size=${30} /><span class="flex-1 min-w-0"><b>한 번에 영상 만들기</b><small>식물·활동·협의회 사진 ${photos.length}장을 팀 프레임 그대로 세로 영상으로</small></span>
        <${Icon} name="ChevronRight" size=${22} /></span>
      <span class="reel-holes" aria-hidden="true"></span>
    </button>
    <section class="glass p-4 grid gap-3">
      <div class="flex items-center gap-2 flex-wrap"><h2 class="pill-h"><${Icon} name="Images" size=${17} />날짜별 사진첩</h2>
        <span class="text-[12px] text-mist">모든 사진에 팀 이름·날짜 도장이 찍혀 있어요</span></div>
      ${byDay.length ? byDay.map(([d, list]) => html`<div key=${d} class="grid gap-2">
          <div class="day-h"><span class="mono">${d}</span><small>따로 ${list.filter((r) => r.mode === "solo").length} · 같이 ${list.filter((r) => r.mode === "team").length} · 활동 ${list.filter((r) => r.kind === "activity").length} · 협의 ${list.filter((r) => r.kind === "meeting").length}</small></div>
          <div class="prints prints-s">${list.map((r, i) => (r.kind === "activity" || r.kind === "meeting")
            ? html`<button key=${r.id} type="button" class="print" style=${{ "--tilt": `${i % 2 ? 1.5 : -1.5}deg` }} onClick=${() => r.kind === "meeting" ? onOpenMeeting(r._meeting) : onOpenAct(r)} aria-label=${`${r.title || "활동"} 사진 열기`}><img src=${r.photo} alt="" loading="lazy" /></button>`
            : html`<${Print} key=${r.id} rec=${r} onOpen=${onOpen} tilt=${i % 2 ? 1.5 : -1.5} />`)}</div>
        </div>`) : html`<div class="empty-note">아직 사진이 없어요.</div>`}
    </section>
    <section class="glass p-4 grid gap-3">
      <h2 class="pill-h justify-self-start"><${Icon} name="Download" size=${17} />보고서용 데이터</h2>
      ${sync && html`<${SyncCard} sync=${sync} onSync=${onSync} />`}
      <button type="button" class="all-in-one" onClick=${getAll} disabled=${!!zipState || (!real.length && !acts.length && !meetings.length)}>
        <span class="aio-ic"><${Icon} name=${zipState ? "Loader2" : "PackageOpen"} size=${28} className=${zipState ? "animate-spin" : ""} /></span>
        <span class="flex-1 min-w-0"><b>${zipState || "자료 한 번에 받기 (ZIP)"}</b>
          <small>사진 ${nPhotos}장(선생님별·같이·활동·협의회 폴더) + 메모·AI 조언 기록표 + 한글 협의록 + 지도 데이터 + 백업</small></span>
      </button>
      ${zipErr && html`<div class="err">${zipErr}</div>`}
      <button type="button" class="exp" disabled=${!photos.length} onClick=${() => openSaver(photos.map((r) => ({ url: r.photo,
          name: `에코쌤즈_${ymd(r.ts)}_${hm(r.ts)}_${safeName(r.kind === "meeting" ? "협의회" : r.kind === "activity" ? (r.title || "활동") : (r.koreanName || "식물"))}.jpg` })), "사진 전체 앨범에 저장")}>
        <${Icon} name="ImageDown" size=${20} className="text-photon" /><span><b>사진 ${photos.length}장 휴대폰 앨범에 저장</b><small>프레임·날짜 도장 그대로 · 10장씩 나눠 저장</small></span></button>
      <p class="text-[12px] text-mist leading-relaxed">네 선생님 기록이 팀 공용 저장소로 모여 있어서, 누구 휴대폰에서 눌러도 팀 전체 자료가 묶여요.</p>
      <div class="grid sm:grid-cols-2 gap-2">
        <button type="button" class="exp" disabled=${!real.length} onClick=${() => saveFile(`에코쌤즈_광합성지도_${today()}.csv`, toCSV(real), "text/csv;charset=utf-8")}>
          <${Icon} name="FileSpreadsheet" size=${20} className="text-photon" /><span><b>CSV</b><small>엑셀 분석 · 실천모임 결과 보고서</small></span></button>
        <button type="button" class="exp" disabled=${!meetings.length} onClick=${() => saveFile(`에코쌤즈_협의회록_${today()}.csv`, meetingsCSV(meetings), "text/csv;charset=utf-8")}>
          <${Icon} name="NotebookPen" size=${20} className="text-photon" /><span><b>협의회록 (CSV)</b><small>날짜·장소·멤버·협의 내용·결정 사항</small></span></button>
        <button type="button" class="exp" disabled=${!real.length} onClick=${() => saveFile(`에코쌤즈_광합성지도_${today()}.geojson`, toGeoJSON(real), "application/geo+json")}>
          <${Icon} name="Globe" size=${20} className="text-photon" /><span><b>GeoJSON</b><small>QGIS · 구글 어스용 좌표</small></span></button>
        <button type="button" class="exp" disabled=${!real.length && !acts.length && !meetings.length} onClick=${() => saveFile(`에코쌤즈_백업_${today()}.json`, JSON.stringify(real.map(({ raw, ...r }) => r).concat(acts.map(({ raw, ...a }) => a), meetings.map((m) => ({ ...m, photos: (m.photos || []).map((ph) => ({ photo: ph.photo })) })))), "application/json")}>
          <${Icon} name="HardDriveDownload" size=${20} className="text-photon" /><span><b>내 기록 보내기 (JSON)</b><small>식물 기록 + 활동 사진 + 협의록 · 팀원에게 공유</small></span></button>
        <button type="button" class="exp" onClick=${() => fileRef.current.click()}>
          <${Icon} name="Merge" size=${20} className="text-photon" /><span><b>팀원 기록 합치기</b><small>받은 JSON을 넣으면 내 지도에 합쳐져요</small></span></button>
        <input ref=${fileRef} id="impIn" type="file" accept=".json,application/json" class="hidden" onChange=${(e) => { const f = e.target.files && e.target.files[0]; if (f) onImport(f); e.target.value = ""; }} />
      </div>
      <p class="text-[12px] text-mist">기록은 이 휴대폰에 저장돼요. 모임 날 각자 ‘내 기록 보내기’를 단톡방에 올리고, 한 사람이 ‘합치기’하면 팀 전체 지도·영상이 완성돼요.</p>
      ${samples > 0 && html`<button type="button" class="link-btn text-amber justify-self-start" onClick=${onClearSamples}><${Icon} name="Eraser" size=${14} />예시 ${samples}건 지우기</button>`}
    </section>
    ${video && html`<${VideoMaker} records=${all} onClose=${() => setVideo(false)} />`}
  </div>`;
}

/* ---------- 분석 인포그래픽 카드 ---------- */
function AnalysisCard({ rec }) {
  const ai = rec.ai, est = rec.model, w = rec.weather, act = M.activity(w.ppfd), P = M.PS_TYPES[rec.psType] || M.PS_TYPES.C3;
  const tax = ai && ai.taxonomy, morph = ai && ai.morphology, eco = ai && ai.ecologicalInsight;
  const maxG = rec.psType === "C4" ? 4 : 3;
  return html`<div class="grid gap-3">
    <div class="min-w-0">
      <div class="flex items-center gap-2 flex-wrap">
        <h3 class="text-[22px] font-display text-snow leading-tight">${rec.koreanName || "미동정 식물"}</h3>
        <${ModeTag} mode=${rec.mode} />
        <span class="badge" style=${{ color: "#fff", background: "#2FA463", borderColor: "#2FA463" }}>${P.label}</span>
        <span class="badge">${rec.growthForm}</span>
        ${rec.sample && html`<span class="badge text-amber" style=${{ borderColor: "#D98E04" }}>예시</span>`}
      </div>
      ${rec.scientificName && html`<div class="italic text-mist mt-0.5">${rec.scientificName}</div>`}
      ${rec.confidence != null && html`<div class="mt-2 flex items-center gap-2 text-[12px] text-mist">
        <span>동정 신뢰도</span><div class="bar flex-1 max-w-[180px]"><i style=${{ width: rec.confidence + "%" }}></i></div>
        <span class="mono text-snow">${rec.confidence}%</span></div>`}
    </div>
    ${tax && html`<div class="flex flex-wrap items-center gap-1 text-[12px]">
      ${[["계", tax.kingdom], ["문", tax.phylum], ["강", tax.class], ["목", tax.order], ["과", tax.family], ["속", tax.genus]]
        .filter(([, v]) => v).map(([k, v], i, a) => html`<span key=${k} class="flex items-center gap-1">
          <span class="tax"><b>${k}</b>${v}</span>${i < a.length - 1 && html`<${Icon} name="ChevronRight" size=${12} className="text-mist" />`}</span>`)}
    </div>`}
    <div class="carbon">
      <div class="flex items-center gap-2 text-[12px] text-mist"><${Icon} name="Atom" size=${14} />탄소 고정 잠재량 (모델 추정)</div>
      <div class="flex items-end gap-2 mt-1 flex-wrap">
        <span class="mono text-[34px] leading-none text-photon">${fix(est.gco2, 2)}</span>
        <span class="text-mist text-[13px] pb-1">g CO₂ / h·m² (지면)</span>
      </div>
      <div class="bar mt-3"><i style=${{ width: Math.min(100, (est.gco2 / maxG) * 100) + "%" }}></i></div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[12px]">
        <div><div class="text-mist">잎 순광합성</div><div class="mono text-snow">${fix(est.aLeaf, 1)} <small class="text-mist">µmol/m²/s</small></div></div>
        <div><div class="text-mist">PPFD</div><div class="mono text-snow">${w.ppfd} <small class="text-mist">· ${act.label}</small></div></div>
        <div><div class="text-mist">엽면적지수 LAI</div><div class="mono text-snow">${fix(est.lai, 1)}</div></div>
        <div><div class="text-mist">온도·건조 보정</div><div class="mono text-snow">×${fix(est.fT, 2)} · ×${fix(est.fVPD, 2)}</div></div>
      </div>
      ${ai && ai.carbonFixationEst && ai.carbonFixationEst.comment && html`<p class="text-[13px] text-snow/90 mt-3 leading-relaxed">${ai.carbonFixationEst.comment}</p>`}
      <details class="mt-2 text-[12px] text-mist"><summary class="cursor-pointer">계산식 보기</summary>
        <div class="mono leading-relaxed mt-2">PPFD = 일사량 ${fix(w.sw, 0)} × 0.45 × 4.57 = ${w.ppfd}<br/>
        A = αI·Amax/(αI+Amax) × f(T) × f(VPD) − Rd<br/>  (${P.label}: α ${P.alpha}, Amax ${est.amax}, 최적 ${P.topt}℃, VPD ${fix(est.vpd, 2)} kPa)<br/>
        군락 = A × (1−e^(−0.5·LAI))/0.5 = ${fix(est.aCanopy, 2)} µmol/m²/s<br/>g CO₂/h·m² = 군락 A × 0.1584</div>
        <p class="mt-2">대표 계수를 쓴 추정치예요. 수업에서는 ‘조건 비교’ 용도로 쓰세요.</p>
      </details>
    </div>
    ${morph && html`<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      ${[["엽서", morph.phyllotaxy, "Network"], ["엽맥", morph.venation, "GitBranch"], ["큐티클", morph.cuticle, "Shield"], ["기공", morph.stomata, "ScanLine"]]
        .filter(([, v]) => v).map(([k, v, ic]) => html`<div key=${k} class="stat">
          <div class="flex items-center gap-1.5 text-[12px] text-mist"><${Icon} name=${ic} size=${13} />${k}</div>
          <div class="text-[13px] text-snow mt-1 leading-snug">${v}</div></div>`)}
    </div>`}
    ${eco && html`<div class="insight">
      <div class="flex items-center gap-2 text-[12px]"><${Icon} name="Thermometer" size=${14} className=${eco.climateIndicator ? "text-amber" : "text-mist"} />
        <span class=${eco.climateIndicator ? "text-amber" : "text-mist"}>${eco.climateIndicator ? "기후변화 지표종" : "기후변화 지표종 아님"}</span></div>
      ${eco.note && html`<p class="text-[13px] text-snow mt-1.5 leading-relaxed">${eco.note}</p>`}
      ${eco.classroom && html`<p class="text-[13px] text-photon mt-1.5 leading-relaxed"><b class="font-semibold">수업 연계 · </b>${eco.classroom}</p>`}
    </div>`}
  </div>`;
}

/* ---------- 새 기록 ---------- */
function startPos(mode, me, gps, picked) {
  if (picked) return picked;
  if (mode === "solo") { const hm = getHome(me); return { lat: hm.lat, lng: hm.lng, accuracy: null, source: "home" }; }
  return gps ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, source: "gps" } : null;
}
function RecordModal({ draft, researcher, weather, settings, gps, onClose, onSave, onOpenSettings }) {
  const [mode, setModeS] = useState(draft.mode || "team");
  const [pos, setPos] = useState(() => startPos(draft.mode || "team", researcher, gps, draft.pos));
  const [raw, setRaw] = useState(null);
  const [framed, setFramed] = useState(null);
  const [ai, setAi] = useState(null), [aiState, setAiState] = useState("idle"), [aiErr, setAiErr] = useState("");
  const [saving, setSaving] = useState(false);
  const home = getHome(researcher);
  const [f, setF] = useState({ koreanName: "", scientificName: "", growthForm: "초본", psType: "C3", lai: "", notes: "", place: (draft.mode === "solo") ? home.label : "" });
  const camRef = useRef(null), galRef = useRef(null);
  const [shotTs, setShotTs] = useState(Date.now());
  const [pastWx, setPastWx] = useState(null), [album, setAlbum] = useState(null);
  const [reading, setReading] = useState(false), [photoErr, setPhotoErr] = useState(""); // album: {ts, gps:bool, wx:"loading"|"ok"|"fail"|"now"}
  const w = pastWx || weather || { temp: null, rh: null, cloud: null, sw: 0, ppfd: 0, par: 0 };
  const m = MODES[mode];
  const est = useMemo(() => M.estimate({ sw: w.sw, temp: w.temp, rh: w.rh, psType: f.psType, growthForm: f.growthForm,
    lai: f.lai === "" ? undefined : Number(f.lai) }), [w, f.psType, f.growthForm, f.lai]);
  const meta = { mode, researcher, ts: shotTs, name: f.koreanName.trim(), sci: f.scientificName.trim(), place: f.place.trim() || m.place };
  const setMode = (k) => {
    setModeS(k);
    if (!draft.pos) setPos(startPos(k, researcher, gps, null));
    setF((q) => ({ ...q, place: k === "solo" ? (q.place && q.place !== "" && q.place !== MODES.team.place ? q.place : home.label) : (q.place === home.label ? "" : q.place) }));
  };
  useEffect(() => { if (!pos && gps && mode === "team") setPos({ lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, source: "gps" }); }, [gps]);
  useEffect(() => {
    if (!raw) { setFramed(null); return; }
    let live = true; const t = setTimeout(() => { EM.composeFrame(raw, meta).then((d) => { if (live) setFramed(d); }, () => {}); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [raw, mode, meta.name, meta.sci, meta.place, shotTs]);

  const onFile = async (e, fromAlbum) => {
    const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
    try {
      setAi(null); setAiState("idle"); setPastWx(null); setAlbum(null); setPhotoErr(""); setReading(true);
      if (!fromAlbum) { setShotTs(Date.now()); setRaw(await resizeImage(file, 1280, 0.86)); setReading(false); return; }
      // 앨범 사진: 찍은 시각·위치를 사진에서 읽고, 그때 날씨로 계산
      const info = await EM.exifInfo(file);
      const ts = info.ts || file.lastModified || Date.now();
      setShotTs(ts);
      const hasGps = info.lat != null;
      let at = pos;
      if (hasGps) { at = { lat: info.lat, lng: info.lng, accuracy: null, source: "photo" }; setPos(at); }
      setRaw(await resizeImage(file, 1280, 0.86)); setReading(false);
      setAlbum({ ts, gps: hasGps, exif: !!info.ts });
    } catch (er) { setReading(false); setPhotoErr(`이 사진을 읽지 못했어요 (${(file.type || file.name || "알 수 없는 형식").slice(0, 30)}). 다른 사진을 고르거나 '촬영'으로 찍어 주세요. 카카오톡 안에서 열었다면 ⋯ → 다른 브라우저로 열어 보세요.`); }
  };
  // 관찰 시각이 지난 시각이면(앨범 사진·날짜 고침) 그 자리·그 시각 날씨로 계산
  const [wxState, setWxState] = useState("now"); // now | loading | ok | fail
  useEffect(() => {
    const old = Date.now() - shotTs > 30 * 60 * 1000;
    if (!old) { setPastWx(null); setWxState("now"); return; }
    const q = pos || (gps ? { lat: gps.lat, lng: gps.lng } : { lat: home.lat, lng: home.lng });
    let live = true; setWxState("loading");
    const t = setTimeout(() => fetchWeatherAt(q.lat, q.lng, shotTs).then((x) => { if (live) { setPastWx(x); setWxState("ok"); } },
      () => { if (live) { setPastWx(null); setWxState("fail"); } }), 400);
    return () => { live = false; clearTimeout(t); };
  }, [shotTs, pos && Math.round(pos.lat * 100), pos && Math.round(pos.lng * 100)]);
  const p = pos || { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1], source: "default", accuracy: null };
  const runAI = async () => {
    if (!aiReady(settings)) { onOpenSettings(); return; }
    setAiState("loading"); setAiErr("");
    try {
      const o = await analyzePlant({ settings, dataUrl: raw, weather: w, lat: p.lat, lng: p.lng, mode });
      setAi(o); setAiState("ok");
      setF((q) => ({ ...q, koreanName: o.koreanName || q.koreanName, scientificName: o.scientificName || q.scientificName, growthForm: o.growthForm, psType: o.photosynthesisType,
        lai: o.carbonFixationEst && Number(o.carbonFixationEst.laiEstimate) > 0 ? String(M.clamp(Number(o.carbonFixationEst.laiEstimate), 0.1, 10)) : q.lai }));
    } catch (er) { setAiState("error"); setAiErr(er.message || String(er)); }
  };
  const preview = { id: "draft", ts: shotTs, mode, researcher, lat: p.lat, lng: p.lng, ai, weather: w, model: est,
    koreanName: f.koreanName, scientificName: f.scientificName, confidence: ai ? ai.confidence : null, growthForm: f.growthForm, psType: f.psType };
  const canSave = !!(f.koreanName.trim() || raw) && !saving;
  const save = async () => {
    setSaving(true);
    let photo = null;
    if (raw) { try { photo = await EM.composeFrame(raw, meta); } catch (e) { photo = raw; } }
    onSave({ ...preview, id: uid(), photo, raw: raw || undefined, place: meta.place, accuracy: p.accuracy ?? null, source: p.source, lai: est.lai, notes: f.notes.trim(),
      weather: { temp: w.temp, rh: w.rh, cloud: w.cloud, sw: w.sw, ppfd: w.ppfd, par: w.par, ...(pastWx ? { past: true } : {}) }, ...(album ? { fromAlbum: true } : {}) });
  };
  const srcLabel = { gps: `내 위치(GPS) ±${Math.round(p.accuracy || 0)}m`, map: "지도에서 콕 찍은 자리", photo: "사진에 담긴 촬영 위치", home: `우리 동네 기본 위치 · ${home.label}`, default: "지도를 눌러 위치를 찍어 주세요" }[p.source];

  return html`<div class="modal-bg" onClick=${onClose}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="새 식물 기록" onClick=${(e) => e.stopPropagation()} style=${{ borderColor: m.color }}>
      <div class="flex items-center gap-2 mb-3">
        <div class="seg3 flex-1">
          ${["solo", "team"].map((k) => html`<button key=${k} type="button" class=${"seg3-b" + (mode === k ? " on" : "") + " s-" + k} onClick=${() => setMode(k)}>
            ${MODES[k].label} · ${k === "solo" ? "우리 동네" : "학교"}</button>`)}
        </div>
        <button type="button" class="icon-btn" onClick=${onClose} aria-label="닫기"><${Icon} name="X" size=${18} /></button>
      </div>
      <div class="grid gap-2">
        <${Label}>발견 위치 · 지도를 누르거나 핀을 끌어 콕 찍어요</${Label}>
        <${LocPicker} pos=${pos} onPick=${setPos} color=${rColor(researcher)} />
        <div class="loc-row">
          <span class="flex items-center gap-1.5 min-w-0 flex-wrap"><${Icon} name="MapPin" size=${15} /><span>${srcLabel}</span>
            <span class="mono text-mist text-[11px]">${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</span></span>
          <span class="flex gap-1.5 shrink-0">
            ${gps && html`<button type="button" class="mini-btn" onClick=${() => setPos({ lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, source: "gps" })}><${Icon} name="LocateFixed" size=${13} />내 위치</button>`}
            ${mode === "solo" && html`<button type="button" class="mini-btn" onClick=${() => setPos({ lat: home.lat, lng: home.lng, accuracy: null, source: "home" })}><${Icon} name="House" size=${13} />우리 동네</button>`}
          </span>
        </div>
        ${p.source === "gps" && p.accuracy > 8 && html`<p class="text-[12px] text-mist">GPS 오차가 약 ${Math.round(p.accuracy)}m예요. 지도를 크게 확대(위성으로 바꾸면 나무까지 보여요)해서 실제 자리를 다시 콕 찍으면 더 정확해요.</p>`}
      </div>
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-mist mb-4 mt-2">
        <span class="flex items-center gap-1"><${Dot} color=${rColor(researcher)} size=${8} />${researcher}</span>
        <span class="mono">${(pastWx || weather) ? `${pastWx ? "촬영 당시 " : ""}${fix(w.temp)}℃ · ${fix(w.sw, 0)} W/m² · PAR ${w.par}` : "기상 정보 없음"}</span>
      </div>
      <div class="grid gap-4">
        <div>
          ${raw ? html`<div class="frame-prev">
              ${framed ? html`<img src=${framed} alt="팀 프레임이 입혀진 사진 미리보기" />` : html`<div class="frame-wait">프레임 입히는 중…</div>`}
              <button type="button" class="icon-btn absolute top-2 right-2" onClick=${() => { setRaw(null); setAi(null); setAiState("idle"); }} aria-label="사진 지우기"><${Icon} name="Trash2" size=${16} /></button>
            </div>
            <p class="text-[12px] text-mist mt-1.5 text-center">저장하면 이 프레임 그대로 사진첩·영상에 남아요.</p>`
          : html`<div class="grid grid-cols-2 gap-2">
              <button type="button" class="drop" onClick=${() => camRef.current.click()} disabled=${reading}><${Icon} name="Camera" size=${24} />촬영</button>
              <button type="button" class="drop" onClick=${() => galRef.current.click()} disabled=${reading}><${Icon} name=${reading ? "Loader2" : "ImagePlus"} size=${24} className=${reading ? "animate-spin" : ""} />${reading ? "사진 읽는 중…" : "앨범에서 선택"}</button>
            </div>
            ${photoErr && html`<div class="err mt-2">${photoErr}</div>`}`}
          <input ref=${camRef} id="camIn" type="file" accept="image/*" capture="environment" class="hidden" onChange=${(e) => onFile(e, false)} />
          <input ref=${galRef} id="galIn" type="file" accept="image/*" class="hidden" onChange=${(e) => onFile(e, true)} />
          ${album && html`<div class="album-note">
            <${Icon} name="Images" size=${16} />
            <span><b>앨범 사진 · ${fmtDate(album.ts)} ${album.exif ? "촬영" : "(파일 날짜)"}</b>
              <small>${album.gps ? "사진에 담긴 위치로 핀을 옮겼어요." : "사진에 위치 정보가 없어요. 지도에서 찍은 자리를 콕 눌러 주세요."}
              ${wxState === "loading" ? " 그날 그 시각 날씨를 불러오는 중…" : wxState === "ok" ? " 빛·기온은 그날 그 시각 기록으로 계산해요." : wxState === "fail" ? " 그날 날씨 기록을 못 찾아 지금 날씨로 계산해요." : ""}</small></span>
          </div>`}
          ${raw && html`<label class="fld mt-3"><span>관찰 날짜·시각 · 틀리면 고쳐 주세요</span>
            <input id="fWhen" type="datetime-local" value=${toLocalInput(shotTs)} max=${toLocalInput(Date.now())}
              onInput=${(e) => { const v = fromLocalInput(e.target.value); if (v && v <= Date.now() + 60000) setShotTs(v); }} />
            ${!album && wxState !== "now" && html`<small class="text-[12px] text-mist">${wxState === "loading" ? "그 시각 날씨를 불러오는 중…" : wxState === "ok" ? "빛·기온을 그날 그 시각 기록으로 다시 계산했어요." : "그 시각 날씨 기록을 못 찾아 지금 날씨로 계산해요."}</small>`}
          </label>`}
          ${raw && html`<button type="button" class="btn-primary w-full mt-2" onClick=${runAI} disabled=${aiState === "loading"}>
            <${Icon} name=${aiState === "loading" ? "Loader2" : "ScanSearch"} size=${18} className=${aiState === "loading" ? "animate-spin" : ""} />
            ${aiState === "loading" ? "사진 속 식물 찾는 중…" : aiReady(settings) ? `AI로 종 찾기 (사진 + ${pastWx ? "그때" : "지금"} 빛)` : "AI 분석하려면 API 키 설정"}</button>`}
          ${aiState === "error" && html`<div class="err mt-2">${aiErr}</div>`}
          ${ai && aiState === "ok" && html`<div class="ai-pick">
            <div class="flex items-center gap-2 flex-wrap"><${Icon} name="Sparkles" size=${15} /><b>${ai.koreanName || "?"}</b>
              <span class="mono text-[12px]">${ai.confidence}%</span>${ai.family && html`<span class="text-[12px]">· ${ai.family}</span>`}
              ${ai.pnScore != null && html`<span class="pn-badge" title="Pl@ntNet 사진 유사도">사진 비교 ${ai.pnScore}%</span>`}</div>
            ${ai.note && html`<p class="text-[12.5px] leading-relaxed mt-1">${ai.note}</p>`}
            ${ai.candidates && ai.candidates.length ? html`<div class="mt-2 flex flex-wrap gap-1.5 items-center"><span class="text-[12px]">다른 후보:</span>
              ${ai.candidates.map((c) => html`<button key=${c.koreanName} type="button" class="cand" onClick=${() => setF((q) => ({ ...q, koreanName: c.koreanName, scientificName: c.scientificName || "" }))}>
                ${c.koreanName}${c.pnScore != null ? html` <small class="mono">사진 ${c.pnScore}%</small>` : c.confidence != null ? html` <small class="mono">${c.confidence}%</small>` : null}</button>`)}</div>` : null}
            <p class="text-[11px] mt-2 opacity-80">${ai.source === "plantnet+claude" ? "Pl@ntNet 사진 데이터 비교 + Claude 판단" : ai.source && ai.source.includes("실패") ? "Pl@ntNet 연결 실패 · Claude 단독 판단" : "Claude 판단"}</p>
          </div>`}
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <label class="fld"><span>국명</span><input id="fKor" value=${f.koreanName} onInput=${(e) => setF({ ...f, koreanName: e.target.value })} placeholder="예: 강아지풀" /></label>
          <label class="fld"><span>학명</span><input id="fSci" class="italic" value=${f.scientificName} onInput=${(e) => setF({ ...f, scientificName: e.target.value })} placeholder="예: Setaria viridis" /></label>
          <label class="fld sm:col-span-2"><span>장소 이름</span><input id="fPlace" value=${f.place} onInput=${(e) => setF({ ...f, place: e.target.value })}
            placeholder=${mode === "solo" ? `예: ${home.label} 앞 화단` : "예: 학교 정문 화단, 운동장 가장자리"} /></label>
        </div>
        <div class="grid sm:grid-cols-[1fr_1fr_110px] gap-3">
          <div><${Label}>생활형</${Label}><div class="flex flex-wrap gap-1.5">${FORM_LIST.map((g) => html`<${Chip} key=${g} on=${f.growthForm === g} onClick=${() => setF({ ...f, growthForm: g })}>${g}</${Chip}>`)}</div></div>
          <div><${Label}>광합성 유형</${Label}><div class="flex flex-wrap gap-1.5">${PS_LIST.map((q) => html`<${Chip} key=${q} on=${f.psType === q} onClick=${() => setF({ ...f, psType: q })}>${M.PS_TYPES[q].label}</${Chip}>`)}</div></div>
          <label class="fld"><span>LAI</span><input id="fLai" type="number" step="0.1" min="0.1" max="10" inputmode="decimal" value=${f.lai}
            placeholder=${String(M.FORMS[f.growthForm].lai)} onInput=${(e) => setF({ ...f, lai: e.target.value })} /></label>
        </div>
        <div class="glass-2 p-4"><${AnalysisCard} rec=${preview} /></div>
        <label class="fld"><span>현장 메모</span><textarea id="fNote" rows="2" value=${f.notes} onInput=${(e) => setF({ ...f, notes: e.target.value })} placeholder="군락 크기, 그늘 여부, 함께 본 생물 등"></textarea></label>
        <button type="button" class="btn-save" onClick=${save} disabled=${!canSave} style=${{ background: m.color, borderColor: m.deep, boxShadow: `0 4px 0 ${m.deep}` }}>
          <${Icon} name="Save" size=${18} />${saving ? "프레임 입혀 저장하는 중…" : `${m.label} 기록 저장`}</button>
        ${!canSave && !saving && html`<p class="text-[12px] text-mist -mt-2 text-center">사진을 넣거나 국명을 적으면 저장할 수 있어요.</p>`}
      </div>
    </div>
  </div>`;
}

/* ---------- 상세 ---------- */
function DetailModal({ rec, me, onClose, onDelete, onUpdate }) {
  const [ask, setAsk] = useState(false);
  const [editWhen, setEditWhen] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const mine = rec.researcher === me || rec.sample;
  const saveWhen = async () => {
    const ts = fromLocalInput(editWhen); if (!ts || ts > Date.now() + 60000) { setErr("날짜를 다시 확인해 주세요."); return; }
    setBusy(true); setErr("");
    try {
      let weather = rec.weather, model = rec.model, note = "";
      try {
        const x = await fetchWeatherAt(rec.lat, rec.lng, ts);
        weather = { temp: x.temp, rh: x.rh, cloud: x.cloud, sw: x.sw, ppfd: x.ppfd, par: x.par, past: true };
        model = M.estimate({ sw: x.sw, temp: x.temp, rh: x.rh, psType: rec.psType, growthForm: rec.growthForm, lai: rec.lai });
      } catch (e) { note = " (그 시각 날씨 기록이 없어 빛·기온은 그대로)"; }
      let photo = rec.photo;
      if (rec.raw) { try { photo = await EM.composeFrame(rec.raw, { mode: rec.mode, researcher: rec.researcher, ts, name: rec.koreanName || "", sci: rec.scientificName || "", place: rec.place || MODES[rec.mode].place }); } catch (e) {} }
      await onUpdate({ ...rec, ts, weather, model, photo }, `날짜를 고쳤어요${note}${rec.raw || !rec.photo ? "" : " · 사진 속 날짜 도장은 예전 그대로예요"}`);
      setEditWhen(null);
    } catch (e) { setErr("저장하지 못했어요."); }
    setBusy(false);
  };
  return html`<div class="modal-bg" onClick=${onClose}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="기록 상세" onClick=${(e) => e.stopPropagation()}>
      <div class="flex items-center gap-2 mb-3 text-[12px] text-mist flex-wrap">
        <${ModeTag} mode=${rec.mode} /><${Dot} color=${rColor(rec.researcher)} size=${8} /><span>${rec.researcher}</span><span>· ${fmtDate(rec.ts)}</span>
        ${mine && editWhen == null && html`<button type="button" class="link-btn" onClick=${() => setEditWhen(toLocalInput(rec.ts))}><${Icon} name="CalendarClock" size=${13} />날짜 고치기</button>`}<span>· ${rec.place || MODES[rec.mode].place}</span>
        <button type="button" class="icon-btn ml-auto" onClick=${onClose} aria-label="닫기"><${Icon} name="X" size=${18} /></button>
      </div>
      ${editWhen != null && html`<div class="when-edit">
        <label class="fld flex-1"><span>관찰 날짜·시각</span><input id="dWhen" type="datetime-local" value=${editWhen} max=${toLocalInput(Date.now())} onInput=${(e) => setEditWhen(e.target.value)} /></label>
        <div class="flex gap-2 items-end"><button type="button" class="btn-ghost" onClick=${() => { setEditWhen(null); setErr(""); }} disabled=${busy}>취소</button>
          <button type="button" class="btn-save" onClick=${saveWhen} disabled=${busy}><${Icon} name=${busy ? "Loader2" : "Check"} size=${16} className=${busy ? "animate-spin" : ""} />${busy ? "다시 계산 중…" : "저장"}</button></div>
        <p class="text-[12px] text-mist w-full">저장하면 그 시각 날씨로 빛·탄소 고정을 다시 계산하고, 사진 날짜 도장도 새로 찍어요.</p>
        ${err && html`<div class="err w-full">${err}</div>`}
      </div>`}
      ${rec.photo && html`<img src=${rec.photo} alt=${rec.koreanName || "식물 사진"} class="detail-photo" />`}
      ${rec.photo && html`<div class="flex justify-end -mt-1 mb-3"><button type="button" class="link-btn" onClick=${() => openSaver([{ url: rec.photo, name: `에코쌤즈_${rec.koreanName || "식물"}_${ymd(rec.ts)}.jpg` }], "프레임 사진 앨범에 저장")}>
        <${Icon} name="ImageDown" size=${14} />앨범에 저장</button></div>`}
      <${AnalysisCard} rec=${rec} />
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-[12px]">
        ${[["기온", fix(rec.weather.temp) + "℃"], ["습도", fix(rec.weather.rh, 0) + "%"], ["운량", fix(rec.weather.cloud, 0) + "%"], ["일사량", fix(rec.weather.sw, 0) + " W/m²"]]
          .map(([k, v]) => html`<div key=${k} class="stat"><div class="text-mist">${k}</div><div class="mono text-snow">${v}</div></div>`)}
      </div>
      ${rec.notes && html`<p class="text-[13px] text-snow mt-3 leading-relaxed">${rec.notes}</p>`}
      <div class="flex gap-2 mt-4 flex-wrap">
        <a class="btn-ghost" href=${`https://www.google.com/maps?q=${rec.lat},${rec.lng}`} target="_blank" rel="noopener"><${Icon} name="ExternalLink" size=${15} />구글 지도</a>
        ${(rec.researcher === me || rec.sample) && (!ask ? html`<button type="button" class="btn-ghost ml-auto text-rose-600" onClick=${() => setAsk(true)}><${Icon} name="Trash2" size=${15} />삭제</button>`
          : html`<div class="ml-auto flex items-center gap-2"><span class="text-[13px] text-rose-700">이 기록을 지울까요?</span>
              <button type="button" class="btn-ghost" onClick=${() => setAsk(false)}>취소</button>
              <button type="button" class="btn-danger" onClick=${() => onDelete(rec.id)}>삭제</button></div>`)}
      </div>
    </div>
  </div>`;
}

/* ---------- 설정 ---------- */
function SettingsModal({ settings, onSave, onClose }) {
  const [key, setKey] = useState(settings.apiKey || "");
  const [model, setModel] = useState(settings.model || DEFAULT_MODEL);
  const [show, setShow] = useState(false);
  return html`<div class="modal-bg" onClick=${onClose}>
    <div class="modal max-w-md" role="dialog" aria-modal="true" aria-label="AI 분석 설정" onClick=${(e) => e.stopPropagation()}>
      <div class="flex items-center gap-2 mb-2"><${Icon} name="KeyRound" size=${19} className="text-photon" />
        <h2 class="font-display text-[20px] text-snow">AI 분석 설정</h2>
        <button type="button" class="icon-btn ml-auto" onClick=${onClose} aria-label="닫기"><${Icon} name="X" size=${18} /></button></div>
      <div class=${"team-ai" + (settings.team ? " on" : "")}><${Icon} name=${settings.team ? "CircleCheck" : "CircleAlert"} size=${17} />
        <span>${settings.team ? html`<b>팀 공용 AI 연결됨</b><small>키를 넣지 않아도 식물 동정·협의회 정리가 돼요.</small>`
          : html`<b>팀 공용 AI 키 없음</b><small>관리자가 Vercel에 ANTHROPIC_API_KEY를 넣으면 네 분 모두 바로 쓸 수 있어요.</small>`}</span></div>
      <div class=${"team-ai" + (settings.plantnet ? " on" : "")}><${Icon} name=${settings.plantnet ? "CircleCheck" : "CircleDashed"} size=${17} />
        <span>${settings.plantnet ? html`<b>Pl@ntNet 사진 비교 연결됨</b><small>종 찾기 때 전 세계 식물 사진과 먼저 비교해 후보를 뽑아요.</small>`
          : html`<b>Pl@ntNet 사진 비교 꺼짐</b><small>관리자가 PLANTNET_API_KEY를 넣으면 사진 비교 후보가 함께 나와요.</small>`}</span></div>
      <p class="text-[13px] text-mist leading-relaxed mb-4">이 기기에서만 따로 쓰려면 Anthropic API 키를 넣으세요. 넣으면 팀 공용 대신 이 키를 쓰고, 키는 <b class="text-snow">이 휴대폰에만</b> 저장돼요. (Claude 구독과 API 크레딧은 별개예요)</p>
      <label class="fld"><span>API 키</span>
        <div class="flex gap-2"><input id="apiKey" type=${show ? "text" : "password"} autocomplete="off" value=${key} onInput=${(e) => setKey(e.target.value)} placeholder="sk-ant-..." class="flex-1" />
          <button type="button" class="icon-btn" onClick=${() => setShow(!show)} aria-label=${show ? "키 숨기기" : "키 보기"}><${Icon} name=${show ? "EyeOff" : "Eye"} size=${17} /></button></div></label>
      <a class="text-[12px] text-photon underline underline-offset-2" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic Console에서 키 발급 ↗</a>
      <label class="fld mt-3"><span>모델</span><input id="aiModel" class="mono" value=${model} onInput=${(e) => setModel(e.target.value)} /></label>
      <div class="flex gap-2 mt-4">
        <button type="button" class="btn-save flex-1" onClick=${() => onSave({ ...settings, apiKey: key.trim(), model: model.trim() || DEFAULT_MODEL })}><${Icon} name="Check" size=${17} />저장</button>
        ${settings.apiKey && html`<button type="button" class="btn-ghost text-rose-600" onClick=${() => { setKey(""); onSave({ ...settings, apiKey: "", model }); }}>키 삭제</button>`}
      </div>
    </div>
  </div>`;
}

/* ---------- 활동 사진 ---------- */
const toLocalInput = (ts) => { const d = new Date(ts), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fromLocalInput = (s) => { const t = new Date(s).getTime(); return isNaN(t) ? null : t; };

function ActivityView({ me, acts, onAdd, onOpen }) {
  const byDay = useMemo(() => {
    const m = new Map(); acts.forEach((a) => { const d = fmtDay(a.ts); if (!m.has(d)) m.set(d, []); m.get(d).push(a); });
    return [...m.entries()];
  }, [acts]);
  return html`<div class="grid gap-4">
    <button type="button" class="act-hero" onClick=${onAdd}>
      <span class="act-hero-ic"><${Icon} name="ImagePlus" size=${28} /></span>
      <span class="flex-1 min-w-0"><b>활동 사진 올리기</b><small>모임·현장 탐사·캠페인 사진을 여러 장 한 번에. 찍은 날짜가 자동으로 찍히고, 나중에 고칠 수 있어요.</small></span>
    </button>
    <section class="glass p-4 grid gap-3">
      <div class="flex items-center gap-2 flex-wrap"><h2 class="pill-h pill-act"><${Icon} name="Users" size=${17} />우리의 활동 기록</h2>
        <span class="text-[12px] text-mist">${acts.length}장 · ${byDay.length}일</span></div>
      ${byDay.length ? html`<div class="act-timeline">${byDay.map(([d, list]) => html`<div key=${d} class="act-day">
          <div class="act-date"><span class="mono">${d}</span><small>${[...new Set(list.map((a) => a.title).filter(Boolean))].join(" · ")}</small></div>
          <div class="prints prints-s">${list.map((a, i) => html`<button key=${a.id} type="button" class="print" style=${{ "--tilt": `${i % 2 ? 1.5 : -1.5}deg` }}
            onClick=${() => onOpen(a)} aria-label=${`${a.title || "활동"} 사진 열기`}><img src=${a.photo} alt="" loading="lazy" /></button>`)}</div>
        </div>`)}</div>`
        : html`<div class="empty-note">첫 모임, 학교 탐사, 캠페인… 우리가 함께한 순간을 올려 두면 마지막에 영상으로 한 번에 묶을 수 있어요.</div>`}
    </section>
  </div>`;
}

function ActivityModal({ me, item, onClose, onSave, onDelete }) {
  const isNew = !item;
  const [files, setFiles] = useState([]); // [{raw, ts}]
  const [title, setTitle] = useState(item ? item.title || "" : "");
  const [place, setPlace] = useState(item ? item.place || "" : "");
  const [people, setPeople] = useState(item ? item.people || [] : [me]);
  const [notes, setNotes] = useState(item ? item.notes || "" : "");
  const [when, setWhen] = useState(item ? toLocalInput(item.ts) : "");
  const [busy, setBusy] = useState(false), [ask, setAsk] = useState(false), [err, setErr] = useState("");
  const [prev, setPrev] = useState(item ? item.photo : null);
  const inRef = useRef(null), camRef = useRef(null);
  const first = isNew ? files[0] : (item.raw ? { raw: item.raw, ts: item.ts } : null);
  const metaFor = (ts) => ({ mode: "activity", researcher: me, ts, name: title.trim() || "우리의 활동", place: place.trim(), people });
  useEffect(() => {
    if (!first) { if (isNew) setPrev(null); return; }
    const ts = fromLocalInput(when) || first.ts;
    let live = true; const t = setTimeout(() => { EM.composeFrame(first.raw, metaFor(ts)).then((d) => { if (live) setPrev(d); }, () => {}); }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [first && first.raw, when, title, place, people.join(",")]);

  const pick = async (e) => {
    const list = [...(e.target.files || [])]; e.target.value = ""; if (!list.length) return;
    setBusy(true); setErr("");
    try {
      const out = [];
      for (const f of list.slice(0, 30)) {
        const ts = (await EM.exifDate(f)) || f.lastModified || Date.now();
        out.push({ raw: await resizeImage(f, 1280, 0.85), ts });
      }
      out.sort((a, b) => a.ts - b.ts);
      setFiles(out); setWhen(toLocalInput(out[0].ts));
    } catch (er) { setErr("사진을 읽지 못했어요. 다른 사진으로 시도하세요."); }
    setBusy(false);
  };
  const togglePerson = (n) => setPeople((ps) => ps.includes(n) ? ps.filter((x) => x !== n) : RESEARCHERS.map((r) => r.name).filter((x) => ps.includes(x) || x === n));
  const save = async () => {
    setBusy(true);
    try {
      const edited = fromLocalInput(when);
      if (isNew) {
        // 첫 장 날짜를 고치면 나머지도 같은 만큼 옮겨서 순서를 지켜요
        const shift = edited && files.length ? edited - files[0].ts : 0;
        const list = [];
        for (const f of files) {
          const ts = f.ts + shift;
          list.push({ id: uid(), kind: "activity", ts, title: title.trim(), place: place.trim(), people, notes: notes.trim(), researcher: me, raw: f.raw,
            photo: await EM.composeFrame(f.raw, metaFor(ts)) });
        }
        onSave(list);
      } else {
        const ts = edited || item.ts;
        const raw = item.raw || item.photo;
        onSave([{ ...item, ts, title: title.trim(), place: place.trim(), people, notes: notes.trim(), raw,
          photo: item.raw ? await EM.composeFrame(raw, metaFor(ts)) : item.photo }]);
      }
    } catch (e) { setErr("저장하지 못했어요. 다시 시도해 주세요."); setBusy(false); }
  };
  return html`<div class="modal-bg" onClick=${busy ? null : onClose}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="활동 사진" onClick=${(e) => e.stopPropagation()} style=${{ borderColor: MODES.activity.color }}>
      <div class="flex items-center gap-2 mb-3"><${Icon} name="Users" size=${20} className="text-amber" />
        <h2 class="font-display text-[20px] text-snow">${isNew ? "활동 사진 올리기" : "활동 사진 고치기"}</h2>
        <button type="button" class="icon-btn ml-auto" onClick=${onClose} aria-label="닫기" disabled=${busy}><${Icon} name="X" size=${18} /></button></div>
      <div class="grid gap-4">
        ${isNew && !files.length ? html`<div class="grid grid-cols-2 gap-2">
            <button type="button" class="drop drop-act" onClick=${() => camRef.current.click()} disabled=${busy}><${Icon} name="Camera" size=${24} />지금 찍기</button>
            <button type="button" class="drop drop-act" onClick=${() => inRef.current.click()} disabled=${busy}><${Icon} name="Images" size=${24} />앨범에서 여러 장</button>
          </div>` : null}
        <input ref=${inRef} id="actIn" type="file" accept="image/*" multiple class="hidden" onChange=${pick} />
        <input ref=${camRef} id="actCam" type="file" accept="image/*" capture="environment" class="hidden" onChange=${pick} />
        ${busy && !prev ? html`<div class="frame-wait p-6 text-center">사진을 읽고 날짜를 찾는 중…</div>` : null}
        ${prev && html`<div class="grid gap-1.5">
          <div class="frame-prev">${html`<img src=${prev} alt="날짜 도장이 찍힌 활동 사진 미리보기" />`}</div>
          ${isNew && files.length > 1 && html`<div class="act-thumbs">${files.map((f, i) => html`<img key=${i} src=${f.raw} alt="" />`)}</div>`}
          <p class="text-[12px] text-mist text-center">${isNew && files.length > 1 ? `${files.length}장 모두 같은 제목으로, 각자 찍은 시각이 도장으로 찍혀요.` : "날짜를 고치면 도장도 바로 바뀌어요."}</p>
        </div>`}
        <label class="fld"><span>날짜와 시각 ${isNew && files.length ? "(사진에서 자동으로 읽었어요)" : ""}</span>
          <input id="actWhen" type="datetime-local" value=${when} onInput=${(e) => setWhen(e.target.value)} /></label>
        ${isNew && files.length > 1 && html`<p class="text-[12px] text-mist -mt-3">첫 장 날짜를 고치면 나머지 사진도 같은 만큼 함께 옮겨져요.</p>`}
        <label class="fld"><span>활동 이름</span><input id="actTitle" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="예: 1차 정기 모임, 학교 화단 탐사, 하천 생태 산책" /></label>
        <label class="fld"><span>장소</span><input id="actPlace" value=${place} onInput=${(e) => setPlace(e.target.value)} placeholder="예: 송례중 과학실, 장지천" /></label>
        <div><${Label}>함께한 사람</${Label}><div class="flex flex-wrap gap-1.5">${RESEARCHERS.map((r) => html`<${Chip} key=${r.name} on=${people.includes(r.name)} color=${r.color} onClick=${() => togglePerson(r.name)}>
          <${Dot} color=${people.includes(r.name) ? "#fff" : r.color} size=${7} />${r.name}</${Chip}>`)}</div></div>
        <label class="fld"><span>메모</span><textarea id="actNote" rows="2" value=${notes} onInput=${(e) => setNotes(e.target.value)} placeholder="무엇을 했고 무엇을 느꼈는지"></textarea></label>
        ${err && html`<div class="err">${err}</div>`}
        <button type="button" class="btn-save" onClick=${save} disabled=${busy || (isNew && !files.length)}
          style=${{ background: MODES.activity.color, borderColor: MODES.activity.deep, boxShadow: `0 4px 0 ${MODES.activity.deep}` }}>
          <${Icon} name="Save" size=${18} />${busy && (files.length || !isNew) ? "날짜 도장 찍는 중…" : isNew ? `활동 사진 ${files.length || ""}장 저장` : "고친 내용 저장"}</button>
        ${!isNew && html`<div class="flex gap-2 flex-wrap">
          <button type="button" class="btn-ghost" onClick=${() => openSaver([{ url: item.photo, name: `에코쌤즈_활동_${ymd(item.ts)}.jpg` }], "활동 사진 앨범에 저장")}>
            <${Icon} name="ImageDown" size=${15} />앨범에 저장</button>
          ${!ask ? html`<button type="button" class="btn-ghost ml-auto text-rose-600" onClick=${() => setAsk(true)}><${Icon} name="Trash2" size=${15} />삭제</button>`
            : html`<div class="ml-auto flex items-center gap-2"><span class="text-[13px] text-rose-700">지울까요?</span>
              <button type="button" class="btn-ghost" onClick=${() => setAsk(false)}>취소</button><button type="button" class="btn-danger" onClick=${() => onDelete(item.id)}>삭제</button></div>`}
        </div>`}
      </div>
    </div>
  </div>`;
}

/* ---------- 같이: 협의회 기록 ---------- */
function MeetingList({ meetings, onAdd, onOpen, onExport }) {
  const [busy, setBusy] = useState(false);
  return html`<div class="grid gap-4">
    <button type="button" class="act-hero meet-hero" onClick=${onAdd}>
      <span class="act-hero-ic"><${Icon} name="NotebookPen" size=${28} /></span>
      <span class="flex-1 min-w-0"><b>협의회 기록하기</b><small>날짜·장소·모임 멤버·협의 내용·사진을 한 장의 회의록으로. 나중에 언제든 고칠 수 있어요.</small></span>
    </button>
    ${meetings.length ? html`<button type="button" class="exp" disabled=${busy} onClick=${async () => { setBusy(true); try { await onExport(meetings); } finally { setBusy(false); } }}>
        <${Icon} name=${busy ? "Loader2" : "FileText"} size=${20} className=${"text-photon" + (busy ? " animate-spin" : "")} />
        <span><b>${busy ? "한글 파일 만드는 중…" : `협의록 ${meetings.length}건 한글 파일로 받기`}</b><small>.hwpx · 한글에서 바로 열려요 · 협의록 양식 표 + 사진, 회차마다 쪽 나눔</small></span></button>
      <div class="meet-list">${meetings.map((m) => { const d = new Date(m.ts);
      return html`<button key=${m.id} type="button" class="minutes" onClick=${() => onOpen(m)}>
        <span class="minutes-date"><b class="mono">${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}</b><small>${d.getFullYear()} · ${["일", "월", "화", "수", "목", "금", "토"][d.getDay()]}</small>
          <em class="mono">${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}</em></span>
        <span class="minutes-body">
          <span class="minutes-no mono">에코쌤즈 협의록 · ${m.place || "장소 미정"}</span>
          <b>${m.title || "에코쌤즈 협의회"}</b>
          <span class="minutes-who">${(m.people || []).map((n) => html`<span key=${n}><${Dot} color=${rColor(n)} size=${7} />${n}</span>`)}</span>
          ${m.content && html`<span class="minutes-text">${m.content}</span>`}
          ${m.decisions && html`<span class="minutes-dec"><${Icon} name="CircleCheck" size=${13} />${m.decisions}</span>`}
          ${m.todos && m.todos.length ? html`<span class="minutes-todo"><${Icon} name="ListTodo" size=${13} />${todosToText(m.todos)}</span>` : null}
          ${m.transcript && html`<span class="minutes-no mono"><${Icon} name="Mic" size=${11} /> 녹음 원문 ${m.transcript.length.toLocaleString()}자</span>`}
          ${m.photos && m.photos.length ? html`<span class="minutes-ph">${m.photos.slice(0, 4).map((ph, i) => html`<img key=${i} src=${ph.photo} alt="" />`)}${m.photos.length > 4 ? html`<i>+${m.photos.length - 4}</i>` : null}</span>` : null}
        </span>
      </button>`; })}</div>`
      : html`<div class="empty-note">첫 협의회를 기록해 보세요. 계획 회의, 중간 점검, 성과 정리까지 모두 여기 쌓여 마지막 아카이브와 영상에 들어가요.</div>`}
  </div>`;
}

/** 휴대폰 음성 인식으로 회의 받아 적기 (끊기면 자동으로 다시 이어 듣기) */
const SpeechRec = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
function useDictation(onLine) {
  const [on, setOn] = useState(false), [interim, setInterim] = useState(""), [err, setErr] = useState(""), [secs, setSecs] = useState(0);
  const want = useRef(false), rec = useRef(null), lock = useRef(null), t0 = useRef(0), base = useRef(0), tick = useRef(null), lineRef = useRef(onLine);
  lineRef.current = onLine;
  const elapsed = () => base.current + (want.current ? (Date.now() - t0.current) / 1000 : 0);
  const grabLock = async () => { try { if (navigator.wakeLock) lock.current = await navigator.wakeLock.request("screen"); } catch (e) {} };
  const startRec = () => {
    const r = new SpeechRec(); rec.current = r;
    r.lang = "ko-KR"; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (e) => {
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i], txt = res[0].transcript.trim();
        if (res.isFinal) { if (txt) lineRef.current(txt, elapsed()); } else tmp += txt + " ";
      }
      setInterim(tmp.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        want.current = false; setErr("마이크를 쓸 수 없어요. 브라우저 주소창의 자물쇠(설정)에서 마이크를 허용해 주세요.");
      } else if (e.error === "audio-capture") { want.current = false; setErr("마이크를 찾지 못했어요."); }
    };
    r.onend = () => { setInterim(""); if (want.current) setTimeout(() => { if (want.current) { try { startRec(); } catch (er) {} } }, 200); else setOn(false); };
    r.start();
  };
  const start = () => {
    if (!SpeechRec) { setErr("이 브라우저는 받아 적기를 지원하지 않아요. 크롬(안드로이드)이나 사파리(아이폰)에서 열어 주세요. 키보드의 🎤 받아쓰기로 원문 칸에 바로 입력해도 돼요."); return; }
    setErr(""); want.current = true; t0.current = Date.now(); setOn(true); grabLock();
    clearInterval(tick.current); tick.current = setInterval(() => setSecs(Math.floor(elapsed())), 1000);
    try { startRec(); } catch (e) { want.current = false; setOn(false); setErr("받아 적기를 시작하지 못했어요. 다시 눌러 보세요."); }
  };
  const stop = () => {
    if (want.current) base.current += (Date.now() - t0.current) / 1000;
    want.current = false; clearInterval(tick.current); setSecs(Math.floor(base.current));
    try { rec.current && rec.current.stop(); } catch (e) {}
    try { lock.current && lock.current.release(); } catch (e) {} lock.current = null;
    setOn(false);
  };
  useEffect(() => {
    const vis = () => { if (document.visibilityState === "visible" && want.current) grabLock(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); want.current = false; clearInterval(tick.current);
      try { rec.current && rec.current.abort(); } catch (e) {} try { lock.current && lock.current.release(); } catch (e) {} };
  }, []);
  return { on, interim, err, secs, start, stop, supported: !!SpeechRec };
}
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function MeetingModal({ me, item, settings, onClose, onSave, onDelete, onExport, onOpenSettings }) {
  const isNew = !item;
  const [when, setWhen] = useState(toLocalInput(item ? item.ts : Date.now()));
  const [place, setPlace] = useState(item ? item.place || "" : "");
  const [people, setPeople] = useState(item ? item.people || [] : RESEARCHERS.map((r) => r.name));
  const [title, setTitle] = useState(item ? item.title || "" : "");
  const [content, setContent] = useState(item ? item.content || "" : "");
  const [decisions, setDecisions] = useState(item ? item.decisions || "" : "");
  const [todos, setTodos] = useState(item ? (item.todos ? todosToText(item.todos) : "") : "");
  const [transcript, setTranscript] = useState(item ? item.transcript || "" : "");
  const [showTr, setShowTr] = useState(false);
  const [photos, setPhotos] = useState(item ? (item.photos || []) : []); // [{raw?, photo}]
  const [busy, setBusy] = useState(false), [ask, setAsk] = useState(false), [err, setErr] = useState("");
  const [sum, setSum] = useState("idle"), [sumMsg, setSumMsg] = useState("");
  const inRef = useRef(null), camRef = useRef(null), trRef = useRef(null);
  const dict = useDictation((line, t) => setTranscript((tr) => {
    // 안드로이드 크롬은 같은 말을 조금씩 늘려 가며 여러 번 확정하기도 해서, 앞 줄을 이어 쓴 것이면 바꿔 끼운다
    const lines = tr ? tr.split("\n") : [];
    const last = lines.length ? lines[lines.length - 1].replace(/^\[\d+:\d+\]\s*/, "") : "";
    if (last && (line === last || line.startsWith(last))) { lines[lines.length - 1] = lines[lines.length - 1].replace(last, line); return lines.join("\n"); }
    if (last && last.startsWith(line)) return tr;
    return (tr ? tr + "\n" : "") + `[${mmss(t)}] ${line}`;
  }));
  useEffect(() => { if (dict.on) setShowTr(true); }, [dict.on]);
  useEffect(() => { if (trRef.current && dict.on) trRef.current.scrollTop = trRef.current.scrollHeight; }, [transcript, dict.interim]);
  const togglePerson = (n) => setPeople((ps) => ps.includes(n) ? ps.filter((x) => x !== n) : RESEARCHERS.map((r) => r.name).filter((x) => ps.includes(x) || x === n));
  const addPhotos = async (e) => {
    const list = [...(e.target.files || [])]; e.target.value = ""; if (!list.length) return;
    setBusy(true); setErr("");
    try { const out = []; for (const f of list.slice(0, 20)) out.push({ raw: await resizeImage(f, 1280, 0.85), photo: null }); setPhotos((ps) => ps.concat(out)); }
    catch (er) { setErr("사진을 읽지 못했어요."); }
    setBusy(false);
  };
  const summarize = async () => {
    if (dict.on) dict.stop();
    if (!aiReady(settings)) { onOpenSettings(); return; }
    const tr = transcript.trim();
    if (tr.length < 20) { setSumMsg("받아 적은 내용이 너무 짧아요. 조금 더 녹음해 주세요."); setSum("error"); return; }
    setSum("loading"); setSumMsg("");
    try {
      const o = await summarizeMeeting(settings, { transcript: tr.slice(-60000), when: EH.fmtWhen(fromLocalInput(when) || Date.now()), place, people, title, content });
      if (o.title) setTitle(o.title);
      if (o.content) setContent(o.content);
      setDecisions(o.decisions || "");
      setTodos(todosToText(o.todos));
      setSum("ok"); setSumMsg("정리했어요. 아래 칸을 확인하고 필요하면 고친 뒤 저장하세요.");
    } catch (e) { setSum("error"); setSumMsg(e.message || String(e)); }
  };
  const build = async () => {
    const ts = fromLocalInput(when) || Date.now();
    const meta = { mode: "meeting", researcher: me, ts, name: title.trim() || "에코쌤즈 협의회", place: place.trim(), people };
    const framed = [];
    for (const ph of photos) framed.push(ph.raw ? { raw: ph.raw, photo: await EM.composeFrame(ph.raw, meta) } : ph);
    return { ...(item || { id: uid(), kind: "meeting", researcher: me }), ts, place: place.trim(), people, title: title.trim(), content: content.trim(),
      decisions: decisions.trim(), todos: textToTodos(todos), transcript: transcript.trim(), photos: framed, editedBy: me, editedAt: Date.now() };
  };
  const save = async () => {
    if (dict.on) dict.stop();
    if (!title.trim() && !content.trim() && !transcript.trim()) { setErr("안건이나 협의 내용을 조금이라도 적어 주세요."); return; }
    setBusy(true); setErr("");
    try { onSave(await build()); } catch (e) { setErr("저장하지 못했어요. 다시 시도해 주세요."); setBusy(false); }
  };
  const exportNow = async () => { setBusy(true); setErr(""); try { await onExport([await build()]); } catch (e) { setErr(e.message || "한글 파일을 만들지 못했어요."); } setBusy(false); };
  const close = () => { if (dict.on) dict.stop(); onClose(); };
  const C = MODES.meeting;
  return html`<div class="modal-bg" onClick=${busy || dict.on ? null : close}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="협의회 기록" onClick=${(e) => e.stopPropagation()} style=${{ borderColor: C.color }}>
      <div class="flex items-center gap-2 mb-3"><${Icon} name="NotebookPen" size=${20} style=${{ color: C.color }} />
        <h2 class="font-display text-[20px] text-snow">${isNew ? "협의회 기록하기" : "협의회 기록 고치기"}</h2>
        <button type="button" class="icon-btn ml-auto" onClick=${close} aria-label="닫기" disabled=${busy}><${Icon} name="X" size=${18} /></button></div>
      <div class="grid gap-4 minutes-form">
        <section class=${"rec-box" + (dict.on ? " live" : "")}>
          <div class="flex items-center gap-2 flex-wrap">
            ${dict.on
              ? html`<button type="button" class="rec-btn stop" onClick=${dict.stop}><span class="rec-sq"></span>중지</button>
                  <span class="rec-time mono"><i class="rec-dot"></i>${mmss(dict.secs)} 듣는 중</span>`
              : html`<button type="button" class="rec-btn" onClick=${dict.start} disabled=${sum === "loading"}><${Icon} name="Mic" size=${20} />${transcript ? "이어서 녹음" : "녹음 시작"}</button>
                  ${transcript && html`<span class="rec-time mono">${dict.secs ? `${mmss(dict.secs)} · ` : ""}${transcript.length.toLocaleString()}자 받아 적음</span>`}`}
            <button type="button" class="rec-sum" onClick=${summarize} disabled=${!transcript.trim() || sum === "loading"}>
              <${Icon} name=${sum === "loading" ? "Loader2" : "Sparkles"} size=${18} className=${sum === "loading" ? "animate-spin" : ""} />${sum === "loading" ? "정리하는 중…" : "정리하기"}</button>
          </div>
          ${!transcript && !dict.on && !dict.err && html`<p class="rec-help">휴대폰을 탁자 가운데 두고 녹음 시작 → 회의 → 중지 → <b>정리하기</b>. 받아 적은 말을 AI가 안건·협의 내용·결정 사항·할 일로 정리해 아래 칸을 채워요.</p>`}
          ${dict.err && html`<div class="err">${dict.err}</div>`}
          ${(transcript || dict.on) && html`<details class="rec-tr" open=${showTr} onToggle=${(e) => setShowTr(e.currentTarget.open)}>
            <summary>받아 적은 원문 ${dict.on ? "(실시간)" : "· 고칠 수 있어요"}</summary>
            <textarea ref=${trRef} id="mTr" rows="6" value=${transcript + (dict.interim ? (transcript ? "\n" : "") + "… " + dict.interim : "")} readOnly=${dict.on}
              onInput=${(e) => setTranscript(e.target.value)} placeholder="여기에 회의 내용이 적혀요"></textarea>
          </details>`}
          ${sumMsg && html`<div class=${sum === "ok" ? "ok-note" : "err"}>${sumMsg}</div>`}
          ${!aiReady(settings) && transcript && html`<p class="rec-help">정리하기는 AI 키가 필요해요. <button type="button" class="underline" onClick=${onOpenSettings}>설정 열기</button></p>`}
        </section>
        <div class="grid sm:grid-cols-2 gap-3">
          <label class="fld"><span>날짜와 시각</span><input id="mWhen" type="datetime-local" value=${when} onInput=${(e) => setWhen(e.target.value)} /></label>
          <label class="fld"><span>장소</span><input id="mPlace" value=${place} onInput=${(e) => setPlace(e.target.value)} placeholder="예: 송례중 과학실, 온라인(줌)" /></label>
        </div>
        <div><${Label}>모임 멤버</${Label}><div class="flex flex-wrap gap-1.5">${RESEARCHERS.map((r) => html`<${Chip} key=${r.name} on=${people.includes(r.name)} color=${r.color} onClick=${() => togglePerson(r.name)}>
          <${Dot} color=${people.includes(r.name) ? "#fff" : r.color} size=${7} />${r.name}</${Chip}>`)}</div></div>
        <label class="fld"><span>안건 (협의회 이름)</span><input id="mTitle" value=${title} onInput=${(e) => setTitle(e.target.value)} placeholder="예: 2차 협의회 · 학교 식물 조사 구역 나누기" /></label>
        <label class="fld"><span>협의 내용</span><textarea id="mContent" rows="7" value=${content} onInput=${(e) => setContent(e.target.value)}
          placeholder="오간 이야기, 의견, 자료를 적어요 (정리하기를 누르면 자동으로 채워져요)"></textarea></label>
        <label class="fld"><span>결정 사항</span><textarea id="mDec" rows="3" value=${decisions} onInput=${(e) => setDecisions(e.target.value)}
          placeholder="- 11월 둘째 주까지 따로 기록 5종씩"></textarea></label>
        <label class="fld"><span>향후 계획 · 할 일</span><textarea id="mTodo" rows="3" value=${todos} onInput=${(e) => setTodos(e.target.value)}
          placeholder="- 후문 쪽 식물 조사 (담당: 이귀리) · 11/7"></textarea></label>
        <div class="grid gap-2"><${Label}>사진 ${photos.length ? `${photos.length}장 · 협의회 날짜 도장이 찍혀요` : ""}</${Label}>
          ${photos.length ? html`<div class="meet-photos">${photos.map((ph, i) => html`<span key=${i} class="meet-ph">
              <img src=${ph.photo || ph.raw} alt="" /><button type="button" onClick=${() => setPhotos((ps) => ps.filter((_, j) => j !== i))} aria-label="사진 빼기"><${Icon} name="X" size=${13} /></button></span>`)}</div>` : null}
          <div class="grid grid-cols-2 gap-2">
            <button type="button" class="drop drop-meet" onClick=${() => camRef.current.click()} disabled=${busy}><${Icon} name="Camera" size=${22} />지금 찍기</button>
            <button type="button" class="drop drop-meet" onClick=${() => inRef.current.click()} disabled=${busy}><${Icon} name="Images" size=${22} />앨범에서 여러 장</button>
          </div>
          <input ref=${inRef} id="mIn" type="file" accept="image/*" multiple class="hidden" onChange=${addPhotos} />
          <input ref=${camRef} id="mCam" type="file" accept="image/*" capture="environment" class="hidden" onChange=${addPhotos} />
        </div>
        ${!isNew && item.editedBy && html`<p class="text-[12px] text-mist">마지막 수정: ${item.editedBy} · ${fmtDate(item.editedAt || item.ts)}</p>`}
        ${err && html`<div class="err">${err}</div>`}
        <button type="button" class="btn-save" onClick=${save} disabled=${busy || sum === "loading"}
          style=${{ background: C.color, borderColor: C.deep, boxShadow: `0 4px 0 ${C.deep}` }}>
          <${Icon} name="Save" size=${18} />${busy ? "잠시만요…" : isNew ? "협의회 기록 저장" : "고친 내용 저장"}</button>
        <div class="flex items-center gap-2 flex-wrap">
          <button type="button" class="btn-ghost" onClick=${exportNow} disabled=${busy}><${Icon} name="FileText" size=${15} />한글 파일(.hwpx)로 받기</button>
          ${!isNew && (!ask ? html`<button type="button" class="btn-ghost ml-auto text-rose-600" onClick=${() => setAsk(true)}><${Icon} name="Trash2" size=${15} />이 협의록 삭제</button>`
          : html`<div class="ml-auto flex items-center gap-2"><span class="text-[13px] text-rose-700">지울까요?</span>
            <button type="button" class="btn-ghost" onClick=${() => setAsk(false)}>취소</button><button type="button" class="btn-danger" onClick=${() => onDelete(item.id)}>삭제</button></div>`)}
        </div>
      </div>
    </div>
  </div>`;
}
function meetingsCSV(ms) {
  const head = ["일시", "장소", "모임 멤버", "안건", "협의 내용", "결정 사항", "향후 계획·할 일", "사진 수", "녹음 원문", "마지막 수정"];
  const rows = ms.slice().sort((a, b) => a.ts - b.ts).map((m) => [new Date(m.ts).toLocaleString("ko-KR"), m.place || "", (m.people || []).join(", "), m.title || "",
    m.content || "", m.decisions || "", todosToText(m.todos), (m.photos || []).length, m.transcript || "", m.editedBy || m.researcher || ""]
    .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  return "﻿" + head.join(",") + "\n" + rows.join("\n");
}
/** 협의회 사진을 사진첩·영상용 낱장으로 펼치기 */
const meetingPhotos = (ms) => ms.flatMap((m) => (m.photos || []).map((ph, i) => ({ id: `${m.id}#${i}`, kind: "meeting", ts: m.ts + i, title: m.title, people: m.people, researcher: m.researcher, photo: ph.photo, _meeting: m })));

/* ---------- 한글 협의록 · 전체 자료 묶음 ---------- */
const ymd = (ts) => { const d = new Date(ts), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const hm = (ts) => { const d = new Date(ts), p = (n) => String(n).padStart(2, "0"); return `${p(d.getHours())}${p(d.getMinutes())}`; };
const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "무제";
async function minutesHwpx(ms) {
  if (!window.JSZip || !EH) throw new Error("한글 파일 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.");
  return EH.build(ms, { photos: async (m) => {
    const out = []; for (const ph of (m.photos || [])) { const u = ph.photo || ph.raw; if (u) { try { out.push(await EH.photoFromDataURL(await photoDataUrl(u))); } catch (e) {} } } return out; } });
}
const minutesFileName = (ms) => ms.length === 1 ? `에코쌤즈_협의록_${ymd(ms[0].ts)}_${safeName(ms[0].title)}.hwpx` : `에코쌤즈_협의록_전체_${ms.length}건_${today()}.hwpx`;
const dataUrlBytes = (u) => { const b = atob(u.slice(u.indexOf(",") + 1)), a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
/** 사진·기록·조언·협의록을 폴더별로 정리한 ZIP */
async function buildAllZip({ records, acts, meetings }, onStep) {
  if (!window.JSZip) throw new Error("압축 도구를 불러오지 못했어요. 새로고침해 주세요.");
  const z = new window.JSZip();
  const real = records.filter((r) => !r.sample);
  const used = new Set();
  const uniq = (path) => { let p = path, i = 2; while (used.has(p)) p = path.replace(/(\.[a-z]+)$/, `_${i++}$1`); used.add(p); return p; };
  let n = 0;
  for (const r of real) {
    if (!r.photo) continue;
    const dir = r.mode === "solo" ? `01_따로_우리동네/${r.researcher}` : `02_같이_학교`;
    z.file(uniq(`${dir}/${ymd(r.ts)}_${hm(r.ts)}_${safeName(r.koreanName || "미확인")}${r.mode === "team" ? `_${r.researcher}` : ""}.jpg`), await photoBytes(r.photo)); n++;
  }
  for (const a of acts) { if (a.photo) { z.file(uniq(`03_활동사진/${ymd(a.ts)}_${hm(a.ts)}_${safeName(a.title || "활동")}.jpg`), await photoBytes(a.photo)); n++; } }
  for (const m of meetings) { let i = 0; for (const ph of (m.photos || [])) { i++; if (ph.photo) { z.file(uniq(`04_협의회/${ymd(m.ts)}_${safeName(m.title || "협의회")}/사진${i}.jpg`), await photoBytes(ph.photo)); n++; } } }
  onStep && onStep("기록표 만드는 중…");
  z.file("05_식물기록표_메모_AI조언.csv", toCSV(real));
  if (meetings.length) {
    z.file("06_협의록_목록.csv", meetingsCSV(meetings));
    onStep && onStep("한글 협의록 만드는 중…");
    z.file(`07_협의록_전체_${meetings.length}건.hwpx`, await minutesHwpx(meetings));
  }
  if (real.length) z.file("08_광합성지도.geojson", JSON.stringify(toGeoJSON(real), null, 1));
  z.file("09_백업_앱에_다시_불러오기용.json", JSON.stringify(real.map(({ raw, ...r }) => r).concat(acts.map(({ raw, ...a }) => a), meetings.map((m) => ({ ...m, photos: (m.photos || []).map((ph) => ({ photo: ph.photo })) })))));
  z.file("읽어주세요.txt", [
    "기후행동 실천모임 에코쌤즈 · 따로 또 같이 자료 묶음", `만든 날: ${new Date().toLocaleString("ko-KR")}`, "",
    `사진 ${n}장 (팀 프레임·날짜 도장이 찍힌 사진)`, `식물 기록 ${real.length}건 · 활동 사진 ${acts.length}장 · 협의록 ${meetings.length}건`, "",
    "01_따로_우리동네 : 선생님별 우리 동네 식물", "02_같이_학교 : 학교에서 같이 모은 식물", "03_활동사진", "04_협의회 : 회차별 사진",
    "05 CSV : 엑셀에서 열기 (메모, AI 광합성 해설·기후지표 근거·수업 연계 조언 포함)", "06 CSV : 협의록 목록 (녹음 원문 포함)",
    "07 .hwpx : 한글에서 열리는 협의록 (회차마다 쪽 나눔)", "08 .geojson : 지도 프로그램용 위치 데이터", "09 .json : 앱 아카이브 → '팀원 기록 합치기'로 다시 불러오기",
  ].join("\r\n"));
  onStep && onStep("압축하는 중…");
  return z.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 3 } });
}

/* ---------- 앱 ---------- */
function App() {
  const saved = store.get(LS_SET, {});
  const [settings, setSettings] = useState({ apiKey: saved.apiKey || "", model: saved.model || DEFAULT_MODEL });
  const [auth, setAuth] = useState(() => { store.del("ecossam.v1.auth"); const a = store.get(LS_AUTH, null); return a && RESEARCHERS.some((r) => r.name === a.name) ? a : null; });
  const me = auth ? auth.name : RESEARCHERS[0].name;
  const [records, setRecords] = useState([]);
  const [acts, setActs] = useState([]);
  const [actEdit, setActEdit] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [meetEdit, setMeetEdit] = useState(null);
  const [teamSub, setTeamSub] = useState("plants");
  const [showSwitch, setShowSwitch] = useState(false);
  const [saver, setSaver] = useState(null);
  // 새 버전 알림: 앱을 다시 볼 때마다 서버의 빌드 번호와 비교
  const [newVer, setNewVer] = useState(false);
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible" || !window.__BUILD__ || window.__BUILD__.startsWith("__")) return;
      try { const t = await (await fetch("/?v=" + Date.now(), { cache: "no-store" })).text(); const m = t.match(/__BUILD__ = "(\d+)"/);
        if (m && m[1] !== window.__BUILD__) setNewVer(true); } catch (e) {}
    };
    const iv = setInterval(check, 5 * 60 * 1000); document.addEventListener("visibilitychange", check); setTimeout(check, 4000);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", check); };
  }, []);
  useEffect(() => { const fn = (e) => setSaver(e.detail); window.addEventListener("eco-save", fn); return () => window.removeEventListener("eco-save", fn); }, []);
  const depth = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTabS] = useState(() => { const hsh = (location.hash || "").slice(1); return TABS.some((t) => t.id === hsh) ? hsh : "today"; });
  const [weather, setWeather] = useState(null), [wState, setWState] = useState("idle"), [wErr, setWErr] = useState("");
  const [gps, setGps] = useState(null);
  const [follow, setFollow] = useState(false);
  const [draft, setDraft] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState("");
  const lastWx = useRef(null), gpsRef = useRef(null); gpsRef.current = gps;

  const say = (m) => { setToast(m); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 2600); };
  const setTab = (t) => { if (t === tabRef.current) { window.scrollTo(0, 0); return; } setTabS(t); try { history.pushState(null, "", "#" + t); depth.current++; } catch (e) {} window.scrollTo(0, 0); };
  const tabRef = useRef(tab); tabRef.current = tab;
  const goBack = () => {
    if (depth.current > 0) history.back();
    else if (tab !== "today") { setTabS("today"); try { history.replaceState(null, "", "#today"); } catch (e) {} window.scrollTo(0, 0); }
  };
  const goHome = () => setTab("today");
  useEffect(() => { const fn = () => { const hsh = (location.hash || "").slice(1); depth.current = Math.max(0, depth.current - 1);
      setTabS(TABS.some((t) => t.id === hsh) ? hsh : "today"); window.scrollTo(0, 0); };
    window.addEventListener("popstate", fn); return () => window.removeEventListener("popstate", fn); }, []);

  // 기록 불러오기 (IndexedDB) + 이전 버전 기록 옮기기
  useEffect(() => { (async () => {
    let all = await db.all();
    const old = store.get(LS_OLD, null);
    if (old && Array.isArray(old)) { for (const r of old) { if (!r.sample) await db.put({ mode: "team", ...r }); } store.del(LS_OLD); all = await db.all(); }
    if (!all.length && !store.get("ecossam.v2.seeded", false)) { for (const r of sampleRecords()) await db.put(r); store.set("ecossam.v2.seeded", true); all = await db.all(); }
    all.sort((a, b) => b.ts - a.ts);
    setRecords(all.filter((r) => !r.kind)); setActs(all.filter((r) => r.kind === "activity")); setMeetings(all.filter((r) => r.kind === "meeting")); setLoaded(true);
    syncNow();
  })(); }, []);

  // ---- 팀 공용 저장소와 맞추기 ----
  const [sync, setSync] = useState({ state: "idle", at: 0, msg: "" });
  const syncing = useRef(false), syncAgain = useRef(false);
  const reloadFromDb = async () => {
    const all = (await db.all()).sort((a, b) => b.ts - a.ts);
    setRecords(all.filter((r) => !r.kind)); setActs(all.filter((r) => r.kind === "activity")); setMeetings(all.filter((r) => r.kind === "meeting"));
  };
  const syncNow = async () => {
    if (syncing.current) { syncAgain.current = true; return; }
    syncing.current = true; setSync((x) => ({ ...x, state: "syncing" }));
    try {
      const dq = store.get(LS_DELQ, []);
      if (dq.length) { await cloud.upsert(dq.map((d) => ({ id: d.id, kind: d.kind || "plant", deleted: true, data: {} }))); store.set(LS_DELQ, []); }
      const up = (await db.all()).filter((r) => !r.sample && (r._dirty || !r._synced));
      for (let i = 0; i < up.length; i += 2) {
        const cl = await Promise.all(up.slice(i, i + 2).map(toCloudItem));
        await cloud.upsert(cl.map((o) => ({ id: o.id, kind: o.kind || "plant", author: o.researcher || null, ts: o.ts || null, data: o, deleted: false })));
        for (const o of cl) await db.put({ ...o, _synced: true });
      }
      let since = store.get(LS_SINCE, ""), got = 0;
      for (let guard = 0; guard < 40; guard++) {
        const rows = await cloud.pull(since);
        for (const row of rows) {
          if (row.deleted) await db.del(row.id); else if (row.data && row.data.id) await db.put({ ...row.data, _synced: true });
          since = row.updated_at; got++;
        }
        store.set(LS_SINCE, since);
        if (rows.length < 500) break;
      }
      await reloadFromDb();
      setSync({ state: "ok", at: Date.now(), msg: "", up: up.length, got });
    } catch (e) {
      setSync({ state: navigator.onLine === false ? "offline" : "error", at: Date.now(), msg: String((e && e.message) || e).slice(0, 160) });
    } finally {
      syncing.current = false;
      if (syncAgain.current) { syncAgain.current = false; setTimeout(syncNow, 400); }
    }
  };
  useEffect(() => {
    const vis = () => { if (document.visibilityState === "visible") syncNow(); };
    const iv = setInterval(() => { if (document.visibilityState === "visible") syncNow(); }, 25000);
    document.addEventListener("visibilitychange", vis); window.addEventListener("online", syncNow);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", vis); window.removeEventListener("online", syncNow); };
  }, []);
  const putLocal = (item) => db.put({ ...item, _dirty: true });
  const delCloud = (id, kind) => { const q = store.get(LS_DELQ, []); q.push({ id, kind }); store.set(LS_DELQ, q); };

  const loadWx = useCallback(async (lat, lng, fromGps) => {
    setWState("loading");
    try { const w = await fetchWeather(lat, lng); setWeather(w); setWState("ok"); lastWx.current = { lat, lng, t: Date.now(), gps: !!fromGps }; }
    catch (e) { setWState("error"); setWErr(e.name === "AbortError" ? "기상 서버가 응답하지 않아요. 잠시 뒤 새로 고침을 눌러 주세요." : "기상 정보를 불러오지 못했어요. 인터넷 연결을 확인하세요."); }
  }, []);
  // 처음엔 내 우리 동네 기준, GPS가 잡히면 현재 위치 기준
  useEffect(() => { if (!auth) return; const hm = getHome(auth.name); loadWx(hm.lat, hm.lng, false); }, [auth && auth.name]);
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition((q) => setGps({ lat: q.coords.latitude, lng: q.coords.longitude, accuracy: q.coords.accuracy }),
      () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  useEffect(() => {
    if (!gps) return; const L0 = lastWx.current;
    const moved = !L0 || !L0.gps || Math.hypot((gps.lat - L0.lat) * 111000, (gps.lng - L0.lng) * 88000) > 500;
    if (moved || Date.now() - L0.t > 600000) loadWx(gps.lat, gps.lng, true);
  }, [gps]);
  useEffect(() => { const t = setInterval(() => { const q = gpsRef.current; if (q) loadWx(q.lat, q.lng, true); else { const hm = getHome(me); loadWx(hm.lat, hm.lng, false); } }, 600000); return () => clearInterval(t); }, [me]);

  const login = (name) => { const a = { name, at: Date.now() }; store.set(LS_AUTH, a); setAuth(a); setTab("today"); };
  const logout = () => { store.del(LS_AUTH); setAuth(null); setDraft(null); setOpenId(null); setActEdit(null); setMeetEdit(null); window.scrollTo(0, 0); };
  const switchTo = (name) => { const a = { name, at: Date.now() }; store.set(LS_AUTH, a); setAuth(a); setShowSwitch(false); say(`${name} 님으로 바꿨어요`); };
  const saveMeeting = async (m) => {
    await putLocal(m); setTimeout(syncNow, 200);
    setMeetings((ms) => [m, ...ms.filter((x) => x.id !== m.id)].sort((a, b) => b.ts - a.ts)); setMeetEdit(null);
    say("협의회 기록을 저장했어요"); setTeamSub("meetings"); setTab("team");
  };
  const exportMinutes = async (ms) => {
    say("한글 협의록을 만드는 중…");
    try { const blob = await minutesHwpx(ms); saveFile(minutesFileName(ms), blob); say("한글 협의록(.hwpx)을 받았어요"); }
    catch (e) { say(e.message || "한글 파일을 만들지 못했어요"); throw e; }
  };
  useEffect(() => { let live = true;
    fetch(TEAM_AI, { method: "GET" }).then((r) => r.ok ? r.json() : null).then((j) => { if (live && j) setSettings((st) => ({ ...st, team: !!j.configured, plantnet: j.plantnet || "" })); }).catch(() => {});
    return () => { live = false; }; }, []);
  const deleteMeeting = async (id) => { await db.del(id); delCloud(id, "meeting"); setTimeout(syncNow, 200); setMeetings((ms) => ms.filter((m) => m.id !== id)); setMeetEdit(null); say("협의회 기록을 지웠어요"); };
  const addRecord = (mode) => setDraft({ mode, pos: null });
  const onMapPick = useCallback((lat, lng) => { setOpenId(null); setDraft({ mode: "team", pos: { lat, lng, source: "map", accuracy: null } }); }, []);
  const saveRecord = async (rec) => {
    const ok = await putLocal(rec); setTimeout(syncNow, 200);
    setRecords((rs) => [rec, ...rs]); setDraft(null);
    say(ok ? `${MODES[rec.mode].label} 기록 저장 · ${rec.koreanName || "식물"}` : "저장 공간이 부족해요. 아카이브에서 백업 후 정리하세요.");
    // 앱 카메라로 찍은 사진은 휴대폰 앨범에 자동으로 남지 않아서, 바로 저장할 수 있게 물어본다
    if (rec.photo && !rec.fromAlbum) setSaver({ items: [{ url: rec.photo, name: `에코쌤즈_${rec.koreanName || "식물"}_${ymd(rec.ts)}_${hm(rec.ts)}.jpg` }], title: "방금 찍은 사진, 앨범에도 남길까요?" });
    setTab(rec.mode === "solo" ? "solo" : "team");
  };
  const saveActs = async (list) => {
    for (const a of list) await putLocal(a); setTimeout(syncNow, 200);
    setActs((as) => { const mm = new Map(as.map((x) => [x.id, x])); list.forEach((a) => mm.set(a.id, a)); return [...mm.values()].sort((a, b) => b.ts - a.ts); });
    setActEdit(null); say(list.length > 1 ? `활동 사진 ${list.length}장을 올렸어요` : "활동 사진을 저장했어요");
  };
  const deleteAct = async (id) => { await db.del(id); delCloud(id, "activity"); setTimeout(syncNow, 200); setActs((as) => as.filter((a) => a.id !== id)); setActEdit(null); say("활동 사진을 지웠어요"); };
  const updateRecord = async (rec, msg) => {
    await putLocal(rec); setTimeout(syncNow, 200);
    setRecords((rs) => rs.map((r) => (r.id === rec.id ? rec : r)).sort((a, b) => b.ts - a.ts)); say(msg || "고쳤어요");
  };
  const deleteRecord = async (id) => { await db.del(id); delCloud(id, "plant"); setTimeout(syncNow, 200); setRecords((rs) => rs.filter((r) => r.id !== id)); setOpenId(null); say("기록을 지웠어요"); };
  const clearSamples = async () => { for (const r of records.filter((x) => x.sample)) await db.del(r.id); setRecords((rs) => rs.filter((r) => !r.sample)); say("예시를 지웠어요"); };
  const importJSON = (file) => {
    const rd = new FileReader();
    rd.onload = async (e) => {
      try {
        const arr = JSON.parse(e.target.result); if (!Array.isArray(arr)) throw 0;
        const ok = arr.filter((o) => o && o.id && !o.kind && typeof o.lat === "number" && o.weather && o.model).map((o) => ({ mode: "team", ...o }));
        const okA = arr.filter((o) => o && o.id && o.kind === "activity" && o.photo);
        const okM = arr.filter((o) => o && o.id && o.kind === "meeting");
        for (const o of ok.concat(okA, okM)) await putLocal(o); setTimeout(syncNow, 200);
        const merge = (rs, add) => { const mm = new Map(rs.map((r) => [r.id, r])); add.forEach((o) => mm.set(o.id, o)); return [...mm.values()].sort((a, b) => b.ts - a.ts); };
        setRecords((rs) => merge(rs, ok)); setActs((as) => merge(as, okA)); setMeetings((ms) => merge(ms, okM));
        say(`식물 ${ok.length}건 · 활동 사진 ${okA.length}장 · 협의록 ${okM.length}건을 합쳤어요`);
      } catch (_) { say("합치기 실패: 이 앱에서 보낸 JSON 파일인지 확인하세요"); }
    };
    rd.readAsText(file);
  };

  if (!auth) return html`<${Gate} onLogin=${login} />`;
  const openRec = records.find((r) => r.id === openId);
  const counts = { solo: records.filter((r) => r.mode === "solo" && r.researcher === me).length, team: records.filter((r) => r.mode === "team").length + meetings.length, activity: acts.length };

  return html`<div class=${"app tab-is-" + tab}>
    <${NavBar} tab=${tab} name=${me} canBack=${depth.current > 0 || tab !== "today"} onBack=${goBack} onHome=${goHome}
      onSwitch=${() => setShowSwitch(true)} onSettings=${() => setShowSettings(true)} onLogout=${logout} hasKey=${aiReady(settings)} />
    ${(sync.state === "error" || sync.state === "offline") && html`<button type="button" class="sync-warn" onClick=${syncNow}><${Icon} name="CloudOff" size=${14} />${sync.state === "offline" ? "인터넷 끊김 · 기록은 이 휴대폰에 먼저 저장돼요" : "팀 저장소 연결 안 됨 · 눌러서 다시 맞추기"}</button>`}
    ${tab === "today" && html`<${Hero} />`}
    <main class="wrap pb-28">
      ${!loaded ? html`<div class="boot" style=${{ minHeight: "30vh" }}>기록을 불러오는 중…</div>`
        : tab === "today" ? html`<${TodayView} me=${me} records=${records} weather=${weather} wState=${wState} wErr=${wErr} gps=${!!gps}
            onRefresh=${() => { const q = gps; if (q) loadWx(q.lat, q.lng, true); else { const hm = getHome(me); loadWx(hm.lat, hm.lng, false); } }} onAdd=${addRecord} onOpen=${setOpenId} goTab=${setTab}
            meetings=${meetings} onAddMeeting=${() => setMeetEdit({ isNew: true })} onMeetings=${() => { setTeamSub("meetings"); setTab("team"); }} />`
        : tab === "solo" ? html`<${SoloView} me=${me} records=${records} gps=${gps} onAdd=${addRecord} onOpen=${setOpenId} say=${say} />`
        : tab === "team" ? html`<${TeamView} records=${records} meetings=${meetings} sub=${teamSub} setSub=${setTeamSub} onAdd=${addRecord} onOpen=${setOpenId}
            onAddMeeting=${() => setMeetEdit({ isNew: true })} onOpenMeeting=${(m) => setMeetEdit(m)} onExportMinutes=${exportMinutes} />`
        : tab === "activity" ? html`<${ActivityView} me=${me} acts=${acts} onAdd=${() => setActEdit({ isNew: true })} onOpen=${(a) => setActEdit(a)} />`
        : tab === "map" ? html`<${MapView} records=${records} gps=${gps} follow=${follow} setFollow=${setFollow} onMapPick=${onMapPick} onOpen=${setOpenId} openId=${openId} />`
        : html`<${ArchiveView} records=${records} acts=${acts} meetings=${meetings} onOpen=${setOpenId} onOpenAct=${(a) => setActEdit(a)} onOpenMeeting=${(m) => setMeetEdit(m)} onClearSamples=${clearSamples} onImport=${importJSON} sync=${sync} onSync=${syncNow} />`}
      <footer class="text-center text-[11px] text-mist leading-relaxed mt-6">기후행동 실천모임 에코쌤즈 · 이정연 · 신민화 · 이귀리 · 정종화<br/>기상 Open-Meteo · 지도 © Esri 위성사진, OpenStreetMap · 탄소 고정 값은 대표 계수 기반 추정치</footer>
    </main>
    <${TabBar} tab=${tab} setTab=${setTab} counts=${counts} />
    ${draft && html`<${RecordModal} draft=${draft} researcher=${me} weather=${weather} settings=${settings} gps=${gps}
      onClose=${() => setDraft(null)} onSave=${saveRecord} onOpenSettings=${() => setShowSettings(true)} />`}
    ${meetEdit && html`<${MeetingModal} me=${me} item=${meetEdit.isNew ? null : meetEdit} settings=${settings} onClose=${() => setMeetEdit(null)} onSave=${saveMeeting} onDelete=${deleteMeeting}
      onExport=${exportMinutes} onOpenSettings=${() => setShowSettings(true)} />`}
    ${newVer && html`<button type="button" class="new-ver" onClick=${() => location.reload()}><${Icon} name="RefreshCw" size=${16} />새 버전이 나왔어요 · 눌러서 새로고침</button>`}
    ${saver && html`<${PhotoSaver} items=${saver.items} title=${saver.title} onClose=${() => setSaver(null)} />`}
    ${showSwitch && html`<${SwitchModal} me=${me} onPick=${switchTo} onClose=${() => setShowSwitch(false)} />`}
    ${actEdit && html`<${ActivityModal} me=${me} item=${actEdit.isNew ? null : actEdit} onClose=${() => setActEdit(null)} onSave=${saveActs} onDelete=${deleteAct} />`}
    ${openRec && !draft && html`<${DetailModal} rec=${openRec} me=${me} onClose=${() => setOpenId(null)} onDelete=${deleteRecord} onUpdate=${updateRecord} />`}
    ${showSettings && html`<${SettingsModal} settings=${settings} onClose=${() => setShowSettings(false)}
      onSave=${(s) => { setSettings(s); store.set(LS_SET, { ...store.get(LS_SET, {}), apiKey: s.apiKey, model: s.model }); setShowSettings(false); say(s.apiKey ? "AI 설정을 저장했어요" : "API 키를 지웠어요"); }} />`}
    ${toast && html`<div class="toast" role="status">${toast}</div>`}
  </div>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
