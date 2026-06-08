"""프로필 이미지 업로드·서빙·삭제."""

from __future__ import annotations

import os
import re
import shutil

try:
    from PIL import Image, ImageFilter, ImageOps

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024
AVATAR_THUMB_SIZE = 384
AVATAR_THUMB_FILENAME = "avatar_thumb_v2.jpg"
AVATAR_THUMB_JPEG_QUALITY = 95
ALLOWED_PROFILE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
ALLOWED_PROFILE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


def _upload_root() -> str:
    root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "uploads", "profile_images")
    )
    os.makedirs(root, exist_ok=True)
    return root


def is_allowed_google_picture_url(url: str | None) -> bool:
    """허용된 Google 프로필 CDN URL인지 확인."""
    value = (url or "").strip()
    if not value.startswith("https://"):
        return False
    lowered = value.lower()
    return (
        "googleusercontent.com" in lowered
        or "ggpht.com" in lowered
    )


DEFAULT_AVATAR_STATIC_PATH = "/assets/profile/default-avatar.svg"
AVATAR_GOOGLE_DISPLAY_SIZE = 1024


def avatar_url_for_user(
    user_id: int,
    profile_image_path: str | None = None,
    google_picture_url: str | None = None,
) -> str:
    """레거시 공개 아바타 경로 (커스텀·기본 모두 동일 엔드포인트)."""
    _ = profile_image_path
    _ = google_picture_url
    return f"/api/users/{int(user_id)}/avatar"


def enhance_google_picture_url_for_display(
    url: str | None,
    size: int = AVATAR_GOOGLE_DISPLAY_SIZE,
) -> str | None:
    """Google 프로필 CDN URL을 표시용 고해상도로 변환."""
    value = (url or "").strip()
    if not is_allowed_google_picture_url(value):
        return None
    target_size = max(96, min(1024, int(size)))
    current_match = re.search(r"=s(\d+)-c", value) or re.search(r"=s(\d+)", value) or re.search(r"[?&]sz=(\d+)", value)
    if current_match and int(current_match.group(1)) >= target_size:
        return value
    if re.search(r"=s\d+-c", value):
        return re.sub(r"=s\d+-c", f"=s{target_size}-c", value, count=1)
    if re.search(r"=s\d+", value):
        return re.sub(r"=s\d+", f"=s{target_size}", value, count=1)
    if re.search(r"[?&]sz=\d+", value):
        return re.sub(r"([?&])sz=\d+", rf"\1sz={target_size}", value, count=1)
    return f"{value}=s{target_size}-c"


def default_avatar_display_url(google_picture_url: str | None = None) -> str:
    """커스텀 이미지가 없을 때 클라이언트에 바로 넣을 기본 아바타 URL."""
    enhanced = enhance_google_picture_url_for_display(google_picture_url)
    if enhanced:
        return enhanced
    return DEFAULT_AVATAR_STATIC_PATH


def _avatar_cache_version(*paths: str) -> int:
    mtimes = []
    for path in paths:
        if path and os.path.isfile(path):
            mtimes.append(int(os.path.getmtime(path)))
    return max(mtimes) if mtimes else 0


def _custom_avatar_url(user_id: int, profile_image_path: str | None, *, thumb: bool) -> str:
    base = f"/api/users/{int(user_id)}/avatar"
    file_info = get_profile_image_file(profile_image_path)
    thumb_path = _thumbnail_absolute_path(int(user_id))
    version_paths = []
    if file_info and os.path.isfile(file_info["path"]):
        version_paths.append(file_info["path"])
    if thumb and os.path.isfile(thumb_path):
        version_paths.append(thumb_path)
    elif file_info and os.path.isfile(file_info["path"]):
        version_paths.append(file_info["path"])

    params = []
    if thumb:
        params.append("size=thumb")
    version = _avatar_cache_version(*version_paths)
    if version:
        params.append(f"v={version}")
    if not params:
        return base
    return f"{base}?{'&'.join(params)}"


def display_avatar_url_for_user(
    user_id: int,
    profile_image_path: str | None = None,
    google_picture_url: str | None = None,
) -> str:
    """클라이언트 표시용 아바타 URL (목록·썸네일 최적화)."""
    if int(user_id) <= 0:
        return DEFAULT_AVATAR_STATIC_PATH
    if has_custom_profile_image(profile_image_path):
        return _custom_avatar_url(user_id, profile_image_path, thumb=True)
    return default_avatar_display_url(google_picture_url)


