/* Pure spherical model; shared by the browser and automated tests. */
(function(root){const model=(function BalloonModelFactory(){
  "use strict";
  const LAB=Object.freeze({version:1,protocol:"balloon-A-J-20-30-8-v1",storage:"space-lab:balloon:v1",years:8});
  const IDS="ABCDEFGHIJ".split(""),TARGETS=IDS.slice(1);
  const ANGLES=[0,.32,.51,.68,.88,1.09,1.32,1.53,1.78,2.15];
  const VECTORS=ANGLES.map((t,i)=>[Math.sin(t)*Math.cos(i*2.39996323),Math.sin(t)*Math.sin(i*2.39996323),Math.cos(t)]);
  const ANSWERS=["observation","claim","evidence","reasoning","connection","limitation"];
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  function distance(diameter,id,from="A"){
    if(![10,20,30].includes(diameter)||!IDS.includes(id)||!IDS.includes(from))throw Error("Invalid model measurement.");
    if(id===from)return 0;
    return diameter/2*Math.acos(Math.max(-1,Math.min(1,dot(VECTORS[IDS.indexOf(id)],VECTORS[IDS.indexOf(from)]))));
  }
  const nearest=n=>Math.round(n+1e-9);
  function numberFrom(raw){
    if(raw===null||raw===undefined||String(raw).trim()==="")return null;
    const n=Number(raw);return Number.isFinite(n)?n:null;
  }
  function calculateRow(first,second){
    if(!Number.isFinite(first)||!Number.isFinite(second))throw Error("Two measurements are required.");
    const change=second-first,rate=change/LAB.years;
    return [change,rate,rate*24,rate*32];
  }
  function fresh(){return {version:LAB.version,protocol:LAB.protocol,started:new Date().toISOString(),
    phase:0,marked:false,student:"",prediction:"",why:"",measurements:{20:{},30:{}},math:{},draftMath:{},
    answers:Object.fromEntries(ANSWERS.map(k=>[k,""]))};}
  const count=(s,d)=>Object.keys(s.measurements[d]).length;
  function unlocked(s){
    if(!s.marked||!s.prediction||!s.why.trim())return 0;
    if(count(s,20)<9)return 1;if(count(s,30)<9)return 2;
    if(Object.keys(s.math).length<9)return 3;return 4;
  }
  function restore(raw){
    if(!raw||raw.version!==LAB.version||raw.protocol!==LAB.protocol)throw Error("This is not a compatible balloon work file.");
    const s=fresh(),text=(v,max=2000)=>typeof v==="string"?v.slice(0,max):"";
    if(typeof raw.started==="string"&&Number.isFinite(Date.parse(raw.started)))s.started=new Date(raw.started).toISOString();
    s.marked=raw.marked===true;s.student=text(raw.student,60);
    s.prediction=["increase","decrease","same"].includes(raw.prediction)?raw.prediction:"";s.why=text(raw.why);
    for(const d of [20,30])for(const id of TARGETS){
      const n=raw.measurements?.[d]?.[id];
      if(Number.isInteger(n)&&n===nearest(distance(d,id)))s.measurements[d][id]=n;
    }
    for(const id of TARGETS){
      const a=s.measurements[20][id],b=s.measurements[30][id],row=raw.math?.[id];
      if(a!==undefined&&b!==undefined&&Array.isArray(row)&&row.length===4){
        const expected=calculateRow(a,b);
        if(row.every((n,i)=>typeof n==="number"&&Number.isFinite(n)&&Math.abs(n-expected[i])<=.00051))s.math[id]=expected;
      }
      if(Array.isArray(raw.draftMath?.[id]))s.draftMath[id]=Array.from({length:4},(_,i)=>text(raw.draftMath[id][i],30));
    }
    for(const key of ANSWERS)s.answers[key]=text(raw.answers?.[key]);
    if(!["farther","closer","same"].includes(s.answers.observation))s.answers.observation="";
    s.phase=Number.isInteger(raw.phase)?Math.max(0,Math.min(4,raw.phase,unlocked(s))):0;
    return s;
  }
  return {LAB,IDS,TARGETS,ANGLES,VECTORS,ANSWERS,dot,distance,nearest,numberFrom,calculateRow,fresh,count,unlocked,restore};
})();if(typeof module!=="undefined"&&module.exports)module.exports=model;else root.BalloonModel=model;})(typeof globalThis!=="undefined"?globalThis:this);
