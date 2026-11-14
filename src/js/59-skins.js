/* ---------- block skins ----------
A skin is the look of the blocks and the board: a palette (7 piece colours + garbage), a tile style that
paints one cell, and a board style (background, grid, frame colours). Each cell picture is painted once per
skin, colour and size into a small offscreen canvas (skinSprite) and then copied with drawImage, so a frame
costs one drawImage per cell plus one for the board background.

Registry (the shop lists SKINS in order; a later cosmetics shop can push more):
  SKINS           [{id, name, desc, price, style, palette:[I,O,T,S,Z,J,L], garbage, board:{bg,grid,dots,frame,glow,accent}}]
                  name/desc are t() keys; price in coins (0 = free, always owned)
  skinById(id)    that skin, or the default skin for an unknown id
  currentSkin()   the equipped skin (profile.theme holds its id, profile.owned the ids bought)
  TILE_STYLES     {style: {tile(c,P,col,id), garbage(c,P,col), ghost(c,P,col,id)}}: paint one P x P cell at 0,0
  skinSprite(skin,v,s,ghost)   cached cell picture (v: 1-7 piece, 8 garbage; s: CSS size on a 2x canvas)
  skinBoard(skin,w,h)          cached board background (w x h CSS px, 2x)
  drawSkinPreview(canvas,skin) a small rendered scene for shop buttons
Ids 0-2 are also known to the server (buy_theme, import_local) and to the saved-profile checks
(10-profile.js, 20-cloud.js): a new id needs a migration and those two filters widened.
*/
const SKIN_SCALE=2;                            // the game canvases draw at 2x (setTransform(2,...))
const GLYPH_MIN=26;                            // cells smaller than this many device px get no glyph

function skinRgb(hex,amt=0){                   // amt > 0 mixes toward white, < 0 toward black
  const n=parseInt(hex.slice(1),16),c=[n>>16,n>>8&255,n&255],to=amt<0?0:255,a=Math.abs(amt);
  return c.map(v=>Math.round(v+(to-v)*a));
}
const tone=(hex,amt,a=1)=>'rgba('+skinRgb(hex,amt).join(',')+','+a+')';
function pathRound(c,x,y,w,h,r){
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
// a panel with stepped corners: the frame shape of Mongolian ornament (хээтэй хүрээ)
function pathStepped(c,x,y,w,h,n){
  const X=x+w,Y=y+h;c.beginPath();c.moveTo(x+n,y);c.lineTo(X-n,y);c.lineTo(X-n,y+n);c.lineTo(X,y+n);c.lineTo(X,Y-n);c.lineTo(X-n,Y-n);
  c.lineTo(X-n,Y);c.lineTo(x+n,Y);c.lineTo(x+n,Y-n);c.lineTo(x,Y-n);c.lineTo(x,y+n);c.lineTo(x+n,y+n);c.closePath();
}
function pathPoly(c,p){c.beginPath();c.moveTo(p[0],p[1]);for(let k=2;k<p.length;k+=2)c.lineTo(p[k],p[k+1]);c.closePath()}
// One small motif per piece, so pieces can be told apart without colour (I = , O ○, T ◇, S ugalz spiral,
// Z ∧ mountain, J • dot, L □). g is the half size.
const GLYPHS=[
  (c,g)=>{c.moveTo(-g,-g*.4);c.lineTo(g,-g*.4);c.moveTo(-g,g*.4);c.lineTo(g,g*.4)},
  (c,g)=>{c.moveTo(g*.82,0);c.arc(0,0,g*.82,0,Math.PI*2)},
  (c,g)=>{c.moveTo(0,-g);c.lineTo(g,0);c.lineTo(0,g);c.lineTo(-g,0);c.closePath()},
  (c,g)=>{for(let k=0;k<=24;k++){const q=k/24,a=Math.PI*(.6+1.8*q),r=g*(1-.72*q);k?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r)}},
  (c,g)=>{c.moveTo(-g,g*.5);c.lineTo(0,-g*.5);c.lineTo(g,g*.5)},
  (c,g)=>{c.moveTo(g*.45,0);c.arc(0,0,g*.45,0,Math.PI*2)},
  (c,g)=>{c.rect(-g*.72,-g*.72,g*1.44,g*1.44)}];
function glyph(c,id,x,y,g,lw,color){
  c.save();c.translate(x,y);c.beginPath();GLYPHS[id](c,g);c.restore();
  if(id===5){c.fillStyle=color;c.fill()}else{c.lineWidth=lw;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.stroke()}
}
// cut into the surface: a lit lower edge under a dark groove
function engrave(c,id,x,y,g,lw,dark,light){glyph(c,id,x,y+lw*.75,g,lw,light);glyph(c,id,x,y,g,lw,dark)}

