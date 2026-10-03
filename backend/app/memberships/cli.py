import click
from flask.cli import with_appcontext
from backend.app.memberships.services import seed_membership_plans


@click.command("seed-plans")
@with_appcontext
def seed_plans_command():
    """Seed the Gold, Silver, and Junior membership plans with pricing and structured benefits."""
    plans = seed_membership_plans()
    for plan in plans:
        click.echo(
            click.style(
                f"- {plan.name} ({plan.code}): INR {plan.displayed_monthly_price:.2f}/mo ({plan.billing_frequency}) - {plan.complimentary_months} complimentary months",
                fg="green",
            )
        )
    click.echo(click.style(f"Successfully seeded {len(plans)} membership plans.", fg="cyan", bold=True))
