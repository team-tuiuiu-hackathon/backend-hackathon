const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Backend Hackathon API',
      version: '1.0.0',
      description: 'API completa para sistema de hackathons com smart contracts',
      contact: {
        name: 'API Support',
        email: 'support@hackathon.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de Desenvolvimento'
      },
      {
        url: 'https://api.hackathon.com',
        description: 'Servidor de Produção'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            id: {
              type: 'string',
              description: 'ID único do usuário'
            },
            name: {
              type: 'string',
              description: 'Nome completo do usuário'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário'
            },
            password: {
              type: 'string',
              minLength: 8,
              description: 'Senha do usuário (mínimo 8 caracteres)'
            },
            passwordConfirm: {
              type: 'string',
              description: 'Confirmação da senha'
            },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'organizer'],
              default: 'user',
              description: 'Papel do usuário no sistema'
            },
            photo: {
              type: 'string',
              description: 'URL da foto do usuário'
            },
            active: {
              type: 'boolean',
              default: true,
              description: 'Status ativo do usuário'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            }
          }
        },
        Wallet: {
          type: 'object',
          required: ['address', 'network'],
          properties: {
            id: {
              type: 'string',
              description: 'ID único da carteira'
            },
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Endereço da carteira (formato Ethereum)'
            },
            network: {
              type: 'string',
              enum: ['ethereum', 'polygon', 'binance', 'avalanche'],
              description: 'Rede blockchain'
            },
            balance: {
              type: 'string',
              description: 'Wallet balance'
            },
            status: {
              type: 'string',
              enum: ['connected', 'disconnected'],
              default: 'connected',
              description: 'Connection status'
            },
            metadata: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Custom wallet name'
                },
                type: {
                  type: 'string',
                  description: 'Wallet type (MetaMask, WalletConnect, etc.)'
                }
              }
            },
            connectedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Connection date'
            }
          }
        },
        Transaction: {
          type: 'object',
          required: ['walletAddress', 'contractAddress', 'functionName'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique transaction ID'
            },
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Source wallet address'
            },
            contractAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Smart contract address'
            },
            functionName: {
              type: 'string',
              description: 'Contract function name'
            },
            parameters: {
              type: 'object',
              description: 'Function parameters'
            },
            gasLimit: {
              type: 'integer',
              minimum: 21000,
              description: 'Gas limit'
            },
            gasPrice: {
              type: 'string',
              description: 'Gas price in wei'
            },
            transactionHash: {
              type: 'string',
              description: 'Transaction hash'
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'failed'],
              description: 'Transaction status'
            },
            blockNumber: {
              type: 'integer',
              description: 'Block number'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction timestamp'
            }
          }
        },
        Hackathon: {
          type: 'object',
          required: ['title', 'description', 'startDate', 'endDate'],
          properties: {
            id: {
              type: 'string',
              description: 'Unique hackathon ID'
            },
            title: {
              type: 'string',
              description: 'Hackathon title'
            },
            description: {
              type: 'string',
              description: 'Detailed description'
            },
            startDate: {
              type: 'string',
              format: 'date-time',
              description: 'Start date'
            },
            endDate: {
              type: 'string',
              format: 'date-time',
              description: 'End date'
            },
            prize: {
              type: 'string',
              description: 'Hackathon prize'
            },
            maxParticipants: {
              type: 'integer',
              minimum: 1,
              description: 'Número máximo de participantes'
            },
            participants: {
              type: 'integer',
              description: 'Número atual de participantes'
            },
            status: {
              type: 'string',
              enum: ['upcoming', 'active', 'completed', 'cancelled'],
              description: 'Status do hackathon'
            },
            requirements: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Requisitos do hackathon'
            },
            organizer: {
              type: 'string',
              description: 'ID do organizador'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error'
            },
            error: {
              type: 'object',
              properties: {
                statusCode: {
                  type: 'integer'
                },
                status: {
                  type: 'string'
                },
                isOperational: {
                  type: 'boolean'
                },
                message: {
                  type: 'string'
                }
              }
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

const specs = swaggerJSDoc(options);

module.exports = {
  specs,
  swaggerUi
};