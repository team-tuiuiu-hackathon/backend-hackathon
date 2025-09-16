-- Comando CREATE TABLE para a tabela stellar_users
-- Tabela para armazenar usuários autenticados via Sign-In with Stellar

CREATE TABLE stellar_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(56) NOT NULL UNIQUE,
    challenge TEXT,
    "lastLogin" TIMESTAMP WITH TIME ZONE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Comentários nas colunas
COMMENT ON COLUMN stellar_users.id IS 'ID único do usuário Stellar (chave primária)';
COMMENT ON COLUMN stellar_users.address IS 'Chave pública Stellar do usuário (56 caracteres)';
COMMENT ON COLUMN stellar_users.challenge IS 'Challenge (nonce) para autenticação - limpo após uso';
COMMENT ON COLUMN stellar_users."lastLogin" IS 'Data do último login bem-sucedido';
COMMENT ON COLUMN stellar_users."isActive" IS 'Status ativo do usuário';

-- Índices para otimização
CREATE UNIQUE INDEX idx_stellar_users_address ON stellar_users (address);
CREATE INDEX idx_stellar_users_challenge ON stellar_users (challenge);
CREATE INDEX idx_stellar_users_last_login ON stellar_users ("lastLogin");

-- Comentário na tabela
COMMENT ON TABLE stellar_users IS 'Tabela para usuários autenticados via Sign-In with Stellar';