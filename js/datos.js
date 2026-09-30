// js/datos.js — centraliza carga de datos y cálculos. Reutilizar siempre desde aquí,
// igual que datos.js en LMBC: nunca duplicar estas fórmulas en cada página.

function rutaDatos(){ return (window.RUTA_DATOS_BASE || '') + 'data/'; }

async function cargarJSON(url, opts = {}){
  const response = await fetch(url, opts);
  if(!response.ok) throw new Error('No se pudieron cargar los datos (HTTP ' + response.status + '). Intenta de nuevo.');
  const data = await response.json();
  if(!Array.isArray(data)) throw new Error('El archivo de datos no tiene el formato esperado.');
  return data;
}
function escaparHTML(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function normalizarBusqueda(value){
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function cantidadEntera(cantidad){
  if(!Number.isSafeInteger(cantidad) || cantidad <= 0) throw new Error('La cantidad debe ser un número entero mayor que cero.');
}
// Compatibility adapters: legacy boxes are read as units; new operations are vial-only.
function normalizarLote(lote){
  const vpc = Number(lote.viales_por_caja) > 0 ? Number(lote.viales_por_caja) : 10;
  return {...lote, viales_por_caja:vpc, stock_cajas:0,
    stock_viales:Number(lote.stock_viales || 0)+Number(lote.stock_cajas || 0)*vpc,
    costo_por_vial:lote.costo_por_vial != null ? Number(lote.costo_por_vial) : Number(lote.costo_neto_caja || 0)/vpc,
    precio_venta_vial:lote.precio_venta_vial != null ? Number(lote.precio_venta_vial) : Number(lote.precio_venta_caja || 0)/vpc};
}
function normalizarVentas(ventas,lotes){
  const porId=Object.fromEntries(lotes.map(l=>[l.id,l]));
  return ventas.map(v=>{
    if(v.tipo_venta!=='caja') return {...v};
    const factor=porId[v.lote_id]?.viales_por_caja || 10;
    return {...v,tipo_venta:'vial',cantidad:v.cantidad*factor,
      tipo_venta_original:v.tipo_venta_original || 'caja',cantidad_original:v.cantidad_original ?? v.cantidad};
  });
}
function normalizarConsignaciones(consignaciones,lotes){
  const porId=Object.fromEntries(lotes.map(l=>[l.id,l]));
  return consignaciones.map(c=>{
    if(c.tipo!=='caja') return {...c};
    const factor=porId[c.lote_id]?.viales_por_caja || 10;
    return {...c,tipo:'vial',cantidad_entregada:c.cantidad_entregada*factor,
      cantidad_pendiente:c.cantidad_pendiente*factor,tipo_original:c.tipo_original || 'caja',
      cantidad_entregada_original:c.cantidad_entregada_original ?? c.cantidad_entregada};
  });
}
function compraAUnidades(cajas,costoCaja,descuento=0){
  if(!Number.isSafeInteger(cajas)||cajas<0) throw new Error('Captura un número entero de cajas compradas.');
  if(!Number.isFinite(costoCaja)||costoCaja<0||!Number.isFinite(descuento)||descuento<0||descuento>100) throw new Error('Revisa costo y descuento.');
  return {unidades:cajas*10,costoUnitario:costoCaja*(1-descuento/100)/10};
}

async function cargarTodo(){
  // cache:'no-store' + parametro de version -> evita que el CDN de GitHub Pages
  // o el navegador sirvan data/*.json desactualizado justo despues de una venta/alta.
  const cacheBuster = '?t=' + Date.now();
  const opts = { cache: 'no-store' };
  const [productos, proveedores, lotes, ventas] = await Promise.all([
    cargarJSON(rutaDatos() + 'productos.json' + cacheBuster, opts),
    cargarJSON(rutaDatos() + 'proveedores.json' + cacheBuster, opts),
    cargarJSON(rutaDatos() + 'lotes.json' + cacheBuster, opts),
    cargarJSON(rutaDatos() + 'ventas.json' + cacheBuster, opts),
  ]);
  const lotesUnidades=lotes.map(normalizarLote);
  return { productos, proveedores, lotes:lotesUnidades, ventas:normalizarVentas(ventas,lotesUnidades) };
}

function formatMoneda(n){
  return '$ ' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function diasHasta(fechaStr){
  if(!fechaStr) return Infinity;
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const f = new Date(fechaStr + 'T00:00:00');
  return Number.isNaN(f.getTime()) ? Infinity : Math.round((f - hoy) / 86400000);
}

function stockEnViales(lote){
  return Number(lote.stock_cajas || 0) * (Number(lote.viales_por_caja) || 10) + Number(lote.stock_viales || 0);
}

function estadoLote(lote){
  const dias = diasHasta(lote.fecha_caducidad);
  const stock = stockEnViales(lote);
  if(stock === 0) return 'brick';
  if(dias < 0) return 'brick';
  if(dias <= 60) return 'amber';
  if(stock < 5) return 'brick';
  return 'teal';
}

// Retained only for interpreting historical box records, never exposed in the UI.
function venderCaja(lote,cantidad){cantidadEntera(cantidad);venderVial(lote,cantidad*(lote.viales_por_caja||10));}
function venderVial(lote,cantidad){
  cantidadEntera(cantidad);
  const unidades=normalizarLote(lote);
  if(cantidad>unidades.stock_viales) throw new Error(`Stock insuficiente: quedan ${unidades.stock_viales} unidades, se pidieron ${cantidad}`);
  unidades.stock_viales-=cantidad;
  Object.assign(lote,unidades);
}

function calcularKPIs({ lotes, ventas }){
  lotes=lotes.map(normalizarLote);
  ventas = ventasActivas(normalizarVentas(ventas,lotes));
  const hoy = new Date();
  const mesActual = hoy.getMonth(), anioActual = hoy.getFullYear();
  let mesAnt = mesActual - 1, anioAnt = anioActual;
  if(mesAnt < 0){ mesAnt = 11; anioAnt -= 1; }

  const valorCosto = lotes.reduce((s,l) => s + (l.costo_por_vial||0)*stockEnViales(l), 0);
  const valorVenta = lotes.reduce((s,l) => s + (l.precio_venta_vial||0)*stockEnViales(l), 0);
  const margenPonderado = valorVenta > 0 ? (valorVenta - valorCosto) / valorVenta * 100 : 0;

  const caducados = lotes.filter(l => diasHasta(l.fecha_caducidad) < 0 && stockEnViales(l) > 0).length;
  const caducidadProxima = lotes.filter(l => { const d = diasHasta(l.fecha_caducidad); return d >= 0 && d <= 60; }).length;
  const stockCritico = lotes.filter(l => { const s = stockEnViales(l); return s > 0 && s < 5; }).length;
  const stockAgotado = lotes.filter(l => stockEnViales(l) === 0).length;

  function ventasDe(mes, anio){
    return ventas.filter(v => { const f = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v.fecha) ? v.fecha+'T12:00:00' : v.fecha); return f.getMonth()===mes && f.getFullYear()===anio; });
  }
  const ventasMes = ventasDe(mesActual, anioActual);
  const ventasMesAnt = ventasDe(mesAnt, anioAnt);

  const ingresosMes = ventasMes.reduce((s,v) => s + (v.precio_vendido||0), 0);
  const ingresosMesAnt = ventasMesAnt.reduce((s,v) => s + (v.precio_vendido||0), 0);
  const variacionIngresos = ingresosMesAnt > 0 ? (ingresosMes - ingresosMesAnt) / ingresosMesAnt * 100 : null;

  const ticketsMes = new Set(ventasMes.map(v=>v.grupo_id || v.id)).size;
  const ticketsMesAnt = new Set(ventasMesAnt.map(v=>v.grupo_id || v.id)).size;
  const ticketPromedio = ticketsMes > 0 ? ingresosMes / ticketsMes : 0;
  const ticketPromedioAnt = ticketsMesAnt > 0 ? ingresosMesAnt / ticketsMesAnt : null;
  const variacionTicket = ticketPromedioAnt ? (ticketPromedio - ticketPromedioAnt) / ticketPromedioAnt * 100 : null;

  const lotesPorId = Object.fromEntries(lotes.map(l => [l.id, l]));
  function costoDeVenta(v){
    const l = lotesPorId[v.lote_id];
    if(!l) return 0;
    return (l.costo_por_vial||0)*(v.cantidad||0);
  }
  const costoVentasMes = ventasMes.reduce((s,v) => s + costoDeVenta(v), 0);
  const costoVentasMesAnt = ventasMesAnt.reduce((s,v) => s + costoDeVenta(v), 0);
  const margenBrutoMes = ingresosMes > 0 ? (ingresosMes - costoVentasMes) / ingresosMes * 100 : 0;
  const margenBrutoMesAnt = ingresosMesAnt > 0 ? (ingresosMesAnt - costoVentasMesAnt) / ingresosMesAnt * 100 : null;
  const variacionMargen = margenBrutoMesAnt !== null ? margenBrutoMes - margenBrutoMesAnt : null;

  // Rotación aproximada: valor de inventario a costo / costo de ventas diario del mes.
  // Asunción: ritmo de venta del mes en curso se mantiene constante (no hay histórico de inventario diario).
  const rotacionDias = costoVentasMes > 0 ? Math.round(valorCosto / (costoVentasMes/30)) : null;

  const ingresoPorProducto = {};
  ventasMes.forEach(v => {
    const l = lotesPorId[v.lote_id];
    const nombre = l ? l.producto_nombre : (v.producto_nombre || 'Desconocido');
    ingresoPorProducto[nombre] = (ingresoPorProducto[nombre]||0) + (v.precio_vendido||0);
  });
  const top5 = Object.entries(ingresoPorProducto).sort((a,b) => b[1]-a[1]).slice(0,5);
  const maxTop5 = top5.length ? top5[0][1] : 1;

  return {
    valorCosto, valorVenta, margenPonderado, caducidadProxima, caducados, stockCritico, stockAgotado,
    lotesActivos: lotes.length,
    ingresosMes, variacionIngresos, ticketPromedio, variacionTicket,
    margenBrutoMes, variacionMargen, rotacionDias,
    top5, maxTop5,
  };
}

function proveedoresConConteo(proveedores, lotes){
  return proveedores.map(p => ({
    ...p,
    lotesActivos: lotes.filter(l => l.proveedor_id === p.id && stockEnViales(l) > 0).length
  })).sort((a,b) => b.lotesActivos - a.lotesActivos);
}

function ventasRecientes(ventas, lotes, n=5){
  ventas = ventasActivas(ventas);
  const lotesPorId = Object.fromEntries(lotes.map(l => [l.id, l]));
  return [...ventas]
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, n)
    .map(v => ({ ...v, lote: lotesPorId[v.lote_id] }));
}

