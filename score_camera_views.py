"""
score_camera_views.py

For each goal event, score all 3 cameras on how clearly the goal pocket
is visible. Two components:
  1. Activity score  — mean frame-difference in the pocket ROI around the
                       event timestamp (motion = ball going in)
  2. Centering score — how close the pocket is to the frame centre
                       (centred = full view, not cut off at edge)

Final score = activity * centering (both 0-1, multiplicative)

Outputs the best camera per event + a ready-to-paste FG_EVENTS block.
"""

import cv2
import numpy as np

# ── Video files ───────────────────────────────────────────────────────────────
VIDEOS = {
    1: 'ours/IMG_1826.MOV',
    2: 'ours/IMG_5254.MOV',
    3: 'ours/IMG_7658 2.MOV',
}
CAM_ROLE = {1: 'Lateral', 2: 'Frontal', 3: 'Diagonal'}

# Each camera's time = lateral_time + offset
OFFSETS = {1: 0, 2: 11, 3: 6}

# ── Pocket position as fraction of frame (x, y) from top-left ────────────────
# CAM 1 positions calibrated from pocket_rois_cam1.json (frame ~1920×1080).
# CAM 2 / CAM 3 positions estimated: table occupies a similar region of each
# frame, with labels mirrored/rotated per camera perspective (see CSV).
POCKET_POS = {
    'top left':      (0.26, 0.30),   # CAM1 actual: cx=499,  cy=326
    'top center':    (0.51, 0.31),   # CAM1 actual: cx=984,  cy=339
    'top right':     (0.76, 0.33),   # CAM1 actual: cx=1466, cy=353
    'bottom left':   (0.06, 0.68),   # CAM1 actual: cx=119,  cy=729
    'bottom center': (0.51, 0.72),   # CAM1 actual: cx=971,  cy=779
    'bottom right':  (0.96, 0.73),   # CAM1 actual: cx=1841, cy=786
    # Labels used by frontal/diagonal cameras for side pockets
    'left center':   (0.10, 0.50),
    'right center':  (0.90, 0.50),
}

# ── Events: lateral timestamp + pocket label per camera ───────────────────────
# Pocket labels from "Pool Event Timestamps.csv"
EVENTS = [
    {'t':  32, 'type': 'goal',     'pocket': {1: 'bottom right',  2: 'bottom left',  3: 'top right'}},
    {'t':  90, 'type': 'goal',     'pocket': {1: 'bottom center', 2: 'left center',  3: 'right center'}},
    {'t': 195, 'type': 'goal',     'pocket': {1: 'bottom right',  2: 'bottom left',  3: 'top right'}},
    {'t': 347, 'type': 'goal',     'pocket': {1: 'top right',     2: 'bottom right', 3: 'top left'}},
    {'t': 347, 'type': 'scratch',  'pocket': {1: 'top right',     2: 'bottom right', 3: 'top left'}},
    {'t': 384, 'type': 'scratch',  'pocket': {1: 'bottom center', 2: 'left center',  3: 'right center'}},
    {'t': 414, 'type': 'goal',     'pocket': {1: 'bottom left',   2: 'top left',     3: 'bottom right'}},
    {'t': 502, 'type': 'scratch',  'pocket': {1: 'bottom left',   2: 'top left',     3: 'bottom right'}},
    {'t': 503, 'type': 'goal',     'pocket': {1: 'top left',      2: 'top right',    3: 'bottom left'}},
    {'t': 529, 'type': 'goal',     'pocket': {1: 'bottom center', 2: 'left center',  3: 'right center'}},
    {'t': 581, 'type': 'goal',     'pocket': {1: 'top left',      2: 'top right',    3: 'bottom left'}},
    {'t': 656, 'type': 'scratch',  'pocket': {1: 'top center',    2: 'right center', 3: 'left center'}},
    {'t': 680, 'type': 'goal',     'pocket': {1: 'top right',     2: 'bottom right', 3: 'top left'}},
    {'t': 693, 'type': 'goal',     'pocket': {1: 'top right',     2: 'bottom right', 3: 'top left'}},
    {'t': 720, 'type': 'goal',     'pocket': {1: 'bottom left',   2: 'top left',     3: 'bottom right'}},
    {'t': 957, 'type': 'game_over','pocket': {1: 'bottom right',  2: 'bottom left',  3: 'top right'}},
]

