const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
const sample=`[21:04:12] John Doe says: We got everyone? Good. Let's get to work.
[21:04:18] * John Doe folds the manifest, slipping it into his jacket.
[21:04:25] Jane Doe says: Everything's accounted for. Check it yourself.
[21:04:32] /do The dock lights flicker against the dark water.
[21:04:38] John Doe says (low): Keep an eye on that gate.
[21:04:44] [Radio] Jane Doe: Copy that. We're ready on this end.
[21:04:51] (( Jane Doe: Give me a second to grab a screenshot. ))`;
const colors={inventoryHeader:['Inventory header','#00d000'],inventoryItem:['Inventory items','#ffff00'],shownItem:['Shown items','#56d64b'],scamPhone:['Scam phone messages','#eda841'],takenItem:['Taken item','#56d64b'],shout:['Shouts','#f1f1f1'],propertyCash:['Property transfers','#eda841'],factionHeading:['Faction heading','#00aaff'],factionMember:['Faction members','#939799'],infoNotice:['Info notices','#f1f1f1'],infoLabel:['[INFO] label','#00aaff'],command:['Info commands','#ffba00'],whisper:['Whispers','#ffba00'],carWhisper:['Car whispers','#fbf724'],phone:['Phone · other caller','#fbf724'],pm:['Private messages','#fbf724'],megaphone:['Megaphone','#fbf724'],advert:['Advertisements','#80e500'],transaction:['Item transfers','#56d64b'],speech:['Normal text','#c6c4c4'],action:['/me · /ame','#c2a3da'],lower:['[lower]','#5a5a5b'],low:['[low]','#939799'],death:['Death / failure','#f00000'],important:['Important info','#fbf724'],success:['Success','#56d64b'],warning:['Warning','#eda841'],information:['Information','#3896f3'],white:['Default white','#f1f1f1'],radio:['Radio · light','#ffec8b'],radioDark:['Radio · dark','#a19558'],department:['Department','#ccca15'],vessel:['Vessel traffic','#33c1c9'],alert:['[!] messages','#ff00bc'],ooc:['OOC','#a8b8d8'],bg:['Background','#15181e']};
const palette=document.querySelector('.palette');palette.replaceChildren();
for(const [id,[label,color]] of Object.entries(colors)){const l=document.createElement('label'),i=document.createElement('input');i.type='color';i.id=id;i.value=color;l.append(document.createTextNode(label),i);palette.append(l)}
const ids=['textAnchor','textOffset','wrapWidth','exportFormat','jpegQuality','jpegMatte','backgroundX','backgroundY','dragMode','backgroundZoom','character','text','timestamps','font','size','width','height','spacing','outline','padding','bold','transparent',...Object.keys(colors)];
let image=null,imageData=null,pos=null,hidden=new Set(),drawn=[],drag=null;
let jpegPreviewTimer=null,jpegPreviewRevision=0,jpegPreviewURL=null,jpegPreviewBusy=false,draftTimer=null,renderFrame=null;
const types=Object.keys(colors).filter(x=>x!=='bg');
for(const type of types){let l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.checked=true;i.addEventListener('change',()=>{i.checked?hidden.delete(type):hidden.add(type);render()});l.append(i,document.createTextNode(colors[type][0]));$('filters').append(l)}
function state(){return {...Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),paletteVersion:2}}
function status(s){$('status').textContent=s}
function load(s){for(const id of ids)if(s[id]!==undefined){if($(id).type==='checkbox')$(id).checked=!!s[id];else $(id).value=s[id]}}
function rpFirstParts(text){
 const clean=text.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/,'');
 const quoted=clean.match(/^\*(?!\*)\s*(.+?)\s+["“]([\s\S]+)["”]\s*$/);
 if(quoted)return {action:quoted[1].trim().replace(/\*$/, '').trim(),speech:' '+quoted[2]};
 return null;
}
function classify(text){
 const openingAction=rpFirstParts(text);
 if(openingAction){const tailType=classify(openingAction.speech.trim());return ['speech','low','lower','phone','shout','whisper','carWhisper'].includes(tailType)?tailType:'speech';}
if(/^\|?-{2,}\s*.+?['’]s Items\b|^Money on hand\s*:/i.test(text))return 'inventoryHeader';
if(/^\d+:\s+.+?\s+x\d+\b|^Total weight\s*:/i.test(text))return 'inventoryItem';
if(/^[^:]+?\s+has shown you their\s+.+/i.test(text))return 'shownItem';
if(/^\(SCAM\s*PHONE\)\s*Message sent to\b/i.test(text))return 'scamPhone';
if(/^\[!\]/.test(text))return 'alert';
if(/^\{(?:[0-9a-f]{6})\}/i.test(text))text=text.replace(/\{[0-9a-f]{6}\}/gi,'');
if(/^\[!\]/.test(text))return 'alert';
if(/^\*\*\s*\[S:\s*\d+\s*\|\s*CH:/i.test(text))return 'radio';
if(/^\(Phone\)\s*\*|^\*|^\/(?:a?me|do)\b/i.test(text))return 'action';
if(/^\(\(\s*PM\s+(?:from|to)\b|^\[PM\b/i.test(text))return 'pm';
if(/^\[Advertisement\]/i.test(text))return 'advert';
if(/^You (?:placed\s+.+?\s+into|took\s+.+?\s+(?:out of|from))\s+(?:the )?property\b/i.test(text))return 'propertyCash';
if(/^You['’]ve just taken\s+/i.test(text))return 'takenItem';
if(/^You (?:gave|received|paid)\b|^[^:]+?\s+paid you\s+.+/i.test(text))return 'transaction';
if(/^Online faction members:/i.test(text))return 'factionHeading';
if(/^Faction Members (?:Online|On-Duty):/i.test(text))return 'white';
if(/^.+? Member .+?\(\/togf\)/i.test(text))return 'factionMember';
if(/^Info:/i.test(text))return 'infoNotice';
if(/^Make sure to always use a realistic name|^will result in a ban\./i.test(text))return 'death';
if(/\bsays\s*(?:\(phone\)|\[phone\])(?:\s|:|$)/i.test(text))return 'phone';
if(/^\(Car\)\s+.+?\s+whispers\s*:/i.test(text))return 'carWhisper';
if(/^.+?\s+whispers\s*:|^\/whisper\b/i.test(text))return 'whisper';
if(/\[Megaphone\]|^\/m\s/i.test(text))return 'megaphone';
if(/^.+?\s+(?:shouts|yells)\s*:|^\/(?:s|shout)\s/i.test(text))return 'shout';
if(/\[lower\]|says\s*\(lower\)|^\/lower\b/i.test(text))return 'lower';
if(/\[low\]|says\s*\(low\)|^\/low\b/i.test(text))return 'low';

if(/\(\(|^\/b\s|\[OOC\]/i.test(text))return 'ooc';
if(/^\[(?:vessel traffic|vts)\]|^\/vts\b/i.test(text))return 'vessel';
if(/^\[(?:department|dep)\]|^\/dep\b/i.test(text))return 'department';
if(/^\[radio(?:\s*[-:]?\s*(?:dark|low))\]|^\[radio\]\s*\[(?:dark|low)\]/i.test(text))return 'radioDark';
if(/^\[(?:radio(?:\s*[-:]?\s*light)?|r)\]/i.test(text))return 'radio';
if(/^\[(?:death|failure|failed|error)\]/i.test(text))return 'death';
if(/^\[(?:important|important info)\]/i.test(text))return 'important';
if(/^\[success\]/i.test(text))return 'success';
if(/^\[warning\]/i.test(text))return 'warning';
if(/^\[(?:info|information)\]/i.test(text))return 'information';
if(/^\[white\]/i.test(text))return 'white';
return 'speech';
}
function parse(line){let stamp=line.match(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/)?.[0]||'';let text=line.slice(stamp.length).replace(/^\[CHAT\]\s*/,'');let type=classify(text);text=text.replace(/^\/(?:a?me|do)\s+/i,'* ').replace(/^\/b\s+(.+)$/i,'(( $1 ))');return {text:($('timestamps').checked?stamp:'')+text,type}}
function font(){return `${$('bold').checked?'bold ':''}${+$('size').value}px ${$('font').value}`}
function segments(text,color){let parts=[],re=/\{([0-9a-fA-F]{6})\}/g,last=0,m;while((m=re.exec(text))){parts.push({text:text.slice(last,m.index),color});color='#'+m[1];last=re.lastIndex}parts.push({text:text.slice(last),color});return parts}
function dialogueColor(line){
const base=$(line.type).value,name=$('character').value.trim().replace(/_/g,' ').replace(/\s+/g,' ').toLowerCase();
if(!name||!['speech','low','lower','phone'].includes(line.type))return base;
const clean=line.text.replace(/\{[0-9a-f]{6}\}/gi,'').replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/, '');
const lead=rpFirstParts(clean);
if(lead){const actor=lead.action.replace(/_/g,' ').replace(/\s+/g,' ').trim().toLowerCase();const own=actor===name||actor.startsWith(name+' ');return line.type==='phone'?own?$('white').value:base:line.type==='low'?own?$('speech').value:base:line.type==='lower'?own?$('low').value:base:own?$('white').value:base;}
const match=clean.match(/^(.+?)\s+(?:says|shouts|whispers|asks|replies|yells)(?=\s|:|\[|\()/i);
if(!match)return base;
const own=match[1].replace(/_/g,' ').replace(/\s+/g,' ').trim().toLowerCase()===name;
if(line.type==='phone')return own?$('white').value:base;
if(line.type==='speech')return own?$('white').value:base;
if(line.type==='low')return own?$('speech').value:base;
if(line.type==='lower')return own?$('low').value:base;
return base;
}
function styledSegments(line,color){
 // Explicit GTA color codes always take priority over automatic formatting.
 if(/\{[0-9a-f]{6}\}/i.test(line.text))return segments(line.text,color);
 if(line.type==='alert'){
 const marker=line.text.match(/^(\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?(\[!\])/);
 if(marker){const out=[];if(marker[1])out.push({text:marker[1],color:$('white').value});out.push({text:marker[2],color:$('alert').value});out.push({text:line.text.slice(marker[0].length),color:$('white').value});return out;}
 }
 if(line.type==='shownItem'){
 const match=line.text.match(/^((?:\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?[^:]+?\s+has shown you their\s+)([\s\S]+)$/i);
 if(match)return [{text:match[1],color:$('shownItem').value},{text:match[2],color:$('white').value}];
 }
 if(line.type==='takenItem'){
 const match=line.text.match(/^((?:\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?You['’]ve just taken\s+)(.+?)(!|\.(?=\s|$)|(?=\s+You will feel)|$)([\s\S]*)$/i);
 if(match)return [{text:match[1],color:$('white').value},{text:match[2],color:$('takenItem').value},{text:match[3]+match[4],color:$('white').value}];
 }
 if(line.type==='infoNotice'){
 const out=[{text:'Info:',color:$('warning').value}],body=line.text.slice(5);
 const re=/You (?:asked|targetted) (.+?) to pay (\$[\d,]+(?:\.\d{2})?)/i,match=re.exec(body);
 if(match){out.push({text:body.slice(0,match.index)+body.slice(match.index,match.index+match[0].indexOf(match[1])),color:$('white').value});out.push({text:match[1],color:$('important').value});out.push({text:' to pay ',color:$('white').value});out.push({text:match[2],color:$('success').value});out.push({text:body.slice(match.index+match[0].length),color:$('white').value});}
 else out.push({text:body,color:$('white').value});return out;
 }
 if(line.type!=='information')return segments(line.text,color);
 const label=line.text.match(/^(\[\d{1,2}:\d{2}(?::\d{2})?\]\s*)?(\[(?:info|information)\])/i);
 if(!label)return segments(line.text,color);
 const out=[];if(label[1])out.push({text:label[1],color:$('white').value});
 out.push({text:label[2],color:$('infoLabel').value});
 const body=line.text.slice(label[0].length),re=/[/.](?:anim\s+stop|stop)\b|\/[a-z][a-z0-9_]*/gi;
 let last=0,match;while((match=re.exec(body))){out.push({text:body.slice(last,match.index),color:$('white').value});out.push({text:match[0],color:$('command').value});last=re.lastIndex;}
 out.push({text:body.slice(last),color:$('white').value});return out;
}
function inlineActionSegments(line,color){
 const leading=rpFirstParts(line.text);
 if(leading){const out=[],stamp=line.text.match(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/);if(stamp)out.push({text:stamp[0],color});out.push(...segments('* '+leading.action,$('action').value));out.push(...inlineActionSegments({...line,text:leading.speech},color));return out;}

 if(!['speech','low','lower','phone','shout','whisper','carWhisper'].includes(line.type))return styledSegments(line,color);
 const re=/(?<!\*)\*([^*]+?)\*(?!\*)/g,out=[];let last=0,match;
 while((match=re.exec(line.text))){
 out.push(...styledSegments({...line,text:line.text.slice(last,match.index)},color));
 out.push(...segments(match[1],$('action').value));last=re.lastIndex;
 }
 if(!last)return styledSegments(line,color);
 out.push(...styledSegments({...line,text:line.text.slice(last)},color));return out;
}
function redactSegments(parts,initial=false){
 let hidden=initial;const out=[];
 for(const part of parts){const chunks=part.text.split('÷');chunks.forEach((text,index)=>{if(index)hidden=!hidden;if(text)out.push({...part,text,redacted:hidden})});}
 return out;
}
function paintChatSegment(c,seg,x,y,size){
 if(seg.redacted){c.fillStyle='#000';c.fillRect(x-0.5,y-1,c.measureText(seg.text).width+1,size+3);return;}
 if(c.lineWidth)c.strokeText(seg.text,x,y);c.fillStyle=seg.color;c.fillText(seg.text,x,y);
}
$('copyRedaction').onclick=async()=>{try{await navigator.clipboard.writeText('÷');status('Copied ÷ — wrap text in ÷…÷ to black it out.')}catch{const input=$('redactionSymbol');input.hidden=false;input.select();status('Select and copy the ÷ symbol.')}};
function layout(lines,w){ctx.font=font();let rows=[];for(const line of lines){let color=dialogueColor(line);let row=[],x=0;for(const seg of redactSegments(inlineActionSegments(line,color),line.redactStart))for(const word of seg.text.split(/(\s+)/)){let chunks=[word];if(ctx.measureText(word).width>w){chunks=[];let chunk='';for(const char of word){if(ctx.measureText(chunk+char).width>w&&chunk){chunks.push(chunk);chunk=''}chunk+=char}if(chunk)chunks.push(chunk)}for(const chunk of chunks){let width=ctx.measureText(chunk).width;if(x+width>w&&x){rows.push(row);row=[];x=0}row.push({text:chunk,color:seg.color,redacted:seg.redacted,x});x+=width}}rows.push(row)}return rows}
function chatOrigin(){
 if(pos)return pos;
 const size=+$('size').value,gap=+$('spacing').value||0;
 const blockHeight=drawn.length?drawn.length*size+(drawn.length-1)*gap:0;
 const offset=Math.max(0,+$('textOffset').value||0);
 return {x:offset,y:$('textAnchor').value==='bottom'?Math.max(0,canvas.height-offset-blockHeight):offset};
}
function renderSingle(){let w=Math.max(80,Math.min(6000,+$('width').value||1100)),pad=Math.max(0,+$('padding').value||0),size=+$('size').value,gap=Math.max(0,+$('spacing').value||0);let raw=$('text').value,redacting=false;let lines=raw?raw.split(/\r?\n/).map(line=>{const parsed=parse(line.replace(/\t/g,'    '));parsed.redactStart=redacting;if((line.match(/÷/g)||[]).length%2)redacting=!redacting;return parsed;}).filter(line=>!line.text.trim()||!hidden.has(line.type)):[];const wrap=Math.max(10,Math.min(100,+$('wrapWidth').value||100));drawn=layout(lines,Math.max(1,(w-pad*2)*wrap/100));$('wrapOutput').textContent=wrap+'%';let h=Math.max(80,pad*2+drawn.length*(size+gap));let fixedHeight=+$('height').value;canvas.width=w;canvas.height=fixedHeight?Math.max(80,Math.min(6000,fixedHeight)):image?Math.round(image.height*w/image.width):h;ctx.clearRect(0,0,canvas.width,canvas.height);if(image){let fit=Math.max(canvas.width/image.width,canvas.height/image.height);let zoom=Math.max(0.1,Math.min(5,(+$('backgroundZoom').value||100)/100));let iw=image.width*fit*zoom,ih=image.height*fit*zoom;ctx.drawImage(image,(canvas.width-iw)/2+(+$('backgroundX').value||0),(canvas.height-ih)/2+(+$('backgroundY').value||0),iw,ih);}else if(!$('transparent').checked){ctx.fillStyle=$('bg').value;ctx.fillRect(0,0,canvas.width,canvas.height)}ctx.font=font();ctx.textBaseline='top';ctx.lineJoin='round';let origin=chatOrigin();ctx.lineWidth=+$('outline').value*2;ctx.strokeStyle='#000';drawn.forEach((row,i)=>row.forEach(seg=>{let x=origin.x+seg.x,y=origin.y+i*(size+gap);paintChatSegment(ctx,seg,x,y,size)}));$('count').textContent=lines.length+' lines';$('dimensions').textContent=canvas.width+' × '+canvas.height+' px';$('sizeout').textContent=size+' px';$('empty').hidden=lines.length>0||!!image;canvas.style.display=lines.length||image?'block':'none';if(!buildingLayers){saveDraft();updateChatOutline();queueJPEGPreview();}}
function saveDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{localStorage.setItem('chatlog-studio',JSON.stringify(state()))}catch{}},300)}
function scheduleRender(){if(renderFrame!==null)return;renderFrame=requestAnimationFrame(()=>{renderFrame=null;render()})}
ids.filter(id=>!['exportFormat','jpegQuality','jpegMatte'].includes(id)).forEach(id=>$(id).addEventListener('input',scheduleRender));
$('jpegMatte').addEventListener('input',()=>{queueJPEGPreview();saveDraft()});
for(const id of ['textAnchor','textOffset'])$(id).addEventListener('input',()=>{pos=null;scheduleRender()});
$('preset800').onclick=()=>{$('width').value=800;$('height').value=600;$('scale').value='1';render();status('Canvas set to 800 × 600. Export at 1× for exactly this size.')};
$('presetauto').onclick=()=>{$('height').value='';render()};
$('example').onclick=()=>{$('text').value=sample;render()};
function download(blob,name){let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function exportCanvas(jpeg,preview=false){
 const out=document.createElement('canvas'),scale=preview?Math.min(1,1000/Math.max(canvas.width,canvas.height)):+$('scale').value;
 out.width=canvas.width*scale;out.height=canvas.height*scale;
 const output=out.getContext('2d');
 if(jpeg){output.fillStyle=$('jpegMatte').value;output.fillRect(0,0,out.width,out.height)}
 output.drawImage(canvas,0,0,out.width,out.height);return out;
}
function queueJPEGPreview(){
 clearTimeout(jpegPreviewTimer);++jpegPreviewRevision;
 $('jpegPreview').hidden=true;$('jpegPreview').removeAttribute('src');
 if(jpegPreviewURL){URL.revokeObjectURL(jpegPreviewURL);jpegPreviewURL=null}
}
$('scale').addEventListener('change',queueJPEGPreview);
function jpegLevel(value){return Math.max(0,Math.min(12,Math.round(Number(value)||0)))}
function exportUI(){
 const jpeg=$('exportFormat').value==='jpeg',q=jpegLevel($('jpegQuality').value);
 const tier=q<=4?'Low':q<=7?'Medium':q<=9?'High':'Maximum';
 $('jpegOptions').hidden=true;$('jpegMatteControl').hidden=!jpeg;$('exportChoice').value=jpeg?'jpeg-'+q:'png';$('jpegSlider').value=q;$('qualityLabel').textContent=q+' · '+tier.toUpperCase();
 $('jpegTier').value=q<=4?'4':q<=7?'7':q<=9?'9':'12';
 $('download').textContent=jpeg?'Export JPEG ↓':'Export PNG ↓';
 $('exportHint').textContent=jpeg?'JPEG · quality '+q+'/12 · '+tier:'Lossless PNG. No watermark.';
 queueJPEGPreview();saveDraft();
}
$('exportFormat').addEventListener('change',exportUI);
$('jpegQuality').addEventListener('input',exportUI);
$('jpegQuality').addEventListener('change',()=>{$('jpegQuality').value=jpegLevel($('jpegQuality').value);exportUI()});
$('jpegSlider').oninput=e=>{$('jpegQuality').value=e.target.value;exportUI()};
$('jpegTier').onchange=e=>{$('jpegQuality').value=e.target.value;exportUI()};
$('download').onclick=()=>{
 if(!sceneHasContent())return status('Add some chat lines first.');
 const jpeg=$('exportFormat').value==='jpeg',q=jpegLevel($('jpegQuality').value),out=exportCanvas(jpeg);
 out.toBlob(b=>{if(!b)return status('Export failed. Please try again.');download(b,'chatlog-'+Date.now()+(jpeg?'.jpg':'.png'));status(jpeg?'JPEG exported · quality '+q+'/12':'PNG exported')},jpeg?'image/jpeg':'image/png',jpeg?q/12:undefined);
};
$('save').onclick=()=>{download(new Blob([JSON.stringify({version:1,settings:state(),image:imageData,pos,hidden:[...hidden]})],{type:'application/json'}),'chatlog-project.json');status('Project downloaded')};$('open').onclick=()=>$('project').click();
function setImage(data){return new Promise((resolve,reject)=>{let img=new Image();img.onload=()=>{if(img.width>6000||img.height>6000){reject(Error('Please use a screenshot up to 6000 × 6000 pixels.'));return}image=img;imageData=data;render();resolve()};img.onerror=()=>reject(Error('Could not read this image.'));img.src=data})}
$('project').onchange=async e=>{try{let p=JSON.parse(await e.target.files[0].text());if(p.version!==1||!p.settings)throw Error('Please choose a Filthlines Chatlog Editor project.');load(p.settings);pos=p.pos||null;hidden=new Set(p.hidden||[]);[...$('filters').querySelectorAll('input')].forEach((x,i)=>x.checked=!hidden.has(types[i]));image=null;imageData=null;if(p.image)await setImage(p.image);render();exportUI();status('Project opened')}catch(err){status(err.message)}e.target.value=''};
async function importScreenshot(file){
 if(!file)return;
 if(!/^image\/(?:png|jpeg|webp|gif|bmp|avif)$/.test(file.type)){status('Choose an image file: PNG, JPG, WebP, GIF, BMP or AVIF.');return;}
 try{
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read this file.'));reader.readAsDataURL(file)});
 await setImage(data);pos=null;$('backgroundZoom').value=100;$('backgroundX').value=0;$('backgroundY').value=0;render();status('Screenshot added. Canvas dimensions preserved. Scroll on the focused preview to zoom the background.');
 }catch(err){status(err.message)}
}
$('image').onchange=e=>{importScreenshot(e.target.files[0]);e.target.value=''};
for(const zone of [$('stage'),document.querySelector('.upload')]){
 zone.addEventListener('dragover',e=>{if(![...e.dataTransfer.types].includes('Files'))return;e.preventDefault();e.dataTransfer.dropEffect='copy';zone.classList.add('dragover')});
 zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('dragover')});
 zone.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();zone.classList.remove('dragover');const files=[...e.dataTransfer.files];const file=files.find(f=>f.type.startsWith('image/'));if(file)importScreenshot(file);else status('Drop an image file here.');});
}
// Keep image drops from navigating away from the editor.
window.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault()});
window.addEventListener('drop',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault()});
$('remove').onclick=()=>{const currentHeight=canvas.height;image=null;imageData=null;if(!$('height').value)$('height').value=currentHeight;$('backgroundZoom').value=100;$('backgroundX').value=0;$('backgroundY').value=0;render();status('Background image removed')};$('reset').onclick=()=>{pos=null;render()};
function updateChatOutline(){
 const box=$('chatDragOutline');
 box.hidden=!(drag&&drag.mode==='text'&&drawn.length);
 if(box.hidden)return;
 ctx.font=font();
 const width=drawn.reduce((max,row)=>Math.max(max,...row.map(seg=>seg.x+ctx.measureText(seg.text).width)),0);
 const size=+$('size').value,step=size+(+$('spacing').value||0),margin=6;
 const origin=chatOrigin();
 box.style.left=((origin.x-margin)/canvas.width*100)+'%';
 box.style.top=((origin.y-margin)/canvas.height*100)+'%';
 box.style.width=((width+margin*2)/canvas.width*100)+'%';
 box.style.height=(((drawn.length-1)*step+size+margin*2)/canvas.height*100)+'%';
}
function hitChat(point){
 const origin=chatOrigin();
 const size=+$('size').value,step=size+(+$('spacing').value||0),margin=5;
 ctx.font=font();
 return drawn.some((row,i)=>{
 const width=row.reduce((max,seg)=>Math.max(max,seg.x+ctx.measureText(seg.text).width),0);
 return width>0&&point.x>=origin.x-margin&&point.x<=origin.x+width+margin&&point.y>=origin.y+i*step-margin&&point.y<=origin.y+i*step+size+margin;
 });
}
$('resetBackground').onclick=()=>{$('backgroundX').value=0;$('backgroundY').value=0;render();status('Background centered')};

$('stage').addEventListener('wheel',e=>handleLayerWheel(e),{passive:false});
$('resetZoom').onclick=()=>{$('backgroundZoom').value=100;render();status('Background zoom reset to 100%')};

// LAYER_ENGINE
let layers=[],selectedLayerId=null,chatLayerId=null,imageLayerId=null,buildingLayers=false,layerCounter=0,pendingNewImage=false;
const chatKeys=['textAnchor','textOffset','wrapWidth','character','text','timestamps','font','size','spacing','outline','padding','bold',...Object.keys(colors).filter(k=>k!=='bg')];
function uid(){return 'layer-'+Date.now().toString(36)+'-'+(++layerCounter)}
function selectedLayer(){return layers.find(l=>l.id===selectedLayerId)}
function chatLayer(){return layers.find(l=>l.id===chatLayerId&&l.type==='chat')}
function imageLayer(){return layers.find(l=>l.id===imageLayerId&&l.type==='image')}
function chatSettings(){const s=state();return Object.fromEntries(chatKeys.map(k=>[k,s[k]]))}
function syncLayers(){
 const chat=chatLayer();if(chat){chat.settings=chatSettings();chat.pos=pos?{...pos}:null;chat.hidden=[...hidden]}
 const img=imageLayer();if(img){img.x=+$('backgroundX').value||0;img.y=+$('backgroundY').value||0;img.zoom=+$('backgroundZoom').value||100;}
}
function serializeLayers(includeImages=true){syncLayers();return {version:2,settings:state(),selectedLayerId,chatLayerId,imageLayerId,layers:layers.map(l=>l.type==='chat'?{id:l.id,type:l.type,name:l.name,visible:l.visible,opacity:l.opacity,settings:l.settings,pos:l.pos,hidden:l.hidden}:{id:l.id,type:l.type,name:l.name,visible:l.visible,opacity:l.opacity,x:l.x,y:l.y,zoom:l.zoom,data:includeImages?l.data:null})}}
function sceneHasContent(){return layers.some(l=>l.visible&&(l.type==='image'?!!l.img:!!l.settings.text.trim()))}
function selectLayer(id,save=true){
 if(save)syncLayers();const layer=layers.find(l=>l.id===id);if(!layer)return;selectedLayerId=id;
 if(layer.type==='chat'){chatLayerId=id;load(layer.settings);pos=layer.pos?{...layer.pos}:null;hidden=new Set(layer.hidden||[]);[...$('filters').querySelectorAll('input')].forEach((input,i)=>input.checked=!hidden.has(types[i]));}
 else{imageLayerId=id;image=layer.img;imageData=layer.data;$('backgroundX').value=layer.x||0;$('backgroundY').value=layer.y||0;$('backgroundZoom').value=layer.zoom||100;}
 for(const key of chatKeys)$(key).disabled=layer.type!=='chat';
 $('text').disabled=false;$('text').readOnly=layer.type!=='chat';
 for(const key of ['backgroundX','backgroundY','backgroundZoom','resetZoom','resetBackground'])$(key).disabled=layer.type!=='image';
 $('layerName').value=layer.name;$('layerOpacity').value=layer.opacity??100;$('opacityOutput').textContent=(layer.opacity??100)+'%';
 $('layerHint').textContent=layer.type==='chat'?'Editing this chat layer. Use the text and style controls below.':'Editing this image layer. Drag it, or use position and zoom controls below.';
 updateLayerList();render();
}
function updateLayerList(){
 const list=$('layerList');list.replaceChildren();
 [...layers].reverse().forEach(layer=>{const row=document.createElement('div');row.className='layer-row'+(layer.id===selectedLayerId?' selected':'');
 const eye=document.createElement('button');eye.className='visibility';eye.textContent=layer.visible?'Show':'Hidden';eye.setAttribute('aria-label',(layer.visible?'Hide ':'Show ')+layer.name);eye.onclick=()=>{layer.visible=!layer.visible;updateLayerList();render()};
 const select=document.createElement('button');select.className='layer-select';select.textContent=(layer.type==='chat'?'T · ':'▧ · ')+layer.name;select.setAttribute('aria-pressed',String(layer.id===selectedLayerId));select.onclick=()=>selectLayer(layer.id);
 row.append(eye,select);list.append(row);
 });
 const layer=selectedLayer(),i=layers.indexOf(layer);$('layerUp').disabled=i<0||i===layers.length-1;$('layerDown').disabled=i<=0;
}
function newChat(){syncLayers();const settings=chatSettings();settings.text='John Doe says: Write your scene here.';const layer={id:uid(),type:'chat',name:'Chat '+(layers.filter(l=>l.type==='chat').length+1),visible:true,opacity:100,settings,pos:null,hidden:[]};layers.push(layer);selectLayer(layer.id,false)}
function removeLayer(id=selectedLayerId){
 syncLayers();const removed=layers.find(l=>l.id===id);if(!removed)return;layers=layers.filter(l=>l.id!==id);
 if(removed.type==='chat'&&chatLayerId===id){chatLayerId=null;pos=null;drawn=[];const other=layers.find(l=>l.type==='chat');if(other){chatLayerId=other.id;load(other.settings);pos=other.pos||null;hidden=new Set(other.hidden||[])}}
 if(removed.type==='image'&&imageLayerId===id){imageLayerId=null;image=null;imageData=null;const other=layers.find(l=>l.type==='image');if(other){imageLayerId=other.id;image=other.img;imageData=other.data;$('backgroundX').value=other.x;$('backgroundY').value=other.y;$('backgroundZoom').value=other.zoom}}
 if(!layers.length){newChat();return}selectLayer(layers.at(-1).id,false);status('Layer removed');
}
function moveLayer(direction){syncLayers();const index=layers.findIndex(l=>l.id===selectedLayerId),target=index+direction;if(target<0||target>=layers.length)return;[layers[index],layers[target]]=[layers[target],layers[index]];updateLayerList();render()}
function imageBounds(layer,w=canvas.width,h=canvas.height){const scale=Math.max(w/layer.img.width,h/layer.img.height)*(layer.zoom||100)/100;const width=layer.img.width*scale,height=layer.img.height*scale;return {x:(w-width)/2+(layer.x||0),y:(h-height)/2+(layer.y||0),width,height}}
function paintLayer(c,layer){if(!layer.visible)return;c.save();c.globalAlpha=(layer.opacity??100)/100;if(layer.type==='image'&&layer.img){const b=imageBounds(layer);c.drawImage(layer.img,b.x,b.y,b.width,b.height)}else if(layer.cache)c.drawImage(layer.cache,0,0);c.restore()}
function render(){
 if(buildingLayers)return;syncLayers();buildingLayers=true;
 const original=state(),originalPos=pos,originalHidden=hidden,originalImage=image,originalImageData=imageData;
 let w=Math.max(80,Math.min(6000,+$('width').value||1100)),h=+$('height').value;
 if(!h){if(originalImage)h=Math.round(originalImage.height*w/originalImage.width);else{renderSingle();h=canvas.height}}
 h=Math.max(80,Math.min(6000,h));
 let selectedRows=[];
 for(const layer of layers){if(layer.type!=='chat')continue;
 const key=JSON.stringify([layer.settings,layer.pos,layer.hidden,w,h]);
 if(layer.cacheKey!==key){load(layer.settings);$('width').value=w;$('height').value=h;pos=layer.pos||null;hidden=new Set(layer.hidden||[]);image=null;imageData=null;$('transparent').checked=true;renderSingle();
 layer.rows=drawn;layer.cache=document.createElement('canvas');layer.cache.width=w;layer.cache.height=h;layer.cache.getContext('2d').drawImage(canvas,0,0);
 // Text layers must remain transparent, independently of the canvas background.
 layer.cacheKey=key;layer.origin=chatOrigin();ctx.font=font();layer.bounds={x:layer.origin.x,y:layer.origin.y,width:drawn.reduce((max,row)=>Math.max(max,...row.map(seg=>seg.x+ctx.measureText(seg.text).width)),0),height:drawn.length?(drawn.length-1)*(+$('size').value+(+$('spacing').value||0))+(+$('size').value):0};
 }
 if(layer.id===chatLayerId)selectedRows=layer.rows||[];
 }
 load(original);pos=originalPos;hidden=originalHidden;image=originalImage;imageData=originalImageData;drawn=selectedRows;
 canvas.width=w;canvas.height=h;ctx.clearRect(0,0,w,h);if(!$('transparent').checked){ctx.fillStyle=$('bg').value;ctx.fillRect(0,0,w,h)}
 for(const layer of layers)paintLayer(ctx,layer);
 $('count').textContent=(chatLayer()?.settings.text.split(/\r?\n/).length||0)+' lines · '+layers.length+' layers';$('dimensions').textContent=w+' × '+h+' px';$('sizeout').textContent=$('size').value+' px';$('wrapOutput').textContent=$('wrapWidth').value+'%';$('empty').hidden=sceneHasContent();canvas.style.display=sceneHasContent()?'block':'none';
 buildingLayers=false;saveDraft();updateChatOutline();queueJPEGPreview();
}
function saveDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{localStorage.setItem('chatlog-studio',JSON.stringify(serializeLayers(false)))}catch{}},400)}
function decodeImage(data){return new Promise((resolve,reject)=>{if(typeof data!=='string'||!/^data:image\//.test(data))return reject(Error('Invalid image data'));const img=new Image();img.onload=()=>img.width<=6000&&img.height<=6000?resolve(img):reject(Error('Use images up to 6000 × 6000 pixels.'));img.onerror=()=>reject(Error('Could not read image.'));img.src=data})}
async function importScreenshot(file){
 if(!file||!file.type.startsWith('image/'))return status('Choose an image file.');
 try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)}),img=await decodeImage(data);syncLayers();
 const layer={id:uid(),type:'image',name:file.name,visible:true,opacity:100,img,data,x:0,y:0,zoom:100};
 // Background images begin below chat layers; ordering can be changed in the panel.
 const firstChat=layers.findIndex(l=>l.type==='chat');layers.splice(firstChat<0?layers.length:firstChat,0,layer);selectLayer(layer.id,false);status('Image layer added. Canvas dimensions unchanged.');
 }catch(err){status(err.message||'Could not open image.')}
}
async function openLayerProject(p){
 if(!p||![1,2].includes(p.version)||!p.settings)throw Error('Choose an editor project file.');
 // Decode everything before replacing the current scene.
 const incoming=[];
 if(p.version===2){if(!Array.isArray(p.layers)||p.layers.length>100)throw Error('Invalid layer list.');for(const raw of p.layers){if(!['chat','image'].includes(raw.type))continue;const layer={...raw,id:uid(),visible:raw.visible!==false,opacity:Math.max(0,Math.min(100,Number(raw.opacity??100)))};layer.oldId=raw.id;if(layer.type==='image'){if(!raw.data)continue;layer.img=await decodeImage(raw.data)}else{layer.settings={...chatSettings(),...raw.settings};layer.hidden=raw.hidden||[];}incoming.push(layer)}}
 else{if(p.image)incoming.push({id:uid(),type:'image',name:'Background',visible:true,opacity:100,data:p.image,img:await decodeImage(p.image),x:+p.settings.backgroundX||0,y:+p.settings.backgroundY||0,zoom:+p.settings.backgroundZoom||100});incoming.push({id:uid(),type:'chat',name:'Chat 1',visible:true,opacity:100,settings:{...chatSettings(),...p.settings},pos:p.pos||null,hidden:p.hidden||[]})}
 load(p.settings);layers=incoming;chatLayerId=null;imageLayerId=null;image=null;imageData=null;pos=null;hidden=new Set();
 const chat=layers.find(l=>l.type==='chat');if(chat){chatLayerId=chat.id;load(chat.settings);pos=chat.pos||null;hidden=new Set(chat.hidden||[])}
 const img=layers.find(l=>l.type==='image');if(img){imageLayerId=img.id;image=img.img;imageData=img.data;$('backgroundX').value=img.x;$('backgroundY').value=img.y;$('backgroundZoom').value=img.zoom}
 if(!layers.length)newChat();else selectLayer((layers.find(l=>l.oldId===p.selectedLayerId)||chat||layers.at(-1)).id,false);exportUI();
}
$('save').onclick=()=>{download(new Blob([JSON.stringify(serializeLayers(true))],{type:'application/json'}),'filthlines-project.json');status('All layers saved. This file includes original images and unredacted text.')};
$('project').onchange=async e=>{try{const p=JSON.parse(await e.target.files[0].text());await openLayerProject(p);status('Layered project opened')}catch(err){status(err.message)}e.target.value=''};
$('addChatLayer').onclick=newChat;$('addImageLayer').onclick=()=>$('image').click();
$('layerName').oninput=()=>{const layer=selectedLayer();if(layer){layer.name=$('layerName').value;updateLayerList();saveDraft()}};
$('layerOpacity').oninput=()=>{const layer=selectedLayer();if(layer){layer.opacity=+$('layerOpacity').value;$('opacityOutput').textContent=layer.opacity+'%';scheduleRender()}};
$('layerUp').onclick=()=>moveLayer(1);$('layerDown').onclick=()=>moveLayer(-1);$('deleteLayer').onclick=()=>removeLayer();
$('duplicateLayer').onclick=()=>{syncLayers();const layer=selectedLayer();if(!layer)return;const copy={...layer,id:uid(),name:layer.name+' copy',cache:null,cacheKey:null};if(layer.type==='chat'){copy.settings={...layer.settings};copy.hidden=[...layer.hidden];copy.pos={x:(layer.pos||layer.origin||{x:28}).x+15,y:(layer.pos||layer.origin||{y:28}).y+15}}else{copy.x+=15;copy.y+=15}layers.splice(layers.indexOf(layer)+1,0,copy);selectLayer(copy.id,false)};
$('remove').onclick=()=>{if(imageLayer())removeLayer(imageLayerId);else status('Select an image layer to remove.')};
function hitLayer(layer,p){if(!layer.visible||layer.opacity===0)return false;const b=layer.type==='image'?imageBounds(layer):layer.bounds;return b&&p.x>=b.x-4&&p.y>=b.y-4&&p.x<=b.x+b.width+4&&p.y<=b.y+b.height+4}
function updateChatOutline(){const box=$('chatDragOutline'),layer=selectedLayer();box.hidden=!(drag&&layer?.type==='chat');if(box.hidden)return;const b=layer.bounds;box.style.left=(b.x-6)/canvas.width*100+'%';box.style.top=(b.y-6)/canvas.height*100+'%';box.style.width=(b.width+12)/canvas.width*100+'%';box.style.height=(b.height+12)/canvas.height*100+'%';}
function beginLayerDrag(){
 clearTimeout(jpegPreviewTimer);++jpegPreviewRevision;$('jpegPreview').hidden=true;
 const layer=selectedLayer(),index=layers.indexOf(layer),ratio=Math.min(1,1600/Math.max(canvas.width,canvas.height));
 for(const [id,group]of [['dragBelow',layers.slice(0,index)],['dragMoving',[layer]],['dragAbove',layers.slice(index+1)]]){const out=$(id);out.width=Math.round(canvas.width*ratio);out.height=Math.round(canvas.height*ratio);out.style.transform='none';const c=out.getContext('2d');c.scale(ratio,ratio);if(id==='dragBelow'&&!$('transparent').checked){c.fillStyle=$('bg').value;c.fillRect(0,0,canvas.width,canvas.height)}group.forEach(l=>paintLayer(c,l));}
 $('backgroundDragLayer').hidden=false;canvas.style.opacity='0';updateChatOutline();
}
canvas.onpointerdown=e=>{
 if(e.button!==0)return;if(renderFrame!==null){cancelAnimationFrame(renderFrame);renderFrame=null;render()}
 const r=canvas.getBoundingClientRect(),p={x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height},mode=$('dragMode').value;
 let target;
 if(mode==='auto'){target=[...layers].reverse().find(l=>hitLayer(l,p));}
 else{const type=mode==='text'?'chat':'image';target=[...layers].reverse().find(l=>l.type===type&&hitLayer(l,p));}
 if(!target)return;selectLayer(target.id);$('stage').focus({preventScroll:true});
 const origin=target.type==='image'?{x:target.x,y:target.y}:target.pos||target.origin;
 drag={id:target.id,mode:target.type==='chat'?'text':'background',x:e.clientX,y:e.clientY,px:origin.x,py:origin.y,s:canvas.width/r.width};canvas.setPointerCapture(e.pointerId);beginLayerDrag();
};
canvas.onpointermove=e=>{if(!drag)return;drag.dx=(e.clientX-drag.x)*drag.s;drag.dy=(e.clientY-drag.y)*drag.s;const transform='translate3d('+(drag.dx/drag.s)+'px,'+(drag.dy/drag.s)+'px,0)';$('dragMoving').style.transform=transform;if(drag.mode==='text')$('chatDragOutline').style.transform=transform;};
function finishLayerDrag(){if(!drag)return;const layer=layers.find(l=>l.id===drag.id);if(layer){if(layer.type==='image'){$('backgroundX').value=Math.round(drag.px+(drag.dx||0));$('backgroundY').value=Math.round(drag.py+(drag.dy||0))}else pos={x:Math.round(drag.px+(drag.dx||0)),y:Math.round(drag.py+(drag.dy||0))};}drag=null;render();canvas.style.opacity='1';$('backgroundDragLayer').hidden=true;$('chatDragOutline').style.transform='none';updateChatOutline();}
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=finishLayerDrag;
function handleLayerWheel(e){if(document.activeElement!==$('stage')||!e.deltaY)return;const layer=selectedLayer();if(layer?.type!=='image')return;e.preventDefault();$('backgroundZoom').value=Math.max(10,Math.min(500,Math.round((+$('backgroundZoom').value||100)*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.0015))));scheduleRender();}
(async()=>{try{const saved=JSON.parse(localStorage.getItem('chatlog-studio'));if(saved?.version===2){await openLayerProject(saved);status('Draft restored. Re-add image layers from files, or open a saved project.');return}if(saved)load(saved);else $('text').value=sample;}catch{$('text').value=sample}
 const initial={id:uid(),type:'chat',name:'Chat 1',visible:true,opacity:100,settings:chatSettings(),pos:null,hidden:[]};layers=[initial];chatLayerId=initial.id;selectLayer(initial.id,false);exportUI();})();

$('text').addEventListener('pointerdown',()=>{
 if(selectedLayer()?.type==='chat')return;
 const chat=chatLayer()||layers.find(layer=>layer.type==='chat');
 if(chat)selectLayer(chat.id);else newChat();
 $('text').readOnly=false;
});
$('text').addEventListener('focus',()=>{
 if(selectedLayer()?.type==='chat')return;
 const chat=chatLayer()||layers.find(layer=>layer.type==='chat');
 if(chat)selectLayer(chat.id);else newChat();
 $('text').readOnly=false;
});
$('exportChoice').onchange=()=>{
 const value=$('exportChoice').value;
 $('exportFormat').value=value==='png'?'png':'jpeg';
 if(value!=='png')$('jpegQuality').value=value.slice(5);
 exportUI();
};
function updateSquareSliders(){document.querySelectorAll('input[type=range]').forEach(input=>{const min=Number(input.min)||0,max=Number(input.max)||100,value=Number(input.value);input.style.setProperty('--fill',((value-min)/(max-min)*100)+'%')})}
document.addEventListener('input',updateSquareSliders);
new MutationObserver(updateSquareSliders).observe($('opacityOutput'),{childList:true});
updateSquareSliders();
