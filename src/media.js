/* ===== 사진 프레임 & 아카이브 영상 (캔버스) ===== */
(function (root) {
  const TEAM = "기후행동 실천모임 에코쌤즈";
  const MODE_INFO = {
    solo: { label: "따로", place: "우리 동네", color: "#2B9BD6", deep: "#1C6E9C" },
    team: { label: "같이", place: "학교", color: "#1E9E57", deep: "#16713E" },
    activity: { label: "활동", place: "", color: "#E8862A", deep: "#B4600E" },
    meeting: { label: "협의", place: "", color: "#9A6A2F", deep: "#6E4A1E" },
  };
  const FONT_DISPLAY = '"Jua", "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const FONT_BODY = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const FONT_STAMP = '"Share Tech Mono", "JetBrains Mono", ui-monospace, monospace';

  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function fontsReady() {
    try {
      if (!document.fonts) return;
      await Promise.race([
        Promise.all([document.fonts.load('48px "Jua"'), document.fonts.load('40px "Share Tech Mono"'), document.fonts.load('24px "IBM Plex Sans KR"')]),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch (e) {}
  }
  function cover(ctx, img, x, y, w, h) {
    const s = Math.max(w / img.width, h / img.height);
    const sw = w / s, sh = h / s, sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  function fitText(ctx, text, maxW, font, startPx, minPx) {
    let px = startPx;
    for (; px > minPx; px -= 2) { ctx.font = font.replace("{px}", px); if (ctx.measureText(text).width <= maxW) return px; }
    ctx.font = font.replace("{px}", minPx);
    let t = text; while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    return t === text ? minPx : { px: minPx, text: t + "…" };
  }
  function stampDate(ts) {
    const d = new Date(ts), p = (n) => String(n).padStart(2, "0");
    return `'${String(d.getFullYear()).slice(2)} ${p(d.getMonth() + 1)} ${p(d.getDate())}`;
  }
  function dotDate(ts) {
    const d = new Date(ts), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** 촬영 사진 → 팀 이름·날짜 도장이 찍힌 폴라로이드 프레임 (900×1125 JPEG) */
  async function composeFrame(rawDataUrl, meta) {
    await fontsReady();
    const img = await loadImg(rawDataUrl);
    const W = 900, H = 1125, P = 36, PH = 828;
    const M = MODE_INFO[meta.mode] || MODE_INFO.team;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#FFFBEF"; g.fillRect(0, 0, W, H);
    // 종이 결
    g.globalAlpha = 0.05; g.fillStyle = "#7A6A3A";
    for (let i = 0; i < 260; i++) g.fillRect((i * 97) % W, (i * 53) % H, 2, 2);
    g.globalAlpha = 1;
    cover(g, img, P, P, PH, PH);
    g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 2; g.strokeRect(P, P, PH, PH);
    // 필름 카메라 날짜 도장
    g.save(); g.font = `52px ${FONT_STAMP}`; g.textAlign = "right"; g.textBaseline = "alphabetic";
    g.shadowColor = "rgba(255,110,0,.85)"; g.shadowBlur = 12; g.fillStyle = "#FF8A1E";
    g.fillText(stampDate(meta.ts), P + PH - 26, P + PH - 26);
    g.shadowBlur = 0; g.fillStyle = "rgba(255,190,90,.55)"; g.fillText(stampDate(meta.ts), P + PH - 26, P + PH - 26);
    g.restore();
    // 아래 띠: 이름·학명·팀
    const bx = P + 6, textW = W - P * 2 - 190;
    const name = meta.name || (meta.mode === "meeting" ? "에코쌤즈 협의회" : meta.mode === "activity" ? "우리의 활동" : "이름을 찾는 중인 식물");
    g.fillStyle = "#1E5E38"; g.textBaseline = "alphabetic";
    const fn = fitText(g, name, textW, `{px}px ${FONT_DISPLAY}`, 58, 34);
    if (typeof fn === "object") { g.font = `${fn.px}px ${FONT_DISPLAY}`; g.fillText(fn.text, bx, 935); } else g.fillText(name, bx, 935);
    g.fillStyle = "#5F7A68";
    if (meta.sci) { g.font = `italic 27px ${FONT_BODY}`; const s2 = fitText(g, meta.sci, textW, `italic {px}px ${FONT_BODY}`, 27, 20);
      g.fillText(typeof s2 === "object" ? s2.text : meta.sci, bx, 978); }
    g.font = `22px ${FONT_BODY}`; g.fillStyle = "#3D5A48";
    const group = meta.mode === "activity" || meta.mode === "meeting";
    const line3 = group
      ? [meta.people && meta.people.length ? "함께 " + meta.people.join("·") : meta.researcher, meta.place, dotDate(meta.ts)].filter(Boolean).join(" · ")
      : `${M.label} · ${meta.researcher} · ${meta.place || M.place} · ${dotDate(meta.ts)}`;
    const l3 = fitText(g, line3, textW, `{px}px ${FONT_BODY}`, 22, 16);
    g.fillText(typeof l3 === "object" ? l3.text : line3, bx, 1020);
    g.font = `26px ${FONT_DISPLAY}`; g.fillStyle = M.deep; g.fillText(TEAM, bx, 1068);
    // 고무 도장 (따로 / 같이)
    g.save(); g.translate(W - 118, 985); g.rotate(-0.21);
    g.strokeStyle = M.color; g.fillStyle = M.color; g.globalAlpha = 0.9; g.lineWidth = 5;
    g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 60, 0, Math.PI * 2); g.stroke();
    g.textAlign = "center"; g.font = `46px ${FONT_DISPLAY}`; g.fillText(M.label, 0, 10);
    g.font = `17px ${FONT_BODY}`; g.fillText("에코쌤즈", 0, -30); g.fillText(group ? "기후행동" : (meta.researcher || ""), 0, 42);
    g.restore();
    // 맨 아래 색띠
    g.fillStyle = M.color; g.fillRect(0, H - 14, W, 14);
    return c.toDataURL("image/jpeg", 0.84);
  }

  /** 사진 목록 → 세로 아카이브 영상 (720×1280) */
  function pickMime() {
    if (typeof MediaRecorder === "undefined") return null;
    const list = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) {} }
    return "";
  }
  function grid(g, W, H, color, alpha) {
    g.fillStyle = color; g.fillRect(0, 0, W, H);
    g.strokeStyle = `rgba(255,255,255,${alpha})`; g.lineWidth = 2;
    for (let x = 0; x <= W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  }
  const ease = (u) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);

  function drawVideoFrame(g, W, H, t, plan) {
    const { intro, per, outro, items, title, stats } = plan;
    if (t < intro) {
      grid(g, W, H, "#2FA463", 0.16);
      const u = ease(t / 0.9);
      g.globalAlpha = u; g.textAlign = "center";
      g.fillStyle = "#FFEB3B"; g.font = `92px ${FONT_DISPLAY}`; g.fillText("기후행동", W / 2, 470 - (1 - u) * 40);
      g.fillText("실천모임", W / 2, 575 - (1 - u) * 40);
      g.fillStyle = "#fff"; g.font = `78px ${FONT_DISPLAY}`; g.fillText("에코쌤즈", W / 2, 675 - (1 - u) * 40);
      g.fillStyle = "#FFFBE6"; g.fillRect(W / 2 - 250, 730, 500, 72);
      g.strokeStyle = "#1E7F4A"; g.lineWidth = 4; g.strokeRect(W / 2 - 250, 730, 500, 72);
      g.fillStyle = "#1E7F4A"; g.font = `40px ${FONT_DISPLAY}`; g.fillText(title, W / 2, 780);
      g.fillStyle = "#fff"; g.font = `28px ${FONT_BODY}`; g.fillText(plan.range, W / 2, 870);
      g.globalAlpha = 1;
      return;
    }
    const tp = t - intro, idx = Math.floor(tp / per);
    if (idx < items.length) {
      const it = items[idx], u = (tp - idx * per) / per, M = MODE_INFO[it.mode] || MODE_INFO.team;
      grid(g, W, H, it.mode === "solo" ? "#2386BC" : it.mode === "activity" ? "#D9781E" : it.mode === "meeting" ? "#8A5E2A" : "#2FA463", 0.13);
      // 위: 따로/같이 꼬리표 + 순번
      g.textAlign = "left"; g.fillStyle = "#fff"; g.font = `44px ${FONT_DISPLAY}`;
      g.fillText(`${M.label} · ${it.researcher}`, 56, 120);
      g.textAlign = "right"; g.font = `30px ${FONT_STAMP}`; g.fillText(`${String(idx + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`, W - 56, 118);
      // 사진 프레임 카드 (살짝 들어오며 확대)
      const a = Math.min(1, u / 0.14, (1 - u) / 0.1);
      const fw = 600, fh = 750, s = 0.97 + 0.05 * u, rot = (idx % 2 ? 1 : -1) * (0.035 - 0.02 * u);
      g.save(); g.globalAlpha = Math.max(0, a); g.translate(W / 2, 640); g.rotate(rot); g.scale(s, s);
      g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 30; g.shadowOffsetY = 14;
      if (it.img) g.drawImage(it.img, -fw / 2, -fh / 2, fw, fh); else { g.fillStyle = "#FFFBEF"; g.fillRect(-fw / 2, -fh / 2, fw, fh); }
      g.restore();
      // 아래: 탄소 고정·장소
      g.globalAlpha = Math.max(0, a); g.textAlign = "center"; g.fillStyle = "#fff";
      g.font = `30px ${FONT_BODY}`; g.fillText(it.caption, W / 2, 1100);
      g.globalAlpha = 1;
      // 진행 막대 (필름 칸)
      const n = items.length, gap = 6, bw = Math.min(40, (W - 112 - gap * (n - 1)) / n);
      const total = n * bw + (n - 1) * gap; let x = (W - total) / 2;
      for (let i = 0; i < n; i++) { g.fillStyle = i < idx ? "#FFEB3B" : i === idx ? "#fff" : "rgba(255,255,255,.3)"; g.fillRect(x, 1190, bw, 10); x += bw + gap; }
      return;
    }
    // 마무리
    const to = t - intro - items.length * per, u = ease(to / 0.8);
    grid(g, W, H, "#1E7F4A", 0.12);
    g.globalAlpha = u; g.textAlign = "center";
    g.fillStyle = "#FFEB3B"; g.font = `70px ${FONT_DISPLAY}`; g.fillText("따로 또 같이", W / 2, 360);
    g.fillStyle = "#fff"; g.font = `34px ${FONT_BODY}`; g.fillText("우리가 함께 기록한 초록", W / 2, 420);
    const rows = [["따로 · 우리 동네", stats.solo + "건"], ["같이 · 학교", stats.team + "건"], ["함께한 활동·협의", stats.acts + "장"], ["만난 식물", stats.species + "종"], ["탄소 고정 합계 (g/h·m²)", stats.carbon]];
    rows.forEach(([k, v], i) => {
      const y = 520 + i * 98;
      g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(90, y - 62, W - 180, 88);
      g.textAlign = "left"; g.fillStyle = "#DFF5E6"; g.font = `30px ${FONT_BODY}`; g.fillText(k, 120, y);
      g.textAlign = "right"; g.fillStyle = "#FFEB3B"; g.font = `44px ${FONT_DISPLAY}`; g.fillText(v, W - 120, y + 2);
    });
    g.textAlign = "center"; g.fillStyle = "#fff"; g.font = `30px ${FONT_DISPLAY}`; g.fillText("이정연 · 신민화 · 이귀리 · 정종화", W / 2, 1060);
    g.font = `24px ${FONT_BODY}`; g.fillStyle = "#CDEBD7"; g.fillText(TEAM + " · 우리 지역 광합성 지도", W / 2, 1106);
    g.globalAlpha = 1;
  }

  function buildPlan(recs, opts) {
    const per = opts.per || 2.2;
    const items = recs.map((r) => (r.kind === "activity" || r.kind === "meeting")
      ? { mode: r.kind, researcher: (r.people && r.people.length ? r.people.join("·") : r.researcher), img: r._img || null, caption: r.title || (r.kind === "meeting" ? "에코쌤즈 협의회" : "우리의 활동") }
      : { mode: r.mode, researcher: r.researcher, img: r._img || null,
          caption: `${r.koreanName || "이름 모를 식물"} · 탄소 ${r.model && isFinite(r.model.gco2) ? r.model.gco2.toFixed(2) : "–"} g/h·m²` });
    const plants = recs.filter((r) => r.kind !== "activity" && r.kind !== "meeting");
    const ts = recs.map((r) => r.ts).sort((a, b) => a - b);
    const d = (x) => { const v = new Date(x); return `${v.getFullYear()}.${v.getMonth() + 1}.${v.getDate()}`; };
    const species = new Set(plants.map((r) => r.scientificName || r.koreanName).filter(Boolean)).size;
    const carbon = plants.reduce((s, r) => s + (r.model && r.model.gco2 || 0), 0).toFixed(1);
    return { intro: 2.6, per, outro: 3.6, items, title: opts.title || "따로 또 같이",
      range: ts.length ? (d(ts[0]) === d(ts[ts.length - 1]) ? d(ts[0]) : `${d(ts[0])} – ${d(ts[ts.length - 1])}`) : "",
      stats: { solo: plants.filter((r) => r.mode === "solo").length, team: plants.filter((r) => r.mode === "team").length,
        acts: recs.length - plants.length, species, carbon } };
  }

  async function makeVideo(recs, opts = {}) {
    const mime = pickMime();
    const canvas = document.createElement("canvas"); canvas.width = 720; canvas.height = 1280;
    if (mime === null || !canvas.captureStream) throw new Error("이 브라우저는 영상 만들기를 지원하지 않아요. 크롬이나 사파리 최신 버전에서 열어 주세요.");
    await fontsReady();
    for (const r of recs) { try { r._img = r.photo ? await loadImg(r.photo) : null; } catch (e) { r._img = null; } }
    const plan = buildPlan(recs, opts);
    const total = plan.intro + plan.items.length * plan.per + plan.outro;
    const g = canvas.getContext("2d");
    drawVideoFrame(g, 720, 1280, 0, plan);
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5000000 } : { videoBitsPerSecond: 5000000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const done = new Promise((res) => { rec.onstop = res; });
    rec.start(250);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        drawVideoFrame(g, 720, 1280, Math.min(t, total - 0.001), plan);
        if (opts.onProgress) opts.onProgress(Math.min(1, t / total));
        if (t >= total) { resolve(); return; }
        setTimeout(tick, 1000 / 30);
      };
      tick();
    });
    rec.stop(); await done;
    stream.getTracks().forEach((tr) => tr.stop());
    recs.forEach((r) => { delete r._img; });
    const type = (rec.mimeType || mime || "video/webm").split(";")[0];
    return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm", seconds: Math.round(total) };
  }

  /** JPEG EXIF 촬영 시각(DateTimeOriginal) 읽기. 없으면 null */
  async function exifDate(file) {
    try {
      const buf = await file.slice(0, 256 * 1024).arrayBuffer(); const v = new DataView(buf);
      if (v.getUint16(0) !== 0xFFD8) return null;
      let o = 2;
      while (o + 4 < v.byteLength) {
        const marker = v.getUint16(o), size = v.getUint16(o + 2);
        if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
          const t = o + 10, le = v.getUint16(t) === 0x4949;
          const u16 = (x) => v.getUint16(x, le), u32 = (x) => v.getUint32(x, le);
          const readStr = (x, n) => { let s = ""; for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(x + i)); return s; };
          const scan = (ifd, want) => { const n = u16(t + ifd); for (let i = 0; i < n; i++) { const e = t + ifd + 2 + i * 12; if (u16(e) === want) return e; } return -1; };
          let found = null;
          const ex = scan(u32(t + 4), 0x8769);
          if (ex > 0) { const e = scan(u32(ex + 8), 0x9003); if (e > 0) found = readStr(t + u32(e + 8), u32(e + 4)); }
          if (!found) { const e = scan(u32(t + 4), 0x0132); if (e > 0) found = readStr(t + u32(e + 8), u32(e + 4)); }
          const m = found && found.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
          if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]); if (!isNaN(d) && d.getFullYear() > 2000) return d.getTime(); }
          return null;
        }
        if ((marker & 0xFF00) !== 0xFF00) break;
        o += 2 + size;
      }
    } catch (e) {}
    return null;
  }

  root.EcoMedia = { exifDate, MODE_INFO, TEAM, composeFrame, makeVideo, drawVideoFrame, buildPlan, loadImg, fontsReady, stampDate, pickMime };
})(typeof window !== "undefined" ? window : globalThis);
