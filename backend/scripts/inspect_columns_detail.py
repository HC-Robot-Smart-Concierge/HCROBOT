import json

with open('scripts/schema_dump.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

with open('scripts/columns_detail.txt', 'w', encoding='utf-8') as out:
    for table_name, info in sorted(data.items()):
        cols = [f"{c['name']} ({c['type']}, {'NULL' if c['nullable']=='YES' else 'NOT NULL'}{', def=' + c['default'] if c['default'] else ''})" for c in info['columns']]
        fks = [f"{fk['column']} -> {fk['ref_table']}.{fk['ref_column']}" for fk in info['fks']]
        out.write(f"=== TABLE: {table_name} ({info['row_count']} rows) ===\n")
        out.write("Columns:\n")
        for col in cols:
            out.write(f"  - {col}\n")
        if fks:
            out.write("Foreign Keys:\n")
            for fk in fks:
                out.write(f"  * {fk}\n")
        out.write("\n")
print("Done writing columns_detail.txt")

