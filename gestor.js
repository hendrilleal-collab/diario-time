/* ---------- MODO GESTOR: resumo do dia, alerta de X1 e pauta do X1 semanal ---------- */
/* Entra com a chave do painel. Lê os mesmos dados que a aba Diário do time do painel. */
const DCAMPOS=['whats','insta','messenger','ligacoes','lig_atendidas','respostas','interessados','followups','simulacoes','reun_agendadas','reun_feitas','fech_qtd'];
let CHAVE=ler('diario_chave'), G={hoje:null,metas:{},cons:[],rows:[],x1s:[]}, gAba='hoje', gCons=null, gSem=null, gMes='este', gEditando=false;
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesIni=(s,k)=>{ const d=dData(s); return iso(new Date(d.getFullYear(),d.getMonth()+k,1)); };
const mesFim=(s,k)=>{ const d=dData(s); return iso(new Date(d.getFullYear(),d.getMonth()+k+1,0)); };
const ultimoX1=(cid,ate)=>G.x1s.filter(x=>x.consultor_id===cid&&(!ate||x.dia<=ate)).sort((a,b)=>b.dia.localeCompare(a.dia))[0]||null;

const dAb=l=>(l.whats||0)+(l.insta||0)+(l.messenger||0);
function dSomar(ls){ const t={n:ls.length,fech_valor:0}; DCAMPOS.forEach(k=>t[k]=0); ls.forEach(l=>{ DCAMPOS.forEach(k=>t[k]+=l[k]||0); t.fech_valor+=Number(l.fech_valor)||0; }); t.ab=t.whats+t.insta+t.messenger; return t; }
function metasDe(c){ return Object.assign({},DIAG_METAS_PADRAO,{abord_dia:G.metas.abord_dia||100,pct_min:G.metas.pct_min||70},(c&&c.metas)||{}); }
const linhaDia=(cid,s)=>G.rows.find(l=>l.consultor_id===cid&&l.dia===s)||null;
const linhasDe=(cid,de,ate)=>G.rows.filter(l=>l.consultor_id===cid&&l.dia>=de&&l.dia<=ate&&util(l.dia));
const segDe=s=>soma(s,-((dData(s).getDay()+6)%7));
const fmtR=v=>'R$ '+Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
const nome1=c=>c.nome.split(' ')[0];

/* mesma regra do painel: últimos 5 dias úteis antes de hoje, contando só depois que liberou o app */
function alertaX1(c){
  const m=G.metas, ini=c.criado?String(c.criado).slice(0,10):'', uteis=[]; let s=soma(G.hoje,-1);
  while(uteis.length<5){ if(util(s)) uteis.push(s); s=soma(s,-1); }
  for(let i=uteis.length-1;i>=0;i--) if(uteis[i]<ini) uteis.splice(i,1);
  const motivos=[]; let sem=0; for(const u of uteis){ if(!linhaDia(c.id,u)) sem++; else break; }
  if(sem>=(m.dias_sem_lancar||2)) motivos.push({g:2,t:sem+' dias úteis seguidos sem lançar'});
  const ls=uteis.map(u=>linhaDia(c.id,u)).filter(Boolean), dg=diagnostico(dSomar(ls),metasDe(c),ls.length,uteis.length);
  dg.r.forEach(x=>motivos.push(x));
  let st=motivos.some(x=>x.g===2)||motivos.length>=3?'x1':motivos.length?'olho':'ok';
  const ux=ultimoX1(c.id), dx=ux?Math.round((dData(G.hoje)-dData(ux.dia))/864e5):null;
  if(st!=='ok'&&dx!=null&&dx<=2) st='feito';
  if(st==='ok'&&uteis.length<2) st='novo';
  return {st,motivos};
}
const ST={x1:['no','Precisa de X1'],olho:['ne','Fica de olho'],ok:['ok','Tudo certo'],feito:['ok','X1 já feito'],novo:['ne','Começando']};

