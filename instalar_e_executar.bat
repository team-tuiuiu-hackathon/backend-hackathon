@echo off
echo Instalando Node.js e executando o projeto

:: Verificar se o Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js não está instalado. Por favor, siga estas instruções:
    echo 1. Acesse https://nodejs.org/
    echo 2. Baixe a versão LTS (recomendada)
    echo 3. Execute o instalador e siga as instruções
    echo 4. Certifique-se de marcar a opção para adicionar o Node.js ao PATH do sistema
    echo 5. Após a instalação, feche este prompt e execute este script novamente
    pause
    exit /b
)

:: Verificar a instalação
echo Verificando a instalação do Node.js...
node --version
npm --version

:: Instalar dependências
echo Instalando dependências do projeto...
npm install

:: Iniciar o servidor
echo Iniciando o servidor...
npm start

pause