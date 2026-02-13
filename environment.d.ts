declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'production' | undefined;
      TELEGRAM_TOKEN: string;
    }
  }
}

export {}
