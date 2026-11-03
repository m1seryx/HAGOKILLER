"""
Remove synthesized snores (1_strong_*) and 1_extra_* from dataset/001_Snore,
replace each with REAL (non-synthesized) snore clips from:
  1_Snore / ALL_SNORING / _alt_snore_sources / _snore_sources

Keeps the folder file count stable. Output names: real_snore_XXXXX.wav
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
HOP_N = CLIP_N  # sparse hops for speed / variety
PREFIX = "real_snore_"
REMOVE_PREFIXES = ("1_strong_", "1_extra_")
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
    rms = float(np.sqrt(np.mean(clip ** 2)))
    if rms < 0.015:
        return 0.0
    spectrum = np.abs(np.fft.rfft(clip))
    freqs = np.fft.rfftfreq(len(clip), d=1.0 / SAMPLE_RATE)
    band = (freqs >= 60.0) & (freqs <= 1200.0)
    band_e = float(np.mean(spectrum[band] ** 2)) if np.any(band) else 0.0
    peak = float(np.max(np.abs(clip))) + 1e-9
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


def collect_remove_targets() -> list[Path]:
    targets: list[Path] = []
    for path in SNORE_DIR.iterdir():
        if not path.is_file():
            continue
        name = path.name.lower()
        if any(name.startswith(p) for p in REMOVE_PREFIXES):
            targets.append(path)
    return sorted(targets)


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
            if "_strong_decode" in path.parts or "_snore_decode" in path.parts:
                continue
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            files.append(path)
    return files


def slice_windows(samples: np.ndarray, keep_top: int = 4) -> list[tuple[float, np.ndarray]]:
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

    peak_i = int(np.argmax(np.abs(samples)))
    start0 = max(0, min(len(samples) - CLIP_N, peak_i - CLIP_N // 2))
    starts = {start0}
    for start in range(0, len(samples) - CLIP_N + 1, HOP_N):
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
    targets = collect_remove_targets()
    strong_n = sum(1 for p in targets if p.name.lower().startswith("1_strong_"))
    extra_n = sum(1 for p in targets if p.name.lower().startswith("1_extra_"))
    print(f"before 001_Snore={before}")
    print(f"removing synth 1_strong_={strong_n}  1_extra_={extra_n}  total={len(targets)}")

    for path in targets:
        path.unlink(missing_ok=True)

    mid = sum(1 for p in SNORE_DIR.iterdir() if p.is_file())
    need = before - mid
    print(f"after delete={mid}; need real replacements={need}")
    if need <= 0:
        print("nothing to replace")
        return

    WORK.mkdir(parents=True, exist_ok=True)
    sources = collect_candidates()
    rng = np.random.default_rng(20261102)
    sources.sort(key=lambda p: p.stat().st_size if p.exists() else 0, reverse=True)
    head_n = min(len(sources), max(need * 4, 2500))
    head = sources[:head_n]
    tail = sources[head_n:]
    rng.shuffle(head)
    rng.shuffle(tail)
    sources = head + tail
    print(f"real source files={len(sources)}")

    avoid: set[str] = set()
    remaining = [p for p in SNORE_DIR.iterdir() if p.is_file()]
    sample_n = min(600, len(remaining))
    if sample_n:
        for path in rng.choice(remaining, size=sample_n, replace=False):
            samples = load_mono16(Path(path))
            if samples is None:
                continue
            clip = samples[:CLIP_N] if len(samples) >= CLIP_N else samples
            if len(clip) > 0:
                avoid.add(fingerprint(clip))
    print(f"seeded fingerprints={len(avoid)}")

    best: dict[str, tuple[float, np.ndarray]] = {}
    pool_target = need + max(300, need // 2)
    for i, src in enumerate(sources):
        if len(best) >= pool_target and i >= need:
            print(f"  early stop at source {i + 1}, pool={len(best)}")
            break
        if (i + 1) % 150 == 0 or i == 0:
            print(f"  scanning sources {i + 1}/{len(sources)}  pool={len(best)}")
        samples = load_source(src)
        if samples is None:
            continue
        for score, clip in slice_windows(samples):
            fp = fingerprint(clip)
            if fp in avoid:
                continue
            prev = best.get(fp)
            if prev is None or score > prev[0]:
                best[fp] = (score, clip)

    ranked = sorted(best.values(), key=lambda x: x[0], reverse=True)
    print(f"unique real windows={len(ranked)}; writing {need}")

    start = next_index()
    written = 0
    for score, clip in ranked:
        if written >= need:
            break
        fp = fingerprint(clip)
        if fp in avoid:
            continue
        avoid.add(fp)
        out = SNORE_DIR / f"{PREFIX}{start + written:05d}.wav"
        write_wav(out, clip)
        written += 1
        if written % 100 == 0 or written == need:
            print(f"  wrote {written}/{need}  (score~{score:.4f})")

    after = sum(1 for p in SNORE_DIR.iterdir() if p.is_file())
    left_strong = sum(1 for p in SNORE_DIR.iterdir() if p.is_file() and p.name.lower().startswith("1_strong_"))
    left_extra = sum(1 for p in SNORE_DIR.iterdir() if p.is_file() and p.name.lower().startswith("1_extra_"))
    print(f"added real={written}")
    print(f"after 001_Snore={after} (was {before})")
    print(f"remaining 1_strong_={left_strong} 1_extra_={left_extra}")
    if written < need or after != before:
        print(f"WARNING: drift/shortfall need={need} wrote={written} before={before} after={after}")


if __name__ == "__main__":
    main()
