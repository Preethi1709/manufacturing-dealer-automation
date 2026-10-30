import os
import re
import smtplib
import uuid
from email.message import EmailMessage
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

class EmailService:
    """
    Outbound SMTP Email Service for Supplier RFQ Communication.
    Supports STARTTLS (port 587) and SSL (port 465).
    Reads credentials securely from environment variables.
    Never exposes or logs sensitive credentials.
    """

    # RFC 5322 compliant email regex pattern (basic practical subset)
    EMAIL_REGEX = re.compile(
        r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"
    )

    @classmethod
    def validate_email(cls, email: Optional[str]) -> Tuple[bool, str]:
        """
        Validates an email address format.
        Returns (is_valid, sanitized_email_or_error_message).
        """
        if not email or not isinstance(email, str):
            return False, "Email address is required."
        
        email_clean = email.strip()
        if len(email_clean) > 254:
            return False, "Email address exceeds maximum length of 254 characters."

        if not cls.EMAIL_REGEX.match(email_clean):
            return False, f"Invalid email format: '{email_clean}'."

        return True, email_clean

    @classmethod
    def get_config(cls) -> Dict[str, Any]:
        """
        Retrieves SMTP configuration from environment variables.
        """
        return {
            "host": os.environ.get("SMTP_HOST", "").strip(),
            "port": int(os.environ.get("SMTP_PORT", "587")),
            "user": os.environ.get("SMTP_USER", "").strip(),
            "password": os.environ.get("SMTP_PASSWORD", "").strip(),
            "from_email": os.environ.get("SMTP_FROM_EMAIL", "").strip() or os.environ.get("SMTP_USER", "").strip(),
            "use_tls": os.environ.get("SMTP_TLS", "true").lower() in ("true", "1", "yes"),
            "use_ssl": os.environ.get("SMTP_SSL", "false").lower() in ("true", "1", "yes")
        }

    @classmethod
    def is_configured(cls) -> bool:
        """
        Checks whether SMTP sending is fully configured with required credentials.
        """
        cfg = cls.get_config()
        return bool(cfg["host"] and cfg["user"] and cfg["password"] and cfg["from_email"])

    @classmethod
    def send_rfq_email(
        cls,
        recipient_email: str,
        subject: str,
        message_body: str,
        sender_name: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends an RFQ email via SMTP.
        Validates recipient address, builds EmailMessage, and dispatches via SMTP.
        Returns a structured dictionary with status, timestamps, and provider message ID.
        """
        is_valid, validated_email = cls.validate_email(recipient_email)
        if not is_valid:
            return {
                "success": False,
                "status": "FAILED",
                "error": validated_email,
                "recipient": recipient_email,
                "timestamp": datetime.now().isoformat()
            }

        if not cls.is_configured():
            return {
                "success": False,
                "status": "CONFIG_REQUIRED",
                "error": "SMTP email credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL) are not configured in backend/.env.",
                "recipient": validated_email,
                "timestamp": datetime.now().isoformat()
            }

        cfg = cls.get_config()
        message_id = f"rfq-{uuid.uuid4().hex[:12]}@{cfg['host'] or 'mfg-procurement.local'}"

        msg = EmailMessage()
        from_display = f"{sender_name} <{cfg['from_email']}>" if sender_name else cfg['from_email']
        msg["From"] = from_display
        msg["To"] = validated_email
        msg["Subject"] = subject
        msg["Message-ID"] = f"<{message_id}>"
        msg["Date"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S +0000")
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.set_content(message_body)

        try:
            if cfg["use_ssl"] or cfg["port"] == 465:
                with smtplib.SMTP_SSL(cfg["host"], cfg["port"], timeout=15) as server:
                    server.login(cfg["user"], cfg["password"])
                    server.send_message(msg)
            else:
                with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
                    if cfg["use_tls"]:
                        server.starttls()
                    server.login(cfg["user"], cfg["password"])
                    server.send_message(msg)

            return {
                "success": True,
                "status": "Sent/Accepted",
                "provider_message_id": message_id,
                "recipient": validated_email,
                "subject": subject,
                "timestamp": datetime.now().isoformat(),
                "error": None
            }
        except smtplib.SMTPAuthenticationError:
            return {
                "success": False,
                "status": "FAILED",
                "error": "SMTP Authentication failed. Please check SMTP_USER and SMTP_PASSWORD.",
                "recipient": validated_email,
                "timestamp": datetime.now().isoformat()
            }
        except smtplib.SMTPConnectError:
            return {
                "success": False,
                "status": "FAILED",
                "error": f"Failed to connect to SMTP host at {cfg['host']}:{cfg['port']}.",
                "recipient": validated_email,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            # Redact any passwords if present in exception message
            sanitized_err = str(e).replace(cfg.get("password", "xyz123"), "******")
            return {
                "success": False,
                "status": "FAILED",
                "error": f"SMTP transmission error: {sanitized_err}",
                "recipient": validated_email,
                "timestamp": datetime.now().isoformat()
            }
