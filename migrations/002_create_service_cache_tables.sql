-- Migração: Criar tabelas de cache para serviços
-- Data: 2024-01-16
-- Descrição: Tabelas para cache e controle de dados dos serviços

-- Tabela para cache de dados do SorobanService
CREATE TABLE IF NOT EXISTS soroban_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(56) NOT NULL,
    method_name VARCHAR(100) NOT NULL,
    parameters_hash VARCHAR(64) NOT NULL, -- Hash dos parâmetros para identificação única
    result_data JSONB NOT NULL,
    network stellar_network NOT NULL DEFAULT 'mainnet',
    cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    hit_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(contract_address, method_name, parameters_hash, network)
);

-- Índices para soroban_cache
CREATE INDEX IF NOT EXISTS idx_soroban_cache_contract ON soroban_cache(contract_address);
CREATE INDEX IF NOT EXISTS idx_soroban_cache_method ON soroban_cache(method_name);
CREATE INDEX IF NOT EXISTS idx_soroban_cache_expires ON soroban_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_soroban_cache_network ON soroban_cache(network);

-- Comentários
COMMENT ON TABLE soroban_cache IS 'Cache de chamadas para contratos Soroban';
COMMENT ON COLUMN soroban_cache.contract_address IS 'Endereço do contrato Soroban';
COMMENT ON COLUMN soroban_cache.method_name IS 'Nome do método chamado';
COMMENT ON COLUMN soroban_cache.parameters_hash IS 'Hash dos parâmetros para identificação única';
COMMENT ON COLUMN soroban_cache.result_data IS 'Resultado da chamada do contrato';
COMMENT ON COLUMN soroban_cache.expires_at IS 'Data de expiração do cache';
COMMENT ON COLUMN soroban_cache.hit_count IS 'Número de vezes que foi usado do cache';

-- Tabela para controle de notificações
CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_type VARCHAR(20) NOT NULL, -- 'email', 'sms', 'push', 'webhook'
    recipient_address VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    template_name VARCHAR(100),
    template_data JSONB,
    priority INTEGER NOT NULL DEFAULT 5, -- 1 = alta, 5 = normal, 10 = baixa
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para notification_queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled ON notification_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority);
CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient ON notification_queue(recipient_type, recipient_address);

-- Comentários
COMMENT ON TABLE notification_queue IS 'Fila de notificações para processamento';
COMMENT ON COLUMN notification_queue.recipient_type IS 'Tipo de destinatário (email, sms, push, webhook)';
COMMENT ON COLUMN notification_queue.priority IS 'Prioridade da notificação (1=alta, 5=normal, 10=baixa)';
COMMENT ON COLUMN notification_queue.status IS 'Status da notificação (pending, sent, failed, cancelled)';

-- Tabela para estatísticas de uso dos serviços
CREATE TABLE IF NOT EXISTS service_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name VARCHAR(100) NOT NULL,
    method_name VARCHAR(100) NOT NULL,
    execution_count INTEGER NOT NULL DEFAULT 1,
    total_execution_time_ms BIGINT NOT NULL DEFAULT 0,
    avg_execution_time_ms DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE 
            WHEN execution_count > 0 THEN total_execution_time_ms::DECIMAL / execution_count 
            ELSE 0 
        END
    ) STORED,
    success_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_execution TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    date_bucket DATE NOT NULL DEFAULT CURRENT_DATE, -- Para agregação diária
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    UNIQUE(service_name, method_name, date_bucket)
);

-- Índices para service_statistics
CREATE INDEX IF NOT EXISTS idx_service_statistics_service ON service_statistics(service_name);
CREATE INDEX IF NOT EXISTS idx_service_statistics_date ON service_statistics(date_bucket);
CREATE INDEX IF NOT EXISTS idx_service_statistics_last_exec ON service_statistics(last_execution);

-- Comentários
COMMENT ON TABLE service_statistics IS 'Estatísticas de uso dos serviços';
COMMENT ON COLUMN service_statistics.avg_execution_time_ms IS 'Tempo médio de execução calculado automaticamente';
COMMENT ON COLUMN service_statistics.date_bucket IS 'Data para agregação das estatísticas';

-- Triggers para updated_at
CREATE TRIGGER update_soroban_cache_updated_at 
    BEFORE UPDATE ON soroban_cache 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_queue_updated_at 
    BEFORE UPDATE ON notification_queue 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_statistics_updated_at 
    BEFORE UPDATE ON service_statistics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Função para limpeza de cache expirado do Soroban
CREATE OR REPLACE FUNCTION cleanup_expired_soroban_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM soroban_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para limpeza de notificações antigas (mais de 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notification_queue 
    WHERE status IN ('sent', 'cancelled') 
    AND created_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para limpeza de estatísticas antigas (mais de 1 ano)
CREATE OR REPLACE FUNCTION cleanup_old_statistics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM service_statistics 
    WHERE date_bucket < CURRENT_DATE - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMIT;