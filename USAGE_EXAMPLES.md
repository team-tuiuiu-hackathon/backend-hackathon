# 🚀 Usage Examples - Smart Contract System

## 📋 Prerequisites

Before running the examples, make sure that:

1. **Node.js is installed** (version 14 or higher)
2. **MongoDB is running** (local or Atlas)
3. **Dependencies installed**: `npm install`
4. **Server started**: `npm run dev`

## 🔧 Initial Setup

### 1. Install Node.js
```bash
# Download and install from official site: https://nodejs.org/
# Or use Chocolatey on Windows:
choco install nodejs

# Verify installation
node --version
npm --version
```

### 2. Install Dependencies
```bash
cd backend-hackathon
npm install
```

### 3. Configure Environment Variables
```bash
# Copy the example file
copy .env.example .env

# Edit the .env file with your configurations
```

### 4. Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🧪 Request Examples

### 🔐 Authentication

#### Register New User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securePassword123",
    "role": "participant"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "participant"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### User Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securePassword123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "participant"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 👥 User Management

#### Get User Profile
```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Update User Profile
```bash
curl -X PUT http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "bio": "Full-stack developer passionate about blockchain"
  }'
```

#### List All Users (Admin only)
```bash
curl -X GET "http://localhost:3000/api/v1/users?page=1&limit=10" \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

### 🏆 Hackathon Management

#### Create New Hackathon (Organizer only)
```bash
curl -X POST http://localhost:3000/api/v1/hackathons \
  -H "Authorization: Bearer ORGANIZER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Blockchain Innovation Challenge",
    "description": "Build the next generation of DeFi applications",
    "startDate": "2024-03-01T09:00:00.000Z",
    "endDate": "2024-03-03T18:00:00.000Z",
    "prize": "$10,000 in ETH",
    "maxParticipants": 100
  }'
```

#### List All Hackathons
```bash
curl -X GET "http://localhost:3000/api/v1/hackathons?page=1&limit=10&status=active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Get Specific Hackathon
```bash
curl -X GET http://localhost:3000/api/v1/hackathons/HACKATHON_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Join Hackathon
```bash
curl -X POST http://localhost:3000/api/v1/hackathons/HACKATHON_ID/join \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teamName": "Blockchain Innovators",
    "projectIdea": "A decentralized marketplace for digital assets"
  }'
```

### 💰 Smart Contract Operations

#### Connect Wallet
```bash
curl -X POST http://localhost:3000/api/v1/smart-contract/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b8D0C9C0E3C5d8c8c8",
    "metadata": {
      "name": "My MetaMask Wallet",
      "type": "MetaMask"
    }
  }'
```

**Expected Response:**
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

#### List Connected Wallets
```bash
curl -X GET "http://localhost:3000/api/v1/smart-contract/wallets?status=connected" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Execute Transaction
```bash
curl -X POST http://localhost:3000/api/v1/smart-contract/transaction \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "550e8400-e29b-41d4-a716-446655440000",
    "contractMethod": "transfer",
    "parameters": [
      "0x8ba1f109551bD432803012645Hac136c9c8c8c8",
      "100"
    ]
  }'
```

#### Disconnect Wallet
```bash
curl -X DELETE http://localhost:3000/api/v1/smart-contract/disconnect/WALLET_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 🔍 Health Check

#### API Health Check
```bash
curl -X GET http://localhost:3000/api/v1/health
```

#### Smart Contract Service Health
```bash
curl -X GET http://localhost:3000/api/v1/smart-contract/health
```

## 🧪 Testing with Postman

### Import Collection
1. Open Postman
2. Click "Import"
3. Create a new collection with the endpoints above
4. Set up environment variables:
   - `baseUrl`: `http://localhost:3000`
   - `token`: Your JWT token

### Environment Variables
```json
{
  "baseUrl": "http://localhost:3000",
  "token": "{{token}}",
  "userId": "{{userId}}",
  "hackathonId": "{{hackathonId}}",
  "walletId": "{{walletId}}"
}
```

## 🐛 Error Handling Examples

### Invalid Authentication
```bash
curl -X GET http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer invalid_token"
```

**Response:**
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "code": "UNAUTHORIZED",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Validation Error
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "email": "invalid-email",
    "password": "123"
  }'
```

**Response:**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name is required"
    },
    {
      "field": "email",
      "message": "Please provide a valid email"
    },
    {
      "field": "password",
      "message": "Password must be at least 6 characters"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 📊 Rate Limiting

### Smart Contract Operations
- **Limit**: 10 requests per 15 minutes
- **Transactions**: 5 requests per 15 minutes
- **General Endpoints**: 100 requests per 15 minutes

### Rate Limit Exceeded Response
```json
{
  "success": false,
  "message": "Too many requests, please try again later",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Troubleshooting

### Common Issues

1. **Server not starting**
   ```bash
   # Check if port 3000 is available
   netstat -ano | findstr :3000
   
   # Kill process if needed
   taskkill /PID <PID> /F
   ```

2. **Database connection error**
   ```bash
   # Check MongoDB status
   mongosh --eval "db.adminCommand('ismaster')"
   
   # Verify connection string in .env
   ```

3. **Authentication issues**
   ```bash
   # Verify JWT secret in .env
   # Check token expiration
   # Ensure proper Authorization header format
   ```

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Or specific modules
DEBUG=app:* npm run dev
```

## 📚 Additional Resources

- **API Documentation**: http://localhost:3000/api-docs
- **Swagger UI**: Interactive API testing interface
- **MongoDB Compass**: GUI for database management
- **Postman Collection**: Import for easy testing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.