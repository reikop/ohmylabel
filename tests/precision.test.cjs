const assert=require('node:assert/strict');
const P=require('../precision.js'),PDF=require('../pdf-export.js');
const {project,fontLoader}=require('../scripts/generate-pdf-fixtures.cjs');
const realPrinter={scaleX:.985,scaleY:1.012,shearX:.003,shearY:-.002,offsetX:1.4,offsetY:-1.1};
const measured=P.POINTS.map(p=>({id:p.id,...P.transform(realPrinter,p)}));
const result=P.fit(measured);assert.ok(result.canApply);assert.ok(result.maxResidual<1e-10);
for(const p of [{x:0,y:0},{x:210,y:297},{x:137.5,y:211.8},...P.POINTS]){
 const actual=P.transform(realPrinter,P.transform(result.correction,p));assert.ok(Math.hypot(actual.x-p.x,actual.y-p.y)<1e-10);
}
assert.throws(()=>P.fit(measured.slice(1)));assert.throws(()=>P.fit(measured.map((p,i)=>i===2?{...p,x:NaN}:p)));
const bad=measured.map(p=>({...p}));bad[2].x+=3;assert.equal(P.fit(bad).canApply,false);
const blank=P.verify([]);assert.equal(blank.passed,false);assert.equal(blank.max,null);
const ideal=P.POINTS.map(p=>({...p}));assert.equal(P.verify([ideal]).status,'incomplete');
assert.equal(P.verify(Array.from({length:10},()=>ideal)).passed,true);
const failed=Array.from({length:10},()=>ideal.map(p=>({...p})));failed[9][4].x+=.51;assert.equal(P.verify(failed).passed,false);assert.equal(P.verify(failed).status,'failed');
assert.equal(P.verify([ideal.map(p=>({...p,x:p.x+.4,y:p.y+.4}))]).status,'failed'); // Euclidean, not separate axis thresholds.
assert.equal(P.valid({...P.IDENTITY,shearX:.2}),false);assert.equal(P.valid({...P.IDENTITY,offsetX:Infinity}),false);
async function run(){
 const overflow={...project,labels:project.labels.map(l=>({...l,text:'아주 긴 문구 '.repeat(100),size:48}))};await assert.rejects(()=>PDF.create(overflow,{fontLoader}),/안전 영역/);
 const unsupported={...project,labels:project.labels.map(l=>({...l,text:'🦄'}))};await assert.rejects(()=>PDF.create(unsupported,{fontLoader}),/지원하지 않는 문자/);
 const empty={...project,start:2,labels:project.labels.map((l,i)=>({...l,text:i===0?'첫 칸':''}))};await assert.rejects(()=>PDF.create(empty,{fontLoader}),/내용이 없습니다/);
 const shifted={...project,offsetX:10};await assert.rejects(()=>PDF.create(shifted,{fontLoader}),/A4 밖/);
 const calibration=await PDF.create({...project,scaleX:1.03,offsetX:3},{mode:'calibration',fontLoader});assert.deepEqual(calibration.calibration,P.IDENTITY);
 const proof=await PDF.create({...project,start:16,copies:20},{mode:'proof',fontLoader});assert.equal(proof.pageCount,1);
 const selected={...project,start:16,copies:2};const out=await PDF.create(selected,{fontLoader});assert.equal(out.pageCount,2);
 console.log('PASS: five-point inverse, nonlinearity rejection, repeated measurements, invalid inputs, PDF overflow/unsupported glyph rejection, and output modes.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
