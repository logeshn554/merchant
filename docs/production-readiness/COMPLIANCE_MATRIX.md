# AllGo India Regulatory & E-Commerce Compliance Matrix

**Date:** 2026-11-04  
**Jurisdiction:** Republic of India  
**Scope:** Multi-vendor Food, Grocery, Homemade Goods, and Local Delivery Marketplace  

---

## 1. Compliance Matrix Overview

This matrix identifies the statutory requirements applicable to AllGo as an e-commerce marketplace operator, food business operator (FBO), and technology platform operating in India.

| Domain | Legislation / Regulation | Responsible Entity | Required Evidence / Control | System Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Food Safety** | Food Safety and Standards Act, 2006 & FSSAI (Licensing & Registration of Food Businesses) Regulations, 2011 | Merchant (FBO) & AllGo (E-Commerce FBO) | 14-digit FSSAI License or Registration certificate; display on merchant storefront and invoices. | **Implemented in Schema & Verification Flow:** `fssaiNumber`, license validity date, FoSCoS category validation. |
| **Food Safety** | FSSAI E-Commerce Guidelines & FoSCoS Category Rules | Merchant & AllGo | Mandatory display of ingredients, allergens, nutritional info, veg/non-veg logo (green/brown dot), shelf-life, storage conditions. | **Implemented in Catalog Envelope:** `allergenList`, `isVegetarian`, `ingredients`, `bestBeforeDate`, `storageInstructions`. |
| **Direct Tax & GST** | CGST / SGST / IGST Act, 2017 (Section 52 TCS & Section 9(5)) | AllGo & Merchant | Valid GSTIN verification; 0.5% CGST + 0.5% SGST TCS collection on taxable supplies; Section 9(5) restaurant service liability handling. | **Modelled in Settlement Policy:** Configurable tax rules, GSTIN format validation, separate TCS line items in ledger. |
| **Legal Metrology** | Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011 | Merchant (Packer/Manufacturer) | Mandatory declarations on e-commerce: Name/address of manufacturer/packer, country of origin, net quantity, MRP (inclusive of all taxes). | **Implemented in Product Model:** Declarations enforced for packaged goods and handmade edibles; MRP strictly verified >= sale price. |
| **Consumer Protection** | Consumer Protection (E-Commerce) Rules, 2020 & 2026 Amendments (Effective Jan 1, 2027) | AllGo Marketplace | Clear disclosure of platform legal entity, Grievance Officer name and contact, 48-hour ticket acknowledgement, 30-day resolution, no dark patterns. | **System Controls:** Dedicated Grievance Officer details in app footer/legal, ticketed dispute tracking, explicit breakdown of charges before payment. |
| **Data Privacy** | Digital Personal Data Protection Act, 2023 (DPDP Act) & DPDP Rules, 2025 | AllGo Data Fiduciary | Purpose limitation, data minimization, clear bilingual consent notices, user right to data erasure/export, no unnecessary identity storage. | **System Controls:** Private bucket rules for merchant KYC docs, AccountDataExport feature, explicit account deletion workflow. |
| **Cybersecurity** | CERT-In Directions under Section 70B of Information Technology Act, 2000 | AllGo Platform Ops | Mandatory 6-hour incident reporting for critical cybersecurity events, accurate NTP synchronized audit logs, 180-day log retention. | **Operational Controls:** Server logs synchronized with UTC/IST, immutable audit trail in Firestore and PostgreSQL journal. |

---

## 2. Food Safety (FSSAI) Categorization

Different business types require different regulatory treatments under FSSAI:
1. **Petty Food Business / Home Kitchen (Turnover < ₹12 Lakhs/year):** Requires FSSAI Registration (Form A).
2. **Medium Restaurant / Cloud Kitchen / Bakery (Turnover ₹12 Lakhs - ₹20 Crores/year):** Requires FSSAI State License (Form B).
3. **Large / Multi-State Operations (Turnover > ₹20 Crores/year or Import/Export):** Requires FSSAI Central License.
4. **AllGo Platform (E-Commerce Food Business Operator):** Must hold Central FSSAI License as an E-Commerce Marketplace.

*System Rule:* No food business (restaurant, home kitchen, baker, pickle maker) can be transitioned to `active` or accept customer orders without an uploaded, verified FSSAI certificate and valid expiry date.

---

## 3. GST & Tax Settlement Architecture

- **Restaurant Food Orders (Sec 9(5)):** AllGo is liable to pay GST on behalf of restaurants for notified restaurant services delivered via the platform.
- **Packaged Groceries / Non-Notified Supplies (Sec 52):** Seller is liable for output GST; AllGo collects and remits Tax Collected at Source (TCS) under Section 52 at 1% (0.5% CGST + 0.5% SGST or 1% IGST) and files GSTR-8 monthly.
- **Commission Tax Invoice:** AllGo issues a GST tax invoice to the merchant for platform commission and delivery fees (18% GST).
