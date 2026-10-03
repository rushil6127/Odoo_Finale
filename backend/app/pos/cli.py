import click
from flask.cli import with_appcontext
from backend.app.pos.services import seed_pos_data


@click.command("seed-pos")
@with_appcontext
def seed_pos_command():
    """Seed initial cafeteria / bar tables and menu items."""
    click.echo("Seeding POS tables and menu items...")
    seed_pos_data()
    click.echo("POS data seeded successfully.")