const PERGUNTAS={
  volume:m=>`O que tá tomando teu tempo e impedindo de chegar nas ${m.abord_dia} abordagens por dia? Qual horário fixo tu consegue bloquear só pra prospecção?`,
  resposta:()=>'Me mostra a mensagem de abertura que tu tá usando. De onde tá vindo a lista de contatos?',
  interesse:()=>'Como tu apresenta o consórcio depois que a pessoa responde? Bora treinar essa parte agora?',
  simulacao:()=>'Quem são os interessados que ainda não receberam simulação? Até quando tu manda?',
  reuniao:()=>'O que tu fala depois de mandar a simulação? Como tu puxa pra reunião?',
  noshow:()=>'Tu confirma a reunião na véspera? Tá saindo da conversa com dia e hora fechados?',
  lancar:()=>'O que tá impedindo de lançar todo dia? Que horário fica fixo pra lançar (antes das 19h)?',
  fechamento:()=>'Me conta a última reunião: em que ponto o cliente travou?',
  followup:()=>'Quantos contatos estão parados esperando retorno teu? Qual é a tua rotina de follow-up?',
  ligacao:()=>'O que te impede de ligar? Qual meta de ligações tu topa pra próxima semana?',
  atendidas:()=>'Em que horários tu tá ligando? Bora testar outros horários essa semana.',
  reun_meta:m=>`Quantas reuniões tu consegue se comprometer pra próxima semana? A meta é ${m.reun_sem}.`,
};

async function gestorIniciar(){
  MODO='gestor'; $('rodape').classList.add('oculto');
  if(!CHAVE) return gestorEntrar();
  $('quem').innerHTML='<b>Gestor</b>carregando…';
  $('app').innerHTML=`<div class="card"><div class="carregando">carregando o time…</div></div>`;
  try{
    const ok=await nuvem('g_ok',{p_chave:CHAVE}); G.hoje=ok.hoje; G.metas=ok.metas||{};
    const de=[soma(segDe(G.hoje),-21),mesIni(G.hoje,-2)].sort()[0];
    const [cons,rows,x1s]=await Promise.all([nuvem('g_consultores',{p_chave:CHAVE}),nuvem('g_lancamentos',{p_chave:CHAVE,p_de:de,p_ate:G.hoje}),nuvem('g_x1_lista',{p_chave:CHAVE,p_de:mesIni(G.hoje,-6)})]);
    G.cons=(cons||[]).filter(c=>c.ativo&&c.tem_pin); G.rows=rows||[]; G.x1s=x1s||[]; gEditando=false;
    if(!gCons||!G.cons.some(c=>c.id===gCons)) gCons=G.cons[0]&&G.cons[0].id;
    // seg a qua: a pauta abre na semana passada (a atual ainda tem pouco dado)
    if(!gSem){ const w=dData(G.hoje).getDay(); gSem=w>=1&&w<=3?'passada':'esta'; }
    gestorRender();
  }catch(e){
    if(String(e.message).includes('chave_invalida')){ CHAVE=null; gravar('diario_chave',null); return gestorEntrar('A chave não confere. Pega ela no painel, no fim da aba Diário do time.'); }
    $('app').innerHTML=`<div class="card"><div class="erro">${esc(erroTxt(e))}</div><button class="btn" onclick="gestorIniciar()">Tentar de novo</button></div>`;
  }
}
function gestorEntrar(aviso){
  $('quem').innerHTML='';
  $('app').innerHTML=`<section class="card"><h2>Modo gestor</h2>
    <p class="sub">Entra com a <b>chave do painel</b> (fica no painel, no fim da aba Diário do time, em "Chave do painel").</p>
    ${aviso?`<div class="dica">${esc(aviso)}</div>`:''}
    <input class="pin" id="chave" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="font-size:18px;letter-spacing:.08em;padding-left:0" aria-label="Chave do painel">
    <button class="link" type="button" onclick="const i=$('chave');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'mostrar a chave':'esconder a chave'">mostrar a chave</button>
    <div class="erro" id="chErro"></div>
    <button class="btn forte cheio" id="btCh">Entrar</button>
    <div class="fim"><button class="link" onclick="sairGestor()">Voltar pro app do consultor</button></div></section>`;
  const ir=async()=>{ const v=$('chave').value.trim(); if(!v) return; $('btCh').disabled=true;
    try{ await nuvem('g_ok',{p_chave:v}); CHAVE=v; gravar('diario_chave',v); gestorIniciar(); }
    catch(e){ $('chErro').textContent=String(e.message).includes('chave_invalida')?'Chave errada.':erroTxt(e); $('btCh').disabled=false; } };
  $('btCh').onclick=ir; $('chave').addEventListener('keydown',e=>{ if(e.key==='Enter') ir(); }); $('chave').focus();
}
function sairGestor(){ MODO='consultor'; history.replaceState(null,'',location.pathname); TOKEN?iniciar():telaEntrar(); }
function esquecerChave(){ if(!confirm('Tirar a chave deste aparelho?')) return; CHAVE=null; gravar('diario_chave',null); gestorEntrar(); }

