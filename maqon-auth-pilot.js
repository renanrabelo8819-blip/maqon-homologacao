/* MAQON V1.6.7 - Cadastro de equipamentos de homologação com RLS Supabase */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg=window.MAQON_SUPABASE_CONFIG || {};
  const showError=m=>{$('error').textContent=m||''};
  const notice=m=>{$('notice').textContent=m||''};
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||'') || !String(cfg.publishableKey||'').startsWith('sb_publishable_') || !window.supabase?.createClient){showError('Configuração Supabase indisponível. Confira URL, publishable key e conexão de rede.');return;}
  const db=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let companyId=null, userId=null, equipment=[], proposals=[], editing=null, editingProposal=null, serial=0;
  function lock(){++serial;companyId=null;userId=null;equipment=[];proposals=[];editing=null;editingProposal=null;$('workspace').style.display='none';$('login').style.display='block';$('login-password').value='';}
  function safeYear(){const v=$('year').value.trim();if(!v)return null;const n=Number(v);if(!Number.isInteger(n)||n<1900||n>2200)throw Error('Informe um ano válido (1900 a 2200).');return n;}
  function payload(){const categoria=$('category').value.trim(),fabricante=$('manufacturer').value.trim(),modelo=$('model').value.trim();if(!categoria||!fabricante||!modelo)throw Error('Preencha categoria, fabricante e modelo.');return {categoria,fabricante,modelo,ano:safeYear(),prefixo:$('prefix').value.trim()||null,situacao:$('status').value};}
  function clearEditor(){editing=null;$('equipment-form').reset();$('form-title').textContent='Cadastrar equipamento de teste';$('save').textContent='Salvar equipamento';$('cancel').hidden=true;}
  function draw(){
    $('count').textContent=String(equipment.length);$('status-text').textContent='Registros obtidos pela API Supabase para a empresa autenticada.';
    const tbody=$('equipment-rows');tbody.replaceChildren();
    for(const rec of equipment){const tr=document.createElement('tr');for(const prop of ['categoria','fabricante','modelo','ano','prefixo','situacao']){const td=document.createElement('td');td.textContent=rec[prop]??'—';tr.append(td)}
      const cell=document.createElement('td');const edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.addEventListener('click',()=>editRecord(rec.id));cell.append(edit);tr.append(cell);tbody.append(tr);}
    if(!equipment.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=7;td.textContent='Nenhum equipamento de teste nesta empresa.';tr.append(td);tbody.append(tr);}
  }
  async function refresh(){if(!companyId)throw Error('Empresa não identificada.');const company=companyId;const result=await db.from('maqon_equipamentos').select('id,empresa_id,categoria,fabricante,modelo,ano,prefixo,situacao').eq('empresa_id',company).order('modelo');if(result.error)throw Error('Erro ao carregar equipamentos: '+result.error.message);if(company!==companyId)return;if(result.data?.some(x=>x.empresa_id!==company))throw Error('Inconsistência de isolamento detectada.');equipment=result.data||[];draw();}
  function proposalNotice(m){$('proposal-notice').textContent=m||'';}
  function proposalPayload(){
    const cliente_nome=$('proposal-client').value.trim(), titulo=$('proposal-title').value.trim();
    if(!cliente_nome||!titulo)throw Error('Informe cliente e título da proposta.');
    const raw=$('proposal-value').value.trim();
    const value=raw===''?null:Number(raw);
    if(value!==null&&(!Number.isFinite(value)||value<0||value>999999999999))throw Error('Valor total inválido.');
    return {cliente_nome,titulo,numero:$('proposal-number').value.trim()||null,modalidade:$('proposal-type').value.trim()||null,valor_total:value,validade_ate:$('proposal-expiry').value||null,status:$('proposal-status').value};
  }
  function clearProposal(){editingProposal=null;$('proposal-form').reset();$('proposal-form-title').textContent='Cadastrar proposta comercial de teste';$('proposal-save').textContent='Salvar proposta';$('proposal-cancel').hidden=true;}
  function drawProposals(){
    $('proposal-count').textContent=String(proposals.length);
    $('proposal-status-text').textContent='Registros retornados pela API para a empresa autenticada.';
    const tbody=$('proposal-rows');tbody.replaceChildren();
    for(const rec of proposals){const tr=document.createElement('tr');
      const vals=[rec.numero,rec.cliente_nome,rec.titulo,rec.modalidade,rec.valor_total==null?'—':Number(rec.valor_total).toLocaleString('pt-BR',{minimumFractionDigits:2}),rec.validade_ate,rec.status];
      for(const val of vals){const td=document.createElement('td');td.textContent=val??'—';tr.append(td);}
      const cell=document.createElement('td'),edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.addEventListener('click',()=>editProposal(rec.id));cell.append(edit);tr.append(cell);tbody.append(tr);
    }
    if(!proposals.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=8;td.textContent='Nenhuma proposta de teste nesta empresa.';tr.append(td);tbody.append(tr);}
  }
  async function refreshProposals(){
    if(!companyId)throw Error('Empresa não identificada.');
    const company=companyId;
    const r=await db.from('maqon_propostas').select('id,empresa_id,numero,cliente_nome,titulo,modalidade,valor_total,validade_ate,status').eq('empresa_id',company).order('criado_em',{ascending:false});
    if(r.error)throw Error('Erro ao carregar propostas: '+r.error.message);
    if(company!==companyId)return;
    if(r.data?.some(x=>x.empresa_id!==company))throw Error('Inconsistência de isolamento de propostas detectada.');
    proposals=r.data||[];drawProposals();
  }
  function editProposal(id){const rec=proposals.find(x=>x.id===id);if(!rec)return;editingProposal=rec.id;
    $('proposal-client').value=rec.cliente_nome||'';$('proposal-title').value=rec.titulo||'';$('proposal-number').value=rec.numero||'';$('proposal-type').value=rec.modalidade||'';
    $('proposal-value').value=rec.valor_total??'';$('proposal-expiry').value=rec.validade_ate||'';$('proposal-status').value=rec.status||'rascunho';
    $('proposal-form-title').textContent='Editar proposta de teste';$('proposal-save').textContent='Salvar edição';$('proposal-cancel').hidden=false;proposalNotice('Editando proposta desta empresa.');$('proposal-form').scrollIntoView({behavior:'smooth'});
  }
  function editRecord(id){const rec=equipment.find(x=>x.id===id);if(!rec)return;editing=rec.id;$('category').value=rec.categoria||'';$('manufacturer').value=rec.fabricante||'';$('model').value=rec.modelo||'';$('year').value=rec.ano??'';$('prefix').value=rec.prefixo||'';$('status').value=rec.situacao||'ativo';$('form-title').textContent='Editar equipamento de teste';$('save').textContent='Salvar edição';$('cancel').hidden=false;notice('Editando equipamento da empresa autenticada.');$('equipment-form').scrollIntoView({behavior:'smooth'});}
  async function loadSession(session){const seq=++serial;if(!session?.user){lock();return;}const user=session.user;const membership=await db.from('maqon_usuarios').select('empresa_id,perfil').eq('usuario_id',user.id);if(seq!==serial)return;if(membership.error)throw Error('Falha ao verificar vínculo: '+membership.error.message);if(membership.data?.length!==1)throw Error('Usuário sem empresa única autorizada.');const member=membership.data[0];const company=await db.from('maqon_empresas').select('nome').eq('id',member.empresa_id).single();if(seq!==serial)return;if(company.error||!company.data)throw Error('Empresa não autorizada ou indisponível.');companyId=member.empresa_id;userId=user.id;await Promise.all([refresh(),refreshProposals()]);if(seq!==serial)return;$('company-name').textContent=company.data.nome;$('who').textContent=(member.perfil==='administrador'?'Administrador':'Cliente')+' • '+(user.email||'Conta autenticada');$('login').style.display='none';$('workspace').style.display='block';showError('');notice('');}
  async function validateSession(session){try{await loadSession(session)}catch(e){lock();showError(e.message||'Falha de autorização.');await db.auth.signOut();}}
  $('login-form').addEventListener('submit',async e=>{e.preventDefault();showError('Validando acesso...');$('login-button').disabled=true;try{const response=await db.auth.signInWithPassword({email:$('login-email').value.trim(),password:$('login-password').value});if(response.error)throw response.error;$('login-password').value='';await validateSession(response.data.session)}catch(err){showError(err.message||'Falha no login.')}finally{$('login-button').disabled=false;}});
  $('equipment-form').addEventListener('submit',async e=>{e.preventDefault();if(!companyId||!userId){notice('Sessão inválida. Entre novamente.');return;}const savedCompany=companyId, savedUser=userId;const button=$('save');button.disabled=true;try{const values=payload();notice('Gravando no Supabase...');let response;if(editing){response=await db.from('maqon_equipamentos').update(values).eq('id',editing).eq('empresa_id',savedCompany).select('id');}else{response=await db.from('maqon_equipamentos').insert({...values,empresa_id:savedCompany}).select('id');}
    if(response.error)throw response.error;if(!response.data||response.data.length!==1)throw Error('Operação não confirmada ou sem permissão.');if(companyId!==savedCompany||userId!==savedUser)return;clearEditor();await refresh();notice('Equipamento de teste salvo com sucesso no Supabase.');
  }catch(err){notice('Não foi possível salvar: '+(err.message||'erro desconhecido'))}finally{button.disabled=false;}});
  $('proposal-form').addEventListener('submit',async e=>{e.preventDefault();if(!companyId||!userId){proposalNotice('Sessão inválida. Entre novamente.');return;}
    const savedCompany=companyId,savedUser=userId,button=$('proposal-save');button.disabled=true;
    try{const values=proposalPayload();proposalNotice('Gravando proposta no Supabase...');
      const response=editingProposal
        ? await db.from('maqon_propostas').update(values).eq('id',editingProposal).eq('empresa_id',savedCompany).select('id')
        : await db.from('maqon_propostas').insert({...values,empresa_id:savedCompany}).select('id');
      if(response.error)throw response.error;
      if(response.data?.length!==1)throw Error('Operação não confirmada ou sem permissão.');
      if(companyId!==savedCompany||userId!==savedUser)return;
      clearProposal();await refreshProposals();proposalNotice('Proposta de teste salva com sucesso no Supabase.');
    }catch(err){proposalNotice('Não foi possível salvar a proposta: '+(err.message||'erro desconhecido'));}finally{button.disabled=false;}
  });
  $('proposal-cancel').addEventListener('click',()=>{clearProposal();proposalNotice('Edição cancelada.');});
  $('cancel').addEventListener('click',()=>{clearEditor();notice('Edição cancelada.');});
  $('signout').addEventListener('click',async()=>{lock();await db.auth.signOut();showError('');});
  db.auth.getSession().then(r=>{if(r.error)throw r.error;return validateSession(r.data.session);}).catch(e=>{lock();showError(e.message||'Erro ao recuperar sessão.');});
})();