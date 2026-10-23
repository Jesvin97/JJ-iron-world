process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://glamore:glamore@localhost:5432/glamore_test?schema=public";
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.APP_URL = "https://reviews.example.test";
process.env.AI_PROVIDER = "mock";
process.env.ALLOW_MOCK_AI = "true";
process.env.TRUST_PROXY = "true";
(process.env as Record<string, string>).NODE_ENV = "test";
delete process.env.GOOGLE_REVIEW_URL;
