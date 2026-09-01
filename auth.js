// Contas, senhas e sessoes. Usa apenas o modulo crypto nativo do Node.
const crypto = require('crypto');
const bd = require('./dados');

const DIAS_SESSAO = 60;
const CUSTO = { N: 16384, r: 8, p: 1 };

function embaralhar(senha, sal) {
  return crypto.scryptSync(senha, sal, 64, CUSTO).toString('hex');
}

function criarSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  return { sal, hash: embaralhar(senha, sal) };
}

function conferirSenha(senha, sal, hash) {
  if (!sal || !hash) return false;
  const tentativa = Buffer.from(embaralhar(senha, sal), 'hex');
  const guardado = Buffer.from(hash, 'hex');
  if (tentativa.length !== guardado.length) return false;
  return crypto.timingSafeEqual(tentativa, guardado);
}

function codigoDeConvite() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let saida = '';
  for (let i = 0; i < 6; i++) saida += letras[crypto.randomInt(letras.length)];
  return saida;
}

function abrirSessao(usuarioId) {
  const dados = bd.carregar();
  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = Date.now() + DIAS_SESSAO * 24 * 60 * 60 * 1000;
  dados.sessoes.push({ token, usuarioId, expiraEm });
  limparSessoesVencidas(dados);
  bd.salvar();
  return { token, expiraEm };
}

function fecharSessao(token) {
  const dados = bd.carregar();
  const antes = dados.sessoes.length;
  dados.sessoes = dados.sessoes.filter((s) => s.token !== token);
  if (dados.sessoes.length !== antes) bd.salvar();
}

function limparSessoesVencidas(dados) {
  const agora = Date.now();
  dados.sessoes = dados.sessoes.filter((s) => s.expiraEm > agora);
}

function usuarioDaRequisicao(req) {
  const token = lerCookie(req, 'nosdois');
  if (!token) return null;
  const dados = bd.carregar();
  const sessao = dados.sessoes.find((s) => s.token === token);
  if (!sessao || sessao.expiraEm < Date.now()) return null;
  return dados.usuarios.find((u) => u.id === sessao.usuarioId) || null;
}

function lerCookie(req, nome) {
  const cru = req.headers.cookie;
  if (!cru) return null;
  for (const parte of cru.split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

function cabecalhoCookie(token, expiraEm) {
  const partes = [
    'nosdois=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + Math.floor((expiraEm - Date.now()) / 1000),
  ];
  if (process.env.HTTPS === '1') partes.push('Secure');
  return partes.join('; ');
}

function cookieVazio() {
  return 'nosdois=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

module.exports = {
  criarSenha,
  conferirSenha,
  codigoDeConvite,
  abrirSessao,
  fecharSessao,
  usuarioDaRequisicao,
  cabecalhoCookie,
  cookieVazio,
  lerCookie,
};
