/* One commit for linked inventory files; never save half a sale.
   Ref updates are non-forced: concurrent changes require reloading. */
async function ghGuardarAtomico(cambios, mensaje, token, shaCache){
  const api = 'https://api.github.com/repos/peptoramx/Peptora';
  const request = async (path, body) => {
    const res = await fetch(api + path, {method:body ? 'POST' : 'GET',cache:'no-store',headers:{
      Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'
    },...(body ? {body:JSON.stringify(body)} : {})});
    if(!res.ok) throw new Error(res.status === 409 || res.status === 422 ?
      'El inventario cambió en otra sesión. Recarga antes de volver a guardar.' :
      'No se pudo guardar (HTTP '+res.status+'). Ningún movimiento fue confirmado.');
    return res.json();
  };
  if(!token) throw new Error('Falta el token de acceso.');
  const ref = await request('/git/ref/heads/main');
  const commit = await request('/git/commits/'+ref.object.sha);
  const tree = await request('/git/trees/'+commit.tree.sha+'?recursive=1');
  if(tree.truncated) throw new Error('No se pudo comprobar el inventario completo.');
  for(const path of Object.keys(cambios)){
    const existing = tree.tree.find(entry=>entry.path===path);
    if((existing?.sha || null) !== (shaCache[path] || null)) throw new Error('Hay cambios más recientes en '+path+'. Recarga antes de guardar.');
  }
  const blobs = await Promise.all(Object.entries(cambios).map(async ([path,data])=>{
    const blob=await request('/git/blobs',{content:JSON.stringify(data,null,2)+'\n',encoding:'utf-8'});
    return {path,mode:'100644',type:'blob',sha:blob.sha};
  }));
  const nuevoTree = await request('/git/trees',{base_tree:commit.tree.sha,tree:blobs});
  const nuevoCommit = await request('/git/commits',{message:mensaje,tree:nuevoTree.sha,parents:[ref.object.sha]});
  const res = await fetch(api+'/git/refs/heads/main',{method:'PATCH',headers:{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'
  },body:JSON.stringify({sha:nuevoCommit.sha,force:false})});
  if(!res.ok) throw new Error('No se confirmó el movimiento. El inventario puede haber cambiado; recarga para verificar antes de reintentar.');
  for(const blob of blobs) shaCache[blob.path]=blob.sha;
  return nuevoCommit.sha;
}
