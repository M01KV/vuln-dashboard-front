/**
 * Lógica de interface do Painel de Vulnerabilidades por Software.
 * Toda comunicação com dados passa exclusivamente pela API back-end (api.js).
 */

const estado = {
  pagina: 1,
  tamanhoPagina: 10,
  categoria: "",
  ordenarPor: "data",
  totalAtivos: 0,
  ativos: [],
  ativoSelecionadoId: null,
  ativoEmEdicaoId: null,
};

const els = {
  tabelaCorpo: document.getElementById("tabela-corpo"),
  filtroCategoria: document.getElementById("filtro-categoria"),
  filtroOrdenar: document.getElementById("filtro-ordenar"),
  filtroPageSize: document.getElementById("filtro-page-size"),
  paginaAnterior: document.getElementById("pagina-anterior"),
  paginaProxima: document.getElementById("pagina-proxima"),
  paginaInfo: document.getElementById("pagina-info"),
  detalheConteudo: document.getElementById("detalhe-conteudo"),
  overlay: document.getElementById("overlay"),
  formAtivo: document.getElementById("form-ativo"),
  formTitulo: document.getElementById("form-titulo"),
  formErro: document.getElementById("form-erro"),
  campoNome: document.getElementById("campo-nome"),
  campoVersao: document.getElementById("campo-versao"),
  campoCategoria: document.getElementById("campo-categoria"),
  btnNovoAtivo: document.getElementById("btn-novo-ativo"),
  btnCancelar: document.getElementById("btn-cancelar"),
  btnApiKey: document.getElementById("btn-api-key"),
  statusConexao: document.getElementById("status-conexao"),
};

const ROTULOS_SEVERIDADE = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "DESCONHECIDA"];

function classeBadge(severidade) {
  return `badge badge--${(severidade || "desconhecida").toLowerCase()}`;
}

