require('dotenv').config();
const Parser = require('rss-parser');
const { GoogleGenAI } = require('@google/genai');
const { google } = require('googleapis');

const parser = new Parser();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. إعداد الاتصال بـ Blogger API
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

// رابط الأداة التي تسوق لها بالعمولة
const AFFILIATE_LINK = "https://your-affiliate-link.com";
const AFFILIATE_TOOL_NAME = "اسم أداة الذكاء الاصطناعي";

async function runAutoBlogger() {
  try {
    console.log("🔍 جاري جلب أحدث الأخبار من المصدر...");
    // جلب أخبار الذكاء الاصطناعي من TechCrunch
    const feed = await parser.parseURL('https://techcrunch.com/category/artificial-intelligence/feed/');
    
    // أخذ أحدث خبر
    const latestNews = feed.items[0];
    console.log(`📌 الخبر الأصلي: ${latestNews.title}`);

    // 2. إرسال الخبر للترجمة وإعادة الصياغة ودمج التسويق بالعمولة
    console.log("🤖 جاري معالجة الخبر وترجمته عبر Gemini...");
    const prompt = `
    أنت صحفي متخصص في تقنيات الذكاء الاصطناعي. قم بمعالجة الخبر التالي:
    العنوان الأصلي: ${latestNews.title}
    المحتوى الأصلي: ${latestNews.contentSnippet || latestNews.content}

    المطلوب:
    1. ترجمة الخبر إلى اللغة العربية وإعادة صياغته بأسلوب صحفي احترافي وسلس جداً.
    2. صياغة عنوان جذاب ومحسّن للبحث (SEO) باللغة العربية.
    3. تقسيم المحتوى إلى فقرات واستخدام عناوين فرعية H2 عند الحاجة.
    4. إضافة فقرة قصيرة في النهاية ترشح أداة "${AFFILIATE_TOOL_NAME}" لاستخدامها في تطبيقات الذكاء الاصطناعي وربطها بالرابط التالي: ${AFFILIATE_LINK}
    5. إرجاع النتيجة بتنسيق JSON فقط بالشكل التالي بدون أي أسطر مضافة:
    {
      "title": "العنوان بالعربية",
      "contentHtml": "محتوى المقال بتنسيق HTML جاهز"
    }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const result = JSON.parse(response.text);

    // إضافة سطر المصدر في نهاية المقال لضمان الاحترافية
    const finalHtml = `
      ${result.contentHtml}
      <hr />
      <p><small>المصدر الأصلي للخبر: <a href="${latestNews.link}" target="_blank" rel="nofollow">${latestNews.blogTitle || 'المصدر'}</a></small></p>
    `;

    // 3. النشر الآلي على بلوجر
    console.log("🚀 جاري نشر المقال على Blogger...");
    const blogResponse = await blogger.posts.insert({
      blogId: process.env.BLOG_ID,
      requestBody: {
        title: result.title,
        content: finalHtml,
        labels: ['أخبار الذكاء الاصطناعي', 'تقنية']
      }
    });

    console.log(`✅ تم نشر المقال بنجاح! الرابط: ${blogResponse.data.url}`);

  } catch (error) {
    console.error("❌ حدث خطأ أثناء التنفيذ:", error);
  }
}

// تشغيل السكريبت
runAutoBlogger();