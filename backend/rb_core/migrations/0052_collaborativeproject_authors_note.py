from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0051_content_authors_note'),
    ]

    operations = [
        migrations.AddField(
            model_name='collaborativeproject',
            name='authors_note',
            field=models.TextField(blank=True, default='', help_text="Author's note about this work (max ~100 words)", max_length=600),
        ),
    ]
