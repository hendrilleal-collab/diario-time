/* Diagnóstico: o mesmo do painel (Diário do time). Se mudar lá, muda aqui também. */
const DIAG_METAS_PADRAO={abord_dia:100,lig_dia:0,follow_dia:0,reun_sem:0,pct_min:70};
function diagPct(a,b){ return b>0?Math.round(a/b*100)+'%':'0%'; }
function diagN(n){ return String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
/* t = somas do período (só seg a sex), m = metas do consultor, nLanc = dias lançados, nUteis = dias úteis do período até hoje */
function diagnostico(t,m,nLanc,nUteis){
  m=Object.assign({},DIAG_METAS_PADRAO,m||{});
  const r=[], ok=[];
  if(nLanc<2) return {r,ok,pouco:true};
  const lim=(m.pct_min||70)/100, md=t.ab/nLanc, lig=t.ligacoes/nLanc, fol=t.followups/nLanc, semanas=Math.max(nUteis/5,1);
  // volume
  if(m.abord_dia&&md<m.abord_dia*lim) r.push({g:2,k:'volume',t:'Volume abaixo da meta',d:`Média de ${diagN(md)} abordagens por dia, e a tua meta é ${diagN(m.abord_dia)}. Sem volume o funil não enche.`});
  // abordagem → resposta
  if(t.ab>=150&&t.respostas/t.ab<0.10) r.push({g:2,k:'resposta',t:'Muita mensagem e pouca resposta',d:`Só ${diagPct(t.respostas,t.ab)} das abordagens tiveram resposta (${diagN(t.respostas)} de ${diagN(t.ab)}). A mensagem de abertura ou a lista podem estar travando.`});
  // resposta → interessado
  if(t.respostas>=10&&t.interessados/t.respostas<0.10) r.push({g:2,k:'interesse',t:'Respondem, mas não se interessam',d:`De ${diagN(t.respostas)} respostas, ${diagN(t.interessados)} viraram interessado. Pode ser o jeito de apresentar o consórcio ou o público que tu tá abordando.`});
  // interessado → simulação
  if(t.interessados>=3&&t.simulacoes<t.interessados*0.5) r.push({g:1,k:'simulacao',t:'Interessado sem simulação',d:`${diagN(t.interessados)} interessados e ${diagN(t.simulacoes)} simulações enviadas. Quem se interessou tá esperando número.`});
  // simulação → reunião
  if(t.simulacoes>=3&&t.reun_agendadas===0) r.push({g:2,k:'reuniao',t:'Simulação que não vira reunião',d:`${diagN(t.simulacoes)} simulações e nenhuma reunião agendada. Falta puxar pro próximo passo depois de mandar a simulação.`});
  // reunião agendada → feita
  if(t.reun_agendadas>=2&&t.reun_feitas<t.reun_agendadas*0.5) r.push({g:1,k:'noshow',t:'Reunião marcada que não acontece',d:`${diagN(t.reun_agendadas)} agendadas e ${diagN(t.reun_feitas)} feitas. Confirmar na véspera e sair da conversa com dia e hora fechados ajuda.`});
  // reunião → fechamento
  if(t.reun_feitas>=3&&t.fech_qtd===0) r.push({g:1,k:'fechamento',t:'Reunião sem fechamento',d:`${diagN(t.reun_feitas)} reuniões feitas e nenhum fechamento. Vale olhar como tá a condução e o fechamento da reunião.`});
  // follow-up
  if(m.follow_dia&&fol<m.follow_dia*lim) r.push({g:1,k:'followup',t:'Follow-up abaixo da meta',d:`Média de ${diagN(fol)} follow-ups por dia, e a tua meta é ${diagN(m.follow_dia)}. Quem respondeu e esfriou precisa de retorno.`});
  else if(!m.follow_dia&&t.respostas>=10&&t.followups<t.respostas*0.3) r.push({g:1,k:'followup',t:'Pouco follow-up',d:`${diagN(t.respostas)} respostas e ${diagN(t.followups)} follow-ups. Quem respondeu e esfriou precisa de retorno.`});
  // ligação
  if(m.lig_dia&&lig<m.lig_dia*lim) r.push({g:1,k:'ligacao',t:'Ligações abaixo da meta',d:`Média de ${String(Math.round(lig*10)/10).replace('.',',')} ligações por dia, e a tua meta é ${diagN(m.lig_dia)}.`});
  else if(!m.lig_dia&&t.ligacoes===0&&nLanc>=3) r.push({g:1,k:'ligacao',t:'Nenhuma ligação',d:'A ligação ainda não entrou na tua rotina. É uma tarefa pra melhorar.'});
  if(t.ligacoes>=10&&t.lig_atendidas/t.ligacoes<0.2) r.push({g:1,k:'atendidas',t:'Pouca ligação atendida',d:`${diagN(t.lig_atendidas)} de ${diagN(t.ligacoes)} ligações atendidas. Testa outros horários.`});
  // reuniões por semana
  if(m.reun_sem&&t.reun_agendadas<m.reun_sem*semanas*lim) r.push({g:1,k:'reun_meta',t:'Reuniões abaixo da meta',d:`${diagN(t.reun_agendadas)} reuniões agendadas no período, e a tua meta é ${diagN(m.reun_sem)} por semana.`});
  // o que tá funcionando
  if(m.abord_dia&&md>=m.abord_dia) ok.push(`Volume em dia: média de ${diagN(md)} abordagens por dia`);
  if(t.ab>=100&&t.respostas/t.ab>=0.2) ok.push(`Boa taxa de resposta: ${diagPct(t.respostas,t.ab)}`);
  if(t.respostas>=10&&t.interessados/t.respostas>=0.2) ok.push(`${diagPct(t.interessados,t.respostas)} de quem respondeu ficou interessado`);
  if(t.reun_feitas>0&&t.reun_feitas>=t.reun_agendadas*0.8) ok.push('Reunião marcada tá acontecendo');
  if(t.fech_qtd>0) ok.push(`${diagN(t.fech_qtd)} ${t.fech_qtd===1?'fechamento':'fechamentos'} no período`);
  if(nUteis>=3&&nLanc>=nUteis) ok.push('Lançou todos os dias');
  r.sort((a,b)=>b.g-a.g);
  return {r,ok};
}
