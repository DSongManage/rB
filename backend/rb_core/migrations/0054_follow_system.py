# Generated migration for Follow model and follower/following counts

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('rb_core', '0053_tag_system'),
    ]

    operations = [
        # Add follower_count and following_count to UserProfile
        migrations.AddField(
            model_name='userprofile',
            name='follower_count',
            field=models.PositiveIntegerField(db_index=True, default=0),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='following_count',
            field=models.PositiveIntegerField(default=0),
        ),
        # Create Follow model
        migrations.CreateModel(
            name='Follow',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('follower', models.ForeignKey(
                    help_text='The user who is following',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='following_set',
                    to=settings.AUTH_USER_MODEL
                )),
                ('following', models.ForeignKey(
                    help_text='The user being followed',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='follower_set',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        # Add unique constraint
        migrations.AddConstraint(
            model_name='follow',
            constraint=models.UniqueConstraint(
                fields=['follower', 'following'],
                name='unique_follow_relationship'
            ),
        ),
        # Add indexes for efficient queries
        migrations.AddIndex(
            model_name='follow',
            index=models.Index(fields=['follower', '-created_at'], name='rb_core_fol_followe_idx'),
        ),
        migrations.AddIndex(
            model_name='follow',
            index=models.Index(fields=['following', '-created_at'], name='rb_core_fol_followi_idx'),
        ),
    ]
