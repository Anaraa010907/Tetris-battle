/* ---------- loop ---------- */
function step(dt){
  if(state!=='play')return;
  tick++;
  if(heldAction){holdTime+=dt;if(holdTime>=holdNext){action(heldAction);holdNext+=.085}}
  if(actionTime>0)actionTime-=dt;
  for(const v of boards){v.time+=dt;v.slow=Math.max(0,v.slow-dt);for(const g of v.garbage)g.delay-=dt}
  const b=boards[0];
  // gravity starts gentle and speeds up every 20 seconds
  const fall=Math.max(param('minFall'),param('fallSeconds')*Math.pow(.92,Math.floor(b.time/20)));
  b.fall+=dt;
  if(b.fall>=fall){b.fall-=fall;if(!hit(b,b.piece.m,b.piece.x,b.piece.y+1))move(b,0,1)}
  if(hit(b,b.piece.m,b.piece.x,b.piece.y+1)){b.grounded+=dt;if(b.grounded>=LOCK_DELAY)lock(b)}
  else b.grounded=0;
  if(state!=='play')return;
  if(!isOnline()){aiClock+=dt;if(aiClock>=aiInterval()){aiClock=0;aiMove()}}
  flashTime=Math.max(0,flashTime-dt);
}
let raf;
function frame(now){
  const dt=Math.min((now-last)/1000,.1);last=now;acc+=dt;
  while(acc>=1/60){step(1/60);acc-=1/60}
  render();raf=requestAnimationFrame(frame);
}
function unlockAudio(){audio.setMuted(!profile.sound);if(state==='play')audio.startMusic();else audio.stopMusic()}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(raf);if(state==='play'&&!isOnline())pause()}
  else{
    last=performance.now();raf=requestAnimationFrame(frame);
    if(isOnline())Net.ping();                  // the match may have been decided while the app was away
    else if(Cloud.on()&&state==='title'&&Cloud.state!=='connecting')sync();
  }
});

