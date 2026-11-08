/* ---------- SALÁRIO: comissões recebidas, carteira e estimativa dos próximos meses (só o que é do Hendril) ---------- */
/* Regras (tiradas dos relatórios):
   - Imóvel: 2% em 13 parcelas (10 x 0,1288% + 0,2374% + 0,2374% + 0,2372%). Veículo/moto: 12 x 0,1538% + 0,1544%.
   - Licenciado 0,20% (parte de gestor): mesmo ritmo, 1/10 dos valores. Vem nas vendas dele e nas do time.
   - Contrato antigo (cronograma de 15 parcelas): segue no mesmo % até a 15ª.
   - Venda de Prévia: o Autorizado entra e sai inteiro (repasse), não conta.
   - Anjo e Indicador: o que sai pra eles é descontado da linha.
   - 18% de imposto em tudo, inclusive nos descontos.
   - Venda até o dia de corte do mês paga no mês seguinte; depois do corte, no outro. */
const SAL_IMO=[0.1288,0.1288,0.1288,0.1288,0.1288,0.1288,0.1288,0.1288,0.1288,0.1288,0.2374,0.2374,0.2372];
const SAL_VEI=[0.1538,0.1538,0.1538,0.1538,0.1538,0.1538,0.1538,0.1538,0.1538,0.1538,0.1538,0.1538,0.1544];
const SAL_MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
let salFiltro='meu', salAberto={carteira:false,hist:false,cfg:false};

function SAL(){
  if(!S.salario||typeof S.salario!=='object') S.salario={};
  const s=S.salario;
  s.config=Object.assign({imposto:18,matricula:'011204',incluirTime:true,contarAtrasados:false,cortes:{},descontos:[]},s.config||{});
  s.relatorios=Array.isArray(s.relatorios)?s.relatorios:[];
  s.contratos=(s.contratos&&typeof s.contratos==='object')?s.contratos:{};
  s.vendas=Array.isArray(s.vendas)?s.vendas:[];
  return s;
}
/* ---------- meses ---------- */
const ymDe=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
function ymSoma(ym,n){ const [a,m]=ym.split('-').map(Number), d=new Date(a,m-1+n,1); return ymDe(d); }
function ymRot(ym,longo){ if(!ym) return '–'; const [a,m]=ym.split('-').map(Number); return longo?MESES_PT[m-1].toLowerCase()+'/'+a:SAL_MES[m-1]+'/'+String(a).slice(2); }
const ymHoje=()=>ymDe(new Date());
function salCorte(ym){ const c=SAL().config.cortes[ym]; return c>=1&&c<=31?Number(c):15; }
/* mês em que a venda começa a pagar */
function salMesPagamento(iso){ const [a,m,d]=iso.split('-').map(Number), ym=a+'-'+String(m).padStart(2,'0'); return ymSoma(ym,d<=salCorte(ym)?1:2); }
const salLiq=()=>1-(Number(SAL().config.imposto)||0)/100;
function salSeg(t){ t=String(t||'').toUpperCase(); return t.includes('MOTO')?'moto':t.includes('VEIC')?'vei':'imo'; }
const SEG_ROT={imo:'Imóvel',vei:'Veículo',moto:'Moto'};
function salCron(seg,cat){ const b=seg==='imo'?SAL_IMO:SAL_VEI, f=cat==='lic'?0.1:1; return b.map(x=>x*f); }
function salNum(v){ if(v==null||v==='') return 0; if(typeof v==='number') return v; let s=String(v).trim(); if(/,\d{1,4}$/.test(s)) s=s.replace(/\./g,'').replace(',','.'); const n=parseFloat(s); return isFinite(n)?n:0; }
function salData(v){ if(!v) return ''; if(v instanceof Date) return isoDia(v); const s=String(v).trim(); let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if(m) return m[3]+'-'+m[2]+'-'+m[1]; m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m?m[0]:''; }
/* próximas parcelas de um contrato a partir da última paga: [{k, pct}] */
function salRestantes(c){
  const s=salCron(c.seg,c.cat), p=c.parcela, tol=s[0]*0.02;
  const novo=p>=1&&p<=s.length&&Math.abs(c.pct-s[p-1])<=tol;
  if(novo){ const r=[]; for(let k=p+1;k<=s.length;k++) r.push({k,pct:s[k-1]}); return {r,total:s.length}; }
  const r=[]; for(let k=p+1;k<=15;k++) r.push({k,pct:c.pct}); return {r,total:15};
}

