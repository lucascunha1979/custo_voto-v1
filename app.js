// ============================================================
// FINANÇAS ELEITORAIS RS 2026 — BLOCO 08D
// INTERFACE COM ABAS E TÍTULOS DINÂMICOS
// ============================================================

"use strict";

let candidaturas = [];
let resumoGeral = null;
let metadados = null;
let detalhamento = null;

let dadosFiltrados = [];
let paginaAtual = 1;
let abaAtual = "geral";

const POR_PAGINA = 25;

const INDICADORES = {
  receitas_total: "Receitas totais",
  receitas_financeiras: "Receitas financeiras",
  receitas_estimaveis: "Receitas estimáveis",
  despesas_contratadas: "Despesas contratadas",
  despesas_pagas: "Despesas pagas"
};

const $ = id => document.getElementById(id);

const inteiro = v =>
  v === null || v === undefined
    ? "Sem vínculo"
    : new Intl.NumberFormat("pt-BR").format(v);

const reais = centavos =>
  centavos === null || centavos === undefined
    ? "Sem informação"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
      }).format(centavos / 100);

const dinheiro = c =>
  Number(c || 0) / 100;

function soma(lista, indicador) {
  return lista.reduce(
    (total, c) =>
      total + (c.financeiro_centavos[indicador] ?? 0),
    0
  );
}

