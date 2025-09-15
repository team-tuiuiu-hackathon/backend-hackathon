# Rotas de Demonstração do Backend Hackathon

Este documento descreve as rotas de demonstração disponíveis quando o servidor é executado no modo de demonstração (sem banco de dados).

## Como acessar

O servidor está rodando na porta 3001. Você pode acessar as rotas usando:

```
http://localhost:3001/api/v1/...
```

## Rotas disponíveis

### Rota principal

- **GET /** - Verifica se a API está funcionando
  - Exemplo: `http://localhost:3001/`
  - Resposta: `{"status":"success","message":"API Backend Hackathon funcionando!"}`

### Hackathons

- **GET /api/v1/demo/hackathons** - Lista todos os hackathons de demonstração
  - Exemplo: `http://localhost:3001/api/v1/demo/hackathons`

- **GET /api/v1/demo/hackathons/:id** - Obtém detalhes de um hackathon específico
  - Exemplo: `http://localhost:3001/api/v1/demo/hackathons/1`
  - Exemplo: `http://localhost:3001/api/v1/demo/hackathons/2`

### Usuários

- **GET /api/v1/demo/users** - Lista todos os usuários de demonstração
  - Exemplo: `http://localhost:3001/api/v1/demo/users`

### Autenticação

- **POST /api/v1/demo/login** - Simula o login de um usuário
  - Exemplo: `http://localhost:3001/api/v1/demo/login`
  - Corpo da requisição: `{"email":"demo@example.com","password":"senha123"}`

## Como testar

Você pode testar estas rotas usando:

1. Um navegador web (para requisições GET)
2. Ferramentas como Postman ou Insomnia
3. Linha de comando com curl:

```bash
# Exemplo para listar hackathons
curl http://localhost:3001/api/v1/demo/hackathons

# Exemplo para login
curl -X POST http://localhost:3001/api/v1/demo/login -H "Content-Type: application/json" -d "{\"email\":\"demo@example.com\",\"password\":\"senha123\"}"
```

## Observações

- Estas rotas são apenas para demonstração e teste
- Os dados são estáticos e não persistem
- Para usar o sistema completo com banco de dados, consulte o arquivo INSTALACAO.md