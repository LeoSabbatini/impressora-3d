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
  filamentos=loadJSON('filamentos3d',[]).map(f=>({...f,id:f.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6)),tipo:f.tipo||'Outro'}));
  tipos=loadJSON('tipos3d',['PLA','PLA Silk','PETG','ABS','TPU']).map(tipo=>{
    if(typeof tipo!=='string')return tipo;
    const antigo=filamentos.find(f=>f.tipo===tipo&&Number(f.custoPorGrama)>0);
    return {nome:tipo,precoKg:antigo?antigo.custoPorGrama*1000:({'PLA':120,'PLA Silk':130}[tipo]??null)};
  });
  filamentos.forEach(f=>{
    if(!tipos.some(tipo=>tipo.nome===f.tipo))tipos.push({nome:f.tipo,precoKg:Number(f.custoPorGrama)>0?f.custoPorGrama*1000:null});
  });
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
      else if(k!=='tipos3d'&&localStorage.getItem(k)!==null)enviarServidor(k,loadJSON(k,null));
    });
    aplicarDados();
    if(JSON.stringify(loadJSON('tipos3d',null))!==JSON.stringify(tipos))saveJSON('tipos3d',tipos);
    renderTudo(); setSync('ok');
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
  saveJSON('config3d',config); renderCustoItemPedido(); alert('Configurações salvas!');
}

function renderTipos(){
  const select=$('filTipo'); const atual=select.value;
  select.replaceChildren(...tipos.map(tipo=>new Option(`${tipo.nome} — ${tipo.precoKg>0?brl(tipo.precoKg)+'/kg':'defina o preço'}`,tipo.nome)));
  if(tipos.some(tipo=>tipo.nome===atual))select.value=atual;
  $('listaTipos').innerHTML=tipos.map((tipo,index)=>`<label class="stat"><span>${escaparTexto(tipo.nome)}</span><input style="width:8rem" type="number" min="0.01" step="0.01" aria-label="Preço por kg de ${escaparTexto(tipo.nome)}" value="${tipo.precoKg??''}" placeholder="R$/kg" onchange="atualizarPrecoTipo(${index},this.value)"></label>`).join('');
}

function adicionarTipo(){
  const t=$('novoTipo').value.trim();
  const precoKg=Number($('novoTipoPreco').value);
  if(!t||!Number.isFinite(precoKg)||precoKg<=0){alert('Informe o nome do tipo e um preço por kg maior que zero!');return}
  if(tipos.some(tipo=>tipo.nome.toLowerCase()===t.toLowerCase())){alert('Esse tipo já existe. Altere seu preço na lista de preços por tipo.');return}
  tipos.push({nome:t,precoKg});
  saveJSON('tipos3d',tipos); $('novoTipo').value=''; $('novoTipoPreco').value=''; renderTipos(); $('filTipo').value=t;
  renderFilamentos();
}

function atualizarPrecoTipo(index,valor){
  const precoKg=Number(valor);
  if(!Number.isFinite(precoKg)||precoKg<=0){alert('Informe um preço por kg maior que zero!');renderTipos();return}
  tipos[index].precoKg=precoKg;
  saveJSON('tipos3d',tipos); renderTipos(); renderFilamentos();
}

function adicionarFilamento(){
  const tipo=$('filTipo').value, nome=$('filNome').value.trim(), cor=$('filCor').value.trim();
  if(!tipo||!nome||!cor){alert('Preencha todos os campos do filamento!');return}
  if(!(tipos.find(t=>t.nome===tipo)?.precoKg>0)){alert('Defina o preço por kg desse tipo antes de adicionar o filamento!');return}
  filamentos.push({id:uid(),tipo,nome,cor});
  saveJSON('filamentos3d',filamentos);
  $('filNome').value='';$('filCor').value='';
  renderFilamentos();
}

function excluirFilamento(id){
  filamentos=filamentos.filter(f=>f.id!==id); saveJSON('filamentos3d',filamentos); renderFilamentos();
}

