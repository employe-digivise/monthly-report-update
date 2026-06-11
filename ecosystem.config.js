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
                // Claude insight auto-fill off until Anthropic credits topped up
                INSIGHT_AI_DISABLED: '1'
            },
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            merge_logs: true,
            time: true
        }
    ]
};
