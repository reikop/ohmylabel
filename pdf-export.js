(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./vendor/pdf-lib.min.js'),require('./vendor/fontkit.umd.min.js'),require('./precision.js'),require('./studio-model.js'));else root.LabelPDF=factory(root.PDFLib,root.fontkit,root.LabelPrecision,root.LabelStudio);})(globalThis,(PDF,fontkit,P,Studio)=>{
  'use strict';
  const PT=72/25.4,H=297*PT,W=210*PT,cache=new Map();
  async function browserFont(key){
    if(!cache.has(key))cache.set(key,new Promise((resolve,reject)=>{
      const decode=()=>{const value=globalThis.OHMYLABEL_FONT_DATA?.[key];if(!value){cache.delete(key);reject(Error('PDF 글꼴을 불러오지 못했습니다.'));return;}resolve(Uint8Array.from(atob(value),c=>c.charCodeAt(0)));};
      if(globalThis.OHMYLABEL_FONT_DATA?.[key])return decode();
      const script=document.createElement('script');script.src=`assets/font-data/${key}.js`;script.onload=decode;script.onerror=()=>{cache.delete(key);script.remove();reject(Error('로컬 글꼴 파일을 확인해 주세요.'));};document.head.append(script);
    }));
    return cache.get(key);
  }
  function wrap(text,font,size,width){
    const lines=[];
    for(const paragraph of text.replace(/\r\n?/g,'\n').normalize('NFC').split('\n')){
      if(!paragraph){lines.push('');continue;}
      let line='';
      for(const char of Array.from(paragraph.replace(/\t/g,'    '))){
        if(font.widthOfTextAtSize(char,size)>width+1e-7)throw Error('글자가 라벨의 안전 영역보다 큽니다. 글자 크기를 줄여 주세요.');
        if(line&&font.widthOfTextAtSize(line+char,size)>width+1e-7){lines.push(line);line=char;}else line+=char;
      }
      lines.push(line);
    }
    return lines;
  }
  function safeRect(r,shape){
    // For ellipses use an inscribed rectangle, so its entire text box stays inside the cut.
    const factor=shape==='ellipse'?Math.SQRT1_2:1;
    const width=r.width*factor,height=r.height*factor;
    const padX=Math.min(3,width*.1),padY=Math.min(2,height*.1);
    return{x:r.x+(r.width-width)/2+padX,y:r.y+(r.height-height)/2+padY,width:width-2*padX,height:height-2*padY};
  }
  function color(hex){return PDF.rgb(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255));}
  function checkedProject(s){
    if(!s||!P.valid(s))throw Error('보정값이 유효하지 않습니다.');
    const g=s.geometry;
    if(!g||!['rect','ellipse'].includes(g.shape)||!['width','height','left','top','gapX','gapY','cols','rows'].every(k=>Number.isFinite(g[k]))||g.width<3||g.height<3||g.left<0||g.top<0||g.gapX<0||g.gapY<0||!Number.isInteger(g.cols)||!Number.isInteger(g.rows)||g.cols<1||g.rows<1||g.cols*g.rows>1000)throw Error('라벨 규격이 유효하지 않습니다.');
    if(P.outsidePage(P.cell(g,g.cols*g.rows-1),P.IDENTITY))throw Error('라벨 배치가 A4를 벗어납니다.');
    if(!Array.isArray(s.labels)||s.labels.length!==g.cols*g.rows||!Number.isInteger(s.start)||s.start<1||s.start>s.labels.length||!Number.isInteger(s.copies)||s.copies<1||s.copies>20)throw Error('인쇄 범위가 유효하지 않습니다.');
    for(const l of s.labels)if(!l||typeof l.text!=='string'||l.text.length>1000||!['sans','serif','mono'].includes(l.font)||!Number.isFinite(l.size)||l.size<6||l.size>48||!/^#[0-9a-f]{6}$/i.test(l.color)||typeof l.bold!=='boolean'||!['left','center','right'].includes(l.align))throw Error('라벨 내용 또는 글자 설정이 유효하지 않습니다.');
  }
  async function create(project,options={}){
    const mode=options.mode||'labels';if(!['labels','proof','calibration','verification'].includes(mode))throw Error('지원하지 않는 PDF 종류입니다.');
    checkedProject(project);
    if(Studio&&!Studio.valid(project))throw Error('이미지 데이터나 배치가 유효하지 않습니다.');
    const doc=await PDF.PDFDocument.create();doc.registerFontkit(fontkit);
    doc.setTitle(mode==='labels'?`오마이라벨 ${project.product}`:`오마이라벨 ${mode}`);doc.setCreator('Ohmylabel vector PDF');doc.setLanguage('ko-KR');
    doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PDF.PrintScaling.None);
    const fonts=new Map();
    // Full embedding preserves composite Korean glyphs that fontkit's subsetter can lose.
    async function font(key){if(!fonts.has(key)){const bytes=await(options.fontLoader||browserFont)(key);const face=fontkit.create(bytes);const embedded=await doc.embedFont(bytes,{subset:false});fonts.set(key,{face,embedded});}return fonts.get(key);}
    const calibration=mode==='calibration'?P.IDENTITY:P.calibration(project);
    const warnings=[];
    const plan=[],imagePlan=[],embeddedImages=new Map();
    if(mode==='labels'){
      for(let i=project.start-1;i<project.labels.length;i++)for(const item of project.labels[i].images||[]){
        const r=P.cell(project.geometry,i),rect={x:r.x+item.x,y:r.y+item.y,width:item.width,height:item.height};
        if(P.outsidePage(rect,calibration))throw Error(`${i+1}번 라벨의 이미지가 보정 후 A4를 벗어납니다.`);
        if(project.geometry.shape==='ellipse'&&P.corners(item).some(p=>((p.x-r.width/2)/(r.width/2))**2+((p.y-r.height/2)/(r.height/2))**2>1+1e-8))throw Error(`${i+1}번 라벨: 이미지 모서리가 타원 밖으로 나갑니다. 이미지 크기나 위치를 조절하세요.`);
        if(!embeddedImages.has(item.assetId)){const data=project.assets[item.assetId].data;try{embeddedImages.set(item.assetId,await(data.startsWith('data:image/png')?doc.embedPng(data):doc.embedJpg(data)));}catch{throw Error(`${i+1}번 라벨의 이미지 파일을 읽지 못했습니다.`);}}
        imagePlan.push({z:item.z??project.labels[i].images.indexOf(item),rect,image:embeddedImages.get(item.assetId)});
      }
      for(let i=project.start-1;i<project.labels.length;i++){
        for(const l of Studio?Studio.textItems(project.labels[i]):[project.labels[i]]){if(!l.text.trim())continue;
        const r=P.cell(project.geometry,i),safe=l.textBox?{x:r.x+l.textBox.x,y:r.y+l.textBox.y,width:l.textBox.width,height:l.textBox.height}:safeRect(r,project.geometry.shape),f=await font(l.font+(l.bold?'-bold':''));
        const text=l.text.replace(/\r\n?/g,'\n').normalize('NFC');
        const unsupported=Array.from(new Set(Array.from(text).filter(c=>!['\n','\t'].includes(c)&&!f.face.hasGlyphForCodePoint(c.codePointAt(0)))));
        if(unsupported.length)throw Error(`${i+1}번 라벨: 포함된 글꼴이 지원하지 않는 문자 ${unsupported.slice(0,5).join(' ')}. 문자나 글꼴을 변경해 주세요.`);
        let lines;try{lines=wrap(text,f.embedded,l.size,safe.width*PT);}catch(e){throw Error(`${i+1}번 라벨: ${e.message}`);}
        const ascent=f.face.ascent/f.face.unitsPerEm*l.size,descent=Math.abs(f.face.descent)/f.face.unitsPerEm*l.size,lineHeight=Math.max(l.size*1.55,ascent+descent);
        const blockHeight=ascent+descent+(lines.length-1)*lineHeight;
        if(blockHeight>safe.height*PT+1e-7)throw Error(`${i+1}번 라벨의 문구가 안전 영역을 넘습니다. 글자 크기나 줄 수를 줄여 주세요.`);
        if(project.geometry.shape==='ellipse'&&P.corners(safe).some(p=>((p.x-r.x-r.width/2)/(r.width/2))**2+((p.y-r.y-r.height/2)/(r.height/2))**2>1+1e-8))throw Error(`${i+1}번 라벨: 텍스트 박스가 타원 밖으로 나갑니다.`);
        if(P.outsidePage(safe,calibration))throw Error(`${i+1}번 라벨의 보정된 내용 영역이 A4 밖으로 나갑니다. 보정값을 확인해 주세요.`);
        plan.push({z:l.z??100,i,l,r,safe,f,lines,ascent,lineHeight,blockHeight});}
      }
      if(!plan.length&&!imagePlan.length)throw Error('선택한 인쇄 범위에 내용이 없습니다.');
    }
    const pageCount=mode==='labels'?project.copies:mode==='verification'?10:1;
    const regular=mode==='labels'?null:(await font('sans')).embedded;
    function text(page,value,x,y,size=9){page.drawText(value,{x:x*PT,y:H-y*PT,size,font:regular,color:PDF.rgb(.12,.17,.13)});}
    function line(page,x1,y1,x2,y2,width=.15){page.drawLine({start:{x:x1*PT,y:H-y1*PT},end:{x:x2*PT,y:H-y2*PT},thickness:width*PT,color:PDF.rgb(0,0,0)});}
    for(let n=0;n<pageCount;n++){
      const page=doc.addPage([W,H]);page.setMediaBox(0,0,W,H);page.setCropBox(0,0,W,H);
      page.pushOperators(PDF.pushGraphicsState(),PDF.concatTransformationMatrix(...P.pdfMatrix(calibration)));
      if(mode==='labels')for(const item of [...imagePlan,...plan].sort((a,b)=>a.z-b.z)){if(item.image){const r=item.rect;page.drawImage(item.image,{x:r.x*PT,y:H-(r.y+r.height)*PT,width:r.width*PT,height:r.height*PT});continue;}
        const {l,safe,f,lines,ascent,lineHeight,blockHeight}=item;
        const firstBaseline=H-(safe.y*PT+(safe.height*PT-blockHeight)/2+ascent);
        lines.forEach((value,j)=>{if(!value)return;const width=f.embedded.widthOfTextAtSize(value,l.size);const x=safe.x*PT+(l.align==='center'?(safe.width*PT-width)/2:l.align==='right'?safe.width*PT-width:0);page.drawText(value,{x,y:firstBaseline-j*lineHeight,size:l.size,font:f.embedded,color:color(l.color)});});
      }
      if(mode==='proof')for(let i=0;i<project.labels.length;i++){
        const r=P.cell(project.geometry,i);if(P.outsidePage(r,calibration))warnings.push(`${i+1}번 라벨 외곽이 A4 경계를 벗어납니다.`);
        if(project.geometry.shape==='ellipse')page.drawEllipse({x:(r.x+r.width/2)*PT,y:H-(r.y+r.height/2)*PT,xScale:r.width/2*PT,yScale:r.height/2*PT,borderWidth:.1*PT,borderColor:PDF.rgb(0,0,0)});
        else page.drawRectangle({x:r.x*PT,y:H-(r.y+r.height)*PT,width:r.width*PT,height:r.height*PT,borderWidth:.1*PT,borderColor:PDF.rgb(0,0,0)});
        text(page,String(i+1),r.x+r.width/2-1,r.y+r.height/2,6);
      }
      if(mode==='calibration'||mode==='verification'){
        for(const p of P.POINTS){line(page,p.x-3,p.y,p.x+3,p.y,.1);line(page,p.x,p.y-3,p.x,p.y+3,.1);const left=p.x>150?p.x-40:p.x+5;text(page,`${p.id} (${p.x}, ${p.y}) mm`,left,p.y-4,8);}
        text(page,'오마이라벨 · 5지점 정밀 측정',35,49,16);
        text(page,mode==='calibration'?'보정 계산용 · 보정 미적용':'보정 확인용 · 현재 보정 적용',35,59,11);
        text(page,`A4 210 × 297 mm / 실제 크기 100% / ${n+1} of ${pageCount}`,35,68,9);
        text(page,'십자선의 교차점까지 종이 왼쪽(X), 위쪽(Y) 거리를 측정하세요.',35,80,9);
        text(page,'A–E 다섯 점을 모두 입력합니다. 단위는 mm입니다.',35,87,9);
        text(page,mode==='calibration'?'이 파일은 기존 프린터 보정값을 사용하지 않습니다.':'이 파일을 출력한 뒤 보정값을 바꾸지 말고 측정 결과를 기록하세요.',35,94,9);
        line(page,55,115,155,115);line(page,55,113,55,117);line(page,155,113,155,117);text(page,'100 mm (눈금 중심 기준)',80,123,8);
        text(page,'측정 기록',35,184,11);
        text(page,'지점           왼쪽 거리 X (mm)           위쪽 거리 Y (mm)',35,195,9);
        P.POINTS.forEach((p,i)=>{const y=207+i*10;text(page,p.id,38,y,9);line(page,65,y+1,107,y+1,.1);line(page,124,y+1,166,y+1,.1);});
        text(page,'목표: 10장 × 5지점에서 최대 위치 오차 0.5 mm 이하 (사용자 실측)',35,267,8);
      }
      page.pushOperators(PDF.popGraphicsState());
    }
    return{bytes:await doc.save(),warnings:[...new Set(warnings)],pageCount,mode,calibration};
  }
  return{create,wrap,safeRect,checkedProject,PT};
});
