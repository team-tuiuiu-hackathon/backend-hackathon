// Script para executar o servidor sem MongoDB externo
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Verifica se o package.json existe
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('Arquivo package.json não encontrado!');
  process.exit(1);
}

// Lê o package.json
const packageJson = require(packageJsonPath);

// Adiciona mongodb-memory-server às devDependencies se não existir
if (!packageJson.devDependencies['mongodb-memory-server']) {
  console.log('Instalando mongodb-memory-server...');
  
  // Executa npm install
  const npmInstall = spawn('npm', ['install', 'mongodb-memory-server', '--save-dev'], {
    stdio: 'inherit',
    shell: true
  });
  
  npmInstall.on('close', (code) => {
    if (code !== 0) {
      console.error(`Erro ao instalar mongodb-memory-server. Código de saída: ${code}`);
      process.exit(1);
    }
    
    console.log('mongodb-memory-server instalado com sucesso!');
    startServer();
  });
} else {
  startServer();
}

function startServer() {
  console.log('Iniciando servidor com banco de dados em memória...');
  
  // Define a variável de ambiente para usar o banco de dados em memória
  process.env.USE_MEMORY_DB = 'true';
  
  // Executa o servidor
  const server = spawn('node', ['src/server.js'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, USE_MEMORY_DB: 'true' }
  });
  
  server.on('close', (code) => {
    console.log(`Servidor encerrado com código: ${code}`);
  });
}