function renderFilamentos(){
  const grupos=Object.create(null);
  filamentos.forEach(f=>{(grupos[f.tipo]=grupos[f.tipo]||[]).push(f)});
  const tiposOrdenados=Object.keys(grupos).sort();
  const select=$('pedFilamento'); const atual=select.value; select.innerHTML='';
  tiposOrdenados.forEach(tipo=>{
    const og=document.createElement('optgroup'); og.label=tipo;
    grupos[tipo].forEach(f=>{
      const o=document.createElement('option'); o.value=f.id;
      const precoKg=tipos.find(t=>t.nome===f.tipo)?.precoKg;
      o.textContent=`${f.nome} (${f.cor}) — ${precoKg>0?brl(precoKg)+'/kg':'defina o preço do tipo'}`; og.appendChild(o);
    });
    select.appendChild(og);
  });
  if(filamentos.some(f=>f.id===atual))select.value=atual;
  $('listaFilamentos').innerHTML=tiposOrdenados.map(tipo=>
    `<div style="margin-bottom:.6rem"><span class="pill">${escaparTexto(tipo)}</span>`+
    grupos[tipo].map(f=>`<div class="stat"><span>${escaparTexto(f.nome)} · ${escaparTexto(f.cor)}</span><button class="ghost" onclick="excluirFilamento('${f.id}')">remover</button></div>`).join('')+
    `</div>`
  ).join('')||'<p class="empty">Nenhum filamento cadastrado.</p>';
  renderCustoItemPedido();
}

function calcularCusto(){
  const pecaNome=$('pecaNome').value.trim()||'Peça sem nome';
  const peso=parseFloat($('pecaPeso').value), horas=parseFloat($('pecaHoras').value);
  const lucroPercentual=parseFloat($('lucro').value)||0;
  if(!Number.isFinite(peso)||peso<=0||!Number.isFinite(horas)||horas<=0||!Number.isFinite(lucroPercentual)||lucroPercentual<0){alert('Informe peso e tempo maiores que zero e uma margem válida!');return}
  const custoEnergia=(config.watts/1000)*horas*config.kwh;
  pendente={pecaNome,peso,horas,custoEnergia,lucroPercentual};
  $('resultadoCard').classList.remove('hidden');
  $('resNomePeca').textContent=pecaNome;
  $('resMaterial').textContent='Definido no pedido';
  $('resEnergia').textContent=brl(custoEnergia);
  $('resCustoBase').textContent='Definido no pedido';
  $('resVenda').textContent='Definido no pedido';
}

function salvarProduto(){
  if(!pendente)return;
  let produto=produtos.find(p=>p.nome.toLowerCase()===pendente.pecaNome.toLowerCase());
  if(!produto){produto={id:uid(),nome:pendente.pecaNome,peso:pendente.peso,horas:pendente.horas,variantes:[]};produtos.push(produto)}
  produto.variantes.forEach(v=>{if(v.horas===undefined)v.horas=produto.horas});
  Object.assign(produto,{peso:pendente.peso,horas:pendente.horas,lucroPercentual:pendente.lucroPercentual});
  saveJSON('produtos3d',produtos);
  renderProdutoSelectPedido();
  alert('Produto salvo! Escolha o filamento ao adicionar cada item do pedido.');
}

function excluirVariante(prodId,varId){
  const produto=produtos.find(p=>p.id===prodId); if(!produto)return;
  produto.variantes=produto.variantes.filter(v=>v.id!==varId);
  saveJSON('produtos3d',produtos); renderVendas();
}

function atualizarVariante(prodId,varId,campo,valor){
  const produto=produtos.find(p=>p.id===prodId); const v=produto?.variantes.find(v=>v.id===varId);
  if(!v)return; v[campo]=parseFloat(valor)||0; saveJSON('produtos3d',produtos); renderVendas();
}

function atualizarPrecoProduto(prodId,valor){
  const produto=produtos.find(p=>p.id===prodId);
  const preco=Number(valor);
  if(!produto||!Number.isFinite(preco)||preco<0)return;
  produto.precoVenda=preco; saveJSON('produtos3d',produtos);
}

function excluirProduto(prodId){
  produtos=produtos.filter(p=>p.id!==prodId);
  saveJSON('produtos3d',produtos); renderVendas();
}

