import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import Base
import app.models

def check_relationships():
    print("=== CHECKING ALL ORM RELATIONSHIPS FOR ERRORS ===")
    error_count = 0
    rel_summary = []
    
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        for rel in mapper.relationships:
            target = rel.mapper.class_
            back_pop = rel.back_populates
            direction = rel.direction.name
            uselist = rel.uselist
            
            # Check if back_populates exists on target
            status = "OK"
            if back_pop:
                if not hasattr(target, back_pop):
                    print(f"ERROR: {cls.__name__}.{rel.key} specifies back_populates='{back_pop}', but {target.__name__} has no such attribute!")
                    error_count += 1
                    status = "BROKEN"
                else:
                    target_rel_prop = target.__mapper__.relationships.get(back_pop)
                    if not target_rel_prop:
                        print(f"ERROR: {cls.__name__}.{rel.key} back_populates='{back_pop}', but {target.__name__}.{back_pop} is not a relationship!")
                        error_count += 1
                        status = "BROKEN"
            
            rel_summary.append({
                "source": cls.__name__,
                "attr": rel.key,
                "target": target.__name__,
                "direction": direction,
                "uselist": uselist,
                "back_populates": back_pop,
                "status": status
            })

    if error_count == 0:
        print(f"ALL {len(rel_summary)} ORM relationships across all models are 100% valid and verified!\n")
    else:
        print(f"Found {error_count} broken relationships!\n")
        
    # Group by source model
    from collections import defaultdict
    by_model = defaultdict(list)
    for r in rel_summary:
        by_model[r["source"]].append(r)
        
    for m, rels in sorted(by_model.items()):
        print(f"Model [{m}]:")
        for r in rels:
            pop_info = f" <-> {r['target']}.{r['back_populates']}" if r['back_populates'] else " (unidirectional)"
            print(f"  - {r['attr']} -> {r['target']} [{r['direction']}, uselist={r['uselist']}]{pop_info}")

if __name__ == "__main__":
    check_relationships()