const TILE_STYLES={
  // carved wood/felt panel with a stepped-corner recess and an engraved motif (default skin)
  carved:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.035),w=P-2*m,r=P*.15,i=P*.17,n=P*.1;
      let g=c.createLinearGradient(0,m,0,P-m);g.addColorStop(0,tone(col,.32));g.addColorStop(.55,col);g.addColorStop(1,tone(col,-.28));
      pathRound(c,m,m,w,w,r);c.fillStyle=g;c.fill();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.55,.55);pathRound(c,m+c.lineWidth/2,m+c.lineWidth/2,w-c.lineWidth,w-c.lineWidth,r);c.stroke();
      g=c.createLinearGradient(0,i,0,P-i);g.addColorStop(0,tone(col,-.22));g.addColorStop(1,tone(col,.06));
      pathStepped(c,i,i,P-2*i,P-2*i,n);c.fillStyle=g;c.fill();
      const lw=Math.max(1,P*.028);c.lineWidth=lw;
      pathStepped(c,i,i+lw,P-2*i,P-2*i,n);c.strokeStyle=tone(col,.5,.45);c.stroke();
      pathStepped(c,i,i,P-2*i,P-2*i,n);c.strokeStyle=tone(col,-.55,.6);c.stroke();
      if(P>=GLYPH_MIN)engrave(c,id,P/2,P/2,P*.155,Math.max(1.2,P*.05),tone(col,-.6,.75),tone(col,.6,.5));
    },
    // quilted felt (ширдэг): woven texture and a running stitch
    garbage(c,P,col){
      const m=Math.max(1,P*.035),w=P-2*m,i=P*.16;
      let g=c.createLinearGradient(0,m,0,P-m);g.addColorStop(0,tone(col,.14));g.addColorStop(1,tone(col,-.18));
      pathRound(c,m,m,w,w,P*.12);c.fillStyle=g;c.fill();
      c.save();c.clip();c.lineWidth=Math.max(1,P*.02);c.strokeStyle=tone(col,.3,.14);c.beginPath();
      for(let k=-P;k<P;k+=P*.16){c.moveTo(k,P);c.lineTo(k+P,0)}c.stroke();c.restore();
      c.setLineDash([P*.075,P*.055]);c.lineWidth=Math.max(1,P*.035);c.lineCap='round';
      pathStepped(c,i,i,P-2*i,P-2*i,P*.1);c.strokeStyle=tone(col,.5,.75);c.stroke();c.setLineDash([]);
    },
    ghost(c,P,col){
      const m=P*.07,lw=Math.max(1.5,P*.045);
      pathRound(c,m,m,P-2*m,P-2*m,P*.15);c.fillStyle=tone(col,0,.1);c.fill();c.lineWidth=lw;c.strokeStyle=tone(col,.15,.8);c.stroke();
      pathStepped(c,P*.25,P*.25,P*.5,P*.5,P*.08);c.lineWidth=Math.max(1,P*.025);c.strokeStyle=tone(col,0,.4);c.stroke();
    }},
  // glowing tubes around a dark glassy core
  neon:{
    tile(c,P,col,id){
      const m=P*.05,w=P-2*m,i=P*.13,r=P*.14;
      pathRound(c,m,m,w,w,r);c.fillStyle='#0a1131';c.fill();
      const g=c.createRadialGradient(P/2,P*.4,0,P/2,P/2,P*.7);g.addColorStop(0,tone(col,0,.42));g.addColorStop(1,tone(col,-.3,.12));c.fillStyle=g;c.fill();
      c.save();c.shadowColor=col;c.shadowBlur=P*.22;c.lineWidth=P*.08;c.strokeStyle=col;pathRound(c,i,i,P-2*i,P-2*i,r*.8);c.stroke();c.stroke();c.restore();
      c.lineWidth=Math.max(1,P*.026);c.strokeStyle=tone(col,.7,.85);pathRound(c,i,i,P-2*i,P-2*i,r*.8);c.stroke();
      if(P>=GLYPH_MIN){c.save();c.shadowColor=col;c.shadowBlur=P*.12;glyph(c,id,P/2,P/2,P*.13,Math.max(1.2,P*.05),tone(col,.55));c.restore()}
    },
    garbage(c,P,col){
      const m=P*.05,w=P-2*m,i=P*.13;
      pathRound(c,m,m,w,w,P*.12);c.fillStyle=tone(col,-.55);c.fill();
      c.save();c.clip();c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.1,.35);c.beginPath();
      for(let k=-P;k<P;k+=P*.22){c.moveTo(k,P);c.lineTo(k+P,0)}c.stroke();c.restore();
      c.lineWidth=Math.max(1,P*.05);c.strokeStyle=tone(col,.15,.9);pathRound(c,i,i,P-2*i,P-2*i,P*.1);c.stroke();
    },
    ghost(c,P,col){
      const i=P*.13;c.save();c.shadowColor=col;c.shadowBlur=P*.12;
      c.lineWidth=Math.max(1.5,P*.05);c.strokeStyle=tone(col,0,.6);pathRound(c,i,i,P-2*i,P-2*i,P*.11);c.stroke();c.restore();
    }},
  // a cut stone: four bevel facets around a flat face
  gem:{
    tile(c,P,col,id){
      const a=Math.max(1,P*.035),b=P-a,i=P*.24,j=P-i;
      pathPoly(c,[a,a,b,a,j,i,i,i]);c.fillStyle=tone(col,.42);c.fill();
      pathPoly(c,[a,a,i,i,i,j,a,b]);c.fillStyle=tone(col,.16);c.fill();
      pathPoly(c,[b,a,b,b,j,j,j,i]);c.fillStyle=tone(col,-.2);c.fill();
      pathPoly(c,[a,b,i,j,j,j,b,b]);c.fillStyle=tone(col,-.38);c.fill();
      const g=c.createLinearGradient(i,i,j,j);g.addColorStop(0,tone(col,.12));g.addColorStop(1,tone(col,-.1));c.fillStyle=g;c.fillRect(i,i,j-i,j-i);
      c.lineWidth=Math.max(1,P*.02);c.strokeStyle=tone(col,.7,.35);c.beginPath();c.moveTo(a,a);c.lineTo(i,i);c.lineTo(j,i);c.stroke();
      if(P>=GLYPH_MIN){
        engrave(c,id,P/2,P/2,P*.12,Math.max(1.1,P*.042),tone(col,-.55,.7),tone(col,.6,.45));
        const sx=i+P*.02,sy=i+P*.02,k=P*.07;c.fillStyle='rgba(255,255,255,.85)';
        pathPoly(c,[sx,sy-k,sx+k*.25,sy-k*.25,sx+k,sy,sx+k*.25,sy+k*.25,sx,sy+k,sx-k*.25,sy+k*.25,sx-k,sy,sx-k*.25,sy-k*.25]);c.fill();
      }
    },
    garbage(c,P,col){
      const a=Math.max(1,P*.035),b=P-a,i=P*.2,j=P-i;
      pathPoly(c,[a,a,b,a,j,i,i,i]);c.fillStyle=tone(col,.2);c.fill();
      pathPoly(c,[a,a,i,i,i,j,a,b]);c.fillStyle=tone(col,.05);c.fill();
      pathPoly(c,[b,a,b,b,j,j,j,i]);c.fillStyle=tone(col,-.15);c.fill();
      pathPoly(c,[a,b,i,j,j,j,b,b]);c.fillStyle=tone(col,-.3);c.fill();
      c.fillStyle=col;c.fillRect(i,i,j-i,j-i);
      const d=Math.max(1,P*.04);let q=11;c.fillStyle=tone(col,-.38,.7);
      for(let k=0;k<8;k++){q=(q*16807)%2147483647;const u=q%997/997;q=(q*16807)%2147483647;c.fillRect(i+u*(j-i-d),i+q%991/991*(j-i-d),d,d)}
    },
    ghost(c,P,col){
      const a=P*.07,i=P*.26;c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(col,.1,.75);c.strokeRect(a,a,P-2*a,P-2*a);
      c.lineWidth=Math.max(1,P*.025);c.strokeStyle=tone(col,0,.4);c.strokeRect(i,i,P-2*i,P-2*i);
    }},
};

