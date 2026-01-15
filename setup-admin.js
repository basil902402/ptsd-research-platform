// سكريبت بسيط لإنشاء مستخدم إداري بدون تفاعل
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { adminQueries, initDatabase } = require('./database');

async function createDefaultAdmin() {
    try {
        // التأكد من وجود الجداول
        initDatabase();

        const username = 'admin';
        const password = 'Admin@123456';

        // تجزئة كلمة المرور
        const passwordHash = await bcrypt.hash(password, 10);

        // إنشاء المستخدم
        try {
            adminQueries.create.run(username, passwordHash);
            console.log(`\n✅ تم إنشاء المستخدم الإداري بنجاح`);
            console.log(`📧 اسم المستخدم: ${username}`);
            console.log(`🔑 كلمة المرور: ${password}`);
            console.log(`\n⚠️  احفظ هذه المعلومات في مكان آمن!\n`);
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                console.log('\n✅ المستخدم الإداري موجود بالفعل');
                console.log(`📧 اسم المستخدم: ${username}`);
                console.log(`🔑 كلمة المرور: ${password}\n`);
            } else {
                console.log('❌ خطأ:', error.message);
            }
        }

    } catch (error) {
        console.error('❌ خطأ:', error.message);
    }
}

createDefaultAdmin();
