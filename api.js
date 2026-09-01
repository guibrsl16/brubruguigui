// Rotas da API. Tudo que sai daqui ja vem filtrado pelo casal do usuario logado.
const bd = require('./dados');
const auth = require('./auth');
const { COLECOES, higienizar } = require('./esquema');
const PERGUNTAS = require('./perguntas');
const historico = require('./atividades');

// o servidor injeta aqui a função que avisa o casal em tempo real
let avisarCasal = () => {};
function aoMudar(funcao) {
  avisarCasal = funcao;
}

function anunciar(usuario, atividade) {
  if (!atividade) return;
  avisarCasal(usuario.casalId, { autorId: usuario.id, texto: atividade.texto, em: atividade.criadoEm });
}

const COLECOES_DO_CASAL = Object.keys(COLECOES);

// ---------- ajudantes ----------

function responder(res, status, corpo, cabecalhos) {
  const texto = JSON.stringify(corpo === undefined ? null : corpo);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }, cabecalhos || {}));
  res.end(texto);
}

function hoje() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function publico(usuario) {
  if (!usuario) return null;
  return {
    id: usuario.id,
    nome: usuario.nome,
    apelido: usuario.apelido || '',
    email: usuario.email,
    cidade: usuario.cidade || '',
    tema: usuario.tema || 'roxo',
    rotina: usuario.rotina || '',
    fuso: typeof usuario.fuso === 'number' ? usuario.fuso : -3,
    agenda: usuario.agenda || {},
  };
}

// ---------- contas ----------

