(function(root){
  'use strict';
  root.initPrecisionUI=function({getProject,applyCalibration,notify}){
    const $=id=>document.getElementById(id),P=root.LabelPrecision,KEY='ohmylabel.precision.v1';
    let profiles=[],session=null,fitResult=null,fitRows=null,pdfURL=null,busy=false;
    function readPoints(prefix){return P.POINTS.map(p=>({id:p.id,x:readNumber(`${prefix}-${p.id}-x`),y:readNumber(`${prefix}-${p.id}-y`)}));}
    function readNumber(id){const value=$(id).value.trim();return value===''?NaN:Number(value);}
    function clearPoints(prefix){P.POINTS.forEach(p=>['x','y'].forEach(axis=>$(prefix+'-'+p.id+'-'+axis).value=''));}
    function validProfile(p){return p&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.length<=100&&p.calibration&&P.valid(p.calibration);}
    try{const saved=JSON.parse(localStorage.getItem(KEY));profiles=Array.isArray(saved?.profiles)?saved.profiles.filter(validProfile).slice(0,50):[];if(saved?.session&&typeof saved.session.fingerprint==='string'&&typeof saved.session.settings==='string'&&Array.isArray(saved.session.sheets)){P.verify(saved.session.sheets);session=saved.session;}}catch{/* A damaged record cannot become a successful measurement. */}
    function persist(){try{localStorage.setItem(KEY,JSON.stringify({version:1,profiles,session}));}catch{notify('보정 기록을 자동 저장하지 못했어요. 기록 파일을 내려받아 주세요.');}}
    function drawProfiles(){const select=$('printer-profile');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='저장한 프린터 설정 선택';select.append(placeholder);for(const p of profiles){const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.name;select.append(opt);}}
    function createFields(prefix){
      const container=$(prefix+'-fields');container.replaceChildren();
      for(const p of P.POINTS){const row=document.createElement('div');row.className='measurement-row';const title=document.createElement('span');title.textContent=`${p.id} · ${p.x}, ${p.y}`;row.append(title);for(const axis of ['x','y']){const label=document.createElement('label');label.className='measurement-field';const sr=document.createElement('span');sr.className='sr-only';sr.textContent=`${p.id} ${axis==='x'?'왼쪽':'위쪽'} 거리 (mm)`;const input=document.createElement('input');input.id=`${prefix}-${p.id}-${axis}`;input.type='number';input.step='0.01';input.min='0';input.max=axis==='x'?'210':'297';input.placeholder=String(p[axis]);label.append(sr,input);if(prefix==='fit')input.addEventListener('input',()=>{fitResult=null;fitRows=null;$('apply-fivepoint').disabled=true;$('fit-result').textContent='측정값이 바뀌었습니다. 보정 계산을 다시 눌러 주세요.';});row.append(label);}container.append(row);}
    }
    function status(){
      const result=P.verify(session?.sheets||[]),changed=session&&session.fingerprint!==P.fingerprint(getProject());
      $('verification-count').textContent=`${result.sheets} / 10장`;
      const target=$('verification-result');target.className='verification-result';
      if(!session)target.textContent='아직 실측 기록이 없습니다. 프린터·급지함·용지 설정을 적고 새 측정을 시작하세요.';
      else if(changed){target.textContent='보정값이 달라졌습니다. 기존 기록은 이전 보정값의 결과입니다. 새 측정을 시작하세요.';target.classList.add('warning');}
      else if(result.max===null)target.textContent='보정 확인용 PDF 10장을 실제 크기 100%로 출력한 뒤 1번 장부터 입력하세요.';
      else{target.textContent=`${result.complete?(result.passed?'목표 충족 (사용자 실측)':'목표 미달'):'측정 진행 중'} · 최대 ${result.max.toFixed(3)} mm / RMS ${result.rms.toFixed(3)} mm${result.complete?'':' · 10장이 모두 기록되기 전에는 합격을 판정하지 않습니다.'}`;if(result.status==='failed')target.classList.add('warning');else if(result.passed)target.classList.add('success');}
      $('add-measurement').disabled=!session||changed||result.complete;
      $('verification-records').replaceChildren();
      for(let i=0;i<(session?.sheets.length||0);i++){const line=document.createElement('li');line.textContent=`${i+1}번 장 · 최대 ${P.verify([session.sheets[i]]).max.toFixed(3)} mm`;$('verification-records').append(line);}
      $('verification-next').textContent=result.complete?'10장 측정 완료':`${result.sheets+1}번 장 측정값`;
    }
    function download(bytes,type,name){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
    async function preview(mode){
      if(busy)return;busy=true;$('precision-error').textContent='';$('pdf-status').textContent='글꼴을 포함한 PDF를 만드는 중입니다…';
      const snapshot=JSON.parse(JSON.stringify(getProject()));
      try{
        const result=await root.LabelPDF.create(snapshot,{mode});
        if(pdfURL)URL.revokeObjectURL(pdfURL);pdfURL=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));
        $('pdf-frame').src=pdfURL;$('pdf-download').href=pdfURL;$('pdf-download').download=`ohmylabel-${snapshot.product}-${mode}.pdf`;
        $('pdf-newtab').href=pdfURL;$('pdf-summary').textContent=`A4 210 × 297 mm · ${result.pageCount}장 · ${mode==='calibration'?'보정 미적용':mode==='verification'?'현재 보정 적용 · 10장 실측용':'현재 보정 적용'} · 글꼴 포함`;
        $('pdf-warnings').textContent=result.warnings.join('\n');$('pdf-status').textContent='';$('pdf-dialog').showModal();
      }catch(e){$('pdf-status').textContent='';$('precision-error').textContent=e.message;notify(e.message);}
      finally{busy=false;}
    }
    $('pdf-export').addEventListener('click',()=>preview('labels'));
    $('pdf-proof').addEventListener('click',()=>preview('proof'));
    $('open-precision').addEventListener('click',()=>{status();$('precision-dialog').showModal();});
    $('fivepoint-pdf').addEventListener('click',()=>preview('calibration'));
    $('verification-pdf').addEventListener('click',()=>preview('verification'));
    $('calculate-fivepoint').addEventListener('click',()=>{
      try{fitRows=readPoints('fit');fitResult=P.fit(fitRows);const m=fitResult.correction;
        $('fit-result').textContent=`X 배율 ${(m.scaleX*100).toFixed(5)}% / Y 배율 ${(m.scaleY*100).toFixed(5)}%\n위치 ${m.offsetX.toFixed(4)}, ${m.offsetY.toFixed(4)} mm\n교차축 보정 ${m.shearX.toFixed(6)}, ${m.shearY.toFixed(6)}\n모델 최대 잔차 ${fitResult.maxResidual.toFixed(3)} mm · RMS ${fitResult.rms.toFixed(3)} mm\n${fitResult.canApply?'적용 후 별도의 10장 실측으로 확인하세요.':'측정 불일치가 크거나 보정 범위를 벗어났습니다. 입력값과 급지를 다시 확인하세요.'}`;
        $('apply-fivepoint').disabled=!fitResult.canApply;
      }catch(e){fitResult=null;fitRows=null;$('fit-result').textContent=e.message;$('apply-fivepoint').disabled=true;}
    });
    $('apply-fivepoint').addEventListener('click',()=>{if(!fitResult?.canApply)return;applyCalibration(fitResult.correction);status();notify('5지점 보정을 적용했어요. 보정 확인용 PDF로 실측해 주세요.');});
    $('save-printer-profile').addEventListener('click',()=>{
      const name=$('profile-name').value.trim();if(!name||name.length>100){notify('프린터·급지함·용지 설정을 100자 이내로 입력해 주세요.');return;}
      if(profiles.length>=50){notify('프린터 설정은 최대 50개까지 저장할 수 있어요.');return;}
      const item={id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),name,calibration:P.calibration(getProject()),createdAt:new Date().toISOString()};profiles.push(item);persist();drawProfiles();$('printer-profile').value=item.id;notify('프린터 보정값을 저장했어요.');
    });
    $('load-printer-profile').addEventListener('click',()=>{const p=profiles.find(p=>p.id===$('printer-profile').value);if(!p)return;applyCalibration(p.calibration);$('profile-name').value=p.name;status();notify('저장한 프린터 보정값을 적용했어요.');});
    $('new-verification').addEventListener('click',()=>{
      const settings=$('verification-settings').value.trim();if(!settings||settings.length>200){notify('검증할 프린터·급지함·용지 설정을 적어 주세요.');return;}
      if(session?.sheets.length){download(JSON.stringify(session,null,2),'application/json','ohmylabel-previous-measurements.json');}
      session={version:1,startedAt:new Date().toISOString(),settings,calibration:P.calibration(getProject()),fingerprint:P.fingerprint(getProject()),sheets:[]};clearPoints('verify');persist();status();
    });
    $('add-measurement').addEventListener('click',()=>{
      if(!session||session.fingerprint!==P.fingerprint(getProject())||session.sheets.length>=10)return;
      try{const rows=P.measurements(readPoints('verify'));session.sheets.push(rows);persist();clearPoints('verify');status();}catch(e){notify(e.message);}
    });
    $('undo-measurement').addEventListener('click',()=>{if(!session?.sheets.length)return;const last=session.sheets.pop();for(const p of last)for(const axis of ['x','y'])$(`verify-${p.id}-${axis}`).value=p[axis];persist();status();});
    $('export-measurements').addEventListener('click',()=>{if(!session){notify('먼저 측정을 시작해 주세요.');return;}const report={...session,result:P.verify(session.sheets),currentCorrectionMatches:session.fingerprint===P.fingerprint(getProject()),evidence:'user-entered measurements; not independently certified'};download(JSON.stringify(report,null,2),'application/json','ohmylabel-measurements.json');});
    $('pdf-dialog').addEventListener('close',()=>{$('pdf-frame').removeAttribute('src');if(pdfURL){URL.revokeObjectURL(pdfURL);pdfURL=null;}});
    createFields('fit');createFields('verify');drawProfiles();status();
    return{refresh:status,preview};
  };
})(globalThis);
