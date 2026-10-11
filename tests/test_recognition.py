import math
import unittest

from recognition import NO_HAND, UNKNOWN, Smoother, classify


def pose(letter):
    """Synthetic geometry exercises rule logic, not real-world ASL accuracy."""
    p = [(0., 0., 0.)] * 21
    raised = {"L": [5], "I": [17], "Y": [17], "V": [5, 9], "W": [5, 9, 13], "F": [9, 13, 17]}[letter]
    for base, x in [(5, -0.5), (9, 0.), (13, 0.45), (17, 0.85)]:
        p[base] = (x, -1., 0.)
        if base in raised:
            spread = x * 0.55
            p[base+1] = (x + spread / 3, -1.5, 0.)
            p[base+2] = (x + spread * 2 / 3, -1.8, 0.)
            p[base+3] = (x + spread, -2.1, 0.)
        else:
            p[base+1] = (x, -1.4, 0.)
            p[base+2] = (x, -1.1, -0.2)
            p[base+3] = (x, -0.8, -0.15)
    p[1], p[2] = (-0.4, -0.25, 0.), (-0.65, -0.45, 0.)
    if letter in "LY":
        p[3], p[4] = (-1., -0.5, 0.), (-1.45, -0.55, 0.)
    else:
        p[3], p[4] = (-0.4, -0.75, -0.15), (-0.1, -1.0, -0.15)
    if letter == "F":
        p[4] = p[8]
    return p


class RulesTests(unittest.TestCase):
    def test_supported_and_geometric_invariance(self):
        for letter in "FILVWY":
            for mirror in (1, -1):
                for scale in (0.1, 2.5):
                    points = [(mirror*x*scale+0.3, y*scale+0.7, z*scale) for x, y, z in pose(letter)]
                    with self.subTest(letter=letter, mirror=mirror, scale=scale):
                        self.assertEqual(classify(points), letter)

    def test_invalid_or_sideways(self):
        for p in ([], [(0, 0, 0)] * 21, [(math.nan, 0, 0)] * 21,
                  [(-y, x, z) for x, y, z in pose("L")]):
            self.assertEqual(classify(p), UNKNOWN)

    def test_u_and_crossed_fingers_are_not_v(self):
        for x in (0.04, 0.2):
            p = pose("V")
            p[8] = (x, -2.1, 0)
            p[12] = (0, -2.1, 0)
            self.assertEqual(classify(p), UNKNOWN)


class SmoothingTests(unittest.TestCase):
    def test_acquisition_loss_and_reacquisition(self):
        s = Smoother()
        for _ in range(5):
            self.assertEqual(s.update("L"), UNKNOWN)
        self.assertEqual(s.update("L"), "L")
        self.assertEqual(s.update(None), NO_HAND)
        self.assertEqual(s.update("L"), UNKNOWN)

    def test_unknown_expires_and_new_letter_does_not_show_stale_label(self):
        s = Smoother()
        for _ in range(8):
            s.update("L")
        self.assertEqual(s.update(UNKNOWN), "L")
        s.update(UNKNOWN)
        self.assertEqual(s.update(UNKNOWN), UNKNOWN)
        for _ in range(8):
            s.update("L")
        self.assertEqual(s.update("V"), UNKNOWN)
        for _ in range(7):
            last = s.update("V")
        self.assertEqual(last, "V")

    def test_alternating_noise_never_stabilizes(self):
        s = Smoother()
        for letter in "LV" * 20:
            self.assertEqual(s.update(letter), UNKNOWN)


if __name__ == "__main__":
    unittest.main()
