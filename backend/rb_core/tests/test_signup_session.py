"""Regression tests for signup session handling.

Verifies that signup properly logs in the new user, replacing any existing
session (e.g. an admin session from Django admin in the same browser).
"""
from django.test import TestCase
from rb_core.models import User, UserProfile, BetaInvite


class SignupSessionReplacementTests(TestCase):
    """Signup must replace any existing session (e.g. admin) with the new user's."""

    def test_signup_replaces_admin_session(self):
        """When an admin is logged in, signing up a new user must log in as the new user."""
        # Create admin user and log them in
        admin = User.objects.create_superuser(username='adminuser', password='adminpw')
        self.client.login(username='adminuser', password='adminpw')

        # Verify admin session
        st = self.client.get('/api/auth/status/')
        self.assertEqual(st.json()['user']['username'], 'adminuser')

        # Create a valid beta invite
        invite = BetaInvite.objects.create(
            email='newuser@test.com',
            status='approved',
            invite_code='TESTCODE123',
        )

        # Signup as new user (admin session still active)
        res = self.client.post('/api/users/signup/', {
            'username': 'newuser',
            'email': 'newuser@test.com',
            'password': 'newuserpassword',
            'invite_code': 'TESTCODE123',
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)

        # Auth status should now be the NEW user, not admin
        st = self.client.get('/api/auth/status/')
        self.assertEqual(st.json()['user']['username'], 'newuser')

        # Profile endpoint should return the new user's profile
        pf = self.client.get('/api/users/profile/')
        self.assertEqual(pf.status_code, 200)
        self.assertEqual(pf.json()['username'], 'newuser')

    def test_signup_logs_in_new_user(self):
        """Signup should automatically log the new user in (no separate login needed)."""
        invite = BetaInvite.objects.create(
            email='solo@test.com',
            status='approved',
            invite_code='SOLO123',
        )

        res = self.client.post('/api/users/signup/', {
            'username': 'solouser',
            'email': 'solo@test.com',
            'password': 'solopass123',
            'invite_code': 'SOLO123',
        }, content_type='application/json')
        self.assertEqual(res.status_code, 201)

        # Should be logged in immediately
        st = self.client.get('/api/auth/status/')
        self.assertTrue(st.json()['authenticated'])
        self.assertEqual(st.json()['user']['username'], 'solouser')
