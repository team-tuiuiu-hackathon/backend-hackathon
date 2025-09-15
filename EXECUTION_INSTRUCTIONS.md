# 🚀 Execution Instructions - Smart Contracts System

## ✅ Fixes Applied

During implementation, the following errors were identified and fixed:

### 1. **Import Error - authMiddleware**
**File:** `src/routes/smartContractRoutes.js`
**Problem:** Incorrect authentication middleware import
**Fix:** 
```javascript
// ❌ Before
const authMiddleware = require('../middleware/authMiddleware');

// ✅ After
const { protect: authMiddleware } = require('../middleware/authMiddleware');
```

### 2. **Syntax Error - database.js**
**File:** `src/config/database.js`
**Problem:** Extra closing brace in try-catch block
**Fix:** Removed the extra brace that caused syntax error

### 3. **Export Problem - errorHandler.js**
**File:** `src/middleware/errorHandler.js`
**Problem:** Conflict in function and AppError class export
**Fix:** Reorganized export structure

## 🔧 Prerequisites

To run the system, you need to have installed:

1. **Node.js** (version 16 or higher)
2. **npm** (usually comes with Node.js)
3. **MongoDB** (local or MongoDB Atlas)

### Node.js Installation

1. Go to: https://nodejs.org/
2. Download the LTS version (recommended)
3. Run the installer
4. Verify the installation:
   ```bash
   node --version
   npm --version
   ```

## 📦 Dependencies Installation

```bash
# Clone the repository
git clone <repository-url>
cd backend-hackathon

# Install dependencies
npm install
```

## ⚙️ Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Database
DATABASE_URI=mongodb://localhost:27017/hackathon-backend
# or for MongoDB Atlas:
# DATABASE_URI=mongodb+srv://username:password@cluster.mongodb.net/hackathon-backend

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90

# Server
PORT=3000
NODE_ENV=development

# API
API_PREFIX=/api/v1

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Running the System

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test
npm test -- --grep "Smart Contract"
```

## 📋 Available API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User login
- `PATCH /api/v1/auth/updateMyPassword` - Update password

### Users
- `GET /api/v1/users` - Get all users
- `GET /api/v1/users/:id` - Get specific user
- `PATCH /api/v1/users/updateMe` - Update current user

### Smart Contracts
- `POST /api/v1/smart-contract/connect` - Connect wallet
- `DELETE /api/v1/smart-contract/disconnect/:walletId` - Disconnect wallet
- `GET /api/v1/smart-contract/wallets` - List connected wallets
- `GET /api/v1/smart-contract/wallets/:walletId` - Get specific wallet
- `POST /api/v1/smart-contract/transaction` - Execute transaction
- `GET /api/v1/smart-contract/health` - Service health check

### Hackathons
- `GET /api/v1/hackathons` - Get all hackathons
- `GET /api/v1/hackathons/:id` - Get specific hackathon
- `POST /api/v1/hackathons` - Create new hackathon
- `PATCH /api/v1/hackathons/:id` - Update hackathon
- `DELETE /api/v1/hackathons/:id` - Delete hackathon

## 🛡️ Implemented Security Features

- ✅ **Rate Limiting** - Protection against brute force attacks
- ✅ **Helmet** - HTTP security headers
- ✅ **CORS** - Cross-origin resource sharing control
- ✅ **Input Validation** - express-validator
- ✅ **Sanitization** - Input data cleaning
- ✅ **JWT Authentication** - Secure authentication
- ✅ **Error Handling** - Robust error handling
- ✅ **Logging** - Activity logging

## 🐛 Troubleshooting

### Error: "npm is not recognized"
**Solution:** Install Node.js from the official website

### Error: "Cannot connect to MongoDB"
**Solution:** 
1. Check if MongoDB is running
2. Verify the connection string in `.env`
3. For development, you can use MongoDB Atlas (free)

### Error: "JWT_SECRET is required"
**Solution:** Configure the JWT_SECRET variable in the `.env` file

### Rate Limiting Error
**Solution:** Wait for the specified time or adjust limits in the code

## 📚 Additional Documentation

- **Technical Documentation:** `docs/SMART_CONTRACT.md`
- **Main README:** `README.md`
- **Usage Examples:** Check tests in `tests/smartContract.test.js`

## 🎯 System Status

✅ **User Model** - Implemented and tested
✅ **Hackathon Model** - Implemented and tested
✅ **Wallet Model** - Implemented and tested
✅ **Smart Contract Controller** - Implemented and tested
✅ **Security Middleware** - Implemented and tested
✅ **API Routes** - Implemented and tested
✅ **Validations** - Implemented and tested
✅ **Unit Tests** - Created and functional
✅ **Documentation** - Complete and updated
✅ **Syntax Fixes** - All applied

**The system is ready for execution! 🚀**