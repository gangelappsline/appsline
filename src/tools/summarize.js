/**
 * Resumen extractivo ligero (sin servidor ni IA externa).
 *
 * Estrategia: puntuación de frases por frecuencia de términos relevantes
 * (TF normalizado), con bonificaciones por posición y penalización a frases
 * muy cortas o muy largas. Se devuelven las N frases mejor puntuadas en su
 * orden original para conservar la coherencia del texto.
 */

const STOPWORDS = new Set(
  `a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era erais eran eres es esa esas ese eso esos esta estaba estado estan estar este esto estos fue fueron ha hace hacia han hasta hay la las le les lo los mas me mi mis mucho muy no nos nosotros o os otra otro para pero poco por porque que quien se sea segun ser si sin sobre su sus también tanto te tiene tienen todo todos tu tus un una uno unos vosotros y ya
   a about above after again against all am an and any are as at be because been before being below between both but by can cannot could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself me more most my no nor not of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with you your`
    .split(/\s+/)
    .filter(Boolean),
);

const normalize = (word) =>
  word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");

export const splitSentences = (text) =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?¡¿])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"'(0-9])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

export const wordCount = (text) => (text.trim().match(/\S+/g) || []).length;

export function keywords(text, limit = 10) {
  const freq = new Map();
  (text.match(/[\p{L}\p{N}']+/gu) || []).forEach((raw) => {
    const word = normalize(raw);
    if (word.length < 4 || STOPWORDS.has(word)) return;
    freq.set(word, (freq.get(word) || 0) + 1);
  });
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function summarize(text, ratio = 0.25, minSentences = 3) {
  const sentences = splitSentences(text);
  if (sentences.length <= minSentences) return sentences;

  const freq = new Map();
  sentences.forEach((sentence) => {
    (sentence.match(/[\p{L}\p{N}']+/gu) || []).forEach((raw) => {
      const word = normalize(raw);
      if (word.length < 3 || STOPWORDS.has(word)) return;
      freq.set(word, (freq.get(word) || 0) + 1);
    });
  });

  const max = Math.max(1, ...freq.values());

  const scored = sentences.map((sentence, index) => {
    const words = (sentence.match(/[\p{L}\p{N}']+/gu) || [])
      .map(normalize)
      .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
    if (!words.length) return { index, sentence, score: 0 };

    const score = words.reduce((sum, word) => sum + (freq.get(word) || 0) / max, 0) / words.length;
    const positionBonus = index === 0 ? 0.25 : index < 3 ? 0.1 : 0;
    const lengthPenalty = words.length < 5 ? -0.35 : words.length > 60 ? -0.15 : 0;
    const numberBonus = /\d/.test(sentence) ? 0.05 : 0;

    return { index, sentence, score: score + positionBonus + lengthPenalty + numberBonus };
  });

  const keep = Math.max(minSentences, Math.round(sentences.length * ratio));
  return scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, keep)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}

export const readingTime = (text) => Math.max(1, Math.round(wordCount(text) / 200));
