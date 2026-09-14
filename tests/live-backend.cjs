/* Read-only production checks. Uses only the browser's public key; no user credentials. */
const fs=require("node:fs/promises"),vm=require("node:vm"),assert=require("node:assert/strict");
(async()=>{
 const context={window:{Object}};vm.runInNewContext(await fs.readFile("assets/classroom-config.js","utf8"),context);
 const config=context.window.CLASSROOM_CONFIG;
 assert.equal(config.enabled,true);assert.ok(config.publishableKey.startsWith("sb_publishable_"));
 const headers={apikey:config.publishableKey,"Content-Type":"application/json"};
 const settings=await fetch(config.supabaseUrl+"/auth/v1/settings",{headers,signal:AbortSignal.timeout(15000)});
 assert.equal(settings.status,200,"Public authentication settings are reachable");
 const data=await settings.json();
 console.log("AUTH_PROVIDER_STATUS "+JSON.stringify({google:data.external?.google===true,email:data.external?.email===true}));
 for(const [path,method] of [["/rest/v1/rpc/lab_context","POST"],["/rest/v1/lab_progress?select=student_id","GET"]]){
  const response=await fetch(config.supabaseUrl+path,{method,headers,...(method==="POST"?{body:"{}"}:{}),signal:AbortSignal.timeout(15000)});
  assert.ok([401,403].includes(response.status),"Anonymous classroom access must be denied: "+path+" returned "+response.status);
 }
 console.log("LIVE_BACKEND_OK public settings reachable; anonymous records and classroom context denied");
})().catch(e=>{console.error(e.message);process.exitCode=1;});
