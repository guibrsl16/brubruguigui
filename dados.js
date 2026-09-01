// Camada de dados: um unico arquivo JSON, escrita atomica, zero dependencias.
const fs = require('fs');
const path = require('path');

const PASTA = path.join(__dirname, 'dados');
const ARQUIVO = path.join(PASTA, 'dados.json');
const TEMPORARIO = path.join(PASTA, 'dados.tmp');

const VAZIO = {
  versao: 1,
  casais: [],
  usuarios: [],
  sessoes: [],
  metas: [],
  cofrinhos: [],
  encontros: [],
  checkins: [],
  termometro: [],
  recados: [],
  perguntas: [],
  itens: [],
  memorias: [],
  datas: [],
  revisoes: [],
  planos: [],
  acordos: [],
  pautas: [],
  pedidos: [],
  capsulas: [],
  atividades: [],
};

let cache = null;

function carregar() {
  if (cache) return cache;
  try {
    const bruto = fs.readFileSync(ARQUIVO, 'utf8');
    cache = Object.assign({}, VAZIO, JSON.parse(bruto));
  } catch (erro) {
    if (erro.code !== 'ENOENT') {
      console.error('[dados] arquivo ilegivel, criando backup:', erro.message);
      try { fs.renameSync(ARQUIVO, ARQUIVO + '.corrompido-' + Date.now()); } catch (_) {}
    }
    cache = JSON.parse(JSON.stringify(VAZIO));
    salvar();
  }
  // garante que colecoes novas existam em bases antigas
  for (const chave of Object.keys(VAZIO)) {
    if (cache[chave] === undefined) cache[chave] = Array.isArray(VAZIO[chave]) ? [] : VAZIO[chave];
  }
  return cache;
}

function salvar() {
  if (!fs.existsSync(PASTA)) fs.mkdirSync(PASTA, { recursive: true });
  fs.writeFileSync(TEMPORARIO, JSON.stringify(cache, null, 2), 'utf8');
  fs.renameSync(TEMPORARIO, ARQUIVO);
}

function novoId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

module.exports = { carregar, salvar, novoId, ARQUIVO };
