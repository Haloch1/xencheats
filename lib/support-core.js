const GAME_ALIASES = new Map([
  ["rainbow six siege", ["rainbow six siege", "rainbow six", "r6s", "r6", "siege"]],
  ["counter-strike 2", ["counter strike 2", "counter-strike 2", "cs2"]],
  ["escape from tarkov", ["escape from tarkov", "tarkov", "eft"]],
  ["call of duty", ["call of duty", "cod", "warzone", "bo6", "bo7"]],
  ["apex legends", ["apex legends", "apex"]],
  ["overwatch 2", ["overwatch 2", "overwatch", "ow2"]],
  ["marvel rivals", ["marvel rivals", "marvel"]],
  ["delta force", ["delta force"]],
  ["battlefield", ["battlefield", "bf6"]],
  ["fortnite", ["fortnite"]],
  ["rust", ["rust"]],
  ["pubg", ["pubg"]],
  ["fragpunk", ["fragpunk"]],
  ["spoofer", ["spoofer", "hwid"]],
]);

const SUPPORT_STOPWORDS = new Set([
  "a", "an", "and", "are", "can", "do", "does", "for", "from", "get", "have",
  "help", "how", "i", "in", "is", "it", "me", "my", "not", "of", "on", "or",
  "please", "product", "the", "this", "to", "with", "work", "working",
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeSupportText(value) {
  return normalize(value);
}

function tokens(value) {
  return normalize(value).split(" ").filter((word) => word && !SUPPORT_STOPWORDS.has(word));
}

function aliasesForProduct(product) {
  const values = new Set([
    product.slug,
    product.name,
    `${product.game || ""} ${product.name || ""}`,
    `${product.category || ""} ${product.name || ""}`,
  ]);
  return [...values].map(normalize).filter(Boolean);
}

function detectGames(query) {
  const normalized = ` ${normalize(query)} `;
  const matches = [];
  for (const [game, aliases] of GAME_ALIASES) {
    if (aliases.some((alias) => normalized.includes(` ${normalize(alias)} `))) matches.push(game);
  }
  return matches;
}

function productGameMatches(product, detectedGames) {
  if (!detectedGames.length) return true;
  const productGame = normalize(product.game || product.category || "");
  return detectedGames.some((game) => productGame.includes(game) || game.includes(productGame));
}

export function resolveSupportProducts(catalog, query, options = {}) {
  const limit = Math.max(1, Number(options.limit || 3));
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return { products: [], ambiguous: false, detectedGames: [] };

  const queryTokens = tokens(normalizedQuery);
  const detectedGames = detectGames(normalizedQuery);
  const scored = catalog.map((product) => {
    const aliases = aliasesForProduct(product);
    const productTokens = new Set(tokens(aliases.join(" ")));
    let score = 0;
    for (const alias of aliases) {
      if (normalizedQuery === alias) score += 100;
      else if (alias.length >= 5 && normalizedQuery.includes(alias)) score += 45;
    }
    for (const word of queryTokens) {
      if (productTokens.has(word)) score += word.length >= 7 ? 9 : 5;
    }
    if (productGameMatches(product, detectedGames)) score += detectedGames.length ? 28 : 0;
    else if (detectedGames.length) score -= 60;
    return { product, score };
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);

  if (!scored.length) return { products: [], ambiguous: false, detectedGames };
  const top = scored[0].score;
  const close = scored.filter((entry) => entry.score >= Math.max(5, top - 4));
  const distinctGames = new Set(close.map((entry) => normalize(entry.product.game || entry.product.category)));
  const ambiguous = !detectedGames.length && close.length > 1 && distinctGames.size > 1;

  return {
    products: (ambiguous ? close : scored).slice(0, limit).map((entry) => entry.product),
    ambiguous,
    detectedGames,
    clarification: ambiguous
      ? `Which game do you mean? I found ${[...new Set(close.map((entry) => entry.product.game || entry.product.category))].join(", ")}.`
      : "",
  };
}

export function buildSupportQuery(currentMessage, history = []) {
  const priorUserMessages = (Array.isArray(history) ? history : [])
    .filter((entry) => entry?.role === "user")
    .map((entry) => String(entry.content || "").trim())
    .filter(Boolean)
    .slice(-6);
  return [...priorUserMessages, String(currentMessage || "").trim()].filter(Boolean).join("\n");
}

export function isSupportTroubleshootingIntent(value) {
  const text = normalize(value);
  return /\b(loader|load|loading|loaded|launch|start|open|inject|injection|error|crash|freeze|frozen|stuck|broken|fail|failed|failing|work|working|setup|install|device|driver|overlay|menu|esp|aimbot|hyper v|virtualization)\b/.test(text)
    && !/^(?:how|where) (?:do |can )?i (?:buy|purchase|get)\b/.test(text);
}

export function isGenericSupportReply(value) {
  const text = normalize(value);
  if (!text) return true;
  return [
    "i can help with products setup orders keys and account issues",
    "tell me the exact product and what you are seeing",
    "tell me the exact product and windows version",
    "i need the exact product and windows version",
  ].some((phrase) => text.includes(phrase));
}

export function getCommonSupportReply(message, history = [], hasAttachment = false) {
  const current = String(message || "").trim();
  const context = buildSupportQuery(current, history).toLowerCase();
  if (/^(bye|goodbye|cya|see you|later)[!. ]*$/i.test(current)) {
    return "Bye! Come back anytime if you need a hand.";
  }
  if (/^(thanks?|thank you|thx|ty|appreciate it|got it|all good|nvm|never ?mind)[!. ]*$/i.test(current)) {
    return "You're welcome!";
  }
  if (/^(hi|hello|hey|yo)[!. ]*$/i.test(current)) {
    return "Hey! What can I help you with?";
  }
  if (/\b(hyper.?v|virtual machine platform|windows hypervisor platform|virtuali[sz]ation)\b/i.test(current)) {
    if (/\b(enable|turn on)\b/i.test(current) && !/\b(disable|turn off)\b/i.test(current)) {
      return "Press Win+R, enter `optionalfeatures`, enable Hyper-V, Virtual Machine Platform, and Windows Hypervisor Platform, then restart. If Windows still keeps the hypervisor off, open an Administrator Terminal, run `bcdedit /set hypervisorlaunchtype auto`, and restart again.";
    }
    return "Press Win+R, enter `optionalfeatures`, uncheck Hyper-V, Virtual Machine Platform, Windows Hypervisor Platform, and Windows Sandbox, then restart. If it is still active, open an Administrator Terminal, run `bcdedit /set hypervisorlaunchtype off`, and restart once more.";
  }
  if (/\b(missing|didn.t get|did not get|where.*key|key.*missing|unfulfilled|not fulfilled)\b/i.test(context)) {
    return "First, sign in to your XenCheats Account page and check both Your Keys and Order History, then refresh once. Make sure you are using the same account that completed checkout. If the order is listed but the key is still missing, tell me what status it shows and I will continue from there. You can optionally paste the Order ID for an exact automatic lookup, but never post your license key or password.";
  }
  if (hasAttachment) {
    return "I can check the screenshot. Tell me the exact product and Windows version too, then I can match the visible error to the right setup steps.";
  }
  return "";
}

export function isDuplicateSupportReply(reply, history = []) {
  const normalizedReply = normalize(reply);
  if (!normalizedReply) return false;
  return (Array.isArray(history) ? history : [])
    .filter((entry) => entry?.role === "assistant")
    .slice(-5)
    .some((entry) => {
      const previous = normalize(entry.content);
      if (!previous) return false;
      if (previous === normalizedReply) return true;
      // Ignore small formatting changes, mentions, and punctuation when the
      // bot has effectively sent the same answer twice.
      const replySentences = normalizedReply.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
      const previousSentences = previous.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
      if (replySentences.length && previousSentences.length
        && replySentences.some((sentence) => sentence.length >= 24 && previousSentences.includes(sentence))) return true;
      const replyWords = new Set(tokens(normalizedReply));
      const previousWords = new Set(tokens(previous));
      if (replyWords.size < 6 || previousWords.size < 6) return false;
      const overlap = [...replyWords].filter((word) => previousWords.has(word)).length;
      return overlap / Math.min(replyWords.size, previousWords.size) >= 0.82;
    });
}

export function classifyTranscriptEvidence(messages = []) {
  const rows = Array.isArray(messages) ? messages : [];
  const customerRows = rows.map((row, index) => ({ ...row, index })).filter((row) => row?.role === "user");
  const staffRows = rows.map((row, index) => ({ ...row, index })).filter((row) => row?.role === "staff");
  const vagueClosure = customerRows.some((row) => /^(thanks?|thank you|ty|thx|appreciate it)[!. ]*$/i.test(String(row.content || "").trim()));
  const usefulStaffRows = staffRows.filter((row) => {
    const content = String(row.content || "").trim();
    return content.length >= 20
      && !/^(close|closed|closing|resolved|done|fixed|try now|check now)[!. ]*$/i.test(content)
      && !/\b(ticket (?:is |was )?(?:closed|resolved)|moving .* inactive)\b/i.test(content);
  });
  const writtenFix = usefulStaffRows.findLast?.((row) => /\b(run|open|disable|enable|turn|restart|delete|download|install|set|use|remove|update|change|allow|uncheck|check)\b/i.test(row.content || ""))
    || [...usefulStaffRows].reverse().find((row) => String(row.content || "").trim().length >= 20);
  const issue = customerRows.find((row) => String(row.content || "").trim().length >= 8);
  const explicitResolution = writtenFix && customerRows.some((row) => row.index > writtenFix.index
    && /\b(fixed|working now|that worked|solved|resolved|got it working)\b/i.test(row.content || ""));
  const reusableIssue = issue && isReusableSupportIssue(issue.content);
  if (explicitResolution && writtenFix && reusableIssue) return { level: "verified", issue, writtenFix };
  if (writtenFix && issue) return { level: "candidate", issue, writtenFix };
  if (vagueClosure) return { level: "tone_only", issue: null, writtenFix: null };
  return { level: "ignore", issue: null, writtenFix: null };
}

function isReusableSupportIssue(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length < 15 || text.length > 900) return false;
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|got it|nvm|never mind)\b/i.test(text)) return false;
  // These are private, transactional, or time-sensitive cases. They should
  // be handled from live order/account data, never reused as generic advice.
  if (/\b(order|invoice|receipt|payment|paid|refund|chargeback|balance|purchase|delivery|stock|price|discount|promo|password|email|license key|activation key|giveaway|account)\b/i.test(text)) return false;
  return /\b(loader|launch|crash|error|fails?|failed|close[sd]?|inject|injection|overlay|hyper.?v|memory integrity|restart|install|download|setting|window|fps|menu|not working|won't|cannot|unable)\b/i.test(text);
}