/* ---------- leitura do relatório (analítico da loja ou relatório de comissão) ---------- */
/* linhas = array de objetos (cabeçalho -> valor); titulo = texto da 1ª aba do analítico, se tiver */
function salLerLinhas(linhas,titulo){
  const cfg=SAL().config, liq=salLiq(), mat=String(cfg.matricula||'').replace(/\D/g,'');
  const analitico=linhas.some(l=>'Comissão Liquida' in l);
  let ref='', mm=String(titulo||'').match(/pagamento em\s+([A-Za-zçÇ]+)\/(\d{4})/i);
  if(mm){ const i=MESES_PT.findIndex(x=>x.toLowerCase()===mm[1].toLowerCase()); if(i>=0) ref=mm[2]+'-'+String(i+1).padStart(2,'0'); }
  const out={analitico,ref,bruto:0,liquido:0,repasses:0,meu:0,time:0,previa:0,descontos:[],taxa:0,linhas:[],ultimaVenda:''};
  linhas.forEach(l=>{
    const st=String(l['Status']||'').trim(); if(!st) return;
    const bruto=salNum(l['Valor bruto']); out.bruto+=bruto;
    if(/^Desc/i.test(st)){ out.descontos.push({nome:st.replace(/^Descontos?\s*/i,'')||st,bruto}); out.meu+=bruto*liq; return; }
    if(/Taxa/i.test(st)){ out.taxa+=bruto; out.meu+=bruto*liq; return; }
    if(!/Paga/i.test(st)) return;
    const cat=/LICENCIADO/i.test(String(l['Categoria']||''))?'lic':'aut';
    const vend=String(l['Vendedor']||'').replace(/\D/g,'');
    const liqLinha=analitico?salNum(l['Comissão Liquida']):bruto*liq;
    const rep=analitico?['$ Equipe','$ Supervisão','$ Anjo 1','$ Anjo 2','$ Indicador'].reduce((a,k)=>a+salNum(l[k]),0):null;
    const eqp=String(l['EQUIPE']||'').trim();
    let tipo=cat==='aut'?((analitico?!!eqp:vend!==mat)?'previa':'meu'):(vend===mat?'meu':'time');
    const venda=salData(l['Data da venda']);
    const linha={contrato:String(l['Contrato']||'').trim(),cat,tipo,cliente:String(l['Nome do Cliente']||'').trim(),seg:salSeg(l['Segmento']),
      credito:salNum(l['Crédito atualizado']),venda,parcela:parseInt(l['Parcela'],10)||0,pct:salNum(l['% comissão']),vendedor:vend,
      liquido:liqLinha,repasse:rep,quem:eqp};
    out.linhas.push(linha);
    if(String(l['Parcela'])==='1'&&venda>out.ultimaVenda) out.ultimaVenda=venda;
  });
  return out;
}
/* junta o relatório na carteira; antes guarda o que a estimativa dizia pra aquele mês */
function salImportar(lido,ref,arquivo){
  const s=SAL(), liq=salLiq();
  const estimado=s.relatorios.length?salProjecao(ref,1)[0]:null;
  let meu=lido.meu, time=0, previa=0, rep=0;
  lido.linhas.forEach(L=>{
    const k=L.contrato+'|'+L.cat, ant=s.contratos[k];
    let keep;
    if(L.repasse!=null) keep=L.liquido>0?Math.max(0,(L.liquido-L.repasse)/L.liquido):1;
    else keep=ant&&ant.keep!=null?ant.keep:(L.tipo==='previa'?0:1);
    if(L.tipo==='previa') keep=0;
    const meuLinha=L.liquido*keep; rep+=L.liquido-meuLinha;
    if(L.tipo==='time') time+=meuLinha; else if(L.tipo==='previa') previa+=L.liquido; else meu+=meuLinha;
    if(L.tipo==='time') meu+=meuLinha;
    const c=ant||{k,contrato:L.contrato,cat:L.cat,hist:{}};
    c.hist=c.hist||{}; c.hist[ref]=Math.round(((c.hist[ref]&&c.lastImport===arquivo+ref?c.hist[ref]:0)+meuLinha)*100)/100; c.lastImport=arquivo+ref;
    if(!ant||ref>=(ant.ref||'')){
      const mesmaRef=ant&&ant.ref===ref;
      Object.assign(c,{cliente:L.cliente,seg:L.seg,credito:L.credito,venda:L.venda,tipo:L.tipo,vendedor:L.vendedor,keep,quem:L.quem||c.quem||'',
        parcela:mesmaRef?Math.max(c.parcela,L.parcela):L.parcela,pct:mesmaRef&&c.parcela>L.parcela?c.pct:L.pct,ref});
    }
    s.contratos[k]=c;
  });
  Object.values(s.contratos).forEach(c=>{ if(c.lastImport===arquivo+ref) delete c.lastImport; });
  const r={ref,arquivo:arquivo||'',importado:new Date().toISOString(),bruto:round2(lido.bruto),liquido:round2(lido.bruto*liq),
    repasses:round2(rep),meu:round2(meu),time:round2(time),linhas:lido.linhas.length,estimado:estimado?round2(estimado.total):null,
    descontos:lido.descontos.map(d=>({nome:d.nome,bruto:round2(d.bruto)}))};
  s.relatorios=s.relatorios.filter(x=>x.ref!==ref).concat(r).sort((a,b)=>a.ref.localeCompare(b.ref));
  // descontos recorrentes: os do relatório mais novo, mantendo o "até" que já tinha
  if(ref===s.relatorios[s.relatorios.length-1].ref){
    const velhos=Object.fromEntries(s.config.descontos.map(d=>[d.nome,d]));
    s.config.descontos=r.descontos.map(d=>({nome:d.nome,bruto:d.bruto,ate:(velhos[d.nome]||{}).ate||''}));
  }
  return r;
}
const round2=v=>Math.round((v||0)*100)/100;
const salUltimo=()=>{ const r=SAL().relatorios; return r.length?r[r.length-1]:null; };

