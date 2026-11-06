/* ---------- CONSULTOR: metas que ele mesmo escolhe (na segunda, pra semana toda) e o retorno ao salvar o dia ---------- */
let MEDIT=false, MRESUMO=null;
const METAS_CAMPOS=[
  ['abord_dia','Abordagens por dia','WhatsApp + Insta + Messenger','obrigatória'],
  ['lig_dia','Ligações por dia','',''],
  ['follow_dia','Follow-ups por dia','',''],
  ['reun_sem','Reuniões agendadas na semana','',''],
];
const nf=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
const sorte=a=>a[Math.floor(Math.random()*a.length)];
const temMetas=()=>EU&&EU.metas_proprias&&Number(EU.metas_proprias.abord_dia)>0;
/* segunda-feira e as metas em vigor ainda são da semana passada: pede pra confirmar ou ajustar */
const revisarSegunda=()=>EU&&temMetas()&&EU.pode_metas&&dData(EU.hoje).getDay()===1&&String(EU.metas_semana||'')<segDaSemana(EU.hoje);

/* ---------- card das metas (topo do "Meu dia") ---------- */
function htmlMetas(){
  if(!EU) return '';
  const mp=EU.metas_proprias||{}, ref=EU.ref_semana||{}, seg=dData(EU.hoje).getDay()===1;
  if(MRESUMO) return htmlResumoMetas();
  const rev=revisarSegunda();
  if(MEDIT||!temMetas()||rev){
    const sug=EU.metas_sugestao||{};
    return `<section class="card metas-card${temMetas()&&!rev?'':' destaque'}">
      <h2 style="font-size:17px">${rev?'Semana nova! Confirma tuas metas':temMetas()?'Ajustar minhas metas':'Quanto tu vai fazer essa semana?'}</h2>
      <p class="sub">${rev?'Já deixei as da semana passada. Mantém ou ajusta pro que tu realmente vai cumprir até sexta.':temMetas()?'Escolhe o que tu realmente vai cumprir.':'Tu escolhe tuas metas. Coloca o que tu realmente vai cumprir, não o que fica bonito. Elas valem a semana toda e só mudam na segunda.'}</p>
      ${ref.dias?`<div class="dica" style="margin-top:12px">Semana passada tu lançou ${ref.dias} ${ref.dias===1?'dia':'dias'}: média de <b>${nf(ref.abord_dia)} abordagens</b>, ${nf(ref.lig_dia)} ligações e ${nf(ref.follow_dia)} follow-ups por dia, e <b>${nf(ref.reun_sem)} reuniões</b> agendadas.</div>`:''}
      <div class="metas-form">${METAS_CAMPOS.map(([k,rot,sub,ob])=>{ const v=mp[k]||'', s=Number(sug[k])||0;
        return `<div class="campo"><label for="mt-${k}">${rot}${ob?' <span style="color:var(--vermelho)">*</span>':''}</label>
          <input id="mt-${k}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="${k==='abord_dia'?'ex: 60':'opcional'}" value="${v}" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
          ${sub||s?`<div class="fal" style="margin-top:3px">${[sub,s?`sugestão do gestor: ${s}`:''].filter(Boolean).join(' · ')}</div>`:''}</div>`; }).join('')}</div>
      <div class="erro" id="mtErro"></div>
      <button class="btn forte cheio" id="btMetas" onclick="salvarMetas()">${rev?'Confirmar metas da semana':temMetas()?'Salvar metas':'Definir minhas metas'}</button>
      ${temMetas()&&!rev?`<div class="fim" style="margin-top:8px"><button class="link" onclick="MEDIT=false;render()">Cancelar</button></div>`:''}
    </section>`;
  }
  const itens=METAS_CAMPOS.filter(([k])=>mp[k]>0);
  return `<section class="card metas-card">
    <div class="gcab"><h3>Minhas metas da semana</h3>${EU.pode_metas?`<button class="link" style="padding:0" onclick="MEDIT=true;render()">ajustar</button>`:'<span>🔒 até segunda</span>'}</div>
    <div class="metas-lista">${itens.map(([k,rot])=>`<div><b>${mp[k]}</b><span>${rot.toLowerCase()}</span></div>`).join('')}</div>
    ${seg&&EU.pode_metas?'<div class="sub" style="margin-top:8px">Hoje é segunda: dá pra revisar tuas metas pra essa semana.</div>':''}
  </section>`;
}
async function salvarMetas(){
  const m={}; METAS_CAMPOS.forEach(([k])=>m[k]=parseInt($('mt-'+k).value,10)||0);
  if(!m.abord_dia){ $('mtErro').textContent='Coloca pelo menos a meta de abordagens por dia.'; $('mt-abord_dia').focus(); return; }
  const bt=$('btMetas'); bt.disabled=true; bt.textContent='Salvando…'; $('mtErro').textContent='';
  try{
    const anterior=Object.assign({},EU.metas_proprias||{});
    const r=await nuvem('app_metas_salvar',{p_token:TOKEN,p_metas:m});
    EU.metas_proprias=r; EU.metas_semana=segDaSemana(EU.hoje); EU.metas=Object.assign({},EU.metas,r); ['lig_dia','follow_dia','reun_sem'].forEach(k=>{ if(!r[k]) delete EU.metas[k]; });
    MEDIT=false; MRESUMO={m:r,anterior}; render(); window.scrollTo(0,0);
  }catch(e){
    if(sessaoCaiu(e)) return sair('Tua sessão foi encerrada. Entra de novo.');
    const msg=String(e.message||'');
    $('mtErro').textContent=msg.includes('metas_travadas')?'As metas só mudam na segunda. Se precisar mudar antes, fala com teu gestor.':erroTxt(e);
    bt.disabled=false; bt.textContent='Salvar metas';
  }
}
/* resumo logo depois de definir: o que a meta significa na semana e quanto falta pro que ele vem fazendo */
function htmlResumoMetas(){
  const m=MRESUMO.m, ref=EU.ref_semana||{}, pn=EU.nome.split(' ')[0], lin=[];
  lin.push(`<b>${m.abord_dia} abordagens por dia</b> = ${m.abord_dia*5} na semana.`);
  if(ref.dias&&ref.abord_dia!=null){ const d=m.abord_dia-ref.abord_dia;
    lin.push(d>0?`Semana passada tua média foi ${nf(ref.abord_dia)}. Pra bater, são <b>+${nf(d)} por dia</b>. Bloqueia um horário fixo só pra isso.`
      :d<0?`Semana passada tua média foi ${nf(ref.abord_dia)}, acima da meta nova. Se tu baixou porque tava pesado, beleza, mas conversa com teu gestor.`
      :`É o mesmo ritmo da semana passada. Agora é manter todo dia.`); }
  if(m.lig_dia) lin.push(`<b>${m.lig_dia} ligações por dia</b>${ref.dias?` (semana passada: ${nf(ref.lig_dia)})`:''}.`);
  if(m.follow_dia) lin.push(`<b>${m.follow_dia} follow-ups por dia</b>${ref.dias?` (semana passada: ${nf(ref.follow_dia)})`:''}.`);
  if(m.reun_sem) lin.push(`<b>${m.reun_sem} reuniões agendadas</b> até sexta, umas ${nf(Math.ceil(m.reun_sem/5*10)/10)} por dia.`);
  return `<section class="card metas-card destaque">
    <h2 style="font-size:17px">Fechado, ${esc(pn)}! Metas da semana ✓</h2>
    <ul class="resumo-l">${lin.map(x=>`<li>${x}</li>`).join('')}</ul>
    <p class="sub">A partir de agora tudo no app compara contigo mesmo, com essas metas. Elas ficam travadas até segunda.</p>
    <button class="btn cheio" style="margin-top:12px" onclick="MRESUMO=null;render()">Bora lançar o dia</button>
  </section>`;
}

