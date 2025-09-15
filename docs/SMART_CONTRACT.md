# Smart Contract Integration

Este documento descreve a integração com smart contracts implementada no sistema de hackathons.

## Visão Geral

A funcionalidade de smart contract permite:
- Conexão e gerenciamento de carteiras
- Execução de transações seguras
- Monitoramento de status de conexão
- Validação e sanitização de dados

## Arquitetura

### Componentes Principais

1. **Wallet Model** (`src/models/walletModel.js`)
   - Modelo para representar carteiras conectadas
   - Validação de endereços Ethereum
   - Gerenciamento de status de conexão

2. **Smart Contract Controller** (`src/controllers/smartContractController.js`)
   - Lógica de negócio para operações de smart contract
   - Gerenciamento de carteiras
   - Execução de transações

3. **Smart Contract Routes** (`src/routes/smartContractRoutes.js`)
   - Endpoints REST para interação com smart contracts
   - Validação de entrada
   - Rate limiting

4. **Smart Contract Middleware** (`src/middleware/smartContractMiddleware.js`)
   - Sanitização de dados
   - Validação de carteiras
   - Logging de atividades
   - Verificação de integridade

## Endpoints da API

### Conectar Carteira
```http
POST /api/v1/smart-contract/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8",
  "metadata": {
    "name": "Minha Carteira",
    "type": "MetaMask"
  }
}
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "message": "Carteira conectada com sucesso",
  "data": {
    "id": "uuid-da-carteira",
    "address": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8",
    "connectionStatus": "connected",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "lastConnectionAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Desconectar Carteira
```http
DELETE /api/v1/smart-contract/disconnect/:walletId
Authorization: Bearer <token>
```

### Listar Carteiras
```http
GET /api/v1/smart-contract/wallets
Authorization: Bearer <token>

# Parâmetros de query opcionais:
# ?status=connected|disconnected
# ?page=1&limit=10
```

### Obter Informações da Carteira
```http
GET /api/v1/smart-contract/wallet/:walletId
Authorization: Bearer <token>
```

### Executar Transação
```http
POST /api/v1/smart-contract/transaction
Authorization: Bearer <token>
Content-Type: application/json

{
  "walletId": "uuid-da-carteira",
  "contractMethod": "transfer",
  "parameters": ["0x8ba1f109551bD432803012645Hac136c9c8c8c8", "100"]
}
```

### Health Check
```http
GET /api/v1/smart-contract/health
```

## Modelo de Dados

### Wallet
```javascript
{
  id: String,              // UUID único
  address: String,         // Endereço Ethereum (validado)
  createdAt: Date,         // Data de criação
  connectionStatus: String, // 'connected' | 'disconnected' | 'error'
  lastConnectionAt: Date,  // Última conexão
  metadata: Object         // Dados adicionais (nome, tipo, etc.)
}
```

## Segurança

### Validações Implementadas

1. **Validação de Endereço Ethereum**
   - Formato hexadecimal
   - Comprimento de 42 caracteres
   - Prefixo '0x'

2. **Rate Limiting**
   - Limite global: 100 requisições por 15 minutos
   - Limite de transações: 10 por 15 minutos

3. **Sanitização de Dados**
   - Remoção de caracteres especiais
   - Validação de tipos
   - Escape de HTML

4. **Middleware de Segurança**
   - Helmet para headers de segurança
   - CORS configurado
   - Validação de entrada com express-validator

### Headers de Segurança

- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Referrer-Policy

## Configuração

### Variáveis de Ambiente

```env
# Smart Contract
SMART_CONTRACT_NETWORK=mainnet
SMART_CONTRACT_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
SMART_CONTRACT_ADDRESS=0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8
SMART_CONTRACT_PRIVATE_KEY=your_private_key_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_TRANSACTION_MAX=10

# Segurança
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
HELMET_CSP_ENABLED=true
```

## Tratamento de Erros

### Códigos de Erro Comuns

- `400` - Dados de entrada inválidos
- `401` - Token de autenticação inválido
- `404` - Carteira não encontrada
- `409` - Carteira já registrada
- `429` - Rate limit excedido
- `500` - Erro interno do servidor

### Estrutura de Resposta de Erro

```json
{
  "success": false,
  "message": "Descrição do erro",
  "errors": [
    {
      "field": "address",
      "message": "Formato de endereço inválido"
    }
  ],
  "errorId": "uuid-do-erro",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testes

### Executar Testes

```bash
# Todos os testes
npm test

# Apenas testes de smart contract
npm test -- --testPathPattern=smartContract

# Testes com coverage
npm run test:coverage
```

### Cobertura de Testes

Os testes cobrem:
- Validação do modelo Wallet
- Endpoints da API
- Middleware de segurança
- Rate limiting
- Tratamento de erros

## Performance

### Otimizações Implementadas

1. **Armazenamento em Memória**
   - Map para acesso O(1) às carteiras
   - Cache de validações

2. **Rate Limiting Inteligente**
   - Diferentes limites por tipo de operação
   - Janelas deslizantes

3. **Validação Eficiente**
   - Regex otimizadas
   - Validação em camadas

## Monitoramento

### Logs Implementados

- Conexões de carteira
- Execução de transações
- Erros e exceções
- Rate limiting
- Atividades suspeitas

### Métricas Disponíveis

- Número de carteiras conectadas
- Transações por minuto
- Taxa de erro
- Tempo de resposta

## Próximos Passos

1. **Integração com Blockchain Real**
   - Implementar Web3.js ou Ethers.js
   - Conectar com redes Ethereum

2. **Persistência de Dados**
   - Migrar para MongoDB
   - Implementar backup e recovery

3. **Funcionalidades Avançadas**
   - Multi-signature wallets
   - Token swaps
   - NFT support

4. **Monitoramento Avançado**
   - Dashboards em tempo real
   - Alertas automáticos
   - Análise de performance

## Suporte

Para dúvidas ou problemas:
1. Consulte os logs da aplicação
2. Verifique a configuração das variáveis de ambiente
3. Execute os testes para validar a funcionalidade
4. Consulte a documentação da API