function estatisticas(lista) {
  const validos = lista.filter(c => c.vinculo_validado && Number.isFinite(c.votos) && c.votos >= 0);
  return { total: lista.length, votos: validos.reduce((n,c)=>n+c.votos,0),
    receitas: soma(validos,"receitas_total"), contratadas: soma(validos,"despesas_contratadas"), pagas: soma(validos,"despesas_pagas"),
    receitasTodos: soma(lista,"receitas_total"), contratadasTodos: soma(lista,"despesas_contratadas"), pagasTodos: soma(lista,"despesas_pagas") };
}
function custoVoto(e,campo) {return e.votos>0 ? e[campo] / (100*e.votos) : null;}
const numeroDecimal = v => new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
function barraHorizontal(id, linhas, unidade="R$") {
 const itens=[...linhas].sort((a,b)=>b.valor-a.valor);
 const altura=Math.max(420,120+itens.length*33);
 $(id).style.height=altura+"px";
 Plotly.react(id,[{type:"bar",orientation:"h",y:itens.map(x=>x.nome).reverse(),x:itens.map(x=>x.valor).reverse(),
 customdata:itens.map(x=>unidade==="Votos"?inteiro(x.valor):unidade==="R$/voto"?reais(Math.round(x.valor*100)):reais(Math.round(x.valor*100))).reverse(),
 marker:{color:"#1555a5"},hovertemplate:"%{y}: %{customdata}<extra></extra>"}],
 {...LAYOUT_BASE,height:altura,margin:{l:175,r:30,t:20,b:72},xaxis:{title:unidade,automargin:true,tickformat:",.0f"},yaxis:{automargin:true}},CONFIG);
}
function grupoPartidos(lista) {
 const m=new Map();lista.forEach(c=>{if(!m.has(c.partido))m.set(c.partido,[]);m.get(c.partido).push(c);});return [...m].map(([nome,dados])=>({nome,dados}));
}
function graficoCustoCargo() {
 const cargos=[...new Set(dadosFiltrados.map(c=>c.cargo))];
 barraHorizontal("graficoCustoCargo",cargos.map(nome=>({nome,valor:custoVoto(estatisticas(dadosFiltrados.filter(c=>c.cargo===nome)),"contratadas")??0})),"R$/voto");
 $("subCustoCargo").textContent="Candidaturas vinculadas; cargos sem votos mostram barra zero, sem custo calculável.";
}
function graficoRelacao() {
 const cargos=[...new Set(dadosFiltrados.map(c=>c.cargo))];
 const d=cargos.map(nome=>({nome,lista:dadosFiltrados.filter(c=>c.cargo===nome)}));
 Plotly.react("graficoRelacao",["receitas_total","despesas_contratadas","despesas_pagas"].map((k,i)=>({
 type:"bar",name:INDICADORES[k],x:d.map(x=>x.nome),y:d.map(x=>dinheiro(soma(x.lista,k))),
 marker:{color:["#087e8b","#8056b8","#bf7027"][i]}})),
 {...LAYOUT_BASE,height:440,barmode:"group",margin:{l:90,r:25,t:30,b:120},xaxis:{automargin:true},yaxis:{title:"R$",automargin:true}},CONFIG);
 $("subRelacao").textContent="Valores declarados, sem somar despesas contratadas às pagas.";
}
function graficosExtraPartidos() {
 const grupos=grupoPartidos(dadosFiltrados);
 barraHorizontal("graficoCustoPartidos",grupos.map(g=>({nome:g.nome,valor:custoVoto(estatisticas(g.dados),"contratadas")??0})),"R$/voto");
 barraHorizontal("graficoVotosPartidos",grupos.map(g=>({nome:g.nome,valor:estatisticas(g.dados).votos})),"Votos");
 $("tituloPartidosCusto").textContent="Custo contratado por voto — "+textoContexto();
 $("tituloPartidosVotos").textContent="Votos vinculados por partido — "+textoContexto();
}
function agregacaoCategoria(tipo) {
 const ids=new Set(dadosFiltrados.map(c=>c.sq_candidato));
 const mapa=new Map();
 for(const r of (detalhamento.classificacoes[tipo]||[])){
 if(!ids.has(r.sq_candidato))continue;
 mapa.set(r.categoria,(mapa.get(r.categoria)||0)+r.valor_centavos);
 }
 return [...mapa].map(([nome,valor])=>({nome,valor:valor/100}));
}
function graficosDetalhamento() {
 const r=$("tipoReceita").value;
 barraHorizontal("graficoOrigem",agregacaoCategoria(r),"R$");
 barraHorizontal("graficoDespesas",agregacaoCategoria("categorias_despesas"),"R$");
 $("tituloDetalhamento").textContent="Origem e aplicação — "+textoContexto();
 $("tituloOrigem").textContent=$("tipoReceita").selectedOptions[0].text+" — "+textoContexto();
 $("tituloDespesas").textContent="Despesas contratadas por categoria — "+textoContexto();
}
function filtrosComparacao() {
 const cargo=$("filtroCargo").value,situacao=$("filtroSituacao").value;
 return candidaturas.filter(c=>(!cargo||c.cargo===cargo)&&(!situacao||(c.situacao_totalizacao||"Não informado")===situacao));
}
function configurarComparacao() {
 const vals=[...new Set(filtrosComparacao().map(c=>c.partido))].sort();
 for(const id of ["partidoA","partidoB"]){
 const antes=$(id).value; preencherSelect(id,vals,"Escolha um partido"); if(vals.includes(antes))$(id).value=antes;
 }
 if(!$("partidoA").value)$("partidoA").value=vals[0]||"";
 if(!$("partidoB").value)$("partidoB").value=vals.find(x=>x!==$("partidoA").value)||vals[0]||"";
}
function graficoComparacao() {
 const a=$("partidoA").value,b=$("partidoB").value;
 const dados=filtrosComparacao(); const la=dados.filter(c=>c.partido===a),lb=dados.filter(c=>c.partido===b);
 const ea=estatisticas(la),eb=estatisticas(lb);
 $("contextoComparacao").textContent=[a,b,$("filtroCargo").value||"Todos os cargos",$("filtroSituacao").value||"Todas as situações"].join(" | ");
 $("tituloComparacao").textContent=a+" × "+b+" — comparação 2026";
 $("cabPartidoA").textContent=a;$("cabPartidoB").textContent=b;
 const met=[
 ["Candidaturas",la.length,lb.length,inteiro],["Votos vinculados",ea.votos,eb.votos,inteiro],
 ["Receitas totais (R$)",ea.receitasTodos,eb.receitasTodos,reais],
 ["Despesas contratadas (R$)",ea.contratadasTodos,eb.contratadasTodos,reais],
 ["Despesas pagas (R$)",ea.pagasTodos,eb.pagasTodos,reais],
 ["Custo contratado por voto",custoVoto(ea,"contratadas"),custoVoto(eb,"contratadas"),v=>v===null?"Não calculável":reais(Math.round(v*100))],
 ["Custo pago por voto",custoVoto(ea,"pagas"),custoVoto(eb,"pagas"),v=>v===null?"Não calculável":reais(Math.round(v*100))],
 ["Receita por voto",custoVoto(ea,"receitas"),custoVoto(eb,"receitas"),v=>v===null?"Não calculável":reais(Math.round(v*100))]
 ];
 $("corpoComparacao").innerHTML=met.map(([n,x,y,f])=>"<tr><td>"+escapeHTML(n)+"</td><td>"+f(x)+"</td><td>"+f(y)+"</td></tr>").join("");
 const cats=["Receitas","Contratadas","Pagas"];
 Plotly.react("graficoComparacaoFinanceira",[["A",la,"#1555a5"],["B",lb,"#087e8b"]].map(([n,l,color])=>({type:"bar",name:n==="A"?a:b,x:cats,y:["receitas_total","despesas_contratadas","despesas_pagas"].map(k=>dinheiro(soma(l,k))),marker:{color}})),{...LAYOUT_BASE,height:440,barmode:"group",xaxis:{automargin:true},yaxis:{title:"R$"}},CONFIG);
 Plotly.react("graficoComparacaoEleitoral",[{type:"bar",x:[a,b],y:[ea.votos,eb.votos],marker:{color:["#1555a5","#087e8b"]},hovertemplate:"%{x}: %{y:,} votos<extra></extra>"}],{...LAYOUT_BASE,height:440,xaxis:{automargin:true},yaxis:{title:"Votos vinculados"}},CONFIG);
}
function escapeHTML(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function buscarJSON(caminho) {
  const resposta = await fetch(caminho);
  if (!resposta.ok) {
    throw new Error(caminho + " — HTTP " + resposta.status);
  }
  return resposta.json();
}

function contextoFiltro() {
  const cargo = $("filtroCargo").value || "Todos os cargos";
  const partido = $("filtroPartido").value || "Todos os partidos";
  const candidatoId = $("filtroCandidato").value;
  const candidato = candidaturas.find(
    c => c.sq_candidato === candidatoId
  );

  return {
    cargo,
    partido,
    candidato: candidato ? candidato.candidato : "Todas as candidaturas",
    situacao: $("filtroSituacao").value || "Todas as situações",
    indicador: INDICADORES[$("filtroIndicador").value]
  };
}

function textoContexto() {
  const c = contextoFiltro();
  return `${c.cargo} | ${c.partido} | ${c.candidato} | ${c.situacao} | 2026`;
}

function preencherSelect(id, valores, rotulo) {
  const select = $(id);
  select.innerHTML = "";
  select.add(new Option(rotulo, ""));
  valores.forEach(v => select.add(new Option(v, v)));
}

function preencherFiltros() {
  preencherSelect(
    "filtroCargo",
    [...new Set(candidaturas.map(c => c.cargo))]
      .filter(Boolean).sort(),
    "Todos os cargos"
  );

  preencherSelect("filtroSituacao", [...new Set(candidaturas.map(c => c.situacao_totalizacao || "Não informado"))].sort((a,b)=>a.localeCompare(b,"pt-BR")), "Todas as situações");
  atualizarFiltrosDependentes();
}

function atualizarFiltrosDependentes() {
  const cargo = $("filtroCargo").value;
  const partidoAntigo = $("filtroPartido").value;
  const candidatoAntigo = $("filtroCandidato").value;

  const filtradosCargo = candidaturas.filter(
    c => !cargo || c.cargo === cargo
  );

  const partidos = [...new Set(
    filtradosCargo.map(c => c.partido)
  )].filter(Boolean).sort();

  preencherSelect(
    "filtroPartido",
    partidos,
    "Todos os partidos"
  );

  if (partidos.includes(partidoAntigo)) {
    $("filtroPartido").value = partidoAntigo;
  }

  const partido = $("filtroPartido").value;

  const disponiveis = filtradosCargo.filter(
    c => !partido || c.partido === partido
  ).sort((a, b) =>
    a.candidato.localeCompare(b.candidato, "pt-BR")
  );

  const select = $("filtroCandidato");
  select.innerHTML = "";
  select.add(new Option("Todas as candidaturas", ""));

  disponiveis.forEach(c => {
    select.add(new Option(
      `${c.candidato} — ${c.partido} (${c.nr_candidato})`,
      c.sq_candidato
    ));
  });

  if (disponiveis.some(
    c => c.sq_candidato === candidatoAntigo
  )) {
    select.value = candidatoAntigo;
  }
}

function aplicarFiltros() {
  const cargo = $("filtroCargo").value;
  const partido = $("filtroPartido").value;
  const candidato = $("filtroCandidato").value;
  const situacao = $("filtroSituacao").value;

  return candidaturas.filter(c =>
    (!cargo || c.cargo === cargo) &&
    (!partido || c.partido === partido) &&
    (!candidato || c.sq_candidato === candidato) &&
    (!situacao || (c.situacao_totalizacao || "Não informado") === situacao)
  );
}

function atualizarTitulos() {
  const contexto = textoContexto();
  const indicador = INDICADORES[$("filtroIndicador").value];

  $("contextoGeral").textContent =
    `Seleção atual: ${contexto} | Indicador: ${indicador}`;

  $("tituloGeral").textContent = `Visão geral — ${contexto}`;
  $("subtituloGeral").textContent =
    "Indicadores financeiros das candidaturas incluídas na seleção.";

  $("tituloPartidos").textContent =
    `${indicador} por partido — ${contexto}`;

  $("subtituloPartidos").textContent =
    `${dadosFiltrados.length} candidaturas no recorte selecionado.`;

  $("tituloCandidatos").textContent =
    `Candidaturas — ${contexto}`;

  $("subtituloCandidatos").textContent =
    `${dadosFiltrados.length} registros disponíveis.`;

  $("tituloComposicao").textContent =
    `Composição financeira — ${contexto}`;

  $("subtituloComposicao").textContent =
    "Receitas e despesas exibidas como categorias distintas.";

  $("tituloVotos").textContent =
    `${indicador} × votação — ${contexto}`;

  $("subtituloVotos").textContent =
    "Apenas candidaturas com correspondência eleitoral validada.";

  $("subtituloGraficoCandidatos").textContent =
    `${indicador} — ${contexto}`;
}

function atualizarKPIs() {
  const validados = dadosFiltrados.filter(
    c => c.vinculo_validado
  ).length;

  $("kpiCandidaturas").textContent =
    inteiro(dadosFiltrados.length);

  $("kpiVinculos").textContent =
    `${inteiro(validados)} com votação vinculada`;

  $("kpiReceitas").textContent =
    reais(soma(dadosFiltrados, "receitas_total"));

  $("kpiContratadas").textContent =
    reais(soma(dadosFiltrados, "despesas_contratadas"));

  $("kpiPagas").textContent =
    reais(soma(dadosFiltrados, "despesas_pagas"));
  const e = estatisticas(dadosFiltrados);
  $("kpiVotos").textContent = inteiro(e.votos);
  $("kpiCustoContrato").textContent = e.votos > 0 ? reais(Math.round(e.contratadas * 100 / e.votos)) : "Não calculável";
  $("kpiCustoPago").textContent = e.votos > 0 ? reais(Math.round(e.pagas * 100 / e.votos)) : "Não calculável";
  $("kpiRecVoto").textContent = e.votos > 0 ? reais(Math.round(e.receitas * 100 / e.votos)) : "Não calculável";
}

const LAYOUT_BASE = {
  paper_bgcolor: "#ffffff",
  plot_bgcolor: "#ffffff",
  font: {family: "Arial", size: 12, color: "#34465d"},
  margin: {l: 90, r: 28, t: 25, b: 76}
};

const CONFIG = {
  responsive: true,
  displaylogo: false,
  locale: "pt-BR"
};

function graficoComposicao() {
  const campos = [
    ["receitas_financeiras", "Receitas financeiras"],
    ["receitas_estimaveis", "Receitas estimáveis"],
    ["despesas_contratadas", "Despesas contratadas"],
    ["despesas_pagas", "Despesas pagas"]
  ];

  Plotly.react("graficoComposicao", [{
    type: "bar",
    orientation: "h",
    y: campos.map(c => c[1]).reverse(),
    x: campos.map(c => dinheiro(soma(dadosFiltrados, c[0]))).reverse(),
    marker: {
      color: ["#c16e2c", "#7d57b9", "#0a8790", "#1b5caf"].reverse()
    },
    hovertemplate: "%{y}<br>R$ %{x:,.2f}<extra></extra>"
  }], {
    ...LAYOUT_BASE,
    height: 440,
    xaxis: {title: "Valor (R$)", automargin: true},
    yaxis: {automargin: true}
  }, CONFIG);
}

function graficoVotos() {
  const indicador = $("filtroIndicador").value;
  const validos = dadosFiltrados.filter(
    c => c.vinculo_validado && c.votos !== null
  );

  Plotly.react("graficoVotos", [{
    type: "scattergl",
    mode: "markers",
    x: validos.map(c => c.votos),
    y: validos.map(c => dinheiro(c.financeiro_centavos[indicador])),
    text: validos.map(c =>
      `${c.candidato}<br>${c.partido} | ${c.cargo}`
    ),
    marker: {size: 9, color: "#1555a5", opacity: .7},
    hovertemplate:
      "<b>%{text}</b><br>Votos: %{x:,}<br>R$ %{y:,.2f}<extra></extra>"
  }], {
    ...LAYOUT_BASE,
    height: 440,
    xaxis: {title: "Votos nominais válidos", rangemode: "tozero"},
    yaxis: {title: "Valor (R$)", rangemode: "tozero"}
  }, CONFIG);
}

function graficoPartidos() {
  const indicador = $("filtroIndicador").value;
  const grupos = new Map();

  dadosFiltrados.forEach(c => {
    const p = c.partido || "Não informado";
    grupos.set(
      p,
      (grupos.get(p) || 0) +
      (c.financeiro_centavos[indicador] ?? 0)
    );
  });

  const ordenados = [...grupos.entries()]
    .sort((a, b) => b[1] - a[1]);

  const altura = Math.max(540, ordenados.length * 36 + 125);
  $("graficoPartidos").style.height = `${altura}px`;

  Plotly.react("graficoPartidos", [{
    type: "bar",
    orientation: "h",
    x: ordenados.map(d => dinheiro(d[1])).reverse(),
    y: ordenados.map(d => d[0]).reverse(),
    marker: {color: "#1555a5"},
    hovertemplate: "%{y}<br>R$ %{x:,.2f}<extra></extra>"
  }], {
    ...LAYOUT_BASE,
    height: altura,
    margin: {l: 130, r: 28, t: 20, b: 70},
    xaxis: {title: "Valor (R$)", automargin: true},
    yaxis: {automargin: true}
  }, CONFIG);
}

function graficoCandidatos() {
  const indicador = $("filtroIndicador").value;

  const ordenados = [...dadosFiltrados]
    .sort((a, b) =>
      (b.financeiro_centavos[indicador] ?? 0) -
      (a.financeiro_centavos[indicador] ?? 0)
    );

  const altura = Math.max(430, ordenados.length * 24 + 130);
  $("graficoCandidatos").style.height = `${altura}px`;

  Plotly.react("graficoCandidatos", [{
    type: "bar",
    orientation: "h",
    x: ordenados.map(c =>
      dinheiro(c.financeiro_centavos[indicador])
    ).reverse(),
    y: ordenados.map(c =>
      `${c.candidato} | ${c.partido}`
    ).reverse(),
    marker: {color: "#087e8b"},
    hovertemplate: "%{y}<br>R$ %{x:,.2f}<extra></extra>"
  }], {
    ...LAYOUT_BASE,
    height: altura,
    margin: {l: 280, r: 28, t: 20, b: 75},
    xaxis: {title: "Valor (R$)"},
    yaxis: {automargin: false}
  }, CONFIG);
}

function obterTabela() {
  const busca = $("buscaTabela").value
    .trim().toLocaleUpperCase("pt-BR");
  const indicador = $("filtroIndicador").value;

  return [...dadosFiltrados]
    .filter(c => {
      const texto = [
        c.candidato, c.partido, c.cargo, c.nr_candidato
      ].join(" ").toLocaleUpperCase("pt-BR");
      return !busca || texto.includes(busca);
    })
    .sort((a, b) =>
      (b.financeiro_centavos[indicador] ?? 0) -
      (a.financeiro_centavos[indicador] ?? 0)
    );
}

function atualizarTabela() {
  const lista = obterTabela();
  const totalPaginas = Math.max(
    1, Math.ceil(lista.length / POR_PAGINA)
  );

  paginaAtual = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaAtual - 1) * POR_PAGINA;

  $("corpoTabela").innerHTML =
    lista.slice(inicio, inicio + POR_PAGINA).map(c => `
      <tr>
        <td>${escapeHTML(c.candidato)}</td>
        <td>${escapeHTML(c.partido)}</td>
        <td>${escapeHTML(c.cargo)}</td>
        <td>${escapeHTML(c.situacao_totalizacao || "Não informado")}</td>
        <td>${c.votos === null ? "Sem vínculo" : inteiro(c.votos)}</td>
        <td>${c.vinculo_validado && c.votos > 0 ? reais(Math.round((c.financeiro_centavos.despesas_contratadas ?? 0)/c.votos)) : "Não calculável"}</td>
        <td>${c.vinculo_validado && c.votos > 0 ? reais(Math.round((c.financeiro_centavos.despesas_pagas ?? 0)/c.votos)) : "Não calculável"}</td>
        <td>${reais(c.financeiro_centavos.receitas_total)}</td>
        <td>${reais(c.financeiro_centavos.despesas_contratadas)}</td>
        <td>${reais(c.financeiro_centavos.despesas_pagas)}</td>
      </tr>
    `).join("");

  $("resumoTabela").textContent =
    `${inteiro(lista.length)} candidaturas — ${textoContexto()}`;

  $("paginaInfo").textContent =
    `Página ${paginaAtual} de ${totalPaginas}`;

  $("paginaAnterior").disabled = paginaAtual <= 1;
  $("paginaProxima").disabled = paginaAtual >= totalPaginas;
}


