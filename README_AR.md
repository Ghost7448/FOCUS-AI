# FOCUS AI — المرحلة الأولى

هذا مجلد البداية الفعلي لمشروع FOCUS AI. يحتوي على:
- صفحة تعريفية Landing Page.
- تسجيل طالب أو مدرس.
- تسجيل دخول.
- صفحات عمل منفصلة للطالب والمدرس والمسؤول.
- إعداد أولي لربط Supabase.
- ملف SQL مبدئي لجدول الحسابات.

## قبل التشغيل

تحتاجين إلى:
1. تثبيت Node.js إصدار LTS على الكمبيوتر.
2. إنشاء مشروع Supabase.
3. نسخ `.env.example` إلى ملف اسمه `.env.local`.
4. وضع Supabase Project URL وAnon Key داخل `.env.local`.
5. تشغيل `npm install`.
6. تشغيل `npm run dev`.
7. فتح `http://localhost:3000`.

## إعداد Supabase

- افتحي SQL Editor في مشروع Supabase.
- شغّلي محتوى `supabase/schema.sql`.
- من Authentication فعّلي Email provider.
- شغّلي ملف `supabase/schema.sql` كاملًا؛ فهو ينشئ جدول profiles وسياسة قراءة الملف الشخصي وTrigger ينشئ دور الطالب أو المدرس فقط.
- اضبطي Site URL وRedirect URLs على عنوان موقعك المحلي أثناء التطوير.

## ملاحظات مهمة

- هذه Phase 1 وليست المنصة النهائية.
- ملف SQL يتضمن Trigger لإنشاء ملف الطالب أو المدرس، ويمنع التسجيل العام من إنشاء Admin.
- دور Admin لا يُنشأ من التسجيل العام.
- لا تضعي Service Role Key في المتصفح أو في متغير يبدأ بـ NEXT_PUBLIC.
- واجهات الأدوات التي لم تُنفذ بعد موضحة صراحة بأنها قادمة في مراحل لاحقة.
- لا ترفعي بيانات طلاب حقيقية قبل مراجعة سياسات الأمان وإكمال RLS واختبارها.

## أوامر التشغيل

```bash
npm install
npm run dev
```

لإنشاء نسخة إنتاج:

```bash
npm run build
npm start
```
