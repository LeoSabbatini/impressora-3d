const $=id=>document.getElementById(id);
const CHAVES=['config3d','tipos3d','filamentos3d','produtos3d','impressora3d','pedidos3d'];
function loadJSON(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
// Salva no cache local e envia para o banco (compartilhado entre dispositivos).
const envioPendente={};
function saveJSON(k,v){
  try{localStorage.setItem(k,JSON.stringify(v))}catch(e){console.error('storage',e)}
  clearTimeout(envioPendente[k]);
  envioPendente[k]=setTimeout(()=>enviarServidor(k,v),300);
}
async function enviarServidor(k,v){
  delete envioPendente[k];
  try{
    const r=await fetch('/api/dados/'+k,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(v)});
    if(!r.ok)throw new Error(r.status);
    setSync('ok');
  }catch(e){console.error('sync',e);setSync('erro')}
}
function setSync(estado){
  const el=$('syncStatus'); if(!el)return;
  el.textContent={ok:'● sincronizado',erro:'● offline (salvo só neste dispositivo)',carregando:'● carregando…'}[estado];
  el.dataset.estado=estado;
}
let config,tipos,filamentos,produtos,impressora,pedidos;
function aplicarDados(){
  config=loadJSON('config3d',{kwh:0.95,watts:150});
  tipos=loadJSON('tipos3d',['PLA','PLA Silk','PETG','ABS','TPU']);
  filamentos=loadJSON('filamentos3d',[]).map(f=>({...f,id:f.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6)),tipo:f.tipo||'Outro'}));
  if(filamentos.some(f=>f.tipo==='Outro')&&!tipos.includes('Outro'))tipos.push('Outro');
  produtos=loadJSON('produtos3d',[]);
  impressora=loadJSON('impressora3d',{modelo:'',valor:0});
  pedidos=loadJSON('pedidos3d',[]);
}
aplicarDados();
// Busca os dados do banco. Se o banco ainda estiver vazio, envia os dados já salvos neste navegador.
async function carregarServidor(){
  if(Object.keys(envioPendente).length)return;
  try{
    const r=await fetch('/api/dados',{cache:'no-store'});
    if(!r.ok)throw new Error(r.status);
    const remoto=await r.json();
    CHAVES.forEach(k=>{
      if(k in remoto)localStorage.setItem(k,JSON.stringify(remoto[k]));
      else if(localStorage.getItem(k)!==null)enviarServidor(k,loadJSON(k,null));
    });
    aplicarDados(); renderTudo(); setSync('ok');
  }catch(e){console.error('sync',e);setSync('erro')}
}
function renderTudo(){
  $('custoKwh').value=config.kwh; $('watts').value=config.watts;
  $('impModelo').value=impressora.modelo||''; $('impValor').value=impressora.valor||'';
  renderTipos(); renderFilamentos();
  const ativa=document.querySelector('nav.tabs button.active')?.dataset.tab;
  if(ativa==='vendas')renderVendas();
  if(ativa==='impressora')renderImpressora();
  if(ativa==='pedidos'){renderProdutoSelectPedido();renderPedidos();}
}
let pedidoItensTemp=[];
let pendente=null;
const brl=n=>'R$ '+(Number(n)||0).toFixed(2).replace('.',',');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function showTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
  $('tab-'+name).classList.add('active');
  document.querySelector(`nav.tabs button[data-tab="${name}"]`).classList.add('active');
  if(name==='vendas')renderVendas();
  if(name==='impressora')renderImpressora();
  if(name==='pedidos'){renderProdutoSelectPedido();renderPedidos();}
}

window.onload=()=>{
  renderTudo(); setSync('carregando'); carregarServidor();
};
// Atualiza com as alterações feitas em outros dispositivos ao voltar para a aba.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')carregarServidor()});

function salvarConfiguracoes(){
  config.kwh=parseFloat($('custoKwh').value)||0;
  config.watts=parseFloat($('watts').value)||0;
  saveJSON('config3d',config); alert('Configurações salvas!');
}

function renderTipos(){
  const select=$('filTipo'); const atual=select.value;
  select.innerHTML=tipos.map(t=>`<option value="${t}">${t}</option>`).join('');
  if(tipos.includes(atual))select.value=atual;
}

function adicionarTipo(){
  const t=$('novoTipo').value.trim();
  if(!t){alert('Digite o nome do tipo!');return}
  if(!tipos.includes(t))tipos.push(t);
  saveJSON('tipos3d',tipos); $('novoTipo').value=''; renderTipos(); $('filTipo').value=t;
}

