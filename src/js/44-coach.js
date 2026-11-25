/* ---------- coach (admin only) ----------
   An admin can turn on a coach for practice games. It shows where to put the falling piece, and whether to
   hold first, for the most attack: T-spins, quads, combos, back-to-back and all clears. It searches every
   place the piece can really reach (slides, soft drops, rotations with SRS kicks, so tucks and T-spins
   count), then looks one piece ahead. It never shows in ranked, online or friend games.

   Admin sign-in: tap the Settings title 5 times. Only a hash of the name and code is stored here; the code
   itself is not in the repo. The admin flag lives in its own localStorage key, so it is never synced. */

const ADMIN_KEY='kb-admin',COACH_KEY='kb-coach';
const ADMIN_HASH='0a0cacf751efef2c7c308134419116d559e980dfd3203c56f331e0e653a10ec9';   // sha256('khan-coach-v1|'+name+'|'+code)
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){}}
const isAdmin=()=>lsGet(ADMIN_KEY)==='1';
const coachWanted=()=>isAdmin()&&lsGet(COACH_KEY)!=='0';
// practice games only: the coach would be an unfair helper against a person or in a rated game
const coachOn=()=>coachWanted()&&!!series&&series.mode==='practice'&&boards.length>0;

// Small SHA-256 (works without crypto.subtle, which a file:// WebView may not offer)
function sha256hex(str){
  const K=[],H0=[];let n=2,c=0;
  const frac=x=>(x-Math.floor(x))*4294967296|0;
  while(c<64){let p=true;for(let d=2;d*d<=n;d++)if(n%d===0){p=false;break}if(p){if(c<8)H0[c]=frac(Math.sqrt(n));K[c++]=frac(Math.cbrt(n))}n++}
  const b=Array.from(new TextEncoder().encode(str)),l=b.length*8;b.push(0x80);while(b.length%64!==56)b.push(0);
  for(let i=7;i>=0;i--)b.push(i>3?0:(l>>>(i*8))&255);
  const h=H0.slice(),w=new Array(64),ro=(x,k)=>x>>>k|x<<(32-k);
  for(let o=0;o<b.length;o+=64){
    for(let i=0;i<16;i++)w[i]=b[o+4*i]<<24|b[o+4*i+1]<<16|b[o+4*i+2]<<8|b[o+4*i+3];
    for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(ro(x,7)^ro(x,18)^x>>>3)+w[i-7]+(ro(y,17)^ro(y,19)^y>>>10)+w[i-16]|0}
    let [A,B,C,D,E,F,G,Hh]=h;
    for(let i=0;i<64;i++){
      const t1=Hh+(ro(E,6)^ro(E,11)^ro(E,25))+(E&F^~E&G)+K[i]+w[i]|0,t2=(ro(A,2)^ro(A,13)^ro(A,22))+(A&B^A&C^B&C)|0;
      Hh=G;G=F;F=E;E=D+t1|0;D=C;C=B;B=A;A=t1+t2|0;
    }
    h[0]=h[0]+A|0;h[1]=h[1]+B|0;h[2]=h[2]+C|0;h[3]=h[3]+D|0;h[4]=h[4]+E|0;h[5]=h[5]+F|0;h[6]=h[6]+G|0;h[7]=h[7]+Hh|0;
  }
  return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}
const adminFails={n:0,until:0};
function adminCheck(name,code){return sha256hex('khan-coach-v1|'+String(name).trim()+'|'+String(code).trim())===ADMIN_HASH}

