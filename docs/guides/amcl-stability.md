# AMCL saved-map navigation

The physical navigation profile now waits for an operator-selected initial pose;
it does not assume that map origin is the robot's starting point. Gazebo keeps its
known-spawn initialization. The physical profile uses 120 scan beams, motion
update thresholds of 2.5 cm / 0.04 rad, and a 0.5 m likelihood field with hit/random
weights 0.85 / 0.15 and sigma 0.15 m. These are starting values for indoor testing,
not a substitute for measuring wheel scale, gyro direction, or LiDAR mounting.
Parameter meanings: [Nav2 AMCL documentation](https://docs.nav2.org/rolling/configuration_and_development/configuration_guide/others/configuring_amcl/).

The real-robot startup script now applies the existing mapping scan protection to
navigation: turn for 0.20 s, pause for 0.50 s, and reject full revolutions overlapping
turns above 15 degrees/s. This produces deliberate pauses while rotating; the scan
bridge does not deskew individual laser rays. Environment overrides
`HCROBOT_TURN_PULSE_ON_SEC`, `HCROBOT_TURN_PULSE_OFF_SEC`, and
`HCROBOT_SCAN_MAX_TURN_DPS` remain available. Setting the latter to 0 disables the
turn filter and should only be used when scan motion distortion is addressed.

The bridge rejects frames with reported scan or encoder ages above 0.5 s. Missing
age fields remain supported for older Pi services. In navigation mode it never
broadcasts a competing identity map-to-odom transform. After `/initialpose`, it
clears both costmaps once to remove observations from the previous pose and
requests up to five AMCL no-motion updates within ten seconds. Requests require
newly published scans, a stop command, and near-zero measured velocities. They do
not publish motor commands. Static walls, keepout filters, and live obstacle
marking/clearing remain enabled.

The Physical Map frontend checks covariance before enabling a new endpoint:
maximum horizontal standard deviation 0.25 m and yaw standard deviation 20 degrees.
It revokes readiness on subsequent excessive covariance or reported sensor loss.
This check blocks new endpoints; it does not cancel an already active Nav2 action.
Low covariance alone does not prove that the robot is at the correct map location.
The laser must visibly match mapped walls. Map overlays still use TF + odometry
as their single source of robot position.

## Apply and check

1. When the robot is available, restart Navigation with the selected map using
   **Khởi động lại Nav2**, or stop the old terminal session and run in WSL:

   ```bash
   bash robot/ros2_configs/start_wsl_navigation.sh auto_explored_map
   ```

2. Reload the frontend (rebuild/redeploy it if serving a production build).
3. Choose **Chọn trên map**, placing the robot at its actual position and dragging
   along its actual heading. Leave it stationary for a few seconds.
4. Check laser alignment, then try a short endpoint. Watch for misplaced walls
   during both straight travel and rotation. Dynamic costmaps should still change
   when a real obstacle enters the sensor's view.

The ROS script/configuration changes execute on the laptop's WSL in this setup;
the Pi firmware/service does not need these files to be pulled to apply this fix.

Read-only sensor/TF checks:

```bash
source /opt/ros/jazzy/setup.bash
python3 robot/ros2_configs/diagnose_localization.py --seconds 12
```

The report includes sensor ages, covariance, TF failures, and the fraction of
scan endpoints within 15 cm of occupied map cells. It only measures the current
state and never sends movement commands.

## Validation and limits

- 32 frontend navigation/service checks and 6 sensor/warmup checks passed.
- An opt-in integration test starts the real AMCL executable on isolated ROS
  domain 87, publishes a synthetic room and scan, verifies manual initialization,
  and checks stationary convergence. In the validation run, position error was
  0.056 m, heading error 0.3 degrees, heading standard deviation 3.7 degrees.
- Hardware validation is pending: the Pi was offline during this change. The
  previously observed 70.6 degree yaw uncertainty was a retained, old AMCL sample.

```bash
source /opt/ros/jazzy/setup.bash
python3 -m unittest discover -s robot/tests -p test_localization_support.py -v
ROS_DOMAIN_ID=87 HCROBOT_RUN_AMCL_SMOKE=1 \
  python3 -m unittest discover -s robot/tests -p test_amcl_smoke.py -v
```
