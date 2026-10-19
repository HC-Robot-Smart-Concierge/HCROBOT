import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
import json
from collections import defaultdict
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.core.database import Base, engine
import app.models  # load all models

def normalize_type_str(sql_type_str: str) -> str:
    s = str(sql_type_str).upper()
    # Normalize common postgres types vs sqlalchemy types
    if "VARCHAR" in s or "CHARACTER VARYING" in s or "STRING" in s:
        # extract length if present
        import re
        m = re.search(r'\((\d+)\)', s)
        if m:
            return f"VARCHAR({m.group(1)})"
        return "VARCHAR"
    if "TEXT" in s:
        return "TEXT"
    if "INT" in s or "SERIAL" in s:
        if "BIG" in s:
            return "BIGINT"
        if "SMALL" in s:
            return "SMALLINT"
        return "INTEGER"
    if "BOOLEAN" in s or "BOOL" in s:
        return "BOOLEAN"
    if "FLOAT" in s or "DOUBLE" in s or "REAL" in s or "NUMERIC" in s:
        return "FLOAT"
    if "DATETIME" in s or "TIMESTAMP" in s:
        return "DATETIME"
    if "JSON" in s:
        return "JSON"
    return s

def run_sync_inspection(connection):
    inspector = inspect(connection)
    db_tables = inspector.get_table_names(schema="public")
    
    # Filter out system or alembic tables
    ignored = {"alembic_version", "spatial_ref_sys"}
    db_tables = [t for t in db_tables if t not in ignored and not t.startswith("_")]
    
    report = {
        "summary": {},
        "table_discrepancies": {},
        "column_discrepancies": defaultdict(dict),
        "fk_discrepancies": defaultdict(dict),
        "relationship_audit": defaultdict(dict),
        "all_tables_details": {}
    }
    
    code_tables = set(Base.metadata.tables.keys())
    db_tables_set = set(db_tables)
    
    missing_in_db = sorted(list(code_tables - db_tables_set))
    missing_in_code = sorted(list(db_tables_set - code_tables))
    common_tables = sorted(list(code_tables & db_tables_set))
    
    report["table_discrepancies"] = {
        "missing_in_database": missing_in_db,
        "missing_in_code_models": missing_in_code,
        "common_tables_count": len(common_tables)
    }
    
    for table_name in common_tables:
        model_table = Base.metadata.tables[table_name]
        
        # 1. DB Columns
        db_cols = {col["name"]: col for col in inspector.get_columns(table_name, schema="public")}
        model_cols = {col.name: col for col in model_table.columns}
        
        db_col_names = set(db_cols.keys())
        model_col_names = set(model_cols.keys())
        
        col_in_db_not_code = sorted(list(db_col_names - model_col_names))
        col_in_code_not_db = sorted(list(model_col_names - db_col_names))
        common_cols = sorted(list(db_col_names & model_col_names))
        
        type_mismatches = []
        nullability_mismatches = []
        
        for c in common_cols:
            db_col = db_cols[c]
            m_col = model_cols[c]
            
            db_type_norm = normalize_type_str(str(db_col["type"]))
            m_type_norm = normalize_type_str(str(m_col.type))
            
            # Check type mismatch (ignore minor length differences if both are VARCHAR or TEXT)
            if db_type_norm != m_type_norm:
                # If one is TEXT and one is VARCHAR without constraint, or both text-like
                if not (("VARCHAR" in db_type_norm or "TEXT" in db_type_norm) and ("VARCHAR" in m_type_norm or "TEXT" in m_type_norm)):
                    type_mismatches.append({
                        "column": c,
                        "db_type": str(db_col["type"]),
                        "db_norm": db_type_norm,
                        "model_type": str(m_col.type),
                        "model_norm": m_type_norm
                    })
            
            # Check nullability
            # db_col['nullable'] is boolean
            # m_col.nullable is boolean
            if db_col["nullable"] != m_col.nullable:
                nullability_mismatches.append({
                    "column": c,
                    "db_nullable": db_col["nullable"],
                    "model_nullable": m_col.nullable
                })
        
        if col_in_db_not_code or col_in_code_not_db or type_mismatches or nullability_mismatches:
            report["column_discrepancies"][table_name] = {
                "in_db_not_code": col_in_db_not_code,
                "in_code_not_db": col_in_code_not_db,
                "type_mismatches": type_mismatches,
                "nullability_mismatches": nullability_mismatches
            }
        
        # 2. Primary Keys
        db_pk = inspector.get_pk_constraint(table_name, schema="public").get("constrained_columns", [])
        m_pk = [c.name for c in model_table.primary_key.columns]
        pk_mismatch = (sorted(db_pk) != sorted(m_pk))
        
        # 3. Foreign Keys
        db_fks = inspector.get_foreign_keys(table_name, schema="public")
        # format: [{'name': '...', 'constrained_columns': ['...'], 'referred_table': '...', 'referred_columns': ['...'], 'options': {'ondelete': '...'}}]
        
        # model fks
        model_fks = []
        for fk in model_table.foreign_keys:
            model_fks.append({
                "column": fk.parent.name,
                "referred_table": fk.column.table.name,
                "referred_column": fk.column.name,
                "ondelete": fk.ondelete
            })
            
        db_fk_map = {}
        for fk in db_fks:
            col = fk["constrained_columns"][0] if fk["constrained_columns"] else "unknown"
            target_table = fk["referred_table"]
            target_col = fk["referred_columns"][0] if fk["referred_columns"] else "unknown"
            ondelete = (fk.get("options") or {}).get("ondelete")
            db_fk_map[col] = {
                "name": fk.get("name"),
                "column": col,
                "referred_table": target_table,
                "referred_column": target_col,
                "ondelete": ondelete
            }
            
        model_fk_map = {fk["column"]: fk for fk in model_fks}
        
        fks_in_db_not_code = [col for col in db_fk_map if col not in model_fk_map]
        fks_in_code_not_db = [col for col in model_fk_map if col not in db_fk_map]
        
        fk_mismatches = []
        for col in set(db_fk_map.keys()) & set(model_fk_map.keys()):
            dfk = db_fk_map[col]
            mfk = model_fk_map[col]
            if dfk["referred_table"] != mfk["referred_table"] or dfk["referred_column"] != mfk["referred_column"]:
                fk_mismatches.append({
                    "column": col,
                    "db_target": f"{dfk['referred_table']}.{dfk['referred_column']}",
                    "model_target": f"{mfk['referred_table']}.{mfk['referred_column']}"
                })
        
        if fks_in_db_not_code or fks_in_code_not_db or fk_mismatches or pk_mismatch:
            report["fk_discrepancies"][table_name] = {
                "pk_mismatch": {"db_pk": db_pk, "model_pk": m_pk} if pk_mismatch else None,
                "fks_in_db_not_code": [db_fk_map[c] for c in fks_in_db_not_code],
                "fks_in_code_not_db": [model_fk_map[c] for c in fks_in_code_not_db],
                "fk_target_mismatches": fk_mismatches
            }
            
        report["all_tables_details"][table_name] = {
            "columns_count_db": len(db_cols),
            "columns_count_model": len(model_cols),
            "fks_count_db": len(db_fks),
            "fks_count_model": len(model_fks),
            "db_columns": list(db_cols.keys()),
            "model_columns": list(model_cols.keys()),
            "db_fks": list(db_fk_map.values()),
            "model_fks": list(model_fk_map.values())
        }

    # 4. ORM Relationships Audit across models
    from sqlalchemy.orm import class_mapper
    models_classes = [c for c in Base.__subclasses__()]
    # Handle possible subclasses of subclasses if any
    all_mappers = []
    for cls in Base.registry.mappers:
        mapper = cls
        model_cls = mapper.class_
        t_name = mapper.mapped_table.name
        
        rels = []
        for rel_prop in mapper.relationships:
            target_cls = rel_prop.mapper.class_
            target_table = rel_prop.mapper.mapped_table.name
            direction = rel_prop.direction.name
            uselist = rel_prop.uselist
            back_populates = rel_prop.back_populates
            backref = rel_prop.backref
            
            # Check local foreign keys
            local_cols = [c.name for c in rel_prop.local_columns] if hasattr(rel_prop, 'local_columns') else []
            
            rels.append({
                "attribute": rel_prop.key,
                "target_model": target_cls.__name__,
                "target_table": target_table,
                "direction": direction,
                "uselist": uselist,
                "back_populates": back_populates,
                "local_columns": local_cols
            })
            
        # Check if there are foreign keys on this table without a relationship
        table_fks = [c.name for c in mapper.mapped_table.foreign_keys]
        # Find which columns are covered by relationship foreign keys
        covered_cols = set()
        for rel_prop in mapper.relationships:
            for c in rel_prop.local_columns:
                covered_cols.add(c.name)
                
        unmapped_fks = [fk.parent.name for fk in mapper.mapped_table.foreign_keys if fk.parent.name not in covered_cols]
        
        report["relationship_audit"][model_cls.__name__] = {
            "table": t_name,
            "relationships": rels,
            "unmapped_fk_columns": unmapped_fks
        }

    return report

