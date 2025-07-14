module.exports = {
  name: "dovedale-map", // Name of your application
  script: "server.js", // Entry point of your application
  interpreter: "bun", // Bun interpreter
  env: {
    PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`, // Add "~/.bun/bin/bun" to PATH
  },
  cwd: "~/dovedale-map"
};
