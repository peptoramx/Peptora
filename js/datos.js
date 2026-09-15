// js/datos.js — centraliza carga de datos y cálculos. Reutilizar siempre desde aquí,
// igual que datos.js en LMBC: nunca duplicar estas fórmulas en cada página.

const RUTA_DATOS = (window.RUTA_DATOS_BASE || '') + 'data/';

async function cargarTodo(){
  // cache:'no-store' + parametro de version -> evita que el CDN de GitHub Pages
  // o el navegador sirvan data/*.json desactualizado justo despues de una venta/alta.
  const cacheBuster = '?t=' + Date.now();
  const opts = { cache: 'no-store' };
  const [productos, proveedores, lotes, ventas] = await Promise.all([
    fetch(RUTA_DATOS + 'productos.json' + cacheBuster, opts).then(r => r.json()),
    fetch(RUTA_DATOS + 'proveedores.json' + cacheBuster, opts).then(r => r.json()),
    fetch(RUTA_DATOS + 'lotes.json' + cacheBuster, opts).then(r => r.json()),
    fetch(RUTA_DATOS + 'ventas.json' + cacheBuster, opts).then(r => r.json()),
  ]);
  return { productos, proveedores, lotes, ventas };
}

function formatMoneda(n){
  return '$ ' + (n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function diasHasta(fechaStr){
  if(!fechaStr) return Infinity;
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const f = new Date(fechaStr + 'T00:00:00');
  return Math.ceil((f - hoy) / 86400000);
}

function stockEnViales(lote){
  return (lote.stock_cajas || 0) * (lote.viales_por_caja || 0) + (lote.stock_viales || 0);
}

function estadoLote(lote){
  const dias = diasHasta(lote.fecha_caducidad);
  const stock = stockEnViales(lote);
  if(stock === 0) return 'brick';
  if(dias >= 0 && dias <= 60) return 'amber';
  if(stock < 5) return 'brick';
  return 'teal';
}

// Vende por caja: descuenta cajas completas. Lanza error si no hay stock suficiente.
function venderCaja(lote, cantidad){
  if((lote.stock_cajas || 0) < cantidad){
    throw new Error(`Stock insuficiente: ${lote.stock_cajas || 0} cajas disponibles, se pidieron ${cantidad}`);
  }
  lote.stock_cajas -= cantidad;
}

// Vende por vial: si no hay viales sueltos suficientes, abre cajas completas automáticamente.
function venderVial(lote, cantidad){
  const vpc = lote.viales_por_caja || 0;
  while((lote.stock_viales || 0) < cantidad){
    if((lote.stock_cajas || 0) <= 0 || vpc <= 0){
      throw new Error(`Stock insuficiente: quedan ${stockEnViales(lote)} viales equivalentes, se pidieron ${cantidad}`);
    }
    lote.stock_cajas -= 1;
    lote.stock_viales = (lote.stock_viales || 0) + vpc;
  }
  lote.stock_viales -= cantidad;
}

function calcularKPIs({ lotes, ventas }){
  const hoy = new Date();
  const mesActual = hoy.getMonth(), anioActual = hoy.getFullYear();
  let mesAnt = mesActual - 1, anioAnt = anioActual;
  if(mesAnt < 0){ mesAnt = 11; anioAnt -= 1; }

  const valorCosto = lotes.reduce((s,l) => s + (l.costo_neto_caja||0)*(l.stock_cajas||0) + (l.costo_por_vial||0)*(l.stock_viales||0), 0);
  const valorVenta = lotes.reduce((s,l) => s + (l.precio_venta_caja||0)*(l.stock_cajas||0) + (l.precio_venta_vial||0)*(l.stock_viales||0), 0);
  const margenPonderado = valorVenta > 0 ? (valorVenta - valorCosto) / valorVenta * 100 : 0;

  const caducidadProxima = lotes.filter(l => { const d = diasHasta(l.fecha_caducidad); return d >= 0 && d <= 60; }).length;
  const stockCritico = lotes.filter(l => { const s = stockEnViales(l); return s > 0 && s < 5; }).length;
  const stockAgotado = lotes.filter(l => stockEnViales(l) === 0).length;

  function ventasDe(mes, anio){
    return ventas.filter(v => { const f = new Date(v.fecha); return f.getMonth()===mes && f.getFullYear()===anio; });
  }
  const ventasMes = ventasDe(mesActual, anioActual);
  const ventasMesAnt = ventasDe(mesAnt, anioAnt);

  const ingresosMes = ventasMes.reduce((s,v) => s + (v.precio_vendido||0), 0);
  const ingresosMesAnt = ventasMesAnt.reduce((s,v) => s + (v.precio_vendido||0), 0);
  const variacionIngresos = ingresosMesAnt > 0 ? (ingresosMes - ingresosMesAnt) / ingresosMesAnt * 100 : null;

  const ticketPromedio = ventasMes.length > 0 ? ingresosMes / ventasMes.length : 0;
  const ticketPromedioAnt = ventasMesAnt.length > 0 ? ingresosMesAnt / ventasMesAnt.length : null;
  const variacionTicket = ticketPromedioAnt ? (ticketPromedio - ticketPromedioAnt) / ticketPromedioAnt * 100 : null;

  const lotesPorId = Object.fromEntries(lotes.map(l => [l.id, l]));
  function costoDeVenta(v){
    const l = lotesPorId[v.lote_id];
    if(!l) return 0;
    return (v.tipo_venta === 'caja' ? (l.costo_neto_caja||0) : (l.costo_por_vial||0)) * (v.cantidad||0);
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
    valorCosto, valorVenta, margenPonderado, caducidadProxima, stockCritico, stockAgotado,
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
  const lotesPorId = Object.fromEntries(lotes.map(l => [l.id, l]));
  return [...ventas]
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, n)
    .map(v => ({ ...v, lote: lotesPorId[v.lote_id] }));
}

function ventasDeVendedor(ventas, vendedorId){
  return ventas.filter(v => v.vendedor_id === vendedorId);
}

function comisionVendedor(ventas, vendedor){
  const propias = ventasDeVendedor(ventas, vendedor.id);
  const totalVendido = propias.reduce((s,v) => s + (v.precio_vendido||0), 0);
  const comision = totalVendido * (vendedor.comision_pct||0) / 100;
  return { totalVendido, comision, numVentas: propias.length };
}
