/* ---------- cloud (Supabase) ---------- */
// Fill the neon-config block (or the SUPABASE_URL / SUPABASE_ANON_KEY secrets for the APK build) to go online.
// Without it the game stays fully offline. Server side: supabase/migrations, setup: docs/SUPABASE.md.
const CFG=(()=>{try{return JSON.parse($('neon-config').textContent)||{}}catch(e){return {}}})();
const Cloud={
  url:String(CFG.supabaseUrl||'').replace(/\/+$/,''),key:String(CFG.supabaseAnonKey||''),
  state:'off',session:null,              // state: off | connecting | online | offline
  on(){return !!(this.url&&this.key)},
  ready(){return this.state==='online'&&!!this.session},
  async req(path,{method='GET',body,auth=true}={}){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
    try{
      const r=await fetch(this.url+path,{method,signal:ctl.signal,body:body===undefined?undefined:JSON.stringify(body),
        headers:{apikey:this.key,'Content-Type':'application/json',Authorization:'Bearer '+(auth&&this.session?this.session.access_token:this.key)}});
      const txt=await r.text();let data=null;try{data=txt?JSON.parse(txt):null}catch(e){data=txt}
      if(!r.ok)throw Object.assign(new Error((data&&(data.message||data.msg||data.error_description||data.error))||'http_'+r.status),{status:r.status});
      return data;
    }catch(e){if(!e.status)throw Object.assign(new Error('network'),{status:0});throw e}
    finally{clearTimeout(timer)}
  },
  setSession(s){
    if(!s||!s.access_token)throw Object.assign(new Error('no_session'),{status:500});
    this.session={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600),
      user:{id:s.user?.id||'',email:s.user?.email||'',anon:!!s.user?.is_anonymous}};
    try{localStorage.setItem('neon-duel-session',JSON.stringify(this.session))}catch(e){}
  },
  clearSession(){this.session=null;try{localStorage.removeItem('neon-duel-session')}catch(e){}},
  async ensure(){
    if(this.session&&this.session.expires_at-60>Date.now()/1000)return;
    if(this.session?.refresh_token){
      try{this.setSession(await this.req('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this.session.refresh_token},auth:false}));return}
      catch(e){if(!e.status)throw e;this.clearSession()}
    }
    // first launch: a guest account, upgraded later with email + password
    this.setSession(await this.req('/auth/v1/signup',{method:'POST',body:{data:{username:profile.name}},auth:false}));
  },
  async rpc(name,args){await this.ensure();return this.req('/rest/v1/rpc/'+name,{method:'POST',body:args||{}})},
  async signIn(email,password){this.setSession(await this.req('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},auth:false}))},
  async link(email,password){
    await this.ensure();
    const u=await this.req('/auth/v1/user',{method:'PUT',body:{email,password}});
    if(u&&u.email){this.session.user.email=u.email;this.session.user.anon=false;try{localStorage.setItem('neon-duel-session',JSON.stringify(this.session))}catch(e){}}
    return !!(u&&u.email);                // false: waiting for the confirmation email
  },
  async signOut(){try{await this.req('/auth/v1/logout',{method:'POST'})}catch(e){}this.clearSession()},
};
try{Cloud.session=JSON.parse(localStorage.getItem('neon-duel-session')||'null')}catch(e){}
function netView(){
  const el=$('headStatus');if(!el)return;
  el.textContent=Cloud.state==='connecting'?t('syncing'):Cloud.state==='online'?t('online'):t('offline');
  el.classList.toggle('on',Cloud.state==='online');
}
// The server is the source of truth for rating, record, coins and themes whenever it is reachable.
function applyServer(p){
  if(!p||!p.id)return;
  Object.assign(profile,{rank:p.rating,wins:p.wins,losses:p.losses,coins:p.coins,streak:p.streak,name:p.username,
    cloudClaim:p.last_claim||'',cloudId:p.id,owned:[0,...new Set((p.owned||[]).filter(v=>v===1||v===2))]});
  if(AVATARS.includes(p.avatar))profile.avatar=p.avatar;
  if(profile.owned.includes(p.theme))profile.theme=p.theme;
  save();profileView();
}
// Results wait here until the server accepts them, so offline games still count later.
let outbox=[];try{outbox=JSON.parse(localStorage.getItem('neon-duel-outbox')||'[]').slice(-20)}catch(e){}
function saveOutbox(){try{localStorage.setItem('neon-duel-outbox',JSON.stringify(outbox.slice(-20)))}catch(e){}}
async function flushOutbox(){
  while(outbox.length&&Cloud.ready()){
    try{applyServer(await Cloud.rpc('report_match',outbox[0]));outbox.shift();saveOutbox()}
    catch(e){
      if(!e.status){Cloud.state='offline';netView();return}
      if(e.message==='too_fast'){setTimeout(()=>flushOutbox(),11000);return}
      outbox.shift();saveOutbox();         // rejected by the server: drop it
    }
  }
}
let syncing=null;
function sync(force){
  if(!Cloud.on())return Promise.resolve();
  if(syncing&&!force)return syncing;
  Cloud.state='connecting';netView();
  return syncing=(async()=>{
    try{
      await Cloud.ensure();
      let p=await Cloud.rpc('get_my_profile');
      // first time on this phone: bring offline progress into the fresh account (the server caps it)
      if(!profile.cloudId&&!p.imported&&p.wins+p.losses===0&&(profile.wins+profile.losses>0||profile.coins>0))
      {
        const name=profile.name,avatar=profile.avatar;
        p=await Cloud.rpc('import_local',{p_rating:profile.rank,p_wins:profile.wins,p_losses:profile.losses,p_coins:profile.coins,p_owned:profile.owned});
        if(name!==p.username&&name.length>=3)p=await Cloud.rpc('set_profile',{p_username:name,p_avatar:avatar,p_theme:null}).catch(()=>p);
      }
      Cloud.state='online';applyServer(p);await flushOutbox();
    }catch(e){Cloud.state='offline'}
    finally{syncing=null;netView()}
  })();
}
function errText(e){
  const m=e&&e.message;
  return t({username_taken:'errNameTaken',not_enough_coins:'notEnough',already_claimed:'claimed',network:'errNetwork',
    'Invalid login credentials':'accBadCloud',bad_profile:'accBad'}[m]||'errGeneric');
}
function msgBox(text,back){modal('<p>'+esc(text)+'</p><button class="wide" id="msgOk">'+t('done')+'</button>');$('msgOk').onclick=back||closeModal}

