import pg from 'pg';
import { randomBytes, scryptSync, randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)) });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set.');
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const hashPassword = password => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

export const SAMPLE_ACCOUNTS = [
  {
    email: 'customer@allgo.in',
    name: 'Alex Sharma',
    password: 'AllGo@123',
    app: 'customer',
    apiPort: 3004,
    profile: {
      role: 'customer',
      phone: '+919876543210',
      phoneVerified: true,
      approvalStatus: 'active',
      walletBalance: 500,
      defaultAddress: 'No. 42, 5th Cross, 100ft Road, Indiranagar, Bengaluru - 560038',
      defaultAddressId: 'addr_customer_indiranagar_1',
      preferences: {
        language: 'en',
        promotions: true,
        orderUpdates: true
      }
    }
  },
  {
    email: 'merchant@allgo.in',
    name: 'Chef Rajesh',
    password: 'AllGo@123',
    app: 'merchant',
    apiPort: 3005,
    profile: {
      role: 'merchant',
      phone: '+919876543211',
      phoneVerified: true,
      approvalStatus: 'approved',
      status: 'approved',
      restaurantName: 'Spice Symphony',
      merchantId: 'res_spice_symphony',
      merchantType: 'restaurant',
      merchantName: 'Spice Symphony',
      merchantStatus: 'approved'
    }
  },
  {
    email: 'driver@allgo.in',
    name: 'Vikram Rao',
    password: 'AllGo@123',
    app: 'driver',
    apiPort: 3006,
    profile: {
      role: 'driver',
      phone: '+919876543212',
      phoneVerified: true,
      approvalStatus: 'approved',
      driver_status: 'approved',
      status: 'approved',
      vehicle_no: 'KA-05-EV-8821',
      license_no: 'DL-KA-2024-88210',
      vehicleType: 'bike',
      online: true
    }
  }
];

export async function seedAccounts() {
  const results = [];
  for (const acc of SAMPLE_ACCOUNTS) {
    const existing = await pool.query('SELECT id FROM allgo_accounts WHERE email = $1', [acc.email]);
    const hash = hashPassword(acc.password);
    let id;
    if (existing.rows.length > 0) {
      id = existing.rows[0].id;
      await pool.query(
        'UPDATE allgo_accounts SET name = $1, password_hash = $2, profile = $3::jsonb WHERE id = $4',
        [acc.name, hash, JSON.stringify(acc.profile), id]
      );
      results.push({ email: acc.email, status: 'updated', role: acc.profile.role, id });
    } else {
      id = randomUUID();
      await pool.query(
        'INSERT INTO allgo_accounts (id, email, name, password_hash, profile) VALUES ($1, $2, $3, $4, $5::jsonb)',
        [id, acc.email, acc.name, hash, JSON.stringify(acc.profile)]
      );
      results.push({ email: acc.email, status: 'created', role: acc.profile.role, id });
    }
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedAccounts()
    .then(res => {
      console.log('Seeded sample accounts successfully:');
      console.log(JSON.stringify(res, null, 2));
      return pool.end();
    })
    .catch(err => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}
