(function classroomMain(){
"use strict";
const $=id=>document.getElementById(id),config=window.CLASSROOM_CONFIG;
const safeCopy=value=>JSON.parse(JSON.stringify(value));
window.Classroom={async start(){
 const practice=new URLSearchParams(location.search).get("practice")==="1";
 if(practice||!window.ClassroomClient.configured(config)){
  if(practice&&window.ClassroomClient.configured(config)){$("practiceLabel").hidden=false;}
  return {mode:"practice"};
 }
 $("workspace").hidden=true;$("classroomGate").hidden=false;
 const api=new window.ClassroomClient(config);
 if(!api.session){location.replace("classroom.html");return null;}
 try{
  const context=await api.context();
  if(context?.profile?.role==="teacher"){location.replace("teacher.html");return null;}
  if(context?.profile?.role!=="student"||!context.classroom){location.replace("classroom.html");return null;}
  let classroom=context.classroom,record=await api.load(classroom.id),revision=record.revision||0;
  const draftKey="earth-science-classroom:draft:"+context.profile.user_id;
  let pending=null,draft=null,conflicted=false,closed=false,running=null,timer=null,poll=null,replaceHook=null,phaseHook=null,pendingPhase=null,phaseRevision=classroom.phase_revision;
  try{draft=JSON.parse(sessionStorage.getItem(draftKey)||"null");}catch(e){}
  if(draft?.state&&Number.isInteger(draft.revision)){pending=draft.state;conflicted=draft.revision!==revision;}
  let initial=pending||record.state;
  $("classroomGate").hidden=true;$("workspace").hidden=false;$("classroomBar").hidden=false;
  $("classroomIdentity").textContent=context.profile.display_name+" · Student";
  $("teacherStepLabel").textContent="Your teacher's step: "+(classroom.current_phase+1);
  $("classroomSignIn").hidden=true;$("teacherDetails").hidden=true;$("newStudent").hidden=true;
  $("student").hidden=true;document.querySelector('label[for="student"]').hidden=true;
  function status(message,error=false){
   $("cloudStatus").textContent=message;$("saveStatus").textContent=message;$("classroomBar").classList.toggle("connection-error",error);
   $("reloadCloud").hidden=!conflicted;
  }
  function cache(){
   try{if(pending)sessionStorage.setItem(draftKey,JSON.stringify({state:pending,revision}));else sessionStorage.removeItem(draftKey);}catch(e){}
  }
  function enqueue(state){
   if(closed)return;pending=safeCopy(state);cache();
   if(conflicted){status("This notebook changed on another device. Save a work-file backup, then reopen the classroom copy.",true);return;}
   status("Saving to your classroom…");clearTimeout(timer);timer=setTimeout(flush,700);
  }
  async function flush(){
   if(closed||conflicted)return false;
   if(running)return running;
   running=(async()=>{
    while(pending&&!closed&&!conflicted){
     const current=pending;pending=null;
     try{
      const saved=await api.save(classroom.id,current,revision);if(closed)return false;
      revision=saved.revision;cache();status("Saved to your classroom · "+new Date(saved.updated_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));
     }catch(e){
      if(closed)return false;pending=pending||current;
      conflicted=e.code==="40001";cache();
      status(conflicted?"This notebook changed on another device. Save a work-file backup, then reopen the classroom copy.":e.message+" Your current work is still on this screen.",true);
      return false;
     }
    }return true;
   })().finally(()=>{running=null;});
   return running;
  }
  function applyPhase(){
   if(pendingPhase===null||!phaseHook)return;
   const p=pendingPhase;pendingPhase=null;$("joinTeacherStep").hidden=true;phaseHook(p);
  }
  function receivePhase(newClass){
   classroom=newClass;
   $("teacherStepLabel").textContent="Your teacher's step: "+(classroom.current_phase+1);
   if(classroom.phase_revision!==phaseRevision){
    phaseRevision=classroom.phase_revision;pendingPhase=classroom.current_phase;
    $("joinTeacherStep").textContent="Go to teacher's Step "+(pendingPhase+1);$("joinTeacherStep").hidden=false;
    if(!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||""))applyPhase();
   }
  }
  async function checkClass(){
   if(closed)return;
   try{const c=await api.context();if(c?.profile?.role!=="student"||c.classroom?.id!==classroom.id){status("Your classroom access changed. Save a backup and sign in again.",true);return;}receivePhase(c.classroom);}
   catch(e){status(e.message+" The teacher's step may be out of date.",true);}
   if(pending&&!running&&!conflicted)await flush();
  }
  $("joinTeacherStep").addEventListener("click",applyPhase);
  document.addEventListener("focusout",()=>{setTimeout(()=>{if(!closed&&pendingPhase!==null&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||""))applyPhase();},100);});
  $("reloadCloud").addEventListener("click",async()=>{
   if(!window.confirm("Replace this screen with the latest classroom copy? Download a work-file backup first if you need the entries on this screen."))return;
   try{const next=await api.load(classroom.id);if(closed)return;pending=null;conflicted=false;revision=next.revision;cache();replaceHook?.(next.state,classroom.current_phase);status("The latest classroom copy is open.");}
   catch(e){status(e.message,true);}
  });
  $("studentSignOut").addEventListener("click",async()=>{
   $("studentSignOut").disabled=true;clearTimeout(timer);const saved=await flush();
   if((!saved||pending||conflicted)&&!window.confirm("Some work is not saved to the classroom. Cancel to download a work file, or OK to sign out and remove this device's draft.")){$("studentSignOut").disabled=false;return;}
   closed=true;clearInterval(poll);clearTimeout(timer);pending=null;cache();$("workspace").hidden=true;$("classroomBar").hidden=true;
   await api.signOut();location.replace("classroom.html");
  });
  window.addEventListener("beforeunload",e=>{if(pending||running){e.preventDefault();e.returnValue="";}});
  const bridge={mode:"cloud",initial,displayName:context.profile.display_name,teacherPhase:classroom.current_phase,enqueue,flush,
   bind(handlers){replaceHook=handlers.replace;phaseHook=p=>{bridge.teacherPhase=p;handlers.phase(p);};poll=setInterval(checkClass,5000);
    if(conflicted)status("This notebook changed on another device. Save a work-file backup, then reopen the classroom copy.",true);
    else status("Classroom notebook open.");}
  };
  return bridge;
 }catch(e){$("classroomGateMessage").textContent=e.message+" Reload the page to try again.";return null;}
}};
})();
