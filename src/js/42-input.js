/* ---------- input ---------- */
function action(a){
  if(state!=='play')return;
  log.push({tick,type:'input',action:a});
  const b=boards[0];
  if(a==='left')move(b,-1,0);
  if(a==='right')move(b,1,0);
  if(a==='rotate')rotate(b,1);
  if(a==='ccw')rotate(b,-1);
  if(a==='r180')rotate(b,2);
  if(a==='soft')for(let i=0;i<param('softCells');i++)if(!move(b,0,1))break;
  if(a==='down1')move(b,0,1);
  if(a==='hard')hard(b);
  if(a==='hold'&&b.canHold){
    const cur=b.piece.id;
    if(b.hold<0)spawn(b);else place(b,b.hold);
    b.hold=cur;b.canHold=false;sound('lock');
    if(b.dead)finishRound(b);
    else if(isOnline())Net.sendState();
  }
  if(a.startsWith('power')&&powersOn()){
    const idx=+a.slice(-1)-1;
    if(idx<powers.length){
      const power=powers.splice(idx,1)[0];
      if(power===0)boards[1].slow=param('slowSeconds');
      if(power===1)b.shield=true;
      if(power===2){b.cells.pop();b.cells.unshift(emptyRow());while(b.piece.y>-4&&hit(b,b.piece.m,b.piece.x,b.piece.y))b.piece.y--}
      showAction('',t(['slow','shield','clear'][power]));sound('clear');
    }
  }
}

