export interface CameraRole {
  number: 1 | 2 | 3 | 4;
  label: string;
  description: string;
  tip: string;
  // SVG path/shape elements (rendered inside viewBox="0 0 100 177")
  overlay: OverlayShape[];
}

export interface OverlayShape {
  type: 'path' | 'circle' | 'ellipse' | 'line' | 'rect';
  props: Record<string, string | number>;
}

export interface SportConfig {
  id: string;
  name: string;
  roles: CameraRole[];
}

// ─── BASKETBALL ────────────────────────────────────────────────────────────────
// Court: 94ft long × 50ft wide. 3pt arc radius ~22ft. Lane 16ft wide, 19ft deep.
const basketball: SportConfig = {
  id: 'basketball',
  name: 'Basketball',
  roles: [
    {
      number: 1,
      label: 'Main',
      description: 'Sideline, center court',
      tip: 'Extend tripod to full height (~5–6 ft) at center sideline. Both baskets should be visible at each side of frame. Half-court line should cross the center.',
      overlay: [
        // Court outline (trapezoid — near sideline at bottom, far at top)
        { type: 'path', props: { d: 'M 5,158 L 95,158 L 90,72 L 10,72 Z' } },
        // Half-court line
        { type: 'line', props: { x1: 50, y1: 72, x2: 50, y2: 158 } },
        // Left lane box (near baseline at x=5, FT line at x=24)
        { type: 'path', props: { d: 'M 5,100 L 24,100 L 24,130 L 5,130 Z' } },
        // Right lane box
        { type: 'path', props: { d: 'M 95,100 L 76,100 L 76,130 L 95,130 Z' } },
        // Left FT line
        { type: 'line', props: { x1: 5, y1: 115, x2: 24, y2: 115 } },
        // Right FT line
        { type: 'line', props: { x1: 95, y1: 115, x2: 76, y2: 115 } },
        // Left 3pt arc (from side appears as outward curve)
        { type: 'path', props: { d: 'M 5,158 Q 28,115 5,72', fill: 'none' } },
        // Right 3pt arc
        { type: 'path', props: { d: 'M 95,158 Q 72,115 95,72', fill: 'none' } },
        // Left basket
        { type: 'circle', props: { cx: 5, cy: 115, r: 2.5 } },
        // Right basket
        { type: 'circle', props: { cx: 95, cy: 115, r: 2.5 } },
        // Center circle (ellipse from elevated side angle)
        { type: 'ellipse', props: { cx: 50, cy: 115, rx: 7, ry: 4 } },
      ],
    },
    {
      number: 2,
      label: 'Baseline',
      description: 'Behind the basket',
      tip: 'Position yourself behind the backboard, slightly elevated. The key/lane should be directly in front of you.',
      overlay: [
        // Court outline (trapezoid — near baseline at bottom, far end vanishes)
        { type: 'path', props: { d: 'M 5,162 L 95,162 L 75,60 L 25,60 Z' } },
        // Lane / key (rectangle vanishing)
        { type: 'path', props: { d: 'M 38,162 L 62,162 L 54,85 L 46,85 Z' } },
        // Free throw line
        { type: 'line', props: { x1: 46, y1: 85, x2: 54, y2: 85 } },
        // Basket (near, large circle in foreground)
        { type: 'circle', props: { cx: 50, cy: 148, r: 7 } },
        // Backboard
        { type: 'line', props: { x1: 38, y1: 143, x2: 62, y2: 143 } },
        // 3pt arc (wraps around — from baseline looks like a large arc in background)
        { type: 'path', props: { d: 'M 5,162 Q 50,30 95,162', fill: 'none' } },
        // Far baseline
        { type: 'line', props: { x1: 25, y1: 60, x2: 75, y2: 60 } },
      ],
    },
    {
      number: 3,
      label: 'Corner',
      description: '3-point corner angle',
      tip: 'Stand in the corner where the baseline meets the sideline. Keep the near basket in frame right, court extending left.',
      overlay: [
        // Baseline (runs left from corner at bottom-right)
        { type: 'line', props: { x1: 95, y1: 160, x2: 10, y2: 160 } },
        // Sideline (runs up from corner)
        { type: 'line', props: { x1: 95, y1: 160, x2: 95, y2: 55 } },
        // Far sideline (perspective)
        { type: 'line', props: { x1: 10, y1: 160, x2: 30, y2: 55 } },
        // Far end line
        { type: 'line', props: { x1: 30, y1: 55, x2: 95, y2: 55 } },
        // 3pt corner line (near corner — the straight portion)
        { type: 'line', props: { x1: 95, y1: 160, x2: 95, y2: 128 } },
        // 3pt arc from corner (curves toward center court)
        { type: 'path', props: { d: 'M 95,128 Q 60,100 55,55', fill: 'none' } },
        // Lane box (visible near right side)
        { type: 'path', props: { d: 'M 95,160 L 75,160 L 68,80 L 95,80 Z' } },
        // Near basket
        { type: 'circle', props: { cx: 92, cy: 148, r: 4 } },
      ],
    },
    {
      number: 4,
      label: 'Overview',
      description: 'Full court, widest angle',
      tip: 'Place tripod on a table, bleacher seat, or any raised surface at center sideline. Goal is to see both baskets and as much of the court as possible. Extend tripod to full height.',
      overlay: [
        // Court outline (bird's eye, slight perspective)
        { type: 'path', props: { d: 'M 8,155 L 92,155 L 92,25 L 8,25 Z' } },
        // Half-court line
        { type: 'line', props: { x1: 8, y1: 90, x2: 92, y2: 90 } },
        // Center circle
        { type: 'circle', props: { cx: 50, cy: 90, r: 8 } },
        // Left lane box
        { type: 'rect', props: { x: 8, y: 72, width: 19, height: 36 } },
        // Right lane box
        { type: 'rect', props: { x: 73, y: 72, width: 19, height: 36 } },
        // Left FT circle (half)
        { type: 'path', props: { d: 'M 27,74 Q 35,90 27,106', fill: 'none' } },
        // Right FT circle (half)
        { type: 'path', props: { d: 'M 73,74 Q 65,90 73,106', fill: 'none' } },
        // Left 3pt arc
        { type: 'path', props: { d: 'M 8,62 Q 38,25 8,118', fill: 'none' } },
        // Left 3pt corner lines
        { type: 'line', props: { x1: 8, y1: 25, x2: 8, y2: 62 } },
        { type: 'line', props: { x1: 8, y1: 118, x2: 8, y2: 155 } },
        // Right 3pt arc
        { type: 'path', props: { d: 'M 92,62 Q 62,25 92,118', fill: 'none' } },
        // Right 3pt corner lines
        { type: 'line', props: { x1: 92, y1: 25, x2: 92, y2: 62 } },
        { type: 'line', props: { x1: 92, y1: 118, x2: 92, y2: 155 } },
        // Left basket
        { type: 'circle', props: { cx: 8, cy: 90, r: 2.5 } },
        // Right basket
        { type: 'circle', props: { cx: 92, cy: 90, r: 2.5 } },
      ],
    },
  ],
};

