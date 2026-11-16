/* Nest & Nibbles: screens and what the buttons do */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),3000)}
let mfa={on:false,verified:true,session:null,known:false};
const mfaErr=e=>/UNVERIFIED_EMAIL/.test(e.message)?'Verify the household email first, then try again.':/OPERATION_NOT_ALLOWED|not enabled|MFA/i.test(e.message)&&!/INVALID/.test(e.message)?'Two-step sign-in is not switched on for the Firebase project yet.':/CREDENTIAL_TOO_OLD|LOGIN_AGAIN/.test(e.message)?'Sign out, sign in again, then retry.':/INVALID_CODE|INVALID_MFA|verification code/i.test(e.message)?'That code was not accepted. Wait for the next one and try again.':'Could not do that: '+e.message;
async function mfaStatus(){
  if(!$('#mfabox'))return;mfaUI();
  try{if(!Sync.tok)await Sync.refresh();const u=(await idp('v1/accounts:lookup',{idToken:Sync.tok})).users[0];mfa.on=(u.mfaInfo||[]).length>0;mfa.verified=!!u.emailVerified;mfa.known=true}catch(e){return}
  mfaUI();
}
function mfaUI(msg){
  const box=$('#mfabox');if(!box)return;const s=mfa.session,m=msg?`<p class="muted" style="margin-top:10px">${esc(msg)}</p>`:'';
  if(s){const link='otpauth://totp/'+encodeURIComponent('Nest & Nibbles:'+L.email)+'?secret='+encodeURIComponent(s.sharedSecretKey)+'&issuer='+encodeURIComponent('Nest & Nibbles');
    box.innerHTML=`<ol><li>Add this key to an authenticator app on <b>both</b> phones (Apple Passwords, Google Authenticator or similar), before confirming.</li></ol><div class="keybox">${esc(s.sharedSecretKey)}</div>
    <div class="row" style="margin-top:10px"><a class="btn sm soft" href="${esc(link)}">Open in authenticator app</a></div>
    <label>Then enter the 6-digit code it shows</label><div class="row"><input id="mfacode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" style="flex:1;min-width:120px"><button class="btn" data-a="mfaFinish">Confirm</button><button class="btn ghost" data-a="mfaCancel">Cancel</button></div>${m}`;return}
  box.innerHTML=!mfa.known?`<p class="muted">Checking…</p>${m}`:mfa.on?`<p><span class="due">On</span> <span class="muted">Signing in needs the password and a code.</span></p>${m}`
    :`<p><span class="due soon">Off</span> <span class="muted">Signing in only needs the password.</span></p><div class="row" style="margin-top:12px"><button class="btn" data-a="mfaStart">Turn on two-step sign-in</button>${mfa.verified?'':'<button class="btn soft" data-a="mfaVerify">Send verification email</button>'}</div>${mfa.verified?'':'<p class="muted" style="margin-top:8px">The household email has to be verified first.</p>'}${m}`;
}
let stale=false;
const busy=()=>{const a=document.activeElement;return $('#modal').classList.contains('on')||spinning||(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))};
function softRender(){if(busy()){stale=true;renderNav();return}stale=false;render()}
document.addEventListener('focusout',()=>setTimeout(()=>{if(stale&&!busy()){stale=false;render()}},80));

/* ---------- groceries ---------- */
const splitItems=t=>t.split(/,|;|\n|\band\b|\bthen\b|\bplus\b/i).map(s=>s.trim().replace(/[.!?]+$/,'')).filter(Boolean);
function addGroceries(names,quiet){
  let n=0;for(const raw of names){const t=raw.trim();if(!t)continue;
    if(S.groceries.some(g=>!g.done&&g.t.toLowerCase()===t.toLowerCase()))continue;
    S.groceries.push({id:uid(),t:t[0].toUpperCase()+t.slice(1),done:false});n++}
  if(n)groceryChanged();if(!quiet)toast(n?`Added ${n} to the list`:'Already on the list');return n;
}
function groceryText(){
  const need=S.groceries.filter(g=>!g.done),got=S.groceries.filter(g=>g.done);
  let s=`🛒 Grocery list: ${need.length} to get\n`+need.map(g=>'▫️ '+g.t).join('\n');
  if(!need.length)s+='All done! 🎉';if(got.length)s+='\n\n✅ Got: '+got.map(g=>g.t).join(', ');return s;
}
let gTimer;
function groceryChanged(){
  save();renderNav();
  if(S.settings.auto&&tgReady()){clearTimeout(gTimer);setSync('Sending to Telegram shortly…');gTimer=setTimeout(()=>sendGroceries(false),6000)}
}
function setSync(m){const e=$('#gsync');if(e)e.textContent=m}
async function sendGroceries(manual){
  clearTimeout(gTimer);const text=groceryText();
  if(!manual&&text===S.lastSent){setSync('Telegram is up to date');return}
  if(!tgReady()){if(manual)toast('Connect Telegram on the Home screen first');return}
  try{await tg('sendMessage',{...target('grocery'),text});S.lastSent=text;save();setSync('Sent to Telegram at '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));if(manual)toast('Sent to Telegram')}
  catch(e){setSync('Telegram failed: '+e.message);if(manual)toast('Telegram: '+e.message)}
}
const FRIDGE=/milk|egg|cheese|yog|butter|cream|meat|chicken|fish|ham|bacon|tofu|lettuce|spinach|salad|berr|juice|paneer|curd/i, FREEZE=/frozen|ice ?cream/i;
const MIC='<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.500V21"/></svg>';
let sr=null;
function mic(btn){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition,inp=$('#gin'),hint=$('#michint'),heard=$('#heard');
  if(!SR){inp.focus();toast('Tap the microphone on the keyboard to dictate');return}
  if(sr){sr.stop();return}
  sr=new SR();sr.lang=navigator.language||'en-SG';sr.interimResults=true;btn.classList.add('on');inp.placeholder='Listening';if(hint)hint.textContent='Listening. Tap again when you are done.';
  sr.onresult=e=>{inp.value=[...e.results].map(r=>r[0].transcript).join(' ');if(heard)heard.textContent=inp.value};
  sr.onerror=e=>{if(e.error!=='no-speech'&&e.error!=='aborted')toast(e.error==='not-allowed'?'Allow microphone access for this site in Safari settings':'Microphone: '+e.error+'. Try the keyboard microphone instead.')};
  sr.onend=()=>{sr=null;const v=inp.value.trim(),n=v?addGroceries(splitItems(v)):0;render();if(n&&S.settings.auto&&tgReady())sendGroceries(true)};
  try{sr.start()}catch(e){sr=null;btn.classList.remove('on')}
}
const gLi=g=>`<li class="${g.done?'done':''}"><button class="tick" data-a="gTick" data-id="${g.id}" aria-label="Tick ${esc(g.t)}">${g.done?'✓':''}</button><span data-a="gTick" data-id="${g.id}">${esc(g.t)}</span><button class="ico" data-a="gDel" data-id="${g.id}" aria-label="Remove ${esc(g.t)}">✕</button></li>`;
const gForm=()=>`<form class="addbar" data-f="gAdd"><input id="gin" name="t" placeholder="Add milk, eggs, bread" autocomplete="off" enterkeyhint="done"><button type="button" class="mic" data-a="mic" aria-label="Dictate">${MIC}</button><button class="btn">Add</button></form>`;
function vGroceries(){
  const need=S.groceries.filter(g=>!g.done),got=S.groceries.filter(g=>g.done);
  return `<div class="head"><h1>Grocery list</h1><span class="muted end" id="gsync">${tgReady()?(S.settings.auto?'Sends to Telegram when it changes':'Auto-send is off'):'Telegram is not connected yet'}</span></div>
  <div class="card hero"><button class="bigmic" data-a="mic" aria-label="Speak your grocery list">${MIC}</button><b id="michint">Tap and say what you need</b><div class="muted">For example: milk, eggs and bread</div><div id="heard" aria-live="polite"></div>
    <form class="addbar" data-f="gAdd"><input id="gin" name="t" placeholder="Or type it here" autocomplete="off" enterkeyhint="done"><button class="btn ghost">Add</button></form></div>
  <div class="board">${S.groceries.length?`<ul>${need.map(gLi).join('')}${got.map(gLi).join('')}</ul>`:`<div class="empty">Nothing to buy. Type or tap the microphone to add things.</div>`}</div>
  <div class="row">
    <button class="btn" data-a="gSend">Send to Telegram</button>
    <button class="btn soft" data-a="gNotes">Save to Notes</button>
    <button class="btn soft" data-a="gShare">Share</button>
    <span style="flex:1"></span>
    <button class="btn leaf" data-a="gStock" ${got.length?'':'disabled'}>Put ticked away</button>
    <button class="btn ghost" data-a="gClear" ${got.length?'':'disabled'}>Clear ticked</button>
  </div>`;
}

