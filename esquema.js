// Define os campos aceitos em cada colecao. Nada fora daqui entra no banco.
const t = {
  texto: (v) => (typeof v === 'string' ? v.slice(0, 4000) : ''),
  textoLongo: (v) => (typeof v === 'string' ? v.slice(0, 20000) : ''),
  imagem: (v) => (typeof v === 'string' ? v.slice(0, 3500000) : ''),
  numero: (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  },
  bool: (v) => v === true || v === 'true',
  lista: (v) => (Array.isArray(v) ? v.slice(0, 500) : []),
  objeto: (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}),
  opcoes: (permitidas) => (v) => (permitidas.includes(v) ? v : permitidas[0]),
  nota1a5: (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
  },
};

const COLECOES = {
  metas: {
    porUsuario: false,
    campos: {
      titulo: t.texto,
      descricao: t.textoLongo,
      tipo: t.opcoes(['compartilhada', 'pessoal']),
      donoId: t.texto,
      categoria: t.texto,
      prazo: t.texto,
      marcos: t.lista,
      concluida: t.bool,
      principal: t.bool,
      alimentaId: t.texto,
      apoio: t.textoLongo,
    },
    obrigatorios: ['titulo'],
  },
  cofrinhos: {
    porUsuario: false,
    campos: {
      titulo: t.texto,
      descricao: t.textoLongo,
      alvo: t.numero,
      prazo: t.texto,
      depositos: t.lista,
      concluido: t.bool,
      metaId: t.texto,
    },
    obrigatorios: ['titulo'],
  },
  encontros: {
    porUsuario: false,
    campos: {
      titulo: t.texto,
      tipo: t.opcoes(['presencial', 'virtual']),
      inicio: t.texto,
      fim: t.texto,
      local: t.texto,
      despesas: t.lista,
      km: t.numero,
      status: t.opcoes(['planejado', 'realizado', 'cancelado']),
      anotacoes: t.textoLongo,
      cofrinhoId: t.texto,
    },
    obrigatorios: ['titulo'],
  },
  checkins: {
    porUsuario: true,
    unicoPor: 'data',
    campos: { data: t.texto, humor: t.nota1a5, energia: t.nota1a5, nota: t.texto },
    obrigatorios: ['data'],
  },
  termometro: {
    porUsuario: true,
    unicoPor: 'semana',
    campos: {
      semana: t.texto,
      comunicacao: t.nota1a5,
      ouvido: t.nota1a5,
      carinho: t.nota1a5,
      comentario: t.textoLongo,
    },
    obrigatorios: ['semana'],
  },
  recados: {
    porUsuario: true,
    camposDoPar: ['curtidoPor'],
    campos: { texto: t.textoLongo, curtidoPor: t.lista },
    obrigatorios: ['texto'],
  },
  itens: {
    porUsuario: false,
    campos: {
      lista: t.opcoes(['filmes', 'lugares', 'desejos']),
      titulo: t.texto,
      obs: t.textoLongo,
      donoId: t.texto,
      status: t.opcoes(['quero', 'feito']),
      notas: t.objeto,
      link: t.texto,
      surpresa: t.bool,
      compradoPor: t.texto,
    },
    obrigatorios: ['titulo'],
  },
  memorias: {
    porUsuario: false,
    campos: { titulo: t.texto, data: t.texto, texto: t.textoLongo, foto: t.imagem },
    obrigatorios: ['titulo'],
  },
  datas: {
    porUsuario: false,
    campos: {
      titulo: t.texto,
      dia: t.numero,
      mes: t.numero,
      ano: t.numero,
      tipo: t.texto,
      lembrarDiasAntes: t.numero,
    },
    obrigatorios: ['titulo'],
  },

  // ---------- planejamento ----------
  revisoes: {
    porUsuario: true,
    unicoPor: 'mes',
    campos: { mes: t.texto, avancou: t.textoLongo, travou: t.textoLongo, muda: t.textoLongo },
    obrigatorios: ['mes'],
  },

  // ---------- distancia ----------
  planos: {
    porUsuario: false,
    unicoNoCasal: true,
    campos: { cidade: t.texto, dataAlvo: t.texto, observacao: t.textoLongo, itens: t.lista },
    obrigatorios: [],
  },

  // ---------- convivencia ----------
  acordos: {
    porUsuario: true,
    camposDoPar: ['aceitoPor'],
    campos: { texto: t.textoLongo, aceitoPor: t.lista, ativo: t.bool },
    obrigatorios: ['texto'],
  },
  pautas: {
    porUsuario: true,
    camposDoPar: ['status'],
    campos: {
      texto: t.textoLongo,
      urgencia: t.opcoes(['tranquila', 'importante', 'urgente']),
      status: t.opcoes(['aberta', 'conversada']),
    },
    obrigatorios: ['texto'],
  },
  pedidos: {
    porUsuario: true,
    unicoPor: 'semana',
    campos: { semana: t.texto, texto: t.textoLongo },
    obrigatorios: ['semana', 'texto'],
  },

  // ---------- delicadezas ----------
  capsulas: {
    porUsuario: true,
    campos: { titulo: t.texto, texto: t.textoLongo, abrirEm: t.texto },
    obrigatorios: ['titulo', 'abrirEm'],
  },
};

function higienizar(colecao, entrada, parcial) {
  const spec = COLECOES[colecao];
  if (!spec) return null;
  const saida = {};
  for (const [campo, conversor] of Object.entries(spec.campos)) {
    if (parcial && !(campo in entrada)) continue;
    saida[campo] = conversor(entrada[campo]);
  }
  if (!parcial) {
    for (const campo of spec.obrigatorios) {
      if (!saida[campo] || (typeof saida[campo] === 'string' && !saida[campo].trim())) return null;
    }
  }
  return saida;
}

module.exports = { COLECOES, higienizar };
