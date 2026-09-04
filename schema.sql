-- Script de criação de tabelas e políticas para o Supabase

-- Criação da tabela de transações
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending')),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Configuração de Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança vinculadas ao usuário logado (auth.uid())
CREATE POLICY "Permitir leitura apenas para o dono"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção apenas para o dono"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização apenas para o dono"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão apenas para o dono"
ON public.transactions FOR DELETE
USING (auth.uid() = user_id);

-- O comando abaixo pode ser necessário se você já tinha transações na tabela sem user_id. 
-- Nesse caso, primeiro você teria que apagá-las (DELETE FROM transactions;) ou adicionar o user_id como NULL temporariamente.

-- =====================================
-- TABELA DE INVESTIMENTOS
-- =====================================
CREATE TABLE public.investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    name TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('fixed', 'variable', 'crypto', 'other')),
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'sold')),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura apenas para o dono (investimentos)"
ON public.investments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção apenas para o dono (investimentos)"
ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir atualização apenas para o dono (investimentos)"
ON public.investments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Permitir exclusão apenas para o dono (investimentos)"
ON public.investments FOR DELETE USING (auth.uid() = user_id);
