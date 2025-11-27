# Generated migration for Circle W3S integration
# NOTE: Migration 0026 already added some Circle fields (circle_payment_id, circle_fee, etc.)
# This migration adds the NEW Circle W3S specific fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rb_core', '0028_add_performance_indexes'),
    ]

    operations = [
        # Remove old transfer_gas_cost field (no longer used)
        migrations.RemoveField(
            model_name='purchase',
            name='transfer_gas_cost',
        ),

        # Add Circle W3S wallet fields to UserProfile
        migrations.AddField(
            model_name='userprofile',
            name='circle_wallet_id',
            field=models.CharField(
                blank=True,
                default=None,
                help_text='Circle W3S wallet ID for user-controlled wallet',
                max_length=128,
                null=True,
                unique=True
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='circle_wallet_address',
            field=models.CharField(
                blank=True,
                default=None,
                help_text='Solana address from Circle W3S wallet',
                max_length=44,
                null=True
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='wallet_provider',
            field=models.CharField(
                blank=True,
                choices=[
                    ('circle_w3s', 'Circle Web3 Services'),
                    ('external', 'External Wallet'),
                    ('web3auth', 'Web3Auth (Deprecated)')
                ],
                default='circle_w3s',
                max_length=20
            ),
        ),

        # Add Circle W3S NFT tracking to Purchase model
        migrations.AddField(
            model_name='purchase',
            name='circle_nft_id',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Circle W3S NFT ID from minting',
                max_length=255
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='circle_mint_transaction_id',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Circle W3S transaction ID for NFT mint',
                max_length=255
            ),
        ),

        # Add USDC distribution tracking to Purchase model
        migrations.AddField(
            model_name='purchase',
            name='usdc_payment_status',
            field=models.CharField(
                choices=[
                    ('pending_conversion', 'Pending USD → USDC Conversion'),
                    ('pending_distribution', 'Pending USDC Distribution'),
                    ('distributed', 'USDC Distributed'),
                    ('failed', 'Distribution Failed')
                ],
                default='pending_conversion',
                help_text='Status of USDC distribution to creator',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='usdc_transfer_signature',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Solana transaction signature for USDC transfer',
                max_length=128
            ),
        ),
        migrations.AddField(
            model_name='purchase',
            name='usdc_distributed_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When USDC was transferred to creator',
                null=True
            ),
        ),
        # NOTE: usdc_amount already exists from migration 0026, we'll alter it instead
        migrations.AlterField(
            model_name='purchase',
            name='usdc_amount',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='Amount of USDC to distribute to creator (90% of net after gas)',
                max_digits=10,
                null=True
            ),
        ),

        # Update help text for existing blockchain fields
        migrations.AlterField(
            model_name='purchase',
            name='nft_mint_address',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Solana NFT mint address',
                max_length=255
            ),
        ),
        migrations.AlterField(
            model_name='purchase',
            name='transaction_signature',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Solana transaction signature for NFT mint',
                max_length=128
            ),
        ),

        # Add indexes for new fields
        migrations.AddIndex(
            model_name='purchase',
            index=models.Index(fields=['usdc_payment_status'], name='rb_core_pur_usdc_pa_idx'),
        ),
        migrations.AddIndex(
            model_name='purchase',
            index=models.Index(fields=['circle_nft_id'], name='rb_core_pur_circle_nft_idx'),
        ),
    ]
