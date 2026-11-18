/* 시드핸즈 — 지역·식생대 정보, 엑셀 내보내기, AI 검토 호출 */

/* ───── 산림 식생대 (참고용 간이 판정: 위도·고도·섬 기준) ─────
   우리나라 산림대는 연평균기온에 따라 난대림(14℃ 이상), 온대림(남부·중부·북부), 한대림(아고산)으로 나뉘어요.
   여기서는 위도·고도로 대략 나눈 값이라 실제 숲과 다를 수 있어요. */
SH.ZONES = {
  warm: { key: 'warm', name: '난대림', color: '#D9534F', emoji: '🌺',
    desc: '겨울에도 푸른 잎을 단 상록활엽수가 자라는 따뜻한 숲이에요. 남해안·섬·제주 낮은 곳에 있어요.',
    trees: ['동백나무', '후박나무', '구실잣밤나무', '붉가시나무', '사스레피나무', '돈나무', '자금우', '마삭줄', '보리밥나무', '팔손이'],
    tip: '열매가 말랑한 상록수가 많아요. 과육을 바로 씻어 내고 그늘에 말려요. 동백·가시나무 도토리처럼 크고 물기 많은 씨앗은 말리면 죽을 수 있어서 선생님께 먼저 여쭤봐요.' },
  south: { key: 'south', name: '온대남부림', color: '#E8A33D', emoji: '🍂',
    desc: '낙엽활엽수 사이에 따뜻한 곳을 좋아하는 나무가 섞여 자라는 숲이에요.',
    trees: ['서어나무', '개서어나무', '졸참나무', '굴피나무', '때죽나무', '사람주나무', '쪽동백나무', '노린재나무', '산초나무', '청미래덩굴'],
    tip: '가을에 열매가 많이 익어요. 꼬투리나 삭과는 저절로 벌어지기 직전에 받아요.' },
  mid: { key: 'mid', name: '온대중부림', color: '#6E9A5B', emoji: '🌳',
    desc: '참나무류가 주인공인 숲이에요. 우리나라 산 대부분이 여기에 속해요.',
    trees: ['신갈나무', '졸참나무', '상수리나무', '떡갈나무', '생강나무', '국수나무', '산딸기', '팥배나무', '붉나무', '노박덩굴'],
    tip: '9~10월에 열매가 가장 많아요. 도토리는 물기가 많아 말리면 안 되는 씨앗이라 선생님께 따로 여쭤봐요.' },
  north: { key: 'north', name: '온대북부림', color: '#2F5D7C', emoji: '🌲',
    desc: '추운 곳을 좋아하는 나무와 바늘잎나무가 섞인 서늘한 숲이에요. 강원 북부나 높은 산 중턱에 있어요.',
    trees: ['신갈나무', '피나무', '거제수나무', '들메나무', '잣나무', '전나무', '함박꽃나무', '고로쇠나무', '당단풍나무', '물푸레나무'],
    tip: '열매가 일찍(8~9월) 익는 종이 많아요. 조금 서둘러 살펴봐요.' },
  alpine: { key: 'alpine', name: '아고산·한대림', color: '#7B5EA7', emoji: '🏔️',
    desc: '해발 1,300m 넘는 높은 산꼭대기 근처의 아주 추운 숲이에요. 기후변화에 가장 약한 곳이에요.',
    trees: ['구상나무', '분비나무', '가문비나무', '주목', '사스래나무', '눈측백', '털진달래', '산앵도나무', '들쭉나무', '시로미'],
    tip: '멸종위기·보호종이 많아요. 국립공원·보호구역에서는 허가 없이 채종하면 안 돼요.' },
};

/* 섬·특수 지역 */
SH.zoneOf = function (lat, lng, alt) {
  lat = +lat; lng = +lng; alt = alt === '' || alt == null ? null : +alt;
  if (!lat || !lng) return null;
  const jeju = lat < 33.7 && lng > 126.0 && lng < 127.2;
  const ulleung = lat > 37.3 && lat < 37.7 && lng > 130.6 && lng < 131.0;
  let z;
  if (jeju) z = alt != null && alt >= 1400 ? 'alpine' : alt != null && alt >= 600 ? 'mid' : 'warm';
  else if (ulleung) z = alt != null && alt >= 600 ? 'mid' : 'warm';
  else if (alt != null && alt >= 1300) z = 'alpine';
  else if (lat < 34.75 || (lat < 35.2 && lng > 127.4 && lng < 129.4 && (alt == null || alt < 200)) || (lat < 35.0 && lng < 126.6)) z = 'warm';
  else if (lat < 35.9) z = alt != null && alt >= 900 ? 'north' : alt != null && alt >= 500 ? 'mid' : 'south';
  else if (lat < 37.9) z = alt != null && alt >= 800 ? 'north' : 'mid';
  else z = 'north';
  const near = SH.ridgeDist ? SH.ridgeDist(lat, lng) : 999;
  return { ...SH.ZONES[z], island: jeju ? '제주' : ulleung ? '울릉도' : '', ridgeKm: Math.round(near), nearRidge: near < 20 };
};