function exportarXLSX() {
 if(typeof XLSX==="undefined"){alert("Biblioteca XLSX indisponível. Atualize a página e tente novamente.");return;}
 const rows=obterTabela(); const w=XLSX.utils.book_new();
 const cab=["Candidato","Partido","Cargo","Situação eleitoral","Votos","Receitas totais (R$)","Despesas contratadas (R$)","Despesas pagas (R$)","Custo contratado/voto (R$)","Custo pago/voto (R$)"];
 const linhas=rows.map(c=>[c.candidato,c.partido,c.cargo,c.situacao_totalizacao||"",c.vinculo_validado?c.votos:null,
 (c.financeiro_centavos.receitas_total??0)/100,(c.financeiro_centavos.despesas_contratadas??0)/100,(c.financeiro_centavos.despesas_pagas??0)/100,
 c.vinculo_validado&&c.votos>0?(c.financeiro_centavos.despesas_contratadas??0)/(100*c.votos):null,
 c.vinculo_validado&&c.votos>0?(c.financeiro_centavos.despesas_pagas??0)/(100*c.votos):null]);
 const ws=XLSX.utils.aoa_to_sheet([cab,...linhas]);
 ws["!cols"]=[{wch:38},{wch:15},{wch:24},{wch:23},{wch:16},...Array.from({length:5},()=>({wch:25}))];
 for(let i=2;i<=linhas.length+1;i++){const votos=ws["E"+i];if(votos?.v===null)delete ws["E"+i]; else if(votos)votos.z="#,##0";for(const col of "FGHIJ"){let c=ws[col+i];if(c?.t==="n")c.z='"R$" #,##0.00';}}
 XLSX.utils.book_append_sheet(w,ws,"Candidaturas");
 const contexto=[["Campo","Filtro"],["Cargo",$("filtroCargo").value||"Todos"],["Partido",$("filtroPartido").value||"Todos"],["Candidatura",$("filtroCandidato").value||"Todas"],["Situação",$("filtroSituacao").value||"Todas"],["Indicador",INDICADORES[$("filtroIndicador").value]],["Registros exportados",rows.length]];
 XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(contexto),"Filtros e metodologia");
 XLSX.writeFile(w,"financas_eleitorais_rs2026_filtrado.xlsx");
}

