#!/usr/bin/env python3
"""
Billiards Highlight Video Generator — realgame-2  v4
Per event: lateral → INSTANT REPLAY card (fadeblack) → best second angle (wipeleft)
Events joined with fadeblack transitions.
"""

import subprocess, os, json, sys
from PIL import Image, ImageDraw, ImageFont

BASE     = os.path.dirname(os.path.abspath(__file__))
OUT      = os.path.join(BASE, "highlights_output")
TEMP     = os.path.join(OUT, "tmp_v4")

LATERAL  = os.path.join(BASE, "IMG_1826.MOV")
FRONTAL  = os.path.join(BASE, "IMG_5254.MOV")
DIAGONAL = os.path.join(BASE, "IMG_7658 2.MOV")

# ── Test mode ──────────────────────────────────────────────────────────────────
TEST_MODE   = False  # set False for full 16-event run
TEST_EVENTS = 3

# ── Transition config ──────────────────────────────────────────────────────────
TRANS_DURATION       = 0.4   # seconds per xfade
TRANS_LAT_TO_CARD    = "fadeblack"
TRANS_CARD_TO_ANGLE  = "wipeleft"
TRANS_BETWEEN_EVENTS = "fadeblack"
TRANS_BETWEEN_DUR    = 0.5

# ── Events ─────────────────────────────────────────────────────────────────────
# (lateral_sec, frontal_sec, diagonal_sec, label, pocket)
EVENTS = [
    ( 32,  43,  38, "Goal 1 – Striped",    "bottom_right"),
    ( 90, 101,  96, "Goal 2 – Striped",    "bottom_center"),
    (195, 206, 200, "Goal 3 – Striped",    "bottom_right"),
    (347, 358, 353, "Goal 4 – Solid",      "top_right"),
    (347, 358, 353, "Scratch 5",           "top_right"),
    (384, 395, 389, "Scratch 6",           "bottom_center"),
    (414, 425, 419, "Goal 7 – Solid",      "bottom_left"),
    (502, 513, 507, "Scratch 8",           "bottom_left"),
    (503, 514, 508, "Goal 9 – Striped",    "top_left"),
    (529, 540, 534, "Goal 10 – Solid",     "bottom_center"),
    (581, 592, 587, "Goal 11 – Solid",     "top_left"),
    (656, 666, 661, "Scratch 12",          "top_center"),
    (680, 691, 685, "Goal 13 – Solid",     "top_right"),
    (693, 704, 699, "Goal 14 – Solid",     "top_right"),
    (720, 730, 725, "Goal 15 – Solid",     "bottom_left"),
    (957, 967, 962, "Game Over – 8-Ball",  "bottom_right"),
]

POCKET_ANGLE = {
    "top_left":      "diagonal",
    "top_center":    "diagonal",
    "top_right":     "frontal",
    "bottom_left":   "frontal",
    "bottom_center": "frontal",
    "bottom_right":  "diagonal",
}

CLIP_BEFORE  = 5
CLIP_AFTER   = 5
CARD_DURATION = 1.5

SDR = [
    "-r", "30",
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-colorspace", "1", "-color_trc", "1", "-color_primaries", "1",
    "-color_range", "tv",
    "-an",
]


def run(cmd, check=True):
    cmd = [str(c) for c in cmd]
    print("   $", " ".join(cmd[:9]), "..." if len(cmd) > 9 else "")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print("  STDERR:", r.stderr[-800:])
        sys.exit(1)
    return r


