#!/usr/bin/env python3
import os

gui_config_path = os.path.expanduser('~/.gz/sim/8/gui.config')
if os.path.exists(gui_config_path):
    with open(gui_config_path, 'r') as f:
        content = f.read()
    
    if 'VisualizeLidar' not in content:
        plugin_xml = """
<!-- LiDAR Rays Visualizer (Display 3D Laser Fan) -->
<plugin filename="VisualizeLidar" name="Visualize Lidar">
  <gz-gui>
    <property type="string" key="state">docked</property>
  </gz-gui>
</plugin>
"""
        content = content.replace('</window>', plugin_xml + '\n</window>')
        with open(gui_config_path, 'w') as f:
            f.write(content)
        print("VisualizeLidar successfully added to ~/.gz/sim/8/gui.config")
    else:
        print("VisualizeLidar is already in gui.config")
