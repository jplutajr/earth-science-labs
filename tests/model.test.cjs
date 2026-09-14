(function modelTests(){
const test=require("node:test"),assert=require("node:assert/strict"),M=require("../assets/model.js");
test("known surface measurements and all nine calculation rows",()=>{
 const expected=[[3,5,2,.25,6,8],[5,8,3,.375,9,12],[7,10,3,.375,9,12],[9,13,4,.5,12,16],[11,16,5,.625,15,20],[13,20,7,.875,21,28],[15,23,8,1,24,32],[18,27,9,1.125,27,36],[22,32,10,1.25,30,40]];
 M.TARGETS.forEach((id,i)=>{const a=M.nearest(M.distance(20,id)),b=M.nearest(M.distance(30,id));assert.deepEqual([a,b,...M.calculateRow(a,b)],expected[i]);});
});
test("all pairwise geodesics scale, remain symmetric, and use the shortest surface arc",()=>{
 for(const from of M.IDS)for(const to of M.IDS){
  const a=M.distance(20,to,from),b=M.distance(30,to,from);
  assert.ok(a>=0&&a<=Math.PI*10+1e-9);assert.ok(Math.abs(a-M.distance(20,from,to))<1e-9);
  assert.ok(Math.abs(b-a*1.5)<1e-9);if(from===to)assert.equal(a,0);else assert.ok(a>0);
 }
 assert.ok(M.distance(20,"J")>20,"Long surface arcs can exceed the diameter");
 assert.throws(()=>M.distance(25,"B"));assert.throws(()=>M.distance(20,"Z"));
});
test("blank and invalid numerical answers are not silently zero",()=>{
 for(const n of [""," ",null,undefined,"NaN","Infinity","abc"])assert.equal(M.numberFrom(n),null);
 assert.equal(M.numberFrom("0"),0);assert.equal(M.numberFrom(".375"),.375);
 assert.equal(M.nearest(21.499999999999996),22);
 assert.throws(()=>M.calculateRow(undefined,20));
});
test("step gates require every measurement and calculation",()=>{
 const s=M.fresh();assert.equal(M.unlocked(s),0);s.marked=true;s.prediction="increase";s.why="The surface stretches.";assert.equal(M.unlocked(s),1);
 for(const id of M.TARGETS)s.measurements[20][id]=M.nearest(M.distance(20,id));
 assert.equal(M.unlocked(s),2);
 for(const id of M.TARGETS)s.measurements[30][id]=M.nearest(M.distance(30,id));
 assert.equal(M.unlocked(s),3);
 for(const id of M.TARGETS)s.math[id]=M.calculateRow(s.measurements[20][id],s.measurements[30][id]);
 assert.equal(M.unlocked(s),4);delete s.math.B;assert.equal(M.unlocked(s),3);
});
test("restoring work validates version, fields, observations and numerical evidence",()=>{
 assert.throws(()=>M.restore({version:99}));const s=M.fresh();
 s.phase=4;s.student="x".repeat(100);s.measurements[20]={B:999,C:5,Z:20};s.measurements[30]={C:8};
 s.math={C:[3,.375,9,12],B:[2,.25,6,8],J:[null,0,0,0]};s.answers.observation="invalid";s.draftMath={B:["9"]};
 const r=M.restore(JSON.parse(JSON.stringify(s)));
 assert.equal(r.phase,0);assert.equal(r.student.length,60);assert.equal(r.measurements[20].B,undefined);assert.equal(r.measurements[20].Z,undefined);
 assert.deepEqual(r.math.C,[3,.375,9,12]);assert.equal(r.math.B,undefined);assert.equal(r.answers.observation,"");assert.deepEqual(r.draftMath.B,["9","","",""]);
});
test("valid work survives a JSON round trip without losing precision",()=>{
 const s=M.fresh();s.marked=true;s.prediction="increase";s.why="Stretching";s.phase=4;
 for(const id of M.TARGETS){for(const d of [20,30])s.measurements[d][id]=M.nearest(M.distance(d,id));s.math[id]=M.calculateRow(s.measurements[20][id],s.measurements[30][id]);}
 s.answers.observation="farther";s.answers.evidence="<script>not executable text</script>";assert.deepEqual(M.restore(JSON.parse(JSON.stringify(s))),s);
});
})();