/* ---------- inventory ---------- */
const LOCS={fridge:'Fridge',freezer:'Freezer',pantry:'Pantry'};
let invFilter='all';
function expBadge(x){if(!x.exp)return'';const d=dayDiff(x.exp,today());
  return d<0?`<span class="due over">expired</span>`:d<=3?`<span class="due soon">${d===0?'use today':plural(d,'day')+' left'}</span>`:`<span class="due">${d} days</span>`}
const locOpts=sel=>Object.entries(LOCS).map(([k,v])=>`<option value="${k}" ${sel===k?'selected':''}>${v}</option>`).join('');
function vInv(){
  const list=S.inv.filter(x=>invFilter==='all'||x.loc===invFilter);
  const groups=Object.keys(LOCS).map(k=>[k,list.filter(x=>x.loc===k).sort((a,b)=>(a.exp||'9').localeCompare(b.exp||'9')||a.t.localeCompare(b.t))]).filter(g=>g[1].length);
  return `<div class="head"><h1>Fridge and pantry</h1><span class="muted end">${plural(S.inv.length,'item')}</span></div>
  <form class="addbar" data-f="iAdd"><input name="t" placeholder="Add an item" autocomplete="off"><input class="w" name="qty" placeholder="Quantity" autocomplete="off"><select class="w" name="loc" aria-label="Where">${locOpts(invFilter)}</select><button class="btn">Add</button></form>
  <div class="seg" style="margin-bottom:16px">${[['all','All'],...Object.entries(LOCS)].map(([k,l])=>`<button class="${invFilter===k?'on':''}" data-a="iFilter" data-k="${k}">${l}</button>`).join('')}</div>
  ${groups.length?`<div class="grid">${groups.map(([k,items])=>`<div class="card"><h2>${LOCS[k]}</h2>${items.map(x=>`<div class="item"><div class="t" data-a="iEdit" data-id="${x.id}">${esc(x.t)}${x.qty?`<small>${esc(x.qty)}</small>`:''}</div>${expBadge(x)}<button class="btn sm clay" data-a="iOut" data-id="${x.id}">Ran out</button><button class="ico" data-a="iEdit" data-id="${x.id}" aria-label="Edit ${esc(x.t)}">✎</button></div>`).join('')}</div>`).join('')}</div>`:`<div class="card empty">Nothing here yet.</div>`}
  <p class="muted" style="margin-top:14px">Ran out moves the item onto the grocery list. Tap an item to edit it or set a use-by date.</p>`;
}
function invForm(x){return `<label>Name</label><input name="t" value="${esc(x.t)}" required><label>Quantity</label><input name="qty" value="${esc(x.qty)}" placeholder="e.g. 2 packs"><label>Where</label><select name="loc">${locOpts(x.loc)}</select><label>Use by (optional)</label><input type="date" name="exp" value="${esc(x.exp)}">`}

/* ---------- routines ---------- */
const dueIn=r=>dayDiff(addDays(r.last,+r.every),today());
function dueBadge(r){const d=dueIn(r);return d<0?`<span class="due over">${plural(-d,'day')} overdue</span>`:d===0?`<span class="due soon">today</span>`:d<=2?`<span class="due soon">in ${plural(d,'day')}</span>`:`<span class="due">in ${d} days</span>`}
const sortedRoutines=()=>[...S.routines].sort((a,b)=>dueIn(a)-dueIn(b));
const rItem=(r,full)=>`<div class="item"><div class="t" data-a="rEdit" data-id="${r.id}">${esc(r.t)}<small>every ${plural(+r.every,'day')}, last ${r.last===today()?'today':plural(dayDiff(today(),r.last),'day')+' ago'}</small></div>${dueBadge(r)}<div class="acts ${full?'full':''}">${full?`<button class="btn sm ghost" data-a="rAlarm" data-id="${r.id}">Alarm</button><button class="btn sm ghost" data-a="rNudge" data-id="${r.id}">Nudge</button>`:''}<button class="btn sm leaf" data-a="rDone" data-id="${r.id}">Done</button></div></div>`;
function vRoutines(){
  const list=sortedRoutines();
  return `<div class="head"><h1>Home routines</h1><button class="btn end" data-a="rNew">Add routine</button></div>
  <div class="card">${list.length?list.map(r=>rItem(r,true)).join(''):`<div class="empty">No routines yet.</div>`}</div>
  <p class="muted">Tap a routine to edit it. Alarm sets an alarm on this device for today. Nudge sends a reminder to Telegram.</p>`;
}
function routineForm(r){return `<label>What</label><input name="t" value="${esc(r.t)}" required placeholder="e.g. Clean AC filter"><label>Repeat every (days)</label><input type="number" name="every" min="1" value="${r.every}" required><label>Last done</label><input type="date" name="last" value="${r.last}" required>`}

