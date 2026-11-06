/* 시드핸즈 — 공통 설정, 서버 연결, 화면 부품 */
const SH = {};
SH.SUPABASE_URL = 'https://hcvaaxxwqqrbpnloyjzr.supabase.co';
SH.DEFAULT_CODE = 'SR2026'; /* 코드 없이 바로 들어가는 기본 학교 (송례중학교) */
SH.ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdmFheHh3cXFyYnBubG95anpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjI1MTgsImV4cCI6MjEwMTU5ODUxOH0.8TKT8aExXiyazDY313G9BHTvZCSu2yrTdxlgwxpNCB8';

/* ───────── 작은 도구 ───────── */
SH.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
SH.pad = n => String(n).padStart(2, '0');
SH.today = () => { const d = new Date(); return `${d.getFullYear()}-${SH.pad(d.getMonth() + 1)}-${SH.pad(d.getDate())}`; };
SH.dayOf = t => { if (!t) return ''; const d = new Date(t); return `${d.getFullYear()}-${SH.pad(d.getMonth() + 1)}-${SH.pad(d.getDate())}`; };
SH.fmt = t => { if (!t) return '-'; const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${SH.pad(d.getHours())}:${SH.pad(d.getMinutes())}`; };
SH.dot = d => d ? d.replace(/-/g, '. ') : '';
SH.distKm = (a, b) => { const R = 6371, r = x => x * Math.PI / 180; const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
SH.toast = (msg, ms = 2600) => {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
};
SH.store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

/* ───────── 서버 연결 (보안정책으로 막힌 Claude 미리보기에서는 데모 모드) ───────── */
SH.mode = 'live';
SH.cspBlocked = false;
document.addEventListener('securitypolicyviolation', e => {
  if (String(e.blockedURI || '').includes('supabase')) SH.cspBlocked = true;
});
SH.rpc = async function (fn, args) {
  if (SH.mode === 'demo') return SH.demo(fn, args || {});
  try {
    const res = await fetch(`${SH.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SH.ANON, Authorization: 'Bearer ' + SH.ANON },
      body: JSON.stringify(args || {})
    });
    if (!res.ok) throw new Error('서버가 응답하지 않아요 (' + res.status + '). 잠시 뒤 다시 해 주세요.');
    return res.json();
  } catch (e) {
    await new Promise(r => setTimeout(r, 60));
    if (SH.cspBlocked) { SH.enterDemo(); return SH.demo(fn, args || {}); }
    if (e instanceof TypeError) throw new Error('인터넷 연결이 불안정해요. 연결을 확인하고 다시 해 주세요.');
    throw e;
  }
};
SH.enterDemo = function () {
  if (SH.mode === 'demo') return;
  SH.mode = 'demo';
  const b = document.createElement('div'); b.className = 'demo-bar';
  const isAdmin = /admin\.html/.test(location.pathname);
  b.innerHTML = `<div class="demo-switch" role="tablist" aria-label="화면 바꾸기"><a href="index.html" class="${isAdmin ? '' : 'on'}">학생 화면</a><a href="admin.html" class="${isAdmin ? 'on' : ''}">선생님 화면</a></div>
    <div><b>미리보기</b>: 기록은 이 브라우저에만 저장돼요. ${isAdmin ? '학교 코드 <b>SR2026</b>, 관리자 비밀번호 <b>songrye-seed26</b>' : '아무 학번·이름·비밀번호로 새로 가입해 보세요. 예시 학생(20103 김하늘)의 비밀번호는 <b>0000</b>'}</div>`;
  document.body.prepend(b);
};
/* 처음 열 때 서버 연결이 막혀 있는지 확인 (Claude 미리보기 감지) */
SH.probe = async function () {
  try { await fetch(`${SH.SUPABASE_URL}/rest/v1/`, { method: 'HEAD', headers: { apikey: SH.ANON } }); } catch {}
  await new Promise(r => setTimeout(r, 60));
  if (SH.cspBlocked) SH.enterDemo();
};
document.addEventListener('DOMContentLoaded', () => SH.probe());

/* ───────── 시드볼트 단계 ───────── */
SH.STATUS = [
  { id: 'collected', label: '채종 완료', desc: '산에서 씨앗을 받아 기록했어요' },
  { id: 'drying', label: '건조 중', desc: '종이봉투에 담아 그늘에서 말리고 있어요' },
  { id: 'cleaned', label: '정선 완료', desc: '껍질·과육·쭉정이를 골라냈어요' },
  { id: 'packed', label: '포장·라벨 완료', desc: '기탁용 봉투에 담고 라벨을 붙였어요' },
  { id: 'deposited', label: '시드볼트 입고', desc: '백두대간 글로벌 시드볼트에 들어갔어요' }
];
SH.STATUS_REJ = { id: 'rejected', label: '보완 필요', desc: '선생님이 고칠 점을 남겼어요' };
SH.ST = Object.fromEntries([...SH.STATUS, SH.STATUS_REJ].map(s => [s.id, s]));
SH.stIndex = id => Math.max(0, SH.STATUS.findIndex(s => s.id === id));

/* ───────── 채종 기록 항목 ───────── */
SH.ACC = {
  idConf: ['확실해요', '아마도', '잘 모르겠어요'],
  origin: ['원래 자라던 곳 (야생)', '누가 심은 것 (조경·화단)', '잘 모르겠어요'],
  habitat: ['숲 속', '숲 가장자리', '등산로 옆', '계곡·물가', '바위 지대', '풀밭', '공원·학교 화단'],
  form: ['큰키나무', '작은키나무·관목', '풀', '덩굴'],
  popSize: ['1~9그루', '10~49그루', '50~99그루', '100그루 이상'],
  share: ['10% 이하', '10~20%', '20%보다 많이'],
  ripe: ['다 익었어요', '거의 익었어요', '덜 익었어요'],
  fruitState: ['바싹 말랐어요', '저절로 벌어졌어요', '촉촉해요 (과육 있음)'],
  health: ['건강해요', '벌레 먹은 씨가 조금', '벌레 먹은 씨가 많음']
};

/* 기탁 준비도 — 시드볼트로 보내기 좋은 기록인지 확인하는 8가지 */
SH.readiness = function (a) {
  const d = a.data || {};
  const items = [
    ['식물 이름(학명)', !!(d.plant && d.sci)],
    ['채종 위치(GPS)', !!(d.lat && d.lng)],
    ['채종 날짜', !!d.date],
    ['야생에서 자란 식물', d.origin === SH.ACC.origin[0]],
    ['50그루 이상인 무리', d.popSize === SH.ACC.popSize[2] || d.popSize === SH.ACC.popSize[3]],
    ['열매의 20% 이하만 채종', d.share === SH.ACC.share[0] || d.share === SH.ACC.share[1]],
    ['다 익은 열매', d.ripe === SH.ACC.ripe[0]],
    ['식물·씨앗 사진', !!((a.photo_plant || a.has_plant) && (a.photo_seed || a.has_seed || a.photo_fruit || a.has_fruit))]
  ];
  return { items, score: items.filter(x => x[1]).length, total: items.length };
};

