// Nos Dois - servidor HTTP sem dependencias externas.
const http = require('http');
const fs = require('fs');
const path = require('path');

const bd = require('./dados');
const auth = require('./auth');
const api = require('./api');

const PORTA = Number(process.env.PORTA || 3300);
const PUBLICO = path.join(__dirname, 'publico');
const LIMITE_CORPO = 6 * 1024 * 1024; // 6 MB, por causa das fotos das memorias

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// ---------- tempo real: cada aba aberta fica ouvindo o que o outro faz ----------

const ouvintes = new Map(); // casalId -> Set de respostas abertas

function abrirCanal(req, res, usuario) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');

  if (!ouvintes.has(usuario.casalId)) ouvintes.set(usuario.casalId, new Set());
  const grupo = ouvintes.get(usuario.casalId);
  grupo.add(res);

  const batida = setInterval(() => res.write(': batida\n\n'), 25000);

  const encerrar = () => {
    clearInterval(batida);
    grupo.delete(res);
    if (!grupo.size) ouvintes.delete(usuario.casalId);
  };
  req.on('close', encerrar);
  res.on('error', encerrar);
}

function avisarCasal(casalId, mensagem) {
  const grupo = ouvintes.get(casalId);
  if (!grupo || !grupo.size) return;
  const linha = 'data: ' + JSON.stringify(mensagem) + '\n\n';
  for (const res of grupo) {
    try {
      res.write(linha);
    } catch (_) {
      grupo.delete(res);
    }
  }
}

api.aoMudar(avisarCasal);

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let bruto = '';
    let tamanho = 0;
    req.on('data', (pedaco) => {
      tamanho += pedaco.length;
      if (tamanho > LIMITE_CORPO) {
        reject(new Error('Envio grande demais. Use uma foto menor.'));
        req.destroy();
        return;
      }
      bruto += pedaco;
    });
    req.on('end', () => {
      if (!bruto) return resolve({});
      try {
        resolve(JSON.parse(bruto));
      } catch (_) {
        reject(new Error('Dados invalidos.'));
      }
    });
    req.on('error', reject);
  });
}

function servirArquivo(res, caminhoPedido) {
  const relativo = caminhoPedido === '/' ? '/index.html' : caminhoPedido;
  const destino = path.join(PUBLICO, path.normalize(relativo).replace(/^([/\\])+/, ''));
  if (!destino.startsWith(PUBLICO)) {
    res.writeHead(403).end('Acesso negado');
    return;
  }
  fs.readFile(destino, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Pagina nao encontrada');
      return;
    }
    const tipo = TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
    res.end(conteudo);
  });
}

async function tratarApi(req, res, url) {
  const dados = bd.carregar();
  const partes = url.pathname.split('/').filter(Boolean); // ['api', ...]
  const rota = partes.slice(1);
  const metodo = req.method;

  let corpo = {};
  if (metodo === 'POST' || metodo === 'PUT') {
    try {
      corpo = await lerCorpo(req);
    } catch (erro) {
      return api.responder(res, 400, { erro: erro.message });
    }
  }

  // --- rotas abertas ---
  if (rota[0] === 'registrar' && metodo === 'POST') {
    const r = api.registrar(dados, corpo);
    if (r.erro) return api.responder(res, 400, r);
    const sessao = auth.abrirSessao(r.usuario.id);
    return api.responder(res, 200, { ok: true }, { 'Set-Cookie': auth.cabecalhoCookie(sessao.token, sessao.expiraEm) });
  }

  if (rota[0] === 'entrar' && metodo === 'POST') {
    const r = api.entrar(dados, corpo);
    if (r.erro) return api.responder(res, 401, r);
    const sessao = auth.abrirSessao(r.usuario.id);
    return api.responder(res, 200, { ok: true }, { 'Set-Cookie': auth.cabecalhoCookie(sessao.token, sessao.expiraEm) });
  }

  if (rota[0] === 'sair' && metodo === 'POST') {
    auth.fecharSessao(auth.lerCookie(req, 'nosdois'));
    return api.responder(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieVazio() });
  }

  // --- daqui pra baixo exige login ---
  const usuario = auth.usuarioDaRequisicao(req);
  if (!usuario) return api.responder(res, 401, { erro: 'Sessao expirada. Entre de novo.' });

  if (rota[0] === 'eventos' && metodo === 'GET') {
    return abrirCanal(req, res, usuario);
  }

  if (rota[0] === 'estado' && metodo === 'GET') {
    return api.responder(res, 200, api.montarEstado(dados, usuario));
  }

  if (rota[0] === 'ajustes' && metodo === 'POST') {
    return api.responder(res, 200, api.salvarAjustes(dados, usuario, corpo));
  }

  if (rota[0] === 'senha' && metodo === 'POST') {
    const r = api.trocarSenha(dados, usuario, corpo);
    return api.responder(res, r.erro ? 400 : 200, r);
  }

  if (rota[0] === 'pergunta') {
    if (metodo === 'GET') return api.responder(res, 200, api.verPergunta(dados, usuario));
    if (metodo === 'POST') return api.responder(res, 200, api.responderPergunta(dados, usuario, corpo));
  }

  if (rota[0] === 'colecao' && rota[1]) {
    const colecao = rota[1];
    const id = rota[2];
    let r;
    if (metodo === 'POST' && !id) r = api.criar(dados, usuario, colecao, corpo);
    else if (metodo === 'PUT' && id) r = api.atualizar(dados, usuario, colecao, id, corpo);
    else if (metodo === 'DELETE' && id) r = api.apagar(dados, usuario, colecao, id);
    else return api.responder(res, 405, { erro: 'Metodo nao permitido.' });
    return api.responder(res, r.erro ? 400 : 200, r);
  }

  return api.responder(res, 404, { erro: 'Rota nao encontrada.' });
}

const servidor = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  if (url.pathname.startsWith('/api/')) {
    tratarApi(req, res, url).catch((erro) => {
      console.error('[api]', erro);
      if (!res.headersSent) api.responder(res, 500, { erro: 'Erro interno no servidor.' });
    });
    return;
  }

  // rotas do app caem no index; quem nao tem sessao vai pra tela de entrada
  if (req.method === 'GET' && (url.pathname === '/' || !path.extname(url.pathname))) {
    const logado = !!auth.usuarioDaRequisicao(req);
    if (!logado && url.pathname !== '/entrar') {
      res.writeHead(302, { Location: '/entrar' });
      return res.end();
    }
    if (logado && url.pathname === '/entrar') {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    return servirArquivo(res, url.pathname === '/entrar' ? '/entrar.html' : '/index.html');
  }

  servirArquivo(res, url.pathname);
});

servidor.listen(PORTA, () => {
  console.log('Brugui rodando em http://localhost:' + PORTA);
});