function ventasDeVendedor(ventas, vendedorId){
  return ventasActivas(ventas).filter(v => v.vendedor_id === vendedorId);
}

// Categoria del producto vendido en esa venta (via lote -> producto -> categoria).
function categoriaDeVenta(v, lotesPorId, productosPorId){
  const l = lotesPorId[v.lote_id];
  if(!l) return null;
  const p = productosPorId[l.producto_id];
  return p ? p.categoria : null;
}

// Comision por vendedor: usa comisiones_categoria[categoria] si esta definido para esa categoria,
// si no cae al comision_pct por default del vendedor. lotes/productos son opcionales
// (si no se mandan, todo usa el % default, igual que antes).
function comisionVendedor(ventas, vendedor, pagos, lotes, productos){
  pagos = pagos || []; lotes = lotes || []; productos = productos || [];
  const propias = ventasDeVendedor(ventas, vendedor.id);
  const lotesPorId = Object.fromEntries(lotes.map(l => [l.id, l]));
  const productosPorId = Object.fromEntries(productos.map(p => [p.id, p]));
  const overrides = vendedor.comisiones_categoria || {};

  let totalVendido = 0, comisionTotal = 0;
  propias.forEach(v => {
    const monto = v.precio_vendido || 0;
    totalVendido += monto;
    const cat = categoriaDeVenta(v, lotesPorId, productosPorId);
    const pct = (cat && overrides[cat] != null) ? overrides[cat] : (vendedor.comision_pct || 0);
    comisionTotal += monto * pct / 100;
  });
  comisionTotal = Math.round(comisionTotal * 100) / 100;

  const pagado = pagos.filter(p => p.vendedor_id === vendedor.id).reduce((s,p) => s + (p.monto||0), 0);
  const pendiente = Math.round((comisionTotal - pagado) * 100) / 100;
  return { totalVendido, comision: comisionTotal, numVentas: propias.length, pagado, pendiente };
}

