/* Teacher-only review suggestions. Pure, local rules; no grades or network requests.
   Science basis and limitations: docs/TEACHER_GUIDE.md. Never mutates a notebook. */
(function(root){
"use strict";
const M=typeof module!=="undefined"&&module.exports?require("./model.js"):root.BalloonModel;
const labels={observation:"Observation",claim:"Claim / pattern",evidence:"Two galaxies as evidence",reasoning:"Why distances changed",connection:"Connection to the universe",limitation:"A model limitation"};
const mathLabels=["Change","Model rate","24-year motion","32-year motion"];
const fmt=n=>String(Number(n.toFixed(3)));
const normalize=s=>String(s||"").toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
// A negated or quoted misconception should not be treated as an assertion.
// This intentionally favors missing a subtle error over rejecting correct wording.
function asserted(text,pattern){
 const clauses=text.replace(/["“][^"”]*["”]/g,"").split(/[!?;,\n]|\.(?!\d)|\b(?:but|however|instead|and)\b/);
 return clauses.some(clause=>{
  const match=pattern.exec(clause);if(!match)return false;
  return !/\b(?:not|never|no|cannot|can't|isn't|isnt|aren't|arent|wasn't|wasnt|weren't|doesn't|doesnt|don't|dont|didn't|didnt)\b/.test(clause.slice(0,match.index+match[0].length));
 });
}
const rules=[
 {fields:["claim"],test:t=>/^(?:a )?(?:slower|smaller|lower)(?: model)?(?: rate| speed)?[.!]?$/.test(t)||asserted(t,/\b(?:farther|further|more distant|far away)\b.{0,65}\b(?:slower|smaller|lower)\b/),message:"The distance–rate pattern may be reversed.",hint:"Compare B and J: which starts farther from A, and which has the larger rate?"},
 {fields:["claim"],test:t=>asserted(t,/\b(?:closer|nearer|less distant)\b.{0,65}\b(?:faster|larger|higher)\b/),message:"This may reverse the distance–rate pattern.",hint:"Use two table rows to compare starting distance and model rate."},
 {fields:["claim"],test:t=>asserted(t,/\b(?:all|every)\b.{0,40}\b(?:same|equal)\b.{0,20}\b(?:rate|speed)/),message:"The model rates are not all equal.",hint:"C and D tie because of rounding, but compare B's 0.25 with J's 1.25 cm/year."},
 {fields:["claim","reasoning","connection"],test:t=>asserted(t,/\b(?:galaxies|dots|markers|distances|they)\b.{0,45}\b(?:closer|together|shrank|shrink\w*|decreas\w*)\b/),message:"This may describe decreasing separation.",hint:"Ask her to compare the first and second distances for one galaxy. The second is larger."},
 {fields:["reasoning","connection"],test:t=>asserted(t,/\b(?:space|universe|surface|balloon)\b.{0,30}\b(?:shrank|shrink\w*|contract\w*|getting smaller)\b/)||/^(?:the )?(?:universe|surface|space) (?:is not|isn't|does not|doesn't) expand/.test(t),message:"This may describe contraction instead of expansion.",hint:"Ask: “What happened to the surface between the markers when the balloon became larger?”"},
 {fields:["reasoning"],test:t=>asserted(t,/\b(?:dots|markers)\s+(?:moved?|slid|slide|crawl\w*)\s+(?:across|over|around)\s+(?:the\s+)?surface\b/),message:"The markers stay at fixed positions on the growing surface.",hint:"Ask: “Did the dots crawl across the surface, or did the surface stretch between them?”"},
 {fields:["reasoning","connection","limitation"],test:t=>asserted(t,/\b(?:real )?galaxies\s+(?:(?:themselves|are|also|all|actually|each)\s+)*(?:(?:grow|grew|expand|stretch|swell)(?:ing|s|ed)?\b(?!\s+(?:farther|further|apart))|(?:get|got|become|became)\s+(?:bigger|larger)\b)/),message:"Check whether she means galaxies themselves grow.",hint:"The model represents growing space between galaxies. Real bound galaxies do not grow with cosmic expansion."},
 {fields:["reasoning","connection","limitation"],test:t=>asserted(t,/\b(?:galaxy a|earth|a)\s+is\s+(?:the\s+)?cent(?:er|re)\s+of\s+(?:the\s+)?universe\b/),message:"A is a reference galaxy, not a center of the universe.",hint:"Ask whether distances would also increase if we measured from a different galaxy."},
 {fields:["connection","limitation"],test:t=>asserted(t,/\b(?:big bang|universe)\b.{0,30}\b(?:explod\w*|explosion)\b.{0,40}\b(?:from (?:a|earth)|into (?:empty )?(?:space|a room))\b/),message:"Check the idea of an explosion from one place into empty space.",hint:"The surface models space itself expanding; the balloon's inside and inflation source are outside the analogy."},
 {fields:["connection","limitation"],test:t=>asserted(t,/\buniverse\b.{0,25}\b(?:8|eight)\s+(?:model )?years?\s+old\b/)||asserted(t,/\bbig bang\b.{0,25}\b(?:8|eight)\s+years?\s+ago\b/),message:"The eight model years are not the age of the universe.",hint:"Eight years is the assumed interval used in this lab's rate calculation."},
 {fields:["connection","limitation"],test:t=>asserted(t,/\b(?:we|i|balloon|this model|the model|this lab)\b.{0,30}\b(?:measur\w*|detect\w*|observ\w*)\b.{0,20}\b(?:redshift|spectra|cosmic microwave)\b/),message:"This simulator does not measure astronomical light.",hint:"It models an expansion pattern. Real redshift measurements come from astronomical observations."},
 {fields:["limitation"],test:t=>/^(?:(?:there (?:are|is)|it has) )?(?:none|nothing|no (?:limits?|limitations?|differences?))[.!]?$/.test(t)||asserted(t,/\b(?:model|balloon)\b.{0,25}\b(?:perfect|exact copy|exactly like the universe)\b/),message:"The balloon is a simplified model with limits.",hint:"Invite one difference: a 2D surface models 3D space, its scales are arbitrary, or it cannot show spectra."}
];
function evidenceIssue(text,s){
 // Only check clearly labeled facts. Other wording (including spoken numbers)
 // remains for the teacher; an unrecognized answer never receives a grade.
 const mentions=[...text.matchAll(/\bgalaxy\s+([B-J])\b|\b([B-HJ])(?=\s*(?:[:=]|(?:started|starts|began|was|is|had|has)\b))/gi)];
 for(let i=0;i<mentions.length;i++){
  const id=(mentions[i][1]||mentions[i][2]).toUpperCase(),segment=text.slice(mentions[i].index,mentions[i+1]?.index).toLowerCase();
  const first=s.measurements[20][id],second=s.measurements[30][id];
  if(first===undefined||second===undefined)continue;
  const number="(-?(?:\\d+(?:\\.\\d+)?|\\.\\d+))";
  const start=segment.match(new RegExp("\\b(?:start(?:ed|s|ing)?(?: distance)?|began|first distance)\\s*(?:at|was|is|of|:|=)?\\s*"+number+"\\s*cm\\b"))||segment.match(new RegExp("^(?:galaxy\\s+)?[b-j]\\s*:\\s*"+number+"\\s*cm\\b"));
  const rate=segment.match(new RegExp("\\b(?:rate|speed)\\s*(?:of|was|is|:|=)?\\s*(?:about|around|approximately)?\\s*"+number+"\\b"))||segment.match(new RegExp(number+"\\s*cm\\s*(?:/|per\\s+)(?:model\\s*)?(?:year|yr)\\b"));
  for(const [match,expected,quantity] of [[start,first,"starting distance"],[rate,M.calculateRow(first,second)[1],"model rate"]]){
   if(!match)continue;
   const decimals=(match[1].split(".")[1]||"").length;
   const tolerance=/\b(?:about|around|approximately)\b/.test(match[0])?.5*10**(-decimals)+1e-9:.00051;
   if(Math.abs(Number(match[1])-expected)>tolerance)return {message:`Check galaxy ${id}'s ${quantity} in her evidence.`,hint:`Her table shows ${fmt(expected)} ${quantity==="model rate"?"cm/year":"cm"}. Ask her to find and compare that value.`};
  }
 }
 return null;
}
function written(key,value,s){
 const t=normalize(value);if(!t)return null;
 if(key==="observation")return t!=="farther"?{message:"The selected observation does not match the measurements.",hint:"Compare 3 cm and 5 cm for B: did the distance become larger or smaller?"}:null;
 if(/^(?:i )?(?:don'?t know|do not know|am not sure|not sure|idk|help|\?+)[.!]?$/.test(t))return {message:"She may be asking for help.",hint:"Read this prompt aloud, then invite a short spoken explanation before typing."};
 for(const rule of rules)if(rule.fields.includes(key)&&rule.test(t))return {message:rule.message,hint:rule.hint};
 return key==="evidence"?evidenceIssue(String(value),s):null;
}
function review(s){
 const result={measurements:{20:{},30:{}},math:{},answers:{},flags:[]};
 function numberCell(value,expected,draft,id,title,hint,saved,tolerance=.00051){
  const text=value===undefined?"":String(value).trim(),number=M.numberFrom(value);
  const cell={value:text,expected,draft,id,saved};
  // A blank or a partial decimal is a draft in progress, not an error.
  const partial=/^[+-]?(?:\d+\.|\.)?$/.test(text);
  if(text&&!partial&&expected!==undefined&&(number===null||Math.abs(number-expected)>tolerance)){
   cell.issue={message:`Expected ${fmt(expected)}.`,hint};
   result.flags.push({id,title,kind:"number",...cell.issue});
  }
  return cell;
 }
 for(const id of M.TARGETS){
  for(const d of [20,30]){
   const draft=s.draftMeasurements?.[d]?.[id],saved=s.measurements[d][id];
   result.measurements[d][id]=numberCell(draft??saved,M.nearest(M.distance(d,id)),draft!==undefined,`review-measure-${d}-${id}`,`Galaxy ${id} · ${d} cm stage`,`Read the tape (${M.distance(d,id).toFixed(1)} cm), then round to the nearest whole centimeter.`,saved,0);
  }
  const a=s.measurements[20][id],b=s.measurements[30][id];
  const expected=a!==undefined&&b!==undefined?M.calculateRow(a,b):null;
  const hints=expected?[`${b} − ${a} = ${fmt(expected[0])} cm.`,`Divide the change by 8: ${fmt(expected[0])} ÷ 8 = ${fmt(expected[1])} cm/year.`,`Multiply the rate by 24: ${fmt(expected[1])} × 24 = ${fmt(expected[2])} cm of extra motion.`,`Multiply the rate by 32: ${fmt(expected[1])} × 32 = ${fmt(expected[3])} cm of extra motion.`]:[];
  result.math[id]=Array.from({length:4},(_,i)=>numberCell(s.draftMath[id]?.[i]??s.math[id]?.[i],expected?.[i],s.draftMath[id]!==undefined,`review-math-${id}-${i}`,`Galaxy ${id} · ${mathLabels[i]}`,hints[i]));
 }
 for(const key of M.ANSWERS){
  const issue=written(key,s.answers[key],s);result.answers[key]=issue;
  if(issue)result.flags.push({id:`review-answer-${key}`,title:labels[key],kind:key==="observation"?"choice":"writing",...issue});
 }
 return result;
}
const api={review,labels};if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.BalloonReview=api;
})(typeof globalThis!=="undefined"?globalThis:this);
