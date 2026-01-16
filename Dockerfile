# استخدام Node.js 18 Alpine (صورة خفيفة)
FROM node:18-alpine

# تعيين مجلد العمل داخل الحاوية
WORKDIR /app

# نسخ ملفات package.json و package-lock.json
COPY package*.json ./

# تثبيت dependencies للإنتاج فقط
RUN npm install --production

# نسخ باقي ملفات المشروع
COPY . .

# إنشاء مجلد البيانات للـ volume
RUN mkdir -p /data

# تهيئة قاعدة البيانات عند أول تشغيل (إذا لم تكن موجودة)
RUN npm run init-db || true

# فتح المنفذ 3000
EXPOSE 3000

# تعيين متغير البيئة الافتراضي
ENV NODE_ENV=production
ENV DB_PATH=/data/database.db

# تشغيل التطبيق
CMD ["npm", "start"]
