"""Append-only também na BD (Postgres): UPDATE/DELETE em auditoria e ledger levantam erro.

A aplicação já bloqueia; isto protege contra SQL directo, scripts e bugs futuros.
Em SQLite (dev) não faz nada.
"""

from django.db import migrations

TABLES = ["audit_auditlog", "ledger_journal", "ledger_posting"]

FUNC = """
CREATE OR REPLACE FUNCTION pagamoz_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabela % é append-only (operação % recusada)', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;
"""


def forwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute(FUNC, params=None)  # None: o "%" do RAISE não é um parâmetro
    for t in TABLES:
        schema_editor.execute(f"DROP TRIGGER IF EXISTS {t}_append_only ON {t};")
        schema_editor.execute(
            f"CREATE TRIGGER {t}_append_only BEFORE UPDATE OR DELETE ON {t} "
            f"FOR EACH ROW EXECUTE FUNCTION pagamoz_append_only();"
        )


def backwards(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    for t in TABLES:
        schema_editor.execute(f"DROP TRIGGER IF EXISTS {t}_append_only ON {t};")
    schema_editor.execute("DROP FUNCTION IF EXISTS pagamoz_append_only();")


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial"), ("ledger", "0002_initial")]
    operations = [migrations.RunPython(forwards, backwards)]
