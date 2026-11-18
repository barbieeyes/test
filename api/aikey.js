// 학교 AI 키 등록·확인 (선생님 관리자 토큰 필요). 키는 서버에서 암호화해 저장하고, 화면엔 끝 4자리만 돌려줍니다.
const { rpc, encrypt, decrypt, chat, body, SRV } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const b = body(req);
  if (!b) return res.status(400).json({ ok: false, error: '요청 형식이 올바르지 않아요.' });
  if (!b.token) return res.status(401).json({ ok: false, error: '선생님 로그인이 필요해요.' });
  const provider = b.provider;
  if (!['shared', 'google', 'anthropic', 'gateway', 'none'].includes(provider)) return res.status(400).json({ ok: false, error: '연결 방식을 골라 주세요.' });

  // 1) 키 확인 (test): 새 키 또는 저장된 키로 아주 짧은 질문을 보내 봅니다
  if (b.action === 'test') {
    let key = (b.key || '').trim(), prov = provider;
    try {
      const g = await rpc('seedhands_admin_ai_get', { p_token: b.token });
      if (!g.ok) return res.status(403).json({ ok: false, error: '선생님으로 다시 로그인해 주세요.' });
      const q = key ? { ok: true } : await rpc('seedhands_ai_quota2', { p_secret: SRV(), p_token: b.token });
      if (!q.ok) return res.status(400).json({ ok: false, error: q.error === 'session' ? '다시 로그인해 주세요.' : q.error });
      if (key && !['google', 'anthropic', 'gateway'].includes(prov)) return res.status(400).json({ ok: false, error: '연결 방식을 골라 주세요.' });
      if (!key) {
        prov = q.provider;
        key = q.provider === 'shared' ? (process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN) : decrypt(q.cipher);
      }
      if (!key) return res.status(400).json({ ok: false, error: '키가 없어요.' });
      const out = await chat(prov, key, '한 단어로만 답해.', [{ type: 'text', text: '소나무의 학명 속명(Genus)은?' }], 300);
      return res.status(200).json({ ok: true, model: out.model, answer: String(out.text).slice(0, 40) });
    } catch (e) {
      const m = e.message || '';
      const why = /401|403|invalid|API key|permission/i.test(m) ? (/credit card|customer_verification/i.test(m) ? '결제 수단(카드) 등록이 필요해요.' : '키가 맞지 않거나 권한이 없어요.') : /429|quota|rate/i.test(m) ? '사용 한도를 넘었어요. 잠시 뒤 다시 해 보세요.' : '연결에 실패했어요.';
      return res.status(200).json({ ok: false, error: why, detail: m.slice(0, 160) });
    }
  }

  // 2) 저장
  let cipher = '', hint = '';
  if (['google', 'anthropic', 'gateway'].includes(provider) && b.key) {
    const k = String(b.key).trim();
    if (k.length < 20 || k.length > 400) return res.status(400).json({ ok: false, error: '키 모양이 올바르지 않아요.' });
    try { cipher = encrypt(k); } catch { return res.status(500).json({ ok: false, error: '서버 암호화 설정이 없어요. 운영국에 알려 주세요.' }); }
    hint = '••••' + k.slice(-4);
  }
  try {
    const r = await rpc('seedhands_admin_ai_set', { p_token: b.token, p_provider: provider, p_cipher: cipher, p_hint: hint });
    if (!r.ok) return res.status(400).json({ ok: false, error: r.error === 'session' ? '다시 로그인해 주세요.' : r.error });
    return res.status(200).json({ ok: true, provider, hint });
  } catch (e) { return res.status(502).json({ ok: false, error: '저장 중 문제가 생겼어요.' }); }
};
