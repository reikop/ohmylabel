// Dependency-free integration checks with a minimal DOM adapter.
// Run with Node.js: node tests/app.test.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const catalogSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'catalog.js'), 'utf8');
class Element {
  constructor(tag='div') { this.tagName=tag; this.children=[]; this.style={}; this.dataset={}; this.attributes={}; this.handlers={}; this.value=''; this.checked=false; this.clientWidth=560; this.className=''; this.classList={toggle:(name,on)=>{const names=new Set(this.className.split(' ').filter(Boolean));on ??= !names.has(name);on?names.add(name):names.delete(name);this.className=[...names].join(' ');},add:name=>this.classList.toggle(name,true),remove:name=>this.classList.toggle(name,false)}; }
  append(...children){ this.children.push(...children); }
  replaceChildren(...children){ this.children=[...children]; }
  setAttribute(key,value){ this.attributes[key]=value; }
  addEventListener(type,fn){ (this.handlers[type] ||= []).push(fn); }
  fire(type){ for(const fn of this.handlers[type] || []) fn({target:this}); }
  click(){ this.fire('click'); }
  showModal(){ this.open=true; }
  close(){ this.open=false; }
}
function boot(storage={}) {
  const ids=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
  ids['show-guides'].checked=true;
  const brands=['any','formtec','custom'].map(brand=>{const e=new Element('button');e.dataset.brand=brand;return e;});
  const align=['left','center','right'].map(a=>{const e=new Element('button');e.dataset.align=a;return e;});
  const document={getElementById:id=>{assert.ok(ids[id],`Unknown element: ${id}`);return ids[id];},createElement:tag=>new Element(tag),querySelectorAll:selector=>({'[data-brand]':brands,'[data-align]':align,'.close-dialog':[]}[selector] || [])};
  const events={};let printed=false;
  const context={document,LabelPrecision:require('../precision.js'),initPrecisionUI:()=>({refresh(){}}),localStorage:{getItem:key=>storage[key] || null,setItem:(key,value)=>storage[key]=value},window:{addEventListener:(type,fn)=>events[type]=fn,print:()=>printed=true},setTimeout:()=>1,clearTimeout:()=>{},console,Blob,URL};
  vm.createContext(context);vm.runInContext(catalogSource,context);vm.runInContext(source,context);
  return {ids,brands,align,storage,events,printed:()=>printed,input:(id,value)=>{ids[id].value=String(value);ids[id].fire('change');}};
}
const app=boot(), {ids}=app;
assert.equal(ids.sheet.children.length,16);
assert.equal(ids.sheet.children[0].style.width,'99.05mm');
assert.equal(ids.sheet.children[0].style.top,'13.8mm');
assert.equal(ids.sheet.children[0].style.left,'5.1mm');
ids.sheet.children[3].click();ids.content.value='<script>alert(1)</script>\n테스트 주소';ids.content.fire('input');
assert.equal(ids.sheet.children[3].children[0].textContent,ids.content.value);
assert.equal(ids.sheet.children[0].children[0].textContent,'차곡차곡, 나의 기록\n소중한 일상을 담아두세요.');
ids.bold.click();assert.equal(ids.sheet.children[3].style.fontWeight,'700');
ids['apply-all'].click();assert.ok(ids.sheet.children.every(c=>c.children[0].textContent===ids.content.value));
app.input('start-label',3);app.input('copies',2);app.input('offset-x',1.5);app.input('offset-y',-1);
ids.print.click();assert.equal(ids['print-dialog'].open,true);
assert.equal(ids['print-root'].children.length,2);
assert.ok(ids['print-root'].children.every(p=>p.children[0].children.length===14));
assert.equal(ids['print-root'].children[0].children[0].style.transform,'translate(1.5mm, -1mm) scale(1, 1)');
assert.equal(ids['print-root'].children[0].children[0].children[0].style.left,'5.1mm');
assert.equal(parseFloat(ids['print-root'].children[0].children[0].children[0].style.top),47.65);
assert.equal(ids['print-root'].children[0].children[0].children[0].className,'label');
ids['confirm-print'].click();assert.equal(app.printed(),true);assert.equal(ids['print-dialog'].open,false);
const restored=boot(app.storage);assert.equal(restored.ids.content.value,ids.content.value);assert.equal(restored.ids.copies.value,2);
app.input('copies',200);assert.equal(ids.copies.value,20);
app.input('start-label',999);assert.equal(ids['start-label'].value,16);
app.brands[1].click();assert.equal(ids.products.children.length,79);ids.search.value='3105';ids.search.fire('input');ids.products.children[0].click();
assert.equal(ids.sheet.children.length,21);assert.equal(ids.sheet.children[0].style.width,'63.5mm');
const geometryWidth=ids['geometry-fields'].children[0].children[0];geometryWidth.value='999';geometryWidth.fire('change');
assert.equal(ids.sheet.children[0].style.width,'63.5mm');assert.ok(ids['geometry-error'].textContent);
ids.search.value='missing-product';ids.search.fire('input');assert.equal(ids.products.children[0].className,'empty');
const corrupted=boot({'ohmylabel.project.v1':'{"version":1}'});assert.equal(corrupted.ids.sheet.children.length,16);
app.events.beforeprint();assert.equal(ids['print-root'].children.length,20);
// Every imported template must fit A4 and place its last cell at the original absolute pitch.
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','catalog.json'),'utf8'));
assert.equal(catalog.products.length,207);
for(const p of catalog.products){
 const runner=boot();runner.brands[p.brand==='any'?0:1].click();runner.ids.search.value=p.code;runner.ids.search.fire('input');
 const button=runner.ids.products.children.find(b=>b.children[1]?.children[0]?.textContent===p.code);assert.ok(button,p.id);button.click();
 const cells=runner.ids.sheet.children;assert.equal(cells.length,p.cols*p.rows,p.id);
 const last=cells.at(-1),x=p.left+(p.cols-1)*(p.width+p.gapX),y=p.top+(p.rows-1)*(p.height+p.gapY);
 assert.ok(Math.abs(parseFloat(last.style.left)-x)<0.000001,p.id+' x precision');
 assert.ok(Math.abs(parseFloat(last.style.top)-y)<0.000001,p.id+' y precision');
 assert.ok(x+p.width<=210.0001 && y+p.height<=297.0001,p.id+' fits A4');
 assert.equal(last.style.borderRadius,p.shape==='ellipse'?'50%':'0');
}
// Simulated printer: horizontal 0.98x with +1mm translation, vertical 1.02x with -0.5mm.
ids['measured-width'].value='98';ids['measured-height'].value='102';ids['measured-left'].value='20.6';ids['measured-top'].value='19.9';ids['apply-calibration'].click();
const calibrated=JSON.parse(app.storage['ohmylabel.project.v1']);
for(const x of [0,20,100,200])assert.ok(Math.abs((calibrated.offsetX+calibrated.scaleX*x)*.98+1-x)<1e-10);
for(const y of [0,20,100,290])assert.ok(Math.abs((calibrated.offsetY+calibrated.scaleY*y)*1.02-.5-y)<1e-10);
ids['measured-width'].value='';ids['apply-calibration'].click();assert.ok(ids['calibration-error'].textContent);
ids['proof-print'].click();assert.equal(ids['print-root'].children.length,1);assert.equal(ids['print-root'].children[0].children[0].children.length,21);
assert.ok(ids['print-root'].children[0].children[0].children.every(c=>c.className.includes('proof-label')));
ids['ruler-print'].click();assert.equal(ids['print-root'].children[0].children[0].className,'ruler-box');
app.events.afterprint();app.events.beforeprint();assert.equal(ids['print-root'].children.length,20);
// Earlier projects keep their actual geometry; they must not silently acquire a verified status.
const old=JSON.parse(app.storage['ohmylabel.project.v1']);old.product='LS-3105';delete old.scaleX;delete old.scaleY;delete old.geometry.shape;old.geometry.left=7.25;
const migrated=boot({'ohmylabel.project.v1':JSON.stringify(old)});assert.ok(migrated.ids['spec-status'].textContent.startsWith('사용자 조정'));
migrated.ids['reset-geometry'].click();assert.equal(migrated.ids.sheet.children[0].style.left,'7mm');
const badScale={...old,scaleX:-1};assert.equal(boot({'ohmylabel.project.v1':JSON.stringify(badScale)}).ids.sheet.children.length,16);
console.log('PASS: 207 catalog templates, sub-micrometer coordinate rounding, A4 bounds, shapes, affine printer calibration, proof/ruler output, legacy migration, editing, persistence, and print settings.');