/* ---------- search ---------- */
// One rotation from (r,x,y) with SRS kicks, as rotate() does it. dir: 1 cw, -1 ccw, 2 half turn.
function coachRotate(cells,id,r,x,y,dir){
  if(id===1)return null;
  const to=(r+dir+4)%4,m=ROT[id][to],key=r+'>'+to,tests=dir===2?K180[key]:(id===0?KI:KJ)[key],b={cells};
  for(let i=0;i<tests.length;i++){const nx=x+tests[i][0],ny=y-tests[i][1];if(!hit(b,m,nx,ny))return {r:to,x:nx,y:ny,k:i}}
  return null;
}
// spinType() for a resting piece: 0 none, 1 mini, 2 full
function coachSpin(cells,id,r,x,y,rot,kick){
  if(id!==2||!rot)return 0;
  const occ=(cx,cy)=>{const X=x+cx,Y=y+cy;return X<0||X>=W||Y>=H||(Y>=0&&!!cells[Y][X])};
  const c=[occ(0,0),occ(2,0),occ(2,2),occ(0,2)];
  if(c.filter(Boolean).length<3)return 0;
  const f=[[0,1],[1,2],[2,3],[3,0]][r];
  return (c[f[0]]&&c[f[1]])||kick===4?2:1;
}
// Every place a piece can lock from a start state, with the easiest key sequence to get there (fewest
// presses; a soft drop costs a little more than a tap, so slides and turns come first where they can).
// Moves: L/R slide, D soft drop to the floor, C/A rotate cw/ccw. Locking is a hard drop.
const COACH_COST={L:10,R:10,C:10,A:10,D:16};
function coachReach(cells,id,start){
  const b={cells},best=new Map(),buckets=[],finals=new Map(),done=new Set();
  const key=(r,x,y,rot)=>(((r*16+x+4)*40+y+8)*2+rot);
  const push=(s,cost,prev,mv)=>{
    const k=key(s.r,s.x,s.y,s.rot),old=best.get(k);
    if(old&&old.cost<=cost)return;
    best.set(k,{s,cost,prev,mv});(buckets[cost]||(buckets[cost]=[])).push(k);
  };
  if(hit(b,ROT[id][start.r],start.x,start.y))return [];
  push({r:start.r,x:start.x,y:start.y,rot:start.rot?1:0,k:start.k||0},0,-1,'');
  let visited=0;
  for(let cost=0;cost<buckets.length&&visited<6000;cost++){
    const list=buckets[cost];if(!list)continue;
    for(let i=0;i<list.length;i++){
      const k=list[i],e=best.get(k);
      if(e.cost!==cost||done.has(k))continue;
      done.add(k);visited++;
      const s=e.s,m=ROT[id][s.r];
      if(hit(b,m,s.x,s.y+1)){
        const spin=coachSpin(cells,id,s.r,s.x,s.y,s.rot,s.k),pos=[];
        for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c])pos.push((s.y+r)*W+s.x+c);
        const fk=pos.sort((a,b)=>a-b).join(',')+'|'+spin;
        if(!finals.has(fk))finals.set(fk,{id,r:s.r,x:s.x,y:s.y,spin,node:k});
      }
      // no half turns: phones have no 180 button (only a keyboard key), so the coach never asks for one
      for(const d of [1,-1]){const n=coachRotate(cells,id,s.r,s.x,s.y,d),mv=d===1?'C':'A';if(n)push({r:n.r,x:n.x,y:n.y,rot:1,k:n.k},cost+COACH_COST[mv],k,mv)}
      for(const dx of [-1,1])if(!hit(b,m,s.x+dx,s.y))push({r:s.r,x:s.x+dx,y:s.y,rot:0,k:0},cost+10,k,dx<0?'L':'R');
      if(!hit(b,m,s.x,s.y+1)){let y=s.y;while(!hit(b,m,s.x,y+1))y++;push({r:s.r,x:s.x,y,rot:0,k:0},cost+COACH_COST.D,k,'D')}
    }
  }
  const out=[];
  for(const f of finals.values()){
    const mv=[];for(let k=f.node;k>=0;){const e=best.get(k);if(e.mv)mv.unshift(e.mv);k=e.prev}
    f.moves=mv;delete f.node;out.push(f);
  }
  return out;
}
const spawnState=id=>{const m=ROT[id][0];return {r:0,x:id===1?4:3,y:-m.findIndex(r=>r.some(v=>v))||0,rot:0,k:0}};
// Lock a piece on a copy of the board the way lock() does: clears, combo, back-to-back, attack, garbage.
function coachLock(cells,f,st){
  const g=cells.map(r=>r.slice()),m=ROT[f.id][f.r];
  for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]){if(f.y+r<0)return null;g[f.y+r][f.x+c]=f.id+1}
  let n=0;
  for(let y=H-1;y>=0;y--)if(g[y].every(v=>v)){g.splice(y,1);g.unshift(emptyRow());n++;y++}
  const pc=n>0&&g.every(r=>r.every(v=>!v));
  let combo=st.combo,b2b=st.b2b;
  if(n>0){combo++;if(n===4||f.spin)b2b++;else b2b=-1}else combo=-1;
  const atk=attackFor(n,f.spin,b2b,combo,pc);
  const pend=st.garbage.map(x=>({rows:x.rows,hole:x.hole,delay:x.delay}));
  let rest=atk,dead=false;
  while(rest>0&&pend.length){const x=pend[0],k=Math.min(x.rows,rest);x.rows-=k;rest-=k;if(!x.rows)pend.shift()}
  if(n===0){
    let cap=GARBAGE_CAP;
    while(cap>0&&pend.length&&pend[0].delay<=0){
      const x=pend[0],k=Math.min(x.rows,cap);
      for(let i=0;i<k;i++){if(g[0].some(v=>v))dead=true;g.shift();const row=Array(W).fill(8);row[x.hole]=0;g.push(row)}
      x.rows-=k;cap-=k;if(!x.rows)pend.shift();
    }
  }
  return {g,n,atk,pc,spin:f.spin,combo,b2b,garbage:pend,dead,broke:st.b2b>=0&&n>0&&b2b<0};
}
// How good a stack looks: few holes, flat, not too high, one clean well kept open for quads, and a
// ready T-spin double slot. The well column is left out of the flatness count.
const COACH_W={hole:7,buried:1.5,bump:.8,agg:.05,high:3,danger:10,well:3.5,extraWell:2.5,tsd:16,atk:7,burn:6,comboEnd:1,quad:8,small:2.5,calmAt:13,calmSpan:6};
// 1 while the stack is low and calm (build for quads and T-spins), down to 0 when it is high or garbage is
// coming (then just clean up and survive). Set by coachPlan() for the board being planned.
let coachCalm=1;
function coachShape(g){
  const w=COACH_W,h=[];let holes=0,buried=0;
  for(let c=0;c<W;c++){
    let top=H;for(let r=0;r<H;r++)if(g[r][c]){top=r;break}
    h.push(H-top);let above=0;
    for(let r=top;r<H;r++){if(g[r][c])above++;else{holes++;buried+=Math.min(above,4)}}
  }
  let agg=0,maxH=0;for(let c=0;c<W;c++){agg+=h[c];maxH=Math.max(maxH,h[c])}
  // the deepest well (a column lower than both neighbours, walls count as high)
  let wc=-1,wd=0;
  for(let c=0;c<W;c++){const l=c?h[c-1]:99,r=c<W-1?h[c+1]:99,d=Math.min(l,r)-h[c];if(d>wd){wd=d;wc=c}}
  let bump=0;for(let c=0;c<W-1;c++)if(c!==wc&&c+1!==wc)bump+=Math.abs(h[c]-h[c+1]);
  let s=-w.hole*holes-w.buried*buried-w.bump*bump-w.agg*agg;
  if(maxH>10)s-=(maxH-10)*w.high;
  if(maxH>15)s-=(maxH-15)*w.danger;
  if(wc>=0&&wd>=2){if(maxH<14)s+=Math.min(wd,4)*w.well*coachCalm;else s-=(wd-2)*w.extraWell}
  if(coachCalm<1)s-=(1-coachCalm)*(agg*.15+maxH*1.5);               // under pressure: keep it low
  for(let c=0;c<W;c++){if(c===wc)continue;const l=c?h[c-1]:99,r=c<W-1?h[c+1]:99,d=Math.min(l,r)-h[c];if(d>=3)s-=(d-2)*w.extraWell}
  if(tsdSlot(g))s+=w.tsd*coachCalm;
  return s;
}
// A ready T-spin double: a T pointing down at x..x+2 would fill two otherwise full rows under a roof.
function tsdSlot(g){
  const gaps=row=>{let k=0;for(let c=0;c<W;c++)if(!row[c])k++;return k};
  for(let y=2;y<H;y++){
    const lo=g[y],mid=g[y-1],top=g[y-2];
    if(gaps(lo)!==1||gaps(mid)!==3)continue;
    for(let x=0;x<=W-3;x++){
      if(lo[x+1]||!lo[x]||!lo[x+2]||mid[x]||mid[x+1]||mid[x+2]||top[x+1])continue;
      if(!!top[x]!==!!top[x+2])return true;                         // a roof on exactly one side
    }
  }
  return false;
}
// What a lock is worth by itself: attack first, then keeping back-to-back and combos going.
function coachValue(e,st,shapeAfter){
  if(!e||e.dead)return -1e6;
  const w=COACH_W;let v=w.atk*e.atk;
  if(e.pc)v+=40;
  if(e.spin===2&&e.n>=2)v+=4;
  const k=coachCalm;
  if(e.n===4)v+=w.quad*k;
  if(e.n>=2&&e.n<4&&!e.spin&&!e.pc)v-=w.small*e.n*k;                 // doubles and triples spend lines a quad or T-spin would use better
  if(e.broke)v-=(4+1.5*st.b2b)*k;
  if(e.n>0&&e.atk===0&&shapeAfter>-40)v-=w.burn*e.n*k;              // lines burnt for nothing while the stack is healthy
  if(st.combo>=0&&e.n===0)v-=w.comboEnd*(1+st.combo);              // a combo ends
  return v;
}
// The best plan for board b: {id, r, x, y, spin, hold, moves, n, atk, label}. Null when nothing fits.
function coachPlan(b){
  const p=b.piece;if(!p)return null;
  const st={combo:b.combo,b2b:b.b2b,garbage:b.garbage};
  let top=b.cells.findIndex(r=>r.some(v=>v));if(top<0)top=H;
  const danger=H-top+pendingRows(b,false);
  coachCalm=Math.max(0,Math.min(1,(COACH_W.calmAt-danger)/COACH_W.calmSpan));
  const options=[{id:p.id,start:{r:p.r,x:p.x,y:p.y,rot:b.lastRot?1:0,k:b.lastKick||0},hold:false,next:b.queue[0]}];
  if(b.canHold){
    const hid=b.hold>=0?b.hold:b.queue[0];
    if(hid!==p.id)options.push({id:hid,start:spawnState(hid),hold:true,next:b.hold>=0?b.queue[0]:b.queue[1]});
  }
  const cands=[];
  for(const o of options)for(const f of coachReach(b.cells,o.id,o.start)){
    const e=coachLock(b.cells,f,st);if(!e)continue;
    const shape=coachShape(e.g),v=coachValue(e,st,shape)-(o.hold?.5:0);
    cands.push({f,e,o,v,shape,quick:v+shape});
  }
  if(!cands.length)return null;
  cands.sort((a,b)=>b.quick-a.quick);
  let best=null;
  for(const c of cands.slice(0,6)){
    let total=c.quick;
    if(c.o.next!==undefined&&!c.e.dead){
      const st2={combo:c.e.combo,b2b:c.e.b2b,garbage:c.e.garbage};let b2=-1e9;
      // the next piece: every reachable place for a T (T-spins need the full search), plain drops for the rest
      const nx=c.o.next,list=nx===2?coachReach(c.e.g,nx,spawnState(nx)):[];
      if(nx!==2)placements(c.e.g,nx,spawnState(nx).y,(m,r,x,y)=>list.push({id:nx,r,x,y,spin:0}));
      for(const f2 of list){
        const e2=coachLock(c.e.g,f2,st2);if(!e2)continue;
        const sh2=coachShape(e2.g);b2=Math.max(b2,coachValue(e2,st2,sh2)+sh2);
      }
      if(b2>-1e9)total=c.v+.9*b2;
    }
    if(!best||total>best.total)best={...c,total};
  }
  const {f,e,o}=best;
  return {id:f.id,r:f.r,x:f.x,y:f.y,spin:f.spin,hold:o.hold,moves:f.moves,n:e.n,atk:e.atk,pc:e.pc,b2b:e.b2b,combo:e.combo,label:coachLabel(e)};
}
function coachLabel(e){
  const names=['','SINGLE','DOUBLE','TRIPLE','QUAD'];
  let main='';
  if(e.pc)main='ALL CLEAR';
  else if(e.spin)main=(e.spin===1?'T-SPIN MINI':'T-SPIN')+(e.n?' '+names[e.n]:'');
  else if(e.n)main=names[e.n];
  if(e.n&&e.combo>0)main+=(main?' · ':'')+e.combo+' COMBO';
  if(e.atk>0)main+=' +'+e.atk;
  return main;
}
// Keys as the on-screen buttons show them: ← → slide, ↓ soft drop, ↻ ↺ rotate, ⤓ hard drop
function coachKeys(plan){
  const sym={L:'←',R:'→',D:'↓',C:'↻',A:'↺'},mv=plan.moves.slice();
  if(mv[mv.length-1]==='D')mv.pop();                                // the last drop is the hard drop itself
  const out=[];
  for(const m of mv){const last=out[out.length-1];if(last&&last.m===m)last.k++;else out.push({m,k:1})}
  return (plan.hold?[t('holdLabel')]:[]).concat(out.map(o=>sym[o.m]+(o.k>1?'×'+o.k:'')),'⤓').join(' ');
}