// ─── TABLE TENNIS ──────────────────────────────────────────────────────────────
// Table: 9ft long × 5ft wide. Net at center.
const tableTennis: SportConfig = {
  id: 'table-tennis',
  name: 'Table Tennis',
  roles: [
    {
      number: 1,
      label: 'Broadcast',
      description: 'Long side, slightly elevated',
      tip: 'Stand at the midpoint of the long side, ~2–3m away, slightly above table height. Both ends of the table should be visible.',
      overlay: [
        // Table outline (trapezoid — near edge bottom, far edge top due to elevation)
        { type: 'path', props: { d: 'M 5,148 L 95,148 L 85,90 L 15,90 Z' } },
        // Net (center vertical line)
        { type: 'line', props: { x1: 50, y1: 90, x2: 50, y2: 148 } },
        // Net posts
        { type: 'circle', props: { cx: 5, cy: 119, r: 2 } },
        { type: 'circle', props: { cx: 95, cy: 119, r: 2 } },
        // Center line (for doubles, along the length — from this angle appears as depth line)
        { type: 'line', props: { x1: 5, y1: 148, x2: 15, y2: 90 } },
        { type: 'line', props: { x1: 95, y1: 148, x2: 85, y2: 90 } },
        // Table legs
        { type: 'line', props: { x1: 10, y1: 148, x2: 10, y2: 165 } },
        { type: 'line', props: { x1: 90, y1: 148, x2: 90, y2: 165 } },
      ],
    },
    {
      number: 2,
      label: 'Behind Player',
      description: 'End view, over shoulder',
      tip: 'Stand ~1–1.5m behind one end of the table. Table should vanish toward the far end. Net visible ~halfway up frame.',
      overlay: [
        // Table outline (vanishing rectangle)
        { type: 'path', props: { d: 'M 15,162 L 85,162 L 60,80 L 40,80 Z' } },
        // Net (horizontal line at midpoint of vanishing table)
        { type: 'line', props: { x1: 40, y1: 121, x2: 60, y2: 121 } },
        // Net post left
        { type: 'line', props: { x1: 15, y1: 162, x2: 40, y2: 121 } },
        // Net post right
        { type: 'line', props: { x1: 85, y1: 162, x2: 60, y2: 121 } },
        // Center line (doubles — along length, center of table)
        { type: 'line', props: { x1: 50, y1: 162, x2: 50, y2: 80 } },
        // Near end line
        { type: 'line', props: { x1: 15, y1: 162, x2: 85, y2: 162 } },
        // Far end line
        { type: 'line', props: { x1: 40, y1: 80, x2: 60, y2: 80 } },
        // Table legs (near)
        { type: 'line', props: { x1: 20, y1: 162, x2: 20, y2: 175 } },
        { type: 'line', props: { x1: 80, y1: 162, x2: 80, y2: 175 } },
      ],
    },
    {
      number: 3,
      label: 'Corner',
      description: 'Diagonal corner view',
      tip: 'Position at a corner of the table, ~1.5m away. Both the near end and near long side should be visible.',
      overlay: [
        // Near corner at bottom-center
        // Near end line (goes left)
        { type: 'line', props: { x1: 50, y1: 158, x2: 5, y2: 140 } },
        // Near long side (goes right, vanishes)
        { type: 'line', props: { x1: 50, y1: 158, x2: 92, y2: 100 } },
        // Far end line
        { type: 'line', props: { x1: 5, y1: 140, x2: 35, y2: 75 } },
        // Far long side
        { type: 'line', props: { x1: 35, y1: 75, x2: 92, y2: 100 } },
        // Net (diagonal, roughly halfway along long side)
        { type: 'line', props: { x1: 5, y1: 120, x2: 71, y2: 78 } },
        // Near corner pocket
        { type: 'circle', props: { cx: 50, cy: 158, r: 3 } },
        // Near end legs
        { type: 'line', props: { x1: 50, y1: 158, x2: 50, y2: 172 } },
        { type: 'line', props: { x1: 10, y1: 140, x2: 10, y2: 154 } },
      ],
    },
    {
      number: 4,
      label: 'Wide',
      description: 'Full room overview',
      tip: 'Back away until both players and the full table are visible. Good for showing rallies and footwork.',
      overlay: [
        // Full table (small, bird's eye perspective)
        { type: 'rect', props: { x: 15, y: 78, width: 70, height: 42 } },
        // Net
        { type: 'line', props: { x1: 50, y1: 78, x2: 50, y2: 120 } },
        // Center line (doubles)
        { type: 'line', props: { x1: 15, y1: 99, x2: 85, y2: 99 } },
        // Player 1 position (circle, near end)
        { type: 'circle', props: { cx: 50, cy: 138, r: 7 } },
        // Player 2 position (far end)
        { type: 'circle', props: { cx: 50, cy: 60, r: 7 } },
        // Player boundary hints
        { type: 'line', props: { x1: 15, y1: 120, x2: 85, y2: 120 } },
        { type: 'line', props: { x1: 15, y1: 78, x2: 85, y2: 78 } },
      ],
    },
  ],
};

