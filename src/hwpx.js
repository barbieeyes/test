/* ===== 한글(.hwpx) 협의록 만들기 =====
 * python-hwpx로 만든 틀(EcoHwpxTpl)의 표·문단을 복사해 내용을 채우고, 사진은 BinData로 넣는다.
 * 협의회 여러 건이면 한 파일에 쪽 나눔으로 이어 붙인다.
 */
(function (root) {
  const HU_PER_MM = 7200 / 25.4;
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    // XML 1.0에 넣을 수 없는 제어 문자 제거
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
  const pad = (n) => String(n).padStart(2, "0");
  function fmtWhen(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.(${DAYS[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** 문단 하나(<hp:p ...>…</hp:p>)의 시작·끝 위치 */
  function paraAround(xml, idx) {
    const s = xml.lastIndexOf("<hp:p ", idx);
    const e = xml.indexOf("</hp:p>", idx) + "</hp:p>".length;
    return [s, e];
  }
  /** 자리표시 문단을 여러 줄 문단으로 바꾸기 */
  function fillLines(xml, token, text) {
    const i = xml.indexOf(token); if (i < 0) return xml;
    const [s, e] = paraAround(xml, i);
    const tpl = xml.slice(s, e);
    const lines = String(text ?? "").replace(/\r/g, "").split("\n");
    const out = lines.map((ln) => tpl.replace(token, esc(ln))).join("");
    return xml.slice(0, s) + out + xml.slice(e);
  }
  function removePara(xml, token) {
    const i = xml.indexOf(token); if (i < 0) return xml;
    const [s, e] = paraAround(xml, i);
    return xml.slice(0, s) + xml.slice(e);
  }

  /** 할 일 목록을 글로 */
  function todoText(m) {
    const list = (m.todos || []).filter((t) => t && (t.what || t.task));
    if (!list.length) return "";
    return list.map((t) => `- ${t.what || t.task}${t.who ? ` (담당: ${t.who})` : ""}${t.when ? ` · ${t.when}` : ""}`).join("\n");
  }

  /**
   * @param {Array} meetings 협의회 기록 [{ts, place, people, title, content, decisions, todos, researcher, editedBy}]
   * @param {Object} opt { team, photos: (m) => [{bytes:Uint8Array, w, h, ext}] (이미 읽어 둔 사진) }
   * @returns {Promise<Blob|Uint8Array>}
   */
  async function build(meetings, opt = {}) {
    const T = root.EcoHwpxTpl, JSZip = root.JSZip;
    if (!T || !JSZip) throw new Error("한글 파일 도구를 불러오지 못했어요.");
    const team = opt.team || "기후행동 실천모임 에코쌤즈";
    const sec = T.section;
    const tStart = sec.lastIndexOf("<hp:p ", sec.indexOf("{{TITLE}}"));
    const endTok = sec.indexOf("{{END}}");
    const [, bEnd] = paraAround(sec, endTok);
    const head = sec.slice(0, tStart), block = sec.slice(tStart, bEnd), tail = sec.slice(bEnd);
    // 사진 문단 틀
    const picAt = block.indexOf("<hp:pic ");
    const [pS, pE] = paraAround(block, picAt);
    const picPara = block.slice(pS, pE);
    const runS = picPara.indexOf("<hp:run"), runE = picPara.lastIndexOf("</hp:run>") + "</hp:run>".length;
    const picRun = picPara.slice(runS, runE);
    const picParaOpen = picPara.slice(0, runS), picParaClose = picPara.slice(runE);
    const blockNoPic = block.slice(0, pS) + "{{PICS}}" + block.slice(pE);

    let nextId = 1000000 + Math.floor(Math.random() * 1000000);
    const reId = (x) => x.replace(/\b(id|instid)="(\d+)"/g, (all, k, v) => (v === "0" ? all : `${k}="${nextId++}"`));
    const bins = []; // {id, name, bytes, mime}
    const prv = [];
    const sorted = meetings.slice().sort((a, b) => a.ts - b.ts);
    let body = "";
    for (let mi = 0; mi < sorted.length; mi++) {
      const m = sorted[mi];
      let b = blockNoPic;
      const title = `${team} 협의록${m.title ? ` - ${m.title}` : ""}`;
      b = b.replace("{{TITLE}}", esc(title));
      b = b.replace("{{SUB}}", esc(`${fmtWhen(m.ts)} · ${m.place || "장소 미정"}`));
      const people = (m.people || []).join(", ");
      const vals = [fmtWhen(m.ts), m.place || "", `${people}${people ? ` (${(m.people || []).length}명)` : ""}`, m.title || "",
        m.content || "", m.decisions || "", todoText(m) || m.next || "", m.editedBy || m.researcher || ""];
      vals.forEach((v, i) => { b = fillLines(b, `{{V${i}}}`, v); });
      // 사진
      const photos = opt.photos ? await opt.photos(m) : [];
      if (photos.length) {
        const W = 72 * HU_PER_MM; // 두 장이 본문 폭(150mm)에 나란히
        let paras = "";
        for (let i = 0; i < photos.length; i += 2) {
          let runs = "";
          for (const ph of photos.slice(i, i + 2)) {
            const id = `BIN${String(bins.length + 1).padStart(4, "0")}`;
            const ext = ph.ext || "jpg";
            bins.push({ id, name: `BinData/${id}.${ext}`, bytes: ph.bytes, mime: ext === "png" ? "image/png" : "image/jpeg" });
            const w = Math.round(W), h = Math.round(W * (ph.h / ph.w || 1.25));
            let r = picRun.replace("{{BIN}}", id);
            r = r.replace(/<hp:orgSz width="\d+" height="\d+"\/>/, `<hp:orgSz width="${w}" height="${h}"/>`)
              .replace(/<hp:curSz width="\d+" height="\d+"\/>/, `<hp:curSz width="${w}" height="${h}"/>`)
              .replace(/centerX="\d+" centerY="\d+"/, `centerX="${w >> 1}" centerY="${h >> 1}"`)
              .replace(/<hc:pt1 x="\d+" y="0"\/>/, `<hc:pt1 x="${w}" y="0"/>`)
              .replace(/<hc:pt2 x="\d+" y="\d+"\/>/, `<hc:pt2 x="${w}" y="${h}"/>`)
              .replace(/<hc:pt3 x="0" y="\d+"\/>/, `<hc:pt3 x="0" y="${h}"/>`)
              .replace(/<hp:imgClip left="0" right="\d+" top="0" bottom="\d+"\/>/, `<hp:imgClip left="0" right="${w}" top="0" bottom="${h}"/>`)
              .replace(/<hp:imgDim dimwidth="\d+" dimheight="\d+"\/>/, `<hp:imgDim dimwidth="${w}" dimheight="${h}"/>`)
              .replace(/<hp:sz width="\d+" height="\d+" widthRelTo/, `<hp:sz width="${w}" height="${h}" widthRelTo`)
              .replace(/<hp:outMargin left="0" right="0" top="0" bottom="0"\/><hp:shapeComment/, `<hp:outMargin left="0" right="850" top="0" bottom="283"/><hp:shapeComment`);
            runs += r;
          }
          paras += picParaOpen + runs + picParaClose;
        }
        b = b.replace("{{PICS}}", paras);
      } else {
        b = b.replace("{{PICS}}", "");
        b = removePara(b, "■ 협의회 사진");
      }
      b = removePara(b, "{{END}}");
      if (mi > 0) b = b.replace('pageBreak="0"', 'pageBreak="1"'); // 첫 문단(제목)에서 쪽 나눔
      body += reId(b);
      prv.push(`${title}\n${vals[0]} ${vals[1]}`);
    }
    const section = head + body + tail;

    const zip = new JSZip();
    const NF = { createFolders: false }; // 한글 패키지에는 폴더 항목을 따로 넣지 않는다
    const F = T.files;
    const now = new Date();
    for (const name of T.order) {
      if (name === "Contents/section0.xml") { zip.file(name, section, NF); continue; }
      const f = F[name]; if (!f) continue;
      if (name === "mimetype") { zip.file(name, f.text, { compression: "STORE", createFolders: false }); continue; }
      if (f.b64) { zip.file(name, f.b64, { base64: true, createFolders: false }); continue; }
      let t = f.text;
      if (name === "Contents/content.hpf") {
        const items = bins.map((x) => `<opf:item id="${x.id}" href="${x.name}" media-type="${x.mime}" isEmbeded="1"/>`).join("");
        t = t.replace("</opf:manifest>", items + "</opf:manifest>")
          .replace(/<opf:title\/>|<opf:title>[^<]*<\/opf:title>/, `<opf:title>${esc(team)} 협의록</opf:title>`)
          .replace(/(name="ModifiedDate" content="text">)[^<]*/, `$1${now.toISOString().slice(0, 19)}Z`)
          .replace(/(name="CreatedDate" content="text">)[^<]*/, `$1${now.toISOString().slice(0, 19)}Z`)
          .replace(/(name="date" content="text">)[^<]*/, `$1${now.toLocaleString("ko-KR")}`);
      }
      if (name === "Preview/PrvText.txt") t = prv.join("\n\n").slice(0, 1000);
      zip.file(name, t, NF);
    }
    for (const x of bins) zip.file(x.name, x.bytes, NF);
    return zip.generateAsync({ type: opt.type || "blob", mimeType: "application/hwp+zip", compression: "DEFLATE" });
  }

  /** dataURL → {bytes, w, h, ext} (브라우저) */
  async function photoFromDataURL(url) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const b64 = url.slice(url.indexOf(",") + 1), bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, w: img.naturalWidth, h: img.naturalHeight, ext: /^data:image\/png/.test(url) ? "png" : "jpg" };
  }

  root.EcoHwpx = { build, photoFromDataURL, fmtWhen };
  if (typeof module !== "undefined") module.exports = root.EcoHwpx;
})(typeof window !== "undefined" ? window : globalThis);
