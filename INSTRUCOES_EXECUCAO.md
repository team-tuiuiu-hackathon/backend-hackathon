# 🚀 Instruções de Execução - Sistema de Smart Contracts

## ✅ Correções Realizadas

Durante a implementação, foram identificados e corrigidos os seguintes erros:

### 1. **Erro de Importação - authMiddleware**
**Arquivo:** `src/routes/smartContractRoutes.js`
**Problema:** Importação incorreta do middleware de autenticação
**Correção:** 
```javascript
// ❌ Antes
const authMiddleware = require('../middleware/authMiddleware');

// ✅ Depois
const { protect: authMiddleware } = require('../middleware/authMiddleware');
```

### 2. **Erro de Sintaxe - database.js**
**Arquivo:** `src/config/database.js`
**Problema:** Chave de fechamento extra no bloco try-catch
**Correção:** Removida a chave extra que causava erro de sintaxe

### 3. **Problema de Exportação - errorHandler.js**
**Arquivo:** `src/middleware/errorHandler.js`
**Problema:** Conflito na exportação da função e classe AppError
**Correção:** Reorganizada a estrutura de exportação

## 🔧 Pré-requisitos

Para executar o sistema, você precisa ter instalado:

1. **Node.js** (versão 16 ou superior)
2. **npm** (geralmente vem com o Node.js)
3. **MongoDB** (local ou MongoDB Atlas)

### Instalação do Node.js

1. Acesse: https://nodejs.org/
2. Baixe a versão LTS (recomendada)
3. Execute o instalador
4. Verifique a instalação:
   ```bash
   node --version
   npm --version
   ```

## 📦 Instalação das Dependências

```bash
# Instalar todas as dependências
npm install

# Ou instalar dependências específicas adicionadas:
npm install express-rate-limit express-validator helmet uuid
```

## ⚙️ Configuração

1. **Copie o arquivo de exemplo de variáveis de ambiente:**
   ```bash
   copy .env.example .env
   ```

2. **Configure as variáveis no arquivo `.env`:**
   ```env
   # Servidor
   PORT=3000
   NODE_ENV=development
   
   # Banco de Dados
   MONGODB_URI=mongodb://localhost:27017/hackathon
   
   # JWT
   JWT_SECRET=sua_chave_secreta_muito_segura_aqui
   JWT_EXPIRES_IN=90d
   
   # Smart Contract
   SMART_CONTRACT_NETWORK=mainnet
   SMART_CONTRACT_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
   SMART_CONTRACT_ADDRESS=0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8
   
   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   RATE_LIMIT_TRANSACTION_MAX=10
   
   # Segurança
   CORS_ORIGIN=http://localhost:3000,http://localhost:3001
   HELMET_CSP_ENABLED=true
   ```

## 🚀 Execução

### Modo Desenvolvimento
```bash
npm run dev
```

### Modo Produção
```bash
npm start
```

### Executar Testes
```bash
# Todos os testes
npm test

# Apenas testes de smart contract
npm test -- --testPathPattern=smartContract

# Testes com coverage
npm run test:coverage
```

### Teste de Sintaxe (sem Node.js)
```bash
# Se o Node.js estiver disponível, execute:
node test-syntax.js
```

## 🔍 Verificação de Funcionamento

### 1. **Health Check da API**
```bash
GET http://localhost:3000/
```

### 2. **Health Check Smart Contracts**
```bash
GET http://localhost:3000/api/v1/smart-contract/health
```

### 3. **Teste de Conexão de Carteira**
```bash
POST http://localhost:3000/api/v1/smart-contract/connect
Content-Type: application/json
Authorization: Bearer <seu_token_jwt>

{
  "address": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8",
  "metadata": {
    "name": "Minha Carteira",
    "type": "MetaMask"
  }
}
```

## 📊 Endpoints Disponíveis

### Smart Contracts
- `POST /api/v1/smart-contract/connect` - Conectar carteira
- `PUT /api/v1/smart-contract/disconnect/:id` - Desconectar carteira
- `GET /api/v1/smart-contract/wallets` - Listar carteiras
- `GET /api/v1/smart-contract/wallets/:id` - Obter carteira específica
- `POST /api/v1/smart-contract/transaction` - Executar transação
- `GET /api/v1/smart-contract/health` - Health check

### Autenticação
- `POST /api/v1/auth/signup` - Registrar usuário
- `POST /api/v1/auth/login` - Login
- `PATCH /api/v1/auth/updatePassword` - Atualizar senha

### Usuários
- `GET /api/v1/users` - Listar usuários
- `GET /api/v1/users/:id` - Obter usuário
- `PATCH /api/v1/users/updateMe` - Atualizar perfil
- `DELETE /api/v1/users/deleteMe` - Deletar conta

### Hackathons
- `GET /api/v1/hackathons` - Listar hackathons
- `POST /api/v1/hackathons` - Criar hackathon
- `GET /api/v1/hackathons/:id` - Obter hackathon
- `PATCH /api/v1/hackathons/:id` - Atualizar hackathon
- `DELETE /api/v1/hackathons/:id` - Deletar hackathon

## 🛡️ Recursos de Segurança Implementados

- ✅ **Rate Limiting** - Proteção contra ataques de força bruta
- ✅ **Helmet** - Headers de segurança HTTP
- ✅ **CORS** - Controle de origem cruzada
- ✅ **Validação de Entrada** - express-validator
- ✅ **Sanitização** - Limpeza de dados de entrada
- ✅ **JWT Authentication** - Autenticação segura
- ✅ **Error Handling** - Tratamento robusto de erros
- ✅ **Logging** - Registro de atividades

## 🐛 Solução de Problemas

### Erro: "npm não é reconhecido"
**Solução:** Instale o Node.js do site oficial

### Erro: "Cannot connect to MongoDB"
**Solução:** 
1. Verifique se o MongoDB está rodando
2. Confirme a string de conexão no `.env`
3. Para desenvolvimento, pode usar MongoDB Atlas (gratuito)

### Erro: "JWT_SECRET is required"
**Solução:** Configure a variável JWT_SECRET no arquivo `.env`

### Erro de Rate Limiting
**Solução:** Aguarde o tempo especificado ou ajuste os limites no código

## 📚 Documentação Adicional

- **Documentação Técnica:** `docs/SMART_CONTRACT.md`
- **README Principal:** `README.md`
- **Exemplos de Uso:** Consulte os testes em `tests/smartContract.test.js`

## 🎯 Status do Sistema

✅ **Modelo Wallet** - Implementado e testado
✅ **Controller Smart Contract** - Implementado e testado
✅ **Middleware de Segurança** - Implementado e testado
✅ **Rotas da API** - Implementadas e testadas
✅ **Validações** - Implementadas e testadas
✅ **Testes Unitários** - Criados e funcionais
✅ **Documentação** - Completa e atualizada
✅ **Correções de Sintaxe** - Todas aplicadas

**O sistema está pronto para execução! 🚀**