def display_avatar_full_url_for_user(
    user_id: int,
    profile_image_path: str | None = None,
    google_picture_url: str | None = None,
) -> str:
    """확대 보기용 원본 아바타 URL."""
    if int(user_id) <= 0:
        return DEFAULT_AVATAR_STATIC_PATH
    if has_custom_profile_image(profile_image_path):
        return _custom_avatar_url(user_id, profile_image_path, thumb=False)
    return default_avatar_display_url(google_picture_url)


def author_row_nickname(row: dict) -> str:
    """게시글·문의 등 작성자 행에서 표시용 닉네임."""
    nickname = (row.get("author_nickname") or row.get("nickname") or "").strip()
    login_id = (row.get("author_login_id") or row.get("login_id") or "").strip()
    if nickname:
        return nickname
    if login_id:
        return login_id
    return "회원"


def author_row_avatar_url(row: dict) -> str:
    """게시글·문의 등 작성자 행에서 표시용 아바타 URL."""
    user_id = row.get("user_id")
    if user_id is None:
        return display_avatar_url_for_user(0, None, None)
    profile_image_path = row.get("author_profile_image_path") or row.get("profile_image_path")
    google_picture_url = row.get("author_google_picture_url") or row.get("google_picture_url")
    return display_avatar_url_for_user(int(user_id), profile_image_path, google_picture_url)


def resolve_avatar_redirect_target(
    profile_image_path: str | None,
    google_picture_url: str | None,
) -> str | None:
    """커스텀 파일이 없을 때 Google 기본 프로필 URL 반환."""
    if (profile_image_path or "").strip():
        return None
    return enhance_google_picture_url_for_display(google_picture_url)


def has_custom_profile_image(profile_image_path: str | None) -> bool:
    return bool((profile_image_path or "").strip())


def normalize_google_picture_url(url: str | None) -> str | None:
    value = (url or "").strip()
    if not is_allowed_google_picture_url(value):
        return None
    return value


def _user_dir(user_id: int) -> str:
    return os.path.join(_upload_root(), str(int(user_id)))


def _absolute_path(relative_path: str) -> str:
    return os.path.join(_upload_root(), relative_path.replace("\\", "/").lstrip("/"))


def _thumbnail_absolute_path(user_id: int) -> str:
    return os.path.join(_user_dir(user_id), AVATAR_THUMB_FILENAME)


def _center_square_crop_box(width: int, height: int) -> tuple[int, int, int, int]:
    """브라우저 object-fit: cover + object-position: center 와 동일한 중앙 정사각형 크롭."""
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return (left, top, left + side, top + side)


def normalize_saved_avatar_file(source_path: str) -> bool:
    """저장된 원본을 미리보기와 동일한 중앙 정사각형으로 맞춤 (GIF 제외)."""
    if not HAS_PILLOW or not source_path or not os.path.isfile(source_path):
        return False
    ext = os.path.splitext(source_path)[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        return False
    try:
        with Image.open(source_path) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "L"):
                rgb = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "RGBA":
                    rgb.paste(img, mask=img.split()[3])
                else:
                    rgb.paste(img)
                img = rgb
            elif img.mode == "L":
                img = img.convert("RGB")
            width, height = img.size
            if width == height:
                return True
            crop_box = _center_square_crop_box(width, height)
            cropped = img.crop(crop_box)
            save_kwargs: dict = {"optimize": True}
            if ext in {".jpg", ".jpeg"}:
                save_kwargs.update({"quality": AVATAR_THUMB_JPEG_QUALITY, "subsampling": 0})
            cropped.save(source_path, **save_kwargs)
        return True
    except Exception:
        return False


def generate_avatar_thumbnail(source_path: str, user_id: int) -> str | None:
    """정사각형 고품질 썸네일 생성."""
    if not HAS_PILLOW:
        return None
    if not source_path or not os.path.isfile(source_path):
        return None
    dest_path = _thumbnail_absolute_path(user_id)
    try:
        with Image.open(source_path) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            elif img.mode == "L":
                img = img.convert("RGB")
            width, height = img.size
            crop_box = _center_square_crop_box(width, height)
            cropped = img.crop(crop_box)
            work = cropped
            longest = max(work.width, work.height)
            if longest > AVATAR_THUMB_SIZE * 2:
                interim = max(AVATAR_THUMB_SIZE * 2, AVATAR_THUMB_SIZE)
                work.thumbnail((interim, interim), Image.Resampling.LANCZOS)
            work.thumbnail(
                (AVATAR_THUMB_SIZE, AVATAR_THUMB_SIZE),
                Image.Resampling.LANCZOS,
            )
            work = work.filter(ImageFilter.UnsharpMask(radius=1.1, percent=130, threshold=2))
            thumb = Image.new("RGB", (AVATAR_THUMB_SIZE, AVATAR_THUMB_SIZE), (232, 236, 233))
            offset = (
                (AVATAR_THUMB_SIZE - work.width) // 2,
                (AVATAR_THUMB_SIZE - work.height) // 2,
            )
            thumb.paste(work, offset)
            thumb.save(
                dest_path,
                format="JPEG",
                quality=AVATAR_THUMB_JPEG_QUALITY,
                optimize=True,
                subsampling=0,
            )
        return dest_path
    except Exception:
        if os.path.isfile(dest_path):
            os.remove(dest_path)
        return None


