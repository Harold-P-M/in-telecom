const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let DB={clases:[],equipos:[],stock:{},ordenes:[],seq:1};
let view='stock',hist='eq',ftec='',eqClase=0,maClase=0;
const NAV=[['stock','Stock'],['clases','Clases'],['equipos','Equipos'],['material','Material'],['legalizar','Legalizar'],['historial','Historial']];

/* Base de datos en el celular (IndexedDB): guarda todo el inventario en un solo registro */
let _d;
const idb=()=>_d||(_d=new Promise((ok,ko)=>{const r=indexedDB.open('in-telecom',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)}));
const kv=async(mode,fn)=>{const d=await idb();return new Promise((ok,ko)=>{const t=d.transaction('kv',mode);const q=fn(t.objectStore('kv'));t.oncomplete=()=>ok(q&&q.result);t.onerror=()=>ko(t.error)})};
const load=async()=>{const v=await kv('readonly',s=>s.get('db'));if(v)DB=v};
const save=()=>kv('readwrite',s=>s.put(DB,'db'));

function toast(m,err){const t=$('#toast');t.textContent=m;t.className='show'+(err?' err':'');clearTimeout(toast.t);toast.t=setTimeout(()=>t.className='',3200)}
/* Todo o nada: si algo falla, se deshace el cambio completo */
async function commit(fn,msg){const bak=JSON.stringify(DB);try{fn();await save();if(msg)toast(msg);return true}catch(e){DB=JSON.parse(bak);toast(e.message||'No se pudo guardar',true);return false}}

const cl=id=>DB.clases.find(c=>c.id==id);
const nm=c=>c?c.nombre+' ('+c.tec+')':'(clase borrada)';
const fdate=i=>new Date(i).toLocaleDateString('es-CO');
const empty=t=>`<p class="mut">${t}</p>`;
const opt=(l,s)=>l.map(c=>`<option value="${c.id}"${c.id==s?' selected':''}>${esc(c.nombre)} (${esc(c.tec)})</option>`).join('');
const normMac=m=>{if(!/^[0-9a-f:.\- ]+$/i.test(m))return null;const h=m.replace(/[^0-9a-f]/gi,'').toUpperCase();return h.length==12?h.match(/../g).join(':'):null};