function gestorRender(){
  const dt=dData(G.hoje);
  $('quem').innerHTML=`<b>Gestor</b>${DSEM[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}`;
  $('app').innerHTML=`
    <div class="abas"><button class="${gAba==='hoje'?'on':''}" onclick="gAba='hoje';gestorRender()">Hoje</button><button class="${gAba==='x1'?'on':''}" onclick="gAba='x1';gestorRender()">Pauta do X1</button><button class="${gAba==='mes'?'on':''}" onclick="gAba='mes';gestorRender()">Mês</button></div>
    <div id="gConteudo">${G.cons.length?(gAba==='hoje'?gHoje():gAba==='mes'?gMesHtml():gPauta()):`<div class="card"><div class="sub">Ninguém liberado no app ainda. Libera o time no painel, em Diário do time → Acesso ao app.</div></div>`}</div>
    ${gAba==='hoje'?'<section class="card" id="lembrete"></section>':''}
    <div class="fim"><button class="link" onclick="sairGestor()">Ir pro app do consultor</button> · <button class="link" onclick="esquecerChave()">Tirar a chave deste aparelho</button></div>`;
  if(gAba==='hoje') renderLembreteGestor();
  window.scrollTo(0,0);
}

function gHoje(){
  const h=G.hoje, ls=G.cons.map(c=>linhaDia(c.id,h)).filter(Boolean), t=dSomar(ls), al=G.cons.map(c=>({c,a:alertaX1(c),l:linhaDia(c.id,h)}));
  const nX1=al.filter(x=>x.a.st==='x1').length;
  return `<section class="card">
      <div class="gcab"><h3>Hoje</h3><span>${ls.length} de ${G.cons.length} lançaram</span></div>
      <div class="kpis"><div><small>Abordagens</small><b>${t.ab}</b></div><div><small>Respostas</small><b>${t.respostas}</b></div><div><small>Reuniões ag.</small><b>${t.reun_agendadas}</b></div><div><small>Fechamentos</small><b>${t.fech_qtd}</b></div></div>
    </section>
    <div class="titulo">Time${nX1?` · <span style="color:var(--vermelho)">${nX1} ${nX1===1?'pede':'pedem'} X1</span>`:''}</div>
    <section class="card lista">${al.map(({c,a,l})=>{ const m=metasDe(c);
      return `<button class="linha" onclick="gAba='x1';gCons='${esc(c.id)}';gestorRender()">
        <div class="ln1"><b>${esc(c.nome)}</b><span class="st ${ST[a.st][0]}">${ST[a.st][1]}</span></div>
        <div class="ln2">${l?`Hoje: <b>${dAb(l)}</b>${m.abord_dia?` de ${m.abord_dia}`:''} abordagens · ${l.reun_agendadas||0} reun. · ${l.fech_qtd||0} fech.`:'<span style="color:var(--ambar)">Ainda não lançou hoje</span>'}</div>
        ${a.motivos.length?`<div class="ln3">${a.motivos.slice(0,3).map(x=>esc(x.t)).join(' · ')}</div>`:''}</button>`; }).join('')}
    </section>
    <p class="sub" style="margin-top:8px">O alerta olha os últimos 5 dias úteis (sem contar hoje). Depois que tu registra o X1 na Pauta, ele vira "X1 já feito" por 2 dias.</p>`;
}

