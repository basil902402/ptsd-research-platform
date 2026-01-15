// سكريبت تغيير كلمة مرور المسؤول
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║                                                           ║');
console.log('║          تغيير كلمة مرور المسؤول                         ║');
console.log('║          Change Admin Password                            ║');
console.log('║                                                           ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// فتح قاعدة البيانات
const db = new Database('./database.db');

// سؤال 1: اسم المستخدم
rl.question('أدخل اسم المستخدم الذي تريد تغيير كلمة مروره (username): ', (username) => {

    // التحقق من وجود المستخدم
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);

    if (!user) {
        console.log('\n❌ خطأ: المستخدم غير موجود!');
        console.log(`المستخدم "${username}" غير موجود في قاعدة البيانات.\n`);
        db.close();
        rl.close();
        return;
    }

    console.log(`\n✅ تم العثور على المستخدم: ${username}`);

    // سؤال 2: كلمة المرور الجديدة
    rl.question('\nأدخل كلمة المرور الجديدة (password): ', (password) => {

        if (!password || password.length < 6) {
            console.log('\n❌ خطأ: كلمة المرور يجب أن تكون 6 أحرف على الأقل!\n');
            db.close();
            rl.close();
            return;
        }

        // تشفير كلمة المرور
        console.log('\n⏳ جاري تشفير كلمة المرور...');
        const hash = bcrypt.hashSync(password, 10);

        // تحديث كلمة المرور في قاعدة البيانات
        const stmt = db.prepare('UPDATE admin_users SET password_hash = ? WHERE username = ?');
        const result = stmt.run(hash, username);

        if (result.changes > 0) {
            console.log('\n✅ تم تغيير كلمة المرور بنجاح!');
            console.log(`\nيمكنك الآن تسجيل الدخول باستخدام:`);
            console.log(`   اسم المستخدم: ${username}`);
            console.log(`   كلمة المرور: (الكلمة الجديدة التي أدخلتها)\n`);
        } else {
            console.log('\n❌ خطأ: فشل تحديث كلمة المرور!\n');
        }

        db.close();
        rl.close();
    });
});
