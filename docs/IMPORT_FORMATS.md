# Import / Backup formats

The Import page (Batch 4) and `scripts/migrate.mjs` accept these shapes. JSON
produced by the migration already matches; CSV columns map to the same fields.

Duplicate detection keys:
- **customers** → `normalizedName` (UPPERCASE, whitespace-collapsed `customerName`)
- **products** → `upc`
- **orders** → `orderNumber`

Existing records are **skipped** unless you confirm overwrite.

---

## Customers

**CSV columns**
```
customerName,address,city,state,postalCode,phone,email,contactName,storeType,route,notes,legacyCustomerId
```
```csv
customerName,address,city,state,postalCode,phone,email,contactName,storeType,route,notes,legacyCustomerId
BUSY BEE,86 MILL ST,SADDLE BROOK,NJ,07663,201-555-0100,,Sam,convenience,Route 1,,2
21 EXXON,1475 MCCARTER HWY,NEWARK,NJ,07104,,,,gas station,Route 2,,3
```

**JSON** (array of objects — extra migration fields like `_docId`,
`normalizedName`, `orderCount` are accepted and preserved):
```json
[
  {
    "_docId": "cust_2",
    "legacyCustomerId": 2,
    "customerName": "BUSY BEE",
    "normalizedName": "BUSY BEE",
    "address": "86 MILL ST",
    "city": "SADDLE BROOK",
    "state": "NJ",
    "postalCode": "07663",
    "active": true
  }
]
```

## Products

**CSV columns**
```
upc,productName,category,price,cost,aisle,location,notes,legacyProductId
```
```csv
upc,productName,category,price,cost,aisle,location,notes,legacyProductId
719410739126,5 HOUR EX 12CT HAWAIIAN BREEZE,energy,23.00,,1,,,1031
719410760120,5 HOUR EX 12CT BLUE RASBERRY,energy,23.00,,1,,,1032
```
`price` accepts `$23.00`, `23`, or `23.00`. Duplicate UPCs are flagged, not blocked.

**JSON**
```json
[
  {
    "_docId": "prod_1031",
    "legacyProductId": 1031,
    "upc": "719410739126",
    "productName": "5 HOUR EX 12CT HAWAIIAN BREEZE",
    "price": 23.0,
    "aisle": "1",
    "active": true
  }
]
```

## Orders

Orders are richest as **JSON** because of the items array + preserved raw text.

```json
[
  {
    "_docId": "order_69",
    "orderNumber": 69,
    "legacyOrderNumber": 69,
    "customerName": "CRANBERRY MARKET& DELI",
    "customerId": "cust_xx",
    "legacyFormat": "structured",
    "legacyOutputText": "[2] / 5 HOUR REG 12CT BERRY - $21.50 x 1\n...",
    "items": [
      { "productName": "5 HOUR REG 12CT BERRY", "aisle": "2", "price": 21.5, "quantity": 1, "customLine": false }
    ],
    "notes": "",
    "importance": "anytime_this_week",
    "status": "archived",
    "printed": true,
    "archived": true,
    "totalItems": 8,
    "totalQuantity": 18,
    "createdAt": "2023-06-29T11:41:38.000Z"
  }
]
```

**Freeform orders** carry `legacyFormat: "freeform"`, an empty `items: []`, and the
full handwritten list in `legacyOutputText` (rendered as-is in the order/print view).

**CSV for orders** (one row per order; items as the raw text block) is supported for
quick loads:
```
orderNumber,customerName,importance,status,printed,archived,notes,createdAt,outputText
```
For full item-level fidelity, prefer JSON.
