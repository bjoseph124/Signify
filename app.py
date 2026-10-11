"""Sign Pop: local, mirrored webcam + a small static ASL rule recognizer."""
import argparse
import os
from pathlib import Path
import sys
import time

from recognition import NO_HAND, SUPPORTED, UNKNOWN, Smoother, classify

# Keep MediaPipe's optional matplotlib font cache inside the project environment.
os.environ.setdefault("MPLCONFIGDIR", str(Path(__file__).parent / ".venv" / "mpl-cache"))


def render(cv2, np, frame, label, fps, help_visible):
    width = 960
    frame = cv2.resize(frame, (width, round(frame.shape[0] * width / frame.shape[1])))
    top, bottom = 130, 118 if help_visible else 66
    canvas = np.full((top + frame.shape[0] + bottom, width, 3), (29, 24, 22), dtype=np.uint8)
    canvas[top:top + frame.shape[0]] = frame
    mint, white, muted = (174, 238, 113), (243, 244, 247), (170, 167, 161)

    def text(value, x, y, size=0.6, color=white, thickness=1):
        cv2.putText(canvas, value, (x, y), cv2.FONT_HERSHEY_SIMPLEX, size, color, thickness, cv2.LINE_AA)

    text("SIGN POP", 25, 32, 0.65, mint, 2)
    text("LOCAL  /  STATIC LETTER LAB", 590, 32, 0.55, muted)
    is_letter = label in SUPPORTED and len(label) == 1
    text(label, 25, 108, 2.3 if is_letter else 1.25, mint if is_letter else white, 3)
    text("Hold a shape. Let it settle.", 480, 79, 0.65)
    text("Landmark rules - no letter confidence score", 480, 106, 0.48, muted)
    y = top + frame.shape[0]
    text("TRY  F   I   L   V   W   Y", 25, y + 28, 0.65, mint, 2)
    text(f"{fps:.0f} FPS", 850, y + 28, 0.55, muted)
    text("Q / Esc quit    H help    R reset       J / Z motion: unsupported", 25, y + 53, 0.51, muted)
    if help_visible:
        text("Palm toward camera, fingers upright, one hand fully visible. Either hand works.", 25, y + 80, 0.53)
        text("F: finger circle   I: pinky   L: index + thumb   V: two   W: three   Y: thumb + pinky", 25, y + 105, 0.51)
    return canvas


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--preview", type=Path, help="Write a synthetic UI preview without opening a camera")
    parser.add_argument("--self-test", action="store_true", help="Run real hand-tracker inference on a blank image; no camera")
    args = parser.parse_args(argv)
    try:
        import cv2
        import mediapipe as mp
        import numpy as np
    except ImportError as exc:
        print(f"Missing dependency: {exc}\nActivate .venv and run: python -m pip install -r requirements.txt", file=sys.stderr)
        return 1
    if not hasattr(mp, "solutions"):
        print("This app needs MediaPipe 0.10.21. Run: python -m pip install -r requirements.txt", file=sys.stderr)
        return 1
    if args.preview:
        frame = np.full((540, 960, 3), (49, 43, 38), dtype=np.uint8)
        cv2.putText(frame, "Webcam appears here", (255, 280), cv2.FONT_HERSHEY_SIMPLEX, 1, (180, 180, 180), 2)
        if not cv2.imwrite(str(args.preview), render(cv2, np, frame, NO_HAND, 0, True)):
            raise RuntimeError(f"Cannot write {args.preview}")
        print(f"Synthetic preview saved to {args.preview}")
        return 0

    cap = None
    try:
        with mp.solutions.hands.Hands(
            static_image_mode=False, max_num_hands=1, model_complexity=1,
            min_detection_confidence=0.65, min_tracking_confidence=0.65,
        ) as hands:
            if args.self_test:
                result = hands.process(np.zeros((480, 640, 3), dtype=np.uint8))
                if result.multi_hand_landmarks:
                    raise RuntimeError("Unexpected hand detected in blank image")
                print(f"PASS: OpenCV {cv2.__version__}, MediaPipe {mp.__version__}; bundled model inference, no-hand result.")
                return 0
            backend = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else cv2.CAP_ANY
            cap = cv2.VideoCapture(args.camera, backend)
            if not cap.isOpened():
                raise RuntimeError(f"Cannot open camera {args.camera}. Check macOS System Settings > Privacy & Security > Camera; enable your terminal or IDE, restart it, close other camera apps, or try --camera 1.")
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 960)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 540)
            title = "Sign Pop | ASL static letter lab"
            cv2.namedWindow(title, cv2.WINDOW_NORMAL)
            smoother = Smoother()
            help_visible = True
            previous, fps = time.monotonic(), 0.0
            failures = 0
            shown = False
            while True:
                if shown and cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                    break
                ok, frame = cap.read()
                if not ok or frame is None:
                    failures += 1
                    smoother.reset()
                    if failures >= 15:
                        raise RuntimeError("Camera stopped returning frames. Check permissions, reconnect the camera, and close other camera apps.")
                    if cv2.waitKey(50) & 0xFF in (27, ord("q"), ord("Q")):
                        break
                    continue
                failures = 0
                frame = cv2.flip(frame, 1)
                # Bound inference resolution even when a camera ignores capture settings.
                if frame.shape[1] > 960:
                    frame = cv2.resize(frame, (960, round(frame.shape[0] * 960 / frame.shape[1])))
                height, width = frame.shape[:2]
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb.flags.writeable = False
                result = hands.process(rgb)
                raw = None
                if result.multi_hand_landmarks:
                    hand = result.multi_hand_landmarks[0]
                    # MediaPipe z uses the same scale as x; y needs aspect correction.
                    points = [(p.x, p.y * height / width, p.z) for p in hand.landmark]
                    in_frame = all(0.015 < p.x < 0.985 and 0.015 < p.y < 0.985 for p in hand.landmark)
                    raw = classify(points) if in_frame else UNKNOWN
                    mp.solutions.drawing_utils.draw_landmarks(
                        frame, hand, mp.solutions.hands.HAND_CONNECTIONS,
                        mp.solutions.drawing_utils.DrawingSpec(color=(174, 238, 113), thickness=2, circle_radius=4),
                        mp.solutions.drawing_utils.DrawingSpec(color=(240, 192, 116), thickness=2),
                    )
                label = smoother.update(raw)
                now = time.monotonic()
                fps = 0.9 * fps + 0.1 / max(now - previous, 1e-6)
                previous = now
                cv2.imshow(title, render(cv2, np, frame, label, fps, help_visible))
                shown = True
                key = cv2.waitKey(1) & 0xFF
                if key in (27, ord("q"), ord("Q")):
                    break
                if key in (ord("h"), ord("H")):
                    help_visible = not help_visible
                if key in (ord("r"), ord("R")):
                    smoother.reset()
    except KeyboardInterrupt:
        pass
    except (RuntimeError, cv2.error) as exc:
        print(f"Sign Pop: {exc}", file=sys.stderr)
        return 1
    finally:
        if cap is not None:
            cap.release()
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    sys.exit(main())
