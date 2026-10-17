/* Retail-only projection. Never include costs, suppliers, customers or credentials. */
(function(root){
function project(lots,today=new Date().toISOString().slice(0,10),priceState={}){
 const map={prod_retatrutida:{10:'retatrutide-1',20:'retatrutide-2'},prod_terzipatida:{20:'tirzepatide-1',30:'tirzepatide-2'},'prod_ghk-cu':{50:'ghk-cu-1',100:'ghk-cu-2'},prod_klow:{80:'klow-1'},prod_semax:{10:'semax-1'},prod_selank:{10:'selank-1'},'prod_mots-c':{10:'mots-c-1'},prod_nad:{500:'nad-plus-1'},'prod_bpc-157':{20:'bpc-157-1'},'prod_bac-water-3ml':{0:'bac-water-3ml-1'},'prod_bac-water-10ml':{0:'bac-water-10ml-1'}};
 map.prod_ipamoreline={10:'ipamorelin-1'};
 map['prod_cjc-1295']={5:'cjc-1295-no-dac-1'};
 map['prod_tesamorelin-ipamoreline']={0:'tesamorelin-ipamorelin-1',15:'tesamorelin-ipamorelin-1'};
 map['prod_bpc-157-tb-500']={0:'wolverine-1',10:'wolverine-1'};
 // Owner-confirmed blend: 5 mg CJC no DAC + 5 mg Ipamorelin.
 // The legacy numeric inventory field records 5 (per component), not a sum.
 map['prod_cjc-1295-no-dac-ipamorelin']={5:'cjc-ipamorelin-1',10:'cjc-ipamorelin-1'};
 map.prod_dsip={10:'dsip-1'};
 map.prod_glutathion={600:'glutathione-1'};
 map['prod_ss-31']={5:'ss-31-1'};
 const groups={};
 for(const l of lots){const id=map[l.producto_id]?.[Number(l.concentracion_mg||0)];if(!id)continue;(groups[id]??=[]).push(l);}
 const offers={};
 for(const [id,rows] of Object.entries(groups)){
  const valid=rows.filter(l=>!l.fecha_caducidad||l.fecha_caducidad>=today);
  const changed=l=>priceState.priceChangedAt?.[l.id]||l.precio_actualizado_en||l.fecha_adquisicion||'';
  const ordered=valid.map((l,index)=>({l,index})).sort((a,b)=>String(changed(b.l)).localeCompare(String(changed(a.l)))||String(b.l.fecha_adquisicion||'').localeCompare(String(a.l.fecha_adquisicion||''))||b.index-a.index);
  const latest=ordered.find(({l})=>Number.isFinite(Number(l.precio_venta_vial))&&Number(l.precio_venta_vial)>0)?.l;
  const stock=valid.reduce((n,l)=>{const units=Number(l.stock_viales||0)+Number(l.stock_cajas||0)*(Number(l.viales_por_caja)||10);return n+(Number.isSafeInteger(units)&&units>0?units:0);},0);
  offers[id]={price:latest?Number(latest.precio_venta_vial):null,available:stock>0};
 }
 // Do not publish inverted strength pricing; the owner must correct inventory prices.
 for(const [low,high] of [['retatrutide-1','retatrutide-2'],['tirzepatide-1','tirzepatide-2'],['ghk-cu-1','ghk-cu-2']]){
  if(offers[low]?.price>0&&offers[high]?.price>0&&offers[high].price<offers[low].price){offers[low].price=null;offers[high].price=null;}
 }
 return {schema:1,currency:'MXN',updatedAt:new Date().toISOString(),offers};
}
function nextPriceState(lots,previousLots,state={},now=new Date().toISOString()){
 const priceChangedAt={...(state.priceChangedAt||{})},before=new Map(previousLots.map(l=>[l.id,l]));
 for(const lot of lots){const old=before.get(lot.id);if(!old||Number(old.precio_venta_vial)!==Number(lot.precio_venta_vial)||Number(old.concentracion_mg)!==Number(lot.concentracion_mg))priceChangedAt[lot.id]=now;}
 for(const id of Object.keys(priceChangedAt))if(!lots.some(l=>l.id===id))delete priceChangedAt[id];
 return {schema:1,priceChangedAt};
}
if(typeof module!=='undefined')module.exports={project,nextPriceState,version:2};else root.PeptoraStoreFeed={project,nextPriceState,version:2};
})(typeof window!=='undefined'?window:globalThis);