// ─── BILLIARDS ─────────────────────────────────────────────────────────────────
// 9ft pool table: 100in × 50in playable area. 6 pockets.
const billiards: SportConfig = {
  id: 'billiards',
  name: 'Billiards',
  roles: [
    {
      number: 1,
      label: 'Elevated Side',
      description: 'Long side, raised on chair/table',
      tip: 'Place tripod on a chair or small table at the center of the long rail, aimed slightly downward. You should see the full table surface and all 6 pockets. This is the main broadcast angle.',
      overlay: [
        // Table outline (elevated perspective — more surface visible than ground level)
        { type: 'path', props: { d: 'M 5,158 L 95,158 L 92,75 L 8,75 Z' } },
        // Near corner pockets
        { type: 'circle', props: { cx: 5, cy: 158, r: 4 } },
        { type: 'circle', props: { cx: 95, cy: 158, r: 4 } },
        // Far corner pockets
        { type: 'circle', props: { cx: 8, cy: 75, r: 3.5 } },
        { type: 'circle', props: { cx: 92, cy: 75, r: 3.5 } },
        // Near side pocket (center of near rail)
        { type: 'circle', props: { cx: 50, cy: 158, r: 4 } },
        // Far side pocket
        { type: 'circle', props: { cx: 50, cy: 75, r: 3.5 } },
        // Head string line (1/4 from left end)
        { type: 'line', props: { x1: 27, y1: 158, x2: 28, y2: 75 } },
        // Spots visible on surface
        { type: 'circle', props: { cx: 27, cy: 117, r: 1.5 } },
        { type: 'circle', props: { cx: 50, cy: 117, r: 1.5 } },
        { type: 'circle', props: { cx: 73, cy: 117, r: 1.5 } },
      ],
    },
    {
      number: 2,
      label: 'Long Side',
      description: 'Along the long rail',
      tip: 'Stand at the center of the long side, at table height. The full table length should be visible. Keep the near rail at the bottom of frame.',
      overlay: [
        // Near rail (bottom)
        { type: 'line', props: { x1: 5, y1: 152, x2: 95, y2: 152 } },
        // Far rail (top, foreshortened by perspective)
        { type: 'line', props: { x1: 10, y1: 95, x2: 90, y2: 95 } },
        // Left end rail
        { type: 'line', props: { x1: 5, y1: 152, x2: 10, y2: 95 } },
        // Right end rail
        { type: 'line', props: { x1: 95, y1: 152, x2: 90, y2: 95 } },
        // Near corner pockets
        { type: 'circle', props: { cx: 5, cy: 152, r: 4 } },
        { type: 'circle', props: { cx: 95, cy: 152, r: 4 } },
        // Far corner pockets
        { type: 'circle', props: { cx: 10, cy: 95, r: 3 } },
        { type: 'circle', props: { cx: 90, cy: 95, r: 3 } },
        // Near side pocket (center of near rail)
        { type: 'circle', props: { cx: 50, cy: 152, r: 4 } },
        // Far side pocket
        { type: 'circle', props: { cx: 50, cy: 95, r: 3 } },
        // Head string line (1/4 from left)
        { type: 'line', props: { x1: 28, y1: 152, x2: 30, y2: 95 } },
        // Spots (along center depth of table)
        { type: 'circle', props: { cx: 50, cy: 124, r: 1.5 } },
        { type: 'circle', props: { cx: 27, cy: 124, r: 1.5 } },
        { type: 'circle', props: { cx: 73, cy: 124, r: 1.5 } },
      ],
    },
    {
      number: 3,
      label: 'Short End',
      description: 'From the head/foot rail',
      tip: 'Stand at one short end of the table, at table height or slightly above. The table should vanish toward the far end.',
      overlay: [
        // Table vanishing toward far end
        { type: 'path', props: { d: 'M 15,160 L 85,160 L 60,78 L 40,78 Z' } },
        // Near end rail
        { type: 'line', props: { x1: 15, y1: 160, x2: 85, y2: 160 } },
        // Far end rail
        { type: 'line', props: { x1: 40, y1: 78, x2: 60, y2: 78 } },
        // Near corner pockets
        { type: 'circle', props: { cx: 15, cy: 160, r: 4 } },
        { type: 'circle', props: { cx: 85, cy: 160, r: 4 } },
        // Far corner pockets
        { type: 'circle', props: { cx: 40, cy: 78, r: 3 } },
        { type: 'circle', props: { cx: 60, cy: 78, r: 3 } },
        // Side pockets (middle of long rails from this angle)
        { type: 'circle', props: { cx: 28, cy: 119, r: 3.5 } },
        { type: 'circle', props: { cx: 72, cy: 119, r: 3.5 } },
        // Head string (appears as horizontal line ~1/4 way down)
        { type: 'line', props: { x1: 23, y1: 140, x2: 77, y2: 140 } },
        // Center line of table (perspective center)
        { type: 'line', props: { x1: 50, y1: 160, x2: 50, y2: 78 } },
      ],
    },
    {
      number: 4,
      label: 'Corner',
      description: 'Diagonal corner view',
      tip: 'Position at a corner pocket, ~1m back and slightly elevated. Two rails should diverge from the near corner pocket.',
      overlay: [
        // Near corner pocket (center-bottom)
        { type: 'circle', props: { cx: 50, cy: 158, r: 5 } },
        // Long rail going left (toward side pocket and far corner)
        { type: 'line', props: { x1: 50, y1: 158, x2: 5, y2: 120 } },
        { type: 'line', props: { x1: 5, y1: 120, x2: 12, y2: 65 } },
        // Short rail going right (toward far end)
        { type: 'line', props: { x1: 50, y1: 158, x2: 90, y2: 130 } },
        { type: 'line', props: { x1: 90, y1: 130, x2: 60, y2: 65 } },
        // Far rail segments
        { type: 'line', props: { x1: 12, y1: 65, x2: 60, y2: 65 } },
        // Side pocket (visible on left rail)
        { type: 'circle', props: { cx: 5, cy: 120, r: 3.5 } },
        // Far corner pockets
        { type: 'circle', props: { cx: 12, cy: 65, r: 3 } },
        { type: 'circle', props: { cx: 60, cy: 65, r: 3 } },
        // Far corner pocket (right side)
        { type: 'circle', props: { cx: 90, cy: 130, r: 3.5 } },
      ],
    },
  ],
};

// ─── Generic fallback (when sport not recognised) ──────────────────────────────
const generic: SportConfig = {
  id: 'generic',
  name: 'General',
  roles: [
    { number: 1, label: 'Main', description: 'Primary wide angle', tip: 'Frame the full playing area.', overlay: [] },
    { number: 2, label: 'Side', description: 'Sideline view', tip: 'Position on the sideline.', overlay: [] },
    { number: 3, label: 'Close-up', description: 'Player tracking', tip: 'Follow the action closely.', overlay: [] },
    { number: 4, label: 'Wide', description: 'Full overview', tip: 'Capture the full scene.', overlay: [] },
  ],
};

export const SPORT_CONFIGS: Record<string, SportConfig> = {
  basketball: basketball,
  'table-tennis': tableTennis,
  billiards: billiards,
};

export function getSportConfig(sport: string): SportConfig {
  const key = sport?.toLowerCase().replace(/\s+/g, '-');
  return SPORT_CONFIGS[key] ?? generic;
}
