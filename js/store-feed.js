/* Retail-only projection. Never include costs, suppliers, customers or credentials. */
(function(root){
function project(lots,today=new Date().toISOString().slice(0,10)){
 const map={prod_retatrutida:{10:'retatrutide-1',20:'retatrutide-2'},prod_terzipatida:{20:'tirzepatide-1',30:'tirzepatide-2'},'prod_ghk-cu':{50:'ghk-cu-1',100:'ghk-cu-2'},prod_klow:{80:'klow-1'},prod_semax:{10:'semax-1'},prod_selank:{10:'selank-1'},'prod_mots-c':{10:'mots-c-1'},prod_nad:{500:'nad-plus-1'},'prod_bpc-157':{20:'bpc-157-1'},'prod_bac-water-3ml':{0:'bac-water-3ml-1'},'prod_bac-water-10ml':{0:'bac-water-10ml-1'}};
 map.prod_ipamoreline={10:'ipamorelin-1'};
 const groups={};
 for(const l of lots){const id=map[l.producto_id]?.[Number(l.concentracion_mg||0)];if(!id)continue;(groups[id]??=[]).push(l);}
 const offers={};
 for(const [id,rows] of Object.entries(groups)){
  const valid=rows.filter(l=>!l.fecha_caducidad||l.fecha_caducidad>=today);
  const ordered=valid.map((l,index)=>({l,index})).sort((a,b)=>String(b.l.fecha_adquisicion||'').localeCompare(String(a.l.fecha_adquisicion||''))||b.index-a.index);
  const latest=ordered.find(({l})=>Number.isFinite(Number(l.precio_venta_vial))&&Number(l.precio_venta_vial)>0)?.l;
  const stock=valid.reduce((n,l)=>{const units=Number(l.stock_viales||0)+Number(l.stock_cajas||0)*(Number(l.viales_por_caja)||10);return n+(Number.isSafeInteger(units)&&units>0?units:0);},0);
  offers[id]={price:latest?Number(latest.precio_venta_vial):null,available:stock>0};
 }
 return {schema:1,currency:'MXN',updatedAt:new Date().toISOString(),offers};
}
if(typeof module!=='undefined')module.exports={project};else root.PeptoraStoreFeed={project};
})(typeof window!=='undefined'?window:globalThis);

