require('dotenv').config();[cite: 1]
const Parser = require('rss-parser');[cite: 1]
const { GoogleGenAI } = require('@google/genai');[cite: 1]
const { google } = require('googleapis');[cite: 1]

const parser = new Parser();[cite: 1]
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });[cite: 1]

// 1. إعداد الاتصال بـ Blogger API
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);[cite: 1]
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });[cite: 1]

const blogger = google.blogger({ version: 'v3', auth: oauth2Client });[cite: 1]

// رابط الأداة التي تسوق لها بالعمولة
const AFFILIATE_LINK = "https://your-affiliate-link.com";[cite: 1]
const AFFILIATE_TOOL_NAME = "اسم أداة الذكاء الاصطناعي";[cite: 1]

// 📡 مصادر الأخبار باللغة العربية المتخصصة في الذكاء الاصطناعي والتقنية
const ARABIC_RSS_SOURCES = [
  'https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%B0%D9%83%D8%A7%D8%A1+%D8%A7%D9%84%D8%A7%D8%B5%D8%B7%D9%86%D8%A7%D8%B9%D9%8A&hl=ar&gl=EG&ceid=EG:ar', // جوجل نيوز - الذكاء الاصطناعي
  'https://news.google.com/rss/search?q=ChatGPT+OpenAI&hl=ar&gl=EG&ceid=EG:ar', // جوجل نيوز - ChatGPT و OpenAI
  'https://aitnews.com/feed/', // البوابة العربية للأخبار التقنية
  'https://www.aljazeera.net/rss/behind-the-news/science-and-technology', // الجزيرة نت - علوم وتكنولوجيا
  'https://www.unlimit-tech.com/feed/', // التقنية بلا حدود
  'https://www.tech-wd.com/wd/feed/', // عالم التقنية
  'https://arageek.com/tech/feed' // أراجيك تك
];[cite: 1]

async function runAutoBlogger() {
  // اختيار مصدر عشوائي من القائمة العربية
  const randomSource = ARABIC_RSS_SOURCES[Math.floor(Math.random() * ARABIC_RSS_SOURCES.length)];[cite: 1]
  console.log(`🔍 جاري جلب أحدث الأخبار من المصدر: ${randomSource}`);[cite: 1]

  const feed = await parser.parseURL(randomSource);[cite: 1]

  // أخذ خبر عشوائي من أول 5 أخبار لمنع التكرار
  const randomIndex = Math.floor(Math.random() * Math.min(5, feed.items.length));[cite: 1]
  const latestNews = feed.items[randomIndex];[cite: 1]
  console.log(`📌 الخبر الأصلي: ${latestNews.title}`);[cite: 1]

  // 2. إرسال الخبر لإعادة الصياغة ودمج التسويق بالعمولة
  console.log("🤖 جاري معالجة الخبر وإعادة صياغته عبر Gemini...");[cite: 1]
  const prompt = `
  أنت صحفي متخصص في تقنيات الذكاء الاصطناعي. قم بمعالجة الخبر العربي التالي:
  العنوان الأصلي: ${latestNews.title}
  المحتوى الأصلي: ${latestNews.contentSnippet || latestNews.content || latestNews.title}

  المطلوب:
  1. إعادة صياغة الخبر بأسلوب صحفي احترافي وسلس جداً باللغة العربية (بدون ترجمة حرفية).
  2. صياغة عنوان جذاب ومحسّن للبحث (SEO) باللغة العربية.
  3. تقسيم المحتوى إلى فقرات واستخدام عناوين فرعية H2 عند الحاجة.
  4. إضافة فقرة قصيرة في النهاية ترشح أداة "${AFFILIATE_TOOL_NAME}" لاستخدامها في تطبيقات الذكاء الاصطناعي وربطها بالرابط التالي: ${AFFILIATE_LINK}
  5. إرجاع النتيجة بتنسيق JSON فقط بالشكل التالي بدون أي أسطر مضافة:
  {
    "title": "العنوان بالعربية",
    "contentHtml": "محتوى المقال بتنسيق HTML جاهز"
  }
  `;[cite: 1]

  // تم تحديث اسم النموذج للنسخة الرسمية الحالية المعتمدة من SDK
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });

  const result = JSON.parse(response.text);[cite: 1]

  // إضافة سطر المصدر في نهاية المقال
  const finalHtml = `
    ${result.contentHtml}
    <hr />
    <p><small>المصدر الأصلي للخبر: <a href="${latestNews.link}" target="_blank" rel="nofollow">${latestNews.blogTitle || 'المصدر'}</a></small></p>
  `;[cite: 1]

  // 3. النشر الآلي على بلوجر
  console.log("🚀 جاري نشر المقال على Blogger...");[cite: 1]
  const blogResponse = await blogger.posts.insert({
    blogId: process.env.BLOG_ID,
    requestBody: {
      title: result.title,
      content: finalHtml,
      labels: ['أخبار الذكاء الاصطناعي', 'تقنية']
    }
  });[cite: 1]

  console.log(`✅ تم نشر المقال بنجاح! الرابط: ${blogResponse.data.url}`);[cite: 1]
  return blogResponse.data.url;[cite: 1]
}

// التصدير الخاص بـ Vercel Serverless Function
module.exports = async (req, res) => {
  try {
    const postUrl = await runAutoBlogger();[cite: 1]
    return res.status(200).json({ 
      success: true, 
      message: "تم نشر المقال بنجاح على Blogger!",
      url: postUrl 
    });[cite: 1]
  } catch (error) {
    console.error("❌ حدث خطأ أثناء التنفيذ:", error);[cite: 1]
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });[cite: 1]
  }
};
