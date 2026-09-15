(function liveCheck(){
const fs=require("node:fs/promises"),assert=require("node:assert/strict"),{chromium}=require("@playwright/test");
(async()=>{
 const base="https://jplutajr.github.io/earth-science-labs/";
 const paths=["index.html","assets/model.js","assets/app.js","assets/styles.css","classroom.html","teacher.html","assets/classroom-config.js","assets/classroom.js","assets/classroom-client.js","assets/login.js","assets/teacher.js","assets/review.js","assets/classroom.css"];
 const expected=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await fs.readFile(p,"utf8")])));
 let ready=false,last="";
 for(let attempt=0;attempt<24;attempt++){
  try{
   for(const p of paths){
    const url=base+(p==="index.html"?"":p)+"?verify="+process.env.GITHUB_SHA;
    const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200,p+" HTTP status");
    assert.equal((await response.text()).trim(),expected[p].trim(),p+" has the current deployment");
   }
   ready=true;break;
  }catch(e){last=String(e.message).slice(0,180);console.log("Waiting for Pages to serve current files, attempt "+(attempt+1));await new Promise(resolve=>setTimeout(resolve,5000));}
 }
 assert.ok(ready,"Current Pages deployment not available: "+last);
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"?practice=1&verify="+process.env.GITHUB_SHA);
  await page.locator("#mark").click();
  await page.locator("#prediction").selectOption("increase");
  await page.locator("#why").fill("The surface stretches.");
  await page.locator("#next").click();
  await page.locator("#layTape").click();
  assert.match(await page.locator("#reading").innerText(),/3\.2 cm/);
  await page.locator("#measurement").fill("3");await page.locator("#record").click();
  assert.match(await page.locator("#measureProgress").innerText(),/1 of 9/);
  assert.deepEqual(errors,[]);
  console.log("LIVE_SITE_OK "+base+" revision "+process.env.GITHUB_SHA);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
})();
