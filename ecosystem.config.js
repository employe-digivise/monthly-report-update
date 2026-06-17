module.exports = {
    apps: [
        {
            name: 'monthly-report',
            script: 'execution/server.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            max_memory_restart: '1G',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                // Mirror the (former) Modal deployment env:
                // browser may call the API directly → allow any origin
                ALLOWED_ORIGINS: '*',
                // Insight AI provider (NVIDIA by default). The API key itself is
                // read from .env via dotenv — NOT hardcoded here (keep secrets out of VCS).
                INSIGHT_AI_PROVIDER: 'nvidia',
                // Generate-path auto-fill safety net ON (the /preview-insights
                // endpoint works regardless of this flag). Set '1' to keep generate
                // from ever calling the LLM (preview-only workflow).
                INSIGHT_AI_DISABLED: '0'
            },
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            merge_logs: true,
            time: true
        }
    ]
};
