-- =============================================================================
-- WeatherChaser: automatische Löschfristen in Supabase (pg_cron)
-- Stand: 23.10.2026
-- =============================================================================
--
-- WOFÜR: Die Datenschutzerklärung verspricht diese Fristen. Ohne diese Jobs
-- passiert die Löschung NICHT von selbst:
--   - Registrierungen ohne bestätigte E-Mail: nach 3 Monaten löschen (§ 4)
--   - Feedback: nach höchstens 24 Monaten löschen (§ 11)
--   - Suchverlauf: Einträge älter als 12 Monate löschen (§ 7)
--
-- SO FÜHRST DU ES AUS (Tim):
--   1. Supabase-Dashboard öffnen → dein Projekt → links „SQL Editor“ → „New query“.
--   2. Den GESAMTEN Inhalt dieser Datei hineinkopieren und auf „Run“ klicken.
--      Supabase fragt evtl. nach, weil „delete“ vorkommt („destructive
--      operation“) → bestätigen.
--   3. Prüfen: Ganz unten liefert die letzte Abfrage eine Tabelle mit drei
--      Zeilen (wc_retention_…). Stehen dort drei Jobs, ist alles eingerichtet.
--   4. Nach ein paar Tagen kontrollieren, ob die Jobs gelaufen sind:
--        select jobname, status, start_time, return_message
--        from cron.job_run_details order by start_time desc limit 20;
--      „succeeded“ = gut. „failed“ → Meldung an mich bzw. den Agenten geben.
--
-- MEHRFACH AUSFÜHREN IST UNSCHÄDLICH (idempotent): Jeder Job wird vor dem
-- Anlegen entfernt, falls es ihn schon gibt. Teil 3 ist durch ein Datum begrenzt.
--
-- Die Jobs laufen täglich nachts (Uhrzeiten in UTC). Sie laufen als Rolle
-- „postgres“, die in Supabase Nutzer in auth.users löschen darf.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Teil 0: pg_cron einschalten (falls noch nicht aktiv).
-- Alternativ im Dashboard: „Integrations“ → „Cron“ → „Enable“.
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;


-- -----------------------------------------------------------------------------
-- Teil 1: Alte Jobs mit gleichem Namen entfernen (macht die Datei wiederholbar).
-- -----------------------------------------------------------------------------
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'wc_retention_unconfirmed_users',
  'wc_retention_feedback',
  'wc_retention_search_history'
);


-- -----------------------------------------------------------------------------
-- Teil 2: Die drei täglichen Jobs anlegen.
-- -----------------------------------------------------------------------------

-- 2a) Registrierungen, deren E-Mail nie bestätigt wurde, nach 3 Monaten löschen.
--     Zuerst deren Feedback (die Verknüpfung steht auf „on delete set null“,
--     sonst bliebe der Text ohne Zuordnung stehen), dann den Nutzer selbst.
--     Gespeicherte Routen, Suchen usw. löscht die Datenbank automatisch mit
--     (on delete cascade). Anmeldungen über Google/Apple sind immer bestätigt
--     und deshalb nicht betroffen.
select cron.schedule(
  'wc_retention_unconfirmed_users',
  '15 3 * * *',  -- täglich 03:15 UTC
  $job$
    delete from public.feedback
    where user_id in (
      select id from auth.users
      where email_confirmed_at is null
        and created_at < now() - interval '3 months'
    );
    delete from auth.users
    where email_confirmed_at is null
      and created_at < now() - interval '3 months';
  $job$
);

-- 2b) Feedback nach 24 Monaten löschen.
select cron.schedule(
  'wc_retention_feedback',
  '25 3 * * *',  -- täglich 03:25 UTC
  $job$
    delete from public.feedback
    where created_at < now() - interval '24 months';
  $job$
);

-- 2c) Suchverlauf: Einträge älter als 12 Monate löschen.
--     (Die App kürzt den Verlauf zusätzlich auf die letzten 15 Einträge.)
select cron.schedule(
  'wc_retention_search_history',
  '35 3 * * *',  -- täglich 03:35 UTC
  $job$
    delete from public.search_history
    where created_at < now() - interval '12 months';
  $job$
);


-- -----------------------------------------------------------------------------
-- Teil 3: EINMALIGE Bereinigung von Feedback ohne Nutzer-ID.
--
-- Hintergrund: Bis zur Korrektur der Kontolöschung (Branch finish-2026-10)
-- blieb das Feedback gelöschter Konten erhalten, nur ohne Nutzer-ID. Diese
-- Zeilen lassen sich nicht mehr von Gast-Feedback unterscheiden; deshalb
-- löscht dieser Schritt ALLES Feedback ohne Nutzer-ID, das vor dem Stichtag
-- entstanden ist — also auch echtes Gast-Feedback aus der Zeit davor.
-- Willst du Gast-Feedback behalten: vorher im Table Editor (Tabelle
-- „feedback“) als CSV exportieren.
--
-- STICHTAG: Führe die Datei erst NACH dem Deployment des Branches aus und
-- setze das Datum unten auf den Tag des Deployments (gelöscht wird nur, was
-- VOR diesem Tag entstanden ist). Durch das Datum bleibt neues Gast-Feedback
-- verschont, auch wenn du die Datei später noch einmal ausführst.
-- -----------------------------------------------------------------------------
delete from public.feedback
where user_id is null
  and created_at < date '2026-10-24';


-- -----------------------------------------------------------------------------
-- Kontrolle: sollte genau drei Zeilen zeigen.
-- -----------------------------------------------------------------------------
select jobid, jobname, schedule, active
from cron.job
where jobname like 'wc_retention_%'
order by jobname;
