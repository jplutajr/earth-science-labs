(function teacherMain(){
"use strict";
const $=id=>document.getElementById(id),M=window.BalloonModel,R=window.BalloonReview,config=window.CLASSROOM_CONFIG;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number.isFinite(n)?String(Number(n.toFixed(3))):"—";
if(!window.ClassroomClient.configured(config)){$("teacherGateMessage").textContent="Classroom accounts are not connected yet. The teacher dashboard will open here after setup.";return;}
const api=new window.ClassroomClient(config);
if(!api.session){location.replace("classroom.html");return;}
let classroom=null,students=[],selected="",guideStep=0,poll=null,busy=false,closed=false,renderedWork="";
const steps=[
 {title:"1 · Predict",say:"The balloon's surface stands for space. The dots stand for galaxies. We will measure from galaxy A.",do:["Have her add the ten markers.","Ask whether distances will increase, decrease, or stay the same.","Read the sentence starter. Let her explain her own prediction."],look:"Any reasoned prediction is acceptable. Do not require a correct prediction before she collects evidence.",help:"Point to two dots. Ask: “What might happen to the space between them when the surface grows?”"},
 {title:"2 · Measure at 20 cm",say:"The balloon is 20 centimeters across. Our tape follows its curved surface from A to each other galaxy.",do:["Select galaxy B and press Lay measuring tape.","Have her read the number and round to a whole centimeter.","She types the rounded number and presses Record.","Repeat for C–J. All nine values should be recorded."],look:"B 3 · C 5 · D 7 · E 9 · F 11 · G 13 · H 15 · I 18 · J 22 cm.",help:"For B the tape reads 3.2 cm. Ask: “Is the decimal digit less than 5?” Use the separate rounding example before telling a lab answer."},
 {title:"3 · Measure at 30 cm",say:"The same balloon is now larger. The galaxy markers stayed in place on the growing surface.",do:["Ask her to notice the increased separation.","Measure A to B–J again using the same tape method.","Keep the first measurements in the table so she can compare the two stages."],look:"B 5 · C 8 · D 10 · E 13 · F 16 · G 20 · H 23 · I 27 · J 32 cm.",help:"Point to one row and compare its two numbers. The camera turns when a new galaxy is selected; that is not galaxy motion."},
 {title:"4 · Calculate",say:"A rate tells us the change for one unit of time. This model uses eight years between the two measurements.",do:["Change = second distance minus first distance.","Rate = change divided by 8. Keep up to three decimal places.","Motion over 24 years = rate × 24. Motion over 32 years = rate × 32.","Use the calculator, then Check and save this row. Repeat all nine rows.","Read the graph as each saved row adds a point."],look:"For B: 5 − 3 = 2 cm; 2 ÷ 8 = 0.25 cm/year; 0.25 × 24 = 6 cm; 0.25 × 32 = 8 cm.",help:"Use the separate 12-to-20 cm example first. Missing measurements must be completed before a calculation row can be checked. The projections are extra motion, not total distances."},
 {title:"5 · Explain",say:"Scientists use measurements as evidence. Use two rows of your table to explain what the model shows.",do:["Choose the observed change in distance.","Help her state the distance–rate pattern in her own words.","Choose two galaxies and cite their numbers.","Explain that the surface expanded between fixed positions.","Connect the pattern to distant-galaxy observations and identify a model limitation.","Review and download or print her report."],look:"Farther apart. More distant galaxies generally have larger model rates. Example: B starts 3 cm away with rate 0.25; J starts 22 cm away with rate 1.25. The surface stretches between them.",help:"Accept short typed, dictated, or scribed oral responses. One valid limit: this two-dimensional surface represents three-dimensional space. The balloon does not measure redshift or provide all Big Bang evidence."}
];
function guide(){
 $("guideChoices").innerHTML=steps.map((s,i)=>`<button data-guide="${i}" aria-pressed="${i===guideStep}" aria-label="${esc(s.title)}">${i+1}</button>`).join("");
 const s=steps[guideStep];$("guideBody").innerHTML=`<h3>${s.title}</h3><div class="note"><strong>Say</strong><p>${s.say}</p></div><h3>Guide her through it</h3><ol>${s.do.map(x=>`<li>${x}</li>`).join("")}</ol><h3>What to look for</h3><p>${s.look}</p><h3>If she needs help</h3><p>${s.help}</p>`;
 $("sendStep").textContent=`Send student to Step ${guideStep+1}`;
}
function key(){
 $("answerKey").innerHTML='<table><caption>Values for this model</caption><thead><tr><th>Galaxy</th><th>First cm</th><th>Second cm</th><th>Change cm</th><th>Rate cm/year</th><th>24-year motion cm</th><th>32-year motion cm</th></tr></thead><tbody>'+M.TARGETS.map(id=>{const a=M.nearest(M.distance(20,id)),b=M.nearest(M.distance(30,id));return `<tr><th scope="row">${id}</th>${[a,b,...M.calculateRow(a,b)].map(n=>`<td>${fmt(n)}</td>`).join("")}</tr>`;}).join("")+"</tbody></table>";
}
function showStudent(){
 const row=students.find(s=>s.student_id===selected);$("teacherDownload").disabled=!row?.state;
 const signature=JSON.stringify([selected,row?.state,row?.updated_at]);
 if(!row?.state){renderedWork="";$("reviewAnnouncement").textContent="";}
 if(!row){$("liveProgress").innerHTML="<p>Add her account below. She will appear after it is registered and ready to sign in.</p>";$("progressStatus").textContent="No student selected.";return;}
 if(!row.state){$("liveProgress").innerHTML="<p>No work saved yet. Her first saved entry will appear here.</p>";$("progressStatus").textContent="Waiting for her first notebook.";return;}
 let s;try{s=M.restore(row.state);}catch(e){$("liveProgress").textContent="This notebook uses an unsupported version.";return;}
 const explanations=M.ANSWERS.filter(k=>s.answers[k].trim()).length;
 const time=new Date(row.updated_at);$("progressStatus").textContent=`Last saved: ${Number.isNaN(time.getTime())?"unknown":time.toLocaleString()} · Last open step: ${(Number.isInteger(row.state.phase)?row.state.phase:s.phase)+1}`;
 if(signature===renderedWork)return;
 const labels=R.labels,review=R.review(s);
 const obs={farther:"Farther apart",closer:"Closer together",same:"The same distance apart"};
 const count=review.flags.length,summary=count?`${count} ${count===1?"item":"items"} to review`:"No automatic flags right now";
 let html=`<div class="review-summary ${count?"has-flags":""}" aria-labelledby="reviewTitle"><p class="eyebrow">Teacher view only</p><h3 id="reviewTitle">${count?"! ":""}${summary}</h3><p class="small">Red marks a number to check or wording to discuss. Drafts may still be changing. Written checks can miss mistakes or flag valid wording; you decide what is accurate.</p>`;
 if(count)html+=`<ul class="review-links">${review.flags.map(f=>`<li><a href="#${f.id}">${esc(f.title)}</a> — ${esc(f.kind==="writing"?"Review wording":f.kind==="choice"?"Check choice":"Check number")}</li>`).join("")}</ul>`;
 else html+="<p class='small'>Keep reviewing her explanations. A response without a flag is not automatically correct.</p>";
 html+=`</div><div class="metrics"><div class="metric"><strong>${M.count(s,20)+M.count(s,30)}/18</strong>measurements</div><div class="metric"><strong>${Object.keys(s.math).length}/9</strong>calculation rows</div><div class="metric"><strong>${explanations}/6</strong>explanations</div></div><h3>Prediction</h3><p>${esc(s.prediction||"Not answered")}<br>${esc(s.why||"No reason entered yet.")}</p><p class="small">Predictions are not marked wrong. Use her measurements to revisit her thinking.</p><h3>Her numbers</h3><p class="small">Draft = her current entry, before Record or Check and save. Blank boxes are not flagged. A flag clears when the latest saved entry matches the expected value.</p><div class="scroll" id="studentData" tabindex="0" role="region" aria-label="Student measurements and calculation drafts"><table><caption>${esc(row.display_name)} · recorded values and current drafts</caption><thead><tr><th>Galaxy</th><th>First cm</th><th>Second cm</th><th>Change cm</th><th>Rate cm/year</th><th>24 years cm</th><th>32 years cm</th></tr></thead><tbody>`;
 function cell(c){
  return `<td id="${c.id}" tabindex="-1" class="${c.issue?"needs-review":""}"><span class="entry-value">${esc(c.value||"—")}</span>${c.draft?'<span class="entry-label">Draft</span>':""}${c.draft&&c.saved!==undefined?`<span class="entry-label">Recorded: ${fmt(c.saved)}</span>`:""}${c.issue?`<span class="review-badge">! Check number</span><span class="entry-label">${esc(c.issue.message)}</span>`:""}</td>`;
 }
 for(const id of M.TARGETS)html+=`<tr><th scope="row">${id}</th>${[review.measurements[20][id],review.measurements[30][id],...review.math[id]].map(cell).join("")}</tr>`;
 html+="</tbody></table></div>";
 const numberFlags=review.flags.filter(f=>f.kind==="number");
 if(numberFlags.length)html+=`<div class="review-prompts"><h3>Help with these numbers</h3>${numberFlags.map(f=>`<p><strong>${esc(f.title)}:</strong> ${esc(f.hint)}</p>`).join("")}</div>`;
 html+="<h3 style='margin-top:24px'>Her explanations</h3>";
 html+=M.ANSWERS.map(k=>{
  const issue=review.answers[k];
  return `<div id="review-answer-${k}" tabindex="-1" class="student-answer ${issue?"needs-review":""}"><strong>${labels[k]}</strong><p class="student-response">${esc((k==="observation"?obs[s.answers[k]]:s.answers[k])||"Not answered yet.")}</p>${issue?`<div class="review-note"><span class="review-badge">! ${k==="observation"?"Check choice":"Review wording"}</span><p>${esc(issue.message)}</p><p><strong>Try asking:</strong> ${esc(issue.hint)}</p></div>`:""}</div>`;
 }).join("");
 const scrollLeft=$("studentData")?.scrollLeft||0,focused=document.activeElement?.id;
 $("liveProgress").innerHTML=html;
 renderedWork=signature;
 $("studentData").scrollLeft=scrollLeft;
 if(focused?.startsWith("review-"))$(focused)?.focus({preventScroll:true});
 const announcement=summary+". Updated from her saved work.";
 if($("reviewAnnouncement").textContent!==announcement)$("reviewAnnouncement").textContent=announcement;
}
async function refresh(){
 if(busy||closed)return;busy=true;
 try{
  const result=await api.dashboard(classroom.id);if(closed)return;
  classroom=result.classroom;students=result.students||[];
  if(!students.some(s=>s.student_id===selected))selected=students[0]?.student_id||"";
  $("studentSelect").innerHTML=students.length?students.map(s=>`<option value="${esc(s.student_id)}">${esc(s.display_name)}</option>`).join(""):'<option value="">No students yet</option>';
  $("studentSelect").value=selected;$("classStep").textContent=`Current class step: ${classroom.current_phase+1} · ${steps[classroom.current_phase].title.split(" · ")[1]}`;
  showStudent();
 }catch(e){$("progressStatus").textContent=e.message+" Last displayed work may be out of date.";}
 finally{busy=false;}
}
$("guideChoices").addEventListener("click",e=>{const b=e.target.closest("[data-guide]");if(b){guideStep=Number(b.dataset.guide);guide();}});
$("sendStep").addEventListener("click",async()=>{
 $("sendStep").disabled=true;$("sendStatus").textContent="Sending…";
 try{classroom=await api.setStep(classroom.id,guideStep,classroom.phase_revision);$("sendStatus").textContent=`Step ${guideStep+1} is ready on her account. An open lab checks for your update every few seconds.`;await refresh();}
 catch(e){$("sendStatus").textContent=e.message;await refresh();}
 finally{$("sendStep").disabled=false;}
});
$("studentSelect").addEventListener("change",()=>{selected=$("studentSelect").value;showStudent();});
$("refreshNow").addEventListener("click",refresh);
$("teacherSignOut").addEventListener("click",async()=>{closed=true;clearInterval(poll);$("teacherPanel").hidden=true;await api.signOut();location.replace("classroom.html");});
$("addStudentForm").addEventListener("submit",async e=>{
 e.preventDefault();$("addStudent").disabled=true;
 try{const result=await api.rpc("lab_add_student",{p_classroom:classroom.id,p_email:$("studentEmail").value,p_display_name:$("studentDisplay").value});
 $("addStudentStatus").textContent=result.ready?"Account added. Her notebook will appear when she saves work.":"Account registered. She can use Google once it is enabled, or an administrator can create her separate lab-password account.";
 $("addStudentForm").reset();await refresh();}
 catch(e){$("addStudentStatus").textContent=e.message;}finally{$("addStudent").disabled=false;}
});
$("teacherDownload").addEventListener("click",()=>{
 const s=students.find(s=>s.student_id===selected);if(!s?.state)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(s.state,null,2)],{type:"application/json"})),a=document.createElement("a");
 a.href=url;a.download="student-balloon-work.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
(async()=>{
 try{const c=await api.context();if(c?.profile?.role!=="teacher"){location.replace(c?.profile?.role==="student"?"index.html":"classroom.html");return;}
 if(!c.classroom)throw Error("No classroom has been assigned.");classroom=c.classroom;guideStep=classroom.current_phase;
 $("teacherGate").hidden=true;$("teacherPanel").hidden=false;$("classLabel").textContent=classroom.label;$("teacherIdentity").textContent=c.profile.display_name+" · Teacher";
 guide();key();await refresh();poll=setInterval(refresh,5000);}
 catch(e){$("teacherGateMessage").textContent=e.message;}
})();
})();
