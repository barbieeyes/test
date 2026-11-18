/* 시드핸즈 전문가 검토: 학생·교사·운영국 화면에서 쓰는 카드 + 미리보기(데모) 백엔드 */
(function () {

SH.EXP_MIN = 3; /* 전문가에게 보내려면 사진이 이만큼 있어야 해요 */
SH.EXP_KIND = { leaf: '🍃 잎 앞·뒤', flower: '🌸 꽃', fruit: '🍒 열매 가까이', stem: '🌿 줄기·가지', bark: '🪵 나무껍질', seed: '🌰 씨앗 확대', habit: '🌳 자라는 모습', other: '📷 기타' };
SH.EXP_VERDICT = {
  correct: { emo: '✅', label: '이름이 맞아요', kid: '전문가 선생님이 이름이 맞다고 확인해 줬어요!', c: '#2F6A1F', bg: '#EAF4E3' },
  corrected: { emo: '✏️', label: '이름을 바로잡았어요', kid: '전문가 선생님이 바른 이름을 알려 줬어요.', c: '#8A520C', bg: '#FFF1D6' },
  uncertain: { emo: '❓', label: '사진만으로는 판단이 어려워요', kid: '사진만으로는 정확히 알기 어렵대요.', c: '#2F5D7C', bg: '#E6EEF5' },
  need_photo: { emo: '📸', label: '사진이 더 필요해요', kid: '사진을 더 넣어서 다시 보내 달래요.', c: '#A3341C', bg: '#FDECE6' }
};
SH.EXP_STATUS = { waiting: '⏳ 전문가를 기다리는 중', claimed: '🔬 전문가가 살펴보는 중', more: '📸 사진이 더 필요해요', done: '✅ 검토 완료' };
SH.ago = t => { if (!t) return ''; const h = (Date.now() - new Date(t)) / 36e5; return h < 1 ? '방금' : h < 24 ? Math.floor(h) + '시간 전' : Math.floor(h / 24) + '일 전'; };

SH.expertResult = function (d, opt = {}) {
  const v = SH.EXP_VERDICT[d.expert_verdict]; if (!v) return '';
  const kid = opt.kid;
  return `<div class="exres" style="border:2px solid ${v.c}33;background:${v.bg};border-radius:14px;padding:14px 16px;margin:8px 0">
    <div style="font-weight:800;color:${v.c};font-size:16px">${v.emo} ${kid ? v.kid : v.label}</div>
    ${d.expert_verdict === 'corrected' ? `<div style="margin-top:6px;font-size:15px">${SH.esc(d.plant_orig || '')} → <b>${SH.esc(d.expert_ko || '')}</b>${d.expert_sci ? ` <i>${SH.esc(d.expert_sci)}</i>` : ''}</div>` : d.expert_verdict === 'correct' && d.expert_ko ? `<div style="margin-top:6px;font-size:15px"><b>${SH.esc(d.expert_ko)}</b>${d.expert_sci ? ` <i>${SH.esc(d.expert_sci)}</i>` : ''}</div>` : ''}
    ${d.expert_comment ? `<p style="margin:8px 0 0;font-size:14.5px;line-height:1.6">“${SH.esc(d.expert_comment)}”</p>` : ''}
    <div class="small muted" style="margin-top:6px">${SH.esc(d.expert_name || '')}${d.expert_at ? ' · ' + SH.dot(String(d.expert_at).slice(0, 10)) : ''}</div></div>`;
};

/* 기록 하나에 붙는 전문가 검토 카드. role: student | teacher | hq */
SH.expertBox = async function (box, { acc, token, role, onChange }) {
  if (!box) return;
  const kid = role === 'student';
  box.innerHTML = `<div class="small muted"><span class="spin"></span> 전문가 검토 정보를 불러오는 중</div>`;
  let r; try { r = await SH.rpc('seedhands_acc_photos', { p_token: token, p_acc: acc.id }); } catch (e) { r = { ok: false, error: e.message }; }
  if (!r.ok) { box.innerHTML = `<div class="small muted">전문가 검토 정보를 불러오지 못했어요.</div>`; return; }
  const extras = r.items || [], q = r.req, d = acc.data || {};
  const base = [['식물 전체', !!(acc.photo_plant || acc.has_plant)], ['씨앗', !!(acc.photo_seed || acc.has_seed)], ['열매', !!(acc.photo_fruit || acc.has_fruit)]];
  const n = base.filter(x => x[1]).length + extras.length, enough = n >= SH.EXP_MIN && base[0][1] && base[1][1];
  const open = q && ['waiting', 'claimed'].includes(q.status);
  const intro = kid ? '식물 전문가 선생님이 사진을 직접 보고 이름이 맞는지 확인해 줘요. 확인되면 시드볼트에 보내는 기록에 <b>전문가 이름</b>이 함께 들어가요!'
    : '식물분류 전문가가 사진을 직접 보고 동정을 확인해요. 확인되면 기탁 양식의 <b>동정자</b>에 전문가 이름이 자동으로 들어가고, 바로잡은 이름은 국명·학명에 반영돼요.';
  box.innerHTML = `<div class="exbox">
    <h3 style="margin:0 0 6px">🔬 전문가 검토</h3>
    ${q ? `<div class="exstate st-${q.status}"><b>${SH.EXP_STATUS[q.status] || ''}</b><span class="small muted"> · ${SH.esc(q.requester || '')} 요청 ${SH.ago(q.created_at)}${q.rounds > 1 ? ` · ${q.rounds}번째` : ''}</span></div>` : `<p class="small" style="margin:0 0 10px;line-height:1.6">${intro}</p>`}
    ${SH.expertResult(d, { kid })}
    <div class="excount ${enough ? 'ok' : ''}"><b>사진 ${n}장</b> <span>/ ${SH.EXP_MIN}장 이상이면 보낼 수 있어요</span>
      <div class="exchips">${base.map(([t, ok]) => `<span class="${ok ? 'on' : ''}">${ok ? '✓' : '·'} ${t}</span>`).join('')}<span class="${extras.length ? 'on' : ''}">${extras.length ? '✓' : '·'} 자세한 사진 ${extras.length}장</span></div></div>
    <div class="exgrid">${extras.map(p => `<figure data-id="${p.id}"><img src="${p.img}" alt="${SH.esc(SH.EXP_KIND[p.kind] || '')}"><figcaption>${SH.EXP_KIND[p.kind] || ''}</figcaption>${open ? '' : `<button type="button" class="exdel" data-del="${p.id}" aria-label="사진 지우기">×</button>`}</figure>`).join('')}
      ${extras.length < 6 && !open ? `<button type="button" class="exadd" id="exAdd"><span>＋</span>자세한 사진 넣기</button>` : ''}</div>
    <p class="small muted" style="margin:6px 0 10px">${kid ? '💡 잎 앞뒤, 꽃이나 열매 가까이, 줄기를 찍으면 더 정확하게 알 수 있어요.' : '💡 잎 앞·뒷면, 꽃·열매 확대, 줄기·껍질 사진이 있으면 동정 정확도가 크게 올라가요.'}</p>
    ${open ? '' : `<label class="field" style="margin:0 0 8px"><span class="lbl">${kid ? '전문가 선생님께 묻고 싶은 점 (안 적어도 돼요)' : '전문가에게 남길 질문 (선택)'}</span><textarea class="inp" id="exQ" rows="2" maxlength="600" placeholder="${kid ? '예: 산딸기랑 멍석딸기가 헷갈려요' : '예: 잎자루 털 유무로 산딸기/멍석딸기 구분 부탁드려요'}"></textarea></label>
      <button type="button" class="btn ${enough ? 'seed' : 'line'} block" id="exGo" ${enough ? '' : 'aria-disabled="true"'}>🔬 ${q && q.status === 'more' ? '사진 더 넣고 다시 요청하기' : q && q.status === 'done' ? '다시 검토 요청하기' : '전문가에게 검토 요청'}</button>`}
  </div>`;
  const reload = () => SH.expertBox(box, { acc, token, role, onChange });
  const addBtn = box.querySelector('#exAdd');
  if (addBtn) addBtn.onclick = async () => {
    const kind = await SH.expertKindPick(); if (!kind) return;
    const f = await SH.pickFile(kind.camera); if (!f) return;
    SH.toast('사진을 넣는 중…');
    try { const img = await SH.shrinkImage(f, 1400, 0.78); const x = await SH.rpc('seedhands_acc_photo_add', { p_token: token, p_acc: acc.id, p_kind: kind.k, p_img: img }); if (!x.ok) return SH.toast(x.error || '넣지 못했어요'); SH.toast('사진을 넣었어요'); reload(); }
    catch (e) { SH.toast('사진을 읽지 못했어요'); }
  };
  box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!(await SH.dialog({ title: '이 사진을 지울까요?', ok: '지우기', danger: true }))) return;
    const x = await SH.rpc('seedhands_acc_photo_del', { p_token: token, p_id: b.dataset.del }); if (!x.ok) return SH.toast(x.error || '지우지 못했어요'); reload();
  });
  const go = box.querySelector('#exGo');
  if (go) go.onclick = async () => {
    if (!enough) { SH.toast(`📸 사진이 ${SH.EXP_MIN}장 이상 있어야 해요. 지금 ${n}장이에요. 「자세한 사진 넣기」로 더 넣어 주세요.`, 4000); return; }
    if (!(await SH.dialog({ title: '전문가에게 보낼까요?', msg: `사진 ${n}장과 기록이 식물 전문가에게 가요. ${kid ? '답이 오면 여기에서 볼 수 있어요.' : '검토가 끝나면 이 기록에 결과가 표시돼요.'}`, ok: '보내기' }))) return;
    go.disabled = true; go.innerHTML = '<span class="spin"></span> 보내는 중';
    const x = await SH.rpc('seedhands_expert_request', { p_token: token, p_acc: acc.id, p_question: box.querySelector('#exQ').value.trim() });
    if (!x.ok) { go.disabled = false; go.textContent = '🔬 전문가에게 검토 요청'; return SH.toast(x.error || '보내지 못했어요', 4000); }
    acc.data = { ...(acc.data || {}), expert_status: 'waiting' };
    SH.toast('🔬 전문가에게 보냈어요!'); onChange && onChange(acc); reload();
  };
};
SH.expertKindPick = function () {
  return new Promise(res => {
    const bg = document.createElement('div'); bg.className = 'dlg-bg'; bg.style.cssText = 'position:fixed;inset:0;background:rgba(10,30,22,.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
    bg.innerHTML = `<div style="background:#fff;border-radius:22px 22px 0 0;padding:20px 18px 26px;width:100%;max-width:520px"><h3 style="margin:0 0 4px">어떤 사진인가요?</h3><p class="small muted" style="margin:0 0 12px">고르면 카메라나 앨범이 열려요.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${Object.entries(SH.EXP_KIND).map(([k, t]) => `<button type="button" class="btn line" data-k="${k}" style="justify-content:flex-start">${t}</button>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:12px"><label style="display:flex;gap:6px;align-items:center;font-size:14px;flex:1"><input type="checkbox" id="kCam" checked> 바로 사진 찍기</label><button type="button" class="btn ghost" data-x>취소</button></div></div>`;
    document.body.appendChild(bg);
    const done = v => { bg.remove(); res(v); };
    bg.onclick = e => { if (e.target === bg) done(null); }; bg.querySelector('[data-x]').onclick = () => done(null);
    bg.querySelectorAll('[data-k]').forEach(b => b.onclick = () => done({ k: b.dataset.k, camera: bg.querySelector('#kCam').checked }));
  });
};
SH.pickFile = function (camera) {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (camera) i.setAttribute('capture', 'environment');
    i.onchange = () => res(i.files && i.files[0] || null); i.click();
    setTimeout(() => window.addEventListener('focus', () => setTimeout(() => { if (!i.files || !i.files.length) res(null); }, 800), { once: true }), 300);
  });
};
SH.expertTag = d => d.expert_verdict ? `<span class="tag" style="background:${SH.EXP_VERDICT[d.expert_verdict].bg};color:${SH.EXP_VERDICT[d.expert_verdict].c}">${SH.EXP_VERDICT[d.expert_verdict].emo} 전문가</span>`
  : d.expert_status === 'waiting' ? '<span class="tag" style="background:#EEF1EF;color:#43524B">⏳ 전문가</span>' : '';

