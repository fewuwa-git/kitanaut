-- Führe dieses Skript im SQL Editor deines Supabase Dashboards aus

-- 1. Tabelle für den Abrechnungskopf
CREATE TABLE IF NOT EXISTS public.pankonauten_abrechnungen (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.pankonauten_users(id) ON DELETE CASCADE,
    jahr INTEGER NOT NULL,
    monat INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'entwurf',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, jahr, monat)
);

-- RLS (Row Level Security) aktivieren
ALTER TABLE public.pankonauten_abrechnungen ENABLE ROW LEVEL SECURITY;

-- Police: User dürfen nur ihre eigenen Abrechnungen sehen und bearbeiten
CREATE POLICY "Users can view own abrechnungen" 
ON public.pankonauten_abrechnungen FOR SELECT 
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.pankonauten_users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Users can insert own abrechnungen" 
ON public.pankonauten_abrechnungen FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own abrechnungen" 
ON public.pankonauten_abrechnungen FOR UPDATE 
USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.pankonauten_users WHERE id = auth.uid() AND role = 'admin'
));

-- 2. Tabelle für die einzelnen Abrechnungstage
CREATE TABLE IF NOT EXISTS public.pankonauten_abrechnung_tage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    abrechnung_id UUID NOT NULL REFERENCES public.pankonauten_abrechnungen(id) ON DELETE CASCADE,
    datum DATE NOT NULL,
    von TIME NOT NULL,
    bis TIME NOT NULL,
    stunden NUMERIC(5,2) NOT NULL,
    stundensatz NUMERIC(10,2) NOT NULL,
    betrag NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(abrechnung_id, datum)
);

-- RLS (Row Level Security) aktivieren
ALTER TABLE public.pankonauten_abrechnung_tage ENABLE ROW LEVEL SECURITY;

-- Police: User dürfen Tage bearbeiten, wenn sie Zugriff auf die zugehörige Abrechnung haben
CREATE POLICY "Users can view own abrechnung_tage" 
ON public.pankonauten_abrechnung_tage FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.pankonauten_abrechnungen a 
    WHERE a.id = abrechnung_id AND (a.user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.pankonauten_users u WHERE u.id = auth.uid() AND u.role = 'admin'
    ))
));

CREATE POLICY "Users can insert own abrechnung_tage" 
ON public.pankonauten_abrechnung_tage FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.pankonauten_abrechnungen a 
    WHERE a.id = abrechnung_id AND a.user_id = auth.uid()
));

CREATE POLICY "Users can update own abrechnung_tage" 
ON public.pankonauten_abrechnung_tage FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.pankonauten_abrechnungen a 
    WHERE a.id = abrechnung_id AND a.user_id = auth.uid()
));

CREATE POLICY "Users can delete own abrechnung_tage" 
ON public.pankonauten_abrechnung_tage FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM public.pankonauten_abrechnungen a 
    WHERE a.id = abrechnung_id AND a.user_id = auth.uid()
));
