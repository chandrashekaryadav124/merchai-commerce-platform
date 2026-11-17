import os
import uuid
from pathlib import Path
from typing import Tuple, Optional
from fastapi import UploadFile, HTTPException, status

# Supported image MIME types and magic byte headers
MAGIC_NUMBERS = {
    "image/jpeg": [b"\xFF\xD8\xFF"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # WebP requires additional 'WEBP' check at offset 8
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB in bytes

# Base uploads directory relative to backend folder
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads" / "products"


def init_storage_dirs() -> None:
    """Ensure upload directories exist."""
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class LocalStorageService:
    @staticmethod
    def validate_image_file(file: UploadFile, content: bytes) -> str:
        """
        Validates uploaded file size and magic bytes.
        Returns the confirmed extension (.jpg, .png, .webp).
        Raises HTTPException on violation.
        """
        # 1. File size check
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{file.filename}' exceeds maximum allowed size of 5 MB."
            )

        if len(content) < 16:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File '{file.filename}' is too small to be a valid image."
            )

        # 2. Magic byte inspection
        is_jpeg = content.startswith(b"\xFF\xD8\xFF")
        is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
        is_webp = content.startswith(b"RIFF") and content[8:12] == b"WEBP"

        if is_jpeg:
            return ".jpg"
        elif is_png:
            return ".png"
        elif is_webp:
            return ".webp"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format for '{file.filename}'. Only authentic JPEG, PNG, and WebP images are permitted."
            )

    @staticmethod
    async def save_product_image(file: UploadFile) -> Tuple[str, str]:
        """
        Validates and saves a product image to disk.
        Returns a tuple: (stored_filename, public_url).
        """
        init_storage_dirs()

        # Read contents into memory for magic-byte validation
        content = await file.read()
        extension = LocalStorageService.validate_image_file(file, content)

        # Generate secure unique filename
        filename = f"{uuid.uuid4().hex}{extension}"
        destination_path = UPLOADS_DIR / filename

        with open(destination_path, "wb") as f:
            f.write(content)

        # Public URL served statically
        public_url = f"/uploads/products/{filename}"
        return filename, public_url

    @staticmethod
    def delete_product_image(image_url_or_path: str) -> bool:
        """
        Deletes a local product image file given its URL or filename.
        Returns True if deleted or file doesn't exist, False on failure.
        """
        if not image_url_or_path:
            return False

        # Extract filename from url: e.g. /uploads/products/abc.jpg -> abc.jpg
        filename = os.path.basename(image_url_or_path)
        file_path = UPLOADS_DIR / filename

        try:
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
                return True
            return False
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")
            return False

