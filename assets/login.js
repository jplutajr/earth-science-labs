(function loginMain(){
"use strict";
const $=id=>document.getElementById(id),config=window.CLASSROOM_CONFIG,Client=window.ClassroomClient;
if(!Client.configured(config)){$("notConnected").hidden=false;$("loginForm").hidden=true;return;}
const api=new Client(config);
$("googleArea").hidden=!config.googleEnabled;
async function route(){
 const context=await api.context();
 if(!context?.profile||!context?.classroom)throw Error("This account has not been assigned to a classroom. Ask your teacher to finish the setup.");
 location.replace(context.profile.role==="teacher"?"teacher.html":"index.html");
}
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();$("signInButton").disabled=true;$("loginStatus").textContent="Signing in…";
 try{await api.signIn($("loginEmail").value,$("loginPassword").value);$("loginPassword").value="";await route();}
 catch(e){$("loginStatus").textContent=e.message;await api.signOut();$("loginPassword").value="";$("signInButton").disabled=false;}
});
$("googleSignIn").addEventListener("click",async()=>{
 $("googleSignIn").disabled=true;$("loginStatus").textContent="Opening Google sign-in…";
 try{location.assign(await api.googleURL(new URL("classroom.html",location.href).href));}
 catch(e){$("loginStatus").textContent=e.message;$("googleSignIn").disabled=false;}
});
const params=new URLSearchParams(location.search),code=params.get("code");
if(code||params.has("error")){
 history.replaceState(null,"",location.pathname);
 $("loginStatus").textContent="Finishing Google sign-in…";
 if(code)api.exchangeCode(code).then(route).catch(async e=>{await api.signOut();$("loginStatus").textContent=e.message;});
 else $("loginStatus").textContent="Google sign-in was cancelled or blocked. Try again or use your separate lab login.";
}else if(api.session){$("loginStatus").textContent="Opening your classroom…";route().catch(async e=>{await api.signOut();$("loginStatus").textContent=e.message;});}
})();
