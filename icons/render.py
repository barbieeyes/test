from playwright.sync_api import sync_playwright
import sys
jobs=[('app.svg',512,'icon-512.png',False),('app.svg',192,'icon-192.png',False),('app.svg',180,'apple-touch-icon.png',False),
      ('fav.svg',32,'favicon-32.png',True),('fav.svg',16,'favicon-16.png',True),('fav.svg',48,'favicon-48.png',True),('maskable.svg',512,'icon-maskable-512.png',False)]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1243/chrome-linux64/chrome')
    for src,sz,out,transp in jobs:
        pg=b.new_page(viewport={'width':sz,'height':sz})
        svg=open(src).read()
        tag = '<svg width="%d" height="%d" ' % (sz, sz)
        pg.set_content('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', tag, 1) + '</body></html>')
        pg.screenshot(path=out,omit_background=transp,clip={'x':0,'y':0,'width':sz,'height':sz})
    b.close()
print('ok')
