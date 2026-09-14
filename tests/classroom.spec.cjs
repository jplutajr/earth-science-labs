(function classroomBrowserTests(){
const {test,expect}=require("@playwright/test"),M=require("../assets/model.js");
const fs=require("node:fs/promises");
const cid="cccccccc-cccc-cccc-cccc-ccccccccccc1";
function backend(){
 const cls={id:cid,label:"Earth Science Test Class",current_phase:0,phase_revision:0};
 const profiles={teacher:{user_id:"teacher",display_name:"Teacher",role:"teacher"},student:{user_id:"student",display_name:"Student 01",role:"student"},other:{user_id:"other",display_name:"Student 02",role:"student"}};
 const records={student:{state:null,revision:0,updated_at:null},other:{state:null,revision:0,updated_at:null}};
 let offline=false;
 async function route(r){
  const request=r.request(),url=new URL(request.url()),body=request.postDataJSON()||{},user=(request.headers().authorization||"").replace("Bearer token-","");
  let data={},status=200;
  if(url.pathname==="/auth/v1/token"){const id=body.email?.split("@")[0]||"student";if(body.password!=="lab-test-password"){status=400;data={code:"invalid_credentials"};}else data={access_token:"token-"+id,refresh_token:"refresh-"+id,expires_in:3600,user:{id}};}
  else if(url.pathname==="/auth/v1/logout")data={};
  else if(!profiles[user]){status=401;data={code:"unauthorized"};}
  else{
   const name=url.pathname.split("/").pop(),profile=profiles[user];
   if(name==="lab_context")data={profile,classroom:cls};
   else if(name==="lab_load"){
    if(profile.role!=="student"||body.p_classroom!==cid){status=403;data={code:"42501"};}else data=records[user];
   }else if(name==="lab_save"){
    if(offline){await r.abort();return;}
    if(profile.role!=="student"||body.p_classroom!==cid){status=403;data={code:"42501"};}
    else if(body.p_expected_revision!==records[user].revision){status=409;data={code:"40001"};}
    else{records[user]={state:body.p_state,revision:records[user].revision+1,updated_at:new Date().toISOString()};data={revision:records[user].revision,updated_at:records[user].updated_at};}
   }else if(name==="lab_dashboard"){
    if(profile.role!=="teacher"){status=403;data={code:"42501"};}
    else data={classroom:cls,students:["student","other"].map(id=>({student_id:id,display_name:profiles[id].display_name,...records[id]}))};
   }else if(name==="lab_set_step"){
    if(profile.role!=="teacher"){status=403;data={code:"42501"};}
    else if(body.p_expected_revision!==cls.phase_revision){status=409;data={code:"40001"};}
    else{cls.current_phase=body.p_phase;cls.phase_revision++;data=cls;}
   }else if(name==="lab_add_student"){data={registered:true,ready:true};}
   else{status=404;data={};}
  }
  await r.fulfill({status,contentType:"application/json",body:JSON.stringify(data)});
 }
 async function attach(context){
  await context.route("**/assets/classroom-config.js",r=>r.fulfill({contentType:"application/javascript",body:'window.CLASSROOM_CONFIG={enabled:true,googleEnabled:true,supabaseUrl:"https://classroom-test.supabase.co",publishableKey:"sb_publishable_test"};'}));
  await context.route("https://classroom-test.supabase.co/**",route);
 }
 return {attach,cls,records,setOffline:value=>{offline=value;}};
}
async function login(page,id){
 await page.goto("/classroom.html");await page.locator("#loginEmail").fill(id+"@example.test");await page.locator("#loginPassword").fill("lab-test-password");await page.locator("#signInButton").click();
}
test("teacher sends a step, sees student work, and student resumes the assigned portion",async({browser},testInfo)=>{
 const b=backend(),tc=await browser.newContext(),sc=await browser.newContext();
 await b.attach(tc);await b.attach(sc);const teacher=await tc.newPage(),student=await sc.newPage();
 const errors=[];for(const p of[teacher,student])p.on("pageerror",e=>errors.push(e.message));
 await login(teacher,"teacher");await expect(teacher.locator("#teacherPanel")).toBeVisible();
 await teacher.locator('[data-guide="1"]').click();await teacher.locator("#sendStep").click();await expect(teacher.locator("#sendStatus")).toContainText("Step 2 is ready");
 await login(student,"student");await expect(student.locator("#stepHeading")).toHaveText("Measure at 20 cm");
 await expect(student.locator("#teacherDetails")).toBeHidden();await expect(student.locator("#newStudent")).toBeHidden();
 await student.locator("#layTape").click();await student.locator("#measurement").fill("3");await student.locator("#record").click();
 await expect(student.locator("#cloudStatus")).toContainText("Saved to your classroom",{timeout:10000});
 await teacher.locator("#refreshNow").click();await expect(teacher.locator("#liveProgress")).toContainText("1/18");
 // A requested later step cannot fabricate missing calculations.
 await teacher.locator('[data-guide="3"]').click();await teacher.locator("#sendStep").click();
 await expect(student.locator("#stepHeading")).toHaveText("Calculate the model rates",{timeout:12000});
 await expect(student.locator("#saveMath")).toBeDisabled();await expect(student.locator("#mathData")).toContainText("Record both measurements");
 await student.reload();await expect(student.locator("#stepHeading")).toHaveText("Calculate the model rates");
 await expect(student.locator("#tableWrap tbody tr").first()).toContainText("3");
 // A student requesting the teacher URL is routed back to the lab.
 await student.goto("/teacher.html");await expect(student.locator("#stepHeading")).toHaveText("Calculate the model rates");
 await teacher.setViewportSize({width:1280,height:960});await teacher.evaluate(()=>document.querySelector("#teacherPanel").scrollIntoView());
 const screenshot=await teacher.screenshot({type:"jpeg",quality:45});await fs.writeFile(testInfo.outputPath("teacher.jpg"),screenshot);console.log("CLASSROOM_TEACHER_JPEG="+screenshot.toString("base64"));
 await teacher.setViewportSize({width:390,height:844});expect(await teacher.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);await tc.close();await sc.close();
});
test("account switch isolates notebooks and sign-out removes the device draft",async({browser})=>{
 const b=backend();b.cls.current_phase=1;b.cls.phase_revision=1;
 const c=await browser.newContext();await b.attach(c);const p=await c.newPage();await login(p,"student");
 await p.locator("#layTape").click();await p.locator("#measurement").fill("3");await p.locator("#record").click();
 await expect(p.locator("#cloudStatus")).toContainText("Saved to your classroom");
 await p.locator("#studentSignOut").click();await expect(p.locator("#loginForm")).toBeVisible();
 expect(await p.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("earth-science-classroom:")))).toEqual([]);
 await p.locator("#loginEmail").fill("other@example.test");await p.locator("#loginPassword").fill("lab-test-password");await p.locator("#signInButton").click();
 await expect(p.locator("#measureProgress")).toContainText("0 of 9");
 expect(b.records.student.state.measurements[20].B).toBe(3);await c.close();
});
test("offline saves recover and stale-device writes require an explicit reload",async({browser})=>{
 const b=backend();b.cls.current_phase=1;b.cls.phase_revision=1;
 const c=await browser.newContext();await b.attach(c);const p=await c.newPage();await login(p,"student");
 await expect(p.locator("#cloudStatus")).toContainText("Saved to your classroom");
 b.setOffline(true);await p.locator("#layTape").click();await p.locator("#measurement").fill("3");await p.locator("#record").click();
 await expect(p.locator("#cloudStatus")).toContainText("still on this screen");
 b.setOffline(false);await expect(p.locator("#cloudStatus")).toContainText("Saved to your classroom",{timeout:12000});
 b.records.student.state.why="Updated on another device";b.records.student.revision++;
 await p.locator("#layTape").click();await p.locator("#measurement").fill("5");await p.locator("#record").click();
 await expect(p.locator("#reloadCloud")).toBeVisible();expect(b.records.student.state.measurements[20].C).toBeUndefined();
 p.once("dialog",d=>d.accept());await p.locator("#reloadCloud").click();
 await expect(p.locator("#cloudStatus")).toContainText("latest classroom copy");
 await expect(p.locator("#measureProgress")).toContainText("1 of 9");await c.close();
});
test("an unconfigured deployment clearly states accounts are not connected",async({page})=>{
 await page.route("**/assets/classroom-config.js",r=>r.fulfill({contentType:"application/javascript",body:"window.CLASSROOM_CONFIG={enabled:false};"}));
 await page.goto("/classroom.html");await expect(page.locator("#notConnected")).toBeVisible();await expect(page.locator("#loginForm")).toBeHidden();
 await page.goto("/teacher.html");await expect(page.locator("#teacherGateMessage")).toContainText("not connected");await expect(page.locator("#teacherPanel")).toBeHidden();
});

