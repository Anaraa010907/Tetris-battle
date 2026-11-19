/* ---------- native bridge (the Android app; android/app/src/main/java/com/anaraa/khanblocks/NativeBridge.java) ----------
In the Android app, MainActivity adds a JavaScript interface named KhanNative with two methods:
  KhanNative.info()       the app's state now, as JSON: {v, platform, billing: 'connecting'|'ready'|'unavailable',
                          ads: {canRequest, privacyRequired, rewarded, interstitial, test}}
  KhanNative.post(json)   a request {id, op, args}; returns 'ok' at once, or an error code if the request is refused
The app answers each request later, and sends events, through ONE function: window.__khanNative(json), with
  {id, ok: true, data} | {id, ok: false, error} | {event: 'state'|'purchases', data}.
In a plain browser there is no KhanNative: Native.has() is false and nothing here does anything. Tests install a
fake KhanNative with the same two methods before the page loads (tests/game_test.py, group "store").
*/
const Native=(()=>{
  let seq=0;
  const waiting=new Map(),subs=new Set();
  const api=()=>{const k=window.KhanNative;return k&&typeof k.post==='function'?k:null};
  const fail=code=>Object.assign(new Error(String(code||'native_error')),{native:true});
  function receive(msg){
    let m=msg;
    if(typeof m==='string'){try{m=JSON.parse(m)}catch(e){return}}
    if(!m||typeof m!=='object')return;
    if(m.id!=null){
      const w=waiting.get(m.id);if(!w)return;
      waiting.delete(m.id);clearTimeout(w.timer);
      if(m.ok)w.res(m.data&&typeof m.data==='object'?m.data:{});else w.rej(fail(m.error));
    }else if(typeof m.event==='string'){
      for(const fn of subs){try{fn(m.event,m.data&&typeof m.data==='object'?m.data:{})}catch(e){}}
    }
  }
  window.__khanNative=receive;
  return {
    has:()=>!!api(),
    info(){try{const s=api()?.info?.();const v=s?JSON.parse(s):null;return v&&typeof v==='object'?v:null}catch(e){return null}},
    // ms: how long to wait for the answer (default 30 s); 0 = no limit (a purchase or an ad takes as long as the player)
    call(op,args,ms){
      const k=api();
      if(!k)return Promise.reject(fail('no_native'));
      return new Promise((res,rej)=>{
        const id=++seq,timer=ms===0?0:setTimeout(()=>{waiting.delete(id);rej(fail('timeout'))},ms||30000);
        waiting.set(id,{res,rej,timer});
        let r;
        try{r=k.post(JSON.stringify({id,op,args:args||{}}))}catch(e){r='post_failed'}
        if(r!=='ok'&&waiting.has(id)){waiting.delete(id);clearTimeout(timer);rej(fail(r||'post_failed'))}
      });
    },
    on(fn){subs.add(fn);return()=>subs.delete(fn)},
  };
})();
