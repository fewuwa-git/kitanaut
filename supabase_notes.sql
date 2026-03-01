-- Führe dieses Skript im SQL Editor deines Supabase Dashboards aus

-- Tabelle für monatliche Notizen im Springerin-Dashboard
CREATE TABLE IF NOT EXISTS public.pankonauten_springerin_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jahr INTEGER NOT NULL,
    monat INTEGER NOT NULL,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(jahr, monat)
);

-- RLS (Row Level Security) aktivieren
ALTER TABLE public.pankonauten_springerin_notes ENABLE ROW LEVEL SECURITY;

-- Police: Nur Admins und Vorstandsmitglieder dürfen Notizen sehen und bearbeiten
CREATE POLICY "Admins and members can view notes" 
ON public.pankonauten_springerin_notes FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.pankonauten_users 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'member')
));

CREATE POLICY "Admins and members can insert notes" 
ON public.pankonauten_springerin_notes FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.pankonauten_users 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'member')
));

CREATE POLICY "Admins and members can update notes" 
ON public.pankonauten_springerin_notes FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.pankonauten_users 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'member')
));

CREATE POLICY "Admins and members can delete notes" 
ON public.pankonauten_springerin_notes FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM public.pankonauten_users 
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'member')
));