function exportarCSV() {
  const colunas = [
    "Candidato", "Partido", "Cargo", "Votos",
    "Receitas (R$)", "Contratadas (R$)", "Pagas (R$)"
  ];

  const linhas = obterTabela().map(c => [
    c.candidato,
    c.partido,
    c.cargo,
    c.votos ?? "",
    (c.financeiro_centavos.receitas_total / 100).toFixed(2),
    (c.financeiro_centavos.despesas_contratadas / 100).toFixed(2),
    (c.financeiro_centavos.despesas_pagas / 100).toFixed(2)
  ]);

  const quote = v => `"${String(v ?? "").replaceAll('"', '""')}"`;

  const csv = [colunas, ...linhas]
    .map(l => l.map(quote).join(";")).join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "financas_rs2026_filtrado.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function renderizarAba() {
  // Os gráficos são renderizados apenas quando sua aba
  // está visível, evitando problemas de dimensionamento.
  if (abaAtual === "geral") {
    atualizarKPIs();
    graficoComposicao();
    graficoVotos();
    graficoCustoCargo();
    graficoRelacao();
  } else if (abaAtual === "partidos") {
    graficoPartidos();
    graficosExtraPartidos();
  } else if (abaAtual === "candidatos") {
    graficoCandidatos();
    atualizarTabela();
  } else if (abaAtual === "comparacao") {
    configurarComparacao();
    graficoComparacao();
  } else if (abaAtual === "detalhamento") {
    graficosDetalhamento();
  }
}

