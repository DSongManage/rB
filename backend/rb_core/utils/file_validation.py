"""
File upload validation utilities for security.

Implements magic byte validation to prevent file type spoofing attacks.
"""
import io
from django.conf import settings
from rest_framework import serializers


# Magic byte signatures for allowed file types
# Format: {mime_type: [(offset, signature_bytes), ...]}
FILE_SIGNATURES = {
    'image/jpeg': [
        (0, b'\xFF\xD8\xFF'),  # JPEG start marker
    ],
    'image/png': [
        (0, b'\x89PNG\r\n\x1a\n'),  # PNG signature
    ],
    'image/webp': [
        (0, b'RIFF'),  # RIFF container
        (8, b'WEBP'),  # WEBP format marker
    ],
    'application/pdf': [
        (0, b'%PDF-'),  # PDF signature
    ],
    'video/mp4': [
        (4, b'ftyp'),  # MP4 file type box
    ],
}


def validate_file_signature(uploaded_file, expected_mime_type):
    """
    Validate file magic bytes to prevent MIME type spoofing.

    Args:
        uploaded_file: Django UploadedFile instance
        expected_mime_type: Expected MIME type (e.g., 'image/jpeg')

    Raises:
        serializers.ValidationError: If file signature doesn't match expected type
    """
    if expected_mime_type not in FILE_SIGNATURES:
        # No signature validation available for this type
        return

    signatures = FILE_SIGNATURES[expected_mime_type]

    # Read beginning of file for signature checking
    try:
        # Save current position
        current_pos = uploaded_file.tell()
        uploaded_file.seek(0)

        # Read enough bytes for signature validation
        header = uploaded_file.read(32)

        # Restore position
        uploaded_file.seek(current_pos)

        # Check all required signatures
        for offset, signature in signatures:
            if len(header) < offset + len(signature):
                raise serializers.ValidationError(
                    f'File too small to validate {expected_mime_type} signature'
                )

            if header[offset:offset + len(signature)] != signature:
                raise serializers.ValidationError(
                    f'Invalid file signature for {expected_mime_type}. '
                    f'File may be corrupted or masquerading as a different type.'
                )
    except (AttributeError, IOError) as e:
        raise serializers.ValidationError(f'Unable to read file: {str(e)}')


def validate_upload(uploaded_file, allowed_types=None, max_size=None):
    """
    Comprehensive upload validation with magic byte checking.

    Args:
        uploaded_file: Django UploadedFile instance
        allowed_types: Set of allowed MIME types (default: from settings)
        max_size: Max file size in bytes (default: from settings)

    Raises:
        serializers.ValidationError: If validation fails
    """
    if uploaded_file is None:
        raise serializers.ValidationError('No file provided')

    # Get configuration
    if allowed_types is None:
        allowed_types = getattr(
            settings,
            'ALLOWED_UPLOAD_CONTENT_TYPES',
            {'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'}
        )

    if max_size is None:
        max_size = getattr(settings, 'MAX_UPLOAD_BYTES', 10 * 1024 * 1024)

    # Validate file size
    try:
        if uploaded_file.size > max_size:
            max_mb = max_size / (1024 * 1024)
            raise serializers.ValidationError(
                f'File too large. Maximum size: {max_mb:.1f}MB'
            )
    except AttributeError:
        raise serializers.ValidationError('Unable to determine file size')

    # Validate MIME type
    content_type = getattr(uploaded_file, 'content_type', '')
    if not content_type:
        raise serializers.ValidationError('File has no content type')

    if content_type not in allowed_types:
        raise serializers.ValidationError(
            f'Unsupported file type: {content_type}. '
            f'Allowed types: {", ".join(sorted(allowed_types))}'
        )

    # Validate magic bytes (prevent MIME spoofing)
    validate_file_signature(uploaded_file, content_type)

    # Additional validation for images
    if content_type.startswith('image/'):
        validate_image(uploaded_file, content_type)


def validate_image(uploaded_file, content_type):
    """
    Additional validation for image files using Pillow.

    Args:
        uploaded_file: Django UploadedFile instance
        content_type: MIME type

    Raises:
        serializers.ValidationError: If image validation fails
    """
    try:
        from PIL import Image
    except ImportError:
        # Pillow not available, skip image validation
        return

    try:
        # Save current position
        current_pos = uploaded_file.tell()
        uploaded_file.seek(0)

        # Try to open and verify the image
        img = Image.open(uploaded_file)
        img.verify()

        # Restore position
        uploaded_file.seek(current_pos)

        # Validate image format matches MIME type
        expected_format = {
            'image/jpeg': 'JPEG',
            'image/png': 'PNG',
            'image/webp': 'WEBP',
        }.get(content_type)

        if expected_format and img.format != expected_format:
            raise serializers.ValidationError(
                f'Image format {img.format} does not match declared type {content_type}'
            )

    except serializers.ValidationError:
        raise
    except Exception as e:
        raise serializers.ValidationError(f'Invalid or corrupted image: {str(e)}')


def validate_avatar(uploaded_file):
    """Validate avatar image uploads."""
    # Avatars should only be images and smaller
    allowed_types = {'image/jpeg', 'image/png', 'image/webp'}
    max_size = 2 * 1024 * 1024  # 2MB for avatars
    validate_upload(uploaded_file, allowed_types=allowed_types, max_size=max_size)


def validate_banner(uploaded_file):
    """Validate banner image uploads."""
    # Banners should only be images and can be slightly larger
    allowed_types = {'image/jpeg', 'image/png', 'image/webp'}
    max_size = 5 * 1024 * 1024  # 5MB for banners
    validate_upload(uploaded_file, allowed_types=allowed_types, max_size=max_size)
