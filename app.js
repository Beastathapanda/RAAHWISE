const CFG={OSRM:'https://router.project-osrm.org',NOM:'https://nominatim.openstreetmap.org',OVP:'https://overpass-api.de/api/interpreter'};
const $=i=>document.getElementById(i),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=(m,ms=3500)=>{const t=$('toast');t.textContent=m;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',ms)};
const ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{toast('Could not save in this browser.')}};
const hav=(a,b)=>{const R=6371e3,r=x=>x*Math.PI/180,dA=r(b[0]-a[0]),dB=r(b[1]-a[1]),h=Math.sin(dA/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dB/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
async function fj(u,opt={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),30000);try{const r=await fetch(u,{...opt,signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
// tabs
[['route','Route'],['pin','Safety Pin'],['rep','Report'],['help','Nearby'],['sos','Contacts'],['info','Data']].forEach(([k,n])=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>tab(k);b.dataset.k=k;$('tabs').append(b)});
function tab(k){document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id=='p-'+k));document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.k==k))}tab('route');
// map
const map=L.map('map').setView([26.8426,75.5659],12);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
const rl=L.layerGroup().addTo(map),fl=L.layerGroup().addTo(map),pl=L.layerGroup().addTo(map),ml=L.layerGroup().addTo(map);let pin=null;
const icon=(e,c)=>L.divIcon({className:'',html:`<div class="mk" style="border-color:${c}">${e}</div>`,iconSize:[30,30],iconAnchor:[15,15]});
map.on('click',e=>{pin=[e.latlng.lat,e.latlng.lng];pl.clearLayers();L.marker(pin,{icon:icon('📍','#2dd4bf')}).addTo(pl).bindPopup(`<b>Selected spot</b><br>${pin[0].toFixed(5)}, ${pin[1].toFixed(5)}<br><button class="btn" onclick="checkPin()">Check Safety Here</button> <button class="btn s" onclick="tab('rep');map.closePopup()">Report here</button>`).openPopup();$('rloc').textContent='Location: '+pin.map(x=>x.toFixed(5)).join(', ');$('rloc').className='note'});
// geocode
let cache={},tm;
['o','d'].forEach(id=>$(id).addEventListener('input',()=>{clearTimeout(tm);const v=$(id).value.trim();if(v.length<3)return;tm=setTimeout(async()=>{try{const r=await fj(`${CFG.NOM}/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(v)}`);$('dl').innerHTML='';r.forEach(x=>{cache[x.display_name]=[+x.lat,+x.lon];$('dl').innerHTML+=`<option value="${esc(x.display_name)}">`})}catch{}},700)}));
async function place(id){const v=$(id).value.trim();if(!v)throw new Error('Enter both a start and a destination.');if(cache[v])return cache[v];const m=v.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);if(m)return[+m[1],+m[2]];const r=await fj(`${CFG.NOM}/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(v)}`);if(!r.length)throw new Error('No place found for “'+v+'”.');return cache[v]=[+r[0].lat,+r[0].lon]}
function useMe(){if(!navigator.geolocation)return toast('Location is not supported on this device.');navigator.geolocation.getCurrentPosition(p=>{$('o').value=p.coords.latitude.toFixed(5)+', '+p.coords.longitude.toFixed(5)},e=>toast('Location permission denied or unavailable. Type a start place instead.'),{enableHighAccuracy:true,timeout:15000})}
// overpass
const oc={};async function ovp(q){if(oc[q])return oc[q];const r=await fj(CFG.OVP,{method:'POST',body:'data='+encodeURIComponent(q)});return oc[q]=r.elements||[]}
const FAC='nwr["amenity"~"^(police|hospital|clinic|pharmacy)$"]';
// reports
const reps=()=>ls('rw_reps',[]);const stat=r=>(r.yes>=3||r.no>=3)?'Under review':'Unverified';
function drawReps(){ml.clearLayers();const L2=reps();L2.forEach(r=>{const s=stat(r);L.marker([r.lat,r.lng],{icon:icon('⚠️',s=='Unverified'?'#facc15':'#f59e0b'),title:r.title}).addTo(ml).bindPopup(`<b>${esc(r.title)}</b><br>${esc(r.cat)} · severity ${['','minor','significant','critical'][r.sev]}<br><span class="badge" style="color:#000">${s}</span> (not officially verified)<br>${esc(r.desc)}<br><small>Observed ${esc(r.obs)}</small><br><button onclick="vote('${r.id}','yes')">Still there (${r.yes})</button> <button onclick="vote('${r.id}','no')">Outdated/incorrect (${r.no})</button>`)});
$('rlist').innerHTML=L2.length?L2.slice().reverse().map(r=>`<div class="card" onclick="map.setView([${r.lat},${r.lng}],17)"><b>${esc(r.title)}</b> <span class="badge">${stat(r)}</span><div class="note">${esc(r.cat)} · ${esc(r.obs)}</div></div>`).join(''):'<p class="note">No reports yet. Tap the map to add the first one.</p>'}
function addRep(){if(!pin)return toast('Tap the map first to choose a location.');const t=$('rt').value.trim(),d=$('rd').value.trim();if(t.length<3)return toast('Add a short title (3+ characters).');if(!$('ro').value)return toast('Enter when you observed this.');
const a=reps(),hr=Date.now()-36e5,rec=JSON.parse(localStorage.getItem('rw_rate')||'[]').filter(x=>x>hr);if(rec.length>=5)return toast('Limit: 5 reports per hour. Please try later.');
const dup=a.find(r=>r.cat==$('rc').value&&hav([r.lat,r.lng],pin)<30&&stat(r)!='Rejected');if(dup){dup.yes++;sv('rw_reps',a);drawReps();return toast('Similar report already exists nearby. Counted as a confirmation instead.')}
a.push({id:'r'+Date.now(),lat:pin[0],lng:pin[1],cat:$('rc').value,title:t,desc:d,sev:+$('rs').value,obs:$('ro').value,ts:new Date().toISOString(),yes:0,no:0,voted:false});sv('rw_reps',a);rec.push(Date.now());sv('rw_rate',rec);
$('rt').value=$('rd').value='';drawReps();toast('Report saved as Unverified.')}
function vote(id,k){const a=reps(),r=a.find(x=>x.id==id);if(!r)return;const v=ls('rw_votes',{});if(v[id])return toast('You already responded to this report.');v[id]=1;sv('rw_votes',v);r[k]++;sv('rw_reps',a);drawReps();map.closePopup()}
// scoring
const MAJ=/^(motorway|trunk|primary|secondary|tertiary)(_link)?$/,MIN=/^(residential|unclassified|living_street)$/,POOR=/^(track|path|bridleway)$/;
function analyze(S,els,o){const night=$('night').checked,near=(p,r)=>S.some(s=>hav(s,p)<=r);
const ways=els.filter(e=>e.tags&&e.tags.highway&&e.type=='way'&&e.center&&near([e.center.lat,e.center.lon],o.wr)),n=ways.length;
const cnt=f=>ways.filter(f).length,maj=cnt(w=>MAJ.test(w.tags.highway)),poor=cnt(w=>POOR.test(w.tags.highway)),yes=cnt(w=>/^(yes|24\/7|automatic)$/.test(w.tags.lit||'')),no=cnt(w=>w.tags.lit=='no');
const lamps=els.filter(e=>e.type=='node'&&e.tags&&e.tags.highway=='street_lamp'&&near([e.lat,e.lon],o.lr)).length;
const fac={};els.filter(e=>e.tags&&e.tags.amenity&&/^(police|hospital|clinic|pharmacy)$/.test(e.tags.amenity)).forEach(e=>{const p=e.type=='node'?[e.lat,e.lon]:e.center&&[e.center.lat,e.center.lon];if(p&&near(p,o.fr))fac[e.tags.amenity]=(fac[e.tags.amenity]||0)+1});
const nf=Object.values(fac).reduce((a,b)=>a+b,0);
const rp=reps().filter(r=>near([r.lat,r.lng],o.rr)&&r.no<3);let pen=0;rp.forEach(r=>pen+=r.sev*(r.yes>=3?1:.4));pen=Math.min(pen,4);
const F=[];let sc=5;
if(n){sc+=2.5*maj/n-1.5*poor/n;F.push(`${n} mapped road segments nearby: ${Math.round(100*maj/n)}% main roads, ${Math.round(100*poor/n)}% tracks/paths.`)}
sc+=Math.min(nf,3)/3;F.push(nf?`Mapped assistance within ${o.fr} m: ${Object.entries(fac).map(([k,v])=>v+' '+k).join(', ')} (open status unknown; proximity is not protection).`:'No mapped assistance facilities nearby (this may just mean unmapped).');
if(night){sc+=2*yes/Math.max(n,1)-2.5*no/Math.max(n,1)+Math.min(lamps/(o.lk||1),10)/10;F.push(`Night: lighting mapped as lit on ${yes}, unlit on ${no} of ${n} segments, ${lamps} mapped streetlamps. ${n&&(yes+no)/n<.3?'Lighting is mostly unmapped, so night confidence is limited.':''}`)}else F.push('Day: lighting data not used.');
if(pen){sc-=pen;F.push(`${rp.length} unverified/community report(s) nearby reduced the score by ${pen.toFixed(1)}. Duplicates not counted separately.`)}else F.push('No community reports nearby (not evidence of safety).');
F.push('No historical crime data is configured, so none is included.');
const enough=n>=o.min;sc=Math.max(0,Math.min(10,Math.round(sc*2)/2));
let conf=!enough?'Low':(n>=20&&(!night||(yes+no)/n>=.3)&&nf>0)?'High':n>=10?'Medium':'Low';
return{enough,sc,conf,F,n,rp:rp.length}}
const sHTML=a=>(a.enough?`<span class="sc">${a.sc}/10</span>`:`<span class="warn">Insufficient data for a reliable safety score.</span>`)+` <span class="badge">Data confidence: ${a.conf}</span>`;
// routes
let R=[],sel=0;const COL=['#60a5fa','#2dd4bf','#c084fc','#fb923c'];
async function go(){const box=$('routes');box.innerHTML='<p class="note">⏳ Finding routes…</p>';try{
const a=await place('o'),b=await place('d');
const r=await fj(`${CFG.OSRM}/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?alternatives=3&overview=full&geometries=geojson&steps=false`);
if(r.code!=='Ok'||!r.routes.length)throw new Error('The routing service found no drivable route between these places.');
R=r.routes.map(x=>({km:x.distance/1e3,min:x.duration/60,pts:x.geometry.coordinates.map(c=>[c[1],c[0]])}));
box.innerHTML='<p class="note">⏳ Loading road, lighting and facility data from OpenStreetMap…</p>';await analyzeAll();
}catch(e){box.innerHTML=`<p class="warn">⚠️ ${esc(e.name=='AbortError'?'The service timed out. Try again.':e.message)}</p>`}}
async function analyzeAll(){const box=$('routes');let els=null,err='';const all=R.flatMap(r=>r.pts),la=all.map(p=>p[0]),lo=all.map(p=>p[1]),bb=[Math.min(...la)-.003,Math.min(...lo)-.003,Math.max(...la)+.003,Math.max(...lo)+.003];
if(bb[2]-bb[0]>.6||bb[3]-bb[1]>.6)err='Route area is too large for OpenStreetMap analysis; safety scores unavailable.';
else try{const bx=bb.join(',');els=await ovp(`[out:json][timeout:40];(way["highway"]["highway"!~"footway|path|steps|cycleway|service|pedestrian|corridor"](${bx});${FAC}(${bx});node["highway"="street_lamp"](${bx}););out center tags 6000;`)}catch(e){err='OpenStreetMap data service (Overpass) is unavailable. Showing routes without safety scores.'}
R.forEach(r=>{r.S=r.pts.filter((_,i)=>i%Math.max(1,Math.round(r.pts.length/Math.max(r.km*20,1)))==0);r.a=els?analyze(r.S,els,{wr:100,lr:40,fr:600,rr:80,min:5,lk:r.km}):null});
const sc=R.filter(r=>r.a&&r.a.enough).sort((x,y)=>y.a.sc-x.a.sc||x.min-y.min);R.forEach((r,i)=>r.role=i==0?'Fastest':'Alternative');
if(sc.length){const best=sc[0];best.role=best==R[0]?'Fastest · highest score':'Recommended safer'}
sel=0;if(sc.length&&sc[0]!==R[0])sel=R.indexOf(sc[0]);
box.innerHTML=(err?`<p class="warn">⚠️ ${esc(err)}</p>`:'')+(R.length==1?'<p class="note">Only one route was returned by the routing service.</p>':'')+R.map((r,i)=>`<div class="card" id="rc${i}" onclick="pick(${i})"><div class="row"><b style="color:${COL[i]}">● ${r.role}</b><span class="badge">${r.km.toFixed(1)} km</span><span class="badge">${Math.round(r.min)} min</span></div>${r.a?sHTML(r.a)+`<details><summary class="note">Why this assessment?</summary><ul>${r.a.F.map(f=>`<li class="note">${esc(f)}</li>`).join('')}</ul><div class="note">Source: OpenStreetMap via Overpass, queried just now. Segments matched approximately within 100 m of the route.</div></details>`:'<span class="warn">Safety assessment unavailable.</span>'}</div>`).join('');pick(sel)}
function pick(i){sel=i;rl.clearLayers();R.forEach((r,j)=>{if(j!=i)L.polyline(r.pts,{color:COL[j],weight:5,opacity:.4}).addTo(rl).on('click',()=>pick(j))});const l=L.polyline(R[i].pts,{color:COL[i],weight:8,opacity:.95}).addTo(rl);L.marker(R[i].pts[0]).addTo(rl);L.marker(R[i].pts.at(-1)).addTo(rl);map.fitBounds(l.getBounds(),{padding:[30,30]});document.querySelectorAll('#routes .card').forEach((c,j)=>c.classList.toggle('on',j==i))}
$('night').onchange=()=>{if(R.length)analyzeAll();if(pin&&$('pin').dataset.on)checkPin()};
// pin
async function checkPin(){if(!pin)return;tab('pin');map.closePopup();$('pin').dataset.on=1;$('pin').innerHTML='⏳ Checking available data…';
try{const[la,lo]=pin,els=await ovp(`[out:json][timeout:30];(way["highway"](around:300,${la},${lo});${FAC}(around:1000,${la},${lo});node["highway"="street_lamp"](around:200,${la},${lo}););out center tags 800;`);
const a=analyze([pin],els,{wr:300,lr:200,fr:1000,rr:300,min:3,lk:.4});
$('pin').innerHTML=`<p>${pin.map(x=>x.toFixed(5)).join(', ')}</p><p>${a.enough?(a.sc>=6.5?'Positive available indicators':a.sc>=4?'Caution advised':'Caution advised'):'Insufficient information'}</p>${sHTML(a)}<ul>${a.F.map(f=>`<li class="note">${esc(f)}</li>`).join('')}</ul><p class="note">Source: OpenStreetMap via Overpass (live query). These labels do not imply guaranteed safety.</p><button class="btn s" onclick="tab('rep')">Report an issue here</button>`}
catch{$('pin').innerHTML='<p class="warn">⚠️ OpenStreetMap data service is unavailable. Try again shortly.</p>'}}
// nearby
async function nearby(){const c=pin||[map.getCenter().lat,map.getCenter().lng];$('hl').innerHTML='<p class="note">⏳ Searching…</p>';
try{const els=await ovp(`[out:json][timeout:30];${FAC}(around:2000,${c[0]},${c[1]});out center tags 100;`);fl.clearLayers();
const E={police:['🚓','Police'],hospital:['🏥','Hospital'],clinic:['⚕️','Clinic'],pharmacy:['💊','Pharmacy']};
const L2=els.map(e=>({e,p:e.type=='node'?[e.lat,e.lon]:e.center&&[e.center.lat,e.center.lon]})).filter(x=>x.p).map(x=>({...x,d:hav(c,x.p)})).sort((a,b)=>a.d-b.d);
if(!L2.length){$('hl').innerHTML='<p class="note">No mapped facilities within 2 km. They may exist but be unmapped.</p>';return}
$('hl').innerHTML=L2.map(x=>{const t=E[x.e.tags.amenity],n=esc(x.e.tags.name||t[1]+' (unnamed)');L.marker(x.p,{icon:icon(t[0],'#60a5fa'),title:n}).addTo(fl).bindPopup(`<b>${n}</b><br>${t[1]}<br>Opening hours/response not verified.`);return`<div class="card" onclick="map.setView([${x.p}],17)">${t[0]} <b>${n}</b><div class="note">${(x.d/1e3).toFixed(2)} km · <a style="color:var(--t)" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${x.p[0]},${x.p[1]}">Directions</a></div></div>`}).join('')}
catch{$('hl').innerHTML='<p class="warn">⚠️ Facility data service is unavailable. Try again shortly.</p>'}}
// contacts + SOS
const cts=()=>ls('rw_c',[]);function drawC(){$('cts').innerHTML=cts().map((c,i)=>`<div class="card" style="cursor:default">${esc(c.n)} · ${esc(c.p)} <button class="btn s" onclick="delC(${i})">Remove</button></div>`).join('')||'<p class="note">No contacts saved.</p>'}
function addC(){const a=cts(),n=$('cn').value.trim(),p=$('cp').value.replace(/[\s-]/g,'');if(a.length>=2)return toast('Maximum two contacts.');if(!n)return toast('Enter a name.');if(!/^\+?\d{10,14}$/.test(p))return toast('Enter a valid phone number (10–14 digits, optional +).');a.push({n,p});sv('rw_c',a);$('cn').value=$('cp').value='';drawC()}
function delC(i){const a=cts();a.splice(i,1);sv('rw_c',a);drawC()}
let cd;function openSOS(){$('sos').showModal();let s=5;$('sb').innerHTML=`<p>Starting SOS in <b id="cdn">${s}</b>… Cancel if this was accidental.</p>`;clearInterval(cd);cd=setInterval(()=>{s--;if($('cdn'))$('cdn').textContent=s;if(s<=0){clearInterval(cd);sosReady()}},1000)}
function closeSOS(){clearInterval(cd);$('sos').close()}
function sosReady(){$('sb').innerHTML='<p>⏳ Getting your location…</p>';if(!navigator.geolocation)return sosUI(null,'Location is not supported on this device.');navigator.geolocation.getCurrentPosition(p=>sosUI(p.coords,''),e=>sosUI(null,'Location unavailable or permission denied.'),{enableHighAccuracy:true,timeout:15000})}
function sosUI(c,err){const link=c?`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=18/${c.latitude}/${c.longitude}`:'',msg=encodeURIComponent('I need help. '+(c?'My location: '+link:'My location could not be retrieved.')+' (sent via RAAHWISE)'),C=cts();
$('sb').innerHTML=`${err?`<p class="warn">${esc(err)}</p>`:`<p>Location found (accuracy ~${Math.round(c.accuracy)} m). <a style="color:var(--t)" target="_blank" rel="noopener" href="${link}">Map link</a></p>`}
<div class="row"><a class="btn sos" href="tel:112">📞 Call 112</a>${C.map(x=>`<a class="btn" href="sms:${esc(x.p)}?body=${msg}">💬 Text ${esc(x.n)}</a><a class="btn s" href="tel:${esc(x.p)}">📞 ${esc(x.n)}</a>`).join('')}${navigator.share?`<button class="btn s" onclick="navigator.share({text:decodeURIComponent('${msg}')}).catch(()=>{})">Share…</button>`:''}<button class="btn s" onclick="navigator.clipboard.writeText(decodeURIComponent('${msg}')).then(()=>toast('Copied'))">Copy message</button></div>
<p class="note"><b>Status: prepared, not sent.</b> Buttons open your phone's own dialler or messaging app. RAAHWISE has no SMS provider configured and cannot confirm delivery. Not an official emergency service.</p>${C.length?'':'<p class="warn">No contacts saved. Add them in the Contacts tab.</p>'}`}
// journey monitoring
let jw=null,jt=null,an=null,asked=false;const chk=$('chk');
function journey(){chk.close&&chk.open&&chk.close();if(jw!==null){navigator.geolocation.clearWatch(jw);clearInterval(jt);jw=null;$('jb').textContent='Start journey monitoring';$('js').textContent='Journey monitoring stopped.';return}
if(!navigator.geolocation)return toast('Location is not supported on this device.');an=null;asked=false;$('js').textContent='Waiting for location permission…';
jw=navigator.geolocation.watchPosition(p=>{if(p.coords.accuracy>60){$('js').textContent='Weak GPS signal (±'+Math.round(p.coords.accuracy)+' m). Waiting for a better fix.';return}
const q=[p.coords.latitude,p.coords.longitude];if(!an||hav(an.p,q)>+$('jr').value){an={p:q,t:Date.now()};asked=false}an.last=Date.now();$('js').textContent='Monitoring active. Last fix '+new Date().toLocaleTimeString()},e=>{toast('Location unavailable: '+e.message);journey()},{enableHighAccuracy:true,maximumAge:5000});
jt=setInterval(()=>{if(an&&!asked&&Date.now()-an.t>=$('jm').value*6e4){asked=true;if($('jv').checked&&navigator.vibrate)navigator.vibrate([300,150,300]);chk.showModal()}},15000);$('jb').textContent='Stop journey monitoring'}
function imOk(){an&&(an.t=Date.now());asked=false;chk.close()}
$('ro').value=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);drawReps();drawC();
