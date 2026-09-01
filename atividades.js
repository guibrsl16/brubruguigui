// Histórico do que cada um mexeu, em frases que dá para ler.
const bd = require('./dados');

const LIMITE_POR_CASAL = 400;
const JANELA_AGRUPAMENTO = 10 * 60 * 1000; // edições seguidas no mesmo registro viram uma linha só

function dinheiro(valor) {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBr(iso) {
  const p = String(iso || '').slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '';
}

function tamanho(lista) {
  return Array.isArray(lista) ? lista.length : 0;
}

function feitos(marcos) {
  return (Array.isArray(marcos) ? marcos : []).filter((m) => m && m.feito).length;
}

// ---------- a frase de cada mexida ----------

function descrever(colecao, acao, registro, anterior) {
  const titulo = registro && registro.titulo ? '“' + registro.titulo + '”' : '';

  if (acao === 'apagou') {
    const nomes = {
      metas: 'apagou a meta ' + titulo,
      cofrinhos: 'apagou o cofrinho ' + titulo,
      encontros: 'apagou o encontro ' + titulo,
      memorias: 'apagou a memória ' + titulo,
      datas: 'apagou a data ' + titulo,
      itens: 'tirou ' + titulo + ' da lista',
      recados: 'apagou um recado',
      acordos: 'apagou um acordo',
      pautas: 'tirou um assunto da pauta',
      capsulas: 'apagou uma carta',
    };
    return nomes[colecao] || 'apagou um registro';
  }

  switch (colecao) {
    case 'checkins':
      return (
        'registrou o check-in do dia — humor ' + registro.humor + '/5, energia ' + registro.energia + '/5' +
        (registro.nota ? ' (“' + registro.nota + '”)' : '')
      );

    case 'termometro':
      return 'respondeu o termômetro da semana — comunicação ' + registro.comunicacao + ', escuta ' + registro.ouvido + ', carinho ' + registro.carinho;

    case 'pedidos':
      return 'escreveu o pedido da semana: “' + String(registro.texto || '').slice(0, 120) + '”';

    case 'revisoes':
      return 'escreveu a revisão do mês';

    case 'recados':
      if (anterior && tamanho(registro.curtidoPor) > tamanho(anterior.curtidoPor)) return 'curtiu um recado';
      if (anterior && tamanho(registro.curtidoPor) < tamanho(anterior.curtidoPor)) return 'descurtiu um recado';
      return acao === 'criou' ? 'deixou um recado: “' + String(registro.texto || '').slice(0, 120) + '”' : 'editou um recado';

    case 'metas': {
      if (acao === 'criou') return 'criou a meta ' + titulo;
      if (anterior && !anterior.principal && registro.principal) return 'elegeu ' + titulo + ' como o Norte de vocês';
      if (anterior && !anterior.concluida && registro.concluida) return 'concluiu a meta ' + titulo;
      if (anterior && anterior.concluida && !registro.concluida) return 'reabriu a meta ' + titulo;
      if (anterior) {
        const antes = feitos(anterior.marcos);
        const agora = feitos(registro.marcos);
        if (agora > antes) return 'cumpriu um passo de ' + titulo;
        if (agora < antes) return 'desmarcou um passo de ' + titulo;
        if (tamanho(registro.marcos) > tamanho(anterior.marcos)) return 'somou um passo em ' + titulo;
      }
      return 'mexeu na meta ' + titulo;
    }

    case 'cofrinhos': {
      if (acao === 'criou') return 'criou o cofrinho ' + titulo;
      if (anterior && tamanho(registro.depositos) > tamanho(anterior.depositos)) {
        const novo = registro.depositos[registro.depositos.length - 1] || {};
        return 'guardou ' + dinheiro(novo.valor) + ' em ' + titulo;
      }
      if (anterior && tamanho(registro.depositos) < tamanho(anterior.depositos)) return 'removeu um depósito de ' + titulo;
      return 'mexeu no cofrinho ' + titulo;
    }

    case 'encontros': {
      if (acao === 'criou') return 'marcou o encontro ' + titulo;
      if (anterior && anterior.status !== 'realizado' && registro.status === 'realizado') return 'marcou ' + titulo + ' como vivido';
      if (anterior && tamanho(registro.despesas) > tamanho(anterior.despesas)) {
        const nova = registro.despesas[registro.despesas.length - 1] || {};
        return 'lançou ' + dinheiro(nova.valor) + ' em ' + titulo;
      }
      return 'mexeu no encontro ' + titulo;
    }

    case 'planos': {
      if (acao === 'criou') return 'escreveu o plano para acabar com a distância';
      if (anterior) {
        const antes = feitos(anterior.itens);
        const agora = feitos(registro.itens);
        if (agora > antes) return 'cumpriu um passo do plano de vocês';
        if (agora < antes) return 'desmarcou um passo do plano';
      }
      return 'ajustou o plano de vocês';
    }

    case 'acordos': {
      if (acao === 'criou') return 'propôs um acordo: “' + String(registro.texto || '').slice(0, 120) + '”';
      if (anterior && tamanho(registro.aceitoPor) > tamanho(anterior.aceitoPor)) return 'aceitou um acordo';
      if (anterior && tamanho(registro.aceitoPor) < tamanho(anterior.aceitoPor)) return 'retirou o aceite de um acordo';
      if (anterior && anterior.ativo !== false && registro.ativo === false) return 'arquivou um acordo';
      return 'editou um acordo';
    }

    case 'pautas': {
      if (acao === 'criou') return 'colocou um assunto na pauta: “' + String(registro.texto || '').slice(0, 120) + '”';
      if (anterior && anterior.status !== 'conversada' && registro.status === 'conversada') return 'marcou um assunto como conversado';
      if (anterior && anterior.status === 'conversada' && registro.status !== 'conversada') return 'reabriu um assunto da pauta';
      return 'editou um assunto da pauta';
    }

    case 'itens': {
      const onde = { filmes: 'filmes', lugares: 'lugares', desejos: 'desejos' }[registro.lista] || 'listas';
      if (acao === 'criou') return 'somou ' + titulo + ' em ' + onde;
      if (anterior && registro.surpresa && !anterior.surpresa) return null; // presente em segredo não vira histórico
      if (anterior && anterior.surpresa && !registro.surpresa) return null;
      if (registro.surpresa) return null;
      if (anterior && anterior.status !== registro.status) {
        return registro.status === 'feito' ? 'marcou ' + titulo + ' como feito' : 'devolveu ' + titulo + ' para a lista';
      }
      return 'editou ' + titulo;
    }

    case 'memorias':
      return acao === 'criou' ? 'guardou a memória ' + titulo : 'editou a memória ' + titulo;

    case 'datas':
      return acao === 'criou' ? 'cadastrou a data ' + titulo : 'editou a data ' + titulo;

    case 'capsulas':
      return acao === 'criou' ? 'lacrou uma carta para abrir em ' + dataBr(registro.abrirEm) : 'mexeu numa carta';

    case 'perguntas':
      return 'respondeu a pergunta do dia';

    case 'perfil':
      return 'ajustou o próprio perfil';

    case 'casal':
      return 'mudou os dados do espaço de vocês';

    default:
      return null;
  }
}

// ---------- registro ----------

function registrar(dados, usuario, { colecao, acao, registro, anterior }) {
  const texto = descrever(colecao, acao, registro || {}, anterior);
  if (!texto) return null;

  if (!Array.isArray(dados.atividades)) dados.atividades = [];
  const agora = Date.now();
  const alvoId = registro && registro.id ? registro.id : colecao;

  // digitou de novo no mesmo lugar em poucos minutos? atualiza a linha em vez de criar outra
  const recente = dados.atividades.find(
    (a) =>
      a.casalId === usuario.casalId &&
      a.usuarioId === usuario.id &&
      a.colecao === colecao &&
      a.alvoId === alvoId &&
      agora - new Date(a.criadoEm).getTime() < JANELA_AGRUPAMENTO
  );

  if (recente) {
    recente.texto = texto;
    recente.criadoEm = new Date(agora).toISOString();
    podar(dados, usuario.casalId);
    return recente;
  }

  const atividade = {
    id: bd.novoId(),
    casalId: usuario.casalId,
    usuarioId: usuario.id,
    colecao,
    alvoId,
    acao,
    texto,
    criadoEm: new Date(agora).toISOString(),
  };
  dados.atividades.push(atividade);
  podar(dados, usuario.casalId);
  return atividade;
}

function podar(dados, casalId) {
  const doCasal = dados.atividades.filter((a) => a.casalId === casalId);
  if (doCasal.length <= LIMITE_POR_CASAL) return;
  const sobrando = doCasal
    .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)))
    .slice(0, doCasal.length - LIMITE_POR_CASAL);
  const remover = new Set(sobrando.map((a) => a.id));
  dados.atividades = dados.atividades.filter((a) => !remover.has(a.id));
}

module.exports = { registrar, descrever };
