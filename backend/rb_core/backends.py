from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model
import jwt  # Use pyjwt for token verification
from django.conf import settings

class Web3AuthBackend(BaseBackend):
    def authenticate(self, request, token=None):
        try:
            # Verify JWT token from Web3Auth (sandbox mode)
            payload = jwt.decode(token, settings.WEB3AUTH_CLIENT_ID, algorithms=['HS256'])  # Adjust algorithm as per Web3Auth docs
            User = get_user_model()
            user, created = User.objects.get_or_create(wallet_address=payload.get('wallet'))
            return user
        except jwt.InvalidTokenError:
            return None
