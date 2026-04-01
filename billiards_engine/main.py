"""
Entry point for the billiards event detection engine.

Usage
-----
  # Run on the first clip found (default)
  python -m billiards_engine.main

  # Run on a specific clip
  python -m billiards_engine.main --clip game1_clip1

  # Run on all clips
  python -m billiards_engine.main --all

  # Show live preview window (requires display)
  python -m billiards_engine.main --preview

  # Skip saving annotated video
  python -m billiards_engine.main --no-video
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import List, Optional

from .pipeline import run_clip

DATASET_DIR = Path(__file__).parent.parent / "billiards-orginal" / "dataset"


def scan_clips(dataset_dir: Path) -> List[Path]:
    """Return sorted list of clip directories that contain a matching .mp4."""
    clips = []
    for d in sorted(dataset_dir.iterdir()):
        if not d.is_dir():
            continue
        video = d / f"{d.name}.mp4"
        if video.is_file():
            clips.append(d)
    return clips


def main(argv: Optional[List[str]] = None):
    parser = argparse.ArgumentParser(
        description="Billiards real-time event detection engine"
    )
    parser.add_argument(
        "--dataset", default=str(DATASET_DIR),
        help="Path to the dataset directory",
    )
    parser.add_argument(
        "--clip", default=None,
        help="Name of a specific clip folder to process (e.g. game1_clip1)",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Process all clips in the dataset directory",
    )
    parser.add_argument(
        "--preview", action="store_true",
        help="Show annotated frames in a window (requires a display)",
    )
    parser.add_argument(
        "--no-video", action="store_true",
        help="Skip writing the annotated video file",
    )
    parser.add_argument(
        "--output-dir", default=None,
        help="Directory to write output files (defaults to each clip's folder)",
    )
    parser.add_argument(
        "--no-annotate", action="store_true",
        help="Skip pocket annotation UI (use estimated positions)",
    )
    parser.add_argument(
        "--reannotate", action="store_true",
        help="Force re-opening the pocket annotation UI even if a config exists",
    )
    args = parser.parse_args(argv)

    dataset_dir = Path(args.dataset)
    if not dataset_dir.is_dir():
        sys.exit(f"Dataset directory not found: {dataset_dir}")

    clips = scan_clips(dataset_dir)
    if not clips:
        sys.exit(f"No clip folders found in: {dataset_dir}")

    print(f"\nBilliards Event Detection Engine")
    print(f"Dataset : {dataset_dir}")
    print(f"Clips found: {[c.name for c in clips]}")

    # Determine which clips to run
    if args.all:
        selected = clips
    elif args.clip:
        match = [c for c in clips if c.name == args.clip]
        if not match:
            sys.exit(f"Clip '{args.clip}' not found. Available: {[c.name for c in clips]}")
        selected = match
    else:
        selected = clips[:1]   # default: first clip only
        print(f"\nNo --clip or --all specified — running on first clip: {selected[0].name}")

    for clip_dir in selected:
        out_dir = args.output_dir or str(clip_dir)
        run_clip(
            clip_dir=str(clip_dir),
            save_video=not args.no_video,
            output_dir=out_dir,
            show_preview=args.preview,
            annotate_pockets_ui=not args.no_annotate,
            force_reannotate=args.reannotate,
        )

    print("\nDone.")


if __name__ == "__main__":
    main()
