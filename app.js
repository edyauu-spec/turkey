(function(){
'use strict';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var params=new URLSearchParams(location.search);
var DAY0=Date.UTC(2026,9,25), GAP=12;
var CITY={cap:'goreme',sel:'selcuk',pam:'pamukkale',ist:'istanbul',ret:'istanbul'};
var GROUPS=[['cap','哥雷梅（Göreme）D1–4'],['sel','塞爾丘克（Selçuk）D5–6'],['pam','棉花堡（Pamukkale）D7'],['ist','伊斯坦堡（Istanbul）D8–12'],['ret','返程 D13–14']];
var WIN={goreme:['2026-10-25','2026-10-29'],selcuk:['2026-10-29','2026-10-31'],pamukkale:['2026-10-31','2026-11-01'],istanbul:['2026-11-01','2026-11-06']};
var D=null, idx=-99, home=0, cur=0, WX=null, WXC=null, WXT=0;

function store(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){return null}}
function p2(n){return (n<10?'0':'')+n}
function b64(s){var b=atob(s),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a}
function toB64(buf){var a=new Uint8Array(buf),s='';for(var i=0;i<a.length;i++)s+=String.fromCharCode(a[i]);return btoa(s)}

/* ---------- time (Istanbul) ---------- */
function ist(){
  var o=params.get('now'),m;
  if(o&&(m=o.match(/^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/)))return {y:+m[1],mo:+m[2],d:+m[3],h:+(m[4]||12),mi:+(m[5]||0)};
  var f=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Istanbul',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date()),g={};
  f.forEach(function(p){g[p.type]=p.value});
  return {y:+g.year,mo:+g.month,d:+g.day,h:(+g.hour)%24,mi:+g.minute};
}
function dayIdx(n){return Math.round((Date.UTC(n.y,n.mo-1,n.d)-DAY0)/864e5)}

/* ---------- crypto ---------- */
async function load(){
  var r=await fetch('data.enc.json',{cache:'no-cache'}); if(!r.ok)throw new Error('load');
  return r.json();
}
async function deriveKey(pass,E){
  var km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(E.salt),iterations:E.iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},true,['decrypt']);
}
async function open(key,E){
  var buf=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(E.iv)},key,b64(E.ct));
  return JSON.parse(new TextDecoder().decode(buf));
}
async function tryRemembered(E){
  var k=store('tr_k'); if(!k)return null;
  try{var key=await crypto.subtle.importKey('raw',b64(k),{name:'AES-GCM'},false,['decrypt']);return await open(key,E)}catch(e){store('tr_k',null);return null}
}

/* ---------- boot ---------- */
var ENC=null;
async function boot(){
  if('serviceWorker' in navigator){try{navigator.serviceWorker.register('sw.js')}catch(e){}}
  if(!window.crypto||!crypto.subtle){$('#err').textContent='這個瀏覽器環境不支援加密（請用 https 網址開啟）';return}
  try{ENC=await load()}catch(e){$('#err').textContent='無法載入資料，請連線後重試';return}
  var d=await tryRemembered(ENC);
  if(d){start(d);return}
  $('#lock').hidden=false; $('#pw').focus();
}
$('#lf').addEventListener('submit',async function(ev){
  ev.preventDefault(); var btn=$('#go'); $('#err').textContent=''; btn.disabled=true; btn.textContent='解鎖中…';
  try{
    var key=await deriveKey($('#pw').value.trim(),ENC), d=await open(key,ENC);
    if($('#rem').checked){store('tr_k',toB64(await crypto.subtle.exportKey('raw',key)))}
    $('#pw').value=''; start(d);
  }catch(e){$('#err').textContent='密碼不正確';}
  btn.disabled=false; btn.textContent='開啟';
});

/* ---------- start ---------- */
function start(data){
  D=data; $('#lock').hidden=true; $('#app').hidden=false;
  buildToday(); buildItin(); buildBook(); $('#mapbox').innerHTML=D.map; $('#budget').innerHTML=D.budget;
  $('#sub-tips').innerHTML=D.tips; buildPhrases(); buildMe(); buildWx();
  var n=ist(); idx=dayIdx(n); home=Math.max(0,Math.min(13,idx)); cur=home;
  refresh(true);
  wireTabs();
  setInterval(function(){refresh(false);fetchWx()},30000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden){refresh(false);fetchWx()}});
  window.addEventListener('online',function(){fetchWx(true)});
}

