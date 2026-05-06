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
                PORT: 3000
            },
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            merge_logs: true,
            time: true
        }
    ]
};
