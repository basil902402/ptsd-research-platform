# دليل النشر - Deployment Guide

<div dir="rtl">

## نظرة عامة

هذا الدليل يوضح كيفية نشر منصة بحث PTSD على خوادم مختلفة.

## الخيار 1: النشر على VPS (الأفضل للإنتاج)

### الخطوة 1: اختيار مزود خدمة

يمكنك استخدام أي من هذه الخدمات:
- **DigitalOcean** (موصى به) - من $5/شهرياً
- **Linode** - من $5/شهرياً
- **AWS Lightsail** - من $3.50/شهرياً
- **Vultr** - من $5/شهرياً

### الخطوة 2: إعداد الخادم

1. **إنشاء Droplet/خادم:**
   - نظام التشغيل: Ubuntu 22.04 LTS
   - الحجم: على الأقل 1GB RAM
   - اختر منطقة قريبة من المستخدمين (الشرق الأوسط إن أمكن)

2. **الاتصال بالخادم عبر SSH:**

```bash
ssh root@your-server-ip
```

3. **تحديث النظام:**

```bash
apt update && apt upgrade -y
```

4. **تثبيت Node.js:**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
```

5. **تثبيت أدوات إضافية:**

```bash
apt install -y git build-essential nginx
```

### الخطوة 3: رفع المشروع

#### الطريقة 1: باستخدام Git (موصى به)

```bash
cd /var/www
git clone YOUR_REPOSITORY_URL ptsd_scale
cd ptsd_scale
npm install
```

#### الطريقة 2: رفع ملفات مباشر

```bash
# على جهازك المحلي
scp -r ptsd_scale root@your-server-ip:/var/www/
```

ثم على الخادم:

```bash
cd /var/www/ptsd_scale
npm install
```

### الخطوة 4: إعداد البيئة

```bash
cp .env.example .env
nano .env
```

عدّل الملف:

```
PORT=3000
NODE_ENV=production
SESSION_SECRET=YOUR_RANDOM_SECRET_HERE
DB_PATH=./database.db
```

⚠️ **مهم:** استخدم مفتاح سري قوي وعشوائي!

### الخطوة 5: تهيئة قاعدة البيانات

```bash
npm run init-db
npm run create-admin
```

### الخطوة 6: إعداد PM2 (لتشغيل الخادم باستمرار)

```bash
npm install -g pm2
pm2 start server.js --name ptsd-platform
pm2 startup
pm2 save
```

### الخطوة 7: إعداد Nginx (Reverse Proxy)

```bash
nano /etc/nginx/sites-available/ptsd
```

أضف:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

تفعيل الموقع:

```bash
ln -s /etc/nginx/sites-available/ptsd /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### الخطوة 8: إعداد SSL (HTTPS)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

✅ **الآن الموقع يعمل على:** `https://your-domain.com`

---

## الخيار 2: النشر على Heroku (سريع وسهل)

### الخطوة 1: إنشاء حساب