/* ---------- Today carousel ---------- */
function buildToday(){
  var car=$('#car'),dots=$('#dots'); car.innerHTML=''; dots.innerHTML='';
  D.days.forEach(function(html,i){
    var s=document.createElement('div'); s.className='slide'; s.dataset.i=i;
    var note=(i===0||i===13)?'<p class="tznote">這天跨時區（香港 UTC+8／土耳其 UTC+3），時間軸為示意，請以上方卡片與機票時間為準。</p>':'';
    s.innerHTML='<span class="chip"></span>'+html+'<p class="tl-t">時間軸<small>實色＝已排定；虛線淺色＝可選加碼；點事件可加入日曆</small></p>'+note+D.cals[i];
    $$('.cal-event',s).forEach(function(e){e.setAttribute('role','button');e.tabIndex=0;e.setAttribute('aria-label','加入日曆：'+e.textContent)});
    car.appendChild(s);
    var b=document.createElement('button'); b.type='button'; b.setAttribute('aria-label',D.titles[i].n+' '+D.titles[i].date);
    b.style.setProperty('--c','var(--'+D.titles[i].key+')'); b.dataset.i=i; dots.appendChild(b);
  });
  dots.addEventListener('click',function(e){var b=e.target.closest('button');if(b)goTo(+b.dataset.i,true)});
  var tick=false;
  car.addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;cur=curIdx();paintDots()})},{passive:true});
  $('#back').addEventListener('click',function(){goTo(home,true);scrollNow()});
  car.addEventListener('click',function(e){var el=e.target.closest('.cal-event');if(el)openSheet(+el.closest('.slide').dataset.i,el)});
  car.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('cal-event')){e.preventDefault();openSheet(+e.target.closest('.slide').dataset.i,e.target)}});
}
function step(){var s=$('.slide');return s?s.offsetWidth+GAP:1}
function curIdx(){var car=$('#car');return Math.max(0,Math.min(13,Math.round(car.scrollLeft/step())))}
function goTo(i,smooth){
  i=Math.max(0,Math.min(13,i)); cur=i; var car=$('#car');
  if(smooth&&car.scrollTo)car.scrollTo({left:i*step(),behavior:'smooth'});else car.scrollLeft=i*step();
  paintDots();
}
var NOW=null, nowHtml='';
function paintNow(){
  if(!NOW)return;
  var w=idx>13?'':wxDay(cur), h=NOW.head+(NOW.nx?'<span class="nx">'+NOW.nx+'</span>':'')+(w?'<span class="nx wxl">'+w+'</span>':'');
  if(h!==nowHtml){nowHtml=h;$('#now').innerHTML=h}
}
function paintDots(){
  paintNow();
  $$('#dots button').forEach(function(b,i){b.classList.toggle('on',i===cur);b.classList.toggle('t',i===idx)});
  $('#back').hidden=(cur===home)||$('#tab-today').hidden;
}
function evInfo(e){
  var t=(e.querySelector('b')||{}).textContent||'', m=t.match(/^(\d\d):(\d\d)/);
  var top=parseFloat(e.style.top),h=parseFloat(e.style.height);
  return {el:e,start:m?(+m[1]*60+ +m[2]):null,top:top,end:top+h,label:e.textContent.replace(t,'').trim(),time:t};
}
function refresh(first){
  var n=ist(); idx=dayIdx(n); var mins=n.h*60+n.mi, hm=p2(n.h)+':'+p2(n.mi);
  $$('.slide').forEach(function(s){
    var i=+s.dataset.i,c=$('.chip',s);
    s.classList.toggle('past',i<idx);
    var txt='';
    if(idx<0)txt=D.titles[i].n+(i===0?' · 出發前 '+(-idx)+' 天':'');
    else if(i<idx)txt=D.titles[i].n+' · 已過';
    else if(i===idx)txt=D.titles[i].n+' · 今天';
    else txt=D.titles[i].n+' · '+(i-idx)+' 天後';
    c.textContent=txt; c.classList.toggle('today',i===idx);
    $$('.cal-now',s).forEach(function(x){x.remove()});
    $$('.cal-event',s).forEach(function(e){e.classList.remove('done')});
  });
  var nx='',head='';
  var T=idx>=0&&idx<=13?D.titles[idx]:null;
  if(idx<0){
    head='<b>'+(idx===-1?'明天出發！':'距離出發還有 '+(-idx)+' 天')+'</b>';
    nx='10/25 香港 09:45 起飛（TK171）· 土耳其現在 '+hm;
  }else if(idx>13){
    head='<b>旅程完結，歡迎回家</b>'; nx='';
  }else{
    head='<b>今天 '+T.n+' · '+T.date+'</b> · 土耳其 '+hm;
    var s=$('.slide[data-i="'+idx+'"]');
    if(idx!==0&&idx!==13&&mins>=240&&mins<1440){
      var pct=(mins-240)/1200*100, tr=$('.cal-track',s);
      if(tr){var nl=document.createElement('div');nl.className='cal-now';nl.style.top=pct+'%';nl.innerHTML='<span>'+hm+'</span>';tr.appendChild(nl)}
      var evs=$$('.cal-event:not(.sugg)',s).map(evInfo);
      evs.forEach(function(e){if(e.end<=pct)e.el.classList.add('done')});
      var run=evs.filter(function(e){return e.top<=pct&&pct<e.end}).pop();
      var nxt=evs.filter(function(e){return e.start!==null&&e.start>mins}).sort(function(a,b){return a.start-b.start})[0];
      if(run)nx='進行中：'+run.label; else if(nxt)nx='下一個 '+nxt.time+' '+nxt.label; else nx='今天的排定行程已完成';
    }
  }
  NOW={head:head,nx:nx}; nowHtml='';
  home=Math.max(0,Math.min(13,idx));
  if(first){goTo(home,false);setTimeout(function(){goTo(home,false);scrollNow()},60)}
  paintDots();
  paintItin();
}
function scrollNow(){
  var nl=$('.cal-now'); if(!nl||$('#tab-today').hidden)return;
  var r=nl.getBoundingClientRect(); window.scrollTo({top:Math.max(0,window.scrollY+r.top-window.innerHeight*0.45),behavior:'smooth'});
}

