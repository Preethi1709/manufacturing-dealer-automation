import pytest
from fastapi.testclient import TestClient
import os
import sys
import uuid
from datetime import datetime

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["excel_storage"] is True

def test_dashboard_metrics():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["total_products_submitted"] >= 4
    assert data["total_dealers_discovered"] >= 6
    assert data["exact_matches"] >= 1
    assert "recent_searches" in data
    assert "recent_dealer_activities" in data

def test_list_requirements():
    response = client.get("/api/requirements")
    assert response.status_code == 200
    reqs = response.json()
    assert len(reqs) >= 4
    assert reqs[0]["requirement_id"].startswith("REQ-")

def test_create_and_get_requirement():
    payload = {
        "product_name": "Hardened Linear Guide Rails 20mm",
        "category": "Linear Motion",
        "specifications": "High precision linear guide rail, length 1000mm, with 2 runner blocks",
        "material": "Bearing Steel GCr15 / 52100",
        "size": "20mm x 1000mm",
        "grade": "Precision Class H",
        "model": "HGR20-1000",
        "quantity": 100,
        "target_price": 45.0,
        "currency": "USD",
        "preferred_location": "USA",
        "delivery_requirement": "14 days",
        "additional_requirements": "Pre-lubricated with synthetic grease."
    }
    create_res = client.post("/api/requirements", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    req_id = created["requirement_id"]
    assert req_id.startswith("REQ-")

    get_res = client.get(f"/api/requirements/{req_id}")
    assert get_res.status_code == 200
    assert get_res.json()["product_name"] == payload["product_name"]

def test_search_dealers():
    # Test directory search with requirement_id
    payload = {
        "requirement_id": "REQ-2025-101",
        "portal": "local_directory",
        "max_results": 5
    }
    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["results_count"] >= 1
    assert len(data["results"]) >= 1

def test_search_by_product_name():
    # Test direct product-name search (reused by image-based search workflow)
    payload = {
        "product_name": "Deep Groove Ball Bearing 6205",
        "portal": "local_directory",
        "max_results": 5
    }
    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["results_count"] >= 1
    assert any("bearing" in r["product_name"].lower() for r in data["results"])

def test_identify_image_endpoint():
    # Test image upload and recognition endpoint
    fake_image_content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB\x00C\x00"
    files = {"file": ("ball_bearing_sample.jpg", fake_image_content, "image/jpeg")}
    res = client.post("/api/search/identify-image", files=files)
    assert res.status_code == 200
    data = res.json()
    assert "product_name" in data
    assert "confidence" in data
    assert "Deep Groove Ball Bearing" in data["product_name"]

def test_external_search_without_key():
    payload = {
        "requirement_id": "REQ-2025-101",
        "portal": "thomasnet",
        "max_results": 5
    }
    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "CONFIG_REQUIRED"
    assert "THOMASNET_API_KEY" in data["error_message"]

def test_tavily_search_missing_key(monkeypatch):
    # Test that Tavily search returns CONFIG_REQUIRED when key is empty
    monkeypatch.setenv("TAVILY_API_KEY", "")
    payload = {
        "product_name": "Stainless Steel Precision Shaft",
        "portal": "live_web",
        "max_results": 5
    }
    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "CONFIG_REQUIRED"
    assert "TAVILY_API_KEY" in data["error_message"]
    assert data["results_count"] == 0

def test_tavily_search_mocked_success(monkeypatch):
    from unittest.mock import MagicMock
    import httpx

    # Set mock key
    monkeypatch.setenv("TAVILY_API_KEY", "tvly-test-mock-key")

    mock_tavily_response = {
        "query": "Deep Groove Ball Bearing 6205-2RS",
        "results": [
            {
                "title": "NTN Bearing Corp - Deep Groove Ball Bearings 6205-2RS",
                "url": "https://www.ntnamericas.com/products/6205-2rs",
                "content": "Deep groove ball bearing with rubber seals, Chrome Steel GCr15, 25mm bore x 52mm OD x 15mm width, dynamic load rating 14.8 kN.",
                "score": 0.95
            },
            {
                "title": "Motion Industries - Radial Ball Bearings 6205 2RS",
                "url": "https://www.motion.com/products/sku/0019283",
                "content": "Industrial power transmission bearing, single row, rubber contact seals on both sides.",
                "score": 0.91
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_tavily_response

    orig_post = httpx.Client.post
    def mock_post(self, url, **kwargs):
        if "api.tavily.com" in str(url):
            return mock_resp
        return orig_post(self, url, **kwargs)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    payload = {
        "product_name": "Deep Groove Ball Bearing 6205-2RS",
        "portal": "live_web",
        "max_results": 5
    }
    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["results_count"] == 2
    assert len(data["results"]) == 2

    first = data["results"][0]
    assert "ntnamericas.com" in first["product_url"]
    assert first["source_portal"] == "Live Web (Tavily)"
    assert first["verification_status"] == "Unverified"
    assert first["listed_price"] is None  # Safeguard: never invent missing price
    assert "Discovered via live web search" in first["match_reason"]

def test_build_industrial_search_query_temperature_scanner():
    from supplier_search import build_industrial_search_query

    req = {
        "product_name": "Digital Automatic Temperature Scanner",
        "category": "Process Instrumentation & Controls",
        "specifications": "Multi-channel digital temperature scanner with 16 display channels and rear sensor-input terminals, RTD Pt100 / Thermocouple"
    }

    query = build_industrial_search_query(req)

    # 1. Simplified, focused core query
    assert "temperature scanner" in query or "temperature indicator" in query

    # 2. Reliable channel detection from specifications
    assert '"16 channel"' in query

    # 3. Input specifications incorporated
    assert "RTD" in query or "thermocouple" in query

    # 4. Product page / manufacturer catalogue intent prioritized
    assert "manufacturer" in query or "catalog" in query or "datasheet" in query

    # 5. Negative exclusions to prevent retail barcode scanners
    assert "-barcode" in query

def test_matching_service_temperature_scanner_vs_sensor_probes():
    from matching_service import MatchingService

    req = {
        "product_name": "Digital Automatic Temperature Scanner",
        "category": "Process Instrumentation & Controls",
        "specifications": "Multi-channel digital temperature scanner with multiple display channels and rear sensor-input terminals"
    }

    # Case A: Actual Multi-Channel Temperature Scanner (e.g. Dwyer Omega DP1001AM)
    omega_scanner = {
        "dealer_name": "Dwyer Omega",
        "product_name": "1/4 DIN 10-Channel Automatic Temperature Scanner | Omega",
        "specifications": "The Omega DP1001AM is a 1/4 DIN, 10-channel automatic temperature scanner designed for multi-point monitoring with RS232.",
        "listed_price": None
    }
    status_omega, reason_omega = MatchingService.evaluate_match(req, omega_scanner)
    assert "Temperature scanner / indicator instrumentation capability confirmed." in reason_omega

    # Case B: Raw Temperature Sensor Probe Catalogue (e.g. Anderson-Negele)
    anderson_catalog = {
        "dealer_name": "Anderson Negele",
        "product_name": "Temperature Sensors - Anderson-Negele Hygienic Sensors",
        "specifications": "Catalog of hygienic RTD and temperature sensor probes for food and pharmaceutical applications.",
        "listed_price": None
    }
    status_anderson, reason_anderson = MatchingService.evaluate_match(req, anderson_catalog)
    assert "represents sensor probes/transmitters rather than a multi-channel temperature scanner instrument" in reason_anderson
    assert status_anderson == "Needs Verification"

    # Case C: Barcode Scanner (irrelevant category)
    barcode_scanner = {
        "dealer_name": "Zebra Technologies",
        "product_name": "Zebra DS3608 Industrial 2D Barcode Scanner",
        "specifications": "Ultra-rugged 1D/2D handheld corded barcode scanner for manufacturing warehouses.",
        "listed_price": 450.0
    }
    status_barcode, reason_barcode = MatchingService.evaluate_match(req, barcode_scanner)
    assert status_barcode == "Not a Match"
    assert "barcode scanner" in reason_barcode.lower()

    # Case D: Unrelated "multi-channel" offering (e.g. TV media network, general power supply)
    # CRITICAL: The word "multi-channel" alone can NEVER establish a product match
    tv_network = {
        "dealer_name": "Multi Channel Network",
        "product_name": "Multi Channel Network Information",
        "specifications": "Joint venture between Foxtel and FOX SPORTS responsible for advertising across 70 television channels.",
        "listed_price": None
    }
    status_tv, reason_tv = MatchingService.evaluate_match(req, tv_network)
    assert status_tv == "Not a Match"
    assert "does not measure or monitor temperature" in reason_tv

def test_tavily_search_temperature_scanner_workflow(monkeypatch):
    from unittest.mock import MagicMock
    import httpx

    monkeypatch.setenv("TAVILY_API_KEY", "tvly-test-mock-key")

    mock_tavily_scanner_response = {
        "query": '("temperature scanner" OR "temperature indicator") "multi-channel"',
        "results": [
            {
                "title": "1/4 DIN 10-Channel Automatic Temperature Scanner | Omega",
                "url": "https://www.dwyeromega.com/en-us/1-4-din-10-channel-automatic-temperature-scanner/p/DP1001AM-Series",
                "content": "The Omega DP1001AM is a 1/4 DIN, 10-channel automatic temperature scanner designed for multi-point monitoring.",
                "score": 0.96
            },
            {
                "title": "Multi-Channel Temperature Scanner PMD-MXT | HGSI",
                "url": "https://www.hgsind.com/product/pmd-mxt-8-16-24-or-32-channel-digital-temperature-scanner-universal-thermocouple",
                "content": "8, 16, 24, or 32 channel digital temperature scanner with universal thermocouple inputs and rear terminal connections.",
                "score": 0.94
            },
            {
                "title": "Temperature Sensors | Anderson-Negele",
                "url": "https://www.anderson-negele.com/us/p/temperature-sensors",
                "content": "Hygienic RTD temperature sensor probes for dairy and sanitary applications.",
                "score": 0.80
            },
            {
                "title": "Multi Channel Network Information",
                "url": "https://rocketreach.co/multi-channel-network-profile",
                "content": "Television advertising joint venture across Foxtel channels.",
                "score": 0.10
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_tavily_scanner_response

    orig_post = httpx.Client.post
    def mock_post(self, url, **kwargs):
        if "api.tavily.com" in str(url):
            return mock_resp
        return orig_post(self, url, **kwargs)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    payload = {
        "product_name": "Digital Automatic Temperature Scanner",
        "category": "Process Instrumentation & Controls",
        "specifications": "Multi-channel digital temperature scanner with multiple display channels and rear sensor-input terminals",
        "portal": "live_web",
        "max_results": 10
    }

    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    
    # Non-supplier noise (rocketreach) should be excluded
    assert all("rocketreach.co" not in r["product_url"] for r in data["results"])

    # All discovered suppliers must be Unverified and have no fabricated pricing
    for item in data["results"]:
        assert item["verification_status"] == "Unverified"
        assert item["listed_price"] is None
        assert "Live Web" in item["source_portal"]

    # Genuine multi-channel scanners must be confirmed
    top_result = data["results"][0]
    assert "dwyeromega.com" in top_result["product_url"] or "hgsind.com" in top_result["product_url"]
    assert "instrumentation capability confirmed" in top_result["match_reason"]

def test_quotation_comparison():
    payload = {
        "requirement_id": "REQ-2025-101"
    }
    res = client.post("/api/quotations/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "comparisons" in data
    assert len(data["comparisons"]) >= 1
    assert data["recommended_dealer_id"] is not None

def test_inquiry_generation():
    payload = {
        "requirement_id": "REQ-2025-101",
        "dealer_id": "DLR-1001",
        "sender_name": "Procurement Lead",
        "sender_company": "Apex Manufacturing Corp."
    }
    res = client.post("/api/inquiry/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["subject"] == "Inquiry for Stainless Steel Precision Shaft SS316L"
    assert "Dear Apex Precision CNC Machining Ltd. Team," in data["message"]
    assert "Greetings from Apex Manufacturing Corp." in data["message"]
    assert "Product: Stainless Steel Precision Shaft SS316L" in data["message"]
    assert "Quantity: 500 units" in data["message"]
    assert "Target Price: $20.00" in data["message"]
    assert "Please share your quotation and availability." in data["message"]

def test_inquiry_generation_new_search_supplier_regression():
    """
    Regression test: Verifies that opening Contact Supplier / RFQ Outreach
    for a newly discovered web search result (e.g. IndiaMART listing with dealer_id='TEMP-DLR')
    does not fail with HTTP 404, but generates a customized formal RFQ draft.
    """
    payload = {
        "requirement_id": "REQ-2025-101",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "Swastik SCN-968 8 Channel Temperature Scanner",
        "sender_name": "Industrial Procurement Team",
        "sender_company": "Apex Manufacturing Corp.",
        "custom_notes": "Please include technical datasheet and quotation."
    }
    res = client.post("/api/inquiry/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["subject"] == "Inquiry for Stainless Steel Precision Shaft SS316L"
    assert "Dear Swastik SCN-968 8 Channel Temperature Scanner Team," in data["message"]
    assert "Notes: Please include technical datasheet and quotation." in data["message"]
    assert data["dealer_name"] == "Swastik SCN-968 8 Channel Temperature Scanner"
    # Unknown contact details must clearly remain blank
    assert data["business_email"] is None
    assert data["public_contact_number"] is None

def test_inquiry_generation_adhoc_search_requirement_regression():
    """
    Regression test: Verifies that RFQ generation succeeds even when initiated
    from an ad-hoc search without an existing requirement_id in Excel.
    """
    payload = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "Radix Instruments",
        "product_name": "Digital Automatic Temperature Scanner",
        "category": "Process Instrumentation & Monitoring",
        "specifications": "16-channel digital scanner with RTD Pt100 inputs",
        "sender_name": "Industrial Procurement Team",
        "sender_company": "Apex Manufacturing Corp."
    }
    res = client.post("/api/inquiry/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["subject"] == "Inquiry for Digital Automatic Temperature Scanner"
    assert "Dear Radix Instruments Team," in data["message"]
    assert "Product: Digital Automatic Temperature Scanner" in data["message"]
    assert "Specifications: 16-channel digital scanner with RTD Pt100 inputs" in data["message"]

def test_inquiry_generation_all_fields_present():
    payload = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "Multispan Control Instruments",
        "product_name": "Multi-Channel Temperature Scanner",
        "model": "MS-801",
        "brand": "Multispan",
        "specifications": "8-channel universal input RTD Pt100/Thermocouple, 230V AC",
        "target_price": 125.50,
        "currency": "USD",
        "quantity": 10,
        "image_url": "https://5.imimg.com/data5/SELLER/Default/scanner_ms801.jpg",
        "sender_company": "Apex Manufacturing Corp."
    }
    res = client.post("/api/inquiry/generate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["subject"] == "Inquiry for Multi-Channel Temperature Scanner"
    msg = data["message"]
    assert "Dear Multispan Control Instruments Team," in msg
    assert "Greetings from Apex Manufacturing Corp." in msg
    assert "Product: Multi-Channel Temperature Scanner" in msg
    assert "Model / Brand: MS-801 / Multispan" in msg or "Model / Brand: MS-801" in msg
    assert "Specifications: 8-channel universal input RTD Pt100/Thermocouple, 230V AC" in msg
    assert "Target Price: $125.50" in msg
    assert "Quantity: 10 units" in msg
    assert "Product Image: https://5.imimg.com/data5/SELLER/Default/scanner_ms801.jpg" in msg
    assert "Please share your quotation and availability." in msg
    assert "Thank you,\nApex Manufacturing Corp." in msg

def test_inquiry_generation_missing_price():
    payload = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "Radix Electrosystems",
        "product_name": "Temperature Scanner 16 Channel",
        "quantity": 5,
        "target_price": None,
        "sender_company": "Apex Manufacturing Corp."
    }
    res = client.post("/api/inquiry/generate", json=payload)
    assert res.status_code == 200
    msg = res.json()["message"]
    assert "Target Price" not in msg
    assert "Quantity: 5 units" in msg
    assert "Product: Temperature Scanner 16 Channel" in msg

def test_inquiry_generation_missing_image():
    payload = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "Radix Electrosystems",
        "product_name": "Temperature Scanner 16 Channel",
        "image_url": None,
        "sender_company": "Apex Manufacturing Corp."
    }
    res = client.post("/api/inquiry/generate", json=payload)
    assert res.status_code == 200
    msg = res.json()["message"]
    assert "Product Image:" not in msg

def test_inquiry_greeting_cleanup_indiamart():
    # 1. Pure portal name should fall back to 'Supplier'
    payload1 = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "IndiaMART",
        "product_name": "Temperature Indicator"
    }
    res1 = client.post("/api/inquiry/generate", json=payload1)
    assert "Dear Supplier Team," in res1.json()["message"]
    assert "Dear IndiaMART Team," not in res1.json()["message"]
    assert "Dear Indiamart Team," not in res1.json()["message"]

    # 2. IndiaMART Supplier prefix should be cleaned to actual supplier name
    payload2 = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "IndiaMART Supplier - Multispan Instruments",
        "product_name": "Digital Indicator"
    }
    res2 = client.post("/api/inquiry/generate", json=payload2)
    assert "Dear Multispan Instruments Team," in res2.json()["message"]

    # 3. IndiaMART suffix should be cleaned
    payload3 = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "Radix Electrosystems Pvt Ltd | IndiaMART",
        "product_name": "Digital Indicator"
    }
    res3 = client.post("/api/inquiry/generate", json=payload3)
    assert "Dear Radix Electrosystems Pvt Ltd Team," in res3.json()["message"]

def test_inquiry_rejects_user_uploaded_reference_image():
    # User's local file or reference upload should NEVER be used as supplier's product image
    payload = {
        "requirement_id": "REQ-SEARCH",
        "dealer_id": "TEMP-DLR",
        "supplier_name": "Test Supplier",
        "product_name": "Temperature Sensor",
        "image_url": "C:/Users/Nunes/.gemini/antigravity/brain/reference.png"
    }
    res = client.post("/api/inquiry/generate", json=payload)
    assert res.status_code == 200
    assert "Product Image:" not in res.json()["message"]

def test_export_dealers():
    res = client.get("/api/export/dealers")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(res.content) > 1000

def test_export_requirements():
    res = client.get("/api/export/requirements")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert len(res.content) > 1000


# =====================================================================
# Supplier Contact Automation, Email/WhatsApp, Contact Log Tests
# =====================================================================
from email_service import EmailService
from whatsapp_service import WhatsAppService
from contact_service import ContactService

def test_email_service_validation():
    # Valid emails
    valid, cleaned = EmailService.validate_email("procurement@supplier-ind.com")
    assert valid is True
    assert cleaned == "procurement@supplier-ind.com"

    valid, cleaned = EmailService.validate_email("sales.rep+rfq@company.co.uk")
    assert valid is True

    # Invalid emails
    valid, err = EmailService.validate_email("not-an-email")
    assert valid is False
    assert "Invalid email format" in err

    valid, err = EmailService.validate_email("@missinguser.com")
    assert valid is False

    valid, err = EmailService.validate_email(None)
    assert valid is False

def test_email_service_unconfigured_safeguard(monkeypatch):
    # Ensure SMTP credentials are empty
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("SMTP_USER", raising=False)
    monkeypatch.delenv("SMTP_PASSWORD", raising=False)
    monkeypatch.delenv("SMTP_FROM_EMAIL", raising=False)

    assert EmailService.is_configured() is False
    res = EmailService.send_rfq_email(
        recipient_email="test@supplier.com",
        subject="RFQ Inquiry",
        message_body="Please provide quotation."
    )
    assert res["success"] is False
    assert res["status"] == "CONFIG_REQUIRED"
    assert "not configured" in res["error"]

def test_email_service_mocked_smtp_send(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.office365.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "procurement@apexcorp.com")
    monkeypatch.setenv("SMTP_PASSWORD", "SuperSecretPW123")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "procurement@apexcorp.com")
    monkeypatch.setenv("SMTP_TLS", "true")

    # Mock smtplib.SMTP
    class MockSMTP:
        def __init__(self, host, port, timeout=15):
            self.host = host
            self.port = port
        def __enter__(self):
            return self
        def __exit__(self, exc_type, exc_val, exc_tb):
            pass
        def starttls(self):
            pass
        def login(self, user, password):
            pass
        def send_message(self, msg):
            pass

    import smtplib
    monkeypatch.setattr(smtplib, "SMTP", MockSMTP)

    res = EmailService.send_rfq_email(
        recipient_email="estimating@verifiedsupplier.com",
        subject="RFQ: Hardened Guide Rails",
        message_body="Specification details attached.",
        sender_name="Apex Purchasing"
    )

    assert res["success"] is True
    assert res["status"] == "Sent/Accepted"
    assert res["provider_message_id"].startswith("rfq-")
    assert res["recipient"] == "estimating@verifiedsupplier.com"

def test_whatsapp_service_validation():
    # Valid E.164 phones
    valid, digits, err = WhatsAppService.validate_phone_number("+1 (555) 234-5678")
    assert valid is True
    assert digits == "15552345678"

    valid, digits, err = WhatsAppService.validate_phone_number("+91-98765-43210")
    assert valid is True
    assert digits == "919876543210"

    # Indian numbers without explicit +
    valid, digits, err = WhatsAppService.validate_phone_number("9876543210")
    assert valid is True
    assert digits == "919876543210"

    valid, digits, err = WhatsAppService.validate_phone_number("09876543210")
    assert valid is True
    assert digits == "919876543210"

    valid, digits, err = WhatsAppService.validate_phone_number("919876543210")
    assert valid is True
    assert digits == "919876543210"

    valid, digits, err = WhatsAppService.validate_phone_number("+9109876543210")
    assert valid is True
    assert digits == "919876543210"

    valid, digits, err = WhatsAppService.validate_phone_number("00919876543210")
    assert valid is True
    assert digits == "919876543210"

    # Invalid phones
    valid, _, err = WhatsAppService.validate_phone_number("123")
    assert valid is False
    assert "Invalid phone format" in err

    valid, _, err = WhatsAppService.validate_phone_number("phone-number")
    assert valid is False

    valid, _, err = WhatsAppService.validate_phone_number("")
    assert valid is False

def test_whatsapp_service_wa_link_generation():
    message = "Hello, please provide quotation for Part #REQ-101.\nTarget Price: $120.00"
    link = WhatsAppService.generate_wa_link("+91-98765-43210", message)
    # Must use format https://wa.me/INTERNATIONAL_NUMBER?text=ENCODED_MESSAGE
    # Phone number must contain digits only, including country code, with no '+', spaces, or hyphens
    assert link.startswith("https://wa.me/919876543210?text=")
    assert "+" not in link.split("?")[0]
    assert "%20" in link or "+" in link
    assert "%0A" in link  # Newline encoded

def test_whatsapp_empty_message_rejected():
    res = WhatsAppService.send_rfq_message("+91-98765-43210", "   ")
    assert res["success"] is False
    assert "empty" in res["error"].lower()

def test_whatsapp_service_unconfigured_draft_fallback(monkeypatch):
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_ID", raising=False)
    monkeypatch.delenv("WHATSAPP_ACCESS_TOKEN", raising=False)

    assert WhatsAppService.is_cloud_api_configured() is False
    res = WhatsAppService.send_rfq_message(
        recipient_phone="+15559876543",
        message_body="Hello, requesting quotation."
    )
    assert res["success"] is True
    assert res["status"] == "Draft / Link Opened"
    assert res["is_draft_link"] is True
    assert "wa.me/15559876543" in res["wa_link"]
    # Never claim automated delivery when only link is generated
    assert res["provider_message_id"] is None

def test_whatsapp_service_mocked_cloud_api(monkeypatch):
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "10987654321")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "meta_cloud_token_secret")

    class MockResponse:
        status_code = 200
        def json(self):
            return {
                "messaging_product": "whatsapp",
                "contacts": [{"input": "15559876543", "wa_id": "15559876543"}],
                "messages": [{"id": "wamid.HBgLMTU1NTk4NzY1NDMVAgARGBI1"}]
            }

    import httpx
    monkeypatch.setattr(httpx.Client, "post", lambda self, url, **kwargs: MockResponse())

    res = WhatsAppService.send_rfq_message(
        recipient_phone="+1 (555) 987-6543",
        message_body="Official RFQ transmission"
    )
    assert res["success"] is True
    assert res["status"] == "Sent/Accepted"
    assert res["is_draft_link"] is False
    assert res["provider_message_id"] == "wamid.HBgLMTU1NTk4NzY1NDMVAgARGBI1"

def test_api_send_email_approval_and_duplicate_prevention(monkeypatch):
    # 1. Unapproved must fail with 400
    unapproved_payload = {
        "requirement_id": "REQ-2025-101",
        "dealer_id": "DLR-1001",
        "supplier_name": "Apex Precision CNC",
        "product_name": "Linear Guide Rails",
        "recipient_email": "sales@apexcnc.com",
        "subject": "RFQ Guide Rails",
        "message_body": "Please quote.",
        "approved": False
    }
    res = client.post("/api/contacts/send-email", json=unapproved_payload)
    assert res.status_code == 400
    assert "confirmation is required" in res.json()["detail"]

    # 2. Approved send with mocked EmailService
    monkeypatch.setattr(
        EmailService,
        "send_rfq_email",
        lambda **kwargs: {
            "success": True,
            "status": "Sent/Accepted",
            "provider_message_id": "rfq-test-unit-001@smtp.local",
            "timestamp": datetime.now().isoformat(),
            "error": None
        }
    )

    test_email = f"unique_{uuid.uuid4().hex[:8]}@apexcnc.com"
    approved_payload = dict(unapproved_payload, approved=True, recipient_email=test_email)
    send_res = client.post("/api/contacts/send-email", json=approved_payload)
    assert send_res.status_code == 200
    data = send_res.json()
    assert data["success"] is True
    assert data["status"] == "Sent/Accepted"
    assert data["provider_message_id"] == "rfq-test-unit-001@smtp.local"
    assert data["contact"]["contact_id"].startswith("CNT-")

    # 3. Duplicate send within 5 minutes must be blocked
    dup_res = client.post("/api/contacts/send-email", json=approved_payload)
    assert dup_res.status_code == 400
    assert "Duplicate send prevented" in dup_res.json()["detail"]

def test_api_send_whatsapp_and_draft_logging():
    payload = {
        "requirement_id": "REQ-2025-101",
        "dealer_id": "DLR-1001",
        "supplier_name": "Apex Precision CNC",
        "product_name": "Linear Guide Rails",
        "recipient_phone": "+1-555-432-1098",
        "message_body": "Formal RFQ: Linear Guide Rails 1000mm length",
        "approved": True
    }
    res = client.post("/api/contacts/send-whatsapp", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "Draft / Link Opened"
    assert "wa.me/15554321098" in data["wa_link"]
    assert data["contact"]["contact_method"] == "WhatsApp"
    assert data["contact"]["recipient_contact"] == "+15554321098"

def test_record_supplier_reply_and_quotation():
    # 1. Fetch existing contact or create one
    contacts = client.get("/api/contacts").json()
    assert len(contacts) > 0
    target_contact_id = contacts[-1]["contact_id"]

    # 2. Record reply with quotation values
    reply_payload = {
        "supplier_response": "Thank you for the RFQ. We can supply the linear guide rails at $42.00 per unit with MOQ of 25 units. Lead time is 10 days.",
        "response_date": "2026-10-29",
        "quoted_price": 42.0,
        "currency": "USD",
        "moq": 25.0,
        "delivery_time": "10 days",
        "quotation_validity": "30 days",
        "technical_details": "Precision Class H, pre-lubricated with synthetic grease.",
        "next_follow_up_date": "2026-11-05",
        "notes": "Excellent commercial offer below target budget."
    }

    res = client.post(f"/api/contacts/{target_contact_id}/record-reply", json=reply_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["communication_status"] == "Quotation Received"
    assert data["quoted_price"] == 42.0
    assert data["moq"] == 25.0
    assert data["delivery_time"] == "10 days"
    assert data["dealer_response"] == reply_payload["supplier_response"]

def test_extract_reply_data():
    raw_text = "Hello Apex team, unit price is $85.50 / piece for MOQ 100 pcs. Delivery time 2-3 weeks from PO confirmation."
    res = client.post("/api/contacts/extract-reply-data", json={"reply_text": raw_text})
    assert res.status_code == 200
    extracted = res.json()
    assert extracted["quoted_price"] == 85.50
    assert extracted["currency"] == "USD"
    assert extracted["moq"] == 100.0
    assert "2-3 weeks" in extracted["delivery_time"]

def test_followup_metrics():
    res = client.get("/api/contacts/followup-metrics")
    assert res.status_code == 200
    data = res.json()
    assert "due_today" in data
    assert "overdue" in data
    assert "waiting_response" in data
    assert "reply_received" in data
    assert "quotation_received" in data
    assert "failed_attempts" in data
    assert "closed" in data
    assert data["total"] >= 1

def test_exact_product_search_with_indiamart_and_images(monkeypatch):
    from unittest.mock import MagicMock
    import httpx

    monkeypatch.setenv("TAVILY_API_KEY", "tvly-test-mock-key")

    mock_response = {
        "query": '("temperature scanner" OR "temperature indicator") "16 channel"',
        "images": [
            "https://5.imimg.com/data5/SELLER/Default/scanner-16ch.jpg",
            "https://www.omega.com/images/omega-dp1001am.png"
        ],
        "results": [
            {
                "title": "16 Channel Temperature Scanner Model DP1001AM | Omega",
                "url": "https://www.dwyeromega.com/en-us/16-channel-temperature-scanner/p/DP1001AM-Series",
                "content": "DP1001AM 16-channel digital temperature scanner with universal thermocouple / RTD Pt100 inputs, dual display, DIN panel mount.",
                "score": 0.98
            },
            {
                "title": "Digital Temperature Scanner 16 Channel at Rs 9500 | Radix Instruments",
                "url": "https://www.indiamart.com/proddetail/16-channel-temperature-scanner-28543823488.html",
                "content": "Radix 16-channel digital automatic temperature scanner with multi-point sensor terminal block and RS485 output.",
                "score": 0.95
            },
            {
                "title": "8 Channel Temperature Indicator Model PMD-8 | HGSI",
                "url": "https://www.hgsind.com/product/pmd-8-channel-temperature-indicator",
                "content": "Compact 8 channel digital temperature indicator for thermocouple inputs.",
                "score": 0.82
            }
        ]
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_response

    orig_post = httpx.Client.post
    def mock_post(self, url, **kwargs):
        if "api.tavily.com" in str(url):
            return mock_resp
        return orig_post(self, url, **kwargs)

    monkeypatch.setattr(httpx.Client, "post", mock_post)

    payload = {
        "product_name": "Digital Automatic Temperature Scanner 16 Channel",
        "category": "Process Instrumentation & Monitoring",
        "specifications": "16-channel digital temperature scanner with RTD Pt100 and thermocouple inputs, DIN panel mount",
        "portal": "live_web",
        "max_results": 10
    }

    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["results_count"] == 3

    results = data["results"]
    # Check that candidate images and spec breakdowns are present
    assert any(r["image_url"] for r in results)
    assert any(r["matching_specs"] for r in results)

    # Check IndiaMART product listing
    indiamart_item = next(r for r in results if "indiamart.com" in r["product_url"])
    assert "indiamart.com" in indiamart_item["product_url"]
    assert indiamart_item["location"] == "India"
    assert indiamart_item["verification_status"] == "Unverified"
    assert "IndiaMART Product Page" in indiamart_item["match_reason"]

    # Check that exact 16-channel match ranks before 8-channel variant
    top = results[0]
    assert "16" in top["product_name"] or "16" in top["specifications"]
    assert top["match_status"] in ["Exact Match", "Partial Match"]

def test_vision_service_heuristic_attributes_extraction():
    import asyncio
    from vision_service import VisionService

    # Test offline heuristic recognition of temperature scanner
    res = asyncio.run(VisionService.identify_product_from_image(b"fake_image_bytes", filename="multichannel_temperature_scanner.jpg"))
    assert res["product_name"] == "Digital Automatic Temperature Scanner"
    assert res["category"] == "Process Instrumentation & Monitoring"
    assert res["product_type"] == "Multi-Channel Temperature Scanner / Indicator"
    assert res["model_number"] == "16-CH-SCANNER"
    assert "DIN panel mount" in res["physical_features"]
    assert res["confidence"] >= 0.85

def test_matching_service_product_variant_classification():
    from matching_service import MatchingService

    req = {
        "product_name": "Digital Automatic Temperature Scanner 16 Channel",
        "category": "Process Instrumentation & Monitoring",
        "specifications": "16-channel digital temperature scanner with RTD inputs"
    }

    # Case 1: Exact 16-channel scanner
    exact_candidate = {
        "product_name": "Digital Temperature Scanner 16 Channel",
        "specifications": "16 display channels with universal RTD Pt100 and thermocouple inputs",
        "product_url": "https://www.example.com/product/scanner-16ch"
    }
    res_exact = MatchingService.evaluate_product_match(req, exact_candidate)
    assert any("16 channels" in s for s in res_exact["matching_specs"])

    # Case 2: 8-channel variant (Related Product / variant)
    variant_candidate = {
        "product_name": "Digital Temperature Scanner 8 Channel",
        "specifications": "8 display channels for temperature monitoring",
        "product_url": "https://www.example.com/product/scanner-8ch"
    }
    res_variant = MatchingService.evaluate_product_match(req, variant_candidate)
    assert res_variant["status"] == "Related Product"
    assert any("8 channels vs required 16 channels" in r for r in res_variant["reason"].split(" | "))


# -------------------------------------------------------------
# Tests for Manual Product Entry & Dealer Search Workflow
# -------------------------------------------------------------
def test_manual_product_entry_validation_and_defaults():
    # 1. Product name too short should fail validation
    res_invalid = client.post("/api/requirements", json={"product_name": "A"})
    assert res_invalid.status_code == 422

    # 2. Manual product entry with only product_name should succeed and use defaults
    unique_name = f"Custom Test Pneumatic Actuator {datetime.now().strftime('%M%S%f')[:8]}"
    res_valid = client.post("/api/requirements", json={"product_name": unique_name})
    assert res_valid.status_code == 201
    data = res_valid.json()
    assert data["product_name"] == unique_name
    assert data["category"] == "Industrial Components"
    assert data["quantity"] == 1.0
    assert data["target_price"] == 0.0
    assert data["requirement_id"].startswith("REQ-")


def test_manual_product_entry_excel_persistence_and_unique_ids():
    timestamp = datetime.now().strftime("%M%S%f")[:8]
    p1_name = f"Multi-Channel Scanner Type A {timestamp}"
    p2_name = f"Multi-Channel Scanner Type B {timestamp}"

    # Create requirement 1 with all relevant fields
    payload1 = {
        "product_name": p1_name,
        "category": "Process Instrumentation & Monitoring",
        "specifications": "16-channel universal input RTD/TC scanner with rear terminals",
        "quantity": 5,
        "target_price": 280.0,
        "currency": "USD",
        "delivery_requirement": "10 days"
    }
    res1 = client.post("/api/requirements", json=payload1)
    assert res1.status_code == 201
    req1 = res1.json()

    # Create requirement 2
    payload2 = {
        "product_name": p2_name,
        "category": "Process Instrumentation & Monitoring",
        "specifications": "8-channel compact scanner",
        "quantity": 10,
        "target_price": 180.0,
        "currency": "USD",
        "delivery_requirement": "7 days"
    }
    res2 = client.post("/api/requirements", json=payload2)
    assert res2.status_code == 201
    req2 = res2.json()

    # Verify unique IDs (they must never collide)
    assert req1["requirement_id"] != req2["requirement_id"]

    # Verify Excel persistence via get_requirement_by_id
    get1 = client.get(f"/api/requirements/{req1['requirement_id']}")
    assert get1.status_code == 200
    assert get1.json()["product_name"] == p1_name
    assert get1.json()["specifications"] == payload1["specifications"]
    assert get1.json()["quantity"] == 5.0
    assert get1.json()["target_price"] == 280.0
    assert get1.json()["delivery_requirement"] == "10 days"

    get2 = client.get(f"/api/requirements/{req2['requirement_id']}")
    assert get2.status_code == 200
    assert get2.json()["product_name"] == p2_name


def test_dropdown_refresh_after_saving_manual_product():
    # Simulates what frontend does: save requirement, then call getRequirements() to refresh dropdown
    unique_prod = f"Precision Spherical Roller Bearing {datetime.now().strftime('%M%S%f')[:8]}"
    create_res = client.post("/api/requirements", json={
        "product_name": unique_prod,
        "category": "Bearings & Power Transmission",
        "specifications": "Double row spherical roller bearing, brass cage, 120mm bore"
    })
    assert create_res.status_code == 201
    created_id = create_res.json()["requirement_id"]

    # Refresh requirements list
    list_res = client.get("/api/requirements")
    assert list_res.status_code == 200
    req_list = list_res.json()
    matching = [r for r in req_list if r["requirement_id"] == created_id]
    assert len(matching) == 1
    assert matching[0]["product_name"] == unique_prod
    assert matching[0]["category"] == "Bearings & Power Transmission"


def test_direct_product_search_without_saving():
    # Direct search with manual product name and specifications without saving a requirement first
    initial_reqs = client.get("/api/requirements").json()
    initial_count = len(initial_reqs)

    direct_product = "Deep Groove Ball Bearing 6205-2RS Radial"
    search_payload = {
        "product_name": direct_product,
        "category": "Bearings & Power Transmission",
        "specifications": "25mm bore rubber seals",
        "portal": "local_directory",
        "max_results": 5
    }
    res = client.post("/api/search", json=search_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["results_count"] >= 1
    assert any("bearing" in r["product_name"].lower() for r in data["results"])

    # Verify that searching did NOT create a new requirement record in Excel
    after_reqs = client.get("/api/requirements").json()
    assert len(after_reqs) == initial_count


def test_manual_product_query_passed_to_tavily_and_indiamart(monkeypatch):
    from supplier_search import generate_targeted_search_queries

    manual_product = "Digital Automatic Temperature Scanner 16 Channel"
    req_dict = {
        "product_name": manual_product,
        "category": "Process Instrumentation & Monitoring",
        "specifications": "16 display channels universal input rear terminals",
        "model": "DP1001AM"
    }

    queries = generate_targeted_search_queries(req_dict)
    # Check that query includes the exact manual product name, temperature scanner token, and IndiaMART target
    assert any("temperature scanner" in q.lower() or manual_product.lower() in q.lower() for q in queries)
    assert any("site:indiamart.com" in q for q in queries)


def test_regression_existing_requirement_selection():
    # Test that existing requirement selection still searches and loads correctly
    req_list = client.get("/api/requirements").json()
    assert len(req_list) >= 1
    first_req = req_list[0]

    payload = {
        "requirement_id": first_req["requirement_id"],
        "portal": "local_directory",
        "max_results": 5
    }
    res = client.post("/api/search", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["requirement_id"] == first_req["requirement_id"]


# -------------------------------------------------------------
# Tests for Public Contact Extraction into Contact Modal
# -------------------------------------------------------------
def test_extract_public_contact_already_available_in_search_results():
    # 1. Existing verified email & phone should return immediately
    payload = {
        "supplier_name": "Apex Precision CNC Machining Ltd.",
        "product_name": "Stainless Steel Precision Shaft SS316L",
        "product_url": "https://www.apexprecisionmfg.com/catalog/shafts",
        "existing_email": "sales@apexprecisionmfg.com",
        "existing_phone": "+1-800-555-0142"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["business_email"] == "sales@apexprecisionmfg.com"
    assert data["public_contact_number"] == "+18005550142"
    assert data["verification_status"] == "Verified"
    assert "catalog registry" in data["extraction_notes"]


def test_extract_public_contact_email_on_product_page(monkeypatch):
    import httpx

    sample_product_html = """
    <!DOCTYPE html>
    <html>
      <head><title>Masibus 85XX Temperature Scanner</title></head>
      <body>
        <h1>Masibus 85XX+ Multi-Channel Scanner</h1>
        <p>For technical inquiries, contact our sales department:</p>
        <a href="mailto:sales@masibus.com">sales@masibus.com</a>
        <a href="tel:+919876543210">Call +91-9876543210</a>
      </body>
    </html>
    """

    class MockResponse:
        def __init__(self):
            self.status_code = 200
            self.text = sample_product_html

    async def mock_async_get(self, url, *args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_async_get)

    payload = {
        "supplier_name": "Masibus Automation",
        "product_name": "Digital Automatic Temperature Scanner",
        "product_url": "https://www.masibus.com/products/85xx-scanner"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["business_email"] == "sales@masibus.com"
    assert data["public_contact_number"] == "+919876543210"
    assert data["verification_status"] == "Verified"
    assert "masibus.com" in data["contact_source_url"]


def test_extract_public_contact_on_official_contact_page(monkeypatch):
    import httpx

    product_html = """
    <html>
      <body>
        <h1>Industrial Thermocouple Scanner</h1>
        <p>Precision monitoring instrumentation.</p>
        <a href="/contact-us">Get in Touch / Contact Us</a>
      </body>
    </html>
    """

    contact_html = """
    <html>
      <body>
        <h2>Contact Sensor Instruments</h2>
        <p>Email: <a href="mailto:info@sensorinstruments.com">info@sensorinstruments.com</a></p>
        <p>Phone: +91 22 2876 5432</p>
      </body>
    </html>
    """

    class MockResponse:
        def __init__(self, text):
            self.status_code = 200
            self.text = text

    async def mock_async_get(self, url, *args, **kwargs):
        if "contact" in str(url):
            return MockResponse(contact_html)
        return MockResponse(product_html)

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_async_get)

    payload = {
        "supplier_name": "Sensor Instruments Ltd",
        "product_name": "Thermocouple Scanner",
        "product_url": "https://www.sensorinstruments.com/products/scanner"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["business_email"] == "info@sensorinstruments.com"
    assert data["public_contact_number"] == "+912228765432"
    assert "contact-us" in data["contact_source_url"]
    assert data["verification_status"] == "Verified"


def test_extract_public_contact_distinguish_manufacturer_and_supplier(monkeypatch):
    import httpx

    indiamart_html = """
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Masibus 16 Channel Temperature Scanner",
          "brand": {
            "@type": "Brand",
            "name": "Masibus"
          }
        }
        </script>
      </head>
      <body>
        <span class="company-name">Apex Automation & Process Traders</span>
        <a href="tel:+919876543210">Contact Seller</a>
      </body>
    </html>
    """

    class MockResponse:
        def __init__(self):
            self.status_code = 200
            self.text = indiamart_html

    async def mock_async_get(self, url, *args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_async_get)

    payload = {
        "supplier_name": "Apex Automation & Process Traders",
        "product_name": "Masibus 16 Channel Temperature Scanner",
        "product_url": "https://www.indiamart.com/proddetail/scanner.html"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["contact_type"] == "Supplier"
    assert data["manufacturer_name"] == "Masibus"
    assert data["public_contact_number"] == "+919876543210"


def test_extract_public_contact_missing_or_inaccessible_pages(monkeypatch):
    import httpx

    monkeypatch.setenv("TAVILY_API_KEY", "")

    async def mock_async_get(self, url, *args, **kwargs):
        raise httpx.ConnectError("Connection refused by target host")

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_async_get)

    payload = {
        "supplier_name": "Unreachable Electronics Corp",
        "product_name": "Custom Scanner Module",
        "product_url": "https://www.unreachable-electronics-test.com/item"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["verification_status"] == "Not Found"
    assert data["business_email"] is None
    assert data["public_contact_number"] is None
    assert "Not found on accessible public pages." in data["extraction_notes"]


def test_extract_public_contact_filter_invalid_email_and_dummy_phone(monkeypatch):
    import httpx

    dirty_html = """
    <html>
      <body>
        <a href="mailto:user@example.com">Example</a>
        <a href="mailto:bug@sentry.io">Sentry</a>
        <a href="mailto:logo@2x.png">Image</a>
        <a href="tel:0000000000">Dummy Phone</a>
        <a href="tel:12345">Short Phone</a>
      </body>
    </html>
    """

    class MockResponse:
        def __init__(self):
            self.status_code = 200
            self.text = dirty_html

    async def mock_async_get(self, url, *args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_async_get)
    monkeypatch.setenv("TAVILY_API_KEY", "")

    payload = {
        "supplier_name": "Dirty Data Industrial",
        "product_name": "Test Part",
        "product_url": "https://www.dirty-data-test.com/product"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Must reject false positives and dummy numbers
    assert data["business_email"] is None
    assert data["public_contact_number"] is None
    assert data["verification_status"] == "Not Found"


def test_extract_public_contact_no_unrelated_supplier_assigned(monkeypatch):
    import httpx

    # Mock product page with no contact info
    class MockPageResponse:
        def __init__(self):
            self.status_code = 200
            self.text = "<html><body>Product Catalogue</body></html>"

    async def mock_async_get(self, url, *args, **kwargs):
        return MockPageResponse()

    # Mock Tavily returning unrelated domain snippet
    mock_tavily = {
        "results": [
            {
                "url": "https://www.randomblogpost.org/review",
                "title": "Random Review Blog",
                "content": "Review written by blogger@randomblogpost.org for unrelated items."
            }
        ]
    }

    class MockTavilyResponse:
        def __init__(self):
            self.status_code = 200
        def json(self):
            return mock_tavily

    async def mock_async_post(self, url, *args, **kwargs):
        return MockTavilyResponse()

    monkeypatch.setattr(httpx.AsyncClient, "get", mock_async_get)
    monkeypatch.setattr(httpx.AsyncClient, "post", mock_async_post)
    monkeypatch.setenv("TAVILY_API_KEY", "mock-tavily-key")

    payload = {
        "supplier_name": "Dwyer Instruments",
        "product_name": "Temperature Scanner",
        "product_url": "https://www.dwyer-inst.com/products/scanner"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Should NOT assign unrelated blog email to Dwyer Instruments
    assert data["business_email"] != "blogger@randomblogpost.org"


def test_extract_public_contact_user_edited_values_preserved():
    # User-specified custom values in existing_email are respected and returned
    payload = {
        "supplier_name": "Custom Machining Shop",
        "product_name": "Shaft",
        "product_url": "https://www.example.com/shaft",
        "existing_email": "purchasing@custom-machining.com",
        "existing_phone": "+1-555-019-2834"
    }
    res = client.post("/api/contacts/extract-public-contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["business_email"] == "purchasing@custom-machining.com"
    assert data["public_contact_number"] == "+15550192834"
