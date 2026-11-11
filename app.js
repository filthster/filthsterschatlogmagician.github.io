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
const ids=['wrapWidth','exportFormat','jpegQuality','jpegMatte','backgroundX','backgroundY','dragMode','backgroundZoom','character','text','timestamps','font','size','width','height','spacing','outline','padding','bold','transparent',...Object.keys(colors)];
let image=null,imageData=null,pos=null,hidden=new Set(),drawn=[],drag=null;
let jpegPreviewTimer=null,jpegPreviewRevision=0,jpegPreviewURL=null,jpegPreviewBusy=false,draftTimer=null,renderFrame=null;
const types=Object.keys(colors).filter(x=>x!=='bg');
for(const type of types){let l=document.createElement('label'),i=document.createElement('input');i.type='checkbox';i.checked=true;i.addEventListener('change',()=>{i.checked?hidden.delete(type):hidden.add(type);render()});l.append(i,document.createTextNode(colors[type][0]));$('filters').append(l)}
function state(){return {...Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:$(id).value])),paletteVersion:2}}
function status(s){$('status').textContent=s}
function load(s){for(const id of ids)if(s[id]!==undefined){if($(id).type==='checkbox')$(id).checked=!!s[id];else $(id).value=s[id]}}
function classify(text){
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
function render(){let w=Math.max(80,Math.min(6000,+$('width').value||1100)),pad=Math.max(0,+$('padding').value||0),size=+$('size').value,gap=Math.max(0,+$('spacing').value||0);let raw=$('text').value,redacting=false;let lines=raw?raw.split(/\r?\n/).map(line=>{const parsed=parse(line.replace(/\t/g,'    '));parsed.redactStart=redacting;if((line.match(/÷/g)||[]).length%2)redacting=!redacting;return parsed;}).filter(line=>!line.text.trim()||!hidden.has(line.type)):[];const wrap=Math.max(10,Math.min(100,+$('wrapWidth').value||100));drawn=layout(lines,Math.max(1,(w-pad*2)*wrap/100));$('wrapOutput').textContent=wrap+'%';let h=Math.max(80,pad*2+drawn.length*(size+gap));let fixedHeight=+$('height').value;canvas.width=w;canvas.height=fixedHeight?Math.max(80,Math.min(6000,fixedHeight)):image?Math.round(image.height*w/image.width):h;ctx.clearRect(0,0,canvas.width,canvas.height);if(image){let fit=Math.max(canvas.width/image.width,canvas.height/image.height);let zoom=Math.max(0.1,Math.min(5,(+$('backgroundZoom').value||100)/100));let iw=image.width*fit*zoom,ih=image.height*fit*zoom;ctx.drawImage(image,(canvas.width-iw)/2+(+$('backgroundX').value||0),(canvas.height-ih)/2+(+$('backgroundY').value||0),iw,ih);}else if(!$('transparent').checked){ctx.fillStyle=$('bg').value;ctx.fillRect(0,0,canvas.width,canvas.height)}ctx.font=font();ctx.textBaseline='top';ctx.lineJoin='round';let origin=pos||{x:pad,y:pad};ctx.lineWidth=+$('outline').value*2;ctx.strokeStyle='#000';drawn.forEach((row,i)=>row.forEach(seg=>{let x=origin.x+seg.x,y=origin.y+i*(size+gap);paintChatSegment(ctx,seg,x,y,size)}));$('count').textContent=lines.length+' lines';$('dimensions').textContent=canvas.width+' × '+canvas.height+' px';$('sizeout').textContent=size+' px';$('empty').hidden=lines.length>0||!!image;canvas.style.display=lines.length||image?'block':'none';saveDraft();updateChatOutline();queueJPEGPreview();}
function saveDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>{try{localStorage.setItem('chatlog-studio',JSON.stringify(state()))}catch{}},300)}
function scheduleRender(){if(renderFrame!==null)return;renderFrame=requestAnimationFrame(()=>{renderFrame=null;render()})}
ids.filter(id=>!['exportFormat','jpegQuality','jpegMatte'].includes(id)).forEach(id=>$(id).addEventListener('input',scheduleRender));
$('jpegMatte').addEventListener('input',()=>{queueJPEGPreview();saveDraft()});
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
 const revision=++jpegPreviewRevision,preview=$('jpegPreview');
 clearTimeout(jpegPreviewTimer);
 if($('exportFormat').value!=='jpeg'||(!drawn.length&&!image)){
 preview.hidden=true;preview.removeAttribute('src');
 if(jpegPreviewURL){URL.revokeObjectURL(jpegPreviewURL);jpegPreviewURL=null}return;
 }
 jpegPreviewTimer=setTimeout(()=>{
 if(jpegPreviewBusy){queueJPEGPreview();return}
 jpegPreviewBusy=true;
 const out=exportCanvas(true,true),quality=jpegLevel($('jpegQuality').value);
 out.toBlob(blob=>{
 jpegPreviewBusy=false;
 if(!blob||revision!==jpegPreviewRevision)return;
 const url=URL.createObjectURL(blob),decoded=new Image();
 decoded.onload=()=>{
 if(revision!==jpegPreviewRevision){URL.revokeObjectURL(url);return}
 if(jpegPreviewURL)URL.revokeObjectURL(jpegPreviewURL);
 jpegPreviewURL=url;preview.src=url;preview.hidden=false;
 $('exportHint').textContent='JPEG · quality '+quality+'/12 · '+(blob.size/1024).toFixed(1)+' KB preview';
 };
 decoded.onerror=()=>URL.revokeObjectURL(url);decoded.src=url;
 },'image/jpeg',quality/12);
 },120);
}
$('scale').addEventListener('change',queueJPEGPreview);
function jpegLevel(value){return Math.max(0,Math.min(12,Math.round(Number(value)||0)))}
function exportUI(){
 const jpeg=$('exportFormat').value==='jpeg',q=jpegLevel($('jpegQuality').value);
 const tier=q<=4?'Low':q<=7?'Medium':q<=9?'High':'Maximum';
 $('jpegOptions').hidden=!jpeg;$('jpegSlider').value=q;$('qualityLabel').textContent=q+' · '+tier.toUpperCase();
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
 if(!drawn.length&&!image)return status('Add some chat lines first.');
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
 const origin=pos||{x:+$('padding').value||0,y:+$('padding').value||0};
 box.style.left=((origin.x-margin)/canvas.width*100)+'%';
 box.style.top=((origin.y-margin)/canvas.height*100)+'%';
 box.style.width=((width+margin*2)/canvas.width*100)+'%';
 box.style.height=(((drawn.length-1)*step+size+margin*2)/canvas.height*100)+'%';
}
function hitChat(point){
 const origin=pos||{x:+$('padding').value||0,y:+$('padding').value||0};
 const size=+$('size').value,step=size+(+$('spacing').value||0),margin=5;
 ctx.font=font();
 return drawn.some((row,i)=>{
 const width=row.reduce((max,seg)=>Math.max(max,seg.x+ctx.measureText(seg.text).width),0);
 return width>0&&point.x>=origin.x-margin&&point.x<=origin.x+width+margin&&point.y>=origin.y+i*step-margin&&point.y<=origin.y+i*step+size+margin;
 });
}
function startBackgroundDrag(){
 clearTimeout(jpegPreviewTimer);++jpegPreviewRevision;$('jpegPreview').hidden=true;
 if(renderFrame!==null){cancelAnimationFrame(renderFrame);renderFrame=null}
 const bg=$('dragBackground'),chat=$('dragChat'),layer=$('backgroundDragLayer');
 const fit=Math.max(canvas.width/image.width,canvas.height/image.height)*(+$('backgroundZoom').value||100)/100;
 const iw=image.width*fit,ih=image.height*fit;
 bg.src=imageData;bg.style.width=(iw/canvas.width*100)+'%';bg.style.height=(ih/canvas.height*100)+'%';
 bg.style.left=(((canvas.width-iw)/2+drag.px)/canvas.width*100)+'%';
 bg.style.top=(((canvas.height-ih)/2+drag.py)/canvas.height*100)+'%';bg.style.transform='translate3d(0,0,0)';
 // Rasterize the stationary dialogue once. Pointer movement only transforms the image layer.
 const ratio=Math.min(1,1600/Math.max(canvas.width,canvas.height));
 chat.width=Math.round(canvas.width*ratio);chat.height=Math.round(canvas.height*ratio);
 const c=chat.getContext('2d');c.scale(ratio,ratio);c.font=font();c.textBaseline='top';c.lineJoin='round';c.lineWidth=+$('outline').value*2;c.strokeStyle='#000';
 const origin=pos||{x:+$('padding').value,y:+$('padding').value},step=+$('size').value+(+$('spacing').value||0);
 drawn.forEach((row,i)=>row.forEach(seg=>{const x=origin.x+seg.x,y=origin.y+i*step;paintChatSegment(c,seg,x,y,+$('size').value)}));
 layer.hidden=false;canvas.style.opacity='0';
}
function finishDrag(){
 if(!drag)return;
 const background=drag.mode==='background';
 if(background){$('backgroundX').value=Math.round(drag.nextX??drag.px);$('backgroundY').value=Math.round(drag.nextY??drag.py)}
 drag=null;canvas.style.cursor='grab';
 if(background){render();canvas.style.opacity='1';$('backgroundDragLayer').hidden=true}else updateChatOutline();
}
canvas.onpointerdown=e=>{
 $('stage').focus({preventScroll:true});if(e.button!==undefined&&e.button!==0)return;
 const r=canvas.getBoundingClientRect();let mode=$('dragMode').value;
 if(mode==='auto'){
 const point={x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
 mode=hitChat(point)?'text':'background';
 }
 if(mode==='background'&&!image)return;
 status(mode==='text'?'Moving chat text':'Moving background image');
 const p=mode==='background'?{x:+$('backgroundX').value||0,y:+$('backgroundY').value||0}:pos||{x:+$('padding').value,y:+$('padding').value};
 drag={mode,x:e.clientX,y:e.clientY,px:p.x,py:p.y,s:canvas.width/r.width};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';if(mode==='background')startBackgroundDrag();updateChatOutline();
};
canvas.onpointermove=e=>{
 if(!drag)return;
 const x=drag.px+(e.clientX-drag.x)*drag.s,y=drag.py+(e.clientY-drag.y)*drag.s;
 if(drag.mode==='background'){drag.nextX=x;drag.nextY=y;$('dragBackground').style.transform='translate3d('+((x-drag.px)/drag.s)+'px,'+((y-drag.py)/drag.s)+'px,0)';return;}
 else pos={x:Math.max(0,Math.min(canvas.width-30,x)),y:Math.max(0,Math.min(canvas.height-20,y))};
 scheduleRender();
};
canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=finishDrag;
$('resetBackground').onclick=()=>{$('backgroundX').value=0;$('backgroundY').value=0;render();status('Background centered')};

$('stage').addEventListener('wheel',e=>{
 if(document.activeElement!==$('stage')||!image||!e.deltaY)return;
 e.preventDefault();
 const factor=Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*0.0015);
 $('backgroundZoom').value=Math.max(10,Math.min(500,Math.round((+$('backgroundZoom').value||100)*factor)));
 render();status('Background zoom: '+$('backgroundZoom').value+'% · Canvas: '+canvas.width+' × '+canvas.height+' px');
},{passive:false});
$('resetZoom').onclick=()=>{$('backgroundZoom').value=100;render();status('Background zoom reset to 100%')};

try{const saved=JSON.parse(localStorage.getItem('chatlog-studio'));if(saved)load(saved);else $('text').value=sample}catch{$('text').value=sample}
$('dragMode').value='auto';
if($('text').value.replaceAll('Eugene Bassanti','John Doe').replaceAll('John Kaminsky','Jane Doe')===sample)$('text').value=sample;
render();exportUI();
