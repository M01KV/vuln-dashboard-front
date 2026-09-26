/**
 * Configuração de ambiente do front-end.
 *
 * Em desenvolvimento local, este arquivo aponta direto para a API rodando
 * em localhost:8000. Ao rodar via Docker, este arquivo é REGERADO no
 * momento em que o container sobe (veja docker/docker-entrypoint.sh),
 * a partir da variável de ambiente API_BASE_URL — permitindo apontar
 * para qualquer endereço da API sem precisar rebuildar a imagem.
 */
window.__ENV__ = {
  API_BASE_URL: "http://localhost:8000",
};
