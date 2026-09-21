// A script transport also works from file://, where fetch(localFont) is blocked.
const fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'..','assets','font-data');fs.mkdirSync(dir,{recursive:true});
for(const [key,name] of Object.entries({sans:'NanumGothic',serif:'NanumMyeongjo',mono:'NanumGothicCoding'}))for(const weight of ['Regular','Bold']){
 const id=key+(weight==='Bold'?'-bold':'');
 const bytes=fs.readFileSync(path.join(__dirname,'..','assets','fonts',`${name}-${weight}.ttf`));
 fs.writeFileSync(path.join(dir,id+'.js'),`globalThis.OHMYLABEL_FONT_DATA ??= {};\nglobalThis.OHMYLABEL_FONT_DATA[${JSON.stringify(id)}] = ${JSON.stringify(bytes.toString('base64'))};\n`);
}
