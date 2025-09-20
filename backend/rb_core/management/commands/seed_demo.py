from django.core.management.base import BaseCommand
from rb_core.models import User, Content, Collaboration

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
                    "wallet_address": wallet[:44],
                },
            )
            user.set_password("password")
            user.save()
            users_by_name[username] = user

        # Featured examples
        if not Content.objects.filter(title="Indie Book One", creator_id=users_by_name["alice"].id).exists():
            Content.objects.create(
                creator=users_by_name["alice"], title="Indie Book One", teaser_link="https://example.com/t1"
            )
        if not Content.objects.filter(title="Short Film", creator_id=users_by_name["bob"].id).exists():
            Content.objects.create(
                creator=users_by_name["bob"], title="Short Film", teaser_link="https://example.com/t2"
            )

        # Bulk fake books for Home feed
        def create_books(user_key: str, count: int = 12):
            user = users_by_name[user_key]
            for i in range(1, count + 1):
                title = f"{user.first_name} Book {i:02d}"
                if not Content.objects.filter(title=title, creator_id=user.id).exists():
                    Content.objects.create(
                        creator=user,
                        title=title,
                        teaser_link=f"https://example.com/{user.username}/teaser/{i}",
                    )
        create_books("alice", 10)
        create_books("bob", 8)
        create_books("carol", 6)

        # One collaboration example
        c1 = Content.objects.get(title="Indie Book One", creator_id=users_by_name["alice"].id)
        collab, _ = Collaboration.objects.get_or_create(content=c1, status='active')
        collab.initiators.add(users_by_name["alice"])
        collab.collaborators.add(users_by_name["bob"])
        collab.revenue_split = {"alice": 60, "bob": 40}
        collab.save()

        self.stdout.write(self.style.SUCCESS("Seeded demo data (users, books, collab)."))
