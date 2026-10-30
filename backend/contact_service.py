import os
import re
import json
import html
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
from urllib.parse import urlparse, urljoin
import httpx

DISALLOWED_EMAIL_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js", ".woff", ".woff2", ".pdf", ".zip"
}
DISALLOWED_EMAIL_DOMAINS = {
    "example.com", "test.com", "domain.com", "sample.com", "w3.org", "schema.org",
    "sentry.io", "cloudflare.com", "wixpress.com", "wix.com", "google.com", "github.com",
    "gravatar.com", "wordpress.org", "mysite.com", "yourdomain.com", "email.com"
}
DISALLOWED_EMAIL_PREFIXES = {
    "noreply", "no-reply", "donotreply", "do-not-reply", "mailer-daemon", "privacy", "abuse"
}

def clean_and_validate_email(email_str: str) -> Optional[str]:
    """Validates and cleans email addresses; rejects false positives and generic extensions."""
    if not email_str or not isinstance(email_str, str):
        return None
    email_str = email_str.strip().lower()
    if email_str.startswith("mailto:"):
        email_str = email_str[7:]
    email_str = email_str.split("?")[0].strip()

    if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", email_str):
        return None

    for ext in DISALLOWED_EMAIL_EXTENSIONS:
        if email_str.endswith(ext):
            return None

    try:
        user_part, domain_part = email_str.split("@", 1)
    except ValueError:
        return None

    if user_part in DISALLOWED_EMAIL_PREFIXES:
        return None
    if domain_part in DISALLOWED_EMAIL_DOMAINS:
        return None

    parts = domain_part.split(".")
    if len(parts) < 2 or len(parts[-1]) < 2:
        return None

    return email_str

def normalize_phone_number(raw_phone: str, default_country: str = "IN") -> Optional[str]:
    """Normalizes phone numbers to standard E.164 format. Supports Indian mobile and landline formats."""
    if not raw_phone or not isinstance(raw_phone, str):
        return None
    raw = raw_phone.strip()
    if raw.startswith("tel:"):
        raw = raw[4:].strip()
    raw = raw.split("?")[0].strip()

    has_plus = raw.startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None

    # Filter out dummy or sequential numbers
    if len(set(digits)) <= 2 and len(digits) >= 8:
        return None
    if digits in ["1234567890", "0123456789", "0987654321"]:
        return None

    # If has + and is valid length (8 to 15 digits)
    if has_plus:
        if 8 <= len(digits) <= 15:
            return f"+{digits}"
        return None

    # Starts with international prefix 00
    if digits.startswith("00") and 10 <= len(digits) <= 17:
        return f"+{digits[2:]}"

    # Indian phone normalization:
    # 1. 12 digits starting with 91 (e.g. 919876543210)
    if digits.startswith("91") and len(digits) == 12 and digits[2] in "6789":
        return f"+{digits}"

    # 2. 11 digits starting with 0 (e.g. 09876543210)
    if digits.startswith("0") and len(digits) == 11 and digits[1] in "6789":
        return f"+91{digits[1:]}"

    # 3. 10 digits Indian mobile starting with 6, 7, 8, 9
    if len(digits) == 10 and digits[0] in "6789":
        if default_country == "IN":
            return f"+91{digits}"
        elif default_country == "US":
            return f"+1{digits}"

    # 4. Indian landline with STD code starting with 0 (e.g. 022-XXXXXXXX or 011-XXXXXXXX)
    if digits.startswith("0") and len(digits) in [10, 11]:
        return f"+91{digits[1:]}"

    # US/Canada numbers
    if len(digits) == 11 and digits.startswith("1") and default_country == "US":
        return f"+{digits}"
    if len(digits) == 10 and default_country == "US":
        return f"+1{digits}"

    # General fallback for international numbers between 10 and 15 digits
    if 10 <= len(digits) <= 15:
        return f"+{digits}"

    return None