/* ───────── 관찰 노트 (배움 활동) ───────── */
SH.MISSIONS = [
  { id: 'leaf', title: '잎', sub: '붙는 방식, 모양, 테두리', color: '#6E9A5B',
    intro: '잎자루에 잎이 몇 장 붙는지, 줄기에 어떤 순서로 나는지, 테두리가 어떤지만 봐도 이름에 가까워져요.',
    groups: [
      { key: 'comp', label: '잎자루 하나에 잎이 몇 장인가요?', opts: 'comp', help: { '홑잎': '잎자루 하나에 잎 한 장', '겹잎': '잎자루 하나에 작은잎 여러 장' } },
      { key: 'arr', label: '줄기에 잎이 붙는 순서', opts: 'arr', help: { '어긋나기': '마디마다 한 장씩 번갈아', '마주나기': '마디마다 두 장이 마주 봐요', '돌려나기·모여나기': '세 장 이상이 둘러나요' } },
      { key: 'shape', label: '잎몸 모양', opts: 'shape' },
      { key: 'edge', label: '잎 테두리', opts: 'edge' }
    ], compare: ['comp', 'arr', 'shape', 'edge'], sketchHint: '잎의 윤곽과 잎맥을 그려 보세요' },
  { id: 'flower', title: '꽃', sub: '꽃이 모여 피는 방식', color: '#C76A8C',
    intro: '꽃은 혼자 피기도, 줄지어 피기도, 우산처럼 모여 피기도 해요. 늦가을에는 국화과 들꽃을 찾아보세요.',
    groups: [
      { key: 'infl', label: '꽃이 달리는 모양 (꽃차례)', opts: 'infl' },
      { key: 'flc', label: '꽃 색깔', type: 'text', ph: '예: 노란색' },
      { key: 'scent', label: '향기', list: ['있어요', '없어요'] },
      { key: 'petals', label: '꽃잎 수', type: 'text', ph: '예: 5장' },
      { key: 'sex', label: '암술과 수술이 한 꽃에 같이 있나요?', list: ['같이 있어요 (양성화)', '따로 있어요 (단성화)', '잘 모르겠어요'] }
    ], compare: ['infl', 'flc'], sketchHint: '꽃잎이 놓인 모양과 꽃송이 전체를 그려 보세요' },
  { id: 'bark', title: '나무껍질과 겨울눈', sub: '잎이 없어도 이름 찾기', color: '#9A6B45',
    intro: '잎이 진 겨울에도 껍질 무늬, 겨울눈, 잎이 떨어진 자국(엽흔)으로 나무를 알아볼 수 있어요.',
    groups: [
      { key: 'touch', label: '손으로 만진 느낌', list: ['거칠어요', '매끈해요'] },
      { key: 'bark', label: '나무껍질 특징', opts: 'bark' },
      { key: 'bud', label: '찾은 겨울눈', multi: true, list: ['끝눈 (가지 맨 끝)', '곁눈 (가지 옆)', '꽃눈 (동글동글)', '잎눈 (뾰족)', '잎자국 (엽흔)'] },
      { key: 'scales', label: '겨울눈 비늘 수와 털', type: 'text', ph: '예: 비늘 4장, 갈색 털' }
    ], compare: ['bark'], sketchHint: '껍질 무늬나 겨울눈, 잎자국을 그려 보세요' },
  { id: 'hair', title: '식물의 털', sub: '루페로 숨은 털 찾기', color: '#7262A8',
    intro: '맨눈에는 안 보이던 털이 루페로 보면 별처럼, 이슬방울처럼 숨어 있어요. 잎 뒷면과 줄기를 살펴보세요.',
    groups: [
      { key: 'tool', label: '관찰 도구', list: ['맨눈', '루페·돋보기', '현미경', '휴대폰 접사'] },
      { key: 'where', label: '관찰한 부분', multi: true, list: ['잎 앞면', '잎 뒷면', '잎자루', '줄기', '꽃받침', '열매'] },
      { key: 'density', label: '털이 얼마나 많나요?', list: ['없어요', '드문드문', '보통', '빽빽해요'] },
      { key: 'hairType', label: '털 모양', multi: true, list: ['곧게 선 털', '한쪽으로 누운 털', '끈적한 방울 털 (샘털)', '별 모양 털', '갈라진 털'] },
      { key: 'feel', label: '촉감과 색', multi: true, list: ['부드러워요', '까슬까슬', '끈적끈적', '흰색', '은빛', '갈색'] }
    ], compare: [], sketchHint: '확대해서 본 털을 크게 그려 보세요' }
];
SH.M = Object.fromEntries(SH.MISSIONS.map(m => [m.id, m]));
SH.noteDone = rec => {
  if (!rec) return false; const d = rec.data || {};
  return !!(d.plant && (Object.keys(d).some(k => !['plant', 'sci', 'family', 'date', 'place', 'lat', 'lng', 'acc', 'taxon'].includes(k) && (Array.isArray(d[k]) ? d[k].length : d[k])) || rec.sketch || rec.photo || rec.has_sketch || rec.has_photo));
};

/* ───────── 화면 안 대화상자 ───────── */
SH.dialog = function ({ title = '', msg = '', input = null, ok = '확인', cancel = '취소', danger = false } = {}) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.style.cssText = 'position:fixed;inset:0;background:rgba(15,30,24,.42);z-index:180;display:flex;align-items:center;justify-content:center;padding:20px';
    bg.innerHTML = `<div role="dialog" aria-modal="true" style="background:var(--paper);border-radius:20px;max-width:380px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.2)">
      ${title ? `<h3 style="font-size:20px;margin-bottom:8px">${SH.esc(title)}</h3>` : ''}
      <p style="margin:0 0 16px;color:var(--ink-2);font-size:15px">${SH.esc(msg)}</p>
      ${input !== null ? `<input class="inp" data-dlgin value="${SH.esc(input)}" style="margin-bottom:16px">` : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn line sm" data-dlgc>${SH.esc(cancel)}</button>
        <button class="btn sm" data-dlgo ${danger ? 'style="background:var(--alert)"' : ''}>${SH.esc(ok)}</button>
      </div></div>`;
    document.body.appendChild(bg);
    const inp = bg.querySelector('[data-dlgin]'); (inp || bg.querySelector('[data-dlgo]')).focus();
    const done = v => { bg.remove(); resolve(v); };
    bg.querySelector('[data-dlgc]').onclick = () => done(false);
    bg.querySelector('[data-dlgo]').onclick = () => done(inp ? inp.value : true);
    bg.onclick = e => { if (e.target === bg) done(false); };
    bg.onkeydown = e => { if (e.key === 'Escape') done(false); if (e.key === 'Enter' && inp) done(inp.value); };
  });
};
SH.print = function () {
  if (SH.mode === 'demo') { SH.toast('미리보기에서는 인쇄가 막혀 있어요. 실제 사이트에서 인쇄할 수 있어요.'); return false; }
  try { window.print(); return true; } catch { SH.toast('인쇄 창을 열지 못했어요.'); return false; }
};

/* ───────── QR 코드 ───────── */
SH.qrSVG = function (text, { size = 220, fg = '#143A2E', bg = '#fff', quiet = 3, logo = true } = {}) {
  if (!window.SHQR) return '';
  const m = window.SHQR(text, logo ? 'H' : 'M'), n = m.length, N = n + quiet * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  const L = logo ? (() => { const w = Math.round(n * 0.2), x = (N - w) / 2; return `<rect x="${x - 0.8}" y="${x - 0.8}" width="${w + 1.6}" height="${w + 1.6}" rx="1.6" fill="${bg}"/>` + SH.logo(w).replace('<svg ', `<svg x="${x}" y="${x}" `).replace(/ aria-hidden="true"/, ''); })() : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR 코드"><rect width="${N}" height="${N}" fill="${bg}"/><path d="${d}" fill="${fg}"/>${L}</svg>`;
};
SH.qrPNG = function (text, px = 1200) {
  return new Promise((res, rej) => {
    const svg = SH.qrSVG(text, { size: px }), img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, px, px); res(c.toDataURL('image/png')); };
    img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
};

/* ───────── 사진 줄이기 ───────── */
SH.shrinkImage = function (file, max = 1100, q = 0.74) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height; const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(url);
      let qq = q, out = c.toDataURL('image/jpeg', qq);
      while (out.length > 850000 && qq > 0.3) { qq -= 0.1; out = c.toDataURL('image/jpeg', qq); }
      res(out);
    };
    img.onerror = rej; img.src = url;
  });
};

