alter role authenticator set pgrst.db_schemas = 'public,storage,graphql_public,hospital';

grant usage on schema hospital to anon, authenticated, service_role;

grant select on all tables in schema hospital to anon;
grant select, insert, update, delete on all tables in schema hospital to authenticated;
grant select, insert, update, delete on all tables in schema hospital to service_role;

grant usage, select on all sequences in schema hospital to anon, authenticated, service_role;

alter default privileges in schema hospital grant select on tables to anon;
alter default privileges in schema hospital grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema hospital grant select, insert, update, delete on tables to service_role;
alter default privileges in schema hospital grant usage, select on sequences to anon, authenticated, service_role;

select pg_notify('pgrst', 'reload config');
select pg_notify('pgrst', 'reload schema');
