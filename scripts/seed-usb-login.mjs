import pg from 'pg';
import { config } from 'dotenv';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
config({path:fileURLToPath(new URL('../../delivery123/.env.local',import.meta.url)),quiet:true});
if (process.env.NODE_ENV === 'production' || process.env.ALLGO_ENVIRONMENT || process.env.ACCOUNT_FIREBASE_BRIDGE_ENABLED === 'true') throw new Error('Seed only the isolated local USB backend.');
const email=process.env.TEST_LOGIN_EMAIL?.trim().toLowerCase(), password=process.env.TEST_LOGIN_PASSWORD;
if(!email || !password || password.length<8) throw new Error('Provide test email and password through environment variables.');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('CREATE SCHEMA IF NOT EXISTS allgo_usb_merchant');
  await client.query('SET LOCAL search_path TO allgo_usb_merchant');
  await client.query("CREATE TABLE IF NOT EXISTS allgo_accounts(id uuid PRIMARY KEY,email text UNIQUE NOT NULL,name text NOT NULL,password_hash text NOT NULL,profile jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now())");
  const salt=randomBytes(16).toString('hex'), hash=`${salt}:${scryptSync(password,salt,64).toString('hex')}`;
  await client.query('INSERT INTO allgo_accounts(id,email,name,password_hash,profile) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,profile=EXCLUDED.profile',[randomUUID(),email,'Test Merchant',hash,JSON.stringify({role:'merchant',localTestAccount:true,merchantId:'usb-test-merchant',merchantType:'restaurant'})]);
  await client.query('COMMIT');
  console.log('Merchant USB test login configured. Live customer account unchanged.');
} catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();await pool.end();}
