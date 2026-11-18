# Requirements Document

## 1. Application Overview

### 1.1 Application Name
Batloung Farm Distribution Management System

### 1.2 Application Description
Batloung Farm Distribution Management System is a web-based administrative platform designed for a fruit distribution business operating in Maseru, Lesotho. The system manages suppliers across South African provinces, fruit catalog and packaging-specific stock levels (Small, Medium, Large) with batch tracking and expiration dates, local vendors with geographical coordinate mapping, multi-item purchase intake, multi-item sales fulfillment with First-Expiry-First-Out (FEFO) stock consumption, clean printable receipt generation, vendor payment tracking (Cash, Mobile Money, Credit), interactive vendor location mapping, and analytical business reports.

## 2. Users and Use Cases

### 2.1 Target Users
- Farm Business Administrators, Operational Staff, and Suppliers requiring delivery visibility.

### 2.2 Core Use Cases
- Managing supplier records and recording multi-item purchase intakes with auto-generated or custom batch numbers and expiration dates that increment packaging-specific stock balances.
- Managing fruit types and monitoring inventory via a stock matrix with expandable batch breakdowns, batch freshness statuses (Fresh, Expiring Soon, Expired), and low-stock alerts.
- Registering and managing street vendors and retailers, maintaining geographic coordinates (latitude and longitude), and tracking transaction histories.
- Viewing vendors on an interactive map view to assess vendor locations, filter vendor points, identify vendors lacking coordinate data, and inspect vendor status details.
- Creating multi-item sales orders with automated price calculations, atomic stock validation, and automatic stock deduction using First-Expiry-First-Out (FEFO) logic while preventing the sale of expired fruit.
- Generating and printing standardized sales receipts immediately upon order creation or reprinting from historical sales records.
- Tracking vendor payment statuses (PAID, PARTIALLY_PAID, UNPAID), recording cash and mobile money settlements, and monitoring outstanding credit balances.
- Viewing key operational metrics on a central dashboard and generating core business reports including top-selling fruits, date-filtered revenue, vendor volume ranking, current stock levels with batch metadata, and batches expiring within 30 days.

## 3. Page Structure and Functional Specifications

### 3.1 Page Structure

```
Batloung Farm Distribution Management System
├── Dashboard
├── Supplier Management
│   ├── Supplier List
│   ├── Add Supplier
│   ├── Edit Supplier
│   └── Delete Supplier
├── Fruit Management
│   ├── Fruit List
│   ├── Add Fruit
│   └── Edit Fruit
├── Stock Management
│   ├── Stock Matrix List (Fruit × Packaging Size)
│   └── Batch Breakdown View (per Fruit & Packaging Size)
├── Vendor Management
│   ├── Vendor List (with Search & Location Status)
│   ├── Add Vendor (with Coordinates Setting)
│   ├── Edit Vendor (with Coordinates Update)
│   └── Vendor Location Map View
├── Purchase Management
│   ├── Purchase Record List
│   └── Create Purchase Order (Multi-item line items with Batch & Expiry)
├── Sales Management
│   ├── Sales Record List (with Reprint Receipt Action)
│   ├── Create Sales Order (Multi-item line items with FEFO Stock Validation)
│   └── Sales Receipt View / Print Modal
├── Payment Management
│   ├── Payment & Outstanding Balance List
│   └── Record Vendor Payment
└── Reports Management
    ├── Top 5 Sold Fruits Report
    ├── Sales Revenue by Date Range Report
    ├── Top Vendors by Purchase Volume Report
    ├── Current Stock Levels Report (with Batch Overview)
    └── Batches Expiring in 30 Days Report
```

### 3.2 Page Functional Specifications

#### 3.2.1 Dashboard
- Metric Cards: Display total sales revenue, total purchase expenditures, total available stock boxes, total count of low-stock items, total outstanding vendor balances, count of expired batches, and count of batches expiring soon (within 7 days).
- Recent Activity & Alerts: Display the latest sales transactions, low-stock threshold alerts, and immediate visual alerts for expired or soon-to-expire batches.

#### 3.2.2 Supplier Management
- Supplier List: Display Supplier ID, Business Name, Contact Person, Phone, Province, and Physical Address.
- Add Supplier: Input and submit Business Name, Contact Person, Phone Number, Province, and Address.
- Edit Supplier: Modify existing supplier contact details, province, and address.
- Delete Supplier: Delete a supplier only if no linked purchase records exist; display a blocking warning if historical purchases are attached.

