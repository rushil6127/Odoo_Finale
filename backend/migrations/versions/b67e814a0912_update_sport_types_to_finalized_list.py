"""update sport types to finalized list

Revision ID: b67e814a0912
Revises: fa27d8e4b14c
Create Date: 2026-10-03 15:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b67e814a0912'
down_revision = 'fa27d8e4b14c'
branch_labels = None
depends_on = None

OLD_SPORTS = ('TENNIS', 'PADEL', 'BADMINTON', 'BOX_CRICKET')
NEW_SPORTS = ('LAWN_TENNIS', 'SWIMMING_POOL', 'BADMINTON', 'BOX_CRICKET', 'TABLE_TENNIS', 'VOLLEYBALL')


def upgrade():
    bind = op.get_bind()
    
    # 1. If existing rows have TENNIS, migrate to LAWN_TENNIS
    try:
        bind.execute(sa.text("UPDATE courts SET sport_type = 'LAWN_TENNIS' WHERE sport_type = 'TENNIS'"))
    except Exception:
        pass

    # 2. Schema update
    if bind.dialect.name == 'postgresql':
        for new_val in ['LAWN_TENNIS', 'SWIMMING_POOL', 'TABLE_TENNIS', 'VOLLEYBALL']:
            op.execute(f"ALTER TYPE sport_types_enum ADD VALUE IF NOT EXISTS '{new_val}'")
    else:
        # SQLite batch alter
        with op.batch_alter_table('courts', schema=None) as batch_op:
            batch_op.alter_column(
                'sport_type',
                existing_type=sa.Enum(*OLD_SPORTS, name='sport_types_enum'),
                type_=sa.Enum(*NEW_SPORTS, name='sport_types_enum'),
                existing_nullable=False,
            )


def downgrade():
    bind = op.get_bind()
    try:
        bind.execute(sa.text("UPDATE courts SET sport_type = 'TENNIS' WHERE sport_type = 'LAWN_TENNIS'"))
    except Exception:
        pass

    if bind.dialect.name != 'postgresql':
        with op.batch_alter_table('courts', schema=None) as batch_op:
            batch_op.alter_column(
                'sport_type',
                existing_type=sa.Enum(*NEW_SPORTS, name='sport_types_enum'),
                type_=sa.Enum(*OLD_SPORTS, name='sport_types_enum'),
                existing_nullable=False,
            )
