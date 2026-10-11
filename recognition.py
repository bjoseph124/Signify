"""Conservative static ASL handshape rules, not a trained alphabet classifier."""
from collections import Counter, deque
import math

SUPPORTED = "FILVWY"
UNKNOWN = "Unknown"
NO_HAND = "No hand detected"


def distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def angle(a, b, c):
    u = [x - y for x, y in zip(a, b)]
    v = [x - y for x, y in zip(c, b)]
    divisor = distance(a, b) * distance(c, b)
    if divisor < 1e-8:
        return 0.0
    return math.degrees(math.acos(max(-1, min(1, sum(x*y for x, y in zip(u, v)) / divisor))))


def classify(points):
    """Accept 21 aspect-corrected x/y/z points. Reject partial/ambiguous shapes.

    Designed for one upright hand, palm toward camera. Mirroring either hand
    preserves distances and angles. Thresholds are heuristics, not probabilities.
    """
    if len(points) != 21 or any(len(p) != 3 for p in points):
        return UNKNOWN
    if not all(math.isfinite(v) for p in points for v in p):
        return UNKNOWN
    scale = distance(points[0], points[9])
    if scale < 1e-6:
        return UNKNOWN
    p = [tuple((v - origin) / scale for v, origin in zip(point, points[0])) for point in points]
    # Require fingers pointing roughly up and a reasonably face-on palm.
    if p[9][1] > -0.45 or abs(p[9][0]) > 0.8 or abs(p[5][0] - p[17][0]) < 0.35:
        return UNKNOWN

    def state(base):
        pip, dip, tip = base + 1, base + 2, base + 3
        straight = angle(p[base], p[pip], p[dip]) > 155 and angle(p[pip], p[dip], p[tip]) > 150
        if straight and distance(p[tip], p[0]) > distance(p[pip], p[0]) + 0.20:
            return "up"
        if angle(p[base], p[pip], p[dip]) < 135 and distance(p[tip], p[base]) < 0.8:
            return "down"
        return "uncertain"

    index, middle, ring, pinky = [state(b) for b in (5, 9, 13, 17)]
    thumb_out = (angle(p[2], p[3], p[4]) > 150
                 and distance(p[4], p[5]) > 0.65
                 and abs(p[4][0] - p[5][0]) > 0.45)
    thumb_in = distance(p[4], p[9]) < 0.65
    if (index, middle, ring, pinky) == ("up", "down", "down", "down") and thumb_out:
        # Thumb and index form an L, rather than lying parallel.
        if 55 < angle(p[4], p[5], p[8]) < 125:
            return "L"
    if (index, middle, ring, pinky) == ("down", "down", "down", "up"):
        if thumb_out:
            return "Y"
        if thumb_in:
            return "I"
    if (index, middle, ring, pinky) == ("up", "up", "down", "down") and thumb_in:
        # Reject U (together) and R (crossed), which have the same raised fingers.
        same_order = (p[8][0] - p[12][0]) * (p[5][0] - p[9][0]) > 0
        if same_order and distance(p[8], p[12]) > 0.45 and angle(p[8], p[0], p[12]) > 12:
            return "V"
    if (index, middle, ring, pinky) == ("up", "up", "up", "down") and thumb_in:
        if distance(p[8], p[12]) > 0.35 and distance(p[12], p[16]) > 0.35:
            return "W"
    if middle == ring == pinky == "up" and index != "up":
        if distance(p[4], p[8]) < 0.23 and distance(p[8], p[5]) < 0.85:
            return "F"
    return UNKNOWN


class Smoother:
    """8-frame vote with immediate loss reset and bounded unknown persistence."""
    def __init__(self, window=8, required=6):
        if not 1 <= required <= window:
            raise ValueError("Require 1 <= required <= window")
        self.history = deque(maxlen=window)
        self.required = required
        self.current = UNKNOWN
        self.misses = 0

    def reset(self):
        self.history.clear()
        self.current = UNKNOWN
        self.misses = 0

    def update(self, label):
        if label is None:
            self.reset()
            return NO_HAND
        self.history.append(label)
        self.misses = self.misses + 1 if label == UNKNOWN else 0
        if self.misses >= 3:
            self.reset()
            return UNKNOWN
        winner, count = Counter(self.history).most_common(1)[0]
        if count >= self.required and winner == label:
            self.current = winner
        elif label != self.current and label != UNKNOWN:
            self.current = UNKNOWN
        return self.current
