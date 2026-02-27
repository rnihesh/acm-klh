from pydantic import BaseModel, Field
from datetime import date, datetime
from enum import Enum
from typing import Optional, Literal


class MismatchType(str, Enum):
    MISSING_IN_GSTR1 = "MISSING_IN_GSTR1"
    MISSING_IN_GSTR2B = "MISSING_IN_GSTR2B"
    VALUE_MISMATCH = "VALUE_MISMATCH"
    RATE_MISMATCH = "RATE_MISMATCH"
    PERIOD_MISMATCH = "PERIOD_MISMATCH"
    GSTIN_ERROR = "GSTIN_ERROR"
    DUPLICATE_INVOICE = "DUPLICATE_INVOICE"
    EXCESS_ITC = "EXCESS_ITC"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Taxpayer(BaseModel):
    gstin: str = Field(..., pattern=r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
    legal_name: str
    trade_name: Optional[str] = None
    state_code: str = Field(..., min_length=2, max_length=2)
    registration_type: str = "Regular"
    status: str = "Active"


class Invoice(BaseModel):
    invoice_number: str
    invoice_date: date
    invoice_type: str = "B2B"
    supplier_gstin: str
    buyer_gstin: str
    taxable_value: float
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    total_value: float
    gst_rate: float
    hsn_code: str
    place_of_supply: str
    reverse_charge: bool = False


class GSTR1Return(BaseModel):
    gstin: str
    return_period: str  # Format: "MMYYYY"
    filing_date: date
    status: str = "Filed"
    invoices: list[Invoice] = []


class GSTR2BReturn(BaseModel):
    gstin: str
    return_period: str
    generation_date: date
    invoices: list[Invoice] = []


class GSTR3BReturn(BaseModel):
    gstin: str
    return_period: str
    filing_date: date
    itc_claimed: float
    output_tax: float
    net_tax: float


class MismatchResult(BaseModel):
    id: str
    mismatch_type: MismatchType
    severity: Severity
    supplier_gstin: str
    buyer_gstin: str
    invoice_number: str
    return_period: str
    field_name: Optional[str] = None
    expected_value: Optional[str] = None
    actual_value: Optional[str] = None
    amount_difference: float = 0.0
    description: str


class VendorRisk(BaseModel):
    gstin: str
    legal_name: str
    risk_score: float = Field(..., ge=0, le=100)
    risk_level: RiskLevel
    filing_rate: float
    mismatch_count: int
    total_invoices: int
    circular_trade_flag: bool = False
    risk_factors: list[str] = []


class AuditTrail(BaseModel):
    id: str
    mismatch_id: str
    explanation: str
    invoice_chain: list[dict] = []
    recommendation: str = ""
    generated_at: datetime


class ReconciliationRequest(BaseModel):
    return_period: str  # Format: "MMYYYY"
    gstin: Optional[str] = None  # Optional: reconcile for specific taxpayer


class DashboardStats(BaseModel):
    total_taxpayers: int
    total_invoices: int
    total_mismatches: int
    high_risk_vendors: int
    total_itc_at_risk: float
    mismatch_breakdown: dict[str, int]
    severity_breakdown: dict[str, int]


class EInvoice(BaseModel):
    irn: str = Field(..., description="Invoice Reference Number (64-char hash)")
    invoice_id: Optional[str] = None
    ack_number: str
    ack_date: date
    irn_status: str = "Active"
    qr_code: Optional[str] = None


class EWayBill(BaseModel):
    ewb_number: str = Field(..., description="12-digit E-Way Bill number")
    invoice_id: Optional[str] = None
    transporter_gstin: str
    transport_mode: str = "Road"
    vehicle_number: Optional[str] = None
    valid_from: date
    valid_until: date
    distance_km: float = 0.0


class PurchaseRegisterEntry(BaseModel):
    entry_id: str
    buyer_gstin: str
    supplier_gstin: str
    invoice_number: str
    invoice_date: date
    taxable_value: float
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    total_value: float
    booked_date: date


class NotificationSettings(BaseModel):
    channel: Literal["email", "webhook"] = "email"
    enabled: bool = True
    email_to: Optional[str] = None
    webhook_url: Optional[str] = None
    notify_on_critical: bool = True
