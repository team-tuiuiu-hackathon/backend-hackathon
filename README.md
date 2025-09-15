# Backend Hackathon

API RESTful desenvolvida em Node.js para gerenciamento de hackathons.

## Tecnologias Utilizadas

- Node.js
- Express
- MongoDB com Mongoose
- JWT para autenticação
- bcryptjs para criptografia

## Estrutura do Projeto

```
├── src/
│   ├── config/         # Configurações do projeto
│   ├── controllers/    # Controladores da aplicação
│   ├── middleware/     # Middlewares personalizados
│   ├── models/         # Modelos do banco de dados
│   ├── routes/         # Rotas da API
│   ├── app.js          # Configuração do Express
│   └── server.js       # Ponto de entrada da aplicação
├── .env                # Variáveis de ambiente
├── .env.example        # Exemplo de variáveis de ambiente
├── .gitignore          # Arquivos ignorados pelo Git
├── package.json        # Dependências e scripts
└── README.md           # Documentação do projeto
```

## Funcionalidades

### Autenticação
- Registro de usuários
- Login com JWT
- Proteção de rotas
- Controle de acesso baseado em funções

### Usuários
- CRUD completo de usuários
- Atualização de perfil
- Alteração de senha

### Hackathons
- CRUD completo de hackathons
- Registro de participantes
- Criação de equipes
- Gerenciamento de projetos

## Como Executar

1. Clone o repositório
   ```bash
   git clone https://github.com/seu-usuario/backend-hackathon.git
   cd backend-hackathon
   ```

2. Instale as dependências
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente
   ```bash
   cp .env.example .env
   # Edite o arquivo .env com suas configurações
   ```

4. Inicie o servidor
   ```bash
   # Modo de desenvolvimento
   npm run dev
   
   # Modo de produção
   npm start
   ```

## API Endpoints

### Autenticação
- `POST /api/v1/auth/signup` - Registrar um novo usuário
- `POST /api/v1/auth/login` - Fazer login
- `PATCH /api/v1/auth/updateMyPassword` - Atualizar senha

### Usuários
- `GET /api/v1/users` - Listar todos os usuários (admin)
- `GET /api/v1/users/:id` - Obter um usuário específico (admin)
- `PATCH /api/v1/users/updateMe` - Atualizar perfil do usuário atual
- `DELETE /api/v1/users/deleteMe` - Desativar conta do usuário atual

### Hackathons
- `GET /api/v1/hackathons` - Listar todos os hackathons
- `GET /api/v1/hackathons/:id` - Obter um hackathon específico
- `POST /api/v1/hackathons` - Criar um novo hackathon
- `PATCH /api/v1/hackathons/:id` - Atualizar um hackathon
- `DELETE /api/v1/hackathons/:id` - Excluir um hackathon
- `POST /api/v1/hackathons/:id/register` - Registrar-se em um hackathon
- `POST /api/v1/hackathons/:id/teams` - Criar uma equipe em um hackathon