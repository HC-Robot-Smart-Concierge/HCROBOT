import unittest
import math
import numpy as np


def icp_2d_step(current_pts, prev_pts, max_iter=25, tol=1e-4, max_assoc_dist=0.35):
    """
    2D Point-to-Point ICP using SVD for scan-to-scan Laser Odometry.
    Returns: (dx_local, dy_local, d_theta_rad)
    """
    if current_pts is None or prev_pts is None or len(current_pts) < 15 or len(prev_pts) < 15:
        return 0.0, 0.0, 0.0

    current_src = current_pts.copy()
    total_R = np.eye(2)
    total_t = np.zeros(2)

    max_dist_sq = max_assoc_dist * max_assoc_dist

    for _ in range(max_iter):
        dists_sq = np.sum((current_src[:, None, :] - prev_pts[None, :, :]) ** 2, axis=2)
        indices = np.argmin(dists_sq, axis=1)
        valid = dists_sq[np.arange(len(current_src)), indices] < max_dist_sq
        if np.sum(valid) < 12:
            break

        p = current_src[valid]
        q = prev_pts[indices[valid]]

        cp = np.mean(p, axis=0)
        cq = np.mean(q, axis=0)

        H = (p - cp).T @ (q - cq)
        U, S, Vt = np.linalg.svd(H)
        R = Vt.T @ U.T
        if np.linalg.det(R) < 0:
            Vt[1, :] *= -1
            R = Vt.T @ U.T
        t = cq - R @ cp

        current_src = (current_src @ R.T) + t
        total_R = R @ total_R
        total_t = R @ total_t + t

        d_theta = np.arctan2(R[1, 0], R[0, 0])
        if np.linalg.norm(t) < tol and abs(d_theta) < tol:
            break

    theta = np.arctan2(total_R[1, 0], total_R[0, 0])
    return float(total_t[0]), float(total_t[1]), float(theta)


class TestLaserOdometry(unittest.TestCase):
    def setUp(self):
        # 4 walls of 3x5m room: [-1.5, 1.5] x [-2.5, 2.5]
        w1 = np.array([[1.5, y] for y in np.linspace(-2.5, 2.5, 120)])
        w2 = np.array([[-1.5, y] for y in np.linspace(-2.5, 2.5, 120)])
        w3 = np.array([[x, 2.5] for x in np.linspace(-1.5, 1.5, 80)])
        w4 = np.array([[x, -2.5] for x in np.linspace(-1.5, 1.5, 80)])
        self.room_pts = np.vstack([w1, w2, w3, w4])

    def test_icp_translation_and_rotation(self):
        p0 = self.room_pts.copy()

        # Robot moves forward 6cm, lateral -2cm, rotates 4 degrees
        dx, dy, dth_deg = 0.06, -0.02, 4.0
        th_rad = math.radians(dth_deg)
        R = np.array([[math.cos(th_rad), -math.sin(th_rad)], [math.sin(th_rad), math.cos(th_rad)]])
        p1 = (self.room_pts - np.array([dx, dy])) @ R

        est_dx, est_dy, est_th = icp_2d_step(p1, p0)
        self.assertAlmostEqual(est_dx, dx, places=2)
        self.assertAlmostEqual(est_dy, dy, places=2)
        self.assertAlmostEqual(math.degrees(est_th), dth_deg, places=1)

    def test_icp_stationary_noise(self):
        p0 = self.room_pts.copy()
        # Add 3mm gaussian noise
        noise = np.random.normal(0, 0.003, p0.shape)
        p1 = p0 + noise

        est_dx, est_dy, est_th = icp_2d_step(p1, p0)
        # Should be below 3mm and 0.2 degrees
        self.assertLess(math.hypot(est_dx, est_dy), 0.005)
        self.assertLess(abs(math.degrees(est_th)), 0.2)

    def test_icp_empty_or_insufficient_points(self):
        p0 = np.array([[1.0, 2.0]])
        p1 = np.array([[1.0, 2.0]])
        dx, dy, th = icp_2d_step(p1, p0)
        self.assertEqual(dx, 0.0)
        self.assertEqual(dy, 0.0)
        self.assertEqual(th, 0.0)


if __name__ == "__main__":
    unittest.main()
