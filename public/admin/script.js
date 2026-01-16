// JavaScript للوحة التحكم - Admin Dashboard Script

let allParticipants = [];
let filteredParticipants = [];
let notifications = [];
let charts = {};

// التحقق من تسجيل الدخول عند تحميل الصفحة
async function checkAuth() {
    try {
        const response = await fetch('/api/admin/check-session');
        const result = await response.json();

        if (!result.authenticated) {
            window.location.href = '/admin/login.html';
            return false;
        }

        document.getElementById('admin-username').textContent = result.username;
        return true;

    } catch (error) {
        console.error('خطأ في التحقق من الجلسة:', error);
        window.location.href = '/admin/login.html';
        return false;
    }
}

// تحميل البيانات الأولية
async function initDashboard() {
    const isAuth = await checkAuth();
    if (!isAuth) return;

    await loadDashboardStats();
    await loadNotifications();
    await loadParticipants();

    // تحديث البيانات كل 30 ثانية
    setInterval(async () => {
        await loadDashboardStats();
        await loadNotifications();
    }, 30000);
}

// تحميل إحصائيات لوحة التحكم
async function loadDashboardStats() {
    try {
        const response = await fetch('/api/admin/dashboard-stats');
        const stats = await response.json();

        document.getElementById('total-participants').textContent = stats.totalParticipants;
        document.getElementById('incomplete-participants').textContent = stats.incompleteParticipants;
        document.getElementById('total-responses').textContent = stats.totalResponses;
        document.getElementById('completion-rate').textContent = stats.completionRate + '%';

        // عرض آخر استجابة
        const latestResponseDiv = document.getElementById('latest-response');
        if (stats.latestResponse) {
            const date = new Date(stats.latestResponse.createdAt + 'Z');
            latestResponseDiv.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">المعرف</div>
                        <div class="detail-value">${stats.latestResponse.participantId}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">التاريخ</div>
                        <div class="detail-value">${date.toLocaleString('en-US')}</div>
                    </div>
                </div>
            `;
        }

        // تحديث شارة الإشعارات
        const badge = document.getElementById('notification-badge');
        if (stats.unreadNotifications > 0) {
            badge.textContent = stats.unreadNotifications;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }

    } catch (error) {
        console.error('خطأ في تحميل الإحصائيات:', error);
    }
}

// تحميل الإشعارات
async function loadNotifications() {
    try {
        const response = await fetch('/api/admin/notifications');
        notifications = await response.json();

        const notificationList = document.getElementById('notification-list');

        if (notifications.length === 0) {
            notificationList.innerHTML = '<p class="no-data">لا توجد إشعارات</p>';
            return;
        }

        notificationList.innerHTML = notifications.map(n => {
            const date = new Date(n.created_at + 'Z');
            return `
                <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
                    <p>${n.message}</p>
                    <p class="notification-time">${date.toLocaleString('en-US')}</p>
                </div>
            `;
        }).join('');

        // إضافة مستمعات للنقرات
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async function () {
                const id = this.dataset.id;
                await markNotificationAsRead(id);
            });
        });

    } catch (error) {
        console.error('خطأ في تحميل الإشعارات:', error);
    }
}

// تحديد إشعار كمقروء
async function markNotificationAsRead(id) {
    try {
        await fetch(`/ api / admin / notifications / ${id}/read`, {
            method: 'PUT'
        });
        await loadNotifications();
        await loadDashboardStats();
    } catch (error) {
        console.error('خطأ في تحديث الإشعار:', error);
    }
}

// تحديد جميع الإشعارات كمقروءة
async function markAllNotificationsAsRead() {
    try {
        await fetch('/api/admin/notifications/mark-all-read', {
            method: 'PUT'
        });
        await loadNotifications();
        await loadDashboardStats();
    } catch (error) {
        console.error('خطأ في تحديث الإشعارات:', error);
    }
}

// تحميل المشاركين
async function loadParticipants() {
    try {
        const response = await fetch('/api/admin/participants');
        allParticipants = await response.json();
        filteredParticipants = [...allParticipants];

        renderParticipantsTable();
        updateQuickChart();

    } catch (error) {
        console.error('خطأ في تحميل المشاركين:', error);
    }
}

// عرض جدول المشاركين
function renderParticipantsTable() {
    const tbody = document.getElementById('participants-tbody');

    if (filteredParticipants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" class="no-data">لا توجد بيانات</td></tr>';
        tbody.innerHTML = '<tr><td colspan="14" class="no-data">لا توجد بيانات</td></tr>';
        return;
    }

    tbody.innerHTML = filteredParticipants.map((p, index) => {
        // تحويل التاريخ من UTC إلى التوقيت المحلي
        const date = new Date(p.created_at + 'Z'); // إضافة Z لتحديد أنه UTC
        const rowNumber = index + 1; // الترقيم من 1 إلى آخر عنصر
        return `
            <tr>
                <td><strong>${rowNumber}</strong></td>
                <td>${p.participant_id}</td>
                <td>${p.gender}</td>
                <td>${p.age}</td>
                <td>${p.education_level}</td>
                <td>${p.marital_status || '-'}</td>
                <td>${p.ms_duration}</td>
                <td><strong>${p.total_score}</strong></td>
                <td>${p.dimension1_score}</td>
                <td>${p.dimension2_score}</td>
                <td>${p.dimension3_score}</td>
                <td>${date.toLocaleString('en-US')}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-sm btn-secondary" onclick="viewParticipant('${p.participant_id}')">
                            عرض التفاصيل
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteParticipant('${p.participant_id}', ${rowNumber})">
                            🗑️ حذف
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// عرض تفاصيل المشارك
async function viewParticipant(participantId) {
    try {
        const response = await fetch(`/api/admin/participants/${participantId}`);
        const participant = await response.json();

        const modal = document.getElementById('participant-modal');
        const detailsDiv = document.getElementById('participant-details');

        // حساب التفسير السريري
        const interpretation = interpretPTSDScore(participant.total_score, participant.dimension1_score, participant.dimension2_score, participant.dimension3_score);

        detailsDiv.innerHTML = `
            <div class="detail-group">
                <h4>البيانات الديموغرافية</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">المعرف</div>
                        <div class="detail-value">${participant.participant_id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">الجنس</div>
                        <div class="detail-value">${participant.gender}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">العمر</div>
                        <div class="detail-value">${participant.age}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">المستوى التعليمي</div>
                        <div class="detail-value">${participant.education_level}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">الحالة الاجتماعية</div>
                        <div class="detail-value">${participant.marital_status || '-'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">مدة الإصابة</div>
                        <div class="detail-value">${participant.ms_duration}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">تاريخ الإكمال</div>
                        <div class="detail-value">${new Date(participant.created_at + 'Z').toLocaleString('en-US')}</div>
                    </div>
                </div>
            </div>
            
            <div class="detail-group">
                <h4>الدرجات والنتائج</h4>
                <div class="score-summary">
                    <div class="score-card total-score">
                        <div class="score-label">الدرجة الكلية</div>
                        <div class="score-number">${participant.total_score}</div>
                        <div class="score-max">من 68</div>
                    </div>
                    
                    <div class="score-card ${participant.dim1_status === 'متحقق' ? 'status-met' : 'status-unmet'}">
                        <div class="score-label">البعد 1: الاستعادة</div>
                        <div class="score-number">${participant.dimension1_score}</div>
                        <div class="score-sub">الأعراض: ${participant.dim1_symptoms || 0} من 5</div>
                        <div class="score-status">${participant.dim1_status || '-'}</div>
                    </div>

                    <div class="score-card ${participant.dim2_status === 'متحقق' ? 'status-met' : 'status-unmet'}">
                        <div class="score-label">البعد 2: التجنب</div>
                        <div class="score-number">${participant.dimension2_score}</div>
                        <div class="score-sub">الأعراض: ${participant.dim2_symptoms || 0} من 7</div>
                        <div class="score-status">${participant.dim2_status || '-'}</div>
                    </div>

                    <div class="score-card ${participant.dim3_status === 'متحقق' ? 'status-met' : 'status-unmet'}">
                        <div class="score-label">البعد 3: الاستثارة</div>
                        <div class="score-number">${participant.dimension3_score}</div>
                        <div class="score-sub">الأعراض: ${participant.dim3_symptoms || 0} من 5</div>
                        <div class="score-status">${participant.dim3_status || '-'}</div>
                    </div>
                </div>
            </div>
            
            <div class="detail-group">
                <h4>التفسير السريري والنتيجة</h4>
                <div class="interpretation-box ${interpretation.severityClass}">
                    <div class="interpretation-header">
                        <span class="interpretation-icon">${interpretation.icon}</span>
                        <span class="interpretation-level">${interpretation.severity}</span>
                    </div>
                    <div class="interpretation-content">
                        <p><strong>التفسير:</strong> ${interpretation.description}</p>
                        <p><strong>المدى السريري:</strong> ${interpretation.range}</p>
                        <div class="clinical-notes">
                            <strong>ملاحظات إكلينيكية:</strong>
                            <ul>
                                ${interpretation.notes.map(note => `<li>${note}</li>`).join('')}
                            </ul>
                        </div>
                        ${interpretation.recommendation ? `
                            <div class="recommendation">
                                <strong>التوصية:</strong> ${interpretation.recommendation}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="detail-group">
                <h4>تفاصيل الإجابات</h4>
                <div class="detail-grid">
                    ${participant.responses.map((r, i) => `
                        <div class="detail-item">
                            <div class="detail-label">السؤال ${i + 1}</div>
                            <div class="detail-value">${r}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        modal.style.display = 'flex';

    } catch (error) {
        console.error('خطأ في تحميل تفاصيل المشارك:', error);
        alert('حدث خطأ في تحميل التفاصيل');
    }
}

// تفسير درجات PTSD - بناءً على معايير مقياس Davidson
function interpretPTSDScore(totalScore, dim1, dim2, dim3) {
    const interpretation = {
        severity: '',
        severityClass: '',
        icon: '',
        description: '',
        range: '',
        notes: [],
        recommendation: ''
    };

    // تصنيف الشدة بناءً على الدرجة الكلية
    if (totalScore >= 0 && totalScore <= 17) {
        interpretation.severity = 'أعراض خفيفة أو غير موجودة';
        interpretation.severityClass = 'severity-minimal';
        interpretation.icon = '✓';
        interpretation.description = 'الدرجة الكلية تشير إلى أعراض PTSD خفيفة جداً أو غير ملحوظة. إن وجدت، فهي لا تؤثر بشكل كبير على الأداء اليومي.';
        interpretation.range = '0-17 (خفيفة/غير موجودة)';
        interpretation.notes = [
            'الأعراض في هذا المستوى لا تستوفي معايير التشخيص السريري لـ PTSD',
            'قد تكون هناك أعراض متفرقة ولكنها غير مستمرة',
            'الأداء الوظيفي والاجتماعي غير متأثر بشكل ملحوظ'
        ];
    } else if (totalScore >= 18 && totalScore <= 34) {
        interpretation.severity = 'أعراض متوسطة';
        interpretation.severityClass = 'severity-moderate';
        interpretation.icon = '⚠';
        interpretation.description = 'الدرجة تشير إلى وجود أعراض PTSD متوسطة الشدة مرتبطة بالإصابة بالتصلب اللويحي. الأعراض ملحوظة وقد تؤثر على الحياة اليومية.';
        interpretation.range = '18-34 (متوسطة)';
        interpretation.notes = [
            'وجود أعراض واضحة في الأبعاد الثلاثة (الاستعادة، التجنب، فرط الاستثارة)',
            'قد يعاني المشارك من تأثير متوسط على الأداء الاجتماعي والمهني',
            'يُنصح بالمتابعة النفسية والدعم',
            'الأعراض تستدعي الانتباه والتدخل المبكر'
        ];
        interpretation.recommendation = 'يُوصى بالمتابعة النفسية والتقييم الإكلينيكي للمشارك.';
    } else if (totalScore >= 35 && totalScore <= 51) {
        interpretation.severity = 'أعراض شديدة';
        interpretation.severityClass = 'severity-severe';
        interpretation.icon = '⚠⚠';
        interpretation.description = 'الدرجة تشير إلى وجود أعراض PTSD شديدة ومؤثرة بشكل كبير على حياة المشارك. الحالة تتطلب تدخلاً علاجياً فورياً.';
        interpretation.range = '35-51 (شديدة)';
        interpretation.notes = [
            'أعراض شديدة في معظم أو كل الأبعاد الثلاثة',
            'تأثير واضح وكبير على الأداء اليومي والعلاقات الاجتماعية',
            'قد تكون هناك حاجة ماسة للتدخل العلاجي (نفسي ودوائي)',
            'الأعراض مستمرة ومزعجة بشكل كبير'
        ];
        interpretation.recommendation = 'يُوصى بشدة بالتحويل الفوري لطبيب نفسي مختص للتقييم والعلاج.';
    } else if (totalScore >= 52 && totalScore <= 68) {
        interpretation.severity = 'أعراض شديدة جداً (حرجة)';
        interpretation.severityClass = 'severity-extreme';
        interpretation.icon = '🚨';
        interpretation.description = 'الدرجة تشير إلى وجود أعراض PTSD شديدة جداً وحرجة تعيق الأداء الطبيعي بشكل كبير. الحالة تستدعي تدخلاً عاجلاً ومكثفاً.';
        interpretation.range = '52-68 (شديدة جداً/حرجة)';
        interpretation.notes = [
            'أعراض حادة وشديدة جداً في جميع الأبعاد',
            'تعطيل كامل أو شبه كامل للأداء الوظيفي والاجتماعي',
            'خطر محتمل على سلامة المشارك النفسية والجسدية',
            'ضرورة التدخل العلاجي الفوري والمكثف',
            'قد تحتاج الحالة لمتابعة متخصصة مستمرة'
        ];
        interpretation.recommendation = 'ضرورة التحويل العاجل لطبيب نفسي متخصص. الحالة تستدعي تقييماً شاملاً وتدخلاً علاجياً مكثفاً فوراً.';
    }

    // تحليل إضافي للأبعاد
    const dimensionAnalysis = [];
    if (dim1 > 12) dimensionAnalysis.push('ارتفاع ملحوظ في أعراض الاستعادة (الذكريات المؤلمة والكوابيس)');
    if (dim2 > 16) dimensionAnalysis.push('ارتفاع ملحوظ في أعراض التجنب (تجنب الأفكار والأماكن المرتبطة بالحدث)');
    if (dim3 > 12) dimensionAnalysis.push('ارتفاع ملحوظ في أعراض فرط الاستثارة (التوتر والأرق وصعوبة التركيز)');

    if (dimensionAnalysis.length > 0) {
        interpretation.notes.push('', '**تحليل الأبعاد:**');
        dimensionAnalysis.forEach(note => interpretation.notes.push(note));
    }

    return interpretation;
}

// إغلاق النافذة المنبثقة
function closeModal() {
    document.getElementById('participant-modal').style.display = 'none';
}

// حذف مشارك مع تأكيد احترافي
async function deleteParticipant(participantId, rowNumber) {
    // إنشاء نافذة تأكيد احترافية
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal confirm-modal';
    confirmModal.innerHTML = `
        <div class="modal-content confirm-content">
            <div class="confirm-header">
                <div class="confirm-icon warning">⚠️</div>
                <h3>تأكيد الحذف</h3>
            </div>
            <div class="confirm-body">
                <p>هل أنت متأكد من حذف بيانات هذا المشارك؟</p>
                <div class="participant-info">
                    <div class="info-row">
                        <span class="info-label">رقم الصف:</span>
                        <span class="info-value">#${rowNumber}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">المعرف:</span>
                        <span class="info-value">${participantId}</span>
                    </div>
                </div>
                <div class="warning-box">
                    <strong>⚠️ تحذير:</strong> هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع البيانات والإجابات بشكل نهائي.
                </div>
            </div>
            <div class="confirm-actions">
                <button class="btn btn-secondary confirm-cancel" onclick="closeConfirmModal()">
                    إلغاء
                </button>
                <button class="btn btn-danger confirm-delete" onclick="confirmDelete('${participantId}')">
                    <span>🗑️</span> نعم، احذف البيانات
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(confirmModal);
    setTimeout(() => confirmModal.classList.add('show'), 10);
}

// إغلاق نافذة التأكيد
function closeConfirmModal() {
    const modal = document.querySelector('.confirm-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

// تأكيد الحذف
async function confirmDelete(participantId) {
    try {
        // عرض مؤشر تحميل
        const deleteBtn = document.querySelector('.confirm-delete');
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<div class="spinner-small"></div> جاري الحذف...';

        const response = await fetch(`/api/admin/participants/${participantId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            // إغلاق نافذة التأكيد
            closeConfirmModal();

            // عرض رسالة نجاح
            showSuccessMessage('تم حذف بيانات المشارك بنجاح');

            // تحديث البيانات
            await loadParticipants();
            await loadDashboardStats();
        } else {
            throw new Error(result.error || 'فشل الحذف');
        }
    } catch (error) {
        console.error('خطأ في حذف المشارك:', error);
        closeConfirmModal();
        showErrorMessage('حدث خطأ أثناء حذف البيانات. يرجى المحاولة مرة أخرى.');
    }
}

// عرض رسالة نجاح
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success-toast';
    toast.innerHTML = `
        <div class="toast-icon">✓</div>
        <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// عرض رسالة خطأ
function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error-toast';
    toast.innerHTML = `
        <div class="toast-icon">✕</div>
        <div class="toast-message">${message}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// تصفية البيانات
function filterParticipants() {
    const educationFilter = document.getElementById('education-filter').value;
    const durationFilter = document.getElementById('duration-filter').value;
    const genderFilter = document.getElementById('gender-filter').value;
    const maritalFilter = document.getElementById('marital-filter').value;

    filteredParticipants = allParticipants.filter(p => {
        if (educationFilter && p.education_level !== educationFilter) return false;
        if (durationFilter && p.ms_duration !== durationFilter) return false;
        if (genderFilter && p.gender !== genderFilter) return false;
        if (maritalFilter && p.marital_status !== maritalFilter) return false;
        return true;
    });

    renderParticipantsTable();
}

// تحميل التحليلات
async function loadAnalytics() {
    try {
        const response = await fetch('/api/admin/analytics');
        const analytics = await response.json();

        // رسم بياني للمستوى التعليمي
        renderEducationChart(analytics.byEducation);

        // رسم بياني لمدة الإصابة
        renderDurationChart(analytics.byDuration);

        // رسم بياني للجنس
        renderGenderChart(analytics.byGender);

        // رسم بياني للحالة الاجتماعية - استخدام requestAnimationFrame لضمان جاهزية العنصر
        requestAnimationFrame(() => {
            setTimeout(() => {
                console.log('Rendering marital chart...');
                const canvas = document.getElementById('marital-chart');
                console.log('Canvas found:', canvas);
                console.log('Data:', analytics.byMaritalStatus);
                renderMaritalChart(analytics.byMaritalStatus);
            }, 200);
        });

        // رسم بياني لتوزيع الدرجات
        renderScoreDistribution(analytics.scoreDistribution);

    } catch (error) {
        console.error('خطأ في تحميل التحليلات:', error);
    }
}

// رسم بياني للحالة الاجتماعية
function renderMaritalChart(data) {
    const ctx = document.getElementById('marital-chart');
    console.log('Marital Chart - Canvas element:', ctx);
    console.log('Marital Chart - Data:', data);

    if (!ctx) {
        console.error('Marital chart canvas not found!');
        return;
    }

    if (!data || data.length === 0) {
        console.warn('No marital status data available');
        return;
    }

    if (charts.maritalChart) {
        charts.maritalChart.destroy();
    }

    charts.maritalChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(d => d.marital_status || 'غير محدد'),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: [
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    console.log('Marital chart created successfully');
}

// تحديث الرسم البياني السريع
function updateQuickChart() {
    const ctx = document.getElementById('quick-chart');
    if (!ctx) return;

    // تجميع الدرجات في نطاقات
    const ranges = {
        '0-10': 0,
        '11-20': 0,
        '21-30': 0,
        '31-40': 0,
        '41-50': 0,
        '51-60': 0,
        '61-68': 0
    };

    allParticipants.forEach(p => {
        const score = p.total_score;
        if (score <= 10) ranges['0-10']++;
        else if (score <= 20) ranges['11-20']++;
        else if (score <= 30) ranges['21-30']++;
        else if (score <= 40) ranges['31-40']++;
        else if (score <= 50) ranges['41-50']++;
        else if (score <= 60) ranges['51-60']++;
        else ranges['61-68']++;
    });

    if (charts.quickChart) {
        charts.quickChart.destroy();
    }

    charts.quickChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(ranges),
            datasets: [{
                label: 'عدد المشاركين',
                data: Object.values(ranges),
                backgroundColor: 'rgba(102, 126, 234, 0.8)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}



// رسم بياني للمستوى التعليمي
function renderEducationChart(data) {
    const ctx = document.getElementById('education-chart');
    if (!ctx) return;

    if (charts.educationChart) {
        charts.educationChart.destroy();
    }

    charts.educationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.education_level),
            datasets: [{
                label: 'عدد المشاركين',
                data: data.map(d => d.count),
                backgroundColor: 'rgba(16, 185, 129, 0.8)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// رسم بياني لمدة الإصابة
function renderDurationChart(data) {
    const ctx = document.getElementById('duration-chart');
    if (!ctx) return;

    if (charts.durationChart) {
        charts.durationChart.destroy();
    }

    charts.durationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.ms_duration),
            datasets: [{
                label: 'عدد المشاركين',
                data: data.map(d => d.count),
                backgroundColor: 'rgba(245, 158, 11, 0.8)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// رسم بياني للجنس
function renderGenderChart(data) {
    const ctx = document.getElementById('gender-chart');
    if (!ctx) return;

    if (charts.genderChart) {
        charts.genderChart.destroy();
    }

    charts.genderChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(d => d.gender),
            datasets: [{
                data: data.map(d => d.count),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(236, 72, 153, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// رسم بياني لتوزيع الدرجات
function renderScoreDistribution(data) {
    const ctx = document.getElementById('score-distribution-chart');
    if (!ctx) return;

    if (charts.scoreDistributionChart) {
        charts.scoreDistributionChart.destroy();
    }

    const labels = Object.keys(data).sort();
    const values = labels.map(l => data[l]);

    charts.scoreDistributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'عدد المشاركين',
                data: values,
                backgroundColor: 'rgba(139, 92, 246, 0.8)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// تصدير البيانات
async function exportData(format) {
    try {
        // عرض مؤشر تحميل
        const loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="spinner"></div>
                <p>جاري تصدير البيانات...</p>
            </div>
        `;
        document.body.appendChild(loadingOverlay);


        // استخدام iframe مخفي للتنزيل - هذا يمنع ظهور الشاشة السوداء
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `/api/admin/export/${format}`;
        document.body.appendChild(iframe);

        // إزالة loading وعرض رسالة نجاح
        setTimeout(() => {
            document.body.removeChild(loadingOverlay);
            const formatName = format === 'excel' ? 'Excel' : format.toUpperCase();
            showSuccessMessage(`تم بدء تصدير البيانات بصيغة ${formatName}`);

            // إزالة iframe بعد فترة كافية للتأكد من بدء التنزيل
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 10000);
        }, 2000);

    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);

        // إزالة loading overlay في حالة الخطأ
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }

        showErrorMessage('حدث خطأ في تصدير البيانات. يرجى المحاولة مرة أخرى.');
    }
}

// توليد رمز QR
function generateQRCode() {
    const url = window.location.origin;
    const qrDiv = document.getElementById('qr-code');
    const urlInput = document.getElementById('participant-url');

    qrDiv.innerHTML = '';
    urlInput.value = url;

    new QRCode(qrDiv, {
        text: url,
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff'
    });
}

// نسخ الرابط
function copyUrl() {
    const urlInput = document.getElementById('participant-url');
    urlInput.select();
    document.execCommand('copy');
    alert('تم نسخ الرابط بنجاح!');
}

// تحميل رمز QR
function downloadQR() {
    const canvas = document.querySelector('#qr-code canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'ptsd-questionnaire-qr.png';
    link.href = canvas.toDataURL();
    link.click();
}

// طباعة رمز QR
function printQR() {
    const qrDiv = document.getElementById('qr-code');
    const printWindow = window.open('', '', 'height=600,width=800');

    printWindow.document.write('<html><head><title>رمز QR - استبيان PTSD</title>');
    printWindow.document.write('<style>body{text-align:center;padding:50px;}h1{margin-bottom:30px;}</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>رمز QR للوصول إلى الاستبيان</h1>');
    printWindow.document.write(qrDiv.innerHTML);
    printWindow.document.write('<p style="margin-top:30px;">امسح هذا الرمز للوصول إلى استبيان بحث اضطراب كرب ما بعد الصدمة</p>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// تسجيل الخروج
async function logout() {
    try {
        await fetch('/api/admin/logout', {
            method: 'POST'
        });
        window.location.href = '/admin/login.html';
    } catch (error) {
        console.error('خطأ في تسجيل الخروج:', error);
    }
}

// التنقل بين الصفحات
function navigateToPage(pageName) {
    // إخفاء جميع الصفحات
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // إزالة التحديد من جميع عناصر القائمة
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // إظهار الصفحة المطلوبة
    const page = document.getElementById(`${pageName}-page`);
    if (page) {
        page.classList.add('active');
    }

    // تحديد عنصر القائمة
    const navItem = document.querySelector(`[data-page="${pageName}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // حفظ الصفحة الحالية في localStorage
    localStorage.setItem('currentAdminPage', pageName);

    // تحديث عنوان الصفحة
    const titles = {
        'dashboard': 'لوحة التحكم',
        'data': 'إدارة البيانات',
        'analytics': 'التحليلات',
        'export': 'تصدير البيانات',
        'qr': 'رمز QR'
    };

    document.getElementById('page-title').textContent = titles[pageName] || 'لوحة التحكم';

    // تحميل البيانات حسب الصفحة
    if (pageName === 'analytics') {
        loadAnalytics();
    } else if (pageName === 'qr') {
        generateQRCode();
    }
}

// مستمعات الأحداث
document.addEventListener('DOMContentLoaded', function () {
    // تهيئة لوحة التحكم
    initDashboard();

    // استعادة الصفحة الأخيرة من localStorage
    const lastPage = localStorage.getItem('currentAdminPage');
    if (lastPage && lastPage !== 'dashboard') {
        navigateToPage(lastPage);
    }

    // التنقل
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const page = this.dataset.page;
            navigateToPage(page);
        });
    });

    // تسجيل الخروج
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // الإشعارات
    const notificationBtn = document.getElementById('notification-btn');
    const notificationPanel = document.getElementById('notification-panel');

    if (notificationBtn && notificationPanel) {
        notificationBtn.addEventListener('click', function () {
            notificationPanel.style.display =
                notificationPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    // تحديد جميع الإشعارات كمقروءة
    const markAllReadBtn = document.getElementById('mark-all-read');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }

    // التصفية
    const educationFilter = document.getElementById('education-filter');
    const durationFilter = document.getElementById('duration-filter');
    const genderFilter = document.getElementById('gender-filter');

    if (educationFilter) educationFilter.addEventListener('change', filterParticipants);
    if (durationFilter) durationFilter.addEventListener('change', filterParticipants);
    if (genderFilter) genderFilter.addEventListener('change', filterParticipants);

    // إغلاق النافذة المنبثقة بالنقر خارجها
    const modal = document.getElementById('participant-modal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // ============= وظائف القائمة الجانبية للجوال =============
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // فتح/إغلاق القائمة الجانبية
    function toggleSidebar() {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
    }

    // إغلاق القائمة الجانبية
    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
    }

    // زر القائمة للجوال
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleSidebar);
    }

    // إغلاق القائمة عند النقر على الـ overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // إغلاق القائمة عند النقر على أي عنصر في القائمة (للجوال)
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            // إغلاق القائمة فقط على الشاشات الصغيرة
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

    // إغلاق القائمة عند تغيير حجم الشاشة لأكبر من 768px
    window.addEventListener('resize', function () {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
});
