import click
from flask.cli import with_appcontext
from backend.app.courts.services import seed_default_courts


@click.command("seed-courts")
@with_appcontext
def seed_courts_command():
    """Seed initial sports courts/facilities for Lawn Tennis, Swimming Pool, Badminton, Box Cricket, Table Tennis, and Volleyball."""
    courts = seed_default_courts()
    for court in courts:
        click.echo(
            click.style(
                f"- {court.name} [{court.sport_type.value}] ({court.surface_type or 'Standard'}) - {court.status.value}",
                fg="green",
            )
        )
    click.echo(click.style(f"Successfully seeded {len(courts)} sports courts.", fg="cyan", bold=True))
