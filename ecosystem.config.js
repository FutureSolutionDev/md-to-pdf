module.exports = {
 apps: [
  {
   name: "md_to_pdf",
   script: "bun",
   args: "run start",
   cwd: ".",
   instances: 1,
   exec_mode: "fork",
   watch: false,
   max_memory_restart: "500M",
   env: {
    NODE_ENV: "production",
    PORT: 3050,
   },
   error_file: "./Logs/pm2-error.log",
   out_file: "./Logs/pm2-out.log",
   log_file: "./Logs/pm2-combined.log",
   time: true,
   autorestart: true,
   max_restarts: 10,
   min_uptime: "10s",
   restart_delay: 1000,
   kill_timeout: 5000,
   listen_timeout: 10000,
   wait_ready: true
  }
 ]
};
