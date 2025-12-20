# Generated manually for legal agreement tracking

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0055_add_content_view_model'),  # Update this to your last migration
    ]

    operations = [
        # Add legal tracking fields to UserProfile
        migrations.AddField(
            model_name='userprofile',
            name='tos_accepted_at',
            field=models.DateTimeField(blank=True, help_text='When user accepted Terms of Service at signup', null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='tos_version',
            field=models.CharField(blank=True, default='', help_text='Version of ToS accepted at signup', max_length=20),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='creator_agreement_accepted_at',
            field=models.DateTimeField(blank=True, help_text='When user accepted Creator Agreement', null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='creator_agreement_version',
            field=models.CharField(blank=True, default='', help_text='Version of Creator Agreement accepted', max_length=20),
        ),
        # Create LegalDocument model
        migrations.CreateModel(
            name='LegalDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('document_type', models.CharField(choices=[('tos', 'Terms of Service'), ('privacy', 'Privacy Policy'), ('creator_agreement', 'Creator Agreement'), ('content_policy', 'Content Policy'), ('dmca', 'DMCA Policy'), ('cookie_policy', 'Cookie Policy')], db_index=True, max_length=30)),
                ('version', models.CharField(help_text="Version string, e.g., '1.0', '2.0'", max_length=20)),
                ('content', models.TextField(help_text='Full content of the legal document (markdown)')),
                ('summary_of_changes', models.TextField(blank=True, default='', help_text='Human-readable summary of what changed from previous version')),
                ('effective_date', models.DateField(help_text='Date when this version becomes/became effective')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-effective_date', '-created_at'],
                'unique_together': {('document_type', 'version')},
            },
        ),
        migrations.AddIndex(
            model_name='legaldocument',
            index=models.Index(fields=['document_type', '-effective_date'], name='rb_core_leg_documen_a1b2c3_idx'),
        ),
        # Create UserLegalAcceptance model
        migrations.CreateModel(
            name='UserLegalAcceptance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('accepted_at', models.DateTimeField(auto_now_add=True)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.TextField(blank=True, default='')),
                ('document', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='acceptances', to='rb_core.legaldocument')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='legal_acceptances', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-accepted_at'],
                'unique_together': {('user', 'document')},
            },
        ),
        migrations.AddIndex(
            model_name='userlegalacceptance',
            index=models.Index(fields=['user', 'document'], name='rb_core_use_user_id_d4e5f6_idx'),
        ),
        migrations.AddIndex(
            model_name='userlegalacceptance',
            index=models.Index(fields=['user', '-accepted_at'], name='rb_core_use_user_id_g7h8i9_idx'),
        ),
    ]