function registrar(dados, corpo) {
  const nome = String(corpo.nome || '').trim().slice(0, 60);
  const email = String(corpo.email || '').trim().toLowerCase().slice(0, 120);
  const senha = String(corpo.senha || '');
  const convite = String(corpo.convite || '').trim().toUpperCase();

  if (nome.length < 2) return { erro: 'Escreva seu nome.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: 'E-mail invalido.' };
  if (senha.length < 6) return { erro: 'A senha precisa de pelo menos 6 caracteres.' };
  if (dados.usuarios.some((u) => u.email === email)) return { erro: 'Ja existe uma conta com esse e-mail.' };

  let casal;
  if (convite) {
    casal = dados.casais.find((c) => c.codigo === convite);
    if (!casal) return { erro: 'Codigo de convite nao encontrado.' };
    const quantos = dados.usuarios.filter((u) => u.casalId === casal.id).length;
    if (quantos >= 2) return { erro: 'Esse espaco ja tem duas pessoas.' };
  } else {
    casal = {
      id: bd.novoId(),
      codigo: auth.codigoDeConvite(),
      nome: String(corpo.nomeCasal || '').trim().slice(0, 60) || 'Brugui',
      dataInicio: String(corpo.dataInicio || '').slice(0, 10),
      criadoEm: new Date().toISOString(),
    };
    dados.casais.push(casal);
  }

  const { sal, hash } = auth.criarSenha(senha);
  const usuario = {
    id: bd.novoId(),
    casalId: casal.id,
    nome,
    apelido: '',
    email,
    sal,
    hash,
    cidade: String(corpo.cidade || '').trim().slice(0, 60),
    tema: 'roxo',
    rotina: '',
    criadoEm: new Date().toISOString(),
  };
  dados.usuarios.push(usuario);
  bd.salvar();
  return { usuario };
}

function entrar(dados, corpo) {
  const email = String(corpo.email || '').trim().toLowerCase();
  const senha = String(corpo.senha || '');
  const usuario = dados.usuarios.find((u) => u.email === email);
  if (!usuario || !auth.conferirSenha(senha, usuario.sal, usuario.hash)) {
    return { erro: 'E-mail ou senha incorretos.' };
  }
  return { usuario };
}

// ---------- pergunta do dia ----------

function perguntaDoDia(dados, usuario) {
  const data = hoje();
  let registro = dados.perguntas.find((p) => p.casalId === usuario.casalId && p.data === data);
  if (!registro) {
    const usadas = dados.perguntas.filter((p) => p.casalId === usuario.casalId).length;
    registro = {
      id: bd.novoId(),
      casalId: usuario.casalId,
      data,
      indice: usadas % PERGUNTAS.length,
      respostas: {},
    };
    dados.perguntas.push(registro);
    bd.salvar();
  }
  return registro;
}

function verPergunta(dados, usuario) {
  const registro = perguntaDoDia(dados, usuario);
  const minha = registro.respostas[usuario.id] || '';
  const idsDoCasal = dados.usuarios.filter((u) => u.casalId === usuario.casalId).map((u) => u.id);
  const todosResponderam = idsDoCasal.length >= 2 && idsDoCasal.every((id) => registro.respostas[id]);
  return {
    data: registro.data,
    texto: PERGUNTAS[registro.indice],
    minhaResposta: minha,
    liberada: todosResponderam,
    respostas: todosResponderam ? registro.respostas : {},
    historico: dados.perguntas
      .filter((p) => p.casalId === usuario.casalId && p.data !== registro.data && Object.keys(p.respostas).length >= 2)
      .slice(-30)
      .map((p) => ({ data: p.data, texto: PERGUNTAS[p.indice], respostas: p.respostas })),
  };
}

// ---------- estado completo ----------

// Uma carta so mostra o conteudo ao destinatario depois da data marcada.
function filtrarCapsula(registro, usuario) {
  const minha = registro.usuarioId === usuario.id;
  const aberta = !registro.abrirEm || registro.abrirEm <= hoje();
  if (minha || aberta) return { ...registro, aberta };
  return { id: registro.id, casalId: registro.casalId, usuarioId: registro.usuarioId, abrirEm: registro.abrirEm, aberta: false, lacrada: true };
}

// Presente marcado como surpresa: quem vai ganhar nao ve que ja foi comprado.
function filtrarItem(registro, usuario) {
  if (registro.lista !== 'desejos' || !registro.surpresa) return registro;
  if (registro.donoId !== usuario.id) return registro;
  return { ...registro, compradoPor: '', status: 'quero', surpresa: false };
}

function montarEstado(dados, usuario) {
  const doCasal = (lista) => lista.filter((r) => r.casalId === usuario.casalId);
  const casal = dados.casais.find((c) => c.id === usuario.casalId) || null;
  const pessoas = dados.usuarios.filter((u) => u.casalId === usuario.casalId);
  const estado = {
    eu: publico(usuario),
    parceiro: publico(pessoas.find((u) => u.id !== usuario.id)),
    casal: casal && {
      id: casal.id,
      nome: casal.nome,
      codigo: casal.codigo,
      dataInicio: casal.dataInicio || '',
    },
    pergunta: verPergunta(dados, usuario),
    hoje: hoje(),
  };
  for (const nome of COLECOES_DO_CASAL) estado[nome] = doCasal(dados[nome]);
  estado.atividades = doCasal(dados.atividades || [])
    .slice()
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .slice(0, 120);
  estado.capsulas = estado.capsulas.map((c) => filtrarCapsula(c, usuario));
  estado.itens = estado.itens.map((i) => filtrarItem(i, usuario));
  return estado;
}

// ---------- CRUD ----------

// So pode existir um Norte por casal: eleger um rebaixa os outros.
function garantirNorteUnico(dados, usuario, vencedorId) {
  for (const meta of dados.metas) {
    if (meta.casalId === usuario.casalId && meta.id !== vencedorId && meta.principal) meta.principal = false;
  }
}

function criar(dados, usuario, colecao, corpo) {
  const spec = COLECOES[colecao];
  if (!spec) return { erro: 'Colecao desconhecida.' };
  const limpo = higienizar(colecao, corpo, false);
  if (!limpo) return { erro: 'Preencha os campos obrigatorios.' };

  // colecoes com registro unico por casal (o plano de fim da distancia)
  if (spec.unicoNoCasal) {
    const existente = dados[colecao].find((r) => r.casalId === usuario.casalId);
    if (existente) {
      const anterior = JSON.parse(JSON.stringify(existente));
      Object.assign(existente, limpo, { alteradoEm: new Date().toISOString() });
      anunciar(usuario, historico.registrar(dados, usuario, { colecao, acao: 'atualizou', registro: existente, anterior }));
      bd.salvar();
      return { registro: existente };
    }
  }

  if (spec.unicoPor) {
    const chave = limpo[spec.unicoPor];
    const existente = dados[colecao].find(
      (r) => r.casalId === usuario.casalId && r.usuarioId === usuario.id && r[spec.unicoPor] === chave
    );
    if (existente) {
      const anterior = JSON.parse(JSON.stringify(existente));
      Object.assign(existente, limpo, { alteradoEm: new Date().toISOString() });
      anunciar(usuario, historico.registrar(dados, usuario, { colecao, acao: 'atualizou', registro: existente, anterior }));
      bd.salvar();
      return { registro: existente };
    }
  }

  const registro = Object.assign(
    { id: bd.novoId(), casalId: usuario.casalId, criadoEm: new Date().toISOString() },
    spec.porUsuario ? { usuarioId: usuario.id } : {},
    limpo
  );
  dados[colecao].push(registro);
  if (colecao === 'metas' && registro.principal) garantirNorteUnico(dados, usuario, registro.id);
  anunciar(usuario, historico.registrar(dados, usuario, { colecao, acao: 'criou', registro }));
  bd.salvar();
  return { registro };
}

function atualizar(dados, usuario, colecao, id, corpo) {
  const spec = COLECOES[colecao];
  if (!spec) return { erro: 'Colecao desconhecida.' };
  const registro = dados[colecao].find((r) => r.id === id && r.casalId === usuario.casalId);
  if (!registro) return { erro: 'Registro nao encontrado.' };

  const meu = !spec.porUsuario || registro.usuarioId === usuario.id;
  const doPar = spec.camposDoPar || [];
  if (!meu && !doPar.length) return { erro: 'Esse registro e do seu par.' };

  const anterior = JSON.parse(JSON.stringify(registro));

  const limpo = higienizar(colecao, corpo, true);
  if (!meu) {
    // do registro do par so alguns campos podem ser tocados (curtir, aceitar, marcar conversada)
    for (const campo of doPar) if (campo in limpo) registro[campo] = limpo[campo];
  } else {
    Object.assign(registro, limpo);
  }

  if (colecao === 'metas' && registro.principal) garantirNorteUnico(dados, usuario, registro.id);
  registro.alteradoEm = new Date().toISOString();
  anunciar(usuario, historico.registrar(dados, usuario, { colecao, acao: 'atualizou', registro, anterior }));
  bd.salvar();
  return { registro };
}

function apagar(dados, usuario, colecao, id) {
  const spec = COLECOES[colecao];
  if (!spec) return { erro: 'Colecao desconhecida.' };
  const registro = dados[colecao].find((r) => r.id === id && r.casalId === usuario.casalId);
  if (!registro) return { erro: 'Registro nao encontrado.' };
  if (spec.porUsuario && registro.usuarioId !== usuario.id) return { erro: 'Esse registro e do seu par.' };
  dados[colecao] = dados[colecao].filter((r) => r !== registro);
  anunciar(usuario, historico.registrar(dados, usuario, { colecao, acao: 'apagou', registro }));
  bd.salvar();
  return { ok: true };
}

// ---------- ajustes ----------

function salvarAjustes(dados, usuario, corpo) {
  if (typeof corpo.nome === 'string' && corpo.nome.trim().length >= 2) usuario.nome = corpo.nome.trim().slice(0, 60);
  if (typeof corpo.apelido === 'string') usuario.apelido = corpo.apelido.trim().slice(0, 40);
  if (typeof corpo.cidade === 'string') usuario.cidade = corpo.cidade.trim().slice(0, 60);
  if (typeof corpo.rotina === 'string') usuario.rotina = corpo.rotina.slice(0, 2000);
  if (corpo.tema === 'roxo' || corpo.tema === 'verde') usuario.tema = corpo.tema;

  if (Number.isFinite(Number(corpo.fuso))) {
    usuario.fuso = Math.min(14, Math.max(-12, Math.round(Number(corpo.fuso))));
  }

  // agenda de horarios livres: uma faixa por dia da semana, em minutos desde a meia-noite
  if (corpo.agenda && typeof corpo.agenda === 'object') {
    const limpa = {};
    for (const dia of ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']) {
      const faixa = corpo.agenda[dia];
      if (!faixa || typeof faixa !== 'object') continue;
      const de = String(faixa.de || '').slice(0, 5);
      const ate = String(faixa.ate || '').slice(0, 5);
      if (/^\d{2}:\d{2}$/.test(de) && /^\d{2}:\d{2}$/.test(ate)) limpa[dia] = { de, ate };
    }
    usuario.agenda = limpa;
  }

  const casal = dados.casais.find((c) => c.id === usuario.casalId);
  if (casal) {
    if (typeof corpo.nomeCasal === 'string' && corpo.nomeCasal.trim()) casal.nome = corpo.nomeCasal.trim().slice(0, 60);
    if (typeof corpo.dataInicio === 'string') casal.dataInicio = corpo.dataInicio.slice(0, 10);
  }
  anunciar(usuario, historico.registrar(dados, usuario, { colecao: 'perfil', acao: 'atualizou', registro: { id: usuario.id } }));
  bd.salvar();
  return { ok: true };
}

function trocarSenha(dados, usuario, corpo) {
  const atual = String(corpo.atual || '');
  const nova = String(corpo.nova || '');
  if (!auth.conferirSenha(atual, usuario.sal, usuario.hash)) return { erro: 'Senha atual incorreta.' };
  if (nova.length < 6) return { erro: 'A nova senha precisa de pelo menos 6 caracteres.' };
  const { sal, hash } = auth.criarSenha(nova);
  usuario.sal = sal;
  usuario.hash = hash;
  bd.salvar();
  return { ok: true };
}

function responderPergunta(dados, usuario, corpo) {
  const registro = perguntaDoDia(dados, usuario);
  registro.respostas[usuario.id] = String(corpo.resposta || '').slice(0, 4000);
  anunciar(usuario, historico.registrar(dados, usuario, { colecao: 'perguntas', acao: 'atualizou', registro }));
  bd.salvar();
  return verPergunta(dados, usuario);
}

module.exports = {
  aoMudar,
  responder,
  registrar,
  entrar,
  montarEstado,
  criar,
  atualizar,
  apagar,
  salvarAjustes,
  trocarSenha,
  verPergunta,
  responderPergunta,
  publico,
  hoje,
};
