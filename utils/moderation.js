// utils/moderation.js
const customBlockedWords = ['gandu', 'vade', 'sede']; // Add more as needed

function containsCustomBlockedWords(text) {
  return customBlockedWords.some(word =>
    text.toLowerCase().includes(word.toLowerCase())
  );
}

async function checkExternalModeration(text) {
  // Simulate a moderation API (e.g., OpenAI or another)
  // You can replace this with a real API call
  return true; // Assume it's safe for now
}

async function moderateText(text) {
  if (!text || typeof text !== 'string') return true;
  if (containsCustomBlockedWords(text)) return false;

  const externalSafe = await checkExternalModeration(text);
  return externalSafe;
}

module.exports = { moderateText };
