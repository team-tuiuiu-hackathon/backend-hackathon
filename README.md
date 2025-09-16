# Backend – Zelo Platform

API RESTful desenvolvida em **Node.js + Express** para gestão financeira transparente e segura em condomínios.
O backend dá suporte à plataforma **Zelo**, que resolve os principais problemas de administração condominial com carteiras multisig, divisão automática de despesas e registros auditáveis on-chain.

---

## 🚨 Problema

A gestão financeira de condomínios é complexa:

* Síndicos e administradores têm dificuldade em gerenciar recursos coletivos.
* Falta de transparência gera desconfiança e conflitos entre moradores.
* Aprovações de pagamentos são burocráticas e pouco participativas.
* Divisão de despesas é manual e sujeita a erros.

Impacto:

* **+500 mil condomínios** no Brasil (residenciais e comerciais).
* **+30 milhões de moradores** afetados.
* **R\$165 bilhões/ano** em fluxo de receita condominial (\~US\$32B).

---

## 💡 Solução – Zelo

Uma API que conecta condomínio, síndico e conselho em um modelo **seguro, transparente e colaborativo**:

* **Carteiras Multisig** → pagamentos aprovados conjuntamente pelo síndico e conselho.
* **Divisão automática de despesas** → proporcional (percentual) ou fixa.
* **Transações em USDC** → dólar digital estável, baixo risco de volatilidade.
* **Governança on-chain** → registros imutáveis, auditáveis e com recuperação de acesso segura.

---

## ⚙️ Tecnologias Utilizadas

* **Backend**: Node.js, Express, PostgreSQL
* **Autenticação**: JWT, controle de acesso baseado em papéis
* **Segurança**: bcryptjs, helmet, express-rate-limit, express-validator, OWASP best practices
* **Identificação**: uuid
* **Blockchain**: Stellar (StellarSDK, StellarExpert, StellarLab, StellarWalletKit, Soroban smart contracts)
* **Stablecoin**: USDC para transações estáveis
* **AI Tools**: TRAE, Cursor, ChatGPT, Gemini, Deepseek

---

## 📂 Estrutura do Projeto

```
├── src/
│   ├── config/         # Configurações do projeto
│   ├── controllers/    # Lógica dos endpoints
│   ├── middleware/     # Middlewares customizados
│   ├── models/         # Modelos do banco de dados
│   ├── routes/         # Rotas da API
│   ├── app.js          # Configuração do Express
│   └── server.js       # Ponto de entrada da aplicação
├── .env                # Variáveis de ambiente
├── .env.example        # Exemplo de variáveis
├── package.json        # Dependências e scripts
└── README.md           # Documentação
```

---

## 🚀 Funcionalidades

### Autenticação

* Registro de usuários
* Login com JWT
* Proteção de rotas
* RBAC (Role-Based Access Control)

### Usuários

* CRUD completo
* Atualização de perfil
* Alteração de senha

### Condomínios

* Criação e gestão de carteiras multisig
* Aprovação de pagamentos colaborativa
* Rateio automático de despesas
* Logs e governança on-chain

---

## ▶️ Como Rodar

1. Clone o repositório

   ```bash
   git clone https://github.com/your-username/zelo-backend.git
   cd zelo-backend
   ```

2. Instale as dependências

   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente

   ```bash
   cp .env.example .env
   # Edite com suas configurações
   ```

4. Configure o banco de dados PostgreSQL e ajuste a conexão no `.env`

5. Inicie o servidor

   ```bash
   # Modo desenvolvimento
   npm run dev

   # Modo produção
   npm start
   ```

---

## 🌐 Endpoints Principais

### Autenticação

* `POST /api/v1/auth/signup` → Criar usuário
* `POST /api/v1/auth/login` → Login
* `PATCH /api/v1/auth/updateMyPassword` → Alterar senha

### Condomínios

* `POST /api/v1/condos` → Criar condomínio
* `POST /api/v1/condos/:id/wallet` → Criar carteira multisig
* `POST /api/v1/condos/:id/expenses` → Registrar despesa
* `PATCH /api/v1/condos/:id/approve` → Aprovar pagamento