#### 3.2.3 Fruit Management
- Fruit List: Display Fruit ID, Fruit Name, Description, and Active Status.
- Add Fruit: Register a new fruit type with Name, Description, and Status. Automatically initializes corresponding stock tracking records for Small, Medium, and Large packaging sizes.
- Edit Fruit: Update fruit name, description, or active status.

#### 3.2.4 Stock Management
- Stock Matrix List: Display inventory grouped by Fruit and Packaging Size (Small, Medium, Large) showing Total Available Quantity in boxes and summary counts of Expired Batches and Expiring-Soon Batches.
- Batch Breakdown View: For each fruit and packaging size, provide an expandable list of underlying batches displaying Batch Number, Receiving Date, Expiration Date, Quantity Received, Quantity Remaining, Days Until Expiry, and Expiration Status.
- Batch Status Flags: Visually flag each batch with textual label and icon into three distinct states:
  - EXPIRED: Expiration date has passed (0 or negative days remaining).
  - EXPIRING_SOON: Expiration date is within 7 days from the current date.
  - FRESH: Expiration date is more than 7 days in the future.
- Batch Filters: Allow filtering stock and batch views by status: All Batches, Only Expiring Soon, or Only Expired.
- Empty State: When a fruit and packaging size has no associated batches, display an explicit empty state indicating no batch records exist.

#### 3.2.5 Vendor Management
- Vendor List: Display Vendor ID, Vendor Name, Phone Number, Location Text, Coordinates Status (Set / Missing), and Registration Date.
- Search Vendors: Filter vendor records by Vendor Name or Phone Number in real time.
- Add Vendor: Register a new vendor with Name, Phone Number, Location Text, Latitude, and Longitude.
- Edit Vendor: Modify vendor contact numbers, physical location address, and latitude/longitude coordinates.
- Vendor Location Map View:
  - Display an interactive map showing registered vendors as interactive map markers.
  - Map Marker Popover / Detail Card: Clicking a marker displays Vendor Name, Phone Number, Location Address, and Current Outstanding Balance.
  - Vendor Search and Filter on Map: Search bar to filter map markers by vendor name or location, and a toggle to filter by balance status.
  - Missing Location Identifier: Prominently display a list of vendors without geographic coordinates with a direct action to edit and set their coordinates.

#### 3.2.6 Purchase Management
- Purchase List: Display Purchase ID, Supplier Name, Purchase Date, Total Amount, and line-item details including associated batch numbers.
- Create Purchase Order:
  - Select a registered supplier and specify the purchase date.
  - Dynamically add multiple fruit items, specifying Fruit Type, Packaging Size (Small, Medium, Large), Box Quantity, Unit Cost per box, Batch Number, and Expiration Date.
  - Batch Number Field: Pre-filled with an auto-generated unique identifier (e.g., BATCH-YYYYMMDD-XXX) with support for manual administrative override.
  - Expiration Date Field: Mandatory valid date picker; values in the past are rejected.
  - Automatically calculate total purchase cost from line-item quantities and unit costs.
  - Upon submission, atomically store purchase records, create stock batch records with initial received and remaining quantities, and increment overall stock balances.

#### 3.2.7 Sales Management and Receipt Printing
- Sales List: Display Sale ID, Receipt Number, Vendor Name, Sale Date, Total Amount, Payment Status, and line-item details.
- Reprint Receipt Action: Each entry in the sales list includes a dedicated 「Print Receipt」 action button to open and print the receipt at any time.
- Create Sales Order:
  - Select a registered vendor and specify the sale date.
  - Dynamically add multiple fruit items, specifying Fruit Type, Packaging Size (Small, Medium, Large), Box Quantity, and Unit Selling Price per box.
  - Select initial payment terms: Payment Method (Cash, Mobile Money, or Credit/Unpaid) and Amount Paid at time of sale.
  - Automatically calculate subtotal per item, overall sale total, and remaining balance.
  - Perform atomic stock and freshness validation: Verify that unexpired stock is sufficient across available batches.
  - If stock is sufficient, deduct boxes from active batches using First-Expiry-First-Out (FEFO) order (earliest expiration date consumed first) and record the sale.
  - Upon successful order completion, automatically display the Printable Receipt dialog with a direct trigger to print.
  - If non-expired stock is insufficient or only expired stock remains, abort the entire transaction without deducting stock or creating partial records.