/* ---------- live plan for the player's board ---------- */
let coachCache={key:'',plan:null,tip:''};
function coachKey(b){
  const p=b.piece;
  return b.cells.map(r=>r.join('')).join('')+'|'+p.id+'|'+b.hold+'|'+b.canHold+'|'+b.queue[0]+b.queue[1]+'|'+b.combo+'|'+b.b2b+'|'+pendingRows(b,false)+'|'+pendingRows(b,true);
}
// The plan for the current piece, kept until the board or the piece changes; replanned from where the
// piece is now if the player has moved it somewhere the old plan can no longer reach.
function coachCurrent(){
  if(!coachOn()||state!=='play')return null;
  const b=boards[0],p=b.piece;if(!p||b.dead)return null;
  const key=coachKey(b);
  let plan=coachCache.key===key?coachCache.plan:null;
  if(plan&&!plan.hold){
    const here=p.r+','+p.x+','+p.y;
    if(coachCache.at!==here){
      coachCache.at=here;
      const ok=coachReach(b.cells,p.id,{r:p.r,x:p.x,y:p.y,rot:b.lastRot?1:0,k:b.lastKick||0}).find(f=>f.r===plan.r&&f.x===plan.x&&f.y===plan.y&&f.spin===plan.spin);
      if(ok)plan.moves=ok.moves;else plan=null;
    }
  }
  if(!plan){plan=coachPlan(b);coachCache={key,plan,at:p.r+','+p.x+','+p.y}}
  return plan;
}
// Called from render(): the tip above the board and the hold button hint
function coachFrame(plan){
  const tip=$('coachTip');
  if(!plan){if(!tip.hidden)tip.hidden=true;$('holdBtn').classList.remove('coach-hold');return}
  const html='<b>'+esc(t('coachBadge'))+'</b> '+esc(plan.label||t('coachPlace'))+'<span>'+esc(coachKeys(plan))+'</span>';
  if(coachCache.tip!==html){coachCache.tip=html;tip.innerHTML=html}
  if(tip.hidden)tip.hidden=false;
  $('holdBtn').classList.toggle('coach-hold',!!plan.hold);
}
// Drawn by drawBoard(): the target cells, outlined (dashed when the plan holds first)
function coachDraw(c,s,plan){
  const m=ROT[plan.id][plan.r],cells=new Set();
  for(let r=0;r<m.length;r++)for(let x=0;x<m[r].length;x++)if(m[r][x]&&plan.y+r>=0)cells.add((plan.y+r)*W+plan.x+x);
  c.save();
  c.fillStyle=plan.hold?'rgba(94,230,255,.16)':'rgba(255,209,102,.20)';
  for(const i of cells)c.fillRect(i%W*s,(i/W|0)*s,s,s);
  c.beginPath();
  for(const i of cells){
    const x=i%W*s,y=(i/W|0)*s,cx=i%W;
    if(!cells.has(i-W)){c.moveTo(x,y);c.lineTo(x+s,y)}
    if(!cells.has(i+W)){c.moveTo(x,y+s);c.lineTo(x+s,y+s)}
    if(cx===0||!cells.has(i-1)){c.moveTo(x,y);c.lineTo(x,y+s)}
    if(cx===W-1||!cells.has(i+1)){c.moveTo(x+s,y);c.lineTo(x+s,y+s)}
  }
  c.lineCap='round';c.setLineDash(plan.hold?[5,4]:[]);
  c.strokeStyle='#050a18';c.lineWidth=5;c.stroke();                   // dark halo keeps it readable on any skin
  c.strokeStyle=plan.hold?'#5ee6ff':'#ffd166';c.lineWidth=2.5;c.shadowColor=c.strokeStyle;c.shadowBlur=8;c.stroke();
  c.restore();
}

