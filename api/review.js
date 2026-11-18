// 시드핸즈 AI 검토: 식물 사진 + 씨앗 사진 + 학생이 적은 이름을 보고 참고 의견을 돌려줍니다.
// Vercel AI Gateway 사용 (OIDC 토큰 또는 AI_GATEWAY_API_KEY). 학생 로그인 토큰이 있어야만 동작합니다.
const SB_URL = 'https://hcvaaxxwqqrbpnloyjzr.supabase.co';
const MODELS = ['anthropic/claude-sonnet-5.5', 'google/gemini-2.5-flash'];

async function sbRpc(fn, body, anon) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('db ' + r.status);
  return r.json();
}

const SYSTEM = `너는 한국 자생식물 종자 채집을 돕는 식물분류 전문가야. 초·중학생이 학교 시드핸즈 활동에서 채종한 씨앗 기록을 미리 검토해.
학생이 적은 식물 이름이 사진과 맞는지, 씨앗이 잘 익었는지, 사진이 동정에 충분한지 살펴봐.
원칙:
- 확신이 없으면 솔직하게 '확인 필요'라고 해. 추측을 사실처럼 말하지 마.
- 최종 동정은 선생님과 전문가가 한다는 점을 존중해. 너의 의견은 참고용이야.
- 채집 날짜·위치(위도/경도/고도)·식생대도 함께 고려해서, 그 시기·지역에 열매를 맺기 어려운 종이면 알려 줘.
- 한국어 국명과 학명을 정확하게 써. 모르는 학명은 지어내지 마.
- 독성·가시·옻 등 안전 주의가 필요한 식물이면 꼭 알려 줘.
- 학생용 문장은 초등학생도 이해하게 쉽고 친절하게, 2문장 이내로.
반드시 아래 JSON 한 개만 출력해 (코드블록 없이):
{"level":"match|check|mismatch|photo","score":0-100,"summary":"학생용 한두 문장","plant_check":"식물 사진 판단(1~2문장)","seed_check":"씨앗 사진 판단: 익음·상태(1~2문장)","candidates":[{"ko":"국명","sci":"학명","reason":"근거"}],"season_region":"시기·지역 적합성(1문장)","safety":"안전 주의(없으면 빈 문자열)","photo_tips":["더 찍으면 좋은 부분"],"for_teacher":"선생님께 드리는 전문 메모(1~2문장)"}
level 기준: match=적은 이름과 사진이 잘 맞음, check=비슷한 종과 헷갈리거나 사진만으론 판단이 어려움, mismatch=다른 종일 가능성이 큼, photo=사진이 흐리거나 부족해서 판단 불가.
candidates는 가능성 높은 순서로 최대 3개.`;

function parseJson(t) {
  if (!t) return null;
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e < s) return null;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return null; }
}

function okImg(u) { return typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(u) && u.length < 1600000; }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const anon = b.anon;
  if (!b.token || !anon) return res.status(400).json({ ok: false, error: '로그인이 필요해요.' });
  if (!okImg(b.plantPhoto) || !okImg(b.seedPhoto)) return res.status(400).json({ ok: false, error: '식물 사진과 씨앗 사진이 둘 다 있어야 AI 검토를 받을 수 있어요.' });

  try {
    const q = await sbRpc('seedhands_ai_quota', { p_token: b.token }, anon);
    if (!q.ok) return res.status(q.error === 'session' ? 401 : 429).json({ ok: false, error: q.error === 'session' ? '다시 로그인해 주세요.' : q.error });
  } catch (e) { return res.status(502).json({ ok: false, error: '서버 확인 중 문제가 생겼어요.' }); }

  const auth = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  if (!auth) return res.status(500).json({ ok: false, error: 'AI 연결 설정이 아직 안 됐어요. 선생님께 알려 주세요.' });

  const info = [
    `학생이 적은 식물 이름: ${b.plant || '(모름)'}${b.sci ? ` / 학명: ${b.sci}` : ''}`,
    `채종일: ${b.date || '(모름)'}`,
    b.lat ? `위치: 위도 ${(+b.lat).toFixed(4)}, 경도 ${(+b.lng).toFixed(4)}${b.alt != null && b.alt !== '' ? `, 해발 ${b.alt}m` : ''}${b.address ? ` (${b.address})` : ''}` : '위치: (없음)',
    b.zone ? `식생대(참고): ${b.zone}` : '',
    b.habitat ? `자라는 곳: ${b.habitat}` : '',
    b.fruit ? `열매 모양(학생 선택): ${b.fruit}` : '',
    '첫 번째 사진 = 식물 전체, 두 번째 사진 = 씨앗' + (okImg(b.fruitPhoto) ? ', 세 번째 사진 = 열매' : ''),
  ].filter(Boolean).join('\n');
  const content = [{ type: 'text', text: info }, { type: 'image_url', image_url: { url: b.plantPhoto } }, { type: 'image_url', image_url: { url: b.seedPhoto } }];
  if (okImg(b.fruitPhoto)) content.push({ type: 'image_url', image_url: { url: b.fruitPhoto } });

  let result = null, model = null, lastErr = '';
  for (const m of MODELS) {
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 45000);
      const r = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
        body: JSON.stringify({ model: m, max_tokens: 1400, temperature: 0.2, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }] }),
      });
      clearTimeout(tm);
      if (!r.ok) { lastErr = `${m} ${r.status} ${(await r.text()).slice(0, 300)}`; continue; }
      const j = await r.json();
      result = parseJson(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
      if (result) { model = m; break; }
      lastErr = m + ' parse';
    } catch (e) { lastErr = m + ' ' + e.message; }
  }
  if (!result) { console.error('ai fail', lastErr); return res.status(502).json({ ok: false, error: 'AI가 지금 답하지 못했어요. 잠시 뒤 다시 해 보거나, 선생님 확인으로 넘어가요.' }); }

  const lv = ['match', 'check', 'mismatch', 'photo'].includes(result.level) ? result.level : 'check';
  const clean = {
    level: lv, score: Math.max(0, Math.min(100, Math.round(+result.score || 0))),
    summary: String(result.summary || '').slice(0, 400), plant_check: String(result.plant_check || '').slice(0, 500),
    seed_check: String(result.seed_check || '').slice(0, 500), season_region: String(result.season_region || '').slice(0, 400),
    safety: String(result.safety || '').slice(0, 300), for_teacher: String(result.for_teacher || '').slice(0, 600),
    candidates: (Array.isArray(result.candidates) ? result.candidates : []).slice(0, 3).map(c => ({ ko: String(c.ko || '').slice(0, 60), sci: String(c.sci || '').slice(0, 100), reason: String(c.reason || '').slice(0, 200) })),
    photo_tips: (Array.isArray(result.photo_tips) ? result.photo_tips : []).slice(0, 4).map(t => String(t).slice(0, 120)),
    claimed: { plant: String(b.plant || '').slice(0, 60), sci: String(b.sci || '').slice(0, 100) },
  };
  let id = null;
  try { const lg = await sbRpc('seedhands_ai_log', { p_token: b.token, p_plant: b.plant || '', p_sci: b.sci || '', p_model: model, p_result: clean }, anon); id = lg.id || null; } catch (e) { console.error('log fail', e.message); }
  return res.status(200).json({ ok: true, id, model, result: clean });
};
