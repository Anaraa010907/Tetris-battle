/* ---------- block skins ----------
A skin is the look of the blocks and the board: a palette (7 piece colours + garbage), a tile style that
paints one cell, and a board style (background, grid, frame colours). Each cell picture is painted once per
skin, colour and size into a small offscreen canvas (skinSprite) and then copied with drawImage, so a frame
costs one drawImage per cell plus one for the board background.

Registry (the shop lists SKINS in order; a later cosmetics shop can push more):
  SKINS           [{id, name, desc, price, season, style, palette:[I,O,T,S,Z,J,L], garbage, board:{bg,grid,dots,frame,glow,accent}}]
                  name/desc are t() keys; price in coins (0 = free, always owned); season skins (ids 20-39) have
                  season:'s1'... and no price: they come only from the season pass (57-pass.js)
  skinById(id)    that skin, or the default skin for an unknown id
  currentSkin()   the equipped skin (profile.theme holds its id, profile.owned the ids bought)
  TILE_STYLES     {style: {tile(c,P,col,id), garbage(c,P,col), ghost(c,P,col,id)}}: paint one P x P cell at 0,0
  skinSprite(skin,v,s,ghost)   cached cell picture (v: 1-7 piece, 8 garbage; s: CSS size on a 2x canvas)
  skinBoard(skin,w,h)          cached board background (w x h CSS px, 2x)
  drawSkinPreview(canvas,skin) a small rendered scene for shop buttons
Ids: 0-2 the first skins, 3-19 coin skins, 20-39 season-pass skins. The server knows every id and price
(skin_price() in supabase/migrations/20261118100000_progression.sql; tests compare it with this registry), so a new
skin needs a new migration too. Saved profiles keep ids 1-39 and drop ids this registry does not know (bottom).
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

// piece motifs drawn as pixels (4 x 4, centred) for the pixel style
const PIXEL_GLYPHS=[['####','....','....','####'],['.##.','#..#','#..#','.##.'],['.##.','####','####','.##.'],['###.','..#.','#.#.','###.'],
  ['....','.##.','#..#','....'],['....','.##.','.##.','....'],['####','#..#','#..#','####']];
// a few seeded specks (felt fibres, stars) that stay off the left middle of the cell
function specks(P,seed,n,fn){let q=seed;for(let k=0;k<n;k++){q=(q*16807)%2147483647;const x=q%997/997*P;q=(q*16807)%2147483647;const y=q%991/991*P;if(Math.abs(x-P*.21)<P*.1&&Math.abs(y-P*.5)<P*.12)continue;fn(x,y,k)}}
// lacquer with a metal frame; jewel: small gems in the corners (the royal skins)
function lacquerStyle(trim,jewel){
  const frame=(c,P)=>{const m=Math.max(1,P*.03),g=c.createLinearGradient(0,0,P,P);g.addColorStop(0,tone(trim,.55));g.addColorStop(.5,trim);g.addColorStop(1,tone(trim,-.5));
    pathRound(c,m,m,P-2*m,P-2*m,P*.1);c.fillStyle=g;c.fill();return m+P*.075};
  const corners=(c,P,i,color)=>{const k=P*.11,l=Math.max(1,P*.03);c.lineWidth=l;c.strokeStyle=color;c.beginPath();
    for(const [x,y,sx,sy] of [[i,i,1,1],[P-i,i,-1,1],[P-i,P-i,-1,-1],[i,P-i,1,-1]]){const a=x+sx*l*1.5,b=y+sy*l*1.5;c.moveTo(a,b+sy*k);c.lineTo(a,b+sy*k*.45);c.lineTo(a+sx*k*.45,b+sy*k*.45);c.lineTo(a+sx*k*.45,b);c.lineTo(a+sx*k,b)}
    c.stroke()};
  return {
    tile(c,P,col,id){
      const i=frame(c,P);
      let g=c.createLinearGradient(0,i,0,P-i);g.addColorStop(0,tone(col,.2));g.addColorStop(1,tone(col,-.4));
      pathRound(c,i,i,P-2*i,P-2*i,P*.06);c.fillStyle=g;c.fill();
      c.save();c.clip();g=c.createLinearGradient(0,i,0,P*.42);g.addColorStop(0,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(i,i,P-2*i,P*.42-i);c.restore();
      corners(c,P,i,tone(trim,.2,.9));
      if(jewel){const r=P*.045;for(const [x,y] of [[P/2,i+r*1.6],[P/2,P-i-r*1.6]]){pathPoly(c,[x,y-r,x+r,y,x,y+r,x-r,y]);c.fillStyle=tone(trim,.75);c.fill()}}
      if(P>=GLYPH_MIN)engrave(c,id,P/2,P/2,P*.15,Math.max(1.2,P*.05),tone(trim,.15),tone(col,-.7,.8));
    },
    garbage(c,P,col){
      const i=frame(c,P);pathRound(c,i,i,P-2*i,P-2*i,P*.06);c.fillStyle=tone(col,-.1);c.fill();
      c.save();c.clip();c.lineWidth=Math.max(1,P*.025);c.strokeStyle=tone(trim,-.2,.35);c.beginPath();
      for(let k=-P;k<P;k+=P*.18){c.moveTo(k,P);c.lineTo(k+P,0)}c.stroke();c.restore();
    },
    ghost(c,P,col){
      const m=P*.07;pathRound(c,m,m,P-2*m,P-2*m,P*.1);c.fillStyle=tone(col,0,.1);c.fill();c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(trim,.2,.8);c.stroke();
      corners(c,P,P*.14,tone(col,.2,.6));
    }};
}
// an octagonal seal (тамга) in a metal frame with a sheen and two inlaid gems (the 2500-coin and premium skins)
function sealStyle(trim){
  const oct=(c,x,y,w,k)=>pathPoly(c,[x+k,y,x+w-k,y,x+w,y+k,x+w,y+w-k,x+w-k,y+w,x+k,y+w,x,y+w-k,x,y+k]);
  return {
    tile(c,P,col,id){
      const m=Math.max(1,P*.025),w=P-2*m;
      let g=c.createLinearGradient(0,0,P,P);g.addColorStop(0,tone(trim,.6));g.addColorStop(.45,trim);g.addColorStop(1,tone(trim,-.5));
      oct(c,m,m,w,P*.22);c.fillStyle=g;c.fill();
      const i=P*.1;g=c.createRadialGradient(P*.4,P*.35,0,P/2,P/2,P*.5);g.addColorStop(0,tone(col,.4));g.addColorStop(.6,col);g.addColorStop(1,tone(col,-.4));
      oct(c,i,i,P-2*i,P*.17);c.fillStyle=g;c.fill();
      c.lineWidth=Math.max(1,P*.022);c.strokeStyle=tone(trim,.3,.85);oct(c,P*.16,P*.16,P*.68,P*.12);c.stroke();
      const r=P*.05;for(const y of [P*.14,P*.86]){pathPoly(c,[P/2,y-r,P/2+r,y,P/2,y+r,P/2-r,y]);c.fillStyle='#fff';c.fill();pathPoly(c,[P/2,y-r*.6,P/2+r*.6,y,P/2,y+r*.6,P/2-r*.6,y]);c.fillStyle=tone(col,.5);c.fill()}
      if(P>=GLYPH_MIN)engrave(c,id,P/2,P/2,P*.14,Math.max(1.2,P*.05),tone(trim,.25),tone(col,-.7,.85));
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.025);oct(c,m,m,P-2*m,P*.22);c.fillStyle=tone(trim,-.45);c.fill();
      oct(c,P*.1,P*.1,P*.8,P*.17);c.fillStyle=tone(col,-.05);c.fill();
      c.lineWidth=Math.max(1,P*.025);c.strokeStyle=tone(trim,-.1,.5);oct(c,P*.18,P*.18,P*.64,P*.11);c.stroke();
    },
    ghost(c,P,col){
      oct(c,P*.06,P*.06,P*.88,P*.22);c.fillStyle=tone(col,0,.1);c.fill();c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(trim,.2,.8);c.stroke();
    }};
}
Object.assign(TILE_STYLES,{
  // quilted felt (ширдэг): a soft pillow of felt, a diamond quilting lattice in light thread and a stitched motif
  felt:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.035);
      pathRound(c,m,m,P-2*m,P-2*m,P*.26);
      let g=c.createRadialGradient(P*.45,P*.4,P*.05,P*.5,P*.5,P*.62);g.addColorStop(0,tone(col,.2));g.addColorStop(.7,col);g.addColorStop(1,tone(col,-.35));
      c.fillStyle=g;c.fill();
      c.save();c.clip();
      specks(P,id*7+3,14,(x,y,k)=>{c.fillStyle=k%2?tone(col,.4,.22):tone(col,-.4,.22);c.fillRect(x,y,Math.max(1,P*.06),Math.max(1,P*.02))});
      c.setLineDash([P*.06,P*.045]);c.lineWidth=Math.max(1,P*.028);c.lineCap='round';c.strokeStyle=tone(col,.62,.7);c.beginPath();
      for(const k of [-.5,0,.5]){c.moveTo(P*(k+.25),0);c.lineTo(P*(k+1.25),P);c.moveTo(P*(.75-k),0);c.lineTo(P*(-.25-k),P)}
      c.stroke();c.setLineDash([]);c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,-.45,.6);pathRound(c,m+P*.02,m+P*.02,P-2*m-P*.04,P-2*m-P*.04,P*.24);c.stroke();
      if(P>=GLYPH_MIN){
        const r=P*.19;pathRound(c,P/2-r,P/2-r,2*r,2*r,r*.5);c.fillStyle=tone(col,-.3);c.fill();
        glyph(c,id,P/2,P/2,P*.12,Math.max(1.2,P*.05),tone(col,.75,.95));
      }
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.035),a=P*.32,b=P*.68;pathRound(c,m,m,P-2*m,P-2*m,P*.26);c.fillStyle=tone(col,-.05);c.fill();
      c.lineWidth=Math.max(1,P*.035);c.lineCap='round';c.strokeStyle=tone(col,.4,.6);c.beginPath();c.moveTo(a,a);c.lineTo(b,b);c.moveTo(b,a);c.lineTo(a,b);c.stroke();
      c.setLineDash([P*.06,P*.05]);c.strokeStyle=tone(col,.45,.55);pathRound(c,P*.14,P*.14,P*.72,P*.72,P*.18);c.stroke();c.setLineDash([]);
    },
    ghost(c,P,col){
      const m=P*.08;pathRound(c,m,m,P-2*m,P-2*m,P*.26);c.fillStyle=tone(col,0,.1);c.fill();
      c.setLineDash([P*.09,P*.06]);c.lineWidth=Math.max(1.5,P*.05);c.lineCap='round';c.strokeStyle=tone(col,.25,.8);c.stroke();c.setLineDash([]);
    }},
  // steppe sunset: a sky gradient, a low sun and a dark hill line along the bottom
  sunset:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.035);
      pathRound(c,m,m,P-2*m,P-2*m,P*.14);
      let g=c.createLinearGradient(0,m,0,P-m);g.addColorStop(0,tone(col,.5));g.addColorStop(.55,col);g.addColorStop(1,tone(col,-.2));c.fillStyle=g;c.fill();
      c.save();c.clip();
      const sx=P*(id%2?.3:.7);g=c.createRadialGradient(sx,P*.7,0,sx,P*.7,P*.3);g.addColorStop(0,'rgba(255,248,220,.95)');g.addColorStop(.35,'rgba(255,240,200,.6)');g.addColorStop(1,'rgba(255,240,200,0)');
      c.fillStyle=g;c.fillRect(0,P*.35,P,P*.65);
      c.fillStyle=tone(col,-.62);c.beginPath();c.moveTo(0,P*.78);c.quadraticCurveTo(P*.3,P*.64,P*.55,P*.74);c.quadraticCurveTo(P*.8,P*.84,P,P*.7);c.lineTo(P,P);c.lineTo(0,P);c.closePath();c.fill();
      c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.55,.55);pathRound(c,m+c.lineWidth/2,m+c.lineWidth/2,P-2*m-c.lineWidth,P-2*m-c.lineWidth,P*.13);c.stroke();
      if(P>=GLYPH_MIN)glyph(c,id,P/2,P*.42,P*.12,Math.max(1.2,P*.048),'rgba(255,255,255,.8)');
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.035);pathRound(c,m,m,P-2*m,P-2*m,P*.14);
      const g=c.createLinearGradient(0,0,0,P);g.addColorStop(0,tone(col,.15));g.addColorStop(1,tone(col,-.3));c.fillStyle=g;c.fill();
      c.save();c.clip();c.fillStyle=tone(col,-.5);c.beginPath();c.moveTo(0,P*.8);c.quadraticCurveTo(P*.5,P*.62,P,P*.8);c.lineTo(P,P);c.lineTo(0,P);c.closePath();c.fill();c.restore();
    },
    ghost(c,P,col){
      const m=P*.08;pathRound(c,m,m,P-2*m,P-2*m,P*.14);c.fillStyle=tone(col,0,.1);c.fill();c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(col,.3,.8);c.stroke();
    }},
  // a round festival medal on a dark plate, with a ribbon notch on top (Наадам)
  medal:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.03),r=P*.42;
      pathRound(c,m,m,P-2*m,P-2*m,P*.1);c.fillStyle=tone(col,-.58);c.fill();
      c.fillStyle=tone(col,.2);pathPoly(c,[P*.36,m,P*.64,m,P*.56,P*.2,P*.44,P*.2]);c.fill();
      let g=c.createRadialGradient(P*.42,P*.4,0,P/2,P/2,r);g.addColorStop(0,tone(col,.35));g.addColorStop(.75,col);g.addColorStop(1,tone(col,-.25));
      c.beginPath();c.arc(P/2,P/2,r,0,Math.PI*2);c.fillStyle=g;c.fill();
      c.lineWidth=Math.max(1,P*.04);c.strokeStyle=tone(col,.6,.9);c.beginPath();c.arc(P/2,P/2,r-c.lineWidth/2,0,Math.PI*2);c.stroke();
      c.setLineDash([P*.035,P*.035]);c.lineWidth=Math.max(1,P*.02);c.strokeStyle=tone(col,-.45,.7);c.beginPath();c.arc(P/2,P/2,r*.72,0,Math.PI*2);c.stroke();c.setLineDash([]);
      if(P>=GLYPH_MIN)engrave(c,id,P/2,P/2,P*.13,Math.max(1.2,P*.045),tone(col,-.6,.8),tone(col,.7,.6));
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.03);pathRound(c,m,m,P-2*m,P-2*m,P*.1);c.fillStyle=tone(col,-.25);c.fill();
      c.beginPath();c.arc(P/2,P/2,P*.34,0,Math.PI*2);c.fillStyle=tone(col,.12);c.fill();c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.4,.6);c.stroke();
    },
    ghost(c,P,col){
      c.beginPath();c.arc(P/2,P/2,P*.4,0,Math.PI*2);c.fillStyle=tone(col,0,.1);c.fill();c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(col,.3,.8);c.stroke();
    }},
  // snow-capped blocks: a white cap with soft drips over a frosty body (season 1)
  snow:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.035);
      pathRound(c,m,m,P-2*m,P-2*m,P*.16);
      let g=c.createLinearGradient(0,m,0,P-m);g.addColorStop(0,tone(col,.25));g.addColorStop(1,tone(col,-.3));c.fillStyle=g;c.fill();
      c.save();c.clip();
      const d=[.3,.38,.31,.36,.29,.4,.33,.3],y=k=>P*d[(k+id)%8];
      c.fillStyle='rgba(30,60,110,.28)';c.beginPath();c.moveTo(0,0);c.lineTo(P,0);for(let k=8;k>=0;k--)c.lineTo(P*k/8,y(k)+P*.04);c.closePath();c.fill();
      g=c.createLinearGradient(0,0,0,P*.4);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#dcecff');c.fillStyle=g;
      c.beginPath();c.moveTo(0,0);c.lineTo(P,0);for(let k=8;k>=0;k--){const x=P*k/8;c.quadraticCurveTo(x+P/16,y(k)+P*.05,x,y(k))}c.closePath();c.fill();
      c.fillStyle='rgba(255,255,255,.9)';specks(P,id*5+9,4,(x,yy)=>{if(yy>P*.45){c.beginPath();c.arc(x,yy,Math.max(.7,P*.022),0,Math.PI*2);c.fill()}});
      c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle='rgba(255,255,255,.55)';pathRound(c,m+c.lineWidth/2,m+c.lineWidth/2,P-2*m-c.lineWidth,P-2*m-c.lineWidth,P*.15);c.stroke();
      if(P>=GLYPH_MIN)engrave(c,id,P/2,P*.64,P*.11,Math.max(1.1,P*.042),tone(col,-.6,.8),tone(col,.6,.5));
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.035);pathRound(c,m,m,P-2*m,P-2*m,P*.16);c.fillStyle=tone(col,-.15);c.fill();
      c.save();c.clip();c.fillStyle='rgba(235,245,255,.7)';c.fillRect(0,0,P,P*.16);c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.35,.5);pathRound(c,P*.14,P*.24,P*.72,P*.62,P*.08);c.stroke();
    },
    ghost(c,P,col){
      const m=P*.08;pathRound(c,m,m,P-2*m,P-2*m,P*.16);c.fillStyle='rgba(255,255,255,.08)';c.fill();c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle='rgba(235,245,255,.75)';c.stroke();
    }},
  // polished silver: a bright rim, an engraved plate, a light streak and four rivets
  silver:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.03),i=P*.12;
      let g=c.createLinearGradient(0,0,P,P);g.addColorStop(0,tone(col,.75));g.addColorStop(.5,tone(col,.1));g.addColorStop(1,tone(col,-.55));
      pathRound(c,m,m,P-2*m,P-2*m,P*.12);c.fillStyle=g;c.fill();
      g=c.createLinearGradient(0,i,0,P-i);g.addColorStop(0,tone(col,.35));g.addColorStop(.45,tone(col,.04));g.addColorStop(.55,tone(col,-.1));g.addColorStop(1,tone(col,-.28));
      pathRound(c,i,i,P-2*i,P-2*i,P*.07);c.fillStyle=g;c.fill();
      c.lineWidth=Math.max(1,P*.022);c.strokeStyle=tone(col,-.6,.55);c.stroke();
      c.save();c.clip();c.globalAlpha=.32;c.fillStyle='#fff';pathPoly(c,[P*.56,i,P*.72,i,P*.38,P-i,P*.24,P-i]);c.fill();c.restore();
      const r=Math.max(.8,P*.028);c.fillStyle=tone(col,.85);for(const [x,y] of [[i*.62,i*.62],[P-i*.62,i*.62],[i*.62,P-i*.62],[P-i*.62,P-i*.62]]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}
      if(P>=GLYPH_MIN)engrave(c,id,P/2,P/2,P*.15,Math.max(1.2,P*.045),tone(col,-.62,.8),tone(col,.75,.6));
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.03);pathRound(c,m,m,P-2*m,P-2*m,P*.12);
      const g=c.createLinearGradient(0,0,0,P);g.addColorStop(0,tone(col,.2));g.addColorStop(1,tone(col,-.25));c.fillStyle=g;c.fill();
      c.save();c.clip();c.lineWidth=Math.max(1,P*.012);for(let y=P*.1;y<P;y+=P*.07){c.strokeStyle=tone(col,y%(P*.14)<P*.07?.3:-.3,.35);c.beginPath();c.moveTo(0,y);c.lineTo(P,y);c.stroke()}c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.45,.6);pathRound(c,P*.14,P*.14,P*.72,P*.72,P*.06);c.stroke();
    },
    ghost(c,P,col){
      const m=P*.07;c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(col,.4,.8);pathRound(c,m,m,P-2*m,P-2*m,P*.12);c.stroke();
      c.lineWidth=Math.max(1,P*.022);c.strokeStyle=tone(col,.1,.45);pathRound(c,P*.17,P*.17,P*.66,P*.66,P*.07);c.stroke();
    }},
  // lake ice (Хөвсгөл): a frosted top, cracks from one point and a white rim
  ice:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.035),w=P-2*m;
      let g=c.createLinearGradient(0,0,P*.3,P);g.addColorStop(0,tone(col,.5));g.addColorStop(.35,tone(col,.06));g.addColorStop(1,tone(col,-.32));
      pathRound(c,m,m,w,w,P*.1);c.fillStyle=g;c.fill();
      c.save();c.clip();
      const fx=P*(.64+.05*Math.sin(id*2.1)),fy=P*(.36+.05*Math.cos(id*1.7));
      c.strokeStyle='rgba(255,255,255,.5)';c.lineWidth=Math.max(1,P*.02);c.beginPath();
      for(const [x,y] of [[P,P*.18],[P*.82,P],[P*.42,P],[P,P*.72],[P*.5,0]]){c.moveTo(fx,fy);c.lineTo(x,y)}c.stroke();
      g=c.createLinearGradient(0,0,0,P*.36);g.addColorStop(0,'rgba(255,255,255,.6)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,P,P*.36);
      c.restore();
      c.lineWidth=Math.max(1,P*.035);c.strokeStyle='rgba(255,255,255,.82)';pathRound(c,m+c.lineWidth/2,m+c.lineWidth/2,w-c.lineWidth,w-c.lineWidth,P*.1);c.stroke();
      if(P>=GLYPH_MIN){c.save();c.shadowColor=tone(col,-.5);c.shadowBlur=P*.06;glyph(c,id,P/2,P*.54,P*.13,Math.max(1.2,P*.048),'rgba(255,255,255,.92)');c.restore()}
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.035);pathRound(c,m,m,P-2*m,P-2*m,P*.1);
      const g=c.createLinearGradient(0,0,0,P);g.addColorStop(0,tone(col,.25));g.addColorStop(1,tone(col,-.2));c.fillStyle=g;c.fill();
      c.save();c.clip();c.fillStyle='rgba(255,255,255,.28)';specks(P,41,10,(x,y)=>{c.beginPath();c.arc(x,y,Math.max(.8,P*.03),0,Math.PI*2);c.fill()});c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle='rgba(255,255,255,.45)';c.stroke();
    },
    ghost(c,P,col){
      const m=P*.07;pathRound(c,m,m,P-2*m,P-2*m,P*.1);c.fillStyle='rgba(255,255,255,.08)';c.fill();
      c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(col,.55,.85);c.stroke();
    }},
  // eight-bit arcade cabinet blocks: light top-left edge, dark bottom-right edge, a pixel motif
  pixel:{
    tile(c,P,col,id){
      const u=P/8,R=v=>Math.round(v);
      c.fillStyle=col;c.fillRect(0,0,P,P);
      c.fillStyle=tone(col,.55);c.fillRect(0,0,P,R(u));c.fillRect(0,0,R(u),P);
      c.fillStyle=tone(col,-.5);c.fillRect(0,R(P-u),P,P-R(P-u));c.fillRect(R(P-u),R(u),P-R(P-u),P);
      c.fillStyle=tone(col,.85);c.fillRect(R(u),R(u),R(2*u)-R(u),R(2*u)-R(u));c.fillRect(R(2*u),R(u),R(3*u)-R(2*u),R(2*u)-R(u));c.fillRect(R(u),R(2*u),R(2*u)-R(u),R(3*u)-R(2*u));
      if(P>=GLYPH_MIN){c.fillStyle=tone(col,-.55);PIXEL_GLYPHS[id].forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='#')c.fillRect(R((x+2)*u),R((y+2)*u),R((x+3)*u)-R((x+2)*u),R((y+3)*u)-R((y+2)*u))}))}
    },
    garbage(c,P,col){
      const u=P/8;c.fillStyle=tone(col,-.15);c.fillRect(0,0,P,P);
      c.fillStyle=tone(col,.2);for(let y=0;y<8;y++)for(let x=0;x<8;x++)if((x+y)%2)c.fillRect(Math.round(x*u),Math.round(y*u),Math.ceil(u),Math.ceil(u));
      c.fillStyle=tone(col,-.55);c.fillRect(0,Math.round(P-u),P,Math.ceil(u));c.fillRect(Math.round(P-u),0,Math.ceil(u),P);
    },
    ghost(c,P,col){
      const u=P/8;c.fillStyle=tone(col,.2,.75);
      for(let k=0;k<8;k+=2){for(const [x,y] of [[k,0],[k+1,7],[0,k+1],[7,k]])c.fillRect(Math.round(x*u),Math.round(y*u),Math.ceil(u),Math.ceil(u))}
    }},
  // glowing embers: a hot core, charred cracks, a fiery rim
  ember:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.03),w=P-2*m;
      pathRound(c,m,m,w,w,P*.12);c.fillStyle='#1a0e0a';c.fill();
      c.save();c.clip();
      const g=c.createRadialGradient(P*.5,P*.45,0,P*.5,P*.5,P*.62);g.addColorStop(0,tone(col,.6));g.addColorStop(.45,col);g.addColorStop(1,tone(col,-.55));
      c.fillStyle=g;c.fillRect(0,0,P,P);
      c.strokeStyle='rgba(24,8,4,.78)';c.lineWidth=Math.max(1,P*.045);c.lineJoin='round';c.lineCap='round';c.beginPath();
      const f=id%2?-1:1,X=x=>P*(f>0?x:1-x);
      for(const pts of [[.6,0,.66,.28,.84,.4,1,.36],[.66,.28,.56,.6,.64,.82,.52,1],[.56,.6,.36,.74,.24,1]]){c.moveTo(X(pts[0]),P*pts[1]);for(let k=2;k<pts.length;k+=2)c.lineTo(X(pts[k]),P*pts[k+1])}
      c.stroke();c.restore();
      c.save();c.shadowColor=col;c.shadowBlur=P*.15;c.lineWidth=Math.max(1,P*.04);c.strokeStyle=tone(col,.35,.9);pathRound(c,m+P*.02,m+P*.02,w-P*.04,w-P*.04,P*.11);c.stroke();c.restore();
      if(P>=GLYPH_MIN){c.save();c.shadowColor='#fff3c4';c.shadowBlur=P*.1;glyph(c,id,P/2,P/2,P*.13,Math.max(1.2,P*.05),tone(col,.85));c.restore()}
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.03);pathRound(c,m,m,P-2*m,P-2*m,P*.12);c.fillStyle=tone(col,-.1);c.fill();
      c.save();c.clip();c.strokeStyle='rgba(255,90,30,.45)';c.lineWidth=Math.max(1,P*.03);c.beginPath();c.moveTo(P*.62,0);c.lineTo(P*.55,P*.45);c.lineTo(P*.72,P);c.moveTo(P*.55,P*.45);c.lineTo(P,P*.6);c.stroke();c.restore();
      c.lineWidth=Math.max(1,P*.025);c.strokeStyle=tone(col,.3,.5);pathRound(c,P*.12,P*.12,P*.76,P*.76,P*.08);c.stroke();
    },
    ghost(c,P,col){
      const m=P*.08;c.save();c.shadowColor=col;c.shadowBlur=P*.15;c.lineWidth=Math.max(1.5,P*.05);c.strokeStyle=tone(col,.2,.7);pathRound(c,m,m,P-2*m,P-2*m,P*.12);c.stroke();c.restore();
    }},
  // the night sky inside a block: a nebula, stars and a glowing rim
  cosmic:{
    tile(c,P,col,id){
      const m=Math.max(1,P*.035),w=P-2*m;
      pathRound(c,m,m,w,w,P*.16);
      let g=c.createRadialGradient(P*.35,P*.32,0,P*.5,P*.5,P*.72);g.addColorStop(0,tone(col,.3));g.addColorStop(.45,tone(col,-.05));g.addColorStop(.8,tone(col,-.55));g.addColorStop(1,'#05061a');
      c.fillStyle=g;c.fill();
      c.save();c.clip();
      g=c.createLinearGradient(0,P,P,0);g.addColorStop(.38,'rgba(255,255,255,0)');g.addColorStop(.64,tone(col,.6,.5));g.addColorStop(.86,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,P,P);
      specks(P,id*13+5,9,(x,y,k)=>{const r=Math.max(.7,P*(k%3?.02:.036));c.fillStyle='rgba(255,255,255,'+(k%3?.75:1)+')';
        if(k%3)c.fillRect(x-r/2,y-r/2,r,r);else pathPoly(c,[x,y-r*2,x+r*.5,y-r*.5,x+r*2,y,x+r*.5,y+r*.5,x,y+r*2,x-r*.5,y+r*.5,x-r*2,y,x-r*.5,y-r*.5]),c.fill()});
      c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.55,.85);pathRound(c,m+c.lineWidth/2,m+c.lineWidth/2,w-c.lineWidth,w-c.lineWidth,P*.15);c.stroke();
      if(P>=GLYPH_MIN){c.save();c.shadowColor=tone(col,.6);c.shadowBlur=P*.14;glyph(c,id,P/2,P/2,P*.13,Math.max(1.2,P*.045),'rgba(255,255,255,.95)');c.restore()}
    },
    garbage(c,P,col){
      const m=Math.max(1,P*.035);pathRound(c,m,m,P-2*m,P-2*m,P*.16);
      const g=c.createLinearGradient(0,0,0,P);g.addColorStop(0,tone(col,.12));g.addColorStop(1,tone(col,-.3));c.fillStyle=g;c.fill();
      c.save();c.clip();c.fillStyle='rgba(255,255,255,.35)';specks(P,77,6,(x,y)=>{c.fillRect(x,y,Math.max(1,P*.025),Math.max(1,P*.025))});c.restore();
      c.lineWidth=Math.max(1,P*.03);c.strokeStyle=tone(col,.4,.6);pathRound(c,P*.13,P*.13,P*.74,P*.74,P*.1);c.stroke();
    },
    ghost(c,P,col){
      const m=P*.08;c.save();c.shadowColor=col;c.shadowBlur=P*.14;pathRound(c,m,m,P-2*m,P-2*m,P*.16);c.fillStyle=tone(col,0,.08);c.fill();
      c.lineWidth=Math.max(1.5,P*.045);c.strokeStyle=tone(col,.4,.75);c.stroke();c.restore();
    }},
  lacquer:lacquerStyle('#e3b341',false),       // gilt frame
  royal:lacquerStyle('#ffd56a',true),          // bright gold frame with gems
  frost:lacquerStyle('#dfe9f7',true),          // silver frame with gems
  seal:sealStyle('#ffd56a'),                   // gold octagonal seal
  silverseal:sealStyle('#d9e2ef'),             // silver octagonal seal
});

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
  // coin skins (3-19): 300 / 600 / 1200 / 2500 coins; the dearer ones have their own shapes and an animated touch (fx)
  {id:3,name:'skinFelt',desc:'skinFeltD',price:300,style:'felt',
    palette:['#c8553d','#3d5a99','#d9a521','#7b3f6e','#3f8f7f','#9bb06b','#e8d3b0'],garbage:'#5c4a42',
    board:{bg:['#1a1422','#0d0a14'],grid:'rgba(255,200,150,.07)',dots:'rgba(255,210,170,.18)',frame:'#8a5a3c',glow:'rgba(200,85,61,.10)',accent:'#d9a521'}},
  {id:4,name:'skinDusk',desc:'skinDuskD',price:300,style:'sunset',
    palette:['#ff7a59','#ffd166','#b98cff','#5ec8f0','#ff3d8b','#3550c8','#7be0a0'],garbage:'#4a4560',
    board:{bg:['#1d1030','#0a0718'],grid:'rgba(255,150,120,.10)',dots:'rgba(255,180,150,.25)',frame:'#7a3f6a',glow:'rgba(255,122,89,.14)',accent:'#ff7a59'}},
  {id:5,name:'skinArcade',desc:'skinArcadeD',price:300,style:'pixel',
    palette:['#00e5ff','#ffe600','#d500f9','#00e676','#ff1744','#2979ff','#ff9100'],garbage:'#546e7a',
    board:{bg:['#050510','#000004'],grid:'rgba(0,229,255,.10)',dots:'',frame:'#00b8d4',glow:'rgba(213,0,249,.14)',accent:'#00e5ff'}},
  {id:6,name:'skinSilver',desc:'skinSilverD',price:600,style:'silver',
    palette:['#7fb2d9','#d6cf86','#b19ad9','#86c9a6','#d98a9a','#6670d0','#e0a66a'],garbage:'#6b7280',
    board:{bg:['#141821','#080a10'],grid:'rgba(200,210,230,.10)',dots:'rgba(220,230,245,.22)',frame:'#9aa6bd',glow:'rgba(200,215,240,.10)',accent:'#d7dde8'}},
  {id:7,name:'skinIce',desc:'skinIceD',price:600,style:'ice',
    palette:['#29c7e6','#f5f0b0','#8a7cf0','#5fe0a8','#e8506e','#3a68e0','#f0ad78'],garbage:'#8aa0b8',
    board:{bg:['#071a2e','#03101f'],grid:'rgba(160,220,255,.12)',dots:'rgba(200,240,255,.25)',frame:'#6fb6e0',glow:'rgba(127,227,255,.14)',accent:'#bff0ff'}},
  {id:8,name:'skinNaadam',desc:'skinNaadamD',price:600,style:'medal',
    palette:['#0a6fc2','#f9cf3a','#7e4bc4','#2e9e4f','#da2032','#f4f1e8','#f08a1c'],garbage:'#64584c',
    board:{bg:['#13102a','#080614'],grid:'rgba(255,204,0,.08)',dots:'rgba(255,220,120,.20)',frame:'#c0392b',glow:'rgba(218,32,50,.12)',accent:'#f9cf3a'}},
  {id:9,name:'skinEmber',desc:'skinEmberD',price:1200,style:'ember',fx:{kind:'glint',color:'#ffb36b',period:4.5},
    palette:['#ff8c1a','#ffe14d','#ff3d6e','#7ee05a','#e81e1e','#4aa8ff','#c86bff'],garbage:'#3b302c',
    board:{bg:['#1a0805','#080202'],grid:'rgba(255,120,40,.08)',dots:'rgba(255,150,80,.18)',frame:'#a8401a',glow:'rgba(255,90,20,.18)',accent:'#ff8c1a'}},
  {id:10,name:'skinPalace',desc:'skinPalaceD',price:1200,style:'lacquer',fx:{kind:'glint',color:'#fff0c0',period:6},
    palette:['#1f6fd6','#e8b923','#8e2bd1','#13a89e','#c8102e','#243b9e','#e2711d'],garbage:'#3a3030',
    board:{bg:['#1a0d0a','#0a0505'],grid:'rgba(232,185,35,.08)',dots:'rgba(232,185,35,.22)',frame:'#c9a227',glow:'rgba(232,185,35,.14)',accent:'#ffd56b'}},
  {id:11,name:'skinKhan',desc:'skinKhanD',price:2500,style:'seal',fx:{kind:'glint',color:'#fff3c4',period:5},
    palette:['#18b6c4','#f2a20c','#6a2bb5','#0f9d6b','#b3122e','#1e4fd1','#efe6cf'],garbage:'#2a2230',
    board:{bg:['#140a1c','#060309'],grid:'rgba(255,210,63,.07)',dots:'rgba(255,210,63,.26)',frame:'#ffcf5a',glow:'rgba(255,191,58,.20)',accent:'#ffcf5a'}},
  {id:12,name:'skinSky',desc:'skinSkyD',price:2500,style:'cosmic',fx:{kind:'twinkle',color:'#ffffff'},
    palette:['#4fc3ff','#ffe27a','#b388ff','#64ffda','#ff6e9c','#536dfe','#ffab40'],garbage:'#4b4f6b',
    board:{bg:['#060824','#02030c'],grid:'rgba(120,140,255,.10)',dots:'rgba(200,210,255,.22)',frame:'#5b6cff',glow:'rgba(83,109,254,.20)',accent:'#b388ff'}},
  // season-pass skins (20-39): only from the season pass, never for coins
  {id:20,name:'skinFrost',desc:'skinFrostD',season:'s1',style:'snow',
    palette:['#9adfff','#fff59a','#c9b6ff','#9ff7cf','#ffb0cf','#8f9fff','#ffb38a'],garbage:'#7d8fa6',
    board:{bg:['#0c1d33','#050d1c'],grid:'rgba(200,235,255,.12)',dots:'rgba(230,245,255,.30)',frame:'#9fd8ff',glow:'rgba(200,235,255,.14)',accent:'#e6f6ff'}},
  {id:21,name:'skinBlizzard',desc:'skinBlizzardD',season:'s1',style:'felt',
    palette:['#2f6db5','#f0ead8','#8c5bb8','#4fa3a5','#c0413e','#1f3f86','#e8a03c'],garbage:'#8e9bb0',
    board:{bg:['#16233a','#0a1222'],grid:'rgba(220,235,255,.08)',dots:'rgba(235,245,255,.22)',frame:'#c9d3df',glow:'rgba(220,235,255,.10)',accent:'#ffffff'}},
  {id:22,name:'skinWolf',desc:'skinWolfD',season:'s1',style:'silverseal',fx:{kind:'glint',color:'#eef4ff',period:6},
    palette:['#3d8fd1','#d8c070','#8a6fd1','#3fae8a','#d1555f','#33479e','#cf8040'],garbage:'#4a505e',
    board:{bg:['#0e1422','#05080f'],grid:'rgba(207,216,230,.09)',dots:'rgba(233,240,255,.22)',frame:'#cfd8e6',glow:'rgba(180,200,240,.14)',accent:'#e9f0ff'}},
  {id:23,name:'skinPolar',desc:'skinPolarD',season:'s1',style:'cosmic',fx:{kind:'twinkle',color:'#e8fffa'},
    palette:['#2ef2c6','#d9ff6a','#9a7dff','#3fd97a','#ff5f8a','#3a6fe0','#ffd36a'],garbage:'#3f4766',
    board:{bg:['#04131f','#01060c'],grid:'rgba(63,245,208,.09)',dots:'rgba(180,255,240,.20)',frame:'#3ff5d0',glow:'rgba(63,245,208,.18)',accent:'#9a7dff'}},
  {id:24,name:'skinIceKhan',desc:'skinIceKhanD',season:'s1',style:'frost',fx:{kind:'glint',color:'#f2fbff',period:6},
    palette:['#5ad1ff','#ffe8a0','#9ea8ff','#5ee8c8','#ff8fae','#3a5ad8','#d8e6f5'],garbage:'#6d7894',
    board:{bg:['#0a1630','#040a18'],grid:'rgba(223,233,247,.08)',dots:'rgba(223,233,247,.26)',frame:'#dfe9f7',glow:'rgba(191,230,255,.16)',accent:'#bfe6ff'}},
  {id:25,name:'skinKhadag',desc:'skinKhadagD',season:'s2',style:'gem',
    palette:['#2d7ff0','#f2f6ff','#7d6cf0','#3fc0d8','#e85a7a','#1f4fb0','#f0c050'],garbage:'#6f7c94',
    board:{bg:['#0d1a36','#061026'],grid:'rgba(127,180,255,.09)',dots:'rgba(188,216,255,.22)',frame:'#7fb4ff',glow:'rgba(127,180,255,.14)',accent:'#bcd8ff'}},
  {id:26,name:'skinLantern',desc:'skinLanternD',season:'s2',style:'pixel',
    palette:['#e8322f','#ffd93d','#c56cf0','#2fbf71','#ff7aa8','#3a5bd9','#ff922b'],garbage:'#6d5c5c',
    board:{bg:['#200a10','#0c0306'],grid:'rgba(255,77,109,.10)',dots:'',frame:'#ff4d6d',glow:'rgba(255,217,61,.14)',accent:'#ffd93d'}},
  {id:27,name:'skinDragon',desc:'skinDragonD',season:'s2',style:'royal',fx:{kind:'glint',color:'#fff0c0',period:6},
    palette:['#d50000','#ffc107','#9c27b0','#009688','#ff6d00','#3949ab','#f5e6c8'],garbage:'#3e2f2a',
    board:{bg:['#200808','#0c0303'],grid:'rgba(255,193,7,.08)',dots:'rgba(255,213,79,.24)',frame:'#ffc107',glow:'rgba(213,0,0,.18)',accent:'#ffd54f'}},
  {id:28,name:'skinFireHorse',desc:'skinFireHorseD',season:'s2',style:'ember',fx:{kind:'glint',color:'#ffc48a',period:4.5},
    palette:['#ff4f9a','#ffe066','#ff9a3c','#3fd9c0','#ff2a2a','#7f6bff','#d17bff'],garbage:'#2f2626',
    board:{bg:['#1c0a04','#090301'],grid:'rgba(255,122,26,.08)',dots:'rgba(255,179,71,.20)',frame:'#ff7a1a',glow:'rgba(255,90,20,.18)',accent:'#ffb347'}},
  {id:29,name:'skinCosmicKhan',desc:'skinCosmicKhanD',season:'s2',style:'cosmic',fx:{kind:'twinkle',color:'#fff3c4'},
    palette:['#ffd740','#e040fb','#40c4ff','#69f0ae','#ff5252','#536dfe','#ff7d3a'],garbage:'#424867',
    board:{bg:['#0b0620','#04020c'],grid:'rgba(255,215,64,.08)',dots:'rgba(255,230,140,.22)',frame:'#ffd740',glow:'rgba(224,64,251,.18)',accent:'#ffd740'}},
];
function skinById(id){return SKINS.find(k=>k.id===id)||SKINS[0]}
function currentSkin(){return skinById(profile.theme)}
const skinOwned=k=>k.id===0||profile.owned.includes(k.id);
// saved profiles keep only skins this registry knows (10-profile.js lets ids 1-39 through)
profile.owned=profile.owned.filter(id=>id===0||SKINS.some(k=>k.id===id));
if(!profile.owned.includes(profile.theme))profile.theme=0;

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
// zoomed in (3 rows of bigger cells) for the shop list, so each skin's texture shows at a glance
const SKIN_SCENE_ZOOM=['.3.22.7','3332277','1111456'];
function drawSkinPreview(cv,skin,zoom){
  const c=cv.getContext('2d'),w=cv.width/SKIN_SCALE,h=cv.height/SKIN_SCALE,scene=zoom?SKIN_SCENE_ZOOM:SKIN_SCENE,s=zoom?h/scene.length:w/W;
  c.setTransform(SKIN_SCALE,0,0,SKIN_SCALE,0,0);c.clearRect(0,0,w,h);
  c.drawImage(skinBoard(skin,w,h),0,0,w,h);
  scene.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch!=='.')c.drawImage(skinSprite(skin,+ch,s),x*s+(zoom?(w-row.length*s)/2:0),y*s,s,s)}));
}
/* ---------- animated touch (skin.fx) ----------
The dearer skins get a slow light sweep over their blocks (glint) or stars twinkling on them (twinkle), drawn on a
transparent canvas over the main board (#skinfx), so the board and its cached layer are never touched. render()
calls skinFxFrame() every frame; skinFxKey() gives '' most of the time (nothing to draw) or a frame id while the
effect moves (a sweep lasts about a second every few seconds at 20 fps; twinkles change 8 times a second), and the
overlay is redrawn only when that id changes: one drawImage of a cached light band clipped to the occupied cells,
or a few cached star sprites. Off with prefers-reduced-motion. */
const SKIN_FX_FPS=20,SKIN_SWEEP=1.1,SKIN_TW=125;
function skinFxKey(skin,now=performance.now()){
  const f=skin.fx;if(!f||fxCalm())return '';
  if(f.kind==='twinkle')return 't'+Math.floor(now/SKIN_TW);
  const t=(now/1000)%(f.period||6);
  return t<SKIN_SWEEP?'g'+Math.floor(t*SKIN_FX_FPS):'';
}
function skinFxBand(color,w,h){
  const key='band|'+color+'|'+w+'x'+h;let cv=skinCache.get(key);
  if(!cv){
    const bw=w*.4,k=.35;cv=skinCanvas(Math.ceil((bw+k*h)*SKIN_SCALE),Math.ceil(h*SKIN_SCALE),()=>skinCache.delete(key));
    const g=cv.getContext('2d');g.scale(SKIN_SCALE,SKIN_SCALE);g.transform(1,0,-k,1,k*h,0);
    const gr=g.createLinearGradient(0,0,bw,0);gr.addColorStop(0,tone(color,0,0));gr.addColorStop(.5,tone(color,0,.5));gr.addColorStop(1,tone(color,0,0));
    g.fillStyle=gr;g.fillRect(0,0,bw,h);skinCache.set(key,cv);
  }
  return cv;
}
function skinFxStar(color){
  const key='star|'+color;let cv=skinCache.get(key);
  if(!cv){
    cv=skinCanvas(48,48,()=>skinCache.delete(key));const g=cv.getContext('2d'),r=g.createRadialGradient(24,24,0,24,24,24);
    r.addColorStop(0,tone(color,0,.9));r.addColorStop(.2,tone(color,0,.35));r.addColorStop(1,tone(color,0,0));g.fillStyle=r;g.fillRect(0,0,48,48);
    g.fillStyle=tone(color,.3,1);pathPoly(g,[24,2,27,21,46,24,27,27,24,46,21,27,2,24,21,21]);g.fill();skinCache.set(key,cv);
  }
  return cv;
}
// cells: the board's locked cells; extra: [[x, y], ...] for the falling piece
function skinFxDraw(c,skin,b,w,h,key,extra){
  const s=w/W,f=skin.fx,n=+key.slice(1);
  if(key[0]==='g'){
    c.save();c.beginPath();
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(b.cells[y][x])c.rect(x*s,y*s,s,s);
    for(const [x,y] of extra)if(y>=0)c.rect(x*s,y*s,s,s);
    c.clip();
    const band=skinFxBand(f.color,w,h),bw=band.width/SKIN_SCALE,t=n/(SKIN_SWEEP*SKIN_FX_FPS);
    c.globalCompositeOperation='lighter';c.drawImage(band,-bw+(w+bw)*t,0,bw,h);c.restore();
    return;
  }
  const star=skinFxStar(f.color),sec=n*SKIN_TW/1000;
  c.save();c.globalCompositeOperation='lighter';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(!b.cells[y][x])continue;
    const hsh=(x*7349+y*1931+97)%997;if(hsh%5)continue;            // about one cell in five has a star
    const ph=(sec/2.6+hsh/997)%1;if(ph>.32)continue;
    const a=Math.sin(ph/.32*Math.PI),z=s*(.5+.4*a);
    c.globalAlpha=a;c.drawImage(star,x*s+s*(.25+(hsh%7)/14)-z/2,y*s+s*(.25+(hsh%11)/22)-z/2,z,z);
  }
  c.restore();
}
let skinFxCv=null,skinFxShown='';
function skinFxFrame(b){
  const skin=currentSkin(),key=skinFxKey(skin);
  if(key===skinFxShown)return;
  skinFxShown=key;
  if(!skinFxCv){skinFxCv=skinCanvas(280*SKIN_SCALE,560*SKIN_SCALE);skinFxCv.id='skinfx';skinFxCv.setAttribute('aria-hidden','true');$('board').after(skinFxCv)}
  const c=skinFxCv.getContext('2d');c.setTransform(SKIN_SCALE,0,0,SKIN_SCALE,0,0);c.clearRect(0,0,280,560);
  if(!key)return;
  const p=b.piece,cells=[];
  if(p)for(let r=0;r<p.m.length;r++)for(let x=0;x<p.m[r].length;x++)if(p.m[r][x])cells.push([p.x+x,p.y+r]);
  skinFxDraw(c,skin,b,280,560,key,cells);
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
