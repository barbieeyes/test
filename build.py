"""src/*.js 를 shell.html 에 넣어 한 장짜리 index.html 만들기"""
import os
here = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(here, "src/shell.html")).read()
for k, f in [("MODEL", "model"), ("MEDIA", "media"), ("HWPXTPL", "hwpx-tpl"), ("HWPX", "hwpx"), ("APP", "app")]:
    tok = f"/*__{k}__*/"
    assert tok in s, tok
    s = s.replace(tok, open(os.path.join(here, f"src/{f}.js")).read().replace("</script", "<\\/script"))
open(os.path.join(here, "index.html"), "w").write(s)
print("index.html", len(s))