const V={};
V.stock=()=>{
 const tecs=[...new Set(DB.clases.map(c=>c.tec))];
 const cs=DB.clases.filter(c=>!ftec||c.tec==ftec);
 const eq=cs.filter(c=>c.tipo=='equipo').map(c=>{const l=DB.equipos.filter(e=>e.claseId==c.id&&e.estado=='stock');
  return `<details class="card"><summary><span><b>${esc(c.nombre)}</b> <span class="tag">${esc(c.tec)}</span></span><span class="n">${l.length}</span></summary>${l.map(e=>`<div class="row"><span>Serial: ${esc(e.serial)}<br>MAC: ${esc(e.mac)}</span><button class="lk" data-act="delEq" data-id="${e.id}">Borrar</button></div>`).join('')||empty('Sin equipos en stock.')}</details>`}).join('');
 const ma=cs.filter(c=>c.tipo=='material').map(c=>`<div class="card row"><span><b>${esc(c.nombre)}</b> <span class="tag">${esc(c.tec)}</span></span><span class="n">${DB.stock[c.id]||0} <small>${c.unidad}</small></span></div>`).join('');
 if(!DB.clases.length)return `<h2>Stock</h2>${empty('Aún no hay nada. Empieza creando una clase en la pestaña Clases.')}`;
 return `<h2>Stock</h2><select id="ftec"><option value="">Todas las tecnologías</option>${tecs.map(t=>`<option${t==ftec?' selected':''}>${esc(t)}</option>`).join('')}</select><h3>Equipos</h3>${eq||empty('No hay clases de equipos.')}<h3>Materiales</h3>${ma||empty('No hay clases de materiales.')}`;
};
V.clases=()=>`<h2>Clases</h2><form id="fCl" class="card"><label>Nombre y referencia<input name="nombre" required placeholder="Cable modem Arris ref X"></label><label>Tecnología<select name="tec"><option>HFC</option><option>G-PON</option></select></label><label>Tipo<select name="tipo"><option value="equipo">Equipo (con serial y MAC)</option><option value="material">Material (con cantidad)</option></select></label><label>Unidad (solo materiales)<select name="unidad"><option>unidades</option><option>metros</option></select></label><button class="pri">Guardar clase</button></form>${DB.clases.map(c=>`<div class="card row"><span><b>${esc(c.nombre)}</b><br><small>${esc(c.tec)}, ${c.tipo}${c.tipo=='material'?', en '+c.unidad:''}</small></span><button class="lk" data-act="delCl" data-id="${c.id}">Borrar</button></div>`).join('')}`;
V.equipos=()=>{
 const cs=DB.clases.filter(c=>c.tipo=='equipo');
 if(!cs.length)return `<h2>Equipos</h2>${empty('Primero crea una clase de tipo equipo en la pestaña Clases.')}`;
 if(!cs.some(c=>c.id==eqClase))eqClase=cs[0].id;
  const l=DB.equipos.filter(e=>e.claseId==eqClase&&e.estado=='stock').slice(-8).reverse();const c=cl(eqClase);
 return `<h2>Equipos</h2><form id="fEq" class="card"><label>Clase<select id="ecl">${opt(cs,eqClase)}</select></label><label>Serial<input id="serial" name="serial" required autocapitalize="characters" autocomplete="off"></label><label>MAC<input name="mac" required autocapitalize="characters" autocomplete="off"></label><button class="pri">Guardar equipo</button></form><h3>Últimos agregados</h3>${l.map(e=>`<div class="card"><b>${esc(c.nombre)}</b> <span class="tag">${esc(c.tec)}</span><br>Serial: ${esc(e.serial)}<br>MAC: ${esc(e.mac)}</div>`).join('')||empty('Aún no hay equipos de esta clase.')}`;
};
V.material=()=>{
 const cs=DB.clases.filter(c=>c.tipo=='material');
 if(!cs.length)return `<h2>Material</h2>${empty('Primero crea una clase de tipo material en la pestaña Clases.')}`;
 if(!cs.some(c=>c.id==maClase))maClase=cs[0].id;
  return `<h2>Material</h2><form id="fMa" class="card"><label>Clase<select id="mcl">${opt(cs,maClase)}</select></label><label>Cantidad a agregar (${cl(maClase).unidad})<input name="q" type="number" min="1" step="1" inputmode="numeric" required></label><button class="pri">Agregar al stock</button></form><h3>Stock actual</h3>${cs.map(c=>`<div class="card row"><span><b>${esc(c.nombre)}</b> <span class="tag">${esc(c.tec)}</span></span><span class="n">${DB.stock[c.id]||0} <small>${c.unidad}</small></span></div>`).join('')}`;
};
V.legalizar=()=>{
 const eq=DB.equipos.filter(e=>e.estado=='stock');
 const ma=DB.clases.filter(c=>c.tipo=='material'&&(DB.stock[c.id]||0)>0);
 return `<h2>Legalizar orden</h2><form id="fLe"><div class="card"><label>Tarea<input name="tarea" required></label><label>Pedido<input name="pedido" required></label><label>Dirección<input name="dir" required></label></div><h3>Equipos usados</h3><input class="srch" data-filter=".le" placeholder="Buscar por serial o clase">${eq.map(e=>`<label class="card chk le"><input type="checkbox" data-eq="${e.id}"><span>${esc(e.serial)}<br><small>${esc(nm(cl(e.claseId)))}</small></span></label>`).join('')||empty('No hay equipos en stock.')}<h3>Materiales usados</h3>${ma.map(c=>`<label class="card row"><span>${esc(c.nombre)}<br><small>Disponible: ${DB.stock[c.id]} ${c.unidad}</small></span><input class="q" type="number" min="0" max="${DB.stock[c.id]}" step="1" value="0" inputmode="numeric" data-mat="${c.id}"></label>`).join('')||empty('No hay materiales en stock.')}<button class="pri">Legalizar orden</button></form>`;
};
V.historial=()=>{
 const seg=`<div class="seg">${[['eq','Equipos'],['or','Órdenes'],['rs','Respaldo']].map(([k,t])=>`<button data-act="seg" data-h="${k}" class="${hist==k?'on':''}">${t}</button>`).join('')}</div>`;
 const srch=`<input class="srch" data-filter=".it" placeholder="Buscar serial, MAC, tarea, pedido o dirección">`;
 let b;
 if(hist=='eq'){
  const l=DB.equipos.filter(e=>e.estado=='legalizado').sort((a,b)=>b.fl.localeCompare(a.fl));
  b=srch+(l.map(e=>`<div class="card it"><b>${esc(e.serial)}</b>, ${esc(e.mac)}<br><small>${esc(nm(cl(e.claseId)))}, ${fdate(e.fl)}<br>Tarea ${esc(e.tarea)}, pedido ${esc(e.pedido)}<br>${esc(e.dir)}</small></div>`).join('')||empty('Aún no hay equipos legalizados.'));
 }else if(hist=='or'){
    b=srch+(DB.ordenes.slice().reverse().map(o=>`<details class="card it"><summary><span><b>Tarea ${esc(o.tarea)}</b>, pedido ${esc(o.pedido)}<br><small>${fdate(o.fecha)}, ${esc(o.dir)}</small></span></summary>${o.equipos.map(e=>`<div><small>${esc(e.clase)}: ${esc(e.serial)}, ${esc(e.mac)}</small></div>`).join('')}${o.materiales.map(m=>`<div><small>${esc(m.clase)}: ${m.q} ${m.u}</small></div>`).join('')}<label>Nota<textarea id="nota${o.id}" rows="3">${esc(o.nota||'')}</textarea></label><button class="pri" style="margin-bottom:8px" data-act="nota" data-id="${o.id}">Guardar nota</button><div class="row"><button class="lk" data-act="undoOr" data-id="${o.id}">Anular y devolver al stock</button><button class="lk" data-act="delOr" data-id="${o.id}">Borrar sin devolver</button></div></details>`).join('')||empty('Aún no hay órdenes legalizadas.'));
 }else{
  b=`<div class="card"><p>Tus datos viven solo en este celular. Si borras los datos de la app o la desinstalas, se pierden. Exporta un respaldo seguido y guárdalo en Drive o envíalo por WhatsApp.</p><button class="pri" data-act="exp">Exportar respaldo</button><label class="btn">Importar respaldo<input type="file" id="imp" accept=".json,application/json" hidden></label></div><p class="mut">${DB.clases.length} clases, ${DB.equipos.length} equipos, ${DB.ordenes.length} órdenes.</p>`;
 }
 return `<h2>Historial</h2>${seg}${b}`;
};

