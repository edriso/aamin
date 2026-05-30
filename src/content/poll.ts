import type { PollSpec } from '../types';
import { config } from '../config';

/**
 * استبيانُ المساء: محاسبةٌ لطيفة للأب والأمّ قبل النوم — بمَ أكرمَك الله
 * مع أبنائك اليوم؟ مجهولٌ + متعدّد الإجابات، فلا أحد (ولا حتى البوت) يرى
 * من صوّت، إنما تظهر النِّسَب العامّة فقط. لا قاعدة بيانات ولا رياء.
 *
 * يُبنى عند كلِّ إرسالٍ بـ buildParentingPoll: قائمةُ BASE_OPTIONS واحدة
 * تُحقَن فيها إضافاتُ اليوم من OPTIONS_BY_DAY (بمفتاح يوم الأسبوع في
 * TZ_NAME). إضافةُ يومٍ آخر لاحقًا = سطرٌ واحد في ذلك الجدول، دون أيّ
 * تفريعٍ في الدالة، وجدولٌ واحد + مفتاح حالةٍ واحد يُبقيان حذفَ نسخةِ
 * الأمس عند نشر اليوم بسيطًا.
 *
 * حدود تيليجرام: السؤال <=300 حرفًا، والخيارات ٢..١٠، كلٌّ <=100. أبقِ
 * الإيموجي في آخِر كلِّ خيار (الإيموجي في أوّله يصطدم بنسبة التصويت التي
 * يُلحقها تيليجرام)، واترك هامشًا بسيطًا (rtlIsolate في lib/post.ts يضيف
 * حرفين).
 *
 * مبدأ الصياغة: كلُّ خيارٍ جُهدٌ صادقٌ تستطيع التأشير عليه بلا كذبٍ ولا
 * إحساسٍ بالتقصير («ولو قليلًا»)، لا ادّعاءَ كمال.
 */

const QUESTION =
  'حاسِب نفسك قبل النوم: بمَ أكرمَك الله مع أبنائك اليوم؟ (سرّي مجهول؛ أشِّر بصدقٍ على ما فعلت، وانوِ بمشاركتك تشجيعَ غيرك من الآباء والأمهات) 📋';

// القائمةُ العامّة التي تُعرَض كلَّ ليلة، بهذا الترتيب المقصود. مصدرٌ
// واحد: الأيامُ الخاصّة تحقن إضافاتها فيها عبر OPTIONS_BY_DAY بدل إعادة
// تعريف القائمة.
const BASE_OPTIONS: readonly string[] = [
  'عانقتُ أبنائي وقبّلتُهم وأظهرتُ لهم حبّي 🤍',
  'لاعبتُهم وأدخلتُ السرور عليهم ولو قليلًا 🎈',
  'أنصتُّ لأحدهم باهتمامٍ ونظرتُ في عينيه وهو يحدّثني 👂',
  'مَلكتُ غضبي ولِنتُ لهم ولم أرفع صوتي 🌿',
  'عدلتُ بينهم ولم أُفضّل أحدًا في عطفي أو عطائي ⚖️',
  'أوفيتُ بوعدي لهم، ولم أَعِدهم بما لا أفي به 🤝',
  'دعوتُ لهم بالصلاح، وحفظتُ لساني أن أدعوَ عليهم 🤲',
  'شجّعتُهم على الخير برفقٍ، وعلّمتُهم شيئًا من دينهم 🕌',
  'أثنيتُ على مجهودهم، ونوّمتُهم على طمأنينةٍ وأمان 🌙',
];

/** خيارٌ إضافيٌّ يُحقَن في القائمة في يومٍ بعينه. */
interface DayOption {
  /** نصُّ الخيار (الإيموجي في آخِره؛ ابقَ تحت ١٠٠ حرف). */
  option: string;
  /**
   * يُدرَج مباشرةً بعد الخيار الأساسيّ المساوي لهذا النصّ، ليقع في موضعه
   * المقصود من الترتيب. اترُكه ليُلحَق في الآخِر. مرساةٌ مجهولة تُطلِق
   * خطأً، فالغلطُ يُسقِط الاختبار بدل أن يَشحَن استبيانًا مختلّ الترتيب.
   */
  after?: string;
}

// تُدرَج إضافةُ نهاية الأسبوع قبل بند ما قبل النوم (آخِر بند).
const WEEKEND_ANCHOR = 'شجّعتُهم على الخير برفقٍ، وعلّمتُهم شيئًا من دينهم 🕌';

// يومُ الأسبوع في TZ_NAME (0=أحد .. 6=سبت) => خيارات تُضاف ذلك اليوم.
// نقطةُ التعديل لإضافات الأيام: أضِف مفتاحًا هنا، ولا تحتاج
// buildParentingPoll إلى أيّ تغيير. الجمعةُ والسبتُ عطلةُ نهاية الأسبوع
// في أكثر بلاد العرب، فنضيف فيهما بندَ وقت العائلة.
const WEEKEND_FAMILY: DayOption = {
  option: 'خصّصتُ وقتًا ممتعًا للعائلة (نزهةً أو جلسةً نتسامر فيها) 🌳',
  after: WEEKEND_ANCHOR,
};
const OPTIONS_BY_DAY: Record<number, readonly DayOption[]> = {
  5: [WEEKEND_FAMILY], // الجمعة
  6: [WEEKEND_FAMILY], // السبت
};

/** يومُ الأسبوع في `tz` (0=أحد..6=سبت) عبر Intl، لا Date.getDay()، حتى
 *  يكون «الجمعة» جمعةً في TZ_NAME لا على المضيف (غالبًا UTC). */
function weekdayInTz(now: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

/** يحقن كلَّ إضافةِ يومٍ في القائمة عند مرساتها (انظر DayOption). */
function applyDayOptions(base: readonly string[], extras: readonly DayOption[]): string[] {
  const options = [...base];
  for (const { option, after } of extras) {
    if (after === undefined) {
      options.push(option);
      continue;
    }
    const at = options.indexOf(after);
    if (at === -1) {
      throw new Error(`parenting poll: anchor option not found: ${after}`);
    }
    options.splice(at + 1, 0, option);
  }
  return options;
}

/**
 * يبني استبيانَ ليلةٍ بعينها. الافتراضُ الآن + config.timezone، فيناديه
 * المُجدوِل بلا وُسطاء؛ والوُسطاء موجودون للاختبارات.
 */
export function buildParentingPoll(now: Date = new Date(), tz: string = config.timezone): PollSpec {
  const day = weekdayInTz(now, tz);
  const extras = OPTIONS_BY_DAY[day] ?? [];
  const options = applyDayOptions(BASE_OPTIONS, extras);

  return {
    question: QUESTION,
    options,
    isAnonymous: true,
    allowsMultipleAnswers: true,
    closeAfterHours: 22,
  };
}
