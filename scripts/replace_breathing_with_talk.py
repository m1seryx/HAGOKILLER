"""
Remove normal breathing / sigh clips from dataset/000_NonSnore and replace
each deleted file with a 3s talking WAV (LibriSpeech), keeping the count stable.
"""

from __future__ import annotations

import csv
import hashlib
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
NON_DIR = ROOT / "dataset" / "000_NonSnore"
SPEECH_CACHE = ROOT / "dataset" / "_speech_sources"
ESC_META = ROOT / "dataset" / "ESC-50-master" / "ESC-50-master" / "meta" / "esc50.csv"
SAMPLE_RATE = 16000
CLIP_SEC = 3.0
CLIP_N = int(SAMPLE_RATE * CLIP_SEC)
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


def collect_breathing_files() -> list[Path]:
    targets: list[Path] = []
    seen: set[str] = set()

    # VocalSound-style sighs / explicit breath names
    for path in NON_DIR.iterdir():
        if not path.is_file():
            continue
        name = path.name.lower()
        if any(k in name for k in ("_sigh", "sigh.", "breath", "inhale", "exhale")):
            key = str(path.resolve()).lower()
            if key not in seen:
                seen.add(key)
                targets.append(path)

    # ESC-50 "breathing" category copies
    if ESC_META.exists():
        with ESC_META.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if row.get("category") != "breathing":
                    continue
                path = NON_DIR / row["filename"]
                if path.exists():
                    key = str(path.resolve()).lower()
                    if key not in seen:
                        seen.add(key)
                        targets.append(path)

    return sorted(targets)


def existing_talk_fingerprints() -> set[str]:
    fps: set[str] = set()
    for path in NON_DIR.glob("0_talk_*.wav"):
        samples = load_mono16(path)
        if samples is not None and len(samples) >= CLIP_N // 2:
            fps.add(fingerprint(samples[:CLIP_N] if len(samples) >= CLIP_N else samples))
    return fps


def next_talk_index() -> int:
    highest = 0
    for path in NON_DIR.glob("0_talk_*.wav"):
        tail = path.stem.split("_")[-1]
        if tail.isdigit():
            highest = max(highest, int(tail))
    return highest + 1


def generate_talk_clips(need: int, avoid_fp: set[str]) -> int:
    flacs = sorted((SPEECH_CACHE / "LibriSpeech").rglob("*.flac"))
    if not flacs:
        raise SystemExit("LibriSpeech not found under dataset/_speech_sources — run augment script first")

    rng = np.random.default_rng(20261102)
    order = np.arange(len(flacs))
    rng.shuffle(order)

    work = SPEECH_CACHE / "_speech_decode"
    work.mkdir(parents=True, exist_ok=True)
    start = next_talk_index()
    written = 0

    for idx in order:
        if written >= need:
            break
        src = flacs[int(idx)]
        decoded = work / f"{src.stem}_{hashlib.md5(str(src).encode()).hexdigest()[:8]}.wav"
        if not decoded.exists() and not decode_to_wav(src, decoded):
            continue
        samples = load_mono16(decoded)
        if samples is None or len(samples) < CLIP_N or is_silent(samples):
            continue

        hop = CLIP_N // 2
        starts = list(range(0, len(samples) - CLIP_N + 1, hop))
        rng.shuffle(starts)
        for off in starts:
            if written >= need:
                break
            clip = samples[off : off + CLIP_N]
            if is_silent(clip):
                continue
            fp = fingerprint(clip)
            if fp in avoid_fp:
                continue
            avoid_fp.add(fp)
            out = NON_DIR / f"0_talk_{start + written:05d}.wav"
            write_wav(out, clip)
            written += 1
            if written % 100 == 0 or written == need:
                print(f"  talk written {written}/{need}")
    return written


def main() -> None:
    before = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    breathing = collect_breathing_files()
    print(f"before count: {before}")
    print(f"breathing/sigh files to remove: {len(breathing)}")

    for path in breathing:
        path.unlink(missing_ok=True)

    mid = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    need = before - mid
    print(f"after delete: {mid}; need talking replacements: {need}")

    avoid = existing_talk_fingerprints()
    added = generate_talk_clips(need, avoid)
    after = sum(1 for p in NON_DIR.iterdir() if p.is_file())
    print(f"added talk: {added}")
    print(f"after count: {after}")
    if after != before:
        print(f"WARNING: count drift {before} -> {after}")


if __name__ == "__main__":
    main()
