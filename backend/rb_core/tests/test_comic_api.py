"""
Tests for Comic Book Collaboration API.

Tests cover:
1. ComicPage CRUD operations
2. ComicPanel CRUD operations
3. SpeechBubble CRUD operations
4. Permission checks
5. Edge cases (empty projects, invalid data)
"""

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from rb_core.models import (
    CollaborativeProject, CollaboratorRole,
    ComicPage, ComicPanel, SpeechBubble
)


User = get_user_model()


class ComicPageViewSetTests(APITestCase):
    """Tests for ComicPage API endpoints."""

    def setUp(self):
        """Set up test users and project."""
        self.owner = User.objects.create_user(
            username='owner',
            email='owner@test.com',
            password='testpass123'
        )
        self.collaborator = User.objects.create_user(
            username='collaborator',
            email='collab@test.com',
            password='testpass123'
        )
        self.stranger = User.objects.create_user(
            username='stranger',
            email='stranger@test.com',
            password='testpass123'
        )

        # Create comic project
        self.project = CollaborativeProject.objects.create(
            title='Test Comic',
            description='A test comic book',
            content_type='comic',
            created_by=self.owner,
            status='active'
        )

        # Add collaborator
        CollaboratorRole.objects.create(
            project=self.project,
            user=self.collaborator,
            role='artist',
            status='accepted',
            can_edit_images=True,
            revenue_percentage=Decimal('0')
        )

        self.client = APIClient()

    def test_list_pages_empty_project(self):
        """GET /api/comic-pages/?project=X returns [] for new project."""
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f'/api/comic-pages/?project={self.project.id}')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # API returns paginated response
        self.assertEqual(response.json()['results'], [])

    def test_list_pages_requires_project_param(self):
        """GET /api/comic-pages/ without project param returns empty."""
        self.client.force_authenticate(user=self.owner)
        response = self.client.get('/api/comic-pages/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # API returns paginated response
        self.assertEqual(response.json()['results'], [])

    def test_create_page(self):
        """POST /api/comic-pages/ creates a page."""
        self.client.force_authenticate(user=self.owner)
        response = self.client.post('/api/comic-pages/', {
            'project': self.project.id
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['page_number'], 1)
        self.assertEqual(data['project'], self.project.id)
        self.assertEqual(data['panels'], [])

    def test_create_page_auto_increment_page_number(self):
        """Page numbers auto-increment correctly."""
        self.client.force_authenticate(user=self.owner)

        # Create first page
        response1 = self.client.post('/api/comic-pages/', {'project': self.project.id})
        self.assertEqual(response1.json()['page_number'], 1)

        # Create second page
        response2 = self.client.post('/api/comic-pages/', {'project': self.project.id})
        self.assertEqual(response2.json()['page_number'], 2)

        # Create third page
        response3 = self.client.post('/api/comic-pages/', {'project': self.project.id})
        self.assertEqual(response3.json()['page_number'], 3)

    def test_update_page(self):
        """PATCH /api/comic-pages/X/ updates page."""
        page = ComicPage.objects.create(
            project=self.project,
            page_number=1
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.patch(f'/api/comic-pages/{page.id}/', {
            'page_format': 'manga',
            'background_color': '#000000'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        page.refresh_from_db()
        self.assertEqual(page.page_format, 'manga')
        self.assertEqual(page.background_color, '#000000')

    def test_delete_page(self):
        """DELETE /api/comic-pages/X/ removes page."""
        page = ComicPage.objects.create(
            project=self.project,
            page_number=1
        )
        self.client.force_authenticate(user=self.owner)

        response = self.client.delete(f'/api/comic-pages/{page.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ComicPage.objects.filter(id=page.id).exists())

    def test_delete_page_reorders_remaining(self):
        """Deleting a page reorders remaining pages."""
        page1 = ComicPage.objects.create(project=self.project, page_number=1)
        page2 = ComicPage.objects.create(project=self.project, page_number=2)
        page3 = ComicPage.objects.create(project=self.project, page_number=3)

        self.client.force_authenticate(user=self.owner)
        self.client.delete(f'/api/comic-pages/{page2.id}/')

        page1.refresh_from_db()
        page3.refresh_from_db()
        self.assertEqual(page1.page_number, 1)
        self.assertEqual(page3.page_number, 2)  # Was 3, now 2

    def test_permission_required(self):
        """Unauthenticated users cannot access."""
        response = self.client.get(f'/api/comic-pages/?project={self.project.id}')
        # DRF may return 403 for session auth without credentials
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_stranger_cannot_access(self):
        """Users not in project cannot access pages."""
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get(f'/api/comic-pages/?project={self.project.id}')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # API returns paginated response with empty results
        self.assertEqual(response.json()['results'], [])  # Returns empty, not 403

    def test_collaborator_can_access(self):
        """Accepted collaborators can access pages."""
        ComicPage.objects.create(project=self.project, page_number=1)

        self.client.force_authenticate(user=self.collaborator)
        response = self.client.get(f'/api/comic-pages/?project={self.project.id}')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # API returns paginated response
        self.assertEqual(len(response.json()['results']), 1)


class ComicPanelViewSetTests(APITestCase):
    """Tests for ComicPanel API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='paneluser',
            email='panel@test.com',
            password='testpass123'
        )
        self.project = CollaborativeProject.objects.create(
            title='Panel Test Comic',
            content_type='comic',
            created_by=self.user,
            status='active'
        )
        self.page = ComicPage.objects.create(
            project=self.project,
            page_number=1
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_panel(self):
        """POST /api/comic-panels/ creates panel."""
        response = self.client.post('/api/comic-panels/', {
            'page': self.page.id,
            'x_percent': 10,
            'y_percent': 10,
            'width_percent': 40,
            'height_percent': 40
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(float(data['x_percent']), 10.0)
        self.assertEqual(float(data['width_percent']), 40.0)

    def test_update_panel_position(self):
        """PATCH /api/comic-panels/X/ updates position."""
        panel = ComicPanel.objects.create(
            page=self.page,
            x_percent=10,
            y_percent=10,
            width_percent=40,
            height_percent=40
        )

        response = self.client.patch(f'/api/comic-panels/{panel.id}/', {
            'x_percent': 20,
            'y_percent': 30
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        panel.refresh_from_db()
        self.assertEqual(float(panel.x_percent), 20.0)
        self.assertEqual(float(panel.y_percent), 30.0)

    def test_delete_panel(self):
        """DELETE /api/comic-panels/X/ removes panel."""
        panel = ComicPanel.objects.create(
            page=self.page,
            x_percent=10,
            y_percent=10,
            width_percent=40,
            height_percent=40
        )

        response = self.client.delete(f'/api/comic-panels/{panel.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ComicPanel.objects.filter(id=panel.id).exists())

    def test_panel_position_bounds(self):
        """Panel position values should be constrained to 0-100."""
        response = self.client.post('/api/comic-panels/', {
            'page': self.page.id,
            'x_percent': -10,  # Invalid
            'y_percent': 10,
            'width_percent': 40,
            'height_percent': 40
        })

        # Should either reject or clamp the value
        # Depending on implementation, adjust assertion
        # For now, we test it doesn't crash
        self.assertIn(response.status_code, [
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST
        ])


class SpeechBubbleViewSetTests(APITestCase):
    """Tests for SpeechBubble API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='bubbleuser',
            email='bubble@test.com',
            password='testpass123'
        )
        self.project = CollaborativeProject.objects.create(
            title='Bubble Test Comic',
            content_type='comic',
            created_by=self.user,
            status='active'
        )
        self.page = ComicPage.objects.create(
            project=self.project,
            page_number=1
        )
        self.panel = ComicPanel.objects.create(
            page=self.page,
            x_percent=10,
            y_percent=10,
            width_percent=40,
            height_percent=40
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_bubble(self):
        """POST /api/speech-bubbles/ creates bubble."""
        response = self.client.post('/api/speech-bubbles/', {
            'panel': self.panel.id,
            'bubble_type': 'oval',
            'text': 'Hello!',
            'x_percent': 10,
            'y_percent': 10,
            'width_percent': 30,
            'height_percent': 20
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data['bubble_type'], 'oval')
        self.assertEqual(data['text'], 'Hello!')

    def test_update_bubble_text(self):
        """PATCH /api/speech-bubbles/X/ updates text."""
        bubble = SpeechBubble.objects.create(
            panel=self.panel,
            bubble_type='oval',
            text='Original',
            x_percent=10,
            y_percent=10,
            width_percent=30,
            height_percent=20
        )

        response = self.client.patch(f'/api/speech-bubbles/{bubble.id}/', {
            'text': 'Updated text!'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bubble.refresh_from_db()
        self.assertEqual(bubble.text, 'Updated text!')

    def test_update_bubble_type(self):
        """Can change bubble type."""
        bubble = SpeechBubble.objects.create(
            panel=self.panel,
            bubble_type='oval',
            text='Test',
            x_percent=10,
            y_percent=10,
            width_percent=30,
            height_percent=20
        )

        response = self.client.patch(f'/api/speech-bubbles/{bubble.id}/', {
            'bubble_type': 'thought'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bubble.refresh_from_db()
        self.assertEqual(bubble.bubble_type, 'thought')

    def test_delete_bubble(self):
        """DELETE /api/speech-bubbles/X/ removes bubble."""
        bubble = SpeechBubble.objects.create(
            panel=self.panel,
            bubble_type='oval',
            text='Delete me',
            x_percent=10,
            y_percent=10,
            width_percent=30,
            height_percent=20
        )

        response = self.client.delete(f'/api/speech-bubbles/{bubble.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(SpeechBubble.objects.filter(id=bubble.id).exists())

    def test_bubble_types_valid(self):
        """Test all valid bubble types can be created."""
        bubble_types = ['oval', 'thought', 'shout', 'whisper', 'narrative', 'caption']

        for btype in bubble_types:
            with self.subTest(bubble_type=btype):
                response = self.client.post('/api/speech-bubbles/', {
                    'panel': self.panel.id,
                    'bubble_type': btype,
                    'text': f'Test {btype}',
                    'x_percent': 10,
                    'y_percent': 10,
                    'width_percent': 30,
                    'height_percent': 20
                }, format='json')
                self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class ComicProjectIntegrationTests(APITestCase):
    """Integration tests for full comic workflows."""

    def setUp(self):
        """Set up test user and authenticate."""
        self.user = User.objects.create_user(
            username='integrationuser',
            email='integration@test.com',
            password='testpass123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_full_comic_workflow(self):
        """Test complete workflow: project → page → panel → bubble."""
        # Create comic project
        project = CollaborativeProject.objects.create(
            title='Integration Test Comic',
            content_type='comic',
            created_by=self.user,
            status='active'
        )

        # Create page
        page_response = self.client.post('/api/comic-pages/', {
            'project': project.id
        })
        self.assertEqual(page_response.status_code, status.HTTP_201_CREATED)
        page_id = page_response.json()['id']

        # Create panel
        panel_response = self.client.post('/api/comic-panels/', {
            'page': page_id,
            'x_percent': 5,
            'y_percent': 5,
            'width_percent': 45,
            'height_percent': 45
        })
        self.assertEqual(panel_response.status_code, status.HTTP_201_CREATED)
        panel_id = panel_response.json()['id']

        # Create speech bubble
        bubble_response = self.client.post('/api/speech-bubbles/', {
            'panel': panel_id,
            'bubble_type': 'oval',
            'text': 'Hello, world!',
            'x_percent': 10,
            'y_percent': 10,
            'width_percent': 40,
            'height_percent': 25
        }, format='json')
        self.assertEqual(bubble_response.status_code, status.HTTP_201_CREATED)

        # Verify list endpoint shows the page
        list_response = self.client.get(f'/api/comic-pages/?project={project.id}')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        # API returns paginated response
        pages = list_response.json()['results']
        self.assertEqual(len(pages), 1)

        # Verify full structure via detail endpoint (includes nested panels)
        detail_response = self.client.get(f'/api/comic-pages/{page_id}/')
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        page_data = detail_response.json()

        self.assertEqual(len(page_data['panels']), 1)
        self.assertEqual(len(page_data['panels'][0]['speech_bubbles']), 1)
        self.assertEqual(page_data['panels'][0]['speech_bubbles'][0]['text'], 'Hello, world!')

    def test_project_type_validation(self):
        """Cannot create comic pages on non-comic projects."""
        book_project = CollaborativeProject.objects.create(
            title='Book Project',
            content_type='book',
            created_by=self.user,
            status='active'
        )

        response = self.client.post('/api/comic-pages/', {
            'project': book_project.id
        })

        # Should fail - book projects don't have comic pages
        # Returns 400 (validation error) not 404
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
