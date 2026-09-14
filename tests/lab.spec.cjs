(function browserTests(){
const {test,expect}=require("@playwright/test");
const fs=require("node:fs/promises");
const M=require("../assets/model.js");
test.beforeEach(async({page})=>{await page.route("**/assets/classroom-config.js",r=>r.fulfill({contentType:"application/javascript",body:"window.CLASSROOM_CONFIG={enabled:false};"}));});
async function setup(page){
 await page.goto("/");
 await page.locator("#mark").click();
 await page.locator("#prediction").selectOption("increase");
 await page.locator("#why").fill("The surface will stretch between the markers.");
 await page.locator("#next").click();
}
async function measureAll(page,d){
 for(const id of M.TARGETS){
  await expect(page.locator("#layTape")).toHaveText(`Lay measuring tape: A → ${id}`);
  await page.locator("#layTape").click();
  await page.locator("#measurement").fill(String(M.nearest(M.distance(d,id))));
  await page.locator("#record").click();
 }
 await expect(page.locator("#measureProgress")).toContainText("9 of 9");
}
async function capture(page,testInfo,label){
 const data=await page.screenshot({type:"jpeg",quality:45,fullPage:false});
 await fs.writeFile(testInfo.outputPath(label+".jpg"),data);
 console.log("LAB_SCREENSHOT_"+label.toUpperCase()+"_BASE64="+data.toString("base64"));
}
test("full student investigation, validated entries, calculations, explanations and portable reports",async({page},testInfo)=>{
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("/");
 await expect(page.locator("#next")).toBeDisabled();
 await page.locator("#mark").click();await page.locator("#prediction").selectOption("increase");
 await expect(page.locator("#next")).toBeDisabled();
 await page.locator("#why").fill("The surface will stretch.");await page.locator("#student").fill('<script>alert("student")</script>');
 await page.locator("#next").click();
 await page.locator("#layTape").click();
 await capture(page,testInfo,"desktop");
 await page.locator("#record").click();await expect(page.locator("#feedback")).toContainText("Type a whole number");
 await page.locator("#measurement").fill("99");await page.locator("#record").click();
 await expect(page.locator("#feedback")).toContainText("Check your rounding");await expect(page.locator("#measureProgress")).toContainText("0 of 9");
 await measureAll(page,20);await page.locator("#next").click();await measureAll(page,30);
 await page.reload();await expect(page.locator("#measureProgress")).toContainText("9 of 9");
 await page.locator("#next").click();
 await page.locator("#saveMath").click();await expect(page.locator("#feedback")).toContainText("Fill in all four");
 await page.locator("#calculate").click();await expect(page.locator("#calcResult")).toHaveText("Enter two numbers.");
 await page.locator("#calcA").fill("3");await page.locator("#calcB").fill("8");await page.locator("#calcOp").selectOption("/");
 await page.locator("#calculate").click();await expect(page.locator("#calcResult")).toHaveText("0.375");
 for(const id of M.TARGETS){
  const expected=M.calculateRow(M.nearest(M.distance(20,id)),M.nearest(M.distance(30,id)));
  for(let i=0;i<4;i++)await page.locator("#math"+i).fill(String(expected[i]));
  await page.locator("#saveMath").click();
 }
 await expect(page.locator("#mathProgress")).toContainText("9 of 9");await expect(page.locator("#graph circle")).toHaveCount(9);
 await page.locator("#next").click();await page.locator("#finish").click();
 await expect(page.locator("#completion")).toContainText("Still to complete");
 await page.locator('[data-observation="farther"]').click();
 const answers={claim:"Farther galaxies had faster rates.",evidence:"B: 3 cm and 0.25 cm/year. J: 22 cm and 1.25 cm/year.",reasoning:"The surface stretched between fixed markers.",connection:"The model shows increasing distances, like the pattern from galaxy observations.",limitation:"The balloon surface is two-dimensional."};
 for(const [id,value] of Object.entries(answers))await page.locator("#"+id).fill(value);
 await page.locator("#finish").click();await expect(page.locator("#completion")).toContainText("Your entries are complete");
 // Revisions must invalidate an old saved answer and its plotted point.
 await page.locator('[data-phase="3"]').click();await page.locator("#math0").fill("999");
 await expect(page.locator('[data-phase="4"]')).toBeDisabled();await expect(page.locator("#graph circle")).toHaveCount(8);
 await page.reload();await expect(page.locator("#math0")).toHaveValue("999");
 await page.locator("#math0").fill("2");await page.locator("#saveMath").click();await page.locator("#next").click();
 await expect(page.locator("#evidence")).toHaveValue(answers.evidence);
 await page.getByText("Save or hand in your work",{exact:true}).click();
 const reportWait=page.waitForEvent("download");await page.locator("#report").click();const report=await reportWait;
 const reportPath=testInfo.outputPath("report.html");await report.saveAs(reportPath);
 const html=await fs.readFile(reportPath,"utf8");
 expect(html).toContain("&lt;script&gt;alert(&quot;student&quot;)&lt;/script&gt;");expect(html).not.toContain('<script>alert("student")</script>');
 expect(html).toContain("teacher review needed");expect(html).toContain("1.125");expect(html).toContain(answers.evidence);
 const csvWait=page.waitForEvent("download");await page.locator("#csv").click();const csv=await csvWait;
 const csvPath=testInfo.outputPath("data.csv");await csv.saveAs(csvPath);const csvText=await fs.readFile(csvPath,"utf8");
 expect(csvText.trim().split(/\r?\n/)).toHaveLength(10);expect(csvText).toContain("J,22,32,10,1.25,30,40");
 const jsonWait=page.waitForEvent("download");await page.locator("#backup").click();const json=await jsonWait;
 const jsonPath=testInfo.outputPath("work.json");await json.saveAs(jsonPath);expect(JSON.parse(await fs.readFile(jsonPath,"utf8")).math.J).toEqual([10,1.25,30,40]);
 page.once("dialog",dialog=>dialog.accept());await page.locator("#newStudent").click();
 await expect(page.locator("#why")).toHaveValue("");await expect(page.locator("#next")).toBeDisabled();
 page.once("dialog",dialog=>dialog.accept());await page.locator("#restoreFile").setInputFiles(jsonPath);
 await expect(page.locator("#claim")).toHaveValue(answers.claim);await expect(page.locator("#graph circle")).toHaveCount(9);
 await page.reload();await expect(page.locator("#evidence")).toHaveValue(answers.evidence);
 expect(errors).toEqual([]);
});
test("mobile layout and keyboard measurement",async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/");
 await page.keyboard.press("Tab");await expect(page.locator(".skip")).toBeFocused();
 await setup(page);await page.locator("#layTape").focus();await page.keyboard.press("Enter");
 await expect(page.locator("#measurement")).toBeFocused();await page.keyboard.type("3");await page.keyboard.press("Enter");
 await expect(page.locator("#measureProgress")).toContainText("1 of 9");
 await page.locator("#layTape").click();await page.evaluate(()=>window.scrollTo(0,340));
 await capture(page,testInfo,"mobile");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await expect(page.locator("#balloon")).toHaveAttribute("role","img");
 await expect(page.locator("#graph")).toHaveAttribute("aria-labelledby","graphTitle graphDesc");
});
test("invalid work files and unavailable browser storage do not crash the lab",async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error("storage blocked");};});
 await page.goto("/");await expect(page.locator("#saveStatus")).toContainText("saving is unavailable");
 await page.locator("#restoreFile").setInputFiles({name:"invalid.json",mimeType:"application/json",buffer:Buffer.from('{"version":99}')});
 await expect(page.locator("#feedback")).toContainText("could not be opened");
 await setup(page);await page.locator("#layTape").click();await expect(page.locator("#reading")).toContainText("3.2 cm");
});
})();