- Sales Receipt View / Print Layout:
  - Document content includes: Farm Business Details (Name: Batloung Farm, Maseru, Lesotho, Contact Details), Receipt Number, Sale Date & Time, Vendor Name, Vendor Phone & Location, Line Items Table (Fruit Type, Packaging Size, Quantity, Unit Selling Price, Line Total), Grand Total Amount, Payment Method, Amount Paid, and Remaining Outstanding Balance.
  - Dedicated print stylesheet that strips system navigation, buttons, sidebars, and application backgrounds, rendering cleanly for standard A4 and POS/thermal paper formats.

#### 3.2.8 Payment Management
- Payment Overview List: Display cumulative total billed, total paid, outstanding balance, and current payment status (PAID, PARTIALLY_PAID, UNPAID) for each vendor.
- Record Payment: Select a vendor and specific sales order, enter payment amount, and select payment method (Cash or Mobile Money). The system updates the payment status and recalculates outstanding balances.

#### 3.2.9 Reports Management
- Top 5 Sold Fruits: Display the top 5 most frequently sold fruits by total box volume in ranking table and chart format.
- Sales Revenue by Date Range: Allow administrators to select a Start Date and End Date to aggregate and display total sales revenue and daily breakdowns.
- Top Vendors by Volume: Display a ranked list of vendors ordered by the total number of boxes purchased.
- Current Stock Levels: Display inventory matrix across all fruits and packaging sizes, showing total available quantity, number of active batches, earliest expiration date, and count of expired batches.
- Batches Expiring in 30 Days: Dedicated report table listing all inventory batches expiring within the next 30 days, sorted chronologically by expiration date to facilitate priority stock clearance.

## 4. Business Rules and Core Logic

### 4.1 Batch Tracking and Stock Rules
1. Every purchase line item creates a dedicated stock batch record containing Batch Number, Fruit, Packaging Size, Quantity Received, Quantity Remaining, Expiration Date, Receiving Date, and linked Purchase ID.
2. Batch numbers must be globally unique across the system.
3. A batch remaining quantity cannot be negative and cannot exceed its initial quantity received.
4. Total available stock for a fruit and packaging size equals the sum of remaining quantities across all non-expired batches for that combination.
5. Batch expiration states are calculated dynamically based on current date:
   - EXPIRED: Expiration Date < Current Date.
   - EXPIRING_SOON: Current Date <= Expiration Date <= Current Date + 7 Days.
   - FRESH: Expiration Date > Current Date + 7 Days.

### 4.2 FEFO Sales Consumption and Order Validation
1. Sales deduction strictly follows First-Expiry-First-Out (FEFO) logic: batches with the earliest expiration date are consumed first.
2. Expired batches are excluded from available saleable stock and cannot be consumed during sales fulfillment.
3. If requested quantity exceeds total non-expired stock for any line item, the entire sale order is rejected atomically with no batch quantities modified.
4. If a sale order spans multiple batches of the same fruit and packaging size, quantities are decremented sequentially across batches until the full order line quantity is fulfilled.

### 4.3 Automated Calculations, Pricing and Receipts
1. Total Purchase Amount = Sum of (Line Item Box Quantity × Unit Cost).
2. Total Sales Amount = Sum of (Line Item Box Quantity × Unit Selling Price).
3. Vendor Outstanding Balance = Sum of Vendor Total Sales Amounts - Sum of Vendor Total Payments Recorded.
4. Receipt Number is auto-generated upon sale creation with a unique format (e.g., RCP-YYYYMMDD-XXXX).
5. Manual overriding of computed totals is strictly prohibited.

### 4.4 Vendor Coordinates and Map Rules
1. Latitude must be a valid float between -90.0 and 90.0; Longitude must be a valid float between -180.0 and 180.0.
2. Vendors without geographic coordinates are classified as 「Unmapped」 and listed in the map page sidebar for location completion.
3. Selecting an unmapped vendor provides a form shortcut to input their coordinates.

