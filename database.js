// وحدة قاعدة البيانات - Database Module
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || './database.db';
const db = new Database(dbPath);

// تفعيل الحذف المتتالي
db.pragma('foreign_keys = ON');

// إنشاء الجداول
function initDatabase() {
  // جدول المشاركين والردود
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id TEXT UNIQUE NOT NULL,
      gender TEXT NOT NULL,
      age TEXT NOT NULL,
      education_level TEXT NOT NULL,
      marital_status TEXT,
      ms_duration TEXT NOT NULL,
      responses TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      dimension1_score INTEGER NOT NULL,
      dimension2_score INTEGER NOT NULL,
      dimension3_score INTEGER NOT NULL,
      dim1_symptoms INTEGER DEFAULT 0,
      dim2_symptoms INTEGER DEFAULT 0,
      dim3_symptoms INTEGER DEFAULT 0,
      dim1_status TEXT DEFAULT '',
      dim2_status TEXT DEFAULT '',
      dim3_status TEXT DEFAULT '',
      completed BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // إضافة الأعمدة الجديدة إذا لم تكن موجودة
  const columnsToAdd = [
    'dim1_symptoms INTEGER DEFAULT 0',
    'dim2_symptoms INTEGER DEFAULT 0',
    'dim3_symptoms INTEGER DEFAULT 0',
    'dim1_status TEXT DEFAULT ""',
    'dim2_status TEXT DEFAULT ""',
    'dim3_status TEXT DEFAULT ""',
    'marital_status TEXT'
  ];

  columnsToAdd.forEach(col => {
    try {
      const colName = col.split(' ')[0];
      db.exec(`ALTER TABLE participants ADD COLUMN ${col}`);
    } catch (err) {
      // Column likely exists
    }
  });


  // جدول مستخدمي الإدارة
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // جدول الإشعارات
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      participant_id TEXT,
      read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // جدول الإعدادات
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ تم إنشاء جداول قاعدة البيانات بنجاح');
}

// تهيئة قاعدة البيانات عند التحميل
initDatabase();

// دوال المشاركين
const participantQueries = {
  // إضافة مشارك جديد
  create: db.prepare(`
    INSERT INTO participants (
      participant_id, gender, age, education_level, marital_status, ms_duration,
      responses, total_score, dimension1_score, dimension2_score, dimension3_score,
      dim1_symptoms, dim2_symptoms, dim3_symptoms,
      dim1_status, dim2_status, dim3_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // الحصول على جميع المشاركين
  getAll: db.prepare('SELECT * FROM participants ORDER BY created_at DESC'),

  // الحصول على مشارك بالمعرف
  getById: db.prepare('SELECT * FROM participants WHERE participant_id = ?'),

  // عدد المشاركين الذين أكملوا
  countCompleted: db.prepare('SELECT COUNT(*) as count FROM participants WHERE completed = 1'),

  // الحصول على آخر مشارك
  getLatest: db.prepare('SELECT * FROM participants ORDER BY created_at DESC LIMIT 1'),

  // إحصائيات حسب المستوى التعليمي
  statsByEducation: db.prepare(`
    SELECT education_level, COUNT(*) as count, AVG(total_score) as avg_score
    FROM participants
    GROUP BY education_level
  `),

  // إحصائيات حسب مدة الإصابة
  statsByDuration: db.prepare(`
    SELECT ms_duration, COUNT(*) as count, AVG(total_score) as avg_score
    FROM participants
    GROUP BY ms_duration
  `),

  // إحصائيات حسب الجنس
  statsByGender: db.prepare(`
    SELECT gender, COUNT(*) as count, AVG(total_score) as avg_score
    FROM participants
    GROUP BY gender
  `),

  // إحصائيات حسب الحالة الاجتماعية
  statsByMaritalStatus: db.prepare(`
    SELECT marital_status, COUNT(*) as count, AVG(total_score) as avg_score
    FROM participants
    WHERE marital_status IS NOT NULL
    GROUP BY marital_status
  `)
};

// دوال الإدارة
const adminQueries = {
  // إنشاء مستخدم إداري
  create: db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)'),

  // البحث عن مستخدم بالاسم
  findByUsername: db.prepare('SELECT * FROM admin_users WHERE username = ?'),

  // الحصول على جميع المستخدمين
  getAll: db.prepare('SELECT id, username, created_at FROM admin_users')
};

// دوال الإشعارات
const notificationQueries = {
  // إضافة إشعار
  create: db.prepare('INSERT INTO notifications (message, participant_id) VALUES (?, ?)'),

  // الحصول على جميع الإشعارات
  getAll: db.prepare('SELECT * FROM notifications ORDER BY created_at DESC'),

  // الحصول على الإشعارات غير المقروءة
  getUnread: db.prepare('SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC'),

  // عدد الإشعارات غير المقروءة
  countUnread: db.prepare('SELECT COUNT(*) as count FROM notifications WHERE read = 0'),

  // تحديد إشعار كمقروء
  markAsRead: db.prepare('UPDATE notifications SET read = 1 WHERE id = ?'),

  // تحديد جميع الإشعارات كمقروءة
  markAllAsRead: db.prepare('UPDATE notifications SET read = 1')
};

// دوال الإعدادات
const settingQueries = {
  // الحصول على إعداد
  get: db.prepare('SELECT value FROM settings WHERE key = ?'),

  // تحديث أو إدراج إعداد
  set: db.prepare(`
    INSERT INTO settings (key, value, updated_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `)
};

module.exports = {
  db,
  initDatabase,
  participantQueries,
  adminQueries,
  notificationQueries,
  settingQueries
};