/* ---------- admin sign-in and settings ---------- */
// settings() calls this: 5 taps on the title open the sign-in; an admin gets the coach switch.
function adminSettings(back){
  const h=$('modal').querySelector('h2');
  if(h){const taps=[];h.addEventListener('click',()=>{const now=Date.now();taps.push(now);while(taps.length&&now-taps[0]>3000)taps.shift();if(taps.length>=5&&!isAdmin())adminLogin(back)})}
  if(!isAdmin()||!$('privacy'))return;
  const txt=()=>t('coachSet')+': '+t(coachWanted()?'on':'off');
  $('privacy').insertAdjacentHTML('beforebegin','<button id="coachBtn" class="coachset">'+esc(txt())+'</button><button id="adminOut">'+esc(t('adminLeave'))+'</button>');
  $('coachBtn').onclick=()=>{lsSet(COACH_KEY,coachWanted()?'0':'1');$('coachBtn').textContent=txt()};
  $('adminOut').onclick=()=>{lsSet(ADMIN_KEY,null);lsSet(COACH_KEY,null);back()};
}
function adminLogin(back){
  modal('<h2>'+esc(t('adminTitle'))+'</h2><div class="stack"><label>'+esc(t('adminName'))+'<input id="adminName" maxlength="32" autocomplete="off" autocapitalize="off" spellcheck="false"></label>'
    +'<label>'+esc(t('adminCode'))+'<input id="adminCode" type="password" maxlength="64" autocomplete="off"></label>'
    +'<button id="adminGo" class="primary">'+esc(t('adminEnter'))+'</button><button id="adminBack">'+esc(t('cancel'))+'</button></div><p class="muted" id="adminMsg">'+esc(t('coachNote'))+'</p>');
  $('adminBack').onclick=back;
  const go=()=>{
    const now=Date.now();
    if(now<adminFails.until){$('adminMsg').textContent=t('adminWait');return}
    if(adminCheck($('adminName').value,$('adminCode').value)){
      adminFails.n=0;lsSet(ADMIN_KEY,'1');lsSet(COACH_KEY,'1');msgBox(t('adminWelcome'),back);
    }else{
      if(++adminFails.n>=5){adminFails.n=0;adminFails.until=now+60000}
      $('adminMsg').textContent=t('adminWrong');$('adminCode').value='';
    }
  };
  $('adminGo').onclick=go;
  $('adminCode').addEventListener('keydown',e=>{if(e.key==='Enter')go()});
}
