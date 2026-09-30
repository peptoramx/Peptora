/* Shared navigation and accessible form labels. No data or credential access. */
(() => {
 const boot = () => {
  const root = document.querySelector('.form-wrap') ? '../' : './';
  const rail = document.querySelector('.rail');
  if(rail){
   const brand=rail.querySelector('.brand');
   brand.innerHTML='<a href="./" aria-label="PEPTORA — Inicio"><img class="brand-logo" src="assets/logo-peptora.png" alt="PEPTORA Research Peptide Labs" width="1200" height="400"></a><span class="brand-caption">Operations / Inventory</span>';
   const nav=rail.querySelector('nav');nav.id='inventoryNav';nav.setAttribute('aria-label','Módulos del inventario');
   const btn=document.createElement('button');btn.className='nav-toggle';btn.type='button';btn.textContent='Menú';btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',nav.id);
   brand.after(btn);
   const close=()=>{nav.classList.remove('open');btn.setAttribute('aria-expanded','false');};
   btn.addEventListener('click',()=>{const open=nav.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();btn.focus();}});
   document.addEventListener('click',e=>{if(!rail.contains(e.target))close();});
   nav.querySelectorAll('a.active').forEach(a=>a.setAttribute('aria-current','page'));
  }
  const reports = document.querySelector('.business-reports');
  if(reports) reports.open = matchMedia('(min-width:861px)').matches;
  const wrap=document.querySelector('.form-wrap');
  if(wrap){
   const banner=document.createElement('div');banner.className='form-brand';
   banner.innerHTML='<a href="../" aria-label="PEPTORA — Inicio"><img class="brand-logo" src="../assets/logo-peptora.png" alt="PEPTORA Research Peptide Labs" width="1200" height="400"></a><span>OPERATIONS / INVENTORY</span>';
   wrap.prepend(banner);
   if(!location.pathname.includes('venta-vendedor')){
    const links=[['','Inicio'],['nuevo-lote/','Alta de lote'],['venta-rapida/','Venta rápida'],['ventas/','Ventas'],['consignacion/','Consignación'],['vendedores/','Vendedores'],['editar-lote/','Editar lotes'],['popularidad/','Reportes'],['promocion/','Promoción'],['calculadora/','Calculadora']];
    const menu=document.createElement('nav');menu.className='module-menu';menu.setAttribute('aria-label','Módulos del inventario');
    for(const [path,title] of links){const a=document.createElement('a');a.href=root+path;a.textContent=title;if(path&&location.pathname.includes('/'+path))a.setAttribute('aria-current','page');menu.append(a);}
    const chooser=document.createElement('details');chooser.className='module-chooser';chooser.open=matchMedia('(min-width:861px)').matches;
    const summary=document.createElement('summary');summary.textContent='Ir a otro módulo';
    chooser.append(summary,menu);banner.after(chooser);
   }
  }
  const main=document.querySelector('.main')||wrap||document.querySelector('.access-card');
  if(main){main.id=main.id||'mainContent';const skip=document.createElement('a');skip.className='skip-link';skip.href='#'+main.id;skip.textContent='Ir al contenido';document.body.prepend(skip);}
  let counter=0;
  const labels=()=>{
   document.querySelectorAll('.field').forEach(field=>{
    const label=field.querySelector('label');const input=field.querySelector('input,select,textarea');
    if(label&&input&&!label.htmlFor){input.id=input.id||'field-'+(++counter);label.htmlFor=input.id;}
   });
   document.querySelectorAll('.status:not([role])').forEach(el=>{el.setAttribute('role','status');el.setAttribute('aria-live','polite');});
   document.querySelectorAll('.rm:not([aria-label]),.rm-cat:not([aria-label])').forEach(el=>el.setAttribute('aria-label','Quitar artículo'));
   document.querySelectorAll('.jeringa-opt:not([role])').forEach(el=>{el.setAttribute('role','button');el.tabIndex=0;el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});});
  };
  labels();new MutationObserver(labels).observe(document.body,{childList:true,subtree:true});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
