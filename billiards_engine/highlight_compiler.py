"""
Highlight compiler — assembles confirmed goal events into a cinematic reel.

For each goal three segments are rendered and concatenated:
  1. WIDE      — full-resolution approach shot (pre_wide s before → post_wide s after)
  2. ZOOM      — 2.5× crop centred on the pocket, slow-motion (repeat each frame
                 slo_factor times), covering slo_pre s before → slo_post s after
  3. TRAIL     — full frame with a glowing pocket marker and "GOAL" overlay,
                 held for hold_s seconds as a "replay card"

Title cards with goal number and pocket label are inserted between goals.

Usage
-----
  from billiards_engine.highlight_compiler import compile_highlights
  compile_highlights(video_path, events_dir, output_path)

  # or CLI:
  python -m billiards_engine.highlight_compiler \
      --video  billiards_dataset/realgame-1/IMG_5253/IMG_5253.mp4 \
      --events billiards_dataset/realgame-1/events/IMG_5253 \
      --output highlights.mp4
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np


# ── Segment timing (seconds) ─────────────────────────────────────────────────
PRE_WIDE  = 4.0   # full-frame approach
POST_WIDE = 2.0
SLO_PRE   = 1.5   # slow-motion pocket zoom
SLO_POST  = 1.2
SLO_FACTOR = 3    # repeat each frame N times (3× slower)
HOLD_S    = 1.5   # goal-card hold time
ZOOM      = 2.8   # zoom multiplier for pocket close-up
TITLE_S   = 2.0   # inter-goal title card duration


# ── Helpers ───────────────────────────────────────────────────────────────────

def _text_card(width: int, height: int, lines: List[str], colors: List[tuple], fps: float, duration_s: float) -> List[np.ndarray]:
    """Return a list of identical dark-background text frames."""
    n_frames = max(1, int(fps * duration_s))
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    frame[:] = (18, 18, 18)

    y0 = height // 2 - (len(lines) - 1) * 38
    for i, (line, col) in enumerate(zip(lines, colors)):
        scale = 1.6 if i == 0 else 0.9
        thick = 3   if i == 0 else 1
        (tw, th), _ = cv2.getTextSize(line, cv2.FONT_HERSHEY_SIMPLEX, scale, thick)
        x = (width - tw) // 2
        y = y0 + i * 76
        cv2.putText(frame, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, col, thick, cv2.LINE_AA)

    return [frame.copy() for _ in range(n_frames)]


def _pocket_zoom_crop(frame: np.ndarray, cx: int, cy: int, zoom: float) -> np.ndarray:
    """Crop a zoom × zoom box centred on (cx, cy) and resize to original dims."""
    h, w = frame.shape[:2]
    half_w = int(w / (2 * zoom))
    half_h = int(h / (2 * zoom))
    x1 = max(0, cx - half_w)
    y1 = max(0, cy - half_h)
    x2 = min(w, cx + half_w)
    y2 = min(h, cy + half_h)
    crop = frame[y1:y2, x1:x2]
    return cv2.resize(crop, (w, h), interpolation=cv2.INTER_LINEAR)


def _annotate_frame(
    frame: np.ndarray,
    frame_id: int,
    fps: float,
    label: str,
    cx: int,
    cy: int,
    is_goal_frame: bool,
    segment_tag: str,
) -> np.ndarray:
    out = frame.copy()
    h, w = out.shape[:2]
    ts = frame_id / fps

    # Dark top bar
    ov = out.copy()
    cv2.rectangle(ov, (0, 0), (w, 40), (12, 12, 12), -1)
    cv2.addWeighted(ov, 0.65, out, 0.35, 0, out)

    goal_color = (0, 60, 255) if is_goal_frame else (200, 200, 200)
    tag = f"GOAL! {label}" if is_goal_frame else f"{segment_tag}  {label}"
    cv2.putText(out, f"Frame {frame_id}  {ts:.2f}s  [{tag}]",
                (12, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.62, goal_color, 1, cv2.LINE_AA)

    # Pocket marker
    r = 40 if is_goal_frame else 28
    color = (0, 60, 255) if is_goal_frame else (0, 200, 80)
    thick = 3 if is_goal_frame else 2
    cv2.circle(out, (cx, cy), r, color, thick)
    cv2.circle(out, (cx, cy), 4, color, -1)

    if is_goal_frame:
        cv2.rectangle(out, (3, 3), (w - 3, h - 3), (0, 60, 255), 3)

    return out


# ── Core ──────────────────────────────────────────────────────────────────────

def compile_highlights(
    video_path: str,
    events_dir: str,
    output_path: str,
    pre_wide: float    = PRE_WIDE,
    post_wide: float   = POST_WIDE,
    slo_pre: float     = SLO_PRE,
    slo_post: float    = SLO_POST,
    slo_factor: int    = SLO_FACTOR,
    hold_s: float      = HOLD_S,
    zoom: float        = ZOOM,
    title_s: float     = TITLE_S,
    rois_path: Optional[str] = None,
) -> str:
    """
    Compile all goals in events_dir/goals.json into a highlight reel.

    Returns the path to the output video.
    """
    goals_json = Path(events_dir) / "goals.json"
    if not goals_json.exists():
        sys.exit(f"goals.json not found: {goals_json}")

    with open(goals_json) as fh:
        goals = json.load(fh)

    if not goals:
        sys.exit("No goals in goals.json — nothing to compile.")

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        sys.exit(f"Cannot open video: {video_path}")

    fps    = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total  = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    print(f"\n  Video: {total} frames @ {fps:.2f}fps  ({width}×{height})")
    print(f"  Goals: {len(goals)}")

    writer = cv2.VideoWriter(
        output_path,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps, (width, height),
    )

    # Load pocket ROI centres for zoom targeting (optional)
    pocket_centers: dict = {}   # label → (cx, cy)
    if rois_path and os.path.isfile(rois_path):
        with open(rois_path) as fh:
            for r in json.load(fh):
                pocket_centers[r["label"]] = (r["cx"], r["cy"])

    # ── Opening title card ────────────────────────────────────────────────
    for frm in _text_card(
        width, height,
        ["HIGHLIGHTS", f"{len(goals)} Goal{'s' if len(goals)>1 else ''}"],
        [(255, 255, 255), (160, 160, 160)],
        fps, title_s,
    ):
        writer.write(frm)

    # ── Per-goal segments ─────────────────────────────────────────────────
    cap = cv2.VideoCapture(video_path)

    for g_idx, goal in enumerate(goals):
        label    = goal["pocket"]
        ev_frame = int(goal["frame"])
        ev_time  = goal["time_s"]
        cx, cy   = pocket_centers.get(label, (width // 2, height // 2))

        print(f"\n  Goal {g_idx+1}/{len(goals)}: {label}  frame={ev_frame}  t={ev_time:.1f}s")

        # ── Title card ────────────────────────────────────────────────────
        for frm in _text_card(
            width, height,
            [f"GOAL {g_idx+1}", label, f"t = {ev_time:.1f}s"],
            [(0, 80, 255), (255, 255, 255), (140, 140, 140)],
            fps, title_s,
        ):
            writer.write(frm)

        # ── Segment 1: WIDE ───────────────────────────────────────────────
        start_f = max(0, ev_frame - int(fps * pre_wide))
        end_f   = min(total - 1, ev_frame + int(fps * post_wide))
        _write_segment(
            cap, writer, fps, start_f, end_f, ev_frame,
            label, cx, cy, zoom=1.0, slo=1, tag="WIDE",
        )

        # ── Segment 2: ZOOM slow-motion ───────────────────────────────────
        start_f = max(0, ev_frame - int(fps * slo_pre))
        end_f   = min(total - 1, ev_frame + int(fps * slo_post))
        _write_segment(
            cap, writer, fps, start_f, end_f, ev_frame,
            label, cx, cy, zoom=zoom, slo=slo_factor, tag="ZOOM  SLO-MO",
        )

        # ── Hold card: freeze on goal frame ───────────────────────────────
        cap.set(cv2.CAP_PROP_POS_FRAMES, ev_frame)
        ret, freeze = cap.read()
        if ret:
            annotated = _annotate_frame(freeze, ev_frame, fps, label, cx, cy,
                                        is_goal_frame=True, segment_tag="GOAL")
            zoomed = _pocket_zoom_crop(annotated, cx, cy, zoom)
            n_hold = max(1, int(fps * hold_s))
            for _ in range(n_hold):
                writer.write(zoomed)

    cap.release()
    writer.release()
    print(f"\n  Highlight reel → {output_path}")
    return output_path


def _write_segment(
    cap: cv2.VideoCapture,
    writer: cv2.VideoWriter,
    fps: float,
    start_f: int,
    end_f: int,
    ev_frame: int,
    label: str,
    cx: int, cy: int,
    zoom: float,
    slo: int,
    tag: str,
):
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
    for fid in range(start_f, end_f + 1):
        ret, frame = cap.read()
        if not ret:
            break
        is_goal = (fid == ev_frame)
        out = _annotate_frame(frame, fid, fps, label, cx, cy, is_goal, tag)
        if zoom > 1.0:
            out = _pocket_zoom_crop(out, cx, cy, zoom)
        repeat = slo if not is_goal else max(slo, int(fps * 0.8))
        for _ in range(repeat):
            writer.write(out)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main(argv=None):
    parser = argparse.ArgumentParser(description="Compile billiards goal highlights")
    parser.add_argument("--video",   required=True, help="Path to source video (.mp4)")
    parser.add_argument("--events",  required=True, help="Path to events/<clip> folder containing goals.json")
    parser.add_argument("--output",  default=None,  help="Output path (default: events_dir/highlights.mp4)")
    parser.add_argument("--rois",    default=None,  help="Path to pocket_rois.json")
    parser.add_argument("--zoom",    type=float, default=ZOOM)
    parser.add_argument("--slo",     type=int,   default=SLO_FACTOR, help="Slow-motion repeat factor")
    args = parser.parse_args(argv)

    out = args.output or str(Path(args.events) / "highlights.mp4")
    compile_highlights(
        video_path  = args.video,
        events_dir  = args.events,
        output_path = out,
        zoom        = args.zoom,
        slo_factor  = args.slo,
        rois_path   = args.rois,
    )


if __name__ == "__main__":
    main()