const SKINS=[
  {id:0,name:'skinKhee',desc:'skinKheeD',price:0,style:'carved',
    // textile and steppe colours: fire red, sky blue, gold, deel magenta, turquoise (оюу), grass green, milk white
    palette:['#ef4b4b','#4a7dff','#ffbf3a','#d64fd0','#3fd8d0','#79b83a','#f3ecdc'],garbage:'#4c5064',
    board:{bg:['#0b1633','#060c1d'],grid:'rgba(64,96,150,.16)',dots:'rgba(140,170,220,.30)',frame:'#41608f',glow:'rgba(255,191,58,.10)',accent:'#ffbf3a'}},
  {id:1,name:'skinAurora',desc:'skinAuroraD',price:100,style:'neon',
    palette:['#ff5fc8','#6fcfff','#4ff0c0','#ffa14a','#9a6bff','#d8ff4f','#f5f3ff'],garbage:'#5b6a8f',
    board:{bg:['#0a0f2e','#050818'],grid:'rgba(130,110,255,.14)',dots:'',frame:'#5b4fd0',glow:'rgba(120,90,255,.18)',accent:'#4ff0c0'}},
  {id:2,name:'skinGobi',desc:'skinGobiD',price:100,style:'gem',
    palette:['#ffe066','#e23c6a','#ff8a3d','#ffa3c4','#2fbfa8','#f6e7cc','#8e5cff'],garbage:'#6a5752',
    board:{bg:['#1a0f2a','#0a0716'],grid:'rgba(255,170,120,.10)',dots:'rgba(255,190,140,.22)',frame:'#8a4f6a',glow:'rgba(255,138,61,.12)',accent:'#ff8a3d'}},
];
function skinById(id){return SKINS.find(k=>k.id===id)||SKINS[0]}
function currentSkin(){return skinById(profile.theme)}

