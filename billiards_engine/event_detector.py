"""
Event detection module.

Detects four event types from track trajectories:

  1. shot_start   — cue ball velocity spikes relative to its recent baseline
  2. collision    — two balls come within contact distance and exchange velocity
  3. pocket       — a ball disappears near one of the 6 pocket regions
  4. rail_hit     — a ball's velocity component reverses near the table boundary

Each event is a dict compatible with the JSON output schema:
  { "type": str, "frame": int, "ball": int }           (shot_start, pocket, rail_hit)
  { "type": "collision", "frame": int, "balls": [a, b] }
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import numpy as np

from .tracker import Track
from .trajectory_builder import TrajectoryBuilder


# ---------------------------------------------------------------------------
# Table geometry helpers
# ---------------------------------------------------------------------------

def build_pocket_regions(
    table_x: int, table_y: int, table_w: int, table_h: int, pocket_radius: int = 30
) -> List[Tuple[float, float, float]]:
    """
    Return 6 pocket (cx, cy, radius) tuples for a standard billiard table.

    Pocket openings sit INSIDE the cushion rails, not at the bounding-box edge.
    We apply an inset so the pocket centers land on the actual hole openings:
      - Corner pockets: inset by ~5% of the table dimension on each axis
      - Side pockets  : inset by ~3% on y only (they're at the long-rail midpoint)

    NOTE: The dataset does not annotate pocket locations.  These are estimated
    heuristics — adjust `corner_inset_*` if your footage differs.
    """
    cx_inset = int(table_w * 0.05)   # ~5% inward from left/right bounding edge
    cy_inset = int(table_h * 0.06)   # ~6% inward from top/bottom bounding edge
    side_cy_inset = int(table_h * 0.03)  # side pockets closer to rail midpoint

    x0 = float(table_x + cx_inset)
    x1 = float(table_x + table_w - cx_inset)
    xm = float(table_x + table_w / 2)

    y0 = float(table_y + cy_inset)
    y1 = float(table_y + table_h - cy_inset)
    ym_top = float(table_y + side_cy_inset)
    ym_bot = float(table_y + table_h - side_cy_inset)

    r = float(pocket_radius)
    return [
        (x0, y0,      r),   # top-left corner
        (xm, ym_top,  r),   # top-mid (side pocket)
        (x1, y0,      r),   # top-right corner
        (x0, y1,      r),   # bottom-left corner
        (xm, ym_bot,  r),   # bottom-mid (side pocket)
        (x1, y1,      r),   # bottom-right corner
    ]


def near_pocket(
    cx: float, cy: float,
    pockets: List[Tuple[float, float, float]],
) -> bool:
    for px, py, pr in pockets:
        if np.hypot(cx - px, cy - py) <= pr:
            return True
    return False


# ---------------------------------------------------------------------------
# Event detector
# ---------------------------------------------------------------------------

class EventDetector:
    """
    Stateful event detector — call update() once per frame.

    Parameters
    ----------
    table_bbox : (x, y, w, h)
        Table bounding box in pixel coordinates.
    fps : float
        Video frame rate (used to express event timestamps in seconds).
    shot_spike_factor : float
        Cue ball speed must exceed `factor × recent_mean` to trigger shot_start.
    shot_min_speed : float
        Cue ball minimum absolute speed (px/s) to avoid triggering on noise.
    collision_dist_factor : float
        Two balls are considered in contact when distance < factor × avg_diameter.
    rail_margin : int
        Distance (px) from table edge within which a rail hit can be detected.
    pocket_radius : int
        Radius (px) of each pocket region.
    cooldown_frames : int
        Minimum frames between two of the same event type for the same ball.
    """

    def __init__(
        self,
        table_bbox: Tuple[int, int, int, int],
        fps: float = 30.0,
        avg_ball_diameter: float = 18.0,
        shot_spike_factor: float = 3.0,
        shot_min_speed: float = 30.0,
        collision_dist_factor: float = 2.0,
        rail_margin: int = 25,
        pocket_radius: int = 35,
        cooldown_frames: int = 15,
        pocket_override: Optional[List[Tuple[float, float, float]]] = None,
    ):
        self.table_x, self.table_y, self.table_w, self.table_h = table_bbox
        self.fps = fps
        self.avg_ball_diameter = avg_ball_diameter
        self.shot_spike_factor = shot_spike_factor
        self.shot_min_speed = shot_min_speed
        self.collision_dist = collision_dist_factor * avg_ball_diameter
        self.rail_margin = rail_margin
        self.cooldown_frames = cooldown_frames

        # Use user-annotated pocket positions if provided, else estimate
        if pocket_override is not None:
            self.pockets = list(pocket_override)
        else:
            self.pockets = build_pocket_regions(
                self.table_x, self.table_y, self.table_w, self.table_h,
                pocket_radius=pocket_radius,
            )

        # Track last-seen positions for pocket detection
        self._last_pos: Dict[int, Tuple[float, float]] = {}

        # Cooldown: {(event_type, ball_id): last_frame_fired}
        self._cooldown: Dict[Tuple[str, int], int] = {}

        # Tracks that disappeared — candidates for pocket events
        self._disappeared: Dict[int, Tuple[int, float, float]] = {}  # id->(frame, cx, cy)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update(
        self,
        active_tracks: List[Track],
        all_track_ids: List[int],
        frame_id: int,
        traj: TrajectoryBuilder,
    ) -> List[Dict]:
        """
        Run all detectors for this frame. Returns list of event dicts.
        active_tracks — tracks currently visible.
        all_track_ids — all known track IDs (for disappearance detection).
        """
        events: List[Dict] = []
        active_ids = {t.id for t in active_tracks}

        # Update last-known positions and find disappeared tracks
        newly_disappeared = []
        for tid in all_track_ids:
            if tid not in active_ids:
                if tid in self._last_pos and tid not in self._disappeared:
                    cx, cy = self._last_pos[tid]
                    self._disappeared[tid] = (frame_id, cx, cy)
                    newly_disappeared.append(tid)

        for tid, (frame_gone, cx, cy) in list(self._disappeared.items()):
            if tid in active_ids:
                del self._disappeared[tid]  # reappeared — not a pocket

        # --- Pocket events ---
        for tid in newly_disappeared:
            frame_gone, cx, cy = self._disappeared[tid]
            if near_pocket(cx, cy, self.pockets):
                ev = {"type": "pocket", "frame": frame_gone, "ball": tid,
                      "time_s": round(frame_gone / self.fps, 3)}
                if self._check_cooldown("pocket", tid, frame_gone):
                    events.append(ev)
                    self._print_event(ev)

        # Per-active-track events
        for track in active_tracks:
            cx, cy = track.cx, track.cy
            self._last_pos[track.id] = (cx, cy)

            # --- Shot start ---
            if track.is_cue_ball():
                ev = self._check_shot_start(track, frame_id, traj)
                if ev:
                    events.append(ev)
                    self._print_event(ev)

            # --- Rail hit ---
            ev = self._check_rail_hit(track, frame_id, traj)
            if ev:
                events.append(ev)
                self._print_event(ev)

        # --- Collisions ---
        collision_evs = self._check_collisions(active_tracks, frame_id, traj)
        for ev in collision_evs:
            events.append(ev)
            self._print_event(ev)

        return events

    # ------------------------------------------------------------------
    # Individual detectors
    # ------------------------------------------------------------------

    def _check_shot_start(
        self, track: Track, frame_id: int, traj: TrajectoryBuilder
    ) -> Optional[Dict]:
        """Cue ball velocity spike detection."""
        current_speed = traj.speed(track)
        if current_speed < self.shot_min_speed:
            return None

        recent = traj.recent_speeds(track, n=15)
        if len(recent) < 5:
            return None

        # Baseline = mean of older speeds (exclude the last 3)
        baseline = float(np.mean(recent[:-3])) if len(recent) > 3 else 0.0
        if baseline < 1.0:
            # Was nearly stationary — any motion above min_speed counts
            if current_speed >= self.shot_min_speed:
                if self._check_cooldown("shot_start", track.id, frame_id):
                    return {
                        "type": "shot_start",
                        "frame": frame_id,
                        "ball": track.id,
                        "time_s": round(frame_id / self.fps, 3),
                        "speed_px_s": round(current_speed, 1),
                    }
        elif current_speed >= self.shot_spike_factor * baseline:
            if self._check_cooldown("shot_start", track.id, frame_id):
                return {
                    "type": "shot_start",
                    "frame": frame_id,
                    "ball": track.id,
                    "time_s": round(frame_id / self.fps, 3),
                    "speed_px_s": round(current_speed, 1),
                }
        return None

    def _check_rail_hit(
        self, track: Track, frame_id: int, traj: TrajectoryBuilder
    ) -> Optional[Dict]:
        """Ball near table boundary with velocity direction reversal."""
        cx, cy = track.cx, track.cy
        m = self.rail_margin
        tx, ty, tw, th = self.table_x, self.table_y, self.table_w, self.table_h

        near_left   = cx < tx + m
        near_right  = cx > tx + tw - m
        near_top    = cy < ty + m
        near_bottom = cy > ty + th - m

        near_rail = near_left or near_right or near_top or near_bottom
        if not near_rail:
            return None

        # Check velocity reversal: compare recent vs older direction
        vels = track.velocities
        if len(vels) < 4:
            return None

        _, vx_new, vy_new = vels[-1]
        _, vx_old, vy_old = vels[-3]

        # Check for sign flip on the relevant axis
        x_flip = (near_left or near_right) and (vx_new * vx_old < 0)
        y_flip = (near_top or near_bottom) and (vy_new * vy_old < 0)

        if x_flip or y_flip:
            speed = float(np.hypot(vx_new, vy_new))
            if speed > 10.0 and self._check_cooldown("rail_hit", track.id, frame_id):
                return {
                    "type": "rail_hit",
                    "frame": frame_id,
                    "ball": track.id,
                    "time_s": round(frame_id / self.fps, 3),
                }
        return None

    def _check_collisions(
        self, active_tracks: List[Track], frame_id: int, traj: TrajectoryBuilder
    ) -> List[Dict]:
        """Pairwise distance + velocity-transfer check."""
        events: List[Dict] = []
        n = len(active_tracks)
        for i in range(n):
            for j in range(i + 1, n):
                a, b = active_tracks[i], active_tracks[j]
                dist = float(np.hypot(a.cx - b.cx, a.cy - b.cy))
                if dist > self.collision_dist:
                    continue

                # Verify velocity change for at least one ball
                speed_a = traj.speed(a)
                speed_b = traj.speed(b)
                prev_speeds_a = traj.recent_speeds(a, n=5)
                prev_speeds_b = traj.recent_speeds(b, n=5)
                mean_a = float(np.mean(prev_speeds_a[:-1])) if len(prev_speeds_a) > 1 else 0
                mean_b = float(np.mean(prev_speeds_b[:-1])) if len(prev_speeds_b) > 1 else 0

                velocity_transferred = (
                    abs(speed_a - mean_a) > 15 or abs(speed_b - mean_b) > 15
                )
                if not velocity_transferred:
                    continue

                key = f"collision_{min(a.id, b.id)}_{max(a.id, b.id)}"
                if self._check_cooldown(key, 0, frame_id):
                    events.append({
                        "type": "collision",
                        "frame": frame_id,
                        "balls": [a.id, b.id],
                        "time_s": round(frame_id / self.fps, 3),
                        "distance_px": round(dist, 1),
                    })
        return events

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def _check_cooldown(self, event_type: str, ball_id: int, frame_id: int) -> bool:
        """Returns True if allowed to fire (not in cooldown). Updates state."""
        key = (event_type, ball_id)
        last = self._cooldown.get(key, -9999)
        if frame_id - last >= self.cooldown_frames:
            self._cooldown[key] = frame_id
            return True
        return False

    @staticmethod
    def _print_event(ev: Dict):
        t = ev.get("time_s", "?")
        etype = ev["type"]
        frame = ev["frame"]
        if etype == "collision":
            balls = ev["balls"]
            dist = ev.get("distance_px", "?")
            print(f"  [frame {frame:4d} | {t:6.2f}s]  COLLISION   balls={balls}  dist={dist}px")
        elif etype == "pocket":
            print(f"  [frame {frame:4d} | {t:6.2f}s]  POCKET      ball={ev['ball']}")
        elif etype == "shot_start":
            spd = ev.get("speed_px_s", "?")
            print(f"  [frame {frame:4d} | {t:6.2f}s]  SHOT START  ball={ev['ball']}  speed={spd}px/s")
        elif etype == "rail_hit":
            print(f"  [frame {frame:4d} | {t:6.2f}s]  RAIL HIT    ball={ev['ball']}")
