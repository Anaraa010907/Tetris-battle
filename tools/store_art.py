#!/usr/bin/env python3
"""Draws the store art from the built game with its own painters (block skin sprites, ornament ring, logo layout):

    android/app/src/main/res/mipmap-*/ic_launcher*.png   launcher icon (legacy + adaptive background/foreground)
    docs/store/icon-512.png      Google Play icon (alpha)
    docs/store/icon-1024.png     App Store icon (no alpha)
    docs/store/feature-graphic.png   Google Play feature graphic, 1024 x 500, no alpha

    python3 tools/build.py && python3 tools/store_art.py

The logo word comes from the game's brandName (src/i18n/45-brand.json), so after a rename run both commands again.
Needs Playwright and Pillow (same as the tests); CHROME=/path/to/chrome if Playwright's Chromium is not installed.
"""
import asyncio, base64, io, os
from playwright.async_api import async_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = r"""
async ()=>{
  await document.fonts.ready;
  const skin=SKINS[0],out={},brand=t('brandName').toUpperCase().split(/\s+/);
  const CROWN=new Path2D('M203 33 206 13 217 23 230 3 243 23 254 13 257 33z'),BAND=new Path2D('M201 33h58v7h-58z'),
    GEMS=new Path2D('M230 25.5l3.6 3.6-3.6 3.6-3.6-3.6zM206 8.5l2.6 2.6-2.6 2.6-2.6-2.6zM254 8.5l2.6 2.6-2.6 2.6-2.6-2.6z');
  const goldV=(c,y0,y1)=>{const g=c.createLinearGradient(0,y0,0,y1);g.addColorStop(0,'#fffbea');g.addColorStop(.4,'#ffd867');g.addColorStop(.64,'#ffb53a');g.addColorStop(1,'#ff7a1f');return g};
  // the khan's crown of the logo, centred at x, bottom at y, w wide
  function crown(c,x,y,w){
    const k=w/58;c.save();c.translate(x,y);c.scale(k,k);c.translate(-230,-40);
    c.fillStyle=goldV(c,3,40);c.strokeStyle='#5a2800';c.lineWidth=1.4;c.lineJoin='round';c.fill(CROWN);c.stroke(CROWN);
    c.fillStyle='#ffcf6a';c.fill(BAND);c.stroke(BAND);c.fillStyle='#3fd8d0';c.fill(GEMS);c.restore();
  }
  function bg(c,S,round){
    c.save();
    if(round){pathRound(c,0,0,S,S,S*.22);c.clip()}
    let g=c.createRadialGradient(S*.5,S*.42,0,S*.5,S*.5,S*.75);g.addColorStop(0,'#16206a');g.addColorStop(.55,'#0a1036');g.addColorStop(1,'#050817');
    c.fillStyle=g;c.fillRect(0,0,S,S);
    for(const [x,y,r,col] of [[0,.1,.7,'rgba(34,211,238,.30)'],[1,.95,.75,'rgba(143,60,255,.36)']]){g=c.createRadialGradient(x*S,y*S,0,x*S,y*S,r*S);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,S,S)}
    let q=5;const rnd=()=>{q=(q*16807)%2147483647;return q/2147483647};
    for(let i=0;i<40;i++){const x=rnd()*S,y=rnd()*S,s=Math.max(1,S*(rnd()<.2?.006:.003));c.fillStyle='rgba(210,225,255,'+(.3+rnd()*.6)+')';c.fillRect(x,y,s,s)}
    c.restore();
  }
  function ring(c,S,R){
    c.save();c.translate(S/2,S/2);
    c.strokeStyle='rgba(255,201,90,.75)';c.lineWidth=S*.008;c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.stroke();
    c.strokeStyle='rgba(255,201,90,.32)';c.lineWidth=S*.005;c.beginPath();c.arc(0,0,R*.9,0,Math.PI*2);c.stroke();
    for(let i=0;i<16;i++){c.save();c.rotate(i/16*Math.PI*2);c.translate(0,-R*.95);const k=S*.022;
      if(i%2){c.fillStyle='#ffd678';c.beginPath();c.moveTo(0,-k);c.lineTo(k*.85,0);c.lineTo(0,k);c.lineTo(-k*.85,0);c.closePath();c.fill()}
      else{c.strokeStyle='rgba(130,205,255,.9)';c.lineWidth=S*.006;pathStepped(c,-k,-k,2*k,2*k,k*.6);c.stroke()}
      c.restore()}
    c.restore();
  }
  // a gold T piece in the default skin with a crown over it
  function emblem(c,S,tile,cy){
    const t=Math.round(tile),x0=S/2-1.5*t,y0=cy-t,cells=[[1,0],[0,1],[1,1],[2,1]];
    c.save();c.shadowColor='rgba(255,191,58,.55)';c.shadowBlur=S*.06;
    for(const [x,y] of cells)c.drawImage(skinSprite(skin,3,t/2),x0+x*t,y0+y*t,t,t);
    c.restore();
    for(const [x,y] of cells)c.drawImage(skinSprite(skin,3,t/2),x0+x*t,y0+y*t,t,t);
    c.save();c.shadowColor='rgba(0,0,0,.45)';c.shadowBlur=S*.02;crown(c,S/2,y0-t*.08,t*1.25);c.restore();
  }
  const mk=S=>{const cv=document.createElement('canvas');cv.width=cv.height=S;return [cv,cv.getContext('2d')]};
  const icon=(S,o)=>{const [cv,c]=mk(S);if(o.bg)bg(c,S,o.round);if(o.ring)ring(c,S,S*o.ring);if(o.piece)emblem(c,S,S*o.piece,S*.58);return cv.toDataURL('image/png')};
  out.full=icon(1024,{bg:1,ring:.38,piece:.17});
  for(const [d,S] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]])out['legacy_'+d]=icon(S*4,{bg:1,round:1,ring:.36,piece:.165});
  for(const [d,S] of [['mdpi',108],['hdpi',162],['xhdpi',216],['xxhdpi',324],['xxxhdpi',432]]){out['bg_'+d]=icon(S*2,{bg:1,ring:.28});out['fg_'+d]=icon(S*2,{piece:.115})}
  // feature graphic: the home scene, the logo on the left, ring and floating pieces on the right
  const F=document.createElement('canvas');F.width=1024;F.height=500;const c=F.getContext('2d');
  c.drawImage($('homeArt'),0,330*1.5,756,250*1.5,0,0,1024,500);
  const v=c.createLinearGradient(0,0,1024,0);v.addColorStop(0,'rgba(5,8,23,.6)');v.addColorStop(.55,'rgba(5,8,23,.1)');v.addColorStop(1,'rgba(5,8,23,.25)');c.fillStyle=v;c.fillRect(0,0,1024,500);
  c.save();c.translate(780,250);c.translate(-150,-150);c.drawImage($('homeRing'),0,0,300,300);c.restore();
  const pc=(id,s,x,y,a,al)=>{const m=PREV[id];c.save();c.globalAlpha=al||1;c.translate(x,y);c.rotate(a*Math.PI/180);c.shadowColor='rgba(0,0,0,.5)';c.shadowBlur=16;c.shadowOffsetY=8;
    m.forEach((row,r)=>row.forEach((vv,q)=>{if(vv)c.drawImage(skinSprite(skin,id+1,s),(q-m[0].length/2)*s,(r-m.length/2)*s,s,s)}));c.restore()};
  pc(4,30,650,130,14);pc(1,32,670,370,-12);pc(3,30,915,130,-16);pc(6,32,910,375,10);pc(0,16,790,90,0,.45);pc(2,56,785,262,-8);
  const cx=300,fit=(txt,font,max)=>{c.font=font;const w=c.measureText(txt).width;return w>max?max/w:1};
  const one=brand[0],two=brand.slice(1).join(' ');
  c.save();c.translate(cx,two?225:262);c.transform(1,0,-.14,1,0,0);c.textAlign='center';
  const k1=fit(one,'800 150px Inter, system-ui, sans-serif',470);c.scale(k1,k1);c.font='800 150px Inter, system-ui, sans-serif';
  for(const [dy,col] of [[13,'#2a1100'],[9,'#4d2200'],[5,'#7a3800']]){c.fillStyle=col;c.fillText(one,0,dy)}
  c.shadowColor='rgba(255,191,58,.45)';c.shadowBlur=30;c.fillStyle=goldV(c,-110,10);c.fillText(one,0,0);c.shadowBlur=0;
  c.lineWidth=1.5;c.strokeStyle='#fff3c8';c.strokeText(one,0,0);c.restore();
  crown(c,cx,(two?225:262)-112*k1,96*k1);
  const by=two?262:300;c.save();c.translate(cx,by);c.strokeStyle='#ffcf6a';c.fillStyle='#ffcf6a';c.lineWidth=2;
  const gap=two?150:0;c.beginPath();c.moveTo(-250,0);c.lineTo(-gap-26,0);c.moveTo(gap+26,0);c.lineTo(250,0);c.stroke();
  c.beginPath();c.moveTo(-258,-6);c.lineTo(-252,0);c.lineTo(-258,6);c.lineTo(-264,0);c.closePath();c.fill();
  c.beginPath();c.moveTo(258,-6);c.lineTo(264,0);c.lineTo(258,6);c.lineTo(252,0);c.closePath();c.fill();
  if(two){pathStepped(c,-gap-22,-8,16,16,5);c.stroke();pathStepped(c,gap+6,-8,16,16,5);c.stroke()}
  c.restore();
  if(two){c.save();c.translate(cx,by+20);c.textAlign='center';c.font='800 50px Inter, system-ui, sans-serif';c.letterSpacing='14px';
    const k2=fit(two,c.font,280);c.scale(k2,k2);
    const g=c.createLinearGradient(0,-40,0,0);g.addColorStop(0,'#ffffff');g.addColorStop(.6,'#d4e8ff');g.addColorStop(1,'#86b6ff');
    c.lineWidth=6;c.strokeStyle='#0d1f66';c.lineJoin='round';c.strokeText(two,7,0);c.shadowColor='rgba(79,139,255,.6)';c.shadowBlur=14;c.fillStyle=g;c.fillText(two,7,0);c.restore()}
  out.feature=F.toDataURL('image/png');
  return out;
}"""


