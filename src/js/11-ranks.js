/* ---------- daily reward ---------- */
function dayKey(off){const d=new Date();d.setDate(d.getDate()+(off||0));return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
// Online, the server decides the day (Ulaanbaatar time); offline, the phone does.
function ubDay(off){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ulaanbaatar'}).format(new Date(Date.now()+(off||0)*864e5))}catch(e){return ''}}
function canClaim(){return Cloud.ready()?profile.cloudClaim!==ubDay(0):profile.lastClaim!==dayKey(0)}
function nextStreak(){return (Cloud.ready()?profile.cloudClaim===ubDay(-1):profile.lastClaim===dayKey(-1))?(profile.streak||0)+1:1}
function bonusFor(){return Math.min(7,nextStreak())*10}
async function claimDaily(){
  if(!canClaim())return 0;
  if(Cloud.ready()){applyServer(await Cloud.rpc('claim_daily'));return 1}
  const bonus=bonusFor();profile.streak=nextStreak();profile.lastClaim=dayKey(0);profile.coins+=bonus;save();profileView();return bonus;
}

/* ---------- rank letters (TETR.IO style) ---------- */
const RANKS=[['D',0,'#9a8aa0'],['D+',650,'#a070a8'],['C-',725,'#9058b0'],['C',800,'#8648c0'],['C+',875,'#7450d8'],
  ['B-',950,'#5f66e0'],['B',1025,'#4f82e8'],['B+',1100,'#3fa6e0'],['A-',1175,'#3cc08a'],['A',1250,'#32cc5c'],['A+',1325,'#6cd84a'],
  ['S-',1400,'#d6bd3a'],['S',1500,'#efbd22'],['S+',1600,'#f7cc1c'],['SS',1700,'#f7a12c'],['U',1850,'#ff6a3d'],['X',2000,'#ff5ae0']];
const PLACEMENT=5;
function rankOf(r){let x=RANKS[0];for(const k of RANKS)if(r>=k[1])x=k;return x}
function placed(){return profile.wins+profile.losses>=PLACEMENT}
function rankLetter(){return placed()?rankOf(profile.rank)[0]:'?'}
// Titles (цол) after Mongolian wrestling ranks; each spans one or more letter ranks.
const TITLES=[['tRookie',0,'#8f9bb0'],['tNachin',725,'#c98a55'],['tKhartsaga',950,'#a9c1de'],['tZaan',1175,'#f0c64c'],
  ['tGarid',1400,'#3fd6e6'],['tArslan',1700,'#6a95ff'],['tAvarga',1850,'#b978ff'],['tDayan',2000,'#ff5ac8']];
function titleIdx(r){let i=0;TITLES.forEach((x,k)=>{if(r>=x[1])i=k});return i}
function titleName(r){return t(TITLES[titleIdx(r)][0])}
function titleColor(r){return TITLES[titleIdx(r)][2]}
function badge(letter,color,size){
  return '<svg class="rbadge" width="'+size+'" height="'+size+'" viewBox="0 0 40 40" aria-hidden="true" style="--rc:'+color+'">'
    +'<path d="M20 2 36 11v18L20 38 4 29V11z" fill="'+color+'30" stroke="'+color+'" stroke-width="2.4"/>'
    +'<path d="M20 7.5 31 13.8v12.4L20 32.5 9 26.2V13.8z" fill="'+color+'26"/>'
    +'<text x="20" y="25.6" text-anchor="middle" font-size="'+(letter.length>1?13:16)+'" font-weight="800" fill="#fff" font-family="Inter,system-ui,sans-serif">'+letter+'</text></svg>';
}
function myBadge(size){return placed()?badge(rankLetter(),titleColor(profile.rank),size):badge('?','#8ea2c2',size)}
function rankPill(){return myBadge(24)+'<span>'+(placed()?titleName(profile.rank):t('placementShort')+' '+(profile.wins+profile.losses)+'/'+PLACEMENT)+'</span>'}

const INP='width:100%;margin:6px 0;padding:10px;border-radius:10px;border:1px solid #293c59;background:#070c1b;color:#eef5ff';
async function hashPw(u,p){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(u.toLowerCase()+':'+p));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