/* 백두대간 선까지 거리(km) */
SH.ridgeDist = function (lat, lng) {
  const R = 6371, rad = Math.PI / 180, P = (SH.RIDGE || []).map(([x, y]) => [y, x]);
  const toXY = (la, ln) => [ln * rad * Math.cos(36.5 * rad) * R, la * rad * R];
  const [px, py] = toXY(lat, lng); let best = 1e9;
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, ay] = toXY(...P[i]), [bx, by] = toXY(...P[i + 1]);
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
};

/* 시·도별 지역 특성 (짧은 소개) */
SH.REGIONS = {
  '서울': '도시 한가운데 있는 산(북한산·관악산 등)이 섬처럼 남아 있어요. 화강암 산이 많고 온대중부 식생이에요.',
  '부산': '바다와 맞닿은 낮은 산이 많고 따뜻해서 난대 식물이 섞여 자라요.',
  '대구': '분지라 여름이 무척 덥고 비가 적어요. 팔공산·비슬산에 온대 숲이 넓어요.',
  '인천': '섬이 많아 바닷바람에 강한 식물이 자라요. 해안 식생과 온대중부 숲이 함께 있어요.',
  '광주': '무등산을 중심으로 온대남부 숲이 자라요. 겨울이 비교적 따뜻해요.',
  '대전': '계룡산·식장산 등 낮은 산지가 둘러싼 내륙이에요. 온대중부와 남부 경계쯤이에요.',
  '울산': '태화강과 가지산 등 영남알프스가 있어요. 해안은 따뜻하고 높은 산은 서늘해요.',
  '세종': '금강을 낀 낮은 구릉과 들이 많은 내륙이에요. 온대중부 식생이에요.',
  '경기': '한강 유역의 낮은 산과 북쪽 높은 산(명지산·화악산)이 함께 있어요. 온대중부·북부가 섞여 있어요.',
  '강원': '백두대간이 지나는 높은 산이 많아요. 영동은 눈이 많고, 아고산 식물과 북방계 식물이 자라요.',
  '충북': '바다가 없는 내륙이에요. 속리산·소백산 등 백두대간 줄기가 지나가요.',
  '충남': '서해안 갯벌과 낮은 구릉이 많고, 해안 쪽엔 바닷바람에 강한 식물이 자라요.',
  '전북': '덕유산·지리산 북쪽 줄기가 동쪽에 있고, 서쪽은 넓은 들과 서해안이에요.',
  '전남': '섬과 리아스식 해안이 많아 난대림이 넓어요. 상록활엽수의 보물창고예요.',
  '경북': '백두대간 시드볼트가 있는 봉화가 여기예요! 높은 산이 많고 백두대간 생태축의 중심이에요.',
  '경남': '지리산과 남해안 섬이 있어요. 높은 산은 아고산, 바닷가는 난대 식생이에요.',
  '제주': '한라산 하나에 난대림부터 아고산까지 모든 식생대가 다 있어요. 고유종·특산종이 많아요.',
};
SH.regionKey = function (s) {
  s = String(s || '');
  const map = [['서울', '서울'], ['부산', '부산'], ['대구', '대구'], ['인천', '인천'], ['광주', '광주'], ['대전', '대전'], ['울산', '울산'], ['세종', '세종'], ['경기', '경기'], ['강원', '강원'],
    ['충청북', '충북'], ['충북', '충북'], ['충청남', '충남'], ['충남', '충남'], ['전라북', '전북'], ['전북', '전북'], ['전북특별', '전북'], ['전라남', '전남'], ['전남', '전남'],
    ['경상북', '경북'], ['경북', '경북'], ['경상남', '경남'], ['경남', '경남'], ['제주', '제주']];
  for (const [k, v] of map) if (s.includes(k)) return v;
  return '';
};