function ativarAba(nome) {
  abaAtual = nome;

  document.querySelectorAll(".aba").forEach(btn => {
    btn.classList.toggle(
      "ativa", btn.dataset.aba === nome
    );
  });

  document.querySelectorAll(".conteudo-aba").forEach(sec => {
    sec.classList.toggle(
      "ativa", sec.id === `aba-${nome}`
    );
  });

  renderizarAba();
}

function atualizarPainel() {
  dadosFiltrados = aplicarFiltros();
  paginaAtual = 1;
  atualizarTitulos();
  renderizarAba();
}

function configurarEventos() {
  $("filtroCargo").addEventListener("change", () => {
    atualizarFiltrosDependentes();
    atualizarPainel();
  });

  $("filtroPartido").addEventListener("change", () => {
    atualizarFiltrosDependentes();
    atualizarPainel();
  });

  $("filtroSituacao").addEventListener("change", atualizarPainel);

  $("filtroCandidato").addEventListener(
    "change", atualizarPainel
  );

  $("filtroIndicador").addEventListener(
    "change", atualizarPainel
  );

  $("limparFiltros").addEventListener("click", () => {
    $("filtroCargo").value = "";
    atualizarFiltrosDependentes();
    $("filtroPartido").value = "";
    atualizarFiltrosDependentes();
    $("filtroCandidato").value = "";
    $("filtroIndicador").value = "despesas_pagas";
    $("filtroSituacao").value = "";
    $("buscaTabela").value = "";
    atualizarPainel();
  });

  document.querySelectorAll(".aba").forEach(btn => {
    btn.addEventListener("click", () =>
      ativarAba(btn.dataset.aba)
    );
  });

  $("buscaTabela").addEventListener("input", () => {
    paginaAtual = 1;
    atualizarTabela();
  });

  $("paginaAnterior").addEventListener("click", () => {
    paginaAtual--;
    atualizarTabela();
  });

  $("paginaProxima").addEventListener("click", () => {
    paginaAtual++;
    atualizarTabela();
  });

  $("exportarCSV").addEventListener("click", exportarXLSX);
  $("tipoReceita").addEventListener("change",()=>{if(abaAtual==="detalhamento")graficosDetalhamento();});
  $("partidoA").addEventListener("change",()=>{if(abaAtual==="comparacao")graficoComparacao();});
  $("partidoB").addEventListener("change",()=>{if(abaAtual==="comparacao")graficoComparacao();});

  window.addEventListener("resize", () => {
    const alvo = {
      geral: ["graficoComposicao", "graficoVotos","graficoCustoCargo","graficoRelacao"],
      partidos: ["graficoPartidos","graficoCustoPartidos","graficoVotosPartidos"],
      comparacao:["graficoComparacaoFinanceira","graficoComparacaoEleitoral"],
      detalhamento:["graficoOrigem","graficoDespesas"],
      candidatos: ["graficoCandidatos"]
    };

    (alvo[abaAtual] || []).forEach(id => {
      const elemento = $(id);
      if (elemento?.data) Plotly.Plots.resize(elemento);
    });
  });
}

