/* Guided lab UI. Optional authenticated classroom storage is provided by the bridge. */
(async function appMain(){
"use strict";
const bridge=await window.Classroom.start();if(!bridge)return;
const cloud=bridge.mode==="cloud";
const M=window.BalloonModel;
const {LAB,IDS,TARGETS,VECTORS,ANSWERS,dot,distance,nearest,numberFrom,calculateRow,fresh,count,unlocked,restore}=M;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number.isFinite(n)?String(Number(n.toFixed(3))):"—";
let state=fresh(),selected="B",tape=false,storageOK=true;
if(cloud){if(bridge.initial)state=restore(bridge.initial);state.student=bridge.displayName;state.phase=bridge.teacherPhase;if(state.phase>0)state.marked=true;}
else try{const raw=localStorage.getItem(LAB.storage);if(raw)state=restore(JSON.parse(raw));}catch(e){storageOK=false;}
selected=nextGalaxy();
function phaseDiameter(){return state.phase===0?10:state.phase===1?20:30;}
function nextGalaxy(){if(state.phase===1||state.phase===2)return TARGETS.find(id=>state.measurements[phaseDiameter()][id]===undefined)||"B";if(state.phase===3)return TARGETS.find(id=>!state.math[id])||"B";return "B";}
function announce(message,error=false){$("feedback").textContent=message;$("feedback").classList.toggle("error",error);}
function save(){
 if(cloud){bridge.enqueue(state);return;}
 try{localStorage.setItem(LAB.storage,JSON.stringify(state));storageOK=true;}catch(e){storageOK=false;}
 $("saveStatus").textContent=storageOK?"Saved on this device. Use a work file to move or back up your work.":"Browser saving is unavailable. Use Save work file before leaving.";
}
function nav(){
 const limit=cloud?Math.max(unlocked(state),bridge.teacherPhase):unlocked(state);
 document.querySelectorAll("[data-phase]").forEach(b=>{
  const p=Number(b.dataset.phase);b.disabled=p>limit;
  if(p===state.phase)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current");
 });
 $("back").hidden=state.phase===0;$("next").hidden=state.phase===4;
 $("next").disabled=state.phase>=limit;
 $("next").textContent=["Next: inflate to 20 cm →","Next: inflate to 30 cm →","Next: calculate →","Next: explain →",""][state.phase];
}
function go(p){
 if(p<0||p>(cloud?Math.max(unlocked(state),bridge.teacherPhase):unlocked(state))||p>4)return;
 state.phase=p;if(cloud&&p>0)state.marked=true;selected=nextGalaxy();tape=false;save();render();
 $("stepHeading").focus({preventScroll:true});
 $("workspace").scrollIntoView({behavior:"auto",block:"start"});
}
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return a.map(x=>x/n);};
function sphere(){
 const d=phaseDiameter(),R=d*8,cx=360,cy=278;
 const a=VECTORS[0],b=VECTORS[IDS.indexOf(selected)];
 const front=unit(a.map((x,i)=>x+b[i])),right=unit(cross([0,1,0],front)),up=cross(front,right);
 const project=v=>[cx+R*dot(v,right),cy-R*dot(v,up),dot(v,front)];
 function path(vectors,frontOnly=true){
  let out="",pen=false;
  for(const v of vectors){const [x,y,z]=project(v);if(frontOnly&&z<-.001){pen=false;continue;}out+=(pen?"L":"M")+x.toFixed(2)+","+y.toFixed(2);pen=true;}
  return out;
 }
 let svg=`<title id="balloonTitle">Balloon at ${d} centimeters in diameter</title><desc id="balloonDesc">A spherical surface with fixed galaxy markers. ${tape?`A yellow curved tape follows the shortest surface path from A to ${selected}; distance ${distance(d,selected).toFixed(1)} centimeters.`:"Choose a galaxy and lay the tape to measure its surface distance from A."} The camera turns to show the selected pair. Faint dots are on the far side.</desc><defs><radialGradient id="sphereLight" cx="32%" cy="23%" r="80%"><stop offset="0" stop-color="#2b8990"/><stop offset=".68" stop-color="#155668"/><stop offset="1" stop-color="#082438"/></radialGradient></defs>`;
 const stars=[[62,50],[650,95],[60,390],[652,468],[174,75],[595,29],[380,30],[45,200],[660,260],[175,510],[540,535]];
 svg+=stars.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i%3?1.6:2.5}" fill="#b5d8e8" opacity=".5"/>`).join("");
 svg+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#sphereLight)" stroke="#60cabb" stroke-width="2"/>`;
 for(const lat of [-60,-30,0,30,60]){
  const phi=lat*Math.PI/180,vs=Array.from({length:145},(_,i)=>{const t=i*Math.PI/72;return [Math.cos(phi)*Math.cos(t),Math.cos(phi)*Math.sin(t),Math.sin(phi)];});
  svg+=`<path d="${path(vs)}" fill="none" stroke="#a1e3df" stroke-width="1" opacity=".24"/>`;
 }
 for(let lon=0;lon<180;lon+=30){
  const phi=lon*Math.PI/180,vs=Array.from({length:145},(_,i)=>{const t=i*Math.PI/72;return [Math.sin(t)*Math.cos(phi),Math.sin(t)*Math.sin(phi),Math.cos(t)];});
  svg+=`<path d="${path(vs)}" fill="none" stroke="#a1e3df" stroke-width="1" opacity=".24"/>`;
 }
 if(tape&&state.marked){
  const theta=Math.acos(Math.max(-1,Math.min(1,dot(a,b)))),vs=Array.from({length:81},(_,i)=>{
   const t=i/80;return a.map((v,j)=>(Math.sin((1-t)*theta)*v+Math.sin(t*theta)*b[j])/Math.sin(theta));
  });
  svg+=`<path d="${path(vs,false)}" fill="none" stroke="#ffda79" stroke-width="7" stroke-linecap="round"/><path d="${path(vs,false)}" fill="none" stroke="#253947" stroke-width="2" stroke-dasharray="2 9"/>`;
 }
 if(state.marked){
  const points=VECTORS.map((v,i)=>({id:IDS[i],p:project(v)})).sort((x,y)=>x.p[2]-y.p[2]);
  for(const {id,p:[x,y,z]} of points){
   const active=id==="A"||id===selected;
   svg+=`<g opacity="${z<0?.24:1}"><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${active?13:8}" fill="${id==="A"?"#fff":id===selected?"#ffda79":"#83f0db"}" stroke="#092234" stroke-width="3"/><text x="${(x+15).toFixed(2)}" y="${(y-13).toFixed(2)}" fill="white" font-size="24" font-family="system-ui,sans-serif" font-weight="750" stroke="#10283e" stroke-width="5" paint-order="stroke">${id}</text></g>`;
  }
 }
 svg+=`<path d="M${cx-R},546 v12 M${cx-R},552 H${cx+R} M${cx+R},546 v12" fill="none" stroke="#afd0dc" stroke-width="2"/><text x="360" y="584" text-anchor="middle" fill="#d7e7ef" font-size="20" font-family="system-ui,sans-serif">${d} cm diameter · not to cosmic scale</text>`;
 $("balloon").innerHTML=svg;
 $("diameterBadge").textContent=d+" cm diameter";
 $("modelCaption").textContent=state.phase===0?"The surface is our model of space. Add markers to choose places to track.":`Viewing A and ${selected}. The tape follows the curved surface. Faint dots are on the far side; the camera turns when you choose a new galaxy.`;
}
function ruler(){
 const d=phaseDiameter(),n=tape?distance(d,selected):null,scale=10.7,left=30;
 let svg="<title>Unrolled measuring tape</title><desc>"+(n===null?"Lay the tape to see a reading.":`Surface distance ${n.toFixed(1)} centimeters. The tape is shown flat for reading.`)+"</desc>";
 svg+='<rect x="25" y="17" width="440" height="35" rx="3" fill="#fff9da" stroke="#827548"/>';
 for(let t=0;t<=40;t++){
  const x=left+t*scale;
  svg+=`<path d="M${x},18 v${t%5===0?20:10}" stroke="#384e5b" stroke-width="1.5"/>`;
  if(t%5===0)svg+=`<text x="${x}" y="73" text-anchor="middle" font-size="16" fill="#20384c">${t}</text>`;
 }
 if(n!==null){const x=left+n*scale;svg+=`<path d="M${x},7 V54" stroke="#a52b0f" stroke-width="3"/><path d="M${x-6},4 L${x+6},4 L${x},13 Z" fill="#a52b0f"/>`;}
 svg+='<text x="480" y="45" text-anchor="middle" font-size="14" fill="#20384c">cm</text>';
 $("ruler").innerHTML=svg;
}
function choices(container,isMath=false){
 const values=isMath?state.math:state.measurements[phaseDiameter()];
 $(container).innerHTML=TARGETS.map(id=>`<button data-galaxy="${id}" aria-pressed="${id===selected}" class="${values?.[id]!==undefined?"recorded":""}" aria-label="Galaxy ${id}${values?.[id]!==undefined?", recorded":""}">${id}</button>`).join("");
}
function measurementView(){
 const d=phaseDiameter();
 $("measureIntro").textContent=d===20?"The balloon is now 20 cm across. Record one distance from A to each of the other nine galaxies.":"The balloon is now 30 cm across. The same galaxy markers have stayed in place on its growing surface. Measure the same nine pairs again.";
 choices("measureChoices");
 $("layTape").textContent=`Lay measuring tape: A → ${selected}`;
 $("readingLabel").textContent=`Surface distance from A to ${selected}`;
 $("reading").textContent=tape?`${distance(d,selected).toFixed(1)} cm`:"Lay the tape to measure.";
 $("measurement").value=state.draftMeasurements[d][selected]??state.measurements[d][selected]??"";
 $("record").disabled=!tape;
 $("measureProgress").textContent=`${count(state,d)} of 9 measurements recorded at this stage. A check mark means recorded.`;
 ruler();
}
function mathView(){
 choices("mathChoices",true);
 const a=state.measurements[20][selected],b=state.measurements[30][selected];
 $("mathData").innerHTML=`<strong>Galaxy ${selected}</strong><p>First Measurement — Year 0<br>First distance: <strong>${fmt(a)} cm</strong></p><p>Second Measurement — Year 8<br>Second distance: <strong>${fmt(b)} cm</strong></p><p class="time-passed">Year 0 → Year 8<br><strong>Time passed = 8 model years</strong></p>`;
 const missing=a===undefined||b===undefined;$("saveMath").disabled=missing;
 if(missing)$("mathData").innerHTML+="<p>Record both measurements for this galaxy in Steps 2 and 3 before checking this row.</p>";
 const row=state.draftMath[selected]||state.math[selected]||["","","",""];
 row.forEach((n,i)=>{$("math"+i).value=n;});
 $("mathProgress").textContent=`${Object.keys(state.math).length} of 9 calculation rows saved. Changing a saved row means you must check and save it again.`;
}
function tableMarkup(){
 return `<table><caption>Distances measured along the balloon's surface from A · Time passed = 8 model years</caption><thead><tr><th scope="col">Galaxy</th><th scope="col">First<br>Measurement<br>— Year 0<br>20 cm balloon<br>(cm)</th><th scope="col">Second<br>Measurement<br>— Year 8<br>30 cm balloon<br>(cm)</th><th scope="col">Change<br>(cm)</th><th scope="col">Rate<br>(Change ÷<br>8 years)<br>(cm/year)</th><th scope="col">Predicted<br>change after<br>24 years (cm)</th><th scope="col">Predicted<br>change after<br>32 years (cm)</th></tr></thead><tbody>`+TARGETS.map(id=>`<tr><th scope="row">${id}</th><td>${fmt(state.measurements[20][id])}</td><td>${fmt(state.measurements[30][id])}</td>${[0,1,2,3].map(i=>`<td>${fmt(state.math[id]?.[i])}</td>`).join("")}</tr>`).join("")+"</tbody></table>";
}
function graphMarkup(){
 const rows=TARGETS.filter(id=>state.math[id]),xMax=25,yMax=1.5,x=n=>85+n/xMax*590,y=n=>325-n/yMax*270;
 let g=`<title id="graphTitle">Starting distance and model expansion rate</title><desc id="graphDesc">${rows.length} of 9 galaxies plotted. Starting distance in centimeters on the horizontal axis; model rate in centimeters per year on the vertical axis. The exact values are in the data table.</desc><rect width="720" height="400" fill="white"/>`;
 for(let n=0;n<=25;n+=5){g+=`<path d="M${x(n)},55 V325" stroke="#dce6ec"/><text x="${x(n)}" y="350" text-anchor="middle" font-size="16" fill="#334e60">${n}</text>`;}
 for(let n=0;n<=1.5001;n+=.25){g+=`<path d="M85,${y(n)} H675" stroke="#dce6ec"/><text x="72" y="${y(n)+5}" text-anchor="end" font-size="16" fill="#334e60">${fmt(n)}</text>`;}
 g+='<path d="M85,50 V325 H680" fill="none" stroke="#20384c" stroke-width="2"/><text x="380" y="390" text-anchor="middle" font-size="18" fill="#20384c">Starting distance from A (cm)</text><text transform="translate(22,190) rotate(-90)" text-anchor="middle" font-size="17" fill="#20384c">Model rate (cm/year)</text>';
 for(const id of rows){const px=x(state.measurements[20][id]),py=y(state.math[id][1]);g+=`<circle cx="${px}" cy="${py}" r="7" fill="#00686c"/><text x="${px+11}" y="${py-9}" font-size="18" font-weight="700" fill="#10283e">${id}</text>`;}
 if(!rows.length)g+='<text x="380" y="170" text-anchor="middle" font-size="19" fill="#526979">Save calculation rows to build your graph.</text>';
 return g;
}
function overview(){$("tableWrap").innerHTML=tableMarkup();$("graph").innerHTML=graphMarkup();}
function answerButtons(){
 document.querySelectorAll("[data-observation]").forEach(b=>b.setAttribute("aria-pressed",String(state.answers.observation===b.dataset.observation)));
}
function render(){
 nav();sphere();overview();
 const p=state.phase;
 $("stepEyebrow").textContent=`Step ${p+1} of 5 · ${["Set up","First measurement","Second measurement","Find the pattern","Use evidence"][p]}`;
 $("stepHeading").textContent=["Make a prediction","Measure at 20 cm","Measure at 30 cm","Calculate the model rates","Explain your findings"][p];
 $("predictPanel").hidden=p!==0;$("measurePanel").hidden=!(p===1||p===2);$("mathPanel").hidden=p!==3;$("explainPanel").hidden=p!==4;
 if(p===0){$("student").value=state.student;$("prediction").value=state.prediction;$("why").value=state.why;$("mark").disabled=state.marked;$("mark").textContent=state.marked?"Galaxy markers added ✓":"Add galaxy markers A–J";}
 if(p===1||p===2)measurementView();if(p===3)mathView();
 for(const k of ANSWERS.filter(k=>k!=="observation"))$(k).value=state.answers[k];
 answerButtons();
 announce(["Add the markers, choose a prediction, and tell why. Then go to Step 2.","Choose a galaxy and lay the tape. You can measure again at any time.","Record all nine distances at the larger size.","Choose a galaxy. Calculate and save all four values.","Use your recorded data to support your explanation."][p]);
}
function selectGalaxy(id){
 selected=id;tape=false;sphere();
 if(state.phase===3){mathView();announce(`Galaxy ${id} selected. Use its two recorded measurements.`);}
 else{measurementView();announce(`Galaxy ${id} selected. Lay the tape from A to ${id}.`);}
}
$("mark").addEventListener("click",()=>{state.marked=true;save();render();announce("Ten markers added. Choose your prediction and tell why.");});
for(const key of ["student","prediction","why"])$(key).addEventListener("input",e=>{state[key]=e.target.value;save();nav();});
document.querySelectorAll("[data-phase]").forEach(b=>b.addEventListener("click",()=>go(Number(b.dataset.phase))));
$("next").addEventListener("click",()=>go(state.phase+1));$("back").addEventListener("click",()=>go(state.phase-1));
for(const id of ["measureChoices","mathChoices"])$(id).addEventListener("click",e=>{const b=e.target.closest("[data-galaxy]");if(b)selectGalaxy(b.dataset.galaxy);});
$("layTape").addEventListener("click",()=>{
 tape=true;sphere();measurementView();
 announce(`The distance from A to ${selected} is ${distance(phaseDiameter(),selected).toFixed(1)} cm. Round it to a whole centimeter.`);
 $("measurement").focus({preventScroll:true});
});
function recordMeasurement(){
 if(!tape)return;
 const d=phaseDiameter(),n=numberFrom($("measurement").value),correct=nearest(distance(d,selected));
 if(n===null||!Number.isInteger(n)){announce("Type a whole number before recording. Use the tape reading to round.",true);return;}
 if(n!==correct){announce(`Check your rounding. The tape reads ${distance(d,selected).toFixed(1)} cm. Look at the digit after the decimal point.`,true);return;}
 const old=selected;state.measurements[d][old]=n;delete state.draftMeasurements[d][old];save();overview();nav();
 const next=TARGETS.find(id=>state.measurements[d][id]===undefined);
 if(next){selected=next;tape=false;}
 sphere();measurementView();
 announce(`Recorded A to ${old}: ${n} cm. ${next?`Next, lay the tape to galaxy ${next}.`:"All nine measurements are recorded. You are ready for the next step."}`);
 (next?$("layTape"):$("next")).focus({preventScroll:true});
}
$("record").addEventListener("click",recordMeasurement);
$("measurement").addEventListener("input",()=>{
 state.draftMeasurements[phaseDiameter()][selected]=$("measurement").value.slice(0,30);
 save();
});
$("measurement").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();recordMeasurement();}});
for(let i=0;i<4;i++)$("math"+i).addEventListener("input",()=>{
 state.draftMath[selected]=[0,1,2,3].map(j=>$("math"+j).value);
 if(state.math[selected]){delete state.math[selected];nav();overview();choices("mathChoices",true);}
 $("mathProgress").textContent=`${Object.keys(state.math).length} of 9 calculation rows saved. Check and save this row when it is ready.`;
 save();$("completion").textContent="";
});
$("saveMath").addEventListener("click",()=>{
 if(state.measurements[20][selected]===undefined||state.measurements[30][selected]===undefined){announce("Record this galaxy in Steps 2 and 3 first.",true);return;}
 const values=[0,1,2,3].map(i=>numberFrom($("math"+i).value));
 const expected=calculateRow(state.measurements[20][selected],state.measurements[30][selected]);
 const missing=values.findIndex(n=>n===null);
 if(missing>=0){announce("Fill in all four calculation boxes. The calculator can help.",true);$("math"+missing).focus();return;}
 const wrong=values.findIndex((n,i)=>Math.abs(n-expected[i])>.00051);
 if(wrong>=0){announce(["Check the change: second distance minus first distance.","Check the rate: change divided by 8. Keep up to 3 decimal places.","Check the 24-year motion: rate times 24.","Check the 32-year motion: rate times 32."][wrong],true);$("math"+wrong).focus();return;}
 const old=selected;state.math[old]=expected;delete state.draftMath[old];
 const next=TARGETS.find(id=>!state.math[id]);if(next)selected=next;
 save();nav();overview();sphere();mathView();
 announce(`Galaxy ${old}: calculations saved. ${next?`Now calculate galaxy ${next}.`:"All nine rows are ready. Go to Step 5."}`);
 (next?$("math0"):$("next")).focus({preventScroll:true});
});
$("calculate").addEventListener("click",()=>{
 const a=numberFrom($("calcA").value),b=numberFrom($("calcB").value),op=$("calcOp").value;
 if(a===null||b===null){$("calcResult").textContent="Enter two numbers.";return;}
 if(op==="/"&&b===0){$("calcResult").textContent="Cannot divide by zero.";return;}
 const n=op==="+"?a+b:op==="-"?a-b:op==="*"?a*b:a/b;
 $("calcResult").textContent=Number.isFinite(n)?fmt(n):"Try smaller numbers.";
});
document.querySelectorAll("[data-observation]").forEach(b=>b.addEventListener("click",()=>{state.answers.observation=b.dataset.observation;answerButtons();save();$("completion").textContent="";}));
for(const k of ANSWERS.filter(k=>k!=="observation"))$(k).addEventListener("input",e=>{state.answers[k]=e.target.value;save();$("completion").textContent="";});
function missingParts(){
 const missing=[];
 if(!state.marked||!state.prediction||!state.why.trim())missing.push("prediction");
 if(count(state,20)<9)missing.push("20 cm measurements");
 if(count(state,30)<9)missing.push("30 cm measurements");
 if(Object.keys(state.math).length<9)missing.push("calculation rows");
 for(const [i,k] of ANSWERS.entries())if(!state.answers[k].trim())missing.push("explanation "+(i+1));
 return missing;
}
$("finish").addEventListener("click",()=>{
 const missing=missingParts();
 $("completion").textContent=missing.length?"Still to complete: "+missing.join(", ")+".":"Your entries are complete. Download or print your report below and review your explanation with your teacher.";
});
function download(name,text,mime){
 const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
const fileDate=()=>new Date().toISOString().slice(0,10);
$("backup").addEventListener("click",()=>{download(`balloon-work-${fileDate()}.json`,JSON.stringify(state,null,2),"application/json");announce("Work file downloaded. Keep it so you can open it later.");});
$("restoreButton").addEventListener("click",()=>{$("restoreFile").value="";$("restoreFile").click();});
$("restoreFile").addEventListener("change",async e=>{
 const file=e.target.files[0];if(!file)return;
 if(file.size>200000){announce("This file is too large. Choose a saved balloon work JSON file.",true);return;}
 try{
  const candidate=restore(JSON.parse(await file.text()));
  if(!window.confirm("Replace the work in this browser with this saved work file?"))return;
  state=candidate;if(cloud){state.student=bridge.displayName;state.phase=bridge.teacherPhase;if(state.phase>0)state.marked=true;}selected=nextGalaxy();tape=false;save();render();announce("Saved work opened. Continue where you left off.");
 }catch(err){announce("That file could not be opened. Choose a compatible balloon work JSON file.",true);}
});
$("newStudent").addEventListener("click",()=>{
 if(!window.confirm("Start a new notebook? This removes the saved work in this browser. Download a work file first if you need it."))return;
 state=fresh();selected="B";tape=false;save();render();$("completion").textContent="";announce("A new notebook is ready.");$("stepHeading").focus();
});
function reportMarkup(){
 const labels={observation:"As the balloon grew, the galaxies became…",claim:"Pattern / claim",evidence:"Two galaxies as evidence",reasoning:"Why did distances change?",connection:"Connection to the expanding universe",limitation:"A limitation of the model"};
 const observation={farther:"Farther apart",closer:"Closer together",same:"The same distance apart"};
 const missing=missingParts();
 return `<h1>Expanding Universe · Lab Report</h1><p>Student code: ${esc(state.student||"Not provided")}<br>Started: ${esc(new Date(state.started).toLocaleDateString())}<br>Report saved: ${esc(new Date().toLocaleString())}</p><p><strong>${missing.length?"Work in progress — missing: "+esc(missing.join(", ")):"All response fields completed — teacher review needed."}</strong></p><h2>Prediction</h2><p>Distances will: ${esc({increase:"increase",decrease:"decrease",same:"stay the same"}[state.prediction]||"Not answered")}<br>${esc(state.why||"Not answered")}</p><h2>Method</h2><p>Virtual model with ten fixed galaxy positions A–J. Starting setup: 10 cm diameter. Measured the shortest curved surface distance from A to B–J at diameters of 20 cm and 30 cm. Recorded to the nearest whole centimeter. Used an assumed interval of 8 model years. Calculated change, rate, and additional motion over 24 and 32 years at that same rate. These are model data, not astronomical measurements.</p><div style="overflow-x:auto">${tableMarkup()}</div><h2>Graph</h2><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 400" role="img" aria-labelledby="graphTitle graphDesc">${graphMarkup()}</svg><h2>Explanation</h2>${ANSWERS.map(k=>`<h3>${labels[k]}</h3><p>${esc((k==="observation"?observation[state.answers[k]]:state.answers[k])||"Not answered")}</p>`).join("")}<h2>Teacher review</h2><p>Teacher: ____________________ &nbsp; Date: ____________________<br>Actual laboratory minutes accepted by teacher: ____________________<br>Support provided / feedback: ____________________________________<br>________________________________________________________________</p><p>This report records a model investigation. It does not automatically certify laboratory credit or replace required NYS science investigations.</p><p>Earth Science Labs · Balloon model v1.0 · <a href="https://jplutajr.github.io/earth-science-labs/">Open the simulator</a></p>`;
}
$("report").addEventListener("click",()=>{
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Balloon lab report</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#20384c;max-width:1050px;margin:30px auto;padding:20px}h1,h2,h3{line-height:1.25}h2{margin-top:30px}h3{font-size:17px}p{white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:8px;border:1px solid #a3bac7;text-align:left}th{background:#edf4f8}caption{text-align:left;font-weight:bold;margin-bottom:12px}svg{max-width:720px;width:100%}@media print{body{margin:0;padding:0;font-size:11pt}table{font-size:9pt}tr{break-inside:avoid}svg{max-height:260px}@page{margin:15mm}}</style></head><body>${reportMarkup()}</body></html>`;
 download(`balloon-report-${fileDate()}.html`,html,"text/html");
});
$("print").addEventListener("click",()=>{$("printArea").innerHTML=reportMarkup();window.print();});
$("csv").addEventListener("click",()=>{
 const rows=[["Galaxy","Distance at 20 cm diameter (cm)","Distance at 30 cm diameter (cm)","Change (cm)","Model rate (cm/year)","Motion in 24 model years (cm)","Motion in 32 model years (cm)"]];
 for(const id of TARGETS)rows.push([id,state.measurements[20][id]??"",state.measurements[30][id]??"",...(state.math[id]||["","","",""])]);
 download(`balloon-data-${fileDate()}.csv`,rows.map(row=>row.join(",")).join("\r\n")+"\r\n","text/csv;charset=utf-8");
});
if(cloud){
 bridge.bind({
  replace(raw,phase){state=raw?restore(raw):fresh();state.student=bridge.displayName;state.phase=phase;if(phase>0)state.marked=true;selected=nextGalaxy();tape=false;render();},
  phase(p){state.phase=p;if(p>0)state.marked=true;selected=nextGalaxy();tape=false;save();render();announce("Your teacher opened Step "+(p+1)+". Your earlier answers are saved.");}
 });
}
save();render();
})();
