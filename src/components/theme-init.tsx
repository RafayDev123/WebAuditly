export function ThemeInitScript() {
  const script = `(() => {
    try {
      const saved = localStorage.getItem('theme');
      const isDark = saved ? saved === 'dark' : true;
      document.documentElement.classList.toggle('dark', isDark);
    } catch {
      document.documentElement.classList.add('dark');
    }
  })();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
