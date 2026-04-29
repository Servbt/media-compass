export type TelegramClient = {
  sendMessage(chatId: number | string, text: string): Promise<void>
}

export class TelegramBotApiClient implements TelegramClient {
  private readonly botToken: string

  constructor(botToken: string) {
    this.botToken = botToken
  }

  async sendMessage(chatId: number | string, text: string) {
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    })

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed with ${response.status}`)
    }
  }
}
