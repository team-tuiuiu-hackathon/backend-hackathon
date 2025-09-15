@echo off
echo Executando servidor no modo de demonstracao (sem banco de dados)...

set SKIP_DB=true
set PORT=3001

echo Iniciando o servidor na porta 3001...

if exist "%ProgramFiles%\nodejs\node.exe" (
    "%ProgramFiles%\nodejs\node.exe" src/server.js
) else if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    "%ProgramFiles(x86)%\nodejs\node.exe" src/server.js
) else (
    echo Node.js nao foi encontrado. Por favor, instale o Node.js e tente novamente.
    echo Visite: https://nodejs.org/
    pause
    exit /b 1
)

pause