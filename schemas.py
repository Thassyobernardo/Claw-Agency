from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class LeadBase(BaseModel):
    source: str
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    author: Optional[str] = None
    posted_at: Optional[str] = None
    keywords: Optional[str] = None

class LeadResponse(LeadBase):
    id: int
    status: str
    analysis: Optional[str] = None
    proposal: Optional[str] = None
    qualification: Optional[str] = None
    deliverable_path: Optional[str] = None
    sequence_stage: int
    last_contact_at: Optional[str] = None
    created_at: str
    updated_at: str

class StatsResponse(BaseModel):
    total: int
    by_status: Dict[str, int]
    by_source: Dict[str, int]
    recent_24h: int

class ScanTriggerResponse(BaseModel):
    ok: bool
    new_leads: int

class UpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(new|sent|won|skipped|qualified|skip|built|paid|delivered)$")