1. اذهب إلى [Heroku](https://heroku.com)
2. أنشئ حساب مجاني

### الخطوة 2: تثبيت Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# أو من الموقع
# https://devcenter.heroku.com/articles/heroku-cli
```

### الخطوة 3: تسجيل الدخول

```bash
heroku login
```

### الخطوة 4: إنشاء تطبيق

```bash
cd ptsd_scale
heroku create ptsd-research-platform
```

### الخطوة 5: إضافة ملف Procfile

```bash
echo "web: node server.js" > Procfile
```

### الخطوة 6: تعيين متغيرات البيئة

```bash
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET=YOUR_RANDOM_SECRET
```

### الخطوة 7: النشر

```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

### الخطوة 8: إنشاء مستخدم إداري

```bash
heroku run npm run create-admin
```

✅ **الموقع جاهز:** `https://ptsd-research-platform.herokuapp.com`

---

## الخيار 3: النشر على Railway

### الخطوة 1: إنشاء حساب

1. اذهب إلى [Railway.app](https://railway.app)
2. سجل دخول بـ GitHub

### الخطوة 2: نشر المشروع

1. اضغط "New Project"
2. اختر "Deploy from GitHub repo"
3. حدد مستودع المشروع
4. Railway سيكتشف Node.js تلقائياً

### الخطوة 3: إضافة متغيرات البيئة

في لوحة التحكم:
- اضغط على المشروع
- اذهب إلى "Variables"
- أضف:
  - `NODE_ENV=production`
  - `SESSION_SECRET=YOUR_SECRET`
  - `PORT=3000`

### الخطوة 4: إنشاء مستخدم إداري

استخدم Railway CLI أو عبر الويب Terminal

✅ **الموقع جاهز!**

---

## الخيار 4: النشر على Render

### الخطوة 1: إنشاء حساب

1. اذهب إلى [Render.com](https://render.com)
2. سجل دخول بـ GitHub

### الخطوة 2: إنشاء Web Service

1. اضغط "New +"
2. اختر "Web Service"
3. اربط مستودع GitHub
4. الإعدادات:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`

### الخطوة 3: إضافة متغيرات البيئة

في إعدادات الخدمة، أضف:
- `NODE_ENV=production`
- `SESSION_SECRET=YOUR_SECRET`

### الخطوة 4: النشر

Render سينشر تلقائياً عند كل push إلى GitHub

✅ **الموقع جاهز!**

---

## صيانة وتحديث

### تحديث الكود

#### على VPS:

```bash
cd /var/www/ptsd_scale
git pull
npm install
pm2 restart ptsd-platform
```

#### على Heroku:

```bash
git push heroku main
```

#### على Railway/Render:

فقط قم بـ push إلى GitHub - سيحدث تلقائياً!

### النسخ الاحتياطي

#### نسخ احتياطي لقاعدة البيانات:

```bash
# على الخادم
cp database.db database_backup_$(date +%Y%m%d).db

# تحميل إلى جهازك
scp root@your-server-ip:/var/www/ptsd_scale/database.db ./backup.db
```

### مراقبة الخادم

#### باستخدام PM2:

```bash
pm2 status
pm2 logs ptsd-platform
pm2 monit
```

---

## الأمان

### 1. تأمين SSH

```bash
# تعطيل تسجيل دخول root
nano /etc/ssh/sshd_config
# عدّل: PermitRootLogin no

# استخدم مفاتيح SSH بدلاً من كلمات المرور
```

### 2. Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 3. تحديثات منتظمة

```bash
apt update && apt upgrade -y
```

### 4. مراقبة الوصول

راجع سجلات Nginx بانتظام:

```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## استكشاف المشاكل

### المشكلة: الموقع لا يعمل

```bash
# تحقق من حالة PM2
pm2 status

# تحقق من السجلات
pm2 logs ptsd-platform

# تحقق من Nginx
systemctl status nginx
```

### المشكلة: خطأ في قاعدة البيانات

```bash
# أعد تهيئة قاعدة البيانات
npm run init-db
```

### المشكلة: لا يمكن تسجيل الدخول

```bash
# أنشئ مستخدم إداري جديد
npm run create-admin
```

---

## التكلفة المتوقعة

| الخدمة | التكلفة الشهرية | الميزات |
|--------|-----------------|---------|
| DigitalOcean | $5-10 | كامل التحكم، أداء ممتاز |
| Heroku | $0-7 | سهل، محدود بالخطة المجانية |
| Railway | $0-5 | سهل، سخي بالخطة المجانية |
| Render | $0-7 | سهل، SSL مجاني |

---

## الخلاصة

**للمبتدئين:** استخدم Railway أو Render  
**للإنتاج الجاد:** استخدم DigitalOcean VPS مع Nginx  
**للاختبار السريع:** استخدم Heroku

---

## الدعم

للمساعدة، راجع:
- [README.md](README.md)
- وثائق الخدمة المستخدمة

</div>
