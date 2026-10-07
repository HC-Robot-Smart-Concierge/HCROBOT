#!/usr/bin/env python3
import os

p = os.path.expanduser('~/.gz/sim/8/gui.config')
if os.path.exists(p):
    with open(p, 'r') as f:
        text = f.read()

    # Clean any old or misplaced VisualizeLidar
    lines = text.splitlines()
    cleaned = []
    skip = False
    for line in lines:
        if 'VisualizeLidar' in line or 'Visualize Lidar' in line:
            skip = True
            continue
        if skip and ('</plugin>' in line or '</gz-gui>' in line or '<gz-gui>' in line or '<property' in line):
            if '</plugin>' in line:
                skip = False
            continue
        cleaned.append(line)
    
    text = '\n'.join(cleaned)
    
    # Insert VisualizeLidar properly after MinimalScene or at the end
    plugin_xml = """
<!-- LiDAR 360 Rays Visualizer -->
<plugin filename="VisualizeLidar" name="Visualize Lidar">
  <gz-gui>
    <property type="string" key="state">docked</property>
  </gz-gui>
</plugin>
"""
    text = text.strip() + '\n' + plugin_xml
    with open(p, 'w') as f:
        f.write(text)
    print("SUCCESS: ~/.gz/sim/8/gui.config updated with docked VisualizeLidar plugin!")
else:
    print("gui.config not found at", p)
