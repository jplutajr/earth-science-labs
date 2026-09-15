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
test("teacher flags legacy drafts and new writing live without editing the student's notebook",async({browser},testInfo)=>{
 const b=backend();b.cls.current_phase=3;
 const legacy=M.fresh();delete legacy.draftMeasurements;legacy.student="Student 01";legacy.marked=true;legacy.phase=3;legacy.prediction="increase";legacy.why="The surface grows.";
 for(const d of[20,30])for(const id of M.TARGETS)legacy.measurements[d][id]=M.nearest(M.distance(d,id));
 legacy.math.C=M.calculateRow(5,8);legacy.draftMath.B=["9",".25","6","8"];
 legacy.answers.evidence="Galaxy B started at 3 cm and had a rate of .25 cm/year.";
 b.records.student={state:legacy,revision:116,updated_at:new Date().toISOString()};
 const initial=JSON.parse(JSON.stringify(b.records.student));
 const tc=await browser.newContext(),sc=await browser.newContext();await b.attach(tc);await b.attach(sc);
 const teacher=await tc.newPage(),student=await sc.newPage(),errors=[];
 teacher.on("pageerror",e=>errors.push(e.message));student.on("pageerror",e=>errors.push(e.message));
 await login(teacher,"teacher");
 await expect(teacher.locator("#review-math-B-0")).toHaveClass(/needs-review/);
 await expect(teacher.locator("#review-math-B-0")).toContainText("Expected 2");
 await expect(teacher.locator("#reviewTitle")).toContainText("1 item to review");
 await teacher.locator("#reviewTitle").scrollIntoViewIfNeeded();await teacher.screenshot({path:testInfo.outputPath("teacher-review-numbers.png")});
 await teacher.locator("#refreshNow").click();expect(b.records.student).toEqual(initial);
 await login(student,"student");await expect(student.locator("#stepHeading")).toHaveText("Calculate the model rates");
 await expect(student.locator("#math0")).toHaveValue("9");
 await expect(student.locator("#cloudStatus")).toContainText("Saved to your classroom");
 expect(b.records.student.state.measurements).toEqual(initial.state.measurements);
 expect(b.records.student.state.answers).toEqual(initial.state.answers);
 expect(b.records.student.state.math).toEqual(initial.state.math);
 expect(b.records.student.state.protocol).toBe(initial.state.protocol);
 expect(b.records.student.state.started).toBe(initial.state.started);
 // Corrections reach the teacher by the existing poll, without clicking Refresh.
 await student.locator("#math0").fill("2");await student.locator("#saveMath").click();
 await expect(teacher.locator("#review-math-B-0")).not.toHaveClass(/needs-review/,{timeout:12000});
 await expect(teacher.locator("#reviewTitle")).toContainText("No automatic flags");
 expect(b.records.student.state.math.B).toEqual([2,.25,6,8]);
 expect(b.records.student.state.math.C).toEqual(initial.state.math.C);
 await teacher.locator('[data-guide="4"]').click();await teacher.locator("#sendStep").click();
 await expect(student.locator("#joinTeacherStep")).toBeVisible({timeout:12000});await student.locator("#joinTeacherStep").click();
 await expect(student.locator("#stepHeading")).toHaveText("Explain your findings");
 await student.locator("#claim").fill("Farther galaxies have smaller rates.");
 await student.locator("#reasoning").fill("The surface stretched between the dots.");
 await student.locator("#connection").fill("Real galaxies get bigger.");
 await expect(teacher.locator("#review-answer-claim")).toHaveClass(/needs-review/,{timeout:12000});
 await expect(teacher.locator("#review-answer-connection")).toHaveClass(/needs-review/);
 await expect(teacher.locator("#review-answer-reasoning")).not.toHaveClass(/needs-review/);
 await expect(teacher.locator("#review-answer-claim")).toContainText("Compare B and J");
 await expect(student.locator(".review-badge,.review-summary,#reviewAnnouncement")).toHaveCount(0);
 expect(await student.evaluate(()=>Boolean(window.BalloonReview))).toBe(false);
 await teacher.locator("#reviewTitle").scrollIntoViewIfNeeded();
 await teacher.screenshot({path:testInfo.outputPath("teacher-review-desktop.png")});
 await teacher.locator('a[href="#review-answer-claim"]').click();
 await expect(teacher.locator("#review-answer-claim")).toBeInViewport();
 await teacher.screenshot({path:testInfo.outputPath("teacher-review-explanations.png")});
 await teacher.setViewportSize({width:390,height:844});await teacher.locator("#reviewTitle").scrollIntoViewIfNeeded();
 expect(await teacher.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await teacher.screenshot({path:testInfo.outputPath("teacher-review-mobile.png")});
 await student.locator("#claim").fill("Farther galaxies have larger rates.");
 await student.locator("#connection").fill("Galaxies do not grow bigger. Space between them expands.");
 await expect(teacher.locator("#reviewTitle")).toContainText("No automatic flags",{timeout:12000});
 // Written content is text, including when a response also triggers a flag.
 await student.locator("#claim").fill('<img src=x onerror="window.injected=true"> Farther galaxies have smaller rates.');
 await expect(teacher.locator("#review-answer-claim")).toHaveClass(/needs-review/,{timeout:12000});
 await expect(teacher.locator("#review-answer-claim img")).toHaveCount(0);
 expect(await teacher.evaluate(()=>window.injected)).toBeUndefined();
 expect(b.records.student.state.measurements).toEqual(initial.state.measurements);
 expect(b.records.student.state.answers.evidence).toBe(initial.state.answers.evidence);
 expect(b.records.student.revision).toBeGreaterThan(initial.revision);expect(errors).toEqual([]);
 await tc.close();await sc.close();
});
test("teacher sees a rejected measurement draft while the prior recorded value survives",async({browser})=>{
 const b=backend();b.cls.current_phase=1;
 const s=M.fresh();s.marked=true;s.phase=1;s.measurements[20].B=3;
 b.records.student={state:s,revision:12,updated_at:new Date().toISOString()};
 const tc=await browser.newContext(),sc=await browser.newContext();await b.attach(tc);await b.attach(sc);
 const teacher=await tc.newPage(),student=await sc.newPage();await login(teacher,"teacher");await login(student,"student");
 await student.locator('#measureChoices [data-galaxy="B"]').click();await student.locator("#layTape").click();
 await student.locator("#measurement").fill("99");await student.locator("#record").click();
 await expect(student.locator("#feedback")).toContainText("Check your rounding");
 await expect(teacher.locator("#review-measure-20-B")).toHaveClass(/needs-review/,{timeout:12000});
 await expect(teacher.locator("#review-measure-20-B")).toContainText("99");
 await expect(teacher.locator("#review-measure-20-B")).toContainText("Recorded: 3");
 expect(b.records.student.state.measurements[20].B).toBe(3);
 await expect(student.locator("#measureProgress")).toContainText("1 of 9");
 await student.locator("#measurement").fill("");
 await expect(teacher.locator("#review-measure-20-B")).not.toHaveClass(/needs-review/,{timeout:12000});
 await student.locator("#measurement").fill("3");await student.locator("#record").click();
 await expect(teacher.locator("#review-measure-20-B")).not.toContainText("Draft",{timeout:12000});
 expect(b.records.student.state.measurements[20].B).toBe(3);expect(b.records.student.state.draftMeasurements[20].B).toBeUndefined();
 await tc.close();await sc.close();
});
test("time instructions preserve saved answers and drafts across reload while monitoring and new saves continue",async({browser},testInfo)=>{
 const b=backend();b.cls.current_phase=3;
 const s=M.fresh();s.student="Student 01";s.marked=true;s.phase=3;s.prediction="increase";s.why="The surface will stretch.";
 for(const id of M.TARGETS){for(const d of[20,30])s.measurements[d][id]=M.nearest(M.distance(d,id));s.math[id]=M.calculateRow(s.measurements[20][id],s.measurements[30][id]);}
 delete s.math.B;s.draftMath.B=["9",".25","6","8"];s.draftMeasurements[20].C="99";
 s.answers={observation:"closer",claim:"Farther galaxies have smaller rates.",evidence:"Galaxy B started at 3 cm.",reasoning:"The surface stretched.",connection:"Space expands.",limitation:"The surface is 2D."};
 const original=JSON.parse(JSON.stringify(s));b.records.student={state:s,revision:500,updated_at:new Date().toISOString()};
 const tc=await browser.newContext(),sc=await browser.newContext();await b.attach(tc);await b.attach(sc);
 const teacher=await tc.newPage(),student=await sc.newPage();await login(teacher,"teacher");
 await expect(teacher.locator("#reviewTitle")).toContainText("4 items to review");
 expect(b.records.student.state).toEqual(original);expect(b.records.student.revision).toBe(500);
 await login(student,"student");await expect(student.locator("#cloudStatus")).toContainText("Saved to your classroom");
 expect(b.records.student.state).toEqual(original);
 await student.reload();await expect(student.locator("#cloudStatus")).toContainText("Saved to your classroom");
 expect(b.records.student.state).toEqual(original);
 await expect(student.locator("#math0")).toHaveValue("9");
 for(const [key,value] of Object.entries(original.answers))if(key!=="observation")await expect(student.locator("#"+key)).toHaveValue(value);
 await expect(student.locator('[data-observation="closer"]')).toHaveAttribute("aria-pressed","true");
 await expect(student.locator("#mathData")).toContainText("First Measurement — Year 0");
 await expect(student.locator("#mathData")).toContainText("Second Measurement — Year 8");
 await expect(student.locator("#mathData")).toContainText("Time passed = 8 model years");
 await expect(student.locator(".rate-rule")).toContainText("Change ÷ Time = Rate");
 await expect(student.locator("#rateInstruction")).toHaveText("Step 2: Change ÷ 8 years = Rate");
 await expect(student.locator("#prediction24Instruction")).toHaveText("Rate × 24 years = predicted change after 24 years");
 await student.locator("#mathPanel").scrollIntoViewIfNeeded();await student.screenshot({path:testInfo.outputPath("model-time-desktop.png")});
 await student.locator('#mathChoices [data-galaxy="J"]').click();await expect(student.locator("#mathData")).toContainText("First distance: 22 cm");
 await expect(student.locator("#mathData")).toContainText("Time passed = 8 model years");await expect(student.locator("#math1")).toHaveValue("1.25");
 await student.locator('#mathChoices [data-galaxy="B"]').click();await expect(student.locator("#mathData")).toContainText("First distance: 3 cm");
 await student.locator("#math0").fill("2");await student.locator("#saveMath").click();
 await expect(teacher.locator("#review-math-B-0")).not.toHaveClass(/needs-review/,{timeout:12000});
 await expect(teacher.locator("#reviewTitle")).toContainText("3 items to review");
 await expect(teacher.locator("#review-measure-20-C")).toHaveClass(/needs-review/);
 await expect(teacher.locator("#review-answer-claim")).toHaveClass(/needs-review/);
 expect(b.records.student.state.answers).toEqual(original.answers);
 expect(b.records.student.state.measurements).toEqual(original.measurements);
 expect(b.records.student.state.draftMeasurements).toEqual(original.draftMeasurements);
 expect(b.records.student.state.math.B).toEqual([2,.25,6,8]);
 await student.reload();await expect(student.locator("#math1")).toHaveValue("0.25");await expect(student.locator("#math2")).toHaveValue("6");
 await student.setViewportSize({width:390,height:844});await student.locator("#mathPanel").scrollIntoViewIfNeeded();
 expect(await student.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await student.screenshot({path:testInfo.outputPath("model-time-mobile.png")});
 await student.locator("#changeInstruction").scrollIntoViewIfNeeded();await student.screenshot({path:testInfo.outputPath("model-rate-mobile.png")});
 // Longer explanations must not widen the existing horizontally scrollable table.
 const widths=await student.evaluate(()=>{
  const table=document.querySelector("#tableWrap table"),current=table.scrollWidth,head=table.tHead.innerHTML;
  table.tHead.innerHTML='<tr><th>Galaxy</th><th>At 20 cm<br>diameter (cm)</th><th>At 30 cm<br>diameter (cm)</th><th>Change<br>(cm)</th><th>Model rate<br>(cm/year)</th><th>Motion in<br>24 years (cm)</th><th>Motion in<br>32 years (cm)</th></tr>';
  const previous=table.scrollWidth;table.tHead.innerHTML=head;return {current,previous};
 });
 expect(widths.current).toBeLessThanOrEqual(widths.previous);
 await student.locator('[data-phase="1"]').click();await expect(student.locator("#measurePanel .model-time")).toContainText("First Measurement — Year 0");
 await student.locator('#measureChoices [data-galaxy="C"]').click();await expect(student.locator("#measurement")).toHaveValue("99");
 await expect(student.locator("#measurePanel .model-time")).toContainText("Second Measurement — Year 8");
 await expect(student.locator("#measurePanel .model-time")).toContainText("Time passed = 8 model years");
 await tc.close();await sc.close();
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
