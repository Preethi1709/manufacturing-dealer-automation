# Manufacturing Dealer Sourcing Automation System

A full-stack, enterprise-grade manufacturing procurement automation application designed to streamline dealer and supplier discovery, technical specification matching, price benchmarking, multi-criteria quotation matrix comparison, and Request for Quotation (RFQ) outreach.

All procurement records, requirements, discovery logs, and quotation comparisons are stored natively in an Excel workbook (`Dealer_Sourcing_Tracker.xlsx`) using thread-safe, structured operations. No SQL, PostgreSQL, MySQL, or MongoDB required.

---

## Architecture Overview

```
manufacturing-dealer-automation/
├── backend/
│   ├── main.py                  # FastAPI REST endpoints & file upload handlers
│   ├── models.py                # Pydantic v2 schemas and validation models
│   ├── excel_service.py         # Thread-safe Excel read/write, backups, and styling
│   ├── supplier_search.py       # Permitted supplier directory & official portal APIs
│   ├── matching_service.py      # Technical spec, MOQ, lead-time & price match engine
│   ├── contact_service.py       # RFQ letter generator & contact tracking
│   ├── seed_data.py             # Pre-populates realistic manufacturing BOM & dealers
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Environment configuration template
│   ├── .env                     # Local configuration
│   ├── data/
│   │   ├── Dealer_Sourcing_Tracker.xlsx   # Primary Excel data store
│   │   └── backups/             # Automatic timestamped Excel backups
│   ├── quotations/              # Local sanitized storage for uploaded quotation files
│   └── tests/
│       └── test_api.py          # Automated pytest test suite (10 test cases)
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI widgets, badges, and modal dialogs
│   │   ├── pages/               # 7 Core Procurement Application Pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProductRequirements.jsx
│   │   │   ├── DealerSearch.jsx
│   │   │   ├── DealerResults.jsx
│   │   │   ├── DealerDetails.jsx
│   │   │   ├── QuotationComparison.jsx
│   │   │   └── ContactLog.jsx
│   │   ├── services/            # Axios API client & blob Excel download helpers
│   │   ├── layouts/             # Responsive sidebar + top navbar layout
│   │   ├── App.jsx              # React Router DOM route definitions
│   │   ├── main.jsx             # React entry point
│   │   └── index.css            # Tailwind CSS directives
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.js           # Vite development server configuration
│   ├── tailwind.config.js       # Manufacturing industrial theme
│   ├── .env.example             # Frontend environment variables
│   └── .env                     # Local frontend API base URL
└── README.md
```

---

## 1. Technology Stack

- **Frontend**: React.js, Vite, JavaScript, Tailwind CSS, Axios, React Router v6, Lucide React icons.
- **Backend**: Python 3.10+, FastAPI, Pydantic v2, pandas, openpyxl, Uvicorn, python-multipart, pytest.
- **Primary Storage**: Excel Workbook (`.xlsx`) with automated thread-safe locking, header formatting, frozen panes, and backup versioning.
- **Quotations Storage**: Local sanitized file directory (`backend/quotations/`) with file type verification and directory traversal prevention.

---

## 2. Excel Data Structure

The system automatically initializes and maintains `backend/data/Dealer_Sourcing_Tracker.xlsx` across 5 worksheets:

1. **`Product_Requirements`**:
   `Requirement_ID`, `Product_Name`, `Category`, `Specifications`, `Material`, `Size`, `Grade`, `Model`, `Quantity`, `Target_Price`, `Currency`, `Preferred_Location`, `Delivery_Requirement`, `Additional_Requirements`, `Created_At`.
2. **`Dealer_Results`**:
   `Dealer_ID`, `Requirement_ID`, `Dealer_Name`, `Product_Name`, `Specifications`, `Public_Contact_Number`, `Business_Email`, `Location`, `Source_Portal`, `Product_URL`, `Listed_Price`, `Confirmed_Quoted_Price`, `Currency`, `MOQ`, `Taxes`, `Delivery_Charges`, `Delivery_Time`, `Match_Status`, `Match_Reason`, `Verification_Status`, `Created_At`.
3. **`Contact_Log`**:
   `Contact_ID`, `Dealer_ID`, `Requirement_ID`, `Contact_Method`, `Inquiry_Message`, `Contact_Date`, `Response_Status`, `Dealer_Response`, `Follow_Up_Date`, `Quotation_File_Path`, `Notes`.
4. **`Quotation_Comparison`**:
   `Comparison_ID`, `Requirement_ID`, `Dealer_ID`, `Unit_Price`, `Quantity`, `Taxes`, `Delivery_Charges`, `Estimated_Total_Cost`, `Currency`, `MOQ`, `Delivery_Time`, `Match_Status`, `Comparison_Notes`.
5. **`Search_History`**:
   `Search_ID`, `Requirement_ID`, `Search_Portal`, `Search_Date`, `Search_Status`, `Results_Count`, `Error_Message`.

---

## 3. Key Features by Page

### Page 1: Dashboard (`/`)
- Live calculated metrics: Total BOM Requirements, Suppliers Identified, Exact Matches, Partial Matches, Quotations Received, Pending RFQs.
- Recent Searches audit log and Recent Supplier Activity feed.
- Direct links to launch searches, add requirements, and run comparisons.

