# Mocks do Contrato Soroban Multisig

Este diretório contém mocks automatizados para simular as principais funcionalidades do contrato inteligente multisig implementado na rede Stellar Soroban.

## 📁 Estrutura dos Arquivos

```
tests/mocks/
├── sorobanContractMocks.json      # Dados de mock em formato JSON
├── sorobanContractMocks.test.js   # Testes Jest com mocks implementados
└── README.md                      # Esta documentação
```

## 🎯 Funcionalidades Cobertas

### 1. **Inicialização e Configuração**
- `initializeContract()` - Inicialização do contrato
- `createMultisigWallet()` - Criação de carteira multisig

### 2. **Atualização de Estado**
- `proposeTransaction()` - Proposta de transação
- `signTransaction()` - Assinatura de transação
- `executeTransaction()` - Execução de transação aprovada
- `processDeposit()` - Processamento de depósito USDC
- `processPayment()` - Processamento de pagamento USDC

### 3. **Leitura de Estado**
- `getWalletBalance()` - Consulta de saldo da carteira
- `getSignatureCount()` - Número de assinaturas de uma transação
- `getTransactionDetails()` - Detalhes de uma transação
- `getNetworkStatus()` - Status da rede Soroban

### 4. **Validação**
- `validateUSDCDeposit()` - Validação de depósito USDC

## 🚀 Como Usar

### Usando os Mocks JSON

```javascript
const mockData = require('./mocks/sorobanContractMocks.json');

// Exemplo: Mock de criação de carteira
const walletInput = mockData.initializationMocks.createMultisigWallet.input;
const expectedOutput = mockData.initializationMocks.createMultisigWallet.output;

// Usar em seus testes
const mockCreateWallet = jest.fn().mockResolvedValue(expectedOutput);
```

### Usando a Classe Mock

```javascript
const { SorobanServiceMock } = require('./mocks/sorobanContractMocks.test.js');

// Instanciar o mock
const sorobanMock = new SorobanServiceMock();

// Usar nos testes
describe('Meu Teste', () => {
  test('deve criar carteira multisig', async () => {
    const result = await sorobanMock.createMultisigWallet({
      owners: [
        { publicKey: 'GABC123...' },
        { publicKey: 'GDEF456...' }
      ],
      threshold: 2,
      name: 'Minha Carteira'
    });
    
    expect(result.success).toBe(true);
    expect(result.walletId).toBeDefined();
  });
});
```

### Executando os Testes

```bash
# Executar todos os testes de mock
npm test -- tests/mocks/sorobanContractMocks.test.js

# Executar com coverage
npm test -- --coverage tests/mocks/sorobanContractMocks.test.js

# Executar em modo watch
npm test -- --watch tests/mocks/sorobanContractMocks.test.js
```

## 📊 Variáveis Genéricas

O arquivo JSON inclui variáveis genéricas que podem ser reutilizadas:

```json
{
  "genericVariables": {
    "n_integrantes": 3,
    "saldo_atual": 1250.50,
    "percentual_divisao": 33.33,
    "threshold_minimo": 2,
    "taxa_transacao": 100,
    "tempo_expiracao": 30,
    "confirmacoes_minimas": 1
  }
}
```

## 🧪 Cenários de Teste

### Cenário 1: Fluxo Completo de Sucesso
1. Inicializar contrato
2. Criar carteira multisig
3. Processar depósito
4. Propor transação
5. Assinar transação
6. Executar transação

### Cenário 2: Falha por Threshold Insuficiente
1. Criar carteira com threshold = 2
2. Propor transação
3. Assinar apenas 1 vez
4. Tentar executar (deve falhar)

### Cenário 3: Falha por Saldo Insuficiente
1. Criar carteira
2. Tentar pagamento > saldo disponível
3. Deve retornar erro

## 🔧 Personalização

### Adicionando Novos Mocks

1. **No arquivo JSON**: Adicione novos objetos seguindo a estrutura existente
2. **No arquivo de teste**: Implemente os testes correspondentes
3. **Na classe Mock**: Adicione os métodos correspondentes

### Exemplo de Novo Mock

```json
{
  "novaFuncionalidade": {
    "description": "Descrição da nova funcionalidade",
    "input": {
      "parametro1": "valor1",
      "parametro2": "valor2"
    },
    "output": {
      "success": true,
      "resultado": "valor_resultado"
    },
    "errors": [
      {
        "condition": "condição de erro",
        "error": "mensagem de erro"
      }
    ]
  }
}
```

## 🛡️ Tratamento de Erros

Todos os mocks incluem tratamento de erros para cenários comuns:

- **Endereços inválidos**
- **Parâmetros faltando**
- **Saldos insuficientes**
- **Assinaturas insuficientes**
- **Transações não encontradas**
- **Problemas de rede**

## 📈 Métricas e Validações

Os mocks incluem validações para:

- ✅ Formatos de endereço Stellar
- ✅ Valores monetários positivos
- ✅ Thresholds válidos
- ✅ Contagem de assinaturas
- ✅ Status de transações
- ✅ Confirmações de blockchain

## 🔍 Debugging

Para debugar os mocks:

```javascript
// Habilitar logs detalhados
const mockWithLogs = jest.fn().mockImplementation((input) => {
  console.log('Mock chamado com:', input);
  return mockData.expectedOutput;
});

// Verificar chamadas
expect(mockWithLogs).toHaveBeenCalledTimes(1);
expect(mockWithLogs).toHaveBeenCalledWith(expectedInput);
```

## 📚 Referências

- [Documentação Stellar](https://developers.stellar.org/)
- [Soroban Smart Contracts](https://soroban.stellar.org/)
- [Jest Testing Framework](https://jestjs.io/)
- [Multisig Wallet Patterns](https://github.com/stellar/soroban-examples)

## 🤝 Contribuindo

Para contribuir com novos mocks:

1. Analise o contrato real no arquivo `src/services/sorobanService.js`
2. Identifique novos métodos ou cenários
3. Adicione os mocks no formato JSON
4. Implemente os testes correspondentes
5. Atualize esta documentação

## 📝 Notas Importantes

- **Consistência**: Os mocks refletem as regras de negócio do contrato real
- **Realismo**: Valores e comportamentos são baseados em cenários reais
- **Manutenibilidade**: Estrutura organizada para fácil manutenção
- **Cobertura**: Todos os métodos públicos estão cobertos
- **Documentação**: Cada mock está documentado com propósito e uso

---

**Última atualização**: Janeiro 2024  
**Versão dos Mocks**: 1.0.0  
**Compatibilidade**: Soroban Testnet