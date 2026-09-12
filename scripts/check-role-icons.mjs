#!/usr/bin/env node
/**
 * Script to check if roles table has icon column and if icons are populated
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../backend/local.db');

console.log('🔍 Checking roles table for icon column...\n');

try {
  const db = new Database(DB_PATH, { readonly: true });
  
  // Check if icon column exists
  const tableInfo = db.prepare("PRAGMA table_info(roles)").all();
  console.log('📋 Roles table columns:');
  tableInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  const hasIconColumn = tableInfo.some(col => col.name === 'icon');
  
  if (!hasIconColumn) {
    console.log('\n❌ ERROR: Icon column does NOT exist in roles table!');
    console.log('Run the migration: 0008_add_role_icons.sql\n');
    db.close();
    process.exit(1);
  }
  
  console.log('\n✅ Icon column exists!\n');
  
  // Check if icons are populated
  const roles = db.prepare(`
    SELECT id, name, icon, category_id
    FROM roles
    LIMIT 10
  `).all();
  
  console.log('🎨 Sample roles with icons:');
  roles.forEach(role => {
    console.log(`  ${role.icon} ${role.name} (${role.id})`);
  });
  
  // Check if any role has default icon
  const defaultIconCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM roles
    WHERE icon = '👤'
  `).get();
  
  console.log(`\n📊 Roles with default icon (👤): ${defaultIconCount.count}`);
  
  const totalRoles = db.prepare('SELECT COUNT(*) as count FROM roles').get();
  console.log(`📊 Total roles: ${totalRoles.count}`);
  
  if (defaultIconCount.count === totalRoles.count) {
    console.log('\n⚠️  WARNING: All roles still have the default icon!');
    console.log('Icons need to be populated. Check if the UPDATE statements in 0008_add_role_icons.sql ran.\n');
  } else if (defaultIconCount.count > 0) {
    console.log(`\n⚠️  WARNING: ${defaultIconCount.count} roles still have the default icon.\n`);
  } else {
    console.log('\n✅ All roles have custom icons!\n');
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
