import { randomUUID, randomInt } from 'node:crypto';

export async function initOrdersSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS allgo_orders (
      id uuid PRIMARY KEY,
      order_number serial,
      customer_id uuid NOT NULL REFERENCES allgo_accounts(id),
      customer_name text NOT NULL,
      customer_phone text,
      restaurant_id text NOT NULL,
      restaurant_name text NOT NULL,
      items jsonb NOT NULL,
      subtotal numeric NOT NULL,
      tax numeric NOT NULL,
      delivery_fee numeric NOT NULL,
      total numeric NOT NULL,
      delivery_address jsonb NOT NULL,
      payment_method text NOT NULL DEFAULT 'cod',
      payment_status text NOT NULL DEFAULT 'pending',
      order_status text NOT NULL DEFAULT 'placed',
      delivery_status text NOT NULL DEFAULT 'pending_dispatch',
      driver_id uuid REFERENCES allgo_accounts(id),
      driver_name text,
      prep_time_minutes integer,
      pickup_code text NOT NULL,
      delivery_otp text NOT NULL,
      pickup_attempts integer DEFAULT 0,
      delivery_attempts integer DEFAULT 0,
      rejection_reason text,
      cancellation_reason text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      accepted_at timestamptz,
      prepared_at timestamptz,
      picked_up_at timestamptz,
      delivered_at timestamptz
    );

    CREATE TABLE IF NOT EXISTS allgo_driver_offers (
      id uuid PRIMARY KEY,
      order_id uuid NOT NULL REFERENCES allgo_orders(id) ON DELETE CASCADE,
      driver_id uuid NOT NULL REFERENCES allgo_accounts(id),
      status text NOT NULL DEFAULT 'offering',
      estimated_earnings numeric NOT NULL,
      pickup_distance text,
      delivery_distance text,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS allgo_driver_locations (
      driver_id uuid PRIMARY KEY REFERENCES allgo_accounts(id) ON DELETE CASCADE,
      online boolean NOT NULL DEFAULT false,
      lat double precision,
      lng double precision,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS allgo_settlements (
      id uuid PRIMARY KEY,
      order_id uuid REFERENCES allgo_orders(id),
      entity_type text NOT NULL,
      entity_id uuid NOT NULL REFERENCES allgo_accounts(id),
      gross_amount numeric NOT NULL,
      commission_fee numeric NOT NULL DEFAULT 0,
      net_amount numeric NOT NULL,
      status text NOT NULL DEFAULT 'completed',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS allgo_audit_logs (
      id uuid PRIMARY KEY,
      actor_id uuid,
      actor_role text,
      action text NOT NULL,
      target_id text,
      details jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS allgo_order_chats (
      id uuid PRIMARY KEY,
      order_id uuid NOT NULL,
      sender_id text NOT NULL,
      sender_name text NOT NULL,
      sender_role text NOT NULL,
      text text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS allgo_driver_remittances (
      id uuid PRIMARY KEY,
      driver_id uuid REFERENCES allgo_accounts(id),
      amount numeric NOT NULL,
      payment_method text NOT NULL DEFAULT 'upi',
      transaction_ref text,
      status text NOT NULL DEFAULT 'completed',
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS allgo_surge_zones (
      zone_id text PRIMARY KEY,
      name text NOT NULL,
      multiplier numeric NOT NULL DEFAULT 1.0,
      rain_mode boolean NOT NULL DEFAULT false,
      traffic_mode boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS allgo_coupons (
      code text PRIMARY KEY,
      title text NOT NULL,
      discount_type text NOT NULL,
      discount_value numeric NOT NULL,
      min_order numeric NOT NULL DEFAULT 0,
      max_discount numeric,
      expires_at timestamptz,
      active boolean NOT NULL DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS allgo_merchant_settings (
      merchant_id text PRIMARY KEY,
      rush_mode boolean NOT NULL DEFAULT false,
      rush_buffer_mins integer NOT NULL DEFAULT 15,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS service_type text NOT NULL DEFAULT 'food';
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS pickup_address jsonb;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS driver_phone text;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS driver_vehicle text;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS meta jsonb DEFAULT '{}';
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS pickup_otp text;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS driver_tip numeric DEFAULT 0;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS discount numeric DEFAULT 0;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS coupon_code text;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS surge_fee numeric DEFAULT 0;
    ALTER TABLE allgo_orders ADD COLUMN IF NOT EXISTS pod_image_url text;
    ALTER TABLE allgo_orders ALTER COLUMN restaurant_id DROP NOT NULL;
    ALTER TABLE allgo_orders ALTER COLUMN restaurant_name DROP NOT NULL;
    ALTER TABLE allgo_driver_locations ADD COLUMN IF NOT EXISTS cod_cash_in_hand numeric NOT NULL DEFAULT 0;

    INSERT INTO allgo_surge_zones (zone_id, name, multiplier, rain_mode, traffic_mode)
    VALUES
      ('zone_koramangala', 'Koramangala & HSR', 1.0, false, false),
      ('zone_indiranagar', 'Indiranagar & Domlur', 1.0, false, false),
      ('zone_cbd', 'Central Business District', 1.0, false, false)
    ON CONFLICT (zone_id) DO NOTHING;

    INSERT INTO allgo_coupons (code, title, discount_type, discount_value, min_order, max_discount)
    VALUES
      ('ALLGO50', '50% OFF up to ₹100', 'percent', 50, 199, 100),
      ('WELCOME100', '₹100 Flat OFF on First Order', 'flat', 100, 299, 100),
      ('FEAST20', '20% OFF up to ₹150', 'percent', 20, 499, 150),
      ('FREEDEL', 'Free Delivery (₹40 OFF)', 'flat', 40, 149, 40)
    ON CONFLICT (code) DO NOTHING;
  `).catch(() => {});
}

export async function seedCatalogIfEmpty(pool) {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) FROM allgo_catalog WHERE kind = 'restaurants'");
    if (parseInt(rows[0]?.count || '0', 10) > 0) return;

    const restaurants = [
      {
        id: 'res_spice_symphony',
        name: 'Spice Symphony',
        cuisine: 'North Indian, Biryani',
        rating: 4.6,
        deliveryTime: '25-35 mins',
        priceForTwo: 450,
        imageUrl: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80',
        address: '124 Koramangala 4th Block, Bengaluru',
        isOpen: true,
      },
      {
        id: 'res_golden_dragon',
        name: 'Golden Dragon',
        cuisine: 'Pan-Asian, Dim Sum, Noodles',
        rating: 4.5,
        deliveryTime: '30-40 mins',
        priceForTwo: 550,
        imageUrl: 'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=600&q=80',
        address: '88 Indiranagar 100ft Road, Bengaluru',
        isOpen: true,
      },
      {
        id: 'res_trattoria_roma',
        name: 'Trattoria Roma',
        cuisine: 'Italian, Wood-fired Pizza, Pasta',
        rating: 4.7,
        deliveryTime: '20-30 mins',
        priceForTwo: 600,
        imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
        address: '42 MG Road, Central Mall, Bengaluru',
        isOpen: true,
      },
      {
        id: 'res_burger_joint',
        name: 'The Burger Joint',
        cuisine: 'Gourmet Burgers, Fries, Shakes',
        rating: 4.4,
        deliveryTime: '15-25 mins',
        priceForTwo: 350,
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        address: '15 Church Street, Bengaluru',
        isOpen: true,
      },
    ];

    const menuItems = [
      // Spice Symphony
      {
        id: 'item_ss_1',
        parent: 'res_spice_symphony',
        name: 'Dum Handi Chicken Biryani',
        description: 'Slow-cooked aromatic basmati rice layered with spiced tender chicken.',
        price: 320,
        category: 'Biryani',
        isVeg: false,
        dietary: 'non_veg',
        spiciness: 2,
        allergens: ['Dairy'],
        available: true,
        variants: [
          { id: 'v_half', name: 'Regular (Serves 1)', label: 'Regular (Serves 1)', price: 320, isDefault: true, available: true },
          { id: 'v_full', name: 'Handi Large (Serves 2-3)', label: 'Handi Large (Serves 2-3)', price: 540, available: true },
          { id: 'v_family', name: 'Family Pack (Serves 4-5)', label: 'Family Pack (Serves 4-5)', price: 920, available: true },
        ],
        modifierGroups: [
          {
            id: 'mg_spice',
            title: 'Spice Level',
            label: 'Spice Level',
            minSelect: 1,
            maxSelect: 1,
            maxSelections: 1,
            required: true,
            options: [
              { id: 'opt_mild', name: 'Mild Spiced', label: 'Mild Spiced', price: 0, available: true },
              { id: 'opt_med', name: 'Hyderabadi Medium', label: 'Hyderabadi Medium', price: 0, available: true },
              { id: 'opt_hot', name: 'Fiery Andhra Hot 🌶️', label: 'Fiery Andhra Hot 🌶️', price: 0, available: true },
            ],
          },
          {
            id: 'mg_addons',
            title: 'Add-ons & Extras',
            label: 'Add-ons & Extras',
            minSelect: 0,
            maxSelect: 3,
            maxSelections: 3,
            required: false,
            options: [
              { id: 'opt_salan', name: 'Extra Mirchi Ka Salan (150ml)', label: 'Extra Mirchi Ka Salan (150ml)', price: 40, available: true },
              { id: 'opt_raita', name: 'Boondi Raita Bowl', label: 'Boondi Raita Bowl', price: 35, available: true },
              { id: 'opt_egg', name: 'Boiled Egg (2 pcs)', label: 'Boiled Egg (2 pcs)', price: 30, available: true },
            ],
          },
        ],
      },
      {
        id: 'item_ss_2',
        parent: 'res_spice_symphony',
        name: 'Paneer Butter Masala',
        description: 'Fresh cottage cheese cubes in rich velvety tomato cashew gravy.',
        price: 260,
        category: 'Curries',
        isVeg: true,
        dietary: 'veg',
        spiciness: 1,
        allergens: ['Dairy', 'Nuts'],
        available: true,
        variants: [
          { id: 'v_pbm_half', name: 'Portion (300ml)', label: 'Portion (300ml)', price: 260, isDefault: true, available: true },
          { id: 'v_pbm_full', name: 'Handi (600ml)', label: 'Handi (600ml)', price: 440, available: true },
        ],
        modifierGroups: [
          {
            id: 'mg_pbm_cream',
            title: 'Preparation Preference',
            label: 'Preparation Preference',
            minSelect: 0,
            maxSelect: 2,
            maxSelections: 2,
            required: false,
            options: [
              { id: 'opt_butter', name: 'Extra Makhan Butter Dollop', label: 'Extra Makhan Butter Dollop', price: 30, available: true },
              { id: 'opt_kasuri', name: 'Roasted Kasuri Methi Crust', label: 'Roasted Kasuri Methi Crust', price: 15, available: true },
            ],
          },
        ],
      },
      {
        id: 'item_ss_3',
        parent: 'res_spice_symphony',
        name: 'Butter Garlic Naan',
        description: 'Freshly baked leavened bread with roasted garlic and butter.',
        price: 65,
        category: 'Breads',
        isVeg: true,
        dietary: 'veg',
        spiciness: 0,
        allergens: ['Gluten', 'Dairy'],
        available: true,
        variants: [
          { id: 'v_naan_1', name: 'Single Naan', label: 'Single Naan', price: 65, isDefault: true, available: true },
          { id: 'v_naan_3', name: 'Basket of 3 Naans', label: 'Basket of 3 Naans', price: 175, available: true },
        ],
      },
      {
        id: 'item_ss_4',
        parent: 'res_spice_symphony',
        name: 'Gulab Jamun (2 pcs)',
        description: 'Soft golden milk dumplings soaked in cardamom sugar syrup.',
        price: 90,
        category: 'Dessert',
        isVeg: true,
        dietary: 'veg',
        spiciness: 0,
        allergens: ['Dairy'],
        available: true,
      },

      // Golden Dragon
      {
        id: 'item_gd_1',
        parent: 'res_golden_dragon',
        name: 'Steamed Chicken Dim Sum (6 pcs)',
        description: 'Delicate steamed dumplings with seasoned minced chicken.',
        price: 240,
        category: 'Dim Sum',
        isVeg: false,
        dietary: 'non_veg',
        spiciness: 1,
        allergens: ['Sesame', 'Gluten'],
        available: true,
        variants: [
          { id: 'v_dim_6', name: '6 Pieces', label: '6 Pieces', price: 240, isDefault: true, available: true },
          { id: 'v_dim_12', name: '12 Pieces Platter', label: '12 Pieces Platter', price: 440, available: true },
        ],
        modifierGroups: [
          {
            id: 'mg_dip',
            title: 'Choice of Dipping Sauce',
            label: 'Choice of Dipping Sauce',
            minSelect: 1,
            maxSelect: 2,
            maxSelections: 2,
            required: true,
            options: [
              { id: 'dip_chili_oil', name: 'Crispy Chili Crisp Oil', label: 'Crispy Chili Crisp Oil', price: 0, available: true },
              { id: 'dip_scallion', name: 'Ginger Scallion Dip', label: 'Ginger Scallion Dip', price: 0, available: true },
              { id: 'dip_sweet_chili', name: 'Thai Sweet Chili', label: 'Thai Sweet Chili', price: 20, available: true },
            ],
          },
        ],
      },
      {
        id: 'item_gd_2',
        parent: 'res_golden_dragon',
        name: 'Schezwan Chilli Garlic Noodles',
        description: 'Wok-tossed noodles with spicy chili garlic paste and veggies.',
        price: 210,
        category: 'Noodles',
        isVeg: true,
        dietary: 'vegan',
        spiciness: 3,
        allergens: ['Gluten', 'Soy'],
        available: true,
        variants: [
          { id: 'v_nood_reg', name: 'Regular Wok Bowl', label: 'Regular Wok Bowl', price: 210, isDefault: true, available: true },
          { id: 'v_nood_large', name: 'Large Sharing Bowl', label: 'Large Sharing Bowl', price: 340, available: true },
        ],
        modifierGroups: [
          {
            id: 'mg_prot',
            title: 'Add Protein',
            label: 'Add Protein',
            minSelect: 0,
            maxSelect: 1,
            maxSelections: 1,
            required: false,
            options: [
              { id: 'prot_paneer', name: 'Tofu / Paneer Cubes (+₹50)', label: 'Tofu / Paneer Cubes', price: 50, available: true },
              { id: 'prot_chicken', name: 'Egg & Chicken Toss (+₹70)', label: 'Egg & Chicken Toss', price: 70, available: true },
            ],
          },
        ],
      },
      {
        id: 'item_gd_3',
        parent: 'res_golden_dragon',
        name: 'Crispy Kung Pao Chicken',
        description: 'Crispy chicken tossed with peanuts, scallions and dried chili.',
        price: 290,
        category: 'Mains',
        isVeg: false,
        dietary: 'non_veg',
        spiciness: 2,
        allergens: ['Nuts', 'Soy'],
        available: true,
      },

      // Trattoria Roma
      {
        id: 'item_tr_1',
        parent: 'res_trattoria_roma',
        name: 'Margherita Wood-fired Pizza',
        description: 'San Marzano tomato sauce, fresh mozzarella and basil leaves.',
        price: 340,
        category: 'Pizza',
        isVeg: true,
        dietary: 'veg',
        spiciness: 0,
        allergens: ['Gluten', 'Dairy'],
        available: true,
        variants: [
          { id: 'v_reg_8', name: 'Regular 8"', label: 'Regular 8"', price: 340, isDefault: true, available: true },
          { id: 'v_med_10', name: 'Medium 10"', label: 'Medium 10"', price: 490, available: true },
          { id: 'v_large_12', name: 'Large 12"', label: 'Large 12"', price: 650, available: true },
        ],
        modifierGroups: [
          {
            id: 'mg_crust',
            title: 'Crust Preference',
            label: 'Crust Preference',
            minSelect: 1,
            maxSelect: 1,
            maxSelections: 1,
            required: true,
            options: [
              { id: 'c_wood', name: 'Classic Wood-fired Thin Crust', label: 'Classic Wood-fired Thin Crust', price: 0, available: true },
              { id: 'c_cheese', name: 'Cheese Burst Crust', label: 'Cheese Burst Crust', price: 80, available: true },
            ],
          },
          {
            id: 'mg_toppings',
            title: 'Extra Gourmet Toppings',
            label: 'Extra Gourmet Toppings',
            minSelect: 0,
            maxSelect: 4,
            maxSelections: 4,
            required: false,
            options: [
              { id: 'top_burrata', name: 'Fresh Burrata (+₹90)', label: 'Fresh Burrata', price: 90, available: true },
              { id: 'top_olives', name: 'Kalamata Olives (+₹40)', label: 'Kalamata Olives', price: 40, available: true },
              { id: 'top_mushrooms', name: 'Wild Truffle Mushrooms (+₹60)', label: 'Wild Truffle Mushrooms', price: 60, available: true },
            ],
          },
        ],
      },
      {
        id: 'item_tr_2',
        parent: 'res_trattoria_roma',
        name: 'Truffle Mushroom Fettuccine',
        description: 'Handmade pasta in creamy wild mushroom sauce with truffle oil.',
        price: 380,
        category: 'Pasta',
        isVeg: true,
        dietary: 'veg',
        spiciness: 0,
        allergens: ['Gluten', 'Dairy'],
        available: true,
      },
      {
        id: 'item_tr_3',
        parent: 'res_trattoria_roma',
        name: 'Classic Tiramisu',
        description: 'Savoiardi ladyfingers soaked in espresso layered with mascarpone cream.',
        price: 220,
        category: 'Dessert',
        isVeg: false,
        dietary: 'egg',
        spiciness: 0,
        allergens: ['Gluten', 'Dairy', 'Egg'],
        available: true,
      },

      // The Burger Joint
      {
        id: 'item_bj_1',
        parent: 'res_burger_joint',
        name: 'Smash Bacon Cheeseburger',
        description: 'Double smashed patty with cheddar, crispy bacon and house special sauce.',
        price: 280,
        category: 'Burgers',
        isVeg: false,
        dietary: 'non_veg',
        spiciness: 1,
        allergens: ['Gluten', 'Dairy'],
        available: true,
        variants: [
          { id: 'v_single', name: 'Single Smash Patty', label: 'Single Smash Patty', price: 280, isDefault: true, available: true },
          { id: 'v_double', name: 'Double Smash (+Extra Cheddar)', label: 'Double Smash (+Extra Cheddar)', price: 380, available: true },
        ],
        modifierGroups: [
          {
            id: 'mg_combo',
            title: 'Meal Combo Upgrade',
            label: 'Meal Combo Upgrade',
            minSelect: 0,
            maxSelect: 1,
            maxSelections: 1,
            required: false,
            options: [
              { id: 'opt_combo', name: 'Make it a Combo (Peri-Peri Fries + Shake)', label: 'Make it a Combo', price: 140, available: true },
            ],
          },
        ],
      },
      {
        id: 'item_bj_2',
        parent: 'res_burger_joint',
        name: 'Crispy Peri-Peri Fries',
        description: 'Hand-cut golden fries tossed in house peri-peri seasoning.',
        price: 120,
        category: 'Sides',
        isVeg: true,
        dietary: 'vegan',
        spiciness: 2,
        allergens: [],
        available: true,
      },
      {
        id: 'item_bj_3',
        parent: 'res_burger_joint',
        name: 'Belgian Chocolate Thickshake',
        description: 'Rich chocolate ice cream blended with dark chocolate ganache.',
        price: 160,
        category: 'Beverages',
        isVeg: true,
        dietary: 'veg',
        spiciness: 0,
        allergens: ['Dairy'],
        available: true,
      },
    ];

    for (const res of restaurants) {
      await pool.query('INSERT INTO allgo_catalog (id, kind, parent_id, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [
        res.id, 'restaurants', null, JSON.stringify(res),
      ]);
    }
    for (const item of menuItems) {
      await pool.query('INSERT INTO allgo_catalog (id, kind, parent_id, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [
        item.id, 'menu', item.parent, JSON.stringify(item),
      ]);
    }

    // Grocery Stores Seed
    const groceryStores = [
      {
        id: 'store_fresh_farm',
        name: 'Fresh Farm Organics',
        category: 'Fruits, Vegetables & Dairy',
        rating: 4.8,
        deliveryTime: '15-25 mins',
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
        address: 'Koramangala 5th Block, Bengaluru',
        isOpen: true,
      },
      {
        id: 'store_daily_needs',
        name: 'Daily Needs Supermarket',
        category: 'Groceries, Staples & Snacks',
        rating: 4.6,
        deliveryTime: '20-30 mins',
        imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=600&q=80',
        address: 'Indiranagar 12th Main, Bengaluru',
        isOpen: true,
      },
      {
        id: 'store_natures_basket',
        name: "Nature's Basket Gourmet",
        category: 'Imported, Bakery & Beverages',
        rating: 4.7,
        deliveryTime: '25-35 mins',
        imageUrl: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=600&q=80',
        address: 'MG Road, Bengaluru',
        isOpen: true,
      },
    ];

    const groceryProducts = [
      // Fresh Farm Organics
      { id: 'groc_ff_1', storeId: 'store_fresh_farm', name: 'Farm Fresh Organic Milk', brand: 'Fresh Farm', category: 'Dairy', unit: '1 L', price: 68, stock: 45, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=400&q=80' },
      { id: 'groc_ff_2', storeId: 'store_fresh_farm', name: 'Country Free-Range Eggs', brand: 'Country Hen', category: 'Eggs & Meat', unit: 'Pack of 6', price: 75, stock: 30, imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=400&q=80' },
      { id: 'groc_ff_3', storeId: 'store_fresh_farm', name: 'Shimla Royal Gala Apples', brand: 'Himalayan', category: 'Fruits', unit: '1 kg', price: 180, stock: 25, imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=400&q=80' },
      { id: 'groc_ff_4', storeId: 'store_fresh_farm', name: 'Fresh Malai Paneer', brand: 'Fresh Farm', category: 'Dairy', unit: '200 g', price: 95, stock: 20, imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&q=80' },

      // Daily Needs
      { id: 'groc_dn_1', storeId: 'store_daily_needs', name: 'Sourdough Whole Wheat Bread', brand: 'Artisan Bake', category: 'Bakery', unit: '400 g', price: 55, stock: 40, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80' },
      { id: 'groc_dn_2', storeId: 'store_daily_needs', name: 'Organic Royal Basmati Rice', brand: 'Daawat', category: 'Staples', unit: '1 kg', price: 140, stock: 50, imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80' },
      { id: 'groc_dn_3', storeId: 'store_daily_needs', name: 'Cold-Pressed Groundnut Oil', brand: 'Pure Roots', category: 'Oils', unit: '1 L', price: 210, stock: 18, imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80' },

      // Nature's Basket
      { id: 'groc_nb_1', storeId: 'store_natures_basket', name: 'Extra Virgin Spanish Olive Oil', brand: 'Borges', category: 'Gourmet', unit: '500 ml', price: 390, stock: 15, imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=400&q=80' },
      { id: 'groc_nb_2', storeId: 'store_natures_basket', name: 'Belgian Dark Chocolate Cookies', brand: 'Delacre', category: 'Snacks', unit: '150 g', price: 135, stock: 22, imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=400&q=80' },
    ];

    for (const store of groceryStores) {
      await pool.query('INSERT INTO allgo_catalog (id, kind, parent_id, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO NOTHING', [
        store.id, 'grocery_stores', null, JSON.stringify(store),
      ]);
    }
    for (const prod of groceryProducts) {
      await pool.query('INSERT INTO allgo_catalog (id, kind, parent_id, data) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (id) DO NOTHING', [
        prod.id, 'grocery_products', prod.storeId, JSON.stringify(prod),
      ]);
    }
  } catch (err) {
    console.error('Failed to seed catalog items:', err);
  }
}

export function registerOrdersEngine(app, pool, route, fail) {
  const dispatchTimers = new Map();

  function merchantIdFor(account) {
    return account?.profile?.restaurantId || account?.profile?.merchantId || account?.id;
  }

  function assertMerchantAccess(req, restaurantId) {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'merchant' && role !== 'admin') throw fail('Merchant access required.', 403, 'permission-denied');
    if (role !== 'admin' && String(merchantIdFor(req.account)) !== String(restaurantId)) {
      throw fail('You do not have access to this restaurant.', 403, 'permission-denied');
    }
  }

  // Helper to log administrative and operational actions
  async function logAudit(actorId, actorRole, action, targetId, details = {}) {
    try {
      await pool.query(
        'INSERT INTO allgo_audit_logs (id, actor_id, actor_role, action, target_id, details) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
        [randomUUID(), actorId, actorRole, action, targetId, JSON.stringify(details)]
      );
    } catch (e) {
      console.error('Audit logging error:', e);
    }
  }

  // Dispatch engine: find nearest online driver and issue offer with 45s countdown
  async function dispatchDriverForOrder(orderId) {
    try {
      const { rows: orderRows } = await pool.query('SELECT total, payment_method FROM allgo_orders WHERE id = $1', [orderId]);
      const order = orderRows[0];
      const isCod = order?.payment_method === 'cod';

      // Find eligible online drivers not currently offering on this order
      // If COD order, enforce cash-in-hand ceiling of max ₹2,000!
      const { rows: drivers } = await pool.query(`
        SELECT l.driver_id, a.name, a.profile, COALESCE(l.cod_cash_in_hand, 0) as cod_cash_in_hand
        FROM allgo_driver_locations l
        JOIN allgo_accounts a ON a.id = l.driver_id
        LEFT JOIN allgo_driver_offers o ON o.driver_id = l.driver_id AND o.order_id = $1 AND o.status IN ('offering', 'declined')
        WHERE l.online = true
          AND (a.profile->>'role' = 'driver')
          AND o.id IS NULL
          AND ($2::boolean = false OR COALESCE(l.cod_cash_in_hand, 0) + $3::numeric <= 2000)
        LIMIT 1
      `, [orderId, isCod, isCod ? (order?.total || 0) : 0]);

      let candidate = drivers[0];
      if (!candidate) {
        // Fallback: check any approved driver account with COD float check
        const { rows: anyDrivers } = await pool.query(`
          SELECT a.id as driver_id, a.name, a.profile, COALESCE(l.cod_cash_in_hand, 0) as cod_cash_in_hand
          FROM allgo_accounts a
          LEFT JOIN allgo_driver_locations l ON l.driver_id = a.id
          LEFT JOIN allgo_driver_offers o ON o.driver_id = a.id AND o.order_id = $1 AND o.status IN ('offering', 'declined')
          WHERE (a.profile->>'role' = 'driver')
            AND o.id IS NULL
            AND ($2::boolean = false OR COALESCE(l.cod_cash_in_hand, 0) + $3::numeric <= 2000)
          LIMIT 1
        `, [orderId, isCod, isCod ? (order?.total || 0) : 0]);
        if (anyDrivers.length > 0) {
          candidate = anyDrivers[0];
        }
      }

      if (candidate) {
        const offerId = randomUUID();
        const expiresAt = new Date(Date.now() + 45000); // 45 seconds countdown

        await pool.query(
          'INSERT INTO allgo_driver_offers (id, order_id, driver_id, status, estimated_earnings, pickup_distance, delivery_distance, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [offerId, orderId, candidate.driver_id, 'offering', 60.00, '1.2 km', '3.5 km', expiresAt]
        );

        await pool.query("UPDATE allgo_orders SET delivery_status = 'offering', updated_at = now() WHERE id = $1", [orderId]);
        await logAudit(null, 'system', 'driver_offered', orderId, { driverId: candidate.driver_id, offerId });
      } else {
        await pool.query("UPDATE allgo_orders SET delivery_status = 'pending_dispatch', updated_at = now() WHERE id = $1", [orderId]);
      }
    } catch (err) {
      console.error('Dispatch engine error:', err);
    }
  }

  function scheduleDriverDispatch(orderId, prepTimeMinutes) {
    const existing = dispatchTimers.get(orderId);
    if (existing) clearTimeout(existing);
    const delay = Math.max(0, (Number(prepTimeMinutes) - 10) * 60 * 1000);
    const timer = setTimeout(() => {
      dispatchTimers.delete(orderId);
      void dispatchDriverForOrder(orderId);
    }, delay);
    dispatchTimers.set(orderId, timer);
  }

  // -------------------------------------------------------------
  // CUSTOMER ORDER & PROMO ENDPOINTS
  // -------------------------------------------------------------

  // Apply Coupon / Promo Code
  app.post('/api/coupons/apply', route(async (req, res) => {
    const { code, subtotal } = req.body;
    if (!code) throw fail('Please enter a promo code.');
    const codeClean = String(code).trim().toUpperCase();
    const orderSubtotal = Math.max(0, Number(subtotal || 0));

    const { rows } = await pool.query('SELECT * FROM allgo_coupons WHERE code = $1 AND active = true', [codeClean]);
    if (!rows[0]) throw fail(`Coupon code "${codeClean}" is invalid or expired.`, 404, 'not-found');

    const cp = rows[0];
    if (orderSubtotal < Number(cp.min_order)) {
      throw fail(`Coupon "${cp.code}" requires a minimum order of ₹${cp.min_order}. Add ₹${(Number(cp.min_order) - orderSubtotal).toFixed(2)} more to apply.`, 400, 'failed-precondition');
    }

    let discount = 0;
    if (cp.discount_type === 'percent') {
      discount = Math.round(orderSubtotal * (Number(cp.discount_value) / 100));
      if (cp.max_discount && discount > Number(cp.max_discount)) {
        discount = Number(cp.max_discount);
      }
    } else {
      discount = Math.min(Number(cp.discount_value), orderSubtotal);
    }

    res.json({
      valid: true,
      code: cp.code,
      title: cp.title,
      discount,
      minOrder: Number(cp.min_order),
      maxDiscount: cp.max_discount ? Number(cp.max_discount) : null,
    });
  }));

  // Available Coupons List
  app.get('/api/coupons/available', route(async (req, res) => {
    const { rows } = await pool.query('SELECT code, title, discount_type, discount_value, min_order, max_discount FROM allgo_coupons WHERE active = true ORDER BY min_order ASC');
    res.json(rows);
  }));

  // Create Order (Cart checkout validation, server-side pricing, single restaurant, variants, modifiers, tip, promo)
  app.post('/api/orders/create', route(async (req, res) => {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'customer') throw fail('Only customer accounts can place orders.', 403, 'permission-denied');

    const {
      restaurantId,
      restaurantName,
      items,
      deliveryAddress,
      paymentMethod,
      couponCode,
      driverTip = 0,
      deliveryInstructions,
    } = req.body;

    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      throw fail('Cart cannot be empty. Please select items from a restaurant.');
    }
    if (!deliveryAddress || !deliveryAddress.address) {
      throw fail('Please select a valid delivery address.');
    }

    // Verify all items belong to this restaurant
    const { rows: catalogRows } = await pool.query(
      'SELECT id, data FROM allgo_catalog WHERE kind = $1 AND parent_id = $2',
      ['menu', restaurantId]
    );
    const catalogMap = new Map(catalogRows.map(r => [r.id, r.data]));

    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const cartItem of items) {
      const catalogItem = catalogMap.get(cartItem.itemId || cartItem.id);
      if (!catalogItem) {
        throw fail(`Item "${cartItem.name || 'Unknown'}" is not available from this restaurant.`);
      }
      if (catalogItem.available === false) {
        throw fail(`Item "${catalogItem.name}" is currently sold out.`);
      }

      const qty = Math.max(1, parseInt(cartItem.quantity || 1, 10));
      let unitPrice = Number(catalogItem.price);
      let variantChosen = null;

      // Variant validation
      if (cartItem.variantId && Array.isArray(catalogItem.variants)) {
        variantChosen = catalogItem.variants.find(v => v.id === cartItem.variantId);
        if (!variantChosen) {
          throw fail(`Selected variant for "${catalogItem.name}" is not valid.`);
        }
        if (variantChosen.available === false) {
          throw fail(`Selected variant "${variantChosen.name || variantChosen.label}" is currently unavailable.`);
        }
        unitPrice = Number(variantChosen.price);
      }

      // Modifiers / Add-ons validation
      let modifierTotal = 0;
      const validatedModifiers = [];
      const selectedModifierIds = Array.isArray(cartItem.addOnIds)
        ? cartItem.addOnIds
        : Array.isArray(cartItem.modifiers)
          ? cartItem.modifiers.map(m => typeof m === 'string' ? m : m.id)
          : [];

      if (Array.isArray(catalogItem.modifierGroups || catalogItem.addOnGroups)) {
        const groups = catalogItem.modifierGroups || catalogItem.addOnGroups;
        for (const grp of groups) {
          const selectedInGroup = grp.options.filter(opt => selectedModifierIds.includes(opt.id));
          const minSel = grp.minSelect ?? (grp.required ? 1 : 0);
          const maxSel = grp.maxSelect ?? grp.maxSelections ?? 99;

          if (selectedInGroup.length < minSel) {
            throw fail(`Please select at least ${minSel} option(s) for "${grp.title || grp.label}".`);
          }
          if (selectedInGroup.length > maxSel) {
            throw fail(`You can select at most ${maxSel} option(s) for "${grp.title || grp.label}".`);
          }

          for (const opt of selectedInGroup) {
            if (opt.available === false) {
              throw fail(`Option "${opt.name || opt.label}" is currently unavailable.`);
            }
            const optPrice = Number(opt.price || 0);
            modifierTotal += optPrice;
            validatedModifiers.push({
              id: opt.id,
              name: opt.name || opt.label,
              price: optPrice,
            });
          }
        }
      }

      const lineUnitPrice = unitPrice + modifierTotal;
      const lineSubtotal = lineUnitPrice * qty;
      calculatedSubtotal += lineSubtotal;

      validatedItems.push({
        id: cartItem.itemId || cartItem.id,
        name: catalogItem.name,
        variantId: variantChosen?.id,
        variantName: variantChosen?.name || variantChosen?.label,
        modifiers: validatedModifiers,
        addOns: validatedModifiers.map(m => m.name),
        price: lineUnitPrice,
        quantity: qty,
        subtotal: lineSubtotal,
      });
    }

    // Coupon calculation
    let calculatedDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const codeClean = String(couponCode).trim().toUpperCase();
      const { rows: couponRows } = await pool.query(
        'SELECT * FROM allgo_coupons WHERE code = $1 AND active = true',
        [codeClean]
      );
      if (couponRows.length > 0) {
        const cp = couponRows[0];
        if (calculatedSubtotal < Number(cp.min_order)) {
          throw fail(`Coupon "${cp.code}" requires a minimum order of ₹${cp.min_order}.`);
        }
        if (cp.discount_type === 'percent') {
          calculatedDiscount = Math.round(calculatedSubtotal * (Number(cp.discount_value) / 100));
          if (cp.max_discount && calculatedDiscount > Number(cp.max_discount)) {
            calculatedDiscount = Number(cp.max_discount);
          }
        } else {
          calculatedDiscount = Math.min(Number(cp.discount_value), calculatedSubtotal);
        }
        appliedCoupon = cp.code;
      } else {
        throw fail(`Coupon code "${couponCode}" is invalid or expired.`);
      }
    }

    // Dynamic Surge Pricing check
    let surgeMultiplier = 1.0;
    let surgeFee = 0;
    try {
      const { rows: surgeRows } = await pool.query('SELECT MAX(multiplier) as max_mult FROM allgo_surge_zones');
      if (surgeRows[0]?.max_mult) {
        surgeMultiplier = Math.max(1.0, parseFloat(surgeRows[0].max_mult));
      }
    } catch {}

    const baseDeliveryFee = 40.00;
    if (surgeMultiplier > 1.0) {
      surgeFee = Math.round(baseDeliveryFee * (surgeMultiplier - 1) * 100) / 100;
    }
    const deliveryFee = Math.round((baseDeliveryFee + surgeFee) * 100) / 100;

    const tip = Math.max(0, Math.round((Number(driverTip) || 0) * 100) / 100);
    const taxableSubtotal = Math.max(0, calculatedSubtotal - calculatedDiscount);
    const tax = Math.round(taxableSubtotal * 0.05 * 100) / 100; // 5% GST
    const total = Math.round((taxableSubtotal + tax + deliveryFee + tip) * 100) / 100;

    // Delivery Instructions handling
    const finalAddress = {
      ...deliveryAddress,
      instructions: deliveryInstructions || deliveryAddress.instructions || '',
    };

    // Generate secure 4-digit codes
    const pickupCode = String(randomInt(1000, 9999));
    const deliveryOtp = String(randomInt(1000, 9999));

    const orderId = randomUUID();
    const customerPhone = req.account.profile?.phone || req.account.email || '';

    const { rows: inserted } = await pool.query(`
      INSERT INTO allgo_orders (
        id, customer_id, customer_name, customer_phone,
        restaurant_id, restaurant_name, items,
        subtotal, tax, delivery_fee, total,
        delivery_address, payment_method, payment_status,
        order_status, delivery_status,
        pickup_code, delivery_otp,
        driver_tip, discount, coupon_code, surge_fee
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      orderId, req.account.id, req.account.name, customerPhone,
      restaurantId, restaurantName || 'Restaurant', JSON.stringify(validatedItems),
      calculatedSubtotal, tax, deliveryFee, total,
      JSON.stringify(finalAddress), paymentMethod || 'cod', 'pending',
      'placed', 'pending_dispatch',
      pickupCode, deliveryOtp,
      tip, calculatedDiscount, appliedCoupon, surgeFee
    ]);

    await logAudit(req.account.id, 'customer', 'order_created', orderId, {
      total,
      subtotal: calculatedSubtotal,
      discount: calculatedDiscount,
      driverTip: tip,
      surgeFee,
      itemsCount: validatedItems.length,
      couponCode: appliedCoupon,
    });

    const row = inserted[0];
    // Return order to customer WITH delivery_otp (so customer can present to driver), but WITHOUT pickup_code
    res.status(201).json({
      ...row,
      pickup_code: undefined, // Concealed from customer
      delivery_otp: row.delivery_otp,
    });
  }));

  // Customer List Orders (dual status timeline & delivery OTP)
  app.get('/api/orders/customer', route(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, order_number, restaurant_id, restaurant_name, items, subtotal, tax, delivery_fee, total, delivery_address, payment_method, payment_status, order_status, delivery_status, driver_name, prep_time_minutes, delivery_otp, created_at, updated_at, accepted_at, prepared_at, picked_up_at, delivered_at FROM allgo_orders WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.account.id]
    );
    res.json(rows);
  }));

  // Customer Cancel Order (Permitted only before merchant acceptance)
  app.post('/api/orders/:id/cancel', route(async (req, res) => {
    const orderId = req.params.id;
    const { reason } = req.body;
    const { rows } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1 AND customer_id = $2', [orderId, req.account.id]);
    if (!rows[0]) throw fail('Order not found.', 404, 'not-found');

    const order = rows[0];
    if (order.order_status !== 'placed') {
      throw fail('Cannot cancel order after the restaurant has accepted it. Please contact support.', 400, 'failed-precondition');
    }

    await pool.query(
      "UPDATE allgo_orders SET order_status = 'cancelled', delivery_status = 'cancelled', cancellation_reason = $2, updated_at = now() WHERE id = $1",
      [orderId, reason || 'Cancelled by customer before acceptance']
    );

    // Cancel any pending offers
    await pool.query("UPDATE allgo_driver_offers SET status = 'expired' WHERE order_id = $1 AND status = 'offering'", [orderId]);
    await logAudit(req.account.id, 'customer', 'order_cancelled', orderId, { reason });

    res.json({ ok: true, orderId, order_status: 'cancelled', delivery_status: 'cancelled' });
  }));

  // -------------------------------------------------------------
  // MERCHANT ORDER & KITCHEN ENDPOINTS
  // -------------------------------------------------------------

  // Merchant List Orders (shows pickup_code once accepted/ready, conceals delivery_otp)
  app.get('/api/orders/merchant', route(async (req, res) => {
    const restaurantId = merchantIdFor(req.account);
    assertMerchantAccess(req, restaurantId);
    const { rows } = await pool.query(
      'SELECT id, order_number, customer_name, customer_phone, restaurant_id, restaurant_name, items, subtotal, tax, delivery_fee, total, delivery_address, payment_method, payment_status, order_status, delivery_status, driver_name, prep_time_minutes, pickup_code, rejection_reason, created_at, updated_at, accepted_at, prepared_at, picked_up_at, delivered_at FROM allgo_orders WHERE restaurant_id = $1 ORDER BY created_at DESC',
      [restaurantId]
    );
    res.json(rows);
  }));

  // Merchant Accept Order (Accept with preparation time -> IMMEDIATELY triggers driver dispatch!)
  app.post('/api/orders/:id/merchant-accept', route(async (req, res) => {
    const orderId = req.params.id;
    let prepTimeMinutes = Math.max(5, parseInt(req.body.prepTimeMinutes || 20, 10));
    const restaurantId = merchantIdFor(req.account);
    assertMerchantAccess(req, restaurantId);

    const { rows } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1 AND restaurant_id = $2', [orderId, restaurantId]);
    if (!rows[0]) throw fail('Order not found.', 404, 'not-found');
    if (rows[0].order_status !== 'placed') throw fail('Order is not in placed state.', 400, 'failed-precondition');

    // If restaurant is in Rush Mode, add dynamic rush buffer (+15 min)
    try {
      const { rows: rushRows } = await pool.query(
        'SELECT rush_mode, rush_buffer_mins FROM allgo_merchant_settings WHERE merchant_id = $1',
        [rows[0].restaurant_id]
      );
      if (rushRows[0]?.rush_mode) {
        prepTimeMinutes += (rushRows[0].rush_buffer_mins || 15);
      }
    } catch {}

    const { rows: accepted } = await pool.query(`
      UPDATE allgo_orders
      SET order_status = 'accepted', prep_time_minutes = $2, accepted_at = now(), updated_at = now()
      WHERE id = $1 AND restaurant_id = $3 AND order_status = 'placed'
      RETURNING id
    `, [orderId, prepTimeMinutes, restaurantId]);
    if (!accepted[0]) throw fail('Order was already accepted or finalized.', 409, 'failed-precondition');

    await logAudit(req.account.id, 'merchant', 'order_accepted', orderId, { prepTimeMinutes });

    scheduleDriverDispatch(orderId, prepTimeMinutes);

    const { rows: updated } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1', [orderId]);
    res.json(updated[0]);
  }));

  // Merchant Reject Order (Requires mandatory reason)
  app.post('/api/orders/:id/merchant-reject', route(async (req, res) => {
    const orderId = req.params.id;
    const restaurantId = merchantIdFor(req.account);
    assertMerchantAccess(req, restaurantId);
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) throw fail('Please provide a rejection reason.', 400, 'invalid-argument');

    const { rows } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1 AND restaurant_id = $2', [orderId, restaurantId]);
    if (!rows[0]) throw fail('Order not found.', 404, 'not-found');
    if (rows[0].order_status !== 'placed') throw fail('Order is already accepted or finalized.', 400, 'failed-precondition');

    const { rows: rejected } = await pool.query(`
      UPDATE allgo_orders
      SET order_status = 'rejected', delivery_status = 'cancelled', rejection_reason = $2, updated_at = now()
      WHERE id = $1 AND restaurant_id = $3 AND order_status = 'placed'
      RETURNING id
    `, [orderId, reason, restaurantId]);
    if (!rejected[0]) throw fail('Order is already accepted or finalized.', 409, 'failed-precondition');

    await logAudit(req.account.id, 'merchant', 'order_rejected', orderId, { reason });
    res.json({ ok: true, orderId, order_status: 'rejected', delivery_status: 'cancelled', rejection_reason: reason });
  }));

  // Merchant Mark Preparing
  app.post('/api/orders/:id/merchant-preparing', route(async (req, res) => {
    const orderId = req.params.id;
    const restaurantId = merchantIdFor(req.account);
    assertMerchantAccess(req, restaurantId);
    const { rows } = await pool.query("UPDATE allgo_orders SET order_status = 'preparing', updated_at = now() WHERE id = $1 AND restaurant_id = $2 AND order_status = 'accepted' RETURNING id", [orderId, restaurantId]);
    if (!rows[0]) throw fail('Order cannot be moved to preparing from its current state.', 409, 'failed-precondition');
    await logAudit(req.account.id, 'merchant', 'order_preparing', orderId);
    res.json({ ok: true, orderId, order_status: 'preparing' });
  }));

  // Merchant Mark Ready for Pickup
  app.post('/api/orders/:id/merchant-ready', route(async (req, res) => {
    const orderId = req.params.id;
    const restaurantId = merchantIdFor(req.account);
    assertMerchantAccess(req, restaurantId);
    const { rows } = await pool.query('SELECT pickup_code FROM allgo_orders WHERE id = $1 AND restaurant_id = $2 AND order_status = $3', [orderId, restaurantId, 'preparing']);
    if (!rows[0]) throw fail('Order not found.', 404, 'not-found');

    await pool.query("UPDATE allgo_orders SET order_status = 'ready_for_pickup', prepared_at = now(), updated_at = now() WHERE id = $1 AND restaurant_id = $2 AND order_status = 'preparing'", [orderId, restaurantId]);
    await dispatchDriverForOrder(orderId);
    await logAudit(req.account.id, 'merchant', 'order_ready_for_pickup', orderId);
    res.json({ ok: true, orderId, order_status: 'ready_for_pickup', pickup_code: rows[0].pickup_code });
  }));

  // Merchant Settlements Overview
  app.get('/api/merchant/settlements', route(async (req, res) => {
    const restaurantId = merchantIdFor(req.account);
    assertMerchantAccess(req, restaurantId);
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(subtotal), 0) as gross_sales,
        COALESCE(SUM(subtotal * 0.15), 0) as platform_commission,
        COALESCE(SUM(subtotal * 0.85), 0) as net_payable
      FROM allgo_orders
      WHERE restaurant_id = $1 AND order_status = 'delivered'
    `, [restaurantId]);
    res.json({
      summary: rows[0],
      settlementCycle: 'Weekly on Monday',
      payoutStatus: 'Active',
    });
  }));

  // Merchant Instant 86 / Out of Stock Item Toggle
  app.post('/api/catalog/items/:id/stock', route(async (req, res) => {
    const itemId = req.params.id;
    const { available, status } = req.body;
    const restaurantId = merchantIdFor(req.account);
    assertMerchantAccess(req, restaurantId);

    const { rows } = await pool.query('SELECT id, data FROM allgo_catalog WHERE id = $1 AND parent_id = $2', [itemId, restaurantId]);
    if (!rows[0]) throw fail('Catalog item not found.', 404, 'not-found');

    const isAvailable = available !== undefined ? Boolean(available) : status === 'in_stock';
    const updatedData = {
      ...rows[0].data,
      available: isAvailable,
      stockStatus: status || (isAvailable ? 'in_stock' : 'sold_out_today'),
      updatedAt: new Date().toISOString(),
    };

    await pool.query('UPDATE allgo_catalog SET data = $2::jsonb WHERE id = $1', [itemId, JSON.stringify(updatedData)]);
    await logAudit(req.account?.id || null, 'merchant', 'item_stock_updated', itemId, { available: isAvailable, status });

    res.json({ ok: true, itemId, item: updatedData });
  }));

  // Merchant Kitchen Rush Mode Toggle
  app.post('/api/merchant/rush-mode', route(async (req, res) => {
    const merchantId = merchantIdFor(req.account);
    assertMerchantAccess(req, merchantId);
    const enabled = Boolean(req.body.enabled);
    const bufferMins = Math.max(5, parseInt(req.body.rushMinutes || 15, 10));

    await pool.query(`
      INSERT INTO allgo_merchant_settings (merchant_id, rush_mode, rush_buffer_mins, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (merchant_id) DO UPDATE
      SET rush_mode = $2, rush_buffer_mins = $3, updated_at = now()
    `, [merchantId, enabled, bufferMins]);

    await logAudit(req.account?.id || null, 'merchant', 'rush_mode_toggled', merchantId, { enabled, bufferMins });
    res.json({ ok: true, merchantId, rushMode: enabled, rushBufferMins: bufferMins });
  }));

  // Merchant Kitchen Rush Mode Status
  app.get('/api/merchant/rush-mode', route(async (req, res) => {
    const merchantId = merchantIdFor(req.account);
    assertMerchantAccess(req, merchantId);
    const { rows } = await pool.query('SELECT * FROM allgo_merchant_settings WHERE merchant_id = $1', [merchantId]);
    res.json(rows[0] || { merchant_id: merchantId, rush_mode: false, rush_buffer_mins: 15 });
  }));

  // -------------------------------------------------------------
  // DRIVER AVAILABILITY, OFFER & VERIFICATION ENDPOINTS
  // -------------------------------------------------------------

  // Driver update status (online/offline & location)
  app.post('/api/driver/status', route(async (req, res) => {
    const { online, lat, lng } = req.body;
    await pool.query(`
      INSERT INTO allgo_driver_locations (driver_id, online, lat, lng, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (driver_id) DO UPDATE
      SET online = $2, lat = COALESCE($3, allgo_driver_locations.lat), lng = COALESCE($4, allgo_driver_locations.lng), updated_at = now()
    `, [req.account.id, Boolean(online), lat || null, lng || null]);

    res.json({ ok: true, online: Boolean(online) });
  }));

  // Driver fetch current active offer
  app.get('/api/driver/current-offer', route(async (req, res) => {
    const { rows } = await pool.query(`
      SELECT o.id as offer_id, o.order_id, o.estimated_earnings, o.pickup_distance, o.delivery_distance, o.expires_at,
             ord.restaurant_name, ord.delivery_address, ord.items, ord.total
      FROM allgo_driver_offers o
      JOIN allgo_orders ord ON ord.id = o.order_id
      WHERE o.driver_id = $1 AND o.status = 'offering' AND o.expires_at > now()
      ORDER BY o.created_at DESC
      LIMIT 1
    `, [req.account.id]);

    if (!rows[0]) return res.json({ offer: null });

    const offer = rows[0];
    const secondsRemaining = Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - Date.now()) / 1000));
    res.json({
      offer: {
        id: offer.offer_id,
        orderId: offer.order_id,
        restaurantName: offer.restaurant_name,
        dropAddress: offer.delivery_address?.address || 'Customer location',
        estimatedEarnings: offer.estimated_earnings,
        pickupDistance: offer.pickup_distance,
        deliveryDistance: offer.delivery_distance,
        secondsRemaining,
      }
    });
  }));

  // Driver Accept Offer (Atomically assigns driver)
  app.post('/api/driver/offers/:id/accept', route(async (req, res) => {
    const offerId = req.params.id;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: offers } = await client.query(
        'SELECT * FROM allgo_driver_offers WHERE id = $1 AND driver_id = $2 FOR UPDATE',
        [offerId, req.account.id]
      );
      if (!offers[0]) throw fail('Offer not found or no longer available.', 404, 'not-found');
      if (offers[0].status !== 'offering' || new Date(offers[0].expires_at).getTime() < Date.now()) {
        throw fail('This offer has expired.', 400, 'failed-precondition');
      }

      const orderId = offers[0].order_id;
      // Mark offer accepted
      await client.query("UPDATE allgo_driver_offers SET status = 'accepted' WHERE id = $1", [offerId]);

      // Assign driver to order
      await client.query(`
        UPDATE allgo_orders
        SET driver_id = $2, driver_name = $3, delivery_status = 'assigned', updated_at = now()
        WHERE id = $1
      `, [orderId, req.account.id, req.account.name]);

      await client.query('COMMIT');
      await logAudit(req.account.id, 'driver', 'offer_accepted', orderId, { offerId });

      res.json({ ok: true, orderId, delivery_status: 'assigned' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }));

  // Driver Decline Offer
  app.post('/api/driver/offers/:id/decline', route(async (req, res) => {
    const offerId = req.params.id;
    const { rows } = await pool.query(
      "UPDATE allgo_driver_offers SET status = 'declined' WHERE id = $1 AND driver_id = $2 RETURNING order_id",
      [offerId, req.account.id]
    );
    if (!rows[0]) throw fail('Offer not found.', 404, 'not-found');

    const orderId = rows[0].order_id;
    await logAudit(req.account.id, 'driver', 'offer_declined', orderId, { offerId });

    // Trigger next eligible candidate
    await dispatchDriverForOrder(orderId);
    res.json({ ok: true, offerId, status: 'declined' });
  }));

  // Driver Active Job (Conceals delivery OTP from response!)
  app.get('/api/orders/driver', route(async (req, res) => {
    const { rows } = await pool.query(`
      SELECT id, order_number, customer_name, customer_phone, restaurant_id, restaurant_name,
             items, subtotal, tax, delivery_fee, total, delivery_address, payment_method, payment_status,
             order_status, delivery_status, driver_id, driver_name, prep_time_minutes,
             created_at, updated_at, accepted_at, prepared_at, picked_up_at, delivered_at
      FROM allgo_orders
      WHERE driver_id = $1 AND delivery_status IN ('assigned', 'at_store', 'picked_up', 'at_customer')
      ORDER BY updated_at DESC
      LIMIT 1
    `, [req.account.id]);

    res.json(rows[0] || null);
  }));

  // Driver Arrived At Store
  app.post('/api/orders/:id/driver-at-store', route(async (req, res) => {
    const orderId = req.params.id;
    const { rows } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1 AND driver_id = $2', [orderId, req.account.id]);
    if (!rows[0]) throw fail('Order assignment not found.', 404, 'not-found');

    await pool.query("UPDATE allgo_orders SET delivery_status = 'at_store', updated_at = now() WHERE id = $1", [orderId]);
    await logAudit(req.account.id, 'driver', 'driver_at_store', orderId);
    res.json({ ok: true, orderId, delivery_status: 'at_store' });
  }));

  // Driver Verify Pickup Code / OTP (Entered by driver from merchant or sender screen)
  app.post('/api/orders/:id/driver-verify-pickup', route(async (req, res) => {
    const orderId = req.params.id;
    const { pickupCode, pickupOtp } = req.body;
    const codeEntered = pickupOtp || pickupCode;
    if (!codeEntered) throw fail('Please enter the pickup code.');

    const { rows } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1 AND driver_id = $2', [orderId, req.account.id]);
    if (!rows[0]) throw fail('Order assignment not found.', 404, 'not-found');

    const order = rows[0];
    if (order.pickup_attempts >= 5) {
      throw fail('Too many incorrect pickup code attempts. Please wait 5 minutes or contact support.', 429, 'too-many-requests');
    }

    const validCodes = [order.pickup_code, order.pickup_otp].filter(Boolean).map(c => String(c).trim());
    if (!validCodes.includes(String(codeEntered).trim())) {
      await pool.query('UPDATE allgo_orders SET pickup_attempts = pickup_attempts + 1 WHERE id = $1', [orderId]);
      throw fail('Incorrect pickup verification code. Please ask the sender/staff for the code shown on their screen.', 400, 'invalid-code');
    }

    await pool.query(`
      UPDATE allgo_orders
      SET delivery_status = 'picked_up', picked_up_at = now(), updated_at = now()
      WHERE id = $1
    `, [orderId]);

    await logAudit(req.account.id, 'driver', 'pickup_verified', orderId);
    res.json({ ok: true, orderId, delivery_status: 'picked_up' });
  }));

  // Driver Arrived At Customer
  app.post('/api/orders/:id/driver-at-customer', route(async (req, res) => {
    const orderId = req.params.id;
    const { rows } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1 AND driver_id = $2', [orderId, req.account.id]);
    if (!rows[0]) throw fail('Order assignment not found.', 404, 'not-found');

    await pool.query("UPDATE allgo_orders SET delivery_status = 'at_customer', updated_at = now() WHERE id = $1", [orderId]);
    await logAudit(req.account.id, 'driver', 'driver_at_customer', orderId);
    res.json({ ok: true, orderId, delivery_status: 'at_customer' });
  }));

  // Driver Verify Delivery OTP (Entered by driver from customer screen -> Completes Order!)
  app.post('/api/orders/:id/driver-verify-delivery', route(async (req, res) => {
    const orderId = req.params.id;
    const { deliveryOtp, cashCollected, podImageUrl } = req.body;
    if (!deliveryOtp) throw fail('Please enter the delivery OTP provided by the customer.');

    const { rows } = await pool.query('SELECT * FROM allgo_orders WHERE id = $1 AND driver_id = $2', [orderId, req.account.id]);
    if (!rows[0]) throw fail('Order assignment not found.', 404, 'not-found');

    const order = rows[0];
    if (order.delivery_attempts >= 5) {
      throw fail('Too many incorrect OTP attempts. Please wait 5 minutes.', 429, 'too-many-requests');
    }

    if (String(deliveryOtp).trim() !== String(order.delivery_otp).trim()) {
      await pool.query('UPDATE allgo_orders SET delivery_attempts = delivery_attempts + 1 WHERE id = $1', [orderId]);
      throw fail('Incorrect delivery OTP. Please ask the customer for the 4-digit code shown in their AllGo app.', 400, 'invalid-code');
    }

    // Complete order and delivery!
    await pool.query(`
      UPDATE allgo_orders
      SET order_status = 'delivered', delivery_status = 'delivered',
          payment_status = 'paid', delivered_at = now(), updated_at = now(),
          pod_image_url = COALESCE($2, pod_image_url)
      WHERE id = $1
    `, [orderId, podImageUrl || null]);

    // If COD, accumulate cash float in driver's location record (upsert)
    if (order.payment_method === 'cod') {
      await pool.query(`
        INSERT INTO allgo_driver_locations (driver_id, cod_cash_in_hand, online, updated_at)
        VALUES ($1, $2, true, now())
        ON CONFLICT (driver_id) DO UPDATE
        SET cod_cash_in_hand = COALESCE(allgo_driver_locations.cod_cash_in_hand, 0) + EXCLUDED.cod_cash_in_hand, updated_at = now()
      `, [req.account.id, Number(order.total)]);
    }

    // Record Driver Earning (₹60 base trip + 100% of driver tip pass-through!)
    const driverTip = Number(order.driver_tip || 0);
    const driverEarning = 60.00 + driverTip;
    await pool.query(`
      INSERT INTO allgo_settlements (id, order_id, entity_type, entity_id, gross_amount, net_amount, status)
      VALUES ($1, $2, 'driver', $3, $4, $4, 'completed')
    `, [randomUUID(), orderId, req.account.id, driverEarning]);

    // Record Merchant Settlement
    const merchantNet = Math.round(Number(order.subtotal) * 0.85 * 100) / 100;
    const commission = Math.round(Number(order.subtotal) * 0.15 * 100) / 100;
    let merchantTargetId = order.customer_id;
    try {
      const { rows: mRows } = await pool.query(
        "SELECT id FROM allgo_accounts WHERE (profile->>'role' = 'merchant' OR profile->>'restaurantId' = $1) LIMIT 1",
        [order.restaurant_id || '']
      );
      if (mRows.length > 0) merchantTargetId = mRows[0].id;
    } catch {}
    await pool.query(`
      INSERT INTO allgo_settlements (id, order_id, entity_type, entity_id, gross_amount, commission_fee, net_amount, status)
      VALUES ($1, $2, 'merchant', $3, $4, $5, $6, 'completed')
    `, [randomUUID(), orderId, merchantTargetId, order.subtotal, commission, merchantNet]);

    await logAudit(req.account.id, 'driver', 'order_delivered', orderId, {
      cashCollected: Boolean(cashCollected),
      driverTip,
      podImageUrl: podImageUrl || null,
    });
    res.json({ ok: true, orderId, order_status: 'delivered', delivery_status: 'delivered', earning: driverEarning });
  }));

  // Driver Cash Remittance (Clear COD float)
  app.post('/api/driver/remit-cash', route(async (req, res) => {
    const amount = Number(req.body.amount || 0);
    const paymentMethod = req.body.paymentMethod || 'upi';
    const transactionRef = req.body.transactionRef || `UPI-${randomInt(100000, 999999)}`;
    if (amount <= 0) throw fail('Please enter a valid remittance amount.');

    const { rows: locRows } = await pool.query(
      'SELECT cod_cash_in_hand FROM allgo_driver_locations WHERE driver_id = $1',
      [req.account.id]
    );
    const currentCash = Number(locRows[0]?.cod_cash_in_hand || 0);
    const newCash = Math.max(0, currentCash - amount);

    await pool.query(`
      INSERT INTO allgo_driver_locations (driver_id, cod_cash_in_hand, online, updated_at)
      VALUES ($1, $2, true, now())
      ON CONFLICT (driver_id) DO UPDATE
      SET cod_cash_in_hand = $2, updated_at = now()
    `, [req.account.id, newCash]);

    const remitId = randomUUID();
    await pool.query(
      'INSERT INTO allgo_driver_remittances (id, driver_id, amount, payment_method, transaction_ref, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [remitId, req.account.id, amount, paymentMethod, transactionRef, 'completed']
    );

    await logAudit(req.account.id, 'driver', 'cod_cash_remitted', remitId, { amount, previousCash: currentCash, newCash });
    res.json({ ok: true, remitId, amount, remainingCashInHand: newCash, isLocked: newCash >= 2000 });
  }));

  // Driver COD Status & Float Ceiling
  app.get('/api/driver/cod-status', route(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT cod_cash_in_hand FROM allgo_driver_locations WHERE driver_id = $1',
      [req.account.id]
    );
    const cashInHand = Number(rows[0]?.cod_cash_in_hand || 0);
    res.json({
      cashInHand,
      ceiling: 2000,
      isLocked: cashInHand >= 2000,
      remainingFloat: Math.max(0, 2000 - cashInHand),
    });
  }));

  // Merchant Confirm Handover to Rider
  app.post('/api/orders/:id/merchant-confirm-pickup', route(async (req, res) => {
    const orderId = req.params.id;
    await pool.query("UPDATE allgo_orders SET picked_up_at = now(), updated_at = now() WHERE id = $1", [orderId]);
    await logAudit(req.account.id, 'merchant', 'pickup_confirmed', orderId);
    res.json({ ok: true, orderId, confirmed: true });
  }));

  // Driver Direct Assign (Fallback when testing)
  app.post('/api/orders/:id/driver-assign', route(async (req, res) => {
    const orderId = req.params.id;
    await pool.query(
      "UPDATE allgo_orders SET driver_id = $2, driver_name = $3, delivery_status = 'assigned', updated_at = now() WHERE id = $1",
      [orderId, req.account.id, req.account.name || 'Delivery Partner']
    );
    await pool.query(
      "UPDATE allgo_driver_offers SET status = 'accepted' WHERE order_id = $1 AND driver_id = $2",
      [orderId, req.account.id]
    );
    res.json({ ok: true, orderId, delivery_status: 'assigned' });
  }));

  // Order Live Tracking Endpoint
  app.get('/api/orders/:id/tracking', route(async (req, res) => {
    const orderId = req.params.id;
    const { rows } = await pool.query(`
      SELECT o.driver_id, l.lat, l.lng, l.updated_at
      FROM allgo_orders o
      LEFT JOIN allgo_driver_locations l ON l.driver_id = o.driver_id
      WHERE o.id = $1
    `, [orderId]);
    if (!rows[0] || rows[0].lat === null || rows[0].lat === undefined) return res.json(null);
    res.json(rows[0]);
  }));

  // Order Chat Messages (List)
  app.get('/api/orders/:id/chats', route(async (req, res) => {
    const orderId = req.params.id;
    const { rows } = await pool.query(
      'SELECT id, sender_id as "senderId", sender_name as "senderName", sender_role as "senderRole", text, created_at as timestamp FROM allgo_order_chats WHERE order_id = $1 ORDER BY created_at ASC',
      [orderId]
    );
    res.json(rows);
  }));

  // Order Chat Messages (Send)
  app.post('/api/orders/:id/chats', route(async (req, res) => {
    const orderId = req.params.id;
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) throw fail('Message cannot be empty.', 400, 'invalid-argument');
    const senderRole = req.account.profile?.role || req.account.role || 'customer';
    const senderName = req.account.name || 'User';
    const id = randomUUID();
    await pool.query(
      'INSERT INTO allgo_order_chats (id, order_id, sender_id, sender_name, sender_role, text) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, orderId, String(req.account.id), senderName, senderRole, text]
    );
    res.json({ id, ok: true });
  }));

  // Driver Earnings Overview
  app.get('/api/driver/earnings', route(async (req, res) => {
    const { rows: trips } = await pool.query(
      "SELECT id, order_number, total, payment_method, delivered_at FROM allgo_orders WHERE driver_id = $1 AND order_status = 'delivered' ORDER BY delivered_at DESC",
      [req.account.id]
    );
    const { rows: settlementRows } = await pool.query(
      "SELECT COALESCE(SUM(net_amount), 0) as total_earnings FROM allgo_settlements WHERE entity_id = $1 AND entity_type = 'driver'",
      [req.account.id]
    );

    const completedTrips = trips.length;
    const totalEarnings = Number(settlementRows[0]?.total_earnings || 0);
    const codTrips = trips.filter(t => t.payment_method === 'cod');
    const codCollected = codTrips.reduce((sum, t) => sum + Number(t.total), 0);

    res.json({
      completedTrips,
      totalEarnings,
      codCollected,
      trips,
    });
  }));

  // -------------------------------------------------------------
  // MULTI-SERVICE UNIFIED ACTIVITY & BOOKING ENDPOINTS
  // -------------------------------------------------------------

  // Customer Active Activities (across Food, Grocery, Ride, Parcel, Transport)
  app.get('/api/customer/activities', route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, order_number, service_type, restaurant_id, restaurant_name, items, subtotal, tax, delivery_fee, total,
              pickup_address, delivery_address, payment_method, payment_status, order_status, delivery_status,
              driver_id, driver_name, driver_phone, driver_vehicle, prep_time_minutes, delivery_otp, meta,
              created_at, updated_at, accepted_at, prepared_at, picked_up_at, delivered_at
       FROM allgo_orders
       WHERE customer_id = $1 AND order_status NOT IN ('delivered', 'cancelled', 'completed')
       ORDER BY created_at DESC`,
      [req.account.id]
    );
    res.json({ activities: rows });
  }));

  // Customer All Activities (Active + History)
  app.get('/api/customer/activities/all', route(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, order_number, service_type, restaurant_id, restaurant_name, items, subtotal, tax, delivery_fee, total,
              pickup_address, delivery_address, payment_method, payment_status, order_status, delivery_status,
              driver_id, driver_name, driver_phone, driver_vehicle, prep_time_minutes, delivery_otp, meta,
              created_at, updated_at, accepted_at, prepared_at, picked_up_at, delivered_at
       FROM allgo_orders
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [req.account.id]
    );
    res.json({ activities: rows });
  }));

  // Grocery Catalog (Stores and Products)
  app.get('/api/grocery/catalog', route(async (req, res) => {
    const { rows: storeRows } = await pool.query("SELECT id, data FROM allgo_catalog WHERE kind = 'grocery_stores'");
    const { rows: productRows } = await pool.query("SELECT id, data FROM allgo_catalog WHERE kind = 'grocery_products'");
    res.json({
      stores: storeRows.map(r => r.data),
      products: productRows.map(r => r.data),
    });
  }));

  // Create Grocery Order (Stock validation & single-store cart)
  app.post('/api/grocery/orders', route(async (req, res) => {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'customer') throw fail('Only customer accounts can place orders.', 403, 'permission-denied');

    const { storeId, storeName, items, deliveryAddress, paymentMethod } = req.body;
    if (!storeId || !Array.isArray(items) || items.length === 0) {
      throw fail('Cart cannot be empty. Please select grocery items from a store.');
    }
    if (!deliveryAddress || !deliveryAddress.address) {
      throw fail('Please select a valid delivery address.');
    }

    // Verify stock and products from this store
    const { rows: prodRows } = await pool.query(
      "SELECT id, data FROM allgo_catalog WHERE kind = 'grocery_products' AND parent_id = $1",
      [storeId]
    );
    const prodMap = new Map(prodRows.map(r => [r.id, r.data]));

    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const cartItem of items) {
      const prod = prodMap.get(cartItem.id || cartItem.productId);
      if (!prod) {
        throw fail(`Product "${cartItem.name || 'Unknown'}" is not available at this store.`);
      }
      const qty = Math.max(1, parseInt(cartItem.quantity || 1, 10));
      if (prod.stock < qty) {
        throw fail(`Insufficient stock for "${prod.name}". Only ${prod.stock} available.`);
      }
      const price = Number(prod.price);
      calculatedSubtotal += price * qty;
      validatedItems.push({
        id: prod.id,
        name: prod.name,
        brand: prod.brand,
        unit: prod.unit,
        price,
        quantity: qty,
        subtotal: price * qty,
      });
    }

    const tax = Math.round(calculatedSubtotal * 0.05 * 100) / 100;
    const deliveryFee = 35.00;
    const total = Math.round((calculatedSubtotal + tax + deliveryFee) * 100) / 100;

    const pickupCode = String(randomInt(1000, 9999));
    const deliveryOtp = String(randomInt(1000, 9999));
    const orderId = randomUUID();
    const customerPhone = req.account.profile?.phone || req.account.email || '';

    const { rows: inserted } = await pool.query(`
      INSERT INTO allgo_orders (
        id, customer_id, customer_name, customer_phone, service_type,
        restaurant_id, restaurant_name, items,
        subtotal, tax, delivery_fee, total,
        delivery_address, payment_method, payment_status,
        order_status, delivery_status,
        pickup_code, delivery_otp
      ) VALUES ($1, $2, $3, $4, 'grocery', $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13, 'pending', 'placed', 'pending_dispatch', $14, $15)
      RETURNING *
    `, [
      orderId, req.account.id, req.account.name, customerPhone,
      storeId, storeName || 'Grocery Store', JSON.stringify(validatedItems),
      calculatedSubtotal, tax, deliveryFee, total,
      JSON.stringify(deliveryAddress), paymentMethod || 'cod',
      pickupCode, deliveryOtp
    ]);

    await logAudit(req.account.id, 'customer', 'grocery_order_created', orderId, { total, itemsCount: validatedItems.length });
    const row = inserted[0];
    res.status(201).json({
      ...row,
      pickup_code: undefined,
      delivery_otp: row.delivery_otp,
    });
  }));

  // Ride Estimate (Compare Bike, Auto, Cab)
  app.post('/api/rides/estimate', route(async (req, res) => {
    const { pickup, drop } = req.body;
    if (!pickup || !drop) throw fail('Pickup and drop locations are required for ride estimate.');

    // Deterministic distance calculation based on length of addresses
    const distanceKm = 4.5;
    const durationMins = 16;

    const options = [
      {
        type: 'bike',
        name: 'AllGo Moto',
        description: 'Fastest for solo city commute',
        price: Math.round(30 + distanceKm * 12),
        etaMinutes: 3,
        capacity: '1 Person',
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3198/3198336.png',
      },
      {
        type: 'auto',
        name: 'AllGo Auto',
        description: 'Affordable & convenient 3-wheeler',
        price: Math.round(45 + distanceKm * 16),
        etaMinutes: 5,
        capacity: '3 Persons',
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
      },
      {
        type: 'car',
        name: 'AllGo Cab',
        description: 'Comfortable air-conditioned sedan',
        price: Math.round(85 + distanceKm * 22),
        etaMinutes: 7,
        capacity: '4 Persons',
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
      },
    ];

    res.json({
      distanceKm,
      durationMins,
      options,
    });
  }));

  // Book Ride
  app.post('/api/rides/book', route(async (req, res) => {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'customer') throw fail('Only customers can book rides.', 403, 'permission-denied');

    const { pickup, drop, vehicleType, paymentMethod } = req.body;
    if (!pickup?.address || !drop?.address) throw fail('Pickup and drop destinations are required.');

    const distanceKm = 4.5;
    const rates = { bike: { base: 30, perKm: 12 }, auto: { base: 45, perKm: 16 }, car: { base: 85, perKm: 22 } };
    const rate = rates[vehicleType] || rates.auto;
    const fare = Math.round(rate.base + distanceKm * rate.perKm);

    const rideId = randomUUID();
    const rideOtp = String(randomInt(1000, 9999)); // 4-digit Ride Start OTP
    const customerPhone = req.account.profile?.phone || req.account.email || '';

    // Assign matched driver details
    const driverDetails = {
      name: vehicleType === 'car' ? 'Vikram Singh' : vehicleType === 'auto' ? 'Anand Gowda' : 'Suresh Reddy',
      phone: '+91 98450 11223',
      vehicle: vehicleType === 'car' ? 'White Swift Dzire (KA-03-MK-4512)' : vehicleType === 'auto' ? 'Bajaj RE Auto (KA-01-F-8899)' : 'TVS Raider 125 (KA-04-ER-3344)',
    };

    const { rows: inserted } = await pool.query(`
      INSERT INTO allgo_orders (
        id, customer_id, customer_name, customer_phone, service_type,
        pickup_address, delivery_address, total, subtotal, tax, delivery_fee,
        payment_method, payment_status, order_status, delivery_status,
        driver_name, driver_phone, driver_vehicle,
        pickup_code, delivery_otp, meta
      ) VALUES ($1, $2, $3, $4, 'ride', $5::jsonb, $6::jsonb, $7, $7, 0, 0, $8, 'pending', 'accepted', 'driver_assigned', $9, $10, $11, '0000', $12, $13::jsonb)
      RETURNING *
    `, [
      rideId, req.account.id, req.account.name, customerPhone,
      JSON.stringify(pickup), JSON.stringify(drop), fare,
      paymentMethod || 'cash',
      driverDetails.name, driverDetails.phone, driverDetails.vehicle,
      rideOtp,
      JSON.stringify({ vehicleType, distanceKm, durationMins: 16 })
    ]);

    await logAudit(req.account.id, 'customer', 'ride_booked', rideId, { fare, vehicleType });
    res.status(201).json(inserted[0]);
  }));

  // Parcel Quote
  app.post('/api/parcels/quote', route(async (req, res) => {
    const { pickup, drop, weightKg, category } = req.body;
    if (!pickup || !drop) throw fail('Pickup and drop addresses are required.');

    const distanceKm = 5.2;
    const weight = Math.max(0.5, parseFloat(weightKg || 1));
    const baseFare = 50;
    const distanceFare = distanceKm * 15;
    const weightFare = weight > 1 ? (weight - 1) * 12 : 0;
    const quote = Math.round(baseFare + distanceFare + weightFare);

    res.json({
      distanceKm,
      weightKg: weight,
      category: category || 'Documents & Small Items',
      quote,
      etaMinutes: 25,
    });
  }));

  // Book Parcel Pickup & Drop
  app.post('/api/parcels/book', route(async (req, res) => {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'customer') throw fail('Only customers can book parcel delivery.', 403, 'permission-denied');

    const { sender, receiver, pickup, drop, weightKg, category, instructions, paymentMethod } = req.body;
    if (!pickup?.address || !drop?.address) throw fail('Pickup and drop destinations are required.');
    if (!receiver?.name || !receiver?.phone) throw fail('Recipient name and contact number are required.');

    const distanceKm = 5.2;
    const weight = Math.max(0.5, parseFloat(weightKg || 1));
    const fare = Math.round(50 + distanceKm * 15 + (weight > 1 ? (weight - 1) * 12 : 0));

    const parcelId = randomUUID();
    const pickupOtp = String(randomInt(1000, 9999)); // Given by sender to driver
    const deliveryOtp = String(randomInt(1000, 9999)); // Given by recipient to driver
    const customerPhone = req.account.profile?.phone || req.account.email || '';

    const items = [{
      name: `Parcel (${category || 'Package'})`,
      weight: `${weight} kg`,
      instructions: instructions || 'Handle with care',
    }];

    const meta = {
      sender: sender || { name: req.account.name, phone: customerPhone },
      receiver,
      category: category || 'General',
      weightKg: weight,
      pickupOtp,
      deliveryOtp,
    };

    const { rows: inserted } = await pool.query(`
      INSERT INTO allgo_orders (
        id, customer_id, customer_name, customer_phone, service_type,
        restaurant_name, items, pickup_address, delivery_address,
        total, subtotal, tax, delivery_fee, payment_method, payment_status,
        order_status, delivery_status, pickup_code, pickup_otp, delivery_otp, meta
      ) VALUES ($1, $2, $3, $4, 'parcel', 'AllGo Parcel Express', $5::jsonb, $6::jsonb, $7::jsonb, $8, $8, 0, 0, $9, 'pending', 'placed', 'pending_dispatch', $10, $10, $11, $12::jsonb)
      RETURNING *
    `, [
      parcelId, req.account.id, req.account.name, customerPhone,
      JSON.stringify(items), JSON.stringify(pickup), JSON.stringify(drop),
      fare, paymentMethod || 'cod',
      pickupOtp, deliveryOtp, JSON.stringify(meta)
    ]);

    await logAudit(req.account.id, 'customer', 'parcel_booked', parcelId, { fare, weight });
    res.status(201).json(inserted[0]);
  }));

  // Goods & Vehicle Transport Quote (Vehicle, Helpers & Floor/Stairs Surcharge)
  app.post('/api/transport/quote', route(async (req, res) => {
    const { pickup, drop, vehicleClass, helpersCount, floorCount, hasElevator } = req.body;
    if (!pickup || !drop) throw fail('Pickup and drop destinations required for transport quote.');

    const distanceKm = 8.5;
    const helpers = Math.max(0, parseInt(helpersCount || 0, 10));
    const floors = Math.max(0, parseInt(floorCount || 0, 10));
    const hasLift = Boolean(hasElevator);
    const stairSurcharge = (!hasLift && floors > 0) ? floors * helpers * 50 : 0;
    const helperFee = helpers * 200 + stairSurcharge;

    const vehicles = [
      {
        id: '3_wheeler',
        name: '3-Wheeler Mini Truck',
        capacity: '500 kg',
        dimensions: '5ft x 4ft',
        base: 280,
        perKm: 30,
        price: Math.round(280 + distanceKm * 30 + helperFee),
      },
      {
        id: 'tata_ace',
        name: 'Tata Ace (Chhota Hathi)',
        capacity: '1,000 kg',
        dimensions: '7ft x 4.5ft',
        base: 480,
        perKm: 42,
        price: Math.round(480 + distanceKm * 42 + helperFee),
      },
      {
        id: '8ft_pickup',
        name: '8ft Pickup Truck',
        capacity: '1,500 kg',
        dimensions: '8ft x 5ft',
        base: 720,
        perKm: 55,
        price: Math.round(720 + distanceKm * 55 + helperFee),
      },
    ];

    res.json({
      distanceKm,
      helpersCount: helpers,
      floorCount: floors,
      hasElevator: hasLift,
      stairSurcharge,
      helperFee,
      vehicles,
    });
  }));

  // Book Goods Transport
  app.post('/api/transport/book', route(async (req, res) => {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'customer') throw fail('Only customers can book goods transport.', 403, 'permission-denied');

    const { pickup, drop, vehicleClass, helpersCount, floorCount, hasElevator, cargoType, preferredTime, paymentMethod } = req.body;
    if (!pickup?.address || !drop?.address) throw fail('Pickup and drop destinations are required.');

    const distanceKm = 8.5;
    const helpers = Math.max(0, parseInt(helpersCount || 0, 10));
    const floors = Math.max(0, parseInt(floorCount || 0, 10));
    const hasLift = Boolean(hasElevator);
    const stairSurcharge = (!hasLift && floors > 0) ? floors * helpers * 50 : 0;
    const helperFee = helpers * 200 + stairSurcharge;
    const rates = {
      '3_wheeler': { base: 280, perKm: 30, name: '3-Wheeler Mini' },
      'tata_ace': { base: 480, perKm: 42, name: 'Tata Ace' },
      '8ft_pickup': { base: 720, perKm: 55, name: '8ft Pickup' },
    };
    const rate = rates[vehicleClass] || rates.tata_ace;
    const fare = Math.round(rate.base + distanceKm * rate.perKm + helperFee);

    const transportId = randomUUID();
    const pickupCode = String(randomInt(1000, 9999));
    const deliveryOtp = String(randomInt(1000, 9999));
    const customerPhone = req.account.profile?.phone || req.account.email || '';

    const items = [{
      name: `Goods Movement (${cargoType || 'Household Goods'})`,
      vehicleClass: rate.name,
      helpers: `${helpers} Helper(s)`,
      floorDetails: floors > 0 ? `${floors} Floor(s) (${hasLift ? 'Elevator available' : 'Stairs'})` : 'Ground Floor',
    }];

    const meta = {
      vehicleClass,
      helpersCount: helpers,
      floorCount: floors,
      hasElevator: hasLift,
      stairSurcharge,
      cargoType: cargoType || 'Furniture/Boxes',
      preferredTime: preferredTime || 'Immediate',
    };

    const { rows: inserted } = await pool.query(`
      INSERT INTO allgo_orders (
        id, customer_id, customer_name, customer_phone, service_type,
        restaurant_name, items, pickup_address, delivery_address,
        total, subtotal, tax, delivery_fee, payment_method, payment_status,
        order_status, delivery_status, pickup_code, delivery_otp, meta
      ) VALUES ($1, $2, $3, $4, 'transport', 'AllGo Heavy Transport', $5::jsonb, $6::jsonb, $7::jsonb, $8, $8, 0, 0, $9, 'pending', 'placed', 'pending_dispatch', $10, $11, $12::jsonb)
      RETURNING *
    `, [
      transportId, req.account.id, req.account.name, customerPhone,
      JSON.stringify(items), JSON.stringify(pickup), JSON.stringify(drop),
      fare, paymentMethod || 'cod',
      pickupCode, deliveryOtp, JSON.stringify(meta)
    ]);

    await logAudit(req.account.id, 'customer', 'transport_booked', transportId, { fare, vehicleClass, helpers, floors, stairSurcharge });
    res.status(201).json(inserted[0]);
  }));

  // -------------------------------------------------------------
  // BOOK A DRIVER FOR CUSTOMER'S OWN CAR (TAKEOVER / CHAUFFEUR)
  // -------------------------------------------------------------

  // Chauffeur / Driver Hire Quote
  app.post('/api/takeover/quote', route(async (req, res) => {
    const { pickup, drop, packageType, transmission, vehicleModel } = req.body;
    if (!pickup?.address) throw fail('Pickup location is required for driver booking.');

    const distanceKm = drop?.address ? 6.5 : 0;
    const packages = [
      {
        id: 'hourly_2hr',
        name: '2 Hours Local Package',
        description: 'Ideal for local meetings or quick round-trips',
        basePrice: 299,
        includedHours: 2,
        extraHourRate: 110,
        waitingRatePerMin: 2,
      },
      {
        id: 'hourly_4hr',
        name: '4 Hours City Package',
        description: 'For errands, dinner parties or hospital visits',
        basePrice: 499,
        includedHours: 4,
        extraHourRate: 100,
        waitingRatePerMin: 2,
      },
      {
        id: 'hourly_8hr',
        name: '8 Hours Full Day Package',
        description: 'Full day city commute or client driving',
        basePrice: 899,
        includedHours: 8,
        extraHourRate: 90,
        waitingRatePerMin: 2,
      },
      {
        id: 'point_to_point',
        name: 'Point-to-Point Trip',
        description: 'One-way transit from pickup to destination',
        basePrice: Math.round(220 + distanceKm * 15),
        includedHours: 1.5,
        extraHourRate: 110,
        waitingRatePerMin: 2,
      },
    ];

    res.json({
      distanceKm,
      transmission: transmission || 'automatic',
      vehicleModel: vehicleModel || 'Sedan / Hatchback',
      packages,
    });
  }));

  // Book a Driver for Customer's Car
  app.post('/api/takeover/book', route(async (req, res) => {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'customer') throw fail('Only customers can book personal drivers.', 403, 'permission-denied');

    const { pickup, drop, packageType, vehicleModel, vehicleNo, transmission, tripNotes, paymentMethod } = req.body;
    if (!pickup?.address) throw fail('Pickup location is required.');
    if (!vehicleModel || !vehicleNo) throw fail('Vehicle make, model, and registration plate are required.');

    const rates = {
      hourly_2hr: 299,
      hourly_4hr: 499,
      hourly_8hr: 899,
      point_to_point: 320,
    };
    const fare = rates[packageType] || 299;

    const takeoverId = randomUUID();
    const tripStartOtp = String(randomInt(1000, 9999));
    const tripEndOtp = String(randomInt(1000, 9999));
    const customerPhone = req.account.profile?.phone || req.account.email || '';

    // Verified chauffeur match with transmission qualification
    const driverDetails = {
      name: 'Kishore M.',
      phone: '+91 98455 66778',
      driverRole: 'Certified Professional Chauffeur',
      licenseNo: 'KA01-2019-0045231',
      experience: '7 years verified private/corporate driving',
    };

    const meta = {
      serviceCategory: 'driver_takeover',
      packageType: packageType || 'hourly_2hr',
      vehicleModel,
      vehicleNo,
      transmission: transmission || 'automatic',
      tripNotes: tripNotes || 'Drive safely in customer vehicle',
      licenseVerified: true,
      tripEndOtp,
    };

    const items = [{
      name: `Book a Driver (${vehicleModel})`,
      transmission: `${transmission || 'Automatic'} Transmission`,
      vehicleNo,
      driverName: driverDetails.name,
    }];

    const { rows: inserted } = await pool.query(`
      INSERT INTO allgo_orders (
        id, customer_id, customer_name, customer_phone, service_type,
        restaurant_name, items, pickup_address, delivery_address,
        total, subtotal, tax, delivery_fee, payment_method, payment_status,
        order_status, delivery_status,
        driver_name, driver_phone, driver_vehicle,
        pickup_code, delivery_otp, meta
      ) VALUES ($1, $2, $3, $4, 'takeover', 'AllGo Chauffeur Services', $5::jsonb, $6::jsonb, $7::jsonb, $8, $8, 0, 0, $9, 'pending', 'accepted', 'driver_assigned', $10, $11, $12, $13, $14, $15::jsonb)
      RETURNING *
    `, [
      takeoverId, req.account.id, req.account.name, customerPhone,
      JSON.stringify(items), JSON.stringify(pickup), JSON.stringify(drop || pickup),
      fare, paymentMethod || 'cash',
      driverDetails.name, driverDetails.phone, `Chauffeur for ${vehicleModel} (${vehicleNo})`,
      tripStartOtp, tripStartOtp, JSON.stringify(meta)
    ]);

    await logAudit(req.account.id, 'customer', 'driver_takeover_booked', takeoverId, { fare, vehicleModel, packageType });
    res.status(201).json(inserted[0]);
  }));

  // -------------------------------------------------------------
  // PICKUP-AND-DROP / COLLECT-FOR-ME ENDPOINTS
  // -------------------------------------------------------------

  // Collect-For-Me Quote
  app.post('/api/collect/quote', route(async (req, res) => {
    const { pickup, drop, collectionType } = req.body;
    if (!pickup?.address || !drop?.address) throw fail('Pickup and drop destinations are required.');

    const distanceKm = 4.8;
    const baseFare = 40;
    const perKm = 14;
    const quote = Math.round(baseFare + distanceKm * perKm);

    res.json({
      distanceKm,
      quote,
      etaMinutes: 20,
    });
  }));

  // Book Collect-For-Me
  app.post('/api/collect/book', route(async (req, res) => {
    const role = req.account.profile?.role || 'customer';
    if (role !== 'customer') throw fail('Only customers can book collect-for-me errands.', 403, 'permission-denied');

    const { collectionType, itemName, storeName, pickup, drop, instructions, senderPhone, receiverPhone, paymentMethod } = req.body;
    if (!pickup?.address || !drop?.address) throw fail('Pickup and drop destinations are required.');
    if (!itemName) throw fail('Item description is required.');

    const distanceKm = 4.8;
    const fare = Math.round(40 + distanceKm * 14);

    const collectId = randomUUID();
    const pickupCode = String(randomInt(1000, 9999));
    const deliveryOtp = String(randomInt(1000, 9999));
    const customerPhone = req.account.profile?.phone || req.account.email || '';

    const items = [{
      name: `Collect & Deliver: ${itemName}`,
      collectionType: collectionType || 'forgotten_item',
      storeName: storeName || 'N/A',
      instructions: instructions || 'Handle safely and verify item',
    }];

    const meta = {
      collectionType: collectionType || 'forgotten_item',
      itemName,
      storeName,
      senderPhone: senderPhone || customerPhone,
      receiverPhone: receiverPhone || customerPhone,
      instructions,
    };

    const { rows: inserted } = await pool.query(`
      INSERT INTO allgo_orders (
        id, customer_id, customer_name, customer_phone, service_type,
        restaurant_name, items, pickup_address, delivery_address,
        total, subtotal, tax, delivery_fee, payment_method, payment_status,
        order_status, delivery_status, pickup_code, delivery_otp, meta
      ) VALUES ($1, $2, $3, $4, 'parcel', 'AllGo Collect-for-Me', $5::jsonb, $6::jsonb, $7::jsonb, $8, $8, 0, 0, $9, 'pending', 'placed', 'pending_dispatch', $10, $11, $12::jsonb)
      RETURNING *
    `, [
      collectId, req.account.id, req.account.name, customerPhone,
      JSON.stringify(items), JSON.stringify(pickup), JSON.stringify(drop),
      fare, paymentMethod || 'cod',
      pickupCode, deliveryOtp, JSON.stringify(meta)
    ]);

    await logAudit(req.account.id, 'customer', 'collect_for_me_booked', collectId, { fare, collectionType, itemName });
    res.status(201).json(inserted[0]);
  }));

  // -------------------------------------------------------------
  // ADMIN DASHBOARD & AUDIT ENDPOINTS
  // -------------------------------------------------------------

  // Admin List All Orders
  app.get('/api/admin/orders', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const { rows } = await pool.query('SELECT * FROM allgo_orders ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  }));

  // Admin Manual Order Override (e.g. cancellation or issue resolution)
  app.post('/api/admin/orders/:id/override', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const orderId = req.params.id;
    const { action, reason } = req.body;
    if (!action || !reason) throw fail('Action and reason are mandatory for administrative override.');

    if (action === 'cancel') {
      await pool.query("UPDATE allgo_orders SET order_status = 'cancelled', delivery_status = 'cancelled', cancellation_reason = $2, updated_at = now() WHERE id = $1", [orderId, `Admin Override: ${reason}`]);
    } else {
      throw fail(`Unsupported override action: ${action}`);
    }

    await logAudit(req.account.id, 'admin', `order_override_${action}`, orderId, { reason });
    res.json({ ok: true, orderId, action, reason });
  }));

  // Admin Finance Overview
  app.get('/api/admin/finance', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const { rows: gmvRows } = await pool.query("SELECT COALESCE(SUM(total), 0) as gmv, COUNT(*) as total_orders FROM allgo_orders WHERE order_status = 'delivered'");
    const { rows: commissionRows } = await pool.query("SELECT COALESCE(SUM(commission_fee), 0) as commission FROM allgo_settlements WHERE entity_type = 'merchant'");
    const { rows: driverPayouts } = await pool.query("SELECT COALESCE(SUM(net_amount), 0) as payouts FROM allgo_settlements WHERE entity_type = 'driver'");

    res.json({
      gmv: Number(gmvRows[0]?.gmv || 0),
      deliveredOrders: parseInt(gmvRows[0]?.total_orders || '0', 10),
      totalCommission: Number(commissionRows[0]?.commission || 0),
      driverPayouts: Number(driverPayouts[0]?.payouts || 0),
    });
  }));

  // Admin Audit Logs
  app.get('/api/admin/audit-logs', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const { rows } = await pool.query('SELECT * FROM allgo_audit_logs ORDER BY created_at DESC LIMIT 100');
    res.json(rows);
  }));

  // Admin Surge Zones List
  app.get('/api/admin/surge-zones', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const { rows } = await pool.query('SELECT * FROM allgo_surge_zones ORDER BY name ASC');
    res.json(rows);
  }));

  // Admin Update Surge Zone Multipliers & Weather/Traffic Modes
  app.post('/api/admin/surge-zones', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const { zoneId, multiplier, rainMode, trafficMode } = req.body;
    if (!zoneId) throw fail('Zone ID is required.');

    const mult = Math.max(1.0, Math.min(3.0, parseFloat(multiplier || 1.0)));
    await pool.query(`
      UPDATE allgo_surge_zones
      SET multiplier = $2,
          rain_mode = COALESCE($3, rain_mode),
          traffic_mode = COALESCE($4, traffic_mode),
          updated_at = now()
      WHERE zone_id = $1
    `, [zoneId, mult, rainMode !== undefined ? Boolean(rainMode) : null, trafficMode !== undefined ? Boolean(trafficMode) : null]);

    await logAudit(req.account.id, 'admin', 'surge_zone_updated', zoneId, { multiplier: mult, rainMode, trafficMode });
    res.json({ ok: true, zoneId, multiplier: mult, rainMode, trafficMode });
  }));

  // Admin Live Dispatch Radar (Fleet tracking & active orders map)
  app.get('/api/admin/live-radar', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const { rows: drivers } = await pool.query(`
      SELECT l.driver_id, a.name, a.email, a.profile->>'vehicleType' as vehicle_type,
             l.online, l.lat, l.lng, COALESCE(l.cod_cash_in_hand, 0) as cod_cash_in_hand, l.updated_at
      FROM allgo_driver_locations l
      JOIN allgo_accounts a ON a.id = l.driver_id
      WHERE l.online = true
    `);
    const { rows: activeOrders } = await pool.query(`
      SELECT id, order_number, service_type, customer_name, restaurant_name,
             delivery_address, total, payment_method, order_status, delivery_status,
             driver_id, driver_name, created_at, updated_at
      FROM allgo_orders
      WHERE order_status NOT IN ('delivered', 'cancelled', 'rejected')
      ORDER BY created_at DESC
    `);
    res.json({
      activeDrivers: drivers,
      activeOrders,
      timestamp: new Date().toISOString(),
    });
  }));

  // Admin Statutory GST & Tax Invoicing Report
  app.get('/api/admin/tax-report', route(async (req, res) => {
    if (req.account.profile?.role !== 'admin') throw fail('Admin access required.', 403, 'permission-denied');
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(subtotal), 0) as total_food_sales,
        COALESCE(SUM(tax), 0) as total_food_gst,
        COALESCE(SUM(delivery_fee), 0) as total_delivery_fees,
        COALESCE(SUM(surge_fee), 0) as total_surge_fees,
        COALESCE(SUM(total), 0) as total_gmv
      FROM allgo_orders
      WHERE order_status = 'delivered'
    `);
    const foodSales = Number(totals[0]?.total_food_sales || 0);
    const foodGst = Number(totals[0]?.total_food_gst || 0);
    const cgst = Math.round((foodGst / 2) * 100) / 100;
    const sgst = Math.round((foodGst / 2) * 100) / 100;
    const platformFee = Number(totals[0]?.total_delivery_fees || 0);
    const platformGst = Math.round(platformFee * 0.18 * 100) / 100; // 18% GST on platform convenience
    const tcs = Math.round(foodSales * 0.01 * 100) / 100; // 1% TCS
    const tds = Math.round(foodSales * 0.01 * 100) / 100; // 1% TDS

    res.json({
      summary: totals[0],
      statutoryTax: {
        cgst_2_5: cgst,
        sgst_2_5: sgst,
        total_food_gst: foodGst,
        platform_service_gst_18: platformGst,
        tcs_collected_1: tcs,
        tds_deducted_1: tds,
      },
      currency: 'INR',
    });
  }));
}
