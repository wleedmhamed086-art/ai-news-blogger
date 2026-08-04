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

const AFFILIATE_LINK = "https://your-affiliate-link.com";
const AFFILIATE_TOOL_NAME = "اسم أداة الذكاء الاصطناعي";

// 📡 مصادر الأخبار العربية
const ARABIC_RSS_SOURCES = [
  'https://news.google.com/rss/search?q=%D8%A7%D9%84%D8%B0%D9%83%D8%A7%D8%A1+%D8%A7%D9%84%D8%A7%D8%B5%D8%B7%D9%86%D8%A7%D8%B9%D9%8I&hl=ar&gl=EG&ceid=EG:ar',
  'https://news.google.com/rss/search?q=ChatGPT+OpenAI&hl=ar&gl=EG&ceid=EG:ar',
  'https://aitnews.com/feed/',
  'https://www.aljazeera.net/rss/behind-the-news/science-and-technology',
  'https://www.unlimit-tech.com/feed/',
  'https://www.tech-wd.com/wd/feed/',
  'https://arageek.com/tech/feed'
];

async function runAutoBlogger() {
  const randomSource = ARABIC_RSS_SOURCES[Math.floor(Math.random() * ARABIC_RSS_SOURCES.length)];
  console.log(`🔍 جاري جلب أحدث الأخبار من المصدر: ${randomSource}`);

  const feed = await parser.parseURL(randomSource);
  if (!feed.items || feed.items.length === 0) {
    throw new Error("لم يتم العثور على أخبار في هذا المصدر.");
  }

  const randomIndex = Math.floor(Math.random() * Math.min(5, feed.items.length));
  const latestNews = feed.items[randomIndex];
  console.log(`📌 الخبر الأصلي: ${latestNews.title}`);

  console.log("🤖 جاري معالجة الخبر وإعادة صياغته عبر Gemini...");
  const prompt = `
  أنت صحفي متخصص في تقنيات الذكاء الاصطناعي. قم بمعالجة الخبر العربي التالي:
  العنوان الأصلي: ${latestNews.title}
  المحتوى الأصلي: ${latestNews.contentSnippet || latestNews.content || latestNews.title}

  المطلوب:
  1. إعادة صياغة الخبر بأسلوب صحفي احترافي وسلس جداً باللغة العربية.
  2. صياغة عنوان جذاب ومحسّن للبحث (SEO) باللغة العربية.
  3. تقسيم المحتوى إلى فقرات واستخدام عناوين فرعية H2 عند الحاجة.
  4. إضافة فقرة قصيرة في النهاية ترشح أداة "${AFFILIATE_TOOL_NAME}" لاستخدامها في تطبيقات الذكاء الاصطناعي وربطها بالرابط التالي: ${AFFILIATE_LINK}
  5. إرجاع النتيجة بتنسيق JSON فقط بالشكل التالي:
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

  // معالجة وتنظيف نص الـ JSON المرجَع من النموذج
  let rawText = response.text.trim();
  if (rawText.startsWith('```json')) {
    rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const result = JSON.parse(rawText);

  const finalHtml = `
    ${result.contentHtml}
    <hr />
    <p><small>المصدر الأصلي للخبر: <a href="${latestNews.link}" target="_blank" rel="nofollow">${latestNews.blogTitle || 'المصدر'}</a></small></p>
  `;

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
  return blogResponse.data.url;
}

// التصدير القياسي المعتمد في Vercel مع Node.js
module.exports = async (req, res) => {
  try {
    const postUrl = await runAutoBlogger();
    return res.status(200).json({ 
      success: true, 
      message: "تم نشر المقال بنجاح على Blogger!",
      url: postUrl 
    });
  } catch (error) {
    console.error("❌ حدث خطأ أثناء التنفيذ:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal Server Error"
    });
  }
};

