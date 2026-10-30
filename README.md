# Manufacturing Dealer Sourcing Automation System

The complete implementation has been updated in the `manufacturing-dealer-automation` directory:

- **Frontend**: `manufacturing-dealer-automation/frontend/` (React, Vite, Tailwind CSS, Axios, Lucide Icons, React Router)
  - Features both **Text-based Search** and **Image-based Search** (with image preview, Vision AI recognition, review & edit, and direct integration into the existing supplier pipeline).
- **Backend**: `manufacturing-dealer-automation/backend/` (FastAPI, Pydantic, pandas, openpyxl, Vision AI service)
- **Excel Storage**: `manufacturing-dealer-automation/backend/data/Dealer_Sourcing_Tracker.xlsx`

Please see [manufacturing-dealer-automation/README.md](file:///c:/Users/Nunes/Documents/products/manufacturing-dealer-automation/README.md) for full architecture details, endpoint specifications, and setup instructions.

### Quick Start (Windows PowerShell)

#### Backend:
```powershell
cd manufacturing-dealer-automation\backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

#### Frontend:
```powershell
cd manufacturing-dealer-automation\frontend
npm.cmd run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
