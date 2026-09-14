(function authTests(){
const test=require("node:test"),assert=require("node:assert/strict");
const {ClassroomClient:C}=require("../assets/classroom-client.js");
function storage(){const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
const config={enabled:true,googleEnabled:true,supabaseUrl:"https://classroom-test.supabase.co",publishableKey:"sb_publishable_test"};
const payload=()=>({access_token:"access",refresh_token:"refresh",expires_in:3600,user:{id:"student-1"},provider_token:"never-store-google-token"});
const response=value=>new Response(JSON.stringify(value),{status:200});
test("configuration accepts public keys and rejects secrets",()=>{
 assert.equal(C.configured(config),true);assert.equal(C.configured({...config,enabled:false}),false);
 assert.equal(C.configured({...config,publishableKey:"sb_secret_not_public"}),false);
 assert.equal(C.configured({...config,supabaseUrl:"http://unsafe.example"}),false);
});
test("sign-in stores only session tokens and user id, not passwords or Google tokens",async()=>{
 const s=storage(),api=new C(config,{storage:s,fetch:async()=>response(payload())});
 await api.signIn("student@example.test","not-logged");const saved=s.getItem(api.key);
 assert.ok(saved.includes("student-1"));assert.ok(!saved.includes("not-logged"));assert.ok(!saved.includes("never-store-google-token"));
 await api.signOut();assert.equal(s.getItem(api.key),null);
});
test("refresh is shared by simultaneous requests and cannot restore a signed-out session",async()=>{
 let resolve,requests=0;
 const api=new C(config,{storage:storage(),fetch:()=>{requests++;return new Promise(r=>{resolve=r;});}});
 api.remember({...payload(),expires_at:1});
 const first=api.refresh(),second=api.refresh();assert.equal(requests,1);
 // Clear local identity before the refresh completes. No logout HTTP request is needed for this race check.
 api.generation++;api.remember(null);resolve(response(payload()));
 await assert.rejects(first,e=>e.code==="CANCELLED");await assert.rejects(second,e=>e.code==="CANCELLED");assert.equal(api.session,null);
});
test("OAuth uses PKCE, a fixed callback, and one-use verifier",async()=>{
 const s=storage(),requests=[],api=new C(config,{storage:s,fetch:async(url,args)=>{requests.push({url,body:JSON.parse(args.body)});return response(payload());}});
 const url=new URL(await api.googleURL("https://jplutajr.github.io/earth-science-labs/classroom.html"));
 assert.equal(url.searchParams.get("provider"),"google");assert.equal(url.searchParams.get("code_challenge_method"),"s256");assert.equal(url.searchParams.get("code_challenge").length,43);
 assert.equal(url.searchParams.get("redirect_to"),"https://jplutajr.github.io/earth-science-labs/classroom.html");
 assert.ok(!url.href.includes("code_verifier"));
 const verifier=JSON.parse(s.getItem(api.key+":pkce")).verifier;await api.exchangeCode("one-use-code");
 assert.equal(requests[0].body.code_verifier,verifier);assert.equal(requests[0].body.auth_code,"one-use-code");assert.equal(s.getItem(api.key+":pkce"),null);
 await assert.rejects(()=>api.exchangeCode("replayed"),e=>e.code==="PKCE");
});
test("failed save preserves a conflict error and never retries as a privileged request",async()=>{
 let calls=0;const api=new C(config,{storage:storage(),fetch:async()=>{calls++;return new Response(JSON.stringify({code:"40001"}),{status:409});}});
 api.remember({...payload(),expires_at:Date.now()/1000+3600});
 await assert.rejects(()=>api.save("class",{},1),e=>e.code==="40001");assert.equal(calls,1);
});
})();