async function iniciar() {
  try {
    if (typeof Plotly === "undefined") {
      throw new Error("Plotly não foi carregado.");
    }

    [candidaturas, resumoGeral, metadados, detalhamento] =
      await Promise.all([
        buscarJSON("dados/candidaturas.json"),
        buscarJSON("dados/resumo.json"),
        buscarJSON("dados/metadados.json"),
        buscarJSON("dados/detalhamento_financeiro.json")
      ]);

    if (candidaturas.length !== 998) {
      throw new Error("Universo de candidaturas inesperado.");
    }

    const validados = candidaturas.filter(
      c => c.vinculo_validado
    ).length;

    if (validados !== 966) {
      throw new Error("Cobertura eleitoral inesperada.");
    }

    for (const indicador of Object.keys(INDICADORES)) {
      if (
        soma(candidaturas, indicador) !==
        resumoGeral.financeiro_centavos[indicador]
      ) {
        throw new Error(
          `Divergência no total financeiro: ${indicador}`
        );
      }
    }

    if(detalhamento.universo_candidaturas!==998)throw Error("Detalhamento incompatível");
    for(const [tipo,esperado] of Object.entries({origem_receitas:31942926860,fonte_receitas:31942926860,natureza_receitas:31942926860,categorias_despesas:20336438026})){
      if((detalhamento.classificacoes[tipo]||[]).reduce((s,r)=>s+r.valor_centavos,0)!==esperado)throw Error("Total do detalhamento não confere: "+tipo);
    }
    preencherFiltros();
    configurarEventos();
    atualizarPainel();

  } catch (erro) {
    console.error(erro);
    $("mensagemErro").hidden = false;
    $("mensagemErro").textContent =
      "Erro ao carregar o painel: " + erro.message;
  }
}

document.addEventListener("DOMContentLoaded", iniciar);
