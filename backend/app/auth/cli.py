import os
import click
from flask.cli import with_appcontext
from backend.app.auth.models import User
from backend.app.auth.services import create_user, get_user_by_email
from backend.app.common.permissions import RoleEnum


@click.command("create-owner")
@click.option(
    "--email",
    default=lambda: os.getenv("OWNER_EMAIL", ""),
    prompt="Owner Email",
    help="Email address for the club owner.",
)
@click.option(
    "--first-name",
    default=lambda: os.getenv("OWNER_FIRST_NAME", "Club"),
    prompt="First Name",
    help="First name of the owner.",
)
@click.option(
    "--last-name",
    default=lambda: os.getenv("OWNER_LAST_NAME", "Owner"),
    prompt="Last Name",
    help="Last name of the owner.",
)
@click.option(
    "--password",
    default=lambda: os.getenv("OWNER_PASSWORD", None),
    help="Password (reads from prompt if not specified in env var).",
)
@with_appcontext
def create_owner_command(email: str, first_name: str, last_name: str, password: str):
    """CLI bootstrap command to provision the initial club OWNER account.

    Reads credentials securely from CLI prompt or environment variables.
    """
    normalized_email = email.lower().strip()
    existing_user = get_user_by_email(normalized_email)
    if existing_user is not None:
        click.echo(
            click.style(
                f"Error: User with email '{normalized_email}' already exists.",
                fg="red",
            )
        )
        return

    if not password:
        password = click.prompt(
            "Owner Password",
            hide_input=True,
            confirmation_prompt=True,
        )

    if len(password) < 6:
        click.echo(
            click.style(
                "Error: Password must be at least 6 characters long.",
                fg="red",
            )
        )
        return

    user = create_user(
        email=normalized_email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role=RoleEnum.OWNER,
        is_active=True,
    )
    click.echo(
        click.style(
            f"Successfully bootstrapped OWNER account for '{user.email}' (ID: {user.id}).",
            fg="green",
        )
    )
