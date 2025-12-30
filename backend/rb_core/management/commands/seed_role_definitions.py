"""
Management command to seed standard role definitions.

Run with: python manage.py seed_role_definitions
"""

from django.core.management.base import BaseCommand
from rb_core.models import RoleDefinition


STANDARD_ROLES = [
    # ========================
    # BOOK PROJECT ROLES
    # ========================
    {
        "name": "Author",
        "category": "creator",
        "description": "Primary writer responsible for creating chapters and narrative content",
        "applicable_to_book": True,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["text"],
            "edit": {"scope": "all", "types": ["text"]},
            "review": ["text", "image", "audio"]
        },
        "ui_components": ["chapter_editor", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "pen",
        "color": "#f59e0b"
    },
    {
        "name": "Co-Author",
        "category": "creator",
        "description": "Writes chapters alongside the primary author with shared editing rights",
        "applicable_to_book": True,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["text"],
            "edit": {"scope": "all", "types": ["text"]},
            "review": ["text", "image"]
        },
        "ui_components": ["chapter_editor", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "users",
        "color": "#f97316"
    },
    {
        "name": "Illustrator",
        "category": "contributor",
        "description": "Creates illustrations and artwork for the project",
        "applicable_to_book": True,
        "applicable_to_art": True,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["image"],
            "edit": {"scope": "own", "types": ["image"]},
            "review": ["text"]
        },
        "ui_components": ["image_uploader", "content_viewer", "task_tracker"],
        "icon": "palette",
        "color": "#8b5cf6"
    },
    {
        "name": "Cover Artist",
        "category": "contributor",
        "description": "Designs the cover and promotional artwork",
        "applicable_to_book": True,
        "applicable_to_art": False,
        "applicable_to_music": True,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["image"],
            "edit": {"scope": "assigned", "types": ["image"]},
            "review": []
        },
        "ui_components": ["image_uploader", "task_tracker"],
        "icon": "image",
        "color": "#a855f7"
    },
    {
        "name": "Editor",
        "category": "reviewer",
        "description": "Reviews and provides feedback on written content without direct editing",
        "applicable_to_book": True,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": True,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": [],
            "edit": {"scope": "none", "types": []},
            "review": ["text", "image"]
        },
        "ui_components": ["content_viewer", "comment_panel", "task_tracker"],
        "icon": "check-circle",
        "color": "#10b981"
    },
    {
        "name": "Proofreader",
        "category": "reviewer",
        "description": "Final review for grammar, spelling, and consistency",
        "applicable_to_book": True,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": [],
            "edit": {"scope": "none", "types": []},
            "review": ["text"]
        },
        "ui_components": ["content_viewer", "comment_panel", "task_tracker"],
        "icon": "spell-check",
        "color": "#14b8a6"
    },
    {
        "name": "Narrator",
        "category": "contributor",
        "description": "Records audio narration for audiobook version",
        "applicable_to_book": True,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["audio"],
            "edit": {"scope": "own", "types": ["audio"]},
            "review": ["text"]
        },
        "ui_components": ["audio_uploader", "content_viewer", "task_tracker"],
        "icon": "microphone",
        "color": "#ec4899"
    },

    # ========================
    # ART PROJECT ROLES
    # ========================
    {
        "name": "Lead Artist",
        "category": "creator",
        "description": "Primary artist with full creative control over artwork",
        "applicable_to_book": False,
        "applicable_to_art": True,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["image"],
            "edit": {"scope": "all", "types": ["image"]},
            "review": ["image"]
        },
        "ui_components": ["image_uploader", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "brush",
        "color": "#f43f5e"
    },
    {
        "name": "Contributing Artist",
        "category": "contributor",
        "description": "Creates additional artwork pieces for the collection",
        "applicable_to_book": False,
        "applicable_to_art": True,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["image"],
            "edit": {"scope": "own", "types": ["image"]},
            "review": []
        },
        "ui_components": ["image_uploader", "task_tracker"],
        "icon": "paint-brush",
        "color": "#fb7185"
    },
    {
        "name": "Art Director",
        "category": "reviewer",
        "description": "Provides creative direction and feedback without creating artwork",
        "applicable_to_book": False,
        "applicable_to_art": True,
        "applicable_to_music": False,
        "applicable_to_video": True,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": [],
            "edit": {"scope": "none", "types": []},
            "review": ["image"]
        },
        "ui_components": ["content_viewer", "comment_panel", "task_tracker"],
        "icon": "eye",
        "color": "#06b6d4"
    },

    # ========================
    # COMIC PROJECT ROLES
    # ========================
    {
        "name": "Writer",
        "category": "creator",
        "description": "Writes comic scripts including dialogue, narration, and panel descriptions",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["text"],
            "edit": {"scope": "all", "types": ["text"]},
            "review": ["text", "image"]
        },
        "ui_components": ["chapter_editor", "bubble_editor", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "pen",
        "color": "#f59e0b"
    },
    {
        "name": "Colorist",
        "category": "contributor",
        "description": "Colors the line art and adds visual depth to panels",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["image"],
            "edit": {"scope": "own", "types": ["image"]},
            "review": ["image"]
        },
        "ui_components": ["image_uploader", "panel_viewer", "task_tracker"],
        "icon": "palette",
        "color": "#ec4899"
    },
    {
        "name": "Letterer",
        "category": "contributor",
        "description": "Creates and positions speech bubbles, captions, and sound effects",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["text"],
            "edit": {"scope": "own", "types": ["text"]},
            "review": ["text", "image"]
        },
        "ui_components": ["bubble_editor", "content_viewer", "task_tracker"],
        "icon": "type",
        "color": "#8b5cf6"
    },
    {
        "name": "Inker",
        "category": "contributor",
        "description": "Inks over pencil artwork to create final line art",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": False,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": ["image"],
            "edit": {"scope": "own", "types": ["image"]},
            "review": ["image"]
        },
        "ui_components": ["image_uploader", "panel_viewer", "task_tracker"],
        "icon": "pen-tool",
        "color": "#64748b"
    },

    # ========================
    # MUSIC PROJECT ROLES
    # ========================
    {
        "name": "Composer",
        "category": "creator",
        "description": "Creates original music compositions",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": True,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["audio"],
            "edit": {"scope": "all", "types": ["audio"]},
            "review": ["audio", "text"]
        },
        "ui_components": ["audio_uploader", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "music",
        "color": "#3b82f6"
    },
    {
        "name": "Producer",
        "category": "creator",
        "description": "Oversees production and has full control over audio content",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": True,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["audio"],
            "edit": {"scope": "all", "types": ["audio"]},
            "review": ["audio", "text", "image"]
        },
        "ui_components": ["audio_uploader", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "sliders",
        "color": "#6366f1"
    },
    {
        "name": "Vocalist",
        "category": "contributor",
        "description": "Records vocal tracks for the project",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": True,
        "applicable_to_video": False,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["audio"],
            "edit": {"scope": "own", "types": ["audio"]},
            "review": ["text"]
        },
        "ui_components": ["audio_uploader", "content_viewer", "task_tracker"],
        "icon": "mic",
        "color": "#d946ef"
    },
    {
        "name": "Lyricist",
        "category": "contributor",
        "description": "Writes song lyrics",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": True,
        "applicable_to_video": False,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["text"],
            "edit": {"scope": "own", "types": ["text"]},
            "review": ["audio"]
        },
        "ui_components": ["chapter_editor", "content_viewer", "task_tracker"],
        "icon": "file-text",
        "color": "#a78bfa"
    },
    {
        "name": "Sound Engineer",
        "category": "technical",
        "description": "Handles mixing, mastering, and technical audio work",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": True,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": [],
            "edit": {"scope": "all", "types": ["audio"]},
            "review": ["audio"]
        },
        "ui_components": ["audio_uploader", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "volume-2",
        "color": "#64748b"
    },

    # ========================
    # VIDEO/FILM PROJECT ROLES
    # ========================
    {
        "name": "Director",
        "category": "creator",
        "description": "Overall creative vision and control over the project",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["video", "image", "audio", "text"],
            "edit": {"scope": "all", "types": ["video", "image", "audio", "text"]},
            "review": ["video", "image", "audio", "text"]
        },
        "ui_components": ["video_uploader", "image_uploader", "audio_uploader", "chapter_editor", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "film",
        "color": "#ef4444"
    },
    {
        "name": "Cinematographer",
        "category": "contributor",
        "description": "Captures video footage for the project",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["video"],
            "edit": {"scope": "own", "types": ["video"]},
            "review": []
        },
        "ui_components": ["video_uploader", "task_tracker"],
        "icon": "video",
        "color": "#f87171"
    },
    {
        "name": "Video Editor",
        "category": "technical",
        "description": "Handles post-production video editing",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["video"],
            "edit": {"scope": "all", "types": ["video"]},
            "review": ["video", "audio"]
        },
        "ui_components": ["video_uploader", "content_viewer", "comment_panel", "task_tracker"],
        "icon": "scissors",
        "color": "#78716c"
    },
    {
        "name": "Screenwriter",
        "category": "contributor",
        "description": "Writes scripts and screenplays",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": False,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["text"],
            "edit": {"scope": "own", "types": ["text"]},
            "review": ["video"]
        },
        "ui_components": ["chapter_editor", "content_viewer", "task_tracker"],
        "icon": "file-text",
        "color": "#fbbf24"
    },
    {
        "name": "Animator",
        "category": "contributor",
        "description": "Creates animated content and motion graphics",
        "applicable_to_book": False,
        "applicable_to_art": False,
        "applicable_to_music": True,
        "applicable_to_video": True,
        "applicable_to_comic": False,
        "default_permissions": {
            "create": ["video", "image"],
            "edit": {"scope": "own", "types": ["video", "image"]},
            "review": []
        },
        "ui_components": ["video_uploader", "image_uploader", "task_tracker"],
        "icon": "play-circle",
        "color": "#22d3ee"
    },

    # ========================
    # CROSS-PROJECT ROLES
    # ========================
    {
        "name": "Project Manager",
        "category": "management",
        "description": "Coordinates project workflow without editing content",
        "applicable_to_book": True,
        "applicable_to_art": True,
        "applicable_to_music": True,
        "applicable_to_video": True,
        "applicable_to_comic": True,
        "default_permissions": {
            "create": [],
            "edit": {"scope": "none", "types": []},
            "review": ["text", "image", "audio", "video"]
        },
        "ui_components": ["content_viewer", "comment_panel", "task_tracker"],
        "icon": "briefcase",
        "color": "#0ea5e9"
    },
]


class Command(BaseCommand):
    help = 'Seed standard role definitions for the collaboration system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Update existing roles instead of skipping them',
        )

    def handle(self, *args, **options):
        force_update = options['force']
        created_count = 0
        updated_count = 0
        skipped_count = 0

        for role_data in STANDARD_ROLES:
            name = role_data['name']
            existing = RoleDefinition.objects.filter(name=name).first()

            if existing:
                if force_update:
                    for key, value in role_data.items():
                        setattr(existing, key, value)
                    existing.save()
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(f'Updated: {name}')
                    )
                else:
                    skipped_count += 1
                    self.stdout.write(f'Skipped (exists): {name}')
            else:
                RoleDefinition.objects.create(**role_data)
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'Created: {name}')
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done! Created: {created_count}, Updated: {updated_count}, Skipped: {skipped_count}'
        ))