/* ---------- estimativa: n meses a partir de 'ini' ---------- */
function salProjecao(ini,n){
  const s=SAL(), cfg=s.config, liq=salLiq(), ult=salUltimo(), ultRef=ult?ult.ref:'';
  const meses=[]; for(let i=0;i<n;i++){ meses.push({ym:ymSoma(ini,i),carteira:0,carteiraTime:0,novas:0,novasTime:0,descontos:0,podeVoltar:0,nVoltar:0,total:0}); }
  const idx=ym=>meses.findIndex(m=>m.ym===ym);
  const lim3=ultRef?ymSoma(ultRef,-3):'';
  Object.values(s.contratos).forEach(c=>{
    if(c.tipo==='previa'||!c.keep) return;
    if(c.tipo==='time'&&!cfg.incluirTime) return;
    const {r}=salRestantes(c); if(!r.length) return;
    const pagou=c.ref===ultRef;
    if(!pagou&&c.ref<lim3) return; // sumiu faz mais de 3 meses: provável cancelamento
    r.forEach((x,i)=>{
      const ym=ymSoma(pagou?c.ref:ultRef,i+1), j=idx(ym); if(j<0) return;
      const v=c.credito*x.pct/100*liq*c.keep;
      if(!pagou&&!cfg.contarAtrasados){ if(i===0){ meses[j].podeVoltar+=v; meses[j].nVoltar++; } return; }
      if(c.tipo==='time') meses[j].carteiraTime+=v; else meses[j].carteira+=v;
    });
  });
  // vendas novas lançadas por ele (as que ainda não entraram em relatório)
  s.vendas.forEach(v=>{
    const fp=salMesPagamento(v.data); if(ultRef&&fp<=ultRef) return;
    const a=salCron(v.seg,'aut'), l=salCron(v.seg,'lic'), cred=v.valor*(v.cotas||1), keep=v.robert?0.5:1;
    a.forEach((p,i)=>{ const j=idx(ymSoma(fp,i)); if(j>=0) meses[j].novas+=cred*(p+l[i])/100*liq*keep; });
  });
  // gestão do time: fechamentos lançados no Diário depois do último relatório
  if(cfg.incluirTime&&typeof DIA!=='undefined'&&DIA.rows){
    DIA.rows.forEach(r=>{ const val=Number(r.fech_valor)||0; if(!val) return;
      const fp=salMesPagamento(r.dia); if(ultRef&&fp<=ultRef) return;
      salCron('imo','lic').forEach((p,i)=>{ const j=idx(ymSoma(fp,i)); if(j>=0) meses[j].novasTime+=val*p/100*liq; });
    });
  }
  // descontos recorrentes
  cfg.descontos.forEach(d=>meses.forEach(m=>{ if(!d.ate||m.ym<=d.ate) m.descontos+=d.bruto*liq; }));
  meses.forEach(m=>{ m.total=m.carteira+m.carteiraTime+m.novas+m.novasTime+m.descontos; });
  return meses;
}
/* resumo de uma venda pra mostrar na hora de lançar */
function salResumoVenda(data,seg,valor,cotas,robert){
  const fp=salMesPagamento(data), cred=valor*(cotas||1), liq=salLiq(), keep=robert?0.5:1;
  const a=salCron(seg,'aut'), l=salCron(seg,'lic'), parc=a.map((p,i)=>cred*(p+l[i])/100*liq*keep);
  return {fp,primeira:parc[0],total:parc.reduce((x,y)=>x+y,0),ultima:ymSoma(fp,a.length-1),parc};
}

