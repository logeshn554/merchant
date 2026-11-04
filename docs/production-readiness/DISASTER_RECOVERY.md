# AllGo Merchant Platform: Disaster Recovery & Business Continuity Plan

**Date:** 2026-11-04  
**Classification:** Operational Infrastructure & Continuity  

---

## 1. Objectives: RPO & RTO

| Metric | Target | Rationale |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 15 minutes** | For transactional order state and financial ledger records. No confirmed financial transaction data may be lost. |
| **Recovery Time Objective (RTO)** | **< 60 minutes** | Total time to restore core merchant order processing, catalog availability, and customer checkout following an infrastructure disruption. |

---

## 2. Backup & Redundancy Architecture

### 2.1 Firestore & Identity Platform
- **Multi-Region Firestore:** Distributed database replication across multi-region clusters (`asia-south1` primary / `asia-south2` secondary).
- **Scheduled Automated Backups:** Cloud Firestore managed daily backups with 30-day point-in-time recovery (PITR) retention.
- **Firebase Auth Continuity:** Google Identity Platform multi-region deployment ensures authentication services remain reachable even during zone outages.

### 2.2 Relational Financial Database (Neon PostgreSQL)
- **Automated Continuous WAL Archiving:** Point-in-time recovery enabled.
- **Automated Snapshots:** Nightly encrypted pg_dump snapshots stored in geo-redundant encrypted object storage.
- **Connection Resiliency:** Client connection pooling with automated retry and backoff on transient network drops.

---

## 3. Incident Response & Disaster Recovery Procedures

1. **Database Degradation / Outage:**
   - Client applications fail gracefully with clear offline notices (`"Order updates are temporarily unavailable. Reconnecting..."`).
   - Orders in `preparing` status remain safely recorded on device and synchronize upon reconnection.
2. **Data Restoration Drill:**
   - Operations conducts semi-annual automated backup restore drills into an isolated staging environment.
   - Restoration integrity verified by running the automated financial reconciliation suite against restored data.
