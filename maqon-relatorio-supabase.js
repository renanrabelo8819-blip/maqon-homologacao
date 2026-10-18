/* MAQON V1.6.11 — PDF técnico de homologação, somente dados autorizados da sessão */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id), notice=t=>{if($('report-notice'))$('report-notice').textContent=t;};
 const config=window.MAQON_SUPABASE_CONFIG||{};
 if(!window.supabase?.createClient||!config.url||!config.publishableKey)return;
 // Instância isolada de cliente usa a mesma sessão persistida de Supabase Auth.
 const db=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 let items=[],companyId=null,userId=null,seq=0;
 const clean=(v)=>String(v??'—').replace(/[\x00-\x1f]/g,' ').slice(0,2500);
 async function fetchContext(){
   const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error('Faça login para gerar um PDF.');
   const r=await db.from('maqon_usuarios').select('empresa_id,perfil,maqon_empresas(nome)').eq('usuario_id',user.id);
   if(r.error||r.data?.length!==1)throw Error('Vínculo único de empresa não confirmado.');
   return {user:user.id,company:r.data[0].empresa_id,name:r.data[0].maqon_empresas?.nome||'Empresa de teste'};
 }
 async function refresh(){const serial=++seq;try{
   const c=await fetchContext(); const r=await db.from('maqon_manutencoes').select('id,empresa_id,equipamento_id,tipo,status,data_registro,responsavel,atividade_ocorrencia,diagnostico,acao_recomendada,prioridade,data_proxima,custo_previsto,observacoes').eq('empresa_id',c.company).order('data_registro',{ascending:false}).limit(100);
   if(r.error)throw r.error;if(r.data?.some(x=>x.empresa_id!==c.company))throw Error('Inconsistência de acesso aos registros.');
   if(serial!==seq)return;companyId=c.company;userId=c.user;items=r.data||[];
   const select=$('report-maintenance');select.replaceChildren(new Option('Selecione uma manutenção',''));
   for(const m of items)select.add(new Option(`${m.data_registro||''} • ${m.tipo} • ${m.atividade_ocorrencia.slice(0,55)}`,m.id));
   notice(`Manutenções autorizadas disponíveis: ${items.length}.`);
 }catch(e){if(serial===seq){items=[];companyId=null;userId=null;$('report-maintenance').replaceChildren(new Option('Selecione uma manutenção',''));notice('Acesso indisponível: '+e.message);}}}
 function writeParagraph(pdf,label,value,state){
   const width=174,lines=pdf.splitTextToSize(`${label}: ${clean(value)}`,width);const lh=5.2;
   if(state.y+lines.length*lh>273){pdf.addPage();state.y=23;}
   pdf.setFont('helvetica','normal');pdf.setTextColor(25,40,48);pdf.setFontSize(9.5);pdf.text(lines,18,state.y);state.y+=lines.length*lh+3;
 }
 function newPage(pdf,state){pdf.addPage();state.y=22;}
 async function imageInto(pdf,d,state){
   const out=await db.storage.from('maqon-documentos-privados-v1').download(d.storage_path);
   if(out.error||!out.data)throw Error(`Acesso negado à evidência ${clean(d.titulo)}: ${out.error?.message||'erro'}`);
   const blob=out.data;
   if(!['image/png','image/jpeg','image/webp'].includes(blob.type)&&!['image/png','image/jpeg','image/webp'].includes(d.mime_type))return;
   const imageType=blob.type||d.mime_type;
   const url=URL.createObjectURL(blob);
   let dataUrl;
   try{
     const img=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Imagem privada não pôde ser aberta'));im.src=url;});
     const c=document.createElement('canvas');const factor=Math.min(1,1400/Math.max(img.width,img.height));c.width=Math.max(1,Math.round(img.width*factor));c.height=Math.max(1,Math.round(img.height*factor));c.getContext('2d').drawImage(img,0,0,c.width,c.height);dataUrl=c.toDataURL('image/jpeg',.78);
     const h=Math.min(93,160*c.height/c.width),w=h*c.width/c.height;
     if(state.y+h+45>274)newPage(pdf,state);
     writeParagraph(pdf,'Evidência',d.titulo,state);
     pdf.addImage(dataUrl,'JPEG',18,state.y,w,h);state.y+=h+4;
     writeParagraph(pdf,'Componente',d.componente_item||'—',state);
     writeParagraph(pdf,'Condição',d.condicao_identificada||'—',state);
     writeParagraph(pdf,'Prioridade',d.prioridade||'—',state);
   }finally{URL.revokeObjectURL(url);}
 }
 async function generate(){const button=$('report-generate');button.disabled=true;const ticket=++seq;
  try{
    const id=$('report-maintenance').value,found=items.find(x=>x.id===id);if(!found)throw Error('Selecione uma manutenção da sua empresa.');
    const ctx=await fetchContext();if(ctx.company!==companyId||ctx.user!==userId||found.empresa_id!==ctx.company)throw Error('Sessão ou empresa alterada; atualize a página.');
    if(!window.jspdf?.jsPDF)throw Error('Biblioteca PDF indisponível. Atualize a página e confira sua conexão.');
    notice('Consultando registros privados da empresa...');
    const eq=await db.from('maqon_equipamentos').select('id,empresa_id,categoria,fabricante,modelo,prefixo,ano').eq('id',found.equipamento_id).eq('empresa_id',ctx.company).single();
    if(eq.error||eq.data?.empresa_id!==ctx.company)throw Error('Equipamento vinculado não autorizado.');
    const dr=await db.from('maqon_documentos').select('id,empresa_id,manutencao_id,titulo,nome_arquivo,mime_type,storage_path,sistema_conjunto,componente_item,condicao_identificada,prioridade,observacoes').eq('empresa_id',ctx.company).eq('manutencao_id',found.id).order('criado_em',{ascending:true}).limit(30);
    if(dr.error)throw dr.error;if(dr.data?.some(x=>x.empresa_id!==ctx.company||x.manutencao_id!==found.id))throw Error('Inconsistência no vínculo de documentos.');
    const check=await fetchContext();if(check.company!==ctx.company||check.user!==ctx.user||ticket!==seq)throw Error('Sessão alterada durante a geração.');
    const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4'}),s={y:22};
    pdf.setFillColor(12,27,34);pdf.rect(0,0,210,14,'F');pdf.setTextColor(255,201,0);pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.text('MAQON | Relatório técnico de homologação',16,9.5);
    pdf.setTextColor(25,40,48);pdf.setFontSize(9);
    writeParagraph(pdf,'Empresa',ctx.name,s);writeParagraph(pdf,'Categoria',eq.data.categoria,s);
    writeParagraph(pdf,'Equipamento',`${eq.data.fabricante} ${eq.data.modelo} — ${eq.data.prefixo||'sem prefixo'}`,s);
    writeParagraph(pdf,'Tipo',found.tipo,s);writeParagraph(pdf,'Data',found.data_registro,s);
    writeParagraph(pdf,'Status',found.status,s);writeParagraph(pdf,'Prioridade',found.prioridade,s);
    writeParagraph(pdf,'Responsável',found.responsavel,s);writeParagraph(pdf,'Atividade/ocorrência',found.atividade_ocorrencia,s);
    writeParagraph(pdf,'Diagnóstico',found.diagnostico,s);writeParagraph(pdf,'Ação recomendada',found.acao_recomendada,s);
    writeParagraph(pdf,'Observações',found.observacoes,s);
    const docs=dr.data||[];writeParagraph(pdf,'Evidências vinculadas',`${docs.length} registro(s)`,s);
    if($('report-images').value==='sim'){
      for(const d of docs.filter(x=>String(x.mime_type).startsWith('image/')).slice(0,8)){
        if(ticket!==seq)throw Error('Sessão alterada.');
        notice(`Obtendo evidência privada: ${clean(d.titulo)}`);
        await imageInto(pdf,d,s);
      }
    }
    const final=await fetchContext();if(final.company!==ctx.company||final.user!==ctx.user||ticket!==seq)throw Error('Sessão alterada; PDF não será salvo.');
    const pages=pdf.getNumberOfPages();for(let n=1;n<=pages;n++){pdf.setPage(n);pdf.setFontSize(8);pdf.setTextColor(100);pdf.text(`Homologação — dados fictícios | Página ${n}/${pages}`,18,290);}
    pdf.save(`MAQON_Relatorio_Teste_${found.data_registro||'manutencao'}.pdf`);
    notice('PDF de homologação gerado localmente. Não é ainda o modelo Premium definitivo.');
  }catch(e){notice('Não foi possível gerar: '+(e.message||'erro desconhecido'));}finally{button.disabled=false;}
 }
 $('report-generate')?.addEventListener('click',generate);
 $('report-refresh')?.addEventListener('click',refresh);
 db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'){++seq;companyId=null;userId=null;items=[];$('report-maintenance').replaceChildren(new Option('Selecione uma manutenção',''));notice('');}else if(event==='SIGNED_IN'||event==='INITIAL_SESSION')setTimeout(refresh,100);});
 setTimeout(refresh,300);
})();
