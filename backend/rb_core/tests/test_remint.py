"""Tests for re-minting (updating) already-published projects."""

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from rb_core.models import (
    CollaborativeProject, CollaboratorRole, Content, ProjectSection, UserProfile,
)


User = get_user_model()


class RemintTests(APITestCase):
    """Test that already-minted projects can be re-published to update content."""

    def setUp(self):
        self.owner = User.objects.create_user(
            username='artist', email='artist@test.com', password='testpass123'
        )
        # Ensure profile with wallet
        profile, _ = UserProfile.objects.get_or_create(user=self.owner)
        profile.wallet_address = '0x1234567890abcdef'
        profile.save()

        self.project = CollaborativeProject.objects.create(
            title='Test Art',
            created_by=self.owner,
            content_type='art',
            is_solo=True,
            price_usd=Decimal('10.00'),
            editions=100,
            teaser_percent=25,
            status='ready_to_mint',
        )
        CollaboratorRole.objects.create(
            project=self.project,
            user=self.owner,
            role='Creator',
            status='accepted',
            revenue_percentage=Decimal('100.00'),
        )
        # Add an image section
        self.section = ProjectSection.objects.create(
            project=self.project,
            section_type='image',
            title='Piece 1',
            order=0,
            owner=self.owner,
        )
        # Set media_file directly in DB to avoid file upload validation
        ProjectSection.objects.filter(pk=self.section.pk).update(media_file='test.jpg')

        self.client.login(username='artist', password='testpass123')

    def test_first_mint_succeeds(self):
        """First mint should create Content and set project to minted."""
        resp = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], 'NFT published successfully')

        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'minted')
        self.assertIsNotNone(self.project.published_content)

    def test_remint_updates_existing_content(self):
        """Re-minting a minted project should update the existing Content, not error."""
        # First mint
        resp1 = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        content_id = resp1.json()['content_id']

        # Update project title
        self.project.refresh_from_db()
        self.project.title = 'Updated Art Title'
        self.project.save()

        # Re-mint
        resp2 = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        data = resp2.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['message'], 'Content updated successfully')
        # Should reuse same Content record
        self.assertEqual(data['content_id'], content_id)

        # Verify content was updated
        content = Content.objects.get(id=content_id)
        self.assertEqual(content.title, 'Updated Art Title')

    def test_remint_updates_price(self):
        """Re-minting should update price on the Content record."""
        # First mint
        resp1 = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        content_id = resp1.json()['content_id']

        # Change price
        self.project.refresh_from_db()
        self.project.price_usd = Decimal('25.00')
        self.project.save()

        # Re-mint
        resp2 = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)

        content = Content.objects.get(id=content_id)
        self.assertEqual(content.price_usd, Decimal('25.00'))

    def test_remint_after_unpublish_restores_inventory_status(self):
        """Re-minting after unpublish should set inventory_status back to 'minted'."""
        # First mint
        resp1 = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        content_id = resp1.json()['content_id']

        # Unpublish
        resp_unpub = self.client.post(f'/api/collaborative-projects/{self.project.id}/unpublish/')
        self.assertEqual(resp_unpub.status_code, status.HTTP_200_OK)

        # Verify content is delisted
        content = Content.objects.get(id=content_id)
        self.assertEqual(content.inventory_status, 'delisted')
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'unpublished')

        # Re-mint (should restore to minted)
        resp2 = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)

        content.refresh_from_db()
        self.assertEqual(content.inventory_status, 'minted')
        self.project.refresh_from_db()
        self.assertEqual(self.project.status, 'minted')

    def test_cancelled_project_cannot_mint(self):
        """Cancelled projects should still be blocked."""
        self.project.status = 'cancelled'
        self.project.save()
        resp = self.client.post(f'/api/collaborative-projects/{self.project.id}/mint/')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cancelled', resp.json()['error'].lower())
