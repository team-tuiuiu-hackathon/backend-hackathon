# Guia de Instalação e Execução

## Pré-requisitos

- Node.js (versão 14 ou superior)
- MongoDB (local ou remoto)

## Instalação do Node.js

### Windows

1. Acesse [nodejs.org](https://nodejs.org/)
2. Baixe a versão LTS (recomendada)
3. Execute o instalador e siga as instruções
4. Certifique-se de marcar a opção para adicionar o Node.js ao PATH do sistema
5. Verifique a instalação abrindo um novo prompt de comando e digitando:
   ```
   node --version
   npm --version
   ```

### Usando Chocolatey (alternativa para Windows)

1. Instale o Chocolatey seguindo as instruções em [chocolatey.org](https://chocolatey.org/install)
2. Abra um PowerShell como administrador e execute:
   ```
   choco install nodejs-lts -y
   ```

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### macOS

```bash
brew install node
```

## Instalação do MongoDB

### Windows

1. Acesse [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community)
2. Baixe e instale o MongoDB Community Server
3. Siga as instruções do instalador

### Usando MongoDB Atlas (alternativa na nuvem)

1. Crie uma conta em [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Crie um cluster gratuito
3. Configure o acesso ao banco de dados
4. Obtenha a string de conexão e atualize o arquivo .env

## Configuração do Projeto

1. Clone o repositório (se ainda não o fez)
2. Navegue até a pasta do projeto
3. Crie um arquivo `.env` baseado no `.env.example`:
   ```
   # Configurações do Servidor
   PORT=3000
   NODE_ENV=development
   
   # Configurações do Banco de Dados
   MONGODB_URI=mongodb://localhost:27017/hackathon
   
   # Configurações de JWT
   JWT_SECRET=sua_chave_secreta_aqui
   JWT_EXPIRES_IN=90d
   
   # Outras configurações
   API_PREFIX=/api/v1
   ```
4. Instale as dependências:
   ```
   npm install
   ```

## Execução do Projeto

### Desenvolvimento

```
npm run dev
```

### Produção

```
npm start
```

### Testes

```
npm test
```

## Scripts de Instalação Automática

Este projeto inclui scripts para facilitar a instalação e execução:

- `instalar_e_executar.ps1`: Script PowerShell para Windows
- `instalar_e_executar.bat`: Script Batch para Windows

Para executar o script PowerShell:
1. Abra o PowerShell como administrador
2. Execute: `Set-ExecutionPolicy RemoteSigned` (se necessário)
3. Navegue até a pasta do projeto
4. Execute: `./instalar_e_executar.ps1`

Para executar o script Batch:
1. Navegue até a pasta do projeto no Explorer
2. Clique duas vezes em `instalar_e_executar.bat`

## Solução de Problemas

### Erro de conexão com o MongoDB

- Verifique se o MongoDB está em execução
- Verifique a string de conexão no arquivo `.env`
- Se estiver usando MongoDB Atlas, verifique se o IP está na lista de permissões

### Erro ao iniciar o servidor

- Verifique se a porta especificada (padrão: 3000) está disponível
- Verifique se todas as variáveis de ambiente necessárias estão configuradas

### Erro ao instalar dependências

- Verifique se o Node.js está instalado corretamente
- Tente limpar o cache do npm: `npm cache clean --force`
- Tente remover a pasta `node_modules` e o arquivo `package-lock.json` e execute `npm install` novamente