"""
OmniRetail - Realistic Multi-Source Data Generator
Generates realistic multi-format datasets aligned with DAV Labs 1, 4, and 5:
- data/raw/customers.csv (Flat File - Lab 1)
- data/raw/products.xml (XML Structure - Lab 1)
- data/raw/orders.json (Nested JSON - Lab 1 & 4)
- data/raw/macro_finance_api.json (API Extracted JSON - Lab 4)
"""

import os
import json
import random
import datetime
import numpy as np
import pandas as pd
import xml.etree.ElementTree as ET


def generate_all_data(output_dir):
    raw_dir = os.path.join(output_dir, "data", "raw")
    os.makedirs(raw_dir, exist_ok=True)
    random.seed(42)
    np.random.seed(42)

    print("Generating Customers Dataset (.csv)...")
    first_names = [
        "Aarav",
        "Ananya",
        "Rohan",
        "Priya",
        "Aditya",
        "Sneha",
        "Vivek",
        "Meera",
        "Karan",
        "Pooja",
        "Manish",
        "Divya",
        "Rahul",
        "Neha",
        "Aryan",
        "Kavya",
        "Saurabh",
        "Kritika",
        "Abhishek",
        "Nandini",
        "Arjun",
        "Simran",
        "Tanvi",
        "Rohit",
        "Dev",
        "Ayesha",
        "Nitin",
        "Ishita",
        "Manav",
        "Palak",
    ]
    last_names = [
        "Sharma",
        "Verma",
        "Patil",
        "Nair",
        "Singh",
        "Joshi",
        "Rao",
        "Kulkarni",
        "Mehta",
        "Iyer",
        "Roy",
        "Kaur",
        "Malhotra",
        "Khan",
        "Chopra",
        "Gupta",
        "Deshmukh",
        "Choudhury",
        "Bose",
        "Reddy",
    ]
    cities = [
        ("Mumbai", "Maharashtra"),
        ("Delhi", "Delhi"),
        ("Bengaluru", "Karnataka"),
        ("Hyderabad", "Telangana"),
        ("Pune", "Maharashtra"),
        ("Chennai", "Tamil Nadu"),
        ("Kolkata", "West Bengal"),
        ("Ahmedabad", "Gujarat"),
        ("Jaipur", "Rajasthan"),
        ("Lucknow", "Uttar Pradesh"),
    ]
    tiers = ["Bronze", "Silver", "Gold", "Platinum"]
    tier_weights = [0.45, 0.30, 0.18, 0.07]

    customers = []
    base_signup = datetime.date(2023, 1, 1)
    for i in range(1, 1001):
        cid = f"CUST{i:04d}"
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        city, state = random.choice(cities)
        signup = base_signup + datetime.timedelta(days=random.randint(0, 900))
        tier = np.random.choice(tiers, p=tier_weights)
        age = int(np.clip(np.random.normal(34, 10), 18, 70))
        gender = random.choice(["Male", "Female"])
        email = f"{fn.lower()}.{ln.lower()}{i % 99}@example.com"
        customers.append(
            {
                "CustomerID": cid,
                "Name": f"{fn} {ln}",
                "Email": email,
                "Gender": gender,
                "Age": age,
                "City": city,
                "State": state,
                "SignupDate": signup.strftime("%Y-%m-%d"),
                "LoyaltyTier": tier,
            }
        )
    df_customers = pd.DataFrame(customers)
    cust_path = os.path.join(raw_dir, "customers.csv")
    df_customers.to_csv(cust_path, index=False)
    print(f" Saved {len(df_customers)} customers to {cust_path}")

    print("Generating Products Catalog (.xml)...")
    catalog = [
        # Electronics
        ("PRD001", "Aura Wireless Headphones", "Electronics", "Audio", 2200.0, 4499.0, "SoundWave Ltd"),
        ("PRD002", "BassPro Bluetooth Speaker", "Electronics", "Audio", 1500.0, 2999.0, "SoundWave Ltd"),
        (
            "PRD003",
            "PixelView 27-inch 4K Monitor",
            "Electronics",
            "Displays",
            14500.0,
            22999.0,
            "TechVision Inc",
        ),
        (
            "PRD004",
            "NovaTech Mechanical Keyboard",
            "Electronics",
            "Peripherals",
            1800.0,
            3499.0,
            "TechVision Inc",
        ),
        (
            "PRD005",
            "Precision Ergonomic Mouse",
            "Electronics",
            "Peripherals",
            800.0,
            1599.0,
            "TechVision Inc",
        ),
        ("PRD006", "SmartLife Fitness Band v4", "Electronics", "Wearables", 1200.0, 2499.0, "FitGear Global"),
        ("PRD007", "Apex HD Smart Webcam", "Electronics", "Peripherals", 1400.0, 2799.0, "TechVision Inc"),
        ("PRD008", "ThunderBolt 65W GaN Charger", "Electronics", "Accessories", 650.0, 1499.0, "VoltCharge"),
        # Furniture
        ("PRD009", "ErgoFlex High-Back Office Chair", "Furniture", "Chairs", 4800.0, 8999.0, "ComfortSeats"),
        ("PRD010", "Solid Oak Standing Desk", "Furniture", "Desks", 11000.0, 19999.0, "CraftWood Designs"),
        (
            "PRD011",
            "Nordic Minimalist Bookshelf",
            "Furniture",
            "Storage",
            3200.0,
            5999.0,
            "CraftWood Designs",
        ),
        ("PRD012", "Memory Foam Lumbar Cushion", "Furniture", "Accessories", 450.0, 1199.0, "ComfortSeats"),
        ("PRD013", "Adjustable Dual Monitor Arm", "Furniture", "Accessories", 1200.0, 2499.0, "ComfortSeats"),
        # Office Supplies
        (
            "PRD014",
            "Premium Leatherette Executive Notebook",
            "Office Supplies",
            "Stationery",
            220.0,
            599.0,
            "PaperCraft",
        ),
        (
            "PRD015",
            "Matte Brass Ballpoint Pen Set",
            "Office Supplies",
            "Stationery",
            300.0,
            799.0,
            "PaperCraft",
        ),
        (
            "PRD016",
            "Desk Organizer Wire Mesh Caddy",
            "Office Supplies",
            "Organization",
            250.0,
            649.0,
            "WorkClean Co",
        ),
        (
            "PRD017",
            "Heavy Duty Desktop Shredder",
            "Office Supplies",
            "Equipment",
            2400.0,
            4499.0,
            "WorkClean Co",
        ),
        (
            "PRD018",
            "Magnetic Dry-Erase Whiteboard 3x2",
            "Office Supplies",
            "Presentation",
            950.0,
            1899.0,
            "PaperCraft",
        ),
        # Home & Kitchen
        (
            "PRD019",
            "Stainless Steel French Press 1L",
            "Home & Kitchen",
            "Coffee & Tea",
            600.0,
            1399.0,
            "BrewMaster",
        ),
        (
            "PRD020",
            "Digital Touch Air Fryer 4.5L",
            "Home & Kitchen",
            "Appliances",
            3100.0,
            5999.0,
            "CuisineChef",
        ),
        (
            "PRD021",
            "Cold Brew Infusion Pitcher",
            "Home & Kitchen",
            "Coffee & Tea",
            450.0,
            1099.0,
            "BrewMaster",
        ),
        (
            "PRD022",
            "Smart Temperature Control Kettle",
            "Home & Kitchen",
            "Appliances",
            1600.0,
            3199.0,
            "CuisineChef",
        ),
        ("PRD023", "Eco Bamboo Cutting Board Set", "Home & Kitchen", "Cookware", 380.0, 899.0, "EcoLiving"),
        # Fashion & Lifestyle
        ("PRD024", "Waterproof Commuter Laptop Backpack", "Fashion", "Bags", 900.0, 2199.0, "UrbanStyle"),
        ("PRD025", "Anti-Blue Light Reading Glasses", "Fashion", "Eyewear", 350.0, 899.0, "UrbanStyle"),
        ("PRD026", "Classic Minimalist Chrono Watch", "Fashion", "Watches", 1600.0, 3499.0, "Timeless Co"),
        ("PRD027", "Merino Wool Blend Winter Scarf", "Fashion", "Apparel", 450.0, 1199.0, "UrbanStyle"),
        (
            "PRD028",
            "RFID Blocking Slim Leather Wallet",
            "Fashion",
            "Accessories",
            400.0,
            999.0,
            "Timeless Co",
        ),
    ]

    root = ET.Element("ProductCatalog", version="2.0", generated=datetime.datetime.now().isoformat())
    for item in catalog:
        p_elem = ET.SubElement(root, "Product", id=item[0])
        ET.SubElement(p_elem, "Name").text = item[1]
        ET.SubElement(p_elem, "Category").text = item[2]
        ET.SubElement(p_elem, "SubCategory").text = item[3]
        ET.SubElement(p_elem, "UnitCostINR").text = str(item[4])
        ET.SubElement(p_elem, "UnitPriceINR").text = str(item[5])
        ET.SubElement(p_elem, "Supplier").text = item[6]

    xml_path = os.path.join(raw_dir, "products.xml")
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ", level=0)
    tree.write(xml_path, encoding="utf-8", xml_declaration=True)
    print(f" Saved {len(catalog)} products to {xml_path}")

    print("Generating Orders Dataset (.json)...")
    product_dict = {p[0]: {"category": p[2], "price": p[5], "cost": p[4]} for p in catalog}
    product_keys = list(product_dict.keys())
    customer_ids = [c["CustomerID"] for c in customers]

    start_date = datetime.date(2024, 1, 1)
    end_date = datetime.date(2026, 9, 30)
    total_days = (end_date - start_date).days

    orders = []
    # Seasonal weights per month: peaks in Oct-Nov (Festive/Diwali) and Dec (Holidays)
    month_weights = {
        1: 0.9,
        2: 0.85,
        3: 0.95,
        4: 0.9,
        5: 1.0,
        6: 0.95,
        7: 1.05,
        8: 1.1,
        9: 1.15,
        10: 1.5,
        11: 1.6,
        12: 1.4,
    }

    order_id_counter = 1
    current_date = start_date
    while current_date <= end_date:
        m_weight = month_weights[current_date.month]
        # Day of week factor: weekends get slightly higher orders
        dow_factor = 1.25 if current_date.weekday() >= 5 else 1.0
        # Overall upward growth trend over time (simulating e-commerce expansion)
        trend_factor = 1.0 + (0.5 * (current_date - start_date).days / total_days)

        expected_orders = int(np.random.poisson(6 * m_weight * dow_factor * trend_factor))
        for _ in range(expected_orders):
            oid = f"ORD{order_id_counter:06d}"
            cid = random.choice(customer_ids)
            pid = random.choice(product_keys)
            p_info = product_dict[pid]

            qty = int(np.random.choice([1, 2, 3, 4, 5], p=[0.60, 0.22, 0.10, 0.05, 0.03]))
            discount = float(
                np.random.choice([0.0, 0.05, 0.10, 0.15, 0.20, 0.25], p=[0.35, 0.25, 0.20, 0.10, 0.07, 0.03])
            )

            unit_price = p_info["price"]
            gross_amount = round(qty * unit_price, 2)
            discount_amount = round(gross_amount * discount, 2)
            net_amount = round(gross_amount - discount_amount, 2)
            total_cost = round(qty * p_info["cost"], 2)
            profit = round(net_amount - total_cost, 2)

            shipping_mode = random.choices(["Standard", "Express", "Same Day"], weights=[0.65, 0.25, 0.10])[0]
            payment_method = random.choices(
                ["UPI", "Credit Card", "Debit Card", "Net Banking", "Cash on Delivery"],
                weights=[0.45, 0.25, 0.12, 0.08, 0.10],
            )[0]

            # Shipping delay simulation
            base_days = 4 if shipping_mode == "Standard" else (2 if shipping_mode == "Express" else 1)
            delivery_days = max(1, int(np.random.normal(base_days, 1.2)))

            # Return status simulation (electronics have higher returns, high discounts increase impulse return)
            return_prob = 0.06 if p_info["category"] != "Electronics" else 0.11
            if discount >= 0.20:
                return_prob += 0.04
            is_returned = 1 if random.random() < return_prob else 0

            # Customer satisfaction rating (1 to 5)
            rating = int(
                np.clip(
                    np.random.normal(
                        4.2 - (0.4 if is_returned else 0.0) - (0.2 * (delivery_days - base_days)), 0.8
                    ),
                    1,
                    5,
                )
            )

            orders.append(
                {
                    "OrderID": oid,
                    "CustomerID": cid,
                    "ProductID": pid,
                    "OrderDate": current_date.strftime("%Y-%m-%d"),
                    "Quantity": qty,
                    "GrossAmount": gross_amount,
                    "DiscountRate": discount,
                    "DiscountAmount": discount_amount,
                    "NetAmount": net_amount,
                    "EstimatedCost": total_cost,
                    "Profit": profit,
                    "ShippingMode": shipping_mode,
                    "PaymentMethod": payment_method,
                    "DeliveryDays": delivery_days,
                    "IsReturned": is_returned,
                    "CustomerRating": rating,
                }
            )
            order_id_counter += 1
        current_date += datetime.timedelta(days=1)

    json_path = os.path.join(raw_dir, "orders.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(orders, f, indent=2)
    print(f" Saved {len(orders)} orders to {json_path}")

    print("Generating Simulated Macro Finance & Inflation API Data (.json)...")
    # Aligns with Lab 4 API data extraction
    macro_data = {
        "source": "OpenExchangeRates & RBI API (Mocked Live Feed)",
        "endpoint": "https://api.exchangerate-api.com/v4/latest/USD",
        "fetch_timestamp": datetime.datetime.now().isoformat(),
        "base_currency": "USD",
        "rates": {"INR": 83.95, "EUR": 0.92, "GBP": 0.78, "JPY": 154.20, "CAD": 1.36},
        "macro_indicators_india": {
            "cpi_inflation_rate_percent": 5.1,
            "repo_rate_percent": 6.50,
            "gdp_growth_forecast_percent": 7.2,
            "e_commerce_market_cagr_percent": 18.4,
        },
    }
    api_path = os.path.join(raw_dir, "macro_finance_api.json")
    with open(api_path, "w", encoding="utf-8") as f:
        json.dump(macro_data, f, indent=2)
    print(f" Saved Macro API data to {api_path}")
    print("\nAll Multi-Source Datasets successfully generated!")


if __name__ == "__main__":
    generate_all_data(str(__import__("pathlib").Path(__file__).resolve().parents[1]))