function render(){
 $('#app').innerHTML=V[view]();
 $('#nav').innerHTML=NAV.map(([k,t])=>`<button data-act="nav" data-v="${k}" class="${k==view?'on':''}">${t}</button>`).join('');
}

function exportar(){
 const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(DB)],{type:'application/json'}));
 a.download='in-telecom-respaldo-'+new Date().toISOString().slice(0,10)+'.json';
 a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}
async function importar(f){
 if(!f)return;let d;
 try{d=JSON.parse(await f.text());if(!Array.isArray(d.clases)||!Array.isArray(d.equipos)||!Array.isArray(d.ordenes)||typeof d.stock!='object'||typeof d.seq!='number')throw 0}
 catch(e){return toast('El archivo no es un respaldo válido',true)}
 if(!confirm('Esto reemplaza TODO el inventario actual. ¿Continuar?'))return;
 if(await commit(()=>{DB=d},'Respaldo importado'))render();
}

document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-act]');if(!b)return;
 const a=b.dataset.act,id=Number(b.dataset.id);
 if(a!='menu')$('#menu').hidden=true;
 if(a=='nav'){view=b.dataset.v;render();scrollTo(0,0)}
 else if(a=='seg'){hist=b.dataset.h;render()}
 else if(a=='exp')exportar();
 else if(a=='delEq'){if(confirm('¿Borrar este equipo del stock?')&&await commit(()=>{DB.equipos=DB.equipos.filter(x=>x.id!=id)},'Equipo borrado'))render()}
 else if(a=='delCl'){if(confirm('¿Borrar esta clase?')&&await commit(()=>{
   if(DB.equipos.some(x=>x.claseId==id)||(DB.stock[id]||0)>0)throw new Error('La clase tiene equipos o stock; no se puede borrar');
   DB.clases=DB.clases.filter(c=>c.id!=id);delete DB.stock[id]},'Clase borrada'))render()}
 else if(a=='undoOr'){if(confirm('¿Anular esta orden? Los equipos y materiales vuelven al stock.')&&await commit(()=>{
   const o=DB.ordenes.find(x=>x.id==id);
   const back=o.materiales.map(m=>({c:m.cid?cl(m.cid):DB.clases.find(c=>nm(c)==m.clase),q:m.q}));
   if(back.some(m=>!m.c))throw new Error('Una clase de material ya no existe; usa Borrar sin devolver');
   back.forEach(m=>{DB.stock[m.c.id]=(DB.stock[m.c.id]||0)+m.q});
   DB.equipos.filter(e=>e.ordenId==id).forEach(e=>{e.estado='stock';['ordenId','fl','tarea','pedido','dir'].forEach(k=>delete e[k])});
   DB.ordenes=DB.ordenes.filter(x=>x.id!=id)},'Orden anulada'))render()}
 else if(a=='delOr'){if(confirm('¿Borrar esta orden y sus equipos? Nada vuelve al stock.')&&await commit(()=>{
   DB.equipos=DB.equipos.filter(e=>e.ordenId!=id);
   DB.ordenes=DB.ordenes.filter(x=>x.id!=id)},'Orden borrada'))render()}
  else if(a=='nota'){const t=$('#nota'+id).value.trim();await commit(()=>{DB.ordenes.find(x=>x.id==id).nota=t},'Nota guardada')}
  else if(a=='menu')$('#menu').hidden=!$('#menu').hidden;
  else if(a=='reset'){if(prompt('Esto borra TODO el inventario y las órdenes. Si quieres conservarlo, cancela y exporta un respaldo primero. Para continuar escribe BORRAR')==='BORRAR'&&await commit(()=>{DB={clases:[],equipos:[],stock:{},ordenes:[],seq:1}},'Inventario restablecido')){view='stock';render()}}
});
document.addEventListener('change',e=>{
 const t=e.target;
 if(t.id=='ftec'){ftec=t.value;render()}
 else if(t.id=='ecl'){eqClase=Number(t.value);render()}
 else if(t.id=='mcl'){maClase=Number(t.value);render()}
 else if(t.id=='imp')importar(t.files[0]);
});
document.addEventListener('input',e=>{
 const f=e.target.dataset.filter;if(!f)return;
 const q=e.target.value.toLowerCase();
 $$(f).forEach(el=>el.hidden=!el.textContent.toLowerCase().includes(q));
});
document.addEventListener('submit',async e=>{
 e.preventDefault();
 const f=e.target,v=Object.fromEntries(new FormData(f));
 if(f.id=='fCl'){
  const n=v.nombre.trim(),tec=v.tec.trim().toUpperCase();
  if(await commit(()=>{
   if(DB.clases.some(c=>c.nombre.toLowerCase()==n.toLowerCase()&&c.tec==tec))throw new Error('Esa clase ya existe');
   DB.clases.push({id:DB.seq++,nombre:n,tec,tipo:v.tipo,unidad:v.tipo=='material'?v.unidad:'unidades'})},'Clase guardada'))render();
 }else if(f.id=='fEq'){
  const s=v.serial.trim().toUpperCase();
  if(await commit(()=>{
   const mac=v.mac.trim().toUpperCase();
   if(DB.equipos.some(x=>x.serial==s))throw new Error('Ese serial ya está registrado');
   DB.equipos.push({id:DB.seq++,claseId:eqClase,serial:s,mac,estado:'stock'})},'Equipo guardado')){render();$('#serial').focus()}
 }else if(f.id=='fMa'){
  const q=Number(v.q);
  if(await commit(()=>{
   if(!Number.isInteger(q)||q<1)throw new Error('La cantidad debe ser un entero mayor a 0');
   DB.stock[maClase]=(DB.stock[maClase]||0)+q},'Material agregado'))render();
 }else if(f.id=='fLe'){
  if(await commit(()=>{
   const eqs=$$('[data-eq]:checked').map(x=>DB.equipos.find(q=>q.id==x.dataset.eq));
   const mats=$$('[data-mat]').map(i=>({c:cl(i.dataset.mat),q:Number(i.value||0)})).filter(m=>m.q!=0);
   if(!eqs.length&&!mats.length)throw new Error('Selecciona al menos un equipo o un material');
   for(const m of mats){
    if(!Number.isInteger(m.q)||m.q<0)throw new Error('Las cantidades deben ser enteros');
    if(m.q>(DB.stock[m.c.id]||0))throw new Error('No alcanza el stock de '+m.c.nombre)}
   const fecha=new Date().toISOString();
   const o={id:DB.seq++,fecha,tarea:v.tarea.trim(),pedido:v.pedido.trim(),dir:v.dir.trim(),
    equipos:eqs.map(e=>({clase:nm(cl(e.claseId)),serial:e.serial,mac:e.mac})),
    materiales:mats.map(m=>({cid:m.c.id,clase:nm(m.c),q:m.q,u:m.c.unidad}))};
   eqs.forEach(e=>Object.assign(e,{estado:'legalizado',ordenId:o.id,fl:fecha,tarea:o.tarea,pedido:o.pedido,dir:o.dir}));
   mats.forEach(m=>{DB.stock[m.c.id]-=m.q});
   DB.ordenes.push(o)},'Orden legalizada')){view='historial';hist='or';render();scrollTo(0,0)}
 }
});

(async()=>{
 try{await load()}catch(e){toast('No se pudo abrir la base de datos',true)}
 if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();
 render();
 if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
})();
