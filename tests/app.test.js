const request = require('supertest');
const app = require('../src/app');

describe('Testes básicos da API', () => {
  // Teste da rota principal
  test('GET / - deve retornar status 200 e mensagem de sucesso', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.message).toBe('API Backend Hackathon funcionando!');
  });

  // Teste de rota não existente
  test('GET /rota-inexistente - deve retornar status 404', async () => {
    const response = await request(app).get('/rota-inexistente');
    expect(response.statusCode).toBe(404);
    expect(response.body.status).toBe('error');
  });
});