def make_transition_card(png_dst):
    W, H = 1920, 1080
    img = Image.new("RGB", (W, H), (13, 13, 15))
    draw = ImageDraw.Draw(img)
    for r in range(500, 0, -4):
        t = r / 500
        a = int(80 * t * (1 - t) * 4)
        c = (max(0, min(255, 20 + a)), max(0, min(255, 140 + a)), max(0, min(255, 120 + a)))
        draw.ellipse([W - r, -r // 2, W + r, H // 2 + r // 2], fill=c)
    for r in range(320, 0, -4):
        t = r / 320
        a = int(60 * t * (1 - t) * 4)
        c = (max(0, min(255, 15 + a)), max(0, min(255, 100 + a)), max(0, min(255, 90 + a)))
        draw.ellipse([W // 2 + 100, H - r, W // 2 + 100 + 2 * r, H + r], fill=c)
    try:
        font_big = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 130)
        font_sub = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 54)
    except Exception:
        font_big = ImageFont.load_default()
        font_sub = font_big
    draw.rectangle([110, 430, 132, 660], fill=(46, 207, 174))
    draw.text((175, 430), "INSTANT", font=font_big, fill=(255, 255, 255))
    draw.text((175, 560), "REPLAY",  font=font_big, fill=(46, 207, 174))
    draw.text((177, 700), "DIFFERENT ANGLE", font=font_sub, fill=(160, 160, 160))
    img.save(png_dst)


def card_to_video(png, dst):
    frames = int(CARD_DURATION * 30)
    run([
        "ffmpeg", "-y",
        "-loop", "1", "-i", png,
        "-frames:v", str(frames),
        "-vf", "scale=1920:1080,format=yuv420p",
        *SDR, dst,
    ])


def extract(src, start, duration, dst):
    start = max(0.0, float(start))
    run([
        "ffmpeg", "-y",
        "-ss", f"{start:.3f}", "-i", src,
        "-t", f"{float(duration):.3f}",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,"
               "pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
        *SDR, dst,
    ])


def build_event_video(lat, card, ang2, dst):
    """Merge 3 clips into one event video using chained xfade transitions."""
    clip_dur  = float(CLIP_BEFORE + CLIP_AFTER)   # 10.0s
    card_dur  = float(CARD_DURATION)               # 1.5s
    td        = float(TRANS_DURATION)              # 0.4s

    # offset1: start fadeblack right before lat ends
    offset1 = clip_dur - td                        # 9.6

    # offset2: after xfade1, effective duration = clip_dur + card_dur - td
    # start wipeleft right before card ends
    offset2 = clip_dur + card_dur - td * 2         # 10.7

    fc = (
        f"[0:v][1:v]xfade=transition={TRANS_LAT_TO_CARD}:duration={td}:offset={offset1:.3f}[v01];"
        f"[v01][2:v]xfade=transition={TRANS_CARD_TO_ANGLE}:duration={td}:offset={offset2:.3f}[vout]"
    )
    run([
        "ffmpeg", "-y",
        "-i", lat, "-i", card, "-i", ang2,
        "-filter_complex", fc,
        "-map", "[vout]",
        "-r", "30",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-colorspace", "1", "-color_trc", "1", "-color_primaries", "1",
        "-color_range", "tv",
        "-an",
        dst,
    ])


def get_duration(path):
    r = run(["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_streams", path])
    for s in json.loads(r.stdout)["streams"]:
        if s.get("codec_type") == "video":
            return float(s.get("duration", 0))
    return 0.0


def concat_events_with_fade(event_files, final):
    """Chain event videos together with fadeblack between each one."""
    if len(event_files) == 1:
        run(["ffmpeg", "-y", "-i", event_files[0],
             "-c", "copy", "-movflags", "+faststart", final])
        return

    td = float(TRANS_BETWEEN_DUR)

    # Probe durations
    print("  Probing event durations…")
    durations = [get_duration(f) for f in event_files]

    # Build filter_complex with chained xfade
    inputs = " ".join(f"-i {f}" for f in event_files)
    fc_parts = []
    cumulative = 0.0
    prev_label = "[0:v]"

    for i in range(1, len(event_files)):
        cumulative += durations[i - 1] - td
        out_label  = "[vout]" if i == len(event_files) - 1 else f"[v{i:02d}]"
        fc_parts.append(
            f"{prev_label}[{i}:v]xfade=transition={TRANS_BETWEEN_EVENTS}"
            f":duration={td}:offset={cumulative:.3f}{out_label}"
        )
        prev_label  = out_label
        cumulative -= td   # xfade shortens total by td

    fc = ";".join(fc_parts)

    cmd = ["ffmpeg", "-y"]
    for f in event_files:
        cmd += ["-i", f]
    cmd += [
        "-filter_complex", fc,
        "-map", "[vout]",
        "-r", "30",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        final,
    ]
    run(cmd)


def main():
    for d in (OUT, TEMP):
        os.makedirs(d, exist_ok=True)

    events = EVENTS[:TEST_EVENTS] if TEST_MODE else EVENTS
    suffix = "test" if TEST_MODE else "full"
    print(f"Running {'TEST (' + str(len(events)) + ' events)' if TEST_MODE else 'FULL (16 events)'}")

    # Shared transition card
    print("Generating transition card…")
    card_png = os.path.join(TEMP, "card.png")
    card_mp4 = os.path.join(TEMP, "card.mp4")
    make_transition_card(card_png)
    card_to_video(card_png, card_mp4)

    event_videos = []

    for idx, (t_lat, t_fro, t_dia, label, pocket) in enumerate(events):
        n = idx + 1
        print(f"\n[{n:02d}/{len(events)}] {label}")
        evdir = os.path.join(TEMP, f"ev{n:02d}")
        os.makedirs(evdir, exist_ok=True)

        print("  lateral…")
        lat = os.path.join(evdir, "1_lat.mp4")
        extract(LATERAL, t_lat - CLIP_BEFORE, CLIP_BEFORE + CLIP_AFTER, lat)

        angle2 = POCKET_ANGLE.get(pocket, "frontal")
        src2   = FRONTAL  if angle2 == "frontal" else DIAGONAL
        t2     = t_fro    if angle2 == "frontal" else t_dia
        print(f"  {angle2}…")
        ang2 = os.path.join(evdir, "2_ang2.mp4")
        extract(src2, t2 - CLIP_BEFORE, CLIP_BEFORE + CLIP_AFTER, ang2)

        print("  xfade merge…")
        ev_out = os.path.join(evdir, "event.mp4")
        build_event_video(lat, card_mp4, ang2, ev_out)
        event_videos.append(ev_out)

    print("\nJoining events with fadeblack…")
    final = os.path.join(OUT, f"highlights_reel_v4_{suffix}.mp4")
    concat_events_with_fade(event_videos, final)

    mb = os.path.getsize(final) / 1e6
    print(f"\nDone →  {final}  ({mb:.1f} MB)")


if __name__ == "__main__":
    main()
