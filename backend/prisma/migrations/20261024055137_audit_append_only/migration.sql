-- The audit log is append-only (README §11): rows can be added, never changed or removed.
-- The one change PostgreSQL itself makes is allowed: when a user is deleted, the foreign key sets "actorId" to
-- NULL (onDelete: SetNull). Every other column must stay exactly as it was.
CREATE FUNCTION "audit_log_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."actorId" IS NULL
     AND NEW."id" = OLD."id"
     AND NEW."at" = OLD."at"
     AND NEW."action" = OLD."action"
     AND NEW."entityType" = OLD."entityType"
     AND NEW."entityId" IS NOT DISTINCT FROM OLD."entityId"
     AND NEW."departmentId" IS NOT DISTINCT FROM OLD."departmentId"
     AND NEW."details" IS NOT DISTINCT FROM OLD."details" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_log rows are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_change"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

-- TRUNCATE bypasses row triggers; refuse it too.
CREATE FUNCTION "audit_log_no_truncate"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log cannot be truncated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_no_truncate"();

-- Least privilege (README §11): in production the app connects as "acp_app" (deploy/db-init/10-app-role.sh),
-- which may read and add audit rows but not change or remove them. Development has no such role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'acp_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON "audit_log" FROM "acp_app";
  END IF;
END
$$;
