"""
Build / append real human snoring WAV clips into dataset/human_snoring.

Sources:
  - CC0 BigSoundBank HMNSnor MP3s
  - Existing real snore MP3/WAV files in dataset/1_Snore
  - dataset/ALL_SNORING wav clips

Each output clip is mono 16-bit PCM at 16 kHz.
"""

from __future__ import annotations

import hashlib
import re
import subprocess
import tempfile
import urllib.request
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "dataset" / "human_snoring"
SOURCE_DIR = ROOT / "dataset" / "_snore_sources"
EXISTING_DIR = ROOT / "dataset" / "1_Snore"
ALL_SNORING_DIR = ROOT / "dataset" / "ALL_SNORING"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SAMPLE_RATE = 16000
CLIP_SEC = 3.0
HOP_SEC = 1.5
EXTRA_COUNT = 10000
USER_AGENT = "HAGOKILLER-dataset-builder/1.0"

BIGSOUNDBANK_IDS = {
    170: "man_snoring",
    653: "woman_snoring",
}

BIGSOUNDBANK_EXTRA = {
    929: "baby_14mo_snoring",
    1070: "child_snoring_1",
    1809: "child_snoring_2",
    1810: "child_snoring_3",
}


def download(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            data = response.read()
        if len(data) < 1000 or data[:15].lstrip().startswith(b"<!DOCTYPE"):
            print(f"skip bad download: {url}")
            return False
        dest.write_bytes(data)
        print(f"downloaded {dest.name} ({len(data)} bytes)")
        return True
    except Exception as exc:
        print(f"download failed {url}: {exc}")
        return False


def decode_to_wav(src: Path, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        FFMPEG,
        "-y",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        str(SAMPLE_RATE),
        "-sample_fmt",
        "s16",
        str(dest),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not dest.exists() or dest.stat().st_size < 1000:
        print(f"ffmpeg failed for {src.name}: {result.stderr[-400:]}")
        return False
    return True


def load_mono16(path: Path) -> np.ndarray | None:
    try:
        rate, data = wavfile.read(path)
    except Exception as exc:
        print(f"read failed {path.name}: {exc}")
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
    if rate != SAMPLE_RATE:
        tmp = path.with_suffix(".resamp.wav")
        if not decode_to_wav(path, tmp):
            return None
        return load_mono16(tmp)
    return samples


def write_wav(path: Path, samples: np.ndarray) -> None:
    peak = float(np.max(np.abs(samples))) + 1e-9
    normalized = samples / peak * 0.9
    pcm = np.clip(normalized * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())


def fingerprint(samples: np.ndarray) -> str:
    step = max(1, SAMPLE_RATE // 20)
    env = samples[::step]
    quantized = np.clip((env * 64).astype(np.int8), -64, 63).tobytes()
    return hashlib.sha1(quantized).hexdigest()


def is_mostly_silent(samples: np.ndarray) -> bool:
    rms = float(np.sqrt(np.mean(samples ** 2)))
    return rms < 0.01


def fetch_bank(ids: dict[int, str]) -> list[Path]:
    files: list[Path] = []
    for sound_id, label in ids.items():
        mp3 = SOURCE_DIR / f"bsb_{sound_id:04d}_{label}.mp3"
        if not mp3.exists() or mp3.stat().st_size < 1000:
            url = f"https://bigsoundbank.com/UPLOAD/mp3/{sound_id:04d}.mp3"
            download(url, mp3)
        if mp3.exists() and mp3.stat().st_size >= 1000:
            files.append(mp3)
    return files


def adult_name(name: str) -> bool:
    lower = name.lower()
    if re.search(r"baby|child|infant|kid", lower):
        return False
    return bool(re.search(r"snor|ronc|ronqu|dormindo|man|male|woman|female|person|pessoa|sleep", lower))


def collect_source_audio() -> list[Path]:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    primary: list[Path] = []
    secondary: list[Path] = []

    primary.extend(fetch_bank(BIGSOUNDBANK_IDS))

    if EXISTING_DIR.exists():
        for path in sorted(EXISTING_DIR.iterdir()):
            name = path.name.lower()
            if path.suffix.lower() == ".mp3" and adult_name(name):
                primary.append(path)
            elif path.suffix.lower() == ".mp3" and re.search(r"snor|ronc|breath|sleep", name):
                secondary.append(path)
            elif path.suffix.lower() == ".wav":
                secondary.append(path)

    if ALL_SNORING_DIR.exists():
        secondary.extend(sorted(ALL_SNORING_DIR.glob("*.wav")))

    secondary.extend(fetch_bank(BIGSOUNDBANK_EXTRA))

    unique: list[Path] = []
    seen = set()
    for path in primary + secondary:
        key = str(path.resolve()).lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(path)
    print(f"source files: {len(unique)} (adult-first)")
    return unique


def load_source_samples(src: Path, work_dir: Path) -> np.ndarray | None:
    if src.suffix.lower() == ".wav":
        try:
            rate, data = wavfile.read(src)
        except Exception:
            decoded = work_dir / f"{hashlib.md5(str(src).encode()).hexdigest()}.wav"
            if not decode_to_wav(src, decoded):
                return None
            return load_mono16(decoded)
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
        # Linear resample for already-decoded wav sources.
        duration = len(samples) / float(rate)
        target_n = max(1, int(round(duration * SAMPLE_RATE)))
        x_old = np.linspace(0.0, 1.0, num=len(samples), endpoint=False)
        x_new = np.linspace(0.0, 1.0, num=target_n, endpoint=False)
        return np.interp(x_new, x_old, samples).astype(np.float32)

    decoded = work_dir / f"{hashlib.md5(str(src).encode()).hexdigest()}_{src.stem[:40]}.wav"
    if not decode_to_wav(src, decoded):
        return None
    return load_mono16(decoded)


def segment_file(src: Path, work_dir: Path, hop_sec: float = HOP_SEC, clip_sec: float = CLIP_SEC) -> list[np.ndarray]:
    samples = load_source_samples(src, work_dir)
    min_len = int(max(1.0, clip_sec * 0.5) * SAMPLE_RATE)
    if samples is None or len(samples) < min_len:
        return []

    clip_n = int(clip_sec * SAMPLE_RATE)
    hop_n = max(1, int(hop_sec * SAMPLE_RATE))
    clips: list[np.ndarray] = []
    if len(samples) <= clip_n:
        if not is_mostly_silent(samples):
            # Pad short real clips to the target window with quiet room noise.
            if len(samples) < clip_n:
                pad = soft_pad(clip_n - len(samples), samples)
                samples = np.concatenate([samples, pad])
            clips.append(samples[:clip_n])
        return clips

    for start in range(0, len(samples) - clip_n + 1, hop_n):
        chunk = samples[start : start + clip_n]
        if is_mostly_silent(chunk):
            continue
        clips.append(chunk)
    tail = samples[-clip_n:]
    if not is_mostly_silent(tail):
        clips.append(tail)
    return clips


def soft_pad(n: int, reference: np.ndarray) -> np.ndarray:
    noise_scale = float(np.sqrt(np.mean(reference ** 2))) * 0.05 + 1e-4
    rng = np.random.default_rng(abs(hash(reference.tobytes()[:64])) % (2**32))
    return rng.normal(0.0, noise_scale, n).astype(np.float32)


def augment_real(samples: np.ndarray, salt: int) -> np.ndarray:
    """Light transforms of real snore audio only (gain, crop, mild speed, noise)."""
    rng = np.random.default_rng(10_000 + salt * 13)
    out = samples.astype(np.float32).copy()
    target_len = max(len(out), int(1.0 * SAMPLE_RATE))

    # Random crop / wrap from a looping view of the real clip.
    if len(out) >= int(0.8 * SAMPLE_RATE):
        loop = np.concatenate([out, out])
        win = min(target_len, len(out))
        start = int(rng.integers(0, len(out)))
        out = loop[start : start + win]
        if len(out) < target_len:
            out = np.concatenate([out, soft_pad(target_len - len(out), out)])
        else:
            out = out[:target_len]

    rate = float(rng.uniform(0.88, 1.12))
    stretched_n = max(1, int(round(len(out) / rate)))
    x_old = np.linspace(0.0, 1.0, num=len(out), endpoint=False)
    x_new = np.linspace(0.0, 1.0, num=stretched_n, endpoint=False)
    stretched = np.interp(x_new, x_old, out).astype(np.float32)
    if len(stretched) >= target_len:
        start = int(rng.integers(0, len(stretched) - target_len + 1))
        out = stretched[start : start + target_len]
    else:
        out = np.concatenate([stretched, soft_pad(target_len - len(stretched), stretched)])

    out *= float(rng.uniform(0.45, 1.35))
    if rng.random() < 0.4:
        # Cheap spectral tilt: blend with a moving average.
        kernel = max(3, int(rng.integers(3, 12)) | 1)
        pad = kernel // 2
        padded = np.pad(out, (pad, pad), mode="edge")
        cumsum = np.cumsum(padded, dtype=np.float64)
        low = ((cumsum[kernel:] - cumsum[:-kernel]) / kernel).astype(np.float32)
        mix = float(rng.uniform(0.35, 0.9))
        out = mix * out + (1.0 - mix) * low[: len(out)]

    noise = rng.normal(0.0, float(np.sqrt(np.mean(out ** 2)) + 1e-6) * rng.uniform(0.01, 0.08), len(out))
    return (out + noise.astype(np.float32)).astype(np.float32)


def existing_outputs() -> list[Path]:
    return sorted(OUT_DIR.glob("real_snore_*.wav"), key=lambda p: int(re.search(r"(\d+)", p.stem).group(1)))


def next_index(files: list[Path]) -> int:
    if not files:
        return 1
    return int(re.search(r"(\d+)", files[-1].stem).group(1)) + 1


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("snore_*.wav"):
        old.unlink()

    present = existing_outputs()
    start_index = next_index(present)
    print(f"keeping {len(present)} existing clips; appending {EXTRA_COUNT} from index {start_index}")

    seen_fp: set[str] = set()
    for path in present:
        samples = load_mono16(path)
        if samples is not None:
            seen_fp.add(fingerprint(samples))

    sources = collect_source_audio()
    new_clips: list[tuple[str, np.ndarray]] = []

    passes = [
        (1.5, 3.0),
        (0.75, 3.0),
        (0.5, 2.5),
        (0.4, 2.0),
        (0.35, 1.5),
        (0.25, 1.25),
        (0.2, 1.0),
    ]

    with tempfile.TemporaryDirectory(prefix="snore_decode_") as tmp:
        work_dir = Path(tmp)
        for hop_sec, clip_sec in passes:
            if len(new_clips) >= EXTRA_COUNT:
                break
            print(f"pass hop={hop_sec}s clip={clip_sec}s (have {len(new_clips)}/{EXTRA_COUNT})")
            for src in sources:
                for chunk in segment_file(src, work_dir, hop_sec=hop_sec, clip_sec=clip_sec):
                    fp = fingerprint(chunk)
                    if fp in seen_fp:
                        continue
                    seen_fp.add(fp)
                    new_clips.append((src.stem, chunk))
                    if len(new_clips) >= EXTRA_COUNT:
                        break
                if len(new_clips) >= EXTRA_COUNT:
                    break

        if len(new_clips) < EXTRA_COUNT:
            remaining = EXTRA_COUNT - len(new_clips)
            print(f"augmenting real clips for the remaining {remaining}")
            seed_clips: list[tuple[str, np.ndarray]] = list(new_clips)
            # Prefer already-saved real clips as seeds so we do not depend on one long pass.
            for path in present:
                samples = load_mono16(path)
                if samples is not None and not is_mostly_silent(samples):
                    seed_clips.append((path.stem, samples))
                if len(seed_clips) >= 800:
                    break
            if not seed_clips:
                raise SystemExit("no real snore seeds available to augment")
            aug_index = 0
            stagnant = 0
            while len(new_clips) < EXTRA_COUNT:
                stem, base = seed_clips[aug_index % len(seed_clips)]
                aug_index += 1
                chunk = augment_real(base, aug_index)
                if is_mostly_silent(chunk):
                    stagnant += 1
                    if stagnant > 5000:
                        break
                    continue
                fp = fingerprint(chunk)
                if fp in seen_fp:
                    stagnant += 1
                    if stagnant > 20000:
                        print("fingerprint collisions too high; stopping early")
                        break
                    continue
                stagnant = 0
                seen_fp.add(fp)
                new_clips.append((f"{stem}_aug", chunk))
                if len(new_clips) % 500 == 0:
                    print(f"augmented unique clips: {len(new_clips)}/{EXTRA_COUNT}")

    new_clips = new_clips[:EXTRA_COUNT]
    if len(new_clips) < EXTRA_COUNT:
        print(f"warning: only found {len(new_clips)} new unique clips")

    for offset, (stem, chunk) in enumerate(new_clips):
        index = start_index + offset
        out = OUT_DIR / f"real_snore_{index:05d}.wav"
        write_wav(out, chunk)
        total_written = offset + 1
        if total_written % 250 == 0 or total_written == len(new_clips):
            print(f"wrote +{total_written}/{len(new_clips)} -> {out.name} from {stem}")

    total = len(existing_outputs())
    (OUT_DIR / "README.txt").write_text(
        "Real human snoring WAV clips for HAGOKILLER.\n"
        f"Count: {total}\n"
        f"Format: mono 16-bit PCM, {SAMPLE_RATE} Hz\n"
        "Sources: BigSoundBank CC0 HMNSnor + dataset/1_Snore + dataset/ALL_SNORING.\n",
        encoding="utf-8",
    )
    print(f"Done. Added {len(new_clips)} clips. Folder now has {total} real snoring WAVs.")


if __name__ == "__main__":
    main()
