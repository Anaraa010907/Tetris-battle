/* ---------- control settings (Settings → Controls, also from the pause menu) ---------- */
// Changes apply at once and are saved in the profile (profile.ctl, checked by ctlClean in 10-profile).
const SENS={low:1.3,normal:1,high:.75};          // finger travel per cell × this
function applyControls(){
  const c=profile.ctl,k=SENS[c.sens]||1,el=$('controls');
  G.step=26*k;G.row=28*k;
  el.hidden=!c.buttons;
  el.classList.toggle('mirror',c.mirror);
  el.classList.toggle('big',c.size==='large');
  $('hint').dataset.t=c.flick?'hint':'hintNoFlick';
  $('hint').textContent=t($('hint').dataset.t);
}
function controlsDialog(back){
  const c=profile.ctl,on=v=>t(v?'on':'off');
  const seg=(key,opts)=>'<div class="seg cseg" role="radiogroup" data-key="'+key+'">'+opts.map(([v,l])=>{const sel=v===c[key];
    return '<button role="radio" data-v="'+v+'" aria-checked="'+sel+'"'+(sel?' class="on"':'')+'>'+l+'</button>'}).join('')+'</div>';
  const range=(key,min,max,step)=>'<label class="crange"><span><b>'+t(key)+'</b><i id="'+key+'Val"></i></span>'
    +'<input type="range" id="'+key+'In" min="'+min+'" max="'+max+'" step="'+step+'" value="'+c[key]+'"></label><p class="muted small">'+t(key+'Note')+'</p>';
  const tog=(key,label,txt)=>'<button class="ctog" data-tog="'+key+'"><span>'+t(label)+'</span><b>'+txt+'</b></button>';
  const top=$('modal').hidden?0:$('modal').scrollTop;
  modal('<span class="eyebrow">'+t('settings')+'</span><h2>'+t('controls')+'</h2><div class="ctl">'
    +'<span class="eyebrow">'+t('ctlKeys')+'</span>'+range('das',50,300,10)+range('arr',0,100,5)
    +'<div class="crow"><b>'+t('sdf')+'</b></div>'+seg('sdf',[[5,'×5'],[10,'×10'],[20,'×20'],[0,t('instant')]])+'<p class="muted small">'+t('sdfNote')+'</p>'
    +'<span class="eyebrow">'+t('ctlTouch')+'</span><div class="crow"><b>'+t('sens')+'</b></div>'
    +seg('sens',[['low',t('sensLow')],['normal',t('sensNormal')],['high',t('sensHigh')]])+'<p class="muted small">'+t('sensNote')+'</p>'
    +tog('flick','flickSet',on(c.flick))
    +'<span class="eyebrow">'+t('ctlLayout')+'</span>'+tog('buttons','btnShow',t(c.buttons?'shown':'hiddenWord'))+tog('mirror','leftHand',on(c.mirror))
    +'<div class="crow"><b>'+t('btnSize')+'</b></div>'+seg('size',[['normal',t('sizeNormal')],['large',t('sizeLarge')]])
    +'<p class="muted small">'+t('keysNote')+'</p>'
    +'<div class="row"><button style="flex:1" id="ctlReset">'+t('ctlReset')+'</button><button class="primary" style="flex:1" id="ctlDone">'+t('done')+'</button></div></div>');
  $('modal').scrollTop=top;
  const set=(key,v)=>{profile.ctl=ctlClean(Object.assign({},profile.ctl,{[key]:v}));save();applyControls()};
  const label=()=>{$('dasVal').textContent=profile.ctl.das+' ms';$('arrVal').textContent=profile.ctl.arr?profile.ctl.arr+' ms':'0 · '+t('instant')};
  for(const key of ['das','arr'])$(key+'In').oninput=e=>{set(key,+e.target.value);label()};
  label();
  document.querySelectorAll('.cseg button').forEach(b=>b.onclick=()=>{
    const key=b.parentNode.dataset.key,v=b.dataset.v;
    set(key,key==='sdf'?+v:v);controlsDialog(back);
  });
  document.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>{set(b.dataset.tog,!profile.ctl[b.dataset.tog]);controlsDialog(back)});
  $('ctlReset').onclick=()=>{profile.ctl=ctlClean();save();applyControls();controlsDialog(back)};
  $('ctlDone').onclick=back||closeModal;
}
applyControls();