function formatarData(isoString) {
  if (!isoString) return "—";
  const data = new Date(isoString);
  return data.toLocaleDateString("pt-BR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function mostrarErroConexao(mensagem) {
  els.statusConexao.textContent = mensagem;
  els.statusConexao.hidden = false;
}

function limparErroConexao() {
  els.statusConexao.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Listagem de ativos                                                  */
/* ------------------------------------------------------------------ */

async function carregarAtivos() {
  els.tabelaCorpo.innerHTML = `<tr><td colspan="5" class="celula-vazia">Carregando ativos…</td></tr>`;
  try {
    const resposta = await api.listarAtivos({
      categoria: estado.categoria,
      page: estado.pagina,
      pageSize: estado.tamanhoPagina,
      ordenarPor: estado.ordenarPor,
    });
    limparErroConexao();
    estado.ativos = resposta.itens;
    estado.totalAtivos = resposta.total;
    renderizarTabela();
    renderizarPaginacao();
  } catch (erro) {
    tratarErroGlobal(erro);
    els.tabelaCorpo.innerHTML = `<tr><td colspan="5" class="celula-vazia">Não foi possível carregar os ativos.</td></tr>`;
  }
}

function renderizarTabela() {
  if (estado.ativos.length === 0) {
    els.tabelaCorpo.innerHTML = `<tr><td colspan="5" class="celula-vazia">Nenhum ativo cadastrado ainda. Clique em "+ Novo ativo" para começar.</td></tr>`;
    return;
  }

  els.tabelaCorpo.innerHTML = "";
  for (const ativo of estado.ativos) {
    const linha = document.createElement("tr");
    linha.dataset.id = ativo.id;
    if (ativo.id === estado.ativoSelecionadoId) linha.classList.add("linha-selecionada");

    linha.innerHTML = `
      <td>${escaparHtml(ativo.nome)}</td>
      <td class="col-versao">${escaparHtml(ativo.versao)}</td>
      <td>${escaparHtml(ativo.categoria)}</td>
      <td>${formatarData(ativo.data_cadastro)}</td>
      <td class="col-acoes">
        <div class="linha-acoes">
          <button class="btn btn--ghost btn--icon" data-acao="ver" title="Ver CVEs">CVEs</button>
          <button class="btn btn--ghost btn--icon" data-acao="editar" title="Editar">Editar</button>
          <button class="btn btn--ghost btn--icon btn--danger" data-acao="excluir" title="Excluir">Excluir</button>
        </div>
      </td>
    `;

    linha.addEventListener("click", (evento) => {
      const acaoBtn = evento.target.closest("button");
      if (!acaoBtn) {
        selecionarAtivo(ativo.id);
        return;
      }
      const acao = acaoBtn.dataset.acao;
      if (acao === "ver") selecionarAtivo(ativo.id);
      if (acao === "editar") abrirFormulario("editar", ativo);
      if (acao === "excluir") excluirAtivo(ativo);
    });

    els.tabelaCorpo.appendChild(linha);
  }
}

function renderizarPaginacao() {
  const totalPaginas = Math.max(1, Math.ceil(estado.totalAtivos / estado.tamanhoPagina));
  els.paginaInfo.textContent = `Página ${estado.pagina} de ${totalPaginas} · ${estado.totalAtivos} ativo(s)`;
  els.paginaAnterior.disabled = estado.pagina <= 1;
  els.paginaProxima.disabled = estado.pagina >= totalPaginas;
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

/* ------------------------------------------------------------------ */
/* Detalhe: vulnerabilidades + resumo de um ativo                      */
/* ------------------------------------------------------------------ */

async function selecionarAtivo(id) {
  estado.ativoSelecionadoId = id;
  renderizarTabela();

  const ativo = estado.ativos.find((item) => item.id === id);
  els.detalheConteudo.innerHTML = `
    <div class="ativo-cabecalho">
      <div class="ativo-cabecalho__nome">${escaparHtml(ativo?.nome ?? "")} <span class="ativo-cabecalho__versao">v${escaparHtml(ativo?.versao ?? "")}</span></div>
    </div>
    <p class="estado-vazio">Consultando a NVD…</p>
  `;

  try {
    const [resumo, vulnerabilidades] = await Promise.all([
      api.buscarResumo(id),
      api.buscarVulnerabilidades(id),
    ]);
    limparErroConexao();
    renderizarDetalhe(ativo, resumo, vulnerabilidades);
  } catch (erro) {
    renderizarErroDetalhe(ativo, erro);
  }
}

function renderizarDetalhe(ativo, resumo, vulnerabilidades) {
  const maiorContagem = Math.max(1, ...ROTULOS_SEVERIDADE.map((s) => resumo.por_severidade[s] || 0));

  const linhasResumo = ROTULOS_SEVERIDADE.map((sev) => {
    const contagem = resumo.por_severidade[sev] || 0;
    const largura = Math.round((contagem / maiorContagem) * 100);
    return `
      <div class="resumo-linha">
        <span class="resumo-linha__rotulo">${sev}</span>
        <span class="resumo-linha__barra-fundo">
          <span class="resumo-linha__barra" style="width:${largura}%; background:var(--sev-${sev.toLowerCase()})"></span>
        </span>
        <span class="resumo-linha__valor">${contagem}</span>
      </div>
    `;
  }).join("");

  const cardsCves = vulnerabilidades.vulnerabilidades.length
    ? vulnerabilidades.vulnerabilidades.map((cve) => `
        <article class="cve-card">
          <div class="cve-card__topo">
            <span class="cve-card__id">${escaparHtml(cve.cve_id)}</span>
            <span class="${classeBadge(cve.severidade)}">${cve.severidade}${cve.score_cvss != null ? ` · ${cve.score_cvss}` : ""}</span>
          </div>
          <p class="cve-card__descricao">${escaparHtml(cve.descricao)}</p>
          <div class="cve-card__rodape">
            <span>Publicado em ${formatarData(cve.data_publicacao)}</span>
          </div>
        </article>
      `).join("")
    : `<p class="aviso">Nenhum CVE encontrado na NVD para "${escaparHtml(vulnerabilidades.termo_busca)}".</p>`;

  els.detalheConteudo.innerHTML = `
    <div class="ativo-cabecalho">
      <div class="ativo-cabecalho__nome">${escaparHtml(ativo?.nome ?? "")} <span class="ativo-cabecalho__versao">v${escaparHtml(ativo?.versao ?? "")}</span></div>
      <p class="ativo-cabecalho__termo">Termo de busca na NVD: "${escaparHtml(vulnerabilidades.termo_busca)}" · ${vulnerabilidades.total_encontrado} CVE(s)${vulnerabilidades.origem_cache ? " · resultado em cache" : ""}</p>
    </div>
    <div class="resumo-grafico">${linhasResumo}</div>
    <div class="lista-cves">${cardsCves}</div>
  `;
}

function renderizarErroDetalhe(ativo, erro) {
  let mensagem = erro.message || "Ocorreu um erro ao consultar a NVD.";
  if (erro.status === 504) mensagem = "A NVD demorou demais para responder (timeout). Tente novamente em instantes.";
  if (erro.status === 429) mensagem = "Limite de requisições da NVD excedido. Aguarde alguns segundos e tente novamente.";
  if (erro.status === 502) mensagem = "A NVD está indisponível no momento. Tente novamente mais tarde.";

  els.detalheConteudo.innerHTML = `
    <div class="ativo-cabecalho">
      <div class="ativo-cabecalho__nome">${escaparHtml(ativo?.nome ?? "")} <span class="ativo-cabecalho__versao">v${escaparHtml(ativo?.versao ?? "")}</span></div>
    </div>
    <p class="aviso aviso--erro">${escaparHtml(mensagem)}</p>
  `;
}

/* ------------------------------------------------------------------ */
/* Formulário: criar / editar ativo                                    */
/* ------------------------------------------------------------------ */

function abrirFormulario(modo, ativo = null) {
  estado.ativoEmEdicaoId = modo === "editar" ? ativo.id : null;
  els.formTitulo.textContent = modo === "editar" ? "Editar ativo" : "Novo ativo";
  els.campoNome.value = ativo?.nome ?? "";
  els.campoVersao.value = ativo?.versao ?? "";
  els.campoCategoria.value = ativo?.categoria ?? "";
  els.formErro.hidden = true;
  els.overlay.hidden = false;
  els.campoNome.focus();
}

function fecharFormulario() {
  els.overlay.hidden = true;
  els.formAtivo.reset();
  estado.ativoEmEdicaoId = null;
}

async function onSubmitFormulario(evento) {
  evento.preventDefault();
  const payload = {
    nome: els.campoNome.value.trim(),
    versao: els.campoVersao.value.trim(),
    categoria: els.campoCategoria.value.trim(),
  };

  if (!payload.nome || !payload.versao || !payload.categoria) {
    exibirErroFormulario("Preencha todos os campos.");
    return;
  }

  try {
    if (estado.ativoEmEdicaoId) {
      await api.atualizarAtivo(estado.ativoEmEdicaoId, payload);
    } else {
      await api.criarAtivo(payload);
    }
    fecharFormulario();
    await carregarAtivos();
  } catch (erro) {
    exibirErroFormulario(erro.message);
  }
}

function exibirErroFormulario(mensagem) {
  els.formErro.textContent = mensagem;
  els.formErro.hidden = false;
}

async function excluirAtivo(ativo) {
  const confirmado = window.confirm(`Remover o ativo "${ativo.nome} ${ativo.versao}"? Essa ação não pode ser desfeita.`);
  if (!confirmado) return;

  try {
    await api.removerAtivo(ativo.id);
    if (estado.ativoSelecionadoId === ativo.id) {
      estado.ativoSelecionadoId = null;
      els.detalheConteudo.innerHTML = `<p class="estado-vazio">Selecione um ativo na lista ao lado para consultar os CVEs relacionados na NVD.</p>`;
    }
    await carregarAtivos();
  } catch (erro) {
    tratarErroGlobal(erro);
  }
}

/* ------------------------------------------------------------------ */
/* Chave de API (autenticação opcional nas rotas de escrita)           */
/* ------------------------------------------------------------------ */

function configurarApiKey() {
  const atual = obterApiKey();
  const novaChave = window.prompt(
    "Informe a API Key exigida pelo back-end para cadastrar/editar/excluir ativos.\n" +
      "Deixe em branco para remover a chave salva (necessário apenas se o back-end tiver WRITE_API_KEY configurada).",
    atual
  );
  if (novaChave === null) return; // usuário cancelou
  salvarApiKey(novaChave.trim());
}

/* ------------------------------------------------------------------ */
/* Erros globais                                                       */
/* ------------------------------------------------------------------ */

function tratarErroGlobal(erro) {
  if (erro.status === 0) {
    mostrarErroConexao(erro.message);
  } else {
    mostrarErroConexao(erro.message || "Ocorreu um erro inesperado.");
  }
}

/* ------------------------------------------------------------------ */
/* Eventos                                                              */
/* ------------------------------------------------------------------ */

els.filtroCategoria.addEventListener("input", debounce(() => {
  estado.categoria = els.filtroCategoria.value.trim();
  estado.pagina = 1;
  carregarAtivos();
}, 400));

els.filtroOrdenar.addEventListener("change", () => {
  estado.ordenarPor = els.filtroOrdenar.value;
  estado.pagina = 1;
  carregarAtivos();
});

els.filtroPageSize.addEventListener("change", () => {
  estado.tamanhoPagina = Number(els.filtroPageSize.value);
  estado.pagina = 1;
  carregarAtivos();
});

els.paginaAnterior.addEventListener("click", () => {
  if (estado.pagina > 1) {
    estado.pagina -= 1;
    carregarAtivos();
  }
});

els.paginaProxima.addEventListener("click", () => {
  estado.pagina += 1;
  carregarAtivos();
});

els.btnNovoAtivo.addEventListener("click", () => abrirFormulario("criar"));
els.btnCancelar.addEventListener("click", fecharFormulario);
els.formAtivo.addEventListener("submit", onSubmitFormulario);
els.btnApiKey.addEventListener("click", configurarApiKey);
els.overlay.addEventListener("click", (evento) => {
  if (evento.target === els.overlay) fecharFormulario();
});

function debounce(fn, atrasoMs) {
  let temporizador;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), atrasoMs);
  };
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

carregarAtivos();
