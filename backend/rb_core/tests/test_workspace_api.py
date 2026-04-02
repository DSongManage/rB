"""
Tests for Workspace API (Reference Images, Art Deliveries, Page Comments).

Tests cover:
1. PageReferenceImage CRUD
2. PageArtDelivery CRUD + approve/request_revision actions
3. Page status workflow transitions
4. ProjectComment with comic_page filtering
5. Permission checks
"""

import io
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from rb_core.models import (
    CollaborativeProject, CollaboratorRole, ComicIssue,
    ComicPage, PageReferenceImage, PageArtDelivery,
    ProjectComment
)


User = get_user_model()


def make_test_image(name='test.png'):
    """Create a minimal PNG file for upload tests."""
    # Minimal valid PNG (1x1 pixel, white)
    png_data = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
        b'\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00'
        b'\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00'
        b'\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    return SimpleUploadedFile(name, png_data, content_type='image/png')


class WorkspaceTestBase(APITestCase):
    """Base class with common setup for workspace tests."""

    def setUp(self):
        self.author = User.objects.create_user(
            username='author', email='author@test.com', password='testpass123'
        )
        self.artist = User.objects.create_user(
            username='artist', email='artist@test.com', password='testpass123'
        )
        self.stranger = User.objects.create_user(
            username='stranger', email='stranger@test.com', password='testpass123'
        )

        self.project = CollaborativeProject.objects.create(
            title='Test Comic',
            description='A test comic book',
            content_type='comic',
            created_by=self.author,
            status='active'
        )

        self.issue = ComicIssue.objects.create(
            project=self.project,
            title='Issue #1',
            issue_number=1
        )

        CollaboratorRole.objects.create(
            project=self.project,
            user=self.artist,
            role='artist',
            status='accepted',
            can_edit_images=True,
            revenue_percentage=Decimal('50')
        )

        self.page = ComicPage.objects.create(
            issue=self.issue,
            project=self.project,
            page_number=1,
            script_data={'page_description': 'A dark alley at night', 'panels': []}
        )

        self.client = APIClient()


