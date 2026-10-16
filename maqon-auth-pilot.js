/* MAQON V1.6.5 — Homologação: painel seguro de leitura. Não é produção comercial. */
(() => {
  'use strict';
  const css=document.createElement('style');
  css.textContent=`
    body > *:not(#mq165-cover):not(#mq165-panel) { display:none!important; }
    body{margin:0!important;background:#07131a!important;color:#eff5f7!important;font-family:Arial,sans-serif!important}
    #mq165-cover{position:fixed;inset:0;z-index:2147483646;display:grid;place-items:center;background:#07131a;padding:16px;box-sizing:border-box}
    #mq165-cover .login{width:min(460px,100%);border:1px solid #ffc900;border-radius:16px;background:#102630;padding:30px;box-sizing:border-box}
    #mq165-cover h1,#mq165-panel h1{color:#ffc900} #mq165-cover input{box-sizing:border-box;width:100%;padding:12px;border-radius:7px;border:1px solid #adc1cd;margin:8px 0 14px;font-size:16px}
    #mq165-cover button,#mq165-panel button{background:#ffc900;color:#051018;font-weight:700;border:0;border-radius:7px;padding:12px 16px;cursor:pointer}
    #mq165-cover label{font-weight:bold}#mq165-error{color:#ffbebe;min-height:22px}
    #mq165-panel{display:none;position:relative;z-index:2147483645;max-width:1160px;margin:0 auto;padding:28px 20px}
    #mq165-panel header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #a47e00;padding-bottom:18px}
    #mq165-panel .sub{color:#bed2db} #mq165-panel .warn{border:1px solid #ae8e21;background:#182b33;border-radius:10px;padding:16px;margin:20px 0;line-height:1.6}
    #mq165-panel .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}
    #mq165-panel .card{border:1px solid #36505b;border-radius:10px;background:#102630;padding:16px}#mq165-panel .card b{font-size:26px;display:block;margin:10px 0;color:#ffc900}
    #mq165-panel .scroll{overflow:auto}#mq165-panel table{width:100%;border-collapse:collapse;min-width:560px}#mq165-panel th,#mq165-panel td{padding:12px;border-bottom:1px solid #314a55;text-align:left}#mq165-panel th{color:#ffc900}
  `;
  document.head.append(css);
  const cover=document.createElement('div');cover.id='mq165-cover';
  cover.innerHTML=`<div class="login"><h1>MAQON • Homologação segura</h1><p>Teste de acesso por empresa. Módulos comerciais locais estão bloqueados para impedir mistura de dados.</p><form id="mq165-form"><label for="mq165-email">E-mail</label><input id="mq165-email" type="email" autocomplete="username" required><label for="mq165-password">Senha</label><input id="mq165-password" type="password" autocomplete="current-password" required><button>Entrar</button><p id="mq165-error" role="alert"></p></form></div>`;
  document.body.append(cover);
  const panel=document.createElement('main');panel.id='mq165-panel';
  panel.innerHTML=`<header><div><h1>MAQON • Área de homologação</h1><strong id="mq165-company"></strong><div id="mq165-profile" class="sub"></div></div><button id="mq165-logout">Sair</button></header><div class="warn"><strong>Modo seguro — V1.6.5</strong><div>Leads, CRM, propostas, manutenção, documentos e integrações permanecem indisponíveis enquanto não houver isolamento e sincronização completos no Supabase. Não utilize dados reais de clientes.</div></div><div class="cards"><div class="card">Empresa vinculada<b id="mq165-linked">1</b></div><div class="card">Equipamentos da empresa (Supabase)<b id="mq165-count">—</b></div><div class="card">Operações comerciais<b>Bloqueadas</b></div></div><h2>Equipamentos da empresa — consulta somente leitura</h2><p id="mq165-status" class="sub">Aguardando autenticação.</p><div class="scroll"><table><thead><tr><th>Categoria</th><th>Fabricante</th><th>Modelo</th><th>Ano</th><th>Situação</th></tr></thead><tbody id="mq165-rows"></tbody></table></div>`;
  document.body.append(panel);
  const $=id=>document.getElementById(id);
  const error=m=>{$('mq165-error').textContent=m||''};
  const cfg=window.MAQON_SUPABASE_CONFIG||{};
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url||'')||!String(cfg.publishableKey||'').startsWith('sb_publishable_')||!window.supabase?.createClient){error('Conexão Supabase indisponível. Confira URL, publishable key e biblioteca.');return}
  const sb=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let version=0;
  async function showSession(session){
    const run=++version;
    if(!session?.user){panel.style.display='none';cover.style.display='grid';return}
    // Não exibimos nem dados locais nem interface anterior. A API deve confirmar o vínculo.
    const membership=await sb.from('maqon_usuarios').select('empresa_id,perfil').eq('usuario_id',session.user.id);
    if(membership.error)throw Error('Vínculo com empresa indisponível: '+membership.error.message);
    if(!membership.data||membership.data.length!==1)throw Error('Usuário sem empresa única válida. Acesso bloqueado.');
    const {empresa_id,perfil}=membership.data[0];
    const company=await sb.from('maqon_empresas').select('nome').eq('id',empresa_id).single();
    if(company.error||!company.data)throw Error('Não foi possível validar a empresa. Acesso bloqueado.');
    const equipments=await sb.from('maqon_equipamentos').select('empresa_id,categoria,fabricante,modelo,ano,situacao').eq('empresa_id',empresa_id).order('modelo');
    if(equipments.error)throw Error('Não foi possível consultar equipamentos: '+equipments.error.message);
    if((equipments.data||[]).some(x=>x.empresa_id!==empresa_id))throw Error('Falha no isolamento de registros. Acesso bloqueado.');
    if(run!==version)return;
    $('mq165-company').textContent=company.data.nome;
    $('mq165-profile').textContent=(perfil==='administrador'?'Administrador':'Cliente')+' • '+(session.user.email||'Usuário autenticado');
    $('mq165-count').textContent=String((equipments.data||[]).length);
    $('mq165-status').textContent='Lista carregada da API Supabase, vinculada à empresa autenticada.';
    const tbody=$('mq165-rows');tbody.replaceChildren();
    for(const item of equipments.data||[]){const tr=document.createElement('tr');for(const field of ['categoria','fabricante','modelo','ano','situacao']){const td=document.createElement('td');td.textContent=String(item[field]??'—');tr.append(td)}tbody.append(tr)}
    if(!equipments.data?.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=5;td.textContent='Nenhum equipamento cadastrado nesta empresa.';tr.append(td);tbody.append(tr)}
    cover.style.display='none';panel.style.display='block';
  }
  async function authenticate(session){try{await showSession(session);error('')}catch(e){panel.style.display='none';cover.style.display='grid';error(e.message||'Falha ao validar o acesso');await sb.auth.signOut()}}
  $('mq165-form').addEventListener('submit',async e=>{e.preventDefault();error('Verificando empresa e permissões...');const email=$('mq165-email').value.trim();const password=$('mq165-password').value;const result=await sb.auth.signInWithPassword({email,password});$('mq165-password').value='';if(result.error){error(result.error.message);return}await authenticate(result.data.session)});
  $('mq165-logout').addEventListener('click',async()=>{++version;panel.style.display='none';cover.style.display='grid';await sb.auth.signOut()});
  sb.auth.getSession().then(r=>{if(r.error)throw r.error;return authenticate(r.data.session)}).catch(e=>error(e.message||'Falha ao recuperar sessão'));
})();
