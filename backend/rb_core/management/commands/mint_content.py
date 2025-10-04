from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from rb_core.models import Content, TestFeeLog
import os
import asyncio


class Command(BaseCommand):
    help = "Trigger devnet Anchor mint flow for a Content id (MVP connectivity test)."

    def add_arguments(self, parser):
        parser.add_argument('--content-id', type=int, required=True, help='Content primary key to mint')

    def handle(self, *args, **options):
        content_id = options['content_id']
        try:
            content = Content.objects.get(id=content_id)
        except Content.DoesNotExist:
            raise CommandError('Content not found')

        if not getattr(settings, 'FEATURE_ANCHOR_MINT', False):
            self.stdout.write(self.style.WARNING('FEATURE_ANCHOR_MINT is disabled; updating content only.'))
            content.inventory_status = 'minted'
            if not content.nft_contract:
                content.nft_contract = getattr(settings, 'ANCHOR_PROGRAM_ID', '') or f'mock_contract_{content.id}'
            content.save()
            return

        try:
            from anchorpy import Program, Provider, Wallet  # type: ignore
            from solana.rpc.async_api import AsyncClient  # type: ignore
            from solana.keypair import Keypair  # type: ignore
            from solders.pubkey import Pubkey  # type: ignore
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f'AnchorPy deps missing: {exc}; writing mock values.'))
            content.inventory_status = 'minted'
            content.nft_contract = getattr(settings, 'ANCHOR_PROGRAM_ID', '') or f'mock_contract_{content.id}'
            content.save()
            return

        rpc_url = getattr(settings, 'SOLANA_RPC_URL', 'https://api.devnet.solana.com')
        program_str = getattr(settings, 'ANCHOR_PROGRAM_ID', '') or os.getenv('RENAISS_BLOCK_PROGRAM_ID', '')
        if not program_str:
            raise CommandError('ANCHOR_PROGRAM_ID not set')

        keypair_path = getattr(settings, 'PLATFORM_WALLET_KEYPAIR_PATH', '') or os.path.abspath(os.path.join(os.path.dirname(settings.BASE_DIR), 'blockchain', 'target', 'platform_wallet.json'))
        try:
            import json as _json
            kp = Keypair.from_secret_key(bytes(bytearray(_json.loads(open(keypair_path, 'r').read()))))  # type: ignore
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f'Platform wallet missing: {exc}; writing mock values.'))
            content.inventory_status = 'minted'
            content.nft_contract = getattr(settings, 'ANCHOR_PROGRAM_ID', '') or f'mock_contract_{content.id}'
            content.save()
            return

        async def _run():
            client = AsyncClient(rpc_url)
            provider = Provider(client, Wallet(kp))
            program_id = Pubkey.from_string(program_str)
            idl_path = os.path.abspath(os.path.join(os.path.dirname(settings.BASE_DIR), 'blockchain', 'rb_contracts', 'target', 'idl', 'renaiss_block.json'))
            idl = None
            try:
                import json as _json
                with open(idl_path, 'r') as f:
                    idl = _json.load(f)
            except Exception:
                idl = None
            tx_sig = None
            if idl is not None:
                program = await Program.create(idl, program_id, provider)
                # Connectivity test only; do not pass accounts until wired
                # tx_sig = await program.rpc['mint_nft']('ipfs://metadata', int(1000))
            await client.close()
            return tx_sig

        try:
            tx = asyncio.run(_run())
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f'Anchor call failed: {exc}'))
            tx = None

        content.inventory_status = 'minted'
        if not content.nft_contract:
            content.nft_contract = program_str
        content.save()

        # Log fee for MVP if price is set
        try:
            fee_bps = int(getattr(settings, 'PLATFORM_FEE_BPS', 1000))
            gross = float(content.price_usd or 0) * float(content.editions or 1)
            fee_amt = round(gross * (fee_bps / 10000.0), 2)
            if fee_amt > 0:
                TestFeeLog.objects.create(amount=fee_amt)
        except Exception:
            pass

        self.stdout.write(self.style.SUCCESS(f'Minted content {content.id}. tx={tx or "n/a"}'))


