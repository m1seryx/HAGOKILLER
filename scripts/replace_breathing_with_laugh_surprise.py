"""
Remove breathing (k8fI3Kkm3GM*.wav) + yawn (+ leftover sigh/breath) from
dataset/000_NonSnore and replace with laughter + surprise vocalizations,
keeping the total file count stable (18,500).
"""

from __future__ import annotations

import hashlib
import re
import wave
from pathlib import Path

import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
NON_DIR = ROOT / "dataset" / "000_NonSnore"
VOCAL_SRC = ROOT / "dataset" / "0_NonSnore"
VIVAE_DIRS = [
    ROOT / "dataset" / "new data non snoreng" / "VIVAE" / "full_set",
    ROOT / "dataset" / "new data non snoreng" / "VIVAE" / "core_set",
]
SAMPLE_RATE = 16000
CLIP_SEC = 3.0
CLIP_N = int(SAMPLE_RATE * CLIP_SEC)

# Breathing YouTube-id clips the user flagged.
BREATH_PREFIX = "k8fI3Kkm3GM"


def load_mono16(path: Path) -> np.ndarray | None:
    try:
        rate, data = wavfile.read(path)
    except Exception:
        return None
    if data.ndim > 1:
        data = data.mean(axis=1)
    if data.dtype == np.int16:
        samples = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        samples = data.astype(np.float32) / 2147483648.0
    else:
        samples = data.astype(np.float32)
        peak = float(np.max(np.abs(samples))) + 1e-9
        samples = samples / peak
    if rate == SAMPLE_RATE:
        return samples
    duration = len(samples) / float(rate)
    target_n = max(1, int(round(duration * SAMPLE_RATE)))
    x_old = np.linspace(0.0, 1.0, num=len(samples), endpoint=False)
    x_new = np.linspace(0.0, 1.0, num=target_n, endpoint=False)
    return np.interp(x_new, x_old, samples).astype(np.float32)


