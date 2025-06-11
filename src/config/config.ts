import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  
  // Discord Configuration
  DISCORD_TOKEN: Joi.string().required(),
  DISCORD_CLIENT_ID: Joi.string().required(),
  DISCORD_GUILD_ID: Joi.string().required(),
  
  // Database Configuration
  DATABASE_URL: Joi.string().required(),
  
  // Redis Configuration
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  
  // Application Configuration
  PORT: Joi.number().default(3000),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  
  // Game Configuration
  TOKEN_BASE_PRICE: Joi.number().default(1.0),
  MINING_BASE_RATE: Joi.number().default(0.1),
  BATTLE_COOLDOWN: Joi.number().default(3600),
  DAILY_REWARD_RESET: Joi.number().default(0),
  
  // Security
  RATE_LIMIT_WINDOW: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100)
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  
  discord: {
    token: envVars.DISCORD_TOKEN,
    clientId: envVars.DISCORD_CLIENT_ID,
    guildId: envVars.DISCORD_GUILD_ID
  },
  
  database: {
    url: envVars.DATABASE_URL
  },
  
  redis: {
    url: envVars.REDIS_URL
  },
  
  app: {
    port: envVars.PORT,
    logLevel: envVars.LOG_LEVEL
  },
  
  game: {
    tokenBasePrice: envVars.TOKEN_BASE_PRICE,
    miningBaseRate: envVars.MINING_BASE_RATE,
    battleCooldown: envVars.BATTLE_COOLDOWN,
    dailyRewardReset: envVars.DAILY_REWARD_RESET
  },
  
  security: {
    rateLimitWindow: envVars.RATE_LIMIT_WINDOW,
    rateLimitMaxRequests: envVars.RATE_LIMIT_MAX_REQUESTS
  }
};

export default config;