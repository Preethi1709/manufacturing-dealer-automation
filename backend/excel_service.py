import os
import re
import shutil
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Thread safety lock for all Excel read/write operations
EXCEL_LOCK = threading.Lock()

SHEET_COLUMNS = {
    "Product_Requirements": [
        "Requirement_ID", "Product_Name", "Category", "Specifications",
        "Material", "Size", "Grade", "Model", "Quantity", "Target_Price",
        "Currency", "Preferred_Location", "Delivery_Requirement",
        "Additional_Requirements", "Created_At"
    ],
    "Dealer_Results": [
        "Dealer_ID", "Requirement_ID", "Dealer_Name", "Product_Name",
        "Specifications", "Public_Contact_Number", "Business_Email",
        "Location", "Source_Portal", "Product_URL", "Listed_Price",
        "Confirmed_Quoted_Price", "Currency", "MOQ", "Taxes",
        "Delivery_Charges", "Delivery_Time", "Match_Status",
        "Match_Reason", "Verification_Status", "Created_At"
    ],
    "Contact_Log": [
        "Contact_ID", "Dealer_ID", "Requirement_ID", "Contact_Method",
        "Inquiry_Message", "Contact_Date", "Response_Status",
        "Dealer_Response", "Follow_Up_Date", "Quotation_File_Path", "Notes",
        "Supplier_Name", "Product_Name", "Recipient_Contact", "Subject",
        "Created_At", "Updated_At", "Approval_Timestamp", "Send_Attempt_Timestamp",
        "Provider_Message_ID", "Communication_Status", "Response_Date",
        "Quoted_Price", "Currency", "MOQ", "Delivery_Time",
        "Quotation_Validity", "Technical_Details", "Follow_Up_Status", "Error_Details"
    ],
    "Quotation_Comparison": [
        "Comparison_ID", "Requirement_ID", "Dealer_ID", "Unit_Price",
        "Quantity", "Taxes", "Delivery_Charges", "Estimated_Total_Cost",
        "Currency", "MOQ", "Delivery_Time", "Match_Status", "Comparison_Notes"
    ],
    "Search_History": [
        "Search_ID", "Requirement_ID", "Search_Portal", "Search_Date",
        "Search_Status", "Results_Count", "Error_Message"
    ]
}

HEADER_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
HEADER_FONT = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
DATA_FONT = Font(name="Segoe UI", size=10, color="0F172A")
THIN_BORDER = Border(
    left=Side(style='thin', color='E2E8F0'),
    right=Side(style='thin', color='E2E8F0'),
    top=Side(style='thin', color='E2E8F0'),
    bottom=Side(style='thin', color='E2E8F0')
)

BACKEND_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_EXCEL_PATH = os.path.join(BACKEND_BASE_DIR, "data", "Dealer_Sourcing_Tracker.xlsx")
DEFAULT_BACKUP_DIR = os.path.join(BACKEND_BASE_DIR, "data", "backups")

