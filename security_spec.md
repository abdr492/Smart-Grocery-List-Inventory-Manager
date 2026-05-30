# Security Specification: Grocery & Inventory Manager

## 1. Data Invariants & Zero-Trust Policies
- **User Ownership Isolation**: Users can ONLY read or write keys belonging to their own Firebase UID. There is no public data sharing; every access is owner-restricted.
- **Creator Validation on Write**: When creating a document (`pantry`, `shoppingList`, `consumptionLogs`, `userSettings`), the `userId` in the payload MUST exactly match `request.auth.uid`.
- **Field-Level Constraints**:
  - `quantity`: Must be a number greater than or equal to 0.
  - `name`: Must be a string with a size between 1 and 100 characters.
  - `expiryDate` (Pantry items): Must be an ISO timestamp (validated as a string format or date).
  - `checked` (Shopping items): Must be a boolean value.
- **Immutability Rules**:
  - `userId` can never be updated or transferred once set (Identity Lock).
  - `createdAt` can never be modified.
- **System Synchronization Rules**:
  - `updatedAt` and `createdAt` must align exactly with `request.time`.

## 2. Security Test-Driven Payloads (Adversarial Draft)
The rules must forbid and deny these payloads:
1. **Unauthenticated Read**: Attempting to query `/pantry` without authentication.
2. **Accessing Another User's Pantry**: Modifying or reading doc `/pantry/1` where `userId = userB` while authenticated as `userA`.
3. **Identity Spoofing**: Creating `/pantry/1` with `userId = userB` while authenticated as `userA`.
4. **Immutability Hijack**: Updating a pantry item and changing its `userId` from `userA` to `userB` to transfer ownership.
5. **Ghost field injection**: Placing a shadow field `isAdmin: true` inside `userSettings/userA`.
6. **Negative quantities**: Creating a pantry item with `quantity: -15`.
7. **Size overload attack**: Creating an item with a 1MB item `name` to abuse Firestore resources.
8. **Malicious ID insertion**: Writing an item with a document ID containing directory traversals or special injection characters like `../admin/pantry`.
9. **Creation Timestamp Spoofing**: Attempting to set `createdAt` to a hand-crafted past/future date.
10. **Bypassing Setting Thresholds**: Attempting to craft settings with `expiryReminderDays: -5`.
11. **Bypassing Checked Type Protection**: Writing a `checked: "yes"` string string into a shoppingList item instead of a true boolean.
12. **Foreign Data Scrape**: Executing a broad read query on `/pantry` without a limiting filters constraint (prevented by strict `allow list` checking against `resource.data.userId == request.auth.uid`).
