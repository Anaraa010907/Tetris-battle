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

/* ---------- rank letters (Tetra League style) ---------- */
const RANKS=[['D',0,'#9a8aa0'],['D+',650,'#a070a8'],['C-',725,'#9058b0'],['C',800,'#8648c0'],['C+',875,'#7450d8'],
  ['B-',950,'#5f66e0'],['B',1025,'#4f82e8'],['B+',1100,'#3fa6e0'],['A-',1175,'#3cc08a'],['A',1250,'#32cc5c'],['A+',1325,'#6cd84a'],
  ['S-',1400,'#d6bd3a'],['S',1500,'#efbd22'],['S+',1600,'#f7cc1c'],['SS',1700,'#f7a12c'],['U',1850,'#ff6a3d'],['X',2000,'#ff5ae0']];
const PLACEMENT=5;
function rankOf(r){let x=RANKS[0];for(const k of RANKS)if(r>=k[1])x=k;return x}
function placed(){return profile.wins+profile.losses>=PLACEMENT}
function rankLetter(){return placed()?rankOf(profile.rank)[0]:'?'}
// Titles (цол) after the ranks of a khan's army; each spans one or more letter ranks. One table drives the
// names (t(key)), their one-line meaning (t(key+'D')), colour and badge emblem (BADGE_EMBLEMS).
const TITLES=[['tWarrior',0,'#8f9bb0','arrow'],['tArban',725,'#c98a55','bow'],['tZuun',950,'#a9c1de','shield'],['tMingghan',1175,'#f0c64c','helmet'],
  ['tTumen',1400,'#3fd6e6','tug'],['tGeneral',1700,'#6a95ff','tugs'],['tKhan',1850,'#b978ff','crown'],['tGreatKhan',2000,'#ff5a5a','crown2']];
function titleIdx(r){let i=0;TITLES.forEach((x,k)=>{if(r>=x[1])i=k});return i}
function titleName(r){return t(TITLES[titleIdx(r)][0])}
function titleColor(r){return TITLES[titleIdx(r)][2]}
function titleEmblem(r){return TITLES[titleIdx(r)][3]}
// army emblems drawn in a 20 x 20 box (white strokes; f = filled parts)
const tugPath='M10 2v17M10 2 8.4 5h3.2zM8 6.5q-1.8 4.2-.9 7.8M10 6.5v8M12 6.5q1.8 4.2.9 7.8';
const BADGE_EMBLEMS={
  arrow:['M4.5 15.5 15 5M4.5 15.5V12M4.5 15.5H8M6.8 13.2V10.2M6.8 13.2h3','M16.8 3.2 10.9 4.9 15.1 9.1z'],
  bow:['M6 2.5Q18 10 6 17.5M6 2.5v15M3 10h12.5','M17 10l-3.2-2v4z'],
  shield:['M10 3a7 7 0 1 0 .01 0zM10 6.2a3.8 3.8 0 1 0 .01 0z','M10 8.4a1.6 1.6 0 1 0 .01 0z'],
  helmet:['M4.5 13Q4.5 5.2 10 4.6 15.5 5.2 15.5 13M3 13h14M5.5 13v4M14.5 13v4M10 4.6V1.8','M9 2.2h2l-1-1.6z'],
  tug:[tugPath,''],
  tugs:[tugPath,'','<g transform="rotate(-28 10 19) scale(.85) translate(1.8 3)"><path d="'+tugPath+'"/></g><g transform="rotate(28 10 19) scale(.85) translate(1.8 3)"><path d="'+tugPath+'"/></g>'],
  crown:['M3.5 15 4.5 6.5 8 10 10 4.5 12 10 15.5 6.5 16.5 15zM3.5 17.5h13','M10 11.2a1.3 1.3 0 1 0 .01 0z'],
  crown2:['M3.5 15 4.5 6.5 8 10 10 5.5 12 10 15.5 6.5 16.5 15zM3.5 17.5h13M1.5 9.5l1.5-1.5M18.5 9.5 17 8','M10 .8l1.6 1.8-1.6 1.8-1.6-1.8zM10 11.2a1.3 1.3 0 1 0 .01 0z']};
function badge(letter,color,size,emblem){
  const e=size>=30&&BADGE_EMBLEMS[emblem],fs=e?(letter.length>1?9.5:11.5):(letter.length>1?13:16);
  return '<svg class="rbadge" width="'+size+'" height="'+size+'" viewBox="0 0 40 40" aria-hidden="true" style="--rc:'+color+'">'
    +'<path d="M20 2 36 11v18L20 38 4 29V11z" fill="'+color+'30" stroke="'+color+'" stroke-width="2.4"/>'
    +'<path d="M20 7.5 31 13.8v12.4L20 32.5 9 26.2V13.8z" fill="'+color+'26"/>'
    +(e?'<g transform="translate(14 7.4) scale(.6)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="'+e[0]+'"/>'
      +(e[1]?'<path d="'+e[1]+'" fill="#fff" stroke="none"/>':'')+(e[2]||'')+'</g>':'')
    +'<text x="20" y="'+(e?30.4:25.6)+'" text-anchor="middle" font-size="'+fs+'" font-weight="800" fill="#fff" font-family="Inter,system-ui,sans-serif">'+letter+'</text></svg>';
}
function myBadge(size){return placed()?badge(rankLetter(),titleColor(profile.rank),size,titleEmblem(profile.rank)):badge('?','#8ea2c2',size)}
function rankPill(){return myBadge(24)+'<span>'+(placed()?titleName(profile.rank):t('placementShort')+' '+(profile.wins+profile.losses)+'/'+PLACEMENT)+'</span>'}

const INP='width:100%;margin:6px 0;padding:10px;border-radius:10px;border:1px solid #293c59;background:#070c1b;color:#eef5ff';
async function hashPw(u,p){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(u.toLowerCase()+':'+p));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}

