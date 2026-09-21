const assert=require('node:assert/strict'),M=require('../studio-model.js'),PDF=require('../pdf-export.js'),{project,fontLoader}=require('../scripts/generate-pdf-fixtures.cjs');
const data=M.table([['이름','우편번호','이름'],['홍길동','00123','배송'],['<img src=x>','04567','직장']]);
assert.deepEqual(data.headers,['이름','우편번호','이름_2']);assert.equal(M.merge(data,'{{이름}} 님\n{{우편번호}}')[0],'홍길동 님\n00123');assert.throws(()=>M.merge(data,'{{없는열}}'));assert.equal(M.valid({version:1}),false);assert.equal(M.valid(project),true);
const bad=structuredClone(project);bad.labels[0].images=[{assetId:'missing',x:0,y:0,width:1,height:1}];assert.equal(M.valid(bad),false);
const box=M.fit({x:99,y:90,width:50,height:20},{width:30,height:10});assert.ok(M.box(box,{width:30,height:10}));
(async()=>{await assert.rejects(()=>PDF.create(bad,{fontLoader}),/이미지/);console.log('PASS: merge headers, leading zeros, literal HTML, missing fields, invalid project and image references, and geometry bounds.');})().catch(e=>{console.error(e);process.exitCode=1;});
