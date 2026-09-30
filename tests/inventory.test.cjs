const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)};
const context=vm.createContext({console,window:{},localStorage:{getItem:()=>null},Date,Intl});
vm.runInContext(fs.readFileSync(path.join(root,'js/datos.js'),'utf8'),context);
const call=(expr)=>vm.runInContext(expr,context);
test('Todas las páginas tienen JavaScript válido',()=>{for(const file of fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.html'))){const html=fs.readFileSync(path.join(root,file),'utf8');for(const match of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1],{filename:file});}});
test('Compatibilidad de stock antiguo',()=>assert.equal(call("stockEnViales({stock_cajas:2,viales_por_caja:10,stock_viales:3})"),23));
test('Venta normaliza existencias y resta unidades',()=>assert.equal(call("(()=>{const l={stock_cajas:2,viales_por_caja:10,stock_viales:3};venderVial(l,14);return JSON.stringify(l)})()"),'{"stock_cajas":0,"viales_por_caja":10,"stock_viales":9,"costo_por_vial":0,"precio_venta_vial":0}'));
test('Stock insuficiente no modifica el lote',()=>assert.equal(call("(()=>{const l={stock_cajas:1,viales_por_caja:10,stock_viales:2};const before=JSON.stringify(l);try{venderVial(l,13)}catch{}return JSON.stringify(l)===before})()"),true));
for(const n of [0,-1,1.5,Infinity,NaN])test('Rechaza cantidad inválida '+n,()=>assert.throws(()=>call('venderVial({stock_cajas:2,viales_por_caja:10,stock_viales:3},'+String(n)+')')));
test('Reversión histórica conserva 20 unidades',()=>assert.equal(call("(()=>{const l={stock_cajas:2,stock_viales:0};venderCaja(l,1);revertirStock(l,'caja',1);return stockEnViales(l)})()"),20));
test('Lote vencido tiene alerta crítica',()=>assert.equal(call("estadoLote({fecha_caducidad:'2020-01-01',stock_cajas:2,viales_por_caja:10})"),'brick'));
test('Fecha inválida no rompe cálculo',()=>assert.equal(call("diasHasta('invalid')"),Infinity));
test('Promoción respeta descuento manual',()=>assert.equal(call("calcularPromocion([{subtotal:100},{subtotal:300}],10).descuentoTotal"),40));
test('Promoción cero no aplica',()=>assert.equal(call("calcularPromocion([{subtotal:100}],0).aplica"),false));
for(const n of [-1,101])test('Descuento inválido '+n,()=>assert.throws(()=>call('calcularPromocion([{subtotal:100}],'+n+')')));
test('Ventas canceladas quedan fuera',()=>assert.equal(call("ventasActivas([{id:1},{id:2,cancelada:true}]).length"),1));
test('Popularidad sin ventas evita división cero',()=>assert.equal(call("popularidadProductos([{id:'l',producto_nombre:'BPC'}],[])[0].max"),1));
test('Comisión específica de categoría',()=>assert.equal(call("comisionVendedor([{lote_id:'l',cantidad:1,precio_vendido:100,vendedor_id:'v'}],{id:'v',comision_pct:5,comisiones_categoria:{Peptidos:10}},[],[{id:'l',producto_id:'p'}],[{id:'p',categoria:'Peptidos'}]).comision"),10));
test('Busqueda sin acentos',()=>assert.equal(call("normalizarBusqueda('PÉPTIDO')"),'peptido'));
test('Escape de texto',()=>assert.equal(call("escaparHTML('<script>')"),'&lt;script&gt;'));
test('Popularidad convierte cajas a viales',()=>assert.equal(call("popularidadProductos([{id:'l',producto_nombre:'BPC',viales_por_caja:10}],[{lote_id:'l',tipo_venta:'caja',cantidad:1},{lote_id:'l',tipo_venta:'vial',cantidad:2}])[0].unidades"),12));
test('Ticket agrupa líneas de la misma venta',()=>assert.equal(call("calcularKPIs({lotes:[],ventas:[{id:'a',grupo_id:'g',fecha:new Date().toISOString(),precio_vendido:100},{id:'b',grupo_id:'g',fecha:new Date().toISOString(),precio_vendido:200}]}).ticketPromedio"),300));
test('Compra: 3 cajas son 30 unidades a costo unitario',()=>assert.equal(call("JSON.stringify(compraAUnidades(3,1200,10))"),'{"unidades":30,"costoUnitario":108}'));
test('Normalización de lotes es idempotente',()=>assert.equal(call("(()=>{const l={stock_cajas:2,stock_viales:3,viales_por_caja:10};return normalizarLote(normalizarLote(l)).stock_viales})()"),23));
test('Historial conserva importe al convertir cajas',()=>assert.equal(call("(()=>{const v=normalizarVentas([{tipo_venta:'caja',lote_id:'l',cantidad:2,precio_vendido:500}],[{id:'l',viales_por_caja:10}])[0];return v.cantidad===20&&v.precio_vendido===500})()"),true));
test('Consignación antigua se convierte una sola vez',()=>assert.equal(call("(()=>{const c=normalizarConsignaciones([{tipo:'caja',lote_id:'l',cantidad_entregada:2,cantidad_pendiente:1}],[{id:'l',viales_por_caja:10}]);return normalizarConsignaciones(c,[])[0].cantidad_pendiente})()"),10));
test('Datos JSON válidos',()=>{for(const file of fs.readdirSync(path.join(root,'data')))if(file.endsWith('.json'))JSON.parse(fs.readFileSync(path.join(root,'data',file),'utf8'));});
test('Referencias conservadas y proveedor Camila',()=>{
 const lots=JSON.parse(fs.readFileSync(path.join(root,'data/lotes.json'),'utf8'));
 const providers=JSON.parse(fs.readFileSync(path.join(root,'data/proveedores.json'),'utf8'));
 const ids=new Set(lots.map(l=>l.id));
 assert.equal(providers.length,1);assert.equal(providers[0].nombre,'Camila');
 for(const l of lots){assert.equal(l.proveedor_id,providers[0].id);assert.equal(l.stock_cajas||0,0)}
 for(const file of ['ventas','consignaciones'])for(const row of JSON.parse(fs.readFileSync(path.join(root,'data',file+'.json'),'utf8')))assert.ok(ids.has(row.lote_id));
});
(async()=>{
 const tx=fs.readFileSync(path.join(root,'js/transacciones.js'),'utf8');
 const requests=[];let failRef=false;
 const mock=async(url,opts)=>{
  requests.push({url,opts});
  let response={};
  if(url.endsWith('/git/ref/heads/main'))response={object:{sha:'head'}};
  else if(url.endsWith('/git/commits/head'))response={tree:{sha:'tree'}};
  else if(url.includes('/git/trees/tree?'))response={tree:[{path:'data/lotes.json',sha:'original'},{path:'data/ventas.json',sha:'sales'}]};
  else if(url.endsWith('/git/blobs'))response={sha:'newblob'};
  else if(url.endsWith('/git/trees'))response={sha:'newtree',tree:[{path:'data/lotes.json',sha:'newstock'},{path:'data/ventas.json',sha:'newsales'}]};
  else if(url.endsWith('/git/commits'))response={sha:'newcommit'};
  return {ok:!(failRef&&opts.method==='PATCH'),status:failRef&&opts.method==='PATCH'?422:200,json:async()=>response};
 };
 const ctx=vm.createContext({fetch:mock,console});vm.runInContext(tx,ctx);
 await vm.runInContext("ghGuardarAtomico({'data/lotes.json':[],'data/ventas.json':[]},'test','synthetic-test-only',{'data/lotes.json':'original','data/ventas.json':'sales'})",ctx);
 assert.equal(requests.filter(r=>r.opts.method==='PATCH').length,1);
 const treeRequest=requests.find(r=>r.url.endsWith('/git/trees')&&r.opts.method==='POST');
 assert.equal(JSON.parse(treeRequest.opts.body).tree.length,2);
 console.log('PASS Venta y stock en un único commit');passed++;
 requests.length=0;
 await assert.rejects(vm.runInContext("ghGuardarAtomico({'data/lotes.json':[]},'test','synthetic-test-only',{'data/lotes.json':'stale'})",ctx));
 assert.equal(requests.some(r=>r.opts.method==='PATCH'),false);console.log('PASS Bloquea datos obsoletos sin escribir');passed++;
 requests.length=0;failRef=true;
 await assert.rejects(vm.runInContext("ghGuardarAtomico({'data/lotes.json':[]},'test','synthetic-test-only',{'data/lotes.json':'original'})",ctx));
 assert.equal(JSON.parse(requests.find(r=>r.opts.method==='PATCH').opts.body).force,false);console.log('PASS Conflicto concurrente no fuerza actualización');passed++;
 for(const consignacion of [true,false]){
   let saved;
   const elements = new Map();const element=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',classList:{add(){},remove(){}}});return elements.get(id)};
   const cancelContext=vm.createContext({console,Date,confirm:()=>true,alert:msg=>{throw new Error(msg)},document:{getElementById:element},localStorage:{getItem:()=> 'synthetic-test-only'}});
   vm.runInContext(fs.readFileSync(path.join(root,'js/datos.js'),'utf8'),cancelContext);
   const html=fs.readFileSync(path.join(root,'ventas/index.html'),'utf8');
   const inline=[...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)][0][1].replace('if(ensureToken()) init();','');
   vm.runInContext(inline,cancelContext);
   cancelContext.ghGuardarAtomico=async changes=>{saved=changes};
   cancelContext.ghGetRaw=async()=>[{id:'c',cantidad_pendiente:2}];
   vm.runInContext("ventas=[{id:'v',lote_id:'l',producto_nombre:'Prueba',cantidad:2,tipo_venta:'vial',origen:"+(consignacion?"'consignacion'":"'bodega'")+",consignacion_id:'c'}];lotes=[{id:'l',stock_viales:3,stock_cajas:1,viales_por_caja:10}];",cancelContext);
   await vm.runInContext('cancelarVenta(0)',cancelContext);
   assert.equal(saved['data/ventas.json'][0].cancelada,true);
   if(consignacion){assert.equal(saved['data/consignaciones.json'][0].cantidad_pendiente,4);assert.equal(saved['data/lotes.json'],undefined)}
   else assert.equal(saved['data/lotes.json'][0].stock_viales,15);
   console.log('PASS Cancelación devuelve a '+(consignacion?'consignación':'bodega'));passed++;
 }
 console.log(passed+' comprobaciones superadas.');
})().catch(e=>{console.error(e);process.exitCode=1});

