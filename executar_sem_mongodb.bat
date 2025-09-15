@echo off
echo Executando servidor sem MongoDB externo...

:: Verificar se o Node.js está no PATH
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js não está no PATH. Tentando encontrar a instalação...
    
    :: Locais comuns de instalação do Node.js
    set POSSIBLE_NODE_PATHS=^
    C:\Program Files\nodejs\;^
    C:\Program Files (x86)\nodejs\;^
    %APPDATA%\npm;^
    %USERPROFILE%\AppData\Roaming\npm;^
    %USERPROFILE%\scoop\apps\nodejs\current;^
    %USERPROFILE%\scoop\shims
    
    :: Adicionar possíveis caminhos ao PATH
    for %%p in (%POSSIBLE_NODE_PATHS%) do (
        if exist "%%p\node.exe" (
            echo Encontrado Node.js em: %%p
            set "PATH=%%p;%PATH%"
            goto :node_found
        )
    )
    
    echo Node.js não foi encontrado. Por favor, instale o Node.js e tente novamente.
    echo Visite: https://nodejs.org/
    pause
    exit /b 1
)

:node_found
echo Usando Node.js em:
where node

set USE_MEMORY_DB=true

echo Iniciando o servidor...
node src/server.js

pause