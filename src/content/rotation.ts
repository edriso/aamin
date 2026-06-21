/**
 * تدويرٌ يوميٌّ حتميٌّ مشترك: يختار بندًا من مجموعةٍ ليومٍ بعينه بحيث
 * يظهر كلُّ بندٍ مرّةً كلَّ «طول المجموعة» يومًا بالضبط، ولا يتكرّر بندٌ
 * في يومَين متتاليَين، وتُغطّى المجموعةُ كاملةً قبل أيّ إعادة، وإضافةُ
 * بندٍ تُعيد خلطَ كلِّ المواضع بدل تثبيت القديمة على أيّامها.
 *
 * المعادلة (ولماذا هذه لا قسمةُ الباقي المجرّدة):
 *   n     = عددُ البنود الصالحة (غير الفارغة).
 *   day   = عددُ الأيّام منذ حقبة يونكس بتوقيت البوت (dayNumberIn، لا
 *           «يومُ السنة»: عدّادٌ متّصلٌ لا يُصفَّر رأسَ السنة، فلا «قفزٌ»
 *           ولا تقاربُ تكرارٍ عند ٣١ ديسمبر/١ يناير).
 *   order = خلطٌ حتميٌّ ثابتٌ لـ [0, n) (shuffledOrder)، يعتمد على n.
 *   index = day mod n  ⇒  البند = usable[order[index]].
 *
 * نقيّةٌ تمامًا: بلا Math.random ولا حالةٍ محفوظة، فنفسُ (المجموعة، البذرة،
 * اليوم، المنطقة) يُنتج دائمًا نفسَ الاختيار — مأمونٌ بعد إعادة التشغيل
 * ومتطابقٌ في كلِّ مكان وسهلُ الاختبار. يستعمله تذكيرُ الصباح ومسارُ
 * المهارات، كلٌّ ببذرته الخاصّة (انظر morningReminders.ts و parentingSkills.ts).
 */
import { dayNumberIn } from 'telegram-broadcast-kit';

/**
 * ترتيبٌ ثابتٌ لمؤشّرات [0, n) مُخلوطٌ خلطًا حتميًّا (mulberry32 ثم
 * Fisher–Yates). نقيّةٌ: نفسُ (n, seed) يُنتج دائمًا نفسَ الترتيب. الترتيبُ
 * يعتمد على n، فزيادةُ المجموعة تُعيد خلطَ كلِّ المواضع بدل تثبيت البنود
 * القديمة على أماكنها.
 */
export function shuffledOrder(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  let s = (seed ^ 0x9e3779b9) >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

/**
 * يختار بندًا من `pool` ليومٍ بعينه بالتدوير المشروح أعلاه. يتجاهل البنودَ
 * الفارغة، ويُعيد null لمجموعةٍ خاوية. نقيّةٌ (تأخذ now/tz).
 */
export function pickShuffledForDay(
  pool: readonly string[],
  seed: number,
  now: Date,
  tz: string,
): string | null {
  const usable = pool.filter((item) => item.trim().length > 0);
  const n = usable.length;
  if (n === 0) return null;
  if (n === 1) return usable[0];
  const day = dayNumberIn(now, tz);
  // ((day % n) + n) % n يبقى في المدى حتى لو كان day سالبًا (نظريًّا).
  const index = ((day % n) + n) % n;
  const order = shuffledOrder(n, seed);
  return usable[order[index]];
}
