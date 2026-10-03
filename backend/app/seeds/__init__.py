"""Seed Framework for Champions Club.

Provides CLI commands for:
- `flask seed demo` (Populates complete demo environment)
- `flask seed core` (Populates Developer A platform and core operations)
- `flask seed reset` (Resets database; strictly disabled in production)
"""

import os
import click
from flask import current_app
from flask.cli import AppGroup
from backend.app.extensions import db
from backend.app.seeds.demo_seed import seed_core_demo
from backend.app.seeds.demo_seed_b import seed_commerce_and_crm_demo

seed_cli = AppGroup("seed", help="Database seeding and demo data management.")

# Registry for modular seed providers (e.g. Developer B commerce modules)
_ADDITIONAL_SEED_PROVIDERS = [seed_commerce_and_crm_demo]


def register_seed_provider(provider_fn):
    """Register an additional modular seed provider function."""
    if provider_fn not in _ADDITIONAL_SEED_PROVIDERS:
        _ADDITIONAL_SEED_PROVIDERS.append(provider_fn)


@seed_cli.command("core")
def seed_core_command():
    """Seed Developer A core operations demo data (Users, Memberships, Courts, Bookings, Payments)."""
    click.echo("[SEED] Seeding Champions Club core operations demo data...")
    summary = seed_core_demo()
    click.echo(
        f"[OK] Core seed complete: {summary['plans']} plans, {summary['courts']} courts, "
        f"{summary['users']} users, {summary['members']} members, {summary['memberships']} memberships, "
        f"{summary['bookings']} bookings, {summary['payments']} payments."
    )


@seed_cli.command("demo")
def seed_demo_command():
    """Seed the entire application demo dataset (Core + Commerce extensions)."""
    click.echo("[SEED] Seeding full Champions Club demo dataset...")
    summary = seed_core_demo()
    click.echo(
        f"[OK] Core operations seeded: {summary['users']} users, {summary['memberships']} memberships, "
        f"{summary['courts']} courts, {summary['bookings']} bookings, {summary['payments']} payments."
    )

    for provider in _ADDITIONAL_SEED_PROVIDERS:
        try:
            prov_name = getattr(provider, "__name__", str(provider))
            click.echo(f"[SEED] Running seed provider: {prov_name}...")
            provider()
        except Exception as e:
            click.echo(f"[WARNING] Seed provider {provider} raised: {e}", err=True)

    click.echo("[OK] Full demo dataset ready!")


@seed_cli.command("reset")
@click.option("--force", is_flag=True, help="Force reset without interactive confirmation.")
def reset_db_command(force: bool):
    """Reset and reinitialize database tables (Refuses to execute in production)."""
    env = os.getenv("FLASK_ENV", "").lower()
    app_env = current_app.config.get("ENV", "").lower()

    if env == "production" or app_env == "production":
        click.echo("[ERROR] Database reset command is strictly prohibited in production!", err=True)
        return

    if not force:
        if not click.confirm("This will drop ALL tables and wipe all data. Continue?"):
            click.echo("Operation aborted.")
            return

    click.echo("[RESET] Dropping all database tables...")
    db.session.remove()
    db.drop_all()
    click.echo("[RESET] Creating fresh database tables...")
    db.create_all()
    click.echo("[OK] Database reset complete.")
