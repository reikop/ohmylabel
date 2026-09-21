const fs=require('node:fs'),path=require('node:path');
const PDF=require('../pdf-export.js'),P=require('../precision.js');
const catalog=require('../data/catalog.json');
const base=path.join(__dirname,'..');
const fontNames={sans:'NanumGothic',serif:'NanumMyeongjo',mono:'NanumGothicCoding'};
const fontLoader=async key=>{const [family,weight]=key.split('-');return fs.readFileSync(path.join(base,'assets/fonts',`${fontNames[family]}-${weight?'Bold':'Regular'}.ttf`));};
const product=catalog.products.find(p=>p.id==='V3240');
const label={text:'차곡차곡, 나의 기록\n정확한 위치에 마음을 담아요.',font:'sans',size:12,color:'#355e48',bold:false,align:'center'};
const project={version:1,product:product.id,geometry:product,labels:Array.from({length:16},()=>({...label})),start:1,copies:1,...P.IDENTITY};
async function run(){
 fs.mkdirSync(path.join(base,'output/pdf'),{recursive:true});fs.mkdirSync(path.join(base,'tmp/pdfs'),{recursive:true});
 for(const [mode,name] of [['calibration','calibration-5point.pdf'],['proof','proof-v3240.pdf'],['labels','labels-v3240.pdf']]){
  const result=await PDF.create(project,{mode,fontLoader});fs.writeFileSync(path.join(base,'output/pdf',name),result.bytes);console.log(name,result.bytes.length+' bytes',result.warnings);
 }
 const six={...project,product:'FONT-TEST',geometry:{width:90,height:70,cols:2,rows:3,left:10,top:30,gapX:10,gapY:10,shape:'rect'},labels:[]};
 for(const family of ['sans','serif','mono'])for(const bold of [false,true])six.labels.push({...label,font:family,bold,text:`한글 글꼴 검증 ${bold?'굵게':'보통'}\nABC abc 0123456789\n${family} · 정밀한 라벨 인쇄`});
 fs.writeFileSync(path.join(base,'tmp/pdfs','font-test.pdf'),(await PDF.create(six,{fontLoader})).bytes);
 fs.writeFileSync(path.join(base,'tmp/pdfs','verification.pdf'),(await PDF.create(project,{fontLoader,mode:'verification'})).bytes);
 const corrected={...project,scaleX:.99,scaleY:1.005,shearX:.002,shearY:-.001,offsetX:1.1,offsetY:-.8};
 fs.writeFileSync(path.join(base,'tmp/pdfs','corrected-proof.pdf'),(await PDF.create(corrected,{fontLoader,mode:'proof'})).bytes);
 const circular=catalog.products.find(p=>p.id==='V3630');
 const circle={...project,product:circular.id,geometry:circular,labels:Array.from({length:circular.cols*circular.rows},()=>({...label,text:'원형 라벨\nTEST 123',size:9}))};
 fs.writeFileSync(path.join(base,'tmp/pdfs','circle.pdf'),(await PDF.create(circle,{fontLoader})).bytes);
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={project,fontLoader,run};
