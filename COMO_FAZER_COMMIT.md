# Como Fazer Commit e Push das Alterações

Para enviar as alterações realizadas para o repositório remoto, siga os passos abaixo:

## Pré-requisitos

1. Ter o Git instalado no seu computador
   - Se não tiver instalado, baixe em: https://git-scm.com/downloads
   - Durante a instalação, selecione a opção para adicionar o Git ao PATH

## Passos para Commit e Push

1. **Abra um terminal Git Bash, PowerShell ou CMD**

2. **Navegue até a pasta do projeto**
   ```
   cd "C:\Users\GPOLL\OneDrive\Documentos\GitHub\backend-hackathon"
   ```

3. **Verifique o status das alterações**
   ```
   git status
   ```
   Este comando mostrará todos os arquivos modificados, adicionados ou removidos.

4. **Adicione todas as alterações ao stage**
   ```
   git add .
   ```
   Ou para adicionar arquivos específicos:
   ```
   git add nome_do_arquivo
   ```

5. **Faça o commit das alterações**
   ```
   git commit -m "Limpeza do projeto para commit e push"
   ```
   Substitua a mensagem entre aspas por uma descrição clara das alterações realizadas.

6. **Envie as alterações para o repositório remoto**
   ```
   git push origin main
   ```
   Se estiver usando outra branch, substitua "main" pelo nome da sua branch.

## Resumo das Alterações Realizadas

As principais alterações que foram feitas neste projeto são:

1. **Limpeza do código**:
   - Restauração do `src/server.js` para configuração original (porta 3000)
   - Remoção das rotas de demonstração em `src/app.js`
   - Restauração do `src/config/database.js` para encerrar o processo em caso de erro de conexão

2. **Atualização da documentação**:
   - Atualização do README.md com instruções para configuração do MongoDB
   - Atualização do arquivo .env.example com comentários sobre a variável SKIP_DB

3. **Configuração do .gitignore**:
   - Adição de arquivos temporários ao .gitignore
   - Inclusão de scripts de demonstração e documentação temporária

## Observações

- Se for a primeira vez que você usa o Git neste computador, pode ser necessário configurar seu nome de usuário e email:
  ```
  git config --global user.name "Seu Nome"
  git config --global user.email "seu.email@exemplo.com"
  ```

- Se o repositório remoto exigir autenticação, você precisará fornecer suas credenciais do GitHub ou usar um token de acesso pessoal.