/* 카드 모양 */
const css = `.exbox .exstate{background:#F3F6F4;border-radius:12px;padding:10px 12px;margin:0 0 8px;font-size:15px}
.exbox .exstate.st-more{background:#FDECE6}.exbox .exstate.st-done{background:#EAF4E3}
.excount{border:1.5px dashed #D8CFB8;border-radius:12px;padding:10px 12px;margin:10px 0;font-size:15px}.excount.ok{border-color:#7FB069;background:#F4FAF0}
.excount span{color:#6b756f;font-size:13.5px}.exchips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.exchips span{font-size:13px;padding:3px 9px;border-radius:999px;background:#EFEDE6;color:#6b756f}.exchips span.on{background:#DDEED3;color:#2F6A1F;font-weight:700}
.exgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}.exgrid figure{margin:0;position:relative;border-radius:12px;overflow:hidden;background:#EFEDE6;aspect-ratio:1}
.exgrid img{width:100%;height:100%;object-fit:cover;display:block}.exgrid figcaption{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);color:#fff;font-size:11.5px;padding:3px 6px}
.exdel{position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:13px;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:16px;cursor:pointer}
.exadd{aspect-ratio:1;border:2px dashed #C9BFA5;border-radius:12px;background:#FBF9F3;color:#22543F;font-weight:700;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer}
.exadd span{font-size:28px;line-height:1}`;
const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