// Reparte, PROPORCIONALMENTE AL SUBTOTAL, un descuento en % que el usuario escribe a mano para esa venta.
// items: [{ producto_id, subtotal }]. descuentoPct: numero que el usuario captura (0 = sin descuento).
// No hay nada automático aquí: si descuentoPct es 0 o no se manda, no se descuenta un peso.
function calcularPromocion(items, descuentoPct){
  descuentoPct = Number(descuentoPct || 0);
  if(!Number.isFinite(descuentoPct) || descuentoPct < 0 || descuentoPct > 100) throw new Error('El descuento debe estar entre 0 y 100%.');
  const aplica = descuentoPct > 0;
  const subtotalTotal = items.reduce((s,i) => s + i.subtotal, 0);
  const descuentoTotal = aplica ? subtotalTotal * (descuentoPct/100) : 0;
  const resultado = items.map(i => {
    const proporcion = subtotalTotal > 0 ? i.subtotal / subtotalTotal : 0;
    const descuentoLinea = Math.round(descuentoTotal * proporcion * 100) / 100;
    const totalLinea = Math.round((i.subtotal - descuentoLinea) * 100) / 100;
    const pctLinea = i.subtotal > 0 ? Math.round(descuentoLinea/i.subtotal*10000)/100 : 0;
    return { ...i, descuento_linea: descuentoLinea, total_linea: totalLinea, descuento_pct_linea: pctLinea };
  });
  return { aplica, subtotalTotal, descuentoTotal: Math.round(descuentoTotal*100)/100, items: resultado };
}

