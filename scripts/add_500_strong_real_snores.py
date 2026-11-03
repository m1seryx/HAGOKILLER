"""
Add 500 stronger REAL snoring clips to dataset/001_Snore.

No synthesis. Clips are sliced from existing real recordings in:
  dataset/1_Snore, ALL_SNORING, _alt_snore_sources, _snore_sources
and ranked by snore-band energy (loud / strong) before writing.
"""

from __future__ import annotations

import hashlib
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
SNORE_DIR = ROOT / "dataset" / "001_Snore"
SOURCE_ROOTS = [
    ROOT / "dataset" / "1_Snore",
    ROOT / "dataset" / "ALL_SNORING",
    ROOT / "dataset" / "_alt_snore_sources",
    ROOT / "dataset" / "_snore_sources",
]
WORK = ROOT / "dataset" / "_snore_sources" / "_strong_decode"
SAMPLE_RATE = 16000
CLIP_SEC = 3.0
CLIP_N = int(SAMPLE_RATE * CLIP_SEC)
HOP_N = CLIP_N // 2
NEED = 500
PREFIX = "real_snore_"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def decode_to_wav(src: Path, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        FFMPEG, "-y", "-i", str(src),
        "-ac", "1", "-ar", str(SAMPLE_RATE), "-sample_fmt", "s16", str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0 and dest.exists() and dest.stat().st_size > 1000


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


def load_source(src: Path) -> np.ndarray | None:
    if src.suffix.lower() == ".wav":
        samples = load_mono16(src)
        if samples is not None:
            return samples
    decoded = WORK / f"{hashlib.md5(str(src.resolve()).encode()).hexdigest()}.wav"
    if not decoded.exists() and not decode_to_wav(src, decoded):
        return None
    return load_mono16(decoded)


def write_wav(path: Path, samples: np.ndarray) -> None:
    # Peak-normalize so strong clips stay hot in the file (still real audio).
    peak = float(np.max(np.abs(samples))) + 1e-9
    pcm = np.clip(samples / peak * 0.95 * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def fingerprint(samples: np.ndarray) -> str:
    step = max(1, SAMPLE_RATE // 20)
    quantized = np.clip((samples[::step] * 64).astype(np.int8), -64, 63).tobytes()
    return hashlib.sha1(quantized).hexdigest()


def strength_score(clip: np.ndarray) -> float:
    """Higher = stronger snore: loud RMS + energy in snore-ish band."""
    rms = float(np.sqrt(np.mean(clip ** 2)))
    if rms < 0.02:
        return 0.0
    spectrum = np.abs(np.fft.rfft(clip))
    freqs = np.fft.rfftfreq(len(clip), d=1.0 / SAMPLE_RATE)
    band = (freqs >= 60.0) & (freqs <= 1200.0)
    band_e = float(np.mean(spectrum[band] ** 2)) if np.any(band) else 0.0
    peak = float(np.max(np.abs(clip))) + 1e-9
    # Prefer loud, snore-band-rich clips with some dynamics.
    return rms * 2.0 + band_e * 0.15 + peak * 0.5


def next_index() -> int:
    highest = 0
    for path in SNORE_DIR.iterdir():
        if not path.is_file():
            continue
        stem = path.stem
        if not stem.startswith(PREFIX):
            continue
        tail = stem[len(PREFIX) :]
        if tail.isdigit():
            highest = max(highest, int(tail))
    return highest + 1


def collect_candidates() -> list[Path]:
    files: list[Path] = []
    seen: set[str] = set()
    for root in SOURCE_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".wav", ".mp3", ".flac", ".ogg", ".m4a"}:
                continue
            # Skip decode-cache dirs.
            if "_strong_decode" in path.parts or "_snore_decode" in path.parts:
                continue
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            files.append(path)
    return files


def slice_strong_windows(samples: np.ndarray, keep_top: int = 3) -> list[tuple[float, np.ndarray]]:
    """Return up to keep_top strongest 3s windows from one real recording."""
    scored: list[tuple[float, np.ndarray]] = []
    if samples is None or len(samples) < SAMPLE_RATE // 2:
        return scored
    if len(samples) < CLIP_N:
        pad = np.zeros(CLIP_N - len(samples), dtype=np.float32)
        clip = np.concatenate([samples, pad])
        score = strength_score(clip)
        if score > 0:
            scored.append((score, clip))
        return scored

    # Peak-centered window first (usually the strongest snore burst).
    peak_i = int(np.argmax(np.abs(samples)))
    start0 = max(0, min(len(samples) - CLIP_N, peak_i - CLIP_N // 2))
    starts = {start0}
    # Sparse hops so long files don't explode the pool.
    hop = max(HOP_N, CLIP_N)
    for start in range(0, len(samples) - CLIP_N + 1, hop):
        starts.add(start)

    for start in starts:
        clip = samples[start : start + CLIP_N].astype(np.float32)
        score = strength_score(clip)
        if score > 0:
            scored.append((score, clip))

    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:keep_top]


def main() -> None:
    if not SNORE_DIR.exists():
        raise SystemExit(f"missing {SNORE_DIR}")

    before = sum(1 for p in SNORE_DIR.iterdir() if p.is_file())
    sources = collect_candidates()
    # Prefer larger files (longer real recordings) then shuffle within tiers.
    rng = np.random.default_rng(20261102)
    sources.sort(key=lambda p: p.stat().st_size if p.exists() else 0, reverse=True)
    # Mix: first 60% largest, rest random smaller for variety.
    head_n = min(len(sources), max(NEED * 3, 1200))
    head = sources[:head_n]
    tail = sources[head_n:]
    rng.shuffle(head)
    rng.shuffle(tail)
    sources = head + tail

    print(f"before 001_Snore={before}")
    print(f"real source files={len(sources)}")
    WORK.mkdir(parents=True, exist_ok=True)

    avoid: set[str] = set()
    existing = [p for p in SNORE_DIR.iterdir() if p.is_file()]
    sample_n = min(400, len(existing))
    if sample_n:
        for path in rng.choice(existing, size=sample_n, replace=False):
            samples = load_mono16(Path(path))
            if samples is None:
                continue
            clip = samples[:CLIP_N] if len(samples) >= CLIP_N else samples
            if len(clip) > 0:
                avoid.add(fingerprint(clip))
    print(f"seeded fingerprints={len(avoid)}")

    best: dict[str, tuple[float, np.ndarray]] = {}
    pool_target = NEED * 3  # gather extras, then keep strongest 500
    for i, src in enumerate(sources):
        if len(best) >= pool_target and i >= NEED:
            print(f"  early stop at source {i + 1}, pool={len(best)}")
            break
        if (i + 1) % 100 == 0 or i == 0:
            print(f"  scanning sources {i + 1}/{len(sources)}  pool={len(best)}")
        samples = load_source(src)
        if samples is None:
            continue
        for score, clip in slice_strong_windows(samples):
            fp = fingerprint(clip)
            if fp in avoid:
                continue
            prev = best.get(fp)
            if prev is None or score > prev[0]:
                best[fp] = (score, clip)

    ranked = sorted(best.values(), key=lambda x: x[0], reverse=True)
    print(f"unique strong windows={len(ranked)}; taking top {NEED}")

    start = next_index()
    written = 0
    for score, clip in ranked:
        if written >= NEED:
            break
        fp = fingerprint(clip)
        if fp in avoid:
            continue
        avoid.add(fp)
        out = SNORE_DIR / f"{PREFIX}{start + written:05d}.wav"
        write_wav(out, clip)
        written += 1
        if written % 50 == 0 or written == NEED:
            print(f"  wrote {written}/{NEED}  (score~{score:.4f})")

    after = sum(1 for p in SNORE_DIR.iterdir() if p.is_file())
    print(f"added={written}")
    print(f"after 001_Snore={after} (was {before})")
    if written < NEED:
        print(f"WARNING: only found {written} strong real clips (wanted {NEED})")


if __name__ == "__main__":
    main()
