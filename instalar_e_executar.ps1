# Script para instalar Node.js e executar o projeto

# Verificar se o Chocolatey está instalado
if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
    Write-Host "Instalando Chocolatey..."
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
}

# Instalar Node.js
Write-Host "Instalando Node.js..."
choco install nodejs-lts -y

# Recarregar o PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Verificar a instalação
Write-Host "Verificando a instalação do Node.js..."
node --version
npm --version

# Navegar para a pasta do projeto
Set-Location -Path $PSScriptRoot

# Instalar dependências
Write-Host "Instalando dependências do projeto..."
npm install

# Iniciar o servidor
Write-Host "Iniciando o servidor..."
npm start