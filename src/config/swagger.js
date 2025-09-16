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