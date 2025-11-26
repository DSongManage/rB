# Generated migration for performance indexes

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0026_add_circle_payment_fields'),
    ]

    operations = [
        # Add db_index to ReadingProgress foreign keys
        migrations.AlterField(
            model_name='readingprogress',
            name='user',
            field=models.ForeignKey(
                db_index=True,
                on_delete=models.deletion.CASCADE,
                related_name='reading_progress',
                to='rb_core.user'
            ),
        ),
        migrations.AlterField(
            model_name='readingprogress',
            name='content',
            field=models.ForeignKey(
                db_index=True,
                on_delete=models.deletion.CASCADE,
                related_name='reading_progress',
                to='rb_core.content'
            ),
        ),
        # Add composite indexes for common queries
        migrations.AddIndex(
            model_name='readingprogress',
            index=models.Index(fields=['user', 'content'], name='rb_core_rea_user_co_idx'),
        ),
        migrations.AddIndex(
            model_name='readingprogress',
            index=models.Index(fields=['user', '-last_read_at'], name='rb_core_rea_user_la_idx'),
        ),
    ]
