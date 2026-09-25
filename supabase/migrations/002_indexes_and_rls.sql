create index if not exists auth_sessions_user_id_idx on auth_sessions(user_id);
create index if not exists password_reset_tokens_user_id_idx on password_reset_tokens(user_id);
create index if not exists websites_user_id_idx on websites(user_id);
create index if not exists websites_domain_idx on websites(domain);
create index if not exists audits_user_id_idx on audits(user_id);
create index if not exists audits_website_id_idx on audits(website_id);
create index if not exists audits_created_at_idx on audits(created_at);
create index if not exists audits_status_idx on audits(status);
create index if not exists audit_stages_audit_id_idx on audit_stages(audit_id);
create index if not exists audit_metrics_audit_id_idx on audit_metrics(audit_id);
create index if not exists audit_findings_audit_id_idx on audit_findings(audit_id);
create index if not exists audit_technologies_audit_id_idx on audit_technologies(audit_id);
create index if not exists recommendations_audit_id_idx on recommendations(audit_id);
create index if not exists notifications_user_id_idx on notifications(user_id);

-- Example RLS strategy for Supabase use.
alter table users enable row level security;
alter table websites enable row level security;
alter table audits enable row level security;
alter table audit_stages enable row level security;
alter table audit_metrics enable row level security;
alter table audit_findings enable row level security;
alter table audit_technologies enable row level security;
alter table recommendations enable row level security;
alter table audit_ai_summaries enable row level security;
alter table notifications enable row level security;
alter table subscriptions enable row level security;

-- Assumes authenticated user id is available in auth.uid() when integrated with Supabase Auth.
create policy if not exists users_self_select on users for select using (id = auth.uid());
create policy if not exists users_self_update on users for update using (id = auth.uid());

create policy if not exists websites_owner_all on websites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists audits_owner_all on audits for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists audit_stages_owner_select on audit_stages for select
  using (exists (select 1 from audits a where a.id = audit_id and a.user_id = auth.uid()));

create policy if not exists audit_metrics_owner_select on audit_metrics for select
  using (exists (select 1 from audits a where a.id = audit_id and a.user_id = auth.uid()));

create policy if not exists audit_findings_owner_all on audit_findings for all
  using (exists (select 1 from audits a where a.id = audit_id and a.user_id = auth.uid()))
  with check (exists (select 1 from audits a where a.id = audit_id and a.user_id = auth.uid()));

create policy if not exists audit_tech_owner_select on audit_technologies for select
  using (exists (select 1 from audits a where a.id = audit_id and a.user_id = auth.uid()));

create policy if not exists recs_owner_select on recommendations for select
  using (exists (select 1 from audits a where a.id = audit_id and a.user_id = auth.uid()));

create policy if not exists ai_summary_owner_select on audit_ai_summaries for select
  using (exists (select 1 from audits a where a.id = audit_id and a.user_id = auth.uid()));

create policy if not exists notifications_owner_all on notifications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists subscriptions_owner_all on subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
