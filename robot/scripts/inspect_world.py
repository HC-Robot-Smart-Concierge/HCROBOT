import xml.etree.ElementTree as ET

tree = ET.parse('/mnt/d/Learning/Ki_9/SEP490/HCROBOT/robot/worlds/hotel_room.world')
root = tree.getroot()
world = root.find('world')

print("=== DANH SACH CAC MODEL TRONG WORLD ===")
for model in world.findall('model'):
    name = model.get('name')
    pose = model.find('pose')
    pose_str = pose.text if pose is not None else "no pose"
    
    # Check sizes
    boxes = [b.text for b in model.findall('.//box/size')]
    cylinders = [(c.find('radius').text, c.find('length').text) for c in model.findall('.//cylinder') if c.find('radius') is not None and c.find('length') is not None]
    meshes = [m.text for m in model.findall('.//mesh/scale')]
    
    print(f"\nModel: {name} (Pose: {pose_str})")
    if boxes:
        print(f"  Box sizes: {boxes[:3]}")
    if cylinders:
        print(f"  Cylinders (r, l): {cylinders[:3]}")
    if meshes:
        print(f"  Mesh scales: {meshes[:3]}")

print("\n=== TRANG THAI STATE CUA CAC MODEL ===")
state = world.find('state')
if state is not None:
    for sm in state.findall('model'):
        s_name = sm.get('name')
        s_pose = sm.find('pose').text if sm.find('pose') is not None else ""
        s_scale = sm.find('scale').text if sm.find('scale') is not None else ""
        print(f"{s_name:25}: pose={s_pose} | scale={s_scale}")
