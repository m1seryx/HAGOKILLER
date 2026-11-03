"""
Bring dataset/000_NonSnore and dataset/001_Snore to 18,500 files each.

- Non-snore: +1000 speaking/talking clips (LibriSpeech speech, sliced to 3s @ 16 kHz)
- Snore: +1000 clips copied from unused sources in 1_Snore / ALL_SNORING / _alt_snore_sources
"""

from __future__ import annotations

import hashlib
import shutil
import subprocess
import tarfile
import urllib.request
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
NON_DIR = ROOT / "dataset" / "000_NonSnore"
SNORE_DIR = ROOT / "dataset" / "001_Snore"
SPEECH_CACHE = ROOT / "dataset" / "_speech_sources"
TARGET = 18500
SAMPLE_RATE = 16000
CLIP_SEC = 3.0
CLIP_N = int(SAMPLE_RATE * CLIP_SEC)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
UA = "HAGOKILLER-dataset-builder/1.0"

# Mini LibriSpeech (~337 MB) — continuous spoken English.
LIBRISPEECH_URL = "https://www.openslr.org/resources/31/train-clean-5.tar.gz"


def count_files(folder: Path) -> int:
    return sum(1 for p in folder.iterdir() if p.is_file())


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


def download(url: str, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"using cached {dest.name}")
        return True
    print(f"downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            with open(dest, "wb") as out:
                shutil.copyfileobj(response, out)
        print(f"saved {dest} ({dest.stat().st_size} bytes)")
        return dest.stat().st_size > 1_000_000
    except Exception as exc:
        print(f"download failed: {exc}")
        return False


def ensure_librispeech() -> list[Path]:
    SPEECH_CACHE.mkdir(parents=True, exist_ok=True)
    archive = SPEECH_CACHE / "train-clean-5.tar.gz"
    extract_root = SPEECH_CACHE / "LibriSpeech"
    flacs = list(extract_root.rglob("*.flac")) if extract_root.exists() else []
    if len(flacs) >= 200:
        print(f"LibriSpeech flacs ready: {len(flacs)}")
        return sorted(flacs)

    if not download(LIBRISPEECH_URL, archive):
        return []

    print("extracting LibriSpeech…")
    with tarfile.open(archive, "r:gz") as tar:
        tar.extractall(SPEECH_CACHE)
    flacs = sorted(extract_root.rglob("*.flac"))
    print(f"extracted flacs: {len(flacs)}")
    return flacs


def next_index(folder: Path, prefix: str) -> int:
    highest = 0
    for path in folder.iterdir():
        if not path.is_file():
            continue
        name = path.stem
        if name.startswith(prefix):
            tail = name[len(prefix) :]
            if tail.isdigit():
                highest = max(highest, int(tail))
    return highest + 1


def augment_snore(need: int) -> int:
    if need <= 0:
        return 0
    existing_names = {p.name.lower() for p in SNORE_DIR.iterdir() if p.is_file()}
    existing_stems = {Path(n).stem.lower() for n in existing_names}

    candidates: list[Path] = []
    for root in [
        ROOT / "dataset" / "1_Snore",
        ROOT / "dataset" / "ALL_SNORING",
        ROOT / "dataset" / "_alt_snore_sources",
    ]:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix.lower() not in {".wav", ".mp3", ".flac", ".ogg"}:
                continue
            if path.name.lower() in existing_names or path.stem.lower() in existing_stems:
                continue
            candidates.append(path)

    print(f"unused snore candidates: {len(candidates)}")
    rng = np.random.default_rng(18500)
    rng.shuffle(candidates)

    start = next_index(SNORE_DIR, "1_extra_")
    written = 0
    seen_fp: set[str] = set()
    work = SPEECH_CACHE / "_snore_decode"
    work.mkdir(parents=True, exist_ok=True)

    for src in candidates:
        if written >= need:
            break
        samples = None
        if src.suffix.lower() == ".wav":
            samples = load_mono16(src)
        if samples is None:
            decoded = work / f"{hashlib.md5(str(src).encode()).hexdigest()}.wav"
            if not decoded.exists() and not decode_to_wav(src, decoded):
                continue
            samples = load_mono16(decoded)
        if samples is None or len(samples) < SAMPLE_RATE // 2 or is_silent(samples):
            continue

        # Prefer a mid clip of CLIP_SEC when longer.
        if len(samples) >= CLIP_N:
            mid = max(0, (len(samples) - CLIP_N) // 2)
            clip = samples[mid : mid + CLIP_N]
        else:
            pad = CLIP_N - len(samples)
            clip = np.concatenate([samples, np.zeros(pad, dtype=np.float32)])

        fp = fingerprint(clip)
        if fp in seen_fp:
            continue
        seen_fp.add(fp)

        out = SNORE_DIR / f"1_extra_{start + written:05d}.wav"
        write_wav(out, clip)
        written += 1
        if written % 100 == 0:
            print(f"  snore written {written}/{need}")

    return written


def augment_talking(need: int) -> int:
    if need <= 0:
        return 0
    flacs = ensure_librispeech()
    if not flacs:
        print("ERROR: no LibriSpeech speech sources available")
        return 0

    rng = np.random.default_rng(18501)
    order = np.arange(len(flacs))
    rng.shuffle(order)

    start = next_index(NON_DIR, "0_talk_")
    written = 0
    seen_fp: set[str] = set()
    work = SPEECH_CACHE / "_speech_decode"
    work.mkdir(parents=True, exist_ok=True)

    for idx in order:
        if written >= need:
            break
        src = flacs[int(idx)]
        decoded = work / f"{src.stem}_{hashlib.md5(str(src).encode()).hexdigest()[:8]}.wav"
        if not decoded.exists():
            if not decode_to_wav(src, decoded):
                continue
        samples = load_mono16(decoded)
        if samples is None or is_silent(samples):
            continue

        # Slice overlapping 3s windows from each utterance.
        if len(samples) < CLIP_N:
            continue
        hop = CLIP_N // 2
        max_start = len(samples) - CLIP_N
        starts = list(range(0, max_start + 1, hop))
        rng.shuffle(starts)
        for off in starts:
            if written >= need:
                break
            clip = samples[off : off + CLIP_N]
            if is_silent(clip):
                continue
            fp = fingerprint(clip)
            if fp in seen_fp:
                continue
            seen_fp.add(fp)
            out = NON_DIR / f"0_talk_{start + written:05d}.wav"
            write_wav(out, clip)
            written += 1
            if written % 100 == 0:
                print(f"  talk written {written}/{need}")

    return written


def main() -> None:
    NON_DIR.mkdir(parents=True, exist_ok=True)
    SNORE_DIR.mkdir(parents=True, exist_ok=True)

    non_count = count_files(NON_DIR)
    snore_count = count_files(SNORE_DIR)
    print(f"before: 000_NonSnore={non_count}  001_Snore={snore_count}")

    need_non = max(0, TARGET - non_count)
    need_snore = max(0, TARGET - snore_count)
    print(f"need: talking={need_non}  snore={need_snore}")

    added_snore = augment_snore(need_snore)
    added_talk = augment_talking(need_non)

    print(
        f"after: 000_NonSnore={count_files(NON_DIR)} (+{added_talk} talk)  "
        f"001_Snore={count_files(SNORE_DIR)} (+{added_snore} snore)"
    )


if __name__ == "__main__":
    main()
