# Generated migration for Circle payment fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0025_update_purchase_with_actual_fees'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchase',
            name='payment_provider',
            field=models.CharField(
                choices=[('stripe', 'Stripe'), ('circle', 'Circle')],
                default='stripe',
                max_length=20,
                help_text='Payment processor used'
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='circle_payment_id',
            field=models.CharField(
                blank=True,
                default='',
                max_length=255,
                help_text='Circle payment ID'
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='circle_tracking_ref',
            field=models.CharField(
                blank=True,
                default='',
                max_length=255,
                help_text='Circle tracking reference'
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='circle_fee',
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text='Circle processing fee',
                max_digits=10,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='net_after_circle',
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text='Net amount after Circle fee',
                max_digits=10,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='usdc_amount',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='USDC amount received on Solana',
                max_digits=18,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='transfer_gas_cost',
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text='Gas cost for USDC transfer to creator (Solana transaction fee)',
                max_digits=10,
                null=True
            ),
        ),
        migrations.AddIndex(
            model_name='purchase',
            index=models.Index(fields=['circle_payment_id'], name='rb_core_pur_circle_p_idx'),
        ),
        migrations.AddIndex(
            model_name='purchase',
            index=models.Index(fields=['payment_provider'], name='rb_core_pur_payment_p_idx'),
        ),
    ]