class ExcelService:
    def __init__(self, file_path: Optional[str] = None, backup_dir: Optional[str] = None):
        if file_path is None or file_path == "data/Dealer_Sourcing_Tracker.xlsx":
            self.file_path = DEFAULT_EXCEL_PATH
        else:
            self.file_path = os.path.abspath(file_path)

        if backup_dir is None or backup_dir == "data/backups":
            self.backup_dir = DEFAULT_BACKUP_DIR
        else:
            self.backup_dir = os.path.abspath(backup_dir)

        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        os.makedirs(self.backup_dir, exist_ok=True)
        self._ensure_workbook_exists()

    def _ensure_workbook_exists(self):
        """Initializes the Excel workbook with standard worksheets and headers if not present."""
        with EXCEL_LOCK:
            if not os.path.exists(self.file_path):
                wb = openpyxl.Workbook()
                # Remove default sheet
                default_sheet = wb.active
                wb.remove(default_sheet)

                for sheet_name, cols in SHEET_COLUMNS.items():
                    ws = wb.create_sheet(title=sheet_name)
                    ws.append(cols)
                    self._format_worksheet_header(ws, cols)

                wb.save(self.file_path)
            else:
                # Ensure all required worksheets exist and headers are synchronized
                wb = openpyxl.load_workbook(self.file_path)
                modified = False
                for sheet_name, cols in SHEET_COLUMNS.items():
                    if sheet_name not in wb.sheetnames:
                        ws = wb.create_sheet(title=sheet_name)
                        ws.append(cols)
                        self._format_worksheet_header(ws, cols)
                        modified = True
                    else:
                        ws = wb[sheet_name]
                        if ws.max_row >= 1:
                            existing_headers = [str(cell.value).strip() for cell in ws[1] if cell.value is not None]
                            for col in cols:
                                if col not in existing_headers:
                                    next_col_idx = len(existing_headers) + 1
                                    cell = ws.cell(row=1, column=next_col_idx, value=col)
                                    cell.fill = HEADER_FILL
                                    cell.font = HEADER_FONT
                                    cell.alignment = Alignment(horizontal="center", vertical="center")
                                    cell.border = THIN_BORDER
                                    col_letter = get_column_letter(next_col_idx)
                                    ws.column_dimensions[col_letter].width = max(len(col) + 4, 15)
                                    existing_headers.append(col)
                                    modified = True
                if modified:
                    wb.save(self.file_path)

    def _format_worksheet_header(self, ws, columns: List[str]):
        """Applies professional styling, freeze pane, and auto column widths."""
        # Freeze top row
        ws.freeze_panes = "A2"
        ws.row_dimensions[1].height = 28

        for col_idx, col_name in enumerate(columns, 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = THIN_BORDER
            
            # Auto-adjust column width based on header length
            col_letter = get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = max(len(col_name) + 4, 15)

    def _create_backup(self):
        """Creates a timestamped backup before modifications."""
        try:
            if os.path.exists(self.file_path):
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_name = f"Dealer_Sourcing_Tracker_backup_{timestamp}.xlsx"
                backup_path = os.path.join(self.backup_dir, backup_name)
                shutil.copy2(self.file_path, backup_path)
                
                # Keep only last 10 backups to save disk space
                backups = sorted([os.path.join(self.backup_dir, f) for f in os.listdir(self.backup_dir) if f.endswith(".xlsx")])
                if len(backups) > 10:
                    for old_b in backups[:-10]:
                        try:
                            os.remove(old_b)
                        except Exception:
                            pass
        except Exception as e:
            print(f"Warning: Failed to create Excel backup: {e}")

    def _read_sheet(self, sheet_name: str) -> List[Dict[str, Any]]:
        """Safely reads all rows from a worksheet into a list of dictionaries."""
        with EXCEL_LOCK:
            if not os.path.exists(self.file_path):
                return []
            try:
                wb = openpyxl.load_workbook(self.file_path, data_only=True)
                if sheet_name not in wb.sheetnames:
                    return []
                ws = wb[sheet_name]
                rows = list(ws.iter_rows(values_only=True))
                if not rows or len(rows) < 2:
                    return []
                
                headers = [str(h).strip() if h is not None else f"col_{i}" for i, h in enumerate(rows[0])]
                records = []
                for row_idx, r in enumerate(rows[1:], start=2):
                    if not any(v is not None and str(v).strip() != "" for v in r):
                        continue
                    item = {}
                    for col_idx, h in enumerate(headers):
                        val = r[col_idx] if col_idx < len(r) else None
                        item[h] = val
                    records.append(item)
                return records
            except Exception as e:
                raise RuntimeError(f"Error reading Excel sheet '{sheet_name}': {str(e)}")

    def _append_row(self, sheet_name: str, row_dict: Dict[str, Any]):
        """Appends a new record to the sheet and formats data cells."""
        with EXCEL_LOCK:
            self._create_backup()
            wb = openpyxl.load_workbook(self.file_path)
            if sheet_name not in wb.sheetnames:
                ws = wb.create_sheet(title=sheet_name)
                cols = SHEET_COLUMNS.get(sheet_name, list(row_dict.keys()))
                ws.append(cols)
                self._format_worksheet_header(ws, cols)
            else:
                ws = wb[sheet_name]

            cols = SHEET_COLUMNS.get(sheet_name, [])
            row_values = [row_dict.get(c, "") for c in cols]
            ws.append(row_values)
            
            # Format the newly appended row
            new_row_idx = ws.max_row
            ws.row_dimensions[new_row_idx].height = 22
            for col_idx in range(1, len(cols) + 1):
                cell = ws.cell(row=new_row_idx, column=col_idx)
                cell.font = DATA_FONT
                cell.border = THIN_BORDER
                cell.alignment = Alignment(vertical="center")

            wb.save(self.file_path)

    def _update_row(self, sheet_name: str, id_col: str, id_val: str, updates: Dict[str, Any]) -> bool:
        """Finds row by ID and updates its cell values."""
        with EXCEL_LOCK:
            self._create_backup()
            wb = openpyxl.load_workbook(self.file_path)
            if sheet_name not in wb.sheetnames:
                return False
            ws = wb[sheet_name]
            cols = SHEET_COLUMNS.get(sheet_name, [])
            if id_col not in cols:
                return False
            
            id_col_idx = cols.index(id_col) + 1
            updated = False

            for row_idx in range(2, ws.max_row + 1):
                cell_val = ws.cell(row=row_idx, column=id_col_idx).value
                if cell_val is not None and str(cell_val).strip() == str(id_val).strip():
                    for k, v in updates.items():
                        if k in cols and v is not None:
                            target_col_idx = cols.index(k) + 1
                            ws.cell(row=row_idx, column=target_col_idx, value=v)
                    updated = True
                    break

            if updated:
                wb.save(self.file_path)
            return updated

    # ------------------- Requirements CRUD -------------------
    def get_all_requirements(self) -> List[Dict[str, Any]]:
        raw = self._read_sheet("Product_Requirements")
        result = []
        for r in raw:
            result.append({
                "requirement_id": str(r.get("Requirement_ID") or ""),
                "product_name": str(r.get("Product_Name") or ""),
                "category": str(r.get("Category") or ""),
                "specifications": str(r.get("Specifications") or ""),
                "material": str(r.get("Material") or "") if r.get("Material") else None,
                "size": str(r.get("Size") or "") if r.get("Size") else None,
                "grade": str(r.get("Grade") or "") if r.get("Grade") else None,
                "model": str(r.get("Model") or "") if r.get("Model") else None,
                "quantity": float(r.get("Quantity") or 0),
                "target_price": float(r.get("Target_Price") or 0),
                "currency": str(r.get("Currency") or "USD"),
                "preferred_location": str(r.get("Preferred_Location") or "") if r.get("Preferred_Location") else None,
                "delivery_requirement": str(r.get("Delivery_Requirement") or "") if r.get("Delivery_Requirement") else None,
                "additional_requirements": str(r.get("Additional_Requirements") or "") if r.get("Additional_Requirements") else None,
                "created_at": str(r.get("Created_At") or "")
            })
        return result

    def get_requirement_by_id(self, req_id: str) -> Optional[Dict[str, Any]]:
        reqs = self.get_all_requirements()
        for r in reqs:
            if r["requirement_id"].lower() == req_id.lower():
                return r
        return None

    def create_requirement(self, req_data: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_all_requirements()
        existing_ids = {str(r.get("requirement_id") or "").strip().upper() for r in existing}

        # Calculate max numeric suffix across all existing REQ IDs
        max_num = 100
        for rid in existing_ids:
            num_matches = re.findall(r'\d+', rid)
            if num_matches:
                try:
                    val = int(num_matches[-1])
                    if val > max_num:
                        max_num = val
                except ValueError:
                    pass

        next_num = max(max_num + 1, len(existing) + 101)
        # Ensure the candidate ID is strictly unique and never collides or overwrites
        while f"REQ-2025-{next_num}".upper() in existing_ids:
            next_num += 1

        req_id = f"REQ-2025-{next_num}"
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Parse quantity and target_price safely
        try:
            qty = float(req_data.get("quantity")) if req_data.get("quantity") is not None else 1.0
            if qty <= 0:
                qty = 1.0
        except (ValueError, TypeError):
            qty = 1.0

        try:
            price = float(req_data.get("target_price")) if req_data.get("target_price") is not None else 0.0
            if price < 0:
                price = 0.0
        except (ValueError, TypeError):
            price = 0.0

        row_dict = {
            "Requirement_ID": req_id,
            "Product_Name": (req_data.get("product_name") or "").strip(),
            "Category": (req_data.get("category") or "Industrial Components").strip(),
            "Specifications": (req_data.get("specifications") or req_data.get("product_name") or "").strip(),
            "Material": req_data.get("material") or None,
            "Size": req_data.get("size") or None,
            "Grade": req_data.get("grade") or None,
            "Model": req_data.get("model") or None,
            "Quantity": qty,
            "Target_Price": price,
            "Currency": req_data.get("currency") or "USD",
            "Preferred_Location": req_data.get("preferred_location") or None,
            "Delivery_Requirement": req_data.get("delivery_requirement") or None,
            "Additional_Requirements": req_data.get("additional_requirements") or None,
            "Created_At": created_at
        }
        self._append_row("Product_Requirements", row_dict)
        return self.get_requirement_by_id(req_id)

    def update_requirement(self, req_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        field_mapping = {
            "product_name": "Product_Name",
            "category": "Category",
            "specifications": "Specifications",
            "material": "Material",
            "size": "Size",
            "grade": "Grade",
            "model": "Model",
            "quantity": "Quantity",
            "target_price": "Target_Price",
            "currency": "Currency",
            "preferred_location": "Preferred_Location",
            "delivery_requirement": "Delivery_Requirement",
            "additional_requirements": "Additional_Requirements"
        }
        excel_updates = {}
        for k, v in updates.items():
            if k in field_mapping and v is not None:
                excel_updates[field_mapping[k]] = v

        if not excel_updates:
            return self.get_requirement_by_id(req_id)

        success = self._update_row("Product_Requirements", "Requirement_ID", req_id, excel_updates)
        if success:
            return self.get_requirement_by_id(req_id)
        return None

    # ------------------- Dealers CRUD -------------------
    def get_all_dealers(self, requirement_id: Optional[str] = None) -> List[Dict[str, Any]]:
        raw = self._read_sheet("Dealer_Results")
        result = []
        for r in raw:
            if requirement_id and str(r.get("Requirement_ID") or "").lower() != requirement_id.lower():
                continue
            result.append({
                "dealer_id": str(r.get("Dealer_ID") or ""),
                "requirement_id": str(r.get("Requirement_ID") or ""),
                "dealer_name": str(r.get("Dealer_Name") or ""),
                "product_name": str(r.get("Product_Name") or ""),
                "specifications": str(r.get("Specifications") or ""),
                "public_contact_number": str(r.get("Public_Contact_Number") or "") if r.get("Public_Contact_Number") else None,
                "business_email": str(r.get("Business_Email") or "") if r.get("Business_Email") else None,
                "location": str(r.get("Location") or ""),
                "source_portal": str(r.get("Source_Portal") or "Manual Entry"),
                "product_url": str(r.get("Product_URL") or "") if r.get("Product_URL") else None,
                "listed_price": float(r.get("Listed_Price")) if r.get("Listed_Price") is not None and str(r.get("Listed_Price")).strip() != "" else None,
                "confirmed_quoted_price": float(r.get("Confirmed_Quoted_Price")) if r.get("Confirmed_Quoted_Price") is not None and str(r.get("Confirmed_Quoted_Price")).strip() != "" else None,
                "currency": str(r.get("Currency") or "USD"),
                "moq": float(r.get("MOQ")) if r.get("MOQ") is not None and str(r.get("MOQ")).strip() != "" else None,
                "taxes": float(r.get("Taxes")) if r.get("Taxes") is not None and str(r.get("Taxes")).strip() != "" else None,
                "delivery_charges": float(r.get("Delivery_Charges")) if r.get("Delivery_Charges") is not None and str(r.get("Delivery_Charges")).strip() != "" else None,
                "delivery_time": str(r.get("Delivery_Time") or "") if r.get("Delivery_Time") else None,
                "match_status": str(r.get("Match_Status") or "Needs Verification"),
                "match_reason": str(r.get("Match_Reason") or "") if r.get("Match_Reason") else None,
                "verification_status": str(r.get("Verification_Status") or "Pending Verification"),
                "created_at": str(r.get("Created_At") or "")
            })
        return result

    def get_dealer_by_id(self, dealer_id: str) -> Optional[Dict[str, Any]]:
        dealers = self.get_all_dealers()
        for d in dealers:
            if d["dealer_id"].lower() == dealer_id.lower():
                return d
        return None

    def create_dealer(self, dealer_data: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_all_dealers()
        
        # Check duplicate by dealer_name + requirement_id + product_name
        req_id = dealer_data.get("requirement_id")
        name = dealer_data.get("dealer_name")
        prod = dealer_data.get("product_name")
        for ex in existing:
            if (ex["requirement_id"].lower() == req_id.lower() and
                ex["dealer_name"].strip().lower() == name.strip().lower() and
                ex["product_name"].strip().lower() == prod.strip().lower()):
                # Duplicate found - return existing instead of corrupting
                return ex

        next_num = len(existing) + 1001
        dealer_id = f"DLR-{next_num}"
        created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        row_dict = {
            "Dealer_ID": dealer_id,
            "Requirement_ID": req_id,
            "Dealer_Name": name,
            "Product_Name": prod,
            "Specifications": dealer_data.get("specifications"),
            "Public_Contact_Number": dealer_data.get("public_contact_number"),
            "Business_Email": dealer_data.get("business_email"),
            "Location": dealer_data.get("location"),
            "Source_Portal": dealer_data.get("source_portal", "Manual Entry"),
            "Product_URL": dealer_data.get("product_url"),
            "Listed_Price": dealer_data.get("listed_price"),
            "Confirmed_Quoted_Price": dealer_data.get("confirmed_quoted_price"),
            "Currency": dealer_data.get("currency", "USD"),
            "MOQ": dealer_data.get("moq"),
            "Taxes": dealer_data.get("taxes"),
            "Delivery_Charges": dealer_data.get("delivery_charges"),
            "Delivery_Time": dealer_data.get("delivery_time"),
            "Match_Status": dealer_data.get("match_status", "Needs Verification"),
            "Match_Reason": dealer_data.get("match_reason"),
            "Verification_Status": dealer_data.get("verification_status", "Pending Verification"),
            "Created_At": created_at
        }
        self._append_row("Dealer_Results", row_dict)
        return self.get_dealer_by_id(dealer_id)

    def update_dealer(self, dealer_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        field_mapping = {
            "dealer_name": "Dealer_Name",
            "product_name": "Product_Name",
            "specifications": "Specifications",
            "public_contact_number": "Public_Contact_Number",
            "business_email": "Business_Email",
            "location": "Location",
            "source_portal": "Source_Portal",
            "product_url": "Product_URL",
            "listed_price": "Listed_Price",
            "confirmed_quoted_price": "Confirmed_Quoted_Price",
            "currency": "Currency",
            "moq": "MOQ",
            "taxes": "Taxes",
            "delivery_charges": "Delivery_Charges",
            "delivery_time": "Delivery_Time",
            "match_status": "Match_Status",
            "match_reason": "Match_Reason",
            "verification_status": "Verification_Status"
        }
        excel_updates = {}
        for k, v in updates.items():
            if k in field_mapping and v is not None:
                excel_updates[field_mapping[k]] = v

        if not excel_updates:
            return self.get_dealer_by_id(dealer_id)

        success = self._update_row("Dealer_Results", "Dealer_ID", dealer_id, excel_updates)
        if success:
            return self.get_dealer_by_id(dealer_id)
        return None

    # ------------------- Contact Log CRUD -------------------
    def get_all_contacts(self, dealer_id: Optional[str] = None, requirement_id: Optional[str] = None) -> List[Dict[str, Any]]:
        raw = self._read_sheet("Contact_Log")
        dealers_map = {d["dealer_id"]: d for d in self.get_all_dealers()}
        reqs_map = {r["requirement_id"]: r for r in self.get_all_requirements()}
        result = []
        for r in raw:
            d_id = str(r.get("Dealer_ID") or "")
            req_id = str(r.get("Requirement_ID") or "")
            if dealer_id and d_id.lower() != dealer_id.lower():
                continue
            if requirement_id and req_id.lower() != requirement_id.lower():
                continue
            
            dealer_obj = dealers_map.get(d_id, {})
            req_obj = reqs_map.get(req_id, {})

            supplier_name = r.get("Supplier_Name") or dealer_obj.get("dealer_name", "Unknown Supplier")
            product_name = r.get("Product_Name") or req_obj.get("product_name") or dealer_obj.get("product_name", "")
            comm_status = str(r.get("Communication_Status") or r.get("Response_Status") or "Pending")
            follow_up = str(r.get("Follow_Up_Date") or "") if r.get("Follow_Up_Date") else None

            # Parse quoted price and MOQ safely
            quoted_price = None
            if r.get("Quoted_Price") is not None and str(r.get("Quoted_Price")).strip() != "":
                try:
                    quoted_price = float(r.get("Quoted_Price"))
                except (ValueError, TypeError):
                    quoted_price = None

            moq = None
            if r.get("MOQ") is not None and str(r.get("MOQ")).strip() != "":
                try:
                    moq = float(r.get("MOQ"))
                except (ValueError, TypeError):
                    moq = None

            result.append({
                "contact_id": str(r.get("Contact_ID") or ""),
                "dealer_id": d_id,
                "requirement_id": req_id,
                "dealer_name": str(supplier_name),
                "supplier_name": str(supplier_name),
                "product_name": str(product_name),
                "contact_method": str(r.get("Contact_Method") or "Email"),
                "recipient_contact": str(r.get("Recipient_Contact") or "") if r.get("Recipient_Contact") else None,
                "subject": str(r.get("Subject") or "") if r.get("Subject") else None,
                "inquiry_message": str(r.get("Inquiry_Message") or ""),
                "contact_date": str(r.get("Contact_Date") or ""),
                "response_status": comm_status,
                "communication_status": comm_status,
                "dealer_response": str(r.get("Dealer_Response") or "") if r.get("Dealer_Response") else None,
                "supplier_response": str(r.get("Dealer_Response") or "") if r.get("Dealer_Response") else None,
                "response_date": str(r.get("Response_Date") or "") if r.get("Response_Date") else None,
                "follow_up_date": follow_up,
                "next_follow_up_date": follow_up,
                "follow_up_status": str(r.get("Follow_Up_Status") or "") if r.get("Follow_Up_Status") else None,
                "quotation_file_path": str(r.get("Quotation_File_Path") or "") if r.get("Quotation_File_Path") else None,
                "quoted_price": quoted_price,
                "currency": str(r.get("Currency") or "USD"),
                "moq": moq,
                "delivery_time": str(r.get("Delivery_Time") or "") if r.get("Delivery_Time") else None,
                "quotation_validity": str(r.get("Quotation_Validity") or "") if r.get("Quotation_Validity") else None,
                "technical_details": str(r.get("Technical_Details") or "") if r.get("Technical_Details") else None,
                "created_at": str(r.get("Created_At") or "") if r.get("Created_At") else None,
                "updated_at": str(r.get("Updated_At") or "") if r.get("Updated_At") else None,
                "approval_timestamp": str(r.get("Approval_Timestamp") or "") if r.get("Approval_Timestamp") else None,
                "send_attempt_timestamp": str(r.get("Send_Attempt_Timestamp") or "") if r.get("Send_Attempt_Timestamp") else None,
                "provider_message_id": str(r.get("Provider_Message_ID") or "") if r.get("Provider_Message_ID") else None,
                "error_details": str(r.get("Error_Details") or "") if r.get("Error_Details") else None,
                "notes": str(r.get("Notes") or "") if r.get("Notes") else None
            })
        return result

    def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_all_contacts()
        next_num = len(existing) + 5001
        contact_id = f"CNT-{next_num}"
        now_iso = datetime.now().isoformat()

        row_dict = {
            "Contact_ID": contact_id,
            "Dealer_ID": contact_data.get("dealer_id"),
            "Requirement_ID": contact_data.get("requirement_id"),
            "Contact_Method": contact_data.get("contact_method", "Email"),
            "Inquiry_Message": contact_data.get("inquiry_message"),
            "Contact_Date": contact_data.get("contact_date", datetime.now().strftime("%Y-%m-%d")),
            "Response_Status": contact_data.get("communication_status") or contact_data.get("response_status", "Pending"),
            "Dealer_Response": contact_data.get("dealer_response") or contact_data.get("supplier_response"),
            "Follow_Up_Date": contact_data.get("follow_up_date") or contact_data.get("next_follow_up_date"),
            "Quotation_File_Path": contact_data.get("quotation_file_path"),
            "Notes": contact_data.get("notes"),
            "Supplier_Name": contact_data.get("supplier_name") or contact_data.get("dealer_name"),
            "Product_Name": contact_data.get("product_name"),
            "Recipient_Contact": contact_data.get("recipient_contact"),
            "Subject": contact_data.get("subject"),
            "Created_At": contact_data.get("created_at") or now_iso,
            "Updated_At": now_iso,
            "Approval_Timestamp": contact_data.get("approval_timestamp"),
            "Send_Attempt_Timestamp": contact_data.get("send_attempt_timestamp"),
            "Provider_Message_ID": contact_data.get("provider_message_id"),
            "Communication_Status": contact_data.get("communication_status") or contact_data.get("response_status", "Pending"),
            "Response_Date": contact_data.get("response_date"),
            "Quoted_Price": contact_data.get("quoted_price"),
            "Currency": contact_data.get("currency", "USD"),
            "MOQ": contact_data.get("moq"),
            "Delivery_Time": contact_data.get("delivery_time"),
            "Quotation_Validity": contact_data.get("quotation_validity"),
            "Technical_Details": contact_data.get("technical_details"),
            "Follow_Up_Status": contact_data.get("follow_up_status", "Pending"),
            "Error_Details": contact_data.get("error_details")
        }
        self._append_row("Contact_Log", row_dict)
        
        contacts = self.get_all_contacts()
        for c in contacts:
            if c["contact_id"] == contact_id:
                return c
        return contact_data

    def update_contact(self, contact_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        field_mapping = {
            "contact_method": "Contact_Method",
            "inquiry_message": "Inquiry_Message",
            "contact_date": "Contact_Date",
            "response_status": "Response_Status",
            "dealer_response": "Dealer_Response",
            "supplier_response": "Dealer_Response",
            "follow_up_date": "Follow_Up_Date",
            "next_follow_up_date": "Follow_Up_Date",
            "quotation_file_path": "Quotation_File_Path",
            "notes": "Notes",
            "supplier_name": "Supplier_Name",
            "product_name": "Product_Name",
            "recipient_contact": "Recipient_Contact",
            "subject": "Subject",
            "approval_timestamp": "Approval_Timestamp",
            "send_attempt_timestamp": "Send_Attempt_Timestamp",
            "provider_message_id": "Provider_Message_ID",
            "communication_status": "Communication_Status",
            "response_date": "Response_Date",
            "quoted_price": "Quoted_Price",
            "currency": "Currency",
            "moq": "MOQ",
            "delivery_time": "Delivery_Time",
            "quotation_validity": "Quotation_Validity",
            "technical_details": "Technical_Details",
            "follow_up_status": "Follow_Up_Status",
            "error_details": "Error_Details"
        }
        excel_updates = {
            "Updated_At": datetime.now().isoformat()
        }
        for k, v in updates.items():
            if k in field_mapping and v is not None:
                excel_updates[field_mapping[k]] = v
                # Also keep Response_Status and Communication_Status in sync
                if k in ("response_status", "communication_status"):
                    excel_updates["Response_Status"] = v
                    excel_updates["Communication_Status"] = v

        if not excel_updates:
            contacts = self.get_all_contacts()
            for c in contacts:
                if c["contact_id"] == contact_id:
                    return c
            return None

        success = self._update_row("Contact_Log", "Contact_ID", contact_id, excel_updates)
        if success:
            contacts = self.get_all_contacts()
            for c in contacts:
                if c["contact_id"] == contact_id:
                    return c
        return None

    def get_followup_metrics(self) -> Dict[str, int]:
        """
        Calculates follow-up tracking metrics across all logged contacts.
        """
        contacts = self.get_all_contacts()
        today_str = datetime.now().strftime("%Y-%m-%d")

        due_today = 0
        overdue = 0
        waiting_response = 0
        reply_received = 0
        quotation_received = 0
        failed_attempts = 0
        closed = 0

        for c in contacts:
            status = str(c.get("communication_status") or c.get("response_status") or "").strip().lower()
            follow_up = str(c.get("follow_up_date") or "").strip()[:10]

            if "closed" in status:
                closed += 1
            elif "fail" in status:
                failed_attempts += 1
            elif "quot" in status:
                quotation_received += 1
            elif "reply" in status or "respond" in status:
                reply_received += 1
            else:
                waiting_response += 1

            # Follow-up schedule check (only active if not closed or quotation received)
            if follow_up and "closed" not in status and "quot" not in status:
                if follow_up == today_str:
                    due_today += 1
                elif follow_up < today_str:
                    overdue += 1

        return {
            "due_today": due_today,
            "overdue": overdue,
            "waiting_response": waiting_response,
            "reply_received": reply_received,
            "quotation_received": quotation_received,
            "failed_attempts": failed_attempts,
            "closed": closed,
            "total": len(contacts)
        }

    # ------------------- Quotation Comparison -------------------
    def save_comparison_record(self, comp_dict: Dict[str, Any]):
        """Saves or updates quotation comparison in sheet."""
        self._append_row("Quotation_Comparison", comp_dict)

    def get_comparisons(self, requirement_id: Optional[str] = None) -> List[Dict[str, Any]]:
        raw = self._read_sheet("Quotation_Comparison")
        result = []
        for r in raw:
            req_id = str(r.get("Requirement_ID") or "")
            if requirement_id and req_id.lower() != requirement_id.lower():
                continue
            result.append({
                "comparison_id": str(r.get("Comparison_ID") or ""),
                "requirement_id": req_id,
                "dealer_id": str(r.get("Dealer_ID") or ""),
                "unit_price": float(r.get("Unit_Price")) if r.get("Unit_Price") is not None else None,
                "quantity": float(r.get("Quantity") or 0),
                "taxes": float(r.get("Taxes")) if r.get("Taxes") is not None else None,
                "delivery_charges": float(r.get("Delivery_Charges")) if r.get("Delivery_Charges") is not None else None,
                "estimated_total_cost": float(r.get("Estimated_Total_Cost")) if r.get("Estimated_Total_Cost") is not None else None,
                "currency": str(r.get("Currency") or "USD"),
                "moq": float(r.get("MOQ")) if r.get("MOQ") is not None else None,
                "delivery_time": str(r.get("Delivery_Time") or ""),
                "match_status": str(r.get("Match_Status") or ""),
                "comparison_notes": str(r.get("Comparison_Notes") or "")
            })
        return result

    # ------------------- Search History -------------------
    def log_search(self, search_data: Dict[str, Any]) -> Dict[str, Any]:
        existing = self.get_search_history()
        search_id = f"SCH-{len(existing) + 7001}"
        search_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        row_dict = {
            "Search_ID": search_id,
            "Requirement_ID": search_data.get("requirement_id"),
            "Search_Portal": search_data.get("search_portal"),
            "Search_Date": search_date,
            "Search_Status": search_data.get("search_status"),
            "Results_Count": search_data.get("results_count", 0),
            "Error_Message": search_data.get("error_message", "")
        }
        self._append_row("Search_History", row_dict)
        return row_dict

    def get_search_history(self) -> List[Dict[str, Any]]:
        raw = self._read_sheet("Search_History")
        result = []
        for r in raw:
            result.append({
                "search_id": str(r.get("Search_ID") or ""),
                "requirement_id": str(r.get("Requirement_ID") or ""),
                "search_portal": str(r.get("Search_Portal") or ""),
                "search_date": str(r.get("Search_Date") or ""),
                "search_status": str(r.get("Search_Status") or ""),
                "results_count": int(r.get("Results_Count") or 0),
                "error_message": str(r.get("Error_Message") or "") if r.get("Error_Message") else None
            })
        return result

    # ------------------- Export Functions -------------------
    def export_dealers_workbook(self, requirement_id: Optional[str] = None) -> openpyxl.Workbook:
        """Creates an export workbook of dealers formatted professionally."""
        dealers = self.get_all_dealers(requirement_id)
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Dealer_Results_Export"
        
        headers = SHEET_COLUMNS["Dealer_Results"]
        ws.append(headers)
        self._format_worksheet_header(ws, headers)

        for d in dealers:
            row = [
                d["dealer_id"], d["requirement_id"], d["dealer_name"], d["product_name"],
                d["specifications"], d["public_contact_number"] or "", d["business_email"] or "",
                d["location"], d["source_portal"], d["product_url"] or "", d["listed_price"] or "",
                d["confirmed_quoted_price"] or "", d["currency"], d["moq"] or "", d["taxes"] or "",
                d["delivery_charges"] or "", d["delivery_time"] or "", d["match_status"],
                d["match_reason"] or "", d["verification_status"], d["created_at"]
            ]
            ws.append(row)
            row_idx = ws.max_row
            ws.row_dimensions[row_idx].height = 20
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=row_idx, column=col_idx)
                c.font = DATA_FONT
                c.border = THIN_BORDER
                c.alignment = Alignment(vertical="center")

        return wb

    def export_requirements_workbook(self) -> openpyxl.Workbook:
        reqs = self.get_all_requirements()
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Requirements_Export"

        headers = SHEET_COLUMNS["Product_Requirements"]
        ws.append(headers)
        self._format_worksheet_header(ws, headers)

        for r in reqs:
            row = [
                r["requirement_id"], r["product_name"], r["category"], r["specifications"],
                r["material"] or "", r["size"] or "", r["grade"] or "", r["model"] or "",
                r["quantity"], r["target_price"], r["currency"], r["preferred_location"] or "",
                r["delivery_requirement"] or "", r["additional_requirements"] or "", r["created_at"]
            ]
            ws.append(row)
            row_idx = ws.max_row
            ws.row_dimensions[row_idx].height = 20
            for col_idx in range(1, len(headers) + 1):
                c = ws.cell(row=row_idx, column=col_idx)
                c.font = DATA_FONT
                c.border = THIN_BORDER
                c.alignment = Alignment(vertical="center")

        return wb

    def export_comparison_workbook(self, requirement_id: str, comparisons: List[Dict[str, Any]]) -> openpyxl.Workbook:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Quotation_Comparison"

        headers = [
            "Requirement_ID", "Dealer_ID", "Dealer_Name", "Unit_Price", "Quantity",
            "Taxes", "Delivery_Charges", "Estimated_Total_Cost", "Cost_Status",
            "Currency", "MOQ", "Delivery_Time", "Match_Status", "Verification_Status",
            "Recommendation_Notes"
        ]
        ws.append(headers)
        self._format_worksheet_header(ws, headers)

        for c in comparisons:
            cost_status = "Incomplete/Missing Components" if c.get("has_unconfirmed_costs") else "Confirmed Total"
            row = [
                c.get("requirement_id"), c.get("dealer_id"), c.get("dealer_name"),
                c.get("unit_price") or "", c.get("quantity") or 0,
                c.get("taxes") if c.get("taxes") is not None else "TBD",
                c.get("delivery_charges") if c.get("delivery_charges") is not None else "TBD",
                c.get("estimated_total_cost") if c.get("estimated_total_cost") is not None else "Pending Details",
                cost_status,
                c.get("currency", "USD"), c.get("moq") or "", c.get("delivery_time") or "",
                c.get("match_status", ""), c.get("verification_status", ""),
                c.get("recommendation_notes", "")
            ]
            ws.append(row)
            row_idx = ws.max_row
            ws.row_dimensions[row_idx].height = 22
            for col_idx in range(1, len(headers) + 1):
                cell = ws.cell(row=row_idx, column=col_idx)
                cell.font = DATA_FONT
                cell.border = THIN_BORDER
                cell.alignment = Alignment(vertical="center")

        return wb
