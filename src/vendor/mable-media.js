
(()=>{
const ids=new Set(["duel_music"]),prefix='data:audio/wav;mable-deferred=',marker=/mable-deferred:([A-Za-z0-9_-]{1,64})/,blockPrefix='mable-deferred-';
let parsed=document.readyState!=='loading';
const ready=new Promise(resolve=>parsed?resolve():document.addEventListener('DOMContentLoaded',()=>resolve(),{once:true}));
const idOf=url=>{if(typeof url!=='string'||!url.startsWith(prefix))return null;const id=url.slice(prefix.length).split(';')[0];return ids.has(id)?id:null};
const real=value=>{const block=document.getElementById(blockPrefix+idOf(value));return block&&block.textContent.trim()||value};
const M=HTMLMediaElement.prototype,S=HTMLSourceElement.prototype,E=Element.prototype,own=(proto,name)=>Object.getOwnPropertyDescriptor(proto,name);
const mediaSrc=own(M,'src'),sourceSrc=own(S,'src'),pausedProperty=own(M,'paused'),nativePlay=M.play,nativePause=M.pause,nativeLoad=M.load,getAttribute=E.getAttribute,setAttribute=E.setAttribute,removeAttribute=E.removeAttribute,hasAttribute=E.hasAttribute;
const written=new WeakMap(),waiting=new Map(),waitingSources=new Set();
const hold=media=>{let state=waiting.get(media);if(!state){state={play:false,promises:[]};waiting.set(media,state)}return state};
const settle=(state,error)=>{for(const [resolve,reject] of state.promises)error?reject(error):resolve();state.promises=[]};
const abort=(state,why)=>settle(state,new DOMException(why,'AbortError'));
const setMedia=(element,value)=>{const state=waiting.get(element);if(state){waiting.delete(element);abort(state,'The play() request was interrupted by a new load request.')}if(!idOf(value)){written.delete(element);mediaSrc.set.call(element,value);return}written.set(element,value);if(parsed){mediaSrc.set.call(element,real(value));return}if(hasAttribute.call(element,'src')){removeAttribute.call(element,'src');nativeLoad.call(element)}hold(element)};
const setSource=(element,value)=>{if(!idOf(value)){written.delete(element);waitingSources.delete(element);sourceSrc.set.call(element,value);return}written.set(element,value);if(parsed){sourceSrc.set.call(element,real(value));return}removeAttribute.call(element,'src');waitingSources.add(element);if(element.parentElement instanceof HTMLMediaElement)hold(element.parentElement)};
const assign=(element,value)=>element instanceof HTMLMediaElement?setMedia(element,value):setSource(element,value);
const managed=element=>element instanceof HTMLMediaElement||element instanceof HTMLSourceElement;
Object.defineProperty(M,'src',{configurable:true,enumerable:mediaSrc.enumerable,get(){return written.has(this)?written.get(this):mediaSrc.get.call(this)},set(value){setMedia(this,String(value))}});
Object.defineProperty(S,'src',{configurable:true,enumerable:sourceSrc.enumerable,get(){return written.has(this)?written.get(this):sourceSrc.get.call(this)},set(value){setSource(this,String(value))}});
Object.defineProperty(M,'paused',{configurable:true,enumerable:pausedProperty.enumerable,get(){const state=waiting.get(this);return state?!state.play:pausedProperty.get.call(this)}});
E.getAttribute=function(name){return managed(this)&&written.has(this)&&String(name).toLowerCase()==='src'?written.get(this):getAttribute.call(this,name)};
E.setAttribute=function(name,value){if(managed(this)&&String(name).toLowerCase()==='src')return assign(this,String(value));return setAttribute.call(this,name,value)};
const adoptNow=element=>{const value=getAttribute.call(element,'src');if(idOf(value)&&!written.has(element))setMedia(element,value)};
M.play=function(){adoptNow(this);let state=waiting.get(this);if(!state&&!parsed&&[...this.children].some(child=>waitingSources.has(child)))state=hold(this);if(!state)return nativePlay.call(this);state.play=true;const promise=new Promise((resolve,reject)=>state.promises.push([resolve,reject]));promise.catch(()=>{});return promise};
M.pause=function(){const state=waiting.get(this);if(!state)return nativePause.call(this);state.play=false;abort(state,'The play() request was interrupted by a call to pause().')};
M.load=function(){adoptNow(this);if(!waiting.has(this))return nativeLoad.call(this)};
if(window.Audio){const Native=window.Audio,Wrapped=function(...args){const element=Reflect.construct(Native,[],new.target||Wrapped);if(args.length&&args[0]!==undefined)setMedia(element,String(args[0]));return element};Wrapped.prototype=Native.prototype;Object.setPrototypeOf(Wrapped,Native);window.Audio=Wrapped}
const copyWritten=(from,to)=>{if(written.has(from))assign(to,written.get(from))};
const cloneNode=Node.prototype.cloneNode;Node.prototype.cloneNode=function(...args){const copy=cloneNode.apply(this,args);if(managed(this))copyWritten(this,copy);if(args[0]&&this.querySelectorAll){const from=this.querySelectorAll('audio,video,source'),to=copy.querySelectorAll('audio,video,source');from.forEach((element,index)=>to[index]&&copyWritten(element,to[index]))}return copy};
const adopt=node=>{if(!(node instanceof Element))return;const elements=managed(node)?[node]:node.firstElementChild?node.querySelectorAll('audio,video,source'):[];for(const element of elements){const value=getAttribute.call(element,'src');if(idOf(value))assign(element,value);else if(waitingSources.has(element)&&element.parentElement instanceof HTMLMediaElement)hold(element.parentElement)}};
new MutationObserver(records=>{for(const record of records)record.addedNodes.forEach(adopt)}).observe(document.documentElement,{childList:true,subtree:true});
const swap=()=>{parsed=true;for(const element of waitingSources)sourceSrc.set.call(element,real(written.get(element)));waitingSources.clear();for(const [element,state] of waiting){waiting.delete(element);if(written.has(element))mediaSrc.set.call(element,real(written.get(element)));else nativeLoad.call(element);if(state.play)nativePlay.call(element).then(()=>settle(state),error=>settle(state,error))}};
if(parsed)swap();else document.addEventListener('DOMContentLoaded',swap,{once:true});
const bytesOf=url=>{const binary=atob(url.slice(url.indexOf(',')+1)),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes.buffer};
const markerOf=buffer=>{if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>128)return null;const match=marker.exec(String.fromCharCode(...new Uint8Array(buffer)));return match&&ids.has(match[1])?match[1]:null};
for(const Context of new Set([window.BaseAudioContext,window.AudioContext,window.webkitAudioContext,window.OfflineAudioContext])){if(!Context||!Object.prototype.hasOwnProperty.call(Context.prototype,'decodeAudioData'))continue;const decode=Context.prototype.decodeAudioData;Context.prototype.decodeAudioData=function(buffer,onSuccess,onError){const id=markerOf(buffer);if(!id)return decode.call(this,buffer,onSuccess,onError);const context=this;return ready.then(()=>new Promise((resolve,reject)=>{const native=decode.call(context,bytesOf(real(prefix+id+';')),decoded=>{resolve(decoded);if(onSuccess)onSuccess(decoded)},error=>{reject(error);if(onError)onError(error)});if(native&&native.then)native.then(resolve,reject)}))}}
})();
