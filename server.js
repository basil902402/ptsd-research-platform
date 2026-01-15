// الخادم الرئيسي - Main Server
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const xl = require('excel4node'); // مكتبة Excel Native
const {
    db,
    initDatabase,
    participantQueries,
    adminQueries,
    notificationQueries,
    settingQueries
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// تهيئة قاعدة البيانات
initDatabase();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// إعداد الجلسات
app.use(session({
    secret: process.env.SESSION_SECRET || 'ptsd-research-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
        sameSite: 'lax'
    },
    proxy: process.env.NODE_ENV === 'production' // Trust proxy in production
}));

// دالة مساعدة للتحقق من تسجيل الدخول
function requireAuth(req, res, next) {
    if (req.session.adminId) {
        next();
    } else {
        res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
    }
}

// دالة حساب الدرجات
function calculateScores(responses) {
    // تحويل الردود من نص JSON إلى مصفوفة
    const answersArray = typeof responses === 'string' ? JSON.parse(responses) : responses;

    // تعريف الفقرات لكل بعد (0-indexed)
    const dim1Indices = [0, 1, 2, 3, 16]; // الاستعادة (5 فقرات)
    const dim2Indices = [4, 5, 6, 7, 8, 9, 10]; // التجنب (7 فقرات)
    const dim3Indices = [11, 12, 13, 14, 15]; // فرط الاستثارة (5 فقرات)

    // دالة مساعدة لحساب الدرجات وعدد الأعراض
    const calculateDim = (indices) => {
        const score = indices.reduce((sum, i) => sum + (answersArray[i] || 0), 0);
        // العرض يتحقق إذا كانت درجته >= 1
        const symptoms = indices.reduce((count, i) => count + ((answersArray[i] || 0) >= 1 ? 1 : 0), 0);
        return { score, symptoms };
    };

    const d1 = calculateDim(dim1Indices);
    const d2 = calculateDim(dim2Indices);
    const d3 = calculateDim(dim3Indices);

    // تحديد حالة التحقق (بناءً على معايير DSM)
    // البعد الأول: عرض واحد على الأقل
    const d1Status = d1.symptoms >= 1 ? 'متحقق' : 'غير متحقق';

    // البعد الثاني: 3 أعراض على الأقل
    const d2Status = d2.symptoms >= 3 ? 'متحقق' : 'غير متحقق';

    // البعد الثالث: عرضين على الأقل
    const d3Status = d3.symptoms >= 2 ? 'متحقق' : 'غير متحقق';

    // الدرجة الكلية
    const totalScore = answersArray.reduce((sum, val) => sum + val, 0);

    return {
        dimension1: d1.score,
        dimension2: d2.score,
        dimension3: d3.score,
        dim1Symptoms: d1.symptoms,
        dim2Symptoms: d2.symptoms,
        dim3Symptoms: d3.symptoms,
        dim1Status: d1Status,
        dim2Status: d2Status,
        dim3Status: d3Status,
        totalScore
    };
}

// توليد معرف مشارك فريد
function generateParticipantId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `P${timestamp}${random}`;
}

// ============= نقاط نهاية API للمشاركين =============

// إرسال استبيان المشارك
app.post('/api/participant/submit', (req, res) => {
    try {
        const { gender, age, educationLevel, maritalStatus, msDuration, responses } = req.body;

        // التحقق من البيانات
        if (!gender || !age || !educationLevel || !maritalStatus || !msDuration || !responses) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        }

        if (responses.length !== 17) {
            return res.status(400).json({ error: 'يجب الإجابة على جميع الأسئلة (17 سؤال)' });
        }

        // حساب الدرجات
        const scores = calculateScores(responses);

        // توليد معرف المشارك
        const participantId = generateParticipantId();

        // حفظ البيانات
        participantQueries.create.run(
            participantId,
            gender,
            age, // text now
            educationLevel,
            maritalStatus,
            msDuration,
            JSON.stringify(responses),
            scores.totalScore,
            scores.dimension1,
            scores.dimension2,
            scores.dimension3,
            scores.dim1Symptoms,
            scores.dim2Symptoms,
            scores.dim3Symptoms,
            scores.dim1Status,
            scores.dim2Status,
            scores.dim3Status
        );

        // إضافة إشعار
        const notificationMessage = `مشارك جديد أكمل الاستبيان - المعرف: ${participantId}`;
        notificationQueries.create.run(notificationMessage, participantId);

        console.log(`✅ تم حفظ بيانات المشارك: ${participantId}`);

        res.json({
            success: true,
            message: 'تم إرسال بياناتك بنجاح. شكراً لمشاركتك!',
            participantId
        });

    } catch (error) {
        console.error('خطأ في حفظ بيانات المشارك:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ البيانات' });
    }
});

