/* ---------- handling: held buttons and keys (DAS, ARR, soft drop) ---------- */
// The same rules for the on-screen buttons and the keyboard (the OS key repeat is not used):
//   left / right: one step at once; held for DAS ms, it repeats every ARR ms (ARR 0: straight to the wall).
//   soft drop: one row at once, then soft-drop factor × gravity (0: down to the floor at once). It never locks.
// Each press has a source ('k' + key code, 'p' + pointer id), so a key and a button can hold the same move.
// The newest held direction wins; letting go of it hands over to the other one, which charges its DAS again.
// Code that drops every hold (a new round, pause, game over) clears heldAction; handling() then lets go too.
const HELD={left:new Set(),right:new Set(),soft:new Set()};
let hDir='',hTime=0,hNext=0,hSoft=0;
const fallTime=b=>Math.max(param('minFall'),param('fallSeconds')*Math.pow(.92,Math.floor(b.time/20)));
const anyHeld=()=>HELD.left.size+HELD.right.size+HELD.soft.size>0;
function press(a,src){
  if(state!=='play'||!HELD[a]||HELD[a].has(src))return;
  const first=!HELD[a].size;
  HELD[a].add(src);heldAction='held';
  if(!first)return;
  if(a==='soft'){hSoft=0;action('down1');if(profile.ctl.sdf===0)softFloor()}
  else{hDir=a;hTime=0;hNext=profile.ctl.das/1000;action(a)}
}
function release(a,src){
  for(const k of a?[a]:Object.keys(HELD)){
    if(!HELD[k].delete(src)||HELD[k].size||k!==hDir)continue;
    const other=k==='left'?'right':'left';
    hDir=HELD[other].size?other:'';hTime=0;hNext=profile.ctl.das/1000;
  }
  if(!anyHeld())heldAction='';
}
function releaseAll(){for(const k in HELD)HELD[k].clear();hDir='';hSoft=0;heldAction=''}
function canMove(dx,dy){const b=boards[0],p=b&&b.piece;return !!p&&state==='play'&&!hit(b,p.m,p.x+dx,p.y+dy)}
function slide(a){const dx=a==='left'?-1:1;for(let i=0;i<W&&canMove(dx,0);i++)action(a)}
function softFloor(){for(let i=0;i<H+4&&canMove(0,1);i++)action('down1')}
// called every game tick (1/60 s) from step()
function handling(dt){
  if(!heldAction){if(anyHeld())releaseAll();return}
  const c=profile.ctl;
  if(hDir){
    hTime+=dt;
    if(hTime>=hNext){
      if(c.arr===0){slide(hDir);hNext=hTime}
      else while(hTime>=hNext&&state==='play'){if(canMove(hDir==='left'?-1:1,0))action(hDir);hNext+=c.arr/1000}
    }
  }
  if(HELD.soft.size&&state==='play'){
    if(c.sdf===0)softFloor();
    else if(!canMove(0,1))hSoft=0;
    else{hSoft+=dt*c.sdf/fallTime(boards[0]);while(hSoft>=1){hSoft--;if(canMove(0,1))action('down1');else{hSoft=0;break}}}
  }
}
window.addEventListener('blur',releaseAll);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll()});
