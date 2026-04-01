"""
Visualizer: draws trajectories, event markers, and pocket regions on frames.
Optionally writes an annotated video.

Color legend:
  - Cue ball (cat 1):  white circles + white trail
  - 8-ball (cat 2):    dark gray
  - Solid (cat 3):     orange
  - Striped (cat 4):   cyan
  - Unknown (cat 0):   yellow

Event flash colours:
  - shot_start: bright cyan ring
  - collision:  magenta ring
  - pocket:     bright green ring
  - rail_hit:   orange ring
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from .tracker import Track

_CAT_COLORS: Dict[int, Tuple[int, int, int]] = {
    0: (0, 220, 220),    # unknown  — yellow
    1: (255, 255, 255),  # cue ball — white
    2: (100, 100, 100),  # 8-ball   — gray
    3: (0, 140, 255),    # solid    — orange
    4: (255, 200, 0),    # striped  — cyan-ish
}

_EVENT_COLORS: Dict[str, Tuple[int, int, int]] = {
    "shot_start": (255, 255, 0),    # cyan
    "collision":  (255, 0, 255),    # magenta
    "pocket":     (0, 255, 60),     # green
    "rail_hit":   (0, 165, 255),    # orange
}

_TRAIL_LENGTH = 30


class Visualizer:
    """
    Parameters
    ----------
    detector : EventDetector
        Needed to draw pocket regions and table boundary.
    trail_length : int
        Number of past positions to show as a fading trail.
    """

    def __init__(self, detector, trail_length: int = _TRAIL_LENGTH):
        self.detector = detector
        self.trail_length = trail_length
        # (expire_frame, event_dict) — keep event markers on screen briefly
        self._flash: List[Tuple[int, Dict]] = []

    def draw(
        self,
        frame: np.ndarray,
        frame_id: int,
        active_tracks: List[Track],
        new_events: List[Dict],
        fps: float,
    ) -> np.ndarray:
        out = frame.copy()

        # Register new events
        flash_duration = max(int(fps * 1.2), 20)   # ~1.2 s
        for ev in new_events:
            self._flash.append((frame_id + flash_duration, ev))

        # Expire old events
        self._flash = [(exp, ev) for exp, ev in self._flash if frame_id <= exp]

        # ── Table boundary ───────────────────────────────────────────────
        tx, ty, tw, th = (
            self.detector.table_x, self.detector.table_y,
            self.detector.table_w, self.detector.table_h,
        )
        cv2.rectangle(out, (tx, ty), (tx + tw, ty + th), (180, 180, 180), 2)

        # ── Pocket circles ───────────────────────────────────────────────
        for px, py, pr in self.detector.pockets:
            cv2.circle(out, (int(px), int(py)), int(pr), (0, 200, 80), 2)

        # ── Ball trajectories + markers ──────────────────────────────────
        for track in active_tracks:
            color = _CAT_COLORS.get(track.category, _CAT_COLORS[0])
            positions = track.positions[-self.trail_length:]
            n = len(positions)

            # Fading trail
            for k in range(1, n):
                _, x0, y0 = positions[k - 1]
                _, x1, y1 = positions[k]
                alpha = (k / n) ** 0.7   # brighter toward current position
                c = tuple(int(ch * alpha) for ch in color)
                thickness = 2 if track.category == 1 else 1
                cv2.line(out, (int(x0), int(y0)), (int(x1), int(y1)), c, thickness)

            # Ball circle
            cx, cy = int(track.cx), int(track.cy)
            radius = 9
            cv2.circle(out, (cx, cy), radius, color, 2)

            # Filled dot for cue ball
            if track.category == 1:
                cv2.circle(out, (cx, cy), 4, color, -1)

            # Track ID label
            cv2.putText(
                out, str(track.id),
                (cx + 11, cy + 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, color, 1, cv2.LINE_AA,
            )

        # ── Event flash markers ──────────────────────────────────────────
        hud_lines: List[Tuple[str, Tuple[int, int, int]]] = []

        for _, ev in self._flash:
            etype = ev["type"]
            ec = _EVENT_COLORS.get(etype, (255, 255, 255))

            ball_ids = ev.get("balls", [ev["ball"]] if "ball" in ev else [])

            for tid in ball_ids:
                track = next((t for t in active_tracks if t.id == tid), None)
                pos = None
                if track:
                    pos = (int(track.cx), int(track.cy))
                elif etype == "pocket":
                    raw = self.detector._last_pos.get(tid)
                    if raw:
                        pos = (int(raw[0]), int(raw[1]))
                if pos:
                    cv2.circle(out, pos, 16, ec, 3)
                    # Arrow for pocket
                    if etype == "pocket":
                        for pocket in self.detector.pockets:
                            px, py, pr = pocket
                            if np.hypot(pos[0] - px, pos[1] - py) <= pr + 20:
                                cv2.arrowedLine(
                                    out, pos, (int(px), int(py)), ec, 2,
                                    tipLength=0.3,
                                )
                                break

            label = etype.upper().replace("_", " ")
            if etype == "collision":
                label += f"  balls {ev.get('balls', [])}"
            elif "ball" in ev:
                label += f"  #{ev['ball']}"
            hud_lines.append((label, ec))

        # ── HUD overlay (top-right) ──────────────────────────────────────
        if hud_lines:
            h_frame, w_frame = out.shape[:2]
            # Deduplicate (multiple flashes of same type)
            seen = set()
            unique_lines = []
            for text, c in hud_lines:
                if text not in seen:
                    seen.add(text)
                    unique_lines.append((text, c))

            for i, (text, c) in enumerate(unique_lines[:6]):
                y_pos = 22 + i * 20
                cv2.putText(
                    out, text,
                    (w_frame - 290, y_pos),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, c, 1, cv2.LINE_AA,
                )

        # ── Frame counter ────────────────────────────────────────────────
        ts = frame_id / fps
        cv2.putText(
            out, f"Frame {frame_id}  {ts:.2f}s",
            (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA,
        )
        # Active track count
        cv2.putText(
            out, f"Tracks: {len(active_tracks)}",
            (10, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1, cv2.LINE_AA,
        )

        return out


class VideoWriter:
    """Thin wrapper around cv2.VideoWriter."""

    def __init__(self, output_path: str, fps: float, width: int, height: int):
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        self._writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not self._writer.isOpened():
            raise RuntimeError(f"Cannot open output video: {output_path}")

    def write(self, frame: np.ndarray):
        self._writer.write(frame)

    def release(self):
        self._writer.release()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.release()
