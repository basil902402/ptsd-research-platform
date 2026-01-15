// JavaScript لصفحة المشاركين - Participant Page Script

// البيانات المجمعة
let participantData = {
    gender: '',
    age: '',
    educationLevel: '',
    msDuration: '',
    responses: []
};

// عرض القسم المحدد
function showSection(sectionId) {
    // إخفاء جميع الأقسام
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    // إظهار القسم المطلوب
    document.getElementById(sectionId).classList.add('active');

    // التمرير إلى الأعلى
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// التحقق من صحة البريد الإلكتروني
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// عرض رسالة خطأ
function showError(message) {
    showToast(message, 'error');
}

// عرض رسالة نجاح
function showSuccess(message) {
    showToast(message, 'success');
}

// إنشاء وعرض رسالة منبثقة (Toast)
function showToast(message, type = 'info') {
    // إنشاء العنصر إذا لم يكن موجوداً
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;

    // أيقونة 
    let icon = '';
    if (type === 'error') icon = '<span class="toast-icon">✕</span>';
    else if (type === 'success') icon = '<span class="toast-icon">✓</span>';

    toast.innerHTML = `
        ${icon}
        <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    // الرسوم المتحركة
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // إخفاء بعد 4 ثواني
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// تفعيل/تعطيل زر الموافقة
document.addEventListener('DOMContentLoaded', function () {
    const consentCheckbox = document.getElementById('consent-checkbox');
    const consentBtn = document.getElementById('consent-btn');

    if (consentCheckbox && consentBtn) {
        consentCheckbox.addEventListener('change', function () {
            consentBtn.disabled = !this.checked;
        });

        consentBtn.addEventListener('click', function () {
            showSection('demographic-section');
        });
    }

    // معالجة نموذج البيانات الديموغرافية
    const demographicForm = document.getElementById('demographic-form');
    if (demographicForm) {
        demographicForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // جمع البيانات
            const formData = new FormData(this);
            participantData.gender = formData.get('gender');
            participantData.age = formData.get('age');
            participantData.educationLevel = formData.get('educationLevel');
            participantData.maritalStatus = formData.get('maritalStatus');
            participantData.msDuration = formData.get('msDuration');

            // التحقق من البيانات
            if (!participantData.gender || !participantData.age ||
                !participantData.educationLevel || !participantData.maritalStatus || !participantData.msDuration) {
                showError('يرجى ملء جميع الحقول المطلوبة');
                return;
            }

            // التحقق من العمر (تجاوز التحقق الرقمي القديم لأن القيمة الآن نصية)
            // إذا كنا بحاجة للتحقق من أن القيمة مختارة فهي مشمولة في التحقق السابق

            // الانتقال إلى صفحة المقياس
            showSection('ptsd-section');
        });
    }

    // معالجة نموذج PTSD
    const ptsdForm = document.getElementById('ptsd-form');
    if (ptsdForm) {
        ptsdForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // جمع الإجابات
            const responses = [];
            for (let i = 1; i <= 17; i++) {
                const answer = document.querySelector(`input[name="q${i}"]:checked`);
                if (!answer) {
                    showError(`يرجى الإجابة على السؤال رقم ${i}`);
                    // التمرير إلى السؤال
                    const questionElement = document.querySelector(`input[name="q${i}"]`);
                    if (questionElement) {
                        questionElement.closest('.question-item').scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                    return;
                }
                responses.push(parseInt(answer.value));
            }

            participantData.responses = responses;

            // إرسال البيانات
            await submitData();
        });
    }
});

// إرسال البيانات إلى الخادم
async function submitData() {
    const loadingOverlay = document.getElementById('loading');

    try {
        // إظهار مؤشر التحميل
        loadingOverlay.style.display = 'flex';

        const response = await fetch('/api/participant/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(participantData)
        });

        const result = await response.json();

        // إخفاء مؤشر التحميل
        loadingOverlay.style.display = 'none';

        if (response.ok && result.success) {
            // عرض صفحة الشكر
            showSection('thankyou-section');

            // مسح البيانات
            participantData = {
                gender: '',
                age: '',
                educationLevel: '',
                maritalStatus: '',
                msDuration: '',
                responses: []
            };

            // إعادة تعيين النماذج
            document.getElementById('demographic-form').reset();
            document.getElementById('ptsd-form').reset();
            document.getElementById('consent-checkbox').checked = false;
            document.getElementById('consent-btn').disabled = true;

        } else {
            showError(result.error || 'حدث خطأ أثناء إرسال البيانات. يرجى المحاولة مرة أخرى.');
        }

    } catch (error) {
        // إخفاء مؤشر التحميل
        loadingOverlay.style.display = 'none';

        console.error('خطأ في إرسال البيانات:', error);
        showError('حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
    }
}

// منع إعادة الإرسال عند تحديث الصفحة
window.addEventListener('beforeunload', function (e) {
    const ptsdSection = document.getElementById('ptsd-section');
    if (ptsdSection && ptsdSection.classList.contains('active')) {
        const confirmationMessage = 'لديك بيانات لم يتم حفظها. هل أنت متأكد من الخروج؟';
        e.returnValue = confirmationMessage;
        return confirmationMessage;
    }
});

// تتبع التقدم (اختياري)
function updateProgress() {
    let answeredCount = 0;
    for (let i = 1; i <= 17; i++) {
        const answer = document.querySelector(`input[name="q${i}"]:checked`);
        if (answer) {
            answeredCount++;
        }
    }

    // يمكن إضافة شريط تقدم هنا إذا لزم الأمر
    console.log(`تم الإجابة على ${answeredCount} من 17 سؤال`);
}

// الاستماع لتغييرات الإجابات لتحديث التقدم
document.addEventListener('change', function (e) {
    if (e.target.name && e.target.name.startsWith('q')) {
        updateProgress();
    }
});