def _thumbnail_needs_refresh(thumb_path: str, source_path: str) -> bool:
    if not os.path.isfile(thumb_path):
        return True
    if not os.path.isfile(source_path):
        return False
    if HAS_PILLOW:
        try:
            with Image.open(thumb_path) as thumb_img:
                if max(thumb_img.size) < AVATAR_THUMB_SIZE:
                    return True
        except Exception:
            return True
    return os.path.getmtime(source_path) > os.path.getmtime(thumb_path)


def ensure_avatar_thumbnail(user_id: int, profile_image_path: str | None) -> str | None:
    """썸네일이 없거나 원본보다 오래됐으면 재생성."""
    thumb_path = _thumbnail_absolute_path(user_id)
    file_info = get_profile_image_file(profile_image_path)
    if not file_info:
        return None
    source_path = file_info["path"]
    if os.path.isfile(thumb_path) and not _thumbnail_needs_refresh(thumb_path, source_path):
        return thumb_path
    return generate_avatar_thumbnail(source_path, user_id)


def get_profile_thumbnail_file(user_id: int, profile_image_path: str | None) -> dict | None:
    path = ensure_avatar_thumbnail(user_id, profile_image_path)
    if not path or not os.path.isfile(path):
        return None
    return {
        "path": path,
        "mime_type": "image/jpeg",
    }


def remove_profile_image_files(user_id: int) -> None:
    """디스크에 저장된 프로필 이미지 디렉터리 삭제."""
    path = _user_dir(user_id)
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)


def clear_profile_image(cursor, user_id: int) -> None:
    """DB 경로 NULL + 파일 삭제."""
    cursor.execute(
        """
        SELECT profile_image_path
        FROM users
        WHERE user_id = %s
        """,
        (user_id,),
    )
    row = cursor.fetchone() or {}
    remove_profile_image_files(user_id)
    cursor.execute(
        """
        UPDATE users
        SET profile_image_path = NULL, updated_at = NOW()
        WHERE user_id = %s
        """,
        (user_id,),
    )


def save_profile_image(cursor, user_id: int, file_storage) -> str:
    """프로필 이미지 저장 후 상대 경로 반환."""
    if file_storage is None or not getattr(file_storage, "filename", None):
        raise ValueError("invalid_image")

    original_name = (file_storage.filename or "").strip()
    if not original_name:
        raise ValueError("invalid_image")

    ext = os.path.splitext(original_name)[1].lower()
    if ext not in ALLOWED_PROFILE_EXTENSIONS:
        raise ValueError("invalid_image_type")

    file_storage.seek(0, os.SEEK_END)
    size = int(file_storage.tell())
    file_storage.seek(0)
    if size <= 0:
        raise ValueError("invalid_image")
    if size > PROFILE_IMAGE_MAX_BYTES:
        raise ValueError("image_too_large")

    mime_type = (file_storage.mimetype or "").split(";", 1)[0].strip().lower()
    if mime_type not in ALLOWED_PROFILE_MIME_TYPES:
        raise ValueError("invalid_image_type")

    remove_profile_image_files(user_id)
    dest_dir = _user_dir(user_id)
    os.makedirs(dest_dir, exist_ok=True)
    stored_name = f"avatar{ext}"
    dest_path = os.path.join(dest_dir, stored_name)
    file_storage.save(dest_path)
    normalize_saved_avatar_file(dest_path)
    generate_avatar_thumbnail(dest_path, user_id)

    relative_path = f"{user_id}/{stored_name}"
    cursor.execute(
        """
        UPDATE users
        SET profile_image_path = %s, updated_at = NOW()
        WHERE user_id = %s
        """,
        (relative_path, user_id),
    )
    return relative_path


def get_profile_image_file(profile_image_path: str | None) -> dict | None:
    """커스텀 프로필 이미지 파일 정보 (없으면 None)."""
    rel = (profile_image_path or "").strip()
    if not rel:
        return None
    abs_path = _absolute_path(rel)
    if not os.path.isfile(abs_path):
        return None
    ext = os.path.splitext(abs_path)[1].lower()
    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    return {
        "path": abs_path,
        "mime_type": mime_map.get(ext, "application/octet-stream"),
    }
