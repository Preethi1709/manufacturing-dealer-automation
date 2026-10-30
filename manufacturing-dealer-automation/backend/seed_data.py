import os
from datetime import datetime
from excel_service import ExcelService
from matching_service import MatchingService

def seed_sample_data():
    excel_svc = ExcelService(file_path="data/Dealer_Sourcing_Tracker.xlsx")
    
    # 1. Product Requirements
    sample_requirements = [
        {
            "product_name": "Stainless Steel Precision Shaft SS316L",
            "category": "Precision Machined Parts",
            "specifications": "CNC turned ground linear shaft, Material: SS 316L, Diameter: 25mm (+/-0.005mm), Length: 300mm, Ra 0.4 surface finish, Passivated, ISO 9001",
            "material": "SS 316L",
            "size": "Dia 25mm x 300mm",
            "grade": "316L Stainless",
            "model": "PS-25-300-316",
            "quantity": 500,
            "target_price": 20.00,
            "currency": "USD",
            "preferred_location": "USA / North America",
            "delivery_requirement": "14 days",
            "additional_requirements": "Material test certificate (MTR) required. Clean deburred edges."
        },
        {
            "product_name": "Deep Groove Ball Bearing 6205-2RS",
            "category": "Bearings & Power Transmission",
            "specifications": "Radial ball bearing, Chrome Steel GCr15 / 52100, Bore: 25mm, Outer Dia: 52mm, Width: 15mm, Rubber Seals (2RS), C3 internal clearance",
            "material": "Chrome Steel GCr15",
            "size": "25x52x15 mm",
            "grade": "ABEC-3 / P6",
            "model": "6205-2RS-C3",
            "quantity": 1000,
            "target_price": 5.50,
            "currency": "USD",
            "preferred_location": "Midwest USA",
            "delivery_requirement": "7 days",
            "additional_requirements": "Individual anti-corrosion packaging, 100% noise/vibration tested."
        },
        {
            "product_name": "Hex Socket Head Cap Screws DIN 912 M8x40",
            "category": "Fasteners & Hardware",
            "specifications": "High-tensile Alloy Steel Grade 12.9, Thread: M8 x 1.25 pitch, Length: 40mm, Black oxide finish, DIN 912 / ISO 4762 standard",
            "material": "Alloy Steel Grade 12.9",
            "size": "M8 x 40mm",
            "grade": "Class 12.9",
            "model": "DIN 912 / ISO 4762",
            "quantity": 10000,
            "target_price": 0.45,
            "currency": "USD",
            "preferred_location": "North America",
            "delivery_requirement": "10 days",
            "additional_requirements": "Bulk boxed in 500 pcs per carton, lot traceable."
        },
        {
            "product_name": "Injection Molded Spur Gear POM-C 2.0 Module",
            "category": "Polymers & Plastics",
            "specifications": "Polyoxymethylene (POM-C Acetal), 30 Teeth, Module 2.0, Pitch Dia 60mm, Face Width 15mm, Bore 12mm with DIN 6885/1 keyway",
            "material": "POM-C Acetal",
            "size": "Module 2.0, Dia 60mm",
            "grade": "Engineering Grade POM",
            "model": "SG-POM-M2-30T",
            "quantity": 800,
            "target_price": 7.00,
            "currency": "USD",
            "preferred_location": "Europe or North America",
            "delivery_requirement": "21 days",
            "additional_requirements": "Burr-free injection mold, dimension report per first 10 parts."
        }
    ]

    created_reqs = []
    for r in sample_requirements:
        req_obj = excel_svc.create_requirement(r)
        created_reqs.append(req_obj)
        print(f"Created requirement: {req_obj['requirement_id']} - {req_obj['product_name']}")

    # 2. Seed Dealers for Requirements
    req1 = created_reqs[0]
    req2 = created_reqs[1]
    req3 = created_reqs[2]

    dealers_data = [
        # For Req 1 (SS316L Shaft)
        {
            "requirement_id": req1["requirement_id"],
            "dealer_name": "Apex Precision CNC Machining Ltd.",
            "product_name": "Stainless Steel Precision Shaft SS316L",
            "specifications": "CNC turned ground linear shaft, Material: SS 316L, Diameter: 25mm (+/-0.005mm), Length: 300mm, Ra 0.4 surface finish, Passivated, ISO 9001 certified",
            "public_contact_number": "+1-800-555-0142",
            "business_email": "sales@apexprecisionmfg.com",
            "location": "Cleveland, OH, USA",
            "source_portal": "Verified Industrial Directory",
            "product_url": "https://www.apexprecisionmfg.com/catalog/shafts-ss316",
            "listed_price": 18.50,
            "confirmed_quoted_price": 18.00,
            "currency": "USD",
            "moq": 100,
            "taxes": 180.00,
            "delivery_charges": 120.00,
            "delivery_time": "12 days",
            "verification_status": "Verified"
        },
        {
            "requirement_id": req1["requirement_id"],
            "dealer_name": "Midwest Metal Turnings Corp.",
            "product_name": "Precision Turned Shaft SS304",
            "specifications": "Ground bar stock, Material: SS 304, Diameter: 25mm, Length: 300mm, commercial tolerance (+/-0.02mm)",
            "public_contact_number": "+1-888-555-0188",
            "business_email": "quotes@midwestmetalturn.com",
            "location": "Gary, IN, USA",
            "source_portal": "Manual Entry",
            "product_url": "https://www.midwestmetalturn.com/parts/shaft25",
            "listed_price": 16.50,
            "confirmed_quoted_price": 16.50,
            "currency": "USD",
            "moq": 50,
            "taxes": 165.00,
            "delivery_charges": 95.00,
            "delivery_time": "10 days",
            "verification_status": "Verified"
        },
        {
            "requirement_id": req1["requirement_id"],
            "dealer_name": "Shenzhen Precision CNC Alloy Co.",
            "product_name": "CNC Turned SS316 Shaft",
            "specifications": "Material: SS 316L, 25mm dia x 300mm, surface Ra 0.8, sea freight or air courier",
            "public_contact_number": "+86-755-555-0112",
            "business_email": "export@shenzhenprecisioncnc.com",
            "location": "Shenzhen, Guangdong, China",
            "source_portal": "Verified Industrial Directory",
            "product_url": "https://www.shenzhenprecisioncnc.com/shafts/ss316",
            "listed_price": 12.30,
            "confirmed_quoted_price": 11.80,
            "currency": "USD",
            "moq": 300,
            "taxes": None,
            "delivery_charges": 350.00,
            "delivery_time": "25 days",
            "verification_status": "Pending Verification"
        },
        # For Req 2 (Bearing 6205-2RS)
        {
            "requirement_id": req2["requirement_id"],
            "dealer_name": "Koyo & NSK Authorized Industrial Supply",
            "product_name": "Deep Groove Ball Bearing 6205-2RS",
            "specifications": "Radial ball bearing, Chrome Steel GCr15 / 52100, Bore: 25mm, OD: 52mm, Width: 15mm, Rubber Seals (2RS), C3 internal clearance, ISO 9001 certified",
            "public_contact_number": "+1-888-555-0199",
            "business_email": "orders@indpowerbearing.com",
            "location": "Chicago, IL, USA",
            "source_portal": "Verified Industrial Directory",
            "product_url": "https://www.indpowerbearing.com/bearings/6205-2rs",
            "listed_price": 4.85,
            "confirmed_quoted_price": 4.60,
            "currency": "USD",
            "moq": 100,
            "taxes": 230.00,
            "delivery_charges": 80.00,
            "delivery_time": "5 days",
            "verification_status": "Verified"
        },
        {
            "requirement_id": req2["requirement_id"],
            "dealer_name": "Continental Bearing Distributors",
            "product_name": "Standard Radial Bearing 6205-ZZ (Metal Shield)",
            "specifications": "Steel 52100, 25x52x15mm, Metal Shields (ZZ) instead of rubber seal (2RS), standard clearance",
            "public_contact_number": "+1-800-555-0912",
            "business_email": "sales@continentalbearing.com",
            "location": "Indianapolis, IN, USA",
            "source_portal": "Manual Entry",
            "product_url": "https://www.continentalbearing.com/item/6205zz",
            "listed_price": 3.90,
            "confirmed_quoted_price": 3.75,
            "currency": "USD",
            "moq": 50,
            "taxes": 187.50,
            "delivery_charges": 60.00,
            "delivery_time": "4 days",
            "verification_status": "Verified"
        },
        # For Req 3 (DIN 912 Screws)
        {
            "requirement_id": req3["requirement_id"],
            "dealer_name": "Trident Fasteners & Hardware Corp.",
            "product_name": "Hex Socket Head Cap Screws DIN 912 M8x40",
            "specifications": "High-tensile Alloy Steel Grade 12.9, Thread: M8 x 1.25 pitch, Length: 40mm, Black oxide finish, DIN 912 / ISO 4762 standard",
            "public_contact_number": "+1-844-555-0177",
            "business_email": "quotes@tridentfasteners.com",
            "location": "Detroit, MI, USA",
            "source_portal": "Verified Industrial Directory",
            "product_url": "https://www.tridentfasteners.com/fasteners/din912-m8x40",
            "listed_price": 0.42,
            "confirmed_quoted_price": 0.39,
            "currency": "USD",
            "moq": 1000,
            "taxes": 195.00,
            "delivery_charges": 75.00,
            "delivery_time": "7 days",
            "verification_status": "Verified"
        }
    ]

    created_dealers = []
    for d in dealers_data:
        # Calculate matching
        req_matching = next(r for r in created_reqs if r["requirement_id"] == d["requirement_id"])
        status_calc, reason_calc = MatchingService.evaluate_match(req_matching, d)
        d["match_status"] = status_calc
        d["match_reason"] = reason_calc
        dlr_obj = excel_svc.create_dealer(d)
        created_dealers.append(dlr_obj)
        print(f"Created dealer: {dlr_obj['dealer_id']} - {dlr_obj['dealer_name']} ({status_calc})")

    # 3. Seed Contact Log
    contact_samples = [
        {
            "dealer_id": created_dealers[0]["dealer_id"],
            "requirement_id": req1["requirement_id"],
            "contact_method": "Email",
            "inquiry_message": "Formal RFQ sent requesting quotation for 500 pcs SS 316L ground shaft. Required lead time 14 days.",
            "contact_date": "2026-10-25",
            "response_status": "Responded",
            "dealer_response": "Received formal quotation #APX-4491 for $18.00/unit. Confirmed 12-day lead time and full MTR certification.",
            "follow_up_date": "2026-11-05",
            "notes": "Top supplier contender for CNC shaft procurement."
        },
        {
            "dealer_id": created_dealers[1]["dealer_id"],
            "requirement_id": req1["requirement_id"],
            "contact_method": "Email",
            "inquiry_message": "Inquiry regarding whether material grade can be upgraded to SS 316L rather than SS 304.",
            "contact_date": "2026-10-26",
            "response_status": "Pending",
            "dealer_response": None,
            "follow_up_date": "2026-10-31",
            "notes": "Awaiting metallurgist confirmation on raw bar stock availability."
        },
        {
            "dealer_id": created_dealers[3]["dealer_id"],
            "requirement_id": req2["requirement_id"],
            "contact_method": "RFQ Form",
            "inquiry_message": "Submitted online RFQ for 1,000 units 6205-2RS deep groove ball bearings.",
            "contact_date": "2026-10-27",
            "response_status": "Responded",
            "dealer_response": "Quoted $4.60/unit for volume of 1,000 units. Available ex-stock Chicago warehouse.",
            "follow_up_date": "2026-11-02",
            "notes": "Excellent pricing below target $5.50."
        }
    ]

    for c in contact_samples:
        excel_svc.create_contact(c)

    # 4. Seed Search History
    excel_svc.log_search({
        "requirement_id": req1["requirement_id"],
        "search_portal": "Verified Industrial Directory",
        "search_status": "COMPLETED",
        "results_count": 2,
        "error_message": None
    })
    excel_svc.log_search({
        "requirement_id": req2["requirement_id"],
        "search_portal": "Verified Industrial Directory",
        "search_status": "COMPLETED",
        "results_count": 1,
        "error_message": None
    })

    print("Data seeding completed successfully!")

if __name__ == "__main__":
    seed_sample_data()
