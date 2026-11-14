
(()=>{
if(window.parent===window)return;
const blockPrefix='mable-deferred-',later=new Set(['domcontentloaded','load','readystatechange']);
let queued=false;
for(const target of [window,document]){const add=target.addEventListener;target.addEventListener=function(type,...rest){if(later.has(String(type).toLowerCase()))queued=true;return add.call(this,type,...rest)}}
const waiting=()=>queued||window.onload||document.onreadystatechange||(document.body&&document.body.hasAttribute('onload'))||document.querySelector('script[type=module]');
const reached=()=>{if(document.readyState!=='loading')return true;const scripts=document.scripts,last=scripts[scripts.length-1];return Boolean(last&&last.type==='application/octet-stream'&&last.id.startsWith(blockPrefix))&&!waiting()};
const send=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>parent.postMessage({type:'game-visible'},'*')));
const poll=()=>{if(reached())return send();if(document.readyState==='loading')return setTimeout(poll,50);send()};
poll();
})();
