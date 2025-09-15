const request = require('supertest');
const app = require('../src/app');
const Wallet = require('../src/models/walletModel');
const SmartContractController = require('../src/controllers/smartContractController');

describe('Smart Contract API', () => {
  let authToken;
  let testWallet;

  beforeAll(async () => {
    // Mock de autenticação para testes
    authToken = 'mock-jwt-token';
    
    // Limpar storage de carteiras para testes
    SmartContractController.walletStorage.clear();
  });

  beforeEach(() => {
    // Limpar storage antes de cada teste
    SmartContractController.walletStorage.clear();
  });

  describe('Wallet Model', () => {
    describe('Constructor', () => {
      it('deve criar uma carteira com dados válidos', () => {
        const walletData = {
          address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8'
        };
        
        const wallet = new Wallet(walletData);
        
        expect(wallet.address).toBe(walletData.address);
        expect(wallet.id).toBeDefined();
        expect(wallet.createdAt).toBeInstanceOf(Date);
        expect(wallet.connectionStatus).toBe('disconnected');
      });

      it('deve rejeitar endereço inválido', () => {
        expect(() => {
          new Wallet({ address: 'invalid-address' });
        }).toThrow('Formato de endereço de carteira inválido');
      });

      it('deve rejeitar endereço vazio', () => {
        expect(() => {
          new Wallet({ address: '' });
        }).toThrow('Endereço da carteira é obrigatório e deve ser uma string');
      });
    });

    describe('updateConnectionStatus', () => {
      let wallet;

      beforeEach(() => {
        wallet = new Wallet({
          address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8'
        });
      });

      it('deve atualizar status para connected', () => {
        wallet.updateConnectionStatus('connected');
        
        expect(wallet.connectionStatus).toBe('connected');
        expect(wallet.lastConnectionAt).toBeInstanceOf(Date);
      });

      it('deve rejeitar status inválido', () => {
        expect(() => {
          wallet.updateConnectionStatus('invalid-status');
        }).toThrow('Status de conexão inválido');
      });
    });

    describe('isConnected', () => {
      it('deve retornar true quando conectado', () => {
        const wallet = new Wallet({
          address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8',
          connectionStatus: 'connected'
        });
        
        expect(wallet.isConnected()).toBe(true);
      });

      it('deve retornar false quando desconectado', () => {
        const wallet = new Wallet({
          address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8'
        });
        
        expect(wallet.isConnected()).toBe(false);
      });
    });
  });

  describe('POST /api/v1/smart-contract/connect', () => {
    it('deve conectar uma carteira válida', async () => {
      const walletData = {
        address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8',
        metadata: {
          name: 'Test Wallet',
          type: 'MetaMask'
        }
      };

      const response = await request(app)
        .post('/api/v1/smart-contract/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send(walletData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toBe(walletData.address);
      expect(response.body.data.connectionStatus).toBe('connected');
    });

    it('deve rejeitar endereço inválido', async () => {
      const walletData = {
        address: 'invalid-address'
      };

      const response = await request(app)
        .post('/api/v1/smart-contract/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send(walletData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('deve rejeitar carteira duplicada', async () => {
      const walletData = {
        address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8'
      };

      // Primeira conexão
      await request(app)
        .post('/api/v1/smart-contract/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send(walletData)
        .expect(201);

      // Segunda conexão (deve falhar)
      const response = await request(app)
        .post('/api/v1/smart-contract/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send(walletData)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('já está registrada');
    });
  });

  describe('GET /api/v1/smart-contract/wallets', () => {
    beforeEach(async () => {
      // Criar algumas carteiras de teste
      const wallets = [
        { address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8' },
        { address: '0x8ba1f109551bD432803012645Hac136c9c8c8c8' },
        { address: '0x9ca2f209661cE543904023756Iac246d0d9d9d9' }
      ];

      for (const walletData of wallets) {
        await request(app)
          .post('/api/v1/smart-contract/connect')
          .set('Authorization', `Bearer ${authToken}`)
          .send(walletData);
      }
    });

    it('deve listar todas as carteiras', async () => {
      const response = await request(app)
        .get('/api/v1/smart-contract/wallets')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
    });

    it('deve filtrar por status', async () => {
      const response = await request(app)
        .get('/api/v1/smart-contract/wallets?status=connected')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(wallet => {
        expect(wallet.connectionStatus).toBe('connected');
      });
    });

    it('deve implementar paginação', async () => {
      const response = await request(app)
        .get('/api/v1/smart-contract/wallets?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });
  });

  describe('POST /api/v1/smart-contract/transaction', () => {
    let walletId;

    beforeEach(async () => {
      // Criar e conectar uma carteira para testes
      const response = await request(app)
        .post('/api/v1/smart-contract/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8' });
      
      walletId = response.body.data.id;
    });

    it('deve executar transação válida', async () => {
      const transactionData = {
        walletId,
        contractMethod: 'transfer',
        parameters: ['0x8ba1f109551bD432803012645Hac136c9c8c8c8', '100']
      };

      const response = await request(app)
        .post('/api/v1/smart-contract/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionHash).toBeDefined();
      expect(response.body.data.method).toBe('transfer');
    });

    it('deve rejeitar método inválido', async () => {
      const transactionData = {
        walletId,
        contractMethod: 'invalidMethod',
        parameters: []
      };

      const response = await request(app)
        .post('/api/v1/smart-contract/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('deve rejeitar carteira inexistente', async () => {
      const transactionData = {
        walletId: '00000000-0000-0000-0000-000000000000',
        contractMethod: 'transfer',
        parameters: ['0x8ba1f109551bD432803012645Hac136c9c8c8c8', '100']
      };

      const response = await request(app)
        .post('/api/v1/smart-contract/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('não encontrada');
    });
  });

  describe('GET /api/v1/smart-contract/health', () => {
    it('deve retornar status de saúde', async () => {
      const response = await request(app)
        .get('/api/v1/smart-contract/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('operacional');
      expect(response.body.version).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('deve aplicar rate limiting em transações', async () => {
      // Criar carteira
      const walletResponse = await request(app)
        .post('/api/v1/smart-contract/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ address: '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8' });
      
      const walletId = walletResponse.body.data.id;
      const transactionData = {
        walletId,
        contractMethod: 'transfer',
        parameters: ['0x8ba1f109551bD432803012645Hac136c9c8c8c8', '100']
      };

      // Fazer múltiplas requisições rapidamente
      const promises = Array(12).fill().map(() => 
        request(app)
          .post('/api/v1/smart-contract/transaction')
          .set('Authorization', `Bearer ${authToken}`)
          .send(transactionData)
      );

      const responses = await Promise.all(promises);
      
      // Algumas devem ser bloqueadas por rate limiting
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });
});

// Mock do middleware de autenticação para testes
jest.mock('../src/middleware/authMiddleware', () => {
  return (req, res, next) => {
    req.user = { id: 'test-user-id', email: 'test@example.com' };
    next();
  };
});