# AllGo Financial Accounting, Settlement & Reconciliation Specification

**Date:** 2026-11-04  
**Scope:** Order Ledgers, Merchant Settlements, Gateway Reconciliation, and Tax Line Items  

---

## 1. Principles of Financial Integrity

1. **Exact Integer Minor Units:** All monetary values (INR paise / cents) are stored and computed exclusively as integers. Never use floating-point numbers for money.
2. **Immutable Double-Entry Ledger:** Financial transactions cannot be mutated or deleted. Corrections are made via offsetting debit/credit reversal entries.
3. **Server-Authoritative Calculation:** Client-provided prices, taxes, discounts, or delivery fees are discarded; authoritative quotes and checkout calculations are recomputed on the backend against current published catalog records.
4. **Idempotent Webhooks & Payouts:** Every payment webhook and payout operation carries a unique deterministic idempotency key (`ord_{bookingId}_{transition}`).

---

## 2. Order Settlement Line-Item Formula

For each completed order, the net merchant payable is calculated as follows:

$$\text{Customer Paid} = \text{Item Total} + \text{Packaging Fee} + \text{Delivery Fee} + \text{Taxes} - \text{Discounts}$$

$$\text{Merchant Gross} = \text{Item Total} + \text{Packaging Fee}$$

$$\text{Platform Commission} = \text{Item Total} \times \left(\frac{\text{Commission BPS}}{10000}\right)$$

$$\text{TCS (Sec 52)} = \text{Taxable Item Value} \times 1\% \quad (\text{if applicable})$$

$$\text{GST on Commission} = \text{Platform Commission} \times 18\%$$

$$\text{Net Merchant Payable} = \text{Merchant Gross} - \text{Platform Commission} - \text{GST on Commission} - \text{TCS}$$

*Example (AllGo 10% commission on ₹500 order):*
- Item Total: ₹50,000 paise (₹500.00)
- Platform Commission (1000 bps): ₹5,000 paise (₹50.00)
- GST on Commission (18%): ₹900 paise (₹9.00)
- TCS (1%): ₹500 paise (₹5.00)
- **Net Merchant Payable:** ₹50,000 - ₹5,000 - ₹900 - ₹500 = **₹43,600 paise (₹436.00)**

---

## 3. Daily Reconciliation Runbook

1. **Gateway vs. Orders:** Compare total settled funds in Razorpay/Bank statement against sum of completed orders with `paymentStatus: 'paid'`.
2. **Merchant Ledger vs. Payouts:** Ensure sum of `merchant_ledger` payable entries matches the aggregate available balance in `merchant_balances`.
3. **Discrepancy Resolution:** Any discrepancy greater than ₹0 paise automatically raises an alert in the Operations Hub for manual investigation.
