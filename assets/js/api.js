/**
 * Camada de acesso à API back-end (vuln-dashboard-api).
 *
 * Importante: o front-end NUNCA chama a NVD diretamente — toda consulta de
 * vulnerabilidades passa por esta API, que centraliza a integração externa.
 */
const API_BASE_URL = window.__ENV__.API_BASE_URL;
const CHAVE_API_KEY_STORAGE = "vuln_dashboard_api_key";

function obterApiKey() {
  return localStorage.getItem(CHAVE_API_KEY_STORAGE) || "";
}

function salvarApiKey(valor) {
  if (valor) {
    localStorage.setItem(CHAVE_API_KEY_STORAGE, valor);
  } else {
    localStorage.removeItem(CHAVE_API_KEY_STORAGE);
  }
}

/**
 * Erro customizado para respostas não-OK da API, preservando o status HTTP.
 */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requisitar(caminho, opcoes = {}) {
  const cabecalhos = { "Content-Type": "application/json", ...(opcoes.headers || {}) };

  const apiKey = obterApiKey();
  if (apiKey && ["POST", "PUT", "DELETE"].includes((opcoes.method || "GET").toUpperCase())) {
    cabecalhos["X-API-Key"] = apiKey;
  }

  let resposta;
  try {
    resposta = await fetch(`${API_BASE_URL}${caminho}`, { ...opcoes, headers: cabecalhos });
  } catch (erroDeRede) {
    throw new ApiError(0, "Não foi possível conectar à API. Ela está no ar em " + API_BASE_URL + "?");
  }

  if (resposta.status === 204) {
    return null;
  }

  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch (_) {
    corpo = null;
  }

  if (!resposta.ok) {
    const mensagem = (corpo && corpo.detail) || `Erro ${resposta.status} ao chamar a API.`;
    throw new ApiError(resposta.status, mensagem);
  }

  return corpo;
}

const api = {
  listarAtivos({ categoria = "", page = 1, pageSize = 10, ordenarPor = "data" } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      ordenar_por: ordenarPor,
    });
    if (categoria) params.set("categoria", categoria);
    return requisitar(`/ativos?${params.toString()}`);
  },

  criarAtivo(payload) {
    return requisitar("/ativos", { method: "POST", body: JSON.stringify(payload) });
  },

  atualizarAtivo(id, payload) {
    return requisitar(`/ativos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  },

  removerAtivo(id) {
    return requisitar(`/ativos/${id}`, { method: "DELETE" });
  },

  buscarVulnerabilidades(id) {
    return requisitar(`/ativos/${id}/vulnerabilidades`);
  },

  buscarResumo(id) {
    return requisitar(`/ativos/${id}/resumo`);
  },
};
