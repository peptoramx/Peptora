const assert=require('node:assert/strict'),{project}=require('./js/store-feed.js');
const fixture=(extra={})=>({producto_id:'prod_retatrutida',concentracion_mg:20,precio_venta_vial:2100,stock_viales:3,fecha_adquisicion:'2026-09-01',fecha_caducidad:'2028-09-01',costo_por_vial:245,proveedor_nombre:'PRIVATE',...extra});
const p=project([fixture(),fixture({precio_venta_vial:2200,stock_viales:2}),fixture({stock_viales:100,fecha_caducidad:'2020-01-01'})]);
assert.deepEqual(p.offers['retatrutide-2'],{price:2200,available:true});
assert.ok(!JSON.stringify(p).includes('PRIVATE'));assert.ok(!JSON.stringify(p).includes('costo_por_vial'));
assert.equal(project([fixture({producto_id:'prod_ipamoreline',concentracion_mg:100})]).offers['ipamorelin-1'],undefined);
assert.equal(project([fixture({producto_id:'prod_ipamoreline',concentracion_mg:10})]).offers['ipamorelin-1'].available,true);
assert.equal(project([fixture({producto_id:'prod_cjc-1295',concentracion_mg:5})]).offers['cjc-1295-no-dac-1'],undefined);
assert.equal(project([fixture({stock_viales:0})]).offers['retatrutide-2'].available,false);
assert.equal(project([fixture({stock_viales:2,stock_cajas:1,viales_por_caja:10})]).offers['retatrutide-2'].available,true);
assert.equal(project([fixture({precio_venta_vial:0})]).offers['retatrutide-2'].price,null);
console.log('Inventory feed: price selection, aggregation, expiry, units, exact presentation and privacy checks passed.');
assert.ok(!JSON.stringify(p).includes('"stock"'));
assert.ok(!JSON.stringify(p).includes('stock_viales'));