function semana(qual){ const seg=segDe(G.hoje), s=qual==='passada'?soma(seg,-7):seg, sex=soma(s,4); return {de:s,ate:sex,fim:sex<G.hoje?sex:G.hoje}; }
function varTxt(a,b){ if(!b) return a?'novo':'–'; const p=Math.round((a-b)/b*100); return p===0?'=':(p>0?'▲ ':'▼ ')+Math.abs(p)+'%'; }
function pautaDados(c,qual){
  const s=semana(qual), ant={de:soma(s.de,-7),ate:soma(s.ate,-7)}, uteis=[]; for(let d=s.de;d<=s.fim;d=soma(d,1)) if(util(d)) uteis.push(d);
  const ls=linhasDe(c.id,s.de,s.ate), la=linhasDe(c.id,ant.de,ant.ate), t=dSomar(ls), ta=dSomar(la), m=metasDe(c);
  const dg=diagnostico(t,m,ls.length,uteis.length), faltaram=uteis.length-ls.length;
  if(ls.length>=2&&faltaram>=2) dg.r.unshift({g:2,k:'lancar',t:`Lançou só ${ls.length} de ${uteis.length} dias`,d:'Os números da semana ficam incompletos. Sem lançar todo dia não dá pra ver onde tá travando.'});
  const falt=ls.filter(l=>l.faltou&&l.faltou.trim());
  const perg=dg.r.map(x=>PERGUNTAS[x.k]&&PERGUNTAS[x.k](m)).filter(Boolean);
  if(!dg.r.length&&ls.length>=2) perg.push('O que tu fez diferente essa semana que funcionou? Como a gente repete isso?');
  // compromisso que valia pra essa semana: último X1 antes da sexta dela
  const comp=ultimoX1(c.id,soma(s.ate,-1)), md=ls.length?Math.round(t.ab/ls.length):0;
  const cumpriu=comp?[[comp.meta_abord,'Abordagens/dia (média)',md],[comp.meta_reun,'Reuniões agendadas',t.reun_agendadas],[comp.meta_fech,'Fechamentos',t.fech_qtd]].filter(x=>x[0]>0):[];
  if(cumpriu.some(([m,,v])=>v<m)) perg.unshift('No último X1 a gente combinou '+cumpriu.map(([m,r])=>`${r.toLowerCase()}: ${m}`).join(', ')+'. O que aconteceu?');
  perg.push('Qual é o teu compromisso pra próxima semana? (número de abordagens, reuniões e fechamentos)');
  return {s,uteis,ls,t,ta,m,dg,falt,perg,comp,cumpriu};
}
function gPauta(){
  const c=G.cons.find(x=>x.id===gCons), p=pautaDados(c,gSem), {t,ta,m,dg}=p, de=dData(p.s.de), ate=dData(p.s.ate);
  const md=p.ls.length?t.ab/p.ls.length:0;
  const linhasNum=[['Abordagens','ab'],['Ligações','ligacoes'],['Respostas','respostas'],['Interessados','interessados'],['Follow-ups','followups'],['Simulações','simulacoes'],['Reuniões agendadas','reun_agendadas'],['Reuniões feitas','reun_feitas'],['Fechamentos','fech_qtd']];
  const funil=[['Abordagem → resposta',t.respostas,t.ab],['Resposta → interessado',t.interessados,t.respostas],['Interessado → simulação',t.simulacoes,t.interessados],['Simulação → reunião',t.reun_agendadas,t.simulacoes],['Reunião agendada → feita',t.reun_feitas,t.reun_agendadas],['Reunião feita → fechamento',t.fech_qtd,t.reun_feitas]];
  return `<div class="chips">${G.cons.map(x=>`<button class="${x.id===gCons?'on':''}" onclick="gCons='${esc(x.id)}';gestorRender()">${esc(nome1(x))}</button>`).join('')}</div>
    <div class="chips" style="margin-top:6px"><button class="${gSem==='esta'?'on':''}" onclick="gSem='esta';gestorRender()">Esta semana</button><button class="${gSem==='passada'?'on':''}" onclick="gSem='passada';gestorRender()">Semana passada</button></div>
    <section class="card">
      <div class="gcab"><h3>${esc(c.nome)}</h3><span>${de.getDate()}/${de.getMonth()+1} a ${ate.getDate()}/${ate.getMonth()+1}</span></div>
      <div class="kpis"><div><small>Lançou</small><b>${p.ls.length}/${p.uteis.length}</b></div><div><small>Média abord./dia</small><b>${Math.round(md)}</b>${m.abord_dia?`<i>meta ${m.abord_dia}</i>`:''}</div><div><small>Reuniões</small><b>${t.reun_agendadas}</b><i>${t.reun_feitas} feitas</i></div><div><small>Vendido</small><b>${t.fech_qtd}</b><i>${fmtR(t.fech_valor)}</i></div></div>
      ${p.ls.length<2?`<div class="dica">Ele lançou ${p.ls.length===1?'só 1 dia':'nenhum dia'} nessa semana. Sem número não tem diagnóstico: começa o X1 por aí.</div>`:''}
    </section>
    ${p.comp?`<div class="titulo">Compromisso do X1 de ${dData(p.comp.dia).getDate()}/${dData(p.comp.dia).getMonth()+1}</div><section class="card">
      ${p.comp.compromisso?`<div class="sub" style="color:var(--preto);font-size:14px;margin-bottom:6px">${esc(p.comp.compromisso)}</div>`:''}
      ${p.cumpriu.length?`<table class="tab"><thead><tr><th></th><th>Prometeu</th><th>Fez</th><th></th></tr></thead><tbody>${p.cumpriu.map(([m,r,v])=>`<tr><td>${r}</td><td>${m}</td><td><b>${v}</b></td><td class="var">${v>=m?'<span style="color:var(--ok)">✓ cumpriu</span>':'<span style="color:var(--vermelho)">não cumpriu</span>'}</td></tr>`).join('')}</tbody></table>`:''}
    </section>`:''}
    ${dg.r.length?`<div class="titulo">Onde tá travando</div><section class="card">${dg.r.map(x=>`<div class="item ${x.g===2?'grave':''}"><b>${esc(x.t)}</b><div>${esc(x.d)}</div></div>`).join('')}</section>`:''}
    ${dg.ok.length?`<div class="titulo">O que tá funcionando · elogia</div><section class="card">${dg.ok.map(x=>`<div class="item bom">${esc(x)}</div>`).join('')}</section>`:''}
    <div class="titulo">Perguntas pro X1</div>
    <section class="card"><ol class="perg">${p.perg.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></section>
    ${p.falt.length?`<div class="titulo">O que ele escreveu que faltou</div><section class="card">${p.falt.map(l=>{ const d=dData(l.dia); return `<div class="item"><span class="fal">${DSEM[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}</span> ${esc(l.faltou)}</div>`; }).join('')}</section>`:''}
    <div class="titulo">Números da semana</div>
    <section class="card"><table class="tab"><thead><tr><th></th><th>Semana</th><th>Anterior</th><th></th></tr></thead><tbody>
      ${linhasNum.map(([r,k])=>`<tr><td>${r}</td><td><b>${t[k]}</b></td><td>${ta[k]}</td><td class="var">${varTxt(t[k],ta[k])}</td></tr>`).join('')}
    </tbody></table></section>
    <div class="titulo">Funil</div>
    <section class="card"><table class="tab"><tbody>${funil.map(([r,a,b])=>`<tr><td>${r}</td><td><b>${b?Math.round(a/b*100)+'%':'–'}</b></td><td class="fal">${a} de ${b}</td></tr>`).join('')}</tbody></table></section>
    <button class="btn cheio" style="margin-top:16px" onclick="copiarPauta()">Copiar pauta</button>
    ${formX1(c,m)}
    ${historicoX1(c)}`;
}
/* ---------- registrar o X1 (fica no banco: igual no iPhone, iPad e computador) ---------- */
function formX1(c,m){
  const x=G.x1s.find(y=>y.consultor_id===c.id&&y.dia===G.hoje), ant=ultimoX1(c.id);
  const v=(k,pad)=>x?x[k]:(ant?ant[k]:pad);
  return `<div class="titulo">${x?'X1 de hoje · editar':'Registrar o X1 de hoje'}</div>
    <section class="card" id="formX1" oninput="gEditando=true">
      <p class="sub" style="margin-top:0;margin-bottom:12px">O que ficou combinado. ${esc(nome1(c))} vê o compromisso e as metas no app dele a semana toda. As anotações são só tuas.</p>
      <div class="campos">
        <div class="campo"><label for="x-abord">Abordagens/dia</label><input id="x-abord" inputmode="numeric" pattern="[0-9]*" value="${v('meta_abord',m.abord_dia||'')||''}"></div>
        <div class="campo"><label for="x-reun">Reuniões na semana</label><input id="x-reun" inputmode="numeric" pattern="[0-9]*" value="${v('meta_reun',m.reun_sem||'')||''}"></div>
        <div class="campo"><label for="x-fech">Fechamentos na semana</label><input id="x-fech" inputmode="numeric" pattern="[0-9]*" value="${v('meta_fech','')||''}"></div>
      </div>
      <div class="campo" style="margin-top:10px"><label for="x-comp">Compromisso (ele vê)</label><textarea id="x-comp" maxlength="1500" placeholder="Ex.: bloquear 9h às 11h só pra prospecção e ligar pros interessados no mesmo dia">${esc(x?x.compromisso:'')}</textarea></div>
      <div class="campo" style="margin-top:10px"><label for="x-notas">Anotações (só tu vê)</label><textarea id="x-notas" maxlength="5000" placeholder="Como ele tá, o que tu percebeu, o que cobrar no próximo">${esc(x?x.notas:'')}</textarea></div>
      <button class="btn forte cheio" style="margin-top:12px" id="btX1" onclick="salvarX1('${esc(c.id)}','${x?x.id:''}')">${x?'Salvar alterações':'Salvar X1'}</button>
    </section>`;
}
async function salvarX1(cid,id){
  const n=k=>parseInt(($(k).value||'').replace(/\D/g,''),10)||0, bt=$('btX1'); bt.disabled=true; bt.textContent='Salvando…';
  try{
    const r=await nuvem('g_x1_salvar',{p_chave:CHAVE,p_id:id||null,p_consultor:cid,p_dia:G.hoje,p_meta_abord:n('x-abord'),p_meta_reun:n('x-reun'),p_meta_fech:n('x-fech'),p_compromisso:$('x-comp').value.trim(),p_notas:$('x-notas').value.trim()});
    G.x1s=G.x1s.filter(y=>y.id!==r.id); G.x1s.unshift(r); gEditando=false; gestorRender(); toast('X1 salvo ✓ ele já vê o compromisso no app');
  }catch(e){ bt.disabled=false; bt.textContent='Salvar X1'; toast(erroTxt(e)); }
}
async function apagarX1(id){
  if(!confirm('Apagar esse X1? O compromisso some do app dele também.')) return;
  try{ await nuvem('g_x1_apagar',{p_chave:CHAVE,p_id:id}); G.x1s=G.x1s.filter(y=>y.id!==id); gestorRender(); toast('X1 apagado'); }catch(e){ toast(erroTxt(e)); }
}
function historicoX1(c){
  const xs=G.x1s.filter(y=>y.consultor_id===c.id).sort((a,b)=>b.dia.localeCompare(a.dia)).slice(0,6);
  if(!xs.length) return '';
  return `<div class="titulo">X1 anteriores</div><section class="card">${xs.map(x=>{ const d=dData(x.dia);
    const metas=[x.meta_abord&&`${x.meta_abord} abord./dia`,x.meta_reun&&`${x.meta_reun} reun.`,x.meta_fech&&`${x.meta_fech} fech.`].filter(Boolean).join(' · ');
    return `<div class="item"><b>${DSEM[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}${metas?` · <span class="fal">${metas}</span>`:''}</b>
      ${x.compromisso?`<div>Compromisso: ${esc(x.compromisso)}</div>`:''}${x.notas?`<div style="color:var(--preto)">Anotações: ${esc(x.notas)}</div>`:''}
      ${x.dia!==G.hoje?`<button class="link" onclick="apagarX1('${x.id}')">apagar</button>`:''}</div>`; }).join('')}</section>`;
}

/* ---------- fechamento do mês ---------- */
function mesDados(qual){
  const k=qual==='passado'?-1:0, de=mesIni(G.hoje,k), fimMes=mesFim(G.hoje,k), ate=fimMes<G.hoje?fimMes:G.hoje;
  // comparação justa: no mês atual, compara com o mesmo pedaço do mês anterior
  const deA=mesIni(G.hoje,k-1), fimA=mesFim(G.hoje,k-1), dia=Number(ate.slice(8)), ateA=k===0?(Number(fimA.slice(8))<dia?fimA:deA.slice(0,8)+String(dia).padStart(2,'0')):fimA;
  const uteis=[]; for(let s=de;s<=ate;s=soma(s,1)) if(util(s)) uteis.push(s);
  const por=G.cons.map(c=>{ const ls=linhasDe(c.id,de,ate), t=dSomar(ls), m=metasDe(c), ta=dSomar(linhasDe(c.id,deA,ateA));
    const esperado=uteis.length*(m.abord_dia||0);
    return {c,ls,t,ta,m,pct:esperado?Math.round(t.ab/esperado*100):0,conv:t.ab?t.reun_agendadas/t.ab:0,dg:diagnostico(t,m,ls.length,uteis.length)}; });
  const T=dSomar(por.flatMap(x=>x.ls)), TA=dSomar(G.cons.flatMap(c=>linhasDe(c.id,deA,ateA)));
  return {k,de,ate,deA,ateA,uteis,por,T,TA,nome:MESES[dData(de).getMonth()],nomeA:MESES[dData(deA).getMonth()],parcial:k===0&&(()=>{ for(let d=soma(ate,1);d<=fimMes;d=soma(d,1)) if(util(d)) return true; return false; })()};
}
function gMesHtml(){
  const M=mesDados(gMes), {T,TA,por}=M, nDias=por.reduce((a,x)=>a+x.ls.length,0), poss=M.uteis.length*por.length;
  const top=(f,ok)=>{ const x=[...por].sort((a,b)=>f(b)-f(a))[0]; return x&&ok(x)?x:null; };
  const dest=[
    ['🏆','Mais vendeu',top(x=>x.t.fech_valor,x=>x.t.fech_valor>0),x=>`${fmtR(x.t.fech_valor)} · ${x.t.fech_qtd} ${x.t.fech_qtd===1?'fechamento':'fechamentos'}`],
    ['🎯','Maior % da meta',top(x=>x.pct,x=>x.pct>0),x=>`${x.pct}% das abordagens`],
    ['📅','Mais constante',top(x=>x.ls.length,x=>x.ls.length>0),x=>`lançou ${x.ls.length} de ${M.uteis.length} dias`],
    ['📈','Melhor conversão',top(x=>x.conv,x=>x.t.ab>=50&&x.conv>0),x=>`${(x.conv*100).toFixed(1).replace('.',',')}% das abordagens viram reunião`],
  ].filter(d=>d[2]);
  const rk=[...por].sort((a,b)=>b.t.fech_valor-a.t.fech_valor||b.pct-a.pct);
  return `<div class="chips"><button class="${gMes==='este'?'on':''}" onclick="gMes='este';gestorRender()">Este mês</button><button class="${gMes==='passado'?'on':''}" onclick="gMes='passado';gestorRender()">Mês passado</button></div>
    <section class="card">
      <div class="gcab"><h3>${M.nome[0].toUpperCase()+M.nome.slice(1)}${M.parcial?' até hoje':''}</h3><span>vs ${M.nomeA}${M.parcial?' (mesmo período)':''}</span></div>
      <div class="kpis">
        <div><small>Vendido</small><b>${fmtR(T.fech_valor)}</b><i>${T.fech_qtd} fech. · ${varTxt(T.fech_valor,TA.fech_valor)}</i></div>
        <div><small>Abordagens</small><b>${T.ab}</b><i>${varTxt(T.ab,TA.ab)}</i></div>
        <div><small>Reuniões</small><b>${T.reun_agendadas}</b><i>${T.reun_feitas} feitas · ${varTxt(T.reun_agendadas,TA.reun_agendadas)}</i></div>
        <div><small>Lançamentos</small><b>${poss?Math.round(nDias/poss*100):0}%</b><i>${nDias} de ${poss} dias</i></div>
      </div>
    </section>
    ${dest.length?`<div class="titulo">Destaques</div><section class="card">${dest.map(([ic,t,x,f])=>`<div class="item bom"><b>${ic} ${t}: ${esc(nome1(x.c))}</b><div>${esc(f(x))}</div></div>`).join('')}</section>`:''}
    <div class="titulo">Por consultor</div>
    <section class="card lista">${rk.map(x=>`<button class="linha" onclick="gAba='x1';gCons='${esc(x.c.id)}';gestorRender()">
      <div class="ln1"><b>${esc(x.c.nome)}</b><span class="fal">${fmtR(x.t.fech_valor)}</span></div>
      <div class="ln2">${x.t.ab} abord.${x.m.abord_dia?` (${x.pct}% da meta)`:''} · ${x.t.reun_agendadas} reun. ag. · ${x.t.reun_feitas} feitas · ${x.t.fech_qtd} fech. · lançou ${x.ls.length}/${M.uteis.length}</div>
      ${x.dg.r.length?`<div class="ln3">Ponto a trabalhar: ${esc(x.dg.r[0].t)}</div>`:''}</button>`).join('')}</section>
    <div class="titulo">Funil do time</div>
    <section class="card"><table class="tab"><tbody>${[['Abordagem → resposta',T.respostas,T.ab],['Resposta → interessado',T.interessados,T.respostas],['Interessado → simulação',T.simulacoes,T.interessados],['Simulação → reunião',T.reun_agendadas,T.simulacoes],['Reunião agendada → feita',T.reun_feitas,T.reun_agendadas],['Reunião feita → fechamento',T.fech_qtd,T.reun_feitas]].map(([r,a,b])=>`<tr><td>${r}</td><td><b>${b?Math.round(a/b*100)+'%':'–'}</b></td><td class="fal">${a} de ${b}</td></tr>`).join('')}</tbody></table></section>
    <button class="btn forte cheio" style="margin-top:16px" onclick="copiarMes()">Copiar fechamento do mês</button>`;
}
function copiarMes(){
  const M=mesDados(gMes), {T,TA,por}=M, nm=M.nome[0].toUpperCase()+M.nome.slice(1);
  const L=[`*Fechamento de ${nm}${M.parcial?' (parcial)':''}*`,'',`Vendido: ${fmtR(T.fech_valor)} em ${T.fech_qtd} ${T.fech_qtd===1?'fechamento':'fechamentos'} (${varTxt(T.fech_valor,TA.fech_valor)} vs ${M.nomeA})`,
    `Abordagens: ${T.ab} (${varTxt(T.ab,TA.ab)}) · Reuniões: ${T.reun_agendadas} agendadas, ${T.reun_feitas} feitas`,'','*Por consultor*'];
  [...por].sort((a,b)=>b.t.fech_valor-a.t.fech_valor||b.pct-a.pct).forEach((x,i)=>L.push(`${i+1}. ${x.c.nome}: ${fmtR(x.t.fech_valor)} · ${x.t.fech_qtd} fech. · ${x.t.reun_agendadas} reun. · ${x.t.ab} abord.${x.m.abord_dia?` (${x.pct}% da meta)`:''}`));
  const txt=L.join('\n'), ok=()=>toast('Fechamento copiado ✓');
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok,()=>prompt('Copia:',txt)); else prompt('Copia:',txt);
}
function copiarPauta(){
  const c=G.cons.find(x=>x.id===gCons), p=pautaDados(c,gSem), {t,ta,dg}=p, de=dData(p.s.de), ate=dData(p.s.ate);
  const L=[`*X1 · ${c.nome}* (${de.getDate()}/${de.getMonth()+1} a ${ate.getDate()}/${ate.getMonth()+1})`,'',
    `Lançou ${p.ls.length} de ${p.uteis.length} dias · ${t.ab} abordagens (${varTxt(t.ab,ta.ab)}) · ${t.reun_agendadas} ${t.reun_agendadas===1?'reunião agendada':'reuniões agendadas'}, ${t.reun_feitas} ${t.reun_feitas===1?'feita':'feitas'} · ${t.fech_qtd} ${t.fech_qtd===1?'fechamento':'fechamentos'} (${fmtR(t.fech_valor)})`];
  if(dg.r.length){ L.push('','*Onde tá travando*'); dg.r.forEach(x=>L.push(`• ${x.t}: ${x.d}`)); }
  if(dg.ok.length){ L.push('','*O que tá funcionando*'); dg.ok.forEach(x=>L.push('• '+x)); }
  L.push('','*Perguntas*'); p.perg.forEach((x,i)=>L.push(`${i+1}. ${x}`));
  if(p.falt.length){ L.push('','*Ele escreveu que faltou*'); p.falt.forEach(l=>{ const d=dData(l.dia); L.push(`• ${DSEM[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}: ${l.faltou}`); }); }
  const txt=L.join('\n'), ok=()=>toast('Pauta copiada ✓ cola no WhatsApp ou nas notas');
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok,()=>prompt('Copia:',txt)); else prompt('Copia:',txt);
}