test("guests keep the practice lab while connected accounts remain separate",async({browser})=>{
 const b=backend(),c=await browser.newContext();await b.attach(c);const p=await c.newPage();
 await p.goto("/");await expect(p.locator("#workspace")).toBeVisible();
 await expect(p.locator("#practiceLabel")).toBeVisible();
 await p.locator("#mark").click();await expect(p.locator("#classroomBar")).toBeHidden();
 expect(b.records.student.revision).toBe(0);expect(b.records.other.revision).toBe(0);
 await c.close();
});
test("Google availability follows provider settings and handles a network outage",async({page})=>{
 let available=false,offline=false,requests=0;
 await page.route("**/assets/classroom-config.js",r=>r.fulfill({contentType:"application/javascript",body:'window.CLASSROOM_CONFIG={enabled:true,googleEnabled:"auto",supabaseUrl:"https://classroom-test.supabase.co",publishableKey:"sb_publishable_test"};'}));
 await page.route("https://classroom-test.supabase.co/**",async r=>{
  requests++;expect(r.request().method()).toBe("GET");expect(new URL(r.request().url()).pathname).toBe("/auth/v1/settings");
  expect(r.request().headers().apikey).toBe("sb_publishable_test");
  if(offline){await r.abort();return;}
  await r.fulfill({contentType:"application/json",body:JSON.stringify({external:{google:available}})});
 });
 await page.goto("/classroom.html");await expect(page.locator("#googlePendingMessage")).toContainText("being set up");
 await expect(page.locator("#googleArea")).toBeHidden();await expect(page.locator("#loginForm")).toBeVisible();
 available=true;await page.reload();await expect(page.locator("#googleSignIn")).toBeVisible();await expect(page.locator("#googlePending")).toBeHidden();
 offline=true;await page.reload();await expect(page.locator("#googlePendingMessage")).toContainText("unavailable right now");await expect(page.locator("#googleArea")).toBeHidden();
 expect(requests).toBe(3);
});
})();
