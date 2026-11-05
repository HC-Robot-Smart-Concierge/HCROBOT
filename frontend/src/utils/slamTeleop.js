export const DEFAULT_SLAM_SPEED = 30;

export const clampTeleopSpeed = (speed) => {
  const value = Number(speed);
  return Number.isFinite(value) ? Math.max(20, Math.min(100, value)) : DEFAULT_SLAM_SPEED;
};

// Preserve the existing mapping calibration at 30%: 0.10 m/s, 0.30 rad/s,
// and 38% motor power for turns. Apply a new speed only when the operator selects it.
export const getSlamTeleopMotion = (command, selectedSpeed = DEFAULT_SLAM_SPEED) => {
  const speed = clampTeleopSpeed(selectedSpeed);
  const ratio = speed / DEFAULT_SLAM_SPEED;
  const turning = command === 'left' || command === 'right';
  return {
    linear: command === 'forward' ? 0.10 * ratio : command === 'backward' ? -0.10 * ratio : 0,
    angular: command === 'left' ? 0.30 * ratio : command === 'right' ? -0.30 * ratio : 0,
    speed: turning ? Math.min(100, Math.round(38 * ratio)) : speed,
  };
};
