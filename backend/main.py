import os
import io
import shutil
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv

# Load local environment variables
load_dotenv()

from models import (
    RequirementCreate, RequirementUpdate, RequirementResponse,
    DealerCreate, DealerUpdate, DealerResponse,
    ContactCreate, ContactUpdate, ContactResponse,
    EmailSendRequest, WhatsAppSendRequest, RecordReplyRequest,
    ExtractReplyRequest, FollowUpMetricsResponse,
    QuotationCompareRequest, QuotationCompareResponse, QuotationComparisonItem,
    SearchRequest, SearchResponse, SearchResultItem, SearchHistoryItem, ImageIdentifyResponse,
    DashboardMetricsResponse, RecentSearchActivity, RecentDealerActivity,
    InquiryGenerateRequest, InquiryGenerateResponse,
    PublicContactExtractRequest, PublicContactExtractResponse
)
from excel_service import ExcelService
from matching_service import MatchingService
from supplier_search import SupplierSearchService
from contact_service import ContactService
from vision_service import VisionService
from email_service import EmailService
from whatsapp_service import WhatsAppService

# Configuration
EXCEL_PATH = os.getenv("EXCEL_FILE_PATH", "data/Dealer_Sourcing_Tracker.xlsx")
BACKUP_DIR = os.getenv("BACKUP_DIR", "data/backups")
QUOTATIONS_DIR = os.getenv("QUOTATIONS_DIR", "quotations")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", 10 * 1024 * 1024)) # 10MB
CORS_ORIGINS = [orig.strip() for orig in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")]

# Ensure directories exist
os.makedirs(os.path.dirname(os.path.abspath(EXCEL_PATH)), exist_ok=True)
os.makedirs(os.path.abspath(BACKUP_DIR), exist_ok=True)
os.makedirs(os.path.abspath(QUOTATIONS_DIR), exist_ok=True)

# Initialize Excel Service
excel_svc = ExcelService(file_path=EXCEL_PATH, backup_dir=BACKUP_DIR)

app = FastAPI(
    title="Manufacturing Dealer Sourcing Automation API",
    description="Automated dealer & supplier discovery, requirement matching, quotation comparison, and Excel tracking system.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Health Check -----------------
@app.get("/api/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "Manufacturing Dealer Sourcing Automation API",
        "timestamp": datetime.now().isoformat(),
        "excel_storage": os.path.exists(excel_svc.file_path)
    }

# ----------------- Dashboard -----------------
@app.get("/api/dashboard", response_model=DashboardMetricsResponse, tags=["Dashboard"])
def get_dashboard_metrics():
    try:
        reqs = excel_svc.get_all_requirements()
        dealers = excel_svc.get_all_dealers()
        contacts = excel_svc.get_all_contacts()
        searches = excel_svc.get_search_history()

        exact_count = sum(1 for d in dealers if d.get("match_status") == "Exact Match")
        partial_count = sum(1 for d in dealers if d.get("match_status") == "Partial Match")
        not_match_count = sum(1 for d in dealers if d.get("match_status") == "Not a Match")
        verified_count = sum(1 for d in dealers if d.get("verification_status") == "Verified")

        quotes_received = sum(1 for d in dealers if d.get("confirmed_quoted_price") is not None)
        pending_responses = sum(1 for c in contacts if c.get("response_status") == "Pending")
        # Also include dealers who have not been contacted or pending quote
        if pending_responses == 0 and len(dealers) > 0:
            pending_responses = sum(1 for d in dealers if d.get("confirmed_quoted_price") is None)

        # Recent searches (last 5)
        req_map = {r["requirement_id"]: r["product_name"] for r in reqs}
        recent_searches = []
        for s in reversed(searches[-5:]):
            recent_searches.append(RecentSearchActivity(
                search_id=s["search_id"],
                product_name=req_map.get(s["requirement_id"], f"Req {s['requirement_id']}"),
                portal=s["search_portal"],
                date=s["search_date"],
                results_count=s["results_count"],
                status=s["search_status"]
            ))

        # Recent dealer activities (last 5)
        recent_dealers = []
        for d in reversed(dealers[-5:]):
            recent_dealers.append(RecentDealerActivity(
                dealer_id=d["dealer_id"],
                dealer_name=d["dealer_name"],
                product_name=d["product_name"],
                match_status=d["match_status"],
                verification_status=d["verification_status"],
                created_at=d["created_at"]
            ))

        return DashboardMetricsResponse(
            total_products_submitted=len(reqs),
            total_dealers_discovered=len(dealers),
            exact_matches=exact_count,
            partial_matches=partial_count,
            not_matches=not_match_count,
            quotations_received=quotes_received,
            pending_dealer_responses=pending_responses,
            verified_dealers=verified_count,
            recent_searches=recent_searches,
            recent_dealer_activities=recent_dealers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard metrics: {str(e)}")

# ----------------- Product Requirements -----------------
@app.get("/api/requirements", response_model=List[RequirementResponse], tags=["Requirements"])
def list_requirements():
    return excel_svc.get_all_requirements()

@app.post("/api/requirements", response_model=RequirementResponse, status_code=status.HTTP_201_CREATED, tags=["Requirements"])
def create_requirement(req_in: RequirementCreate):
    try:
        created = excel_svc.create_requirement(req_in.model_dump())
        return created
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save requirement to Excel: {str(e)}")

@app.get("/api/requirements/{requirement_id}", response_model=RequirementResponse, tags=["Requirements"])
def get_requirement(requirement_id: str):
    req = excel_svc.get_requirement_by_id(requirement_id)
    if not req:
        raise HTTPException(status_code=404, detail=f"Requirement '{requirement_id}' not found.")
    return req

@app.put("/api/requirements/{requirement_id}", response_model=RequirementResponse, tags=["Requirements"])
def update_requirement(requirement_id: str, updates: RequirementUpdate):
    req = excel_svc.get_requirement_by_id(requirement_id)
    if not req:
        raise HTTPException(status_code=404, detail=f"Requirement '{requirement_id}' not found.")
    
    updated = excel_svc.update_requirement(requirement_id, updates.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update requirement.")
    return updated

# ----------------- Supplier Search (Text & Image Based) -----------------
@app.post("/api/search", response_model=SearchResponse, tags=["Supplier Search"])
def search_dealers(search_req: SearchRequest):
    req = None
    if search_req.requirement_id:
        req = excel_svc.get_requirement_by_id(search_req.requirement_id)
        if not req and not search_req.product_name:
            raise HTTPException(status_code=404, detail=f"Requirement '{search_req.requirement_id}' not found.")

    if not req:
        if not search_req.product_name or not search_req.product_name.strip():
            raise HTTPException(status_code=400, detail="Either requirement_id or product_name must be provided.")

        p_clean = search_req.product_name.strip()
        p_lower = p_clean.lower()

        # Check if an existing requirement matches
        matched_req = None
        all_reqs = excel_svc.get_all_requirements()
        for r in all_reqs:
            if r["product_name"].strip().lower() == p_lower:
                matched_req = r
                break
        if not matched_req:
            for r in all_reqs:
                if p_lower in r["product_name"].lower() or r["product_name"].lower() in p_lower:
                    matched_req = r
                    break

        req = {
            "requirement_id": matched_req["requirement_id"] if matched_req else "REQ-SEARCH",
            "product_name": p_clean,
            "category": search_req.category or (matched_req.get("category") if matched_req else None) or "Industrial Components",
            "specifications": search_req.specifications or (matched_req.get("specifications") if matched_req else None) or p_clean,
            "quantity": float(matched_req.get("quantity") or 100.0) if matched_req else 100.0,
            "target_price": float(matched_req.get("target_price") or 50.0) if matched_req else 50.0,
            "currency": (matched_req.get("currency") if matched_req else None) or "USD",
            "preferred_location": search_req.filter_location or (matched_req.get("preferred_location") if matched_req else None),
            "delivery_requirement": (matched_req.get("delivery_requirement") if matched_req else None) or "14 days",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    # Execute search using existing search service
    search_res = SupplierSearchService.execute_search(
        requirement=req,
        portal=search_req.portal,
        location_filter=search_req.filter_location,
        max_results=search_req.max_results
    )

    req_id = req.get("requirement_id", "REQ-SEARCH")

    # Log to Search_History in Excel
    history_log = {
        "requirement_id": req_id,
        "search_portal": search_res.get("portal", search_req.portal),
        "search_status": search_res.get("status", "COMPLETED"),
        "results_count": search_res.get("results_count", 0),
        "error_message": search_res.get("error_message")
    }
    logged = excel_svc.log_search(history_log)
    search_id = logged.get("Search_ID", f"SCH-{datetime.now().strftime('%M%S')}")

    return SearchResponse(
        search_id=search_id,
        requirement_id=req_id,
        portal=search_res["portal"],
        search_date=search_res["search_date"],
        status=search_res["status"],
        results_count=search_res["results_count"],
        results=[SearchResultItem(**item) for item in search_res["results"]],
        error_message=search_res.get("error_message"),
        notes=search_res.get("notes")
    )

@app.post("/api/search/identify-image", response_model=ImageIdentifyResponse, tags=["Supplier Search"])
async def identify_product_image(file: UploadFile = File(...)):
    """
    Identifies manufacturing product name, category, and specifications from an uploaded image.
    Uses Vision AI (Gemini/OpenAI) if configured, with an intelligent industrial pattern recognizer.
    """
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    original_filename = Path(file.filename or "product.jpg").name
    file_ext = Path(original_filename).suffix.lower()

    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image format '{file_ext}'. Allowed formats: {', '.join(allowed_extensions)}"
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="Image file exceeds maximum upload limit of 10MB.")

    mime_type = file.content_type or "image/jpeg"
    result = await VisionService.identify_product_from_image(content, filename=original_filename, mime_type=mime_type)
    return ImageIdentifyResponse(**result)

@app.get("/api/search/{search_id}", response_model=SearchHistoryItem, tags=["Supplier Search"])
def get_search_record(search_id: str):
    history = excel_svc.get_search_history()
    for h in history:
        if h["search_id"].lower() == search_id.lower():
            return SearchHistoryItem(**h)
    raise HTTPException(status_code=404, detail=f"Search history '{search_id}' not found.")

@app.post("/api/search/save-results", response_model=List[DealerResponse], tags=["Supplier Search"])
def save_search_results(requirement_id: str, results: List[SearchResultItem], product_name: Optional[str] = Query(None)):
    """Saves discovered search results into Dealer_Results worksheet."""
    req = excel_svc.get_requirement_by_id(requirement_id)
    if not req:
        # Create an ad-hoc requirement record in Excel so relationships are preserved
        first_item_name = product_name or (results[0].product_name if results else "Custom Sourced Component")
        req = excel_svc.create_requirement({
            "product_name": first_item_name,
            "category": "Industrial Components",
            "specifications": f"Specifications for {first_name if 'first_name' in locals() else first_item_name}",
            "quantity": 100,
            "target_price": results[0].listed_price if (results and results[0].listed_price) else 25.0,
            "currency": "USD"
        })
        requirement_id = req["requirement_id"]

    saved_dealers = []
    for item in results:
        dealer_dict = {
            "requirement_id": requirement_id,
            "dealer_name": item.dealer_name,
            "product_name": item.product_name,
            "specifications": item.specifications,
            "public_contact_number": item.public_contact_number,
            "business_email": item.business_email,
            "location": item.location,
            "source_portal": item.source_portal,
            "product_url": item.product_url,
            "listed_price": item.listed_price,
            "currency": req.get("currency", "USD"),
            "moq": item.moq,
            "delivery_time": item.delivery_time,
            "match_status": item.match_status,
            "match_reason": item.match_reason,
            "verification_status": item.verification_status
        }
        res = excel_svc.create_dealer(dealer_dict)
        saved_dealers.append(res)
    return saved_dealers

# ----------------- Dealers -----------------
@app.get("/api/dealers", response_model=List[DealerResponse], tags=["Dealers"])
def list_dealers(requirement_id: Optional[str] = Query(None)):
    return excel_svc.get_all_dealers(requirement_id=requirement_id)

@app.post("/api/dealers", response_model=DealerResponse, status_code=status.HTTP_201_CREATED, tags=["Dealers"])
def create_dealer(dealer_in: DealerCreate):
    req = excel_svc.get_requirement_by_id(dealer_in.requirement_id)
    if not req:
        raise HTTPException(status_code=400, detail=f"Invalid requirement_id '{dealer_in.requirement_id}'.")

    # Evaluate match status and reason if not manually supplied
    data = dealer_in.model_dump()
    if not data.get("match_status") or data.get("match_status") == "Needs Verification":
        status_calc, reason_calc = MatchingService.evaluate_match(req, data)
        data["match_status"] = status_calc
        data["match_reason"] = reason_calc

    created = excel_svc.create_dealer(data)
    return created

@app.get("/api/dealers/{dealer_id}", response_model=DealerResponse, tags=["Dealers"])
def get_dealer(dealer_id: str):
    dealer = excel_svc.get_dealer_by_id(dealer_id)
    if not dealer:
        raise HTTPException(status_code=404, detail=f"Dealer '{dealer_id}' not found.")
    return dealer

@app.put("/api/dealers/{dealer_id}", response_model=DealerResponse, tags=["Dealers"])
def update_dealer(dealer_id: str, updates: DealerUpdate):
    dealer = excel_svc.get_dealer_by_id(dealer_id)
    if not dealer:
        raise HTTPException(status_code=404, detail=f"Dealer '{dealer_id}' not found.")
    
    update_data = updates.model_dump(exclude_unset=True)

    # Re-evaluate matching if price or specs changed
    if any(k in update_data for k in ["listed_price", "confirmed_quoted_price", "moq", "delivery_time", "specifications"]):
        req = excel_svc.get_requirement_by_id(dealer["requirement_id"])
        if req:
            merged = {**dealer, **update_data}
            status_calc, reason_calc = MatchingService.evaluate_match(req, merged)
            update_data["match_status"] = status_calc
            update_data["match_reason"] = reason_calc

    updated = excel_svc.update_dealer(dealer_id, update_data)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update dealer.")
    return updated

# ----------------- Quotation File Upload -----------------
@app.post("/api/dealers/{dealer_id}/upload-quotation", tags=["Dealers"])
async def upload_dealer_quotation(dealer_id: str, file: UploadFile = File(...)):
    dealer = excel_svc.get_dealer_by_id(dealer_id)
    if not dealer:
        raise HTTPException(status_code=404, detail=f"Dealer '{dealer_id}' not found.")

    # Validate file extension
    allowed_extensions = {".pdf", ".xlsx", ".xls", ".docx", ".doc", ".png", ".jpg", ".jpeg"}
    original_filename = Path(file.filename or "quotation.pdf").name  # Sanitize path traversal
    file_ext = Path(original_filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file_ext}'. Allowed types: {', '.join(allowed_extensions)}"
        )

    # Read and check size
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum size limit of {MAX_UPLOAD_SIZE // (1024*1024)}MB.")

    # Unique sanitized filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    clean_name = f"{dealer_id}_{timestamp}_{original_filename.replace(' ', '_')}"
    target_path = Path(QUOTATIONS_DIR).resolve() / clean_name

    # Path traversal check
    if not str(target_path).startswith(str(Path(QUOTATIONS_DIR).resolve())):
        raise HTTPException(status_code=400, detail="Invalid file destination path.")

    with open(target_path, "wb") as f:
        f.write(content)

    relative_path = clean_name
    return {
        "status": "success",
        "message": f"Quotation document uploaded successfully for dealer {dealer_id}.",
        "file_path": relative_path,
        "original_name": original_filename,
        "file_size": len(content)
    }

@app.get("/api/quotations/download/{filename}", tags=["Quotations"])
def download_quotation_file(filename: str):
    safe_filename = Path(filename).name  # Prevent directory traversal
    file_path = Path(QUOTATIONS_DIR).resolve() / safe_filename

    if not str(file_path).startswith(str(Path(QUOTATIONS_DIR).resolve())) or not file_path.exists():
        raise HTTPException(status_code=404, detail="Quotation document not found.")

    return FileResponse(
        path=str(file_path),
        filename=safe_filename,
        media_type="application/octet-stream"
    )

# ----------------- Contact Log & Outreach -----------------
@app.get("/api/contacts", response_model=List[ContactResponse], tags=["Contacts"])
def list_contacts(dealer_id: Optional[str] = Query(None), requirement_id: Optional[str] = Query(None)):
    return excel_svc.get_all_contacts(dealer_id=dealer_id, requirement_id=requirement_id)

@app.get("/api/contacts/followup-metrics", response_model=FollowUpMetricsResponse, tags=["Contacts"])
def get_followup_metrics():
    """
    Returns aggregated KPI metrics for the Follow-up dashboard:
    Due today, Overdue, Waiting for response, Reply received, Quotation received, Failed attempts, Closed.
    """
    return excel_svc.get_followup_metrics()

@app.post("/api/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED, tags=["Contacts"])
def create_contact(contact_in: ContactCreate):
    dealer = excel_svc.get_dealer_by_id(contact_in.dealer_id)
    created = excel_svc.create_contact(contact_in.model_dump())
    return created

@app.put("/api/contacts/{contact_id}", response_model=ContactResponse, tags=["Contacts"])
def update_contact(contact_id: str, updates: ContactUpdate):
    updated = excel_svc.update_contact(contact_id, updates.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail=f"Contact record '{contact_id}' not found.")
    return updated

@app.post("/api/contacts/send-email", tags=["Contacts"])
def send_rfq_email(email_req: EmailSendRequest):
    """
    Validates recipient email, checks user authorization, prevents duplicate sends,
    dispatches RFQ via SMTP, and logs the attempt and delivery status to Excel.
    """
    if not email_req.approved:
        raise HTTPException(
            status_code=400,
            detail="User confirmation is required. Please check the authorization box before sending."
        )

    is_valid, validated_email = EmailService.validate_email(email_req.recipient_email)
    if not is_valid:
        raise HTTPException(status_code=400, detail=validated_email)

    # Duplicate send prevention: check if same recipient received email for this requirement in last 5 minutes
    contacts = excel_svc.get_all_contacts(requirement_id=email_req.requirement_id)
    now_ts = datetime.now()
    for c in contacts:
        if (
            c.get("recipient_contact") == validated_email
            and c.get("communication_status") == "Sent/Accepted"
            and c.get("send_attempt_timestamp")
        ):
            try:
                prev_time = datetime.fromisoformat(c["send_attempt_timestamp"])
                if (now_ts - prev_time).total_seconds() < 300:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Duplicate send prevented: An RFQ was already sent to {validated_email} for requirement {email_req.requirement_id} within the last 5 minutes (Contact ID: {c.get('contact_id')})."
                    )
            except (ValueError, TypeError):
                pass

    # Execute outbound email send
    send_result = EmailService.send_rfq_email(
        recipient_email=validated_email,
        subject=email_req.subject,
        message_body=email_req.message_body,
        sender_name=email_req.sender_name
    )

    comm_status = send_result["status"]
    contact_payload = {
        "dealer_id": email_req.dealer_id,
        "requirement_id": email_req.requirement_id,
        "supplier_name": email_req.supplier_name,
        "product_name": email_req.product_name,
        "contact_method": "Email",
        "recipient_contact": validated_email,
        "subject": email_req.subject,
        "inquiry_message": email_req.message_body,
        "contact_date": datetime.now().strftime("%Y-%m-%d"),
        "response_status": comm_status,
        "communication_status": comm_status,
        "approval_timestamp": datetime.now().isoformat(),
        "send_attempt_timestamp": send_result.get("timestamp") or datetime.now().isoformat(),
        "provider_message_id": send_result.get("provider_message_id"),
        "error_details": send_result.get("error"),
        "follow_up_date": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
        "notes": f"Outbound RFQ email sent via SMTP. Provider ID: {send_result.get('provider_message_id') or 'N/A'}." if send_result.get("success") else f"Email transmission failed: {send_result.get('error')}"
    }

    created = excel_svc.create_contact(contact_payload)

    return {
        "success": send_result["success"],
        "status": send_result["status"],
        "provider_message_id": send_result.get("provider_message_id"),
        "error": send_result.get("error"),
        "contact": created
    }

@app.post("/api/contacts/send-whatsapp", tags=["Contacts"])
def send_rfq_whatsapp(wa_req: WhatsAppSendRequest):
    """
    Validates phone number in E.164 format. Dispatches via WhatsApp Cloud API if configured,
    or generates an official wa.me prefilled draft link for user review and sending.
    Logs the record in Excel Contact_Log.
    """
    if not wa_req.approved:
        raise HTTPException(
            status_code=400,
            detail="User confirmation is required. Please check the authorization box before sending."
        )

    if not wa_req.message_body or not wa_req.message_body.strip():
        raise HTTPException(
            status_code=400,
            detail="RFQ message body cannot be empty."
        )

    is_valid, digits, err = WhatsAppService.validate_phone_number(wa_req.recipient_phone)
    if not is_valid:
        raise HTTPException(status_code=400, detail=err)

    wa_result = WhatsAppService.send_rfq_message(
        recipient_phone=digits,
        message_body=wa_req.message_body.strip()
    )

    comm_status = wa_result["status"]
    is_draft = wa_result.get("is_draft_link", False)
    clean_phone = f"+{digits}"

    contact_payload = {
        "dealer_id": wa_req.dealer_id,
        "requirement_id": wa_req.requirement_id,
        "supplier_name": wa_req.supplier_name,
        "product_name": wa_req.product_name,
        "contact_method": "WhatsApp",
        "recipient_contact": clean_phone,
        "subject": f"WhatsApp RFQ: {wa_req.product_name or 'Part Inquiry'}",
        "inquiry_message": wa_req.message_body,
        "contact_date": datetime.now().strftime("%Y-%m-%d"),
        "response_status": comm_status,
        "communication_status": comm_status,
        "approval_timestamp": datetime.now().isoformat(),
        "send_attempt_timestamp": wa_result.get("timestamp") or datetime.now().isoformat(),
        "provider_message_id": wa_result.get("provider_message_id"),
        "error_details": wa_result.get("error"),
        "follow_up_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"),
        "notes": (
            f"WhatsApp wa.me link generated for manual review/send. Target: {clean_phone}."
            if is_draft else
            f"WhatsApp Cloud API message accepted. Provider ID: {wa_result.get('provider_message_id')}."
        )
    }

    created = excel_svc.create_contact(contact_payload)

    return {
        "success": wa_result["success"],
        "status": wa_result["status"],
        "is_draft_link": is_draft,
        "wa_link": wa_result.get("wa_link"),
        "provider_message_id": wa_result.get("provider_message_id"),
        "error": wa_result.get("error"),
        "contact": created
    }

@app.post("/api/contacts/{contact_id}/record-reply", response_model=ContactResponse, tags=["Contacts"])
def record_supplier_reply(contact_id: str, reply_in: RecordReplyRequest):
    """
    Records an inbound supplier reply and quotation details (price, MOQ, delivery time, etc.)
    Updates communication status and next follow-up date in Excel Contact_Log.
    """
    contacts = excel_svc.get_all_contacts()
    existing = next((c for c in contacts if c["contact_id"] == contact_id), None)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Contact record '{contact_id}' not found.")

    new_status = reply_in.communication_status or ("Quotation Received" if reply_in.quoted_price is not None else "Reply Received")

    updates = {
        "dealer_response": reply_in.supplier_response,
        "supplier_response": reply_in.supplier_response,
        "response_date": reply_in.response_date or datetime.now().strftime("%Y-%m-%d"),
        "communication_status": new_status,
        "response_status": new_status,
        "quoted_price": reply_in.quoted_price,
        "currency": reply_in.currency or "USD",
        "moq": reply_in.moq,
        "delivery_time": reply_in.delivery_time,
        "quotation_validity": reply_in.quotation_validity,
        "technical_details": reply_in.technical_details,
        "quotation_file_path": reply_in.quotation_file_path,
        "follow_up_date": reply_in.next_follow_up_date,
        "next_follow_up_date": reply_in.next_follow_up_date,
        "notes": reply_in.notes or existing.get("notes")
    }

    updated = excel_svc.update_contact(contact_id, updates)
    return updated

@app.post("/api/contacts/extract-reply-data", tags=["Contacts"])
def extract_reply_data(req: ExtractReplyRequest):
    """
    Heuristically extracts quoted price, currency, MOQ, and lead time from raw reply text for user review.
    """
    return ContactService.extract_quotation_data(req.reply_text)

@app.post("/api/contacts/extract-public-contact", response_model=PublicContactExtractResponse, tags=["Contacts"])
async def extract_supplier_public_contact(extract_req: PublicContactExtractRequest):
    """
    Extracts publicly listed business email address and phone number for a supplier product listing.
    Inspects product listing page, official contact/about pages, and verified domain metadata.
    Never fabricates details. Distinguishes Manufacturer from Supplier/Seller where applicable.
    """
    res = await ContactService.extract_public_contact(extract_req.model_dump())
    return PublicContactExtractResponse(**res)

@app.post("/api/inquiry/generate", response_model=InquiryGenerateResponse, tags=["Contacts"])
def generate_dealer_inquiry(inq_req: InquiryGenerateRequest):
    req = None
    if inq_req.requirement_id and inq_req.requirement_id not in ["TEMP-REQ", "REQ-SEARCH", "REQ-INQUIRY", "REQ-N/A"]:
        req = excel_svc.get_requirement_by_id(inq_req.requirement_id)
    
    if not req:
        # Check if an existing requirement in Excel matches product_name
        if inq_req.product_name:
            all_reqs = excel_svc.get_all_requirements()
            p_lower = inq_req.product_name.strip().lower()
            for r in all_reqs:
                if r.get("product_name", "").lower() == p_lower or p_lower in r.get("product_name", "").lower():
                    req = r
                    break
        
        # If still not found, construct a safe draft requirement using provided product information
        if not req:
            req = {
                "requirement_id": inq_req.requirement_id or "REQ-INQUIRY",
                "product_name": inq_req.product_name or "Industrial Component",
                "category": inq_req.category or "Industrial Components",
                "specifications": inq_req.specifications or "",
                "quantity": inq_req.quantity,
                "target_price": inq_req.target_price,
                "currency": inq_req.currency or "USD",
                "delivery_requirement": inq_req.delivery_requirement,
                "material": None,
                "size": None,
                "grade": None,
                "model": None
            }

    dealer = None
    if inq_req.dealer_id and inq_req.dealer_id not in ["TEMP-DLR", "DLR-SEARCH", "DLR-NEW"]:
        dealer = excel_svc.get_dealer_by_id(inq_req.dealer_id)

    if not dealer:
        # If supplier is not in Excel yet (e.g. newly discovered live search / IndiaMART listing),
        # generate a safe draft using available product/supplier information, leaving unknown contacts blank
        dealer_display_name = inq_req.supplier_name or inq_req.dealer_name or "Supplier Representative"
        dealer = {
            "dealer_id": inq_req.dealer_id or "TEMP-DLR",
            "dealer_name": dealer_display_name,
            "product_name": inq_req.product_name or req.get("product_name", "Industrial Part"),
            "specifications": inq_req.specifications or req.get("specifications", ""),
            "business_email": inq_req.business_email,
            "public_contact_number": inq_req.public_contact_number,
            "product_url": inq_req.product_url,
            "image_url": inq_req.image_url,
            "model": inq_req.model,
            "brand": inq_req.brand,
            "source_portal": "Live Web Search",
            "verification_status": "Unverified"
        }
    else:
        if inq_req.image_url and not dealer.get("image_url"):
            dealer["image_url"] = inq_req.image_url
        if inq_req.model and not dealer.get("model"):
            dealer["model"] = inq_req.model
        if inq_req.brand and not dealer.get("brand"):
            dealer["brand"] = inq_req.brand

    if inq_req.model and not req.get("model"):
        req["model"] = inq_req.model
    if inq_req.brand and not req.get("brand"):
        req["brand"] = inq_req.brand
    if inq_req.target_price is not None:
        req["target_price"] = inq_req.target_price
    if inq_req.quantity is not None:
        req["quantity"] = inq_req.quantity

    generated = ContactService.generate_inquiry_message(
        requirement=req,
        dealer=dealer,
        sender_name=inq_req.sender_name or "Procurement Department",
        sender_company=inq_req.sender_company or "Apex Manufacturing Corp.",
        custom_notes=inq_req.custom_notes
    )
    return InquiryGenerateResponse(**generated)

# ----------------- Quotation Comparison -----------------
@app.post("/api/quotations/compare", response_model=QuotationCompareResponse, tags=["Quotations"])
def compare_quotations(compare_req: QuotationCompareRequest):
    req = excel_svc.get_requirement_by_id(compare_req.requirement_id)
    if not req:
        raise HTTPException(status_code=404, detail=f"Requirement '{compare_req.requirement_id}' not found.")

    # Fetch dealers for requirement
    all_dealers = excel_svc.get_all_dealers(requirement_id=compare_req.requirement_id)
    if compare_req.dealer_ids:
        filter_ids = {d.lower() for d in compare_req.dealer_ids}
        dealers_to_compare = [d for d in all_dealers if d["dealer_id"].lower() in filter_ids]
    else:
        dealers_to_compare = all_dealers

    if not dealers_to_compare:
        raise HTTPException(status_code=400, detail="No dealers available for comparison for this requirement.")

    qty = req.get("quantity") or 1.0
    target_price = req.get("target_price") or 0.0

    comparison_items: List[QuotationComparisonItem] = []
    candidates_for_recommendation = []

    for idx, d in enumerate(dealers_to_compare, start=1):
        cmp_id = f"CMP-{datetime.now().strftime('%m%d')}-{idx:03d}"
        
        # Effective unit price: confirmed quote has priority over listed price
        unit_price = d.get("confirmed_quoted_price") if d.get("confirmed_quoted_price") is not None else d.get("listed_price")
        taxes = d.get("taxes")
        delivery_charges = d.get("delivery_charges")

        # Cost calculation logic
        has_unconfirmed = False
        est_total = None

        if unit_price is not None:
            subtotal = unit_price * qty
            # Check if taxes and shipping are fully known
            if taxes is not None and delivery_charges is not None:
                est_total = round(subtotal + taxes + delivery_charges, 2)
                has_unconfirmed = False
            else:
                has_unconfirmed = True
                t_val = taxes if taxes is not None else 0.0
                d_val = delivery_charges if delivery_charges is not None else 0.0
                est_total = round(subtotal + t_val + d_val, 2)
        else:
            has_unconfirmed = True

        # Intelligent Multi-factor Recommendation Scoring
        # Combines Spec Match (40%), Price Competitiveness (30%), Lead Time (15%), Verification (15%)
        score = 0.0
        match_status = d.get("match_status", "Needs Verification")
        if match_status == "Exact Match":
            score += 40.0
        elif match_status == "Partial Match":
            score += 25.0
        elif match_status == "Needs Verification":
            score += 15.0
        else:
            score += 0.0

        if unit_price and target_price > 0:
            price_ratio = target_price / unit_price
            price_score = min(max(price_ratio * 30.0, 0.0), 35.0)
            score += price_score

        # Lead time score
        req_lead = req.get("delivery_requirement")
        dlr_lead = d.get("delivery_time")
        if dlr_lead and req_lead:
            score += 15.0
        elif dlr_lead:
            score += 10.0

        # Verification score
        if d.get("verification_status") == "Verified":
            score += 15.0
        elif d.get("verification_status") == "Pending Verification":
            score += 7.0

        item = QuotationComparisonItem(
            comparison_id=cmp_id,
            requirement_id=req["requirement_id"],
            dealer_id=d["dealer_id"],
            dealer_name=d["dealer_name"],
            unit_price=unit_price,
            quantity=qty,
            taxes=taxes,
            delivery_charges=delivery_charges,
            estimated_total_cost=est_total,
            has_unconfirmed_costs=has_unconfirmed,
            currency=req.get("currency", "USD"),
            moq=d.get("moq"),
            delivery_time=d.get("delivery_time"),
            match_status=match_status,
            verification_status=d.get("verification_status", "Pending Verification"),
            comparison_notes=d.get("match_reason"),
            recommendation_score=round(score, 1)
        )
        comparison_items.append(item)

        # Log comparison record to Excel
        excel_svc.save_comparison_record({
            "Comparison_ID": cmp_id,
            "Requirement_ID": req["requirement_id"],
            "Dealer_ID": d["dealer_id"],
            "Unit_Price": unit_price,
            "Quantity": qty,
            "Taxes": taxes,
            "Delivery_Charges": delivery_charges,
            "Estimated_Total_Cost": est_total,
            "Currency": req.get("currency", "USD"),
            "MOQ": d.get("moq"),
            "Delivery_Time": d.get("delivery_time"),
            "Match_Status": match_status,
            "Comparison_Notes": d.get("match_reason")
        })

    # Pick recommended supplier based on highest comprehensive score
    best_candidate = max(comparison_items, key=lambda c: (c.recommendation_score or 0))
    rec_summary = (
        f"Recommended Supplier: '{best_candidate.dealer_name}' (Overall Score: {best_candidate.recommendation_score}/100). "
        f"Evaluated on technical specification conformance ({best_candidate.match_status}), commercial price competitiveness, "
        f"delivery lead time ({best_candidate.delivery_time or 'Standard'}), and supplier verification."
    )

    return QuotationCompareResponse(
        requirement=RequirementResponse(**req),
        comparisons=comparison_items,
        recommended_dealer_id=best_candidate.dealer_id,
        recommendation_summary=rec_summary
    )

@app.get("/api/quotations", tags=["Quotations"])
def list_quotation_comparisons(requirement_id: Optional[str] = Query(None)):
    return excel_svc.get_comparisons(requirement_id=requirement_id)

# ----------------- Excel Exports -----------------
@app.get("/api/export/dealers", tags=["Exports"])
def export_dealers(requirement_id: Optional[str] = Query(None)):
    try:
        wb = excel_svc.export_dealers_workbook(requirement_id=requirement_id)
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)
        
        filename = f"Dealer_Results_Export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@app.get("/api/export/requirements", tags=["Exports"])
def export_requirements():
    try:
        wb = excel_svc.export_requirements_workbook()
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)

        filename = f"Manufacturing_Requirements_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@app.get("/api/export/comparison", tags=["Exports"])
def export_comparison(requirement_id: str = Query(...)):
    try:
        req = excel_svc.get_requirement_by_id(requirement_id)
        if not req:
            raise HTTPException(status_code=404, detail=f"Requirement '{requirement_id}' not found.")
        
        dealers = excel_svc.get_all_dealers(requirement_id=requirement_id)
        comp_items = []
        qty = req.get("quantity") or 1.0

        for d in dealers:
            unit_price = d.get("confirmed_quoted_price") if d.get("confirmed_quoted_price") is not None else d.get("listed_price")
            taxes = d.get("taxes")
            delivery = d.get("delivery_charges")
            has_unconf = (taxes is None or delivery is None or unit_price is None)
            est_total = (unit_price * qty + (taxes or 0) + (delivery or 0)) if unit_price is not None else None
            
            comp_items.append({
                "requirement_id": requirement_id,
                "dealer_id": d["dealer_id"],
                "dealer_name": d["dealer_name"],
                "unit_price": unit_price,
                "quantity": qty,
                "taxes": taxes,
                "delivery_charges": delivery,
                "estimated_total_cost": est_total,
                "has_unconfirmed_costs": has_unconf,
                "currency": req.get("currency", "USD"),
                "moq": d.get("moq"),
                "delivery_time": d.get("delivery_time"),
                "match_status": d.get("match_status"),
                "verification_status": d.get("verification_status"),
                "recommendation_notes": d.get("match_reason")
            })

        wb = excel_svc.export_comparison_workbook(requirement_id=requirement_id, comparisons=comp_items)
        stream = io.BytesIO()
        wb.save(stream)
        stream.seek(0)

        filename = f"Quotation_Comparison_{requirement_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison export failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
