from django.core.management.base import BaseCommand
from rb_core.models import User, Content, Collaboration, UserProfile
import random

TYPES = ['book','art','film','music']
GENRES = ['fantasy','scifi','nonfiction','drama','comedy','other']

class Command(BaseCommand):
    help = "Seed demo users, content, and collaborations"

    def handle(self, *args, **options):
        demo_users = [
            ("admin", "Admin", "Admin User", "Fj3adminWalletxxxxxxxxxxxxxxxxxxxxxxx"),
            ("alice", "Alice", "Author", "Fj3aliceWalletxxxxxxxxxxxxxxxxxxxxxxx"),
            ("bob", "Bob", "Director", "Fj3bobWalletxxxxxxxxxxxxxxxxxxxxxxxxx"),
            ("carol", "Carol", "Editor", "Fj3carolWalletxxxxxxxxxxxxxxxxxxxxxx"),
        ]
        users_by_name = {}
        for username, first, last, wallet in demo_users:
            user, _ = User.objects.update_or_create(
                username=username,
                defaults={
                    "email": f"{username}@example.com",
                    "first_name": first,
                    "last_name": last,
                },
            )
            user.set_password("password")
            user.save()
            # Ensure profile exists and carries wallet
            prof, _ = UserProfile.objects.get_or_create(user=user, defaults={"username": username})
            if not prof.wallet_address:
                prof.wallet_address = wallet[:44]
                prof.save()
            users_by_name[username] = user

        def create_item(user, title):
            ctype = random.choice(TYPES)
            genre = random.choice(GENRES)
            teaser = f"https://example.com/{user.username}/{title.replace(' ','_').lower()}/teaser"
            Content.objects.get_or_create(
                creator=user,
                title=title,
                defaults={
                    'teaser_link': teaser,
                    'content_type': ctype,
                    'genre': genre,
                }
            )

        # Featured
        create_item(users_by_name['alice'], 'Indie Book One')
        create_item(users_by_name['bob'], 'Short Film')

        # Bulk
        for i in range(1, 12):
            create_item(users_by_name['alice'], f'Alice Book {i:02d}')
        for i in range(1, 9):
            create_item(users_by_name['bob'], f'Bob Work {i:02d}')
        for i in range(1, 7):
            create_item(users_by_name['carol'], f'Carol Piece {i:02d}')

        c1 = Content.objects.filter(title='Indie Book One', creator=users_by_name['alice']).first()
        if c1:
            collab, _ = Collaboration.objects.get_or_create(content=c1, status='active')
            collab.initiators.add(users_by_name['alice'])
            collab.collaborators.add(users_by_name['bob'])
            collab.revenue_split = {'alice': 60, 'bob': 40}
            collab.save()

        self.stdout.write(self.style.SUCCESS("Seeded demo data (mixed types/genres)."))

        # Bulk create Test1..Test100 with diverse fields
        cities = [
            'New York, NY','Los Angeles, CA','Chicago, IL','Houston, TX','Phoenix, AZ','Philadelphia, PA','San Antonio, TX','San Diego, CA','Dallas, TX','San Jose, CA',
            'Austin, TX','Jacksonville, FL','Fort Worth, TX','Columbus, OH','Charlotte, NC','San Francisco, CA','Indianapolis, IN','Seattle, WA','Denver, CO','Washington, DC',
        ]
        roles_options = [['author'], ['artist'], ['director'], ['editor'], ['composer'], ['writer'], ['illustrator'], ['producer']]
        genre_options = [['fantasy'], ['scifi'], ['nonfiction'], ['drama'], ['comedy'], ['other']]
        status_cycle = [
            'Open Node','Chain Builder','Mint-Ready Partner',
            'Selective Forge','Linked Capacity','Partial Protocol',
            'Locked Chain','Sealed Vault','Exclusive Mint'
        ]

        for i in range(1, 101):
            uname = f"Test{i}"
            user, _ = User.objects.get_or_create(username=uname)
            user.set_password('password')
            user.email = f"{uname.lower()}@example.com"
            user.first_name = "Test"
            user.last_name = str(i)
            user.save()
            prof, _ = UserProfile.objects.get_or_create(user=user, defaults={"username": uname})
            prof.location = cities[i % len(cities)]
            prof.roles = roles_options[i % len(roles_options)]
            prof.genres = genre_options[i % len(genre_options)]
            prof.is_private = True  # default label
            prof.status = status_cycle[i % len(status_cycle)]
            if not prof.display_name:
                prof.display_name = uname
            prof.save()

        self.stdout.write(self.style.SUCCESS("Seeded 100 test users with diverse profiles."))