/* ───────── 그리기 판 (선을 기억해서 '매끈하게' 보정할 수 있어요) ───────── */
SH.makeSketch = function (host, hint, initial, onChange) {
  const W = 1000, H = 700;
  const colors = ['#1F2A24', '#22543F', '#6E9A5B', '#9A6B45', '#D9982B', '#C76A8C', '#2F5D7C', '#7262A8'];
  host.classList.add('sk-host');
  host.innerHTML = `<div class="sk-tools" role="toolbar" aria-label="그리기 도구">
      ${colors.map((c, i) => `<button type="button" class="sk-sw ${i ? '' : 'on'}" style="background:${c}" data-c="${c}" aria-label="색 ${i + 1}"></button>`).join('')}
      <span class="sk-sep"></span>
      ${[3, 8, 16].map((s, i) => `<button type="button" class="sk-btn sz ${i ? '' : 'on'}" data-s="${s}" aria-label="굵기 ${i + 1}"><span class="dot" style="width:${4 + i * 5}px;height:${4 + i * 5}px"></span></button>`).join('')}
      <span class="sk-sep"></span>
      <button type="button" class="sk-btn" data-t="eraser" title="지우개" aria-label="지우개">🧽</button>
      <button type="button" class="sk-btn" data-t="undo" title="되돌리기" aria-label="되돌리기">↶</button>
      <button type="button" class="sk-btn" data-t="redo" title="다시하기" aria-label="다시하기">↷</button>
      <button type="button" class="sk-btn" data-t="clear" title="모두 지우기" aria-label="모두 지우기">🗑️</button>
      <button type="button" class="sk-btn" data-t="trace" title="사진 따라 그리기" aria-label="사진 따라 그리기">🖼️</button>
      <button type="button" class="sk-btn" data-t="full" title="크게 그리기" aria-label="크게 그리기">⛶</button>
      <button type="button" class="sk-btn sk-magic" data-t="smooth" title="삐뚤빼뚤한 선을 매끈하게" aria-label="선 매끈하게">✨ 매끈하게</button>
    </div>
    <div class="sk-wrap"><img class="trace hidden" alt=""><canvas width="${W}" height="${H}" aria-label="그림 그리는 곳"></canvas><div class="sk-hint">${SH.esc(hint)}</div></div>`;
  const cv = host.querySelector('canvas'), ctx = cv.getContext('2d');
  const hintEl = host.querySelector('.sk-hint'), traceImg = host.querySelector('.trace'), traceBtn = host.querySelector('[data-t=trace]');
  let color = colors[0], size = 3, eraser = false, cur = null, traceOn = false, traceSrc = null, dirty = false, base = null;
  let strokes = []; const hist = [], fut = [];
  const snap = () => { hist.push({ strokes: JSON.parse(JSON.stringify(strokes)), base }); if (hist.length > 40) hist.shift(); fut.length = 0; };
  const has = () => !!(base || strokes.length);
  const changed = () => { dirty = true; hintEl.style.display = has() ? 'none' : ''; onChange && onChange(); };
  function path(st) {
    const p = st.pts; ctx.globalCompositeOperation = st.er ? 'destination-out' : 'source-over'; ctx.strokeStyle = st.c; ctx.fillStyle = st.c; ctx.lineWidth = st.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (p.length < 2) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], st.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]); ctx.stroke();
  }
  function render() { ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H); if (base) ctx.drawImage(base, 0, 0, W, H); strokes.forEach(path); ctx.globalCompositeOperation = 'source-over'; hintEl.style.display = has() ? 'none' : ''; }
  if (initial) { const im = new Image(); im.onload = () => { base = im; render(); }; im.src = initial; }
  const pos = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width * 10) / 10, Math.round((e.clientY - r.top) * H / r.height * 10) / 10]; };
  cv.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); snap(); cur = { c: color, w: eraser ? size * 3 + 10 : size, er: eraser, pts: [pos(e)] }; strokes.push(cur); path(cur); hintEl.style.display = 'none'; });
  cv.addEventListener('pointermove', e => {
    if (!cur) return; e.preventDefault();
    for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) { const p = pos(ev), l = cur.pts[cur.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 1.2) cur.pts.push(p); }
    const n = cur.pts.length; if (n >= 2) { const seg = { ...cur, pts: cur.pts.slice(Math.max(0, n - 3)) }; path(seg); ctx.globalCompositeOperation = 'source-over'; }
  });
  const end = () => { if (cur) { cur = null; render(); changed(); } };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => cv.addEventListener(t, end));
  /* 매끈하게: 손떨림을 줄이는 이동평균 + 모서리를 둥글게 하는 차이킨 보정 */
  function smoothPts(p) {
    if (p.length < 4) return p;
    let q = p.map((pt, i) => { if (i === 0 || i === p.length - 1) return pt; let sx = 0, sy = 0, n = 0; for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < p.length) { sx += p[j][0]; sy += p[j][1]; n++; } } return [sx / n, sy / n]; });
    for (let it = 0; it < 2; it++) { const r = [q[0]]; for (let i = 0; i < q.length - 1; i++) { const a = q[i], b = q[i + 1]; r.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } r.push(q[q.length - 1]); q = r; }
    return q.filter((_, i) => i % 2 === 0 || i === q.length - 1);
  }
  host.querySelector('[data-t=smooth]').onclick = () => {
    if (!strokes.some(s => !s.er && s.pts.length > 3)) return SH.toast(base ? '예전에 저장한 그림은 보정할 수 없어요. 새로 그린 선만 매끈하게 바뀌어요.' : '먼저 선을 그려 주세요.');
    snap(); strokes = strokes.map(s => s.er ? s : { ...s, pts: smoothPts(s.pts) }); render(); changed();
    SH.toast('✨ 선이 매끈해졌어요. 마음에 안 들면 ↶ 되돌리기를 눌러요.');
  };
  host.querySelectorAll('.sk-sw').forEach(b => b.onclick = () => { color = b.dataset.c; eraser = false; host.querySelectorAll('.sk-sw').forEach(x => x.classList.toggle('on', x === b)); host.querySelector('[data-t=eraser]').classList.remove('on'); });
  host.querySelectorAll('.sz').forEach(b => b.onclick = () => { size = +b.dataset.s; host.querySelectorAll('.sz').forEach(x => x.classList.toggle('on', x === b)); });
  host.querySelector('[data-t=eraser]').onclick = e => { eraser = !eraser; e.currentTarget.classList.toggle('on', eraser); };
  host.querySelector('[data-t=undo]').onclick = () => { if (!hist.length) return; fut.push({ strokes, base }); const h = hist.pop(); strokes = h.strokes; base = h.base; render(); changed(); };
  host.querySelector('[data-t=redo]').onclick = () => { if (!fut.length) return; hist.push({ strokes, base }); const h = fut.pop(); strokes = h.strokes; base = h.base; render(); changed(); };
  host.querySelector('[data-t=clear]').onclick = async () => { if (!has() || !(await SH.dialog({ msg: '그림을 모두 지울까요?', ok: '지우기', danger: true }))) return; snap(); strokes = []; base = null; render(); changed(); };
  traceBtn.onclick = () => { if (!traceSrc) return SH.toast('먼저 사진을 넣으면 그 위에 따라 그릴 수 있어요.'); traceOn = !traceOn; traceImg.classList.toggle('hidden', !traceOn); traceBtn.classList.toggle('on', traceOn); };
  const card = host.closest('.card') || host;
  host.querySelector('[data-t=full]').onclick = e => { const on = card.classList.toggle('sk-full'); e.currentTarget.classList.toggle('on', on); document.body.style.overflow = on ? 'hidden' : ''; };
  return {
    get dirty() { return dirty; },
    hasInk: has,
    exportJPEG() {
      if (!has()) return null;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(cv, 0, 0);
      let q = .82, out = c.toDataURL('image/jpeg', q);
      while (out.length > 650000 && q > .35) { q -= .12; out = c.toDataURL('image/jpeg', q); }
      return out;
    },
    setTrace(src) { traceSrc = src || null; if (src) traceImg.src = src; else { traceOn = false; traceImg.classList.add('hidden'); traceBtn.classList.remove('on'); } }
  };
};

/* ───────── 위치 ───────── */
SH.locate = () => new Promise((res, rej) => {
  if (!navigator.geolocation) return rej(new Error('이 기기는 위치 기능을 쓸 수 없어요.'));
  navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy), alt: p.coords.altitude != null ? Math.round(p.coords.altitude) : null }),
    e => rej(new Error(e.code === 1 ? '위치 권한을 허용해 주세요. 주소창 옆 자물쇠 아이콘에서 바꿀 수 있어요.' : '위치를 찾지 못했어요. 하늘이 보이는 곳에서 다시 해 주세요.')),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 });
});