/* ---------- recipes ---------- */
const UNITS='g|kg|ml|l|tbsp|tsp|cups?|cloves?|cans?|tins?|pinch|bunch|slices?|pieces?|oz|lbs?|packs?|handful|sticks?|large|small|medium';
function norm(s){
  s=s.toLowerCase().replace(/\(.*?\)/g,'').replace(new RegExp('^[\\d\\s/.,½¼¾x-]*((' +UNITS+ ')\\b\\.?\\s*)?(of\\s+)?'),'').replace(/[^a-z\s]/g,' ').trim().replace(/\s+/g,' ');
  return s.split(' ').map(w=>w.length>3?(/ies$/.test(w)?w.slice(0,-3)+'y':/oes$/.test(w)?w.slice(0,-2):/[^s]s$/.test(w)?w.slice(0,-1):w):w).join(' ');
}
function hasIng(ing,stock){const i=norm(ing);if(!i)return true;return stock.some(n=>n===i||(n.length>2&&i.length>2&&(n.includes(i)||i.includes(n))))}
function recipeStatus(r){
  const stock=S.inv.map(x=>norm(x.t)),listed=S.groceries.filter(g=>!g.done).map(g=>norm(g.t));
  const parts=r.ing.map(n=>({n,have:hasIng(n,stock),listed:hasIng(n,listed)}));
  const have=parts.filter(p=>p.have).length;return{parts,have,total:parts.length,missing:parts.filter(p=>!p.have)};
}
const ranked=()=>S.recipes.map(r=>({r,s:recipeStatus(r)})).sort((a,b)=>b.s.have/(b.s.total||1)-a.s.have/(a.s.total||1)||a.s.missing.length-b.s.missing.length);
let picked='';
function vRecipes(){
  const list=ranked();
  return `<div class="head"><h1>What can we cook?</h1><div class="row end"><button class="btn clay" data-a="cSurprise">Surprise me</button><button class="btn soft" data-a="cPaste">Paste recipes</button><button class="btn" data-a="cNew">Add recipe</button></div></div>
  ${list.length?`<div class="grid">${list.map(({r,s})=>{const toAdd=s.missing.filter(p=>!p.listed);return `<div class="card rc ${picked===r.id?'pick':''}" id="rc-${r.id}"><h2><span>${esc(r.t)}</span><button class="ico" data-a="cEdit" data-id="${r.id}" aria-label="Edit ${esc(r.t)}">✎</button></h2>
    <div class="muted">${s.missing.length?`You have ${s.have} of ${s.total}`:'Ready to cook'}</div><div class="bar"><div style="width:${s.total?s.have/s.total*100:100}%"></div></div>
    <div class="chips">${s.parts.map(p=>`<span class="chip ${p.have?'have':p.listed?'listed':'miss'}">${esc(p.n)}</span>`).join('')}</div>
    ${s.missing.length?`<button class="btn sm" data-a="cAddMissing" data-id="${r.id}" ${toAdd.length?'':'disabled'}>${toAdd.length?`Add ${toAdd.length} missing to list`:'Missing items are on the list'}</button>`:''}</div>`}).join('')}</div>`:`<div class="card empty">Add your recipes to see what you can cook from what is in stock.</div>`}
  <p class="muted" style="margin-top:14px">Green is in your kitchen, orange is missing, purple is already on the grocery list.</p>`;
}
function recipeForm(r){return `<label>Recipe name</label><input name="t" value="${esc(r.t)}" required><label>Ingredients, one per line</label><textarea name="ing" rows="8" placeholder="2 eggs&#10;200g pasta&#10;garlic">${esc(r.ing.join('\n'))}</textarea>`}
function parseRecipes(text){
  return text.split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean).map(b=>{
    let lines=b.split('\n').map(l=>l.replace(/^[-•*]\s*/,'').trim()).filter(Boolean),t=lines.shift(),ing=lines;
    if(!ing.length&&t.includes(':')){const i=t.indexOf(':');ing=t.slice(i+1).split(',').map(s=>s.trim()).filter(Boolean);t=t.slice(0,i)}
    return{id:uid(),t:t.replace(/:$/,'').trim(),ing};
  }).filter(r=>r.t);
}

/* ---------- spinner ---------- */
let spinMode='decide',rot=0,spinning=false,spinResult='';
const PAL=['#8c6293','#d3782b','#658150','#723508','#b08fb6','#e09a5e','#8ea37c'];
function spinItems(){
  if(spinMode==='decide')return['Cook','Eat out','Cook','Eat out','Cook','Eat out'];
  if(spinMode==='out')return S.eatout;
  const ready=S.recipes.filter(r=>!recipeStatus(r).missing.length);return(ready.length>=2?ready:S.recipes).map(r=>r.t);
}
function drawWheel(){
  const c=$('#wheel');if(!c)return;const items=spinItems(),n=items.length,d=devicePixelRatio||1,sz=c.clientWidth;
  c.width=c.height=sz*d;const x=c.getContext('2d');x.scale(d,d);const R=sz/2;x.translate(R,R);
  if(!n){x.fillStyle='#e9e4e1';x.beginPath();x.arc(0,0,R,0,7);x.fill();return}
  const seg=Math.PI*2/n;
  for(let i=0;i<n;i++){
    let col=spinMode==='decide'?(i%2?'#d3782b':'#658150'):PAL[i%PAL.length];
    if(spinMode!=='decide'&&i===n-1&&n>1&&col===PAL[0])col=PAL[2];
    x.beginPath();x.moveTo(0,0);x.arc(0,0,R,-Math.PI/2+i*seg,-Math.PI/2+(i+1)*seg);x.closePath();x.fillStyle=col;x.fill();x.strokeStyle='#fff';x.lineWidth=2;x.stroke();
    x.save();x.rotate(-Math.PI/2+(i+.5)*seg);x.fillStyle='#fff';x.font=`700 ${n>10?12:n>6?13:15}px Manrope,system-ui,sans-serif`;x.textAlign='right';x.textBaseline='middle';
    let t=items[i];if(t.length>18)t=t.slice(0,17)+'…';x.fillText(t,R-14,0);x.restore();
  }
}
function confetti(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const w=$('.wheelbox');if(!w)return;const r=w.getBoundingClientRect(),c=document.createElement('canvas');c.id='confetti';c.width=innerWidth;c.height=innerHeight;document.body.appendChild(c);
  const x=c.getContext('2d'),P=Array.from({length:120},()=>{const a=Math.random()*Math.PI*2,v=5+Math.random()*10;return{x:r.left+r.width/2,y:r.top+r.height/2,vx:Math.cos(a)*v,vy:Math.sin(a)*v-5,s:6+Math.random()*7,c:PAL[Math.floor(Math.random()*4)],r:Math.random()*6,vr:(Math.random()-.5)*.4}}),t0=performance.now();
  (function f(t){const k=(t-t0)/2000;if(k>=1){c.remove();return}x.clearRect(0,0,c.width,c.height);x.globalAlpha=1-k*k;
    for(const p of P){p.vy+=.35;p.vx*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/3,p.s,p.s*.66);x.restore()}
    requestAnimationFrame(f)})(t0);
}
function spin(){
  const items=spinItems(),n=items.length;if(spinning)return;if(n<2){toast('Add at least two options first');return}
  const i=Math.floor(Math.random()*n),seg=360/n,jit=(Math.random()-.5)*seg*.7,box=$('.wheelbox'),res=$('#result');
  rot=rot-(rot%360)+360*8+(360-(i+.5)*seg)+jit;spinning=true;spinResult='';$('#after').innerHTML='';
  box.classList.remove('win');box.classList.add('go');res.className='result rolling';
  const roll=setInterval(()=>{const e=$('#result');if(e)e.textContent=items[Math.floor(Math.random()*n)]},110);
  $('#wheel').style.transform=`rotate(${rot}deg)`;
  setTimeout(()=>{clearInterval(roll);spinning=false;spinResult=items[i];if(tab!=='spin'||!$('#result')){if(stale)softRender();return}
    $('.wheelbox').classList.remove('go');$('.wheelbox').classList.add('win');
    const r=$('#result');r.textContent=items[i];r.className='result pop';confetti();
    let h='';if(spinMode==='decide')h=items[i]==='Cook'?`<button class="btn leaf" data-a="sMode" data-k="cook">Now spin what to cook</button>`:`<button class="btn" data-a="sMode" data-k="out">Now spin where to go</button>`;
    else h=`<button class="btn soft" data-a="sTell">Tell the group</button>`+(spinMode==='cook'?` <button class="btn soft" data-a="sRecipe">See recipe</button>`:'');
    $('#after').innerHTML=h;if(stale)softRender()},5100);
}
function vSpin(){
  return `<div class="head"><h1>What are we eating?</h1></div>
  <div class="spin"><div class="card" style="text-align:center"><div class="seg">${[['decide','Cook or out?'],['cook','What to cook'],['out','Where to eat']].map(([k,l])=>`<button class="${spinMode===k?'on':''}" data-a="sMode" data-k="${k}">${l}</button>`).join('')}</div>
  <div class="wheelbox"><canvas id="wheel" style="transform:rotate(${rot}deg);transition:none"></canvas><button class="hub" data-a="spin">SPIN</button></div>
  <div class="result" id="result">${esc(spinResult)}</div><div class="row" id="after" style="justify-content:center;min-height:44px"></div></div>
  <div class="card"><h2>Eat-out spots</h2><div class="chips">${S.eatout.map((e,i)=>`<span class="chip">${esc(e)}<button data-a="eDel" data-i="${i}" aria-label="Remove ${esc(e)}">✕</button></span>`).join('')||'<span class="muted">Add your go-to places.</span>'}</div>
  <form class="addbar" data-f="eAdd" style="margin:0"><input name="t" placeholder="Add a place" autocomplete="off"><button class="btn">Add</button></form>
  <p class="muted" style="margin-top:12px">What to cook spins your recipes. When at least two are ready to cook, it only spins those.</p></div></div>`;
}

