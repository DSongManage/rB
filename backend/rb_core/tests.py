from django.test import TestCase
from django.urls import reverse
from .models import User, UserProfile


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

    def test_search_by_handle(self):
        user = User.objects.create_user(username='renaiss1234')
        UserProfile.objects.create(user=user, username='renaiss1234')
        res = self.client.get('/api/users/search/?q=@renaiss')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(any(r['username'].startswith('renaiss') for r in data))

# Create your tests here.