/* ───────── 식물 고르기 (주변 관찰 기록 + 도감) ───────── */
SH._near = {};
SH.fetchNearby = async function (lat, lng) {
  const key = lat.toFixed(3) + ',' + lng.toFixed(3);
  if (SH._near[key]) return SH._near[key];
  let results = [];
  for (const radius of [0.7, 2, 5]) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch(`https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=${radius}&taxon_id=47126&locale=ko&per_page=60&verifiable=true`, { signal: ctl.signal });
      const j = await r.json();
      results = (j.results || []).filter(x => x.taxon && ['species', 'subspecies', 'variety', 'form', 'hybrid'].includes(x.taxon.rank));
    } finally { clearTimeout(tm); }
    if (results.length >= 12) break;
  }
  return SH._near[key] = results.map(x => {
    const t = x.taxon, cur = SH.findPlant(null, t.name);
    const kn = t.preferred_common_name && /[가-힣]/.test(t.preferred_common_name) ? t.preferred_common_name : null;
    return { n: cur?.n || kn || t.name, s: t.name, f: cur?.f || '', id: t.id, count: x.count, photo: t.default_photo?.square_url, cur, ko: !!(cur || kn) };
  });
};
SH.familyOf = async function (taxonId) {
  try {
    const j = await (await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}?locale=ko`)).json();
    const fam = (j.results?.[0]?.ancestors || []).find(a => a.rank === 'family');
    return fam ? (fam.preferred_common_name && /[가-힣]/.test(fam.preferred_common_name) ? fam.preferred_common_name : fam.name) : '';
  } catch { return ''; }
};
SH.openPlantPicker = function ({ fix, prefer = 'any', onPick, onNeedGPS }) {
  const month = new Date().getMonth() + 1;
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-label="식물 고르기">
    <div class="sheet-head"><h3>어떤 식물인가요?</h3><button class="btn ghost" data-x>닫기</button></div>
    <div class="seg"><button data-tab="near">📍 내 주변</button><button data-tab="book">📖 도감</button><button data-tab="find">🔤 이름 검색</button></div>
    <input class="inp" placeholder="이름으로 찾기 (예: 참나무, 국화과)" data-q style="margin-bottom:10px" autocomplete="off">
    <div class="plist" data-list></div></div>`;
  document.body.appendChild(bg); document.body.style.overflow = 'hidden';
  const close = () => { bg.remove(); document.body.style.overflow = ''; };
  bg.onclick = e => { if (e.target === bg) close(); }; bg.querySelector('[data-x]').onclick = close;
  const list = bg.querySelector('[data-list]'), q = bg.querySelector('[data-q]');
  let tab = fix ? 'near' : 'book', near = null;
  const pills = p => (p.fm?.includes(month) ? '<span class="pill seed">지금 열매</span>' : '') + (p.flm?.includes(month) ? '<span class="pill">지금 꽃</span>' : '') + (p.caution ? '<span class="pill alert">주의</span>' : '');
  const icon = p => `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3E6A2F" stroke-width="1.6">${p.t === '풀' ? '<path d="M12 21V11M12 11c-4 0-6-3-6-6 4 0 6 2 6 6zM12 14c3 0 5-2 5-5-3 0-5 2-5 5z"/>' : p.shape === '바늘·선형' ? '<path d="M12 3l6 9h-3l4 6H5l4-6H6z M12 18v3"/>' : '<circle cx="12" cy="9" r="6"/><path d="M12 15v6"/>'}</svg>`;
  function book() {
    const kw = q.value.trim();
    let arr = SH.PLANTS.filter(p => !kw || p.n.includes(kw) || p.f.includes(kw) || p.s.toLowerCase().includes(kw.toLowerCase()));
    const score = p => prefer === 'fruit' ? (p.fm?.includes(month) ? 0 : 1) : prefer === 'flower' ? (p.flm?.includes(month) ? 0 : 1) : 0;
    arr = arr.slice().sort((a, b) => score(a) - score(b));
    list.innerHTML = (arr.map(p => `<button class="pitem" data-n="${SH.esc(p.n)}"><div class="ph">${icon(p)}</div><div><b>${SH.esc(p.n)}</b>${pills(p)}<span class="meta"><span class="sci">${SH.esc(p.s)}</span> ${SH.esc(p.f)}</span></div></button>`).join('')
      || `<div class="empty">도감에 없는 식물이에요.<br><br><button class="btn sm" data-gofind>🔤 이름 검색으로 찾기</button></div>`) + `<div class="empty small">전국 낮은 산에서 흔히 만나는 ${SH.PLANTS.length}종을 담았어요.</div>`;
    list.querySelectorAll('.pitem').forEach(b => b.onclick = () => { const p = SH.PLANTS.find(x => x.n === b.dataset.n); close(); onPick({ n: p.n, s: p.s, f: p.f }); });
    const gf = list.querySelector('[data-gofind]'); if (gf) gf.onclick = () => go('find');
  }
  async function nearby() {
    if (!fix) { list.innerHTML = `<div class="empty">위치를 먼저 찾으면 이 근처에서 실제로 관찰된 식물을 보여 드려요.<br><br><button class="btn sm" data-gps>내 위치 찾기</button></div>`; list.querySelector('[data-gps]').onclick = () => { close(); onNeedGPS && onNeedGPS(); }; return; }
    if (!near) {
      list.innerHTML = '<div class="empty"><span class="spin"></span><br>이 근처에서 관찰된 식물을 불러오고 있어요</div>';
      try { near = await SH.fetchNearby(fix.lat, fix.lng); }
      catch { list.innerHTML = '<div class="empty">주변 관찰 기록을 불러오지 못했어요. 인터넷 연결을 확인하거나 도감 탭에서 골라 주세요.</div>'; return; }
    }
    const kw = q.value.trim();
    const arr = near.filter(p => !kw || p.n.includes(kw) || p.s.toLowerCase().includes(kw.toLowerCase()) || (p.f || '').includes(kw))
      .sort((a, b) => (b.cur ? 1 : 0) - (a.cur ? 1 : 0) || (b.ko ? 1 : 0) - (a.ko ? 1 : 0) || b.count - a.count);
    list.innerHTML = '<div class="small muted" style="padding:0 4px 4px">시민과학 플랫폼 iNaturalist에 이 근처에서 실제로 기록된 식물이에요. 많이 기록된 순서예요.</div>' +
      (arr.map(p => `<button class="pitem" data-i="${near.indexOf(p)}">${p.photo ? `<img src="${p.photo}" alt="" loading="lazy">` : '<div class="ph"></div>'}<div><b>${SH.esc(p.n)}</b>${p.cur ? '<span class="pill">도감</span>' + pills(p.cur) : ''}<span class="meta"><span class="sci">${SH.esc(p.s)}</span> ${SH.esc(p.f || '')}</span><span class="meta">근처 관찰 ${p.count}회</span></div></button>`).join('')
        || '<div class="empty">근처 기록이 없어요. 도감 탭에서 골라 주세요.</div>');
    list.querySelectorAll('.pitem').forEach(b => b.onclick = async () => {
      const p = near[+b.dataset.i]; close();
      let f = p.f; if (!f) f = await SH.familyOf(p.id);
      onPick({ n: p.n, s: p.s, f, id: p.id });
    });
  }
  let findTimer = null, findSeq = 0;
  async function find() {
    const kw = q.value.trim();
    q.placeholder = '식물 이름을 써 보세요 (예: 뽀리뱅이, 고마리)';
    if (kw.length < 1) { list.innerHTML = '<div class="empty">🔤 우리말 이름이나 학명을 쓰면<br>전 세계 식물 목록에서 찾아 줘요.</div>'; return; }
    const local = SH.PLANTS.filter(p => p.n.includes(kw) || p.s.toLowerCase().includes(kw.toLowerCase()));
    const seq = ++findSeq;
    list.innerHTML = '<div class="empty"><span class="spin"></span> 찾는 중</div>';
    let res = [];
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 9000);
      const j = await (await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(kw)}&taxon_id=47126&locale=ko&per_page=25`, { signal: ctl.signal })).json();
      clearTimeout(tm);
      res = (j.results || []).filter(t => ['species', 'subspecies', 'variety', 'form', 'hybrid'].includes(t.rank));
    } catch { if (seq === findSeq && !local.length) { list.innerHTML = '<div class="empty">지금은 이름 검색을 할 수 없어요. 인터넷 연결을 확인하거나 도감 탭을 이용해 주세요.</div>'; return; } }
    if (seq !== findSeq) return;
    const seen = new Set(local.map(p => p.s.toLowerCase()));
    const items = [...local.map(p => ({ n: p.n, s: p.s, f: p.f, cur: p })), ...res.filter(t => !seen.has(t.name.toLowerCase())).map(t => {
      const kn = t.preferred_common_name && /[가-힣]/.test(t.preferred_common_name) ? t.preferred_common_name : (t.matched_term && /[가-힣]/.test(t.matched_term) ? t.matched_term : null);
      return { n: kn || t.name, s: t.name, f: '', id: t.id, photo: t.default_photo?.square_url, ko: !!kn };
    })].sort((a, b) => (b.cur ? 2 : b.ko ? 1 : 0) - (a.cur ? 2 : a.ko ? 1 : 0));
    list.innerHTML = items.length ? items.map((p, i) => `<button class="pitem" data-i="${i}">${p.photo ? `<img src="${p.photo}" alt="" loading="lazy">` : `<div class="ph">${p.cur ? icon(p.cur) : '🌿'}</div>`}<div><b>${SH.esc(p.n)}</b>${p.cur ? '<span class="pill">도감</span>' + pills(p.cur) : ''}<span class="meta"><span class="sci">${SH.esc(p.s)}</span> ${SH.esc(p.f || '')}</span></div></button>`).join('')
      + '<div class="empty small">iNaturalist 전체 식물 목록에서 찾았어요. 과·속 이름은 고르면 자동으로 채워져요.</div>'
      : '<div class="empty">찾는 식물이 없어요. 띄어쓰기 없이 다시 써 보거나, 이름 칸에 직접 적어도 돼요.</div>';
    list.querySelectorAll('.pitem').forEach(b => b.onclick = async () => {
      const p = items[+b.dataset.i]; close();
      if (p.cur) return onPick({ n: p.cur.n, s: p.cur.s, f: p.cur.f });
      const x = await SH.taxonInfo(p.id);
      onPick({ n: p.n, s: p.s, f: x.family || '', id: p.id });
    });
  }
  const go = t => {
    tab = t; bg.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x.dataset.tab === t));
    if (t !== 'find') q.placeholder = '이름으로 찾기 (예: 참나무, 국화과)';
    t === 'near' ? nearby() : t === 'find' ? find() : book();
  };
  bg.querySelectorAll('.seg button').forEach(x => x.onclick = () => go(x.dataset.tab));
  q.oninput = () => { if (tab === 'find') { clearTimeout(findTimer); findTimer = setTimeout(find, 350); } else go(tab); };
  go(tab);
};

/* ───────── 미리보기(데모) 백엔드 — 이 브라우저에만 저장 ───────── */
SH._db = null;
SH._demoDB = function () {
  if (SH._db) return SH._db;
  let db = SH.store.get('sh_demo_v4');
  if (!db) {
    const now = Date.now(), iso = t => new Date(t).toISOString();
    db = { superPw: 'seedvault-demo', schools: [{ id: 'sc1', code: 'SR2026', name: '송례중학교', inst_name: '송례중학교', region: '서울특별시', site_name: '대모산', site_lat: 37.4772, site_lng: 127.0789, contact: '', pw: 'songrye-seed26', acc_seq: 0, created_at: iso(now - 864e6) }], students: [], records: [], accs: [], sessions: {} };
    const names = ['김하늘', '이도윤', '박서연', '최지우', '정민준', '한예린', '오시우'];
    const picks = [['노박덩굴', 'Celastrus orbiculatus', '노박덩굴과', '덩굴', '여러 갈래로 터짐 (삭과)'], ['산국', 'Chrysanthemum boreale', '국화과', '풀', '딱딱한 열매 (견과·수과)'], ['팥배나무', 'Sorbus alnifolia', '장미과', '큰키나무', '사과 모양 (이과)'], ['싸리', 'Lespedeza bicolor', '콩과', '작은키나무·관목', '꼬투리 (협과)'], ['당단풍나무', 'Acer pseudosieboldianum', '무환자나무과', '큰키나무', '날개 열매 (시과)'], ['쑥부쟁이', 'Aster yomena', '국화과', '풀', '딱딱한 열매 (견과·수과)'], ['화살나무', 'Euonymus alatus', '노박덩굴과', '작은키나무·관목', '여러 갈래로 터짐 (삭과)']];
    const sts = ['deposited', 'packed', 'cleaned', 'drying', 'collected', 'rejected', 'collected'];
    names.forEach((n, i) => {
      const id = 'st' + i; db.students.push({ id, school_id: 'sc1', no: `2${SH.pad(i % 3 + 1)}${SH.pad(i + 3)}`, name: n, pin: '0000', created_at: iso(now - 7 * 864e5), last_login: iso(now - i * 36e5) });
      const p = picks[i];
      db.schools[0].acc_seq++;
      db.accs.push({ id: 'a' + i, school_id: 'sc1', student_id: id, acc_no: `SR2026-2026-${String(db.schools[0].acc_seq).padStart(3, '0')}`, status: sts[i],
        teacher_note: sts[i] === 'rejected' ? '열매가 덜 익었어요. 다음 탐사 때 다 익은 열매로 다시 받아 볼까요?' : null,
        data: { date: SH.dayOf(now - (i + 1) * 864e5 * 3), place: '대모산 불국사 가는 길', country: '대한민국', address: '서울특별시 강남구 일원동 대모산', identifier: n + ', 담당 교사', lat: 37.4752 + 0.0012 * i, lng: 127.0742 + 0.0015 * (i % 4), acc: 8, alt: 120 + i * 18, plant: p[0], sci: p[1], family: p[2], idConf: SH.ACC.idConf[i % 2], origin: SH.ACC.origin[0], habitat: SH.ACC.habitat[i % 4], form: p[3], popSize: SH.ACC.popSize[i % 2 ? 3 : 2], plantsSampled: String(10 + i * 4), share: SH.ACC.share[i === 6 ? 2 : 0], fruit: p[4], ripe: SH.ACC.ripe[sts[i] === 'rejected' ? 2 : 0], fruitState: SH.ACC.fruitState[0], seedCount: String(120 + i * 85), seedNote: '', health: SH.ACC.health[0], drying: true, team: '' },
        photo_plant: null, photo_fruit: null, photo_seed: null, sketch: null, created_at: iso(now - (i + 1) * 864e5 * 3), updated_at: iso(now - i * 36e5) });
      const cols = ['#6E9A5B', '#C76A8C', '#9A6B45', '#7262A8', '#D9982B', '#2F5D7C', '#22543F'], ms = ['leaf', 'flower', 'bark', 'hair', 'leaf', 'flower', 'leaf'];
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 700'><rect width='1000' height='700' fill='white'/><path d='M500 620 C${300 + i * 20} 520 ${260 + i * 10} 260 500 90 C${740 - i * 10} 260 ${700 - i * 20} 520 500 620Z' fill='none' stroke='${cols[i]}' stroke-width='14' stroke-linecap='round'/><path d='M500 600 L500 130' stroke='${cols[i]}' stroke-width='8'/>${[0, 1, 2, 3].map(k => `<path d='M500 ${520 - k * 95} L${400 - k * 8} ${450 - k * 95}M500 ${520 - k * 95} L${600 + k * 8} ${450 - k * 95}' stroke='${cols[i]}' stroke-width='6' stroke-linecap='round'/>`).join('')}</svg>`;
      db.records.push({ id: 'r' + i, student_id: id, mission: ms[i], data: { plant: ['신갈나무', '산국', '서어나무', '굴참나무', '생강나무', '쑥부쟁이', '당단풍나무'][i], comp: '홑잎', arr: '어긋나기', date: SH.dayOf(now - i * 864e5) }, sketch: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), photo: null, updated_at: iso(now - i * 72e5) });
    });
  }
  return SH._db = db;
};
SH._save = () => SH.store.set('sh_demo_v4', SH._db);
SH.demo = function (fn, a) {
  const db = SH._demoDB(), save = SH._save, tok = () => Math.random().toString(36).slice(2) + Date.now().toString(36), now = () => new Date().toISOString();
  const sess = db.sessions[a.p_token] || {}, sid = sess.sid, adm = sess.admin ? sess : null;
  const scopeOk = school_id => adm && (adm.super || adm.school_id === school_id);
  const school = code => db.schools.find(s => s.code === String(code || '').trim().toUpperCase());
  const pub = s => ({ id: s.id, code: s.code, name: s.name, region: s.region, site_name: s.site_name, site_lat: s.site_lat, site_lng: s.site_lng, contact: s.contact, inst_name: s.inst_name, created_at: s.created_at });
  const accLite = x => ({ id: x.id, school_id: x.school_id, student_id: x.student_id, acc_no: x.acc_no, data: x.data, status: x.status, teacher_note: x.teacher_note, has_plant: !!x.photo_plant, has_fruit: !!x.photo_fruit, has_seed: !!x.photo_seed, has_sketch: !!x.sketch, created_at: x.created_at, updated_at: x.updated_at });
  switch (fn) {
    case 'seedhands_school_info': { const s = school(a.p_code); return s ? { ok: true, school: pub(s) } : { ok: false, error: '학교 코드를 찾지 못했어요. 미리보기 코드는 SR2026이에요.' }; }
    case 'seedhands_school_create': {
      if ((a.p_name || '').trim().length < 2) return { ok: false, error: '학교 이름을 입력해 주세요.' };
      if ((a.p_pw || '').length < 6) return { ok: false, error: '관리자 비밀번호는 6자 이상으로 정해 주세요.' };
      const code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
      const s = { id: 'sc' + tok(), code, name: a.p_name.trim(), region: a.p_region, site_name: a.p_site_name, site_lat: a.p_site_lat, site_lng: a.p_site_lng, contact: a.p_contact, pw: a.p_pw, acc_seq: 0, created_at: now() };
      db.schools.push(s); const t = tok(); db.sessions[t] = { admin: true, school_id: s.id }; save(); return { ok: true, code, token: t };
    }
    case 'seedhands_login2': {
      const s = school(a.p_code); if (!s) return { ok: false, error: '학교 코드를 찾지 못했어요.' };
      const no = String(a.p_no || '').trim(), name = String(a.p_name || '').trim();
      if (!/^\d{4,6}$/.test(no)) return { ok: false, error: '학번은 숫자 4~6자리로 입력해 주세요.' };
      if (name.length < 2) return { ok: false, error: '이름을 정확히 입력해 주세요.' };
      if (!/^\d{4}$/.test(a.p_pin || '')) return { ok: false, error: '비밀번호는 숫자 4자리예요.' };
      let st = db.students.find(x => x.school_id === s.id && x.no === no);
      if (!st) { st = { id: 'u' + tok(), school_id: s.id, no, name, pin: a.p_pin, created_at: now() }; db.students.push(st); }
      else if (st.name !== name) return { ok: false, error: '이 학번은 다른 이름으로 등록되어 있어요.' };
      else if (st.pin !== a.p_pin) return { ok: false, error: '비밀번호가 맞지 않아요. (예시 학생은 0000)' };
      st.last_login = now(); const t = tok(); db.sessions[t] = { sid: st.id }; save();
      return { ok: true, token: t, student: { no: st.no, name: st.name } };
    }
    case 'seedhands_me': {
      const st = db.students.find(x => x.id === sid); if (!st) return { ok: false, error: 'session' };
      const s = db.schools.find(x => x.id === st.school_id);
      return { ok: true, student: { no: st.no, name: st.name }, school: pub(s),
        records: db.records.filter(r => r.student_id === sid).map(r => ({ mission: r.mission, data: r.data, sketch: r.sketch, photo: r.photo, updated_at: r.updated_at })),
        accessions: db.accs.filter(x => x.student_id === sid).sort((x, y) => y.created_at.localeCompare(x.created_at)).map(accLite) };
    }
    case 'seedhands_save': {
      if (!sid) return { ok: false, error: 'session' };
      let r = db.records.find(x => x.student_id === sid && x.mission === a.p_mission);
      if (!r) { r = { id: 'r' + tok(), student_id: sid, mission: a.p_mission }; db.records.push(r); }
      Object.assign(r, { data: a.p_data, sketch: a.p_sketch || null, photo: a.p_photo || null, updated_at: now() }); save(); return { ok: true, updated_at: r.updated_at };
    }
    case 'seedhands_acc_get': { const x = db.accs.find(y => y.id === a.p_id && y.student_id === sid); return x ? { ok: true, acc: { ...x } } : { ok: false, error: '기록을 찾지 못했어요.' }; }
    case 'seedhands_acc_save': {
      const st = db.students.find(x => x.id === sid); if (!st) return { ok: false, error: 'session' };
      const img = (old, v) => v == null ? old : (v || null);
      let x;
      if (!a.p_id) {
        const s = db.schools.find(y => y.id === st.school_id); s.acc_seq++;
        x = { id: 'a' + tok(), school_id: s.id, student_id: sid, acc_no: `${s.code}-${new Date().getFullYear()}-${String(s.acc_seq).padStart(3, '0')}`, status: 'collected', teacher_note: null, created_at: now(), photo_plant: null, photo_fruit: null, photo_seed: null, sketch: null };
        db.accs.push(x);
      } else {
        x = db.accs.find(y => y.id === a.p_id && y.student_id === sid); if (!x) return { ok: false, error: '기록을 찾지 못했어요.' };
        if (!['collected', 'rejected'].includes(x.status)) return { ok: false, error: '선생님이 이미 처리 중인 씨앗이라 고칠 수 없어요.' };
        x.status = 'collected';
      }
      Object.assign(x, { data: a.p_data, photo_plant: img(x.photo_plant, a.p_plant), photo_fruit: img(x.photo_fruit, a.p_fruit), photo_seed: img(x.photo_seed, a.p_seed), sketch: img(x.sketch, a.p_sketch), updated_at: now() });
      if (!save()) { x.photo_plant = x.photo_fruit = x.photo_seed = x.sketch = null; save(); }
      return { ok: true, id: x.id, acc_no: x.acc_no, status: x.status, updated_at: x.updated_at };
    }
    case 'seedhands_acc_delete': {
      const i = db.accs.findIndex(y => y.id === a.p_id && y.student_id === sid && ['collected', 'rejected'].includes(y.status));
      if (i < 0) return { ok: false, error: '지울 수 없는 기록이에요.' }; db.accs.splice(i, 1); save(); return { ok: true };
    }
    case 'seedhands_logout': delete db.sessions[a.p_token]; save(); return null;
    case 'seedhands_admin_login2': {
      if (String(a.p_code).toUpperCase() === 'ALL') { if (a.p_pw !== db.superPw) return { ok: false, error: '비밀번호가 맞지 않아요. (미리보기: seedvault-demo)' }; const t = tok(); db.sessions[t] = { admin: true, super: true }; save(); return { ok: true, token: t, super: true }; }
      const s = school(a.p_code); if (!s) return { ok: false, error: '학교 코드를 찾지 못했어요.' };
      if (s.pw !== a.p_pw) return { ok: false, error: '관리자 비밀번호가 맞지 않아요.' };
      const t = tok(); db.sessions[t] = { admin: true, school_id: s.id }; save(); return { ok: true, token: t, super: false };
    }
    case 'seedhands_admin_overview': {
      if (!adm) return { ok: false, error: 'session' };
      const stu = db.students.filter(s => scopeOk(s.school_id)), ids = new Set(stu.map(s => s.id));
      return { ok: true, super: !!adm.super, schools: db.schools.filter(s => scopeOk(s.id)).map(pub),
        students: stu.map(s => ({ id: s.id, school_id: s.school_id, no: s.no, name: s.name, created_at: s.created_at, last_login: s.last_login })),
        records: db.records.filter(r => ids.has(r.student_id)).map(r => ({ id: r.id, student_id: r.student_id, mission: r.mission, data: r.data, has_sketch: !!r.sketch, has_photo: !!r.photo, updated_at: r.updated_at })),
        accessions: db.accs.filter(x => scopeOk(x.school_id)).sort((x, y) => x.acc_no.localeCompare(y.acc_no)).map(accLite) };
    }
    case 'seedhands_admin_images': {
      if (!adm) return { ok: false, error: 'session' };
      return { ok: true, items: db.records.filter(r => { const s = db.students.find(x => x.id === r.student_id); return s && scopeOk(s.school_id) && (!a.p_student || r.student_id === a.p_student) && (!a.p_mission || r.mission === a.p_mission) && (r.sketch || r.photo); }).map(r => ({ id: r.id, student_id: r.student_id, mission: r.mission, sketch: r.sketch, photo: r.photo })) };
    }
    case 'seedhands_admin_acc_images': if (!adm) return { ok: false, error: 'session' };
      return { ok: true, items: db.accs.filter(x => a.p_ids.includes(x.id) && scopeOk(x.school_id)).map(x => ({ id: x.id, photo_plant: x.photo_plant, photo_fruit: x.photo_fruit, photo_seed: x.photo_seed, sketch: x.sketch })) };
    case 'seedhands_admin_acc_update': {
      if (!adm) return { ok: false, error: 'session' }; let n = 0;
      db.accs.forEach(x => { if (a.p_ids.includes(x.id) && scopeOk(x.school_id)) { if (a.p_status) x.status = a.p_status; if (a.p_note != null) x.teacher_note = a.p_note || null; x.updated_at = now(); n++; } });
      save(); return { ok: true, updated: n };
    }
    case 'seedhands_admin_reset_pin': { if (!adm) return { ok: false, error: 'session' }; if (!/^\d{4}$/.test(a.p_pin || '')) return { ok: false, error: '숫자 4자리로 정해 주세요.' }; const s = db.students.find(x => x.id === a.p_student && scopeOk(x.school_id)); if (s) s.pin = a.p_pin; save(); return { ok: true }; }
    case 'seedhands_admin_delete_student': { if (!adm) return { ok: false, error: 'session' }; db.students = db.students.filter(x => !(x.id === a.p_student && scopeOk(x.school_id))); db.accs = db.accs.filter(x => x.student_id !== a.p_student); db.records = db.records.filter(x => x.student_id !== a.p_student); save(); return { ok: true }; }
    case 'seedhands_admin_change_pw': {
      if (!adm) return { ok: false, error: 'session' }; if ((a.p_new || '').length < 6) return { ok: false, error: '새 비밀번호는 6자 이상으로 해 주세요.' };
      if (adm.super) { if (a.p_old !== db.superPw) return { ok: false, error: '현재 비밀번호가 맞지 않아요.' }; db.superPw = a.p_new; }
      else { const s = db.schools.find(x => x.id === adm.school_id); if (a.p_old !== s.pw) return { ok: false, error: '현재 비밀번호가 맞지 않아요.' }; s.pw = a.p_new; }
      save(); return { ok: true };
    }
    case 'seedhands_public_points': {
      const pts = db.accs.filter(x => x.data && x.data.lat).map(x => ({ lat: +(+x.data.lat).toFixed(3), lng: +(+x.data.lng).toFixed(3), plant: x.data.plant, sci: x.data.sci, date: x.data.date, status: x.status, school: (db.schools.find(s => s.id === x.school_id) || {}).name }));
      const extra = [[35.87, 128.61, '대구 팔공중학교', '쑥부쟁이'], [35.16, 129.06, '부산 금정중학교', '때죽나무'], [37.75, 128.88, '강릉 노암중학교', '노박덩굴'], [35.15, 126.85, '광주 무등중학교', '산국'], [36.35, 127.38, '대전 보문중학교', '팥배나무'], [33.45, 126.56, '제주 한라중학교', '청미래덩굴'], [36.63, 127.49, '청주 우암중학교', '싸리'], [35.82, 127.15, '전주 기린중학교', '화살나무'], [37.26, 127.03, '수원 광교중학교', '당단풍나무'], [34.81, 126.39, '목포 유달중학교', '노박덩굴'], [36.95, 128.87, '봉화 춘양중학교', '신갈나무']];
      extra.forEach(([la, ln, sc, pl], i) => pts.push({ lat: la + (i % 3) * .01, lng: ln, plant: pl, date: SH.today(), status: i % 4 === 0 ? 'deposited' : 'collected', school: sc + '(예시)' }));
      return { ok: true, points: pts, schools: db.schools.length + extra.length, total: pts.length, deposited: pts.filter(p => p.status === 'deposited').length };
    }
    case 'seedhands_school_gallery': {
      const me = db.students.find(x => x.id === sid); if (!me) return { ok: false, error: 'session' };
      const mask = n => n.length >= 3 ? n[0] + '*'.repeat(n.length - 2) + n[n.length - 1] : n[0] + '*';
      return { ok: true, items: db.records.filter(r => { const st = db.students.find(x => x.id === r.student_id); return st && st.school_id === me.school_id && (!a.p_mission || r.mission === a.p_mission) && (r.sketch || r.photo); })
        .map(r => { const st = db.students.find(x => x.id === r.student_id); return { mission: r.mission, plant: r.data.plant, date: r.data.date || SH.dayOf(r.updated_at), who: mask(st.name), mine: r.student_id === sid, sketch: r.sketch, photo: r.photo, updated_at: r.updated_at }; }) };
    }
    case 'seedhands_admin_acc_patch': {
      if (!adm) return { ok: false, error: 'session' }; const x = db.accs.find(y => y.id === a.p_id && scopeOk(y.school_id)); if (!x) return { ok: false };
      Object.assign(x.data, a.p_patch); x.updated_at = now(); save(); return { ok: true };
    }
    case 'seedhands_admin_school_update2': {
      if (!adm || !adm.school_id) return { ok: false, error: 'session' };
      Object.assign(db.schools.find(x => x.id === adm.school_id), { name: a.p_name, region: a.p_region, site_name: a.p_site_name, site_lat: a.p_site_lat, site_lng: a.p_site_lng, contact: a.p_contact, inst_name: a.p_inst }); save(); return { ok: true };
    }
    case 'seedhands_admin_school_update': {
      if (!adm || !adm.school_id) return { ok: false, error: 'session' };
      Object.assign(db.schools.find(x => x.id === adm.school_id), { name: a.p_name, region: a.p_region, site_name: a.p_site_name, site_lat: a.p_site_lat, site_lng: a.p_site_lng, contact: a.p_contact }); save(); return { ok: true };
    }
  }
  return { ok: false, error: '알 수 없는 요청이에요.' };
};

