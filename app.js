(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const STORAGE = 'ohmylabel.project.v1';
  const catalog = globalThis.OHMYLABEL_CATALOG;
  const products = [...catalog.products, { id:'CUSTOM', code:'CUSTOM', brand:'custom', name:'나만의 규격', width:63.5, height:38.1, cols:3, rows:7, gapX:2.5, gapY:0, left:7, top:15.8, shape:'rect' }];
  const mm = n => Number(n.toFixed(6));
  const fonts = { sans: '"Label Sans", sans-serif', serif: '"Label Serif", serif', mono: '"Label Mono", monospace' };
  const geometryNames = { width: '라벨 가로 (mm)', height: '라벨 세로 (mm)', cols: '가로 칸 수', rows: '세로 칸 수', left: '왼쪽 여백 (mm)', top: '위쪽 여백 (mm)', gapX: '가로 간격 (mm)', gapY: '세로 간격 (mm)' };
  const newLabel = () => ({ text: '차곡차곡, 나의 기록\n소중한 일상을 담아두세요.', font: 'sans', size: 12, color: '#355e48', bold: false, align: 'center' });
  function geometry(p) { return { width:p.width, height:p.height, cols:p.cols, rows:p.rows, gapX:p.gapX, gapY:p.gapY, left:p.left, top:p.top, shape:p.shape }; }
  let state = { version: 1, product: 'V3240', geometry: geometry(products.find(p=>p.id==='V3240')), labels: Array.from({length:16}, newLabel), selected: 0, start: 1, copies: 1, offsetX: 0, offsetY: 0, scaleX:1, scaleY:1 };
  let currentBrand = 'any', zoom = .65, toastTimer, restoring = false, printMode = 'labels', precisionUI, studioUI;
  function migrate(s) { if(!s || typeof s!=='object')return s;if(/^LS-(3105|3107|3108)$/.test(s.product))s.product=s.product.replace('LS-','FT-');if(s.geometry && !s.geometry.shape)s.geometry.shape='rect';s.scaleX ??= 1;s.scaleY ??= 1;s.shearX ??= 0;s.shearY ??= 0;return s; }
  function validGeometry(g) {
    return g && ['rect','ellipse'].includes(g.shape) && Object.keys(geometryNames).every(k => Number.isFinite(g[k])) && g.width >= 3 && g.height >= 3 && Number.isInteger(g.cols) && Number.isInteger(g.rows) && g.cols >= 1 && g.rows >= 1 && g.cols*g.rows <= 1000 && g.left >= 0 && g.top >= 0 && g.gapX >= 0 && g.gapY >= 0 && g.left+g.cols*g.width+(g.cols-1)*g.gapX <= 210.0001 && g.top+g.rows*g.height+(g.rows-1)*g.gapY <= 297.0001;
  }
  function validProject(s) {
    return s && (!globalThis.LabelStudio || globalThis.LabelStudio.valid(s)) && s.version === 1 && products.some(p => p.id === s.product) && validGeometry(s.geometry) && Array.isArray(s.labels) && s.labels.length === s.geometry.cols*s.geometry.rows && s.labels.every(l => l && typeof l.text === 'string' && l.text.length <= 1000 && Object.hasOwn(fonts,l.font) && Number.isFinite(l.size) && l.size >= 6 && l.size <= 48 && /^#[0-9a-f]{6}$/i.test(l.color) && typeof l.bold === 'boolean' && ['left','center','right'].includes(l.align)) && Number.isInteger(s.selected) && s.selected >= 0 && s.selected < s.labels.length && Number.isInteger(s.start) && s.start >= 1 && s.start <= s.labels.length && Number.isInteger(s.copies) && s.copies >= 1 && s.copies <= 20 && [s.offsetX,s.offsetY].every(n => Number.isFinite(n) && Math.abs(n) <= 10);
  }
  function validCalibration(s){return globalThis.LabelPrecision.valid(s);}
  try { const saved = migrate(JSON.parse(localStorage.getItem(STORAGE))); if(validProject(saved)&&validCalibration(saved)) state = saved; } catch { restoring = true; }
  currentBrand = products.find(p => p.id === state.product).brand;
  function toast(message) { $('toast').textContent=message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(() => $('toast').classList.remove('visible'),3000); }
  function save() { globalThis.LabelStudio?.prune(state);try { localStorage.setItem(STORAGE,JSON.stringify(state)); $('save-status').textContent='✓ 자동 저장됨'; } catch { $('save-status').textContent='저장 공간 부족 · 프로젝트 파일로 저장해 주세요'; } }
  function renderProducts() {
    document.querySelectorAll('[data-brand]').forEach(b => b.classList.toggle('active',b.dataset.brand === currentBrand));
    $('products').replaceChildren();
    const query=$('search').value.trim().toLowerCase().replace(/^(ls|lq)-?/,'');
    const shapeFilter=$('shape-filter').value || 'all', countFilter=$('count-filter').value || 'all';
    const matches=products.filter(p => {
      const count=p.cols*p.rows;
      const shapeMatches=shapeFilter==='all' || p.shape===shapeFilter;
      const countMatches=countFilter==='all' || (countFilter==='small'?count<=20:countFilter==='medium'?count>20&&count<=60:count>60);
      return p.brand===currentBrand && (p.id+' '+p.name+' '+p.width+'x'+p.height).toLowerCase().includes(query) && (currentBrand==='custom' || shapeMatches&&countMatches);
    });
    $('catalog-count').textContent=`${matches.length}개 품번 · 제조사 데이터 기준`;
    for(const p of matches) {
      const button=document.createElement('button'); button.className='product'+(p.id===state.product?' active':''); button.setAttribute('aria-pressed',String(p.id===state.product));
      const mini=document.createElement('span');mini.className='mini-sheet';mini.style.gridTemplateColumns=`repeat(${p.cols},minmax(0,1fr))`;const miniRows=Math.ceil(Math.min(p.cols*p.rows,80)/p.cols);mini.style.gridTemplateRows=`repeat(${miniRows},minmax(0,1fr))`;mini.style.gap=`${Math.min(2,17/p.cols/3,24/miniRows/3)}px`;mini.setAttribute('aria-hidden','true');
      for(let i=0;i<Math.min(p.cols*p.rows,80);i++) mini.append(document.createElement('i'));
      const desc=document.createElement('span');const title=document.createElement('strong');title.textContent=p.id==='CUSTOM'?'직접 규격 설정':p.code;const subtitle=document.createElement('small');subtitle.textContent=`${p.cols*p.rows}칸 · ${mm(p.width)} × ${mm(p.height)} mm`;desc.append(title,subtitle);
      const check=document.createElement('span');check.className='check';check.textContent=p.id===state.product?'●':'';button.append(mini,desc,check);
      button.addEventListener('click',()=>selectProduct(p));$('products').append(button);
    }
    if(!matches.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='등록된 규격이 없어요. 직접 설정을 이용해 주세요.';$('products').append(empty);}
  }
  function selectProduct(p) {
    if(p.id !== state.product){state.product=p.id;state.geometry=geometry(p);resizeLabels();save();}
    if(p.brand==='custom') $('geometry').open=true;
    renderAll();
  }
  function resizeLabels() {
    const n=state.geometry.cols*state.geometry.rows;
    // Keep existing content when switching products; additional slots start empty.
    state.labels=Array.from({length:n},(_,i)=>state.labels[i] || {...newLabel(),text:''});
    if(globalThis.LabelStudio)for(const l of state.labels){if(l.images)l.images=l.images.map(i=>globalThis.LabelStudio.fit(i,state.geometry));if(l.textBox)l.textBox=globalThis.LabelStudio.fit(l.textBox,state.geometry);}state.selected=Math.min(state.selected,n-1);state.start=Math.min(state.start,n);
  }
  function renderGeometry() {
    const p=products.find(p=>p.id===state.product),g=state.geometry;
    $('selected-product').textContent=p.id==='CUSTOM'?'직접 설정':p.code;
    $('label-size').textContent=`${mm(g.width)} × ${mm(g.height)} mm`;$('label-count').textContent=`${g.cols*g.rows}칸 (${g.cols}열 × ${g.rows}행)`;
    const original=p.id!=='CUSTOM' && Object.entries(geometry(p)).every(([key,value])=>g[key]===value);
    $('spec-status').textContent=original?'기본 규격 · 실물 출력 검증 전':'사용자 조정 규격 · 제조사 원본과 다를 수 있어요';
    $('spec-status').classList.toggle('modified',!original);$('source-version').textContent=p.sourceVersion?`${p.brand==='any'?'A사':'F사'} 데이터 ${p.sourceVersion}`:'직접 입력한 규격';
    $('geometry-shape').value=g.shape;$('reset-geometry').hidden=p.id==='CUSTOM';
    $('pitch-info').textContent=`첫 칸: 왼쪽 ${mm(g.left)} / 위 ${mm(g.top)} mm · 피치: 가로 ${mm(g.width+g.gapX)} / 세로 ${mm(g.height+g.gapY)} mm`;
    $('source').hidden=!p.source;if(p.source)$('source').href=p.source;
    $('geometry-fields').replaceChildren();
    for(const [key,title] of Object.entries(geometryNames)) {
      const label=document.createElement('label');label.textContent=title;const input=document.createElement('input');input.type='number';input.value=g[key];input.id='geometry-'+key;input.min=['cols','rows'].includes(key)?1:['width','height'].includes(key)?3:0;input.step=['cols','rows'].includes(key)?1:'any';
      input.addEventListener('change',()=>{const candidate={...state.geometry,[key]:Number(input.value)};if(input.value==='' || !validGeometry(candidate)){$('geometry-error').textContent='A4 영역을 벗어나거나 잘못된 값입니다. 이전 값으로 되돌렸어요.';input.value=state.geometry[key];return;}state.geometry=candidate;resizeLabels();$('geometry-error').textContent='';save();renderGeometry();renderSheet();renderEditor();});label.append(input);$('geometry-fields').append(label);
    }
  }
  function makeLabel(index,printing=false) {
    const g=state.geometry,l=state.labels[index],cell=document.createElement(printing?'div':'button');
    cell.className='label';cell.style.left=`${mm(g.left+(index%g.cols)*(g.width+g.gapX))}mm`;cell.style.top=`${mm(g.top+Math.floor(index/g.cols)*(g.height+g.gapY))}mm`;cell.style.width=mm(g.width)+'mm';cell.style.height=mm(g.height)+'mm';cell.style.borderRadius=g.shape==='ellipse'?'50%':'0';cell.style.fontFamily=fonts[l.font];cell.style.fontSize=l.size+'pt';cell.style.fontWeight=l.bold?'700':'400';cell.style.color=l.color;cell.style.textAlign=l.align;
    const content=document.createElement('span');content.className='label-content';content.textContent=l.text;if(l.textBox){const b=l.textBox;Object.assign(content.style,{position:'absolute',left:b.x+'mm',top:b.y+'mm',width:b.width+'mm',height:b.height+'mm',display:'flex',flexDirection:'column',justifyContent:'center',overflow:'hidden'});}cell.append(content);
    if(l.images&&(!printing||printMode!=='proof'))for(const item of l.images){const asset=state.assets?.[item.assetId];if(!asset)continue;const image=document.createElement('img');image.className='label-image';image.src=asset.data;image.alt='';image.style.left=item.x+'mm';image.style.top=item.y+'mm';image.style.width=item.width+'mm';image.style.height=item.height+'mm';cell.append(image);}
    if(!printing){cell.classList.toggle('selected',index===state.selected);cell.classList.toggle('skipped',index<state.start-1);cell.setAttribute('aria-label',`${index+1}번 라벨: ${l.text || '빈 라벨'}`);cell.setAttribute('aria-pressed',String(index===state.selected));cell.addEventListener('click',()=>{state.selected=index;renderSheet();renderEditor();save();});}
    return cell;
  }
  function renderSheet() {
    $('sheet').replaceChildren(...state.labels.map((_,i)=>makeLabel(i)));$('sheet').classList.toggle('guides',$('show-guides').checked);applyZoom();$('selection-number').textContent=String(state.selected+1).padStart(2,'0');
    $('start-label').max=state.labels.length;
  }
  function applyZoom(){const scale=zoom;$('sheet').style.transform=`scale(${scale})`;$('sheet-wrap').style.width=(210*96/25.4*scale)+'px';$('sheet-wrap').style.height=(297*96/25.4*scale)+'px';$('zoom-label').textContent=Math.round(scale*100)+'%';}
  function fitZoom(){zoom=Math.min(.8,Math.max(.25,($('canvas').clientWidth-46)/(210*96/25.4)));applyZoom();}
  function renderEditor(){const l=state.labels[state.selected];$('editing-number').textContent=`${state.selected+1}번 라벨`;$('content').value=l.text;$('char-count').textContent=`${l.text.length} / 1,000`;$('font').value=l.font;$('font-size').value=l.size;$('color').value=l.color;$('color-value').textContent=l.color;$('bold').classList.toggle('active',l.bold);$('bold').setAttribute('aria-pressed',String(l.bold));document.querySelectorAll('[data-align]').forEach(b=>{b.classList.toggle('active',b.dataset.align===l.align);b.setAttribute('aria-pressed',String(b.dataset.align===l.align));});$('start-label').value=state.start;$('copies').value=state.copies;$('offset-x').value=state.offsetX;$('offset-y').value=state.offsetY;studioUI?.refresh();}
  function updateLabel(update){Object.assign(state.labels[state.selected],update);renderSheet();save();}
  function renderCalibration(){$('calibration-status').textContent=`배율 X ${mm(state.scaleX*100)}% / Y ${mm(state.scaleY*100)}% · 위치 ${mm(state.offsetX)}, ${mm(state.offsetY)} mm${state.shearX||state.shearY?' · 기울어짐 보정 적용':''}`;precisionUI?.refresh();}
  function renderAll(){renderProducts();renderGeometry();renderSheet();renderEditor();renderCalibration();}
  document.querySelectorAll('[data-brand]').forEach(button=>button.addEventListener('click',()=>{currentBrand=button.dataset.brand;$('search').value='';renderProducts();if(currentBrand==='custom')selectProduct(products.find(p=>p.brand==='custom'));}));
  $('search').addEventListener('input',renderProducts);
  $('shape-filter').addEventListener('change',renderProducts);$('count-filter').addEventListener('change',renderProducts);
  $('geometry-shape').addEventListener('change',()=>{state.geometry.shape=$('geometry-shape').value;renderGeometry();renderSheet();save();});
  $('reset-geometry').addEventListener('click',()=>{state.geometry=geometry(products.find(p=>p.id===state.product));resizeLabels();renderAll();save();toast('제조사 데이터의 원본 규격으로 복원했어요.');});
  $('content').addEventListener('input',()=>{updateLabel({text:$('content').value});$('char-count').textContent=`${$('content').value.length} / 1,000`;});
  $('font').addEventListener('change',()=>updateLabel({font:$('font').value}));
  $('font-size').addEventListener('change',()=>{const size=Math.max(6,Math.min(48,Number($('font-size').value)||12));$('font-size').value=size;updateLabel({size});});
  $('color').addEventListener('input',()=>{updateLabel({color:$('color').value});$('color-value').textContent=$('color').value;});
  $('bold').addEventListener('click',()=>{updateLabel({bold:!state.labels[state.selected].bold});renderEditor();});
  document.querySelectorAll('[data-align]').forEach(b=>b.addEventListener('click',()=>{updateLabel({align:b.dataset.align});renderEditor();}));
  $('apply-all').addEventListener('click',()=>{const label=state.labels[state.selected];state.labels=state.labels.map(()=>JSON.parse(JSON.stringify(label)));renderSheet();save();toast(`${state.labels.length}개의 라벨에 적용했어요.`);});
  for(const [id,key,min,max,integer] of [['start-label','start',1,1000,true],['copies','copies',1,20,true],['offset-x','offsetX',-10,10,false],['offset-y','offsetY',-10,10,false]]){
    $(id).addEventListener('change',()=>{let n=Number($(id).value);if(!Number.isFinite(n))n=state[key];n=Math.max(min,Math.min(key==='start'?state.labels.length:max,n));if(integer)n=Math.floor(n);state[key]=n;$(id).value=n;renderSheet();renderCalibration();save();});
  }
  $('show-guides').addEventListener('change',renderSheet);
  $('zoom-in').addEventListener('click',()=>{zoom=Math.min(1.2,zoom+.1);applyZoom();});$('zoom-out').addEventListener('click',()=>{zoom=Math.max(.25,zoom-.1);applyZoom();});
  $('help').addEventListener('click',()=>$('help-dialog').showModal());
  document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  function buildPrint(){
    const root=$('print-root');root.replaceChildren();
    if(printMode==='ruler'){
      const page=document.createElement('div');page.className='print-sheet';const square=document.createElement('div');square.className='ruler-box';square.textContent='100 × 100 mm\n바깥쪽 변 기준\n종이 왼쪽·위에서 각각 20 mm';const note=document.createElement('div');note.className='ruler-note';note.textContent='오마이라벨 프린터 측정지\nA4 / 세로 / 실제 크기 100% / 여백 없음 / 머리글·바닥글 해제\n이 페이지는 앱 보정이 적용되지 않습니다.\n가로·세로 길이, 왼쪽·위쪽 거리를 측정해 보정 창에 입력하세요.';page.append(square,note);root.append(page);return;
    }
    for(let c=0;c<(printMode==='proof'?1:state.copies);c++){
      const page=document.createElement('div');page.className='print-sheet';const layer=document.createElement('div');layer.className='print-layer';layer.style.transform=`translate(${mm(state.offsetX)}mm, ${mm(state.offsetY)}mm) `+(state.shearX||state.shearY?`matrix(${state.scaleX}, ${state.shearY||0}, ${state.shearX||0}, ${state.scaleY}, 0, 0)`:`scale(${state.scaleX}, ${state.scaleY})`);
      for(let i=printMode==='proof'?0:state.start-1;i<state.labels.length;i++){
        const cell=makeLabel(i,true);
        if(printMode==='proof'){cell.classList.add('proof-label');cell.children[0].textContent=String(i+1);cell.style.fontSize='6pt';cell.style.color='#000000';}
        layer.append(cell);
      }
      page.append(layer);root.append(page);
    }
  }
  function showPrint(mode){printMode=mode;buildPrint();$('print-dialog').showModal();}
  $('print').addEventListener('click',()=>showPrint('labels'));
  $('proof-print').addEventListener('click',()=>showPrint('proof'));
  $('confirm-print').addEventListener('click',()=>{$('print-dialog').close();buildPrint();window.print();});
  window.addEventListener('beforeprint',buildPrint);
  window.addEventListener('afterprint',()=>{printMode='labels';});
  $('calibrate').addEventListener('click',()=>$('calibration-dialog').showModal());
  $('ruler-print').addEventListener('click',()=>{$('calibration-dialog').close();printMode='ruler';buildPrint();window.print();$('calibration-dialog').showModal();});
  $('apply-calibration').addEventListener('click',()=>{
    const values=['measured-width','measured-height','measured-left','measured-top'].map(id=>$(id).value.trim()===''?NaN:Number($(id).value));
    const [w,h,left,top]=values,scaleX=100/w,scaleY=100/h;
    const candidate={scaleX,scaleY,shearX:0,shearY:0,offsetX:20-left*scaleX,offsetY:20-top*scaleY};
    if(!values.every(Number.isFinite)||w<=0||h<=0||!validCalibration(candidate)||Math.abs(candidate.offsetX)>10||Math.abs(candidate.offsetY)>10){$('calibration-error').textContent='측정값을 확인하세요. 배율 90–110%, 위치 ±10mm 범위만 보정할 수 있어요.';return;}
    Object.assign(state,candidate);$('calibration-error').textContent='';renderEditor();renderCalibration();save();$('calibration-dialog').close();toast('보정을 적용했어요. 칼선 시험 인쇄로 확인해 주세요.');
  });
  $('reset-calibration').addEventListener('click',()=>{Object.assign(state,globalThis.LabelPrecision.IDENTITY);renderEditor();renderCalibration();save();toast('프린터 보정을 초기화했어요.');});
  $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`오마이라벨-${state.product}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('프로젝트 파일을 저장했어요.');});
  $('import').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=>{const file=$('import-file').files[0];if(!file)return;try{if(file.size>30_000_000)throw new Error('too large');const next=migrate(JSON.parse(await file.text()));if(!validProject(next)||!validCalibration(next))throw new Error('invalid');state=next;currentBrand=products.find(p=>p.id===state.product).brand;$('search').value='';$('shape-filter').value='all';$('count-filter').value='all';renderAll();save();toast('프로젝트를 불러왔어요.');}catch{toast('올바른 오마이라벨 프로젝트 파일을 선택해 주세요.');}finally{$('import-file').value='';}});
  if(globalThis.initStudioUI)studioUI=globalThis.initStudioUI({getProject:()=>state,commit:fn=>{fn(state);renderSheet();renderEditor();save();},notify:toast});
  renderAll();fitZoom();window.addEventListener('resize',fitZoom);if(restoring)$('save-status').textContent='자동 저장을 사용할 수 없어요 · 파일로 저장해 주세요';
  precisionUI=globalThis.initPrecisionUI({getProject:()=>state,applyCalibration:values=>{Object.assign(state,values);renderEditor();renderCalibration();save();},notify:toast});
})();
