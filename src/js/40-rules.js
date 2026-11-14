/* ================= core rules ================= */
const W=10,H=20;
// SRS spawn orientations in their rotation boxes. ids: 0 I, 1 O, 2 T, 3 S, 4 Z, 5 J, 6 L
const SHAPES=[
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1],[0,0,0]],
  [[0,1,1],[1,1,0],[0,0,0]],
  [[1,1,0],[0,1,1],[0,0,0]],
  [[1,0,0],[1,1,1],[0,0,0]],
  [[0,0,1],[1,1,1],[0,0,0]]];
const rotCW=m=>m[0].map((_,i)=>m.map(r=>r[i]).reverse());
const ROT=SHAPES.map(m=>{const a=[m];for(let i=1;i<4;i++)a.push(rotCW(a[i-1]));return a});
// previews: shapes trimmed to their cells
const PREV=SHAPES.map(m=>{const rows=m.filter(r=>r.some(v=>v)),cols=m[0].map((_,c)=>c).filter(c=>rows.some(r=>r[c]));return rows.map(r=>cols.map(c=>r[c]))});
// SRS kicks (x right, y up), Tetra League style
const KJ={'0>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'1>0':[[0,0],[1,0],[1,-1],[0,2],[1,2]],'1>2':[[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '2>1':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],'2>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],'3>2':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '3>0':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],'0>3':[[0,0],[1,0],[1,1],[0,-2],[1,-2]]};
const KI={'0>1':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],'1>0':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'1>2':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  '2>1':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'2>3':[[0,0],[2,0],[-1,0],[2,1],[-1,-2]],'3>2':[[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
  '3>0':[[0,0],[1,0],[-2,0],[1,-2],[-2,1]],'0>3':[[0,0],[-1,0],[2,0],[-1,2],[2,-1]]};
const K180={'0>2':[[0,0],[0,1],[1,1],[-1,1],[1,0],[-1,0]],'1>3':[[0,0],[1,0],[1,2],[1,1],[0,2],[0,1]],
  '2>0':[[0,0],[0,-1],[-1,-1],[1,-1],[-1,0],[1,0]],'3>1':[[0,0],[-1,0],[-1,2],[-1,1],[0,2],[0,1]]};
const LOCK_DELAY=.5,MAX_RESETS=15,GARBAGE_DELAY=.35,GARBAGE_CAP=8,PC_BONUS=10;
// block colours and looks live in the skin registry (59-skins.js)

let state='title',boards=[],series=null,tick=0,acc=0,last=0,aiClock=0,powers=[],earned=0,log=[],seed=1,
  flashTime=0,actionTime=0,heldAction='',holdTime=0,holdNext=.28,roundEndSent=false,gest=null,overTimer=0;
function rnd(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let x=Math.imul(a^a>>>15,1|a);x=x+Math.imul(x^x>>>7,61|x)^x;return((x^x>>>14)>>>0)/4294967296}}
function param(k){return window.MABLE_PARAMS[k]}
const emptyRow=()=>Array(W).fill(0);
function makeBoard(pieceSeed){
  return {cells:Array.from({length:H},emptyRow),queue:[],rng:mulberry(pieceSeed),piece:null,hold:-1,canHold:true,
    fall:0,grounded:0,resets:0,lowest:0,lastRot:false,lastKick:0,garbage:[],combo:-1,b2b:-1,
    pieces:0,attack:0,lines:0,garbageCleared:0,time:0,slow:0,shield:false,dead:false};
}
function refill(b){while(b.queue.length<7){const g=[0,1,2,3,4,5,6];for(let i=6;i>0;i--){const j=Math.floor(b.rng()*(i+1));[g[i],g[j]]=[g[j],g[i]]}b.queue.push(...g)}}
function spawn(b){refill(b);const id=b.queue.shift();refill(b);b.canHold=true;place(b,id)}
function place(b,id){
  const m=ROT[id][0];
  b.piece={id,r:0,m,x:id===1?4:3,y:-m.findIndex(r=>r.some(v=>v))||0};
  b.fall=0;b.grounded=0;b.resets=0;b.lowest=b.piece.y;b.lastRot=false;
  if(hit(b,m,b.piece.x,b.piece.y))b.dead=true;
}
function hit(b,m,x,y){
  for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)
    if(m[r][c]&&(x+c<0||x+c>=W||y+r>=H||(y+r>=0&&b.cells[y+r][x+c])))return true;
  return false;
}
function resetLanding(b){if(b.resets<MAX_RESETS){b.grounded=0;b.resets++}}
function reachedLow(b){if(b.piece.y>b.lowest){b.lowest=b.piece.y;b.resets=0;b.grounded=0}}
function move(b,dx,dy){
  const p=b.piece;
  if(hit(b,p.m,p.x+dx,p.y+dy))return false;
  if(dx&&hit(b,p.m,p.x,p.y+1))resetLanding(b);
  p.x+=dx;p.y+=dy;b.lastRot=false;
  if(dy)reachedLow(b);
  return true;
}
// dir: 1 clockwise, -1 counter-clockwise, 2 half turn
function rotate(b,dir){
  const p=b.piece;if(p.id===1)return false;
  const to=(p.r+dir+4)%4,m=ROT[p.id][to],key=p.r+'>'+to,tests=dir===2?K180[key]:(p.id===0?KI:KJ)[key];
  const wasGrounded=hit(b,p.m,p.x,p.y+1);
  for(let i=0;i<tests.length;i++){
    const nx=p.x+tests[i][0],ny=p.y-tests[i][1];
    if(!hit(b,m,nx,ny)){
      p.m=m;p.r=to;p.x=nx;p.y=ny;b.lastRot=true;b.lastKick=i;
      if(wasGrounded||hit(b,m,nx,ny+1))resetLanding(b);
      reachedLow(b);
      return true;
    }
  }
  return false;
}
function hard(b){while(move(b,0,1));lock(b)}
// 0 none, 1 mini, 2 full T-spin (3-corner rule; the 5th kick always counts as full)
function spinType(b){
  const p=b.piece;if(p.id!==2||!b.lastRot)return 0;
  const occ=(cx,cy)=>{const x=p.x+cx,y=p.y+cy;return x<0||x>=W||y>=H||(y>=0&&!!b.cells[y][x])};
  const c=[occ(0,0),occ(2,0),occ(2,2),occ(0,2)];
  if(c.filter(Boolean).length<3)return 0;
  const f=[[0,1],[1,2],[2,3],[3,0]][p.r];
  return (c[f[0]]&&c[f[1]])||b.lastKick===4?2:1;
}
// Tetra League style attack: lines, T-spins, back-to-back, combo multiplier, all clear
function attackFor(n,spin,b2b,combo,pc){
  let a=n===0?0:spin===2?[0,2,4,6][n]:spin===1?[0,0,1,2][n]:[0,0,1,2,4][n];
  if(n>0&&(n===4||spin)&&b2b>0)a+=Math.floor(1+Math.log1p(b2b*.8));
  if(n>0&&combo>0)a=a>0?a*(1+.25*combo):Math.log1p(combo*1.25);
  a=Math.floor(a);
  if(pc)a+=PC_BONUS;
  return a;
}
function vibrate(){if(profile.vibration&&navigator.vibrate)try{navigator.vibrate(35)}catch(e){}}
function sound(name){audio.play(name,{volume:.5})}
function foeOf(b){return boards[b===boards[0]?1:0]}
function pendingRows(b,readyOnly){return b.garbage.reduce((s,g)=>s+(!readyOnly||g.delay<=0?g.rows:0),0)}
function dumpGarbage(b){
  let cap=GARBAGE_CAP;
  while(cap>0&&b.garbage.length&&b.garbage[0].delay<=0){
    const g=b.garbage[0],k=Math.min(g.rows,cap);
    for(let i=0;i<k;i++){
      if(b.cells[0].some(v=>v))b.dead=true;
      b.cells.shift();const row=Array(W).fill(8);row[g.hole]=0;b.cells.push(row);
    }
    g.rows-=k;cap-=k;if(!g.rows)b.garbage.shift();
  }
}
function lock(b){
  const p=b.piece,spin=spinType(b),me=b===boards[0];
  for(let r=0;r<p.m.length;r++)for(let c=0;c<p.m[r].length;c++)if(p.m[r][c]&&p.y+r<0){b.dead=true;finishRound(b);return}
  for(let r=0;r<p.m.length;r++)for(let c=0;c<p.m[r].length;c++)if(p.m[r][c])b.cells[p.y+r][p.x+c]=p.id+1;
  const fx=fxRows(b);                         // effects (62-fx.js): the rows about to clear
  let n=0,gc=0;
  for(let y=H-1;y>=0;y--)if(b.cells[y].every(v=>v)){if(b.cells[y].includes(8))gc++;b.cells.splice(y,1);b.cells.unshift(emptyRow());n++;y++}
  b.pieces++;
  const pc=n>0&&b.cells.every(r=>r.every(v=>!v));
  if(n>0){b.combo++;if(n===4||spin)b.b2b++;else b.b2b=-1}else b.combo=-1;
  const atk=attackFor(n,spin,b.b2b,b.combo,pc);
  b.lines+=n;b.garbageCleared+=gc;
  if(atk>0){
    b.attack+=atk;let rest=atk;
    while(rest>0&&b.garbage.length){const g=b.garbage[0],k=Math.min(g.rows,rest);g.rows-=k;rest-=k;if(!g.rows)b.garbage.shift()}
    if(rest>0){
      const other=foeOf(b),hole=Math.floor(rnd()*W);
      if(isOnline()){if(me)Net.attack(rest,hole)}                   // the other phone adds it to its own queue
      else if(powersOn()&&other.shield){other.shield=false;if(other===boards[0])showAction('',t('blocked'))}
      else{other.garbage.push({rows:rest,hole,delay:GARBAGE_DELAY});log.push({tick,type:'garbage',to:me?1:0,rows:rest})}
    }
  }
  if(n===0){const before=pendingRows(b,true);dumpGarbage(b);fxRise(b,before-pendingRows(b,true));if(me&&before)vibrate()}
  if(me){
    sound(n?'clear':'lock');
    if(n){vibrate();flashTime=.18}
    announce(n,spin,b,pc,atk);
    if(powersOn()&&n){
      earned+=n;
      while(earned>=param('powerLines')){earned-=param('powerLines');if(powers.length<2)powers.push(Math.floor(rnd()*3))}
    }
  }
  fxLock(b,fx,spin,pc,atk);
  spawn(b);
  if(b.dead)finishRound(b);
  else if(me&&isOnline())Net.sendState();
}
function announce(n,spin,b,pc,atk){
  const names=['','SINGLE','DOUBLE','TRIPLE','QUAD'];
  let main='',kind='';
  if(spin){main=(spin===1?'T-SPIN MINI':'T-SPIN')+(n?' '+names[n]:'');kind='spin'}
  else if(n>=2){main=names[n];kind=n===4?'quad':''}
  if(pc){main='ALL CLEAR';kind='pc'}
  const sub=[];
  if(n&&(n===4||spin)&&b.b2b>0)sub.push('B2B ×'+b.b2b);
  if(n&&b.combo>0)sub.push(b.combo+' COMBO');
  if(atk>0)sub.push('+'+atk);
  if(!main&&!(n&&b.combo>0))return;   // plain singles stay quiet
  showAction(main,sub.join('  ·  '),kind);
}
function showAction(main,sub,kind){
  const el=$('action');
  el.firstElementChild.textContent=main;el.lastElementChild.textContent=sub;
  el.className='';void el.offsetWidth;el.className='show '+(kind||'');
  actionTime=1.4;
}

