const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.join(__dirname,'..');
const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>errors.push(e));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://localhost/',runScripts:'outside-only',virtualConsole});
const w=dom.window,$=id=>w.document.getElementById(id);
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
let blobs=0;w.URL.createObjectURL=()=>`blob:test-${++blobs}`;w.URL.revokeObjectURL=()=>{};
w.HTMLAnchorElement.prototype.click=function(){};
// Load the real browser scripts, including the local embedded font payload.
for(const file of ['data/catalog.js','vendor/pdf-lib.min.js','vendor/fontkit.umd.min.js','precision.js','assets/font-data/sans.js','pdf-export.js','precision-ui.js','app.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
function fill(prefix,dx=0,dy=0){for(const p of w.LabelPrecision.POINTS)for(const a of ['x','y']){$(`${prefix}-${p.id}-${a}`).value=p[a]+(a==='x'?dx:dy);$(`${prefix}-${p.id}-${a}`).dispatchEvent(new w.Event('input'));}}
function click(id){$(id).click();}
function record(){return JSON.parse(w.localStorage.getItem('ohmylabel.precision.v1'));}
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('PDF generation timed out');}
(async()=>{
 try{
  click('open-precision');assert.ok($('precision-dialog').open);
  click('calculate-fivepoint');assert.ok($('apply-fivepoint').disabled,'blank inputs must not fit');
  fill('fit',1,-.5);click('calculate-fivepoint');assert.equal($('apply-fivepoint').disabled,false);click('apply-fivepoint');
  $('profile-name').value='Test printer / tray 1 / A4';click('save-printer-profile');
  assert.ok(Math.abs(record().profiles[0].calibration.offsetX+1)<1e-8);
  $('verification-settings').value='Test printer / tray 1 / A4 / 100%';click('new-verification');
  click('add-measurement');assert.equal(record().session.sheets.length,0);
  for(let i=0;i<9;i++){fill('verify');click('add-measurement');}
  assert.ok($('verification-result').textContent.includes('측정 진행 중'));
  fill('verify');click('add-measurement');assert.ok($('verification-result').textContent.includes('목표 충족'));
  click('undo-measurement');fill('verify',.4,.4);click('add-measurement');
  assert.ok($('verification-result').textContent.includes('목표 미달'),'diagonal error exceeds .5 mm');
  fill('fit');click('calculate-fivepoint');click('apply-fivepoint');
  assert.ok($('verification-result').textContent.includes('보정값이 달라졌습니다'));assert.ok($('add-measurement').disabled);
  click('load-printer-profile');assert.ok($('verification-result').textContent.includes('목표 미달'));
  $('fit-A-x').value='';$('fit-A-x').dispatchEvent(new w.Event('input'));assert.ok($('apply-fivepoint').disabled);
  click('pdf-export');await until(()=>$('pdf-dialog').open||$('precision-error').textContent);
  assert.equal($('precision-error').textContent,'');assert.ok($('pdf-dialog').open);assert.ok($('pdf-download').href.startsWith('blob:'));
  assert.ok($('pdf-summary').textContent.includes('글꼴 포함'));$('pdf-dialog').close();assert.equal($('pdf-frame').hasAttribute('src'),false);
  $('content').value='🦄';$('content').dispatchEvent(new w.Event('input'));click('pdf-export');
  await until(()=>$('precision-error').textContent);assert.ok($('precision-error').textContent.includes('지원하지 않는 문자'));
  assert.deepEqual(errors,[]);console.log('PASS: real DOM calibration, profiles, blank-input rejection, 10-sheet decisions, correction invalidation, embedded-font PDF preview, and export errors.');
 }finally{w.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
