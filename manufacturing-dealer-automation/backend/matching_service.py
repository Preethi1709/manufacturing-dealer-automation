import re
from typing import Dict, Any, Tuple, Optional

def _parse_delivery_days(delivery_str: Optional[str]) -> Optional[int]:
    """Helper to convert human delivery strings to estimated days."""
    if not delivery_str:
        return None
    s = delivery_str.lower().strip()
    match = re.search(r'(\d+)\s*(day|days|d\b)', s)
    if match:
        return int(match.group(1))
    match_weeks = re.search(r'(\d+)\s*(week|weeks|wk|wks)', s)
    if match_weeks:
        return int(match_weeks.group(1)) * 7
    match_months = re.search(r'(\d+)\s*(month|months|mo)', s)
    if match_months:
        return int(match_months.group(1)) * 30
    return None

def _contains_spec_keywords(target_spec: str, source_text: str) -> bool:
    """Checks if key significant terms (e.g. 316L, 12.9, DIN 912, 6205) exist in text."""
    if not target_spec or not source_text:
        return False
    clean_target = target_spec.lower().strip()
    clean_source = source_text.lower().strip()
    
    # Direct substring match
    if clean_target in clean_source:
        return True

    # Check key alphanumeric tokens (like 316l, ss316, din912, 12.9, gcr15, abec-3)
    tokens = re.findall(r'[a-zA-Z0-9\.\-]+', clean_target)
    significant_tokens = [t for t in tokens if len(t) >= 2 and t not in {"and", "for", "with", "the", "standard", "grade", "class", "steel", "material"}]
    
    if not significant_tokens:
        return False

    return any(tok in clean_source for tok in significant_tokens)