ANALYSIS_WINDOW_S = 3.0   # look at 3s window BEFORE the event (ball rolling in)
N_FRAMES          = 20    # frames to extract per camera per event
ROI_RADIUS_PX     = 80    # fixed pocket ROI radius in pixels (generous but focused)


def centering_score(pocket_label: str) -> float:
    """1.0 = pocket at frame centre, 0.0 = extreme corner."""
    pos = POCKET_POS.get(pocket_label)
    if pos is None:
        return 0.5
    fx, fy = pos
    dist = np.hypot(fx - 0.5, fy - 0.5)
    return float(1.0 - dist / np.hypot(0.5, 0.5))


def extract_frames(video_path: str, timestamp_s: float, n: int, window_s: float):
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"  [warn] could not open {video_path}")
        return []
    # Sample from window_s before event to 0.5s after — captures ball rolling in
    start_s = max(0, timestamp_s - window_s)
    cap.set(cv2.CAP_PROP_POS_MSEC, start_s * 1000)
    frames = []
    for _ in range(n):
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()
    return frames


def activity_score(frames, pocket_label: str) -> float:
    """Mean abs frame-difference in the pocket ROI (fixed pixel radius)."""
    if len(frames) < 2:
        return 0.0
    pos = POCKET_POS.get(pocket_label)
    if pos is None:
        return 0.0
    diffs = []
    for i in range(1, len(frames)):
        h, w = frames[i].shape[:2]
        cx, cy = int(pos[0] * w), int(pos[1] * h)
        r = ROI_RADIUS_PX
        x1, y1 = max(0, cx - r), max(0, cy - r)
        x2, y2 = min(w, cx + r), min(h, cy + r)
        roi_prev = frames[i - 1][y1:y2, x1:x2].astype(np.float32)
        roi_curr = frames[i    ][y1:y2, x1:x2].astype(np.float32)
        if roi_prev.size == 0:
            continue
        diffs.append(float(np.abs(roi_curr - roi_prev).mean()))
    return float(np.mean(diffs)) if diffs else 0.0


def score_event(event: dict) -> dict:
    scores = {}
    for cam_num, video_path in VIDEOS.items():
        label = event['pocket'].get(cam_num, '')
        t_cam = event['t'] + OFFSETS[cam_num]

        frames   = extract_frames(video_path, t_cam, N_FRAMES, ANALYSIS_WINDOW_S)
        act      = activity_score(frames, label)
        cen      = centering_score(label)
        scores[cam_num] = {'activity': round(act, 2), 'centering': round(cen, 3)}

    # Best camera = highest activity in pocket ROI; centering shown for info only
    best = max(scores, key=lambda c: scores[c]['activity'])
    return {'scores': scores, 'best_cam': best}


def main():
    print("Scoring camera views for each event...\n")
    results = []
    for ev in EVENTS:
        print(f"  t={ev['t']:3d}s  {ev['type']:9s}  pocket(lateral)={ev['pocket'][1]}")
        res = score_event(ev)
        results.append(res)
        for cam_num, s in res['scores'].items():
            marker = ' ◀ BEST' if cam_num == res['best_cam'] else ''
            print(f"    CAM {cam_num} ({CAM_ROLE[cam_num]:8s}):  "
                  f"activity={s['activity']:5.1f}  centering={s['centering']:.2f}{marker}")
        print()

    print("\n── Ready-to-paste FG_EVENTS block ─────────────────────────────\n")
    for ev, res in zip(EVENTS, results):
        pocket_label = ev['pocket'][1].replace(' ', '-').capitalize()
        # Convert "bottom-right" → "Bottom-Right" style
        pocket_label = '-'.join(w.capitalize() for w in ev['pocket'][1].split())
        print(f"  {{ t: {ev['t']:3d}, type: '{ev['type']:<9}', pocket: '{pocket_label:<14}', cam: {res['best_cam']} }},")


if __name__ == '__main__':
    main()