/* ---------- importar arquivo (.xlsx) no navegador ---------- */
function salCarregarXLSX(){
  if(window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok,erro)=>{ const sc=document.createElement('script'); sc.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload=()=>ok(window.XLSX); sc.onerror=()=>erro(new Error('Não consegui abrir o leitor de planilha. Confere a internet.')); document.head.appendChild(sc); });
}
async function salArquivo(inp){
  const f=inp.files&&inp.files[0]; inp.value=''; if(!f) return;
  try{
    const X=await salCarregarXLSX(), wb=X.read(await f.arrayBuffer(),{type:'array',cellDates:false});
    let linhas=null, titulo='';
    wb.SheetNames.forEach(n=>{ const ws=wb.Sheets[n], aoa=X.utils.sheet_to_json(ws,{header:1,raw:true,defval:null});
      if(!titulo) titulo=aoa.slice(0,4).map(r=>(r||[]).filter(Boolean).join(' ')).join(' ');
      const hi=aoa.findIndex(r=>(r||[]).includes('Status')&&(r||[]).includes('Valor bruto'));
      if(hi>=0&&!linhas){ const h=aoa[hi]; linhas=aoa.slice(hi+1).map(r=>Object.fromEntries(h.map((c,i)=>[c==null?'_'+i:String(c).trim(),r[i]]))); }
    });
    if(!linhas) return alert('Não achei as colunas do relatório de comissão nesse arquivo (Status, Valor bruto…).');
    const lido=salLerLinhas(linhas,titulo);
    let ref=lido.ref;
    if(!ref&&lido.ultimaVenda) ref=salMesPagamento(lido.ultimaVenda);
    ref=prompt('Esse relatório é do pagamento de qual mês? (ano-mês, ex: 2026-11)',ref||ymHoje());
    if(!ref||!/^\d{4}-\d{2}$/.test(ref.trim())) return; ref=ref.trim();
    if(SAL().relatorios.some(r=>r.ref===ref)&&!confirm('Já tem relatório de '+ymRot(ref,true)+'. Substituir?')) return;
    if(!lido.analitico&&!confirm('Esse é o relatório sem os repasses. Vou usar os repasses que eu já conheço de cada contrato (Prévia, Anjo, Robert). Venda nova de Prévia ou indicação nova pode sair errada. Se tiver o analítico da loja, ele é melhor. Seguir assim?')) return;
    const r=salImportar(lido,ref,f.name); salvar(); renderSalario();
    alert('Relatório de '+ymRot(ref,true)+' carregado.\nTeu líquido: '+salRs(r.meu)+(r.estimado!=null?'\nA estimativa dizia: '+salRs(r.estimado):''));
  }catch(e){ alert('Não consegui ler esse arquivo: '+(e.message||e)); }
}
const salRs=v=>(v<0?'−':'')+'R$ '+Math.abs(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const salRs0=v=>(v<0?'−':'')+'R$ '+milhar(Math.round(Math.abs(v||0)));

/* ---------- ações ---------- */
function salLancar(){
  const data=$('svData').value, cli=$('svCli').value.trim(), seg=$('svSeg').value, valor=salNum($('svValor').value.replace(/\./g,'')), cotas=Math.max(parseInt($('svCotas').value,10)||1,1), robert=$('svRobert').checked;
  if(!data||!valor){ alert('Coloca a data e o valor da carta.'); return; }
  SAL().vendas.push({id:'v'+Date.now().toString(36),data,cliente:cli,seg,valor,cotas,robert,criado:new Date().toISOString()});
  salvar(); renderSalario();
}
function salApagarVenda(id){ const v=SAL().vendas.find(x=>x.id===id); if(!v||!confirm('Apagar a venda '+(v.cliente||'')+'?')) return; SAL().vendas=SAL().vendas.filter(x=>x.id!==id); salvar(); renderSalario(); }
function salPrevia(){
  const el=$('svPrev'); if(!el) return;
  const data=$('svData').value, valor=salNum($('svValor').value.replace(/\./g,'')), cotas=Math.max(parseInt($('svCotas').value,10)||1,1);
  if(!data||!valor){ el.innerHTML='Coloca a data e o valor que eu te mostro quando e quanto entra.'; return; }
  const r=salResumoVenda(data,$('svSeg').value,valor,cotas,$('svRobert').checked);
  el.innerHTML=`Começa a pagar em <b>${ymRot(r.fp,true)}</b>: <b>${salRs(r.primeira)}</b> por mês nas primeiras parcelas, <b>${salRs0(r.total)}</b> líquido até ${ymRot(r.ultima,true)}. Corte de ${ymRot(data.slice(0,7))}: dia ${salCorte(data.slice(0,7))}.`;
}
function salCfg(campo,valor){
  const c=SAL().config;
  if(campo==='imposto') c.imposto=Math.min(Math.max(salNum(valor),0),50);
  else if(campo==='matricula') c.matricula=String(valor).replace(/\D/g,'');
  else c[campo]=valor;
  salvar(); renderSalario();
}
function salCorteSet(ym,v){ const n=parseInt(v,10); const c=SAL().config.cortes; if(n>=1&&n<=31) c[ym]=n; else delete c[ym]; salvar(); renderSalario(); }
function salDescAte(i,v){ const d=SAL().config.descontos[i]; if(!d) return; d.ate=/^\d{4}-\d{2}$/.test(v)?v:''; salvar(); renderSalario(); }

/* ---------- tela ---------- */
function renderSalario(){
  const el=$('pag-salario'); if(!el) return;
  const s=SAL(), ult=salUltimo();
  const topoImport=`<input type="file" id="salArq" accept=".xlsx,.xls" style="display:none" onchange="salArquivo(this)">`;
  if(!ult){
    el.innerHTML=`${topoImport}<div class="callout"><div class="etq">Salário e comissões · só o que é teu</div>
      <div style="font-size:24px;font-weight:700;margin-top:6px">Carrega o teu relatório de comissão</div>
      <div class="sub" style="margin:8px 0 14px;color:rgba(255,255,255,.75)">Usa o analítico da loja (o que tem os repasses dos Prévias, Anjo e Robert). Com ele o painel monta tua carteira e a estimativa dos próximos meses.</div>
      <button class="btn forte" onclick="$('salArq').click()">Carregar relatório</button></div>`;
    return;
  }
  const prox=ymSoma(ult.ref,1), proj=salProjecao(prox,6), p0=proj[0], dif=p0.total-ult.meu;
  const ativos=Object.values(s.contratos).filter(c=>c.tipo!=='previa'&&c.keep>0);
  let h=topoImport;
  // topo
  h+=`<div class="grade">
    <div class="card"><div class="rot">Recebido em ${ymRot(ult.ref,true)}</div><div class="val">${salRs0(ult.meu)}</div><div class="pe">líquido, já sem imposto e repasses</div></div>
    <div class="card escuro"><div class="rot">Estimativa ${ymRot(prox,true)}</div><div class="val">${salRs0(p0.total)}</div><div class="pe">${dif>=0?'+':'−'}${salRs0(Math.abs(dif)).replace('−','')} em relação a ${ymRot(ult.ref)}</div></div>
    <div class="card top"><div class="rot">Vendas novas lançadas</div><div class="val">${salRs0(proj.reduce((a,m)=>a+m.novas,0))}</div><div class="pe">somam nos próximos 6 meses</div></div>
    <div class="card top"><div class="rot">Pode voltar</div><div class="val">${salRs0(p0.podeVoltar)}</div><div class="pe">${p0.nVoltar} ${p0.nVoltar===1?'contrato':'contratos'} que não ${p0.nVoltar===1?'pagou':'pagaram'} em ${ymRot(ult.ref)}${s.config.contarAtrasados?' · já contando':''}</div></div>
  </div>`;
  // gráfico
  h+=`<div class="titulo">Próximos meses <span>estimativa líquida</span></div><div class="bloco"><div class="dgraf" id="salGraf"></div>
    <div class="legenda">Preto é o que entrou, vermelho é estimativa. A estimativa conta a carteira que tá pagando, as vendas que tu lançou aqui${s.config.incluirTime?' e os fechamentos do time no Diário':''}. Sem venda nova a curva cai, porque contrato vai terminando.</div></div>`;
  // de onde vem
  const linhaTab=(rot,k,neg)=>`<tr><td>${rot}</td>${proj.map(m=>`<td class="pc"${m[k]===0?' style="color:var(--txt3)"':''}>${m[k]===0?'–':salRs0(m[k])}</td>`).join('')}</tr>`;
  h+=`<div class="titulo">De onde vem <span>mês a mês</span></div><div class="tab-wrap"><table style="min-width:760px"><thead><tr><th></th>${proj.map(m=>`<th>${ymRot(m.ym)}</th>`).join('')}</tr></thead><tbody>
    ${linhaTab('Carteira · tuas vendas','carteira')}
    ${linhaTab('Vendas novas · lançadas aqui','novas')}
    ${s.config.incluirTime?linhaTab('Gestão do time · carteira','carteiraTime')+linhaTab('Gestão do time · fechamentos do Diário','novasTime'):''}
    ${linhaTab('Descontos (Antecipay e outros)','descontos')}
    <tr class="total"><td>Total estimado</td>${proj.map(m=>`<td>${salRs0(m.total)}</td>`).join('')}</tr>
    ${proj.some(m=>m.podeVoltar)&&!s.config.contarAtrasados?`<tr><td class="fal">Se os atrasados voltarem a pagar</td>${proj.map(m=>`<td class="fal">${m.podeVoltar?'+'+salRs0(m.podeVoltar):''}</td>`).join('')}</tr>`:''}
  </tbody></table></div>`;
  // lançar venda
  const hoje=isoDia(hojeZero());
  h+=`<div class="titulo">Lançar venda tua <span>entra na estimativa na hora</span></div>
    <div class="bloco"><div class="sal-form">
      <div><label>Data da venda</label><input class="inp" type="date" id="svData" value="${hoje}" oninput="salPrevia()"></div>
      <div><label>Cliente</label><input class="inp" id="svCli" placeholder="nome"></div>
      <div><label>Segmento</label><select class="inp" id="svSeg" onchange="salPrevia()"><option value="imo">Imóvel</option><option value="vei">Veículo</option><option value="moto">Moto</option></select></div>
      <div><label>Valor da carta</label><input class="inp" id="svValor" inputmode="numeric" placeholder="ex: 100.000" oninput="this.value=milhar(this.value.replace(/\\D/g,'').slice(0,10));salPrevia()"></div>
      <div><label>Cotas</label><input class="inp" id="svCotas" type="number" min="1" value="1" oninput="salPrevia()"></div>
      <div class="sal-ck"><label><input type="checkbox" id="svRobert" onchange="salPrevia()"> Indicação do Robert</label></div>
      <div><button class="btn forte" onclick="salLancar()">Lançar venda</button></div>
    </div><div class="sal-prev" id="svPrev"></div></div>`;
  const vend=s.vendas.slice().sort((a,b)=>b.data.localeCompare(a.data));
  const pend=vend.filter(v=>salMesPagamento(v.data)>ult.ref), absorv=vend.length-pend.length;
  if(pend.length) h+=`<div class="tab-wrap" style="margin-top:12px"><table style="min-width:760px"><thead><tr><th>Data</th><th>Cliente</th><th>Segmento</th><th>Carta</th><th>Começa a pagar</th><th>Por mês</th><th>Total líquido</th><th></th></tr></thead><tbody>
    ${pend.map(v=>{ const r=salResumoVenda(v.data,v.seg,v.valor,v.cotas,v.robert);
      return `<tr><td class="fal">${dataBR(v.data)}</td><td class="nome-cel">${esc(v.cliente||'–')}${v.robert?' <span class="st ne">Robert</span>':''}</td><td>${SEG_ROT[v.seg]}</td><td class="pc">${salRs0(v.valor*(v.cotas||1))}${v.cotas>1?` <span class="fal">${v.cotas} cotas</span>`:''}</td><td>${ymRot(r.fp,true)}</td><td class="pc">${salRs(r.primeira)}</td><td class="pc">${salRs0(r.total)}</td><td><button class="lixo" onclick="salApagarVenda('${v.id}')">×</button></td></tr>`; }).join('')}
    </tbody></table></div>`;
  h+=`<div class="legenda">Lança só as tuas vendas. As do time entram sozinhas pelo Diário. ${absorv?`${absorv} ${absorv===1?'venda lançada já entrou':'vendas lançadas já entraram'} em relatório e ${absorv===1?'saiu':'saíram'} daqui pra não contar duas vezes.`:''}</div>`;
  // carteira
  const porContrato={};
  ativos.forEach(c=>{ const o=porContrato[c.contrato]||(porContrato[c.contrato]={contrato:c.contrato,cliente:c.cliente,seg:c.seg,tipo:c.tipo,credito:c.credito,parcela:0,total:0,mes:0,resta:0,fim:'',ref:c.ref,venda:c.venda});
    const {r,total}=salRestantes(c), pagou=c.ref===ult.ref, liq=salLiq();
    if(c.cat==='aut'||!o.parcela){ o.parcela=c.parcela; o.total=total; }
    if(r.length){ o.mes+=c.credito*r[0].pct/100*liq*c.keep; o.resta+=r.reduce((a,x)=>a+c.credito*x.pct/100*liq*c.keep,0);
      const fim=ymSoma(pagou?c.ref:ult.ref,r.length); if(fim>o.fim) o.fim=fim; }
    if(c.tipo==='meu') o.tipo='meu'; if(c.ref>o.ref) o.ref=c.ref; });
  let lista=Object.values(porContrato).filter(o=>o.resta>0.005||o.ref===ult.ref);
  const cont={meu:lista.filter(o=>o.tipo==='meu').length,time:lista.filter(o=>o.tipo==='time').length,
    atras:lista.filter(o=>o.ref<ult.ref&&o.resta>0).length,fim:lista.filter(o=>o.fim&&o.fim<=ymSoma(ult.ref,2)&&o.resta>0).length};
  if(salFiltro==='meu') lista=lista.filter(o=>o.tipo==='meu'); else if(salFiltro==='time') lista=lista.filter(o=>o.tipo==='time');
  else if(salFiltro==='atras') lista=lista.filter(o=>o.ref<ult.ref&&o.resta>0); else if(salFiltro==='fim') lista=lista.filter(o=>o.fim&&o.fim<=ymSoma(ult.ref,2)&&o.resta>0);
  lista.sort((a,b)=>b.mes-a.mes);
  h+=`<div class="titulo">Minha carteira <span>${Object.keys(porContrato).length} contratos</span></div>
    <div class="chips">${[['meu','Tuas vendas',cont.meu],['time','Gestão do time',cont.time],['atras','Não pagaram',cont.atras],['fim','Terminam em 2 meses',cont.fim]].map(([k,r,n])=>`<button class="chip${salFiltro===k?' on':''}" onclick="salFiltro='${k}';salAberto.carteira=true;renderSalario()">${r} · ${n}</button>`).join('')}</div>
    <div class="tab-wrap"><table style="min-width:880px"><thead><tr><th>Cliente</th><th>Segmento</th><th>Carta</th><th>Venda</th><th>Parcela</th><th>Próximo mês</th><th>Ainda vai render</th><th>Termina</th><th>Situação</th></tr></thead><tbody>
    ${(salAberto.carteira?lista:lista.slice(0,12)).map(o=>`<tr><td class="nome-cel">${esc(o.cliente)}</td><td>${SEG_ROT[o.seg]}</td><td class="fal">${salRs0(o.credito)}</td><td class="fal">${dataBR(o.venda)}</td>
      <td>${o.parcela}<span class="fal">/${o.total}</span></td><td class="pc">${o.resta>0?salRs(o.mes):'–'}</td><td>${o.resta>0?salRs0(o.resta):'<span class="fal">terminou</span>'}</td><td class="fal">${o.resta>0?ymRot(o.fim):'–'}</td>
      <td>${o.ref<ult.ref?`<span class="st no">não pagou em ${ymRot(ult.ref)}</span>`:o.resta<=0?'<span class="st ne">última paga</span>':'<span class="st ok">em dia</span>'}</td></tr>`).join('')||'<tr><td colspan="9" class="fal">Nada aqui.</td></tr>'}
    </tbody></table></div>
    ${!salAberto.carteira&&lista.length>12?`<div style="text-align:center;margin-top:10px"><button class="mini" onclick="salAberto.carteira=true;renderSalario()">Ver todos os ${lista.length}</button></div>`:''}
    <div class="legenda">Valores líquidos, do jeito que ficam contigo (sem imposto e sem repasse de Anjo e Robert). Contrato de Prévia não aparece porque sai inteiro pra eles.</div>`;
  // histórico
  const rel=s.relatorios.slice().reverse();
  h+=`<div class="titulo">Histórico <span>o que entrou de verdade</span></div>
    <div class="tab-wrap"><table style="min-width:820px"><thead><tr><th>Pagamento</th><th>Relatório bruto</th><th>Depois do imposto</th><th>Repasses</th><th>Ficou contigo</th><th>Gestão do time</th><th>A estimativa dizia</th><th>Diferença</th></tr></thead><tbody>
    ${rel.map(r=>`<tr><td style="font-weight:600">${ymRot(r.ref,true)}</td><td class="fal">${salRs(r.bruto)}</td><td class="fal">${salRs(r.liquido)}</td><td class="fal">${salRs(-r.repasses)}</td><td class="pc">${salRs(r.meu)}</td><td class="fal">${salRs(r.time)}</td>
      <td class="fal">${r.estimado!=null?salRs(r.estimado):'–'}</td><td>${r.estimado!=null?`<span class="pc" style="color:${r.meu>=r.estimado?C.ok:C.vermelho}">${r.meu>=r.estimado?'+':'−'}${salRs(Math.abs(r.meu-r.estimado)).replace('−','')}</span>`:'<span class="fal">–</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap"><button class="btn forte" onclick="$('salArq').click()">Carregar relatório do mês</button>
      <span class="legenda" style="margin:0">Todo mês, quando sair o relatório, carrega aqui (de preferência o analítico da loja). A carteira se atualiza e tu vê o quanto a estimativa errou.</span></div>`;
  // ajustes
  const ymA=ymHoje(), ymB=ymSoma(ymA,1);
  h+=`<div class="titulo">Ajustes</div><div class="dois">
    <div class="bloco"><div style="font-weight:600;font-size:13px;margin-bottom:4px">Corte do mês</div>
      <div class="legenda" style="margin:0 0 10px">Venda até esse dia paga no mês seguinte. Depois dele, no outro. Coloca conforme o vencimento dos imóveis. Em branco = dia 15.</div>
      <div style="display:flex;gap:14px;flex-wrap:wrap">${[ymA,ymB].map(ym=>`<div><label class="fal">${ymRot(ym,true)}</label><br><input class="inp curto" type="number" min="1" max="31" style="width:90px" value="${s.config.cortes[ym]||''}" placeholder="15" onchange="salCorteSet('${ym}',this.value)"></div>`).join('')}</div></div>
    <div class="bloco"><div style="font-weight:600;font-size:13px;margin-bottom:4px">Descontos que se repetem</div>
      <div class="legenda" style="margin:0 0 10px">Vêm do último relatório. Quando um acabar, coloca o último mês dele (ex: 2027-03).</div>
      ${s.config.descontos.length?s.config.descontos.map((d,i)=>`<div style="display:flex;gap:10px;align-items:center;margin-top:6px"><span style="flex:1">${esc(d.nome)} <span class="fal">${salRs(d.bruto)} bruto</span></span><input class="inp curto" style="width:110px" placeholder="até ano-mês" value="${d.ate||''}" onchange="salDescAte(${i},this.value.trim())"></div>`).join(''):'<span class="fal">Nenhum.</span>'}</div>
    <div class="bloco cfg">
      <div><label>Imposto %</label><input type="number" min="0" max="50" value="${s.config.imposto}" onchange="salCfg('imposto',this.value)"></div>
      <div><label>Tua matrícula</label><input class="inp curto" style="width:110px" value="${esc(s.config.matricula)}" onchange="salCfg('matricula',this.value)"></div>
      <div class="sal-ck"><label><input type="checkbox" ${s.config.incluirTime?'checked':''} onchange="salCfg('incluirTime',this.checked)"> Somar a gestão do time (0,20%)</label></div>
      <div class="sal-ck"><label><input type="checkbox" ${s.config.contarAtrasados?'checked':''} onchange="salCfg('contarAtrasados',this.checked)"> Contar que os atrasados voltam a pagar</label></div>
    </div></div>`;
  el.innerHTML=h;
  salGrafico($('salGraf'),ult,proj);
  salPrevia();
}
function salGrafico(box,ult,proj){
  if(!box) return;
  const ant=SAL().relatorios.slice(-3).map(r=>({ym:r.ref,v:r.meu,real:true}));
  const dados=ant.concat(proj.map(m=>({ym:m.ym,v:m.total,real:false})));
  const W=720,H=230,L=8,R=8,T=26,B=26, max=Math.max(...dados.map(d=>d.v),1)*1.12, n=dados.length, bw=(W-L-R)/n, bar=Math.min(54,bw*.62), y=v=>T+(H-T-B)*(1-Math.max(v,0)/max);
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Salário recebido e estimado">`;
  dados.forEach((d,i)=>{ const x=L+bw*i+(bw-bar)/2, top=y(d.v), r=Math.min(4,y(0)-top);
    s+=`<path d="M${x},${y(0)} V${top+r} Q${x},${top} ${x+r},${top} H${x+bar-r} Q${x+bar},${top} ${x+bar},${top+r} V${y(0)} Z" fill="${d.real?C.preto:C.vermelho}"${d.real?'':' fill-opacity=".85"'}/>`;
    s+=`<text class="rot" x="${x+bar/2}" y="${top-7}" text-anchor="middle">${(Math.round(d.v/100)/10).toString().replace('.',',')} mil</text>`;
    s+=`<text class="eixo" x="${x+bar/2}" y="${H-8}" text-anchor="middle">${ymRot(d.ym)}</text>`;
    s+=`<rect x="${L+bw*i}" y="${T}" width="${bw}" height="${H-T-B}" fill="transparent" data-tip="<b>${ymRot(d.ym,true)}</b><br>${d.real?'recebido':'estimado'}: ${salRs0(d.v)}"/>`;
  });
  s+=`<line x1="${L}" x2="${W-R}" y1="${y(0)}" y2="${y(0)}" stroke="#CFC9C9"/></svg>`;
  box.innerHTML=s; if(typeof dTip==='function') dTip(box);
}
