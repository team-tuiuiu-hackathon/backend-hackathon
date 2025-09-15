# Smart Contract Integration

This document describes the smart contract integration implemented in the hackathon system.

## Overview

The smart contract functionality allows:
- Wallet connection and management
- Secure transaction execution
- Connection status monitoring
- Data validation and sanitization

## Architecture

### Main Components

1. **Wallet Model** (`src/models/walletModel.js`)
   - Model to represent connected wallets
   - Ethereum address validation
   - Connection status management

2. **Smart Contract Controller** (`src/controllers/smartContractController.js`)
   - Business logic for smart contract operations
   - Wallet management
   - Transaction execution

3. **Smart Contract Routes** (`src/routes/smartContractRoutes.js`)
   - REST endpoints for smart contract interaction
   - Input validation
   - Rate limiting

4. **Smart Contract Middleware** (`src/middleware/smartContractMiddleware.js`)
   - Data sanitization
   - Wallet validation
   - Activity logging
   - Integrity verification

## API Endpoints

### Connect Wallet
```http
POST /api/v1/smart-contract/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "address": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8",
  "metadata": {
    "name": "My Wallet",
    "type": "MetaMask"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet connected successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "address": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8",
    "balance": "1.5 ETH",
    "status": "connected",
    "connectedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Disconnect Wallet
```http
DELETE /api/v1/smart-contract/disconnect/:walletId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet disconnected successfully"
}
```

### List Connected Wallets
```http
GET /api/v1/smart-contract/wallets?status=connected&page=1&limit=10
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Wallets retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "address": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8",
      "balance": "1.5 ETH",
      "status": "connected",
      "metadata": {
        "name": "My Wallet",
        "type": "MetaMask"
      },
      "connectedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1
  }
}
```

### Get Specific Wallet
```http
GET /api/v1/smart-contract/wallets/:walletId
Authorization: Bearer <token>
```

### Execute Transaction
```http
POST /api/v1/smart-contract/transaction
Authorization: Bearer <token>
Content-Type: application/json

{
  "walletId": "550e8400-e29b-41d4-a716-446655440000",
  "contractMethod": "transfer",
  "parameters": [
    "0x8ba1f109551bD432803012645Hac136c9c8c8c8",
    "100"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transaction executed successfully",
  "data": {
    "transactionHash": "0x1234567890abcdef...",
    "status": "pending",
    "gasUsed": "21000",
    "method": "transfer"
  }
}
```

### Health Check
```http
GET /api/v1/smart-contract/health
```

**Response:**
```json
{
  "success": true,
  "message": "Smart contract service operational",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## Security Features

### Rate Limiting
- **Smart Contract Operations**: 10 requests per 15 minutes
- **Transactions**: 5 requests per 15 minutes
- **General Endpoints**: 100 requests per 15 minutes

### Input Validation
- Ethereum address format validation
- Parameter type checking
- Required field validation
- Data sanitization

### Authentication
- JWT token required for all operations
- User-specific wallet access
- Role-based permissions

### Logging
- All operations are logged
- Security events tracking
- Error monitoring
- Performance metrics

## Error Handling

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| WALLET_NOT_FOUND | Wallet not found | 404 |
| INVALID_ADDRESS | Invalid Ethereum address | 400 |
| INSUFFICIENT_FUNDS | Insufficient wallet funds | 400 |
| GAS_LIMIT_EXCEEDED | Gas limit exceeded | 400 |
| INVALID_NONCE | Transaction sequence error | 400 |
| TRANSACTION_REVERTED | Transaction reverted by contract | 400 |
| RATE_LIMIT_EXCEEDED | Too many requests | 429 |
| UNAUTHORIZED | Invalid or missing token | 401 |
| INTERNAL_ERROR | Internal server error | 500 |

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Testing

### Unit Tests
Run the smart contract tests:
```bash
npm test -- --grep "Smart Contract"
```

### Test Coverage
- Wallet connection/disconnection
- Transaction execution
- Input validation
- Error handling
- Rate limiting
- Authentication

### Test Data
The tests use mock data and don't interact with real blockchain networks.

## Configuration

### Environment Variables
```env
# Smart Contract Configuration
SMART_CONTRACT_ENABLED=true
ETHEREUM_NETWORK=mainnet
INFURA_PROJECT_ID=your_infura_project_id

# Rate Limiting
SMART_CONTRACT_RATE_LIMIT=10
TRANSACTION_RATE_LIMIT=5
RATE_LIMIT_WINDOW=900000

# Security
WALLET_VALIDATION_ENABLED=true
TRANSACTION_LOGGING_ENABLED=true
```

### Database Schema

#### Wallet Collection
```javascript
{
  _id: ObjectId,
  id: String, // UUID
  userId: ObjectId, // Reference to User
  address: String, // Ethereum address
  balance: String,
  status: String, // 'connected' | 'disconnected'
  metadata: {
    name: String,
    type: String
  },
  connectedAt: Date,
  disconnectedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Monitoring and Maintenance

### Health Monitoring
- Service availability check
- Database connectivity
- External API status
- Performance metrics

### Logs
- Connection events
- Transaction attempts
- Security violations
- Error occurrences

### Maintenance Tasks
- Clean up disconnected wallets
- Archive old transactions
- Update rate limits
- Security audits

## Future Enhancements

1. **Multi-chain Support**
   - Polygon integration
   - Binance Smart Chain
   - Arbitrum support

2. **Advanced Features**
   - Multi-signature wallets
   - Token swaps
   - NFT support

3. **Enhanced Security**
   - Hardware wallet support
   - Advanced fraud detection
   - Audit trails

4. **Advanced Monitoring**
   - Real-time dashboards
   - Automated alerts
   - Performance analysis

## Support

For questions or issues:
1. Check the application logs
2. Verify environment variable configuration
3. Run tests to validate functionality
4. Consult the API documentation

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Submit pull requests for review

## License

This project is licensed under the MIT License - see the LICENSE file for details.