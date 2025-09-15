# 🌟 Sign-In with Stellar - Documentação

Sistema de autenticação baseado na blockchain Stellar implementado para o projeto hackathon.

## 📋 Visão Geral

O sistema permite que usuários se autentiquem usando suas chaves Stellar, sem necessidade de senhas tradicionais. A autenticação é baseada em assinatura criptográfica de transações Stellar.

## 🏗️ Arquitetura

### Componentes Implementados

1. **Modelo de Dados** (`stellarUserModel.js`)
   - Tabela `stellar_users` com campos `address` e `challenge`
   - Métodos para gerenciar usuários e challenges

2. **Controller** (`stellarAuthController.js`)
   - Endpoints para challenge e login
   - Verificação de assinaturas Stellar
   - Geração de tokens JWT

3. **Rotas** (`stellarAuthRoutes.js`)
   - Configuração das rotas da API
   - Documentação Swagger integrada

## 🔧 Instalação

### Dependências Necessárias

```bash
npm install stellar-sdk
```

### Configuração do Banco de Dados

Execute o comando SQL fornecido em `CREATE_TABLE_STELLAR_USERS.sql`:

```sql
CREATE TABLE stellar_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(56) NOT NULL UNIQUE,
    challenge TEXT,
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

## 🚀 Endpoints da API

### 1. Gerar Challenge

**POST** `/api/v1/stellar/challenge`

Gera um challenge (nonce) para autenticação.

**Request Body:**
```json
{
  "publicKey": "GCKFBEIYTKP6JY4Q2FBJCGK6YBWKX7NQQQIWXQYN7XJHVQZQZQZQZQZQ"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "transactionXDR": "AAAAAgAAAABelb7j...",
    "challenge": "a1b2c3d4e5f6...",
    "expiresIn": 300
  }
}
```

### 2. Login

**POST** `/api/v1/stellar/login`

Autentica o usuário com a transação assinada.

**Request Body:**
```json
{
  "signedXDR": "AAAAAgAAAABelb7j..."
}
```

**Response:**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "data": {
    "user": {
      "id": "uuid-here",
      "address": "GCKFBEIYTKP6JY4Q2FBJCGK6YBWKX7NQQQIWXQYN7XJHVQZQZQZQZQZQ",
      "lastLogin": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

### 3. Dados do Usuário

**GET** `/api/v1/stellar/me`

Retorna dados do usuário autenticado (requer token JWT).

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid-here",
      "address": "GCKFBEIYTKP6JY4Q2FBJCGK6YBWKX7NQQQIWXQYN7XJHVQZQZQZQZQZQ",
      "lastLogin": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

## 🔐 Fluxo de Autenticação

### Passo a Passo

1. **Cliente solicita challenge**
   - Envia `publicKey` para `/api/v1/stellar/challenge`
   - Recebe `transactionXDR` e `challenge`

2. **Cliente assina transação**
   - Desserializa o XDR recebido
   - Assina com sua chave privada
   - Obtém `signedXDR`

3. **Cliente faz login**
   - Envia `signedXDR` para `/api/v1/stellar/login`
   - Recebe token JWT se válido

4. **Cliente usa token**
   - Inclui token no header `Authorization: Bearer <token>`
   - Acessa rotas protegidas

### Validações de Segurança

- ✅ Verificação de formato da chave pública Stellar
- ✅ Validação da assinatura criptográfica
- ✅ Verificação do challenge na transação
- ✅ Limpeza do challenge após uso (anti-replay)
- ✅ Expiração do challenge (5 minutos)
- ✅ Tokens JWT com expiração configurável

## 💻 Exemplo de Uso

Veja o arquivo `STELLAR_AUTH_EXAMPLE.js` para um exemplo completo de implementação.

### Exemplo Básico (JavaScript)

```javascript
const StellarSdk = require('stellar-sdk');
const axios = require('axios');

async function autenticarComStellar(publicKey, secretKey) {
  // 1. Solicitar challenge
  const challengeRes = await axios.post('/api/v1/stellar/challenge', {
    publicKey
  });
  
  const { transactionXDR } = challengeRes.data.data;
  
  // 2. Assinar transação
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    transactionXDR, 
    StellarSdk.Networks.TESTNET
  );
  transaction.sign(keypair);
  
  // 3. Fazer login
  const loginRes = await axios.post('/api/v1/stellar/login', {
    signedXDR: transaction.toXDR()
  });
  
  return loginRes.data.token;
}
```

## 🛡️ Middleware de Proteção

Use o middleware `protectStellar` para proteger rotas:

```javascript
const { protectStellar } = require('./controllers/stellarAuthController');

router.get('/rota-protegida', protectStellar, (req, res) => {
  // req.user contém os dados do usuário autenticado
  res.json({ user: req.user });
});
```

## 🌐 Rede Stellar

O sistema está configurado para usar a **Testnet** do Stellar:
- Horizon Server: `https://horizon-testnet.stellar.org`
- Network Passphrase: `Test SDF Network ; September 2015`

Para produção, altere para a Mainnet:
- Horizon Server: `https://horizon.stellar.org`
- Network Passphrase: `Public Global Stellar Network ; September 2015`

## 📝 Variáveis de Ambiente

Certifique-se de configurar no `.env`:

```env
JWT_SECRET=seu-jwt-secret-super-seguro
JWT_EXPIRES_IN=7d
DATABASE_URL=sua-connection-string-postgresql
```

## 🧪 Testes

Para testar o sistema:

1. Execute o servidor: `npm run dev`
2. Acesse a documentação: `http://localhost:3000/api-docs`
3. Use o exemplo: `node STELLAR_AUTH_EXAMPLE.js`

## 🔍 Troubleshooting

### Erros Comuns

1. **"publicKey inválida"**
   - Verifique se a chave tem 56 caracteres
   - Deve começar com 'G'

2. **"Challenge não encontrado"**
   - O challenge expira em 5 minutos
   - Solicite um novo challenge

3. **"Assinatura inválida"**
   - Verifique se está usando a chave privada correta
   - Confirme se a transação foi assinada corretamente

## 📚 Recursos Adicionais

- [Stellar SDK Documentation](https://stellar.github.io/js-stellar-sdk/)
- [Stellar Developer Portal](https://developers.stellar.org/)
- [JWT.io](https://jwt.io/) - Para debugar tokens JWT

## 🤝 Contribuição

Este sistema foi desenvolvido como parte do projeto hackathon. Para melhorias:

1. Adicione testes unitários
2. Implemente rate limiting específico
3. Adicione logs de auditoria
4. Configure monitoramento de performance

---

**Desenvolvido com ❤️ para o Hackathon Stellar**