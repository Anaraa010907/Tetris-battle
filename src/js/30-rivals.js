/* ---------- rivals ---------- */
// sec: seconds per piece, noise: placement mistakes, style: 0 survive, 1 + likes quads, 2 builds a well and looks ahead
const DIFFS=[{sec:2.1,noise:2.5,style:0,rating:850},{sec:1.3,noise:.6,style:1,rating:1000},{sec:.8,noise:.1,style:2,rating:1250}];
// Ranked bots stand in when no player is around. They are always labelled as bots and built to match a rating.
const BOT_NAMES=['NOVA_7','Kairo','Mira','Taiga','Orbit','Zed','Vega','Lyra','Onyx','Echo','Rune','Pixel'];
const BOT_RP_CAP=1400;                 // online: from Гарьд up, rank points come only from real players
function curve(pts,x){
  if(x<=pts[0][0])return pts[0][1];
  for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){const [x0,y0]=pts[i-1],[x1,y1]=pts[i];return y0+(y1-y0)*(x-x0)/(x1-x0)}
  return pts[pts.length-1][1];
}
function botFor(rating){
  const r=Math.max(600,Math.min(2100,Math.round(rating+(Math.random()*2-1)*60)));
  return {name:BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)],rating:r,cfg:{
    sec:curve([[600,2.5],[850,2],[1000,1.35],[1250,.85],[1500,.65],[1800,.5],[2100,.42]],r),
    noise:curve([[600,3],[850,2.2],[1000,.7],[1250,.15],[1500,.05],[2100,0]],r),style:r<925?0:r<1175?1:2}};
}
let rival='NOVA',rivalCfg=DIFFS[1],rivalRating=1000;

