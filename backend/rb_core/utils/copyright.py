"""Copyright generation utilities for renaissBlock.

Provides functions for generating copyright text for published content.
"""

from datetime import datetime
from typing import Optional, Dict


def generate_copyright_text(
    author_name: str,
    year: Optional[int] = None,
    include_blockchain_message: bool = True
) -> Dict[str, str]:
    """
    Generate copyright text for published content.

    Args:
        author_name: Display name or username of the author
        year: Publication year (defaults to current year)
        include_blockchain_message: Whether to include the blockchain timestamp message

    Returns:
        Dict with 'copyright_line', 'blockchain_message', and 'full_text'
    """
    if year is None:
        year = datetime.now().year

    copyright_line = f"(C) {year} {author_name}. All Rights Reserved."

    blockchain_message = (
        "Every work published on renaissBlock is timestamped on the blockchain "
        "- creating an immutable record of your authorship. No registration required."
    )

    if include_blockchain_message:
        full_text = f"{copyright_line}\n\n{blockchain_message}"
    else:
        full_text = copyright_line

    return {
        'copyright_line': copyright_line,
        'blockchain_message': blockchain_message,
        'full_text': full_text
    }


def get_author_display_name(user) -> str:
    """
    Get the best display name for an author.

    Args:
        user: User model instance

    Returns:
        Display name or username
    """
    if hasattr(user, 'profile') and user.profile:
        if user.profile.display_name:
            return user.profile.display_name
    return user.username