/* ---------- notes ---------- */
let dest='group',strokes=[],cur=null,penCol='#8c6293',penW=5,rec=null,voice=null;
const destChat=()=>dest==='a'?{chat_id:S.settings.chatA}:dest==='b'?{chat_id:S.settings.chatB}:target('notes');
const destName=()=>dest==='a'?S.settings.a:dest==='b'?S.settings.b:'the group';
function padSetup(){
  const c=$('#pad');if(!c)return;const d=devicePixelRatio||1;c.width=c.clientWidth*d;c.height=c.clientHeight*d;const x=c.getContext('2d');x.scale(d,d);
  const draw=()=>{x.fillStyle='#fff';x.fillRect(0,0,c.clientWidth,c.clientHeight);x.lineCap=x.lineJoin='round';
    for(const s of strokes){x.strokeStyle=x.fillStyle=s.c;x.lineWidth=s.w;x.beginPath();if(s.p.length===1){x.arc(s.p[0][0],s.p[0][1],s.w/2,0,7);x.fill();continue}
      x.moveTo(s.p[0][0],s.p[0][1]);for(let i=1;i<s.p.length;i++){const a=s.p[i-1],b=s.p[i];x.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2)}x.stroke()}};
  padSetup.draw=draw;draw();
  const pt=e=>{const r=c.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  c.onpointerdown=e=>{try{c.setPointerCapture(e.pointerId)}catch(_){}cur={c:penCol,w:penW,p:[pt(e)]};strokes.push(cur);draw()};
  c.onpointermove=e=>{if(cur){cur.p.push(pt(e));draw()}};
  c.onpointerup=c.onpointercancel=()=>{cur=null};
}
const padBlob=()=>new Promise(r=>$('#pad').toBlob(r,'image/png'));
function voiceUI(){
  const e=$('#voicebox');if(!e)return;
  e.innerHTML=`<div class="row"><button class="recbtn ${rec?'on':''}" data-a="vRec" aria-label="${rec?'Stop recording':'Record'}">${rec?'<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>':MIC}</button><div style="flex:1;min-width:160px"><b>${rec?'Recording. Tap to stop.':voice?'Recorded.':'Tap to record'}</b><div class="muted">${voice?'Listen back, then send.':'A hello, a reminder, a song.'}</div></div></div>
  ${voice?`<audio controls src="${voice.url}"></audio><div class="row" style="margin-top:12px"><button class="btn" data-a="vSend">Send to ${esc(destName())}</button><button class="btn soft" data-a="vShare">Share (WhatsApp)</button><button class="btn ghost" data-a="vClear">Discard</button></div>`:''}`;
}
function vNotes(){
  const st=S.settings,opts=[['group','Group'],['a',st.a],['b',st.b]];
  return `<div class="head"><h1>Little notes</h1><div class="seg end">${opts.map(([k,l])=>`<button class="${dest===k?'on':''}" data-a="nDest" data-k="${k}">${esc(l)}</button>`).join('')}</div></div>
  <div class="grid two"><div class="card"><h2>Doodle</h2><canvas id="pad"></canvas>
    <div class="row" style="margin-top:12px">${['#8c6293','#d3782b','#658150','#723508','#2f211a'].map(c=>`<button class="sw ${penCol===c?'on':''}" style="background:${c}" data-a="nCol" data-c="${c}" aria-label="Pen colour"></button>`).join('')}
      <div class="seg" style="box-shadow:none;background:var(--paper)">${[[3,'Fine'],[5,'Pen'],[12,'Bold']].map(([w,l])=>`<button class="${penW===w?'on':''}" data-a="nW" data-w="${w}">${l}</button>`).join('')}</div></div>
    <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-a="nUndo">Undo</button><button class="btn sm ghost" data-a="nWipe">Clear</button></div>
    <div class="row" style="margin-top:12px"><input id="cap" placeholder="Caption (optional)" style="flex:1;min-width:160px"></div>
    <div class="row" style="margin-top:10px"><button class="btn" data-a="nSendDoodle">Send to ${esc(destName())}</button><button class="btn soft" data-a="nShareDoodle">Share (WhatsApp)</button></div></div>
  <div><div class="card" style="margin-bottom:16px"><h2>Voice note</h2><div id="voicebox"></div></div>
  <div class="card"><h2>Reminder</h2><form data-f="nRemind"><textarea name="t" rows="2" placeholder="Don't forget the dry cleaning" required></textarea>
    <div class="row" style="margin-top:10px"><button class="btn">Send to ${esc(destName())}</button><button type="button" class="btn soft" data-a="nRemindSc">Via iPhone Shortcut</button><button type="button" class="btn soft" data-a="nRemindShare">Share</button></div></form></div></div></div>`;
}

/* ---------- telegram panel (shown on Home until connected, and always in Settings) ---------- */
const KINDS=[['grocery','Grocery list'],['routines','Routines and nudges'],['notes','Doodles, voice notes, reminders'],['wheel','Wheel results']];
function tgPanel(){
  const s=S.settings,groups=s.dests.filter(d=>!d.priv),people=s.dests.filter(d=>d.priv),mains=groups.filter(d=>!d.id.split('|')[1]);
  const opt=(v,l,sel)=>`<option value="${esc(v)}" ${String(sel||'')===String(v)?'selected':''}>${esc(l)}</option>`;
  const who=(k,n)=>`<div style="flex:1;min-width:130px"><label>${esc(n)}'s private chat</label><select data-s="${k}">${opt('','None',s[k])}${people.map(d=>opt(d.id.split('|')[0],d.label,s[k])).join('')}${s[k]&&!people.some(d=>d.id.split('|')[0]===String(s[k]))?opt(s[k],'Chat '+s[k],s[k]):''}</select></div>`;
  return `<label style="margin-top:0">Bot token</label><input id="tgtoken" data-s="token" value="${esc(s.token)}" placeholder="123456789:AAF…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
  <div class="row" style="margin-top:12px"><button class="btn soft" data-a="tFind">Find chats and topics</button><button class="btn" data-a="tTest">Send a test</button></div><p class="muted" id="chats" style="margin-top:8px"></p>
  <label>Main group</label><select data-s="chat">${opt('',mains.length?'Choose a group':'No groups found yet',s.chat)}${mains.map(d=>opt(d.id.split('|')[0],d.label,s.chat)).join('')}${s.chat&&!mains.some(d=>d.id.split('|')[0]===String(s.chat))?opt(s.chat,'Chat '+s.chat,s.chat):''}</select>
  <label>Where each kind of message goes</label>
  ${KINDS.map(([k,l])=>`<div class="row" style="margin-bottom:8px"><span style="flex:1 1 150px;font-weight:600">${l}</span><select data-r="${k}" style="flex:2 1 180px">${opt('','Main group',s.route[k])}${groups.map(d=>opt(d.id,d.label,s.route[k])).join('')}</select></div>`).join('')}
  <div class="row" style="align-items:flex-end">${who('chatA',s.a)}${who('chatB',s.b)}</div>`;
}

