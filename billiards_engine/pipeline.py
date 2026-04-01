"""
Main pipeline: wires together all stages for one video clip.

Stages (in order per frame):
  1. VideoLoader        — yields raw frames
  2. DetectionLoader    — provides annotated detections for frame 0 and frame N-1
  3. OpenCVBallDetector — detects balls on all other frames
  4. CentroidTracker    — assigns stable IDs
  5. TrajectoryBuilder  — smoothed positions + velocities
  6. EventDetector      — fires events
  7. Visualizer         — draws overlays
  8. VideoWriter        — saves annotated clip

Design for streaming extension:
  The main loop is a simple `for frame_id, frame in loader.frames()` generator.
  Replace it with a live-capture generator and the rest of the pipeline is unchanged.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from .video_loader import VideoLoader
from .detection_loader import DetectionLoader, Detection
from .opencv_detector import OpenCVBallDetector, estimate_table_bbox
from .tracker import CentroidTracker
from .trajectory_builder import TrajectoryBuilder
from .event_detector import EventDetector
from .visualizer import Visualizer, VideoWriter
from .pocket_annotator import annotate_pockets


def _find_bbox_dir(clip_dir: str) -> Optional[str]:
    candidate = os.path.join(clip_dir, "bounding_boxes")
    return candidate if os.path.isdir(candidate) else None


def _estimate_table(loader: VideoLoader) -> Tuple[int, int, int, int]:
    """Grab the first frame and estimate the table bounding box."""
    frame = loader.get_frame(0)
    bbox = estimate_table_bbox(frame)
    if bbox is None:
        # Fallback: treat full frame as table
        return 0, 0, loader.info.width, loader.info.height
    return bbox


def run_clip(
    clip_dir: str,
    save_video: bool = True,
    output_dir: Optional[str] = None,
    show_preview: bool = False,
    annotate_pockets_ui: bool = True,
    force_reannotate: bool = False,
) -> List[Dict]:
    """
    Run the full event detection pipeline on one clip.

    Parameters
    ----------
    clip_dir : str
        Path to the clip folder (e.g., dataset/game1_clip1/).
    save_video : bool
        If True, save an annotated MP4 next to the source video.
    output_dir : str, optional
        Directory for output files. Defaults to clip_dir.
    show_preview : bool
        If True, display frames in a cv2 window (requires a display).

    Returns
    -------
    List of event dicts (also written to events.json in output_dir).
    """
    clip_name = os.path.basename(clip_dir.rstrip("/"))
    video_path = os.path.join(clip_dir, f"{clip_name}.mp4")

    if not os.path.isfile(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    out_dir = output_dir or clip_dir
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  Clip : {clip_name}")
    print(f"  Video: {video_path}")

    with VideoLoader(video_path) as loader:
        info = loader.info
        print(f"  Size : {info.width}x{info.height}  FPS={info.fps:.2f}  Frames={info.frame_count}")

        # --- Stage 1: estimate table geometry from first frame ---
        table_bbox = _estimate_table(loader)
        tx, ty, tw, th = table_bbox
        print(f"  Table: x={tx} y={ty} w={tw} h={th}")

        # --- Stage 2: load pre-annotated detections (frame 0 and last) ---
        bbox_dir = _find_bbox_dir(clip_dir)
        det_loader = DetectionLoader(bbox_dir, info.frame_count) if bbox_dir else None
        if det_loader:
            print(f"  Annotations: {det_loader.annotated_frames}")
        else:
            print("  Annotations: none")

        # --- Stage 3a: pocket locations ---
        # Always try to load saved config first; only open the UI when
        # annotate_pockets_ui=True and no saved config exists yet.
        pocket_override = annotate_pockets(
            clip_dir,
            pocket_radius=35,
            force_reannotate=force_reannotate,
            show_ui=annotate_pockets_ui,
        )
        if pocket_override:
            print(f"  Pockets: {len(pocket_override)} locations loaded")
        else:
            print("  Pockets: using estimated positions (no saved config)")

        # --- Stage 3b: build pipeline components ---
        detector = OpenCVBallDetector(min_radius=7, max_radius=14, table_bbox=table_bbox)
        tracker = CentroidTracker(max_distance=60.0, max_missing=8)
        traj_builder = TrajectoryBuilder(window=40, smooth_k=5, fps=info.fps)
        event_det = EventDetector(
            table_bbox=table_bbox,
            fps=info.fps,
            avg_ball_diameter=18.0,
            shot_spike_factor=3.0,
            shot_min_speed=30.0,
            collision_dist_factor=2.2,
            rail_margin=28,
            pocket_radius=38,
            cooldown_frames=12,
            pocket_override=pocket_override,
        )
        viz = Visualizer(event_det, trail_length=25)

        # Video writer setup
        writer: Optional[VideoWriter] = None
        annotated_path = os.path.join(out_dir, f"{clip_name}_annotated.mp4")
        if save_video:
            writer = VideoWriter(annotated_path, info.fps, info.width, info.height)

        all_events: List[Dict] = []
        print(f"\n  Detected events:")
        print(f"  {'-'*50}")

        # --- Main loop ---
        for frame_id, frame in loader.frames():

            # Priority 1: use annotated detections if this is a key frame
            if det_loader and det_loader.has_frame(frame_id):
                detections = det_loader.get(frame_id)
                tracker.seed(detections, frame_id)
                active = tracker.update([], frame_id)
            else:
                # Priority 2: run OpenCV detector
                detections = detector.detect(frame, frame_id)
                active = tracker.update(detections, frame_id)

            # Update trajectories
            traj_builder.update(active, frame_id)

            # Detect events
            all_track_ids = [t.id for t in tracker.all_tracks()]
            new_events = event_det.update(active, all_track_ids, frame_id, traj_builder)
            all_events.extend(new_events)

            # Visualise
            annotated = viz.draw(frame, frame_id, active, new_events, info.fps)

            if writer:
                writer.write(annotated)

            if show_preview:
                cv2.imshow(clip_name, annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

        # Cleanup
        if writer:
            writer.release()
            print(f"\n  Annotated video saved: {annotated_path}")

        if show_preview:
            cv2.destroyAllWindows()

    # --- Save events JSON ---
    # Keep only fields relevant to the output spec
    clean_events = []
    for ev in all_events:
        entry = {k: ev[k] for k in ("type", "frame") if k in ev}
        if "ball" in ev:
            entry["ball"] = ev["ball"]
        if "balls" in ev:
            entry["balls"] = ev["balls"]
        if "time_s" in ev:
            entry["time_s"] = ev["time_s"]
        clean_events.append(entry)

    events_path = os.path.join(out_dir, f"{clip_name}_events.json")
    with open(events_path, "w") as fh:
        json.dump(clean_events, fh, indent=2)
    print(f"  Events JSON saved : {events_path}")
    print(f"  Total events      : {len(all_events)}")

    return all_events
