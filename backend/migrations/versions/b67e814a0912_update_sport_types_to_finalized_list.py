"""update sport types to finalized list

Revision ID: b67e814a0912
Revises: fa27d8e4b14c
Create Date: 2026-10-03 15:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b67e814a0912'
down_revision = '0b4e50e8b00f'
branch_labels = None
depends_on = None

OLD_SPORTS = ('TENNIS', 'PADEL', 'BADMINTON', 'BOX_CRICKET')
NEW_SPORTS = ('LAWN_TENNIS', 'SWIMMING_POOL', 'BADMINTON', 'BOX_CRICKET', 'TABLE_TENNIS', 'VOLLEYBALL')


def upgrade():
    bind = op.get_bind()

    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE sport_types_enum RENAME TO sport_types_enum_old")
        op.execute("CREATE TYPE sport_types_enum AS ENUM ('LAWN_TENNIS', 'SWIMMING_POOL', 'BADMINTON', 'BOX_CRICKET', 'TABLE_TENNIS', 'VOLLEYBALL')")
        op.execute(
            "ALTER TABLE courts ALTER COLUMN sport_type TYPE sport_types_enum USING ("
            "CASE WHEN sport_type::text = 'TENNIS' THEN 'LAWN_TENNIS'::sport_types_enum "
            "WHEN sport_type::text = 'PADEL' THEN 'LAWN_TENNIS'::sport_types_enum "
            "ELSE sport_type::text::sport_types_enum END)"
        )
        op.execute("DROP TYPE sport_types_enum_old")
    else:
        # 1. If existing rows have TENNIS, migrate to LAWN_TENNIS
        try:
            bind.execute(sa.text("UPDATE courts SET sport_type = 'LAWN_TENNIS' WHERE sport_type = 'TENNIS'"))
        except Exception:
            pass

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

    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE sport_types_enum RENAME TO sport_types_enum_new")
        op.execute("CREATE TYPE sport_types_enum AS ENUM ('TENNIS', 'PADEL', 'BADMINTON', 'BOX_CRICKET')")
        op.execute(
            "ALTER TABLE courts ALTER COLUMN sport_type TYPE sport_types_enum USING ("
            "CASE WHEN sport_type::text = 'LAWN_TENNIS' THEN 'TENNIS'::sport_types_enum "
            "WHEN sport_type::text IN ('SWIMMING_POOL', 'TABLE_TENNIS', 'VOLLEYBALL') THEN 'BADMINTON'::sport_types_enum "
            "ELSE sport_type::text::sport_types_enum END)"
        )
        op.execute("DROP TYPE sport_types_enum_new")
    else:
        try:
            bind.execute(sa.text("UPDATE courts SET sport_type = 'TENNIS' WHERE sport_type = 'LAWN_TENNIS'"))
        except Exception:
            pass

        with op.batch_alter_table('courts', schema=None) as batch_op:
            batch_op.alter_column(
                'sport_type',
                existing_type=sa.Enum(*NEW_SPORTS, name='sport_types_enum'),
                type_=sa.Enum(*OLD_SPORTS, name='sport_types_enum'),
                existing_nullable=False,
            )

