# PEPTORA · Inventory

Interfaz operativa alineada con PEPTORA Site: blanco, azul claro, azul profundo, Archivo e Inter. Se conserva el logo original.

## Operación por unidad
- Inventario, ventas, consignaciones y edición funcionan por vial/unidad.
- El alta permite introducir unidades y costo unitario directamente.
- La ayuda opcional convierte compras: una caja = 10 viales; costo unitario = costo por caja × (1 − descuento/100) ÷ 10.
- Las entradas de un mismo producto se muestran agrupadas por concentración. El detalle conserva cada costo, precio y caducidad.
- Proveedor común: Camila. Los registros iniciales comparten fecha de adquisición 2026-09-01 y código de lote por nombre.
- Los identificadores originales se conservan para mantener las referencias de ventas y consignaciones.
- Los adaptadores de datos interpretan registros antiguos por caja sin duplicar unidades.

## Guardado
`js/transacciones.js` guarda los archivos relacionados en un único commit:
ventas y stock, entregas y consignaciones, devoluciones, cancelaciones y altas.
Compara los SHA de los archivos y actualiza main sin force. Si hubo cambios en otra sesión, se requiere recargar; no sobrescribe el inventario más reciente.
Los errores de carga no se interpretan como un historial vacío.

Una venta cancelada regresa al origen correcto: bodega o consignación.
No se eliminan lotes con ventas o consignaciones relacionadas.

## Validación
Con Node instalado:
```sh
node tests/inventory.test.cjs
```
Pruebas sin red y sin escrituras reales: cantidades, descuentos, concentración del inventario,
conversión de compras, compatibilidad histórica, indicadores, comisiones, concurrencia y cancelaciones.
La calculadora es una conversión matemática de referencia, no una recomendación de uso.

## Publicación
Sitio estático compatible con GitHub Pages. Se mantienen CNAME, .nojekyll, rutas y manifiesto.
El dominio existente es inventario.peptora.site. Los cambios de código y datos se revisan juntos antes de integrar a main.

## Límites existentes
El acceso sigue usando tokens GitHub almacenados en el navegador. El bloqueo visual no equivale a autorización de servidor.
El repositorio es público: sus JSON no son privados. Para datos operativos confidenciales y roles de vendedor realmente restringidos se necesita almacenamiento privado y un backend con autorización.
Los precios, costos y caducidades de entradas existentes no se homogeneizan automáticamente.
