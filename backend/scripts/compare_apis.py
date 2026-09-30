import json
import os
import re

def main():
    with open('api_inventory.json', 'r', encoding='utf-8') as f:
        inventory = json.load(f)

    frontend_dir = os.path.abspath('../frontend/src')
    files_map = {}
    all_frontend_code = ""

    for root, dirs, files in os.walk(frontend_dir):
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, frontend_dir)
                try:
                    with open(full_path, 'r', encoding='utf-8', errors='ignore') as fp:
                        content = fp.read()
                        files_map[rel_path] = content
                        all_frontend_code += "\n" + content
                except Exception:
                    pass

    connected = []
    unconnected = []

    for item in inventory:
        path = item['path']
        method = item['method']
        
        # Bỏ qua các endpoint docs/health cơ bản
        if path in ['/', '/health', '/docs', '/redoc', '/openapi.json']:
            continue
            
        clean_path = path.replace('/api/v1', '')
        
        # Bóc tách sub-path sau prefix
        sub_paths = [clean_path]
        prefixes = [
            '/operations/restaurant',
            '/operations/taxi',
            '/operations/concierge',
            '/operations/admin',
            '/operations/staff',
            '/operations/notifications',
            '/operations/reception',
            '/operations/room-service',
            '/operations/housekeeping',
            '/operations/bell-services',
            '/operations/maintenance',
            '/operations',
            '/rag',
            '/logs',
            '/ai',
            '/auth',
            '/map',
            '/workflows',
        ]
        for prefix in prefixes:
            if clean_path.startswith(prefix):
                sub_paths.append(clean_path[len(prefix):])

        matched = False
        for sp in sub_paths:
            if not sp or sp == '/':
                continue
            # Xử lý dynamic params như {room_number} -> regex
            regex_sp = re.sub(r'\{[^}]+\}', r'[^/`"\']+', sp)
            if sp in all_frontend_code or re.search(regex_sp, all_frontend_code):
                matched = True
                break

        if matched:
            connected.append(item)
        else:
            unconnected.append(item)

    with open('unconnected_apis.json', 'w', encoding='utf-8') as f:
        json.dump(unconnected, f, ensure_ascii=False, indent=2)

    import sys
    sys.stdout.reconfigure(encoding='utf-8')

    print(f"Tong so API nghiep vu: {len(connected) + len(unconnected)}")
    print(f"Da noi Frontend: {len(connected)}")
    print(f"Chua noi hoac can ra soat: {len(unconnected)}")
    print("=" * 80)
    for idx, u in enumerate(unconnected, 1):
        tags = ', '.join(u.get('tags', []))
        summary = u.get('summary', '')
        print(f"{idx:2d}. [{u['method']:6}] {u['path']:50} | {tags:25} | {summary}")

if __name__ == '__main__':
    main()