### 4.5 Payment Status Lifecycle
1. If Total Paid = Sale Total Amount, status is PAID.
2. If Total Paid > 0 and Total Paid < Sale Total Amount, status is PARTIALLY_PAID.
3. If Total Paid = 0, status is UNPAID.

### 4.6 Referential Integrity and Deletion Restrictions
1. A supplier with linked purchase history cannot be deleted.
2. A fruit with existing purchase, sale, batch, or non-zero stock history cannot be deleted.
3. A vendor with linked sales records or an outstanding balance cannot be deleted.
4. Purchases linked to active stock batches or sales history cannot be deleted if deletion would compromise inventory consistency.

## 5. Exceptions and Edge Cases

| Scenario | Trigger Condition | System Behavior and Error Feedback |
| :--- | :--- | :--- |
| Insufficient Non-Expired Stock | Requested box quantity exceeds total available unexpired stock across batches | Rejects entire sale order. Displays message: 「Insufficient non-expired stock for [Fruit Name] - [Packaging Size]. Available: X boxes, Requested: Y boxes. Transaction cancelled.」 |
| Only Expired Stock Available | All remaining stock for a requested fruit packaging size has expired | Rejects entire sale order. Displays message: 「Cannot fulfill order: Available stock for [Fruit Name] - [Packaging Size] is expired.」 |
| Duplicate Batch Number | User inputs a batch number that already exists in the system | Blocks purchase order submission. Displays message: 「Batch number already exists. Please use a unique batch number.」 |
| Past Expiration Date on Purchase | User selects an expiration date earlier than the purchase/intake date | Blocks purchase order submission. Displays message: 「Expiration date cannot be in the past.」 |
| Invalid Coordinates | User enters latitude outside [-90, 90] or longitude outside [-180, 180] | Blocks vendor save. Displays message: 「Please enter valid geographic coordinates (Latitude: -90 to 90, Longitude: -180 to 180).」 |
| Deleting Supplier with Records | Attempting to delete a supplier linked to purchase records | Blocks deletion. Displays message: 「Cannot delete supplier: Linked purchase records exist.」 |
| Empty Line Items | Submitting a purchase or sales order with zero line items | Blocks form submission. Displays message: 「Please add at least one fruit line item.」 |
| Invalid Numeric Input | Quantity or price input is zero, negative, or non-numeric | Blocks input validation. Displays message: 「Quantity and price values must be positive numbers.」 |
| Overpayment | Entered payment amount exceeds the vendor's total outstanding balance | Blocks submission. Displays message: 「Payment amount cannot exceed the total outstanding balance.」 |

## 6. Acceptance Criteria

1. Users can create, update, search, and view suppliers, fruits, vendors (with latitude and longitude coordinates), and their associated records with referential integrity constraints enforced.
2. The Vendor Location Map View renders all vendors with coordinates as interactive markers displaying business details and outstanding balances, provides filtering/search capabilities, and lists unmapped vendors.
3. Users can record multi-item purchase orders where each line item captures an auto-generated or custom unique batch number and a valid future expiration date.
4. The stock management page displays total box inventory by fruit and packaging size, supports expandable batch breakdowns, displays days until expiry, indicates batch status (FRESH, EXPIRING_SOON, EXPIRED) via labels and icons, and filters batches by expiration state.
5. Multi-item sales orders atomically validate stock availability, automatically consume stock across batches using First-Expiry-First-Out (FEFO) ordering, and prevent the sale of expired batches.
6. After creating a sales order or when selecting a past sale from the sales list, users can trigger and print a clean receipt containing farm details, receipt number, date, vendor details, line items, totals, payment method, paid amount, and outstanding balance without UI navigation artifacts.
7. Users can record vendor payments via Cash and Mobile Money, with accurate tracking of PAID, PARTIALLY_PAID, and UNPAID statuses and vendor outstanding balances.
8. Users can generate all required reports, including Top 5 sold fruits, date-filtered sales revenue, vendor volume rankings, current stock levels with batch metadata, and batches expiring within 30 days.

## 7. Out of Scope for Current Release

1. External public e-commerce portal for self-service vendor ordering.
2. Automated turn-by-turn live GPS navigation and vehicle telemetry tracking.
3. Algorithmic fruit spoilage forecasting and shelf-life degradation modeling.
4. Direct third-party payment gateway merchant integrations.