/* ───── 미리보기(데모) 백엔드 ───── */
const ph = (emo, bg) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='${bg}'/><text x='200' y='250' font-size='170' text-anchor='middle'>${emo}</text></svg>`);
SH.demoExpert = function (fn, a, X) {
  const { db, sess, sid, adm, save } = X;
  if (!db.experts) {
    db.experts = [{ id: 'e1', name: '김식물', org: '국립수목원', field: '목본', email: 'expert@seedhands.kr', pw: 'expert-demo', active: true, created_at: new Date(Date.now() - 20 * 864e5).toISOString() },
      { id: 'e2', name: '이초본', org: '서울여대 식물분류 연구실', field: '초본', email: 'herb@seedhands.kr', pw: 'expert-demo', active: true, created_at: new Date(Date.now() - 12 * 864e5).toISOString() }];
    db.photos = []; db.reqs = [];
    const seedReq = (accId, by, q, hoursAgo, extra) => {
      const x = db.accs.find(y => y.id === accId); if (!x) return;
      x.photo_plant = x.photo_plant || ph('🌳', '#CFE6C4'); x.photo_seed = x.photo_seed || ph('🌰', '#F1E2C8'); x.photo_fruit = x.photo_fruit || ph('🍒', '#F6D9D2');
      extra.forEach((k, i) => db.photos.push({ id: accId + 'p' + i, acc_id: accId, kind: k, img: ph({ leaf: '🍃', flower: '🌸', stem: '🌿', bark: '🪵', seed: '🌰', habit: '🌲' }[k] || '📷', '#E8EFE4'), created_at: new Date().toISOString() }));
      db.reqs.push({ id: 'q' + accId, acc_id: accId, school_id: x.school_id, requested_by: by, requester: by === 'teacher' ? '담당 교사' : (db.students.find(s => s.id === x.student_id) || {}).name + ' (학생)', question: q, status: 'waiting',
        ai_level: x.data.ai_level || (hoursAgo > 30 ? 'check' : 'match'), claimed_plant: x.data.plant, claimed_sci: x.data.sci, created_at: new Date(Date.now() - hoursAgo * 36e5).toISOString(), rounds: 1 });
      x.data.expert_status = 'waiting'; x.data.ai_level = x.data.ai_level || (hoursAgo > 30 ? 'check' : 'match');
    };
    seedReq('ex0a0', 'teacher', '쑥부쟁이와 개쑥부쟁이 구분 부탁드려요.', 40, ['leaf', 'flower']);
    seedReq('ex1a1', 'student', '청미래덩굴이 맞나요? 잎이 둥글어요.', 18, ['leaf', 'stem', 'habit']);
    seedReq('ex5a1', 'teacher', '팥배나무 열매가 맞는지 확인 부탁드립니다.', 6, ['leaf']);
    seedReq('ex7a0', 'student', '', 3, ['leaf', 'flower', 'seed']);
    const done = db.accs.find(y => y.id === 'ex2a0'); if (done) { seedReq('ex2a0', 'teacher', '', 70, ['leaf']); const q = db.reqs[db.reqs.length - 1]; Object.assign(q, { status: 'done', verdict: 'correct', ko: done.data.plant, sci: done.data.sci, comment: '열매가 주황색으로 갈라지고 붉은 씨껍질이 보여 노박덩굴이 맞아요.', expert_id: 'e1', done_at: new Date(Date.now() - 50 * 36e5).toISOString() });
      Object.assign(done.data, { expert_status: 'done', expert_verdict: 'correct', expert_ko: done.data.plant, expert_sci: done.data.sci, expert_comment: q.comment, expert_name: '김식물 (국립수목원)', expert_org: '국립수목원', expert_at: q.done_at, identifier: '김식물 (국립수목원)' }); }
    save();
  }
  const exp = sess.expert ? db.experts.find(e => e.id === sess.expert && e.active) : null;
  const me = exp ? { id: exp.id, name: exp.name, org: exp.org, field: exp.field, hq: false } : adm && adm.super ? { id: null, name: '운영국', org: '서울여대 시드핸즈 총괄팀', hq: true } : null;
  const role = accId => { const x = db.accs.find(y => y.id === accId); if (!x) return null; if (sid) return x.student_id === sid ? 'student' : null; if (adm) return adm.super ? 'hq' : adm.school_id === x.school_id ? 'teacher' : null; return exp ? 'expert' : null; };
  const nPh = x => 2 + (x.photo_fruit ? 1 : 0) + db.photos.filter(p => p.acc_id === x.id).length;
  const now = () => new Date().toISOString();
  switch (fn) {
    case 'seedhands_acc_photos': { const r = role(a.p_acc); if (!r) return { ok: false, error: 'session' }; return { ok: true, items: db.photos.filter(p => p.acc_id === a.p_acc), req: db.reqs.find(q => q.acc_id === a.p_acc) || null }; }
    case 'seedhands_acc_photo_add': { const r = role(a.p_acc); if (!r || r === 'expert') return { ok: false, error: 'session' }; if (db.photos.filter(p => p.acc_id === a.p_acc).length >= 6) return { ok: false, error: '자세한 사진은 6장까지 넣을 수 있어요.' };
      db.photos.push({ id: 'p' + Date.now(), acc_id: a.p_acc, kind: a.p_kind, img: a.p_img, created_at: now() }); save(); return { ok: true }; }
    case 'seedhands_acc_photo_del': { db.photos = db.photos.filter(p => p.id !== a.p_id); save(); return { ok: true }; }
    case 'seedhands_expert_request': {
      const r = role(a.p_acc); if (!r || r === 'expert') return { ok: false, error: 'session' }; const x = db.accs.find(y => y.id === a.p_acc);
      if (!x.photo_plant || !x.photo_seed) return { ok: false, error: '식물 전체 사진과 씨앗 사진이 꼭 있어야 해요.' };
      const n = nPh(x); if (n < 3) return { ok: false, error: '사진이 3장 이상 있어야 전문가에게 보낼 수 있어요. 잎·꽃·열매·줄기 사진을 더 넣어 주세요.' };
      let q = db.reqs.find(y => y.acc_id === x.id); if (q && ['waiting', 'claimed'].includes(q.status)) return { ok: false, error: '이미 전문가 검토를 기다리고 있어요.' };
      const who = r === 'student' ? (db.students.find(s => s.id === x.student_id) || {}).name + ' (학생)' : r === 'teacher' ? '담당 교사' : '운영국';
      if (!q) { q = { id: 'q' + Date.now(), acc_id: x.id, school_id: x.school_id, rounds: 0 }; db.reqs.push(q); }
      Object.assign(q, { requested_by: r, requester: who, question: a.p_question || '', status: 'waiting', ai_level: x.data.ai_level, claimed_plant: x.data.plant, claimed_sci: x.data.sci, created_at: now(), expert_id: null, done_at: null, rounds: (q.rounds || 0) + 1 });
      x.data.expert_status = 'waiting'; save(); return { ok: true, id: q.id, photos: n };
    }
    case 'seedhands_expert_login': { const e = db.experts.find(y => y.email === String(a.p_email || '').trim().toLowerCase() && y.active); if (!e) return { ok: false, error: '등록된 전문가 계정이 아니에요. 운영국에 문의해 주세요.' }; if (e.pw !== a.p_pw) return { ok: false, error: '비밀번호가 맞지 않아요.' };
      const t = 'ex' + Math.random().toString(36).slice(2); db.sessions[t] = { expert: e.id }; save(); return { ok: true, token: t, expert: { name: e.name, org: e.org, field: e.field } }; }
    case 'seedhands_expert_queue': {
      if (!me) return { ok: false, error: 'session' };
      const C = s => db.reqs.filter(q => q.status === s).length;
      const L = db.reqs.filter(q => !a.p_status || q.status === a.p_status || (a.p_status === 'open' && ['waiting', 'claimed'].includes(q.status))).map(q => { const x = db.accs.find(y => y.id === q.acc_id) || { data: {} }; const sc = db.schools.find(s => s.id === q.school_id) || {};
        return { ...q, plant: q.claimed_plant, sci: q.claimed_sci, expert: (db.experts.find(e => e.id === q.expert_id) || {}).name, mine: !!me.id && q.expert_id === me.id, school: sc.name, region: sc.region, acc_no: x.acc_no, date: x.data.date, address: x.data.address, lat: x.data.lat, lng: x.data.lng, alt: x.data.alt, family: x.data.family, photos: nPh(x) }; })
        .sort((p, q) => p.created_at < q.created_at ? -1 : 1);
      return { ok: true, me, counts: { waiting: C('waiting'), claimed: C('claimed'), more: C('more'), done: C('done'), mine: db.reqs.filter(q => me.id && q.expert_id === me.id && ['done', 'more'].includes(q.status)).length }, items: L };
    }
    case 'seedhands_expert_get': {
      if (!me) return { ok: false, error: 'session' }; const q = db.reqs.find(y => y.id === a.p_req); if (!q) return { ok: false, error: '요청을 찾지 못했어요.' }; const x = db.accs.find(y => y.id === q.acc_id); const sc = db.schools.find(s => s.id === x.school_id) || {};
      return { ok: true, req: q, expert: (db.experts.find(e => e.id === q.expert_id) || {}).name, acc: { ...x }, school: { name: sc.name, region: sc.region, site_name: sc.site_name }, photos: db.photos.filter(p => p.acc_id === x.id),
        ai: x.data.ai_level ? { model: '미리보기', result: { level: x.data.ai_level, score: 72, summary: x.data.ai_summary || '사진 속 잎 모양은 적은 이름과 비슷해요. 열매 사진을 더 보면 좋아요.', plant_check: '잎 가장자리 톱니와 어긋나기 배열이 보여요.', seed_check: '씨앗이 갈색으로 잘 익었어요.', candidates: [{ ko: x.data.plant, sci: x.data.sci, reason: '잎과 열매 모양' }], for_teacher: '비슷한 종과 헷갈릴 수 있어 확인이 필요해요.' } } : null };
    }
    case 'seedhands_expert_claim': { if (!me || !me.id) return { ok: false, error: '전문가 계정으로 맡을 수 있어요.' }; const q = db.reqs.find(y => y.id === a.p_req);
      if (a.p_on && q.status === 'waiting') Object.assign(q, { status: 'claimed', expert_id: me.id, claimed_at: now() }); else if (!a.p_on && q.status === 'claimed' && q.expert_id === me.id) Object.assign(q, { status: 'waiting', expert_id: null }); else return { ok: false, error: '다른 전문가가 이미 맡았거나 상태가 바뀌었어요.' }; save(); return { ok: true }; }
    case 'seedhands_expert_answer': {
      if (!me) return { ok: false, error: 'session' }; const q = db.reqs.find(y => y.id === a.p_req); const x = db.accs.find(y => y.id === q.acc_id); const v = a.p_verdict;
      if (!SH.EXP_VERDICT[v]) return { ok: false, error: '판정을 골라 주세요.' }; if (v === 'corrected' && !(a.p_ko || '').trim()) return { ok: false, error: '바른 국명을 적어 주세요.' };
      if (['uncertain', 'need_photo'].includes(v) && !(a.p_comment || '').trim()) return { ok: false, error: '학생과 선생님이 알 수 있게 의견을 적어 주세요.' };
      const nm = me.name + (me.org ? ` (${me.org})` : '');
      Object.assign(q, { status: v === 'need_photo' ? 'more' : 'done', verdict: v, ko: v === 'correct' ? (a.p_ko || x.data.plant) : a.p_ko, sci: v === 'correct' ? (a.p_sci || x.data.sci) : a.p_sci, family: a.p_family, comment: a.p_comment, done_at: now(), expert_id: me.id || q.expert_id });
      Object.assign(x.data, { expert_status: q.status, expert_verdict: v, expert_ko: q.ko, expert_sci: q.sci, expert_family: q.family, expert_comment: q.comment, expert_name: nm, expert_org: me.org, expert_at: now() });
      if (v === 'correct' || v === 'corrected') x.data.identifier = nm;
      if (v === 'corrected') Object.assign(x.data, { plant_orig: x.data.plant_orig || x.data.plant, plant: q.ko, sci: q.sci || '', family: q.family || x.data.family });
      save(); return { ok: true, status: q.status };
    }
    case 'seedhands_hq_experts': {
      if (!adm || !adm.super) return { ok: false, error: 'session' }; const R = db.reqs, c = f => R.filter(f).length; const dn = R.filter(q => q.done_at);
      const oldest = R.filter(q => ['waiting', 'claimed'].includes(q.status)).reduce((m, q) => Math.max(m, (Date.now() - new Date(q.created_at)) / 36e5), 0);
      return { ok: true, experts: db.experts.map(e => ({ ...e, pw: undefined, done: c(q => q.expert_id === e.id && ['done', 'more'].includes(q.status)), claimed: c(q => q.expert_id === e.id && q.status === 'claimed') })),
        stats: { total: R.length, waiting: c(q => q.status === 'waiting'), claimed: c(q => q.status === 'claimed'), more: c(q => q.status === 'more'), done: c(q => q.status === 'done'),
          hours: dn.length ? +(dn.reduce((s, q) => s + (new Date(q.done_at) - new Date(q.created_at)) / 36e5, 0) / dn.length).toFixed(1) : null, oldest_hours: oldest ? +oldest.toFixed(1) : null,
          correct: c(q => q.verdict === 'correct'), corrected: c(q => q.verdict === 'corrected'), uncertain: c(q => q.verdict === 'uncertain'), need_photo: c(q => q.verdict === 'need_photo'),
          ai_match_ok: c(q => q.ai_level === 'match' && q.verdict === 'correct'), ai_match_total: c(q => q.ai_level === 'match' && ['correct', 'corrected'].includes(q.verdict)),
          ai_flag_ok: c(q => ['check', 'mismatch'].includes(q.ai_level) && q.verdict === 'corrected'), ai_flag_total: c(q => ['check', 'mismatch'].includes(q.ai_level) && ['correct', 'corrected'].includes(q.verdict)),
          decided: c(q => ['correct', 'corrected'].includes(q.verdict)) } };
    }
    case 'seedhands_hq_expert_save': {
      if (!adm || !adm.super) return { ok: false, error: 'session' };
      if (!(a.p_name || '').trim() || !/^[^@\s]+@[^@\s]+$/.test((a.p_email || '').trim())) return { ok: false, error: '이름과 이메일(로그인 아이디)을 바르게 적어 주세요.' };
      if (a.p_pw && a.p_pw.length < 8) return { ok: false, error: '비밀번호는 8자 이상이에요.' };
      let e = db.experts.find(y => y.id === a.p_id);
      if (!e) { if (!a.p_pw) return { ok: false, error: '처음 만들 때는 비밀번호가 필요해요.' }; if (db.experts.some(y => y.email === a.p_email.trim().toLowerCase())) return { ok: false, error: '이미 등록된 이메일이에요.' }; e = { id: 'e' + Date.now(), created_at: now() }; db.experts.push(e); }
      Object.assign(e, { name: a.p_name.trim(), org: a.p_org, field: a.p_field, email: a.p_email.trim().toLowerCase(), active: a.p_active !== false }); if (a.p_pw) e.pw = a.p_pw; save(); return { ok: true, id: e.id };
    }
  }
  return null;
};
})();
