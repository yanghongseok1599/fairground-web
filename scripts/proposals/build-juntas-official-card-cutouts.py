from pathlib import Path

from PIL import Image
from rembg import new_session, remove


ROOT = Path(__file__).resolve().parents[2]
IMAGES = [
    (
        ROOT / ".codex_tmp-card-male-photo.png",
        ROOT / "public/proposals/juntas/player-card-male-cutout-v2.png",
    ),
    (
        ROOT / ".codex_tmp-card-female-photo.png",
        ROOT / "public/proposals/juntas/player-card-female-cutout-v2.png",
    ),
]


def build_cutout(source: Path, destination: Path, session) -> None:
    with Image.open(source).convert("RGBA") as image:
        cutout = remove(
            image,
            session=session,
            alpha_matting=False,
            post_process_mask=True,
        )
        destination.parent.mkdir(parents=True, exist_ok=True)
        cutout.save(destination, "PNG", optimize=True)


def main() -> None:
    session = new_session("birefnet-general")
    for source, destination in IMAGES:
        build_cutout(source, destination, session)
        print(destination.relative_to(ROOT))


if __name__ == "__main__":
    main()
