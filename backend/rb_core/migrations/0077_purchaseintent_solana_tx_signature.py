# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0076_speech_bubble_style_system'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaseintent',
            name='solana_tx_signature',
            field=models.CharField(blank=True, default='', help_text='Solana transaction signature when payment is submitted', max_length=128),
        ),
    ]