def extract_emails_from_html(html_text: str, domain: Optional[str] = None) -> List[str]:
    """Extracts and ranks valid emails from HTML text and mailto links."""
    if not html_text:
        return []
    mailto_matches = re.findall(r'href=["\']mailto:([^"\'?\s>]+)', html_text, re.IGNORECASE)
    text_matches = re.findall(r'\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b', html_text)

    all_raw = mailto_matches + text_matches
    cleaned = []
    seen = set()

    for r in all_raw:
        em = clean_and_validate_email(r)
        if em and em not in seen:
            seen.add(em)
            cleaned.append(em)

    if domain:
        clean_dom = domain.lower().replace("www.", "")
        cleaned.sort(key=lambda e: (
            clean_dom in e.split("@")[-1],
            any(prefix in e for prefix in ["sales", "rfq", "inquiry", "info", "contact", "order"])
        ), reverse=True)
    else:
        cleaned.sort(key=lambda e: any(prefix in e for prefix in ["sales", "rfq", "inquiry", "info", "contact", "order"]), reverse=True)

    return cleaned

def extract_phones_from_html(html_text: str, default_country: str = "IN") -> List[str]:
    """Extracts and normalizes phone numbers from tel links, keyword context, and text."""
    if not html_text:
        return []
    tel_matches = re.findall(r'href=["\']tel:([^"\'\s>]+)', html_text, re.IGNORECASE)
    context_matches = re.findall(
        r'(?:Phone|Tel|Mobile|Call|Contact|WhatsApp|Mob|Helpline|Toll\s*Free)[^0-9\n]{1,15}(\+?[0-9\s().-]{8,20})',
        html_text,
        re.IGNORECASE
    )
    direct_matches = re.findall(
        r'(?:\+91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}|\b\d{10}\b|\+1[\s.-]?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}|\+49[\s.-]?\d{2,4}[\s.-]?\d{4,8}',
        html_text
    )

    all_raw = tel_matches + context_matches + direct_matches
    cleaned = []
    seen = set()

    for p in all_raw:
        norm = normalize_phone_number(p, default_country=default_country)
        if norm and norm not in seen:
            seen.add(norm)
            cleaned.append(norm)

    return cleaned

def extract_contacts_from_json_ld(html_text: str, default_country: str = "IN") -> Tuple[List[str], List[str], Dict[str, Any]]:
    """Extracts structured contact details and brand/manufacturer from schema.org JSON-LD."""
    emails = []
    phones = []
    metadata = {}
    if not html_text:
        return emails, phones, metadata

    script_blocks = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html_text, re.DOTALL | re.IGNORECASE)
    for block in script_blocks:
        try:
            data = json.loads(block.strip())
            def walk(obj):
                if isinstance(obj, dict):
                    if "email" in obj and isinstance(obj["email"], str):
                        em = clean_and_validate_email(obj["email"])
                        if em:
                            emails.append(em)
                    if "telephone" in obj and isinstance(obj["telephone"], str):
                        ph = normalize_phone_number(obj["telephone"], default_country)
                        if ph:
                            phones.append(ph)
                    if "brand" in obj and isinstance(obj["brand"], dict) and "name" in obj["brand"]:
                        metadata["brand"] = obj["brand"]["name"]
                    elif "brand" in obj and isinstance(obj["brand"], str):
                        metadata["brand"] = obj["brand"]
                    if "seller" in obj and isinstance(obj["seller"], dict) and "name" in obj["seller"]:
                        metadata["seller"] = obj["seller"]["name"]
                    if "manufacturer" in obj and isinstance(obj["manufacturer"], dict) and "name" in obj["manufacturer"]:
                        metadata["manufacturer"] = obj["manufacturer"]["name"]
                    elif "manufacturer" in obj and isinstance(obj["manufacturer"], str):
                        metadata["manufacturer"] = obj["manufacturer"]
                    for k, v in obj.items():
                        walk(v)
                elif isinstance(obj, list):
                    for item in obj:
                        walk(item)
            walk(data)
        except Exception:
            continue

    return list(dict.fromkeys(emails)), list(dict.fromkeys(phones)), metadata