/* ───────── 시드핸즈 로고 (씨앗을 감싼 두 손) ───────── */
SH.logo = (size = 36, bg = '#22543F') => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="${bg}"/><path d="M32 11c-6.5 4.5-8.6 12-6.4 19 1.2 3.8 4 5.8 6.4 5.8s5.2-2 6.4-5.8c2.2-7 .1-14.5-6.4-19z" fill="#D9982B"/><path d="M32 16.5v17" stroke="${bg}" stroke-width="2.2" stroke-linecap="round"/><path d="M10.5 29.5c1.5 11 9 18.5 21.5 19.5M53.5 29.5c-1.5 11-9 18.5-21.5 19.5" fill="none" stroke="#F1F4F0" stroke-width="4.2" stroke-linecap="round"/><path d="M10.5 29.5l-1.8-4.2M53.5 29.5l1.8-4.2" stroke="#F1F4F0" stroke-width="4.2" stroke-linecap="round"/></svg>`;

/* ───────── 전국 지도 (오프라인 SVG: 남한 윤곽 + 백두대간 + 시드볼트) ───────── */
SH.VAULT = { lat: 36.95, lng: 128.87, name: '백두대간 글로벌 시드볼트', place: '경북 봉화 국립백두대간수목원' };
SH.KR = [[126.12,37.72],[126.37,37.78],[126.66,37.93],[126.95,38.10],[127.15,38.25],[127.45,38.32],[127.80,38.30],[128.10,38.33],[128.30,38.48],[128.36,38.61],[128.47,38.40],[128.60,38.18],[128.75,37.95],[128.92,37.78],[129.05,37.62],[129.18,37.42],[129.30,37.20],[129.38,36.95],[129.42,36.70],[129.45,36.45],[129.40,36.25],[129.47,36.08],[129.57,36.05],[129.48,35.90],[129.45,35.65],[129.35,35.45],[129.25,35.30],[129.10,35.12],[128.95,35.05],[128.75,35.02],[128.60,34.88],[128.45,34.90],[128.30,34.85],[128.05,34.92],[127.85,34.83],[127.70,34.72],[127.55,34.78],[127.38,34.62],[127.20,34.55],[127.00,34.55],[126.80,34.45],[126.60,34.35],[126.47,34.32],[126.38,34.48],[126.30,34.68],[126.38,34.85],[126.30,35.05],[126.40,35.30],[126.50,35.55],[126.60,35.80],[126.70,35.98],[126.62,36.15],[126.52,36.35],[126.45,36.55],[126.20,36.65],[126.15,36.82],[126.38,36.95],[126.60,37.00],[126.75,37.18],[126.68,37.35],[126.58,37.50],[126.42,37.62]];
SH.RIDGE = [[127.73,35.34],[127.75,35.86],[127.96,36.10],[127.87,36.54],[128.05,36.73],[128.49,36.96],[128.87,36.98],[128.92,37.10],[129.0,37.47],[128.65,37.75],[128.465,38.12],[128.32,38.33]];
SH.proj = (lng, lat) => [((lng - 125.85) * 0.806 * 100 + 10).toFixed(1), ((38.8 - lat) * 100 + 10).toFixed(1)];
SH.koreaSVG = function ({ points = [], mine = null, site = null, dark = true, id = 'krmap' } = {}) {
  const P = (a, b) => SH.proj(a, b).join(',');
  const land = SH.KR.map(p => P(p[0], p[1])).join(' ');
  const ridge = SH.RIDGE.map(p => P(p[0], p[1])).join(' ');
  const [jx, jy] = SH.proj(126.55, 33.38), [vx, vy] = SH.proj(SH.VAULT.lng, SH.VAULT.lat);
  const c = dark ? { land: '#1E4D3C', edge: '#3F7360', grid: 'rgba(255,255,255,.05)', txt: '#CFE0D6' } : { land: '#E3EBDF', edge: '#B9CAB3', grid: 'rgba(20,58,46,.05)', txt: '#56665E' };
  const grid = [34, 35, 36, 37, 38].map(l => { const y = SH.proj(126, l)[1]; return `<line x1="0" x2="340" y1="${y}" y2="${y}" stroke="${c.grid}"/><text x="4" y="${y - 3}" font-size="8" fill="${c.txt}" opacity=".5">${l}°N</text>`; }).join('');
  const dot = (p, i) => { const [x, y] = SH.proj(+p.lng, +p.lat); const dep = p.status === 'deposited'; return `<circle class="kr-dot" data-i="${i}" cx="${x}" cy="${y}" r="${dep ? 5 : 4}" fill="${dep ? '#D9982B' : '#9FD08A'}" stroke="${dark ? '#143A2E' : '#fff'}" stroke-width="1.4" tabindex="0"><title>${SH.esc(p.plant || '')}${p.school ? ' · ' + SH.esc(p.school) : ''}</title></circle>`; };
  const flows = points.slice(0, 60).map(p => { const [x, y] = SH.proj(+p.lng, +p.lat); const mx = (+x + +vx) / 2, my = Math.min(+y, +vy) - 40; return `<path d="M${x},${y} Q${mx},${my} ${vx},${vy}" fill="none" stroke="#D9982B" stroke-opacity="${p.status === 'deposited' ? .55 : .14}" stroke-width="1"/>`; }).join('');
  let extra = '';
  if (site && site.lat) { const [sx, sy] = SH.proj(site.lng, site.lat); extra += `<g><circle cx="${sx}" cy="${sy}" r="11" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 3"/><text x="${+sx + 14}" y="${+sy + 4}" font-size="11" fill="${dark ? '#fff' : '#143A2E'}" font-weight="600">${SH.esc(site.name || '')}</text></g>`; }
  if (mine && mine.lat) { const [mx, my] = SH.proj(+mine.lng, +mine.lat); extra += `<g><circle cx="${mx}" cy="${my}" r="14" fill="#D9982B" opacity=".25"/><circle cx="${mx}" cy="${my}" r="6" fill="#D9982B" stroke="#fff" stroke-width="2"/></g>`; }
  return `<svg id="${id}" viewBox="0 0 340 580" role="img" aria-label="전국 씨앗 지도" style="display:block;width:100%;height:auto">
    ${grid}
    <polygon points="${land}" fill="${c.land}" stroke="${c.edge}" stroke-width="1.2" stroke-linejoin="round"/>
    <ellipse cx="${jx}" cy="${jy}" rx="30" ry="17" fill="${c.land}" stroke="${c.edge}" stroke-width="1.2"/>
    <polyline points="${ridge}" fill="none" stroke="#D9982B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
    <text x="${SH.proj(128.0, 36.35)[0]}" y="${SH.proj(128.0, 36.35)[1]}" font-size="10" fill="#D9982B" transform="rotate(-62 ${SH.proj(128.0, 36.35).join(' ')})" font-weight="600">백두대간</text>
    ${flows}${points.map(dot).join('')}${extra}
    <g transform="translate(${vx - 11},${vy - 26})"><rect x="0" y="6" width="22" height="17" rx="3.5" fill="#D9982B"/><circle cx="11" cy="14.5" r="4" fill="none" stroke="#143A2E" stroke-width="1.8"/><path d="M1.5 6l9.5-5.5 9.5 5.5" fill="none" stroke="#D9982B" stroke-width="2"/></g>
    <text x="${+vx + 15}" y="${+vy - 12}" font-size="11" fill="${dark ? '#fff' : '#143A2E'}" font-weight="700">시드볼트</text>
  </svg>`;
};

