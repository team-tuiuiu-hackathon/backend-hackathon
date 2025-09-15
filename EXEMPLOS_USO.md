# 🚀 Exemplos de Uso - Sistema de Smart Contracts

## 📋 Pré-requisitos

Antes de executar os exemplos, certifique-se de que:

1. **Node.js está instalado** (versão 14 ou superior)
2. **MongoDB está rodando** (local ou Atlas)
3. **Dependências instaladas**: `npm install`
4. **Servidor iniciado**: `npm run dev`

## 🔧 Configuração Inicial

### 1. Instalar Node.js
```bash
# Baixe e instale do site oficial: https://nodejs.org/
# Ou use o Chocolatey no Windows:
choco install nodejs

# Verificar instalação
node --version
npm --version
```

### 2. Instalar Dependências
```bash
cd backend-hackathon
npm install
```

### 3. Configurar Variáveis de Ambiente
```bash
# Copie o arquivo de exemplo
copy .env.example .env

# Edite o arquivo .env com suas configurações
```

### 4. Iniciar o Servidor
```bash
# Modo desenvolvimento
npm run dev

# Modo produção
npm start
```

## 🧪 Exemplos de Requisições

### 🔐 Autenticação

#### Registrar Usuário
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "senha123",
    "passwordConfirm": "senha123"
  }'
```

#### Fazer Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@example.com",
    "password": "senha123"
  }'
```

**Resposta esperada:**
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "João Silva",
      "email": "joao@example.com",
      "role": "user"
    }
  }
}
```

### 💰 Gestão de Carteiras

#### Conectar Carteira
```bash
curl -X POST http://localhost:3000/api/v1/smart-contract/connect-wallet \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db7C4C9db7C4",
    "network": "ethereum",
    "metadata": {
      "name": "Minha Carteira Principal",
      "type": "MetaMask"
    }
  }'
```

#### Listar Carteiras
```bash
curl -X GET http://localhost:3000/api/v1/smart-contract/wallets \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

#### Desconectar Carteira
```bash
curl -X DELETE http://localhost:3000/api/v1/smart-contract/disconnect-wallet \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db7C4C9db7C4"
  }'
```

### 📝 Execução de Transações

#### Executar Transação
```bash
curl -X POST http://localhost:3000/api/v1/smart-contract/execute-transaction \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -d '{
    "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db7C4C9db7C4",
    "contractAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "functionName": "transfer",
    "parameters": {
      "to": "0xabcdef1234567890abcdef1234567890abcdef12",
      "amount": "1000000000000000000"
    },
    "gasLimit": 21000,
    "gasPrice": "20000000000"
  }'
```

### 🏆 Gestão de Hackathons

#### Listar Hackathons
```bash
curl -X GET http://localhost:3000/api/v1/hackathons \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

#### Criar Hackathon (Admin)
```bash
curl -X POST http://localhost:3000/api/v1/hackathons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_JWT_ADMIN" \
  -d '{
    "title": "DeFi Innovation Challenge",
    "description": "Construa o futuro das finanças descentralizadas",
    "startDate": "2024-02-01T00:00:00Z",
    "endDate": "2024-02-03T23:59:59Z",
    "prize": "10 ETH",
    "maxParticipants": 100,
    "requirements": ["Smart Contract", "Frontend", "Documentation"]
  }'
```

## 🔍 Verificação de Status

### Health Check
```bash
curl -X GET http://localhost:3000/api/v1/smart-contract/health
```

### Status do Sistema
```bash
curl -X GET http://localhost:3000/api/v1/health
```

## 🧪 Testando com Postman

### 1. Importar Collection
Crie uma nova collection no Postman com as seguintes configurações:

**Base URL:** `http://localhost:3000/api/v1`

**Headers Globais:**
- `Content-Type: application/json`
- `Authorization: Bearer {{token}}` (para rotas protegidas)

### 2. Variáveis de Ambiente
```json
{
  "baseUrl": "http://localhost:3000/api/v1",
  "token": "",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db7C4C9db7C4"
}
```

## 🐛 Debugging e Logs

### Visualizar Logs
```bash
# Logs em tempo real
npm run dev

# Logs com mais detalhes
DEBUG=* npm run dev
```

### Testar Sintaxe
```bash
# Executar teste de sintaxe
node test-syntax.js
```

## 📊 Monitoramento

### Rate Limiting
O sistema implementa rate limiting:
- **Geral:** 100 requisições por 15 minutos
- **Login:** 5 tentativas por 15 minutos
- **Operações críticas:** 10 por hora

### Logs de Atividade
Todas as operações são logadas:
```javascript
// Exemplo de log
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Wallet connected successfully",
  "userId": "507f1f77bcf86cd799439011",
  "walletAddress": "0x742d35Cc6634C0532925a3b8D4C9db7C4C9db7C4",
  "ip": "192.168.1.100"
}
```

## 🔒 Segurança

### Headers de Segurança
O sistema usa Helmet.js para:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Referrer Policy

### Validação de Inputs
Todos os inputs são validados e sanitizados:
- Endereços de carteira
- Parâmetros de transação
- Dados de usuário

### Autenticação JWT
- Tokens expiram em 24 horas
- Refresh tokens disponíveis
- Middleware de proteção em todas as rotas sensíveis

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com MongoDB**
   ```bash
   # Verificar se MongoDB está rodando
   mongosh
   ```

2. **Token JWT inválido**
   ```bash
   # Fazer login novamente para obter novo token
   curl -X POST http://localhost:3000/api/v1/auth/login ...
   ```

3. **Rate limit excedido**
   ```bash
   # Aguardar 15 minutos ou usar IP diferente
   ```

4. **Endereço de carteira inválido**
   ```bash
   # Verificar formato: deve começar com 0x e ter 42 caracteres
   ```

### Logs de Erro
```bash
# Verificar logs de erro
tail -f logs/error.log

# Ou no console durante desenvolvimento
npm run dev
```

## 📚 Recursos Adicionais

- **Documentação completa:** `INSTRUCOES_EXECUCAO.md`
- **Demonstração visual:** `demo.html`
- **Testes:** `npm test`
- **Linting:** `npm run lint`

---

**💡 Dica:** Use a demonstração HTML (`demo.html`) para testar as funcionalidades sem precisar fazer requisições HTTP manuais!