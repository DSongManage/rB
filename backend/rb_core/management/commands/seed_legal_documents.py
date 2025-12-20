"""
Management command to seed initial legal documents.

Usage:
    python manage.py seed_legal_documents
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date
from rb_core.models import LegalDocument


class Command(BaseCommand):
    help = 'Seeds initial legal documents (Terms, Privacy, Creator Agreement, etc.)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing documents of the same version',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)

        documents = [
            {
                'document_type': 'tos',
                'version': '1.0',
                'effective_date': date(2024, 12, 1),
                'summary_of_changes': 'Initial version',
                'content': self.get_tos_content(),
            },
            {
                'document_type': 'privacy',
                'version': '1.0',
                'effective_date': date(2024, 12, 1),
                'summary_of_changes': 'Initial version',
                'content': self.get_privacy_content(),
            },
            {
                'document_type': 'creator_agreement',
                'version': '1.0',
                'effective_date': date(2024, 12, 1),
                'summary_of_changes': 'Initial version',
                'content': self.get_creator_agreement_content(),
            },
            {
                'document_type': 'content_policy',
                'version': '1.0',
                'effective_date': date(2024, 12, 1),
                'summary_of_changes': 'Initial version',
                'content': self.get_content_policy_content(),
            },
            {
                'document_type': 'dmca',
                'version': '1.0',
                'effective_date': date(2024, 12, 1),
                'summary_of_changes': 'Initial version',
                'content': self.get_dmca_content(),
            },
        ]

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for doc_data in documents:
            doc, created = LegalDocument.objects.get_or_create(
                document_type=doc_data['document_type'],
                version=doc_data['version'],
                defaults={
                    'effective_date': doc_data['effective_date'],
                    'summary_of_changes': doc_data['summary_of_changes'],
                    'content': doc_data['content'],
                }
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"Created: {doc_data['document_type']} v{doc_data['version']}")
                )
            elif force:
                doc.effective_date = doc_data['effective_date']
                doc.summary_of_changes = doc_data['summary_of_changes']
                doc.content = doc_data['content']
                doc.save()
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f"Updated: {doc_data['document_type']} v{doc_data['version']}")
                )
            else:
                skipped_count += 1
                self.stdout.write(
                    f"Skipped (already exists): {doc_data['document_type']} v{doc_data['version']}"
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f"Done! Created: {created_count}, Updated: {updated_count}, Skipped: {skipped_count}"
        ))

    def get_tos_content(self):
        return """# Terms of Service

Last Updated: December 2024

Welcome to renaissBlock. These Terms of Service govern your access to and use of our platform.

## 1. Acceptance of Terms

By creating an account or using renaissBlock, you agree to these Terms.

## 2. Description of Service

renaissBlock is a platform for creators to publish and sell digital content.

## 3. Account Registration

You must provide accurate information and keep your credentials secure.

## 4. Creator Terms

Additional terms apply when publishing content. See the Creator Agreement.

## 5. Purchaser Terms

Purchases grant personal, non-commercial use licenses.

## 6. Prohibited Conduct

Do not upload infringing content, engage in fraud, or violate policies.

## 7. Intellectual Property

You retain ownership of your content. We get a limited license to operate the platform.

## 8. Disclaimers and Limitations

The service is provided "as is" without warranties.

## 9. Contact

legal@renaissblock.com
"""

    def get_privacy_content(self):
        return """# Privacy Policy

Last Updated: December 2024

This Privacy Policy explains how renaissBlock collects, uses, and protects your information.

## 1. Information We Collect

- Account information (name, email)
- Transaction data
- Usage analytics

## 2. How We Use Information

- Provide and improve services
- Process transactions
- Send important updates

## 3. Information Sharing

We do not sell your personal information.

## 4. Your Rights

You can access, correct, or delete your data.

## 5. Security

We use encryption and security measures to protect your data.

## 6. Contact

privacy@renaissblock.com
"""

    def get_creator_agreement_content(self):
        return """# Creator Agreement

Last Updated: December 2024

This agreement applies when you publish content on renaissBlock.

## 1. Eligibility

You must be 18+ and have rights to your content.

## 2. Content Ownership

You retain full ownership. We get a limited license to display and distribute.

## 3. Revenue and Fees

- Platform fees: 15% (<$10), 12% ($10-50), 10% (>$50)
- You are responsible for taxes on earnings

## 4. Collaboration Terms

Revenue splits are binding once published.

## 5. Content Standards

Content must comply with our Content Policy.

## 6. Contact

creators@renaissblock.com
"""

    def get_content_policy_content(self):
        return """# Content Policy

Last Updated: December 2024

This policy explains what content is allowed on renaissBlock.

## 1. Prohibited Content

- Illegal content
- Child exploitation (zero tolerance)
- Non-consensual intimate content
- Credible threats of violence
- Fraud and plagiarism
- Copyright infringement

## 2. Restricted Content

- Mature/adult content must be marked appropriately
- AI-generated content must be disclosed

## 3. Quality Standards

Content should be original and complete.

## 4. Enforcement

Violations may result in content removal or account termination.

## 5. Contact

content@renaissblock.com
"""

    def get_dmca_content(self):
        return """# DMCA & Copyright Policy

Last Updated: December 2024

renaissBlock respects intellectual property rights.

## 1. Reporting Infringement

Send notices to: dmca@renaissblock.com

Include:
- Your contact information
- Identification of the copyrighted work
- Location of infringing material
- Good faith statement
- Statement of accuracy under penalty of perjury
- Your signature

## 2. Counter-Notification

If you believe content was removed in error, you may submit a counter-notice.

## 3. Repeat Infringer Policy

We terminate accounts of repeat infringers.

## 4. Contact

dmca@renaissblock.com
"""
