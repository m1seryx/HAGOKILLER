"""
Build 20,000 snoring WAVs into dataset/human_snoring from ALTERNATE sources only:
  - dataset/archive.zip -> Snoring/
  - dataset/dataset.zip -> Snoring Dataset/1 (Khan)
  - GitHub Snore_Detection_Project snoring class
  - Mixkit / extra BigSoundBank downloads under _alt_snore_sources/web_downloads

Does not reuse dataset/1_Snore MP3s, ALL_SNORING, or the earlier BigSoundBank man/woman pair
as primary seeds (those were the previous pipeline).
"""

from __future__ import annotations

import hashlib
import re
import subprocess
import tempfile
import wave
import warnings
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "dataset" / "human_snoring"
ALT_ROOT = ROOT / "dataset" / "_alt_snore_sources"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SAMPLE_RATE = 16000
TARGET_COUNT = 20000
CLIP_SEC = 3.0


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
        peak = np.max(np.abs(samples)) + 1e-9
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
    return float(np.sqrt(np.mean(samples ** 2))) < 0.01


def soft_pad(n: int, reference: np.ndarray, salt: int) -> np.ndarray:
    scale = float(np.sqrt(np.mean(reference ** 2))) * 0.05 + 1e-4
    rng = np.random.default_rng(salt)
    return rng.normal(0.0, scale, n).astype(np.float32)


def collect_alt_sources() -> list[Path]:
    roots = [
        ALT_ROOT / "archive_snoring",
        ALT_ROOT / "khan_dataset_zip",
        ALT_ROOT / "web_downloads",
        ALT_ROOT / "Snore_Detection_Project" / "Snore_Detection" / "data" / "1",
    ]
    files: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        files.extend(root.rglob("*.wav"))
        files.extend(root.rglob("*.mp3"))
    # Skip obvious non-snore class folders if any slip in.
    cleaned = []
    seen = set()
    for path in files:
        key = str(path.resolve()).lower()
        if key in seen:
            continue
        parts = {part.lower() for part in path.parts}
        if "0" in parts and "data" in parts and path.parent.name == "0":
            continue
        if "non" in path.name.lower() and "snor" in path.name.lower():
            continue
        seen.add(key)
        cleaned.append(path)
    print(f"alternate source files: {len(cleaned)}")
    return cleaned


def load_source(src: Path, work_dir: Path) -> np.ndarray | None:
    if src.suffix.lower() == ".wav":
        samples = load_mono16(src)
        if samples is not None:
            return samples
    decoded = work_dir / f"{hashlib.md5(str(src).encode()).hexdigest()}.wav"
    if not decode_to_wav(src, decoded):
        return None
    return load_mono16(decoded)


def windows(samples: np.ndarray, clip_sec: float, hop_sec: float) -> list[np.ndarray]:
    clip_n = int(clip_sec * SAMPLE_RATE)
    hop_n = max(1, int(hop_sec * SAMPLE_RATE))
    if len(samples) < int(0.6 * SAMPLE_RATE):
        return []
    out: list[np.ndarray] = []
    if len(samples) <= clip_n:
        chunk = samples
        if len(chunk) < clip_n:
            chunk = np.concatenate([chunk, soft_pad(clip_n - len(chunk), chunk, len(chunk))])
        if not is_silent(chunk):
            out.append(chunk[:clip_n])
        return out
    for start in range(0, len(samples) - clip_n + 1, hop_n):
        chunk = samples[start : start + clip_n]
        if not is_silent(chunk):
            out.append(chunk)
    tail = samples[-clip_n:]
    if not is_silent(tail):
        out.append(tail)
    return out


def augment(samples: np.ndarray, salt: int) -> np.ndarray:
    rng = np.random.default_rng(50_000 + salt * 17)
    target_len = int(CLIP_SEC * SAMPLE_RATE)
    base = samples.astype(np.float32)
    loop = np.concatenate([base, base, base])
    start = int(rng.integers(0, max(1, len(base))))
    chunk = loop[start : start + target_len]
    if len(chunk) < target_len:
        chunk = np.concatenate([chunk, soft_pad(target_len - len(chunk), chunk, salt)])

    rate = float(rng.uniform(0.85, 1.15))
    stretched_n = max(1, int(round(len(chunk) / rate)))
    x_old = np.linspace(0.0, 1.0, num=len(chunk), endpoint=False)
    x_new = np.linspace(0.0, 1.0, num=stretched_n, endpoint=False)
    stretched = np.interp(x_new, x_old, chunk).astype(np.float32)
    if len(stretched) >= target_len:
        s0 = int(rng.integers(0, len(stretched) - target_len + 1))
        out = stretched[s0 : s0 + target_len]
    else:
        out = np.concatenate([stretched, soft_pad(target_len - len(stretched), stretched, salt + 3)])

    out *= float(rng.uniform(0.4, 1.4))
    if rng.random() < 0.45:
        kernel = max(3, int(rng.integers(3, 15)) | 1)
        pad = kernel // 2
        padded = np.pad(out, (pad, pad), mode="edge")
        cumsum = np.cumsum(padded, dtype=np.float64)
        low = ((cumsum[kernel:] - cumsum[:-kernel]) / kernel).astype(np.float32)
        mix = float(rng.uniform(0.3, 0.95))
        out = mix * out + (1.0 - mix) * low[: len(out)]
    if rng.random() < 0.25:
        # Mild tremolo / flutter
        t = np.arange(len(out), dtype=np.float32) / SAMPLE_RATE
        out *= (1.0 + float(rng.uniform(0.05, 0.2)) * np.sin(2 * np.pi * float(rng.uniform(12, 40)) * t)).astype(np.float32)

    noise = rng.normal(0.0, float(np.sqrt(np.mean(out ** 2)) + 1e-6) * rng.uniform(0.01, 0.1), len(out))
    return (out + noise.astype(np.float32)).astype(np.float32)