// Ranking global de productos por unidades vendidas (historico). Marca el ultimo 25% (o sin ventas) como rezagado.
function popularidadProductos(lotes, ventas){
  ventas = ventasActivas(ventas);
  const lotesPorId = Object.fromEntries(lotes.map(l=>[l.id,l]));
  const nombrePorLote = Object.fromEntries(lotes.map(l => [l.id, l.producto_nombre]));
  const unidades = {};
  ventas.forEach(v => {
    const nombre = v.producto_nombre || nombrePorLote[v.lote_id] || 'Desconocido';
    const factor = v.tipo_venta==='caja' ? (lotesPorId[v.lote_id]?.viales_por_caja || 1) : 1;
    unidades[nombre] = (unidades[nombre]||0) + (v.cantidad||0)*factor;
  });
  const todos = new Set([...Object.keys(unidades), ...lotes.map(l => l.producto_nombre)]);
  const lista = [...todos].map(nombre => ({ nombre, unidades: unidades[nombre]||0 }));
  lista.sort((a,b) => b.unidades - a.unidades);
  const max = lista.length ? Math.max(lista[0].unidades, 1) : 1;
  const n = lista.length;
  const corte = Math.ceil(n*0.75);
  return lista.map((item,i) => ({ ...item, max, rezagado: item.unidades===0 || i>=corte }));
}

// Gate simple de acceso: bloquea la pagina completa hasta que haya un token guardado.
function gateMasterToken(){
  if(localStorage.getItem('peptora_token')) return true;
  const base = window.RUTA_DATOS_BASE || (location.pathname.endsWith('/index.html') && location.pathname.split('/').length > 2 ? '../' : (document.querySelector('.form-wrap') ? '../' : ''));
  document.body.innerHTML = `
    <main class="access-screen"><form class="access-card" id="gateForm">
      <img class="brand-logo" src="${base}assets/logo-peptora.png" alt="PEPTORA Research Peptide Labs" width="1200" height="400">
      <span class="brand-caption">OPERATIONS / INVENTORY</span>
      <h1>Tu centro de operaciones.</h1>
      <p>Control de inventario, ventas y consignaciones.</p>
      <label for="gateTokenInput">Token de acceso GitHub</label>
      <input id="gateTokenInput" type="password" placeholder="Token de acceso" required autocomplete="off">
      <button class="btn" id="gateTokenBtn" type="submit">Entrar al inventario →</button>
      <p class="hint">El token se guarda en este navegador. Utiliza únicamente un equipo de confianza.</p>
    </form></main>`;
  document.getElementById('gateForm').onsubmit = event => { event.preventDefault(); };
  document.getElementById('gateForm').onsubmit = event => {
    event.preventDefault();
    const v = document.getElementById('gateTokenInput').value.trim();
    if(!v) return;
    localStorage.setItem('peptora_token', v);
    location.reload();
  };
  return false;
}

// Revierte el descuento de stock de una venta cancelada (inverso de venderCaja/venderVial).
function revertirStock(lote, tipoVenta, cantidad){
  cantidadEntera(cantidad);
  const unidades=normalizarLote(lote);
  unidades.stock_viales += cantidad*(tipoVenta==='caja' ? (lote.viales_por_caja || 10) : 1);
  Object.assign(lote,unidades);
}

function ventasActivas(ventas){
  return ventas.filter(v => !v.cancelada);
}

// ---- Consignación: qué producto está físicamente en manos de cada vendedor, sin vender todavía ----

// cantidad_pendiente = lo entregado menos lo ya vendido (desde este registro) menos lo devuelto.
function consignacionesDeVendedor(consignaciones, vendedorId){
  return consignaciones.filter(c => c.vendedor_id === vendedorId && c.cantidad_pendiente > 0);
}

function totalPendienteConsignacion(consignaciones, vendedorId){
  return consignacionesDeVendedor(consignaciones, vendedorId).reduce((s,c) => s + c.cantidad_pendiente, 0);
}

function consignacionesActivas(consignaciones){
  return consignaciones.filter(c => c.cantidad_pendiente > 0);
}
