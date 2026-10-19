import json

with open("scripts/audit_report.json", encoding="utf-8") as f:
    report = json.load(f)

print("=== ALL FOREIGN KEYS PER TABLE ===")
for t, details in sorted(report["all_tables_details"].items()):
    db_fks = details["db_fks"]
    model_fks = details["model_fks"]
    if db_fks or model_fks:
        print(f"\nTable [{t}]:")
        for fk in db_fks:
            col = fk["column"]
            target = f"{fk['referred_table']}({fk['referred_column']})"
            ondelete = fk.get("ondelete") or "NO ACTION"
            print(f"  DB   : {col} -> {target} [ON DELETE {ondelete}]")
        for fk in model_fks:
            col = fk["column"]
            target = f"{fk['referred_table']}({fk['referred_column']})"
            ondelete = fk.get("ondelete") or "NO ACTION"
            print(f"  Model: {col} -> {target} [ON DELETE {ondelete}]")
