import json

with open('scripts/schema_dump.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total tables: {len(data)}")
print("=" * 80)
for table_name, info in sorted(data.items()):
    pks = info['pks']
    fks = [f"{fk['column']} -> {fk['ref_table']}({fk['ref_column']})" for fk in info['fks']]
    cols = [c['name'] for c in info['columns']]
    row_count = info['row_count']
    print(f"Table: {table_name:<25} | Rows: {row_count:<5} | Cols: {len(cols):<3} | PK: {pks}")
    if fks:
        print(f"   FKs: {', '.join(fks)}")
print("=" * 80)
