// 시드핸즈 AI 검토: 식물 사진 + 씨앗 사진 + 학생이 적은 이름 → 참고 의견
// 학교 키가 있으면 그 키로, 없으면 운영국 공용(Vercel AI Gateway, OIDC)으로 호출합니다.
const { rpc, decrypt, chat, body } = require('./_lib');

const SYSTEM = `너는 한국 자생식물 종자 채집을 돕는 식물분류 전문가야. 초·중학생이 학교 시드핸즈 활동에서 채종한 씨앗 기록을 미리 검토해.
학생이 적은 식물 이름이 사진과 맞는지, 씨앗이 잘 익었는지, 사진이 동정에 충분한지 살펴봐.
원칙:
- 확신이 없으면 솔직하게 '확인 필요'라고 해. 추측을 사실처럼 말하지 마.
- 최종 동정은 선생님과 전문가가 한다는 점을 존중해. 너의 의견은 참고용이야.
- 채집 날짜·위치(위도/경도/고도)·식생대도 함께 고려해서, 그 시기·지역에 열매를 맺기 어려운 종이면 알려 줘.
- 한국어 국명과 학명을 정확하게 써. 모르는 학명은 지어내지 마.
- 독성·가시·옻 등 안전 주의가 필요한 식물이면 꼭 알려 줘.
- 도토리·동백처럼 말리면 죽는 씨앗(난저장성)으로 알려진 종이면 for_teacher에 적어 줘.
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
const okImg = u => typeof u === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(u) && u.length < 1600000;

function keyFor(req, q) {
  if (q.provider === 'shared') return { provider: 'shared', key: process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN };
  let key = null; try { key = decrypt(q.cipher); } catch { key = null; }
  return { provider: q.provider, key };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = body(req);
  if (!b.token) return res.status(400).json({ ok: false, error: '로그인이 필요해요.' });
  if (!okImg(b.plantPhoto) || !okImg(b.seedPhoto)) return res.status(400).json({ ok: false, error: '식물 사진과 씨앗 사진이 둘 다 있어야 AI 검토를 받을 수 있어요.' });

  let q;
  try { q = await rpc('seedhands_ai_quota', { p_token: b.token }); }
  catch (e) { console.error(e.message); return res.status(502).json({ ok: false, error: '서버 확인 중 문제가 생겼어요.' }); }
  if (!q.ok) return res.status(q.error === 'session' ? 401 : 429).json({ ok: false, off: !!q.off, error: q.error === 'session' ? '다시 로그인해 주세요.' : q.error });

  const { provider, key } = keyFor(req, q);
  if (!key) return res.status(503).json({ ok: false, off: true, error: 'AI 연결이 아직 안 됐어요. 선생님 확인으로 넘어가요.' });

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

  let out;
  try { out = await chat(provider, key, SYSTEM, content, 1400); }
  catch (e) {
    console.error('ai fail', provider, e.message);
    const card = /credit card|customer_verification/i.test(e.message);
    return res.status(502).json({ ok: false, off: card, error: card ? 'AI 결제 설정이 아직 안 돼서 지금은 AI 검토를 쓸 수 없어요. 선생님 확인으로 넘어가요.' : 'AI가 지금 답하지 못했어요. 잠시 뒤 다시 해 보거나, 선생님 확인으로 넘어가요.' });
  }
  const result = parseJson(out.text);
  if (!result) return res.status(502).json({ ok: false, error: 'AI 답을 읽지 못했어요. 한 번 더 눌러 주세요.' });

  const lv = ['match', 'check', 'mismatch', 'photo'].includes(result.level) ? result.level : 'check';
  const S = (v, n) => String(v || '').slice(0, n);
  const clean = {
    level: lv, score: Math.max(0, Math.min(100, Math.round(+result.score || 0))),
    summary: S(result.summary, 400), plant_check: S(result.plant_check, 500), seed_check: S(result.seed_check, 500),
    season_region: S(result.season_region, 400), safety: S(result.safety, 300), for_teacher: S(result.for_teacher, 600),
    candidates: (Array.isArray(result.candidates) ? result.candidates : []).slice(0, 3).map(c => ({ ko: S(c.ko, 60), sci: S(c.sci, 100), reason: S(c.reason, 200) })),
    photo_tips: (Array.isArray(result.photo_tips) ? result.photo_tips : []).slice(0, 4).map(t => S(t, 120)),
    claimed: { plant: S(b.plant, 60), sci: S(b.sci, 100) }, provider,
  };
  let id = null;
  try { const lg = await rpc('seedhands_ai_log', { p_token: b.token, p_plant: b.plant || '', p_sci: b.sci || '', p_model: out.model, p_result: clean }); id = lg.id || null; }
  catch (e) { console.error('log fail', e.message); }
  return res.status(200).json({ ok: true, id, model: out.model, result: clean });
};