def existing_count() -> int:
    return len(list(OUT_DIR.glob("real_snore_*.wav")))


def next_index() -> int:
    files = list(OUT_DIR.glob("real_snore_*.wav"))
    if not files:
        return 1
    return max(int(re.search(r"(\d+)", p.stem).group(1)) for p in files) + 1


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    start = next_index()
    print(f"existing={existing_count()} appending={TARGET_COUNT} from index {start}")

    sources = collect_alt_sources()
    if not sources:
        raise SystemExit("no alternate snoring sources found; run fetch_alt_snore_sources.py first")

    seen: set[str] = set()
    for path in OUT_DIR.glob("real_snore_*.wav"):
        samples = load_mono16(path)
        if samples is not None:
            seen.add(fingerprint(samples))

    clips: list[tuple[str, np.ndarray]] = []
    seeds: list[tuple[str, np.ndarray]] = []

    with tempfile.TemporaryDirectory(prefix="alt_snore_") as tmp:
        work = Path(tmp)
        for hop, clip in [(1.0, 3.0), (0.5, 2.5), (0.35, 2.0), (0.25, 1.5), (0.2, 1.0)]:
            if len(clips) >= TARGET_COUNT:
                break
            print(f"segment pass hop={hop} clip={clip} have={len(clips)}")
            for src in sources:
                audio = load_source(src, work)
                if audio is None:
                    continue
                seeds.append((src.stem, audio))
                for chunk in windows(audio, clip_sec=clip, hop_sec=hop):
                    fp = fingerprint(chunk)
                    if fp in seen:
                        continue
                    seen.add(fp)
                    clips.append((src.stem, chunk))
                    if len(clips) >= TARGET_COUNT:
                        break
                if len(clips) >= TARGET_COUNT:
                    break

        if len(clips) < TARGET_COUNT:
            print(f"augmenting from {len(seeds)} alt seeds for remaining {TARGET_COUNT - len(clips)}")
            if not seeds:
                raise SystemExit("no seed audio loaded from alternate sources")
            # Keep a manageable seed pool.
            seed_pool = seeds[:1500]
            salt = 0
            stagnant = 0
            while len(clips) < TARGET_COUNT:
                stem, base = seed_pool[salt % len(seed_pool)]
                salt += 1
                chunk = augment(base, salt)
                if is_silent(chunk):
                    stagnant += 1
                    if stagnant > 10000:
                        break
                    continue
                fp = fingerprint(chunk)
                if fp in seen:
                    stagnant += 1
                    if stagnant > 50000:
                        print("too many fingerprint collisions; stopping")
                        break
                    continue
                stagnant = 0
                seen.add(fp)
                clips.append((f"{stem}_alt_aug", chunk))
                if len(clips) % 1000 == 0:
                    print(f"unique clips {len(clips)}/{TARGET_COUNT}")

    clips = clips[:TARGET_COUNT]
    for offset, (stem, chunk) in enumerate(clips):
        index = start + offset
        out = OUT_DIR / f"real_snore_{index:05d}.wav"
        write_wav(out, chunk)
        if (offset + 1) % 1000 == 0 or offset + 1 == len(clips):
            print(f"wrote +{offset + 1}/{len(clips)} -> {out.name} ({stem})")

    total = existing_count()
    (OUT_DIR / "README.txt").write_text(
        "Real / alt-source human snoring WAV clips for HAGOKILLER.\n"
        f"Count: {total}\n"
        f"Format: mono 16-bit PCM, {SAMPLE_RATE} Hz\n"
        "Alternate sources used for this batch:\n"
        "  - archive.zip / Snoring\n"
        "  - dataset.zip / Snoring Dataset class 1 (Khan)\n"
        "  - GitHub jibran-mujtaba/Snore_Detection_Project data/1\n"
        "  - Mixkit snoring SFX + extra BigSoundBank HMNSnor downloads\n"
        "Clips beyond unique windows are light augmentations of those real sources.\n",
        encoding="utf-8",
    )
    print(f"Done. Added {len(clips)}. Folder now has {total} WAVs.")


if __name__ == "__main__":
    main()
