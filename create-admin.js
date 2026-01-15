// سكريبت إنشاء مستخدم إداري - Create Admin User Script
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { adminQueries, initDatabase } = require('./database');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function createAdmin() {
    try {
        // التأكد من وجود الجداول
        initDatabase();

        console.log('\n=== إنشاء مستخدم إداري جديد ===\n');

        const username = await question('اسم المستخدم (username): ');
        if (!username || username.length < 3) {
            console.log('❌ اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
            rl.close();
            return;
        }

        const password = await question('كلمة المرور (password): ');
        if (!password || password.length < 6) {
            console.log('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            rl.close();
            return;
        }

        // تجزئة كلمة المرور
        const passwordHash = await bcrypt.hash(password, 10);

        // إنشاء المستخدم
        try {
            adminQueries.create.run(username, passwordHash);
            console.log(`\n✅ تم إنشاء المستخدم الإداري بنجاح: ${username}`);
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                console.log('❌ اسم المستخدم موجود بالفعل');
            } else {
                console.log('❌ خطأ:', error.message);
            }
        }

        rl.close();
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        rl.close();
    }
}

createAdmin();
