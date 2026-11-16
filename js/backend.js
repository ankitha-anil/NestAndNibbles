/* Nest & Nibbles: data, sign-in, sync, Telegram and Shortcuts (no screens in here) */
/* ---------- helpers & state ---------- */
const $=(s,e=document)=>e.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9);
const today=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const dayDiff=(a,b)=>Math.round((new Date(a+'T00:00')-new Date(b+'T00:00'))/864e5);
const addDays=(iso,n)=>{const d=new Date(iso+'T12:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const KEY='nestnibbles.v1',LKEY='nestnibbles.device';
const GATED=!!(CONFIG.databaseURL&&CONFIG.apiKey);
const ago=n=>addDays(today(),-n);
const DEFAULTS=()=>({
  groceries:[],
  inv:[
    {id:uid(),t:'Eggs',qty:'6',loc:'fridge',exp:''},{id:uid(),t:'Milk',qty:'1 L',loc:'fridge',exp:addDays(today(),3)},
    {id:uid(),t:'Butter',qty:'',loc:'fridge',exp:''},{id:uid(),t:'Rice',qty:'1 kg',loc:'pantry',exp:''},
    {id:uid(),t:'Pasta',qty:'2 packs',loc:'pantry',exp:''},{id:uid(),t:'Onions',qty:'4',loc:'pantry',exp:''},
    {id:uid(),t:'Garlic',qty:'',loc:'pantry',exp:''},{id:uid(),t:'Olive oil',qty:'',loc:'pantry',exp:''},
    {id:uid(),t:'Frozen peas',qty:'',loc:'freezer',exp:''}],
  routines:[
    {id:uid(),t:'Laundry',every:4,last:ago(3)},{id:uid(),t:'Change bedsheets',every:14,last:ago(9)},
    {id:uid(),t:'Vacuum and mop',every:7,last:ago(7)},{id:uid(),t:'Clean bathroom',every:7,last:ago(2)},
    {id:uid(),t:'Clear out fridge',every:30,last:ago(12)},{id:uid(),t:'Washing machine clean cycle',every:30,last:ago(33)},
    {id:uid(),t:'Descale kettle',every:60,last:ago(20)},{id:uid(),t:'Water the plants',every:3,last:ago(1)}],
  recipes:[
    {id:uid(),t:'Garlic butter pasta',icon:'🍝',time:'20',cuisine:'Italian',ing:['pasta','garlic','butter','parmesan','parsley']},
    {id:uid(),t:'Egg fried rice',icon:'🍚',time:'15',cuisine:'Chinese',ing:['rice','eggs','frozen peas','soy sauce','spring onions','garlic']},
    {id:uid(),t:'Tomato soup and grilled cheese',icon:'🍲',time:'30',cuisine:'Western',ing:['tomatoes','onion','garlic','bread','cheese','butter']},
    {id:uid(),t:'Veggie omelette',icon:'🍳',time:'10',cuisine:'Western',ing:['eggs','onion','bell pepper','cheese','butter']}],
  eatout:['Pizza','Sushi','Thai','Burgers','Our usual café','Tacos'],
  settings:{a:'Me',b:'Partner',token:'',chat:'',chatA:'',chatB:'',auto:true,digest:true,scNotes:'Nest Groceries',scMsg:'Nest Message',scAlarm:'Nest Alarm',dests:[],route:{},aiKey:'',aiModel:'gpt-5.4-mini'},
  lastDigest:'',lastSent:''
});
const DS=DEFAULTS().settings,LISTS=['groceries','inv','routines','recipes','eatout'];
let S=DEFAULTS();
try{const raw=JSON.parse(localStorage.getItem(KEY));if(raw){S={...S,...raw,settings:{...S.settings,...raw.settings}}}}catch(e){}
/* L = things that stay on this device only */
let L={fb:'',key:'',email:'',rt:'',who:'a'};
try{Object.assign(L,JSON.parse(localStorage.getItem(LKEY))||{})}catch(e){}
const saveL=()=>{try{localStorage.setItem(LKEY,JSON.stringify(L))}catch(e){}};
if(GATED){L.fb=CONFIG.databaseURL;L.key=CONFIG.apiKey}
const locked=()=>GATED&&!L.rt;
function fix(){
  for(const k of LISTS){const v=S[k];S[k]=Array.isArray(v)?v.filter(x=>x!=null):v&&typeof v==='object'?Object.values(v):[]}
  S.recipes.forEach(r=>{r.ing=Array.isArray(r.ing)?r.ing:r.ing?Object.values(r.ing):[];r.icon=r.icon||'🍽️';r.time=r.time||'';r.cuisine=r.cuisine||'';r.url=r.url||''});
  S.inv.forEach(x=>{x.qty=x.qty||'';x.exp=x.exp||'';x.loc=x.loc||'pantry'});
  S.settings={...DS,...S.settings};const st=S.settings;st.dests=Array.isArray(st.dests)?st.dests.filter(Boolean):st.dests&&typeof st.dests==='object'?Object.values(st.dests):[];st.route=st.route&&typeof st.route==='object'?st.route:{};S.lastDigest=S.lastDigest||'';S.lastSent=S.lastSent||'';
}
fix();
const local=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const save=()=>{local();Sync.push()};
const me=()=>S.settings[L.who]||'Me';
let tab='home';


/* ---------- private sync: Firebase sign-in + Realtime Database over REST ---------- */
const SYNCED=[...LISTS,'settings','lastDigest','lastSent'];
async function idp(path,body){
  const r=await fetch('https://identitytoolkit.googleapis.com/'+path+'?key='+encodeURIComponent(L.key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();if(j.error)throw new Error(j.error.message);return j;
}
const Sync={es:null,tok:'',timer:null,snap:{},on:false,msg:'',pending:null,
  base:()=>L.fb.replace(/\/+$/,'')+'/nest',
  ready:()=>/^https:\/\//.test(L.fb)&&!!L.key&&!!L.rt,
  state(on,msg){this.on=on;this.msg=on?'Signed in and syncing.':(msg||'');renderNav();const e=$('#syncmsg');if(e)e.textContent=this.msg},
  async signIn(pw){
    const j=await idp('v1/accounts:signInWithPassword',{email:L.email,password:pw,returnSecureToken:true});
    if(j.mfaPendingCredential){const f=(j.mfaInfo||[])[0]||{};this.pending={cred:j.mfaPendingCredential,id:f.mfaEnrollmentId};throw Object.assign(new Error('second step needed'),{mfa:true})}
    this.tok=j.idToken;L.rt=j.refreshToken;saveL();
  },
  async second(code){
    const j=await idp('v2/accounts/mfaSignIn:finalize',{mfaPendingCredential:this.pending.cred,mfaEnrollmentId:this.pending.id,totpVerificationInfo:{verificationCode:code}});
    this.pending=null;this.tok=j.idToken;L.rt=j.refreshToken;saveL();
  },
  async refresh(){
    const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(L.key),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(L.rt)});
    const j=await r.json();if(j.error)throw new Error(j.error.message);
    this.tok=j.id_token;L.rt=j.refresh_token;saveL();
  },
  async start(haveToken){
    this.stop();if(!this.ready()||!window.EventSource){this.state(false);return}
    if(!haveToken){try{await this.refresh()}catch(e){
      if(GATED&&/TOKEN_EXPIRED|USER_DISABLED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN/.test(e.message)){signOut('Please sign in again.');return}
      this.state(false,'Could not sign in ('+e.message+'). Sign in again.');return}}
    const es=this.es=new EventSource(this.base()+'.json?auth='+encodeURIComponent(this.tok));
    es.addEventListener('put',e=>this.recv(JSON.parse(e.data)));
    es.addEventListener('patch',e=>{const m=JSON.parse(e.data);for(const k in (m.data||{}))this.recv({path:(m.path==='/'?'':m.path)+'/'+k,data:m.data[k]})});
    es.addEventListener('auth_revoked',()=>this.start());
    es.addEventListener('cancel',()=>{this.stop();this.state(false,'The database refused access. Check the UID in your rules.')});
    es.onerror=()=>{this.state(false,es.readyState===2?'The database refused the connection. Check the URL and the UID in your rules.':'Reconnecting…')};
    this.timer=setTimeout(()=>this.start(),50*60*1000);
  },
  stop(){if(this.es){this.es.close();this.es=null}clearTimeout(this.timer);this.on=false},
  push(){
    if(!this.on||!this.es)return;
    for(const k of SYNCED){const j=JSON.stringify(S[k]??null);if(j===this.snap[k])continue;this.snap[k]=j;
      fetch(this.base()+'/'+k+'.json?auth='+encodeURIComponent(this.tok),{method:'PUT',body:j}).then(r=>{if(!r.ok)delete this.snap[k]}).catch(()=>{delete this.snap[k]})}
  },
  recv(m){
    const parts=(m.path||'/').split('/').filter(Boolean),d=m.data;
    if(!parts.length){
      this.snap={};
      if(d!=null){for(const k of SYNCED){
        if(k in d){S[k]=k==='settings'?{...S.settings,...d.settings}:d[k]}
        else if(LISTS.includes(k))S[k]=[];else continue;
        fix();this.snap[k]=JSON.stringify(S[k])}}
      fix();local();this.state(true);this.push();softRender();return;
    }
    const k=parts[0];if(parts.length!==1||!SYNCED.includes(k))return;
    const before=JSON.stringify(S[k]);
    S[k]=d==null?(LISTS.includes(k)?[]:k==='settings'?S.settings:''):k==='settings'?{...S.settings,...d}:d;
    fix();const now=JSON.stringify(S[k]);this.snap[k]=now;
    if(now!==before){local();softRender()}
  }
};
function signOut(msg){
  Sync.stop();L.rt='';saveL();
  if(GATED){try{localStorage.removeItem(KEY)}catch(e){}S=DEFAULTS();fix()}
  Sync.msg=msg||'Signed out on this device.';render();
}
/* ---------- telegram / sharing ---------- */
const tgReady=()=>S.settings.token&&S.settings.chat;
/* Where a kind of message goes: a chosen group or topic, otherwise the main group. */
function target(kind){const r=(S.settings.route||{})[kind]||'',p=r.split('|'),o={chat_id:p[0]||S.settings.chat};if(r&&p[1])o.message_thread_id=p[1];return o}
const cleanToken=t=>(String(t||'').match(/\d{5,}:[\w-]{20,}/)||[''])[0];
async function tg(method,fields){
  const tok=cleanToken(S.settings.token);
  if(!tok)throw new Error('that does not look like a bot token. It should look like 123456789:AAF… with nothing else around it');
  let body;
  if(Object.values(fields).some(Array.isArray)){body=new FormData();for(const k in fields){const v=fields[k];Array.isArray(v)?body.append(k,v[0],v[1]):body.append(k,v)}}
  else{body=new URLSearchParams();for(const k in fields)body.append(k,fields[k])}
  const r=await fetch(`https://api.telegram.org/bot${tok}/${method}`,{method:'POST',body});
  const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){throw new Error('unexpected reply from Telegram (status '+r.status+')')}
  if(!j.ok)throw new Error(j.description||'Telegram error');return j.result;
}
async function tgSafe(method,fields,okMsg){
  if(!S.settings.token){toast('Connect Telegram on the Home screen first');return false}
  if(!fields.chat_id){toast('No Telegram chat is set for that yet');return false}
  try{await tg(method,fields);if(okMsg)toast(okMsg);return true}catch(e){toast('Telegram: '+e.message);return false}
}
function runShortcut(name,text){location.href='shortcuts://run-shortcut?name='+encodeURIComponent(name)+'&input=text&text='+encodeURIComponent(text)}
async function share(data){
  try{if(data.files&&!(navigator.canShare&&navigator.canShare({files:data.files})))throw 0;
    if(!navigator.share)throw 0;await navigator.share(data)}
  catch(e){if(e&&e.name==='AbortError')return;toast('Sharing is not available in this browser')}
}

/* ---------- OpenAI: reads receipts and recipe pages, answers as JSON ---------- */
async function ai(content,opts={}){
  const key=(S.settings.aiKey||'').trim();if(!key)throw new Error('nokey');
  const body={model:(S.settings.aiModel||'gpt-5.4-mini').trim(),input:[{role:'user',content}]};
  if(opts.schema)body.text={format:{type:'json_schema',name:opts.name,strict:true,schema:opts.schema}};
  if(opts.web)body.tools=[{type:'web_search'}];
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify(body)});
  const t=await r.text();let j;try{j=JSON.parse(t)}catch(e){throw new Error('unexpected reply from OpenAI (status '+r.status+')')}
  if(j.error)throw new Error(j.error.message||'OpenAI error');
  const txt=(j.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
  const m=txt.match(/\{[\s\S]*\}/);if(!m)throw new Error('OpenAI sent back no answer');
  return JSON.parse(m[0]);
}
const aiErr=e=>e.message==='nokey'?'Add your OpenAI key in Settings first':/api key|Incorrect|401/i.test(e.message)?'OpenAI did not accept that key. Check it in Settings.':/model/i.test(e.message)&&/not|exist|access/i.test(e.message)?'OpenAI does not recognise that model name. Check it in Settings.':/quota|billing|insufficient/i.test(e.message)?'Your OpenAI account has no credit left.':/Failed to fetch|Load failed|NetworkError/i.test(e.message)?'Could not reach OpenAI from this device.':'OpenAI: '+e.message;