/* ---------- retorno ao salvar o dia ---------- */
/* olha o dia salvo e os últimos 5 dias úteis lançados (com ele), sempre contra as metas que ele escolheu */
function analisarDia(dia){
  const l=DIAS[dia], m=Object.assign({},DIAG_METAS_PADRAO,EU.metas||{}), pn=EU.nome.split(' ')[0];
  const janela=Object.keys(DIAS).filter(s=>s<=dia&&util(s)).sort().slice(-5).map(s=>DIAS[s]);
  const t={}; ['whats','insta','messenger','ligacoes','lig_atendidas','respostas','interessados','followups','simulacoes','reun_agendadas','reun_feitas','fech_qtd'].forEach(k=>t[k]=janela.reduce((a,x)=>a+(x[k]||0),0));
  t.ab=t.whats+t.insta+t.messenger; t.fech_valor=janela.reduce((a,x)=>a+(Number(x.fech_valor)||0),0);
  const ab=(l.whats||0)+(l.insta||0)+(l.messenger||0), n=janela.length;
  const bateu=m.abord_dia&&ab>=m.abord_dia, perto=m.abord_dia&&ab>=m.abord_dia*0.8;
  const r={titulo:'',meta:[],atencao:[],bom:[],dica:'',gestor:false};
  // título
  r.titulo=bateu?sorte([`Boa, ${pn}! Dia lançado ✓`,`Valeu, ${pn}! Dia lançado ✓`,`É isso, ${pn}! Dia lançado ✓`])
    :sorte([`Dia lançado ✓, ${pn}`,`Valeu por lançar, ${pn} ✓`]);
  // metas do dia
  if(m.abord_dia) r.meta.push(bateu?`Bateu tua meta: <b>${ab} abordagens</b> de ${m.abord_dia} 🔥`
    :perto?`Quase: <b>${ab} abordagens</b> de ${m.abord_dia}. Faltaram ${m.abord_dia-ab}.`
    :`Ficou em <b>${ab} de ${m.abord_dia} abordagens</b>. ${sorte(['Acontece.','Amanhã tu recupera.','Dia que não rendeu, segue o jogo.'])}`);
  if(m.lig_dia) r.meta.push((l.ligacoes||0)>=m.lig_dia?`Ligações: <b>${l.ligacoes}</b> de ${m.lig_dia} ✓`:`Ligações: <b>${l.ligacoes||0}</b> de ${m.lig_dia}.`);
  if(m.follow_dia) r.meta.push((l.followups||0)>=m.follow_dia?`Follow-ups: <b>${l.followups}</b> de ${m.follow_dia} ✓`:`Follow-ups: <b>${l.followups||0}</b> de ${m.follow_dia}.`);
  if(m.reun_sem){ const seg=soma(dia,-((dData(dia).getDay()+6)%7)), rs=Object.keys(DIAS).filter(s=>s>=seg&&s<=dia&&util(s)).reduce((a,s)=>a+(DIAS[s].reun_agendadas||0),0);
    r.meta.push(rs>=m.reun_sem?`Reuniões da semana: <b>${rs}</b> de ${m.reun_sem}. Meta batida ✓`:`Reuniões da semana até aqui: <b>${rs}</b> de ${m.reun_sem}.`); }
  // atenção: mesma leitura do painel, nos últimos dias
  const dg=diagnostico(t,m,n,n), DICA={
    volume:'Bloqueia o primeiro horário do dia só pra abordagem, antes de abrir qualquer outra coisa.',
    resposta:'Testa outra mensagem de abertura em 20 contatos amanhã e compara o retorno.',
    interesse:'Antes de falar de consórcio, pergunta o que a pessoa quer conquistar. Depois mostra o caminho.',
    simulacao:'Manda a simulação pra quem se interessou hoje ainda, enquanto tá quente.',
    reuniao:'Depois de mandar a simulação, já oferece dois horários pra conversar.',
    noshow:'Confirma toda reunião na véspera e sai da conversa com dia e hora fechados.',
    fechamento:'Na próxima reunião, pergunta no fim: "o que falta pra gente fechar hoje?"',
    followup:'Separa 20 minutos no fim da tarde só pra retomar quem respondeu e esfriou.',
    ligacao:'Escolhe 5 contatos quentes e liga antes do almoço. Ligação rende mais que mensagem.',
    atendidas:'Testa ligar em outro horário, tipo começo da manhã ou depois das 18h.',
    reun_meta:'Puxa pra reunião todo interessado que já viu a simulação.',
  };
  if(bateu&&t.ab>=100&&t.respostas/t.ab<0.10){
    r.atencao.push({t:'Meta batida, mas pouco retorno',d:`Nos últimos ${n} dias, só ${diagPct(t.respostas,t.ab)} das abordagens tiveram resposta. Será o script ou a lista?`});
    r.dica=DICA.resposta;
  }
  dg.r.filter(x=>!(r.atencao.length&&x.k==='resposta')&&!(bateu&&x.k==='volume')).slice(0,2-r.atencao.length).forEach(x=>{ r.atencao.push({t:x.t,d:x.d}); if(!r.dica) r.dica=DICA[x.k]||''; });
  // o que andou bem (hoje primeiro, depois a semana)
  const melhorDia=Object.keys(DIAS).filter(s=>s!==dia&&s<dia&&util(s)).sort().slice(-4).every(s=>ab>=((DIAS[s].whats||0)+(DIAS[s].insta||0)+(DIAS[s].messenger||0)));
  if(l.fech_qtd) r.bom.push(`${l.fech_qtd} ${l.fech_qtd===1?'fechamento':'fechamentos'} hoje${l.fech_valor?` (${'R$ '+Number(l.fech_valor).toLocaleString('pt-BR',{maximumFractionDigits:0})})`:''} 🏆`);
  else if(l.reun_feitas) r.bom.push(`${l.reun_feitas} ${l.reun_feitas===1?'reunião feita':'reuniões feitas'} hoje`);
  else if(l.reun_agendadas) r.bom.push(`${l.reun_agendadas} ${l.reun_agendadas===1?'reunião agendada':'reuniões agendadas'} hoje`);
  else if(l.simulacoes) r.bom.push(`${l.simulacoes} ${l.simulacoes===1?'simulação enviada':'simulações enviadas'} hoje`);
  if(n>=3&&melhorDia&&ab>0&&!bateu) r.bom.push('Teu melhor dia de abordagens nos últimos dias');
  if(ab>=20&&(l.respostas||0)/ab>=0.2) r.bom.push(`Boa resposta hoje: ${diagPct(l.respostas,ab)} responderam`);
  dg.ok.filter(o=>!/Volume em dia/.test(o)||!bateu).slice(0,1).forEach(o=>r.bom.push(o));
  r.bom=r.bom.slice(0,2);
  if(!r.dica) r.dica=bateu?sorte(['Mantém o ritmo amanhã e começa pelos follow-ups de quem respondeu hoje.','Amanhã, antes de abordar gente nova, retoma quem respondeu hoje.'])
    :sorte(['Amanhã começa pelas abordagens, antes de qualquer outra coisa.','Define agora o horário que tu vai fazer as abordagens amanhã.']);
  r.gestor=r.atencao.length>0;
  return r;
}
function mostrarRetorno(dia){
  const ov=document.createElement('div'); ov.className='ret-ov'; ov.id='retOv';
  ov.innerHTML=`<div class="ret"><div class="ret-carregando"><span class="ret-pt"></span><span class="ret-pt"></span><span class="ret-pt"></span><div>Analisando teu dia…</div></div></div>`;
  document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add('on'));
  setTimeout(()=>{
    let r; try{ r=analisarDia(dia); }catch(e){ fecharRetorno(); toast('Salvo ✓ teu gestor já vê no painel'); return; }
    ov.querySelector('.ret').innerHTML=`
      <h2>${r.titulo}</h2>
      ${r.meta.length?`<div class="ret-meta">${r.meta.map(x=>`<div>${x}</div>`).join('')}</div>`:''}
      ${r.atencao.map(a=>`<div class="ret-bl at"><b>Atenção: ${esc(a.t.charAt(0).toLowerCase()+a.t.slice(1))}</b><div>${esc(a.d)}</div></div>`).join('')}
      ${r.bom.length?`<div class="ret-bl bom"><b>O que andou bem</b>${r.bom.map(x=>`<div>${esc(x)}</div>`).join('')}</div>`:''}
      ${r.dica?`<div class="ret-bl dc"><b>Pra amanhã</b><div>${esc(r.dica)}</div></div>`:''}
      ${r.gestor?`<div class="ret-pe">Leva isso pro teu gestor no X1. O app mostra onde o número travou, o porquê vocês descobrem juntos.</div>`:''}
      <button class="btn forte cheio" style="margin-top:14px" onclick="fecharRetorno()">Valeu!</button>`;
  },1300);
}
function fecharRetorno(){ const ov=$('retOv'); if(!ov) return; ov.classList.remove('on'); setTimeout(()=>ov.remove(),200); }