/* ---------- Add to calendar (.ics / Google Calendar) ---------- */
var TZ_IST=3, TZ_HK=8;
function calTimes(i,start,dur,label){
  var base=DAY0+i*864e5, tz=TZ_IST, etz=TZ_IST;
  if(i===0&&start<720){tz=etz=TZ_HK}
  if(i===13){tz=etz=TZ_HK}
  var s=base+start*6e4-tz*36e5, e=base+(start+dur)*6e4-etz*36e5;
  if(/TK171/.test(label)){e=base+(16*60+45)*6e4-TZ_IST*36e5;etz=TZ_IST}              /* 09:45 HKG -> 16:45 IST */
  if(/TK170/.test(label)){e=base+864e5+(8*60+5)*6e4-TZ_HK*36e5;etz=TZ_HK}            /* 17:05 IST -> 08:05 HKG next day */
  return {s:s,e:e,tz:tz,etz:etz};
}
function hmAt(ms,tz){var d=new Date(ms+tz*36e5);return p2(d.getUTCHours())+':'+p2(d.getUTCMinutes())}
function utcStamp(ms){var d=new Date(ms);return d.getUTCFullYear()+p2(d.getUTCMonth()+1)+p2(d.getUTCDate())+'T'+p2(d.getUTCHours())+p2(d.getUTCMinutes())+p2(d.getUTCSeconds())+'Z'}
function calEvent(i,el){
  var f=evInfo(el), dur=Math.max(15,Math.round((f.end-f.top)*12)), t=D.titles[i];
  if(f.start===null)return null;
  var tm=calTimes(i,f.start,dur,f.label), plain=function(h){return String(h).replace(/<[^>]*>/g,'')};
  var desc=t.n+' · '+t.date+' · '+plain(t.title)+(el.dataset.note?'\n'+el.dataset.note:'')+(el.classList.contains('sugg')?'\n（可選行程）':'')+'\n土耳其之旅 App';
  return {i:i,s:tm.s,e:tm.e,tz:tm.tz,etz:tm.etz,title:f.label,loc:el.dataset.loc||'',desc:desc,key:'d'+i+'-'+f.start,sugg:el.classList.contains('sugg')};
}
function icsEsc(x){return String(x).replace(/\\/g,'\\\\').replace(/;/g,'\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
function icsFold(line){
  var enc=new TextEncoder(),out=[],cur='',n=0,lim=75;
  for(var ch of line){var b=enc.encode(ch).length;if(n+b>lim){out.push(cur);cur='';n=0;lim=74}cur+=ch;n+=b}
  out.push(cur);return out.join('\r\n ');
}
function buildIcs(list){
  var L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Turkey Trip 2026//ZH//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'], now=utcStamp(Date.now());
  list.forEach(function(e){
    L.push('BEGIN:VEVENT','UID:'+e.key+'@turkey-trip-2026','DTSTAMP:'+now,'DTSTART:'+utcStamp(e.s),'DTEND:'+utcStamp(e.e),'SUMMARY:'+icsEsc(e.title));
    if(e.loc)L.push('LOCATION:'+icsEsc(e.loc));
    L.push('DESCRIPTION:'+icsEsc(e.desc),'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(e.title),'END:VALARM','END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n')+'\r\n';
}
function googleUrl(e){
  var q=encodeURIComponent;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+q(e.title)+'&dates='+utcStamp(e.s)+'/'+utcStamp(e.e)+'&details='+q(e.desc)+(e.loc?'&location='+q(e.loc):'');
}
function sendIcs(name,text){
  var ua=navigator.userAgent||'', ios=/iP(hone|ad|od)/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),
      standalone=(window.navigator.standalone===true)||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);
  try{
    var file=new File([text],name,{type:'text/calendar'});
    if((ios&&standalone)&&navigator.canShare&&navigator.canShare({files:[file]})){navigator.share({files:[file],title:name}).catch(function(){});return}
  }catch(e){}
  if(ios&&!standalone){location.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(text);return}
  var u=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'})), a=document.createElement('a');
  a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},5000);
}
function closeSheet(){var s=$('#sheet');if(s)s.remove();document.removeEventListener('keydown',sheetKey)}
function sheetKey(e){if(e.key==='Escape')closeSheet()}
function openSheet(i,el){
  var ev=calEvent(i,el); if(!ev)return; closeSheet();
  var slide=el.closest('.slide'), t=D.titles[i], when=t.date+' '+hmAt(ev.s,ev.tz)+'–'+hmAt(ev.e,ev.etz);
  var zone=function(z){return z===TZ_HK?'香港時間':'土耳其時間'};
  when+=' · '+(ev.tz===ev.etz?zone(ev.tz):'出發'+zone(ev.tz)+'／抵達'+zone(ev.etz));
  var all=$$('.cal-event:not(.sugg)',slide).map(function(x){return calEvent(i,x)}).filter(function(x){return x&&!/^(起床|就寢)/.test(x.title)});
  var h='<div class="sheet-bg" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="加入日曆">'+
    '<div class="sh-grip"></div><p class="sh-k">'+t.n+(ev.sugg?' · 可選行程':'')+'</p><h3>'+esc(ev.title)+'</h3><p class="sh-when">'+esc(when)+'</p>'+
    (ev.loc?'<p class="sh-loc">'+esc(ev.loc)+'</p>':'')+
    '<button type="button" class="btn" data-a="ics">加入手機日曆（.ics）</button>'+
    '<a class="btn ghost" data-a="g" target="_blank" rel="noopener" href="'+esc(googleUrl(ev))+'">用 Google 日曆開啟</a>'+
    (all.length>1?'<button type="button" class="btn ghost" data-a="day">加入 '+t.n+' 全部已排定行程（'+all.length+' 項）</button>':'')+
    '<p class="sh-hint">會以土耳其時間換算成你手機的時區，並在開始前 30 分鐘提醒。若 iPhone 沒有彈出日曆，請改用 Google 日曆，或在分享選單選「日曆」。</p>'+
    '<button type="button" class="sh-x" data-close>關閉</button></div>';
  var box=document.createElement('div'); box.id='sheet'; box.innerHTML=h; document.body.appendChild(box);
  box.addEventListener('click',function(e){
    if(e.target.closest('[data-close]')){closeSheet();return}
    var b=e.target.closest('button[data-a]'); if(!b)return;
    if(b.dataset.a==='ics')sendIcs('turkey-'+t.n+'-'+ev.key+'.ics',buildIcs([ev]));
    if(b.dataset.a==='day')sendIcs('turkey-'+t.n+'.ics',buildIcs(all));
  });
  document.addEventListener('keydown',sheetKey);
  var f=$('.btn',box); if(f)f.focus();
}
window.__cal={calEvent:calEvent,buildIcs:buildIcs,googleUrl:googleUrl,calTimes:calTimes};

/* ---------- Tabs ---------- */
var tabState={};
function showTab(t){
  $$('#tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===t)});
  $$('.pane').forEach(function(p){p.hidden=(p.id!=='tab-'+t)});
  window.scrollTo(0,0);
  if(t==='today'){goTo(cur,false);paintDots();}
  else $('#back').hidden=true;
}
function wireTabs(){
  $('#tabs').addEventListener('click',function(e){var b=e.target.closest('button');if(b)showTab(b.dataset.tab)});
  $$('.seg button').forEach(function(b){b.addEventListener('click',function(){
    $$('.seg button').forEach(function(x){x.classList.toggle('on',x===b)});
    $$('#tab-more .sub').forEach(function(s){s.hidden=(s.id!=='sub-'+b.dataset.sub)});
  })});
}

/* ---------- Itinerary list ---------- */
function buildItin(){
  var h='<h2>14 天總覽</h2><p class="hint">點任何一天，跳到「今日」的該日詳情</p>';
  GROUPS.forEach(function(g){
    h+='<div class="grp">'+g[1]+'</div>';
    D.titles.forEach(function(t,i){if(t.key===g[0])h+='<button type="button" class="row" data-i="'+i+'" style="--c:var(--'+t.key+')"><b>'+t.n+'</b><span class="tt">'+t.title+'<small>'+t.date+'</small></span></button>'});
  });
  $('#itin').innerHTML=h;
  $('#itin').addEventListener('click',function(e){var b=e.target.closest('.row');if(!b)return;cur=+b.dataset.i;showTab('today')});
}
function paintItin(){$$('#itin .row').forEach(function(r,i){var k=+r.dataset.i;r.classList.toggle('today',k===idx);r.classList.toggle('past',k<idx)})}

/* ---------- Bookings + checklist ---------- */
function chkState(){try{return JSON.parse(store('tr_chk')||'{}')}catch(e){return {}}}
function buildBook(){
  var st=chkState(),h='<h2>預訂與待辦</h2><p class="hint">勾選只存在這部手機，你和同行者各自獨立</p><div id="prog" class="prog"></div><div class="bar"><i id="barfill"></i></div>';
  D.todo.forEach(function(g,gi){
    h+='<div class="panel" style="--c:var(--'+['cap','sel','pam'][gi%3]+')"><h3>'+g.g+'</h3>';
    g.items.forEach(function(it){h+='<label class="chk"><input type="checkbox" data-k="'+it.k+'"'+(st[it.k]?' checked':'')+'><span>'+it.t+'</span></label>'});
    h+='</div>';
  });
  h+=D.panels[0]+D.panels[1]+D.hotels+D.panels[2]+D.panels[3];
  $('#book').innerHTML=h; paintProg();
  $('#book').addEventListener('change',function(e){
    var k=e.target.dataset&&e.target.dataset.k; if(!k)return;
    var s=chkState(); if(e.target.checked)s[k]=1;else delete s[k];
    store('tr_chk',JSON.stringify(s)); paintProg();
  });
}
function paintProg(){
  var all=$$('#book input[data-k]'),done=all.filter(function(x){return x.checked}).length;
  $('#prog').innerHTML='待辦完成 <b>'+done+' / '+all.length+'</b>';
  $('#barfill').style.width=(all.length?done/all.length*100:0)+'%';
}

/* ---------- Phrases ---------- */
function esc(s){return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function buildPhrases(){
  var el=$('#sub-phr');
  var h='<input id="q" type="search" placeholder="搜尋（中文或土耳其文）" aria-label="搜尋"><p class="hint">點一句會放大，可直接給當地人看</p><div id="plist"></div>';
  el.innerHTML=h;
  function draw(q){
    q=(q||'').trim().toLowerCase(); var o='';
    D.phrases.forEach(function(g){
      var it=g.items.filter(function(p){return !q||(p.zh+p.tr+p.py).toLowerCase().indexOf(q)>-1});
      if(!it.length)return;
      o+='<div class="panel" style="--c:var(--ist)"><h3>'+g.g+'</h3>'+it.map(function(p){
        return '<div class="ph" data-t="'+esc(p.tr)+'" data-z="'+esc(p.zh)+'" role="button" tabindex="0"><span class="zh">'+p.zh+'</span><span class="tr">'+p.tr+'</span><span class="py">唸法：'+p.py+'</span></div>'}).join('')+'</div>';
    });
    $('#plist').innerHTML=o||'<p class="hint">沒有符合的句子</p>';
  }
  draw('');
  $('#q').addEventListener('input',function(){draw(this.value)});
  el.addEventListener('click',function(e){var p=e.target.closest('.ph');if(!p)return;big(p.dataset.z,p.dataset.t)});
  el.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('ph')){e.preventDefault();big(e.target.dataset.z,e.target.dataset.t)}});
}
function big(zh,tr){
  var o=document.createElement('div'); o.className='big'; o.setAttribute('role','dialog');
  o.innerHTML='<div><p>'+esc(tr)+'</p><small>'+esc(zh)+'</small></div>';
  o.addEventListener('click',function(){o.remove()}); document.body.appendChild(o);
}

