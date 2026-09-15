const test=require("node:test"),assert=require("node:assert/strict"),M=require("../assets/model.js"),R=require("../assets/review.js");
function notebook(){
 const s=M.fresh();s.marked=true;s.prediction="increase";s.why="I think the surface will grow.";s.phase=3;
 for(const d of [20,30])for(const id of M.TARGETS)s.measurements[d][id]=M.nearest(M.distance(d,id));
 return s;
}
test("review checks current numeric drafts without changing saved work",()=>{
 const s=notebook();s.draftMeasurements[20].B="99";s.draftMath.B=["9",".25","6","8"];
 const before=JSON.stringify(s),r=R.review(s);
 assert.equal(r.flags.length,2);assert.equal(r.measurements[20].B.expected,3);assert.equal(r.measurements[20].B.saved,3);
 assert.equal(r.math.B[0].expected,2);assert.equal(r.math.B[1].issue,undefined);
 assert.equal(JSON.stringify(s),before);
 s.draftMeasurements[20].B="3";s.draftMath.B[0]="2";assert.equal(R.review(s).flags.length,0);
});
test("blank drafts, partial decimals, reasoned predictions and missing prerequisites are not marked wrong",()=>{
 const s=M.fresh();s.prediction="decrease";s.why="I think the dots will get closer.";
 s.draftMath.B=["99","", ".", "2."];assert.equal(R.review(s).flags.length,0);
 const n=notebook();n.draftMath.C=["", ".", "-", "2."];assert.equal(R.review(n).flags.length,0);
 n.draftMeasurements[20].B="";assert.equal(R.review(n).flags.length,0);
});
test("numeric checks use the student checker's rounding tolerance and never treat blanks as zero",()=>{
 const s=notebook();s.draftMath.C=["3",".3755","9","12"];assert.equal(R.review(s).flags.length,0);
 s.draftMath.C[1]=".38";assert.equal(R.review(s).flags.length,1);
 s.draftMath.C[1]="0";assert.equal(R.review(s).flags.length,1);
 s.draftMath.C[1]="";assert.equal(R.review(s).flags.length,0);
 s.draftMeasurements[20].B="3.0001";assert.equal(R.review(s).flags.length,1);
});
test("legacy v1 notebooks keep every answer, calculation and measurement; new drafts round-trip",()=>{
 const old=notebook();delete old.draftMeasurements;
 old.math.C=M.calculateRow(5,8);old.draftMath.B=["9",".25","6","8"];old.answers.reasoning="The surface stretched.";
 const legacy=JSON.parse(JSON.stringify(old)),resumed=M.restore(legacy);
 for(const [key,value] of Object.entries(legacy))assert.deepEqual(resumed[key],value,key);
 assert.deepEqual(resumed.draftMeasurements,{20:{},30:{}});
 resumed.draftMeasurements[30].C="88";const again=M.restore(resumed);assert.equal(again.draftMeasurements[30].C,"88");
 assert.deepEqual(again.measurements,legacy.measurements);assert.deepEqual(again.math,legacy.math);assert.equal(again.protocol,legacy.protocol);
 // Ignore foreign keys and keep bounded, textual drafts in work-file imports.
 resumed.draftMeasurements[20]={B:"x".repeat(100),Z:"99",C:5};
 const safe=M.restore(resumed);assert.equal(safe.draftMeasurements[20].B.length,30);assert.equal(safe.draftMeasurements[20].Z,undefined);assert.equal(safe.draftMeasurements[20].C,undefined);
});
test("specific misconceptions receive explainable review suggestions",()=>{
 const cases=[
  ["observation","closer"],["observation","same"],
  ["claim","Farther galaxies have a slower rate."],["claim","smaller"],
  ["claim","All galaxies have the same speed."],
  ["reasoning","The dots got closer together."],["reasoning","The balloon shrank."],
  ["reasoning","The dots moved across the surface."],
  ["connection","The universe is not expanding."],
  ["connection","Real galaxies grow bigger."],["connection","The galaxies themselves expand."],
  ["connection","Galaxy A is the center of the universe."],
  ["connection","The Big Bang was an explosion into empty space."],
  ["connection","The universe is eight years old."],
  ["connection","We measured redshift with the balloon."],
  ["limitation","No limitations."],["limitation","The model is a perfect copy."],
  ["reasoning","I don't know."]
 ];
 for(const [key,value] of cases){const s=notebook();s.answers[key]=value;const r=R.review(s);assert.ok(r.answers[key],key+": "+value);assert.ok(r.answers[key].hint);}
});
test("negations, short answers, alternate wording and model limits are not rejected for keywords",()=>{
 const cases=[
  ["observation","farther"],["claim","bigger"],["claim","Farther are faster, closer are slower."],
  ["claim","Farther galaxies have a larger rate and closer galaxies have a smaller rate."],
  ["claim","They do not all have the same rate."],["claim","Farther galaxies do not have slower rates."],
  ["reasoning","expands"],["reasoning","The surface streched between the dots."],
  ["reasoning","The markers aren't getting closer. Space grows between them."],
  ["reasoning","The dots dont get closer."],
  ["connection","Real galaxies do not grow bigger."],
  ["connection","Galaxies grow farther apart."],
  ["connection","Galaxy A is not the center of the universe."],
  ["connection","I used to think \"Galaxy A is the center of the universe\" but it is just our reference."],
  ["connection","The Big Bang was not an explosion into empty space."],
  ["limitation","We cannot measure redshift with this balloon."],
  ["limitation","It cannot show spectra or cosmic microwave background radiation."],
  ["limitation","The balloon has a center but that is not part of the analogy."],
  ["limitation","2D vs 3D"],["limitation","The balloon is not exactly like the universe."],
  ["evidence","B started at three centimeters and J started at twenty-two centimeters."]
 ];
 for(const [key,value] of cases){const s=notebook();s.answers[key]=value;assert.equal(R.review(s).answers[key],null,key+": "+value);}
});
test("clearly labeled written evidence is compared with the student's table",()=>{
 const s=notebook();
 for(const good of ["Galaxy B started at 3 cm and had a rate of .25 cm/year. Galaxy J started at 22 cm and had a rate of 1.25 cm/year.","B: 3 cm and 0.25 cm/year. J: 22 cm and 1.25 cm/year.","Galaxy C had a rate of about .38 cm/year."]){s.answers.evidence=good;assert.equal(R.review(s).answers.evidence,null,good);}
 for(const bad of ["Galaxy B started at 30 cm and had a rate of .25 cm/year.","Galaxy J had a rate of 12.5 cm/year.","B: 3 cm and 2.5 cm/year."]){s.answers.evidence=bad;assert.ok(R.review(s).answers.evidence,bad);}
});