async def main():
    async with async_playwright() as pw:
        br = await pw.chromium.launch(executable_path=os.environ.get('CHROME') or None, args=['--no-sandbox'])
        pg = await (await br.new_context(viewport={'width': 393, 'height': 852})).new_page()
        await pg.goto('file://' + os.path.join(ROOT, 'index.html'))
        await pg.wait_for_timeout(600)
        out = await pg.evaluate(JS)
        await br.close()
    img = lambda k: Image.open(io.BytesIO(base64.b64decode(out[k].split(',')[1]))).convert('RGBA')
    res = os.path.join(ROOT, 'android/app/src/main/res')
    for d, s in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
        img('legacy_' + d).resize((s, s), Image.LANCZOS).save(os.path.join(res, 'mipmap-' + d, 'ic_launcher.png'), optimize=True)
    for d, s in [('mdpi', 108), ('hdpi', 162), ('xhdpi', 216), ('xxhdpi', 324), ('xxxhdpi', 432)]:
        img('bg_' + d).resize((s, s), Image.LANCZOS).convert('RGB').save(os.path.join(res, 'mipmap-' + d, 'ic_launcher_background.png'), optimize=True)
        img('fg_' + d).resize((s, s), Image.LANCZOS).save(os.path.join(res, 'mipmap-' + d, 'ic_launcher_foreground.png'), optimize=True)
    store = os.path.join(ROOT, 'docs/store')
    os.makedirs(store, exist_ok=True)
    full = img('full')
    full.resize((512, 512), Image.LANCZOS).save(os.path.join(store, 'icon-512.png'), optimize=True)
    full.convert('RGB').save(os.path.join(store, 'icon-1024.png'), optimize=True)
    img('feature').convert('RGB').save(os.path.join(store, 'feature-graphic.png'), optimize=True)
    print('store art written: launcher icons, docs/store/icon-512.png, icon-1024.png, feature-graphic.png')


if __name__ == '__main__':
    asyncio.run(main())