/* resumo das 20h no celular do gestor */
async function renderLembreteGestor(){
  const el=$('lembrete'); if(!el) return;
  const sub=pushOk()&&Notification.permission==='granted'?await inscricao():null, ligado=sub&&ler('diario_push_gestor')===sub.endpoint;
  let h=`<div class="lemb"><div><h3 style="font-size:14px;font-weight:600">Resumo das 20h</h3><div class="sub">Dias úteis: quem lançou, quem faltou e os números do time. Na sexta avisa que as pautas do X1 estão prontas.</div></div><span class="selo ${ligado?'ok':''}">${ligado?'ligado':'desligado'}</span></div>`;
  if(ligado) h+=`<button class="link" onclick="desligarResumo()">Desligar neste aparelho</button>`;
  else if(ehIOS&&!instalado()) h+=`<div class="dica">No iPhone o aviso só funciona com o app na tela de início: abre no <b>Safari</b>, toca em compartilhar <b>⬆︎</b> e <b>Adicionar à Tela de Início</b>. Depois abre pelo ícone, entra no modo gestor e liga aqui.</div>`;
  else if(!pushOk()) h+=`<div class="dica">Este navegador não aceita notificações. No Android usa o Chrome; no iPhone, o Safari com o app na tela de início.</div>`;
  else if(Notification.permission==='denied') h+=`<div class="dica">As notificações estão bloqueadas pra este app. Libera nas configurações do celular e volta aqui.</div>`;
  else h+=`<button class="btn cheio" style="margin-top:12px" id="btResumo" onclick="ligarResumo()">Ligar resumo das 20h</button>`;
  el.innerHTML=h;
}
async function ligarResumo(){
  const bt=$('btResumo'); if(bt){ bt.disabled=true; bt.textContent='Ligando…'; }
  try{
    if(await Notification.requestPermission()!=='granted'){ toast('Sem permissão de notificação.'); return renderLembreteGestor(); }
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(!sub){ const k=await nuvem('app_vapid'); sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(k)}); }
    const j=sub.toJSON();
    await nuvem('g_push_salvar',{p_chave:CHAVE,p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth,p_aparelho:aparelho()});
    gravar('diario_push_gestor',j.endpoint); toast('Resumo das 20h ligado ✓');
  }catch(e){ toast(e.rede?erroTxt(e):'Não consegui ligar o aviso neste aparelho.'); }
  renderLembreteGestor();
}
async function desligarResumo(){
  const sub=await inscricao();
  if(sub){ try{ await nuvem('g_push_remover',{p_chave:CHAVE,p_endpoint:sub.endpoint}); }catch(e){} }
  gravar('diario_push_gestor',null); toast('Resumo desligado'); renderLembreteGestor();
}