class PageReferenceImageTests(WorkspaceTestBase):
    """Tests for page reference image CRUD."""

    def test_upload_reference_image(self):
        """Author can upload a reference image."""
        self.client.force_authenticate(user=self.author)
        response = self.client.post('/api/page-reference-images/', {
            'page': self.page.id,
            'file': make_test_image('mood_board.png'),
            'caption': 'Dark alley reference',
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['caption'], 'Dark alley reference')
        self.assertEqual(data['uploaded_by_username'], 'author')
        self.assertEqual(data['page'], self.page.id)

    def test_artist_can_upload_reference_image(self):
        """Artist collaborator can also upload reference images."""
        self.client.force_authenticate(user=self.artist)
        response = self.client.post('/api/page-reference-images/', {
            'page': self.page.id,
            'file': make_test_image(),
            'caption': 'Style reference',
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_stranger_cannot_upload_reference_image(self):
        """Non-collaborator cannot upload reference images."""
        self.client.force_authenticate(user=self.stranger)
        response = self.client.post('/api/page-reference-images/', {
            'page': self.page.id,
            'file': make_test_image(),
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_reference_images_by_page(self):
        """Can filter reference images by page."""
        self.client.force_authenticate(user=self.author)
        PageReferenceImage.objects.create(
            page=self.page,
            file=make_test_image(),
            caption='Ref 1',
            uploaded_by=self.author
        )
        PageReferenceImage.objects.create(
            page=self.page,
            file=make_test_image(),
            caption='Ref 2',
            uploaded_by=self.author
        )

        response = self.client.get(f'/api/page-reference-images/?page={self.page.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data if isinstance(data, list) else data.get('results', data)
        self.assertEqual(len(results), 2)

    def test_delete_reference_image(self):
        """Can delete a reference image."""
        self.client.force_authenticate(user=self.author)
        ref = PageReferenceImage.objects.create(
            page=self.page,
            file=make_test_image(),
            uploaded_by=self.author
        )

        response = self.client.delete(f'/api/page-reference-images/{ref.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PageReferenceImage.objects.filter(id=ref.id).exists())


class PageArtDeliveryTests(WorkspaceTestBase):
    """Tests for art delivery upload, versioning, and approval workflow."""

    def test_upload_art_delivery(self):
        """Artist can upload art delivery."""
        self.client.force_authenticate(user=self.artist)
        response = self.client.post('/api/page-art-deliveries/', {
            'page': self.page.id,
            'file': make_test_image('page1_final.png'),
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['version'], 1)
        self.assertEqual(data['status'], 'delivered')
        self.assertEqual(data['uploaded_by_username'], 'artist')
        self.assertEqual(data['filename'], 'page1_final.png')

    def test_art_delivery_auto_increments_version(self):
        """Each upload auto-increments the version number."""
        self.client.force_authenticate(user=self.artist)

        # First upload
        r1 = self.client.post('/api/page-art-deliveries/', {
            'page': self.page.id,
            'file': make_test_image('v1.png'),
        }, format='multipart')
        self.assertEqual(r1.json()['version'], 1)

        # Second upload
        r2 = self.client.post('/api/page-art-deliveries/', {
            'page': self.page.id,
            'file': make_test_image('v2.png'),
        }, format='multipart')
        self.assertEqual(r2.json()['version'], 2)

    def test_art_delivery_updates_page_status(self):
        """Uploading art delivery sets page_status to 'art_delivered'."""
        self.client.force_authenticate(user=self.artist)
        self.client.post('/api/page-art-deliveries/', {
            'page': self.page.id,
            'file': make_test_image(),
        }, format='multipart')

        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'art_delivered')

    def test_approve_art_delivery(self):
        """Author can approve an art delivery."""
        delivery = PageArtDelivery.objects.create(
            page=self.page,
            file=make_test_image(),
            filename='test.png',
            version=1,
            uploaded_by=self.artist
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.post(f'/api/page-art-deliveries/{delivery.id}/approve/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['status'], 'approved')
        self.assertIsNotNone(data['reviewed_at'])

        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'approved')

    def test_request_revision(self):
        """Author can request revision with notes."""
        delivery = PageArtDelivery.objects.create(
            page=self.page,
            file=make_test_image(),
            filename='test.png',
            version=1,
            uploaded_by=self.artist
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.post(
            f'/api/page-art-deliveries/{delivery.id}/request_revision/',
            {'revision_notes': 'The alley needs to be darker'}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['status'], 'revision_requested')
        self.assertEqual(data['revision_notes'], 'The alley needs to be darker')

        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'revision_requested')

    def test_request_revision_requires_notes(self):
        """Revision request without notes returns 400."""
        delivery = PageArtDelivery.objects.create(
            page=self.page,
            file=make_test_image(),
            filename='test.png',
            version=1,
            uploaded_by=self.artist
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.post(
            f'/api/page-art-deliveries/{delivery.id}/request_revision/',
            {}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_artist_cannot_approve(self):
        """Artist cannot approve their own delivery."""
        delivery = PageArtDelivery.objects.create(
            page=self.page,
            file=make_test_image(),
            filename='test.png',
            version=1,
            uploaded_by=self.artist
        )

        self.client.force_authenticate(user=self.artist)
        response = self.client.post(f'/api/page-art-deliveries/{delivery.id}/approve/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_stranger_cannot_upload_art(self):
        """Non-collaborator cannot upload art."""
        self.client.force_authenticate(user=self.stranger)
        response = self.client.post('/api/page-art-deliveries/', {
            'page': self.page.id,
            'file': make_test_image(),
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_art_deliveries_by_page(self):
        """Can filter art deliveries by page."""
        self.client.force_authenticate(user=self.author)
        PageArtDelivery.objects.create(
            page=self.page, file=make_test_image(), filename='v1.png',
            version=1, uploaded_by=self.artist
        )
        PageArtDelivery.objects.create(
            page=self.page, file=make_test_image(), filename='v2.png',
            version=2, uploaded_by=self.artist
        )

        response = self.client.get(f'/api/page-art-deliveries/?page={self.page.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data if isinstance(data, list) else data.get('results', data)
        self.assertEqual(len(results), 2)


class PageStatusWorkflowTests(WorkspaceTestBase):
    """Tests for page status transitions."""

    def test_default_page_status(self):
        """New pages default to 'script_only'."""
        self.assertEqual(self.page.page_status, 'script_only')

    def test_update_page_status(self):
        """Author can update page status."""
        self.client.force_authenticate(user=self.author)
        response = self.client.patch(
            f'/api/comic-pages/{self.page.id}/',
            {'page_status': 'in_progress'},
            format='json'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'in_progress')

    def test_page_status_in_serializer_response(self):
        """page_status is included in the API response."""
        self.client.force_authenticate(user=self.author)
        response = self.client.get(f'/api/comic-pages/{self.page.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('page_status', response.json())
        self.assertEqual(response.json()['page_status'], 'script_only')

    def test_full_workflow_script_to_approved(self):
        """Full workflow: script_only → in_progress → art_delivered → approved."""
        # 1. Author marks as in_progress
        self.client.force_authenticate(user=self.author)
        self.client.patch(
            f'/api/comic-pages/{self.page.id}/',
            {'page_status': 'in_progress'},
            format='json'
        )
        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'in_progress')

        # 2. Artist uploads art → auto-sets art_delivered
        self.client.force_authenticate(user=self.artist)
        self.client.post('/api/page-art-deliveries/', {
            'page': self.page.id,
            'file': make_test_image(),
        }, format='multipart')
        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'art_delivered')

        # 3. Author approves
        delivery = PageArtDelivery.objects.filter(page=self.page).first()
        self.client.force_authenticate(user=self.author)
        self.client.post(f'/api/page-art-deliveries/{delivery.id}/approve/')
        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'approved')

    def test_revision_workflow(self):
        """art_delivered → revision_requested → art_delivered (new version)."""
        # Setup: create initial delivery
        delivery = PageArtDelivery.objects.create(
            page=self.page, file=make_test_image(), filename='v1.png',
            version=1, uploaded_by=self.artist
        )
        self.page.page_status = 'art_delivered'
        self.page.save()

        # 1. Author requests revision
        self.client.force_authenticate(user=self.author)
        self.client.post(
            f'/api/page-art-deliveries/{delivery.id}/request_revision/',
            {'revision_notes': 'Too bright'}
        )
        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'revision_requested')

        # 2. Artist uploads new version
        self.client.force_authenticate(user=self.artist)
        r = self.client.post('/api/page-art-deliveries/', {
            'page': self.page.id,
            'file': make_test_image('v2.png'),
        }, format='multipart')
        self.assertEqual(r.json()['version'], 2)
        self.page.refresh_from_db()
        self.assertEqual(self.page.page_status, 'art_delivered')


class PageCommentsTests(WorkspaceTestBase):
    """Tests for page-level comments."""

    def test_create_page_comment(self):
        """Can create a comment scoped to a specific page."""
        self.client.force_authenticate(user=self.author)
        response = self.client.post('/api/project-comments/', {
            'project': self.project.id,
            'comic_page': self.page.id,
            'content': 'Can you make this panel more dynamic?'
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['comic_page'], self.page.id)
        self.assertEqual(data['content'], 'Can you make this panel more dynamic?')

    def test_filter_comments_by_page(self):
        """Can filter comments to a specific page."""
        # Create page 2
        page2 = ComicPage.objects.create(
            issue=self.issue, project=self.project, page_number=2
        )

        # Comments on page 1
        ProjectComment.objects.create(
            project=self.project, comic_page=self.page,
            author=self.author, content='Page 1 comment'
        )
        # Comments on page 2
        ProjectComment.objects.create(
            project=self.project, comic_page=page2,
            author=self.author, content='Page 2 comment'
        )
        # Project-level comment (no page)
        ProjectComment.objects.create(
            project=self.project, author=self.author,
            content='General comment'
        )

        self.client.force_authenticate(user=self.author)

        # Filter by page 1
        response = self.client.get(
            f'/api/project-comments/?project={self.project.id}&comic_page={self.page.id}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        results = data if isinstance(data, list) else data.get('results', data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['content'], 'Page 1 comment')

    def test_artist_can_comment_on_page(self):
        """Artist collaborator can comment on pages."""
        self.client.force_authenticate(user=self.artist)
        response = self.client.post('/api/project-comments/', {
            'project': self.project.id,
            'comic_page': self.page.id,
            'content': 'Working on this now!'
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_stranger_cannot_comment(self):
        """Non-collaborator cannot comment."""
        self.client.force_authenticate(user=self.stranger)
        response = self.client.post('/api/project-comments/', {
            'project': self.project.id,
            'comic_page': self.page.id,
            'content': 'Intruder comment'
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ComicPageSerializerTests(WorkspaceTestBase):
    """Tests that the ComicPage serializer includes new workspace fields."""

    def test_page_includes_reference_images(self):
        """ComicPage response includes nested reference_images."""
        PageReferenceImage.objects.create(
            page=self.page, file=make_test_image(),
            caption='Test ref', uploaded_by=self.author
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.get(f'/api/comic-pages/{self.page.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('reference_images', data)
        self.assertEqual(len(data['reference_images']), 1)
        self.assertEqual(data['reference_images'][0]['caption'], 'Test ref')

    def test_page_includes_art_deliveries(self):
        """ComicPage response includes nested art_deliveries."""
        PageArtDelivery.objects.create(
            page=self.page, file=make_test_image(),
            filename='v1.png', version=1, uploaded_by=self.artist
        )

        self.client.force_authenticate(user=self.author)
        response = self.client.get(f'/api/comic-pages/{self.page.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('art_deliveries', data)
        self.assertEqual(len(data['art_deliveries']), 1)
        self.assertEqual(data['art_deliveries'][0]['version'], 1)

    def test_page_includes_page_status(self):
        """ComicPage response includes page_status."""
        self.client.force_authenticate(user=self.author)
        response = self.client.get(f'/api/comic-pages/{self.page.id}/')

        data = response.json()
        self.assertIn('page_status', data)
        self.assertEqual(data['page_status'], 'script_only')
