from sqlalchemy import Column, Integer, ForeignKey, Date, Enum, Numeric, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from core.database import Base


class InvoiceStatus(str, enum.Enum):
    PAID = "paid"
    UNPAID = "unpaid"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=True)
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date, nullable=True)
    status = Column(
        Enum(InvoiceStatus, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=InvoiceStatus.UNPAID,
        server_default=InvoiceStatus.UNPAID.value,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    company = relationship("Company", backref="invoices")

