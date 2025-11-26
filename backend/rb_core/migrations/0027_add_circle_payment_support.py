# Generated migration to add Circle payment support

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0026_add_circle_payment_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchase',
            name='payment_provider',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('stripe', 'Stripe'),
                    ('circle', 'Circle'),
                ],
                default='stripe',
                help_text='Payment provider used for this purchase'
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='circle_payment_id',
            field=models.CharField(
                max_length=255,
                blank=True,
                default='',
                help_text='Circle payment ID'
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='circle_tracking_ref',
            field=models.CharField(
                max_length=255,
                blank=True,
                default='',
                help_text='Circle tracking reference'
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='circle_fee',
            field=models.DecimalField(
                max_digits=10,
                decimal_places=4,
                null=True,
                blank=True,
                help_text='Circle processing fee in USD'
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='net_after_circle',
            field=models.DecimalField(
                max_digits=10,
                decimal_places=4,
                null=True,
                blank=True,
                help_text='Net amount after Circle fees (gross - circle_fee)'
            ),
        ),
        # Make stripe_payment_intent_id non-unique since Circle uses different IDs
        migrations.AlterField(
            model_name='purchase',
            name='stripe_payment_intent_id',
            field=models.CharField(max_length=255, blank=True, default=''),
        ),
        # Add index for Circle payment ID
        migrations.AddIndex(
            model_name='purchase',
            index=models.Index(fields=['circle_payment_id'], name='rb_core_pu_circle__idx'),
        ),
    ]
