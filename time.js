/* ---------- CONSULTOR: compromisso do X1, ranking do time e conquistas ---------- */
let rPer='semana';

function abasConsultor(){
  return `<div class="abas" style="margin-bottom:4px"><button class="${cAba==='dia'?'on':''}" onclick="trocarAba('dia')">Meu dia</button><button class="${cAba==='time'?'on':''}" onclick="trocarAba('time')">Time</button></div>`;
}
function trocarAba(a){
  if(a===cAba) return;
  if(SUJO&&!confirm('Tu mudou números e não salvou. Sair mesmo assim?')) return;
  SUJO=false; cAba=a; render(); window.scrollTo(0,0);
}

/* dias úteis da semana (seg até hoje) e do mês (dia 1 até hoje) */
function uteisAte(de,ate){ const r=[]; for(let s=de;s<=ate;s=soma(s,1)) if(util(s)) r.push(s); return r; }
const segDaSemana=s=>soma(s,-((dData(s).getDay()+6)%7));
const iniMes=s=>s.slice(0,8)+'01';

/* ---------- compromisso: o que ele combinou no último X1, e como tá indo nesta semana ---------- */
function htmlCompromisso(){
  if(!COMP) return '';
  const h=EU.hoje, seg=segDaSemana(h), ls=uteisAte(seg,h).map(s=>DIAS[s]).filter(Boolean);
  const ab=ls.reduce((a,l)=>a+(l.whats||0)+(l.insta||0)+(l.messenger||0),0), md=ls.length?Math.round(ab/ls.length):0;
  const reun=ls.reduce((a,l)=>a+(l.reun_agendadas||0),0), fech=ls.reduce((a,l)=>a+(l.fech_qtd||0),0), d=dData(COMP.dia);
  const barra=(v,m)=>`<div class="barra${v>=m?' ok':''}"><div style="width:${Math.min(100,m?v/m*100:0)}%"></div></div>`;
  const itens=[[COMP.meta_abord,'Abordagens por dia (média)',md],[COMP.meta_reun,'Reuniões agendadas na semana',reun],[COMP.meta_fech,'Fechamentos na semana',fech]].filter(x=>x[0]>0);
  return `<section class="card">
    <div class="gcab"><h3>Meu compromisso</h3><span>X1 de ${d.getDate()}/${d.getMonth()+1}</span></div>
    ${COMP.compromisso?`<div class="sub" style="color:var(--preto);font-size:14px">${esc(COMP.compromisso)}</div>`:''}
    ${itens.map(([m,r,v])=>`<div class="comp-meta"><span>${r}</span><b>${v} de ${m}</b></div>${barra(v,m)}`).join('')}
    ${itens.length?'<div class="sub" style="margin-top:8px">Contando os dias lançados desta semana.</div>':''}
  </section>`;
}

/* ---------- ranking ---------- */
async function renderTime(){
  $('rodape').classList.add('oculto');
  $('app').innerHTML=`${abasConsultor()}<div id="rkBox"><div class="card"><div class="carregando">carregando o time…</div></div></div>`;
  try{ RANK=await nuvem('app_ranking',{p_token:TOKEN}); }
  catch(e){
    if(sessaoCaiu(e)) return sair('Tua sessão foi encerrada. Entra de novo.');
    $('rkBox').innerHTML=`<div class="card"><div class="erro">${esc(erroTxt(e))}</div><button class="btn" onclick="renderTime()">Tentar de novo</button></div>`; return;
  }
  desenharRanking();
}
function linhasRanking(){
  const h=EU.hoje, de=rPer==='semana'?segDaSemana(h):iniMes(h), ateOntem=uteisAte(de,soma(h,-1)).length;
  return RANK.map(r=>{ const p=r[rPer], base=Math.max(ateOntem,p.dias), esperado=base*(r.meta_abord||0);
      return Object.assign({},r,{p,pct:esperado?Math.round(p.abord/esperado*100):0,base}); })
    .sort((a,b)=>b.pct-a.pct||b.p.abord-a.p.abord);
}
function desenharRanking(){
  const ls=linhasRanking(), eu=ls.find(x=>x.eu), pos=ls.indexOf(eu)+1, med=['🥇','🥈','🥉'];
  const h=EU.hoje, uteis=uteisAte(rPer==='semana'?segDaSemana(h):iniMes(h),h).length;
  $('rkBox').innerHTML=`
    <div class="chips"><button class="${rPer==='semana'?'on':''}" onclick="rPer='semana';desenharRanking()">Esta semana</button><button class="${rPer==='mes'?'on':''}" onclick="rPer='mes';desenharRanking()">Este mês</button></div>
    ${eu?`<div class="titulo">Minhas conquistas</div>${conquistas(eu,pos,uteis)}`:''}
    <div class="titulo">Ranking · % da meta de abordagens</div>
    <section class="card lista">${ls.map((r,i)=>`<div class="rk${r.eu?' eu':''}">
        <div class="medalha">${r.pct>0&&i<3?med[i]:`<span class="fal">${i+1}º</span>`}</div>
        <div class="nm"><b>${esc(r.eu?'Você':r.nome.split(' ')[0])}</b><span>${r.p.abord} abord. · ${r.p.reun} reun. · ${r.p.fech} fech.${r.sequencia>=3?` · 🔥 ${r.sequencia}`:''}</span></div>
        <div class="pct">${r.meta_abord?r.pct+'%':'–'}<small>${r.p.dias} ${r.p.dias===1?'dia':'dias'}</small></div></div>`).join('')}
    </section>
    <p class="sub" style="margin-top:8px">A % compara tuas abordagens com a meta de cada dia útil${rPer==='semana'?' da semana':' do mês'} até ontem (hoje conta quando tu lança). 🔥 = dias seguidos lançando.</p>`;
}
function conquistas(eu,pos,uteis){
  const seq=eu.sequencia, prox=[5,10,20,40,60,100].find(n=>n>seq)||seq+20;
  const c=[
    {on:seq>0,ic:'🔥',t:seq>0?`${seq} ${seq===1?'dia':'dias'} seguidos lançando`:'Lança hoje pra começar a sequência',s:`próxima: ${prox} dias`},
    {on:eu.pct>=100,ic:'🎯',t:eu.pct>=100?'Meta de abordagens em dia':`${eu.pct}% da meta`,s:rPer==='semana'?'nesta semana':'neste mês'},
    {on:pos===1&&eu.pct>0,ic:'🏆',t:pos===1&&eu.pct>0?'1º lugar do time':`${pos}º lugar do time`,s:rPer==='semana'?'ranking da semana':'ranking do mês'},
    {on:eu.p.dias>=uteis&&uteis>0,ic:'📅',t:`Lançou ${eu.p.dias} de ${uteis} dias`,s:eu.p.dias>=uteis?'todos os dias ✓':'lança todo dia'},
  ];
  return `<div class="conq">${c.map(x=>`<div class="${x.on?'':'off'}"><b>${x.ic}</b>${esc(x.t)}<div class="fal">${esc(x.s)}</div></div>`).join('')}</div>`;
}