// ============= نقاط نهاية API للإدارة =============

// تسجيل الدخول
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
        }

        // البحث عن المستخدم
        const user = adminQueries.findByUsername.get(username);

        if (!user) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // التحقق من كلمة المرور
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // حفظ الجلسة
        req.session.adminId = user.id;
        req.session.username = user.username;

        res.json({
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            username: user.username
        });

    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
    }
});

// تسجيل الخروج
app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

// التحقق من الجلسة
app.get('/api/admin/check-session', (req, res) => {
    if (req.session.adminId) {
        res.json({
            authenticated: true,
            username: req.session.username
        });
    } else {
        res.json({ authenticated: false });
    }
});

// الحصول على إحصائيات لوحة التحكم
app.get('/api/admin/dashboard-stats', requireAuth, (req, res) => {
    try {
        const allParticipants = participantQueries.getAll.all();
        const completedCount = participantQueries.countCompleted.get().count;
        const latestParticipant = participantQueries.getLatest.get();
        const unreadNotifications = notificationQueries.countUnread.get().count;

        const totalResponses = allParticipants.length;
        const completionRate = totalResponses > 0 ? (completedCount / totalResponses) * 100 : 0;

        res.json({
            totalParticipants: completedCount,
            incompleteParticipants: totalResponses - completedCount,
            totalResponses,
            completionRate: completionRate.toFixed(1),
            latestResponse: latestParticipant ? {
                participantId: latestParticipant.participant_id,
                createdAt: latestParticipant.created_at
            } : null,
            unreadNotifications
        });

    } catch (error) {
        console.error('خطأ في جلب الإحصائيات:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الإحصائيات' });
    }
});

// الحصول على جميع المشاركين
app.get('/api/admin/participants', requireAuth, (req, res) => {
    try {
        const participants = participantQueries.getAll.all();

        // تحويل الردود من نص إلى مصفوفة
        const processedParticipants = participants.map(p => ({
            ...p,
            responses: JSON.parse(p.responses)
        }));

        res.json(processedParticipants);

    } catch (error) {
        console.error('خطأ في جلب المشاركين:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب البيانات' });
    }
});

// الحصول على مشارك واحد
app.get('/api/admin/participants/:id', requireAuth, (req, res) => {
    try {
        const participant = participantQueries.getById.get(req.params.id);

        if (!participant) {
            return res.status(404).json({ error: 'المشارك غير موجود' });
        }

        participant.responses = JSON.parse(participant.responses);
        res.json(participant);

    } catch (error) {
        console.error('خطأ في جلب بيانات المشارك:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب البيانات' });
    }
});