function adicionarFilamento(){
  const tipo=$('filTipo').value, nome=$('filNome').value.trim(), cor=$('filCor').value.trim();
  const preco=parseFloat($('filPreco').value), peso=parseFloat($('filPeso').value);
  if(!tipo||!nome||!cor||!preco||!peso){alert('Preencha todos os campos do filamento!');return}
  filamentos.push({id:uid(),tipo,nome,cor,preco,peso,custoPorGrama:preco/peso});
  saveJSON('filamentos3d',filamentos);
  $('filNome').value='';$('filCor').value='';$('filPreco').value='';$('filPeso').value='';
  renderFilamentos();
}

function excluirFilamento(id){
  filamentos=filamentos.filter(f=>f.id!==id); saveJSON('filamentos3d',filamentos); renderFilamentos();
}

function renderFilamentos(){
  const grupos={};
  filamentos.forEach(f=>{(grupos[f.tipo]=grupos[f.tipo]||[]).push(f)});
  const tiposOrdenados=Object.keys(grupos).sort();
  const select=$('calcFilamento'); select.innerHTML='';
  tiposOrdenados.forEach(tipo=>{
    const og=document.createElement('optgroup'); og.label=tipo;
    grupos[tipo].forEach(f=>{
      const o=document.createElement('option'); o.value=f.id;
      o.textContent=`${f.nome} (${f.cor}) — ${brl(f.preco)}`; og.appendChild(o);
    });
    select.appendChild(og);
  });
  $('listaFilamentos').innerHTML=tiposOrdenados.map(tipo=>
    `<div style="margin-bottom:.6rem"><span class="pill">${tipo}</span>`+
    grupos[tipo].map(f=>`<div class="stat"><span>${f.nome} · ${f.cor} <span class="pill">${brl(f.custoPorGrama)}/g</span></span><button class="ghost" onclick="excluirFilamento('${f.id}')">remover</button></div>`).join('')+
    `</div>`
  ).join('')||'<p class="empty">Nenhum filamento cadastrado.</p>';
}

function calcularCusto(){
  if(filamentos.length===0){alert('Adicione um filamento primeiro!');return}
  const filamento=filamentos.find(f=>f.id===$('calcFilamento').value);
  if(!filamento){alert('Selecione um filamento válido (recarregue a lista se necessário).');return}
  const pecaNome=$('pecaNome').value.trim()||'Peça sem nome';
  const peso=parseFloat($('pecaPeso').value), horas=parseFloat($('pecaHoras').value);
  const lucroPercentual=parseFloat($('lucro').value)||0;
  if(!peso||!horas){alert('Preencha o peso e o tempo da peça!');return}
  const custoMaterial=peso*filamento.custoPorGrama;
  const custoEnergia=(config.watts/1000)*horas*config.kwh;
  const custoBase=custoMaterial+custoEnergia;
  const precoVenda=custoBase*(1+lucroPercentual/100);
  pendente={pecaNome,peso,horas,filamentoId:filamento.id,custoMaterial,custoEnergia,custoBase,lucroPercentual,precoSugerido:precoVenda};
  $('resultadoCard').classList.remove('hidden');
  $('resNomePeca').textContent=`${pecaNome} — ${filamento.cor}`;
  $('resMaterial').textContent=brl(custoMaterial);
  $('resEnergia').textContent=brl(custoEnergia);
  $('resCustoBase').textContent=brl(custoBase);
  $('resVenda').textContent=brl(precoVenda);
}

function salvarProduto(){
  if(!pendente)return;
  let produto=produtos.find(p=>p.nome.toLowerCase()===pendente.pecaNome.toLowerCase());
  if(!produto){produto={id:uid(),nome:pendente.pecaNome,peso:pendente.peso,horas:pendente.horas,variantes:[]};produtos.push(produto)}
  let variante=produto.variantes.find(v=>v.filamentoId===pendente.filamentoId);
  const dados={filamentoId:pendente.filamentoId,custoMaterial:pendente.custoMaterial,custoEnergia:pendente.custoEnergia,
    custoBase:pendente.custoBase,lucroPercentual:pendente.lucroPercentual,precoSugerido:pendente.precoSugerido};
  if(variante)Object.assign(variante,dados);
  else produto.variantes.push({id:uid(),...dados,precoVenda:'',vendidos:0});
  saveJSON('produtos3d',produtos);
  alert('Produto salvo! Veja a aba Vendas.');
}