async def main():
    async with engine.connect() as conn:
        report = await conn.run_sync(run_sync_inspection)
    
    with open("scripts/audit_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print("=== AUDIT SUMMARY ===")
    print(f"Total tables in Code models: {len(Base.metadata.tables)}")
    print(f"Total tables in DB: {len(report['all_tables_details'])}")
    print(f"Tables missing in DB: {report['table_discrepancies']['missing_in_database']}")
    print(f"Tables in DB missing in Code: {report['table_discrepancies']['missing_in_code_models']}")
    
    print("\n--- COLUMN DISCREPANCIES ---")
    if not report["column_discrepancies"]:
        print("NONE! All columns are 100% in sync.")
    else:
        for t, disc in report["column_discrepancies"].items():
            print(f"Table '{t}':")
            if disc.get("in_db_not_code"):
                print(f"  + In DB but NOT in Code: {disc['in_db_not_code']}")
            if disc.get("in_code_not_db"):
                print(f"  - In Code but NOT in DB: {disc['in_code_not_db']}")
            if disc.get("type_mismatches"):
                print(f"  ~ Type mismatches: {disc['type_mismatches']}")
            if disc.get("nullability_mismatches"):
                print(f"  ! Nullability mismatches: {disc['nullability_mismatches']}")
                
    print("\n--- FOREIGN KEY DISCREPANCIES ---")
    if not report["fk_discrepancies"]:
        print("NONE! All foreign keys are 100% in sync.")
    else:
        for t, disc in report["fk_discrepancies"].items():
            print(f"Table '{t}':")
            if disc.get("pk_mismatch"):
                print(f"  ! PK mismatch: {disc['pk_mismatch']}")
            if disc.get("fks_in_db_not_code"):
                print(f"  + FK in DB not in Code: {disc['fks_in_db_not_code']}")
            if disc.get("fks_in_code_not_db"):
                print(f"  - FK in Code not in DB: {disc['fks_in_code_not_db']}")
            if disc.get("fk_target_mismatches"):
                print(f"  ~ FK target mismatches: {disc['fk_target_mismatches']}")

    print("\n--- UNMAPPED FK COLUMNS IN ORM ---")
    for model_name, info in report["relationship_audit"].items():
        if info.get("unmapped_fk_columns"):
            print(f"Model {model_name} (table {info['table']}): FK columns without relationship() -> {info['unmapped_fk_columns']}")

if __name__ == "__main__":
    asyncio.run(main())
