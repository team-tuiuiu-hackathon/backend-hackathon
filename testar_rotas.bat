@echo off
echo Testando rotas de demonstracao do Backend Hackathon
echo.

echo 1. Testando rota principal...
curl -s http://localhost:3001/
echo.
echo.

echo 2. Testando lista de hackathons...
curl -s http://localhost:3001/api/v1/demo/hackathons
echo.
echo.

echo 3. Testando detalhes do hackathon 1...
curl -s http://localhost:3001/api/v1/demo/hackathons/1
echo.
echo.

echo 4. Testando lista de usuarios...
curl -s http://localhost:3001/api/v1/demo/users
echo.
echo.

echo 5. Testando login...
curl -s -X POST http://localhost:3001/api/v1/demo/login -H "Content-Type: application/json" -d "{\"email\":\"demo@example.com\",\"password\":\"senha123\"}"
echo.
echo.

echo Testes concluidos!
echo Consulte o arquivo DEMO_ROTAS.md para mais informacoes sobre as rotas disponiveis.

pause