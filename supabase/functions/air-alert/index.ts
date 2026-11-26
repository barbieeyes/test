// 공기질 환기 알림: eco_items(kind=air)가 바뀔 때마다 DB 트리거가 부르고,
// 측정 중인 보드의 CO₂가 2분 연속 기준을 넘으면 구독한 휴대폰에 웹 푸시를 보내요.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-team-pin, apikey, authorization", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const COOLDOWN = 30 * 60 * 1000; // 같은 보드는 30분에 한 번만 다시 알림
const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");

let keys: Record<string, string> | null = null;
async function getKeys() {
  if (keys) return keys;
  const { data } = await sb.from("air_private").select("k,v");
  keys = Object.fromEntries((data || []).map((r: any) => [r.k, r.v]));
  webpush.setVapidDetails("mailto:ecossam@example.com", keys.vapid_pub, keys.vapid_priv);
  return keys;
}

async function send(endpoint: string, sub: any, payload: object) {
  try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 600, urgency: "high" }); return true; }
  catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("air_push").delete().eq("endpoint", endpoint);
    console.log("push fail", e?.statusCode, String(e?.body || e).slice(0, 200));
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const k = await getKeys();
  const body = await req.json().catch(() => ({}));

  // 앱의 '시험 알림' 버튼
  if (body.test) {
    if (req.headers.get("x-team-pin") !== "2144") return json({ error: "pin" }, 401);
    const { data } = await sb.from("air_push").select("endpoint,sub").eq("endpoint", body.endpoint).maybeSingle();
    if (!data) return json({ error: "not subscribed" }, 404);
    const ok = await send(data.endpoint, data.sub, { title: "에코쌤즈 공기질 알림", body: "알림이 잘 와요! CO₂가 기준을 넘으면 이렇게 알려 드릴게요.", tag: "air-test" });
    return json({ ok });
  }

  if (req.headers.get("x-alert-secret") !== k.secret) return json({ error: "forbidden" }, 403);
  const { data: it } = await sb.from("eco_items").select("data").eq("id", body.id).maybeSingle();
  const d: any = it?.data; if (!d || d.kind !== "air") return json({ skip: "no item" });
  const pts: number[][] = (d.points || []).slice().sort((a: number[], b: number[]) => a[0] - b[0]);
  if (pts.length < 2) return json({ skip: "few points" });
  const now = Date.now(), last = pts[pts.length - 1], prev = pts[pts.length - 2];
  if (now - last[0] > 5 * 60 * 1000) return json({ skip: "old upload" }); // 밀린 기록을 한꺼번에 올릴 때는 알리지 않음
  const dev = d.dev;

  // 측정 중(측정 시작을 눌렀고 아직 종료 안 함)일 때만 알림
  const { data: ss } = await sb.from("eco_items").select("data").eq("kind", "air_sess").eq("deleted", false).filter("data->>dev", "eq", dev);
  const sess = (ss || []).map((r: any) => r.data).filter((s: any) => !s.end).sort((a: any, b: any) => b.start - a.start)[0];
  if (!sess) return json({ skip: "not measuring" });
  const place = sess.place || d.place || "측정 장소";

  const { data: subs } = await sb.from("air_push").select("endpoint,sub,thr");
  const { data: sts } = await sb.from("air_alert_state").select("endpoint,over,last_sent").eq("dev", dev);
  const stMap = new Map((sts || []).map((s: any) => [s.endpoint, s]));
  // 튀는 값 하나로는 울리지 않게: 최근 2분이 모두 기준 이상일 때만
  const hi = Math.min(last[1], prev[1]);
  let sent = 0;
  for (const s of subs || []) {
    const st: any = stMap.get(s.endpoint) || { over: false, last_sent: 0 };
    const thr = s.thr || 1000;
    if (hi >= thr && (!st.over || now - st.last_sent > COOLDOWN)) {
      const ok = await send(s.endpoint, s.sub, { title: `환기가 필요해요 · ${place}`, body: `CO₂ ${fmt(last[1])}ppm (기준 ${fmt(thr)}ppm) · 창문을 열어 주세요`, tag: "air-" + dev });
      if (ok) { sent++; await sb.from("air_alert_state").upsert({ endpoint: s.endpoint, dev, over: true, last_sent: now }); }
    } else if (st.over && last[1] < thr - 100 && prev[1] < thr - 100) {
      const ok = await send(s.endpoint, s.sub, { title: `공기가 좋아졌어요 · ${place}`, body: `CO₂ ${fmt(last[1])}ppm으로 내려갔어요`, tag: "air-" + dev });
      if (ok) sent++;
      await sb.from("air_alert_state").upsert({ endpoint: s.endpoint, dev, over: false, last_sent: st.last_sent });
    }
  }
  return json({ ok: true, co2: last[1], sent });
});
