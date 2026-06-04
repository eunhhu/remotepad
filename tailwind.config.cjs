module.exports = {
  content: ["./web/index.html", "./web/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#171b22",
        ink: "#f5f7fa",
        muted: "#9da7b3",
        line: "#303844",
        action: "#2f81f7",
        danger: "#ef4444",
        ok: "#22c55e"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};
