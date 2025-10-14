from django.test import TestCase
from django.conf import settings
from .models import User, UserProfile, Content, Collaboration


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
    
    def test_user_search_returns_accomplishments_and_stats(self):
        """Test enhanced UserSearchView returns capabilities, accomplishments, and stats (FR8)"""
        # Create test users with profiles
        user1 = User.objects.create_user(username='creator1')
        profile1 = UserProfile.objects.create(
            user=user1,
            username='creator1',
            display_name='Test Creator',
            roles=['author', 'artist'],
            genres=['fantasy', 'scifi'],
            content_count=15,
            total_sales_usd=2500.50,
            status='Mint-Ready Partner',
            location='SF'
        )
        
        user2 = User.objects.create_user(username='artist2')
        profile2 = UserProfile.objects.create(
            user=user2,
            username='artist2',
            roles=['artist'],
            genres=['art'],
            content_count=8,
            total_sales_usd=1200.00,
            status='Selective Forge'
        )
        
        # Create collaborations to test successful_collabs count
        content = Content.objects.create(title='Test', creator=user1, content_type='book')
        collab = Collaboration.objects.create(content=content, status='active')
        collab.collaborators.add(user1, user2)
        
        # Search for users
        res = self.client.get('/api/users/search/?role=artist')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        # Assert both users returned
        self.assertGreaterEqual(len(data), 2)
        
        # Find creator1 in results
        creator1_data = next((u for u in data if u['username'] == 'creator1'), None)
        self.assertIsNotNone(creator1_data)
        
        # Assert capabilities
        self.assertEqual(creator1_data['roles'], ['author', 'artist'])
        self.assertEqual(creator1_data['genres'], ['fantasy', 'scifi'])
        
        # Assert accomplishments
        self.assertEqual(creator1_data['content_count'], 15)
        self.assertAlmostEqual(creator1_data['total_sales_usd'], 2500.50, places=2)
        self.assertGreaterEqual(creator1_data['successful_collabs'], 1)
        
        # Assert status
        self.assertEqual(creator1_data['status'], 'Mint-Ready Partner')
        self.assertEqual(creator1_data['status_category'], 'green')
        
        # Assert tier and location
        self.assertIn('tier', creator1_data)
        self.assertEqual(creator1_data['location'], 'SF')
    
    def test_invite_creates_collaboration_with_message_and_equity(self):
        """Test enhanced InviteView creates Collaboration with message, equity, and sanitization (FR8)"""
        # Create initiator and collaborator
        initiator = User.objects.create_user(username='initiator', password='testpass')
        initiator_profile = UserProfile.objects.create(user=initiator, username='initiator')
        
        collaborator = User.objects.create_user(username='collab1')
        collab_profile = UserProfile.objects.create(user=collaborator, username='collab1')
        
        # Login as initiator
        self.client.login(username='initiator', password='testpass')
        
        # Send invite with message and equity split
        res = self.client.post('/api/invite/', {
            'message': 'Let\'s create <script>alert("xss")</script> an amazing NFT together!',
            'equity_percent': 30,
            'collaborators': [collaborator.id],
            'attachments': 'QmExampleIPFSHash123',
        }, content_type='application/json')
        
        self.assertEqual(res.status_code, 201)
        data = res.json()
        
        # Assert response contains invite details
        self.assertIn('invite_id', data)
        self.assertEqual(data['status'], 'pending')
        self.assertEqual(data['invited_users'], ['collab1'])
        self.assertEqual(data['equity_percent'], 30)
        
        # Verify Collaboration created
        collab = Collaboration.objects.get(id=data['invite_id'])
        self.assertEqual(collab.status, 'pending')
        self.assertIn(initiator, collab.initiators.all())
        self.assertIn(collaborator, collab.collaborators.all())
        
        # Verify revenue split stored
        self.assertEqual(collab.revenue_split['initiator'], 70)
        self.assertEqual(collab.revenue_split['collaborators'], 30)
        
        # Verify message sanitized (XSS removed)
        message_stored = collab.revenue_split.get('message', '')
        self.assertIn('amazing NFT together', message_stored)
        self.assertNotIn('<script>', message_stored)
        
        # Verify attachments stored
        self.assertEqual(collab.revenue_split.get('attachments'), 'QmExampleIPFSHash123')
    
    def test_collaboration_placeholder_content_excluded_from_home_page(self):
        """Test that collaboration invite placeholder content is excluded from /api/content/ (bug fix)"""
        # Create regular content
        regular_user = User.objects.create_user(username='regular_creator')
        regular_profile = UserProfile.objects.create(user=regular_user, username='regular_creator')
        regular_content = Content.objects.create(
            title='My Amazing NFT',
            creator=regular_user,
            content_type='book',
            genre='fantasy'
        )
        
        # Create collaboration placeholder (from InviteView)
        collab_user = User.objects.create_user(username='collab_creator')
        collab_profile = UserProfile.objects.create(user=collab_user, username='collab_creator')
        collab_placeholder = Content.objects.create(
            title='Collaboration Invite - Test Project',  # Starts with "Collaboration Invite"
            creator=collab_user,
            content_type='other',
            genre='other'
        )
        
        # Fetch /api/content/ (should exclude collaboration placeholders)
        res = self.client.get('/api/content/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        # Assert regular content is included
        titles = [item['title'] for item in data]
        self.assertIn('My Amazing NFT', titles)
        
        # Assert collaboration placeholder is EXCLUDED
        self.assertNotIn('Collaboration Invite - Test Project', titles)
        
        # Verify collaboration placeholder exists in DB but not in API
        self.assertTrue(Content.objects.filter(title__startswith='Collaboration Invite').exists())
        self.assertEqual(len([t for t in titles if t.startswith('Collaboration Invite')]), 0)
    
    def test_notifications_returns_pending_invites_for_user(self):
        """Test /api/notifications/ returns pending collaboration invites for authenticated user (FR8)"""
        # Create users
        initiator = User.objects.create_user(username='initiator', password='testpass')
        initiator_profile = UserProfile.objects.create(user=initiator, username='initiator', display_name='Initiator User')
        
        recipient = User.objects.create_user(username='recipient', password='testpass')
        recipient_profile = UserProfile.objects.create(user=recipient, username='recipient')
        
        # Create collaboration invite
        content = Content.objects.create(title='Test Collab Content', creator=initiator, content_type='book')
        collab = Collaboration.objects.create(
            content=content,
            status='pending',
            revenue_split={
                'initiator': 60,
                'collaborators': 40,
                'message': 'Let\'s work together on this fantasy series!',
                'attachments': 'QmTest123',
            }
        )
        collab.initiators.add(initiator)
        collab.collaborators.add(recipient)
        
        # Login as recipient
        self.client.login(username='recipient', password='testpass')
        
        # Fetch notifications
        res = self.client.get('/api/notifications/')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        # Assert invite returned
        self.assertEqual(len(data), 1)
        invite = data[0]
        
        # Assert all fields present
        self.assertEqual(invite['id'], collab.id)
        self.assertEqual(invite['sender_username'], 'initiator')
        self.assertEqual(invite['sender_display_name'], 'Initiator User')
        self.assertIn('fantasy series', invite['message'])
        self.assertEqual(invite['equity_percent'], 40)
        self.assertEqual(invite['attachments'], 'QmTest123')
        self.assertEqual(invite['content_id'], content.id)
        
        # Verify initiator's own invites don't appear in their notifications
        self.client.login(username='initiator', password='testpass')
        res2 = self.client.get('/api/notifications/')
        data2 = res2.json()
        self.assertEqual(len(data2), 0)  # Initiator should see 0 notifications

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