const skinCache=new Map();
// an offscreen canvas; lost() runs if the browser drops and restores its memory (it comes back blank)
function skinCanvas(w,h,lost){const cv=document.createElement('canvas');cv.width=w;cv.height=h;if(lost)cv.addEventListener('contextrestored',lost);return cv}
function skinSprite(skin,v,s,ghost=false){
  const P=Math.round(s*SKIN_SCALE),key=skin.id+'|'+v+'|'+P+(ghost?'g':'');
  let cv=skinCache.get(key);
  if(!cv){
    cv=skinCanvas(P,P,()=>skinCache.delete(key));
    const c=cv.getContext('2d'),st=TILE_STYLES[skin.style]||TILE_STYLES.carved,col=v===8?skin.garbage:skin.palette[v-1];
    if(ghost)st.ghost(c,P,col,v-1);else if(v===8)st.garbage(c,P,col);else st.tile(c,P,col,v-1);
    skinCache.set(key,cv);
  }
  return cv;
}
function skinBoard(skin,w,h){
  const key=skin.id+'|board|'+w+'x'+h;
  let cv=skinCache.get(key);
  if(!cv){
    cv=skinCanvas(w*SKIN_SCALE,h*SKIN_SCALE,()=>skinCache.delete(key));
    const c=cv.getContext('2d'),B=skin.board,s=w/W,rows=Math.round(h/s);
    c.scale(SKIN_SCALE,SKIN_SCALE);
    const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,B.bg[0]);g.addColorStop(1,B.bg[1]);c.fillStyle=g;c.fillRect(0,0,w,h);
    const r=c.createRadialGradient(w/2,h,0,w/2,h,h*.9);r.addColorStop(0,B.glow);r.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=r;c.fillRect(0,0,w,h);
    c.strokeStyle=B.grid;c.lineWidth=.5;c.beginPath();
    for(let x=1;x<W;x++){c.moveTo(x*s,0);c.lineTo(x*s,h)}
    for(let y=1;y<rows;y++){c.moveTo(0,y*s);c.lineTo(w,y*s)}
    c.stroke();
    if(B.dots&&s>=14){c.fillStyle=B.dots;const d=Math.max(1,s*.07);for(let y=1;y<rows;y++)for(let x=1;x<W;x++)c.fillRect(x*s-d/2,y*s-d/2,d,d)}
    skinCache.set(key,cv);
  }
  return cv;
}
// a small scene with every piece colour, a garbage row and a ghost, drawn with the real sprites
const SKIN_SCENE=['..3..226..','.333.22666','11114477.5','8888.88888'];
function drawSkinPreview(cv,skin){
  const c=cv.getContext('2d'),w=cv.width/SKIN_SCALE,h=cv.height/SKIN_SCALE,s=w/W;
  c.setTransform(SKIN_SCALE,0,0,SKIN_SCALE,0,0);c.clearRect(0,0,w,h);
  c.drawImage(skinBoard(skin,w,h),0,0,w,h);
  SKIN_SCENE.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch!=='.')c.drawImage(skinSprite(skin,+ch,s),x*s,y*s,s,s)}));
}
// frame colours and the ornament band around the boards follow the skin
function skinBand(color){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="18" height="8"><path d="M0 4H5.5M12.5 4H18M9 1.2 11.8 4 9 6.8 6.2 4Z" fill="none" stroke="'+color+'" stroke-width="1.2"/><circle cx="0" cy="4" r="1.1" fill="'+color+'"/><circle cx="18" cy="4" r="1.1" fill="'+color+'"/></svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
}
let shownSkin=null;
function applySkinCss(skin){
  if(shownSkin===skin)return;shownSkin=skin;
  const st=document.documentElement.style,B=skin.board;
  st.setProperty('--skin-frame',B.frame);st.setProperty('--skin-glow',B.glow);st.setProperty('--skin-accent',B.accent);st.setProperty('--skin-band',skinBand(B.accent));
}
