// ============================================================
// FINANÇAS ELEITORAIS RS 2026 — BLOCO 08D
// INTERFACE COM ABAS E TÍTULOS DINÂMICOS
// ============================================================

"use strict";

let candidaturas = [];
let resumoGeral = null;
let metadados = null;

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
    indicador: INDICADORES[$("filtroIndicador").value]
  };
}

function textoContexto() {
  const c = contextoFiltro();
  return `${c.cargo} | ${c.partido} | ${c.candidato} | 2026`;
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

  return candidaturas.filter(c =>
    (!cargo || c.cargo === cargo) &&
    (!partido || c.partido === partido) &&
    (!candidato || c.sq_candidato === candidato)
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
        <td>${c.votos === null ? "Sem vínculo" : inteiro(c.votos)}</td>
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
  } else if (abaAtual === "partidos") {
    graficoPartidos();
  } else if (abaAtual === "candidatos") {
    graficoCandidatos();
    atualizarTabela();
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

  $("exportarCSV").addEventListener("click", exportarCSV);

  window.addEventListener("resize", () => {
    const alvo = {
      geral: ["graficoComposicao", "graficoVotos"],
      partidos: ["graficoPartidos"],
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

    [candidaturas, resumoGeral, metadados] =
      await Promise.all([
        buscarJSON("dados/candidaturas.json"),
        buscarJSON("dados/resumo.json"),
        buscarJSON("dados/metadados.json")
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
