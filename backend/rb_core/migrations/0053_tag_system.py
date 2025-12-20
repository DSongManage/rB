from django.db import migrations, models
from django.utils.text import slugify


def seed_predefined_tags(apps, schema_editor):
    """Seed predefined tags for content discovery."""
    Tag = apps.get_model('rb_core', 'Tag')

    predefined_tags = [
        # Genre tags
        ('Fantasy', 'genre'),
        ('Sci-Fi', 'genre'),
        ('Romance', 'genre'),
        ('Mystery', 'genre'),
        ('Thriller', 'genre'),
        ('Horror', 'genre'),
        ('Historical', 'genre'),
        ('Contemporary', 'genre'),
        ('Literary Fiction', 'genre'),
        ('Non-Fiction', 'genre'),
        # Theme tags
        ('Adventure', 'theme'),
        ('Coming of Age', 'theme'),
        ('Redemption', 'theme'),
        ('Love', 'theme'),
        ('Betrayal', 'theme'),
        ('Survival', 'theme'),
        ('Identity', 'theme'),
        ('Family', 'theme'),
        ('Friendship', 'theme'),
        ('War', 'theme'),
        # Mood tags
        ('Dark', 'mood'),
        ('Light', 'mood'),
        ('Humorous', 'mood'),
        ('Emotional', 'mood'),
        ('Suspenseful', 'mood'),
        ('Uplifting', 'mood'),
        ('Melancholic', 'mood'),
        ('Intense', 'mood'),
        ('Whimsical', 'mood'),
        ('Thought-Provoking', 'mood'),
    ]

    for name, category in predefined_tags:
        Tag.objects.create(
            name=name,
            slug=slugify(name),
            category=category,
            is_predefined=True,
            usage_count=0,
        )


def reverse_seed(apps, schema_editor):
    """Remove predefined tags."""
    Tag = apps.get_model('rb_core', 'Tag')
    Tag.objects.filter(is_predefined=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0052_collaborativeproject_authors_note'),
    ]

    operations = [
        # Create Tag model
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('slug', models.SlugField(max_length=50, unique=True)),
                ('category', models.CharField(choices=[('genre', 'Genre'), ('theme', 'Theme'), ('mood', 'Mood'), ('custom', 'Custom')], default='custom', max_length=20)),
                ('is_predefined', models.BooleanField(default=False)),
                ('usage_count', models.PositiveIntegerField(db_index=True, default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-usage_count', 'name'],
            },
        ),
        # Add ManyToMany relationship from Content to Tag
        migrations.AddField(
            model_name='content',
            name='tags',
            field=models.ManyToManyField(blank=True, related_name='contents', to='rb_core.tag'),
        ),
        # Seed predefined tags
        migrations.RunPython(seed_predefined_tags, reverse_seed),
    ]