def clean_supplier_name_for_greeting(name: Optional[str]) -> str:
    """
    Cleans supplier name for greetings:
    - Strips generic portal labels like 'IndiaMART Supplier - ...' or '... - IndiaMART'
    - Strips trailing 'Team' to avoid 'Dear XYZ Team Team,'
    - If the name is generic (e.g. 'IndiaMART', 'IndiaMART Supplier', 'Supplier Representative', 'Indiamart Team', 'Dear Indiamart Team', etc.)
      or empty, falls back to 'Supplier'.
    - Returns clean supplier name.
    """
    if not name or not isinstance(name, str):
        return "Supplier"
    s = name.strip()
    if not s:
        return "Supplier"

    s = re.sub(r'^dear\s+', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'^(?:indiamart\s*(?:supplier)?\s*[-–—:|]\s*)', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\s*[-–—:|]\s*indiamart.*$', '', s, flags=re.IGNORECASE).strip()
    s = re.sub(r'\s+team$', '', s, flags=re.IGNORECASE).strip()

    generic_labels = {
        "indiamart", "indiamart supplier", "supplier representative",
        "portal", "portal supplier", "live web search", "temp-dlr",
        "dlr-search", "dlr-new", "new supplier", "supplier", "n/a", "unknown", "none"
    }

    if s.lower() in generic_labels:
        return "Supplier"

    return s

def format_model_brand(model: Optional[str], brand: Optional[str]) -> Optional[str]:
    """Returns clean 'Model / Brand' value or None if neither is available."""
    m = model.strip() if model and isinstance(model, str) and model.strip().lower() not in ["n/a", "none", "null"] else None
    b = brand.strip() if brand and isinstance(brand, str) and brand.strip().lower() not in ["n/a", "none", "null"] else None
    if m and b:
        if b.lower() in m.lower():
            return m
        return f"{m} / {b}"
    elif m:
        return m
    elif b:
        return b
    return None

def format_target_price(price: Optional[float], currency: Optional[str] = "USD") -> Optional[str]:
    """
    Formats price cleanly (e.g. '$120.00' or 'INR 5,000.00').
    Returns None if price is missing or <= 0. Never invents prices.
    """
    if price is None:
        return None
    try:
        val = float(price)
    except (ValueError, TypeError):
        return None
    if val <= 0:
        return None

    curr = (currency or "USD").strip().upper()
    if curr in ["USD", "$"]:
        return f"${val:,.2f}"
    elif curr in ["INR", "RS", "RS.", "₹"]:
        return f"INR {val:,.2f}"
    elif curr in ["EUR", "€"]:
        return f"€{val:,.2f}"
    elif curr in ["GBP", "£"]:
        return f"£{val:,.2f}"
    else:
        return f"{curr} {val:,.2f}"

def format_quantity(qty: Optional[float]) -> Optional[str]:
    """Formats quantity as 'X units'. Returns None if qty is missing or <= 0."""
    if qty is None:
        return None
    try:
        val = float(qty)
    except (ValueError, TypeError):
        return None
    if val <= 0:
        return None
    if val.is_integer():
        return f"{int(val)} units"
    return f"{val:g} units"

def format_specifications(specs: Optional[str]) -> Optional[str]:
    """Returns clean specifications string or None if empty or placeholder."""
    if not specs or not isinstance(specs, str):
        return None
    s = specs.strip()
    if not s or s.lower() in ["n/a", "none", "null", "not available"]:
        return None
    return s

def clean_image_url(url: Optional[str]) -> Optional[str]:
    """
    Returns accessible public image URL or None.
    Rejects dummy, local, or placeholder URLs. Never allows user-uploaded images as supplier image.
    """
    if not url or not isinstance(url, str):
        return None
    u = url.strip()
    if not (u.startswith("http://") or u.startswith("https://")):
        return None
    if any(fake in u.lower() for fake in [
        "placeholder", "example.com", "fake", "default_img",
        "localhost", "127.0.0.1", "blob:", "data:"
    ]):
        return None
    return u

class ContactService:
    @staticmethod
    def generate_inquiry_message(
        requirement: Dict[str, Any],
        dealer: Dict[str, Any],
        sender_name: str = "Procurement Department",
        sender_company: str = "Apex Manufacturing Corp.",
        custom_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a simplified, professional Request for Quotation (RFQ) inquiry message
        with a greeting, product details, product image, and price only.
        Omits missing/unavailable fields rather than inventing placeholders.
        """
        sender_company = (sender_company or "Apex Manufacturing Corp.").strip()
        prod_name = (
            requirement.get("product_name")
            if requirement.get("product_name") and requirement.get("product_name") not in ["Industrial Component", "Industrial Part"]
            else None
        ) or dealer.get("product_name") or requirement.get("product_name") or "Industrial Product"
        prod_name = prod_name.strip()

        # Subject: Inquiry for [Product Name]
        subject = f"Inquiry for {prod_name}"

        # Clean supplier name for greeting (avoids 'Dear Indiamart Team', etc.)
        raw_dealer_name = (
            dealer.get("dealer_name")
            or dealer.get("supplier_name")
            or "Supplier"
        )
        cleaned_supplier_name = clean_supplier_name_for_greeting(raw_dealer_name)

        # Model / Brand
        model = dealer.get("model_number") or dealer.get("model") or requirement.get("model")
        brand = dealer.get("brand") or requirement.get("brand")
        model_brand = format_model_brand(model, brand)

        # Specifications
        specs = requirement.get("specifications") or dealer.get("specifications")
        clean_specs = format_specifications(specs)

        # Target Price
        target_price = requirement.get("target_price")
        currency = requirement.get("currency") or dealer.get("currency") or "USD"
        price_str = format_target_price(target_price, currency)

        # Quantity
        qty = requirement.get("quantity")
        qty_str = format_quantity(qty)

        # Product Image (strictly supplier's accessible product image, never user reference image)
        raw_img = dealer.get("image_url")
        clean_img = clean_image_url(raw_img)

        # Greetings line
        greeting_company = sender_company if sender_company.endswith(".") else f"{sender_company}."

        body_lines = [
            f"Dear {cleaned_supplier_name} Team,",
            "",
            f"Greetings from {greeting_company}",
            "",
            "We are interested in the following product:",
            "",
            f"Product: {prod_name}"
        ]

        if model_brand:
            body_lines.append(f"Model / Brand: {model_brand}")
        if clean_specs:
            body_lines.append(f"Specifications: {clean_specs}")
        if price_str:
            body_lines.append(f"Target Price: {price_str}")
        if qty_str:
            body_lines.append(f"Quantity: {qty_str}")

        if clean_img:
            body_lines.append("")
            body_lines.append(f"Product Image: {clean_img}")

        if custom_notes and custom_notes.strip():
            body_lines.append("")
            body_lines.append(f"Notes: {custom_notes.strip()}")

        body_lines.extend([
            "",
            "Please share your quotation and availability.",
            "",
            "Thank you,",
            f"{sender_company}"
        ])

        full_message = "\n".join(body_lines)

        email = dealer.get("business_email")
        phone = dealer.get("public_contact_number")

        return {
            "subject": subject,
            "message": full_message,
            "dealer_name": raw_dealer_name,
            "business_email": email,
            "public_contact_number": phone,
            "contact_method": "Email" if email else ("WhatsApp" if phone else "Portal Inquiry")
        }

    @staticmethod
    def extract_quotation_data(reply_text: str) -> Dict[str, Any]:
        """
        Heuristically extracts quotation data (price, currency, MOQ, delivery time)
        from free-text supplier replies for review.
        Leaves unknown values as None.
        """
        if not reply_text or not isinstance(reply_text, str):
            return {
                "quoted_price": None,
                "currency": "USD",
                "moq": None,
                "delivery_time": None,
                "technical_details": None
            }

        extracted: Dict[str, Any] = {
            "quoted_price": None,
            "currency": "USD",
            "moq": None,
            "delivery_time": None,
            "technical_details": None
        }

        # 1. Price extraction
        # Look for patterns like "$45.50", "USD 120", "EUR 85.00", "Rs. 2500", "45.00 USD/unit"
        currency_match = re.search(r"(\$|€|£|₹|USD|EUR|GBP|INR)", reply_text, re.IGNORECASE)
        if currency_match:
            c = currency_match.group(1).upper()
            curr_map = {"$": "USD", "€": "EUR", "£": "GBP", "₹": "INR"}
            extracted["currency"] = curr_map.get(c, c)

        price_match = re.search(
            r"(?:price|quote|rate|unit price|cost)?\s*(?::|\s)\s*(?:\$|€|£|₹|USD|EUR|GBP|INR)?\s*([0-9]{1,6}(?:\.[0-9]{1,2})?)\s*(?:per unit|\/unit|\/pc|\/piece|usd|eur|inr)?",
            reply_text,
            re.IGNORECASE
        )
        if price_match:
            try:
                extracted["quoted_price"] = float(price_match.group(1))
            except (ValueError, IndexError):
                pass

        # 2. MOQ extraction: "MOQ: 50", "MOQ is 100 pcs", "minimum order of 25 units"
        moq_match = re.search(r"(?:moq|minimum\s+order(?:\s+quantity)?)\s*(?::|\s|is)?\s*([0-9]+)", reply_text, re.IGNORECASE)
        if moq_match:
            try:
                extracted["moq"] = float(moq_match.group(1))
            except (ValueError, IndexError):
                pass

        # 3. Delivery / Lead Time: "lead time: 2-3 weeks", "delivery within 10 days"
        lead_match = re.search(r"(?:lead\s*time|delivery\s*(?:time)?)\s*(?::|\s|is)?\s*([0-9]+\s*-\s*[0-9]+\s*(?:days?|weeks?|months?)|[0-9]+\s*(?:days?|weeks?|months?))", reply_text, re.IGNORECASE)
        if lead_match:
            extracted["delivery_time"] = lead_match.group(1).strip()

        return extracted

    @staticmethod
    async def extract_public_contact(req_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts public business email address and phone number for a supplier product listing.
        1. Checks existing email & phone if already present in search result.
        2. Fetches and inspects product_url HTML for email, phone, tel/mailto, JSON-LD metadata.
        3. Looks for linked official Contact/About page on the same domain.
        4. Reuses Tavily targeted search if contact details are still missing.
        5. Distinguishes Manufacturer contact from Supplier/Seller contact when applicable.
        6. Returns structured response with provenance and verification status.
        Never fabricates contacts.
        """
        supplier_name = (req_data.get("supplier_name") or "Supplier").strip()
        product_name = (req_data.get("product_name") or "").strip()
        product_url = (req_data.get("product_url") or "").strip()
        existing_email = clean_and_validate_email(req_data.get("existing_email") or "")
        existing_phone = normalize_phone_number(req_data.get("existing_phone") or "")

        # 1. First use existing verified details if both email and phone are present
        if existing_email and existing_phone:
            return {
                "supplier_name": supplier_name,
                "business_email": existing_email,
                "public_contact_number": existing_phone,
                "source_page_url": product_url or None,
                "contact_source_url": product_url or None,
                "contact_type": "Supplier",
                "verification_status": "Verified",
                "extraction_notes": "Verified business contact available from catalog registry.",
                "manufacturer_name": None,
                "manufacturer_email": None,
                "manufacturer_phone": None,
                "manufacturer_source_url": None
            }

        found_email = existing_email
        found_phone = existing_phone
        contact_source_url = product_url or None if (found_email or found_phone) else None
        contact_type = "Supplier"
        verification_status = "Not Found"
        extraction_notes = None
        manufacturer_name = None
        manufacturer_email = None
        manufacturer_phone = None
        manufacturer_source_url = None

        parsed_url = urlparse(product_url) if product_url else None
        domain = parsed_url.netloc.lower().replace("www.", "") if parsed_url and parsed_url.netloc else ""
        is_indiamart = "indiamart.com" in domain

        default_country = "IN" if (is_indiamart or any(term in (req_data.get("category") or "").lower() for term in ["india", "inr"])) else "IN"

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

        product_html = None

        # 2. Inspect the product listing page
        if product_url and parsed_url and parsed_url.scheme in ["http", "https"]:
            try:
                async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
                    resp = await client.get(product_url, headers=headers)
                    if resp.status_code == 200:
                        product_html = resp.text

                        # A. JSON-LD contacts & metadata
                        j_emails, j_phones, j_meta = extract_contacts_from_json_ld(product_html, default_country)
                        if not found_email and j_emails:
                            found_email = j_emails[0]
                            contact_source_url = product_url
                            verification_status = "Verified"
                        if not found_phone and j_phones:
                            found_phone = j_phones[0]
                            contact_source_url = product_url
                            verification_status = "Verified"

                        if j_meta.get("manufacturer") or j_meta.get("brand"):
                            manufacturer_name = j_meta.get("manufacturer") or j_meta.get("brand")

                        # B. HTML page extraction
                        p_emails = extract_emails_from_html(product_html, domain)
                        p_phones = extract_phones_from_html(product_html, default_country)

                        if not found_email and p_emails:
                            found_email = p_emails[0]
                            contact_source_url = product_url
                            verification_status = "Verified"
                        if not found_phone and p_phones:
                            found_phone = p_phones[0]
                            contact_source_url = product_url
                            verification_status = "Verified"

                        # Check IndiaMART specific structure
                        if is_indiamart:
                            slr_match = re.search(r'class=["\'][^"\']*(?:company-name|seller-name|slr-name)[^"\']*["\'][^>]*>([^<]+)<', product_html, re.IGNORECASE)
                            if slr_match and slr_match.group(1).strip():
                                extracted_seller = slr_match.group(1).strip()
                                if supplier_name in ["Live Web Supplier", "IndiaMART Supplier", "Supplier"]:
                                    supplier_name = extracted_seller

                        if found_email or found_phone:
                            extraction_notes = f"Extracted from product listing page ({domain})."
            except Exception:
                pass

        # 3. If email or phone still missing, check official Contact / About page on the same domain
        if (not found_email or not found_phone) and product_html and product_url and domain and not is_indiamart:
            try:
                link_matches = re.findall(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', product_html, re.IGNORECASE | re.DOTALL)
                contact_href = None
                for href, text in link_matches:
                    clean_text = text.lower()
                    clean_href = href.lower()
                    if any(c in clean_href for c in ["/contact", "/contact-us", "/contactus", "contact_us", "/about-us", "/get-in-touch"]) or \
                       any(c in clean_text for c in ["contact us", "contact", "get in touch"]):
                        abs_url = urljoin(product_url, href)
                        parsed_contact = urlparse(abs_url)
                        if parsed_contact.netloc.lower().replace("www.", "") == domain:
                            contact_href = abs_url
                            break

                if contact_href:
                    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                        c_resp = await client.get(contact_href, headers=headers)
                        if c_resp.status_code == 200:
                            c_html = c_resp.text
                            c_emails = extract_emails_from_html(c_html, domain)
                            c_phones = extract_phones_from_html(c_html, default_country)
                            if not found_email and c_emails:
                                found_email = c_emails[0]
                                contact_source_url = contact_href
                                verification_status = "Verified"
                            if not found_phone and c_phones:
                                found_phone = c_phones[0]
                                contact_source_url = contact_href
                                verification_status = "Verified"

                            if found_email or found_phone:
                                extraction_notes = f"Extracted from official contact page ({contact_href})."
            except Exception:
                pass

        # 4. If email or phone still missing, use targeted Tavily query
        tavily_key = os.getenv("TAVILY_API_KEY", "").strip()
        if (not found_email or not found_phone) and tavily_key:
            try:
                if domain and not is_indiamart and domain not in ["amazon.in", "flipkart.com", "alibaba.com"]:
                    tavily_query = f'site:{domain} ("contact" OR "email" OR "phone" OR "sales")'
                else:
                    clean_sup = re.sub(r'(?i)\b(pvt|ltd|inc|corp|co|llc)\b', '', supplier_name).strip()
                    tavily_query = f'"{clean_sup}" "{product_name}" official contact email phone'

                tavily_payload = {
                    "api_key": tavily_key,
                    "query": tavily_query,
                    "search_depth": "basic",
                    "max_results": 3,
                    "include_answer": False,
                    "include_raw_content": False
                }
                async with httpx.AsyncClient(timeout=12.0) as client:
                    t_resp = await client.post("https://api.tavily.com/search", json=tavily_payload)
                    if t_resp.status_code == 200:
                        t_data = t_resp.json()
                        t_results = t_data.get("results", [])
                        for tr in t_results:
                            t_url = tr.get("url", "")
                            t_content = tr.get("content", "") + " " + tr.get("title", "")
                            t_emails = extract_emails_from_html(t_content)
                            t_phones = extract_phones_from_html(t_content, default_country)

                            tr_domain = urlparse(t_url).netloc.lower().replace("www.", "")
                            clean_sup = re.sub(r'(?i)\b(pvt|ltd|inc|corp|co|llc)\b', '', supplier_name).strip()
                            is_relevant = (domain and tr_domain == domain) or (clean_sup.lower() in t_content.lower())

                            if is_relevant:
                                if not found_email and t_emails:
                                    found_email = t_emails[0]
                                    contact_source_url = t_url
                                    verification_status = "Verified" if (domain and tr_domain == domain) else "Unverified"
                                if not found_phone and t_phones:
                                    found_phone = t_phones[0]
                                    contact_source_url = t_url
                                    verification_status = "Verified" if (domain and tr_domain == domain) else "Unverified"

                                if found_email or found_phone:
                                    extraction_notes = f"Discovered via targeted search ({t_url})."
                                    break
            except Exception:
                pass

        # 5. Distinguish Manufacturer Contact vs Supplier Contact if product specifies manufacturer
        prod_text = f"{product_name} {req_data.get('specifications', '')}".lower()
        known_mfrs = ["masibus", "dwyer", "radix", "omega", "skf", "nsk", "koyo", "siemens", "honeywell", "yokogawa", "mitsubishi"]
        detected_mfr = None
        for m in known_mfrs:
            if m in prod_text:
                detected_mfr = m.title()
                break

        if detected_mfr and supplier_name.lower() != detected_mfr.lower():
            manufacturer_name = detected_mfr
            if domain and detected_mfr.lower() in domain:
                contact_type = "Manufacturer"
                manufacturer_email = found_email
                manufacturer_phone = found_phone
                manufacturer_source_url = contact_source_url
            else:
                contact_type = "Supplier"
                try:
                    from supplier_search import VERIFIED_SUPPLIER_REGISTRY
                    for reg in VERIFIED_SUPPLIER_REGISTRY:
                        if detected_mfr.lower() in reg["dealer_name"].lower():
                            manufacturer_email = reg.get("business_email")
                            manufacturer_phone = reg.get("public_contact_number")
                            manufacturer_source_url = reg.get("product_url")
                            break
                except Exception:
                    pass
        elif domain and any(term in domain for term in ["distributor", "supply", "trader", "dealer"]):
            contact_type = "Distributor"

        # 6. Final verification status and notes
        if found_email or found_phone:
            if not verification_status or verification_status == "Not Found":
                verification_status = "Verified" if (contact_source_url and domain and domain in contact_source_url) else "Unverified"
            if not extraction_notes:
                extraction_notes = f"Found on public page: {contact_source_url or product_url}."
        else:
            verification_status = "Not Found"
            extraction_notes = "Not found on accessible public pages."

        return {
            "supplier_name": supplier_name,
            "business_email": found_email,
            "public_contact_number": found_phone,
            "source_page_url": product_url or None,
            "contact_source_url": contact_source_url,
            "contact_type": contact_type,
            "verification_status": verification_status,
            "extraction_notes": extraction_notes,
            "manufacturer_name": manufacturer_name,
            "manufacturer_email": manufacturer_email,
            "manufacturer_phone": manufacturer_phone,
            "manufacturer_source_url": manufacturer_source_url
        }