function excluirVariante(prodId,varId){
  const produto=produtos.find(p=>p.id===prodId); if(!produto)return;
  produto.variantes=produto.variantes.filter(v=>v.id!==varId);
  if(produto.variantes.length===0)produtos=produtos.filter(p=>p.id!==prodId);
  saveJSON('produtos3d',produtos); renderVendas();
}

function atualizarVariante(prodId,varId,campo,valor){
  const produto=produtos.find(p=>p.id===prodId); const v=produto?.variantes.find(v=>v.id===varId);
  if(!v)return; v[campo]=parseFloat(valor)||0; saveJSON('produtos3d',produtos); renderVendas();
}

function renderVendas(){
  const tbody=document.querySelector('#tabelaVendas tbody'); tbody.innerHTML='';
  let totFat=0, totCusto=0;
  produtos.forEach(p=>p.variantes.forEach(v=>{
    const fil=filamentos.find(f=>f.id===v.filamentoId);
    const vendidos=Number(v.vendidos)||0, precoVenda=Number(v.precoVenda)||0;
    const faturado=vendidos*precoVenda, custoTot=vendidos*v.custoBase, lucro=faturado-custoTot;
    totFat+=faturado; totCusto+=custoTot;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${p.nome}</td><td>${fil?fil.nome+' · '+fil.cor:'—'}</td>
      <td class="mono">${(p.horas||0)}h</td>
      <td class="mono">${(vendidos*(p.horas||0)).toFixed(1).replace(/\.0$/,'')}h</td>
      <td class="mono">${brl(v.custoBase)}</td><td class="mono">${brl(v.precoSugerido)}</td>
      <td><input type="number" step="0.01" value="${v.precoVenda||''}" placeholder="0,00" onchange="atualizarVariante('${p.id}','${v.id}','precoVenda',this.value)"></td>
      <td><input type="number" value="${v.vendidos||0}" onchange="atualizarVariante('${p.id}','${v.id}','vendidos',this.value)"></td>
      <td class="mono">${brl(faturado)}</td><td class="mono ${lucro>=0?'pos':'neg'}">${brl(lucro)}</td>
      <td><button class="ghost" onclick="excluirVariante('${p.id}','${v.id}')">✕</button></td>`;
    tbody.appendChild(tr);
  }));
  $('vendasVazio').classList.toggle('hidden',produtos.length>0);
  $('totFaturado').textContent=brl(totFat); $('totCusto').textContent=brl(totCusto);
  $('totLucro').textContent=brl(totFat-totCusto);
}

function renderProdutoSelectPedido(){
  const select=$('pedProduto'); select.innerHTML=produtos.map(p=>`<option value="${p.id}">${p.nome}</option>`).join('');
  atualizarVariantesSelect();
}

function atualizarVariantesSelect(){
  const produto=produtos.find(p=>p.id===$('pedProduto').value);
  $('pedVariante').innerHTML=(produto?.variantes||[]).map(v=>{
    const fil=filamentos.find(f=>f.id===v.filamentoId);
    return `<option value="${v.id}">${fil?fil.nome+' · '+fil.cor:'—'}</option>`;
  }).join('');
}

function adicionarItemPedido(){
  const produto=produtos.find(p=>p.id===$('pedProduto').value);
  if(!produto){alert('Cadastre e salve um produto primeiro (aba Calculadora)!');return}
  const varianteId=$('pedVariante').value, variante=produto.variantes.find(v=>v.id===varianteId);
  const fil=filamentos.find(f=>f.id===variante?.filamentoId);
  const quantidade=parseInt($('pedQtd').value)||1;
  pedidoItensTemp.push({produtoId:produto.id,varianteId,quantidade,label:`${produto.nome} — ${fil?fil.nome+' · '+fil.cor:'—'} ×${quantidade}`});
  renderItensPedidoTemp();
}

function removerItemPedidoTemp(i){ pedidoItensTemp.splice(i,1); renderItensPedidoTemp(); }

function renderItensPedidoTemp(){
  $('itensPedidoTemp').innerHTML=pedidoItensTemp.map((it,i)=>
    `<div class="itemLinha"><span>${it.label}</span><button class="ghost" onclick="removerItemPedidoTemp(${i})">✕</button></div>`
  ).join('');
}

function criarPedido(){
  if(pedidoItensTemp.length===0){alert('Adicione pelo menos um item ao pedido!');return}
  pedidos.push({id:uid(),descricao:$('pedDescricao').value.trim(),status:'fila',itens:pedidoItensTemp,contabilizado:false,criadoEm:Date.now()});
  saveJSON('pedidos3d',pedidos);
  $('pedDescricao').value='';
  pedidoItensTemp=[]; renderItensPedidoTemp(); renderPedidos();
}

function ajustarVendidos(pedido,sinal){
  pedido.itens.forEach(it=>{
    const produto=produtos.find(p=>p.id===it.produtoId);
    const v=produto?.variantes.find(v=>v.id===it.varianteId);
    if(v)v.vendidos=Math.max(0,(Number(v.vendidos)||0)+sinal*it.quantidade);
  });
  saveJSON('produtos3d',produtos);
}

function onDragStart(ev,id){ ev.dataTransfer.setData('text/plain',id); }

function onDropColuna(ev,novoStatus){
  ev.preventDefault(); ev.currentTarget.classList.remove('dragover');
  const id=ev.dataTransfer.getData('text/plain');
  moverPedido(id,novoStatus);
}

function moverPedido(id,novoStatus){
  const pedido=pedidos.find(p=>p.id===id); if(!pedido||pedido.status===novoStatus)return;
  if(novoStatus==='concluido'&&!pedido.contabilizado){ajustarVendidos(pedido,1);pedido.contabilizado=true}
  else if(pedido.status==='concluido'&&novoStatus!=='concluido'&&pedido.contabilizado){ajustarVendidos(pedido,-1);pedido.contabilizado=false}
  pedido.status=novoStatus;
  saveJSON('pedidos3d',pedidos); renderPedidos();
}

function excluirPedido(id){
  const pedido=pedidos.find(p=>p.id===id); if(!pedido)return;
  if(pedido.status==='concluido'&&pedido.contabilizado)ajustarVendidos(pedido,-1);
  pedidos=pedidos.filter(p=>p.id!==id); saveJSON('pedidos3d',pedidos); renderPedidos();
}

function renderPedidos(){
  ['fila','producao','concluido'].forEach(status=>{
    $('col-'+status).innerHTML=pedidos.filter(p=>p.status===status).map(p=>
      `<div class="kcard" draggable="true" ondragstart="onDragStart(event,'${p.id}')">
        <button class="ghost kdel" onclick="excluirPedido('${p.id}')">✕</button>
        <b>Pedido ${p.id.slice(-4)}</b>
        ${p.descricao?`<div class="kdescricao">${escaparTexto(p.descricao)}</div>`:''}
        ${p.itens.map(it=>`<div class="kitem">${it.label}</div>`).join('')}
      </div>`
    ).join('')||'<p class="empty" style="font-size:.85rem">Vazio</p>';
  });
}

function escaparTexto(texto){
  const elemento=document.createElement('div');
  elemento.textContent=texto;
  return elemento.innerHTML;
}

function salvarImpressora(){
  impressora={modelo:$('impModelo').value.trim(),valor:parseFloat($('impValor').value)||0};
  saveJSON('impressora3d',impressora); renderImpressora(); alert('Impressora salva!');
}

function calcularLucroTotal(){
  let lucro=0;
  produtos.forEach(p=>p.variantes.forEach(v=>{lucro+=(Number(v.vendidos)||0)*((Number(v.precoVenda)||0)-v.custoBase)}));
  return lucro;
}

const DONUT_CIRC=2*Math.PI*72;
function renderImpressora(){
  const lucro=Math.max(0,calcularLucroTotal()), valor=impressora.valor||0;
  const pago=Math.min(lucro,valor), falta=Math.max(0,valor-lucro);
  const pct=valor>0?Math.min(100,(pago/valor)*100):0;
  const bar=$('donutBar');
  bar.style.strokeDasharray=DONUT_CIRC;
  bar.style.strokeDashoffset=DONUT_CIRC*(1-pct/100);
  bar.style.stroke=pct>=100?'var(--accent)':'var(--good)';
  $('donutPct').textContent=Math.round(pct)+'%';
  $('impPago').textContent=brl(lucro); $('impTotal').textContent=brl(valor); $('impFalta').textContent=brl(falta);
  $('impProgressoCard').classList.toggle('hidden',valor<=0);
}
