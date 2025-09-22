from django import forms
from .models import UserProfile


class ProfileEditForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['display_name']


