"""
Goal detector — approach-zone gated, felt-motion constrained.

Core insight
------------
A ball rolling into a pocket travels ACROSS THE FELT first.
A person's arm/jacket enters the pocket ROI from OUTSIDE the table.

Algorithm per pocket:
  1. Background model: median of first N quiet frames.
  2. Pocket ROI  — small circle centred on the pocket hole.
  3. Approach zone — circle of felt just INSIDE the table from the pocket
     (shifted toward the table centre by `approach_offset` pixels).
     Only ball-sized motion on the felt reaches this zone.
  4. Goal state machine:
       IDLE → PRIMED  when approach zone sees activity > approach_threshold
                       (a ball is rolling toward this pocket on the felt)
       PRIMED → ENTERING  when pocket ROI activity > enter_threshold
                            (ball reached the pocket edge)
       ENTERING → GOAL   when pocket ROI activity drops < exit_threshold
                            (ball fell in)
  5. Extra guard: peak_activity in the pocket ROI must be ≥ peak_ratio ×
     idle baseline (rejects slow gradual drifts).

This means a jacket dropped onto the pocket without any prior felt-side motion
can NEVER trigger a goal — there is no approach-zone activity first.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import List, Optional, Tuple

import cv2
import numpy as np


class _State(Enum):
    IDLE     = auto()
    PRIMED   = auto()   # approach zone lit up — ball heading toward pocket
    ENTERING = auto()   # ball visible in the pocket ROI


@dataclass
class GoalEvent:
    pocket_idx:    int
    label:         str
    frame_id:      int
    peak_activity: float


@dataclass
class _PocketTracker:
    idx:              int
    label:            str
    roi:              dict           # pocket ROI  {cx,cy,radius,x,y,w,h}
    approach_roi:     dict           # felt-side approach zone
    background:       Optional[np.ndarray] = None
    approach_bg:      Optional[np.ndarray] = None
    state:            _State = _State.IDLE
    peak_activity:    float  = 0.0
    entry_frame:      int    = 0
    primed_frame:     int    = 0
    cooldown_until:   int    = 0
    _baseline_at_entry: float = 0.0


def _build_approach_roi(pocket_roi: dict, table_cx: float, table_cy: float,
                        offset: int, radius: int) -> dict:
    """
    Shift the pocket centre toward the table centre by `offset` pixels.
    Returns a new ROI dict for the approach zone on the felt.
    """
    cx, cy = pocket_roi["cx"], pocket_roi["cy"]
    dx, dy = table_cx - cx, table_cy - cy
    dist = max(np.hypot(dx, dy), 1.0)
    # Unit vector toward table centre
    ux, uy = dx / dist, dy / dist
    acx = int(cx + ux * offset)
    acy = int(cy + uy * offset)
    return {
        "cx": acx, "cy": acy, "radius": radius,
        "x": acx - radius, "y": acy - radius,
        "w": radius * 2,   "h": radius * 2,
    }


class GoalDetector:
    """
    Parameters
    ----------
    rois : list of pocket dicts {label, cx, cy, radius, x, y, w, h}
    background_frames : int
    enter_threshold : float  — MAD to confirm ball is at pocket edge
    exit_threshold  : float  — MAD below which ball has fallen in
    approach_threshold : float — MAD in the felt approach zone to PRIME the pocket
    approach_offset : int    — pixels from pocket toward table centre for approach zone
    approach_radius : int    — radius of the approach zone circle (px)
    approach_window : int    — frames approach zone must stay lit before priming
    prime_ttl       : int    — frames PRIMED state stays valid (ball must reach pocket)
    min_entry_frames / max_entry_frames : int
    cooldown_frames : int
    peak_ratio : float
    """

    def __init__(
        self,
        rois:               List[dict],
        background_frames:  int   = 45,
        enter_threshold:    float = 20.0,
        exit_threshold:     float = 10.0,
        approach_threshold: float = 12.0,
        approach_offset:    int   = 90,    # px toward table centre from pocket
        approach_radius:    int   = 40,    # felt-side zone radius
        approach_window:    int   = 2,     # consecutive frames to confirm approach
        prime_ttl:          int   = 60,    # frames PRIMED state is valid (~2s)
        min_entry_frames:   int   = 2,
        max_entry_frames:   int   = 30,
        cooldown_frames:    int   = 90,
        peak_ratio:         float = 2.0,
    ):
        # Compute table centre as mean of pocket centres
        cxs = [r["cx"] for r in rois]
        cys = [r["cy"] for r in rois]
        table_cx = float(np.mean(cxs))
        table_cy = float(np.mean(cys))

        self._trackers = []
        for i, r in enumerate(rois):
            aroi = _build_approach_roi(r, table_cx, table_cy, approach_offset, approach_radius)
            self._trackers.append(
                _PocketTracker(idx=i, label=r["label"], roi=r, approach_roi=aroi)
            )

        self._bg_frames       = background_frames
        self._enter_thr       = enter_threshold
        self._exit_thr        = exit_threshold
        self._approach_thr    = approach_threshold
        self._approach_window = approach_window
        self._prime_ttl       = prime_ttl
        self._min_entry       = min_entry_frames
        self._max_entry       = max_entry_frames
        self._cooldown        = cooldown_frames
        self._peak_ratio      = peak_ratio

        self._bg_buffer:  List[List[np.ndarray]] = [[] for _ in rois]
        self._abg_buffer: List[List[np.ndarray]] = [[] for _ in rois]
        self._bg_built = False

        # Rolling approach-zone activity per pocket (for the windowed check)
        self._approach_buf: List[deque] = [
            deque(maxlen=approach_window) for _ in rois
        ]

        self.activity_log: List[List[float]] = [[] for _ in rois]
        self._baseline: List[deque] = [deque(maxlen=60) for _ in rois]

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def pocket_states(self):
        """Return list of (state_name, pocket_act, approach_act, approach_roi) per pocket."""
        return [
            (pt.state.name,
             self.activity_log[pt.idx][-1] if self.activity_log[pt.idx] else 0.0,
             self._approach_buf[pt.idx][-1] if self._approach_buf[pt.idx] else 0.0,
             pt.approach_roi)
            for pt in self._trackers
        ]

    def process_frame(self, frame: np.ndarray, frame_id: int) -> List[GoalEvent]:
        events: List[GoalEvent] = []

        for pt in self._trackers:
            roi_img  = self._crop(frame, pt.roi)
            aroi_img = self._crop(frame, pt.approach_roi)

            # ── Background accumulation ───────────────────────────────────
            if not self._bg_built:
                self._bg_buffer[pt.idx].append(roi_img.astype(np.float32))
                self._abg_buffer[pt.idx].append(aroi_img.astype(np.float32))
                if len(self._bg_buffer[pt.idx]) >= self._bg_frames:
                    pt.background   = np.median(
                        np.stack(self._bg_buffer[pt.idx]), axis=0).astype(np.float32)
                    pt.approach_bg  = np.median(
                        np.stack(self._abg_buffer[pt.idx]), axis=0).astype(np.float32)
                continue

            if pt.background is None or pt.approach_bg is None:
                continue

            # ── Pocket ROI activity ───────────────────────────────────────
            pocket_diff = np.abs(roi_img.astype(np.float32) - pt.background)
            pocket_act  = float(pocket_diff.mean())
            self.activity_log[pt.idx].append(pocket_act)

            # ── Approach zone activity (felt-side motion) ─────────────────
            app_diff = np.abs(aroi_img.astype(np.float32) - pt.approach_bg)
            app_act  = float(app_diff.mean())
            self._approach_buf[pt.idx].append(app_act)
            approach_lit = all(a >= self._approach_thr
                               for a in self._approach_buf[pt.idx])

            # Rolling baseline (idle frames only)
            if pt.state == _State.IDLE and frame_id >= pt.cooldown_until:
                self._baseline[pt.idx].append(pocket_act)
            baseline = (float(np.median(self._baseline[pt.idx]))
                        if self._baseline[pt.idx] else 0.0)

            if frame_id < pt.cooldown_until:
                continue

            # ── State machine ─────────────────────────────────────────────
            if pt.state == _State.IDLE:
                if approach_lit:
                    pt.state       = _State.PRIMED
                    pt.primed_frame = frame_id

            elif pt.state == _State.PRIMED:
                # Keep approach zone active while ball is rolling
                if approach_lit:
                    pt.primed_frame = frame_id   # refresh TTL

                # Expire if ball never arrived
                if frame_id - pt.primed_frame > self._prime_ttl:
                    pt.state = _State.IDLE
                    continue

                if pocket_act >= self._enter_thr:
                    pt.state             = _State.ENTERING
                    pt.entry_frame       = frame_id
                    pt.peak_activity     = pocket_act
                    pt._baseline_at_entry = baseline
                    print(f"    [enter] {pt.label} f={frame_id} pocket={pocket_act:.1f} approach={app_act:.1f}")

            elif pt.state == _State.ENTERING:
                pt.peak_activity = max(pt.peak_activity, pocket_act)
                frames_in = frame_id - pt.entry_frame

                if frames_in > self._max_entry:
                    pt.state = _State.IDLE
                    continue

                if pocket_act < self._exit_thr and frames_in >= self._min_entry:
                    b = max(pt._baseline_at_entry, 1.0)
                    if self._peak_ratio > 0 and pt.peak_activity < self._peak_ratio * b:
                        print(f"    [reject] {pt.label} peak_ratio too low ({pt.peak_activity:.1f} / {b:.1f})")
                        pt.state = _State.IDLE
                        continue

                    ev = GoalEvent(
                        pocket_idx    = pt.idx,
                        label         = pt.label,
                        frame_id      = frame_id,
                        peak_activity = round(pt.peak_activity, 1),
                    )
                    events.append(ev)
                    print(f"    [GOAL] {pt.label} f={frame_id} peak={pt.peak_activity:.1f}")
                    pt.state          = _State.IDLE
                    pt.cooldown_until = frame_id + self._cooldown

                elif pocket_act < self._exit_thr:
                    pt.state = _State.IDLE

        if not self._bg_built and all(
            pt.background is not None for pt in self._trackers
        ):
            self._bg_built = True
            print(f"    Background model built ({self._bg_frames} frames)")

        return events

    # ------------------------------------------------------------------ #

    @staticmethod
    def _crop(frame: np.ndarray, roi: dict) -> np.ndarray:
        x, y, w, h = roi["x"], roi["y"], roi["w"], roi["h"]
        fh, fw = frame.shape[:2]
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(fw, x + w), min(fh, y + h)
        return frame[y1:y2, x1:x2]
