--
-- PostgreSQL database dump
--

\restrict TDDVpowPthBMMuGsIki5D8gt86It6e0GLdLqxcS2zzl3EYTtoHy5SjIaMBA8zcZ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: check_rate_limit(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rate_limit(p_user_id uuid, p_endpoint text, p_max_calls integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare current_window timestamptz := date_trunc('hour', now());
        current_count integer;
begin
  insert into rate_limits (user_id, endpoint, window_start)
  values (p_user_id, p_endpoint, current_window)
  on conflict (user_id, endpoint, window_start)
  do update set call_count = rate_limits.call_count + 1
  returning call_count into current_count;
  -- opportunistic cleanup of old windows
  delete from rate_limits where window_start < now() - interval '24 hours';
  return current_count <= p_max_calls;
end; $$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end; $$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assessment_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    bcba_id uuid,
    session_type text DEFAULT 'initial'::text,
    reauth_cycle integer DEFAULT 0,
    status text DEFAULT 'not_started'::text,
    sections jsonb DEFAULT '{}'::jsonb,
    sections_with_data integer DEFAULT 0,
    sections_approved integer DEFAULT 0,
    documents jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    client_profile jsonb,
    result jsonb,
    consent_granted boolean DEFAULT false NOT NULL,
    consent_granted_at timestamp with time zone,
    progress_narrative_text text,
    client_name text,
    bcba_name text
);


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    dob date,
    phone text,
    address text,
    gender text,
    icd10 text,
    diagnosis text,
    insurer_name text,
    member_id text,
    group_number text,
    health_plan_name text,
    referring_provider text,
    referring_provider_npi text,
    referring_provider_phone text,
    referral_date date,
    parent_name text,
    parent_relationship text,
    parent_email text,
    preferred_language text DEFAULT 'English'::text,
    source text DEFAULT 'crm_created'::text,
    stage text,
    stage_entered_at timestamp with time zone,
    auth_expiry_date date,
    reauth_cycle integer DEFAULT 0,
    pipeline_entry boolean DEFAULT false,
    bcba_id uuid,
    rbt_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_session_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_session_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid,
    bcba_id uuid,
    reauth_cycle integer DEFAULT 0,
    session_type text,
    session_number integer,
    session_date date,
    entries jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    role text DEFAULT 'bcba'::text,
    cert_expiry date,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: assessment_sessions assessment_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: service_session_logs service_session_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_session_logs
    ADD CONSTRAINT service_session_logs_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: assessment_sessions assessment_sessions_bcba_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_bcba_id_fkey FOREIGN KEY (bcba_id) REFERENCES auth.users(id);


--
-- Name: assessment_sessions assessment_sessions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients clients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: service_session_logs service_session_logs_bcba_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_session_logs
    ADD CONSTRAINT service_session_logs_bcba_id_fkey FOREIGN KEY (bcba_id) REFERENCES auth.users(id);


--
-- Name: service_session_logs service_session_logs_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_session_logs
    ADD CONSTRAINT service_session_logs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: staff staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: assessment_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: clients own clients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own clients" ON public.clients USING ((auth.uid() = user_id));


--
-- Name: service_session_logs own logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own logs" ON public.service_session_logs USING ((bcba_id = auth.uid()));


--
-- Name: assessment_sessions own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own sessions" ON public.assessment_sessions USING ((bcba_id = auth.uid()));


--
-- Name: staff own staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own staff" ON public.staff USING ((user_id = auth.uid()));


--
-- Name: service_session_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_session_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION check_rate_limit(p_user_id uuid, p_endpoint text, p_max_calls integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_rate_limit(p_user_id uuid, p_endpoint text, p_max_calls integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_rate_limit(p_user_id uuid, p_endpoint text, p_max_calls integer) TO authenticated;
GRANT ALL ON FUNCTION public.check_rate_limit(p_user_id uuid, p_endpoint text, p_max_calls integer) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: TABLE assessment_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.assessment_sessions TO anon;
GRANT ALL ON TABLE public.assessment_sessions TO authenticated;
GRANT ALL ON TABLE public.assessment_sessions TO service_role;


--
-- Name: TABLE clients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.clients TO anon;
GRANT ALL ON TABLE public.clients TO authenticated;
GRANT ALL ON TABLE public.clients TO service_role;


--
-- Name: TABLE service_session_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.service_session_logs TO anon;
GRANT ALL ON TABLE public.service_session_logs TO authenticated;
GRANT ALL ON TABLE public.service_session_logs TO service_role;


--
-- Name: TABLE staff; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff TO anon;
GRANT ALL ON TABLE public.staff TO authenticated;
GRANT ALL ON TABLE public.staff TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict TDDVpowPthBMMuGsIki5D8gt86It6e0GLdLqxcS2zzl3EYTtoHy5SjIaMBA8zcZ

--
-- Storage: bucket + policies (captured from the `storage` schema)
-- Source: assessment_documents_storage_policies migration (applied via MCP, no local file)
-- Added here manually because pg_dump was scoped to the public schema.
--

INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment-documents', 'assessment-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read own assessment documents"
    ON storage.objects FOR SELECT TO authenticated
    USING (((bucket_id = 'assessment-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "Users can upload own assessment documents"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (((bucket_id = 'assessment-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

