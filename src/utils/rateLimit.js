
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {Error} err 
 * @param {number} attempt
 */
export async function handleGithubError(err, attempt = 1) {
  const maxAttempts = 3;
  const resp = err.response;

  if (resp && (resp.status === 403 || resp.status === 429)) {
    const reset = resp.headers["x-ratelimit-reset"];
    const remaining = resp.headers["x-ratelimit-remaining"];

    if (remaining === "0" && reset) {
      const now = Math.floor(Date.now() / 1000);
      const wait = (parseInt(reset) - now + 1) * 1000;
      console.log(`⚠️ Rate limit reached. Sleeping for ${Math.ceil(wait / 1000)}s...`);
      await sleep(wait);
      return true;
    }
  }

  if (attempt < maxAttempts) {
    const backoff = Math.pow(3, attempt - 1) * 1000; 
    console.log(`⚠️ Request failed, retrying in ${backoff / 1000}s (attempt ${attempt})`);
    await sleep(backoff);
    return true;
  }

  console.error("❌ Request failed after retries:", err.message);
  return false;
}
