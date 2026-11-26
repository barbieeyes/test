// 에코쌤즈 팀 공용 AI 중계: 브라우저에 키를 두지 않고, Vercel 환경변수 ANTHROPIC_API_KEY로 Claude를 부른다.
// GET  /api/ai → { configured: true|false }
// POST /api/ai (헤더 x-team-pin) → Anthropic Messages API 응답 그대로
const MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5", "claude-fable-5-1"];
const DEFAULT_MODEL = "claude-sonnet-5-5";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.ANTHROPIC_API_KEY || "";
  // Pl@ntNet 키는 사이트 주소(ecossam-map.vercel.app)로만 쓰이게 잠가 두는 공개용 키라 화면에 넘겨 준다
  if (req.method === "GET") return res.status(200).json({ configured: !!key, plantnet: process.env.PLANTNET_API_KEY || "" });
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 받아요" });
  if ((req.headers["x-team-pin"] || "") !== (process.env.TEAM_PIN || "2144")) return res.status(403).json({ error: "팀 비밀번호가 맞지 않아요" });
  if (!key) return res.status(503).json({ error: "팀 공용 AI 키가 설정되지 않았어요" });

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || !Array.isArray(b.messages) || !b.messages.length) return res.status(400).json({ error: "요청 형식이 올바르지 않아요" });
  const payload = {
    model: MODELS.includes(b.model) ? b.model : DEFAULT_MODEL,
    max_tokens: Math.max(64, Math.min(Number(b.max_tokens) || 1500, 12000)),
    messages: b.messages.slice(0, 4),
  };
  if (typeof b.system === "string") payload.system = b.system.slice(0, 2000);

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    res.status(r.status).setHeader("content-type", "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: "AI 서버에 연결하지 못했어요" });
  }
};