/* ---------- Install / settings ---------- */
function buildMe(){
  $('#sub-me').innerHTML='<div class="panel" style="--c:var(--sel)"><h3>安裝到手機</h3><ul>'+
  '<li><b>iPhone（Safari）：</b>按底部分享鍵 → 「加入主畫面」。從主畫面開啟後，沒有網絡也能用。</li>'+
  '<li><b>Android（Chrome）：</b>右上角 ⋮ → 「安裝應用程式」或「加到主畫面」。</li>'+
  '<li>第一次請在有網絡時開啟並輸入密碼，之後離線也能看（天氣預報除外）。</li></ul></div>'+
  '<div class="panel" style="--c:var(--ret)"><h3>設定</h3><p class="hint">時間以土耳其時間（UTC+3）判斷「今天」。</p>'+
  '<p><button class="btn ghost" id="upd" type="button">更新到最新版</button> <button class="btn" id="lk" type="button">鎖定</button></p></div>';
  $('#upd').addEventListener('click',async function(){
    try{var ks=await caches.keys();await Promise.all(ks.map(function(k){return caches.delete(k)}));var rs=await navigator.serviceWorker.getRegistrations();rs.forEach(function(r){r.unregister()})}catch(e){}
    location.reload();
  });
  $('#lk').addEventListener('click',function(){store('tr_k',null);location.reload()});
}