// الحصول على الإحصائيات التحليلية
app.get('/api/admin/analytics', requireAuth, (req, res) => {
    try {
        const byEducation = participantQueries.statsByEducation.all();
        const byDuration = participantQueries.statsByDuration.all();
        const byGender = participantQueries.statsByGender.all();
        const byMaritalStatus = participantQueries.statsByMaritalStatus.all();
        const allParticipants = participantQueries.getAll.all();

        // حساب توزيع الدرجات
        const scoreDistribution = allParticipants.reduce((acc, p) => {
            const range = Math.floor(p.total_score / 10) * 10;
            const key = `${range}-${range + 9}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        res.json({
            byEducation,
            byDuration,
            byGender,
            byMaritalStatus,
            scoreDistribution,
            totalParticipants: allParticipants.length
        });

    } catch (error) {
        console.error('خطأ في جلب التحليلات:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب التحليلات' });
    }
});

// الحصول على الإشعارات
app.get('/api/admin/notifications', requireAuth, (req, res) => {
    try {
        const notifications = notificationQueries.getAll.all();
        res.json(notifications);

    } catch (error) {
        console.error('خطأ في جلب الإشعارات:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الإشعارات' });
    }
});

// تحديد إشعار كمقروء
app.put('/api/admin/notifications/:id/read', requireAuth, (req, res) => {
    try {
        notificationQueries.markAsRead.run(req.params.id);
        res.json({ success: true });

    } catch (error) {
        console.error('خطأ في تحديث الإشعار:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء التحديث' });
    }
});

// تحديد جميع الإشعارات كمقروءة
app.put('/api/admin/notifications/mark-all-read', requireAuth, (req, res) => {
    try {
        notificationQueries.markAllAsRead.run();
        res.json({ success: true });

    } catch (error) {
        console.error('خطأ في تحديث الإشعارات:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء التحديث' });
    }
});

// حذف مشارك
app.delete('/api/admin/participants/:id', requireAuth, (req, res) => {
    try {
        const participantId = req.params.id;

        // التحقق من وجود المشارك
        const participant = participantQueries.getById.get(participantId);
        if (!participant) {
            return res.status(404).json({ error: 'المشارك غير موجود' });
        }

        // حذف المشارك from database
        const deleteStmt = db.prepare('DELETE FROM participants WHERE participant_id = ?');
        deleteStmt.run(participantId);

        console.log(`✅ تم حذف المشارك: ${participantId}`);

        res.json({
            success: true,
            message: 'تم حذف المشارك بنجاح'
        });

    } catch (error) {
        console.error('خطأ في حذف المشارك:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء الحذف' });
    }
});

// تصدير البيانات
app.get('/api/admin/export/:format', requireAuth, (req, res) => {
    try {
        const { format } = req.params;

        if (format === 'json') {
            const participants = participantQueries.getAll.all();
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=ptsd-data.json');
            res.json(participants);

        } else if (format === 'excel') {
            // تحويل إلى ملف Excel حقيقي (.xlsx) باستخدام excel4node
            // هذا يلغي رسائل التحذير ويضمن توافقية كاملة
            const wb = new xl.Workbook();

            // خيارات ورقة العمل (اتجاه اليمين لليسار)
            const ws = wb.addWorksheet('بيانات المشاركين', {
                'sheetView': {
                    'rightToLeft': true
                }
            });

            // أنماط الخلايا
            const headerStyle = wb.createStyle({
                font: {
                    bold: true,
                    color: '#1f2937',
                    size: 12
                },
                fill: {
                    type: 'pattern',
                    patternType: 'solid',
                    fgColor: '#f3f4f6'
                },
                border: {
                    left: { style: 'thin', color: '#e5e7eb' },
                    right: { style: 'thin', color: '#e5e7eb' },
                    top: { style: 'thin', color: '#e5e7eb' },
                    bottom: { style: 'thin', color: '#e5e7eb' }
                },
                alignment: {
                    horizontal: 'center',
                    vertical: 'center'
                }
            });

            const cellStyle = wb.createStyle({
                alignment: {
                    horizontal: 'center',
                    vertical: 'center'
                },
                border: {
                    left: { style: 'thin', color: '#e5e7eb' },
                    right: { style: 'thin', color: '#e5e7eb' },
                    top: { style: 'thin', color: '#e5e7eb' },
                    bottom: { style: 'thin', color: '#e5e7eb' }
                }
            });

            // العناوين
            const headers = [
                'المعرف', 'الجنس', 'العمر', 'المستوى التعليمي', 'الحالة الاجتماعية', 'مدة الإصابة',
                'الدرجة الكلية',
                'درجة البعد 1', 'أعراض البعد 1', 'حالة البعد 1',
                'درجة البعد 2', 'أعراض البعد 2', 'حالة البعد 2',
                'درجة البعد 3', 'أعراض البعد 3', 'حالة البعد 3',
                'تاريخ الإنشاء'
            ];

            // إضافة العناوين
            headers.forEach((header, index) => {
                ws.cell(1, index + 1)
                    .string(header)
                    .style(headerStyle);

                // تخصيص عرض الأعمدة
                let width = 15; // عرض افتراضي
                if (index === 4) width = 20; // الحالة الاجتماعية
                if (index === 5) width = 25; // مدة الإصابة (نص طويل)
                if (index >= 9 && index <= 15) width = 18; // أعمدة الحالة والأعراض
                if (index === 16) width = 20; // التاريخ

                ws.column(index + 1).setWidth(width);
            });

            const participants = participantQueries.getAll.all();

            // إضافة البيانات
            participants.forEach((p, rowIndex) => {
                const r = rowIndex + 2; // نبدأ من الصف الثاني
                const date = new Date(p.created_at).toLocaleString('en-US');

                ws.cell(r, 1).string(p.participant_id || '').style(cellStyle);
                ws.cell(r, 2).string(p.gender || '').style(cellStyle);
                ws.cell(r, 3).string(String(p.age || '')).style(cellStyle);
                ws.cell(r, 4).string(p.education_level || '').style(cellStyle);
                ws.cell(r, 5).string(p.marital_status || '').style(cellStyle);
                ws.cell(r, 6).string(p.ms_duration || '').style(cellStyle);
                ws.cell(r, 7).number(p.total_score || 0).style(cellStyle);

                ws.cell(r, 8).number(p.dimension1_score || 0).style(cellStyle);
                ws.cell(r, 9).string(`${p.dim1_symptoms || 0} من 5`).style(cellStyle);
                ws.cell(r, 10).string(p.dim1_status || '-').style(cellStyle);

                ws.cell(r, 11).number(p.dimension2_score || 0).style(cellStyle);
                ws.cell(r, 12).string(`${p.dim2_symptoms || 0} من 7`).style(cellStyle);
                ws.cell(r, 13).string(p.dim2_status || '-').style(cellStyle);

                ws.cell(r, 14).number(p.dimension3_score || 0).style(cellStyle);
                ws.cell(r, 15).string(`${p.dim3_symptoms || 0} من 5`).style(cellStyle);
                ws.cell(r, 16).string(p.dim3_status || '-').style(cellStyle);

                ws.cell(r, 17).string(date || '').style(cellStyle);
            });

            const filename = 'ptsd-data.xlsx';

            wb.write(filename, res);

        } else if (format === 'csv') {
            // تحويل إلى CSV قياسي (فواصل عادية)
            const participants = participantQueries.getAll.all();
            const delimiter = ',';

            const headers = [
                'المعرف', 'الجنس', 'العمر', 'المستوى التعليمي', 'الحالة الاجتماعية', 'مدة الإصابة',
                'الدرجة الكلية',
                'درجة البعد 1', 'أعراض البعد 1', 'حالة البعد 1',
                'درجة البعد 2', 'أعراض البعد 2', 'حالة البعد 2',
                'درجة البعد 3', 'أعراض البعد 3', 'حالة البعد 3',
                'تاريخ الإنشاء'
            ];

            let csv = headers.join(delimiter) + '\n';

            participants.forEach(p => {
                const row = [
                    p.participant_id,
                    p.gender,
                    p.age,
                    p.education_level,
                    p.marital_status,
                    p.ms_duration,
                    p.total_score,
                    p.dimension1_score,
                    `${p.dim1_symptoms || 0} من 5`,
                    p.dim1_status,
                    p.dimension2_score,
                    `${p.dim2_symptoms || 0} من 7`,
                    p.dim2_status,
                    p.dimension3_score,
                    `${p.dim3_symptoms || 0} من 5`,
                    p.dim3_status
                ];

                // تنسيق التاريخ
                const dateStr = new Date(p.created_at).toLocaleString('en-US');
                row.push(dateStr);

                csv += row.map(val => {
                    const strVal = String(val || '');
                    if (strVal.includes(delimiter) || strVal.includes('"') || strVal.includes('\n')) {
                        return `"${strVal.replace(/"/g, '""')}"`;
                    }
                    return strVal;
                }).join(delimiter) + '\n';
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="ptsd-data.csv"');
            res.send('\uFEFF' + csv);

        } else {
            res.status(400).json({ error: 'صيغة غير مدعومة' });
        }

    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء التصدير' });
    }
});

// ============= المسارات =============

// الصفحة الرئيسية - توجيه إلى صفحة المشاركين
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'participant', 'index.html'));
});

// صفحة تسجيل دخول الإدارة
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

// بدء تشغيل الخادم
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║     منصة بحث اضطراب كرب ما بعد الصدمة                   ║
║     PTSD Research Platform                                ║
║                                                           ║
║     الباحث: باسل البشري                                  ║
║     الجامعة: جامعة الملك عبدالعزيز                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

✅ الخادم يعمل على: http://localhost:${PORT}
✅ صفحة المشاركين: http://localhost:${PORT}
✅ لوحة التحكم: http://localhost:${PORT}/admin

📝 لإنشاء مستخدم إداري، قم بتشغيل:
   npm run create-admin
  `);
});
