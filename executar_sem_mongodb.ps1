# Script para executar o servidor sem MongoDB externo

# Verificar se o Node.js está instalado
try {
    $nodeVersion = node --version
    Write-Host "Node.js encontrado: $nodeVersion"
} catch {
    Write-Host "Node.js não está instalado ou não está no PATH."
    Write-Host "Tentando encontrar a instalação..."
    
    # Locais comuns de instalação do Node.js
    $possiblePaths = @(
        "C:\Program Files\nodejs\",
        "C:\Program Files (x86)\nodejs\",
        "$env:APPDATA\npm",
        "$env:USERPROFILE\AppData\Roaming\npm",
        "$env:USERPROFILE\scoop\apps\nodejs\current",
        "$env:USERPROFILE\scoop\shims"
    )
    
    $nodeFound = $false
    foreach ($path in $possiblePaths) {
        if (Test-Path "$path\node.exe") {
            Write-Host "Encontrado Node.js em: $path"
            $env:Path = "$path;$env:Path"
            $nodeFound = $true
            break
        }
    }
    
    if (-not $nodeFound) {
        Write-Host "Node.js não foi encontrado. Por favor, instale o Node.js e tente novamente."
        Write-Host "Visite: https://nodejs.org/"
        Read-Host "Pressione ENTER para sair"
        exit 1
    }
}

# Definir variável de ambiente para usar banco de dados em memória
$env:USE_MEMORY_DB = "true"

Write-Host "Iniciando o servidor sem MongoDB..."

# Executar o servidor
try {
    node src/server.js
} catch {
    Write-Host "Erro ao executar o servidor: $_"
    Read-Host "Pressione ENTER para sair"
    exit 1
}