"""python-hwpx로 만든 협의록 참고 문서(minutes-ref.hwpx)를 브라우저용 틀(src/hwpx-tpl.js)로 바꾼다."""
import zipfile, json, base64, re, sys
src = sys.argv[1] if len(sys.argv) > 1 else "tools/minutes-ref.hwpx"
z = zipfile.ZipFile(src)
files = {}
for n in z.namelist():
    if n.startswith("BinData/") or n == "Contents/section0.xml":
        continue
    b = z.read(n)
    if n.endswith(".png"):
        files[n] = {"b64": base64.b64encode(b).decode()}
    else:
        t = b.decode("utf-8")
        if n == "Contents/content.hpf":
            t = re.sub(r'<opf:item id="BIN\d+"[^>]*/>', "", t)
            t = t.replace("synthetic-fixture-author", "에코쌤즈")
        files[n] = {"text": t}
sec = z.read("Contents/section0.xml").decode("utf-8")
labels = ["일시", "장소", "참석자", "안건", "협의 내용", "결정 사항", "향후 계획(할 일)", "작성자"]
for l in labels:
    sec = sec.replace(f'<hp:run charPrIDRef="0"><hp:t>{l}</hp:t>', f'<hp:run charPrIDRef="8"><hp:t>{l}</hp:t>', 1)
sec = re.sub(r'binaryItemIDRef="BIN\d+"', 'binaryItemIDRef="{{BIN}}"', sec)
order = [n for n in z.namelist() if not n.startswith("BinData/")]
out = "/* 자동 생성: tools/make_hwpx_tpl.py — 한글(.hwpx) 협의록 틀 */\n(typeof window !== 'undefined' ? window : globalThis).EcoHwpxTpl = " + json.dumps({"order": order, "files": files, "section": sec}, ensure_ascii=False) + ";\n"
open("src/hwpx-tpl.js", "w").write(out)
print("ok", len(out), order)
