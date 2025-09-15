const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/userModel');

// Configuração para testes
beforeAll(async () => {
  // Conectar ao banco de dados de teste
  const testDbUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/hackathon_test';
  await mongoose.connect(testDbUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// Limpar o banco de dados após cada teste
afterEach(async () => {
  await User.deleteMany({});
});

// Desconectar do banco de dados após todos os testes
afterAll(async () => {
  await mongoose.connection.close();
});

describe('Testes de autenticação', () => {
  // Teste de registro de usuário
  test('POST /api/v1/auth/signup - deve registrar um novo usuário', async () => {
    const userData = {
      name: 'Usuário Teste',
      email: 'teste@example.com',
      password: 'senha123456',
      passwordConfirm: 'senha123456',
    };

    const response = await request(app)
      .post('/api/v1/auth/signup')
      .send(userData);

    expect(response.statusCode).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.token).toBeDefined();
    expect(response.body.data.user).toBeDefined();
    expect(response.body.data.user.name).toBe(userData.name);
    expect(response.body.data.user.email).toBe(userData.email);
    expect(response.body.data.user.password).toBeUndefined(); // Senha não deve ser retornada
  });

  // Teste de login
  test('POST /api/v1/auth/login - deve fazer login com credenciais válidas', async () => {
    // Primeiro, criar um usuário
    const userData = {
      name: 'Usuário Login',
      email: 'login@example.com',
      password: 'senha123456',
      passwordConfirm: 'senha123456',
    };

    await request(app)
      .post('/api/v1/auth/signup')
      .send(userData);

    // Tentar fazer login
    const loginData = {
      email: 'login@example.com',
      password: 'senha123456',
    };

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginData);

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.token).toBeDefined();
  });

  // Teste de login com credenciais inválidas
  test('POST /api/v1/auth/login - deve falhar com credenciais inválidas', async () => {
    const loginData = {
      email: 'naoexiste@example.com',
      password: 'senhaerrada',
    };

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send(loginData);

    expect(response.statusCode).toBe(401);
    expect(response.body.status).toBe('fail');
  });
});