/* ---------- home ---------- */
function vHome(){
  const need=S.groceries.filter(g=>!g.done),rk=ranked(),ready=rk.filter(x=>!x.s.missing.length),rs=sortedRoutines(),due=rs.filter(r=>dueIn(r)<=0),h=new Date().getHours(),t=rk[0];
  const toAdd=t?t.s.missing.filter(p=>!p.listed):[];
  return `<div class="banner"><div><h1>${h<12?'Good morning':h<18?'Good afternoon':'Good evening'}, ${esc(me())}</h1>
    <p>${new Date().toLocaleDateString([], {weekday:'long',day:'numeric',month:'long'})}. ${need.length?plural(need.length,'thing')+' to buy':'Nothing to buy'} and ${due.length?plural(due.length,'routine')+' due at home.':'the house is all caught up.'}</p></div>
    <svg viewBox="0 0 150 112" aria-hidden="true"><circle cx="118" cy="26" r="15" fill="#d3782b" opacity=".85"/><path d="M28 60 70 26l42 34v40H28z" fill="#8c6293"/><path d="M20 62 70 20l50 42" fill="none" stroke="#723508" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="60" y="70" width="20" height="30" rx="3" fill="#f5f5f5"/><circle cx="22" cy="94" r="13" fill="#658150"/><circle cx="124" cy="92" r="16" fill="#658150"/><path d="M4 102h142" stroke="#723508" stroke-width="4" stroke-linecap="round"/></svg></div>
  <div class="tiles">
    <button class="tile t1" data-a="go" data-k="groceries"><span>To buy</span><b>${need.length}</b></button>
    <button class="tile t2" data-a="go" data-k="recipes"><span>Ready to cook</span><b>${ready.length}</b></button>
    <button class="tile t3" data-a="go" data-k="routines"><span>Routines due</span><b>${due.length}</b></button>
    <button class="tile t4" data-a="go" data-k="inv"><span>In the kitchen</span><b>${S.inv.length}</b></button>
  </div>
  ${tgReady()?'':`<div class="card"><h2>Connect your Telegram group</h2><p class="muted" style="margin-bottom:12px">One-time step. Add your bot to the group, send a message there, paste the bot token and tap Find chats and topics. You can fine-tune topics later in Settings.</p>${tgPanel()}</div>`}
  <div class="grid two"><div class="card"><div class="row" style="margin-bottom:12px"><h2 style="margin:0;flex:1">Grocery list</h2><button class="btn sm ghost" data-a="go" data-k="groceries">Open list</button></div>
    ${gForm()}<ul class="glist">${need.length?need.slice(0,6).map(gLi).join('')+(need.length>6?`<li class="muted" style="font-weight:500">and ${need.length-6} more</li>`:''):'<li class="muted" style="font-weight:500">All stocked up.</li>'}</ul></div>
  <div><div class="card" style="margin-bottom:16px"><div class="row" style="margin-bottom:12px"><h2 style="margin:0;flex:1">Tonight</h2><button class="btn sm ghost" data-a="go" data-k="spin">Spin the wheel</button></div>
    ${t?`<p style="font-weight:700">${esc(t.r.t)}</p><p class="muted" style="margin:4px 0 12px">${t.s.missing.length?'You would need '+esc(t.s.missing.map(p=>p.n).join(', '))+'.':'You have everything for it.'}</p>${toAdd.length?`<button class="btn sm" data-a="cAddMissing" data-id="${t.r.id}">Add ${toAdd.length} missing to list</button>`:''}`:'<p class="muted">Add a recipe and it will show up here.</p>'}</div>
  <div class="card"><div class="row" style="margin-bottom:6px"><h2 style="margin:0;flex:1">Coming up at home</h2><button class="btn sm ghost" data-a="go" data-k="routines">All routines</button></div>
    ${rs.length?rs.slice(0,3).map(r=>rItem(r,false)).join(''):'<p class="muted">No routines yet.</p>'}</div></div></div>`;
}

/* ---------- settings ---------- */
function vSettings(){
  const s=S.settings,f=(k,l,ph='',type='text')=>`<label>${l}</label><input data-s="${k}" type="${type}" value="${esc(s[k])}" placeholder="${ph}" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off">`;
  const lf=(k,l,ph='',type='text')=>`<label>${l}</label><input data-l="${k}" type="${type}" value="${esc(L[k])}" placeholder="${ph}" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off">`;
  const sw=(k,l)=>`<label class="check"><input type="checkbox" data-s="${k}" ${s[k]?'checked':''}>${l}</label>`;
  return `<div class="head"><h1>Settings</h1></div>
  <div class="grid two"><div>
  <div class="card"><h2>Our nest</h2><div class="row" style="align-items:flex-end"><div style="flex:1;min-width:130px">${f('a','First name')}</div><div style="flex:1;min-width:130px">${f('b','Second name')}</div></div>
    <label>This device belongs to</label><div class="seg" style="box-shadow:none;background:var(--paper)">${['a','b'].map(k=>`<button class="${L.who===k?'on':''}" data-a="who" data-k="${k}">${esc(s[k])}</button>`).join('')}</div>
    ${GATED?`<div class="row" style="margin-top:16px"><span class="muted" style="flex:1">Signed in as ${esc(L.email)}</span><button class="btn sm ghost" data-a="sOut">Sign out</button></div>`:''}</div>
  ${GATED?`<div class="card"><h2>Two-step sign-in</h2><p class="muted">Adds a 6-digit code from an authenticator app on top of the password, every time someone signs in.</p><div id="mfabox" style="margin-top:12px"></div></div>`:''}
  <div class="card"><h2>Telegram</h2><p class="muted" style="margin-bottom:12px">Re-pick the group, or send each kind of message to its own topic or a different group.</p>${tgPanel()}
    <details><summary>How to add a topic or another group</summary><ol><li>Make sure the bot is a member of the group (Group Privacy turned off in @BotFather).</li><li>Send one message inside each topic you want to use, and in any other group.</li><li>Tap <b>Find chats and topics</b>. Each topic then appears in the lists above as Group › Topic.</li><li>Pick where each kind of message goes, then tap <b>Send a test</b>.</li></ol></details></div>
  <div class="card"><h2>iPhone and iPad Shortcuts</h2>${f('scNotes','Shortcut that saves the grocery list to Notes')}${f('scMsg','Shortcut that sends a message (WhatsApp or iMessage)')}${f('scAlarm','Shortcut that sets an alarm for a routine')}
    <details><summary>How to make the two shortcuts</summary><p class="muted"><b>${esc(s.scNotes)}</b>: in the Shortcuts app tap +, add the action Append to Note, set the text to Shortcut Input and choose a shared note called Groceries. Name the shortcut exactly as above.</p><p class="muted" style="margin-top:8px"><b>${esc(s.scMsg)}</b>: new shortcut, add Send Message via WhatsApp (or Send Message for iMessage), set the message to Shortcut Input and the recipient to your partner. Name it exactly as above.</p><p class="muted" style="margin-top:8px"><b>${esc(s.scAlarm)}</b>: new shortcut with four actions. 1) Split Text: split Shortcut Input by New Lines. 2) Get Item from List: First Item. 3) Get Item from List: Last Item, from the Split Text result. 4) Create Alarm: set the time to the first item and the label to the last item. Name it exactly as above.</p><p class="muted" style="margin-top:8px">Shortcuts must exist on the device running this app. Share the Notes note with your partner so it shows on both phones. Doodles and voice notes reach WhatsApp through the Share button.</p></details></div>
  </div><div>
  <div class="card"><h2>Backup</h2><p class="muted">Save a copy of everything now and then.</p><div class="row" style="margin-top:12px"><button class="btn soft" data-a="bExport">Download backup</button><button class="btn soft" data-a="bImport">Restore backup</button><button class="btn ghost" data-a="bReset">Reset app</button></div><input type="file" id="bfile" accept="application/json,.json" hidden></div>
  </div></div>`;
}

