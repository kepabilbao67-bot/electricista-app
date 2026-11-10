(function(){
const input=document.getElementById('fileInput');if(!input)return;
input.multiple=true;input.removeAttribute('accept');
const tray=document.createElement('section');tray.id='d360FileTray';tray.style.cssText='padding:12px;margin:12px 0;border:2px dashed #3b82f6;border-radius:10px';
const heading=document.createElement('strong');heading.textContent='Archivos cargados — arrastra aquí fotos, PDF, vídeos, audio u otros archivos';
const list=document.createElement('div');list.id='d360FileList';list.style.marginTop='8px';
tray.append(heading,list);document.querySelector('.filebox').insertAdjacentElement('afterend',tray);
const files=[];
function render(){list.replaceChildren();for(let i=0;i<files.length;i++){const f=files[i],item=document.createElement('div');item.style.cssText='display:flex;gap:8px;align-items:center;padding:4px;flex-wrap:wrap';const text=document.createElement('span');text.textContent=f.name+' ('+Math.ceil(f.size/1024)+' KB)';const open=document.createElement('button');open.textContent='Abrir';open.onclick=()=>displayFile(f);const download=document.createElement('button');download.textContent='Descargar original';download.onclick=()=>{const url=URL.createObjectURL(f),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};item.append(text,open,download);list.append(item)}}
async function add(list){const incoming=Array.from(list||[]).filter(f=>f instanceof File);if(!incoming.length)return;for(const f of incoming)files.push(f);render();await displayFile(incoming[0]);status(incoming.length+' archivo(s) añadidos. Selecciona Abrir para verlos.')}
input.addEventListener('change',e=>{e.stopImmediatePropagation();const selected=Array.from(e.target.files||[]);input.value='';add(selected)},true);
function drop(e){if(!e.dataTransfer?.files?.length)return;e.preventDefault();e.stopImmediatePropagation();add(e.dataTransfer.files)}
document.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault()},true);
document.addEventListener('drop',drop,true);
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='d360:add-files')return;if(Array.isArray(e.data.files))add(e.data.files)});
window.Documentos360AddFiles=add;
})();