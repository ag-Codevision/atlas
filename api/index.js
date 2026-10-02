import { api } from '../server.mjs';

export default async function handler(req, res) {
  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `${protocol}://${host}`);
    return await api(req, res, url);
  } catch (error) {
    if (res.headersSent) return res.end();
    const status = error.status || 500;
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    });
    res.end(JSON.stringify({ error: error.message || 'Erro interno no servidor.' }));
  }
}
