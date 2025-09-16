-- Migração: Criar tabela stellar_validations
-- Data: 2024-01-16
-- Descrição: Tabela para cache de validações de endereços Stellar

-- Criar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar enum para network
CREATE TYPE stellar_network AS ENUM ('mainnet', 'testnet');

-- Criar tabela stellar_validations
CREATE TABLE IF NOT EXISTS stellar_validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    address VARCHAR(56) NOT NULL UNIQUE,
    is_valid BOOLEAN NOT NULL,
    exists BOOLEAN NOT NULL,
    account_data JSONB,
    network stellar_network,
    last_validated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    validation_count INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Criar índices para otimização
CREATE INDEX IF NOT EXISTS idx_stellar_validations_address ON stellar_validations(address);
CREATE INDEX IF NOT EXISTS idx_stellar_validations_last_validated ON stellar_validations(last_validated);
CREATE INDEX IF NOT EXISTS idx_stellar_validations_status ON stellar_validations(is_valid, exists);
CREATE INDEX IF NOT EXISTS idx_stellar_validations_network ON stellar_validations(network);

-- Comentários nas colunas
COMMENT ON TABLE stellar_validations IS 'Cache de validações de endereços Stellar';
COMMENT ON COLUMN stellar_validations.id IS 'ID único da validação (chave primária)';
COMMENT ON COLUMN stellar_validations.address IS 'Endereço Stellar validado';
COMMENT ON COLUMN stellar_validations.is_valid IS 'Se o endereço tem formato válido';
COMMENT ON COLUMN stellar_validations.exists IS 'Se a conta existe na rede Stellar';
COMMENT ON COLUMN stellar_validations.account_data IS 'Dados da conta Stellar (balances, sequence, etc.)';
COMMENT ON COLUMN stellar_validations.network IS 'Rede onde a conta foi encontrada';
COMMENT ON COLUMN stellar_validations.last_validated IS 'Data da última validação';
COMMENT ON COLUMN stellar_validations.validation_count IS 'Número de vezes que foi validado';
COMMENT ON COLUMN stellar_validations.error_message IS 'Mensagem de erro da última validação (se houver)';

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para atualizar updated_at
CREATE TRIGGER update_stellar_validations_updated_at 
    BEFORE UPDATE ON stellar_validations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Função para limpeza automática de registros antigos (mais de 24 horas)
CREATE OR REPLACE FUNCTION cleanup_old_stellar_validations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM stellar_validations 
    WHERE last_validated < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comentário na função
COMMENT ON FUNCTION cleanup_old_stellar_validations() IS 'Remove validações antigas (mais de 24 horas)';

COMMIT;