/* ---------- shell ---------- */
const I={home:'<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  groceries:'<path d="M3 4h2.5l2.2 11h10l2-8H7"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  inv:'<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M6 10h12M9.5 6v1.5M9.5 13v3"/>',
  routines:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4"/>',
  recipes:'<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
  spin:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>',
  notes:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/>',
  settings:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'};
const TABS=[['home','Home'],['groceries','List'],['inv','Kitchen'],['recipes','Recipes'],['spin','Decide'],['routines','Routines'],['notes','Notes'],['settings','Settings']];
const VIEWS={home:vHome,groceries:vGroceries,inv:vInv,routines:vRoutines,recipes:vRecipes,spin:vSpin,notes:vNotes,settings:vSettings};
const PRIMARY=['home','groceries','inv','recipes'];
let moreOpen=false;
function renderNav(){
  if(locked())return;
  const badge={groceries:S.groceries.filter(g=>!g.done).length,routines:S.routines.filter(r=>dueIn(r)<=0).length,inv:S.inv.filter(x=>x.exp&&dayDiff(x.exp,today())<=1).length};
  const btn=([k,l],cls)=>`<button class="tab ${cls} ${tab===k?'on':''}" data-a="go" data-k="${k}"><svg viewBox="0 0 24 24">${I[k]}</svg>${l}${badge[k]?`<b>${badge[k]}</b>`:''}</button>`;
  const extra=TABS.filter(t=>!PRIMARY.includes(t[0])),eb=extra.reduce((n,t)=>n+(badge[t[0]]||0),0);
  $('#nav').innerHTML=`<div class="brand">Nest &amp;<br>Nibbles</div>`+TABS.map(t=>btn(t,PRIMARY.includes(t[0])?'':'x')).join('')
    +`<button class="tab more ${extra.some(t=>t[0]===tab)?'on':''}" data-a="more" aria-expanded="${moreOpen}"><svg viewBox="0 0 24 24">${I.more}</svg>More${eb?`<b>${eb}</b>`:''}</button>`
    +`<div class="sheet ${moreOpen?'open':''}">${extra.map(t=>btn(t,'s')).join('')}</div>`
    +`<div class="sync ${Sync.on?'on':''}"><i></i>${Sync.on?'Synced':'This device'}</div>`;
}
let loginStep='pw';
function vLogin(){
  const code=loginStep==='code';
  return `<div class="login"><div class="brandmark">Nest &amp; Nibbles</div><p class="muted" style="margin-bottom:16px">${code?'Enter the 6-digit code from your authenticator app.':'Sign in with your household account to open your home.'}</p>
  <form class="card" data-f="login">${code?`<label style="margin-top:0">Authenticator code</label><input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" required style="font-size:22px;letter-spacing:.3em;text-align:center">`
    :`<label style="margin-top:0">Email</label><input id="lem" type="email" autocomplete="username" value="${esc(L.email)}" required><label>Password</label><input id="spw" type="password" autocomplete="current-password" required>`}
  <div class="row" style="margin-top:16px">${code?'<button type="button" class="btn ghost" data-a="lBack">Back</button>':''}<button class="btn" style="flex:1">${code?'Verify':'Sign in'}</button></div><p class="muted" id="syncmsg" style="margin-top:10px">${esc(Sync.msg)}</p></form></div>`;
}
function render(){
  if(locked()){$('#nav').style.display='none';$('#view').innerHTML=vLogin();return}
  $('#nav').style.display='';
  renderNav();$('#view').innerHTML=VIEWS[tab]();
  if(tab==='spin'){drawWheel();requestAnimationFrame(()=>{const w=$('#wheel');if(w)w.style.transition=''})}
  if(tab==='notes'){padSetup();voiceUI()}
  if(tab==='settings'&&GATED)mfaStatus();
}
function modal(title,body,onSave,onDelete){
  const m=$('#modal');m.innerHTML=`<form><h2>${esc(title)}</h2>${body}<div class="row" style="margin-top:18px">${onDelete?'<button type="button" class="btn ghost" data-x="del">Delete</button>':''}<span style="flex:1"></span><button type="button" class="btn ghost" data-x="no">Cancel</button><button class="btn">Save</button></div></form>`;
  m.classList.add('on');const close=()=>{m.classList.remove('on');m.innerHTML=''};
  m.onclick=e=>{if(e.target===m||e.target.dataset.x==='no'){close();if(stale)softRender()}else if(e.target.dataset.x==='del'){close();onDelete();save();render()}};
  $('form',m).onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));close();onSave(d);save();render()};
}
const byId=(arr,id)=>arr.find(x=>x.id===id);
const lines=t=>t.split('\n').map(s=>s.trim()).filter(Boolean);

/* ---------- actions ---------- */
let resetArmed=0;
const A={
  go:d=>{tab=d.k;picked='';moreOpen=false;render();$('main').scrollTop=0},
  more:()=>{moreOpen=!moreOpen;renderNav()},
  mic:(d,b)=>mic(b),
  gTick:d=>{const g=byId(S.groceries,d.id);if(!g)return;g.done=!g.done;groceryChanged();render()},
  gDel:d=>{S.groceries=S.groceries.filter(g=>g.id!==d.id);groceryChanged();render()},
  gClear:()=>{S.groceries=S.groceries.filter(g=>!g.done);groceryChanged();render()},
  gStock:()=>{const got=S.groceries.filter(g=>g.done);for(const g of got){if(!S.inv.some(x=>norm(x.t)===norm(g.t)))S.inv.push({id:uid(),t:g.t[0].toUpperCase()+g.t.slice(1),qty:'',loc:FREEZE.test(g.t)?'freezer':FRIDGE.test(g.t)?'fridge':'pantry',exp:''})}
    S.groceries=S.groceries.filter(g=>!g.done);groceryChanged();render();toast(`${plural(got.length,'item')} put away`)},
  gSend:()=>sendGroceries(true),
  gNotes:()=>runShortcut(S.settings.scNotes,new Date().toLocaleDateString([], {weekday:'short',day:'numeric',month:'short'})+'\n'+S.groceries.filter(g=>!g.done).map(g=>'- '+g.t).join('\n')),
  gShare:()=>share({text:groceryText()}),
  iFilter:d=>{invFilter=d.k;render()},
  iOut:d=>{const x=byId(S.inv,d.id);if(!x)return;S.inv=S.inv.filter(i=>i.id!==d.id);addGroceries([x.t],true);save();render();toast(`${x.t} added to the grocery list`)},
  iEdit:d=>{const x=byId(S.inv,d.id);if(x)modal('Edit item',invForm(x),v=>Object.assign(x,v),()=>{S.inv=S.inv.filter(i=>i!==x)})},
  rNew:()=>modal('New routine',routineForm({t:'',every:7,last:today()}),v=>S.routines.push({id:uid(),...v,every:Math.max(1,+v.every||1)})),
  rEdit:d=>{const r=byId(S.routines,d.id);if(r)modal('Edit routine',routineForm(r),v=>Object.assign(r,v,{every:Math.max(1,+v.every||1)}),()=>{S.routines=S.routines.filter(i=>i!==r)})},
  rDone:d=>{const r=byId(S.routines,d.id);if(!r)return;r.last=today();save();render();toast(`${r.t} done. Next in ${plural(+r.every,'day')}.`)},
  rNudge:d=>{const r=byId(S.routines,d.id),n=dueIn(r);tgSafe('sendMessage',{...target('routines'),text:`🔔 ${r.t}: ${n<0?plural(-n,'day')+' overdue':n===0?'due today':'due in '+plural(n,'day')} (nudge from ${me()})`},'Nudge sent')},
  cNew:()=>modal('New recipe',recipeForm({t:'',ing:[]}),v=>S.recipes.push({id:uid(),t:v.t,ing:lines(v.ing)})),
  cEdit:d=>{const r=byId(S.recipes,d.id);if(r)modal('Edit recipe',recipeForm(r),v=>{r.t=v.t;r.ing=lines(v.ing)},()=>{S.recipes=S.recipes.filter(i=>i!==r)})},
  cPaste:()=>modal('Paste recipes',`<p class="muted">Recipe name on the first line, ingredients underneath, a blank line between recipes. Or one per line: <code>Name: a, b, c</code></p><textarea name="txt" rows="10" style="margin-top:10px" placeholder="Dal tadka&#10;lentils&#10;onion&#10;tomatoes&#10;&#10;Pancakes: flour, eggs, milk"></textarea>`,v=>{const rs=parseRecipes(v.txt);S.recipes.push(...rs);toast(`Added ${plural(rs.length,'recipe')}`)}),
  cAddMissing:d=>{const r=byId(S.recipes,d.id);if(r){addGroceries(recipeStatus(r).missing.filter(p=>!p.listed).map(p=>p.n));render()}},
  cSurprise:()=>{if(!S.recipes.length){toast('Add a recipe first');return}const st=ranked(),ready=st.filter(x=>!x.s.missing.length),pool=ready.length?ready:st.slice().sort((a,b)=>a.s.missing.length-b.s.missing.length).slice(0,3),p=pool[Math.floor(Math.random()*pool.length)];
    picked=p.r.id;render();toast(`Tonight: ${p.r.t}${p.s.missing.length?`. You need ${p.s.missing.length} more.`:'. You have everything.'}`);const el=$('#rc-'+p.r.id);if(el)el.scrollIntoView({behavior:'smooth',block:'center'})},
  spin,
  sMode:d=>{if(spinning)return;spinMode=d.k;spinResult='';render()},
  sTell:()=>tgSafe('sendMessage',{...target('wheel'),text:(spinMode==='out'?'🎡 The wheel has spoken. We are eating out: ':'🎡 The wheel has spoken. We are cooking: ')+spinResult},'Told the group'),
  sRecipe:()=>{const r=S.recipes.find(r=>r.t===spinResult);tab='recipes';picked=r?r.id:'';render();const el=r&&$('#rc-'+r.id);if(el)el.scrollIntoView({block:'center'})},
  eDel:d=>{S.eatout.splice(+d.i,1);save();render()},
  nDest:d=>{dest=d.k;const cap=$('#cap').value;render();$('#cap').value=cap},
  nCol:d=>{penCol=d.c;document.querySelectorAll('.sw').forEach(b=>b.classList.toggle('on',b.dataset.c===penCol))},
  nW:(d,b)=>{penW=+d.w;b.parentNode.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))},
  nUndo:()=>{strokes.pop();padSetup.draw()},
  nWipe:()=>{strokes=[];padSetup.draw()},
  nSendDoodle:async()=>{if(!strokes.length){toast('Draw something first');return}const b=await padBlob();if(await tgSafe('sendPhoto',{...destChat(),photo:[b,'doodle.png'],caption:($('#cap').value||'💌')+' · from '+me()},`Doodle sent to ${destName()}`)){strokes=[];render()}},
  nShareDoodle:async()=>{if(!strokes.length){toast('Draw something first');return}const b=await padBlob();share({files:[new File([b],'doodle.png',{type:'image/png'})],text:$('#cap').value||''})},
  vRec:async()=>{
    if(rec){rec.stop();return}
    if(!navigator.mediaDevices||!window.MediaRecorder){toast('Recording needs the app to be opened over https');return}
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true}),chunks=[];rec=new MediaRecorder(stream);
      rec.ondataavailable=e=>chunks.push(e.data);
      rec.onstop=()=>{const type=rec.mimeType||chunks[0]?.type||'audio/mp4',blob=new Blob(chunks,{type});stream.getTracks().forEach(t=>t.stop());rec=null;voice={blob,type,url:URL.createObjectURL(blob)};voiceUI()};
      rec.start();voiceUI()}catch(e){rec=null;toast('Microphone permission is needed')}},
  vClear:()=>{voice=null;voiceUI()},
  vSend:async()=>{const ogg=/ogg/.test(voice.type),ext=ogg?'ogg':/webm/.test(voice.type)?'webm':'m4a',m=ext==='webm'?'sendDocument':'sendVoice',k=ext==='webm'?'document':'voice';
    if(await tgSafe(m,{...destChat(),[k]:[voice.blob,'voice-note.'+ext],caption:'From '+me()},`Voice note sent to ${destName()}`)){voice=null;voiceUI()}},
  vShare:()=>{const ext=/ogg/.test(voice.type)?'ogg':/webm/.test(voice.type)?'webm':'m4a';share({files:[new File([voice.blob],'voice-note.'+ext,{type:voice.type})]})},
  nRemindSc:(d,b)=>{const t=b.form.t.value.trim();if(!t){toast('Write the reminder first');return}runShortcut(S.settings.scMsg,'🔔 '+t)},
  nRemindShare:(d,b)=>{const t=b.form.t.value.trim();if(!t){toast('Write the reminder first');return}share({text:'🔔 '+t})},
  who:d=>{L.who=d.k;saveL();render()},
  tTest:async()=>{if(!S.settings.chat){toast('Choose the main group first');return}
    let ok=await tgSafe('sendMessage',{chat_id:S.settings.chat,text:'🏡 Nest & Nibbles is connected!'},'Test sent');
    for(const [k,l] of KINDS){const t=target(k);if(ok&&t.message_thread_id)ok=await tgSafe('sendMessage',{...t,text:'🏡 '+l+' will be posted here.'},'Tests sent')}},
  rAlarm:d=>{const r=byId(S.routines,d.id);if(!r)return;modal('Set an alarm for today',`<p class="muted">Creates an alarm on this device through your ${esc(S.settings.scAlarm)} shortcut.</p><label>Time</label><input type="time" name="time" value="${esc(r.alarm||'18:00')}" required>`,v=>{r.alarm=v.time;setTimeout(()=>runShortcut(S.settings.scAlarm,v.time+'\n'+r.t),80)})},
  tFind:async()=>{const ti=$('#tgtoken');if(ti&&ti.value.trim()){S.settings.token=cleanToken(ti.value)||ti.value.trim();ti.value=S.settings.token;save()}
    if(!S.settings.token){toast('Paste the bot token first');return}
    const say=m=>{const o=$('#chats');if(o)o.textContent=m};say('Looking for chats…');
    try{let ups;try{ups=await tg('getUpdates',{})}catch(e){if(/webhook/i.test(e.message)){await tg('deleteWebhook',{});ups=await tg('getUpdates',{})}else throw e}
      const found={};
      for(const u of ups){const m=u.message||u.edited_message||u.channel_post||u.my_chat_member;if(!m||!m.chat)continue;
        const c=m.chat,title=c.title||[c.first_name,c.last_name].filter(Boolean).join(' ')||'Chat';
        found[c.id+'|']={id:c.id+'|',label:title,priv:c.type==='private'};
        if(m.is_topic_message&&m.message_thread_id){const nm=(m.forum_topic_created||(m.reply_to_message||{}).forum_topic_created||{}).name,id=c.id+'|'+m.message_thread_id;
          if(nm||!found[id])found[id]={id,label:title+' › '+(nm||'Topic '+m.message_thread_id),priv:false,named:!!nm}}}
      const merged={};for(const d of S.settings.dests)merged[d.id]=d;
      for(const id in found){if(merged[id]&&merged[id].named&&!found[id].named&&id.split('|')[1])continue;merged[id]=found[id]}
      S.settings.dests=Object.values(merged);
      const mains=S.settings.dests.filter(d=>!d.priv&&!d.id.split('|')[1]),topics=S.settings.dests.filter(d=>!d.priv&&d.id.split('|')[1]);
      if(!S.settings.chat&&mains.length===1)S.settings.chat=mains[0].id.split('|')[0];
      const wasHome=tab==='home';save();render();
      const msg=Object.keys(found).length?`Found ${plural(mains.length,'group')} and ${plural(topics.length,'topic')}.${topics.length?'':' To see a topic, send a message inside it and search again.'}`:'The token works, but the bot has not seen any chat yet. Remove the bot from the group, add it again, send a message in the group, then search again.';
      say(msg);if(wasHome&&tgReady())toast('Telegram connected. Choose topics in Settings.');
    }catch(e){const m=/does not look like/.test(e.message)?'T'+e.message.slice(1)+'.':/Unauthorized|Not Found/i.test(e.message)?'Telegram does not recognise that token. Copy it again from @BotFather.':/Failed to fetch|Load failed|NetworkError/i.test(e.message)?'Could not reach Telegram from this device. Check the connection or any content blocker.':'Telegram said: '+e.message;say(m);toast(m)}},
  sSign:async()=>{
    const say=m=>{const e=$('#syncmsg');if(e)e.textContent=m};
    try{
      if(loginStep==='code'){const c=$('#otp').value.replace(/\D/g,'');if(c.length<6){toast('Enter the 6-digit code');return}say('Checking…');await Sync.second(c)}
      else{const pw=$('#spw').value,em=$('#lem');if(em){L.email=em.value.trim();saveL()}
        if(!L.email||!pw){toast('Enter your email and password');return}say('Signing in…');await Sync.signIn(pw)}
      loginStep='pw';Sync.msg='';render();Sync.start(true);
    }catch(e){
      if(e.mfa){loginStep='code';Sync.msg='';render();const o=$('#otp');if(o)o.focus();return}
      Sync.state(false,loginStep==='code'?'That code was not accepted. Wait for the next one and try again.':'Sign-in failed. Check the email and password.')}},
  lBack:()=>{loginStep='pw';Sync.msg='';render()},
  mfaStart:async()=>{try{await Sync.refresh();mfa.session=(await idp('v2/accounts/mfaEnrollment:start',{idToken:Sync.tok,totpEnrollmentInfo:{}})).totpSessionInfo;mfaUI()}catch(e){mfaUI(mfaErr(e))}},
  mfaFinish:async()=>{const c=$('#mfacode').value.replace(/\D/g,'');if(c.length<6){toast('Enter the 6-digit code');return}
    try{const j=await idp('v2/accounts/mfaEnrollment:finalize',{idToken:Sync.tok,displayName:'Authenticator app',totpVerificationInfo:{sessionInfo:mfa.session.sessionInfo,verificationCode:c}});
      if(j.idToken){Sync.tok=j.idToken;L.rt=j.refreshToken;saveL()}mfa.session=null;mfa.on=true;mfaUI('Two-step sign-in is now on.');Sync.start(!!j.idToken)}catch(e){mfaUI(mfaErr(e))}},
  mfaCancel:()=>{mfa.session=null;mfaUI()},
  mfaVerify:async()=>{try{await idp('v1/accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:Sync.tok});mfaUI('Verification email sent to '+L.email+'. Open the link in it, then come back here.')}catch(e){mfaUI(mfaErr(e))}},
  sOut:()=>signOut(),
  bExport:()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));a.download='nest-and-nibbles-backup-'+today()+'.json';a.click()},
  bImport:()=>$('#bfile').click(),
  bReset:(d,b)=>{if(Date.now()-resetArmed>4000){resetArmed=Date.now();b.textContent='Tap again to erase everything';return}
    try{localStorage.removeItem(KEY)}catch(e){}S=DEFAULTS();fix();save();resetArmed=0;render();toast('App reset')}
};
const F={
  gAdd:f=>{const v=f.t.value;if(v.trim())addGroceries(splitItems(v),true);render();$('#gin').focus()},
  iAdd:f=>{const t=f.t.value.trim();if(!t)return;S.inv.push({id:uid(),t:t[0].toUpperCase()+t.slice(1),qty:f.qty.value.trim(),loc:f.loc.value,exp:''});save();render();$('[data-f=iAdd] input').focus()},
  eAdd:f=>{const t=f.t.value.trim();if(!t)return;S.eatout.push(t);save();render()},
  login:()=>A.sSign(),
  nRemind:async f=>{if(await tgSafe('sendMessage',{...destChat(),text:'🔔 '+f.t.value.trim()+'\nfrom '+me()},`Reminder sent to ${destName()}`))f.reset()}
};
document.addEventListener('click',e=>{if(moreOpen&&!e.target.closest('.sheet,.more')){moreOpen=false;renderNav()}
  const b=e.target.closest('[data-a]');if(b&&A[b.dataset.a]){if(b.type!=='submit')e.preventDefault();A[b.dataset.a](b.dataset,b)}});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-f]');if(f){e.preventDefault();F[f.dataset.f](f)}});
document.addEventListener('change',e=>{
  const k=e.target.dataset.s,l=e.target.dataset.l;
  if(k){S.settings[k]=e.target.type==='checkbox'?e.target.checked:e.target.value.trim();save();if(/^(a|b|scNotes|scMsg)$/.test(k))stale=true}
  if(l){L[l]=e.target.value.trim();saveL()}
  const rt=e.target.dataset.r;if(rt){S.settings.route={...S.settings.route,[rt]:e.target.value};save()}
  if(e.target.id==='bfile'&&e.target.files[0]){e.target.files[0].text().then(t=>{const d=JSON.parse(t);if(!d.settings||!d.groceries)throw 0;S={...DEFAULTS(),...d};fix();save();render();toast('Backup restored')}).catch(()=>toast('That file is not a Nest & Nibbles backup'))}
});
addEventListener('resize',()=>{if(tab==='spin')drawWheel();if(tab==='notes')padSetup()});

/* morning digest of due routines (only fires while the app is open somewhere) */
function digest(){
  if(locked()||!S.settings.digest||!tgReady()||S.lastDigest===today()||new Date().getHours()<8)return;
  const due=S.routines.filter(r=>dueIn(r)<=0);S.lastDigest=today();save();if(!due.length)return;
  tg('sendMessage',{...target('routines'),text:'🏡 Today around the nest:\n'+due.map(r=>`• ${r.t}${dueIn(r)<0?` (${plural(-dueIn(r),'day')} overdue)`:''}`).join('\n')}).catch(()=>{});
}
setInterval(()=>{digest();if(busy())renderNav();else render()},30*60*1000);
local();render();
Sync.start().then(()=>setTimeout(digest,Sync.ready()?4000:0));
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(tab==='spin')drawWheel()});

/* home-screen icon */
try{const c=document.createElement('canvas');c.width=c.height=180;const x=c.getContext('2d');
  x.fillStyle='#8c6293';x.fillRect(0,0,180,180);x.fillStyle='#f5f5f5';x.beginPath();x.moveTo(90,38);x.lineTo(146,84);x.lineTo(146,142);x.lineTo(34,142);x.lineTo(34,84);x.closePath();x.fill();
  x.fillStyle='#d3782b';x.beginPath();x.arc(90,108,18,0,7);x.fill();$('#touchicon').href=c.toDataURL('image/png')}catch(e){}
