Backend – Zelo Platform

RESTful API built with Node.js + Express for transparent and secure financial management in condominiums.
The backend powers the Zelo platform, solving key issues in condo administration with multisig wallets, automated expense splitting, and on-chain auditable records.

🚨 Problem

Condominium financial management is complex:

Managers (HOAs) struggle to control collective resources.

Lack of transparency generates distrust and conflicts among residents.

Payment approvals are bureaucratic and unilateral.

Expense splitting is manual and error-prone.

Impact:

+500,000 condominiums in Brazil (residential and commercial).

+30 million residents affected.

R$165 billion/year (~US$32B) in condo revenue flows.

💡 Solution – Zelo

An API that connects condo, manager, and board in a secure, transparent, and collaborative model:

Multisig wallets → payments approved jointly by manager and board.

Automated expense splitting → proportional (percentage-based) or fixed.

USDC transactions → stable digital dollar, low volatility.

On-chain governance → immutable, auditable records with secure access recovery.

⚙️ Technologies Used

Backend: Node.js, Express, PostgreSQL

Authentication: JWT, role-based access control

Security: bcryptjs, helmet, express-rate-limit, express-validator, OWASP best practices

Identifiers: uuid

Blockchain: Stellar (StellarSDK, StellarExpert, StellarLab, StellarWalletKit, Soroban smart contracts)

Stablecoin: USDC for transactions

AI Tools: TRAE, Cursor, ChatGPT, Gemini, Deepseek

📂 Project Structure
├── src/
│   ├── config/         # Project configurations
│   ├── controllers/    # Endpoint logic
│   ├── middleware/     # Custom middlewares
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── app.js          # Express configuration
│   └── server.js       # Application entry point
├── .env                # Environment variables
├── .env.example        # Example environment variables
├── package.json        # Dependencies and scripts
└── README.md           # Documentation

🚀 Features
Authentication

User registration

JWT login

Route protection

Role-Based Access Control (RBAC)

Users

Full CRUD

Profile updates

Password changes

Condominiums

Create and manage multisig wallets

Collaborative payment approvals

Automatic expense splitting

On-chain governance and logs

▶️ How to Run

Clone the repository

git clone https://github.com/your-username/zelo-backend.git
cd zelo-backend


Install dependencies

npm install


Configure environment variables

cp .env.example .env
# Edit with your settings


Configure PostgreSQL and set the connection string in .env

Start the server

# Development mode
npm run dev

# Production mode
npm start

🌐 Main API Endpoints
Authentication

POST /api/v1/auth/signup → Create user

POST /api/v1/auth/login → Login

PATCH /api/v1/auth/updateMyPassword → Change password

Condominiums

POST /api/v1/condos → Create condo

POST /api/v1/condos/:id/wallet → Create multisig wallet

POST /api/v1/condos/:id/expenses → Register expense

PATCH /api/v1/condos/:id/approve → Approve payment