function renderVendas(){
  const tbody=document.querySelector('#tabelaVendas tbody'); tbody.innerHTML='';
  let totFat=0, totCusto=0;
  produtos.forEach(p=>{
    if(p.variantes.length===0){
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${escaparTexto(p.nome)}</td><td>No pedido</td><td class="mono">${p.horas||0}h</td><td>0h</td><td colspan="2">Definido no pedido</td>
        <td><input type="number" min="0" step="0.01" aria-label="Preço de venda" value="${p.precoVenda||''}" placeholder="0,00" onchange="atualizarPrecoProduto('${p.id}',this.value)"></td>
        <td>0</td><td class="mono">${brl(0)}</td><td class="mono">${brl(0)}</td><td><button class="ghost" onclick="excluirProduto('${p.id}')">✕</button></td>`;
      tbody.appendChild(tr);
    }
    p.variantes.forEach(v=>{
    const fil=filamentos.find(f=>f.id===v.filamentoId);
    const vendidos=Number(v.vendidos)||0, precoVenda=Number(v.precoVenda)||0;
    const faturado=vendidos*precoVenda, custoTot=vendidos*v.custoBase, lucro=faturado-custoTot;
    totFat+=faturado; totCusto+=custoTot;
    const tr=document.createElement('tr');
    const horas=v.horas??p.horas??0;
    tr.innerHTML=`<td>${escaparTexto(p.nome)}</td><td>${escaparTexto(v.filamentoNome||(fil?fil.nome+' · '+fil.cor:'—'))}</td>
      <td class="mono">${horas}h</td>
      <td class="mono">${(vendidos*horas).toFixed(1).replace(/\.0$/,'')}h</td>
      <td class="mono">${brl(v.custoBase)}</td><td class="mono">${brl(v.precoSugerido)}</td>
      <td><input type="number" step="0.01" value="${v.precoVenda||''}" placeholder="0,00" onchange="atualizarVariante('${p.id}','${v.id}','precoVenda',this.value)"></td>
      <td><input type="number" value="${v.vendidos||0}" onchange="atualizarVariante('${p.id}','${v.id}','vendidos',this.value)"></td>
      <td class="mono">${brl(faturado)}</td><td class="mono ${lucro>=0?'pos':'neg'}">${brl(lucro)}</td>
      <td><button class="ghost" onclick="excluirVariante('${p.id}','${v.id}')">✕</button></td>`;
    tbody.appendChild(tr);
    });
  });
  $('vendasVazio').classList.toggle('hidden',produtos.length>0);
  $('totFaturado').textContent=brl(totFat); $('totCusto').textContent=brl(totCusto);
  $('totLucro').textContent=brl(totFat-totCusto);
}

function renderProdutoSelectPedido(){
  const select=$('pedProduto'); const atual=select.value;
  select.replaceChildren(...produtos.map(p=>new Option(p.nome,p.id)));
  if(produtos.some(p=>p.id===atual))select.value=atual;
  renderCustoItemPedido();
}

function calcularItemPedido(produto,filamento){
  const tipo=tipos.find(t=>t.nome===filamento.tipo);
  if(!(tipo?.precoKg>0))return null;
  const lucroPercentual=produto.lucroPercentual??produto.variantes[0]?.lucroPercentual??0;
  const custoMaterial=produto.peso*tipo.precoKg/1000;
  const custoEnergia=(config.watts/1000)*produto.horas*config.kwh;
  const custoBase=custoMaterial+custoEnergia;
  const anterior=produto.variantes.findLast(v=>v.filamentoId===filamento.id);
  return {filamentoId:filamento.id,filamentoNome:`${filamento.tipo} · ${filamento.nome} · ${filamento.cor}`,
    precoKg:tipo.precoKg,peso:produto.peso,horas:produto.horas,
    custoMaterial,custoEnergia,custoBase,lucroPercentual,precoSugerido:custoBase*(1+lucroPercentual/100),
    precoVenda:produto.precoVenda??anterior?.precoVenda??''};
}

function renderCustoItemPedido(){
  const produto=produtos.find(p=>p.id===$('pedProduto').value);
  const filamento=filamentos.find(f=>f.id===$('pedFilamento').value);
  if(!produto||!filamento){$('pedCustoItem').textContent='Cadastre um produto e um filamento para adicionar itens ao pedido.';return}
  const custos=calcularItemPedido(produto,filamento);
  $('pedCustoItem').textContent=custos?`Por unidade: material ${brl(custos.custoMaterial)} + energia ${brl(custos.custoEnergia)} = custo ${brl(custos.custoBase)} · Venda sugerida ${brl(custos.precoSugerido)}`:'Defina o preço por kg desse tipo na aba Calculadora.';
}

function adicionarItemPedido(){
  const produto=produtos.find(p=>p.id===$('pedProduto').value);
  if(!produto){alert('Cadastre e salve um produto primeiro (aba Calculadora)!');return}
  const fil=filamentos.find(f=>f.id===$('pedFilamento').value);
  if(!fil){alert('Cadastre e selecione um filamento para este item!');return}
  const custos=calcularItemPedido(produto,fil);
  if(!custos){alert('Defina o preço por kg desse tipo de filamento na aba Calculadora!');return}
  const quantidade=Number($('pedQtd').value);
  if(!Number.isSafeInteger(quantidade)||quantidade<1){alert('Informe uma quantidade inteira maior que zero!');return}
  pedidoItensTemp.push({produtoId:produto.id,...custos,quantidade,label:`${produto.nome} — ${custos.filamentoNome} ×${quantidade}`});
  renderItensPedidoTemp();
}

function removerItemPedidoTemp(i){ pedidoItensTemp.splice(i,1); renderItensPedidoTemp(); }

function renderItensPedidoTemp(){
  $('itensPedidoTemp').innerHTML=pedidoItensTemp.map((it,i)=>
    `<div class="itemLinha"><span>${escaparTexto(it.label)}<br>Custo: ${brl(it.custoBase*it.quantidade)} · Sugerido: ${brl(it.precoSugerido*it.quantidade)}</span><button class="ghost" onclick="removerItemPedidoTemp(${i})">✕</button></div>`
  ).join('');
}

function criarPedido(){
  if(pedidoItensTemp.length===0){alert('Adicione pelo menos um item ao pedido!');return}
  if(pedidoItensTemp.some(it=>!produtos.some(p=>p.id===it.produtoId))){alert('Um produto foi removido. Remova esse item e adicione outro ao pedido.');return}
  pedidoItensTemp.forEach(it=>{
    const produto=produtos.find(p=>p.id===it.produtoId);
    let variante=produto.variantes.find(v=>v.filamentoId===it.filamentoId&&v.custoBase===it.custoBase&&v.precoSugerido===it.precoSugerido&&(v.horas??produto.horas)===it.horas&&v.precoVenda===it.precoVenda);
    if(!variante){
      const {produtoId,quantidade,label,...custos}=it;
      variante={id:uid(),...custos,vendidos:0}; produto.variantes.push(variante);
    }
    it.varianteId=variante.id;
  });
  saveJSON('produtos3d',produtos);
  pedidos.push({id:uid(),cliente:$('pedCliente').value.trim(),descricao:$('pedDescricao').value.trim(),status:'fila',itens:pedidoItensTemp,contabilizado:false,criadoEm:Date.now()});
  saveJSON('pedidos3d',pedidos);
  $('pedCliente').value='';
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
        ${p.cliente?`<div class="kcliente">Cliente: ${escaparTexto(p.cliente)}</div>`:''}
        ${renderDataPedido(p.criadoEm)}
        ${p.descricao?`<div class="kdescricao">${escaparTexto(p.descricao)}</div>`:''}
        ${p.itens.map(it=>`<div class="kitem">${escaparTexto(it.label)}</div>`).join('')}
      </div>`
    ).join('')||'<p class="empty" style="font-size:.85rem">Vazio</p>';
  });
}

function renderDataPedido(criadoEm){
  if(criadoEm===undefined||criadoEm===null||criadoEm==='')return '';
  const data=new Date(criadoEm);
  if(Number.isNaN(data.getTime()))return '';
  return `<time class="kdata" datetime="${data.toISOString()}">Criado em: ${data.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</time>`;
}

function escaparTexto(texto){
  const elemento=document.createElement('div');
  elemento.textContent=texto;
  return elemento.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
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
