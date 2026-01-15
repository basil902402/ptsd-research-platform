// سكريبت تهيئة قاعدة البيانات - Database Initialization Script
require('dotenv').config();
const { initDatabase } = require('./database');

console.log('🔄 جاري إنشاء قاعدة البيانات...');
initDatabase();
console.log('✅ تمت التهيئة بنجاح!');
