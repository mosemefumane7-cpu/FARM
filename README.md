# Batloung Farm API (Node.js + Express + MySQL)

REST API for the Batloung Farm Distribution Management System.

## Setup

```bash
cd server
npm install
cp .env.example .env      # then fill in your MySQL credentials
mysql -u root -p < ../database/schema.sql
npm run dev               # http://localhost:4000
```

`GET /api/health` reports database connectivity without crashing the process when
MySQL is unreachable.

## Project structure

```
server/
├── .env.example
├── package.json
└── src/
    ├── app.js                    # Express app, CORS, JSON parsing
    ├── server.js                 # bootstrap + graceful DB failure handling
    ├── config/db.js              # mysql2 pool, testConnection, withTransaction
    ├── middleware/
    │   ├── errorHandler.js       # ApiError, asyncHandler, MySQL error mapping
    │   └── validate.js           # field, enum, date and line-item validation
    ├── models/                   # SQL queries only
    │   ├── supplierModel.js
    │   ├── fruitModel.js         # fruits, stock, prices
    │   ├── vendorModel.js
    │   └── tradeModel.js         # purchases, sales, payments, reports
    ├── controllers/              # request handling + business rules
    │   ├── supplierController.js
    │   ├── fruitController.js
    │   ├── vendorController.js
    │   └── tradeController.js
    └── routes/                   # endpoint definitions
        ├── index.js
        ├── supplierRoutes.js
        ├── fruitRoutes.js
        ├── stockRoutes.js
        ├── vendorRoutes.js
        └── tradeRoutes.js
```

## Endpoints

### Suppliers

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/suppliers` | List all suppliers |
| GET | `/api/suppliers/:id` | Retrieve one supplier |
| POST | `/api/suppliers` | Register a supplier |
| PUT | `/api/suppliers/:id` | Update supplier details |
| DELETE | `/api/suppliers/:id` | Delete — blocked when purchase records exist |

### Fruits, stock and prices

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/fruits` | List all fruits |
| GET | `/api/fruits/:id` | Retrieve one fruit |
| POST | `/api/fruits` | Register a fruit (creates 3 stock rows) |
| PUT | `/api/fruits/:id` | Update fruit details |
| DELETE | `/api/fruits/:id` | Delete — blocked when purchase/sale history exists |
| GET | `/api/fruits/prices` | Selling price per fruit × packaging size |
| PUT | `/api/fruits/:id/prices` | Set the price for one packaging size |
| GET | `/api/stock` | Stock for every fruit × packaging size |
| GET | `/api/stock/low` | Fruits at or below their threshold |
| PATCH | `/api/stock/:id` | Update the low-stock threshold |

### Vendors

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/vendors?search=term` | List / search by name or phone |
| GET | `/api/vendors/:id` | Retrieve one vendor |
| POST | `/api/vendors` | Register a vendor |
| PUT | `/api/vendors/:id` | Update vendor details |
| DELETE | `/api/vendors/:id` | Delete — blocked when sale records exist |

### Purchases

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/purchases` | List purchases |
| GET | `/api/purchases/:id` | Purchase with line items |
| POST | `/api/purchases` | Record a multi-item purchase |

```json
{
  "supplier_id": 1,
  "purchase_date": "2026-11-18",
  "items": [
    { "fruit_id": 1, "packaging_size": "LARGE", "quantity": 10, "unit_cost": 62.00 },
    { "fruit_id": 2, "packaging_size": "MEDIUM", "quantity": 50, "unit_cost": 33.00 }
  ]
}
```

### Sales

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/sales` | List sales |
| GET | `/api/sales/outstanding` | Sales with a balance owing |
| GET | `/api/sales/:id` | Sale with line items and payments |
| POST | `/api/sales` | Record a multi-item sale (atomic stock check) |

```json
{
  "vendor_id": 1,
  "sale_date": "2026-11-18",
  "payment_method": "CREDIT",
  "items": [
    { "fruit_id": 1, "packaging_size": "LARGE", "quantity": 4, "unit_price": 92.00 }
  ]
}
```

Insufficient stock returns `400` and rolls the whole sale back:

```json
{
  "success": false,
  "message": "Insufficient stock for Apples - LARGE packaging. Available: 10 boxes, Requested: 999 boxes. Transaction cancelled."
}
```

### Payments

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/payments` | Payment history |
| POST | `/api/payments` | Record a settlement |

```json
{
  "sale_id": 4,
  "amount": 500.00,
  "payment_method": "MOBILE_MONEY",
  "payment_date": "2026-11-18",
  "note": "Part payment"
}
```

Overpayment returns `400`: `Payment amount cannot exceed the outstanding balance of 1090.00.`

### Reports

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/reports/top-fruits?limit=5` | Five most frequently sold fruits |
| GET | `/api/reports/revenue?start_date=&end_date=` | Revenue for a date range |
| GET | `/api/reports/top-vendors` | Vendors ranked by boxes purchased |
| GET | `/api/reports/stock-levels` | Current stock per fruit × packaging size |
| GET | `/api/reports/vendor-balances` | Billed, paid and outstanding per vendor |
| GET | `/api/reports/dashboard` | Aggregate dashboard KPIs |

## Status codes

| Code | Meaning |
| --- | --- |
| 200 | Request succeeded |
| 201 | Record created |
| 400 | Validation failure, insufficient stock, overpayment, deletion blocked |
| 404 | Record or route not found |
| 500 | Unexpected server or database error |
