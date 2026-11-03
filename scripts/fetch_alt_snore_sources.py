"""Download extra snoring audio from sources not used in the first human_snoring build."""

from __future__ import annotations

import re
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dataset" / "_alt_snore_sources" / "web_downloads"
UA = {"User-Agent": "Mozilla/5.0 HAGOKILLER-dataset-builder/1.0"}


def get(url: str) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as response:
            data = response.read()
        if len(data) < 1000 or data[:15].lstrip().startswith(b"<!DOCTYPE"):
            return None
        return data
    except Exception as exc:
        print(f"fail {url}: {exc}")
        return None


def save_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    print(f"saved {path.name} ({len(data)} bytes)")


def fetch_mixkit() -> None:
    html = get("https://mixkit.co/free-sound-effects/snoring/")
    if not html:
        print("mixkit page unavailable")
        return
    text = html.decode("utf-8", "ignore")
    urls = sorted(set(re.findall(r"https://assets\.mixkit\.co/[^\"']+\.mp3", text)))
    print(f"mixkit urls: {len(urls)}")
    for index, url in enumerate(urls[:40]):
        dest = OUT / f"mixkit_{index:02d}.mp3"
        if dest.exists() and dest.stat().st_size > 1000:
            continue
        data = get(url)
        if data:
            save_bytes(dest, data)


def fetch_bigsoundbank_extra() -> None:
    # Already had 0170/0653; pull child/other HMNSnor IDs as alternate bank files.
    ids = {
        929: "baby_14mo",
        1070: "child_1",
        1809: "child_2",
        1810: "child_3",
    }
    for sound_id, label in ids.items():
        dest = OUT / f"bsb_{sound_id:04d}_{label}.mp3"
        if dest.exists() and dest.stat().st_size > 1000:
            continue
        data = get(f"https://bigsoundbank.com/UPLOAD/mp3/{sound_id:04d}.mp3")
        if data:
            save_bytes(dest, data)


def ensure_extracted_zips() -> None:
    archive_out = ROOT / "dataset" / "_alt_snore_sources" / "archive_snoring"
    archive_out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ROOT / "dataset" / "archive.zip") as archive:
        for name in archive.namelist():
            if name.startswith("Snoring/") and name.lower().endswith(".wav") and not name.endswith("/"):
                target = archive_out / Path(name).name
                if not target.exists():
                    target.write_bytes(archive.read(name))

    khan_out = ROOT / "dataset" / "_alt_snore_sources" / "khan_dataset_zip"
    khan_out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ROOT / "dataset" / "dataset.zip") as archive:
        for name in archive.namelist():
            normalized = name.replace("\\", "/")
            if "/1/" in normalized and normalized.lower().endswith(".wav"):
                target = khan_out / Path(name).name
                if not target.exists():
                    target.write_bytes(archive.read(name))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ensure_extracted_zips()
    fetch_mixkit()
    fetch_bigsoundbank_extra()
    wavs = list((ROOT / "dataset" / "_alt_snore_sources").rglob("*.wav"))
    mp3s = list((ROOT / "dataset" / "_alt_snore_sources").rglob("*.mp3"))
    print(f"alt sources ready: {len(wavs)} wav, {len(mp3s)} mp3")


if __name__ == "__main__":
    main()
