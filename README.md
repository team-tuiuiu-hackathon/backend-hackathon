# Backend Hackathon

RESTful API developed in Node.js for hackathon management.

## Technologies Used

- Node.js
- Express
- MongoDB com Mongoose
- JWT for authentication
- bcryptjs for encryption
- express-rate-limit for rate limiting
- express-validator for validation
- helmet for security
- uuid for unique identifiers

## Project Structure

```
├── src/
│   ├── config/         # Project configurations
│   ├── controllers/    # Application controllers
│   ├── middleware/     # Custom middlewares
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── app.js          # Express configuration
│   └── server.js       # Application entry point
├── .env                # Environment variables
├── .env.example        # Environment variables example
├── .gitignore          # Files ignored by Git
├── package.json        # Dependencies and scripts
└── README.md           # Project documentation
```

## Features

### Authentication
- User registration
- JWT login
- Route protection
- Role-based access control

### Users
- Complete user CRUD
- Profile updates
- Password changes

### Hackathons
- Complete hackathon CRUD
- Participant registration
- Team creation
- Project management

### Smart Contracts
- Ethereum wallet connection and management
- Secure transaction execution
- Wallet address validation
- Rate limiting for critical operations
- Activity logging and monitoring
- Advanced security middleware

## How to Run

1. Clone the repository
   ```bash
   git clone https://github.com/your-username/backend-hackathon.git
   cd backend-hackathon
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   ```bash
   cp .env.example .env
   # Edit the .env file with your configurations
   ```

4. Configure MongoDB
   - Install MongoDB locally or use a service like MongoDB Atlas
   - Configure the connection string in the .env file:
   ```
   MONGODB_URI=your_mongodb_connection_string
   ```

5. Start the server
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Register a new user
- `POST /api/v1/auth/login` - Login
- `PATCH /api/v1/auth/updateMyPassword` - Update password

### Users
- `GET /api/v1/users` - List all users (admin)
- `GET /api/v1/users/:id` - Get a specific user (admin)
- `PATCH /api/v1/users/updateMe` - Update current user profile
- `DELETE /api/v1/users/deleteMe` - Deactivate current user account

### Hackathons
- `GET /api/v1/hackathons` - List all hackathons
- `GET /api/v1/hackathons/:id` - Get a specific hackathon
- `POST /api/v1/hackathons` - Create a new hackathon
- `PATCH /api/v1/hackathons/:id` - Update a hackathon
- `DELETE /api/v1/hackathons/:id` - Delete a hackathon
- `POST /api/v1/hackathons/:id/register` - Register for a hackathon
- `POST /api/v1/hackathons/:id/teams` - Create a team in a hackathon