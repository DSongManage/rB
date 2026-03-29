"""
Management command to seed standard milestone templates.

Run with: python manage.py seed_milestone_templates
"""

from django.core.management.base import BaseCommand
from rb_core.models import RoleDefinition, MilestoneTemplate


TEMPLATES = [
    # ========================
    # ARTIST TEMPLATES
    # ========================
    {
        "role_name": "Lead Artist",
        "name": "22-Page Issue Standard",
        "description": "Standard 22-page comic issue: 5 trust pages (page-by-page) + 3 production blocks of 5 pages + 2-page final delivery",
        "total_pages": 22,
        "milestones": [
            # Trust phase: pages 1-5 (individual pages)
            {"type": "trust_page", "pages": 1, "payment_pct": 4.55, "description": "Trust Page 1", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 4.55, "description": "Trust Page 2", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 4.55, "description": "Trust Page 3", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 4.55, "description": "Trust Page 4", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 4.55, "description": "Trust Page 5", "revision_limit": 3, "review_window_hours": 72},
            # Production phase: pages 6-20 (5-page blocks)
            {"type": "production_block", "pages": 5, "payment_pct": 22.73, "description": "Pages 6-10", "revision_limit": 3, "review_window_hours": 72},
            {"type": "production_block", "pages": 5, "payment_pct": 22.73, "description": "Pages 11-15", "revision_limit": 3, "review_window_hours": 72},
            {"type": "production_block", "pages": 5, "payment_pct": 22.73, "description": "Pages 16-20", "revision_limit": 3, "review_window_hours": 72},
            # Final delivery: pages 21-22
            {"type": "final_delivery", "pages": 2, "payment_pct": 9.06, "description": "Final Pages 21-22", "revision_limit": 2, "review_window_hours": 72},
        ],
    },
    {
        "role_name": "Lead Artist",
        "name": "10-Page Short Story",
        "description": "Short story: 5 trust pages (page-by-page) + 1 production block of 5 pages",
        "total_pages": 10,
        "milestones": [
            {"type": "trust_page", "pages": 1, "payment_pct": 10, "description": "Trust Page 1", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 10, "description": "Trust Page 2", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 10, "description": "Trust Page 3", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 10, "description": "Trust Page 4", "revision_limit": 3, "review_window_hours": 72},
            {"type": "trust_page", "pages": 1, "payment_pct": 10, "description": "Trust Page 5", "revision_limit": 3, "review_window_hours": 72},
            {"type": "production_block", "pages": 5, "payment_pct": 50, "description": "Pages 6-10", "revision_limit": 3, "review_window_hours": 72},
        ],
    },
    # ========================
    # COLORIST TEMPLATES
    # ========================
    {
        "role_name": "Colorist",
        "name": "22-Page Coloring (Per-Block)",
        "description": "Coloring for 22-page issue: 5-page blocks throughout (no trust phase, line art serves as quality reference)",
        "total_pages": 22,
        "milestones": [
            {"type": "production_block", "pages": 5, "payment_pct": 25, "description": "Color Pages 1-5", "revision_limit": 2, "review_window_hours": 48},
            {"type": "production_block", "pages": 5, "payment_pct": 25, "description": "Color Pages 6-10", "revision_limit": 2, "review_window_hours": 48},
            {"type": "production_block", "pages": 5, "payment_pct": 25, "description": "Color Pages 11-15", "revision_limit": 2, "review_window_hours": 48},
            {"type": "production_block", "pages": 5, "payment_pct": 20, "description": "Color Pages 16-20", "revision_limit": 2, "review_window_hours": 48},
            {"type": "final_delivery", "pages": 2, "payment_pct": 5, "description": "Color Pages 21-22", "revision_limit": 2, "review_window_hours": 48},
        ],
    },
    # ========================
    # LETTERER TEMPLATES
    # ========================
    {
        "role_name": "Letterer",
        "name": "22-Page Lettering (Batch)",
        "description": "Lettering for 22-page issue: 2 large batches (fastest turnaround, last in pipeline)",
        "total_pages": 22,
        "milestones": [
            {"type": "production_block", "pages": 11, "payment_pct": 50, "description": "Letter Pages 1-11", "revision_limit": 2, "review_window_hours": 48},
            {"type": "final_delivery", "pages": 11, "payment_pct": 50, "description": "Letter Pages 12-22", "revision_limit": 2, "review_window_hours": 48},
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed standard milestone templates for escrow contracts'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for template_data in TEMPLATES:
            role_name = template_data.pop('role_name')

            try:
                role_def = RoleDefinition.objects.get(name=role_name, is_active=True)
            except RoleDefinition.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f'  Skipping "{template_data["name"]}" — RoleDefinition "{role_name}" not found'
                ))
                template_data['role_name'] = role_name  # restore for next iteration
                continue

            obj, created = MilestoneTemplate.objects.update_or_create(
                role_definition=role_def,
                name=template_data['name'],
                defaults={
                    'description': template_data['description'],
                    'total_pages': template_data['total_pages'],
                    'milestones': template_data['milestones'],
                    'is_active': True,
                },
            )

            template_data['role_name'] = role_name  # restore

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  Created: {obj.name} ({role_name})'))
            else:
                updated_count += 1
                self.stdout.write(f'  Updated: {obj.name} ({role_name})')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone: {created_count} created, {updated_count} updated'
        ))