/* 이달에 열매가 익는 우리 도감 식물 */
SH.ripeNow = function (month) {
  month = month || new Date().getMonth() + 1;
  return (SH.PLANTS || []).filter(p => (p.fm || []).includes(month)).map(p => p.n);
};

/* ───── 엑셀(.xlsx) 만들기: 외부 라이브러리 없이 ───── */
SH.xlsx = function (sheets) {
  // sheets: [{ name, rows: [[...], ...] }]
  const enc = new TextEncoder();
  const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const col = n => { let s = ''; n++; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const sheetXml = rows => {
    const widths = (rows[0] || []).map((_, c) => Math.min(48, Math.max(8, ...rows.slice(0, 200).map(r => String(r[c] ?? '').length * 1.6 + 2))));
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>';
    widths.forEach((w, i) => { x += `<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`; });
    x += '</cols><sheetData>';
    rows.forEach((r, ri) => {
      x += `<row r="${ri + 1}">`;
      r.forEach((v, ci) => {
        const ref = col(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : '';
        if (v === null || v === undefined || v === '') return;
        if (typeof v === 'number' && isFinite(v)) x += `<c r="${ref}"${st}><v>${v}</v></c>`;
        else x += `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
      });
      x += '</row>';
    });
    return x + `</sheetData><autoFilter ref="A1:${col(Math.max(0, (rows[0] || []).length - 1))}${Math.max(1, rows.length)}"/></worksheet>`;
  };
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name).slice(0, 31)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF143A2E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)]),
  ];
  // store-only ZIP
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], central = []; let off = 0;
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, text] of files) {
    const nb = enc.encode(name), db = enc.encode(text), c = crc(db);
    const head = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0)]);
    parts.push(head, nb, db);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(db.length), ...u32(db.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += head.length + nb.length + db.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
SH.download = function (blob, name) {
  if (SH.mode === 'demo') { SH.toast('미리보기에서는 내려받기가 막혀 있어요. 실제 사이트에서 돼요.'); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
};

/* ───── AI 검토 ───── */
SH.AI_LEVEL = {
  match: { label: '이름이 잘 맞아요', emoji: '✅', cls: 'ai-ok' },
  check: { label: '한 번 더 확인해요', emoji: '🤔', cls: 'ai-check' },
  mismatch: { label: '다른 식물일 수 있어요', emoji: '⚠️', cls: 'ai-bad' },
  photo: { label: '사진이 더 필요해요', emoji: '📸', cls: 'ai-photo' },
};
SH.aiReview = async function (payload) {
  if (SH.mode === 'demo') {
    await new Promise(r => setTimeout(r, 900));
    return { ok: true, id: null, demo: true, model: 'demo', result: { level: 'match', score: 86, summary: `사진 속 잎과 열매 모양이 ${payload.plant || '적은 식물'}과 잘 맞아 보여! 선생님께 마지막으로 확인받자.`, plant_check: '잎 모양과 가지 모습이 적은 이름과 비슷해요.', seed_check: '씨앗이 갈색으로 잘 익었어요.', season_region: '이 시기·지역에서 열매를 맺는 식물이에요.', safety: '', for_teacher: '미리보기 예시 결과입니다.', candidates: [{ ko: payload.plant || '', sci: payload.sci || '', reason: '잎·열매 모양' }], photo_tips: ['잎 앞뒷면을 가까이 찍으면 더 정확해요'] } };
  }
  try {
    const r = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, anon: SH.ANON }) });
    const j = await r.json().catch(() => ({ ok: false, error: 'AI 서버 응답을 읽지 못했어요.' }));
    return j;
  } catch (e) { return { ok: false, error: '인터넷 연결을 확인해 주세요.' }; }
};
SH.aiCard = function (res, opt = {}) {
  if (!res) return '';
  const R = res.result || res; const L = SH.AI_LEVEL[R.level] || SH.AI_LEVEL.check;
  const cands = (R.candidates || []).filter(c => c.ko || c.sci).map(c => `<li><b>${SH.esc(c.ko)}</b> <i class="sci">${SH.esc(c.sci)}</i>${c.reason ? `<span> · ${SH.esc(c.reason)}</span>` : ''}</li>`).join('');
  return `<div class="aicard ${L.cls}">
    <div class="aihead"><span class="aiemo">${L.emoji}</span><div><b>AI 의견: ${L.label}</b>${R.score != null ? `<span class="aiscore">확신 ${R.score}%</span>` : ''}</div></div>
    <p class="aisum">${SH.esc(R.summary || '')}</p>
    ${opt.full !== false ? `<dl class="aidl">
      ${R.plant_check ? `<dt>🌿 식물</dt><dd>${SH.esc(R.plant_check)}</dd>` : ''}
      ${R.seed_check ? `<dt>🌰 씨앗</dt><dd>${SH.esc(R.seed_check)}</dd>` : ''}
      ${R.season_region ? `<dt>📅 시기·지역</dt><dd>${SH.esc(R.season_region)}</dd>` : ''}
      ${R.safety ? `<dt>⛑️ 안전</dt><dd>${SH.esc(R.safety)}</dd>` : ''}
      ${cands ? `<dt>🔎 후보</dt><dd><ul class="aicand">${cands}</ul></dd>` : ''}
      ${(R.photo_tips || []).length ? `<dt>📸 더 찍으면 좋아요</dt><dd>${R.photo_tips.map(SH.esc).join(' · ')}</dd>` : ''}
      ${opt.teacher && R.for_teacher ? `<dt>👩‍🏫 선생님 메모</dt><dd>${SH.esc(R.for_teacher)}</dd>` : ''}
    </dl>` : ''}
    <p class="ainote">AI는 참고만 해요. 최종 확인은 선생님이 해요.</p></div>`;
};

/* 식생대 카드 */
SH.zoneCard = function (z, opt = {}) {
  if (!z) return '';
  const ripe = opt.month ? SH.ripeNow(opt.month).slice(0, 8) : [];
  return `<div class="zonecard" style="--zc:${z.color}">
    <div class="zhead"><span class="zemo">${z.emoji}</span><div><small>이곳은 (참고용)</small><b>${z.name}${z.island ? ` · ${z.island}` : ''}</b></div></div>
    <p>${z.desc}</p>
    ${z.nearRidge ? `<p class="zridge">⛰️ 백두대간 생태축에서 약 ${z.ridgeKm}km! 우리나라 숲의 등뼈 가까이예요.</p>` : ''}
    <div class="ztrees"><small>이런 나무가 자라요</small>${z.trees.slice(0, opt.short ? 6 : 10).map(t => `<span>${t}</span>`).join('')}</div>
    ${ripe.length ? `<div class="ztrees"><small>이번 달 열매가 익는 도감 식물</small>${ripe.map(t => `<span class="ripe">${t}</span>`).join('')}</div>` : ''}
    ${opt.short ? '' : `<p class="ztip">💡 ${z.tip}</p>`}
  </div>`;
};

SH.plantEmo = p => !p ? '🌱' : /덩굴/.test(p.t || '') ? '🍃' : /풀/.test(p.t || '') ? '🌼' : '🌳';
/* 도감 데이터 묶기 (학생·운영국 공용) */
SH.bookCard = function (e, opt = {}) {
  const bp = SH.findPlant ? SH.findPlant(e.plant) : null, fmt = n => Number(n || 0).toLocaleString('ko-KR');
  return `<article class="bookcard"><div class="bimg" data-ph="${SH.esc(e.photoKey || '')}">${e.photoKey ? '<span class="spin"></span>' : `<span class="bemo">${SH.plantEmo(bp)}</span>`}</div>
    <div class="bbody"><h3>${SH.esc(e.plant || '이름 미정')}</h3><div class="sci">${SH.esc(e.sci || '')}</div><div class="small muted">${SH.esc(e.family || '')}</div>
    <div class="bnum"><div><b>${fmt(e.seeds)}</b><span>씨앗(립)</span></div><div><b>${fmt(e.recs)}</b><span>기록</span></div><div><b>${fmt(e.dep)}</b><span>입고</span></div></div>
    <dl class="bkv">${e.schools ? `<dt>학교</dt><dd>${SH.esc(e.schools)}</dd>` : ''}${e.regions ? `<dt>지역</dt><dd>${SH.esc(e.regions)}</dd>` : ''}${e.months ? `<dt>채종 시기</dt><dd>${SH.esc(e.months)}</dd>` : ''}</dl>
    ${bp?.tip && !opt.noTip ? `<p class="small" style="margin:6px 0 0">💡 ${SH.esc(bp.tip)}</p>` : ''}</div></article>`;
};
