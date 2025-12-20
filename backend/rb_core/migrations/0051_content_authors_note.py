from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0050_content_average_rating_content_like_count_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='content',
            name='authors_note',
            field=models.TextField(blank=True, default='', max_length=600),
        ),
    ]