/* ───────── GIS: 주소·고도·도분초 ───────── */
SH.dms = v => { v = Math.abs(+v); const d = Math.floor(v), mF = (v - d) * 60, m = Math.floor(mF), s = Math.round((mF - m) * 60); return s === 60 ? [d, m + 1, 0] : [d, m, s]; };
SH.gis = async function (lat, lng) {
  const out = { country: '대한민국', address: '', admin1: '', elev: null };
  const tm = ms => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  try {
    const j = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ko`, { signal: tm(8000) })).json();
    const a = j.address || {};
    out.country = a.country || out.country;
    out.admin1 = a.province || a.state || a.city || '';
    const parts = [a.province || a.state, a.city, a.county, a.borough, a.town, a.village, a.suburb, a.quarter, a.road, a.house_number].filter(Boolean);
    out.address = [...new Set(parts)].join(' ') || (j.display_name || '');
  } catch {}
  try {
    const j = await (await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, { signal: tm(8000) })).json();
    if (j.elevation && j.elevation[0] != null) out.elev = Math.round(j.elevation[0]);
  } catch {}
  return out;
};

/* ───────── 기탁 정보 양식 (수목원 기탁 목록과 같은 순서) ───────── */
SH.DEPOSIT_COLS = [
  ['일련번호', '목록 순서', 'auto'], ['과명', '과의 라틴어 이름 (예: Poaceae)', 'book'], ['과국명', '과의 우리말 이름 (예: 벼과)', 'book'],
  ['속명', '속의 라틴어 이름 (예: Setaria)', 'book'], ['속국명', '속의 우리말 이름 (예: 강아지풀속)', 'book'], ['학명', '저자까지 포함한 학명', 'book'],
  ['국명', '우리말 식물 이름', 'student'], ['점수', '같은 식물·같은 날 채종한 봉투 수', 'teacher'], ['무게(g)', '정선 후 씨앗 무게', 'teacher'],
  ['기탁기관명', '기탁하는 학교·기관', 'teacher'], ['채집일', '씨앗을 받은 날', 'student'], ['채집자', '채종한 학생 모두', 'student'],
  ['동정자', '식물 이름을 확인한 사람', 'student'], ['채집국가', '나라', 'gps'], ['채집지', '주소', 'gps'], ['경도', '십진수 경도', 'gps'], ['위도', '십진수 위도', 'gps'],
  ['위도(도)', '', 'gps'], ['위도(분)', '', 'gps'], ['위도(초)', '', 'gps'], ['경도(도)', '', 'gps'], ['경도(분)', '', 'gps'], ['경도(초)', '', 'gps'], ['고도', '해발 높이(m)', 'gps']
];
SH.SRC = { gps: ['GPS·지도', '#2F5D7C'], book: ['도감', '#3E6A2F'], student: ['학생 입력', '#8A5B0C'], teacher: ['선생님', '#7262A8'], auto: ['자동', '#56665E'] };
SH.depositRow = function (i, a, student, school) {
  const d = a.data || {}, la = d.lat != null && d.lat !== '' ? SH.dms(d.lat) : ['', '', ''], lo = d.lng != null && d.lng !== '' ? SH.dms(d.lng) : ['', '', ''];
  const t = SH.taxoFields(d.sci, d.family);
  const collectors = [student?.name, ...(String(d.team || '').split(/[,، ]+/))].map(x => (x || '').trim()).filter(Boolean);
  return [i, d.famLa || t.famLa, d.family || '', d.genus || t.genus, d.genusKo || t.genusKo, d.sciFull || [d.sci, d.author || t.author].filter(Boolean).join(' '), d.plant || '',
    d.lots || 1, d.weight || '', school?.inst_name || school?.name || '', d.date || '', [...new Set(collectors)].join(', '), d.identifier || [...new Set(collectors)].join(', '),
    d.country || '대한민국', d.address || d.place || '', d.lng ?? '', d.lat ?? '', la[0], la[1], la[2], lo[0], lo[1], lo[2], d.alt ?? ''];
};
SH.taxonInfo = async function (taxonId) {
  try {
    const j = await (await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}?locale=ko`)).json();
    const anc = j.results?.[0]?.ancestors || [], ko = x => x && x.preferred_common_name && /[가-힣]/.test(x.preferred_common_name) ? x.preferred_common_name : '';
    const fam = anc.find(a => a.rank === 'family'), gen = anc.find(a => a.rank === 'genus');
    return { family: ko(fam) || fam?.name || '', famLa: fam?.name || '', genus: gen?.name || '', genusKo: ko(gen) };
  } catch { return {}; }
};
SH.leaflet = () => !!(window.L && SH.mode !== 'demo');
SH.tiles = map => L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }).addTo(map);
/* 무료 지도(오픈스트리트맵) 위에 씨앗 점 찍기 — 키 없이 동작 */
SH.seedMap = function (el, { points = [], mine = [], site = null, ridge = false, vault = false, zoom = null, onPick = null } = {}) {
  if (el._map) { el._map.remove(); el._map = null; }
  const map = L.map(el, { scrollWheelZoom: false, tap: true }); SH.tiles(map); el._map = map;
  const b = [];
  if (ridge) L.polyline(SH.RIDGE.map(([x, y]) => [y, x]), { color: '#D9982B', weight: 4, opacity: .75, dashArray: '8 6' }).addTo(map).bindTooltip('백두대간');
  if (vault) { const v = L.marker([SH.VAULT.lat, SH.VAULT.lng], { icon: L.divIcon({ className: '', html: '<div class="mk-emo">🏔️</div>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(map).bindPopup(`<b>${SH.VAULT.name}</b><br>${SH.VAULT.place}`); b.push([SH.VAULT.lat, SH.VAULT.lng]); }
  if (site && site.lat) { L.marker([site.lat, site.lng], { icon: L.divIcon({ className: '', html: '<div class="mk-emo">🏫</div>', iconSize: [34, 34], iconAnchor: [17, 17] }) }).addTo(map).bindPopup(`<b>${SH.esc(site.name || '탐사지')}</b>`); b.push([site.lat, site.lng]); }
  const dot = (p, isMine) => {
    const dep = p.status === 'deposited';
    const m = L.circleMarker([p.lat, p.lng], { radius: isMine ? 9 : 7, color: '#143A2E', weight: 2, fillColor: dep ? '#D9982B' : isMine ? '#6E9A5B' : '#9FD08A', fillOpacity: .95 }).addTo(map);
    m.bindPopup(`<b>${SH.esc(p.plant || '이름 모름')}</b>${p.school ? '<br>' + SH.esc(p.school) : ''}${p.date ? '<br>' + SH.esc(p.date) : ''}<br><span style="color:#666">${SH.ST?.[p.status]?.label || ''}</span>`);
    if (onPick) m.on('click', () => onPick(p));
    b.push([p.lat, p.lng]);
  };
  points.forEach(p => dot(p, false)); mine.forEach(p => dot(p, true));
  if (zoom) map.setView(zoom.c, zoom.z);
  else if (b.length > 1) map.fitBounds(b, { padding: [28, 28], maxZoom: 15 });
  else if (b.length === 1) map.setView(b[0], 14);
  else map.setView([36.3, 127.9], 6);
  setTimeout(() => map.invalidateSize(), 80);
  return map;
};

/* ───────── 씨앗 친구 '톨이' (씨앗 한 톨에서 태어난 안내 친구) ───────── */
SH.toli = (size = 72, wave = false) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true" class="toli">
  <ellipse cx="50" cy="93" rx="22" ry="4" fill="rgba(20,58,46,.15)"/>
  <path d="M50 30c4-12 14-17 24-16-2 11-11 17-24 16z" fill="#6E9A5B"/><path d="M50 30c-3-10-11-14-19-13 1 9 9 14 19 13z" fill="#8DBA6F"/>
  <path d="M50 28v8" stroke="#4E7A3E" stroke-width="3" stroke-linecap="round"/>
  <path d="M50 34c-17 8-25 22-22 38 2 11 11 17 22 17s20-6 22-17c3-16-5-30-22-38z" fill="#D9982B"/>
  <path d="M50 38c-11 7-16 17-15 29" fill="none" stroke="#F0BE5C" stroke-width="4" stroke-linecap="round" opacity=".7"/>
  <circle cx="42" cy="62" r="3.6" fill="#2B1D05"/><circle cx="58" cy="62" r="3.6" fill="#2B1D05"/>
  <circle cx="43.2" cy="60.8" r="1.2" fill="#fff"/><circle cx="59.2" cy="60.8" r="1.2" fill="#fff"/>
  <ellipse cx="36" cy="69" rx="4.5" ry="2.6" fill="#F08A6B" opacity=".55"/><ellipse cx="64" cy="69" rx="4.5" ry="2.6" fill="#F08A6B" opacity=".55"/>
  <path d="M45 70q5 5 10 0" fill="none" stroke="#2B1D05" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M29 72c-6 0-9 4-8 8" fill="none" stroke="#B87A1C" stroke-width="4" stroke-linecap="round"/>
  <path d="M71 72c6-2 9-7 8-12" fill="none" stroke="#B87A1C" stroke-width="4" stroke-linecap="round" class="${wave ? 'toli-wave' : ''}"/>
</svg>`;
SH.say = (html, opt = {}) => `<div class="say ${opt.cls || ''}"><div class="say-face">${SH.toli(opt.size || 52)}</div><div class="say-bubble">${html}</div></div>`;

/* ───────── 어린이 친화 그림 글자 (선택지 앞에 붙는 이모지) ───────── */
SH.EMO = {
  '확실해요': '💯', '아마도': '🤔', '잘 모르겠어요': '❓',
  '원래 자라던 곳 (야생)': '🏞️', '누가 심은 것 (조경·화단)': '🪴',
  '큰키나무': '🌳', '작은키나무·관목': '🌿', '풀': '🌱', '덩굴': '🍇',
  '1~9그루': '🌱', '10~49그루': '🌿', '50~99그루': '🌳', '100그루 이상': '🌲',
  '10% 이하': '🤏', '10~20%': '✋', '20%보다 많이': '🙅',
  '숲 속': '🌲', '숲 가장자리': '🌳', '등산로 옆': '🥾', '계곡·물가': '💧', '바위 지대': '🪨', '풀밭': '🌾', '공원·학교 화단': '🏫',
  '다 익었어요': '🟤', '거의 익었어요': '🟡', '덜 익었어요': '🟢',
  '바싹 말랐어요': '🍂', '저절로 벌어졌어요': '💥', '촉촉해요 (과육 있음)': '💧',
  '건강해요': '💪', '벌레 먹은 씨가 조금': '🐛', '벌레 먹은 씨가 많음': '🐞',
  '꼬투리 (협과)': '🫛', '여러 갈래로 터짐 (삭과)': '💥', '한쪽만 갈라짐 (골돌과)': '🫘', '날개 열매 (시과)': '🍁', '딱딱한 열매 (견과·수과)': '🌰',
  '솔방울 (구과)': '🌲', '말랑·씨 많음 (장과)': '🫐', '딱딱한 씨 하나 (핵과)': '🍒', '사과 모양 (이과)': '🍎', '작은 열매 모음 (취과·다화과)': '🍓'
};
SH.STAGE_EMO = { collected: '🌰', drying: '☀️', cleaned: '🧺', packed: '✉️', deposited: '🏔️', rejected: '✏️' };
SH.STAGE_KID = { collected: '채종', drying: '말리기', cleaned: '고르기', packed: '봉투', deposited: '시드볼트' };
SH.formEmo = d => SH.EMO[d.form] || (SH.findPlant && SH.findPlant(d.plant, d.sci) ? { '풀': '🌱', '덩굴': '🍇' }[SH.findPlant(d.plant, d.sci).t] || '🌳' : '🌰');
