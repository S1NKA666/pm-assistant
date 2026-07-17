// Вспомогательная функция для повтора запросов при сбоях (retries with exponential backoff)
export async function retryRequest(fn, maxRetries = 3, delayMs = 1000) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      // Если это ошибка авторизации (401/403) или неверного запроса (400), повторять нет смысла
      const status = error.response?.status;
      if (status === 401 || status === 403 || status === 400 || status === 404) {
        throw error;
      }
      
      if (attempt >= maxRetries) {
        throw error;
      }
      
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.warn(`[RetryHelper] Запрос завершился ошибкой: "${error.message}". Попытка ${attempt}/${maxRetries}. Ожидание ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
