from django.test import TestCase
from django.conf import settings


class SettingsEnvFlagsTest(TestCase):
    def test_anchor_env_flags_present(self):
        # FEATURE_ANCHOR_MINT should be a boolean
        self.assertIn(settings.FEATURE_ANCHOR_MINT, (True, False))
        # ANCHOR_PROGRAM_ID should be non-empty for devnet testing
        self.assertTrue(isinstance(settings.ANCHOR_PROGRAM_ID, str))
        self.assertGreater(len(settings.ANCHOR_PROGRAM_ID or ''), 0)
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings
from .models import User, UserProfile, Content
from .serializers import UserProfileSerializer
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse


class ProfileTests(TestCase):
    def test_signup_generates_handle_when_blank(self):
        res = self.client.post('/api/users/signup/', data={"username":"", "display_name":"Jane"}, content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertTrue(data['username'])
        self.assertTrue(User.objects.filter(username=data['username']).exists())
        self.assertTrue(UserProfile.objects.filter(username=data['username']).exists())

    def test_profile_edit_display_name_only(self):
        user = User.objects.create_user(username='testuser')
        self.client.force_login(user)
        UserProfile.objects.create(user=user, username='testuser')
        res = self.client.patch('/api/users/profile/', data={"display_name":"New Name"}, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        up = UserProfile.objects.get(user=user)
        self.assertEqual(up.display_name, 'New Name')

    def test_userprofile_serializer_resolves_media_urls(self):
        user = User.objects.create_user(username='mediauser')
        prof = UserProfile.objects.create(user=user, username='mediauser', avatar_url='/media/avatars/x.png', banner_url='/media/banners/y.png')
        req = type('obj', (object,), {'build_absolute_uri': lambda self, u: f'http://testserver{u}'})()
        ser = UserProfileSerializer(prof, context={'request': req})
        data = ser.data
        self.assertTrue(data['avatar'].startswith('http://testserver/'))
        self.assertTrue(data['banner'].startswith('http://testserver/'))

    def test_search_by_handle(self):
        user = User.objects.create_user(username='renaiss1234')
        UserProfile.objects.create(user=user, username='renaiss1234')
        res = self.client.get('/api/users/search/?q=@renaiss')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(any(r['username'].startswith('renaiss') for r in data))

class ContentCustomizeAndPreviewTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner')
        self.other = User.objects.create_user(username='other')
        self.owner_prof = UserProfile.objects.create(user=self.owner, username='owner')
        self.other_prof = UserProfile.objects.create(user=self.other, username='other')
        self.content = Content.objects.create(
            creator=self.owner,
            title='Test Work',
            teaser_link='https://example.com/teaser',
            content_type='book',
            genre='other',
        )

    def test_owner_can_patch_customize_fields(self):
        self.client.force_login(self.owner)
        url = f'/api/content/detail/{self.content.id}/'
        payload = {
            'price_usd': 1.5,
            'editions': 20,
            'teaser_percent': 25,
            'watermark_preview': True,
        }
        res = self.client.patch(url, data=payload, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        c = Content.objects.get(id=self.content.id)
        self.assertEqual(float(c.price_usd), 1.5)
        self.assertEqual(c.editions, 20)
        self.assertEqual(c.teaser_percent, 25)
        self.assertEqual(c.watermark_preview, True)

    def test_non_owner_forbidden_to_patch(self):
        self.client.force_login(self.other)
        url = f'/api/content/detail/{self.content.id}/'
        res = self.client.patch(url, data={'price_usd': 2.0}, content_type='application/json')
        self.assertIn(res.status_code, (403, 404))  # hidden or forbidden

    def test_preview_endpoint_valid_and_404(self):
        res = self.client.get(f'/api/content/{self.content.id}/preview/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn('teaser_link', data)
        self.assertEqual(data.get('content_type'), 'book')
        res2 = self.client.get('/api/content/999999/preview/')
        self.assertEqual(res2.status_code, 404)

    def test_upload_rejects_large_file(self):
        self.client.force_login(self.owner)
        big = b'0' * (int(getattr(settings, 'MAX_UPLOAD_BYTES', 1024 * 1024)) + 1)
        f = SimpleUploadedFile('big.pdf', big, content_type='application/pdf')
        res = self.client.post('/api/content/', data={'title': 'Too Big', 'file': f, 'content_type': 'book', 'genre': 'other'})
        self.assertEqual(res.status_code, 400)

    def test_upload_rejects_bad_type(self):
        self.client.force_login(self.owner)
        small = b'hello world'
        f = SimpleUploadedFile('bad.exe', small, content_type='application/x-msdownload')
        res = self.client.post('/api/content/', data={'title': 'Bad Type', 'file': f, 'content_type': 'book', 'genre': 'other'})
        self.assertEqual(res.status_code, 400)

    def test_invite_view_creator_lookup(self):
        self.client.force_login(self.owner)
        c = Content.objects.create(creator=self.owner, title='Owned', teaser_link='https://t', content_type='book', genre='other')
        res = self.client.post('/api/invite/', data={'collaborator': self.other.id, 'content': c.id})
        self.assertEqual(res.status_code, 200)


class MintContentCommandTests(TestCase):
    def test_mint_content_command_sets_minted_and_contract(self):
        c = Content.objects.create(
            creator=User.objects.create_user(username='mcuser'),
            title='MC Work',
            teaser_link='https://t',
            content_type='book',
            genre='other',
        )
        from django.conf import settings as django_settings
        setattr(django_settings, 'FEATURE_ANCHOR_MINT', False)
        call_command('mint_content', content_id=c.id)
        c.refresh_from_db()
        self.assertEqual(c.inventory_status, 'minted')
        self.assertTrue((c.nft_contract or '') != '')


class MintViewPlatformWalletTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='minter')
        self.client.force_login(self.user)
        self.content = Content.objects.create(
            creator=self.user,
            title='Mintable',
            teaser_link='https://t',
            content_type='book',
            genre='other',
            price_usd=10,
            editions=1,
        )

    @override_settings(PLATFORM_WALLET_PUBKEY='11111111111111111111111111111111111111111111', PLATFORM_FEE_BPS=1000)
    def test_platform_wallet_added_and_scaled(self):
        # Creator requests 100%; platform fee 10% should scale creator to 90% and add platform 10%
        royalties = [{ 'address': '22222222222222222222222222222222222222222222', 'percent': 100 }]
        res = self.client.post('/api/mint/', data={'content_id': self.content.id, 'royalties': royalties}, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        roys = data.get('royalties') or []
        # Expect last entry to be platform wallet 10
        self.assertTrue(len(roys) >= 2)
        platform_entry = roys[-1]
        self.assertEqual(platform_entry[0][:44], '11111111111111111111111111111111111111111111'[:44])
        self.assertEqual(float(platform_entry[1]), 10.0)