/* ---------- Weather ---------- */
var WCODE=function(c){return c===0?'☀️':c<=2?'🌤':c===3?'☁️':c<=48?'🌫':c<=57?'🌦':c<=67?'🌧':c<=77?'❄️':c<=82?'🌧':'⛈'};
function iso(n){return n.y+'-'+p2(n.mo)+'-'+p2(n.d)}
function dayIso(i){var t=new Date(DAY0+i*864e5);return t.getUTCFullYear()+'-'+p2(t.getUTCMonth()+1)+'-'+p2(t.getUTCDate())}
/* weather line for day i of the trip: live temp only for today; other days are labelled so it's clear which day it is */
function wxDay(i){
  var T=D.titles[i], city=CITY[T.key], isToday=(i===idx), lbl=isToday?'':T.n+' '+T.date+' 天氣 ';
  var dd=WX&&WX[city], k=dd?dd.time.indexOf(dayIso(i)):-1;
  if(k<0)return idx<=i&&WXT?lbl+'暫無預報（預報最多涵蓋未來 16 天）':'';
  if(i<idx)return '';
  var stale=Date.now()-WXT>WX_STALE, c=WXC&&WXC[city];
  var nowT=(isToday&&c&&!stale)?'現在 '+Math.round(c.temperature_2m)+'° · ':'';
  return lbl+nowT+WCODE(dd.weather_code[k])+' '+Math.round(dd.temperature_2m_max[k])+'°/'+Math.round(dd.temperature_2m_min[k])+'° · 降雨 '+(dd.precipitation_probability_max[k]||0)+'%'+(stale?' · <small>'+wxAge()+'的預報</small>':'');
}
function buildWx(){
  var h='<p class="hint">下方「典型氣候」是 10 月底至 11 月初的大約範圍，不是預報；有網絡時會附上實際預報（最多未來 16 天），每次開啟 App 及每 30 分鐘自動更新。</p><p class="hint" id="wx-upd"></p>';
  D.climate.forEach(function(c){
    h+='<div class="wx" id="wx-'+c.id+'"><h3>'+c.name+'</h3><p class="d">'+c.days+'</p><p class="cur" hidden></p><p><span class="ty">典型 '+c.typ+'</span>（日高／夜低）<br>'+c.note+'</p><div class="fc" hidden></div></div>';
  });
  $('#sub-wx').innerHTML=h;
  var cached=store('tr_wx'); try{if(cached){cached=JSON.parse(cached);WX=cached.d;WXC=cached.c||null;WXT=cached.t||0;paintWx()}}catch(e){}
  fetchWx(true);
}
var WX_TTL=18e5, WX_STALE=3*36e5, wxBusy=false;
function fetchWx(force){
  if(wxBusy||(!force&&WXT&&Date.now()-WXT<WX_TTL))return;
  if(navigator.onLine===false)return;
  wxBusy=true;
  var q=D.climate,lat=q.map(function(c){return c.lat}).join(','),lon=q.map(function(c){return c.lon}).join(',');
  var u='https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&current=temperature_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FIstanbul&forecast_days=16';
  fetch(u,{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
    if(!Array.isArray(j))j=[j]; var d={},cc={};
    q.forEach(function(c,i){if(j[i]&&j[i].daily)d[c.id]=j[i].daily;if(j[i]&&j[i].current)cc[c.id]=j[i].current});
    if(!Object.keys(d).length)throw 0;
    WX=d; WXC=cc; WXT=Date.now(); store('tr_wx',JSON.stringify({t:WXT,d:d,c:cc})); paintWx(); refresh(false);
  }).catch(function(){paintWx()}).then(function(){wxBusy=false});
}
function wxAge(){
  if(!WXT)return '';
  var m=Math.round((Date.now()-WXT)/6e4);
  return m<1?'剛剛':m<60?m+' 分鐘前':m<1440?Math.round(m/60)+' 小時前':Math.round(m/1440)+' 天前';
}
function paintWx(){
  var up=$('#wx-upd');
  if(up)up.textContent=WXT?'預報更新於 '+wxAge()+(Date.now()-WXT>WX_STALE?'（未能連線更新，資料可能已過時）':''):'';
  if(!WX)return;
  var today=iso(ist());
  D.climate.forEach(function(c){
    var dd=WX[c.id],box=$('#wx-'+c.id+' .fc'),cu=$('#wx-'+c.id+' .cur'); if(!dd||!box)return;
    var now=WXC&&WXC[c.id];
    if(cu){cu.hidden=!now||Date.now()-WXT>WX_STALE;if(now)cu.innerHTML='現在 '+WCODE(now.weather_code)+' <b>'+Math.round(now.temperature_2m)+'°</b>（體感 '+Math.round(now.apparent_temperature)+'°）'}
    var w=WIN[c.id],h='';
    dd.time.forEach(function(t,i){
      if(t<w[0]||t>w[1]||t<today)return;
      h+='<div><b>'+t.slice(5).replace('-','/')+'</b><em>'+WCODE(dd.weather_code[i])+'</em>'+Math.round(dd.temperature_2m_max[i])+'°/'+Math.round(dd.temperature_2m_min[i])+'°<br>'+(dd.precipitation_probability_max[i]||0)+'%</div>';
    });
    box.hidden=!h; box.innerHTML=h;
  });
}
boot();
})();