class MatchingService:
    @staticmethod
    def evaluate_product_match(requirement: Dict[str, Any], dealer: Dict[str, Any]) -> Dict[str, Any]:
        """
        Comprehensive product-level evaluation comparing a manufacturing requirement
        against candidate supplier listings (manufacturer, distributor, IndiaMART, or verified directory).
        Returns a rich structured dictionary:
        - status: 'Exact Match', 'Partial Match', 'Related Product', 'Needs Verification', 'Not a Match'
        - reason: summary explanation
        - matching_specs: list of verified specifications
        - missing_specs: list of unconfirmed/differing specifications
        - match_evidence: narrative explanation of match tier classification
        - model_number: detected model/part number
        - is_product_page: bool indicating whether URL is a specific product listing
        """
        reasons = []
        matching_specs = []
        missing_specs = []
        is_exact = True
        is_partial = False
        is_related = False
        is_incompatible = False
        needs_verification = False

        req_name = (requirement.get("product_name") or "").lower()
        req_spec_text = (requirement.get("specifications") or "").lower()
        req_category = (requirement.get("category") or "").lower()
        req_combined = f"{req_name} {req_spec_text} {req_category}"

        dlr_name = (dealer.get("product_name") or "").lower()
        dlr_specs = (dealer.get("specifications") or "").lower()
        full_dlr_text = f"{dlr_name} {dlr_specs}"
        dlr_url = (dealer.get("product_url") or "").lower()
        is_web_discovery = (
            dealer.get("verification_status") == "Unverified"
            or (dealer.get("source_portal") and "live web" in str(dealer.get("source_portal")).lower())
        )

        # 1. Product Page vs Directory/Aggregator Page Analysis
        is_product_page = any(seg in dlr_url for seg in ["/proddetail/", "/product/", "/p/", "/item/", "/pd/", "/catalog/", ".pdf"])
        is_aggregator_page = any(seg in dlr_url for seg in ["/impcat/", "/search/", "/categories/", "/dir/", "/companies/"])
        if is_aggregator_page:
            reasons.append("Directory category page: individual product model requires direct listing verification.")
            missing_specs.append("Individual product datasheet (directory category page)")
            is_exact = False
            needs_verification = True
        elif is_product_page:
            matching_specs.append("Direct supplier product page verified")

        # 2. Model & Part Number Extraction & Matching
        req_model = requirement.get("model") or requirement.get("model_number")
        if not req_model:
            # Extract common industrial model patterns (e.g. 6205-2RS, DP1001AM, DIN 912, SS316L, PMD-MXT)
            model_matches = re.findall(r'\b[A-Z0-9]{2,}[-_][A-Z0-9]{2,}\b|\b\d{4}[A-Z0-9\-]{2,}\b|\bDIN\s*\d+\b|\bISO\s*\d+\b', f"{req_name} {req_spec_text}", re.IGNORECASE)
            if model_matches:
                req_model = model_matches[0]

        detected_dlr_model = None
        dlr_model_matches = re.findall(r'\b[A-Z0-9]{2,}[-_][A-Z0-9]{2,}\b|\b\d{4}[A-Z0-9\-]{2,}\b|\bDIN\s*\d+\b|\bISO\s*\d+\b', f"{dlr_name} {dlr_specs}", re.IGNORECASE)
        if dlr_model_matches:
            detected_dlr_model = dlr_model_matches[0]

        if req_model:
            clean_req_m = req_model.lower().replace(" ", "").replace("-", "")
            clean_dlr_text = full_dlr_text.replace(" ", "").replace("-", "")
            if clean_req_m in clean_dlr_text:
                matching_specs.append(f"Model/Part number verified: {req_model}")
                reasons.append(f"Exact model designation '{req_model}' confirmed.")
            else:
                missing_specs.append(f"Target model '{req_model}' not explicitly verified in listing")

        # 3. Product Family & Instrumentation Analysis
        is_req_temp_scanner = ("scanner" in req_name or "scanner" in req_spec_text) and any(
            t in req_combined for t in ["temp", "temperature", "channel", "thermal"]
        )
        is_dlr_barcode = "barcode" in full_dlr_text

        if is_req_temp_scanner and is_dlr_barcode:
            reasons.append("Product mismatch: Result is a retail/logistics barcode scanner, not an industrial temperature monitoring scanner.")
            missing_specs.append("Industrial temperature monitoring functionality")
            is_incompatible = True
        elif is_req_temp_scanner:
            has_temp = any(t in full_dlr_text for t in ["temperature", "temp", "thermal", "rtd", "thermocouple", "pt100"])
            has_instrument = any(t in full_dlr_text for t in ["scanner", "indicator", "data logger", "logger", "monitor", "monitoring", "controller", "recorder", "meter"])
            has_channels = any(t in full_dlr_text for t in ["multi-channel", "multichannel", "multi channel", "multipoint", "multi-point", "channel", "channels"])

            if not has_temp:
                reasons.append(f"Product mismatch: '{dealer.get('product_name')}' does not measure or monitor temperature.")
                missing_specs.append("Temperature measurement capability")
                is_incompatible = True
            elif has_temp and not has_instrument:
                reasons.append(f"Product distinction: '{dealer.get('product_name')}' represents sensor probes/transmitters rather than a multi-channel temperature scanner instrument.")
                matching_specs.append("Temperature sensor probe compatibility")
                missing_specs.append("Dedicated multi-point scanner / display instrument")
                is_exact = False
                needs_verification = True
            elif has_temp and has_instrument:
                matching_specs.append("Temperature monitoring instrumentation")
                
                # Check channel count alignment
                ch_req_match = re.search(r'\b(\d{1,2})\s*(?:-| )?(?:display\s+|input\s+)?channels?\b', req_combined)
                ch_dlr_match = re.search(r'\b(\d{1,2})\s*(?:-| )?(?:display\s+|input\s+)?channels?\b', full_dlr_text)

                if ch_req_match and ch_dlr_match:
                    req_ch = int(ch_req_match.group(1))
                    dlr_ch = int(ch_dlr_match.group(1))
                    if req_ch == dlr_ch:
                        matching_specs.append(f"Channel count verified: {req_ch} channels")
                        reasons.append(f"Channel capacity matches requirement ({req_ch} channels).")
                    else:
                        missing_specs.append(f"Channel capacity: {dlr_ch} channels (target: {req_ch} channels)")
                        reasons.append(f"Channel count differs ({dlr_ch} channels vs required {req_ch} channels).")
                        is_exact = False
                        is_related = True
                elif has_channels or "scanner" in full_dlr_text:
                    matching_specs.append("Multi-channel scanning capability")
                    reasons.append("Temperature scanner / indicator instrumentation capability confirmed.")
                else:
                    missing_specs.append("Multi-channel scanning architecture")
                    reasons.append("Temperature instrumentation identified; multi-channel capacity requires verification.")
                    is_exact = False
                    needs_verification = True

                # Check sensor input types (RTD, Thermocouple, Universal)
                if any(t in full_dlr_text for t in ["rtd", "pt100"]):
                    matching_specs.append("RTD Pt100 sensor input support")
                if any(t in full_dlr_text for t in ["thermocouple", "tc input"]):
                    matching_specs.append("Thermocouple (TC) input support")
                if any(t in full_dlr_text for t in ["universal input", "configurable input"]):
                    matching_specs.append("Universal multi-sensor input support")

                # Check form factor (DIN panel mount, rear terminals)
                if any(t in full_dlr_text for t in ["panel mount", "1/4 din", "1/8 din", "din panel", "flush mount"]):
                    matching_specs.append("DIN panel-mount enclosure")
                if any(t in full_dlr_text for t in ["terminal", "terminals", "rear connection", "screw terminal"]):
                    matching_specs.append("Rear multi-point sensor terminal blocks")

        else:
            # General industrial manufacturing part matching
            req_keywords = set(re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', req_name))
            dlr_keywords = set(re.findall(r'\b[a-zA-Z0-9_\-]{3,}\b', full_dlr_text))
            stop_modifiers = {"digital", "automatic", "standard", "high", "precision", "industrial", "type", "with", "for", "and", "component", "parts"}
            substantive_req = req_keywords - stop_modifiers
            if not substantive_req:
                substantive_req = req_keywords

            overlap = substantive_req.intersection(dlr_keywords)

            if not overlap and req_name not in dlr_name and dlr_name not in req_name:
                reasons.append(f"Product type mismatch: '{dealer.get('product_name')}' vs required '{requirement.get('product_name')}'.")
                missing_specs.append("Core product type alignment")
                is_incompatible = True
            else:
                matching_specs.append(f"Product type alignment ({', '.join(list(overlap)[:3]) if overlap else 'Name match'})")
                reasons.append("Product type alignment verified.")

        # 4. Material Matching
        req_mat = requirement.get("material") or ""
        if req_mat:
            if _contains_spec_keywords(req_mat, dlr_specs) or _contains_spec_keywords(req_mat, dlr_name):
                matching_specs.append(f"Material: {req_mat}")
                reasons.append(f"Material specification confirmed ({req_mat}).")
            else:
                missing_specs.append(f"Material grade '{req_mat}' unconfirmed")
                reasons.append(f"Material '{req_mat}' not explicitly confirmed in supplier catalog.")
                is_exact = False
                needs_verification = True

        # 5. Grade / Standard Matching
        req_grade = requirement.get("grade") or ""
        if req_grade:
            if _contains_spec_keywords(req_grade, dlr_specs) or _contains_spec_keywords(req_grade, dlr_name):
                matching_specs.append(f"Standard/Grade: {req_grade}")
                reasons.append(f"Grade/standard verified ({req_grade}).")
            else:
                missing_specs.append(f"Quality standard '{req_grade}' unconfirmed")
                reasons.append(f"Quality grade '{req_grade}' needs supplier documentation.")
                is_exact = False
                needs_verification = True

        # 6. Dimensions & Size Matching
        req_size = requirement.get("size") or ""
        if req_size:
            if _contains_spec_keywords(req_size, dlr_specs) or _contains_spec_keywords(req_size, dlr_name):
                matching_specs.append(f"Dimensions: {req_size}")
                reasons.append(f"Dimensions/size matching ({req_size}).")
            else:
                missing_specs.append(f"Dimensions '{req_size}' require drawing/catalog check")
                reasons.append(f"Dimensional specs ({req_size}) require drawing review.")
                is_exact = False

        # 7. Price, MOQ & Lead Time Analysis
        unit_price = dealer.get("confirmed_quoted_price") if dealer.get("confirmed_quoted_price") is not None else dealer.get("listed_price")
        target_price = requirement.get("target_price")
        curr = requirement.get("currency", "USD")

        if unit_price is None or unit_price <= 0:
            missing_specs.append("Commercial pricing quotation")
            reasons.append("Unit price unconfirmed; formal quotation required.")
            if not is_web_discovery:
                is_exact = False
                needs_verification = True
        elif target_price and target_price > 0:
            price_ratio = unit_price / target_price
            if price_ratio <= 1.0:
                matching_specs.append(f"Listed price within budget ({curr} {unit_price:.2f})")
                reasons.append(f"Price {curr} {unit_price:.2f} within target {curr} {target_price:.2f} (Savings: {(1 - price_ratio)*100:.1f}%).")
            elif price_ratio <= 1.15:
                matching_specs.append(f"Listed price within 15% tolerance ({curr} {unit_price:.2f})")
                reasons.append(f"Price {curr} {unit_price:.2f} within 15% tolerance of target {curr} {target_price:.2f}.")
                is_exact = False
                is_partial = True
            elif price_ratio <= 1.35:
                missing_specs.append(f"Price exceeds budget by {(price_ratio - 1)*100:.1f}%")
                reasons.append(f"Price {curr} {unit_price:.2f} exceeds target {curr} {target_price:.2f} by {(price_ratio - 1)*100:.1f}%.")
                is_exact = False
                is_partial = True
            else:
                reasons.append(f"Price {curr} {unit_price:.2f} significantly exceeds target budget {curr} {target_price:.2f}.")
                is_incompatible = True

        # 8. Delivery Schedule Compatibility
        req_delivery = requirement.get("delivery_requirement")
        dlr_delivery = dealer.get("delivery_time")
        req_days = _parse_delivery_days(req_delivery)
        dlr_days = _parse_delivery_days(dlr_delivery)

        if req_days and dlr_days:
            if dlr_days <= req_days:
                matching_specs.append(f"Lead time: {dlr_delivery}")
                reasons.append(f"Lead time ({dlr_delivery}) satisfies project timeline ({req_delivery}).")
            elif dlr_days <= req_days * 1.3:
                missing_specs.append(f"Lead time slightly exceeds timeline ({dlr_delivery})")
                is_exact = False
                is_partial = True
            else:
                reasons.append(f"Lead time ({dlr_delivery}) is unacceptable for urgent schedule ({req_delivery}).")
                is_incompatible = True
        elif dlr_delivery:
            matching_specs.append(f"Quoted lead time: {dlr_delivery}")
            reasons.append(f"Quoted lead time: {dlr_delivery}.")
        else:
            missing_specs.append("Delivery lead time unconfirmed")
            reasons.append("Lead time not specified; requires confirmation.")
            if not is_web_discovery:
                is_exact = False

        # 9. Preferred Location Compatibility
        pref_loc = (requirement.get("preferred_location") or "").lower().strip()
        dlr_loc = (dealer.get("location") or "").lower().strip()
        if pref_loc:
            if _contains_spec_keywords(pref_loc, dlr_loc):
                matching_specs.append(f"Region: {dealer.get('location')}")
                reasons.append(f"Supplier location ({dealer.get('location')}) meets regional preference ({requirement.get('preferred_location')}).")
            else:
                missing_specs.append(f"Target location '{requirement.get('preferred_location')}' (found: '{dealer.get('location')}')")
                reasons.append(f"Supplier located in '{dealer.get('location')}' (target region: '{requirement.get('preferred_location')}').")

        # 10. Classification Synthesis
        if is_incompatible:
            status = "Not a Match"
            evidence = "Supplier offering represents a non-matching component or different product category."
        elif is_related:
            status = "Related Product"
            evidence = "Supplier offers an adjacent component or alternative channel configuration from the same product family."
        elif is_exact and not needs_verification:
            status = "Exact Match"
            evidence = "Identified product listing satisfies technical requirements, form factor, and core specifications."
        elif is_partial:
            status = "Partial Match"
            evidence = "Product aligns with core technical function; secondary specifications or commercial terms require review."
        elif needs_verification:
            status = "Needs Verification"
            evidence = "Preliminary listing match; formal supplier documentation or quotation is required to confirm full compatibility."
        else:
            status = "Partial Match"
            evidence = "Product offering demonstrates partial technical alignment with procurement specifications."

        full_reason = " | ".join(reasons)
        return {
            "status": status,
            "reason": full_reason,
            "matching_specs": matching_specs,
            "missing_specs": missing_specs,
            "match_evidence": evidence,
            "model_number": detected_dlr_model or req_model,
            "is_product_page": is_product_page
        }

    @staticmethod
    def evaluate_match(requirement: Dict[str, Any], dealer: Dict[str, Any]) -> Tuple[str, str]:
        """
        Backward-compatible match evaluator returning (status: str, reason: str).
        """
        res = MatchingService.evaluate_product_match(requirement, dealer)
        return res["status"], res["reason"]
