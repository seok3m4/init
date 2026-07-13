// AppModule tests must not inherit an external startup sync from a developer's local .env.
process.env.NCS_OPEN_API_SYNC_ON_STARTUP = "false";