def write_wav(path: Path, samples: np.ndarray) -> None:
    peak = float(np.max(np.abs(samples))) + 1e-9
    pcm = np.clip(samples / peak * 0.9 * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def fingerprint(samples: np.ndarray) -> str:
    step = max(1, SAMPLE_RATE // 20)
    quantized = np.clip((samples[::step] * 64).astype(np.int8), -64, 63).tobytes()
    return hashlib.sha1(quantized).hexdigest()


def is_silent(samples: np.ndarray) -> bool:
    return float(np.sqrt(np.mean(samples ** 2))) < 0.012


def to_clip(samples: np.ndarray, rng: np.random.Generator) -> np.ndarray | None:
    if samples is None or len(samples) == 0 or is_silent(samples):
        return None
    if len(samples) >= CLIP_N:
        start = int(rng.integers(0, len(samples) - CLIP_N + 1))
        clip = samples[start : start + CLIP_N].copy()
    else:
        clip = np.zeros(CLIP_N, dtype=np.float32)
        start = int(rng.integers(0, CLIP_N - len(samples) + 1))
        clip[start : start + len(samples)] = samples
    if is_silent(clip):
        return None
    return clip


def augment(clip: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    out = clip.copy()
    gain = float(rng.uniform(0.75, 1.15))
    out *= gain
    # Small circular shift so duplicates of the same source stay distinct.
    shift = int(rng.integers(-SAMPLE_RATE // 4, SAMPLE_RATE // 4 + 1))
    if shift:
        out = np.roll(out, shift)
    # Mild noise floor so fingerprints differ after gain/shift collisions.
    if float(rng.random()) < 0.35:
        out += rng.normal(0.0, 0.002, size=out.shape).astype(np.float32)
    return out.astype(np.float32)


def collect_remove_targets() -> list[Path]:
    targets: list[Path] = []
    seen: set[str] = set()
    for path in NON_DIR.iterdir():
        if not path.is_file():
            continue
        name = path.name.lower()
        drop = (
            name.startswith(BREATH_PREFIX.lower())
            or "yawn" in name
            or "_sigh" in name
            or name.startswith("sigh")
            or "breath" in name
            or "inhale" in name
            or "exhale" in name
        )
        if not drop:
            continue
        key = str(path.resolve()).lower()
        if key in seen:
            continue
        seen.add(key)
        targets.append(path)
    return sorted(targets)


def existing_names() -> set[str]:
    return {p.name.lower() for p in NON_DIR.iterdir() if p.is_file()}


def collect_laughter_sources(taken_names: set[str]) -> list[Path]:
    out: list[Path] = []
    if not VOCAL_SRC.exists():
        return out
    for path in sorted(VOCAL_SRC.glob("*_laughter.wav")):
        if path.name.lower() in taken_names:
            continue
        out.append(path)
    return out


def collect_surprise_sources(taken_names: set[str]) -> list[Path]:
    out: list[Path] = []
    seen: set[str] = set()
    for folder in VIVAE_DIRS:
        if not folder.exists():
            continue
        for path in sorted(folder.glob("*.wav")):
            # Skip macOS resource forks / junk.
            if path.name.startswith("._"):
                continue
            if "surprise" not in path.name.lower():
                continue
            key = path.name.lower()
            if key in taken_names or key in seen:
                continue
            seen.add(key)
            out.append(path)
    return out


def next_index(prefix: str) -> int:
    highest = 0
    pat = re.compile(rf"^{re.escape(prefix)}_(\d+)\.wav$", re.I)
    for path in NON_DIR.iterdir():
        m = pat.match(path.name)
        if m:
            highest = max(highest, int(m.group(1)))
    return highest + 1


def write_replacements(
    need: int,
    laugh_srcs: list[Path],
    surprise_srcs: list[Path],
) -> tuple[int, int]:
    """Return (laugh_written, surprise_written). Aim ~55% laugh / 45% surprise."""
    if need <= 0:
        return 0, 0

    surprise_quota = min(len(surprise_srcs) * 3, max(1, int(round(need * 0.45))))
    laugh_quota = need - surprise_quota

    rng = np.random.default_rng(20261102)
    avoid_fp: set[str] = set()

    # Seed fingerprints from a sample of current non-snore so we avoid near-dupes.
    existing = [p for p in NON_DIR.iterdir() if p.is_file()]
    sample_n = min(400, len(existing))
    for path in rng.choice(existing, size=sample_n, replace=False):
        samples = load_mono16(Path(path))
        if samples is None:
            continue
        clip = samples[:CLIP_N] if len(samples) >= CLIP_N else samples
        if len(clip) > 0:
            avoid_fp.add(fingerprint(clip))

    laugh_i = next_index("0_laugh")
    surprise_i = next_index("0_surprise")
    laugh_written = 0
    surprise_written = 0

    def emit(kind: str, sources: list[Path], start_idx: int, quota: int) -> int:
        if quota <= 0 or not sources:
            return 0
        written = 0
        order = np.arange(len(sources))
        rng.shuffle(order)
        attempts = 0
        max_attempts = max(quota * 40, 500)
        src_i = 0
        while written < quota and attempts < max_attempts:
            attempts += 1
            src = sources[int(order[src_i % len(order)])]
            src_i += 1
            samples = load_mono16(src)
            clip = to_clip(samples, rng) if samples is not None else None
            if clip is None:
                continue
            # First pass: raw clip; later passes: light augment for variety.
            candidate = clip if written < len(sources) else augment(clip, rng)
            fp = fingerprint(candidate)
            if fp in avoid_fp:
                candidate = augment(clip, rng)
                fp = fingerprint(candidate)
                if fp in avoid_fp:
                    continue
            avoid_fp.add(fp)
            out = NON_DIR / f"0_{kind}_{start_idx + written:05d}.wav"
            write_wav(out, candidate)
            written += 1
            if written % 100 == 0 or written == quota:
                print(f"  {kind} written {written}/{quota}")
        return written

    laugh_written = emit("laugh", laugh_srcs, laugh_i, laugh_quota)
    # If laughter ran short, fold remainder into surprise quota.
    shortfall = laugh_quota - laugh_written
    surprise_written = emit(
        "surprise", surprise_srcs, surprise_i, surprise_quota + shortfall
    )

    still = need - laugh_written - surprise_written
    if still > 0 and laugh_srcs:
        print(f"  filling remaining {still} with more laughter…")
        laugh_written += emit("laugh", laugh_srcs, laugh_i + laugh_written, still)

    return laugh_written, surprise_written


def main() -> None:
    if not NON_DIR.exists():
        raise SystemExit(f"missing {NON_DIR}")

    before = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    targets = collect_remove_targets()
    breath_n = sum(1 for p in targets if p.name.lower().startswith(BREATH_PREFIX.lower()))
    yawn_n = sum(1 for p in targets if "yawn" in p.name.lower())
    other_n = len(targets) - breath_n - yawn_n

    print(f"before count: {before}")
    print(f"remove: {len(targets)}  (k8fI3Kkm3GM breath={breath_n}, yawn={yawn_n}, other={other_n})")

    for path in targets:
        path.unlink(missing_ok=True)

    mid = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    need = before - mid
    print(f"after delete: {mid}; need replacements: {need}")

    taken = existing_names()
    laugh_srcs = collect_laughter_sources(taken)
    surprise_srcs = collect_surprise_sources(taken)
    print(f"unused laughter sources: {len(laugh_srcs)}")
    print(f"unused surprise sources: {len(surprise_srcs)}")

    added_laugh, added_surprise = write_replacements(need, laugh_srcs, surprise_srcs)
    after = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    print(f"added laugh={added_laugh} surprise={added_surprise}")
    print(f"after count: {after}")
    if after != before:
        print(f"WARNING: count drift {before} -> {after}")
    left_k = sum(1 for p in NON_DIR.iterdir() if p.is_file() and p.name.lower().startswith(BREATH_PREFIX.lower()))
    left_yawn = sum(1 for p in NON_DIR.iterdir() if p.is_file() and "yawn" in p.name.lower())
    print(f"remaining k8fI3Kkm3GM={left_k} yawn={left_yawn}")


if __name__ == "__main__":
    main()
