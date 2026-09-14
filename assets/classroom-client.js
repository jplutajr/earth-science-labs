(function(root){const api=(function clientFactory(){
"use strict";
class ClassroomError extends Error{
 constructor(message,code="",status=0){super(message);this.name="ClassroomError";this.code=code;this.status=status;}
}
class ClassroomClient{
 constructor(config,options={}){
  this.config=config;this.fetch=options.fetch||globalThis.fetch.bind(globalThis);
  this.storage=options.storage||globalThis.sessionStorage;this.session=null;this.refreshing=null;this.generation=0;
  this.key="earth-science-classroom:session:v1";
  try{const value=JSON.parse(this.storage.getItem(this.key)||"null");if(value?.access_token&&value?.refresh_token&&value?.user?.id)this.session=value;}catch(e){}
 }
 static configured(c){
  if(!c?.enabled||!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(c.supabaseUrl)||typeof c.publishableKey!=="string")return false;
  if(c.publishableKey.startsWith("sb_secret_"))return false;
  if(c.publishableKey.startsWith("sb_publishable_"))return true;
  try{return JSON.parse(atob(c.publishableKey.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).role==="anon";}catch(e){return false;}
 }
 remember(value){
  this.session=value?{access_token:value.access_token,refresh_token:value.refresh_token,expires_at:value.expires_at,user:{id:value.user.id}}:null;
  try{if(this.session)this.storage.setItem(this.key,JSON.stringify(this.session));else this.storage.removeItem(this.key);}catch(e){if(value){this.session=null;throw new ClassroomError("This browser must allow session storage for classroom sign-in. Ask your teacher for help.","STORAGE");}}
 }
 async request(path,body,token){
  let response;
  try{response=await this.fetch(this.config.supabaseUrl+path,{method:"POST",headers:{"Content-Type":"application/json",apikey:this.config.publishableKey,...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body||{}),signal:AbortSignal.timeout(20000)});}
  catch(e){throw new ClassroomError("Cannot reach the classroom. Check your connection and try again.","NETWORK");}
  const text=await response.text();let data={};try{data=text?JSON.parse(text):{};}catch(e){throw new ClassroomError("The classroom returned an unexpected response.","RESPONSE",response.status);}
  if(!response.ok){
   const code=data.code||data.error_code||"REQUEST";
   const message=code==="40001"?"This work changed in another tab or device. Reopen the saved work before continuing.":response.status===401||response.status===403?"Sign in again or ask your teacher to check your classroom access.":code==="42501"?"This account does not have permission for that classroom.":response.status===429?"Too many attempts. Wait a little and try again.":"The classroom could not complete that request.";
   throw new ClassroomError(message,code,response.status);
  }
  return data;
 }
 async signIn(email,password){
  const generation=++this.generation;this.remember(null);
  let data;
  try{data=await this.request("/auth/v1/token?grant_type=password",{email:email.trim(),password});}
  catch(e){if(e.code==="NETWORK")throw e;throw new ClassroomError("Sign-in did not work. Check your email and password, or ask your teacher for help.",e.code,e.status);}
  if(generation!==this.generation)throw new ClassroomError("Sign-in was cancelled.","CANCELLED");
  if(!data.access_token||!data.refresh_token||!data.user?.id)throw new ClassroomError("The sign-in response was incomplete.","RESPONSE");
  this.remember({...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in});return data.user;
 }
 async refresh(){
  if(this.refreshing)return this.refreshing;
  if(!this.session)throw new ClassroomError("Please sign in.","SIGNED_OUT",401);
  const generation=this.generation,token=this.session.refresh_token;
  this.refreshing=(async()=>{
   const data=await this.request("/auth/v1/token?grant_type=refresh_token",{refresh_token:token});
   if(generation!==this.generation)throw new ClassroomError("The account changed.","CANCELLED");
   if(!data.access_token||!data.user?.id)throw new ClassroomError("Please sign in again.","SIGNED_OUT",401);
   this.remember({...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in});
  })().catch(e=>{if(generation===this.generation&&e.code!=="NETWORK")this.remember(null);throw e;}).finally(()=>{this.refreshing=null;});
  return this.refreshing;
 }
 async rpc(name,args={},retry=true){
  if(!this.session)throw new ClassroomError("Please sign in.","SIGNED_OUT",401);
  if(this.session.expires_at<Date.now()/1000+60)await this.refresh();
  const generation=this.generation;
  try{const data=await this.request("/rest/v1/rpc/"+name,args,this.session.access_token);if(generation!==this.generation)throw new ClassroomError("The account changed.","CANCELLED");return data;}
  catch(e){if(e.status===401&&retry&&generation===this.generation){await this.refresh();return this.rpc(name,args,false);}throw e;}
 }
 async googleURL(callback){
  if(!this.config.googleEnabled)throw new ClassroomError("Google sign-in has not been connected yet.","CONFIG");
  const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=base64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))));
  try{this.storage.setItem(this.key+":pkce",JSON.stringify({verifier,created:Date.now()}));}catch(e){throw new ClassroomError("Allow session storage to use Google sign-in.","STORAGE");}
  const url=new URL(this.config.supabaseUrl+"/auth/v1/authorize");
  url.search=new URLSearchParams({provider:"google",redirect_to:callback,code_challenge:challenge,code_challenge_method:"s256",prompt:"select_account"}).toString();
  return url.href;
 }
 async exchangeCode(code){
  let pending;try{pending=JSON.parse(this.storage.getItem(this.key+":pkce")||"null");this.storage.removeItem(this.key+":pkce");}catch(e){}
  if(!pending?.verifier||Date.now()-pending.created>600000)throw new ClassroomError("Google sign-in expired or started in another tab. Choose Sign in with Google again.","PKCE");
  const generation=++this.generation;
  const data=await this.request("/auth/v1/token?grant_type=pkce",{auth_code:code,code_verifier:pending.verifier});
  if(generation!==this.generation)throw new ClassroomError("Sign-in was cancelled.","CANCELLED");
  if(!data.access_token||!data.refresh_token||!data.user?.id)throw new ClassroomError("The sign-in response was incomplete.","RESPONSE");
  this.remember({...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in});
  return data.user;
 }
 async signOut(){
  const token=this.session?.access_token;++this.generation;this.remember(null);
  if(token){try{await this.request("/auth/v1/logout?scope=local",{},token);}catch(e){}}
 }
 context(){return this.rpc("lab_context");}
 load(classroom){return this.rpc("lab_load",{p_classroom:classroom});}
 save(classroom,state,revision){return this.rpc("lab_save",{p_classroom:classroom,p_state:state,p_expected_revision:revision});}
 dashboard(classroom){return this.rpc("lab_dashboard",{p_classroom:classroom});}
 setStep(classroom,phase,revision){return this.rpc("lab_set_step",{p_classroom:classroom,p_phase:phase,p_expected_revision:revision});}
}
return {ClassroomClient,ClassroomError};
})();if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(root,api);})(globalThis);
