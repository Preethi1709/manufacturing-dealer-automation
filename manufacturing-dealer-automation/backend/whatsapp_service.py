import os
import re
import urllib.parse
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import httpx

class WhatsAppService:
    """
    WhatsApp Integration Service for Supplier RFQ Communication.
    Supports official WhatsApp Business Cloud API (Meta Graph API).
    Provides safe 'wa.me' prefilled link generation fallback when Cloud API is unconfigured.
    Validates recipient phone numbers according to E.164 international numbering format.
    Never uses browser automation or unofficial hacks.
    """

    # E.164 format: Optional leading '+', country code, followed by subscriber number (7 to 15 digits total)
    PHONE_REGEX = re.compile(r"^\+?[1-9]\d{6,14}$")

    @classmethod
    def validate_phone_number(cls, phone: Optional[str], default_country: str = "IN") -> Tuple[bool, str, str]:
        """
        Validates and standardizes a phone number to digits-only E.164 format.
        Strips common formatting characters (spaces, dashes, dots, parentheses).
        Normalizes Indian numbers (+91, 0 prefix, 10-digit mobile) without duplicating 91.
        Returns (is_valid, cleaned_digits_only, error_message).
        """
        if not phone or not isinstance(phone, str):
            return False, "", "Phone number is required."

        raw = phone.strip()
        if raw.lower().startswith("tel:"):
            raw = raw[4:].strip()
        raw = raw.split("?")[0].strip()

        has_plus = raw.startswith("+")
        has_double_zero = raw.startswith("00")
        digits = re.sub(r"\D", "", raw)
        if not digits:
            return False, "", f"Invalid phone format: '{phone}'. Expected international format with country code (e.g., +15551234567 or +919876543210)."

        # Reject dummy repeating numbers or sequential test patterns
        if len(set(digits)) <= 2 and len(digits) >= 8:
            return False, digits, f"Invalid phone format: '{phone}'. Dummy or repeating digits."
        if digits in ["1234567890", "0123456789", "0987654321"]:
            return False, digits, f"Invalid phone format: '{phone}'. Sequential dummy numbers."

        # If has international prefix '+' or '00'
        if has_plus or has_double_zero:
            d = digits[2:] if has_double_zero else digits
            # Strip redundant local trunk 0 in +91 0XXXXXXXXXX (13 digits starting with 910)
            if d.startswith("910") and len(d) == 13:
                d = "91" + d[3:]
            if 8 <= len(d) <= 15:
                return True, d, ""
            return False, d, f"Invalid phone length: '{phone}'. Expected 8 to 15 digits."

        # Indian phone normalization (when entered without explicit +):
        # 1. 13 digits starting with 910 (e.g. 9109876543210 -> strip local trunk 0)
        if digits.startswith("910") and len(digits) == 13:
            digits = "91" + digits[3:]

        # 2. 12 digits starting with 91 (e.g. 919876543210) -> already international, do NOT duplicate 91!
        if digits.startswith("91") and len(digits) == 12 and digits[2] in "6789":
            return True, digits, ""

        # 3. 11 digits starting with 0 (e.g. 09876543210) -> replace 0 with 91
        if digits.startswith("0") and len(digits) == 11 and digits[1] in "6789":
            return True, "91" + digits[1:], ""

        # 4. Indian landline STD with 0 (e.g. 022XXXXXXXX or 011XXXXXXXX)
        if digits.startswith("0") and len(digits) in (10, 11):
            return True, "91" + digits[1:], ""

        # 5. 10 digits Indian mobile starting with 6,7,8,9
        if len(digits) == 10 and digits[0] in "6789":
            if default_country == "IN":
                return True, "91" + digits, ""
            elif default_country == "US":
                return True, "1" + digits, ""

        # 6. US numbers: 11 digits starting with 1
        if len(digits) == 11 and digits.startswith("1") and default_country == "US":
            return True, digits, ""
        if len(digits) == 10 and default_country == "US":
            return True, "1" + digits, ""

        # 7. General fallback for international numbers between 10 and 15 digits
        if 10 <= len(digits) <= 15:
            return True, digits, ""

        return False, digits, f"Invalid phone format: '{phone}'. Expected international format with country code (e.g., +15551234567 or +919876543210)."

    @classmethod
    def get_cloud_api_config(cls) -> Dict[str, Any]:
        """
        Retrieves Meta WhatsApp Business Cloud API configuration from environment variables.
        """
        return {
            "phone_number_id": os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "").strip(),
            "access_token": os.environ.get("WHATSAPP_ACCESS_TOKEN", "").strip(),
            "api_version": os.environ.get("WHATSAPP_API_VERSION", "v19.0").strip(),
            "business_account_id": os.environ.get("WHATSAPP_BUSINESS_ACCOUNT_ID", "").strip()
        }

    @classmethod
    def is_cloud_api_configured(cls) -> bool:
        """
        Checks whether WhatsApp Business Cloud API credentials are set.
        """
        cfg = cls.get_cloud_api_config()
        return bool(cfg["phone_number_id"] and cfg["access_token"])

    @classmethod
    def generate_wa_link(cls, phone: str, message: str) -> str:
        """
        Generates a compliant wa.me deep link with prefilled URL-encoded message text.
        Format: https://wa.me/INTERNATIONAL_NUMBER?text=ENCODED_MESSAGE
        The phone number contains digits only, including country code, with no '+', spaces, or hyphens.
        """
        is_valid, digits, _ = cls.validate_phone_number(phone)
        clean_msg = (message or "").strip()
        encoded_text = urllib.parse.quote(clean_msg)
        if is_valid:
            return f"https://wa.me/{digits}?text={encoded_text}"
        return f"https://wa.me/?text={encoded_text}"

    @classmethod
    def send_rfq_message(
        cls,
        recipient_phone: str,
        message_body: str,
        template_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an RFQ via WhatsApp.
        If Cloud API is configured: sends via Meta Graph API.
        If Cloud API is not configured: generates a verified wa.me link with status 'Draft / Link Opened'.
        """
        if not message_body or not message_body.strip():
            return {
                "success": False,
                "status": "FAILED",
                "error": "RFQ message body cannot be empty.",
                "recipient": recipient_phone,
                "timestamp": datetime.now().isoformat(),
                "wa_link": None
            }

        is_valid, digits, err = cls.validate_phone_number(recipient_phone)
        if not is_valid:
            return {
                "success": False,
                "status": "FAILED",
                "error": err,
                "recipient": recipient_phone,
                "timestamp": datetime.now().isoformat(),
                "wa_link": None
            }

        wa_link = cls.generate_wa_link(digits, message_body.strip())

        # Check if official Cloud API is configured
        if not cls.is_cloud_api_configured():
            return {
                "success": True,
                "status": "Draft / Link Opened",
                "is_draft_link": True,
                "wa_link": wa_link,
                "recipient": f"+{digits}",
                "provider_message_id": None,
                "timestamp": datetime.now().isoformat(),
                "message": (
                    "WhatsApp Business Cloud API is not configured. "
                    "Generated a prefilled wa.me chat draft link. "
                    "The message must be manually reviewed and sent in WhatsApp by the user."
                )
            }

        # Meta WhatsApp Business Cloud API execution
        cfg = cls.get_cloud_api_config()
        url = f"https://graph.facebook.com/{cfg['api_version']}/{cfg['phone_number_id']}/messages"
        headers = {
            "Authorization": f"Bearer {cfg['access_token']}",
            "Content-Type": "application/json"
        }

        # If a pre-approved template name is provided, use template message type
        # Otherwise use standard text message (only allowed within 24-hr customer service window)
        if template_name:
            payload = {
                "messaging_product": "whatsapp",
                "to": digits,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": "en_US"}
                }
            }
        else:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": digits,
                "type": "text",
                "text": {"preview_url": True, "body": message_body}
            }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, headers=headers, json=payload)
                data = res.json()

            if res.status_code in (200, 201) and "messages" in data:
                provider_msg_id = data["messages"][0].get("id")
                return {
                    "success": True,
                    "status": "Sent/Accepted",
                    "is_draft_link": False,
                    "provider_message_id": provider_msg_id,
                    "recipient": f"+{digits}",
                    "timestamp": datetime.now().isoformat(),
                    "wa_link": wa_link,
                    "error": None
                }
            else:
                err_info = data.get("error", {}).get("message", res.text)
                return {
                    "success": False,
                    "status": "FAILED",
                    "is_draft_link": False,
                    "error": f"WhatsApp Cloud API Error ({res.status_code}): {err_info}",
                    "recipient": f"+{digits}",
                    "timestamp": datetime.now().isoformat(),
                    "wa_link": wa_link
                }
        except Exception as e:
            # Redact token from any error message
            sanitized = str(e).replace(cfg.get("access_token", ""), "******")
            return {
                "success": False,
                "status": "FAILED",
                "is_draft_link": False,
                "error": f"Network error contacting WhatsApp Cloud API: {sanitized}",
                "recipient": f"+{digits}",
                "timestamp": datetime.now().isoformat(),
                "wa_link": wa_link
            }
