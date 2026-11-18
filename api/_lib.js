// 시드핸즈 서버 공통: Supabase RPC, 키 암호화, AI 호출
const crypto = require('crypto');
const SB_URL = 'https://hcvaaxxwqqrbpnloyjzr.supabase.co';
const ANON = process.env.SH_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjdmFheHh3cXFyYnBubG95anpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjI1MTgsImV4cCI6MjEwMTU5ODUxOH0.8TKT8aExXiyazDY313G9BHTvZCSu2yrTdxlgwxpNCB8';

async function rpc(fn, body, anon) {
  const key = anon || ANON;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('db ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

function secretKey() {
  const s = process.env.SH_KEY_SECRET;
  if (!s || s.length < 16) return null;
  return crypto.createHash('sha256').update(s).digest();
}
function encrypt(plain) {
  const k = secretKey(); if (!k) throw new Error('no secret');
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return 'v1:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function decrypt(blob) {
  const k = secretKey(); if (!k || !blob || !blob.startsWith('v1:')) return null;
  const b = Buffer.from(blob.slice(3), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', k, b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

/* provider → 호출 방법
   shared   : 운영국 Vercel AI Gateway (OIDC)
   gateway  : 학교 Vercel AI Gateway 키
   google   : 학교 Google Gemini API 키 (OpenAI 호환 주소)
   anthropic: 학교 Anthropic API 키 */
const TARGETS = {
  shared: { url: 'https://ai-gateway.vercel.sh/v1/chat/completions', models: ['anthropic/claude-sonnet-5.5', 'google/gemini-2.5-flash'], kind: 'openai' },
  gateway: { url: 'https://ai-gateway.vercel.sh/v1/chat/completions', models: ['anthropic/claude-sonnet-5.5', 'google/gemini-2.5-flash'], kind: 'openai' },
  google: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'], kind: 'openai' },
  anthropic: { url: 'https://api.anthropic.com/v1/messages', models: ['claude-sonnet-5-5', 'claude-haiku-5-5'], kind: 'anthropic' },
};

async function chat(provider, key, system, content, maxTokens) {
  const T = TARGETS[provider]; if (!T) throw new Error('provider');
  let lastErr = '';
  for (const m of T.models) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 45000);
    try {
      let r, text;
      if (T.kind === 'anthropic') {
        const blocks = content.map(c => {
          if (c.type === 'text') return { type: 'text', text: c.text };
          const mm = /^data:(image\/[a-z]+);base64,(.*)$/.exec(c.image_url.url);
          return { type: 'image', source: { type: 'base64', media_type: mm[1], data: mm[2] } };
        });
        r = await fetch(T.url, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: m, max_tokens: maxTokens, temperature: 0.2, system, messages: [{ role: 'user', content: blocks }] }) });
        if (!r.ok) { lastErr = `${m} ${r.status} ${(await r.text()).slice(0, 300)}`; continue; }
        const j = await r.json(); text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      } else {
        r = await fetch(T.url, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: m, max_tokens: maxTokens, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content }] }) });
        if (!r.ok) { lastErr = `${m} ${r.status} ${(await r.text()).slice(0, 300)}`; continue; }
        const j = await r.json(); text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      }
      if (text) return { text, model: (provider === 'shared' || provider === 'gateway' ? '' : provider + '/') + m };
      lastErr = m + ' empty';
    } catch (e) { lastErr = m + ' ' + e.message; } finally { clearTimeout(tm); }
  }
  const err = new Error(lastErr); err.ai = true; throw err;
}

function body(req) { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }

module.exports = { rpc, encrypt, decrypt, chat, body, TARGETS };
