CREATE TABLE validadocscredentials (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL NULL,
    documento VARCHAR(255) NULL,
    telefone VARCHAR(255) NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);


CREATE TABLE validadocslogs (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) NOT NULL,
    engine VARCHAR(10) NOT NULL,
    validation_status BOOLEAN NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE validadocsUsers (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL NULL,
    senha VARCHAR(255) NULL,
    tipo VARCHAR(1) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
