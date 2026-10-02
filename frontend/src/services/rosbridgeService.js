/**
 * Rosbridge v2.0 Protocol Client for ROS 2 Navigation & SLAM Toolbox
 * Connects directly to rosbridge_websocket (port 9090) over native WebSockets
 */

export const ROS_TOPICS = {
  MAP: '/map',
  SCAN: '/scan',
  ODOM: '/odom',
  AMCL_POSE: '/amcl_pose',
  GOAL_POSE: '/goal_pose',
  CMD_VEL: '/cmd_vel',
};

export const ROS_MSG_TYPES = {
  OCCUPANCY_GRID: 'nav_msgs/OccupancyGrid',
  LASER_SCAN: 'sensor_msgs/LaserScan',
  ODOMETRY: 'nav_msgs/Odometry',
  POSE_WITH_COVARIANCE: 'geometry_msgs/PoseWithCovarianceStamped',
  POSE_STAMPED: 'geometry_msgs/PoseStamped',
  TWIST: 'geometry_msgs/Twist',
};

/**
 * Chuyển đổi ROS 2 nav_msgs/OccupancyGrid sang định dạng Canvas Grid
 */
export const parseOccupancyGrid = (msg) => {
  if (!msg || !msg.info || !Array.isArray(msg.data)) {
    return null;
  }
  const { width, height, resolution, origin } = msg.info;
  const originX = origin?.position?.x ?? -5.0;
  const originY = origin?.position?.y ?? -5.0;

  return {
    gridData: msg.data,
    metadata: {
      width,
      height,
      resolution,
      origin_x: originX,
      origin_y: originY,
    },
  };
};

/**
 * Chuyển đổi ROS 2 sensor_msgs/LaserScan sang mảng tọa độ tia cực
 */
export const parseLaserScan = (msg) => {
  if (!msg || !Array.isArray(msg.ranges)) {
    return [];
  }
  const { angle_min = 0, angle_increment = 0.01745, ranges, intensities, range_min = 0.1, range_max = 12.0 } = msg;
  const points = [];

  for (let i = 0; i < ranges.length; i++) {
    const dist = ranges[i];
    if (dist >= range_min && dist <= range_max && isFinite(dist)) {
      const angleRad = angle_min + i * angle_increment;
      const angleDeg = (angleRad * (180 / Math.PI)) % 360;
      points.push({
        angle: angleDeg < 0 ? angleDeg + 360 : angleDeg,
        distance: Number(dist.toFixed(3)),
        quality: intensities && intensities[i] ? Math.round(intensities[i]) : 47,
      });
    }
  }

  return points;
};

/**
 * Chuyển đổi Quaternion (z, w) sang góc Euler Yaw (radian & degree)
 */
export const quaternionToYaw = (z = 0, w = 1) => {
  return 2 * Math.atan2(z, w);
};

/**
 * Tạo message điều hướng Goal Pose cho Nav2 (/goal_pose)
 */
export const createGoalPoseMsg = (x, y, yaw = 0, frameId = 'map') => {
  const halfYaw = yaw / 2;
  return {
    header: {
      stamp: {
        sec: Math.floor(Date.now() / 1000),
        nanosec: (Date.now() % 1000) * 1000000,
      },
      frame_id: frameId,
    },
    pose: {
      position: {
        x: Number(x.toFixed(3)),
        y: Number(y.toFixed(3)),
        z: 0.0,
      },
      orientation: {
        x: 0.0,
        y: 0.0,
        z: Math.sin(halfYaw),
        w: Math.cos(halfYaw),
      },
    },
  };
};

/**
 * Tạo message vận tốc /cmd_vel cho Robot
 */
export const createCmdVelMsg = (linearX = 0, angularZ = 0) => {
  return {
    linear: {
      x: Number(linearX),
      y: 0.0,
      z: 0.0,
    },
    angular: {
      x: 0.0,
      y: 0.0,
      z: Number(angularZ),
    },
  };
};

/**
 * Rosbridge WebSocket Client Class
 */
export class RosbridgeClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.ws = null;
    this.subscriptions = new Map(); // topic -> Set(callbacks)
    this.isConnected = false;
    this.reconnectTimer = null;
    this.autoReconnect = options.autoReconnect ?? true;
  }

  connect() {
    try {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        if (this.options.onOpen) this.options.onOpen();

        // Resubscribe to all topics on reconnect
        this.subscriptions.forEach((_, topic) => {
          this.sendSubscribeOp(topic);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.op === 'publish' && data.topic) {
            const listeners = this.subscriptions.get(data.topic);
            if (listeners) {
              listeners.forEach((cb) => {
                try {
                  cb(data.msg);
                } catch (err) {
                  console.error(`Callback error for topic ${data.topic}:`, err);
                }
              });
            }
          }
        } catch (err) {
          console.error('Rosbridge JSON parse error:', err);
        }
      };

      this.ws.onerror = (err) => {
        this.isConnected = false;
        if (this.options.onError) this.options.onError(err);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (this.options.onClose) this.options.onClose();

        if (this.autoReconnect && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('Failed to initiate Rosbridge connection:', err);
    }
  }

  disconnect() {
    this.autoReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {
        console.warn('Error closing Rosbridge socket:', err);
      }
      this.ws = null;
    }
    this.isConnected = false;
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  sendSubscribeOp(topic, type) {
    const payload = {
      op: 'subscribe',
      topic,
    };
    if (type) payload.type = type;
    return this.send(payload);
  }

  subscribe(topic, type, callback) {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      this.sendSubscribeOp(topic, type);
    }
    this.subscriptions.get(topic).add(callback);

    // Return unbind function
    return () => this.unsubscribe(topic, callback);
  }

  unsubscribe(topic, callback) {
    const listeners = this.subscriptions.get(topic);
    if (!listeners) return;

    if (callback) {
      listeners.delete(callback);
    }

    if (!callback || listeners.size === 0) {
      this.subscriptions.delete(topic);
      this.send({
        op: 'unsubscribe',
        topic,
      });
    }
  }

  publish(topic, type, msg) {
    return this.send({
      op: 'publish',
      topic,
      type,
      msg,
    });
  }

  publishGoal(x, y, yaw = 0) {
    const msg = createGoalPoseMsg(x, y, yaw);
    return this.publish(ROS_TOPICS.GOAL_POSE, ROS_MSG_TYPES.POSE_STAMPED, msg);
  }

  publishCmdVel(linearX = 0, angularZ = 0) {
    const msg = createCmdVelMsg(linearX, angularZ);
    return this.publish(ROS_TOPICS.CMD_VEL, ROS_MSG_TYPES.TWIST, msg);
  }
}