### Page 2: Product Requirements (`/requirements`)
- Form to define technical parameters: Material, dimensions, grade, model standard, volume, target price, delivery requirement, ISO quality terms.
- Full validation with instant feedback.
- Interactive table of all active requirements with 1-click supplier search and Excel export.

### Page 3: Dealer Search (`/search`)
- **Dual Sourcing Modes**:
  - **Text-based Search**: Select from existing BOM requirements or enter an ad-hoc product name.
  - **Image-based Search with Vision AI**:
    - Upload component photos (`.jpg`, `.png`, `.webp`).
    - Instant image preview and "Search by Image" action.
    - AI vision recognition extracts product name, category, and visible specifications (e.g. standards, markings, dimensions).
    - Review & edit identified product name before searching.
    - Low-confidence fallback prompting user verification if image is ambiguous.
- **Unified Backend Sourcing Pipeline**:
  - Image recognition converts directly into a search query and passes into the **existing supplier search workflow**, querying Live Web Search (Tavily AI), verified industrial catalogs, ThomasNet, IndiaMART, and Alibaba.
  - Results are displayed in the discovered supplier listings table with 1-click import into the Excel Sourcing Tracker and seamless navigation to Dealer Results.
- Real-time search progress indicator and transparent portal status notifications.
- 1-click batch import of discovered suppliers into the Excel tracker.
- Manual supplier entry modal when offline quotes are received.

### Page 4: Dealer Results (`/dealers`)
- Searchable by supplier name, product name, specifications, and email.
- Multi-dimensional filters: Exact/Partial Match, Verification Status, Location, Max Price.
- Sortable columns: Price, Dealer Name, Lead Time.
- Direct download button for formatted Excel export.

### Page 5: Dealer Details (`/dealers/:dealerId`)
- Complete supplier profile, catalog specifications, contact information, and website link.
- In-depth technical match analysis with explicit explanation reasons.
- Upload and download quotation documents (.pdf, .xlsx, .docx, images).
- Inline editable profile fields and verification status dropdown (`Verified`, `Pending Verification`, `Unverified`, `Rejected`).

### Page 6: Quotation Comparison (`/comparison`)
- Multi-supplier comparison matrix for the same requirement.
- Displays Unit Price, Target Difference, Taxes, Freight, MOQ, Lead Time, and Estimated Total Cost.
- Flags incomplete or unconfirmed costs explicitly (`Partial - Missing freight/taxes`).
- Multi-attribute recommendation engine that evaluates technical fit and delivery schedule, preventing naive selection of substandard lowest-price items.
- Export comparison to Excel.

### Page 7: Contact and Follow-up (`/contacts`)
- Formal RFQ inquiry letter generator with company letterhead, bill of materials specs, and commercial breakdown request.
- Strict procurement governance: requires user review and approval before outreach is logged.
- Track supplier responses, scheduled follow-up dates, and internal engineering notes.

---

## 4. Setup Instructions (Windows)

### Prerequisites
- **Python**: Version 3.10 or higher (`python --version`)
- **Node.js**: Version 18 or higher (`node -v`)

### Step 1: Clone or Navigate to the Project
```powershell
cd c:\Users\Nunes\Documents\products\manufacturing-dealer-automation
```

### Step 2: Configure & Start the FastAPI Backend
```powershell
cd backend

# 1. Install Python dependencies
python -m pip install -r requirements.txt

# 2. Configure Live Web Search and Vision AI in backend/.env:
# TAVILY_API_KEY=your_tavily_api_key_here
# (Optional) GEMINI_API_KEY=your_gemini_api_key or OPENAI_API_KEY=your_openai_api_key
# API keys are stored securely in backend/.env only and never exposed to the frontend.

# 3. Seed initial realistic manufacturing requirements & suppliers (optional, creates tracker)
python seed_data.py

# 4. Start development server
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API is now running at `http://127.0.0.1:8000`. Interactive Swagger API docs are available at `http://127.0.0.1:8000/docs`.

### Step 3: Configure & Start the React Frontend
In a new PowerShell window:
```powershell
cd c:\Users\Nunes\Documents\products\manufacturing-dealer-automation\frontend

# 1. Install frontend dependencies
npm.cmd install

# 2. Start Vite development server
npm.cmd run dev
```
The frontend is now running at `http://localhost:5173`.

---

## 5. Automated Testing

To run the backend test suite:
```powershell
cd backend
python -m pytest tests/test_api.py -v
```

This tests:
1. System health check & Excel storage availability.
2. Dashboard metrics aggregation.
3. Requirements listing and creation.
4. Supplier search against verified directory.
5. Unauthorized API key handling (compliance with portal policies).
6. Multi-attribute quotation comparison.
7. Professional RFQ inquiry generation.
8. Excel export streaming for dealers and requirements.

---

## 6. Security & Reliability Highlights

- **Thread-safe Excel Access**: Uses Python `threading.Lock()` to prevent race conditions during concurrent updates.
- **Automatic Backups**: Creates timestamped `.xlsx` backups in `data/backups/` before applying modifications.
- **Path Traversal Protection**: Uploaded files and download paths are sanitized using `pathlib.Path.resolve()` and `os.path.basename`.
- **Restricted File Types**: File uploads accept only `.pdf`, `.xlsx`, `.xls`, `.docx`, `.doc`, `.png`, and `.jpg` up to 10MB.
- **Strict Data Integrity**: No fabricated search results or fake supplier deliveries. Transparent error messages when external portal credentials are missing.


npm.cmd run dev


.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001