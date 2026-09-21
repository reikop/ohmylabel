(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LabelPrecision=api;})(globalThis,()=>{
  'use strict';
  const POINTS=Object.freeze([{id:'A',x:20,y:20},{id:'B',x:190,y:20},{id:'C',x:105,y:148.5},{id:'D',x:20,y:277},{id:'E',x:190,y:277}].map(Object.freeze));
  const IDENTITY=Object.freeze({scaleX:1,scaleY:1,shearX:0,shearY:0,offsetX:0,offsetY:0});
  const KEYS=Object.keys(IDENTITY);
  function calibration(s={}){return Object.fromEntries(KEYS.map(k=>[k,s[k]??IDENTITY[k]]));}
  function valid(s){const m=calibration(s);return KEYS.every(k=>Number.isFinite(m[k]))&&m.scaleX>=.9&&m.scaleX<=1.1&&m.scaleY>=.9&&m.scaleY<=1.1&&Math.abs(m.shearX)<=.03&&Math.abs(m.shearY)<=.03&&Math.abs(m.offsetX)<=10&&Math.abs(m.offsetY)<=10&&(m.scaleX*m.scaleY-m.shearX*m.shearY)>.8;}
  function transform(m,p){m=calibration(m);return{x:m.scaleX*p.x+m.shearX*p.y+m.offsetX,y:m.shearY*p.x+m.scaleY*p.y+m.offsetY};}
  function inverse(m){m=calibration(m);const det=m.scaleX*m.scaleY-m.shearX*m.shearY;if(!Number.isFinite(det)||Math.abs(det)<1e-9)throw Error('변환을 계산할 수 없는 측정값입니다.');const r={scaleX:m.scaleY/det,shearX:-m.shearX/det,shearY:-m.shearY/det,scaleY:m.scaleX/det};r.offsetX=-(r.scaleX*m.offsetX+r.shearX*m.offsetY);r.offsetY=-(r.shearY*m.offsetX+r.scaleY*m.offsetY);return r;}
  function fingerprint(m){m=calibration(m);return KEYS.map(k=>m[k].toFixed(9)).join(',');}
  function measurements(rows){
    if(!Array.isArray(rows)||rows.length!==5)throw Error('A–E 다섯 지점을 모두 측정해 주세요.');
    return POINTS.map(p=>{const matches=rows.filter(r=>r.id===p.id);const r=matches[0];if(matches.length!==1||!r||!Number.isFinite(r.x)||!Number.isFinite(r.y)||r.x<0||r.x>210||r.y<0||r.y>297)throw Error(`${p.id} 지점의 종이 왼쪽·위쪽 거리를 확인해 주세요.`);return{id:p.id,x:r.x,y:r.y};});
  }
  function solve(matrix,vector){const a=matrix.map((row,i)=>[...row,vector[i]]);for(let c=0;c<3;c++){let pivot=c;for(let r=c+1;r<3;r++)if(Math.abs(a[r][c])>Math.abs(a[pivot][c]))pivot=r;[a[c],a[pivot]]=[a[pivot],a[c]];if(Math.abs(a[c][c])<1e-10)throw Error('측정점 배치가 올바르지 않습니다.');const v=a[c][c];a[c]=a[c].map(n=>n/v);for(let r=0;r<3;r++)if(r!==c){const f=a[r][c];a[r]=a[r].map((n,k)=>n-f*a[c][k]);}}return a.map(r=>r[3]);}
  function fit(rows){
    rows=measurements(rows);
    const design=POINTS.map(p=>[(p.x-105)/100,(p.y-148.5)/100,1]);
    const matrix=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>design.reduce((sum,row)=>sum+row[i]*row[j],0)));
    const regression=axis=>solve(matrix,[0,1,2].map(k=>design.reduce((sum,row,i)=>sum+row[k]*rows[i][axis],0)));
    const x=regression('x'),y=regression('y');
    const forward={scaleX:x[0]/100,shearX:x[1]/100,offsetX:x[2]-x[0]*1.05-x[1]*1.485,shearY:y[0]/100,scaleY:y[1]/100,offsetY:y[2]-y[0]*1.05-y[1]*1.485};
    const correction=inverse(forward);
    const residuals=POINTS.map((p,i)=>{const predicted=transform(forward,p);return{id:p.id,dx:rows[i].x-predicted.x,dy:rows[i].y-predicted.y,error:Math.hypot(rows[i].x-predicted.x,rows[i].y-predicted.y)};});
    const maxResidual=Math.max(...residuals.map(r=>r.error));
    return{correction,forward,residuals,maxResidual,rms:Math.sqrt(residuals.reduce((s,r)=>s+r.error**2,0)/5),canApply:valid(correction)&&maxResidual<=.5};
  }
  function verify(sheets){
    if(!Array.isArray(sheets)||sheets.length>10)throw Error('검증은 최대 10장까지 기록할 수 있습니다.');
    const points=sheets.flatMap((sheet,i)=>measurements(sheet).map((r,j)=>{const p=POINTS[j];return{sheet:i+1,id:p.id,dx:r.x-p.x,dy:r.y-p.y,error:Math.hypot(r.x-p.x,r.y-p.y)};}));
    const max=points.length?Math.max(...points.map(p=>p.error)):null;
    return{sheets:sheets.length,points,max,rms:points.length?Math.sqrt(points.reduce((s,p)=>s+p.error**2,0)/points.length):null,complete:sheets.length===10,passed:sheets.length===10&&max<=.5,status:!points.length?'unmeasured':max>.5?'failed':sheets.length===10?'passed':'incomplete'};
  }
  function cell(g,i){return{x:g.left+(i%g.cols)*(g.width+g.gapX),y:g.top+Math.floor(i/g.cols)*(g.height+g.gapY),width:g.width,height:g.height};}
  function corners(rect){return[{x:rect.x,y:rect.y},{x:rect.x+rect.width,y:rect.y},{x:rect.x,y:rect.y+rect.height},{x:rect.x+rect.width,y:rect.y+rect.height}];}
  function outsidePage(rect,m){return corners(rect).map(p=>transform(m,p)).some(p=>p.x<-.0001||p.x>210.0001||p.y<-.0001||p.y>297.0001);}
  // PDF has its origin at the bottom left; the app's mm coordinates start at the top left.
  function pdfMatrix(m){m=calibration(m);const pt=72/25.4,H=297*pt;return[m.scaleX,-m.shearY,-m.shearX,m.scaleY,m.shearX*H+m.offsetX*pt,(1-m.scaleY)*H-m.offsetY*pt];}
  return{POINTS,IDENTITY,KEYS,calibration,valid,transform,inverse,fingerprint,measurements,fit,verify,cell,corners,outsidePage,pdfMatrix};
});
